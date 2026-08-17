/**
 * The reward shop.
 *
 * `v1.reward.redeem` has existed since the server was written, and until the
 * catalogue was authored it could not succeed at all: it reads a
 * `rewards.catalog` part that nothing published. Points accumulated against a
 * shop that did not exist.
 *
 * Everything here is cosmetic — a colour, a board, a title — and that is a rule
 * rather than a coincidence. A reward that made a mission easier would turn
 * points into a shortcut past the learning they exist to record, and one that
 * made a mission harder would punish a student for spending them. Nothing here
 * is worth money either; the audience is thirteen.
 *
 * It reads the catalogue from the device rather than the network, so the shop
 * opens with no signal. That matters because the points are mostly earned with
 * no signal too.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import type { RewardItem } from '@/src/data/cache/catalog';
import { queryKeys } from '@/src/data/queries/client';
import { rpc, RpcError } from '@/src/data/nakama/rpc';
import { newItemId } from '@/src/data/outbox/queue';
import { useRewards } from '@/src/data/queries/hooks';
import { EmptyState } from '@/src/ui/components/ScreenState';
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '@/src/ui/tokens';

export function RewardShop({
  accountId,
  balance,
  owned,
  onRedeemed,
}: {
  accountId: string | null;
  balance: number;
  /** Item ids already redeemed, so nothing is offered twice. */
  owned: string[];
  onRedeemed: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const rewards = useRewards(accountId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownedSet = useMemo(() => new Set(owned), [owned]);
  const items: RewardItem[] = rewards.data ?? [];

  if (items.length === 0) {
    // No catalogue on this device yet. Said plainly rather than shown as an
    // empty shelf, which would read as "you have nothing worth buying".
    return <EmptyState title={t('rewards.emptyTitle')} body={t('rewards.emptyBody')} />;
  }

  async function redeem(item: RewardItem) {
    if (!accountId) return;
    setBusy(item.id);
    setError(null);
    try {
      await rpc(accountId, 'v1.reward.redeem', {
        itemId: item.id,
        idempotencyKey: newItemId(),
      });
      // The balance moved on the server, so re-read rather than subtracting
      // here. Two sources for one number is how they end up disagreeing.
      void queryClient.invalidateQueries({ queryKey: queryKeys.points(accountId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap(accountId) });
      onRedeemed();
    } catch (err) {
      // Told apart because the next action differs: wait and earn more, or
      // nothing at all because it is already yours.
      const code = err instanceof RpcError ? err.code : null;
      setError(
        code === 'CONFLICT' ? t('rewards.cannotAfford') : t('error.generic'),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.balance}>{t('rewards.balance', { points: balance })}</Text>

      {items.map((item) => {
        const isOwned = ownedSet.has(item.id);
        const affordable = balance >= item.cost;

        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.name}>{t(`reward.${item.id}`)}</Text>
              <Text style={styles.kind}>{t(`rewards.kind.${item.kind}`)}</Text>
            </View>

            {isOwned ? (
              <Text style={styles.owned}>{t('rewards.owned')}</Text>
            ) : (
              <Pressable
                testID={`reward-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={t('rewards.buyAccessible', {
                  name: t(`reward.${item.id}`),
                  points: item.cost,
                })}
                // Disabled rather than hidden when it cannot be afforded. What
                // a student is working towards is the useful half of a shop,
                // and hiding it leaves them with no reason to keep earning.
                disabled={!affordable || busy !== null}
                style={[styles.buy, !affordable && styles.unaffordable]}
                onPress={() => void redeem(item)}
              >
                {busy === item.id ? (
                  <ActivityIndicator color={palette.surface} />
                ) : (
                  <Text style={affordable ? styles.buyLabel : styles.unaffordableLabel}>
                    {t('rewards.cost', { points: item.cost })}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        );
      })}

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  balance: { ...typography.caption, color: palette.ink500 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  info: { flex: 1, gap: spacing.xs },
  name: { ...typography.label, color: palette.ink900 },
  kind: { ...typography.caption, color: palette.ink500 },
  buy: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.blue700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyLabel: { ...typography.label, color: palette.surface },
  unaffordable: { backgroundColor: palette.ink100 },
  unaffordableLabel: { ...typography.label, color: palette.ink500 },
  owned: { ...typography.caption, color: palette.success600 },
  error: { ...typography.caption, color: palette.danger600 },
});
