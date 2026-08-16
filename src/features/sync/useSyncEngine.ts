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

import { drain, type DrainOutcome } from '../../data/outbox/drain';
import { oldestPendingAt, pendingCount, permanentFailures } from '../../data/outbox/queue';
import { queryKeys } from '../../data/queries/client';
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
  });

  const inFlight = useRef(false);

  const refreshCounts = useCallback(() => {
    if (!accountId) return;
    setState((previous) => ({
      ...previous,
      pending: pendingCount(accountId),
      oldestPendingAt: oldestPendingAt(accountId),
      corrections: permanentFailures(accountId),
      online: isOnline(),
    }));
  }, [accountId]);

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
      if (next.online) void run('reconnect');
    });
  }, [run]);

  // --- trigger: foreground ------------------------------------------------
  useEffect(() => {
    const handler = (status: AppStateStatus) => {
      if (status !== 'active') return;
      void refreshConnectivity().then(() => run('foreground'));
    };
    const subscription = AppState.addEventListener('change', handler);
    return () => subscription.remove();
  }, [run]);

  // --- trigger: timer -----------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => void run('timer'), TIMER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [run]);

  // --- initial ------------------------------------------------------------
  useEffect(() => {
    refreshCounts();
    void run('startup');
  }, [refreshCounts, run]);

  return {
    ...state,
    /** The offline indicator's button. */
    syncNow: () => run('manual'),
    refreshCounts,
  };
}
