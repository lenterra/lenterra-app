/**
 * What a teacher has assigned, on the home screen.
 *
 * The card itself is not new. What it did before was render `assignment.targetId`
 * — so a thirteen-year-old was shown `congklak.m04` as the name of the thing
 * their teacher had asked them to do. Everything else in the app resolves an id
 * to a title through the catalog; this one place did not.
 *
 * Two other things changed with it.
 *
 * The list comes from the local cache rather than the recommendation response.
 * `v1.mission.recommend` carries the current assignment, but it is an RPC, so
 * assignments appeared only while a student had signal — and the moment they
 * would actually read one is on the bus home. `v1.sync.pull` carries the whole
 * list, the sync engine caches it, and this reads the cache.
 *
 * And there can be more than one. A teacher assigning a lesson to the class and
 * a mission to one student who is stuck has made two decisions, and showing
 * only the newer of them silently discards the other.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dismissAssignment, type Assignment } from '@/src/data/cache/assignments';
import { findMission } from '@/src/data/cache/catalog';
import { findLesson } from '@/src/data/cache/courses';
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '@/src/ui/tokens';

/** At most this many at once. A wall of assignments is a wall nobody starts. */
const MAX_SHOWN = 3;

export function AssignmentCards({
  accountId,
  assignments,
  onOpenMission,
  onOpenLesson,
  onDismissed,
}: {
  accountId: string;
  assignments: Assignment[];
  onOpenMission: (missionId: string) => void;
  onOpenLesson: (lessonId: string) => void;
  onDismissed: () => void;
}) {
  const { t } = useTranslation();

  const resolved = useMemo(
    () =>
      assignments.slice(0, MAX_SHOWN).map((assignment) => ({
        assignment,
        title: titleFor(accountId, assignment, t),
      })),
    [accountId, assignments, t],
  );

  if (resolved.length === 0) return null;

  return (
    <View style={styles.group}>
      {resolved.map(({ assignment, title }) => (
        <View key={assignment.id} style={styles.card}>
          <Pressable
            testID={`assignment-${assignment.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('home.assignmentAccessible', { title })}
            style={styles.main}
            onPress={() =>
              // A teacher may assign either. Sending a lesson id to the mission
              // player opens a board that does not exist.
              assignment.kind === 'lesson'
                ? onOpenLesson(assignment.targetId)
                : onOpenMission(assignment.targetId)
            }
          >
            <Text style={styles.label}>{t('home.assignmentFromTeacher')}</Text>
            <Text style={styles.title}>{title}</Text>
            {assignment.note ? <Text style={styles.note}>{assignment.note}</Text> : null}
          </Pressable>

          {/*
            Dismissal is local, and says "hide" rather than "done". The server
            has no notion of a student completing an assignment, so a card
            claiming otherwise would be a claim nobody made.
          */}
          <Pressable
            testID={`assignment-hide-${assignment.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('home.assignmentHide')}
            style={styles.hide}
            onPress={() => {
              dismissAssignment(accountId, assignment.id);
              onDismissed();
            }}
          >
            <Text style={styles.hideLabel}>{t('home.assignmentHide')}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/**
 * Resolve an assignment to something a student can read.
 *
 * Falls back to a generic phrase rather than the id when the catalog on this
 * device does not have the target yet — which happens when a teacher assigns
 * from newer content than the student has synced. "Your teacher assigned
 * something" is honest; `algo.greedy.l02` is noise.
 */
function titleFor(
  accountId: string,
  assignment: Assignment,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (assignment.kind === 'lesson') {
    const found = findLesson(accountId, assignment.targetId);
    return found ? t(found.lesson.titleKey) : t('home.assignmentUnknownLesson');
  }

  const found = findMission(accountId, assignment.targetId);
  return found ? t(found.mission.titleKey) : t('home.assignmentUnknownMission');
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  card: {
    backgroundColor: palette.orange100,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  main: { gap: spacing.xs },
  label: { ...typography.caption, color: palette.orange600, fontWeight: '700' },
  title: { ...typography.heading, color: palette.ink900 },
  note: { ...typography.body, color: palette.ink700 },
  hide: {
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  hideLabel: { ...typography.caption, color: palette.ink500 },
});
