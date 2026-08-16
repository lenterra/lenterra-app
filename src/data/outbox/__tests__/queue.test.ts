/**
 * Outbox behaviour.
 *
 * These test the promise the product makes to a student in NTT: play for two
 * weeks with no signal, and every single thing you did is still there when you
 * next connect. Getting the retry classification wrong either loses that work
 * or retries forever, so both directions are asserted.
 */

import * as queue from '../queue';
import { backoffFor, isPermanent, needsRecovery, MAX_BATCH_ITEMS } from '../types';

// MMKV is native. This stands in an in-memory equivalent so the queue's own
// logic is what is under test — but it honours the instance `id`, because that
// id is precisely what provides per-account isolation. A mock that shared one
// map would make the isolation test pass for the wrong reason.
const mockMemory = new Map<string, string>();

jest.mock('react-native-mmkv', () => ({
  MMKV: class {
    private readonly prefix: string;

    constructor(options?: { id?: string }) {
      this.prefix = `${options?.id ?? 'default'}::`;
    }
    getString(key: string) {
      return mockMemory.get(this.prefix + key);
    }
    set(key: string, value: string | number) {
      mockMemory.set(this.prefix + key, String(value));
    }
    getNumber(key: string) {
      const raw = mockMemory.get(this.prefix + key);
      return raw === undefined ? undefined : Number(raw);
    }
    delete(key: string) {
      mockMemory.delete(this.prefix + key);
    }
    clearAll() {
      for (const key of [...mockMemory.keys()]) {
        if (key.startsWith(this.prefix)) mockMemory.delete(key);
      }
    }
  },
}));

const ACCOUNT = 'account-1';

beforeEach(() => mockMemory.clear());

describe('enqueue', () => {
  it('stores an item with a monotonic sequence', () => {
    const first = queue.enqueue(ACCOUNT, 'attempt', { missionId: 'congklak.m01' });
    const second = queue.enqueue(ACCOUNT, 'attempt', { missionId: 'congklak.m02' });

    expect(second.deviceSeq).toBeGreaterThan(first.deviceSeq);
    expect(queue.all(ACCOUNT)).toHaveLength(2);
  });

  it('is idempotent on the same id', () => {
    queue.enqueue(ACCOUNT, 'attempt', { a: 1 }, 'fixed-id');
    queue.enqueue(ACCOUNT, 'attempt', { a: 1 }, 'fixed-id');

    expect(queue.all(ACCOUNT)).toHaveLength(1);
  });

  it('keeps two accounts entirely separate', () => {
    // Shared phones are the norm for the target student. Two siblings' work
    // must never merge.
    queue.enqueue(ACCOUNT, 'attempt', { a: 1 });
    queue.enqueue('account-2', 'attempt', { b: 2 });

    expect(queue.all(ACCOUNT)).toHaveLength(1);
    expect(queue.all('account-2')).toHaveLength(1);
    expect(queue.all(ACCOUNT)[0]?.payload).toEqual({ a: 1 });
  });
});

describe('take', () => {
  it('returns items in device-sequence order', () => {
    // Mastery is path-dependent under BKT: the same attempts in a different
    // order produce a different number.
    const ids = ['a', 'b', 'c'].map((id) => queue.enqueue(ACCOUNT, 'attempt', {}, id));
    const batch = queue.take(ACCOUNT);

    expect(batch.map((item) => item.id)).toEqual(ids.map((item) => item.id));
  });

  it('caps a batch at the item limit', () => {
    for (let i = 0; i < MAX_BATCH_ITEMS + 10; i++) {
      queue.enqueue(ACCOUNT, 'event', { i }, `id-${i}`);
    }
    expect(queue.take(ACCOUNT)).toHaveLength(MAX_BATCH_ITEMS);
  });

  it('skips items inside their backoff window', () => {
    queue.enqueue(ACCOUNT, 'attempt', {}, 'waiting');
    queue.enqueue(ACCOUNT, 'attempt', {}, 'ready');

    queue.markInflight(ACCOUNT, ['waiting'], 1000);
    queue.backoff(ACCOUNT, 'waiting', { code: 'UNAVAILABLE', message: 'x' }, 1000);

    const batch = queue.take(ACCOUNT, 2000);
    expect(batch.map((item) => item.id)).toEqual(['ready']);
  });

  it('never lets one waiting item block the ones behind it', () => {
    queue.enqueue(ACCOUNT, 'attempt', {}, 'first');
    queue.enqueue(ACCOUNT, 'attempt', {}, 'second');

    queue.markInflight(ACCOUNT, ['first']);
    queue.backoff(ACCOUNT, 'first', { code: 'UNAVAILABLE', message: 'x' });

    expect(queue.take(ACCOUNT).map((item) => item.id)).toContain('second');
  });

  it('always sends at least one item even if oversized', () => {
    // A single large replay must not be able to wedge the queue permanently.
    queue.enqueue(ACCOUNT, 'attempt', { big: 'x'.repeat(600_000) }, 'huge');
    expect(queue.take(ACCOUNT)).toHaveLength(1);
  });
});

describe('failure handling', () => {
  it('a transient failure keeps the item, whatever the attempt count', () => {
    queue.enqueue(ACCOUNT, 'attempt', {}, 'flaky');

    for (let i = 0; i < 50; i++) {
      queue.markInflight(ACCOUNT, ['flaky']);
      queue.backoff(ACCOUNT, 'flaky', { code: 'UNAVAILABLE', message: 'down' });
    }

    // The student did the work; the network is what is broken.
    expect(queue.all(ACCOUNT)).toHaveLength(1);
    expect(queue.all(ACCOUNT)[0]?.status).toBe('pending');
  });

  it('backoff grows and then caps', () => {
    expect(backoffFor(0)).toBe(5_000);
    expect(backoffFor(4)).toBe(1_800_000);
    expect(backoffFor(99)).toBe(1_800_000);
  });

  it('a permanent failure is kept so it can be explained', () => {
    queue.enqueue(ACCOUNT, 'attempt', {}, 'rejected');
    queue.markPermanent(ACCOUNT, 'rejected', {
      code: 'VALIDATION_FAILED',
      message: 'replay mismatch',
    });

    // Deleting it would make the points quietly disappear with no explanation,
    // which reads as the system cheating.
    expect(queue.permanentFailures(ACCOUNT)).toHaveLength(1);
    expect(queue.take(ACCOUNT)).toHaveLength(0);
  });

  it('classifies errors the right way round', () => {
    expect(isPermanent('VALIDATION_FAILED')).toBe(true);
    expect(isPermanent('INVALID_ARGUMENT')).toBe(true);
    // Everything unrecognised defaults to transient: wrongly calling a
    // transient error permanent destroys work, the reverse costs a retry.
    expect(isPermanent('UNAVAILABLE')).toBe(false);
    expect(isPermanent('SOMETHING_NEW')).toBe(false);
    expect(isPermanent(undefined)).toBe(false);

    expect(needsRecovery('CATALOG_STALE')).toBe('catalog');
    expect(needsRecovery('UNAUTHENTICATED')).toBe('session');
    expect(needsRecovery('UNAVAILABLE')).toBeNull();
  });
});

describe('recovery', () => {
  it('returns items stranded inflight by a killed app', () => {
    queue.enqueue(ACCOUNT, 'attempt', {}, 'stranded');
    queue.markInflight(ACCOUNT, ['stranded']);
    expect(queue.take(ACCOUNT)).toHaveLength(0);

    queue.recoverInflight(ACCOUNT);
    expect(queue.take(ACCOUNT)).toHaveLength(1);
  });

  it('removes an item only once it is confirmed', () => {
    queue.enqueue(ACCOUNT, 'attempt', {}, 'confirmed');
    queue.markInflight(ACCOUNT, ['confirmed']);
    expect(queue.all(ACCOUNT)).toHaveLength(1);

    queue.remove(ACCOUNT, 'confirmed');
    expect(queue.all(ACCOUNT)).toHaveLength(0);
  });

  it('reports the oldest waiting item for the offline indicator', () => {
    expect(queue.oldestPendingAt(ACCOUNT)).toBeNull();
    queue.enqueue(ACCOUNT, 'attempt', {}, 'old');
    expect(queue.oldestPendingAt(ACCOUNT)).toBeGreaterThan(0);
  });
});
