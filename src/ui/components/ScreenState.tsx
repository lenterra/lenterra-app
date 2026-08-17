/**
 * The states every screen has to handle.
 *
 * Loading, empty, error, and offline are not edge cases here — for the target
 * student, offline is the *normal* case and empty is what the first week looks
 * like. The demo had none of them, because with hardcoded arrays there is
 * nothing to be loading or missing.
 *
 * Two rules these encode:
 *
 *  - **Cached data never shows a spinner.** A screen that has data renders it
 *    and refreshes behind it (PRD-ACC-018).
 *  - **Offline is not an error.** It is a state the product is designed for,
 *    and saying "something went wrong" when a student is simply on a bus
 *    teaches them the app is broken.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '../tokens';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.centered} accessibilityRole="progressbar">
      <ActivityIndicator color={palette.blue600} />
      <Text style={styles.body}>{label ?? t('common.loading')}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.centered}>
      <Text accessibilityRole="alert" style={styles.body}>
        {message ?? t('error.generic')}
      </Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryLabel}>{t('common.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The offline banner.
 *
 * Shows the pending count and offers a manual sync, because a student standing
 * in the one corner of the school with signal wants to push their work now
 * rather than wait for a timer (TRD-SYNC-007).
 */
export function OfflineNotice({
  pending,
  syncing,
  onSync,
}: {
  pending: number;
  syncing: boolean;
  onSync?: () => void;
}) {
  const { t } = useTranslation();
  if (pending === 0) return null;

  return (
    <View testID="offline-notice" style={styles.banner}>
      <Text style={styles.bannerText}>
        {syncing ? t('sync.syncing') : t('sync.pendingCount', { count: pending })}
      </Text>
      {onSync && !syncing ? (
        <Pressable accessibilityRole="button" onPress={onSync} hitSlop={8}>
          <Text style={styles.bannerAction}>{t('common.syncNow')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Marks a value that includes unsynced contributions (TRD-SYNC-002). */
export function PendingMark() {
  const { t } = useTranslation();
  return (
    <Text style={styles.pending} accessibilityLabel={t('common.pending')}>
      {' •'}
    </Text>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.heading, color: palette.ink900, textAlign: 'center' },
  body: { ...typography.body, color: palette.ink500, textAlign: 'center' },
  retry: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.blue600,
  },
  retryLabel: { ...typography.label, color: palette.surface },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.warning100,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  bannerText: { ...typography.caption, color: palette.warning600, flexShrink: 1 },
  bannerAction: { ...typography.caption, color: palette.blue600, fontWeight: '700' },
  pending: { color: palette.warning600, fontWeight: '700' },
});
