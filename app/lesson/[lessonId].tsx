/**
 * The lesson reader, and the check at the end of it.
 *
 * Text-first and entirely offline. There is no video and no audio anywhere in
 * R1 — a single video would consume a month of the 5 MB weekly data budget the
 * target student actually has (PRD-CRS-003), so the decision is a constraint,
 * not a preference.
 *
 * The check grades locally and says the result is provisional, which is the
 * honest description: the server re-grades it and the server's score is what
 * moves mastery. A wrong answer shows the authored explanation naming the
 * misconception, because "incorrect" on its own teaches a student nothing they
 * did not already know (PRD-CRS-005).
 */

import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CheckItemPublic, LessonBlock } from '@lenterra/core';

import { activeAccountId } from '@/src/data/cache/storage';
import { findLesson, nextLessonId } from '@/src/data/cache/courses';
import { completeLesson, isLessonComplete } from '@/src/features/courses/progress';
import { useCheck } from '@/src/features/courses/useCheck';
import { useSync } from '@/src/features/sync/SyncProvider';
import { EmptyState } from '@/src/ui/components/ScreenState';
import {
  MIN_TOUCH_TARGET,
  palette,
  radius,
  spacing,
  typography,
} from '@/src/ui/tokens';

export default function LessonScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const accountId = activeAccountId();

  const found = accountId && lessonId ? findLesson(accountId, lessonId) : null;

  if (!accountId || !found) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState title={t('courses.emptyTitle')} body={t('error.offline')} />
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryLabel}>{t('common.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <Reader
      accountId={accountId}
      lesson={found.lesson}
      course={found.course}
      catalogVersion={found.catalogVersion}
    />
  );
}

type Found = NonNullable<ReturnType<typeof findLesson>>;

function Reader({
  accountId,
  lesson,
  course,
  catalogVersion,
}: {
  accountId: string;
  lesson: Found['lesson'];
  course: Found['course'];
  catalogVersion: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const sync = useSync();

  const [showCheck, setShowCheck] = useState(false);
  const alreadyDone = useMemo(
    () => isLessonComplete(accountId, lesson.id),
    [accountId, lesson.id],
  );
  const next = nextLessonId(course, lesson.id);

  const finish = () => {
    completeLesson(accountId, course.id, lesson.id);
    if (next) router.replace(`/lesson/${next}`);
    else router.replace(`/course/${course.id}`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t(course.titleKey)}</Text>
        <Text style={styles.title}>{t(lesson.titleKey)}</Text>
        <Text style={styles.meta}>
          {t('courses.readingTime', { minutes: lesson.readingMinutes })}
        </Text>

        {lesson.blocks.map((block, index) => (
          <Block key={index} block={block} onOpenMission={(id) => router.push(`/play/${id}`)} />
        ))}

        {lesson.check && !showCheck ? (
          <Pressable
            accessibilityRole="button"
            style={styles.primary}
            onPress={() => setShowCheck(true)}
          >
            <Text style={styles.primaryLabel}>{t('courses.checkTitle')}</Text>
          </Pressable>
        ) : null}

        {lesson.check && showCheck ? (
          <Check
            accountId={accountId}
            courseId={course.id}
            lessonId={lesson.id}
            catalogVersion={catalogVersion}
            check={lesson.check}
            offline={!sync.online}
            onFinish={finish}
            nextLabel={next ? t('courses.nextLesson') : t('courses.backToCourse')}
          />
        ) : null}

        {!lesson.check ? (
          <Pressable accessibilityRole="button" style={styles.primary} onPress={finish}>
            <Text style={styles.primaryLabel}>
              {next ? t('courses.nextLesson') : t('courses.backToCourse')}
            </Text>
          </Pressable>
        ) : null}

        {alreadyDone ? <Text style={styles.doneNote}>{t('courses.lessonDone')}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/**
 * One piece of a lesson.
 *
 * Exhaustive by construction: the block union is discriminated, so adding a
 * kind without rendering it fails to compile rather than leaving a gap on a
 * page a student is reading with nobody to ask.
 */
function Block({
  block,
  onOpenMission,
}: {
  block: LessonBlock;
  onOpenMission: (missionId: string) => void;
}) {
  const { t } = useTranslation();

  switch (block.kind) {
    case 'text':
      return <Text style={styles.body}>{t(block.textKey)}</Text>;

    case 'example':
      return (
        <View style={styles.example}>
          <Text style={styles.body}>{t(block.textKey)}</Text>
          {block.captionKey ? (
            <Text style={styles.caption}>{t(block.captionKey)}</Text>
          ) : null}
        </View>
      );

    case 'callout':
      return (
        <View style={[styles.callout, calloutTone[block.tone]]}>
          {/* The tone is named, not only coloured — a washed-out panel in
              daylight loses the tint long before it loses the word. */}
          <Text style={styles.calloutLabel}>{t(`courses.tone.${block.tone}`)}</Text>
          <Text style={styles.body}>{t(block.textKey)}</Text>
        </View>
      );

    case 'image':
      // Images are authored but not shipped in R1 (PRD-CRS-003 caps the whole
      // catalogue at 8 MB and nothing has been drawn yet). The alt text is
      // required for exactly this reason: it is the lesson when the picture is
      // not there.
      return (
        <View style={styles.imageFallback}>
          <Text style={styles.caption}>{t(block.altKey)}</Text>
        </View>
      );

    case 'gameLink':
      return (
        <Pressable
          accessibilityRole="button"
          style={styles.gameLink}
          onPress={() => onOpenMission(block.missionId)}
        >
          <Text style={styles.gameLinkLabel}>{t(block.labelKey)}</Text>
        </Pressable>
      );
  }
}

const calloutTone = StyleSheet.create({
  tip: { backgroundColor: palette.blue050, borderLeftColor: palette.blue600 },
  warning: { backgroundColor: palette.warning100, borderLeftColor: palette.warning600 },
  culture: { backgroundColor: palette.orange100, borderLeftColor: palette.orange600 },
});

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

function Check({
  accountId,
  courseId,
  lessonId,
  catalogVersion,
  check,
  offline,
  onFinish,
  nextLabel,
}: {
  accountId: string;
  courseId: string;
  lessonId: string;
  catalogVersion: string;
  check: NonNullable<Found['lesson']['check']>;
  offline: boolean;
  onFinish: () => void;
  nextLabel: string;
}) {
  const { t } = useTranslation();
  const state = useCheck({ accountId, courseId, lessonId, catalogVersion, check, offline });

  return (
    <View style={styles.check}>
      <Text style={styles.sectionTitle}>{t('courses.checkTitle')}</Text>
      {state.attemptNumber > 1 ? (
        <Text style={styles.caption}>{t('courses.attempt', { n: state.attemptNumber })}</Text>
      ) : null}

      {check.items.map((item, index) => (
        <Item
          key={item.id}
          item={item}
          index={index}
          value={state.answers[item.id]}
          onAnswer={(value) => state.answer(item.id, value)}
          verdict={state.result?.items.find((entry) => entry.itemId === item.id) ?? null}
        />
      ))}

      {state.result === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !state.complete }}
          disabled={!state.complete}
          style={[styles.primary, !state.complete && styles.primaryDisabled]}
          onPress={state.submit}
        >
          <Text style={styles.primaryLabel}>{t('courses.submitCheck')}</Text>
        </Pressable>
      ) : (
        <View style={styles.result}>
          <Text style={state.result.passed ? styles.resultPass : styles.resultFail}>
            {state.result.passed ? t('courses.checkPassed') : t('courses.checkFailed')}
          </Text>
          <Text style={styles.resultScore}>
            {t('courses.checkScore', {
              correct: state.result.items.filter((entry) => entry.correct).length,
              total: state.result.items.length,
            })}
          </Text>

          {/*
            Marked provisional rather than presented as final. The server
            re-grades this, and a number that silently changes later reads as
            the system cheating.
          */}
          <Text style={styles.pending}>{t('result.pendingSync')}</Text>

          <Pressable accessibilityRole="button" style={styles.primary} onPress={onFinish}>
            <Text style={styles.primaryLabel}>{nextLabel}</Text>
          </Pressable>

          {/* Retrying is offered whether or not they passed, and every retry is
              recorded — a second attempt is different evidence from a first. */}
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={state.retry}>
            <Text style={styles.secondaryLabel}>{t('courses.retryCheck')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Item({
  item,
  index,
  value,
  onAnswer,
  verdict,
}: {
  item: CheckItemPublic;
  index: number;
  value: unknown;
  onAnswer: (value: unknown) => void;
  verdict: { correct: boolean; explainKey: string } | null;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.item}>
      <Text style={styles.itemPrompt}>
        {index + 1}. {t(item.promptKey)}
      </Text>

      {item.kind === 'choice' ? (
        <ChoiceItem item={item} value={value} onAnswer={onAnswer} locked={verdict !== null} />
      ) : item.kind === 'order' ? (
        <OrderItem item={item} value={value} onAnswer={onAnswer} locked={verdict !== null} />
      ) : (
        <Text style={styles.caption}>{t('courses.unsupportedItem')}</Text>
      )}

      {verdict ? (
        <View style={verdict.correct ? styles.verdictRight : styles.verdictWrong}>
          <Text style={styles.verdictLabel}>
            {verdict.correct ? t('courses.itemRight') : t('courses.itemWrong')}
          </Text>
          {/* Shown on a right answer too. A student who guessed correctly is
              exactly the one who most needs the reasoning. */}
          <Text style={styles.body}>{t(verdict.explainKey)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ChoiceItem({
  item,
  value,
  onAnswer,
  locked,
}: {
  item: CheckItemPublic;
  value: unknown;
  onAnswer: (value: unknown) => void;
  locked: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.options}>
      {(item.optionKeys ?? []).map((key, index) => {
        const selected = value === index;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: locked }}
            disabled={locked}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onAnswer(index)}
          >
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
              {t(key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Ordering, done by tapping fragments into place.
 *
 * Drag-and-drop would be the obvious interaction and is the wrong one here: the
 * reference device is a 5-inch screen, often scratched, often used one-handed
 * on a bus. Tap-to-place works with the same precision as any other button on
 * the screen.
 */
function OrderItem({
  item,
  value,
  onAnswer,
  locked,
}: {
  item: CheckItemPublic;
  value: unknown;
  onAnswer: (value: unknown) => void;
  locked: boolean;
}) {
  const { t } = useTranslation();
  const fragments = item.fragmentKeys ?? [];
  const chosen = Array.isArray(value) ? (value as number[]) : [];

  const toggle = (index: number) => {
    if (chosen.includes(index)) {
      onAnswer(chosen.filter((entry) => entry !== index));
      return;
    }
    const next = [...chosen, index];
    onAnswer(next.length === fragments.length ? next : next);
  };

  return (
    <View style={styles.options}>
      {fragments.map((key, index) => {
        const position = chosen.indexOf(index);
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={
              position >= 0
                ? t('courses.orderPlaced', { n: position + 1, text: t(key) })
                : t('courses.orderUnplaced', { text: t(key) })
            }
            accessibilityState={{ selected: position >= 0, disabled: locked }}
            disabled={locked}
            style={[styles.option, position >= 0 && styles.optionSelected]}
            onPress={() => toggle(index)}
          >
            <Text style={styles.orderMark}>{position >= 0 ? String(position + 1) : '·'}</Text>
            <Text style={[styles.optionLabel, position >= 0 && styles.optionLabelSelected]}>
              {t(key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },

  eyebrow: { ...typography.caption, color: palette.blue700, fontWeight: '700' },
  title: { ...typography.title, color: palette.ink900 },
  meta: { ...typography.caption, color: palette.ink500 },
  sectionTitle: { ...typography.heading, color: palette.ink900 },
  body: { ...typography.body, color: palette.ink700 },
  caption: { ...typography.caption, color: palette.ink500 },
  doneNote: { ...typography.caption, color: palette.success600, textAlign: 'center' },

  example: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  callout: {
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  calloutLabel: { ...typography.caption, color: palette.ink700, fontWeight: '700' },
  imageFallback: {
    backgroundColor: palette.ink100,
    borderRadius: radius.md,
    padding: spacing.lg,
  },

  gameLink: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.blue600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  gameLinkLabel: { ...typography.label, color: palette.blue700 },

  check: { gap: spacing.md, marginTop: spacing.lg },
  item: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  itemPrompt: { ...typography.body, color: palette.ink900, fontWeight: '600' },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.ink100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: { borderColor: palette.blue600, backgroundColor: palette.blue050 },
  optionLabel: { ...typography.body, color: palette.ink700, flexShrink: 1 },
  optionLabelSelected: { color: palette.ink900, fontWeight: '600' },
  orderMark: { ...typography.label, color: palette.blue700, width: 20, textAlign: 'center' },

  verdictRight: {
    backgroundColor: palette.success100,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  verdictWrong: {
    backgroundColor: palette.warning100,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  verdictLabel: { ...typography.label, color: palette.ink900 },

  result: { gap: spacing.sm, alignItems: 'stretch' },
  resultPass: { ...typography.heading, color: palette.success600 },
  resultFail: { ...typography.heading, color: palette.warning600 },
  resultScore: { ...typography.body, color: palette.ink700 },
  pending: { ...typography.caption, color: palette.warning600 },

  primary: {
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: palette.blue700,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryDisabled: { backgroundColor: palette.ink300 },
  primaryLabel: { ...typography.label, color: palette.surface },
  secondary: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { ...typography.label, color: palette.blue700 },
});
