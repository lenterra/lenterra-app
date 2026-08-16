/**
 * Animation timing.
 *
 * The requirement is specific: any single animation completes within two
 * seconds, or is skippable to instant. A four-link continuation chain on a
 * seven-pit board would otherwise be thirty seconds of forced watching on a
 * borrowed phone the student has to hand back.
 */

import type { MoveEvent } from '@lenterra/core';

import { Animator, DEFAULT_STEP_MS, MAX_ANIMATION_MS } from '../animator';

function events(count: number): MoveEvent[] {
  return Array.from({ length: count }, (_, index) => ({ kind: 'sow' as const, index }));
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Animator', () => {
  it('emits one frame per event in order', () => {
    const seen: number[] = [];
    const animator = new Animator({ onFrame: (frame) => seen.push(frame.index) });

    animator.enqueue(events(4));
    jest.advanceTimersByTime(DEFAULT_STEP_MS * 5);

    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it('calls onDone with an empty list rather than hanging', () => {
    const onDone = jest.fn();
    new Animator({ onFrame: jest.fn(), onDone }).enqueue([]);
    expect(onDone).toHaveBeenCalled();
  });

  it('completes a long chain inside the budget', () => {
    // 60 events at the natural step would be 8.4 seconds. Compressed, the whole
    // sequence must still land inside the two-second ceiling.
    const onDone = jest.fn();
    const animator = new Animator({ onFrame: jest.fn(), onDone });

    animator.enqueue(events(60));
    jest.advanceTimersByTime(MAX_ANIMATION_MS + 200);

    expect(onDone).toHaveBeenCalled();
  });

  it('skip emits every remaining frame immediately', () => {
    const seen: number[] = [];
    const onDone = jest.fn();
    const animator = new Animator({ onFrame: (frame) => seen.push(frame.index), onDone });

    animator.enqueue(events(10));
    jest.advanceTimersByTime(DEFAULT_STEP_MS);
    const beforeSkip = seen.length;

    animator.skip();

    // Skipping is free because the logical state was already correct before
    // the first frame — the animation is a replay of things that happened.
    expect(seen).toHaveLength(10);
    expect(beforeSkip).toBeLessThan(10);
    expect(onDone).toHaveBeenCalled();
    expect(animator.isPlaying).toBe(false);
  });

  it('skipping twice does not double-emit', () => {
    const seen: number[] = [];
    const animator = new Animator({ onFrame: (frame) => seen.push(frame.index) });

    animator.enqueue(events(5));
    animator.skip();
    animator.skip();

    expect(seen).toHaveLength(5);
  });

  it('a new move replaces whatever is still playing', () => {
    // A student tapping quickly gets the newest move, not a backlog.
    const seen: MoveEvent[] = [];
    const animator = new Animator({ onFrame: (frame) => seen.push(frame.event) });

    animator.enqueue([{ kind: 'sow', index: 1 }, { kind: 'sow', index: 2 }]);
    jest.advanceTimersByTime(DEFAULT_STEP_MS / 2);
    animator.enqueue([{ kind: 'capture', index: 9 }]);
    jest.advanceTimersByTime(DEFAULT_STEP_MS * 3);

    expect(seen.some((event) => event.kind === 'capture')).toBe(true);
    expect(seen.filter((event) => event.index === 2)).toHaveLength(0);
  });

  it('cancel stops emitting entirely', () => {
    const onFrame = jest.fn();
    const animator = new Animator({ onFrame });

    animator.enqueue(events(10));
    animator.cancel();
    jest.advanceTimersByTime(5000);

    expect(onFrame.mock.calls.length).toBeLessThanOrEqual(1);
    expect(animator.pending).toBe(0);
  });
});
