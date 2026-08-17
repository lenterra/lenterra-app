/**
 * Event-driven animation.
 *
 * The inversion that matters. Today `distributeSeeds` in `games.tsx` drives
 * React state one seed per 200 ms `setTimeout` tick, so the board is only
 * correct after the last timer fires. That is why the current implementation
 * cannot skip an animation without corrupting state, and why a four-link chain
 * on a seven-pit board would mean thirty seconds of forced watching on a
 * borrowed phone.
 *
 * Here the engine has already produced the final state and an ordered event
 * list. The animation is a *replay of things that already happened*, so
 * skipping it is free: the logical state was correct before the first frame.
 */

import type { MoveEvent } from '@lenterra/core';

export type AnimationFrame = {
  event: MoveEvent;
  index: number;
  total: number;
};

export interface AnimatorOptions {
  /** Milliseconds per event at normal speed. */
  stepMs?: number;
  /**
   * A single animation must never block input for more than this.
   * Long chains accelerate rather than queue linearly.
   */
  maxTotalMs?: number;
  onFrame: (frame: AnimationFrame) => void;
  onDone?: () => void;
}

export const DEFAULT_STEP_MS = 140;
export const MAX_ANIMATION_MS = 2000;

export class Animator {
  private queue: MoveEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private index = 0;
  private readonly options: Required<Omit<AnimatorOptions, 'onDone'>> & { onDone?: () => void };

  constructor(options: AnimatorOptions) {
    this.options = {
      stepMs: options.stepMs ?? DEFAULT_STEP_MS,
      maxTotalMs: options.maxTotalMs ?? MAX_ANIMATION_MS,
      onFrame: options.onFrame,
      onDone: options.onDone,
    };
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  get pending(): number {
    return Math.max(0, this.queue.length - this.index);
  }

  /**
   * Play an event list.
   *
   * Replaces anything still playing: a student who taps quickly gets the newest
   * move, not a backlog of old ones.
   */
  enqueue(events: MoveEvent[]): void {
    this.stopTimer();
    this.queue = events;
    this.index = 0;

    if (events.length === 0) {
      this.options.onDone?.();
      return;
    }
    this.tick();
  }

  /** Finish everything immediately. The first tap during play calls this. */
  skip(): void {
    this.stopTimer();
    for (let i = this.index; i < this.queue.length; i++) {
      this.options.onFrame({
        event: this.queue[i] as MoveEvent,
        index: i,
        total: this.queue.length,
      });
    }
    this.index = this.queue.length;
    this.options.onDone?.();
  }

  /** Drop the queue without emitting — used when leaving the screen. */
  cancel(): void {
    this.stopTimer();
    this.queue = [];
    this.index = 0;
  }

  /**
   * Per-step delay, compressed so the whole sequence fits the budget.
   *
   * A 40-event chain at 140 ms would take 5.6 seconds. Compressing to fit 2
   * seconds keeps the animation legible as motion while never becoming a wait.
   */
  private stepDelay(): number {
    const total = this.queue.length;
    const natural = total * this.options.stepMs;
    if (natural <= this.options.maxTotalMs) return this.options.stepMs;
    return Math.max(16, Math.floor(this.options.maxTotalMs / total));
  }

  private tick(): void {
    if (this.index >= this.queue.length) {
      this.stopTimer();
      this.options.onDone?.();
      return;
    }

    this.options.onFrame({
      event: this.queue[this.index] as MoveEvent,
      index: this.index,
      total: this.queue.length,
    });
    this.index += 1;

    this.timer = setTimeout(() => this.tick(), this.stepDelay());
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
