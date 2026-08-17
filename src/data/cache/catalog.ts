/**
 * The content cache.
 *
 * Missions are stored whole, by catalog version, with their hash verified on
 * write and on read (TRD-SYNC-010). A partially-written catalog is worse than
 * none: the student plays against rules the server will not recognise, and
 * every attempt comes back rejected through no fault of theirs.
 *
 * The previous version is kept until the outbox drains. Discarding it while
 * attempts played against it are still queued would make those attempts
 * unvalidatable — punishing exactly the students the offline design exists to
 * serve.
 */

import type { Mission } from '@lenterra/core';
import { hashValue } from '@lenterra/core';

import { ACCOUNT_KEYS, accountStorage, readJson, writeJson } from './storage';

interface CachedPart {
  version: string;
  sha256: string;
  body: unknown;
  storedAt: number;
}

function partKey(version: string, part: string): string {
  return `${ACCOUNT_KEYS.catalogPart}${version}:${part}`;
}

export function currentCatalogVersion(accountId: string): string | null {
  return accountStorage(accountId).getString(ACCOUNT_KEYS.catalogVersion) ?? null;
}

export function setCurrentCatalogVersion(accountId: string, version: string): void {
  accountStorage(accountId).set(ACCOUNT_KEYS.catalogVersion, version);
}

/**
 * Store a catalog part, verifying its hash first.
 *
 * Returns false when the hash does not match, so the caller re-pulls that part
 * rather than caching something corrupt.
 */
export function storePart(
  accountId: string,
  version: string,
  part: string,
  sha256: string,
  body: unknown,
): boolean {
  // The server sends the digest it computed; recomputing it here is what turns
  // "the download said it succeeded" into "the bytes are the right bytes".
  if (hashValue(body) !== sha256) return false;

  writeJson(accountStorage(accountId), partKey(version, part), {
    version,
    sha256,
    body,
    storedAt: Date.now(),
  } satisfies CachedPart);
  return true;
}

export function readPart<T>(accountId: string, version: string, part: string): T | null {
  const cached = readJson<CachedPart>(accountStorage(accountId), partKey(version, part));
  if (!cached) return null;

  // Verified again on read: MMKV survives crashes and low-storage kills, and a
  // truncated write is exactly the case that would otherwise play silently.
  if (hashValue(cached.body) !== cached.sha256) {
    accountStorage(accountId).delete(partKey(version, part));
    return null;
  }
  return cached.body as T;
}

export function missionsFor(accountId: string, version: string, game: string): Mission[] {
  return readPart<Mission[]>(accountId, version, `missions.${game}`) ?? [];
}

/** What a reward is. All three kinds are cosmetic; nothing here changes a game. */
export interface RewardItem {
  id: string;
  cost: number;
  kind: 'avatar_color' | 'board_skin' | 'title';
  value: string;
}

/**
 * The reward shop, from the catalog already on the device.
 *
 * Read locally rather than fetched, so the shop opens with no connection —
 * which is the normal state for the students who earn the points.
 *
 * Sorted by cost. A list ordered by whatever the authoring file happened to
 * contain would put an 800-point title above a 100-point colour, and the first
 * thing a student wants to know is what they can afford now.
 */
export function rewardCatalog(accountId: string): RewardItem[] {
  const version = currentCatalogVersion(accountId);
  if (!version) return [];

  const body = readPart<Record<string, Omit<RewardItem, 'id'>>>(
    accountId,
    version,
    'rewards.catalog',
  );
  if (!body) return [];

  return Object.keys(body)
    .map((id) => ({ id, ...(body[id] as Omit<RewardItem, 'id'>) }))
    .sort((a, b) => a.cost - b.cost);
}

/**
 * Find a mission by id, across games.
 *
 * Looks in the named version first and falls back to whatever is cached, so a
 * student who has queued an attempt against an older catalog can still open
 * the mission and see what they played.
 */
export function findMission(
  accountId: string,
  missionId: string,
  version?: string,
): { mission: Mission; catalogVersion: string } | null {
  const target = version ?? currentCatalogVersion(accountId);
  if (!target) return null;

  const game = missionId.slice(0, missionId.indexOf('.'));
  for (const mission of missionsFor(accountId, target, game)) {
    if (mission.id === missionId) return { mission, catalogVersion: target };
  }
  return null;
}

/** Which parts of a manifest are missing or stale locally. */
export function partsToPull(
  accountId: string,
  version: string,
  manifest: { part: string; sha256: string }[],
): string[] {
  const missing: string[] = [];
  for (const entry of manifest) {
    const cached = readJson<CachedPart>(accountStorage(accountId), partKey(version, entry.part));
    if (!cached || cached.sha256 !== entry.sha256) missing.push(entry.part);
  }
  return missing;
}

/**
 * Drop a superseded catalog version.
 *
 * The caller must confirm the outbox is empty first — see the note at the top
 * of this file.
 */
export function evictVersion(accountId: string, version: string, parts: string[]): void {
  const store = accountStorage(accountId);
  for (const part of parts) store.delete(partKey(version, part));
}
