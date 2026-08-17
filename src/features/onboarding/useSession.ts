/**
 * The session gate.
 *
 * Today `profile.tsx:170` gates one screen on `!!account` while the other four
 * render regardless — so a signed-out user sees four screens of fabricated
 * data. This moves the decision to app entry, where it can be answered once.
 */

import { useCallback, useEffect, useState } from 'react';

import { activeAccountId, signOut as clearAccount } from '../../data/cache/storage';
import { isSessionExpired, loadSession } from '../../data/nakama/client';
import { pendingCount } from '../../data/outbox/queue';

export type SessionStatus =
  | 'loading'
  | 'unauthenticated'
  /** Signed in, but has not chosen a name or joined a class yet. */
  | 'needs-onboarding'
  | 'ready';

export interface SessionState {
  status: SessionStatus;
  accountId: string | null;
}

export function useSession(onboarded?: boolean): SessionState & {
  refresh: () => void;
  signOut: () => { pendingItems: number };
} {
  const [state, setState] = useState<SessionState>({ status: 'loading', accountId: null });

  const evaluate = useCallback(() => {
    const accountId = activeAccountId();

    if (!accountId) {
      setState({ status: 'unauthenticated', accountId: null });
      return;
    }

    const session = loadSession(accountId);
    // Only a genuinely expired *refresh* token requires signing in again. A
    // stale auth token is refreshed silently, and being offline is not a
    // reason to sign anybody out.
    if (!session || isSessionExpired(accountId)) {
      setState({ status: 'unauthenticated', accountId: null });
      return;
    }

    setState({
      status: onboarded === false ? 'needs-onboarding' : 'ready',
      accountId,
    });
  }, [onboarded]);

  useEffect(evaluate, [evaluate]);

  /**
   * Sign out, keeping the outbox.
   *
   * Returns the number of unsynced items so the UI can say exactly what is at
   * stake — "3 results have not been sent yet, they stay on this phone" — rather
   * than a generic warning nobody reads.
   */
  const signOut = useCallback(() => {
    const accountId = state.accountId;
    if (!accountId) return { pendingItems: 0 };

    const items = pendingCount(accountId);
    clearAccount(accountId);
    setState({ status: 'unauthenticated', accountId: null });
    return { pendingItems: items };
  }, [state.accountId]);

  return { ...state, refresh: evaluate, signOut };
}
