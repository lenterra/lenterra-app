/**
 * Courses.
 *
 * The last screen still running the demo verbatim: "Hi, Firsa" over a gradient
 * banner reading "Exclusive / Just For / You!", a search field wired to
 * nothing, and four course cards with hardcoded titles and progress.
 *
 * Two things are gone deliberately rather than deferred.
 *
 * The banner is a promotional treatment for an offer that does not exist. R1 is
 * free to pilot schools, there is nothing a student can buy, and a fake
 * discount on a screen shown to children rehearses a pattern this product
 * should not teach (PRD-APP-043, PRD-CRS-008).
 *
 * The search box is gone until there is enough content for search to be the
 * faster way to find something. A field that filters four items is furniture.
 *
 * Courses are catalog content, not app code (PRD-CRS-001), so this screen is a
 * reader over what has been published. When nothing has been, it says so
 * plainly instead of showing invented cards.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { activeAccountId } from '@/src/data/cache/storage';
import { allCourses, type CourseSummary } from '@/src/data/cache/courses';
import { lessonsCompletedIn } from '@/src/features/courses/progress';
import { useProgress } from '@/src/data/queries/hooks';
import { useSync } from '@/src/features/sync/SyncProvider';
import { EmptyState, LoadingState } from '@/src/ui/components/ScreenState';
import {
  MIN_TOUCH_TARGET,
  domainColors,
  palette,
  radius,
  spacing,
  typography,
} from '@/src/ui/tokens';

export default function CoursesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const accountId = activeAccountId();
  const sync = useSync();
  const progress = useProgress(accountId);

  const courses = useMemo<CourseSummary[]>(
    () => (accountId ? allCourses(accountId) : []),
    [accountId, sync.catalogProgress],
  );

  // Lessons completed per course, so a card can show real progress rather
  // than the demo's fixed percentages.
  //
  // Reconciled against what the device knows: a student who read three lessons
  // on a bus has finished three, whether or not the server has heard about it.
  // Showing the server's count alone would make their morning's work vanish
  // until the next sync.
  const completed = useMemo(() => {
    const map: Record<string, number> = {};
    if (!accountId) return map;
    for (const course of courses) {
      const synced = progress.data?.courses.find(
        (entry: { courseId: string; lessonsCompleted: number }) => entry.courseId === course.id,
      );
      map[course.id] = lessonsCompletedIn(accountId, course.id, synced?.lessonsCompleted);
    }
    return map;
  }, [accountId, courses, progress.data]);

  if (sync.catalogProgress && courses.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <LoadingState label={t('courses.downloading')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={progress.isRefetching}
            onRefresh={() => void progress.refetch()}
          />
        }
      >
        <Text style={styles.title}>{t('courses.title')}</Text>

        {courses.length === 0 ? (
          <EmptyState title={t('courses.emptyTitle')} body={t('courses.emptyBody')} />
        ) : (
          courses.map((course) => {
            const done = completed[course.id] ?? 0;
            const total = course.lessons.length;
            const minutes = course.lessons.reduce((sum, lesson) => sum + lesson.readingMinutes, 0);

            return (
              <Pressable
                key={course.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(course.titleKey)}. ${t('courses.lessonsOf', { done, total })}`}
                style={styles.card}
                onPress={() => router.push(`/course/${course.id}`)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{t(course.titleKey)}</Text>
                  <View style={[styles.tag, { backgroundColor: domainColors[course.domain].bg }]}>
                    {/* The domain label carries the meaning; colour only
                        reinforces it (PRD-ACC-013). */}
                    <Text style={[styles.tagText, { color: domainColors[course.domain].fg }]}>
                      {t(`progress.domain.${course.domain}`)}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={styles.cardSummary}>
                  {t(course.summaryKey)}
                </Text>

                <Text style={styles.cardMeta}>
                  {t('courses.lessonsOf', { done, total })} ·{' '}
                  {/* An honest reading time, authored per lesson and summed
                      here rather than guessed from word count (PRD-CRS-010). */}
                  {t('courses.readingTime', { minutes })}
                </Text>

                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: total, now: done }}
                  style={styles.barTrack}
                >
                  <View
                    style={[
                      styles.barFill,
                      { width: total === 0 ? '0%' : `${Math.round((done / total) * 100)}%` },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.title, color: palette.ink900 },

  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { ...typography.heading, color: palette.ink900, flexShrink: 1 },
  cardSummary: { ...typography.body, color: palette.ink700 },
  cardMeta: { ...typography.caption, color: palette.ink500 },

  tag: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  tagText: { ...typography.caption, fontWeight: '700' },

  barTrack: { height: 6, borderRadius: radius.pill, backgroundColor: palette.ink100 },
  barFill: { height: 6, borderRadius: radius.pill, backgroundColor: palette.blue600 },
});
