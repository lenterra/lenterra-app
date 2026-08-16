/**
 * The Nakama client and session lifecycle.
 *
 * Replaces `lib/nakama-client.ts`, which held the session in a module-level
 * mutable variable. Nothing re-rendered when it changed, nothing refreshed it,
 * and it did not survive a restart — so every app launch was an anonymous one.
 *
 * Here the token is persisted per account, refreshed before it expires, and
 * exposed through a single accessor, so no component can hold a stale copy.
 */

import { Client, Session } from '@heroiclabs/nakama-js';

import { config } from '../../lib/config';
import { ACCOUNT_KEYS, accountStorage, readJson, writeJson } from '../cache/storage';

export const client = new Client(
  config.nakama.serverKey,
  config.nakama.host,
  config.nakama.port,
  config.nakama.useSsl,
  config.nakama.timeoutMs,
);

interface StoredSession {
  token: string;
  refreshToken: string;
  userId: string;
  username: string;
  /** Epoch seconds. */
  expiresAt: number;
  refreshExpiresAt: number;
}

/**
 * Refresh when within six hours of expiry.
 *
 * The auth token lasts 24 hours. Six hours of slack means a student who opens
 * the app once a day never sees a sign-in prompt, and one who is offline for
 * the whole window still has a valid refresh token for 90 days (TRD-AUTH-007).
 */
const REFRESH_WINDOW_SECONDS = 6 * 60 * 60;

let current: { accountId: string; session: Session } | null = null;
let refreshInFlight: Promise<Session | null> | null = null;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function toStored(session: Session): StoredSession {
  return {
    token: session.token,
    refreshToken: session.refresh_token ?? '',
    userId: session.user_id ?? '',
    username: session.username ?? '',
    expiresAt: session.expires_at ?? 0,
    refreshExpiresAt: session.refresh_expires_at ?? 0,
  };
}

function fromStored(stored: StoredSession): Session {
  return Session.restore(stored.token, stored.refreshToken);
}

export function persistSession(accountId: string, session: Session): void {
  writeJson(accountStorage(accountId), ACCOUNT_KEYS.session, toStored(session));
  current = { accountId, session };
}

export function loadSession(accountId: string): Session | null {
  if (current && current.accountId === accountId) return current.session;

  const stored = readJson<StoredSession>(accountStorage(accountId), ACCOUNT_KEYS.session);
  if (!stored) return null;

  const session = fromStored(stored);
  current = { accountId, session };
  return session;
}

export function clearSession(accountId: string): void {
  accountStorage(accountId).delete(ACCOUNT_KEYS.session);
  if (current && current.accountId === accountId) current = null;
}

export function sessionUserId(accountId: string): string | null {
  const stored = readJson<StoredSession>(accountStorage(accountId), ACCOUNT_KEYS.session);
  return stored?.userId ?? null;
}

/**
 * A usable session, refreshing if needed.
 *
 * Returns `null` rather than throwing when there is nothing usable and no
 * connectivity. Callers decide what that means: play continues offline, sync
 * waits. A refresh failure must never discard the outbox or block play.
 */
export async function ensureSession(accountId: string): Promise<Session | null> {
  const session = loadSession(accountId);
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  if (expiresAt - nowSeconds() > REFRESH_WINDOW_SECONDS) return session;

  const refreshExpiresAt = session.refresh_expires_at ?? 0;
  if (refreshExpiresAt !== 0 && refreshExpiresAt <= nowSeconds()) {
    // The 90-day refresh token has expired. This is the only case that
    // genuinely requires signing in again.
    clearSession(accountId);
    return null;
  }

  // One refresh at a time. Several queries waking together on reconnect would
  // otherwise each try, and the losers would refresh with a rotated token.
  if (!refreshInFlight) {
    refreshInFlight = client
      .sessionRefresh(session)
      .then((refreshed) => {
        persistSession(accountId, refreshed);
        return refreshed;
      })
      .catch(() => {
        // Offline, or the server is down. Keep the existing token: it may
        // still be valid, and the request that follows will find out.
        return session;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export function isSessionExpired(accountId: string): boolean {
  const stored = readJson<StoredSession>(accountStorage(accountId), ACCOUNT_KEYS.session);
  if (!stored) return true;
  return stored.refreshExpiresAt !== 0 && stored.refreshExpiresAt <= nowSeconds();
}
