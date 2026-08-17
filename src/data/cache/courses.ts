/**
 * Reading courses out of the catalog cache.
 *
 * Everything here works offline. The course index and every
 * lesson body arrive during the first connected session after enrolment — the
 * catalog sync pulls all available parts, so a student who has synced once has
 * the whole catalogue and never meets a lesson that needs the network to open.
 *
 * The one thing that is *not* here is the answer key. It lives in the
 * `checks.answers` part, which the server refuses to serve to a client. What
 * ships is a digest per item, enough to grade offline and worth nothing
 * afterwards — the score that counts is the one the server computes.
 */

import type { CheckPublic, CourseSummary, Lesson, SkillNodeId } from '@lenterra/core';
import { lessonForNode } from '@lenterra/core';

import { currentCatalogVersion, readPart } from './catalog';

export type { CheckPublic, CourseSummary, Lesson };

export function coursesFor(accountId: string, version: string): CourseSummary[] {
  return readPart<CourseSummary[]>(accountId, version, 'courses') ?? [];
}

/** The published course index, or an empty list before the first sync. */
export function allCourses(accountId: string): CourseSummary[] {
  const version = currentCatalogVersion(accountId);
  if (!version) return [];
  return coursesFor(accountId, version);
}

export function findCourse(
  accountId: string,
  courseId: string,
): { course: CourseSummary; catalogVersion: string } | null {
  const version = currentCatalogVersion(accountId);
  if (!version) return null;
  for (const course of coursesFor(accountId, version)) {
    if (course.id === courseId) return { course, catalogVersion: version };
  }
  return null;
}

/** Lesson bodies for one course. One catalog part each, so this is one read. */
export function lessonsFor(accountId: string, courseId: string, version?: string): Lesson[] {
  const target = version ?? currentCatalogVersion(accountId);
  if (!target) return [];
  return readPart<Lesson[]>(accountId, target, `lessons.${courseId}`) ?? [];
}

/**
 * Find a lesson by id, without needing to know its course.
 *
 * Lesson ids are `<courseId>.<slug>`, so the course is recoverable from the id
 * — which is what lets a struggle offer and a `gameLink` both address a lesson
 * directly rather than routing through the course index.
 */
export function findLesson(
  accountId: string,
  lessonId: string,
  version?: string,
): { lesson: Lesson; course: CourseSummary; catalogVersion: string } | null {
  const target = version ?? currentCatalogVersion(accountId);
  if (!target) return null;

  const separator = lessonId.lastIndexOf('.');
  if (separator < 0) return null;
  const courseId = lessonId.slice(0, separator);

  const found = findCourse(accountId, courseId);
  if (!found) return null;

  for (const lesson of lessonsFor(accountId, courseId, target)) {
    if (lesson.id === lessonId) {
      return { lesson, course: found.course, catalogVersion: target };
    }
  }
  return null;
}

/**
 * Where to resume a course.
 *
 * The first lesson the student has not completed, or the last one when they
 * have finished — returning to a finished course should open something, not
 * nothing.
 */
export function resumeLesson(course: CourseSummary, completedIds: string[]): string | null {
  if (course.lessons.length === 0) return null;
  for (const lesson of course.lessons) {
    if (!completedIds.includes(lesson.id)) return lesson.id;
  }
  return course.lessons[course.lessons.length - 1]?.id ?? null;
}

/** The lesson after this one, so a reader can offer "next" without the index. */
export function nextLessonId(course: CourseSummary, lessonId: string): string | null {
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0 || index + 1 >= course.lessons.length) return null;
  return course.lessons[index + 1]?.id ?? null;
}

export function checkOf(lesson: Lesson): CheckPublic | null {
  return lesson.check ?? null;
}

/**
 * The lesson to offer a student stuck on a node.
 *
 * Searches every published course, because the node a student is failing is not
 * necessarily in the course they last opened — most nodes are taught in one
 * course and practised in another.
 */
export function lessonCovering(accountId: string, node: string): Lesson | null {
  const version = currentCatalogVersion(accountId);
  if (!version) return null;

  // Compared across every course rather than stopping at the first one that
  // mentions the node. Most nodes are taught in one course and practised in
  // another, so "first match" reliably returns the lesson that touches the idea
  // in passing instead of the one that is about it.
  let best: Lesson | null = null;
  let bestRank = Number.MAX_SAFE_INTEGER;

  for (const course of coursesFor(accountId, version)) {
    if (!course.skillNodes.includes(node as SkillNodeId)) continue;

    const found = lessonForNode(lessonsFor(accountId, course.id, version), node as SkillNodeId);
    if (!found) continue;

    // Nodes are emitted heaviest first, so a lower position means the lesson
    // leans on this node more.
    const rank = found.skillNodes.indexOf(node as SkillNodeId);
    if (rank >= 0 && rank < bestRank) {
      best = found;
      bestRank = rank;
    }
  }
  return best;
}
