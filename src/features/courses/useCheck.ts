/**
 * Answering a check for understanding.
 *
 * Graded on the device the moment the student submits, so a result and an
 * explanation appear with no network involved (PRD-CRS-002, PRD-CRS-005). That
 * grade is provisional and says so: the submission goes to the outbox, the
 * server re-grades it against the answer key, and the server's score is the one
 * that moves mastery (PRD-CRS-004).
 *
 * Grading uses the core's own function, the same one the server calls. Writing
 * a second one here would eventually disagree with it, and the student would
 * watch a correct answer turn wrong on sync with nothing to explain it.
 */

import { useCallback, useMemo, useState } from 'react';

import type { CheckAnswer, CheckPublic, CheckResult } from '@lenterra/core';
import { gradeLocally } from '@lenterra/core';

import * as queue from '../../data/outbox/queue';

export interface UseCheckArgs {
  accountId: string;
  courseId: string;
  lessonId: string;
  catalogVersion: string;
  check: CheckPublic;
  /** Whether the student was offline when they answered, for the server record. */
  offline: boolean;
}

export interface UseCheck {
  /** Current answers, by item id. Undefined until the item is touched. */
  answers: Record<string, unknown>;
  answer: (itemId: string, value: unknown) => void;
  /** Every item has an answer, so submitting is meaningful. */
  complete: boolean;
  result: CheckResult | null;
  /** Which attempt this is. Retries are recorded, not hidden (PRD-CRS-005). */
  attemptNumber: number;
  submit: () => void;
  /** Clear the result and the answers so the student can try again after reading. */
  retry: () => void;
}

export function useCheck({
  accountId,
  courseId,
  lessonId,
  catalogVersion,
  check,
  offline,
}: UseCheckArgs): UseCheck {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);

  const answer = useCallback(
    (itemId: string, value: unknown) => {
      // Answers freeze once graded. Editing one against a result already on
      // screen would let a student correct their way to a pass without it
      // counting as the retry it is.
      if (result !== null) return;
      setAnswers((current) => ({ ...current, [itemId]: value }));
    },
    [result],
  );

  const complete = useMemo(
    () => check.items.every((item) => answers[item.id] !== undefined),
    [answers, check.items],
  );

  const submit = useCallback(() => {
    if (result !== null) return;

    const payload: CheckAnswer[] = check.items.map((item) => ({
      itemId: item.id,
      answer: answers[item.id],
    }));

    const graded = gradeLocally(check, payload);
    setResult(graded);

    // Queued after grading so the student is never shown a spinner for
    // something already decided, and queued unconditionally — a failed check is
    // evidence too, and dropping it would flatter the mastery estimate.
    queue.enqueue(accountId, 'check', {
      checkId: check.id,
      courseId,
      lessonId,
      catalogVersion,
      answers: payload,
      playedOffline: offline,
    });
  }, [accountId, answers, catalogVersion, check, courseId, lessonId, offline, result]);

  const retry = useCallback(() => {
    setAnswers({});
    setResult(null);
    setAttemptNumber((n) => n + 1);
  }, []);

  return { answers, answer, complete, result, attemptNumber, submit, retry };
}
