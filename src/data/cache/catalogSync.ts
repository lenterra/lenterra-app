/**
 * Pulling the catalog (TRD-SYNC-010, -011, -012).
 *
 * `catalog.ts` could store and verify content from the day it was written, and
 * nothing ever called it — so `missionsFor` returned an empty array, the games
 * tab rendered "catalog stale" forever, and every mission, the solver that
 * verified them and the engine that plays them were unreachable through the UI.
 * This is the missing half.
 *
 * Four properties the naive version would not have:
 *
 *  - **Resumable.** Parts are stored one at a time and `partsToPull` recomputes
 *    what is still missing, so a prefetch killed halfway resumes rather than
 *    restarting. On the target connection, restarting means never finishing.
 *  - **Batched under the server's cap.** `v1.catalog.pull` rejects a request
 *    over 2 MB rather than truncating it, so the batching lives here where the
 *    byte counts from the manifest are.
 *  - **The version pointer moves last.** A student is never pointed at a
 *    version whose parts are only half stored; until every part is down, the
 *    old catalog is the current one and stays playable.
 *  - **Deferred during play.** Swapping content under a mission in progress
 *    would invalidate the attempt the student is in the middle of.
 */

import type { Mission } from '@lenterra/core';
import { z } from 'zod';

import { rpc, RpcError } from '../nakama/rpc';
import { connectivity } from '../../lib/net';
import { pendingCount } from '../outbox/queue';
import {
  currentCatalogVersion,
  evictVersion,
  missionsFor,
  partsToPull,
  setCurrentCatalogVersion,
  storePart,
} from './catalog';
import { ACCOUNT_KEYS, accountStorage, readJson, writeJson } from './storage';

/** Matches `MAX_PULL_BYTES` server-side. Kept just under it for headroom. */
const MAX_BATCH_BYTES = 1_800_000;

/**
 * What we are willing to pull without being asked, on a cellular connection.
 *
 * Above this the update waits for wifi and the student is told there is one,
 * rather than a week's data allowance disappearing into a background fetch
 * (PRD-ACC-007, TRD-PERF-005).
 */
const METERED_AUTO_LIMIT_BYTES = 500_000;

const ManifestSchema = z.object({
  version: z.string(),
  parts: z.array(
    z.object({
      part: z.string(),
      sha256: z.string(),
      bytes: z.number(),
      changed: z.boolean(),
      available: z.boolean(),
    }),
  ),
  totalBytes: z.number(),
  changedBytes: z.number(),
});

const PullSchema = z.object({
  version: z.string(),
  parts: z.array(z.object({ part: z.string(), sha256: z.string(), body: z.unknown() })),
});

export type ManifestPart = z.infer<typeof ManifestSchema>['parts'][number];

export interface CatalogProgress {
  /** Parts stored so far in this run. */
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
}

export type CatalogSyncResult =
  | { status: 'up-to-date'; version: string }
  | { status: 'updated'; version: string; partsStored: number }
  | { status: 'deferred'; reason: 'play-in-progress' | 'metered'; version: string; bytes: number }
  | { status: 'failed'; reason: string };

/**
 * A record of an update we chose not to take automatically.
 *
 * Kept so the student can be offered it explicitly — an update that is silently
 * skipped on cellular and never mentioned is indistinguishable from one that is
 * broken.
 */
interface DeferredUpdate {
  version: string;
  bytes: number;
  noticedAt: number;
}

const DEFERRED_KEY = 'catalog-deferred-update';

export function deferredUpdate(accountId: string): DeferredUpdate | null {
  return readJson<DeferredUpdate>(accountStorage(accountId), DEFERRED_KEY);
}

function rememberDeferred(accountId: string, version: string, bytes: number): void {
  writeJson(accountStorage(accountId), DEFERRED_KEY, {
    version,
    bytes,
    noticedAt: Date.now(),
  } satisfies DeferredUpdate);
}

function clearDeferred(accountId: string): void {
  accountStorage(accountId).delete(DEFERRED_KEY);
}

// ---------------------------------------------------------------------------
// Play interlock (TRD-SYNC-011)
// ---------------------------------------------------------------------------

let playInProgress = 0;

/**
 * Hold off catalog swaps while a mission is being played.
 *
 * A counter rather than a boolean: two overlapping holders (a mission and, say,
 * a tutorial replay) must both release before the catalog is free to move.
 */
export function holdCatalog(): () => void {
  playInProgress += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    playInProgress = Math.max(0, playInProgress - 1);
  };
}

export function catalogHeld(): boolean {
  return playInProgress > 0;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export interface SyncCatalogOptions {
  onProgress?: (progress: CatalogProgress) => void;
  /** Set when the student asked for the update, which overrides the data budget. */
  force?: boolean;
}

/**
 * Bring the cached catalog up to the server's current version.
 *
 * Safe to call on every connect: when nothing has changed it costs one small
 * request and stores nothing.
 */
export async function syncCatalog(
  accountId: string,
  options: SyncCatalogOptions = {},
): Promise<CatalogSyncResult> {
  const have = currentCatalogVersion(accountId);

  let manifest: z.infer<typeof ManifestSchema>;
  try {
    manifest = await rpc(
      accountId,
      'v1.catalog.manifest',
      have ? { haveVersion: have } : {},
      { schema: ManifestSchema },
    );
  } catch (err) {
    return { status: 'failed', reason: err instanceof RpcError ? err.code : 'UNAVAILABLE' };
  }

  // Server-only parts are listed so the byte accounting adds up, and must not
  // be requested — the server rejects them, and a rejected batch would stall
  // the whole update behind a part the client can never have.
  const pullable = manifest.parts.filter((part) => part.available);
  const missing = partsToPull(accountId, manifest.version, pullable);

  if (missing.length === 0) {
    if (have !== manifest.version) {
      // Everything is already stored under this version — a previous run got
      // the parts down but was killed before the pointer moved.
      commitVersion(accountId, manifest.version, pullable, have);
    }
    clearDeferred(accountId);
    return { status: 'up-to-date', version: manifest.version };
  }

  const wanted = pullable.filter((part) => missing.includes(part.part));
  const bytes = wanted.reduce((sum, part) => sum + part.bytes, 0);

  if (catalogHeld() && have) {
    rememberDeferred(accountId, manifest.version, bytes);
    return { status: 'deferred', reason: 'play-in-progress', version: manifest.version, bytes };
  }

  // A first install has no playable content at all, so it goes ahead on any
  // connection: refusing it would leave the student with an app that cannot do
  // anything, which is worse than the data it costs.
  const budgeted = have !== null && !options.force;
  if (budgeted && connectivity().metered && bytes > METERED_AUTO_LIMIT_BYTES) {
    rememberDeferred(accountId, manifest.version, bytes);
    return { status: 'deferred', reason: 'metered', version: manifest.version, bytes };
  }

  const progress: CatalogProgress = {
    done: 0,
    total: wanted.length,
    bytesDone: 0,
    bytesTotal: bytes,
  };
  options.onProgress?.(progress);

  for (const batch of batches(wanted)) {
    let response: z.infer<typeof PullSchema>;
    try {
      response = await rpc(
        accountId,
        'v1.catalog.pull',
        { version: manifest.version, parts: batch.map((part) => part.part) },
        { schema: PullSchema },
      );
    } catch (err) {
      // Parts already stored stay stored; the next run resumes from there.
      return { status: 'failed', reason: err instanceof RpcError ? err.code : 'UNAVAILABLE' };
    }

    for (const part of response.parts) {
      if (!storePart(accountId, manifest.version, part.part, part.sha256, part.body)) {
        // The bytes arrived but do not hash to what the manifest promised.
        // Reporting beats retrying blind: a mismatch that repeats is a real
        // disagreement about content, and silently looping would hide it.
        return { status: 'failed', reason: 'integrity' };
      }
      progress.done += 1;
      progress.bytesDone += batch.find((b) => b.part === part.part)?.bytes ?? 0;
      options.onProgress?.({ ...progress });
    }
  }

  // Anything still missing means the server did not send a part it listed.
  // Moving the pointer now would point the student at an incomplete catalog.
  const stillMissing = partsToPull(accountId, manifest.version, pullable);
  if (stillMissing.length > 0) {
    return { status: 'failed', reason: 'incomplete' };
  }

  commitVersion(accountId, manifest.version, pullable, have);
  clearDeferred(accountId);
  return { status: 'updated', version: manifest.version, partsStored: wanted.length };
}

/**
 * Move the pointer, and drop the superseded version only when it is safe.
 *
 * Attempts queued against the old catalog still need it: the server validates
 * a replay against the version it was played on, and a client that has thrown
 * that version away cannot show the student what they played (TRD-SYNC-011).
 * When the outbox is not empty the old version simply stays; the next commit
 * with a drained queue collects it.
 */
function commitVersion(
  accountId: string,
  version: string,
  parts: ManifestPart[],
  previous: string | null,
): void {
  // The index is what makes eviction possible later: MMKV cannot enumerate
  // keys by prefix, so a version that never recorded its own part names could
  // only be deleted by guessing.
  writeJson(
    accountStorage(accountId),
    partsIndexKey(version),
    parts.map((part) => part.part),
  );
  setCurrentCatalogVersion(accountId, version);

  if (!previous || previous === version) return;
  if (pendingCount(accountId) > 0) return;

  const stale = readJson<string[]>(accountStorage(accountId), partsIndexKey(previous));
  if (stale) {
    evictVersion(accountId, previous, stale);
    accountStorage(accountId).delete(partsIndexKey(previous));
  }
}

function partsIndexKey(version: string): string {
  return `${ACCOUNT_KEYS.catalogPart}index:${version}`;
}

/** Group parts into requests that stay under the server's response cap. */
function batches(parts: ManifestPart[]): ManifestPart[][] {
  const out: ManifestPart[][] = [];
  let current: ManifestPart[] = [];
  let size = 0;

  for (const part of parts) {
    // A single oversized part gets its own request. The server will reject it
    // and say so, which is a clearer failure than never attempting it.
    if (current.length > 0 && size + part.bytes > MAX_BATCH_BYTES) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(part);
    size += part.bytes;
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * Missions across every game in the cached catalog.
 *
 * Goes through `missionsFor` rather than reading the keys directly, so the
 * read-time hash check applies here too. A cross-game surface is exactly where
 * a silently corrupt part would be least obvious.
 */
export function allCachedMissions(accountId: string, games: readonly string[]): Mission[] {
  const version = currentCatalogVersion(accountId);
  if (!version) return [];

  const out: Mission[] = [];
  for (const game of games) out.push(...missionsFor(accountId, version, game));
  return out;
}
