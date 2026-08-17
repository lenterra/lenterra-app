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

/** Everything opening a mission decides, before any of it reaches React. */
export interface OpenedSession {
  recorder: ReplayRecorder<unknown, unknown>;
  state: unknown;
  finished: boolean;
  /**
   * When the session began, or null for a fresh one.
   *
   * Null rather than `Date.now()` because this is computed during render, and
   * a clock read during render is impure — it makes the same render produce a
   * different result each time it runs. A resumed session already knows its
   * start time; a new one is stamped from an effect, before anything that
   * measures a duration can run.
   */
  startedAt: number | null;
  hintShown: boolean;
  hintUsed: boolean;
  /** True when a saved session was picked up rather than a new one begun. */
  resumed: boolean;
}

/**
 * Open a mission: a fresh session, or the saved one replayed back.
 *
 * Pure but for reading storage and the clock, and separated from the hook so it
 * can be tested — which it could not be while it lived inside an effect, and
 * this is the code that decides whether a student who was interrupted mid-game
 * gets their board back or starts again.
 *
 * **The board is always re-derived from the moves**, never restored from a
 * serialised position. A stored board is a second source of truth that can
 * disagree with the rules, and the disagreement would surface as a game that
 * plays illegally rather than as a load error.
 *
 * A saved session that no longer replays cleanly is abandoned at the last move
 * that worked rather than discarded whole: the student keeps the part of their
 * game the current rules still accept. That happens after a content update
 * changes a mission under a save, which is exactly when throwing it all away
 * would feel arbitrary.
 */
export function openSession(
  engine: GameEngine<unknown, unknown>,
  mission: Mission,
  accountId: string,
): OpenedSession {
  const recorder = new ReplayRecorder(engine, mission);
  const saved = readJson<ResumeState>(accountStorage(accountId), ACCOUNT_KEYS.resume);

  const matches =
    !!saved && saved.missionId === mission.id && saved.contentVersion === mission.contentVersion;

  if (!matches || !saved) {
    return {
      recorder,
      state: recorder.state,
      finished: recorder.isTerminal(),
      startedAt: null,
      hintShown: false,
      hintUsed: false,
      resumed: false,
    };
  }

  for (const move of saved.moves) {
    const parsed = engine.parseMove(move.move);
    if (!parsed) break;
    try {
      recorder.play(parsed, move.actor, move.elapsedMs);
    } catch {
      break;
    }
  }

  return {
    recorder,
    state: recorder.state,
    finished: recorder.isTerminal(),
    // The original start time, so an interrupted session is not credited with
    // a duration that begins when the student came back to it.
    startedAt: saved.startedAt,
    hintShown: saved.hintShown,
    hintUsed: saved.hintUsed,
    resumed: true,
  };
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

  // Null until the session starts, rather than `useRef(Date.now())`. `useRef`
  // evaluates its argument on every render and discards all but the first, so
  // the old form read the clock dozens of times per mission and threw the
  // readings away. Harmless, but it is a clock read during render, and this is
  // a codebase where every timestamp that matters comes from the server.
  const startedAt = useRef<number | null>(null);

  /**
   * When this session began.
   *
   * Every caller runs after the mount effect has set it. The fallback exists
   * because the type says it can be null, and returning `now` — a zero-length
   * session — is the only reading that cannot silently inflate a duration the
   * server will score.
   */
  const startedAtMs = () => startedAt.current ?? Date.now();
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
  /**
   * Opened during render, not from an effect.
   *
   * An effect runs after the commit, so the board was mounted empty and then
   * filled a frame later. For a student resuming a game that is their position
   * appearing to be lost and then coming back — and on a slow device the gap is
   * long enough to be read as exactly that.
   *
   * The identity is the account and the mission's content version rather than
   * the mission object, so a parent that rebuilds its props does not restart a
   * game in progress. The old dependency array included the object itself and
   * would have.
   */
  const sessionKey = `${accountId}:${mission.id}:${mission.contentVersion}`;
  const [session, setSession] = useState<{ key: string; opened: OpenedSession } | null>(null);

  if (engine && session?.key !== sessionKey) {
    const opened = openSession(engine, mission, accountId);
    setSession({ key: sessionKey, opened });
    setState(opened.state);
    setFinished(opened.finished);
    setHintShown(opened.hintShown);
    setHintUsed(opened.hintUsed);
    // A new mission inherits nothing from the last one. Leaving these would
    // show the previous game's rejection over a fresh board.
    setRejection(null);
    setLastEvents([]);
  }

  /**
   * The recorder, held in state rather than a ref.
   *
   * A ref cannot be written during render, and this has to be established
   * before the first paint or the board mounts empty and fills a frame later —
   * which, to a student resuming a game, looks like their position was lost and
   * then came back. State is the only place a value can be both derived during
   * render and survive to the next one.
   */
  const recorder = session?.opened.recorder ?? null;

  useEffect(() => {
    // Stamped here rather than during render: reading the clock while
    // rendering makes the same render produce different results, and this
    // number is the denominator of a duration the server scores. Every caller
    // of `startedAtMs` runs from an event or from `finish`, so all of them are
    // after this.
    startedAt.current = session?.opened.startedAt ?? Date.now();

    // Freeze the catalog for the duration. Content changing under a mission in
    // progress would leave the student having played one version and the
    // server validating against another.
    const release = holdCatalog();

    return () => {
      animator.cancel();
      release();
    };
    // `session` is deliberately absent: it changes identity only when the key
    // does, and depending on it would re-freeze the catalog on every state
    // update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animator, sessionKey]);

  const persistResume = useCallback(() => {
    const active = recorder;
    if (!active || finished) return;

    // Persisted after every move so a killed app loses at most the current
    // move, not the session (TRD-APP-004).
    const replay = active.finish();
    writeJson(accountStorage(accountId), ACCOUNT_KEYS.resume, {
      missionId: mission.id,
      contentVersion: mission.contentVersion,
      moves: replay.moves,
      startedAt: startedAtMs(),
      hintShown,
      hintUsed,
    } satisfies ResumeState);
  }, [accountId, finished, hintShown, hintUsed, mission, recorder]);

  const clearResume = useCallback(() => {
    accountStorage(accountId).delete(ACCOUNT_KEYS.resume);
  }, [accountId]);

  // --- finishing ----------------------------------------------------------
  const finish = useCallback(() => {
    const active = recorder;
    if (!active || !engine) return;

    const replay = active.finish();
    const outcome = active.outcome();
    const durationMs = Date.now() - startedAtMs();
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
        clientStartedAt: new Date(startedAtMs()).toISOString(),
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
  }, [
    accountId,
    catalogVersion,
    clearResume,
    engine,
    hintShown,
    hintUsed,
    mission,
    options,
    recorder,
    twoPlayer,
  ]);

  // --- playing ------------------------------------------------------------
  const play = useCallback(
    (move: unknown): PlayRejection | null => {
      const active = recorder;
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

      const result = active.play(parsed, actor, Date.now() - startedAtMs());

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
          const aiResult = active.play(reply, 'ai', Date.now() - startedAtMs());
          setState(aiResult.state);
          setLastEvents((previous) => [...previous, ...aiResult.events]);
          animator.enqueue([...result.events, ...aiResult.events]);
          persistResume();
          if (active.isTerminal()) finish();
        }
      }

      return null;
    },
    [animator, engine, finish, finished, persistResume, recorder, twoPlayer],
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
