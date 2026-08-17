/**
 * The query client.
 *
 * `gcTime: Infinity` plus MMKV persistence is what makes cached data render
 * instantly with no spinner, across app restarts and not just within a session
 * (PRD-ACC-018). On a device that is offline more often than not, a spinner
 * over data we already have is a bug.
 */

import { QueryClient, type QueryKey } from '@tanstack/react-query';

import { ACCOUNT_KEYS, accountStorage, readJson, writeJson } from '../cache/storage';
import { RpcError } from '../nakama/rpc';

const HOUR = 60 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cached data is shown immediately and refreshed behind it.
        staleTime: 60_000,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        // Reconnect is the moment worth refetching on: it is when the data can
        // actually have changed from the student's point of view.
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          if (error instanceof RpcError && !error.retryable) return false;
          return failureCount < 3;
        },
        retryDelay: (attempt, error) => {
          if (error instanceof RpcError && error.retryAfterMs > 0) return error.retryAfterMs;
          return Math.min(30_000, 1000 * 2 ** attempt);
        },
      },
      mutations: {
        // Mutations that matter go through the outbox, which owns its own
        // retry policy. Anything left here is best-effort.
        retry: false,
      },
    },
  });
}

interface PersistedCache {
  savedAt: number;
  entries: { key: QueryKey; data: unknown }[];
}

/**
 * Persist and restore the cache per account.
 *
 * Deliberately simple: a snapshot on write, a restore on start. TanStack's
 * persister plugin would work, but this keeps the storage layout ours and
 * makes the per-account namespacing obvious rather than configured.
 */
export function persistQueryCache(client: QueryClient, accountId: string): void {
  const entries: PersistedCache['entries'] = [];

  for (const query of client.getQueryCache().getAll()) {
    if (query.state.status !== 'success') continue;
    entries.push({ key: query.queryKey, data: query.state.data });
  }

  writeJson(accountStorage(accountId), ACCOUNT_KEYS.queryCache, {
    savedAt: Date.now(),
    entries,
  } satisfies PersistedCache);
}

export function restoreQueryCache(client: QueryClient, accountId: string): void {
  const cache = readJson<PersistedCache>(accountStorage(accountId), ACCOUNT_KEYS.queryCache);
  if (!cache) return;

  // A cache older than a week is not worth restoring: bands and leaderboards
  // would be misleading rather than merely stale, and every query refetches
  // anyway once there is signal.
  if (Date.now() - cache.savedAt > 7 * 24 * HOUR) return;

  for (const entry of cache.entries) {
    client.setQueryData(entry.key, entry.data);
  }
}

export const queryKeys = {
  bootstrap: (accountId: string) => ['bootstrap', accountId] as const,
  progress: (accountId: string) => ['progress', accountId] as const,
  recommendations: (accountId: string, gameId?: string) =>
    ['recommendations', accountId, gameId ?? 'all'] as const,
  /** Prefix matching every per-game variant, for invalidation. */
  recommendationsAll: (accountId: string) => ['recommendations', accountId] as const,
  catalogManifest: (accountId: string) => ['catalog', 'manifest', accountId] as const,
  leaderboard: (accountId: string, scope: string, period: string) =>
    ['leaderboard', accountId, scope, period] as const,
  classGoal: (accountId: string) => ['class-goal', accountId] as const,
  points: (accountId: string) => ['points', accountId] as const,
  certificates: (accountId: string) => ['certificates', accountId] as const,
  /** Read from the local cache, not the network — see `data/cache/assignments`. */
  assignments: (accountId: string) => ['assignments', accountId] as const,
  rewards: (accountId: string) => ['rewards', accountId] as const,
  friends: (accountId: string) => ['friends', accountId] as const,
} as const;
