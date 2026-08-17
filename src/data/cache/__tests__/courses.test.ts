/**
 * Reading courses out of the cache.
 *
 * All of it has to work with no network, because that is the state the target
 * student is in most of the time. The cases that matter are the ones where a
 * lookup could plausibly return something wrong rather than nothing: the wrong
 * lesson for a node, a stale catalog version, or a lesson whose body never
 * arrived.
 */

import {
  allCourses,
  findCourse,
  findLesson,
  lessonCovering,
  lessonsFor,
  nextLessonId,
  resumeLesson,
} from '../courses';
import { setCurrentCatalogVersion, storePart } from '../catalog';
import type { CourseSummary, Lesson } from '@lenterra/core';

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
const VERSION = 'catalog@abc123';

function lesson(id: string, nodes: string[] = []): Lesson {
  return {
    id,
    courseId: id.slice(0, id.lastIndexOf('.')),
    titleKey: `course.${id}.title`,
    readingMinutes: 3,
    skillNodes: nodes as never,
    blocks: [{ kind: 'text', textKey: `course.${id}.b01` }],
  };
}

const LOOPS: CourseSummary = {
  id: 'algo.loops',
  domain: 'algorithms',
  contentVersion: 1,
  titleKey: 'course.algo.loops.title',
  summaryKey: 'course.algo.loops.summary',
  skillNodes: ['algo.iteration', 'algo.sequencing'],
  entitlement: 'free',
  prerequisites: [],
  lessons: [
    { id: 'algo.loops.l01', titleKey: 'x', readingMinutes: 3, hasCheck: true },
    { id: 'algo.loops.l02', titleKey: 'x', readingMinutes: 3, hasCheck: false },
    { id: 'algo.loops.l03', titleKey: 'x', readingMinutes: 3, hasCheck: false },
  ],
};

const STEPS: CourseSummary = {
  ...LOOPS,
  id: 'algo.steps',
  titleKey: 'course.algo.steps.title',
  summaryKey: 'course.algo.steps.summary',
  skillNodes: ['algo.sequencing'],
  lessons: [
    { id: 'algo.steps.l01', titleKey: 'x', readingMinutes: 3, hasCheck: true },
    { id: 'algo.steps.l02', titleKey: 'x', readingMinutes: 3, hasCheck: false },
    { id: 'algo.steps.l03', titleKey: 'x', readingMinutes: 3, hasCheck: false },
  ],
};

/** Store a part the way the sync does, so the hash check is exercised too. */
function publish(part: string, body: unknown) {
  const { hashValue } = jest.requireActual('@lenterra/core');
  const ok = storePart(ACCOUNT, VERSION, part, hashValue(body), body);
  expect(ok).toBe(true);
}

beforeEach(() => {
  mockMemory.clear();
  setCurrentCatalogVersion(ACCOUNT, VERSION);
  publish('courses', [LOOPS, STEPS]);
  publish('lessons.algo.loops', [
    lesson('algo.loops.l01', ['algo.iteration', 'algo.sequencing']),
    lesson('algo.loops.l02'),
    lesson('algo.loops.l03'),
  ]);
  publish('lessons.algo.steps', [
    lesson('algo.steps.l01', ['algo.sequencing']),
    lesson('algo.steps.l02'),
    lesson('algo.steps.l03'),
  ]);
});

describe('before anything has synced', () => {
  it('reports no courses rather than throwing', () => {
    mockMemory.clear();
    expect(allCourses(ACCOUNT)).toEqual([]);
    expect(findCourse(ACCOUNT, 'algo.loops')).toBeNull();
    expect(findLesson(ACCOUNT, 'algo.loops.l01')).toBeNull();
    expect(lessonsFor(ACCOUNT, 'algo.loops')).toEqual([]);
  });
});

describe('lookups', () => {
  it('finds a course and its lessons', () => {
    expect(allCourses(ACCOUNT)).toHaveLength(2);
    expect(findCourse(ACCOUNT, 'algo.loops')?.course.id).toBe('algo.loops');
    expect(lessonsFor(ACCOUNT, 'algo.loops')).toHaveLength(3);
  });

  it('recovers the course from a lesson id without being told it', () => {
    // Lesson ids are `<courseId>.<slug>`, which is what lets a struggle offer
    // and a gameLink address a lesson directly.
    const found = findLesson(ACCOUNT, 'algo.loops.l02');
    expect(found?.course.id).toBe('algo.loops');
    expect(found?.lesson.id).toBe('algo.loops.l02');
  });

  it('returns nothing for ids that do not exist or are not lesson-shaped', () => {
    expect(findCourse(ACCOUNT, 'algo.nonexistent')).toBeNull();
    expect(findLesson(ACCOUNT, 'algo.loops.l99')).toBeNull();
    expect(findLesson(ACCOUNT, 'nodots')).toBeNull();
  });

  it('reads nothing from a version that was never stored', () => {
    // A student holding an older catalog must not be served a newer version's
    // lessons by accident.
    expect(lessonsFor(ACCOUNT, 'algo.loops', 'catalog@other')).toEqual([]);
  });
});

describe('resuming', () => {
  it('opens the first unread lesson', () => {
    expect(resumeLesson(LOOPS, [])).toBe('algo.loops.l01');
    expect(resumeLesson(LOOPS, ['algo.loops.l01'])).toBe('algo.loops.l02');
  });

  it('opens the last lesson once the course is finished', () => {
    const all = LOOPS.lessons.map((entry) => entry.id);
    expect(resumeLesson(LOOPS, all)).toBe('algo.loops.l03');
  });

  it('has nothing to resume in an empty course', () => {
    expect(resumeLesson({ ...LOOPS, lessons: [] }, [])).toBeNull();
  });

  it('knows what comes next, and when nothing does', () => {
    expect(nextLessonId(LOOPS, 'algo.loops.l01')).toBe('algo.loops.l02');
    expect(nextLessonId(LOOPS, 'algo.loops.l03')).toBeNull();
    expect(nextLessonId(LOOPS, 'not-a-lesson')).toBeNull();
  });
});

describe('the recovery offer', () => {
  it('finds the lesson covering a node the student is failing', () => {
    expect(lessonCovering(ACCOUNT, 'algo.iteration')?.id).toBe('algo.loops.l01');
  });

  it('prefers the lesson that leans on the node over one that mentions it', () => {
    // `algo.sequencing` is secondary in algo.loops.l01 and primary in
    // algo.steps.l01. A student stuck on sequencing should be sent to the
    // lesson about sequencing, not the one that touches it in passing.
    expect(lessonCovering(ACCOUNT, 'algo.sequencing')?.id).toBe('algo.steps.l01');
  });

  it('offers nothing rather than a wrong lesson for an uncovered node', () => {
    // Offering a lesson that does not teach the node is worse than offering
    // none: the student reads it and is still stuck.
    expect(lessonCovering(ACCOUNT, 'sec.assets')).toBeNull();
  });
});

describe('integrity', () => {
  it('refuses a part whose bytes do not match the hash the server promised', () => {
    const stored = storePart(ACCOUNT, VERSION, 'courses', 'not-the-real-hash', [LOOPS]);
    expect(stored).toBe(false);
  });

  it('drops a part that was corrupted after it was written', () => {
    // MMKV survives crashes and low-storage kills, and a truncated write is
    // exactly the case that would otherwise play silently against wrong rules.
    const key = [...mockMemory.keys()].find((entry) => entry.includes(`${VERSION}:courses`));
    expect(key).toBeDefined();
    const raw = JSON.parse(mockMemory.get(key as string) as string);
    raw.body = [{ ...LOOPS, id: 'tampered' }];
    mockMemory.set(key as string, JSON.stringify(raw));

    expect(allCourses(ACCOUNT)).toEqual([]);
  });
});
