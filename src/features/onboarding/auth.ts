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
import { setActiveAccount } from '../../data/cache/storage';

export type SignInStrategy = 'email' | 'google';

export class AuthError extends Error {
  readonly reason:
    | 'cancelled'
    | 'verifier_unreachable'
    | 'verifier_rejected'
    | 'nakama_rejected'
    | 'unknown';

  constructor(reason: AuthError['reason'], message: string) {
    super(message);
    this.name = 'AuthError';
    this.reason = reason;
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
    throw new AuthError('verifier_rejected', 'Sign-in could not be verified');
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

/**
 * Sign in with a class code (TRD-AUTH-004).
 *
 * **Not implemented.** Whether thirdweb can provision a wallet headlessly from
 * a server-generated identifier, and later link that wallet to an email while
 * keeping the same address, is unverified against a live integration (OQ-04).
 *
 * This throws rather than falling back to a local-only account, because a
 * student who onboarded into an account that cannot be upgraded would lose
 * their certificates at R3 with no way back — and they would not find out for
 * a year.
 */
export async function signInWithClassCode(_code: string): Promise<never> {
  throw new AuthError(
    'unknown',
    'Class-code sign-in is not available yet — it depends on a thirdweb capability that has not been verified (OQ-04)',
  );
}
