/**
 * Catalog sync.
 *
 * The behaviour under test is the one whose absence made every authored
 * mission unreachable, so it is worth pinning down precisely rather than
 * asserting "it downloads". Four properties matter:
 *
 *  - a half-finished pull leaves the student on the old catalog, playable
 *  - an interrupted pull resumes instead of restarting
 *  - a part whose bytes do not match its digest is refused
 *  - the old version survives while attempts against it are still queued
 */

import { hashValue } from '@lenterra/core';

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

const mockRpc = jest.fn();
jest.mock('../../nakama/rpc', () => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
  RpcError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock('../../../lib/net', () => ({
  connectivity: () => ({ online: true, metered: false, type: 'wifi' }),
}));

import { currentCatalogVersion, missionsFor } from '../catalog';
import { holdCatalog, syncCatalog } from '../catalogSync';
import * as queue from '../../outbox/queue';

const ACCOUNT = 'account-1';

const MISSIONS_A = [{ id: 'congklak.m01', rank: 1 }];
const MISSIONS_B = [
  { id: 'congklak.m01', rank: 1 },
  { id: 'congklak.m02', rank: 2 },
];
const STRINGS = { 'mission.m01.title': 'Satu' };

/** A manifest whose digests are the real ones, so storePart's check is live. */
function manifest(version: string, bodies: Record<string, unknown>, extra = {}) {
  return {
    version,
    parts: Object.entries(bodies).map(([part, body]) => ({
      part,
      sha256: hashValue(body),
      bytes: JSON.stringify(body).length,
      changed: true,
      available: true,
      ...extra,
    })),
    totalBytes: 0,
    changedBytes: 0,
  };
}

function pullResponse(version: string, bodies: Record<string, unknown>, parts: string[]) {
  return {
    version,
    parts: parts.map((part) => ({
      part,
      sha256: hashValue(bodies[part]),
      body: bodies[part],
    })),
  };
}

/** Wire the two RPCs to a given catalog. */
function serve(version: string, bodies: Record<string, unknown>) {
  mockRpc.mockImplementation((_account: string, name: string, req: { parts?: string[] }) => {
    if (name === 'v1.catalog.manifest') return Promise.resolve(manifest(version, bodies));
    if (name === 'v1.catalog.pull') {
      return Promise.resolve(pullResponse(version, bodies, req.parts ?? []));
    }
    throw new Error(`unexpected rpc ${name}`);
  });
}

beforeEach(() => {
  mockMemory.clear();
  mockRpc.mockReset();
});

describe('syncCatalog', () => {
  it('stores every part and points the student at the new version', async () => {
    serve('v1', { 'missions.congklak': MISSIONS_A, 'strings.id': STRINGS });

    const result = await syncCatalog(ACCOUNT);

    expect(result).toEqual({ status: 'updated', version: 'v1', partsStored: 2 });
    expect(currentCatalogVersion(ACCOUNT)).toBe('v1');
    expect(missionsFor(ACCOUNT, 'v1', 'congklak')).toHaveLength(1);
  });

  it('does nothing on a second run', async () => {
    serve('v1', { 'missions.congklak': MISSIONS_A });
    await syncCatalog(ACCOUNT);

    const pullsBefore = mockRpc.mock.calls.filter((c) => c[1] === 'v1.catalog.pull').length;
    const result = await syncCatalog(ACCOUNT);
    const pullsAfter = mockRpc.mock.calls.filter((c) => c[1] === 'v1.catalog.pull').length;

    expect(result).toEqual({ status: 'up-to-date', version: 'v1' });
    expect(pullsAfter).toBe(pullsBefore);
  });

  it('leaves the old catalog current when the pull fails halfway', async () => {
    serve('v1', { 'missions.congklak': MISSIONS_A });
    await syncCatalog(ACCOUNT);

    // v2 exists, but the network dies on the pull.
    mockRpc.mockImplementation((_a: string, name: string) => {
      if (name === 'v1.catalog.manifest') {
        return Promise.resolve(manifest('v2', { 'missions.congklak': MISSIONS_B }));
      }
      return Promise.reject(new Error('connection lost'));
    });

    const result = await syncCatalog(ACCOUNT);

    expect(result.status).toBe('failed');
    // The student is still on v1 and can still play it. Pointing at a version
    // with no parts stored would empty the games tab for no reason they caused.
    expect(currentCatalogVersion(ACCOUNT)).toBe('v1');
    expect(missionsFor(ACCOUNT, 'v1', 'congklak')).toHaveLength(1);
  });

  it('resumes from what it already stored', async () => {
    const bodies = { 'missions.congklak': MISSIONS_B, 'strings.id': STRINGS };

    // First run: the second part never arrives.
    mockRpc.mockImplementation((_a: string, name: string, req: { parts?: string[] }) => {
      if (name === 'v1.catalog.manifest') return Promise.resolve(manifest('v1', bodies));
      const parts = (req.parts ?? []).filter((p) => p === 'missions.congklak');
      if (parts.length === 0) return Promise.reject(new Error('connection lost'));
      return Promise.resolve(pullResponse('v1', bodies, parts));
    });
    await syncCatalog(ACCOUNT);

    // Second run: only the missing part is requested.
    serve('v1', bodies);
    const result = await syncCatalog(ACCOUNT);

    expect(result).toEqual({ status: 'updated', version: 'v1', partsStored: 1 });
    const pull = mockRpc.mock.calls.filter((c) => c[1] === 'v1.catalog.pull').pop();
    expect((pull?.[2] as { parts: string[] }).parts).toEqual(['strings.id']);
  });

  it('refuses a part whose bytes do not match the digest', async () => {
    mockRpc.mockImplementation((_a: string, name: string) => {
      if (name === 'v1.catalog.manifest') {
        return Promise.resolve(manifest('v1', { 'missions.congklak': MISSIONS_A }));
      }
      // The digest is the one the manifest promised; the body is not.
      return Promise.resolve({
        version: 'v1',
        parts: [
          {
            part: 'missions.congklak',
            sha256: hashValue(MISSIONS_A),
            body: [{ id: 'congklak.m99', rank: 99 }],
          },
        ],
      });
    });

    const result = await syncCatalog(ACCOUNT);

    expect(result).toEqual({ status: 'failed', reason: 'integrity' });
    expect(currentCatalogVersion(ACCOUNT)).toBeNull();
  });

  it('never requests a part the server marks unavailable', async () => {
    const bodies = { 'missions.congklak': MISSIONS_A };
    mockRpc.mockImplementation((_a: string, name: string, req: { parts?: string[] }) => {
      if (name === 'v1.catalog.manifest') {
        const m = manifest('v1', bodies);
        m.parts.push({
          part: 'checks.answers',
          sha256: 'x'.repeat(64),
          bytes: 10,
          changed: true,
          available: false,
        });
        return Promise.resolve(m);
      }
      return Promise.resolve(pullResponse('v1', bodies, req.parts ?? []));
    });

    const result = await syncCatalog(ACCOUNT);

    expect(result.status).toBe('updated');
    const requested = mockRpc.mock.calls
      .filter((c) => c[1] === 'v1.catalog.pull')
      .flatMap((c) => (c[2] as { parts: string[] }).parts);
    expect(requested).not.toContain('checks.answers');
  });

  it('defers an update while a mission is being played', async () => {
    serve('v1', { 'missions.congklak': MISSIONS_A });
    await syncCatalog(ACCOUNT);

    serve('v2', { 'missions.congklak': MISSIONS_B });
    const release = holdCatalog();
    const held = await syncCatalog(ACCOUNT);

    expect(held.status).toBe('deferred');
    expect(currentCatalogVersion(ACCOUNT)).toBe('v1');

    release();
    const after = await syncCatalog(ACCOUNT);
    expect(after.status).toBe('updated');
    expect(currentCatalogVersion(ACCOUNT)).toBe('v2');
  });

  it('keeps the superseded version while attempts against it are queued', async () => {
    serve('v1', { 'missions.congklak': MISSIONS_A });
    await syncCatalog(ACCOUNT);

    // An attempt played on v1 and not yet sent.
    queue.enqueue(ACCOUNT, 'attempt', { missionId: 'congklak.m01', contentVersion: 'v1' });

    serve('v2', { 'missions.congklak': MISSIONS_B });
    await syncCatalog(ACCOUNT);

    expect(currentCatalogVersion(ACCOUNT)).toBe('v2');
    // v1 is still readable: the server validates that replay against the
    // version it was played on, and the student can still be shown it.
    expect(missionsFor(ACCOUNT, 'v1', 'congklak')).toHaveLength(1);
  });

  it('drops the superseded version once nothing is queued against it', async () => {
    serve('v1', { 'missions.congklak': MISSIONS_A });
    await syncCatalog(ACCOUNT);

    serve('v2', { 'missions.congklak': MISSIONS_B });
    await syncCatalog(ACCOUNT);

    expect(missionsFor(ACCOUNT, 'v1', 'congklak')).toHaveLength(0);
    expect(missionsFor(ACCOUNT, 'v2', 'congklak')).toHaveLength(2);
  });
});
