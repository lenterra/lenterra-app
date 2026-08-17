/**
 * The Congklak board.
 *
 * Rendering only. It imports the core's *types* and its read-only helpers, and
 * holds no rules of its own — the whole point of the extraction is that there
 * is one implementation of what a move does, and the server runs it too.
 *
 * The layout mirrors the physical board and the demo's index scheme:
 *
 *       A5  A4  A3  A2  A1        opponent's row, indices n…1
 *   H2                     H1     stores
 *       B1  B2  B3  B4  B5        the student's row
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CongklakState } from '@lenterra/core';
import { pitsPerSide, rowOf, storeOf } from '@lenterra/core';

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '@/src/ui/tokens';

export interface CongklakBoardProps {
  state: CongklakState;
  onPitPress: (pit: number) => void;
  /** Pits the student may currently sow. */
  legalPits: number[];
  disabled?: boolean;
  /** Highlighted while an animation is passing through it. */
  activePit?: number | null;
}

export function CongklakBoard({
  state,
  onPitPress,
  legalPits,
  disabled = false,
  activePit = null,
}: CongklakBoardProps) {
  const { t } = useTranslation();

  const n = pitsPerSide(state);
  const playerStore = storeOf(state, state.playerSide);
  const opponentStore = storeOf(state, state.playerSide === 1 ? 2 : 1);

  // The opponent's row is drawn right-to-left so the board reads as a loop,
  // which is how it looks on a real congklak and how the wrap-around makes
  // visual sense.
  const opponentRow = useMemo(() => {
    const row = rowOf(state, state.playerSide === 1 ? 2 : 1);
    const indices: number[] = [];
    for (let i = row.to; i >= row.from; i--) indices.push(i);
    return indices;
  }, [state, n]);

  const playerRow = useMemo(() => {
    const row = rowOf(state, state.playerSide);
    const indices: number[] = [];
    for (let i = row.from; i <= row.to; i++) indices.push(i);
    return indices;
  }, [state, n]);

  return (
    <View style={styles.board}>
      <View style={styles.rowArea}>
        {opponentRow.map((index) => (
          <Pit
            key={index}
            index={index}
            seeds={state.pits[index] ?? 0}
            active={activePit === index}
            side="opponent"
          />
        ))}
      </View>

      <View style={styles.middle}>
        <Store
          seeds={state.pits[opponentStore] ?? 0}
          label={t('congklak.store')}
          side="opponent"
        />
        <View style={styles.spacer} />
        <Store seeds={state.pits[playerStore] ?? 0} label={t('congklak.store')} side="player" />
      </View>

      <View style={styles.rowArea}>
        {playerRow.map((index) => {
          const legal = legalPits.includes(index);
          // A stable handle for the playable pits, in board order. The E2E flow
          // needs to take *a* legal move without knowing the rules, and marking
          // legality is something the board already does visually.
          const legalIndex = legal ? legalPits.indexOf(index) : -1;
          return (
            <Pit
              key={index}
              index={index}
              seeds={state.pits[index] ?? 0}
              active={activePit === index}
              side="player"
              legal={legal}
              testID={legalIndex >= 0 ? `legal-move-${legalIndex}` : undefined}
              onPress={legal && !disabled ? () => onPitPress(index) : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

function Pit({
  index,
  seeds,
  side,
  legal = false,
  testID,
  active = false,
  onPress,
}: {
  index: number;
  seeds: number;
  side: 'player' | 'opponent';
  legal?: boolean;
  testID?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      // The count is the whole game. A screen reader user must get the number,
      // not "pit".
      accessibilityLabel={`${t('congklak.seed')} ${seeds}`}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.pit,
        side === 'opponent' && styles.pitOpponent,
        legal && styles.pitLegal,
        active && styles.pitActive,
      ]}
    >
      <Text style={styles.pitCount}>{seeds}</Text>
    </Pressable>
  );
}

function Store({
  seeds,
  label,
  side,
}: {
  seeds: number;
  label: string;
  side: 'player' | 'opponent';
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${seeds}`}
      style={[styles.store, side === 'opponent' && styles.storeOpponent]}
    >
      <Text style={styles.storeCount}>{seeds}</Text>
      <Text style={styles.storeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowArea: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  middle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spacer: { flex: 1 },

  pit: {
    flex: 1,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    backgroundColor: palette.blue050,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pitOpponent: { backgroundColor: palette.ink100 },
  // A playable pit is marked by a border as well as a fill, so the affordance
  // survives a colour-blind student and a washed-out panel in daylight.
  pitLegal: { borderColor: palette.blue600 },
  pitActive: { borderColor: palette.orange600, borderWidth: 3 },
  pitCount: { ...typography.heading, color: palette.ink900 },

  store: {
    minWidth: MIN_TOUCH_TARGET + spacing.lg,
    minHeight: MIN_TOUCH_TARGET + spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.blue100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  storeOpponent: { backgroundColor: palette.ink100 },
  storeCount: { ...typography.display, color: palette.ink900 },
  storeLabel: { ...typography.caption, color: palette.ink500 },
});
