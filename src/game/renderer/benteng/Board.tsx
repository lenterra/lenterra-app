/**
 * The Benteng board.
 *
 * Rendering only — the rules live in `@lenterra/core`, which the server runs
 * too, so there is one implementation of what a move does.
 *
 * **Freshness is the whole game** (PRD-GAME-013). A unit may capture another
 * only if its own freshness is strictly lower, so a student who misreads the
 * numbers is not making a strategic mistake, they are playing a different game.
 * Three things follow, and none of them is decoration:
 *
 *  - Every unit shows its freshness **as a number**, always, not on tap.
 *  - The number a student reads is the number the rule uses — it comes from
 *    `unitFreshness` in the core rather than being recomputed here, because a
 *    second implementation is how a UI ends up showing 3 for a unit the engine
 *    treats as 4.
 *  - Selecting a unit marks which enemies it can *actually* take. Working that
 *    out is the skill; hiding it behind a rejected move is a buzzer, not a
 *    lesson (PRD-GAME-012).
 *
 * Prisoners are drawn at the captor's base rather than removed, because
 * "captured" has to look like a place a unit can be rescued from (PRD-GAME-014).
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { BentengState, BentengUnit } from '@lenterra/core';
import { activeUnits, freshnessOf, unitFreshness } from '@lenterra/core';

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '@/src/ui/tokens';
import { skinFor } from '../skins';

export interface BentengBoardProps {
  state: BentengState;
  /** The unit the student has picked up, if any. */
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string | null) => void;
  onMove: (unitId: string, x: number, y: number) => void;
  legalTargets: { unitId: string; x: number; y: number }[];
  /**
   * Which side the person holding the phone may move.
   *
   * Not always the student's own: in hot-seat the guest takes the other side on
   * the same screen, and a board that only ever lets you touch `playerSide`
   * would make their turn unplayable (TRD-MP-001).
   */
  controllableSide?: 1 | 2;
  disabled?: boolean;
  /**
   * A board skin the student has equipped, e.g. `benteng.pasir`.
   *
   * Repaints the grid, the empty squares, and the two bases. It deliberately
   * cannot touch the units: which side a piece belongs to, whether it is
   * selected, and whether it can be captured are all carried by colour, and a
   * skin free to repaint them would be a cosmetic that changes play.
   */
  skin?: string | null;
}

export function BentengBoard({
  state,
  selectedUnitId,
  onSelectUnit,
  onMove,
  legalTargets,
  controllableSide,
  disabled = false,
  skin = null,
}: BentengBoardProps) {
  const { t } = useTranslation();
  const paint = skinFor('benteng', skin);

  const cells = useMemo(() => {
    const map = new Map<string, { unit: BentengUnit | null; base: 1 | 2 | null }>();
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) map.set(`${x},${y}`, { unit: null, base: null });
    }
    for (const base of state.bases) {
      const cell = map.get(`${base.x},${base.y}`);
      if (cell) cell.base = base.team;
    }
    for (const unit of state.units) {
      if (unit.captured) continue;
      const cell = map.get(`${unit.x},${unit.y}`);
      if (cell) cell.unit = unit;
    }
    return map;
  }, [state]);

  const targetsForSelected = useMemo(
    () => legalTargets.filter((target) => target.unitId === selectedUnitId),
    [legalTargets, selectedUnitId],
  );

  /**
   * Stable handles for "a move you may make", in board order.
   *
   * Benteng needs two taps — pick a unit, then a square — so the handle is on
   * the unit while nothing is selected, and on the destination once something
   * is. The E2E flow taps `legal-move-0` twice and gets a legal move without
   * knowing any of the rules.
   */
  const movableUnitIds = useMemo(() => {
    const ids: string[] = [];
    for (const target of legalTargets) {
      if (ids.indexOf(target.unitId) < 0) ids.push(target.unitId);
    }
    return ids;
  }, [legalTargets]);

  const selected = selectedUnitId
    ? state.units.filter((unit) => unit.id === selectedUnitId)[0] ?? null
    : null;

  /**
   * Which enemies the selected unit could actually capture.
   *
   * Computed from the same comparison the rule uses, so the marks cannot
   * disagree with what the engine will accept.
   */
  const mySide = controllableSide ?? state.playerSide;

  const capturable = useMemo(() => {
    if (!selected) return new Set<string>();
    const mine = freshnessOf(state, selected);
    const enemies = activeUnits(state, selected.team === 1 ? 2 : 1);
    const out = new Set<string>();
    for (const enemy of enemies) {
      if (mine < freshnessOf(state, enemy)) out.add(enemy.id);
    }
    return out;
  }, [selected, state]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.grid, { backgroundColor: paint.board }]}>
        {Array.from({ length: state.height }, (_, y) => (
          <View key={y} style={styles.row}>
            {Array.from({ length: state.width }, (_, x) => {
              const cell = cells.get(`${x},${y}`);
              const unit = cell?.unit ?? null;
              const base = cell?.base ?? null;
              const isTarget = targetsForSelected.some((target) => target.x === x && target.y === y);
              const isSelected = unit !== null && unit.id === selectedUnitId;

              const targetIndex = isTarget
                ? targetsForSelected.findIndex((target) => target.x === x && target.y === y)
                : -1;
              const unitIndex = unit && !selectedUnitId ? movableUnitIds.indexOf(unit.id) : -1;
              const handle =
                targetIndex >= 0
                  ? `legal-move-${targetIndex}`
                  : unitIndex >= 0
                    ? `legal-move-${unitIndex}`
                    : undefined;
              const freshness = unit ? unitFreshness(state, unit.id) : null;

              const label = unit
                ? t('benteng.unitLabel', {
                    side:
                      unit.team === state.playerSide ? t('benteng.yours') : t('benteng.theirs'),
                    freshness: freshness ?? 0,
                  })
                : base
                  ? t('benteng.baseLabel', {
                      side: base === state.playerSide ? t('benteng.yours') : t('benteng.theirs'),
                    })
                  : t('benteng.emptyCell');

              return (
                <Pressable
                  key={x}
                  testID={handle}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    if (isTarget && selectedUnitId) return onMove(selectedUnitId, x, y);
                    if (unit && unit.team === mySide) {
                      return onSelectUnit(isSelected ? null : unit.id);
                    }
                    onSelectUnit(null);
                  }}
                  style={[
                    styles.cell,
                    {
                      backgroundColor:
                        base === null
                          ? paint.accent
                          : base === state.playerSide
                            ? paint.own
                            : paint.opponent,
                    },
                    // Last, so no skin can paint over the one border that says
                    // a square is reachable.
                    isTarget && styles.target,
                  ]}
                >
                  {unit ? (
                    <View
                      style={[
                        styles.unit,
                        unit.team === state.playerSide ? styles.unitOwn : styles.unitEnemy,
                        isSelected && styles.unitSelected,
                        // Marked before the move is attempted, not after it is
                        // refused. Working out who is takeable is the lesson.
                        capturable.has(unit.id) && styles.unitCapturable,
                      ]}
                    >
                      <Text style={styles.freshness}>{freshness ?? 0}</Text>
                    </View>
                  ) : base !== null ? (
                    <Text style={styles.baseMark}>⌂</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Prisoners state={state} />
    </View>
  );
}

/**
 * Held units.
 *
 * Shown as a row rather than deleted from the board, so a student can see that
 * a captured unit still exists somewhere and can be fetched back — which is
 * the entire `sec.response` lesson.
 */
function Prisoners({ state }: { state: BentengState }) {
  const { t } = useTranslation();
  const held = state.units.filter((unit) => unit.captured);
  if (held.length === 0) return null;

  const mine = held.filter((unit) => unit.team === state.playerSide);
  const theirs = held.filter((unit) => unit.team !== state.playerSide);

  return (
    <View style={styles.prisoners}>
      {mine.length > 0 ? (
        <Text style={styles.prisonerLine}>
          {t('benteng.yourPrisoners', { count: mine.length })}
        </Text>
      ) : null}
      {theirs.length > 0 ? (
        <Text style={styles.prisonerLine}>
          {t('benteng.theirPrisoners', { count: theirs.length })}
        </Text>
      ) : null}
    </View>
  );
}

const CELL = Math.max(40, MIN_TOUCH_TARGET - 8);

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm, alignItems: 'center' },
  grid: {
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: 2,
  },
  row: { flexDirection: 'row', gap: 2 },

  cell: {
    width: CELL,
    height: CELL,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A reachable square is outlined rather than tinted, so it stays visible on
  // a washed-out panel in daylight (PRD-ACC-016).
  target: { borderWidth: 2, borderColor: palette.blue600 },
  baseMark: { ...typography.body, color: palette.ink500 },

  unit: {
    width: CELL - 8,
    height: CELL - 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  unitOwn: { backgroundColor: palette.blue700 },
  unitEnemy: { backgroundColor: palette.ink500 },
  unitSelected: { borderColor: palette.ink900 },
  // Dashed, because "you could take this one" is a different kind of statement
  // from "this is selected" and the two are often on screen together.
  unitCapturable: { borderColor: palette.success600, borderStyle: 'dashed', borderWidth: 3 },

  // The number is the game. It is always on screen, never behind a tap.
  freshness: { ...typography.label, color: palette.surface, fontWeight: '700' },

  prisoners: { gap: spacing.xs, alignItems: 'center' },
  prisonerLine: { ...typography.caption, color: palette.ink500 },
});
