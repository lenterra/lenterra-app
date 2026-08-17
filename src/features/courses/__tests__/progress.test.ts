/**
 * Lesson progress, and what a student sees before their work has synced.
 *
 * The case worth protecting: a student reads three lessons on a bus with no
 * signal. If the screen showed only what the server knows, their morning's work
 * would read as zero until the next connection — which is the exact failure the
 * offline design exists to prevent, appearing in the one place it is easiest to
 * overlook.
 */

import { completeLesson, completedLessons, isLessonComplete, lessonsCompletedIn } from '../progress';
import * as queue from '../../../data/outbox/queue';
import { resumeLesson, nextLessonId } from '../../../data/cache/courses';
import type { CourseSummary } from '@lenterra/core';

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
const COURSE = 'algo.loops';

const course: CourseSummary = {
  id: COURSE,
  domain: 'algorithms',
  contentVersion: 1,
  titleKey: 'x',
  summaryKey: 'x',
  skillNodes: ['algo.iteration'],
  entitlement: 'free',
  prerequisites: [],
  lessons: [
    { id: 'algo.loops.l01', titleKey: 'x', readingMinutes: 3, hasCheck: true },
    { id: 'algo.loops.l02', titleKey: 'x', readingMinutes: 3, hasCheck: true },
    { id: 'algo.loops.l03', titleKey: 'x', readingMinutes: 3, hasCheck: false },
  ],
};

beforeEach(() => mockMemory.clear());

describe('completing a lesson', () => {
  it('records it locally and queues it for the server', () => {
    completeLesson(ACCOUNT, COURSE, 'algo.loops.l01');

    expect(isLessonComplete(ACCOUNT, 'algo.loops.l01')).toBe(true);
    expect(queue.all(ACCOUNT)).toHaveLength(1);
    expect(queue.all(ACCOUNT)[0]?.kind).toBe('lesson');
  });

  it('does not queue the same lesson twice', () => {
    completeLesson(ACCOUNT, COURSE, 'algo.loops.l01');
    completeLesson(ACCOUNT, COURSE, 'algo.loops.l01');

    expect(queue.all(ACCOUNT)).toHaveLength(1);
  });

  it('keeps two accounts on one phone separate', () => {
    completeLesson(ACCOUNT, COURSE, 'algo.loops.l01');

    expect(isLessonComplete('account-2', 'algo.loops.l01')).toBe(false);
  });
});

describe('reconciling with the server', () => {
  it('shows unsynced work rather than the server count', () => {
    completeLesson(ACCOUNT, COURSE, 'algo.loops.l01');
    completeLesson(ACCOUNT, COURSE, 'algo.loops.l02');

    // The server has heard about none of it yet.
    expect(lessonsCompletedIn(ACCOUNT, COURSE, 0)).toBe(2);
  });

  it('shows work done on another device that this one has not seen', () => {
    expect(lessonsCompletedIn(ACCOUNT, COURSE, 3)).toBe(3);
  });

  it('counts only the course asked about', () => {
    completeLesson(ACCOUNT, COURSE, 'algo.loops.l01');
    completeLesson(ACCOUNT, 'sec.basics', 'sec.basics.l01');

    expect(completedLessons(ACCOUNT, COURSE)).toEqual(['algo.loops.l01']);
  });
});

describe('resuming', () => {
  it('opens the first unread lesson', () => {
    expect(resumeLesson(course, ['algo.loops.l01'])).toBe('algo.loops.l02');
  });

  it('opens something when the course is finished, rather than nothing', () => {
    const all = course.lessons.map((lesson) => lesson.id);
    expect(resumeLesson(course, all)).toBe('algo.loops.l03');
  });

  it('has no next lesson after the last one', () => {
    expect(nextLessonId(course, 'algo.loops.l03')).toBeNull();
    expect(nextLessonId(course, 'algo.loops.l01')).toBe('algo.loops.l02');
  });
});
