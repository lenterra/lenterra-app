/**
 * Friends, over Nakama's own friend system.
 *
 * The demo had three arrays of celebrity names in `profile.tsx` and printed
 * the student's raw `0x…` wallet address as "Your ID". Both are replaced here:
 * the graph is Nakama's, and the shareable identifier is a class-scoped friend
 * code.
 *
 * The server enforces the rules — same-school only, no adding by username — in
 * the `beforeAddFriends` hook, because a client-side check is bypassed by
 * calling the API directly. Nothing in this file is a security boundary.
 */

import { client, ensureSession } from './client';
import { RpcError, rpc } from './rpc';

/**
 * Nakama's friend states.
 *
 * Named rather than compared as integers at the call site: `state === 2`
 * reads as nothing, and getting incoming and outgoing the wrong way round
 * would show a student a "accept" button on a request they sent.
 */
export const FRIEND_STATE = {
  mutual: 0,
  /** We sent it; they have not answered. */
  outgoing: 1,
  /** They sent it; we can accept or refuse. */
  incoming: 2,
  blocked: 3,
} as const;

export interface Friend {
  userId: string;
  displayName: string;
  state: number;
  /** Present only for mutual friends — a request shows no progress. */
  online: boolean;
}

export interface FriendLists {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  blocked: Friend[];
}

const EMPTY: FriendLists = { friends: [], incoming: [], outgoing: [], blocked: [] };

export async function listFriends(accountId: string): Promise<FriendLists> {
  const session = await ensureSession(accountId);
  if (!session) throw new RpcError('UNAUTHENTICATED', 'No usable session');

  let result;
  try {
    result = await client.listFriends(session, undefined, 100, undefined);
  } catch {
    throw new RpcError('OFFLINE', 'Could not reach the server');
  }

  const out: FriendLists = { friends: [], incoming: [], outgoing: [], blocked: [] };

  for (const entry of result.friends ?? []) {
    const friend: Friend = {
      userId: entry.user?.id ?? '',
      // `display_name` is the moderated one; `username` is a generated handle
      // the student never chose and should never be shown.
      displayName: entry.user?.display_name || entry.user?.username || '',
      state: entry.state ?? FRIEND_STATE.mutual,
      online: entry.user?.online === true,
    };
    if (!friend.userId) continue;

    switch (friend.state) {
      case FRIEND_STATE.mutual:
        out.friends.push(friend);
        break;
      case FRIEND_STATE.outgoing:
        out.outgoing.push(friend);
        break;
      case FRIEND_STATE.incoming:
        out.incoming.push(friend);
        break;
      case FRIEND_STATE.blocked:
        out.blocked.push(friend);
        break;
      default:
        break;
    }
  }

  return out;
}

export function emptyFriendLists(): FriendLists {
  return EMPTY;
}

/**
 * Look a classmate up by friend code.
 *
 * Returns null both when the code does not exist and when it belongs to
 * another school — the server deliberately does not distinguish them, because
 * a distinguishable answer turns this into a way to enumerate other schools'
 * children.
 */
export async function findByCode(
  accountId: string,
  code: string,
): Promise<{ userId: string; displayName: string } | null> {
  const found = await rpc<{ userId: string; displayName: string } | null>(
    accountId,
    'v1.friend.searchByCode',
    { code },
  );
  return found ?? null;
}

/** Send or accept — Nakama treats both as `addFriends`. */
export async function addFriend(accountId: string, userId: string): Promise<void> {
  const session = await ensureSession(accountId);
  if (!session) throw new RpcError('UNAUTHENTICATED', 'No usable session');
  await client.addFriends(session, [userId], []);
}

/** Refuse a request, or remove an existing friend. Both are `deleteFriends`. */
export async function removeFriend(accountId: string, userId: string): Promise<void> {
  const session = await ensureSession(accountId);
  if (!session) throw new RpcError('UNAUTHENTICATED', 'No usable session');
  await client.deleteFriends(session, [userId], []);
}

/**
 * Block.
 *
 * Separate from removing, and deliberately so: a student who blocks someone
 * has said something stronger than "not friends", and a blocked user must not
 * be able to send a fresh request.
 */
export async function blockUser(accountId: string, userId: string): Promise<void> {
  const session = await ensureSession(accountId);
  if (!session) throw new RpcError('UNAUTHENTICATED', 'No usable session');
  await client.blockFriends(session, [userId], []);
}

export type ReportReason = 'bullying' | 'inappropriate_name' | 'impersonation' | 'other';

/**
 * Report someone to a human.
 *
 * Blocking protects the student now; reporting is what reaches an adult. The
 * two are offered together because a child who has been bullied should not
 * have to work out which one they wanted.
 */
export async function reportUser(
  accountId: string,
  userId: string,
  reason: ReportReason,
  surface: string,
): Promise<void> {
  await rpc(accountId, 'v1.moderation.report', {
    subjectUserId: userId,
    reason,
    surface,
  });
}
