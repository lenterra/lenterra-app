/**
 * Opening a mission: fresh, or the saved game replayed back.
 *
 * This lived inside a mount effect and so had no test at all, which is a poor
 * place for a gap — it is the code that decides whether a student who was
 * interrupted mid-game gets their board back or starts again. A child who has
 * played fifteen moves and been called away has a strong opinion about that,
 * and the failure is invisible from the outside: a wrong resume looks like a
 * fresh mission, not like an error.
 *
 * Two properties carry the weight. The board is always **re-derived from the
 * moves** rather than restored from a stored position, so a save can never
 * disagree with the rules. And a resumed session keeps its **original start
 * time**, because that number is the denominator of a duration the server
 * scores.
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

import type { GameEngine, Mission } from '@lenterra/core';

import { ACCOUNT_KEYS, accountStorage, writeJson } from '../../../data/cache/storage';
import { openSession } from '../usePlaySession';

const ACCOUNT = 'account-1';

/**
 * A counter engine: state is the moves applied so far, in order.
 *
 * Deliberately not congklak. What is under test is the resume, and a real
 * engine would make an assertion about a board stand in for an assertion about
 * replay — the two would fail together and only one of them would be the
 * subject. Here the state *is* the move list, so "the board was re-derived"
 * becomes something a test can read directly.
 */
function counterEngine(): GameEngine<string[], string> {
  return {
    id: 'congklak',
    version: '1',
    init: () => [],
    isLegal: (_state: string[], move: string) => move !== 'illegal',
    applyMove: (state: string[], move: string) => ({
      state: [...state, move],
      events: [],
    }),
    evaluateGoal: (state: string[]) => ({
      achieved: state.length >= 3,
      terminal: state.length >= 3,
      progress: {},
    }),
    // A move that does not round-trip is how a content change under a save
    // shows up: the stored value no longer parses into a move of this version.
    parseMove: (raw: unknown) => (typeof raw === 'string' && raw !== 'unparseable' ? raw : null),
    aiMove: () => null,
    legalMoves: () => [],
  } as unknown as GameEngine<string[], string>;
}

const mission = (over: Partial<Mission> = {}): Mission =>
  ({
    id: 'congklak.m01',
    game: 'congklak',
    contentVersion: 1,
    setup: {},
    config: {},
    goal: {},
    seed: 1,
    constraints: {},
    ...over,
  }) as unknown as Mission;

const move = (seq: number, value: string) => ({
  seq,
  actor: 'player' as const,
  move: value,
  elapsedMs: seq * 1000,
});

function save(over: Record<string, unknown> = {}) {
  writeJson(accountStorage(ACCOUNT), ACCOUNT_KEYS.resume, {
    missionId: 'congklak.m01',
    contentVersion: 1,
    moves: [move(0, 'a'), move(1, 'b')],
    startedAt: 1_700_000_000_000,
    hintShown: true,
    hintUsed: false,
    ...over,
  });
}

beforeEach(() => mockMemory.clear());

describe('openSession — a fresh mission', () => {
  it('starts empty when nothing is saved', () => {
    const opened = openSession(counterEngine(), mission(), ACCOUNT);

    expect(opened.resumed).toBe(false);
    expect(opened.state).toEqual([]);
    expect(opened.finished).toBe(false);
  });

  it('leaves the start time for the caller to stamp', () => {
    // Null, not `Date.now()`. This runs during render, and a clock read there
    // makes the same render produce a different result each time it runs.
    expect(openSession(counterEngine(), mission(), ACCOUNT).startedAt).toBeNull();
  });

  it('carries no hint state into a new game', () => {
    save({ hintShown: true, hintUsed: true, missionId: 'congklak.m99' });

    const opened = openSession(counterEngine(), mission(), ACCOUNT);

    expect(opened.hintShown).toBe(false);
    expect(opened.hintUsed).toBe(false);
  });
});

describe('openSession — resuming', () => {
  it('replays the saved moves back onto the board', () => {
    save();

    const opened = openSession(counterEngine(), mission(), ACCOUNT);

    expect(opened.resumed).toBe(true);
    // Derived by re-playing, in order — not read from a stored position.
    expect(opened.state).toEqual(['a', 'b']);
  });

  it('keeps the original start time', () => {
    // The student was away for an hour. Crediting the session from the moment
    // they came back would report a mission that took two minutes as two
    // minutes of play plus an hour of it sitting on a table.
    save();

    expect(openSession(counterEngine(), mission(), ACCOUNT).startedAt).toBe(1_700_000_000_000);
  });

  it('restores whether a hint was shown and whether it was used', () => {
    // These two ride along to the server on the attempt and change what the
    // evidence is worth. Losing them across a resume would silently mark a
    // hinted attempt as unhinted.
    save({ hintShown: true, hintUsed: true });

    const opened = openSession(counterEngine(), mission(), ACCOUNT);

    expect(opened.hintShown).toBe(true);
    expect(opened.hintUsed).toBe(true);
  });

  it('reports a saved game that was already won as finished', () => {
    save({ moves: [move(0, 'a'), move(1, 'b'), move(2, 'c')] });

    expect(openSession(counterEngine(), mission(), ACCOUNT).finished).toBe(true);
  });
});

describe('openSession — a save that no longer fits', () => {
  it('ignores a save from another mission', () => {
    save({ missionId: 'benteng.m03' });

    const opened = openSession(counterEngine(), mission(), ACCOUNT);

    expect(opened.resumed).toBe(false);
    expect(opened.state).toEqual([]);
  });

  it('ignores a save from an older content version', () => {
    // The mission was republished. Replaying old moves into new rules is how a
    // student ends up with a position the validator will reject.
    save({ contentVersion: 1 });

    const opened = openSession(counterEngine(), mission({ contentVersion: 2 }), ACCOUNT);

    expect(opened.resumed).toBe(false);
    expect(opened.state).toEqual([]);
  });

  it('keeps the moves that still replay and abandons the rest', () => {
    // Partial rather than all-or-nothing: the student keeps the part of their
    // game the current rules still accept, which is the kinder answer at the
    // one moment this happens — right after a content update.
    save({ moves: [move(0, 'a'), move(1, 'unparseable'), move(2, 'c')] });

    const opened = openSession(counterEngine(), mission(), ACCOUNT);

    expect(opened.state).toEqual(['a']);
    expect(opened.resumed).toBe(true);
  });

  it('stops at a move the rules now reject rather than throwing', () => {
    // `ReplayRecorder.play` throws on an illegal move. Uncaught, that would
    // crash the play screen on open — the student sees the app die, not a
    // mission.
    save({ moves: [move(0, 'a'), move(1, 'illegal'), move(2, 'c')] });

    expect(() => openSession(counterEngine(), mission(), ACCOUNT)).not.toThrow();
    expect(openSession(counterEngine(), mission(), ACCOUNT).state).toEqual(['a']);
  });

  it('survives a save with no moves at all', () => {
    save({ moves: [] });

    const opened = openSession(counterEngine(), mission(), ACCOUNT);

    expect(opened.state).toEqual([]);
    expect(opened.startedAt).toBe(1_700_000_000_000);
  });

  it('does not read another account\'s saved game', () => {
    // Shared classroom devices are the normal case, not the edge case.
    save();

    const opened = openSession(counterEngine(), mission(), 'account-2');

    expect(opened.resumed).toBe(false);
    expect(opened.state).toEqual([]);
  });
});
