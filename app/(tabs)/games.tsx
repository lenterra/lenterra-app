/**
 * The games tab.
 *
 * This file was 1,489 lines: a games grid, a detail sheet, a Congklak board
 * renderer and the Congklak *rules* interleaved with React state and timers.
 * Three things were wrong with it beyond the size.
 *
 *  - **Every card opened the same sheet.** All four `TouchableOpacity`s shared
 *    one `onPress={() => setDetails(!details)}`, so Benteng, Engklek and Gaple
 *    each opened Congklak's detail view. Three of the four were artwork.
 *  - **The rules lived here.** `distributeSeeds` drove React state one seed per
 *    200ms timer tick, which made them unusable on a server, untestable without
 *    a renderer, and impossible to verify a replay against. They now live in
 *    `@lenterra/core`, which the server runs too.
 *  - **The win condition was `newBoard[6] >= 2`** — one hardcoded check serving
 *    as the goal for every mission the product would ever have.
 *
 * What is left is a list: the games that exist, the missions in each ladder,
 * and how far the student has got. Playing happens at `play/[missionId]`.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Mission } from '@lenterra/core';

import { activeAccountId } from '@/src/data/cache/storage';
import { currentCatalogVersion, missionsFor } from '@/src/data/cache/catalog';
import { useProgress } from '@/src/data/queries/hooks';
import { useSync } from '@/src/features/sync/SyncProvider';
import { EmptyState, LoadingState } from '@/src/ui/components/ScreenState';
import {
	MIN_TOUCH_TARGET,
	palette,
	radius,
	spacing,
	typography,
} from '@/src/ui/tokens';

/** Only games with a playable engine and authored missions appear. */
const GAMES = ['congklak', 'benteng'] as const;

export default function GamesScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const accountId = activeAccountId();
	const sync = useSync();
	// Recomputed when the catalog finishes downloading: the version pointer
	// moves last, so a completed pull is exactly when this stops being null.
	const catalogVersion = useMemo(
		() => (accountId ? currentCatalogVersion(accountId) : null),
		// The trigger, not a value read above — which is why exhaustive-deps calls
		// it unnecessary and why removing it would strand this on the version the
		// device had before the download.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[accountId, sync.catalogProgress],
	);

	const progress = useProgress(accountId);

	const ladders = useMemo(() => {
		if (!accountId || !catalogVersion) return [];
		return GAMES.map((game) => ({
			game,
			missions: missionsFor(accountId, catalogVersion, game).sort((a, b) => a.rank - b.rank),
		})).filter((ladder) => ladder.missions.length > 0);
	}, [accountId, catalogVersion]);

	// No ladders has three distinct causes and they need three different
	// answers. Collapsing them into "catalog stale" told a student on their
	// first launch — the commonest case by far — that something was wrong,
	// when content was simply still arriving.
	if (ladders.length === 0) {
		if (sync.catalogProgress) {
			const { done, total } = sync.catalogProgress;
			return (
				<SafeAreaView style={styles.screen}>
					<LoadingState label={t('games.downloading', { done, total })} />
				</SafeAreaView>
			);
		}

		return (
			<SafeAreaView style={styles.screen}>
				<EmptyState
					title={t('games.title')}
					body={sync.online ? t('games.noContentYet') : t('games.noContentOffline')}
				/>
				{sync.online ? (
					<Pressable
						accessibilityRole="button"
						style={styles.download}
						onPress={() => void sync.downloadCatalogNow()}
					>
						<Text style={styles.downloadLabel}>{t('games.downloadContent')}</Text>
					</Pressable>
				) : null}
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.title}>{t('games.title')}</Text>

				{ladders.map((ladder) => (
					<Ladder
						key={ladder.game}
						game={ladder.game}
						missions={ladder.missions}
						// Highest rank the student has evidence for, +1 unlocked.
						// A recommendation is not a gate: everything at or below the
						// frontier stays playable.
						unlockedThrough={unlockedThrough(ladder.missions, progress.data?.mastery ?? [])}
						onOpen={(missionId) => router.push(`/play/${missionId}`)}
					/>
				))}
			</ScrollView>
		</SafeAreaView>
	);
}

/**
 * How far the ladder is open.
 *
 * Derived from evidence rather than stored: a student with mastery on a node
 * has demonstrably played the missions that evidence it, and deriving means
 * there is no second counter to drift out of step with the attempts.
 */
function unlockedThrough(
	missions: Mission[],
	mastery: { skillNodeId: string; evidenceCount: number }[],
): number {
	const evidenced = new Set(
		mastery.filter((entry) => entry.evidenceCount > 0).map((entry) => entry.skillNodeId),
	);

	let highest = 0;
	for (const mission of missions) {
		const nodes = Object.keys(mission.skillWeights ?? {});
		if (nodes.some((node) => evidenced.has(node))) highest = Math.max(highest, mission.rank);
	}
	// Rank 1 is always open, and one mission beyond the frontier.
	return Math.max(1, highest + 1);
}

function Ladder({
	game,
	missions,
	unlockedThrough: frontier,
	onOpen,
}: {
	game: string;
	missions: Mission[];
	unlockedThrough: number;
	onOpen: (missionId: string) => void;
}) {
	const { t } = useTranslation();
	const done = missions.filter((m) => m.rank < frontier).length;

	return (
		<View style={styles.ladder}>
			<View style={styles.ladderHeader}>
				<Text style={styles.ladderTitle}>{t(`games.${game}`)}</Text>
				<Text style={styles.ladderCount}>
					{t('games.missionCount', { done, total: missions.length })}
				</Text>
			</View>

			{missions.map((mission) => {
				const locked = mission.rank > frontier;
				return (
					<Pressable
						key={mission.id}
						accessibilityRole="button"
						accessibilityState={{ disabled: locked }}
						accessibilityLabel={`${mission.rank}. ${t(mission.titleKey)}${
							locked ? `. ${t('games.locked')}` : ''
						}`}
						disabled={locked}
						style={[styles.mission, locked && styles.missionLocked]}
						onPress={() => onOpen(mission.id)}
					>
						<Text style={styles.missionRank}>{mission.rank}</Text>
						<View style={styles.missionInfo}>
							<Text style={styles.missionTitle}>{t(mission.titleKey)}</Text>
							<Text numberOfLines={2} style={styles.missionBrief}>
								{locked ? t('games.locked') : t(mission.briefKey)}
							</Text>
						</View>
						{!locked ? <Text style={styles.play}>{t('games.play')}</Text> : null}
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: palette.canvas },
	content: { padding: spacing.lg, gap: spacing.lg },
	title: { ...typography.title, color: palette.ink900 },

	ladder: { gap: spacing.sm },
	ladderHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
	ladderTitle: { ...typography.heading, color: palette.ink900 },
	ladderCount: { ...typography.caption, color: palette.ink500 },

	mission: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.surface,
		borderRadius: radius.md,
		padding: spacing.lg,
	},
	// Locked reads as locked without relying on colour: the brief is replaced
	// by the reason, and the play affordance is absent.
	missionLocked: { opacity: 0.55 },
	missionRank: { ...typography.heading, color: palette.blue700, width: 28 },
	missionInfo: { flex: 1, gap: spacing.xs },
	missionTitle: { ...typography.label, color: palette.ink900 },
	missionBrief: { ...typography.caption, color: palette.ink500 },
	play: { ...typography.label, color: palette.blue700 },

	download: {
		minHeight: MIN_TOUCH_TARGET,
		marginHorizontal: spacing.xl,
		marginBottom: spacing.xl,
		backgroundColor: palette.blue700,
		borderRadius: radius.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	downloadLabel: { ...typography.label, color: palette.surface },
});
