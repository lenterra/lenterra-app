/**
 * The typed RPC wrapper (TRD-APP-001).
 *
 * Every server call in the app goes through here. Today the only one is a
 * `useEffect` inside `profile.tsx` calling Nakama directly with no error
 * handling, no retry, and no typing — which is why nothing else in the app has
 * real data.
 *
 * Three properties this has and that does not:
 *
 *  - **Typed against the server's own contracts**, so a field rename is a
 *    compile error rather than an `undefined` three screens later.
 *  - **Validated at runtime.** A response that does not match its shape is an
 *    error here, not a crash somewhere else.
 *  - **Errors carry codes.** The client can tell "re-authenticate and keep the
 *    outbox" from "stop retrying" from "back off" — which, on a connection that
 *    drops constantly, is the difference between recovering and losing work.
 */

import { z } from 'zod';

import { config } from '../../lib/config';
import { client, ensureSession } from './client';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'CATALOG_STALE'
  | 'UNAVAILABLE'
  /** Client-side only: the request never left the device. */
  | 'OFFLINE';

export class RpcError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.details = details;
  }

  /**
   * Should the caller try again later?
   *
   * The distinction matters most for the outbox: a retryable failure keeps the
   * item queued, a terminal one removes it and surfaces a correction. Getting
   * this backwards either loses a student's work or retries forever.
   */
  get retryable(): boolean {
    return this.code === 'UNAVAILABLE' || this.code === 'OFFLINE' || this.code === 'RATE_LIMITED';
  }

  get retryAfterMs(): number {
    const value = this.details?.['retryAfterMs'];
    return typeof value === 'number' ? value : 0;
  }
}

const Envelope = z.union([
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }),
  }),
]);

const KNOWN_CODES: ErrorCode[] = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INVALID_ARGUMENT',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'CATALOG_STALE',
  'UNAVAILABLE',
];

function toCode(value: string): ErrorCode {
  return (KNOWN_CODES as string[]).includes(value) ? (value as ErrorCode) : 'UNAVAILABLE';
}

export interface RpcOptions<T> {
  /**
   * Validates `data`. Omit only where the payload is genuinely opaque.
   *
   * The input parameter is pinned to `unknown` on purpose. A bare
   * `z.ZodType<T>` lets TypeScript bind `T` to the schema's *input* type, and
   * for any schema using `.default()` those differ — a defaulted field is
   * optional going in and guaranteed coming out. Callers annotate their hooks
   * with `z.infer`, which is the output, so the two disagreed the moment a
   * default was added and the error pointed at the hook rather than here.
   */
  schema?: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Set for calls that must not trigger a token refresh loop. */
  skipRefresh?: boolean;
}

/**
 * Call a server RPC.
 *
 * @throws RpcError — always. Nothing else escapes, so callers only ever handle
 *   one error shape.
 */
export async function rpc<T = unknown>(
  accountId: string,
  name: string,
  req: unknown,
  options?: RpcOptions<T>,
): Promise<T> {
  const session = options?.skipRefresh ? null : await ensureSession(accountId);

  if (!session) {
    throw new RpcError('UNAUTHENTICATED', 'No usable session');
  }

  let raw: string;
  try {
    // nakama-js serialises the object itself; passing a pre-encoded string
    // would arrive double-encoded and fail to parse server-side.
    const response = await client.rpc(session, name, (req ?? {}) as object);
    raw = typeof response.payload === 'string' ? response.payload : JSON.stringify(response.payload);
  } catch (err) {
    // A transport failure is not a server rejection. Treating it as one would
    // make the outbox discard work that never reached the server.
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      throw new RpcError('UNAUTHENTICATED', 'Session rejected');
    }
    throw new RpcError('OFFLINE', 'Could not reach the server');
  }

  let envelope: z.infer<typeof Envelope>;
  try {
    envelope = Envelope.parse(JSON.parse(raw));
  } catch {
    throw new RpcError('UNAVAILABLE', 'The server sent an unreadable response');
  }

  if (!envelope.ok) {
    throw new RpcError(toCode(envelope.error.code), envelope.error.message, envelope.error.details);
  }

  if (!options?.schema) return envelope.data as T;

  const parsed = options.schema.safeParse(envelope.data);
  if (!parsed.success) {
    // A shape mismatch is a real defect — a server and client that disagree
    // about a contract. Surfacing it here names the RPC; letting it through
    // produces an undefined read in a component with no clue where it came from.
    throw new RpcError('UNAVAILABLE', `Unexpected response shape from ${name}`, {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

/** Fields every mutating RPC carries. */
export function withIdempotency<T extends object>(req: T, key: string): T & { idempotencyKey: string } {
  return { ...req, idempotencyKey: key };
}

export const CLIENT_VERSION = config.clientVersion;
