/**
 * The play session.
 *
 * Holds display state and calls the engine. It holds **no rules** — those live
 * in `@lenterra/core`, which the server runs too. That is what makes an offline
 * score mean the same thing as an online one.
 *
 * Nothing here awaits the network (TRD-APP-003). A student on a bus with no
 * signal plays a complete mission: moves, opponent replies, goal evaluation,
 * result, points. The outbox handles the rest whenever signal returns.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  ReplayRecorder,
  engineFor,
  legalityOf,
  type AttemptOutcome,
  type GameEngine,
  type Mission,
  type MoveEvent,
  type Replay,
} from '@lenterra/core';

import { Animator } from '../../game/animator';
import { holdCatalog } from '../../data/cache/catalogSync';
import { ACCOUNT_KEYS, accountStorage, readJson, writeJson } from '../../data/cache/storage';
import { enqueue, newItemId } from '../../data/outbox/queue';
import { config } from '../../lib/config';
import { isOnline } from '../../lib/net';

export interface PlayRejection {
  reason: string;
  /** Game-specific numbers the UI states rather than just buzzing. */
  detail?: Record<string, number>;
}

export interface PlayResult {
  outcome: AttemptOutcome;
  replay: Replay;
  durationMs: number;
  /** The outbox id, so the provisional result and the confirmation match up. */
  attemptKey: string;
}

interface ResumeState {
  missionId: string;
  contentVersion: number;
  moves: { seq: number; actor: 'player' | 'opponent' | 'ai'; move: unknown; elapsedMs: number }[];
  startedAt: number;
  hintShown: boolean;
  hintUsed: boolean;
}

export interface UsePlaySessionOptions {
  accountId: string;
  mission: Mission;
  catalogVersion: string;
  twoPlayer?: boolean;
  onFinished?: (result: PlayResult) => void;
}

export function usePlaySession(options: UsePlaySessionOptions) {
  const { accountId, mission, catalogVersion } = options;
  const twoPlayer = options.twoPlayer === true;

  const engine = useMemo(
    () => engineFor(mission.game) as GameEngine<unknown, unknown> | null,
    [mission.game],
  );

  const recorder = useRef<ReplayRecorder<unknown, unknown> | null>(null);
  const startedAt = useRef<number>(Date.now());
  const [state, setState] = useState<unknown>(null);
  const [finished, setFinished] = useState(false);
  const [rejection, setRejection] = useState<PlayRejection | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [lastEvents, setLastEvents] = useState<MoveEvent[]>([]);

  const animator = useMemo(
    () =>
      new Animator({
        onFrame: () => {
          /* the renderer subscribes; the session only tracks whether it is busy */
        },
        onDone: () => setAnimating(false),
      }),
    [],
  );

  // --- start or resume ----------------------------------------------------
  useEffect(() => {
    if (!engine) return;

    const fresh = new ReplayRecorder(engine, mission);
    const saved = readJson<ResumeState>(accountStorage(accountId), ACCOUNT_KEYS.resume);

    if (saved && saved.missionId === mission.id && saved.contentVersion === mission.contentVersion) {
      // Replay the saved moves through the engine rather than restoring a
      // serialised board. The board is always re-derived — a stored state is a
      // second source of truth that can disagree with the rules.
      for (const move of saved.moves) {
        const parsed = engine.parseMove(move.move);
        if (!parsed) break;
        try {
          fresh.play(parsed, move.actor, move.elapsedMs);
        } catch {
          break; // a resume that no longer replays cleanly starts over
        }
      }
      startedAt.current = saved.startedAt;
      setHintShown(saved.hintShown);
      setHintUsed(saved.hintUsed);
    } else {
      startedAt.current = Date.now();
    }

    recorder.current = fresh;
    setState(fresh.state);
    setFinished(fresh.isTerminal());

    // Freeze the catalog for the duration (TRD-SYNC-011). Content changing
    // under a mission in progress would leave the student having played one
    // version and the server validating against another.
    const release = holdCatalog();

    return () => {
      animator.cancel();
      release();
    };
  }, [accountId, animator, engine, mission]);

  const persistResume = useCallback(() => {
    const active = recorder.current;
    if (!active || finished) return;

    // Persisted after every move so a killed app loses at most the current
    // move, not the session (TRD-APP-004).
    const replay = active.finish();
    writeJson(accountStorage(accountId), ACCOUNT_KEYS.resume, {
      missionId: mission.id,
      contentVersion: mission.contentVersion,
      moves: replay.moves,
      startedAt: startedAt.current,
      hintShown,
      hintUsed,
    } satisfies ResumeState);
  }, [accountId, finished, hintShown, hintUsed, mission]);

  const clearResume = useCallback(() => {
    accountStorage(accountId).delete(ACCOUNT_KEYS.resume);
  }, [accountId]);

  // --- finishing ----------------------------------------------------------
  const finish = useCallback(() => {
    const active = recorder.current;
    if (!active || !engine) return;

    const replay = active.finish();
    const outcome = active.outcome();
    const durationMs = Date.now() - startedAt.current;
    const attemptKey = newItemId();

    // Persist before confirming. A crash between showing "+10 points" and
    // writing the record silently loses learning the student believes they
    // have banked.
    enqueue(
      accountId,
      'attempt',
      {
        missionId: mission.id,
        missionContentVersion: mission.contentVersion,
        catalogVersion,
        gameId: mission.game,
        replay,
        claimedOutcome: outcome,
        durationMs,
        clientStartedAt: new Date(startedAt.current).toISOString(),
        // Overwritten by the queue with the real monotonic value.
        deviceSeq: 0,
        hintShown,
        hintUsed,
        // Recorded honestly. Metric M-A01 — the share of play that happens
        // offline — is the evidence that the offline design is used at all, and
        // it is worthless if this flag is a constant.
        playedOffline: !isOnline(),
        twoPlayer,
        coreVersion: engine.version,
        clientVersion: config.clientVersion,
      },
      attemptKey,
    );

    clearResume();
    setFinished(true);
    options.onFinished?.({ outcome, replay, durationMs, attemptKey });
  }, [accountId, catalogVersion, clearResume, engine, hintShown, hintUsed, mission, options, twoPlayer]);

  // --- playing ------------------------------------------------------------
  const play = useCallback(
    (move: unknown): PlayRejection | null => {
      const active = recorder.current;
      if (!active || !engine || finished) return null;

      const parsed = engine.parseMove(move);
      if (!parsed) return { reason: 'malformed_move' };

      if (!engine.isLegal(active.state, parsed)) {
        // Rejections are diagnostic, not a buzz. Benteng in particular has to
        // state both freshness numbers.
        const detail = describeRejection(engine, active.state, parsed);
        setRejection(detail);
        return detail;
      }

      setRejection(null);

      // In hot-seat the two students share the screen, so who a move belongs to
      // is decided by whose side is to move, not by who is holding the phone.
      // The guest is `opponent`: their moves are replayed and validated like any
      // other, and the server scores none of them as the account holder's
      // (TRD-MP-002). Nothing about the guest is recorded anywhere.
      const actor: 'player' | 'opponent' =
        twoPlayer && engine.sideToMove(active.state) !== engine.playerSide(active.state)
          ? 'opponent'
          : 'player';

      const result = active.play(parsed, actor, Date.now() - startedAt.current);

      // Logical state is correct immediately; the animation follows.
      setState(result.state);
      setLastEvents(result.events);
      setAnimating(result.events.length > 0);
      animator.enqueue(result.events);

      persistResume();

      if (active.isTerminal()) {
        finish();
        return null;
      }

      // The deterministic opponent replies. Same seed, same move, every time —
      // which is what lets the server verify the opponent's side rather than
      // trust it.
      //
      // Not in hot-seat: there the other side is a person, and an AI reply would
      // take their turn away from them.
      if (!twoPlayer && engine.sideToMove(active.state) !== engine.playerSide(active.state)) {
        const reply = active.aiMove();
        if (reply) {
          const aiResult = active.play(reply, 'ai', Date.now() - startedAt.current);
          setState(aiResult.state);
          setLastEvents((previous) => [...previous, ...aiResult.events]);
          animator.enqueue([...result.events, ...aiResult.events]);
          persistResume();
          if (active.isTerminal()) finish();
        }
      }

      return null;
    },
    [animator, engine, finish, finished, persistResume, twoPlayer],
  );

  const skipAnimation = useCallback(() => {
    animator.skip();
    setAnimating(false);
  }, [animator]);

  /**
   * Offer a hint.
   *
   * Offered, never imposed, and only after three failures on the same mission.
   * A hinted success is recorded as hinted and contributes reduced weight, so
   * help-seeking is neither punished nor a route to a certificate.
   */
  const offerHint = useCallback(() => setHintShown(true), []);
  const useHint = useCallback(() => {
    setHintShown(true);
    setHintUsed(true);
  }, []);

  const abandon = useCallback(() => {
    clearResume();
    animator.cancel();
  }, [animator, clearResume]);

  /**
   * Backgrounding pauses, it does not forfeit.
   *
   * A mission is already persisted after every move, so the state is safe. What
   * this stops is the animation continuing against a screen nobody is looking
   * at and finishing the mission while the app is in the background — the
   * student would come back to a result they did not watch happen.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') return;
      animator.cancel();
      persistResume();
    });
    return () => subscription.remove();
  }, [animator, persistResume]);

  return {
    engine,
    state,
    play,
    finished,
    rejection,
    animating,
    lastEvents,
    skipAnimation,
    offerHint,
    useHint,
    hintShown,
    hintUsed,
    abandon,
    twoPlayer,
    /**
     * Whose turn it is, in hot-seat terms.
     *
     * The current player has to be unmistakable (TRD-MP-001): two students
     * sharing a phone in a noisy classroom will otherwise move on each other's
     * turn, and a move made by the wrong person cannot be taken back.
     */
    seatToMove: (engine && state
      ? engine.sideToMove(state) === engine.playerSide(state)
        ? 'you'
        : twoPlayer
          ? 'guest'
          : 'machine'
      : null) as 'you' | 'guest' | 'machine' | null,
    legalMoves: engine && state ? engine.legalMoves(state) : [],
    goal: engine && state ? engine.evaluateGoal(state, mission.goal) : null,
  };
}

/**
 * Turn an illegal move into something the student can act on.
 *
 * "Try again" teaches nothing. The freshness comparison in Benteng is the whole
 * rule, and stating both numbers is how a student learns it.
 */
function describeRejection(
  engine: GameEngine<unknown, unknown>,
  state: unknown,
  move: unknown,
): PlayRejection {
  if (engine.gameId === 'benteng') {
    // `legalityOf` is exported from the core precisely so the UI can state the
    // comparison rather than reimplement the rule.
    const legality = legalityOf(state as never, move as never);

    if (legality.reason === 'stale' && legality.rejection) {
      return {
        reason: 'benteng.staleCapture',
        detail: {
          mine: legality.rejection.moverFreshness,
          theirs: legality.rejection.targetFreshness,
        },
      };
    }
    return { reason: `benteng.${legality.reason ?? 'illegal'}` };
  }
  return { reason: 'congklak.illegalMove' };
}
