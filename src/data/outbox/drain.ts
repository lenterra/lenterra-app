/**
 * Draining the outbox.
 *
 * Serialised, resumable, and partial-success by design. Items leave the queue
 * only after a confirmed result, so an interruption at any point leaves it
 * consistent — the worst case is a retry, which the idempotency key makes free.
 */

import { RpcError, rpc } from '../nakama/rpc';
import { config } from '../../lib/config';
import * as queue from './queue';
import { isPermanent, needsRecovery, type OutboxItem } from './types';

export interface SyncResult {
  idempotencyKey: string;
  status: 'applied' | 'duplicate' | 'rejected';
  error?: { code: string; message: string };
  data?: unknown;
}

export interface SyncSummary {
  points: number;
  streakDays: number;
  rank: number | null;
}

export interface SyncPushResponse {
  results: SyncResult[];
  summary?: SyncSummary;
  serverTime?: string;
}

export interface DrainOutcome {
  sent: number;
  applied: number;
  rejected: number;
  remaining: number;
  /** Set when the drain stopped early and why. */
  stoppedBecause?: 'offline' | 'unauthenticated' | 'catalog_stale' | 'error';
}

export interface DrainHooks {
  /** Apply an authoritative server result over the provisional one. */
  onApplied?: (item: OutboxItem, data: unknown) => void;
  /** Show the student a correction, once, in plain language. */
  onCorrection?: (item: OutboxItem, error: { code: string; message: string }) => void;
  onSummary?: (summary: SyncSummary) => void;
  /** Pull the catalog and return true if it changed. */
  refreshCatalog?: () => Promise<boolean>;
}

/** One drain at a time, per account. */
const draining = new Set<string>();

export function isDraining(accountId: string): boolean {
  return draining.has(accountId);
}

export async function drain(
  accountId: string,
  hooks: DrainHooks = {},
): Promise<DrainOutcome> {
  const outcome: DrainOutcome = { sent: 0, applied: 0, rejected: 0, remaining: 0 };

  if (draining.has(accountId)) {
    outcome.remaining = queue.pendingCount(accountId);
    return outcome;
  }

  draining.add(accountId);
  let catalogRetried = false;

  try {
    // A previous run may have died mid-send. Those items are safe to retry.
    queue.recoverInflight(accountId);

    for (;;) {
      const batch = queue.take(accountId);
      if (batch.length === 0) break;

      queue.markInflight(accountId, batch.map((item) => item.id));

      let response: SyncPushResponse;

      try {
        response = await rpc(accountId, 'v1.sync.push', {
          batchId: `${accountId}-${Date.now()}`,
          clientVersion: config.clientVersion,
          items: batch.map((item) => ({
            kind: item.kind,
            idempotencyKey: item.id,
            deviceSeq: item.deviceSeq,
            payload: item.payload,
          })),
        });
      } catch (err) {
        const rpcError = err instanceof RpcError ? err : new RpcError('UNAVAILABLE', String(err));

        // The whole batch failed to reach the server or was refused wholesale.
        // Nothing is removed; every item goes back to pending with backoff.
        for (const item of batch) {
          queue.backoff(accountId, item.id, { code: rpcError.code, message: rpcError.message });
        }

        const recovery = needsRecovery(rpcError.code);
        if (recovery === 'catalog' && hooks.refreshCatalog && !catalogRetried) {
          catalogRetried = true;
          await hooks.refreshCatalog();
          continue; // one retry after pulling the catalog
        }

        outcome.stoppedBecause =
          rpcError.code === 'OFFLINE'
            ? 'offline'
            : rpcError.code === 'UNAUTHENTICATED'
              ? 'unauthenticated'
              : recovery === 'catalog'
                ? 'catalog_stale'
                : 'error';
        break;
      }

      outcome.sent += batch.length;
      const byId = new Map(batch.map((item) => [item.id, item]));

      for (const result of response.results ?? []) {
        const item = byId.get(result.idempotencyKey);
        if (!item) continue;

        if (result.status === 'applied' || result.status === 'duplicate') {
          queue.remove(accountId, item.id);
          outcome.applied += 1;
          if (result.data !== undefined) hooks.onApplied?.(item, result.data);
          continue;
        }

        const error = result.error ?? { code: 'UNAVAILABLE', message: 'Rejected' };

        if (isPermanent(error.code)) {
          // Terminal. The student is told what happened rather than watching
          // points silently vanish.
          queue.markPermanent(accountId, item.id, error);
          outcome.rejected += 1;
          hooks.onCorrection?.(item, error);
        } else {
          queue.backoff(accountId, item.id, error);
        }
      }

      if (response.summary) hooks.onSummary?.(response.summary);

      // Every item in the batch came back non-applied and non-permanent —
      // sending the same batch again immediately would spin.
      const stillReady = queue.take(accountId);
      if (stillReady.length > 0 && stillReady[0]?.id === batch[0]?.id) break;
    }
  } finally {
    draining.delete(accountId);
  }

  outcome.remaining = queue.pendingCount(accountId);
  return outcome;
}
