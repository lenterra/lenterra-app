/**
 * The client half of the auth chain (ADR-002, ADR-004).
 *
 * What this replaces, in `app/(tabs)/profile.tsx`:
 *
 *   const session = await nakamaClient.authenticateCustom(account.address);
 *
 * A wallet address with nothing proving the caller controls it. That call sits
 * inside a `useEffect` in a tab screen, so authentication is a side effect of
 * looking at your profile, and the other four tabs render regardless.
 *
 * It also replaces `ConnectButton` and its eight external wallets. Asking a
 * rural student to install MetaMask before they can play a Congklak mission is
 * the single largest access barrier the demo has, and it exists to serve a
 * feature — token rewards — that is blocked pending review anyway.
 */

import { signLoginPayload, type LoginPayload } from 'thirdweb/auth';
import { inAppWallet } from 'thirdweb/wallets';

import { config } from '../../lib/config';
import { thirdwebClient } from '../../lib/thirdweb';
import { client, persistSession } from '../../data/nakama/client';
import { rpc } from '../../data/nakama/rpc';
import { newItemId } from '../../data/outbox/queue';
import { deviceId, setActiveAccount } from '../../data/cache/storage';

export type SignInStrategy = 'email' | 'google';

export class AuthError extends Error {
  readonly reason:
    | 'cancelled'
    | 'verifier_unreachable'
    | 'verifier_rejected'
    | 'nakama_rejected'
    | 'unknown';

  /**
   * What the service said was wrong, when it said anything useful.
   *
   * `verifier_rejected` covers a mistyped code, a full class, and too many
   * attempts, and a student can act on all three — retype it, ask the teacher,
   * or wait. Collapsing them into one message would leave them tapping the same
   * button.
   */
  readonly detail: string | undefined;

  constructor(reason: AuthError['reason'], message: string, detail?: string) {
    super(message);
    this.name = 'AuthError';
    this.reason = reason;
    this.detail = detail;
  }
}

interface AssertionResponse {
  assertion: string;
  address: string;
  expiresIn: number;
}

async function postToVerifier<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.verifierUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    // Distinguished from a rejection: unreachable is worth retrying, rejected
    // is not, and during a class onboarding session that difference decides
    // whether a teacher waits or moves on.
    throw new AuthError('verifier_unreachable', 'Could not reach the sign-in service');
  }

  if (!response.ok) {
    // The body names the reason where there is one worth acting on. A failure
    // to read it is not itself a failure — the rejection still stands.
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body?.error === 'string') detail = body.error;
    } catch {
      detail = undefined;
    }
    throw new AuthError('verifier_rejected', 'Sign-in could not be verified', detail);
  }
  return (await response.json()) as T;
}

/**
 * Prove control of the address, and exchange that proof for an assertion.
 *
 * **Corrected from the original design.** ADR-004 assumed the wallet could hand
 * over an RS256 JWT via `getAuthToken()`. thirdweb v5 has no such method; its
 * supported flow is sign-in-with-Ethereum. The server issues a payload with a
 * nonce it chose, the wallet signs it, and the server verifies the signature.
 *
 * That is a stronger claim than the original design made. A bearer token proves
 * the holder was once given one; a signature over a server-chosen nonce proves
 * the caller controls the key for that address right now.
 */
async function fetchAssertion(
  account: { address: string },
  wallet: ReturnType<typeof inAppWallet>,
  strategy: SignInStrategy,
): Promise<AssertionResponse> {
  const { payload } = await postToVerifier<{ payload: LoginPayload }>('/session/challenge', {
    address: account.address,
  });

  const signed = await signLoginPayload({
    payload,
    account: wallet.getAccount() as Parameters<typeof signLoginPayload>[0]['account'],
  });

  return postToVerifier<AssertionResponse>('/session', {
    payload: signed.payload,
    signature: signed.signature,
    strategy,
  });
}

/**
 * Sign in with an in-app wallet.
 *
 * The student sees an email code or a Google sheet. They never see a wallet,
 * a seed phrase, or the word "crypto" — the address exists so an R3 certificate
 * has somewhere to live, and that is the only reason.
 */
export async function signIn(strategy: SignInStrategy, email?: string): Promise<string> {
  const wallet = inAppWallet();

  let account: { address: string };
  try {
    account =
      strategy === 'email'
        ? await wallet.connect({ client: thirdwebClient, strategy: 'email', email: email ?? '', verificationCode: '' })
        : await wallet.connect({ client: thirdwebClient, strategy: 'google' });
  } catch (err) {
    throw new AuthError('cancelled', (err as Error)?.message ?? 'Sign-in was cancelled');
  }

  const { assertion, address } = await fetchAssertion(account, wallet, strategy);

  // The address is lower-cased on both sides. An address differing only in
  // case must not be able to become a second account.
  const customId = address.toLowerCase();

  let session;
  try {
    session = await client.authenticateCustom(customId, true, undefined, {
      assertion,
      authStrategy: strategy,
    });
  } catch (err) {
    throw new AuthError('nakama_rejected', (err as Error)?.message ?? 'The server refused the sign-in');
  }

  const accountId = session.user_id ?? customId;
  persistSession(accountId, session);
  setActiveAccount(accountId);
  return accountId;
}

/**
 * Send the email verification code.
 *
 * Split from `signIn` because the UI needs two steps and the second one needs
 * the code the student read off their phone.
 */
export async function sendEmailCode(email: string): Promise<void> {
  const wallet = inAppWallet();
  await wallet.connect({
    client: thirdwebClient,
    strategy: 'email',
    email,
    verificationCode: '',
  });
}

export interface ReclaimCandidate {
  /** Names only, masked. A full roster behind a six-character code is a safeguarding problem. */
  maskedName: string;
  reclaimToken: string;
}

export interface ClassCodeSession {
  accountId: string;
  classId: string;
  className: string;
  schoolName: string;
  /** Profiles already in this class that a returning student might recognise. */
  candidates: ReclaimCandidate[];
}

interface ClassCodeResponse {
  assertion: string;
  customId: string;
  walletAddress: string | null;
  classId: string;
  className: string;
  schoolName: string;
}

/**
 * Sign in with a class code (TRD-AUTH-004).
 *
 * The path that matters most for reach: a student with no email, on a borrowed
 * phone, joining from a code their teacher wrote on the board. Nothing on it
 * requires an inbox, a password, or a wallet app.
 *
 * One call decides everything. Nakama validates the code against a real class
 * with real capacity and signs a grant; the verifier turns that grant into an
 * identity and an assertion. Neither half can be skipped from here, and the
 * device never holds anything it could reuse — the assertion is single-use and
 * expires in two minutes.
 *
 * The account may have no wallet address, which is deliberate rather than a
 * failure: see `upgradeAccount`.
 */
export async function signInWithClassCode(code: string): Promise<ClassCodeSession> {
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length === 0) {
    throw new AuthError('verifier_rejected', 'Enter the code your teacher gave you', 'invalid_code');
  }

  const device = deviceId();
  const result = await postToVerifier<ClassCodeResponse>('/session/class-code', {
    code: trimmed,
    deviceId: device,
  });

  let session;
  try {
    session = await client.authenticateCustom(result.customId, true, undefined, {
      assertion: result.assertion,
      authStrategy: 'class_code',
    });
  } catch (err) {
    throw new AuthError(
      'nakama_rejected',
      (err as Error)?.message ?? 'The server refused the sign-in',
    );
  }

  const accountId = session.user_id ?? result.customId;
  persistSession(accountId, session);
  setActiveAccount(accountId);

  // Joining is part of signing in this way, not a step after it: an account
  // created from a class code and not in that class is an account with no
  // school, no classmates, and no reason to exist. The membership insert is an
  // upsert, so a retry after a dropped response rejoins rather than failing.
  let joined: JoinResponse;
  try {
    joined = await rpc<JoinResponse>(accountId, 'v1.class.join', {
      code: trimmed,
      deviceId: device,
      idempotencyKey: newItemId(),
    });
  } catch (err) {
    // The account is real and signed in, so leaving them here is better than
    // discarding it: they can retry the join, and a teacher can add them by
    // hand. Signing them out would lose an identity nobody can recreate.
    throw new AuthError('nakama_rejected', (err as Error)?.message ?? 'Could not join the class');
  }

  return {
    accountId,
    classId: result.classId,
    className: joined.class?.name ?? result.className,
    schoolName: joined.class?.schoolName ?? result.schoolName,
    candidates: joined.existingProfiles ?? [],
  };
}

interface JoinResponse {
  class?: { id: string; name: string; schoolName: string };
  existingProfiles?: ReclaimCandidate[];
}

/**
 * Ask a teacher to hand a previous profile back (TRD-AUTH-006).
 *
 * Nothing transfers here. A class-code student has no email and no password, so
 * there is nothing they could present as proof and the teacher is the only
 * authority — which also means an unapproved request must never block play. The
 * student keeps going on the account they just created while it waits.
 */
export async function requestReclaim(
  accountId: string,
  classId: string,
  reclaimToken: string,
): Promise<void> {
  await rpc(accountId, 'v1.class.reclaim.request', {
    classId,
    reclaimToken,
    idempotencyKey: newItemId(),
  });
}

/**
 * Add an email or Google login to a class-code account (TRD-AUTH-005).
 *
 * A class-code student has no email and no password, which is what makes the
 * path reachable at all and also what makes it fragile: lose the device and the
 * only recovery is a teacher approving a reclaim. This is how they stop being
 * in that position, and — because it is what creates their wallet — how they
 * become able to hold a certificate.
 *
 * The account is never forked. They are already signed in, so there is nothing
 * to merge: the same account keeps its progress, points, and mastery, and only
 * what they sign in with next time changes.
 */
export async function upgradeAccount(
  accountId: string,
  strategy: SignInStrategy,
  email?: string,
): Promise<{ walletAddress: string }> {
  const wallet = inAppWallet();

  let account: { address: string };
  try {
    account =
      strategy === 'email'
        ? await wallet.connect({ client: thirdwebClient, strategy: 'email', email: email ?? '', verificationCode: '' })
        : await wallet.connect({ client: thirdwebClient, strategy: 'google' });
  } catch (err) {
    throw new AuthError('cancelled', (err as Error)?.message ?? 'Sign-in was cancelled');
  }

  const { assertion } = await fetchAssertion(account, wallet, strategy);

  // Sent to the server rather than applied locally: the address is claimed by
  // the account that presents proof of it, and only the server can tell whether
  // it already belongs to somebody else.
  const result = await rpc<{ walletAddress: string }>(accountId, 'v1.account.upgrade', {
    assertion,
    idempotencyKey: newItemId(),
  });

  return { walletAddress: result.walletAddress };
}
