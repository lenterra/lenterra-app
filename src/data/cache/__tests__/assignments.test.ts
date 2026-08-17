/**
 * The assignment cache.
 *
 * Assignments are the one thing a teacher sends a student directly, and they
 * have to survive being offline — a student reads one on the bus, not in the
 * corner of the school with signal. That makes the cache the source of truth
 * rather than a convenience, and three of its rules are load-bearing:
 *
 *  - a withdrawn assignment disappears
 *  - a dismissal survives the next pull
 *  - a dismissal is forgotten once the server stops mentioning that id, so a
 *    re-assigned lesson is not silently hidden forever
 */

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

import {
  activeAssignments,
  assignmentsPulledAt,
  dismissAssignment,
  storeAssignments,
  type Assignment,
} from '../assignments';

const ACCOUNT = 'account-1';

const lesson = (id: string, overrides: Partial<Assignment> = {}): Assignment => ({
  id,
  kind: 'lesson',
  targetId: 'comp.modular.l01',
  withdrawn: false,
  ...overrides,
});

beforeEach(() => mockMemory.clear());

test('an account with no pull yet has nothing and says so', () => {
  expect(activeAssignments(ACCOUNT)).toEqual([]);
  expect(assignmentsPulledAt(ACCOUNT)).toBe(0);
});

test('what the server sent is what is shown', () => {
  storeAssignments(ACCOUNT, [lesson('a1'), lesson('a2')], 1_000);

  expect(activeAssignments(ACCOUNT).map((a) => a.id)).toEqual(['a1', 'a2']);
  expect(assignmentsPulledAt(ACCOUNT)).toBe(1_000);
});

test('a withdrawn assignment is not shown', () => {
  // A teacher who withdraws an assignment has changed their mind, and a card
  // still offering it would send a student to do work nobody wants any more.
  storeAssignments(ACCOUNT, [lesson('a1'), lesson('a2', { withdrawn: true })], 1_000);

  expect(activeAssignments(ACCOUNT).map((a) => a.id)).toEqual(['a1']);
});

test('a dismissal survives the next pull', () => {
  // The server has no notion of dismissal, so every pull returns the same
  // assignment. Without this the card a student hid would come straight back.
  storeAssignments(ACCOUNT, [lesson('a1'), lesson('a2')], 1_000);
  dismissAssignment(ACCOUNT, 'a1');
  expect(activeAssignments(ACCOUNT).map((a) => a.id)).toEqual(['a2']);

  storeAssignments(ACCOUNT, [lesson('a1'), lesson('a2')], 2_000);
  expect(activeAssignments(ACCOUNT).map((a) => a.id)).toEqual(['a2']);
});

test('a dismissal is forgotten once the server stops sending that assignment', () => {
  // Otherwise the dismissal list grows for the life of the account, and an
  // assignment re-issued under the same id would stay hidden forever — which
  // looks, to the student and the teacher, like the feature is broken.
  storeAssignments(ACCOUNT, [lesson('a1')], 1_000);
  dismissAssignment(ACCOUNT, 'a1');
  expect(activeAssignments(ACCOUNT)).toEqual([]);

  storeAssignments(ACCOUNT, [], 2_000);
  storeAssignments(ACCOUNT, [lesson('a1')], 3_000);

  expect(activeAssignments(ACCOUNT).map((a) => a.id)).toEqual(['a1']);
});

test('dismissing twice is not an error and does not duplicate', () => {
  storeAssignments(ACCOUNT, [lesson('a1')], 1_000);
  dismissAssignment(ACCOUNT, 'a1');
  dismissAssignment(ACCOUNT, 'a1');

  expect(activeAssignments(ACCOUNT)).toEqual([]);
});

test('two accounts on one phone cannot see each other', () => {
  // The isolation is at the storage-instance level rather than by key prefix,
  // and shared devices are the normal case for this audience.
  storeAssignments(ACCOUNT, [lesson('a1')], 1_000);
  storeAssignments('account-2', [lesson('b1')], 1_000);

  expect(activeAssignments(ACCOUNT).map((a) => a.id)).toEqual(['a1']);
  expect(activeAssignments('account-2').map((a) => a.id)).toEqual(['b1']);
});
