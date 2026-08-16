/**
 * The offline outbox.
 *
 * The store the whole offline-first design rests on. A student in NTT plays for
 * two weeks with no connectivity; everything they did has to still be here, in
 * order, when they next get signal.
 */

export type OutboxKind = 'attempt' | 'check' | 'lesson' | 'event';

export type OutboxStatus = 'pending' | 'inflight' | 'failed_permanent';

export interface OutboxItem {
  /** Also the idempotency key. Generated on the device, before any UI confirmation. */
  id: string;
  kind: OutboxKind;
  /** Monotonic per device. Orders a batch server-side; a device clock cannot. */
  deviceSeq: number;
  payload: unknown;
  /** Device clock. Corrected server-side; kept for diagnosis. */
  createdAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  /** Earliest time a retry may be made, from the backoff schedule. */
  nextAttemptAt: number;
  status: OutboxStatus;
  lastError?: { code: string; message: string };
}

/**
 * Backoff schedule for transient failures.
 *
 * Capped at 30 minutes and never exhausted: an item is *never* discarded
 * because of a transient error, however many times it has failed. The student
 * did the work; the network is what is broken.
 */
export const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000, 1_800_000];

export function backoffFor(attempts: number): number {
  const index = Math.min(attempts, BACKOFF_MS.length - 1);
  return BACKOFF_MS[index] as number;
}

/**
 * Errors that mean "stop retrying".
 *
 * Everything not listed here is treated as transient. That default is
 * deliberate: wrongly classing a transient error as permanent destroys a
 * student's work, while the reverse only costs a retry.
 */
const PERMANENT_CODES = ['VALIDATION_FAILED', 'INVALID_ARGUMENT', 'FORBIDDEN', 'NOT_FOUND'];

export function isPermanent(code: string | undefined): boolean {
  return code !== undefined && PERMANENT_CODES.includes(code);
}

/** Errors that need an action before a retry can succeed. */
export function needsRecovery(code: string | undefined): 'catalog' | 'session' | null {
  if (code === 'CATALOG_STALE') return 'catalog';
  if (code === 'UNAUTHENTICATED') return 'session';
  return null;
}

export const MAX_BATCH_ITEMS = 50;
export const MAX_BATCH_BYTES = 512 * 1024;
