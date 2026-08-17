/**
 * Work a teacher has assigned.
 *
 * `v1.sync.pull` is the only channel that carries an assignment to a device,
 * and nothing called it — so a teacher could not create one and, had they
 * managed to, no student would have seen it. This is the client half.
 *
 * Stored locally rather than fetched when a screen opens. Everything else in
 * this product assumes a student is usually offline, and an assignment is
 * exactly the thing they need to read when they are: on the bus, at home,
 * anywhere that is not the one corner of the school with signal.
 *
 * Dismissal is local and permanent-ish. The server has no concept of a student
 * acknowledging an assignment, and inventing one would mean a teacher's screen
 * implying a child had read something when all it recorded was a tap.
 */

import { ACCOUNT_KEYS, accountStorage, readJson, writeJson } from './storage';

export interface Assignment {
  id: string;
  kind: 'mission' | 'lesson';
  targetId: string;
  note?: string;
  withdrawn: boolean;
}

interface Stored {
  assignments: Assignment[];
  dismissedIds: string[];
  pulledAt: number;
}

const EMPTY: Stored = { assignments: [], dismissedIds: [], pulledAt: 0 };

function read(accountId: string): Stored {
  return readJson<Stored>(accountStorage(accountId), ACCOUNT_KEYS.assignments) ?? EMPTY;
}

/**
 * Replace the assignment list with what the server just sent.
 *
 * Dismissals are kept across a pull, and pruned to ids the server still knows
 * about — otherwise the list of dismissals grows for the life of the account,
 * and a re-assigned lesson would stay silently dismissed forever.
 */
export function storeAssignments(accountId: string, assignments: Assignment[], now: number): void {
  const previous = read(accountId);
  const live = new Set(assignments.map((assignment) => assignment.id));

  writeJson(accountStorage(accountId), ACCOUNT_KEYS.assignments, {
    assignments,
    dismissedIds: previous.dismissedIds.filter((id) => live.has(id)),
    pulledAt: now,
  } satisfies Stored);
}

/** What to show: not withdrawn, not dismissed here. */
export function activeAssignments(accountId: string): Assignment[] {
  const stored = read(accountId);
  const dismissed = new Set(stored.dismissedIds);
  return stored.assignments.filter(
    (assignment) => !assignment.withdrawn && !dismissed.has(assignment.id),
  );
}

export function dismissAssignment(accountId: string, assignmentId: string): void {
  const stored = read(accountId);
  if (stored.dismissedIds.includes(assignmentId)) return;

  writeJson(accountStorage(accountId), ACCOUNT_KEYS.assignments, {
    ...stored,
    dismissedIds: [...stored.dismissedIds, assignmentId],
  } satisfies Stored);
}

export function assignmentsPulledAt(accountId: string): number {
  return read(accountId).pulledAt;
}
