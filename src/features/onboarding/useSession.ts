/**
 * The session gate.
 *
 * Today `profile.tsx:170` gates one screen on `!!account` while the other four
 * render regardless — so a signed-out user sees four screens of fabricated
 * data. This moves the decision to app entry, where it can be answered once.
 */

import { useCallback, useState } from 'react';

import { activeAccountId, signOut as clearAccount } from '../../data/cache/storage';
import { isSessionExpired, loadSession } from '../../data/nakama/client';
import { pendingCount } from '../../data/outbox/queue';

export type SessionStatus =
  | 'unauthenticated'
  /** Signed in, but has not chosen a name or joined a class yet. */
  | 'needs-onboarding'
  | 'ready';

export interface SessionState {
  status: SessionStatus;
  accountId: string | null;
}

/**
 * Who is signed in, read straight from storage.
 *
 * Every source here is synchronous — the account id, the stored session and its
 * expiry all live on the device — so there is no asynchronous step to wait for
 * and never was. The hook used to start at `loading` and resolve from an
 * effect, which meant one render of "we do not know yet" over a question
 * already answered, and a splash screen held for a frame at every cold start.
 */
function evaluateSession(onboarded?: boolean): SessionState {
  const accountId = activeAccountId();
  if (!accountId) return { status: 'unauthenticated', accountId: null };

  const session = loadSession(accountId);
  // Only a genuinely expired *refresh* token requires signing in again. A
  // stale auth token is refreshed silently, and being offline is not a
  // reason to sign anybody out.
  if (!session || isSessionExpired(accountId)) {
    return { status: 'unauthenticated', accountId: null };
  }

  return { status: onboarded === false ? 'needs-onboarding' : 'ready', accountId };
}

export function useSession(onboarded?: boolean): SessionState & {
  refresh: () => void;
  signOut: () => { pendingItems: number };
} {
  const [state, setState] = useState<SessionState>(() => evaluateSession(onboarded));

  // Re-read when onboarding completes, during render rather than after it.
  // From an effect this would render the onboarding gate once more before
  // moving on, which is a student who has just chosen their name seeing the
  // name screen flash back.
  const [seenOnboarded, setSeenOnboarded] = useState(onboarded);
  if (seenOnboarded !== onboarded) {
    setSeenOnboarded(onboarded);
    setState(evaluateSession(onboarded));
  }

  const evaluate = useCallback(() => setState(evaluateSession(onboarded)), [onboarded]);

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
