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
import { rowOf, storeOf } from '@lenterra/core';

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '@/src/ui/tokens';
import { skinFor } from '../skins';

export interface CongklakBoardProps {
  state: CongklakState;
  onPitPress: (pit: number) => void;
  /** Pits the student may currently sow. */
  legalPits: number[];
  disabled?: boolean;
  /** Highlighted while an animation is passing through it. */
  activePit?: number | null;
  /**
   * A board skin the student has equipped, e.g. `congklak.kayu`.
   *
   * Repaints surfaces only. The legal-move and active borders are deliberately
   * left alone by every skin — they carry meaning no colour duplicates, and a
   * board where a playable pit is indistinguishable from an empty one would be
   * a cosmetic that changes play.
   */
  skin?: string | null;
}

export function CongklakBoard({
  state,
  onPitPress,
  legalPits,
  disabled = false,
  activePit = null,
  skin = null,
}: CongklakBoardProps) {
  const { t } = useTranslation();
  const paint = skinFor('congklak', skin);

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
  }, [state]);

  const playerRow = useMemo(() => {
    const row = rowOf(state, state.playerSide);
    const indices: number[] = [];
    for (let i = row.from; i <= row.to; i++) indices.push(i);
    return indices;
  }, [state]);

  return (
    <View style={[styles.board, { backgroundColor: paint.board }]}>
      <View style={styles.rowArea}>
        {opponentRow.map((index) => (
          <Pit
            key={index}
            index={index}
            seeds={state.pits[index] ?? 0}
            active={activePit === index}
            side="opponent"
            fill={paint.opponent}
          />
        ))}
      </View>

      <View style={styles.middle}>
        <Store
          seeds={state.pits[opponentStore] ?? 0}
          label={t('congklak.store')}
          fill={paint.opponent}
        />
        <View style={styles.spacer} />
        <Store
          seeds={state.pits[playerStore] ?? 0}
          label={t('congklak.store')}
          fill={paint.accent}
        />
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
              fill={paint.own}
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
  fill,
}: {
  index: number;
  seeds: number;
  side: 'player' | 'opponent';
  legal?: boolean;
  testID?: string;
  active?: boolean;
  onPress?: () => void;
  fill: string;
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
        { backgroundColor: fill },
        // After the fill, never before: legality and activity are the two things
        // a skin must not be able to repaint away.
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
  fill,
}: {
  seeds: number;
  label: string;
  fill: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${seeds}`}
      style={[styles.store, { backgroundColor: fill }]}
    >
      <Text style={styles.storeCount}>{seeds}</Text>
      <Text style={styles.storeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  // A playable pit is marked by a border as well as a fill, so the affordance
  // survives a colour-blind student and a washed-out panel in daylight.
  pitLegal: { borderColor: palette.blue600 },
  pitActive: { borderColor: palette.orange600, borderWidth: 3 },
  pitCount: { ...typography.heading, color: palette.ink900 },

  store: {
    minWidth: MIN_TOUCH_TARGET + spacing.lg,
    minHeight: MIN_TOUCH_TARGET + spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  storeCount: { ...typography.display, color: palette.ink900 },
  storeLabel: { ...typography.caption, color: palette.ink500 },
});
