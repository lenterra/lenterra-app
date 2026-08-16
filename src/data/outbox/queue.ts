/**
 * The durable queue.
 *
 * Order of operations is the whole point: **persist, then confirm.** A crash
 * between showing "you earned 10 points" and writing the record silently loses
 * learning the student believes they have banked, which is the worst outcome
 * available to a product whose central promise is that offline play counts.
 */

import { ACCOUNT_KEYS, accountStorage, nextDeviceSeq, readJson, writeJson } from '../cache/storage';
import { backoffFor, MAX_BATCH_BYTES, MAX_BATCH_ITEMS, type OutboxItem, type OutboxKind } from './types';

function read(accountId: string): OutboxItem[] {
  return readJson<OutboxItem[]>(accountStorage(accountId), ACCOUNT_KEYS.outbox) ?? [];
}

function write(accountId: string, items: OutboxItem[]): void {
  writeJson(accountStorage(accountId), ACCOUNT_KEYS.outbox, items);
}

/** Client-generated id, doubling as the idempotency key. */
export function newItemId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Queue an action.
 *
 * Returns the stored item so the caller can render a provisional result
 * referencing the same id the server will confirm.
 */
export function enqueue(
  accountId: string,
  kind: OutboxKind,
  payload: unknown,
  id: string = newItemId(),
): OutboxItem {
  const item: OutboxItem = {
    id,
    kind,
    deviceSeq: nextDeviceSeq(accountId),
    payload,
    createdAt: Date.now(),
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: 0,
    status: 'pending',
  };

  const items = read(accountId);
  // Re-queuing the same id is a no-op rather than a duplicate. A retry loop in
  // a caller must not be able to double-award anything.
  if (items.some((existing) => existing.id === id)) return item;

  items.push(item);
  write(accountId, items);
  return item;
}

export function all(accountId: string): OutboxItem[] {
  return read(accountId);
}

export function pendingCount(accountId: string): number {
  return read(accountId).filter((item) => item.status !== 'failed_permanent').length;
}

/** Oldest unsynced item, for the "waiting since…" line in the offline indicator. */
export function oldestPendingAt(accountId: string): number | null {
  const pending = read(accountId).filter((item) => item.status === 'pending');
  if (pending.length === 0) return null;
  return pending.reduce((oldest, item) => Math.min(oldest, item.createdAt), Number.MAX_SAFE_INTEGER);
}

/**
 * The next batch to send.
 *
 * Ordered by `deviceSeq` so a student's history applies in the order they lived
 * it — mastery is path-dependent, so the same attempts in a different order
 * produce a different number. Items still inside their backoff window are
 * skipped rather than blocking everything behind them.
 */
export function take(accountId: string, now: number = Date.now()): OutboxItem[] {
  const ready = read(accountId)
    .filter((item) => item.status === 'pending' && item.nextAttemptAt <= now)
    .sort((a, b) => a.deviceSeq - b.deviceSeq);

  const batch: OutboxItem[] = [];
  let bytes = 0;

  for (const item of ready) {
    const size = JSON.stringify(item.payload).length;
    if (batch.length >= MAX_BATCH_ITEMS) break;
    // Always send at least one item, even an oversized one — otherwise a
    // single large replay would wedge the queue permanently.
    if (batch.length > 0 && bytes + size > MAX_BATCH_BYTES) break;
    batch.push(item);
    bytes += size;
  }
  return batch;
}

export function markInflight(accountId: string, ids: string[], now: number = Date.now()): void {
  const items = read(accountId);
  for (const item of items) {
    if (!ids.includes(item.id)) continue;
    item.status = 'inflight';
    item.attempts += 1;
    item.lastAttemptAt = now;
  }
  write(accountId, items);
}

/** Confirmed applied or duplicate — the only reason an item ever leaves. */
export function remove(accountId: string, id: string): void {
  write(
    accountId,
    read(accountId).filter((item) => item.id !== id),
  );
}

/**
 * A transient failure. Schedules a retry and returns the item to `pending`.
 *
 * Never removes it, whatever the attempt count.
 */
export function backoff(
  accountId: string,
  id: string,
  error?: { code: string; message: string },
  now: number = Date.now(),
): void {
  const items = read(accountId);
  for (const item of items) {
    if (item.id !== id) continue;
    item.status = 'pending';
    item.nextAttemptAt = now + backoffFor(item.attempts);
    if (error) item.lastError = error;
  }
  write(accountId, items);
}

/**
 * A permanent failure.
 *
 * Kept in the queue rather than deleted, so the student can be shown what
 * happened and why. Deleting it would make the points quietly disappear with
 * no explanation, which reads as the system cheating.
 */
export function markPermanent(
  accountId: string,
  id: string,
  error: { code: string; message: string },
): void {
  const items = read(accountId);
  for (const item of items) {
    if (item.id !== id) continue;
    item.status = 'failed_permanent';
    item.lastError = error;
  }
  write(accountId, items);
}

/** Items the student should be told about. */
export function permanentFailures(accountId: string): OutboxItem[] {
  return read(accountId).filter((item) => item.status === 'failed_permanent');
}

/** Dismiss a correction the student has seen. */
export function acknowledge(accountId: string, id: string): void {
  remove(accountId, id);
}

/** Return anything stuck inflight to pending — used on app start after a kill. */
export function recoverInflight(accountId: string): void {
  const items = read(accountId);
  let changed = false;
  for (const item of items) {
    if (item.status !== 'inflight') continue;
    // An item left inflight means the app died mid-send. The server may or may
    // not have applied it; the idempotency key makes retrying safe either way.
    item.status = 'pending';
    changed = true;
  }
  if (changed) write(accountId, items);
}
