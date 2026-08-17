/**
 * Sync state, shared with every screen.
 *
 * The engine has to be a singleton — two drains racing would double-send the
 * outbox — but its state is what several screens need to render honestly: the
 * pending count on home, the download progress on games, the "content update
 * waiting" prompt anywhere the student can act on it.
 *
 * Before this, screens read `pendingCount()` directly at render time. That is a
 * plain read with no subscription, so the number only changed when something
 * else happened to re-render the screen — the banner could sit at "3 waiting"
 * after a successful sync until the student navigated away and back.
 */

import { createContext, useContext, type ReactNode } from 'react';

import { useSyncEngine } from './useSyncEngine';

type SyncEngine = ReturnType<typeof useSyncEngine>;

const SyncContext = createContext<SyncEngine | null>(null);

export function SyncProvider({
  accountId,
  children,
}: {
  accountId: string | null;
  children: ReactNode;
}) {
  const engine = useSyncEngine(accountId);
  return <SyncContext.Provider value={engine}>{children}</SyncContext.Provider>;
}

/**
 * Read the sync state.
 *
 * Returns a quiet default outside the provider rather than throwing, because
 * the alternative is a screen that crashes in a test harness or a storybook
 * for a reason that has nothing to do with what it renders.
 */
export function useSync(): SyncEngine {
  const value = useContext(SyncContext);
  if (value) return value;

  return {
    pending: 0,
    oldestPendingAt: null,
    syncing: false,
    online: true,
    corrections: [],
    lastOutcome: null,
    catalogProgress: null,
    catalogUpdateWaiting: null,
    syncNow: async () => null,
    downloadCatalogNow: async () => null,
    refreshCounts: () => {},
  };
}
