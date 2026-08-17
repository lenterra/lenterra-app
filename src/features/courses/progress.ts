/**
 * Lesson progress, kept on the device.
 *
 * The server is the durable record — it survives a reinstall (PRD-CRS-007) —
 * but it returns a *count* of lessons completed per course, not which ones. A
 * count cannot answer "where do I resume", and a student two weeks offline
 * needs that answer without asking anyone.
 *
 * So completion is recorded here the moment it happens, queued for the server,
 * and the two are reconciled by taking whichever knows about more: the device
 * knows about work not yet synced, the server knows about work done on another
 * device.
 */

import { ACCOUNT_KEYS, accountStorage, readJson, writeJson } from '../../data/cache/storage';
import * as queue from '../../data/outbox/queue';

const KEY = `${ACCOUNT_KEYS.settings}:lessons-completed`;

type CompletionMap = Record<string, number>;

function read(accountId: string): CompletionMap {
  return readJson<CompletionMap>(accountStorage(accountId), KEY) ?? {};
}

/** Lesson ids the student has finished, oldest first. */
export function completedLessons(accountId: string, courseId?: string): string[] {
  const map = read(accountId);
  return Object.keys(map)
    .filter((id) => courseId === undefined || id.indexOf(`${courseId}.`) === 0)
    .sort((a, b) => (map[a] ?? 0) - (map[b] ?? 0));
}

export function isLessonComplete(accountId: string, lessonId: string): boolean {
  return read(accountId)[lessonId] !== undefined;
}

/**
 * Mark a lesson read.
 *
 * Written before the queue, in that order: a crash between the two costs a
 * sync, while the reverse would show a lesson as unread that the student has
 * already finished and been credited for.
 */
export function completeLesson(accountId: string, courseId: string, lessonId: string): void {
  const map = read(accountId);
  if (map[lessonId] !== undefined) return;

  map[lessonId] = Date.now();
  writeJson(accountStorage(accountId), KEY, map);
  queue.enqueue(accountId, 'lesson', { courseId, lessonId });
}

/**
 * How many lessons of a course are done, reconciling device and server.
 *
 * The larger of the two, because each knows something the other does not and
 * neither is ever wrong about work that happened — only about work it has not
 * heard of yet.
 */
export function lessonsCompletedIn(
  accountId: string,
  courseId: string,
  serverCount: number | undefined,
): number {
  const local = completedLessons(accountId, courseId).length;
  return Math.max(local, serverCount ?? 0);
}
