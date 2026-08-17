/**
 * A course, and the lessons in it.
 *
 * The route `courses.tsx` has been linking to since the screen was rebuilt.
 * Everything it needs is in the catalog cache, so it opens with no network
 * and shows real lesson-level progress rather than a percentage
 * nobody computed.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { activeAccountId } from '@/src/data/cache/storage';
import { findCourse, lessonsFor, resumeLesson } from '@/src/data/cache/courses';
import { completedLessons } from '@/src/features/courses/progress';
import { EmptyState } from '@/src/ui/components/ScreenState';
import {
  MIN_TOUCH_TARGET,
  domainColors,
  palette,
  radius,
  spacing,
  typography,
} from '@/src/ui/tokens';

export default function CourseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const accountId = activeAccountId();

  const found = accountId && courseId ? findCourse(accountId, courseId) : null;
  const done = accountId && courseId ? completedLessons(accountId, courseId) : [];

  if (!accountId || !found) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState title={t('courses.emptyTitle')} body={t('courses.emptyBody')} />
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryLabel}>{t('common.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { course } = found;
  const bodies = lessonsFor(accountId, course.id);
  const minutes = course.lessons.reduce((sum, lesson) => sum + lesson.readingMinutes, 0);
  const resume = resumeLesson(course, done);
  const started = done.length > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t(course.titleKey)}</Text>
          <View style={[styles.tag, { backgroundColor: domainColors[course.domain].bg }]}>
            {/* The label carries the meaning; colour only reinforces it. */}
            <Text style={[styles.tagText, { color: domainColors[course.domain].fg }]}>
              {t(`progress.domain.${course.domain}`)}
            </Text>
          </View>
        </View>

        <Text style={styles.summary}>{t(course.summaryKey)}</Text>
        <Text style={styles.meta}>
          {t('courses.lessonsOf', { done: done.length, total: course.lessons.length })} ·{' '}
          {t('courses.readingTime', { minutes })}
        </Text>

        {resume ? (
          <Pressable
            accessibilityRole="button"
            style={styles.primary}
            onPress={() => router.push(`/lesson/${resume}`)}
          >
            <Text style={styles.primaryLabel}>
              {started ? t('courses.resume') : t('courses.start')}
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>{t('courses.lessons')}</Text>

        {course.lessons.map((entry, index) => {
          const complete = done.includes(entry.id);
          // A lesson with no cached body is a lesson that cannot be opened. It
          // stays visible and says so, rather than opening onto a blank page.
          const readable = bodies.some((body) => body.id === entry.id);

          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${t(entry.titleKey)}. ${
                complete ? t('courses.lessonDone') : t('courses.lessonTodo')
              }`}
              accessibilityState={{ disabled: !readable }}
              disabled={!readable}
              style={[styles.row, !readable && styles.rowDisabled]}
              onPress={() => router.push(`/lesson/${entry.id}`)}
            >
              <Text style={[styles.rowMark, complete && styles.rowMarkDone]}>
                {complete ? '✓' : String(index + 1)}
              </Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{t(entry.titleKey)}</Text>
                <Text style={styles.rowMeta}>
                  {t('courses.readingTime', { minutes: entry.readingMinutes })}
                  {entry.hasCheck ? ` · ${t('courses.hasCheck')}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: spacing.lg, gap: spacing.md },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...typography.title, color: palette.ink900, flexShrink: 1 },
  summary: { ...typography.body, color: palette.ink700 },
  meta: { ...typography.caption, color: palette.ink500 },
  sectionTitle: { ...typography.heading, color: palette.ink900, marginTop: spacing.md },

  tag: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  tagText: { ...typography.caption, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowDisabled: { opacity: 0.5 },
  rowMark: {
    ...typography.label,
    color: palette.ink500,
    width: 28,
    textAlign: 'center',
  },
  rowMarkDone: { color: palette.success600 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, color: palette.ink900, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: palette.ink500 },

  primary: {
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: palette.blue700,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryLabel: { ...typography.label, color: palette.surface },
  secondary: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { ...typography.label, color: palette.blue700 },
});
