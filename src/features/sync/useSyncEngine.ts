/**
 * Drain triggers (TRD-SYNC-007).
 *
 * The queue drains when connectivity returns, when the app comes to the
 * foreground, on a fifteen-minute timer while online with work waiting, and on
 * explicit request.
 *
 * The manual trigger matters more than it looks. A student standing in the one
 * corner of the school with signal wants to push their work *now*, and telling
 * them to wait for a timer is a bad answer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  deferredUpdate,
  syncCatalog,
  type CatalogProgress,
  type CatalogSyncResult,
} from '../../data/cache/catalogSync';
import { drain, type DrainOutcome } from '../../data/outbox/drain';
import { oldestPendingAt, pendingCount, permanentFailures } from '../../data/outbox/queue';
import { storeAssignments, type Assignment } from '../../data/cache/assignments';
import { queryKeys } from '../../data/queries/client';
import { rpc } from '../../data/nakama/rpc';
import { isOnline, onConnectivityChange, refreshConnectivity } from '../../lib/net';
import type { OutboxItem } from '../../data/outbox/types';

const TIMER_INTERVAL_MS = 15 * 60 * 1000;

export interface SyncState {
  pending: number;
  oldestPendingAt: number | null;
  syncing: boolean;
  online: boolean;
  /** Items the student needs to be told about, once. */
  corrections: OutboxItem[];
  lastOutcome: DrainOutcome | null;
  /** Non-null only while content is downloading. */
  catalogProgress: CatalogProgress | null;
  /** An update we declined to take automatically, for the student to accept. */
  catalogUpdateWaiting: { version: string; bytes: number } | null;
}

export function useSyncEngine(accountId: string | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SyncState>({
    pending: 0,
    oldestPendingAt: null,
    syncing: false,
    online: isOnline(),
    corrections: [],
    lastOutcome: null,
    catalogProgress: null,
    catalogUpdateWaiting: null,
  });

  const inFlight = useRef(false);
  const catalogInFlight = useRef(false);

  const refreshCounts = useCallback(() => {
    if (!accountId) return;
    const waiting = deferredUpdate(accountId);
    setState((previous) => ({
      ...previous,
      pending: pendingCount(accountId),
      oldestPendingAt: oldestPendingAt(accountId),
      corrections: permanentFailures(accountId),
      online: isOnline(),
      catalogUpdateWaiting: waiting ? { version: waiting.version, bytes: waiting.bytes } : null,
    }));
  }, [accountId]);

  /**
   * Pull content (TRD-SYNC-012).
   *
   * Runs on the same triggers as the outbox drain but independently of it: a
   * student with nothing queued still needs the catalog, and that is precisely
   * the student on their first session, who has nothing to play until this
   * completes.
   */
  const pullCatalog = useCallback(
    async (force = false): Promise<CatalogSyncResult | null> => {
      if (!accountId || catalogInFlight.current || !isOnline()) return null;

      catalogInFlight.current = true;
      try {
        const result = await syncCatalog(accountId, {
          force,
          onProgress: (progress) => setState((prev) => ({ ...prev, catalogProgress: progress })),
        });

        setState((prev) => ({
          ...prev,
          catalogProgress: null,
          catalogUpdateWaiting:
            result.status === 'deferred' ? { version: result.version, bytes: result.bytes } : null,
        }));

        if (result.status === 'updated') {
          // Recommendations and progress are keyed to a catalog version, so
          // they are stale the moment the content underneath them changes.
          void queryClient.invalidateQueries({ queryKey: queryKeys.recommendationsAll(accountId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.progress(accountId) });
        }
        return result;
      } catch {
        setState((prev) => ({ ...prev, catalogProgress: null }));
        return null;
      } finally {
        catalogInFlight.current = false;
      }
    },
    [accountId, queryClient],
  );

  /**
   * Pull what the server has for this student.
   *
   * Assignments are the reason this exists: `v1.sync.pull` is the only channel
   * that carries one to a device, and until now nothing called it, so the whole
   * assignment feature was complete on the server and invisible here.
   *
   * Failures are swallowed on purpose. This runs on every reconnect and every
   * foreground, and a student who has no teacher assignment — most of them,
   * most of the time — must never see an error because a background pull did
   * not land.
   */
  const pullServerState = useCallback(async (): Promise<void> => {
    if (!accountId || !isOnline()) return;

    try {
      const result = await rpc<{ changes?: { assignments?: Assignment[] } }>(
        accountId,
        'v1.sync.pull',
        { cursor: null },
      );
      storeAssignments(accountId, result.changes?.assignments ?? [], Date.now());
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignments(accountId) });
    } catch {
      // Keep whatever was pulled last. A stale assignment list is far better
      // than an empty one, which reads as "your teacher has assigned nothing".
    }
  }, [accountId, queryClient]);

  const run = useCallback(
    async (reason: string): Promise<DrainOutcome | null> => {
      if (!accountId || inFlight.current) return null;
      if (!isOnline()) return null;
      if (pendingCount(accountId) === 0) return null;

      inFlight.current = true;
      setState((previous) => ({ ...previous, syncing: true }));

      try {
        const outcome = await drain(accountId, {
          onSummary: () => {
            // The authoritative numbers have moved. Invalidating rather than
            // patching keeps one source of truth for what the student sees.
            void queryClient.invalidateQueries({ queryKey: queryKeys.progress(accountId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.points(accountId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap(accountId) });
          },
        });

        setState((previous) => ({ ...previous, lastOutcome: outcome, syncing: false }));
        refreshCounts();
        return outcome;
      } catch {
        setState((previous) => ({ ...previous, syncing: false }));
        return null;
      } finally {
        inFlight.current = false;
        void reason;
      }
    },
    [accountId, queryClient, refreshCounts],
  );

  // --- trigger: connectivity regained ------------------------------------
  useEffect(() => {
    return onConnectivityChange((next) => {
      setState((previous) => ({ ...previous, online: next.online }));
      if (next.online) {
        void run('reconnect');
        void pullCatalog();
        void pullServerState();
      }
    });
  }, [run, pullCatalog, pullServerState]);

  // --- trigger: foreground ------------------------------------------------
  useEffect(() => {
    const handler = (status: AppStateStatus) => {
      if (status !== 'active') return;
      void refreshConnectivity().then(() => {
        void run('foreground');
        void pullCatalog();
        void pullServerState();
      });
    };
    const subscription = AppState.addEventListener('change', handler);
    return () => subscription.remove();
  }, [run, pullCatalog, pullServerState]);

  // --- trigger: timer -----------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => void run('timer'), TIMER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [run]);

  // --- initial ------------------------------------------------------------
  useEffect(() => {
    refreshCounts();
    void run('startup');
    // Ordered after the drain deliberately: a queued attempt belongs to the
    // catalog version it was played against, and pushing it before the version
    // moves keeps that pairing obvious on both sides.
    void pullCatalog();
    // Last, and after the drain: an assignment list pulled before this
    // student's own work has been pushed would be a picture of the server
    // before it knew what they had done.
    void pullServerState();
  }, [refreshCounts, run, pullCatalog, pullServerState]);

  return {
    ...state,
    /** The offline indicator's button. */
    syncNow: () => run('manual'),
    /** "Download now" on a deferred update — the student overriding the budget. */
    downloadCatalogNow: () => pullCatalog(true),
    refreshCounts,
    pullServerState,
  };
}
