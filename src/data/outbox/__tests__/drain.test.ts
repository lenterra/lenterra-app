/**
 * Draining the outbox.
 *
 * This is where a student's two weeks of offline play is either banked or lost.
 * Every case below is one way it could be lost quietly: a transient error
 * mistaken for a terminal one, a partial batch treated as a whole failure, a
 * rejected item that vanishes without the student being told, or a loop that
 * resends the same batch forever and never reaches the rest of the queue.
 */

import { drain, isDraining } from '../drain';
import * as queue from '../queue';
import { RpcError } from '../../nakama/rpc';

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

/**
 * The RPC module is replaced entirely rather than partially.
 *
 * `requireActual` would pull in `lib/config`, which throws at import when its
 * environment is absent — and Expo's Babel preset inlines `EXPO_PUBLIC_*` reads
 * at transform time, so setting the variables at runtime does not reach it.
 * Supplying `RpcError` here keeps `instanceof` consistent: the drain imports the
 * class from this same module, so both sides see the same constructor.
 *
 * Prefixed with `mock` so Jest's hoisting allows the factory to close over it.
 */
const mockRpc = jest.fn();

// The drain reads `config.clientVersion` directly; see the manual mock for why
// it cannot simply be imported in a test.
jest.mock('../../../lib/config');

jest.mock('../../nakama/rpc', () => {
  class MockRpcError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'RpcError';
      this.code = code;
    }
  }
  return {
    RpcError: MockRpcError,
    rpc: (...args: unknown[]) => mockRpc(...args),
  };
});

const rpc = mockRpc;

const ACCOUNT = 'account-1';

beforeEach(() => {
  mockMemory.clear();
  rpc.mockReset();
});

function applied(ids: string[]) {
  return {
    results: ids.map((id) => ({ idempotencyKey: id, status: 'applied' as const })),
    summary: { points: 10, streakDays: 1, rank: null },
  };
}

describe('a successful drain', () => {
  it('clears applied items and reports what it sent', async () => {
    const a = queue.enqueue(ACCOUNT, 'attempt', { missionId: 'congklak.m01' });
    const b = queue.enqueue(ACCOUNT, 'check', { checkId: 'algo.loops.l01' });
    rpc.mockResolvedValue(applied([a.id, b.id]));

    const outcome = await drain(ACCOUNT);

    expect(outcome.applied).toBe(2);
    expect(outcome.remaining).toBe(0);
    expect(queue.all(ACCOUNT)).toHaveLength(0);
  });

  it('treats a duplicate exactly like an applied item', async () => {
    // A retry after a response was lost in transit is the normal case, not an
    // exception. Leaving duplicates queued would mean an interrupted sync never
    // finishes draining.
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockResolvedValue({
      results: [{ idempotencyKey: item.id, status: 'duplicate' }],
    });

    const outcome = await drain(ACCOUNT);
    expect(outcome.applied).toBe(1);
    expect(queue.all(ACCOUNT)).toHaveLength(0);
  });

  it('hands the server result back so a provisional score can be corrected', async () => {
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockResolvedValue({
      results: [{ idempotencyKey: item.id, status: 'applied', data: { outcome: 'failure' } }],
    });

    const onApplied = jest.fn();
    await drain(ACCOUNT, { onApplied });

    expect(onApplied).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id }),
      { outcome: 'failure' },
    );
  });
});

describe('failure classification', () => {
  it('keeps an item queued when the whole batch fails to reach the server', async () => {
    // The student did the work; the network is what is broken. Nothing may be
    // discarded here, however many times it has failed.
    queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockRejectedValue(new RpcError('OFFLINE', 'no connection'));

    const outcome = await drain(ACCOUNT);

    expect(outcome.stoppedBecause).toBe('offline');
    expect(queue.all(ACCOUNT)).toHaveLength(1);
    expect(queue.all(ACCOUNT)[0]?.status).toBe('pending');
  });

  it('removes a permanently rejected item and tells the student why', async () => {
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockResolvedValue({
      results: [
        {
          idempotencyKey: item.id,
          status: 'rejected',
          error: { code: 'VALIDATION_FAILED', message: 'replay did not validate' },
        },
      ],
    });

    const onCorrection = jest.fn();
    const outcome = await drain(ACCOUNT, { onCorrection });

    expect(outcome.rejected).toBe(1);
    expect(onCorrection).toHaveBeenCalled();
    // Kept in the queue rather than deleted: points that silently vanish read
    // as the system cheating.
    expect(queue.permanentFailures(ACCOUNT)).toHaveLength(1);
  });

  it('retries an item rejected for a transient reason', async () => {
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockResolvedValue({
      results: [
        {
          idempotencyKey: item.id,
          status: 'rejected',
          error: { code: 'UNAVAILABLE', message: 'server busy' },
        },
      ],
    });

    await drain(ACCOUNT);

    expect(queue.permanentFailures(ACCOUNT)).toHaveLength(0);
    expect(queue.all(ACCOUNT)[0]?.status).toBe('pending');
    expect(queue.all(ACCOUNT)[0]?.nextAttemptAt).toBeGreaterThan(0);
  });

  it('applies the good items in a batch that also contains a bad one', async () => {
    // Partial success is the normal case. Failing the whole batch would let one
    // bad item block a week of a student's work indefinitely.
    const good = queue.enqueue(ACCOUNT, 'attempt', { n: 1 });
    const bad = queue.enqueue(ACCOUNT, 'attempt', { n: 2 });
    rpc.mockResolvedValue({
      results: [
        { idempotencyKey: good.id, status: 'applied' },
        {
          idempotencyKey: bad.id,
          status: 'rejected',
          error: { code: 'VALIDATION_FAILED', message: 'nope' },
        },
      ],
    });

    const outcome = await drain(ACCOUNT);

    expect(outcome.applied).toBe(1);
    expect(outcome.rejected).toBe(1);
    expect(queue.all(ACCOUNT).map((entry) => entry.id)).toEqual([bad.id]);
  });
});

describe('recovery and safety', () => {
  it('pulls the catalog once and retries when the server says it is stale', async () => {
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    const refreshCatalog = jest.fn().mockResolvedValue(true);

    rpc
      .mockRejectedValueOnce(new RpcError('CATALOG_STALE', 'catalog moved on'))
      .mockResolvedValueOnce(applied([item.id]));

    const outcome = await drain(ACCOUNT, { refreshCatalog });

    expect(refreshCatalog).toHaveBeenCalledTimes(1);
    // The retry has to actually send. The failure above put the batch into a
    // backoff window, and without clearing it the "retry" finds an empty queue.
    expect(outcome.applied).toBe(1);
    expect(outcome.sent).toBe(1);
  });

  it('gives up after one catalog retry rather than looping', async () => {
    queue.enqueue(ACCOUNT, 'attempt', {});
    const refreshCatalog = jest.fn().mockResolvedValue(true);
    rpc.mockRejectedValue(new RpcError('CATALOG_STALE', 'still stale'));

    const outcome = await drain(ACCOUNT, { refreshCatalog });

    expect(refreshCatalog).toHaveBeenCalledTimes(1);
    expect(outcome.stoppedBecause).toBe('catalog_stale');
  });

  it('stops rather than spinning when a batch comes back entirely unapplied', async () => {
    // Every item non-applied and non-permanent means sending the same batch
    // again immediately would loop forever on a device with no signal.
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockResolvedValue({
      results: [
        {
          idempotencyKey: item.id,
          status: 'rejected',
          error: { code: 'UNAVAILABLE', message: 'busy' },
        },
      ],
    });

    await drain(ACCOUNT);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('runs one drain at a time per account', async () => {
    queue.enqueue(ACCOUNT, 'attempt', {});
    let release: (value: unknown) => void = () => {};
    rpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const first = drain(ACCOUNT);
    // A second drain while one is in flight would send the same items twice.
    const second = await drain(ACCOUNT);
    expect(second.sent).toBe(0);
    expect(isDraining(ACCOUNT)).toBe(true);

    release({ results: [] });
    await first;
    expect(isDraining(ACCOUNT)).toBe(false);
  });

  it('recovers items left in flight by a killed app', async () => {
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    queue.markInflight(ACCOUNT, [item.id]);
    rpc.mockResolvedValue(applied([item.id]));

    // The server may or may not have applied it; the idempotency key makes
    // retrying safe either way, and dropping it would lose the work.
    const outcome = await drain(ACCOUNT);
    expect(outcome.applied).toBe(1);
  });

  it('reports the summary the server returned', async () => {
    const item = queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockResolvedValue(applied([item.id]));

    const onSummary = jest.fn();
    await drain(ACCOUNT, { onSummary });

    expect(onSummary).toHaveBeenCalledWith({ points: 10, streakDays: 1, rank: null });
  });

  it('stops on an authentication failure without discarding anything', async () => {
    queue.enqueue(ACCOUNT, 'attempt', {});
    rpc.mockRejectedValue(new RpcError('UNAUTHENTICATED', 'session expired'));

    const outcome = await drain(ACCOUNT);

    expect(outcome.stoppedBecause).toBe('unauthenticated');
    expect(queue.pendingCount(ACCOUNT)).toBe(1);
  });

  it('does nothing at all on an empty queue', async () => {
    const outcome = await drain(ACCOUNT);
    expect(outcome.sent).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });
});
