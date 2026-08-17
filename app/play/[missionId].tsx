/**
 * The play surface.
 *
 * Full-screen, and completely offline. No code path here awaits the network
 * (TRD-APP-003): the mission comes from the cached catalog, the rules come from
 * `@lenterra/core`, the opponent is deterministic, and the result goes to the
 * outbox. A student on a bus with no signal plays a whole mission and sees a
 * real result at the end of it.
 *
 * That result is marked pending until the server confirms it. It is not a
 * guess — it is the same computation the server will perform, done earlier.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useTranslation } from 'react-i18next';

import type { BentengState, CongklakMove, CongklakState, Mission } from '@lenterra/core';

import { activeAccountId } from '@/src/data/cache/storage';
import { currentCatalogVersion, findMission } from '@/src/data/cache/catalog';
import { useBootstrap } from '@/src/data/queries/hooks';
import { usePlaySession, type PlayResult } from '@/src/features/play/usePlaySession';
import { boardSkinOf } from '@/src/features/rewards/wardrobe';
import { BentengBoard } from '@/src/game/renderer/benteng/Board';
import { CongklakBoard } from '@/src/game/renderer/congklak/Board';
import { EmptyState } from '@/src/ui/components/ScreenState';
import {
	MIN_TOUCH_TARGET,
	palette,
	radius,
	spacing,
	typography,
} from '@/src/ui/tokens';

export default function PlayScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const { missionId } = useLocalSearchParams<{ missionId: string }>();
	const accountId = activeAccountId();

	const found = accountId && missionId ? findMission(accountId, missionId) : null;
	const catalogVersion = accountId ? currentCatalogVersion(accountId) : null;

	// Read from the cached bootstrap rather than fetched here: the board must
	// draw at the same moment offline as online, and a skin that arrives a
	// second late would repaint the board under a student mid-move.
	const bootstrap = useBootstrap(accountId);
	const equippedSkin = bootstrap.data?.profile.equipped.boardSkin ?? null;

	const [result, setResult] = useState<PlayResult | null>(null);
	// Null until the student has chosen. Hot-seat is never assumed: a mission
	// started in the wrong mode either scores a friend's play as the student's
	// or takes a friend's turns away.
	const [mode, setMode] = useState<'solo' | 'hotseat' | null>(null);
	const onFinished = useCallback((r: PlayResult) => setResult(r), []);

	// Landscape for the duration, portrait on the way out. The
	// board is a wide 2×n grid; in portrait the pits are either unreadable or
	// too small to hit reliably. Unlocking in the cleanup rather than on unmount
	// of a child means backing out mid-mission still restores the app.
	useEffect(() => {
		void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
		return () => {
			void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
		};
	}, []);

	if (!accountId || !found || !catalogVersion) {
		// The catalog has not been pulled, or this mission is not in it. Not an
		// error the student caused, and not one they can fix by retrying here.
		return (
			<SafeAreaView style={styles.screen}>
				<EmptyState title={t('error.catalogStale')} body={t('error.offline')} />
				<Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.back()}>
					<Text style={styles.secondaryLabel}>{t('common.back')}</Text>
				</Pressable>
			</SafeAreaView>
		);
	}

	if (mode === null) {
		return <ModeChooser onChoose={setMode} onLeave={() => router.back()} />;
	}

	return (
		<PlaySurface
			accountId={accountId}
			mission={found.mission}
			catalogVersion={found.catalogVersion}
			twoPlayer={mode === 'hotseat'}
			equippedSkin={equippedSkin}
			result={result}
			onFinished={onFinished}
			onLeave={() => router.back()}
		/>
	);
}

/**
 * Solo or two-player, chosen before the board appears.
 *
 * Congklak and Benteng are social games; two students on one handset is how
 * they are actually played, and it is the only multiplayer R1 has. What the
 * choice buys is honesty about the record: in hot-seat only the account
 * holder's own moves feed the model, the guest is never identified or given an
 * account, and the attempt is marked shared so its evidence counts for less
 * (TRD-MP-002).
 */
function ModeChooser({
	onChoose,
	onLeave,
}: {
	onChoose: (mode: 'solo' | 'hotseat') => void;
	onLeave: () => void;
}) {
	const { t } = useTranslation();

	return (
		<SafeAreaView testID="play-mode-chooser" style={styles.screen}>
			<ScrollView contentContainerStyle={styles.chooserBody}>
				<Text style={styles.chooserTitle}>{t('play.chooseMode')}</Text>

				<Pressable
					testID="play-mode-solo"
					accessibilityRole="button"
					style={styles.modeCard}
					onPress={() => onChoose('solo')}
				>
					<Text style={styles.modeTitle}>{t('play.modeSolo')}</Text>
					<Text style={styles.modeBody}>{t('play.modeSoloBody')}</Text>
				</Pressable>

				<Pressable
					accessibilityRole="button"
					testID="play-mode-hotseat"
					style={styles.modeCard}
					onPress={() => onChoose('hotseat')}
				>
					<Text style={styles.modeTitle}>{t('play.modeHotseat')}</Text>
					<Text style={styles.modeBody}>{t('play.modeHotseatBody')}</Text>
					{/* Said before they choose, not discovered afterwards. */}
					<Text style={styles.modeNote}>{t('play.modeHotseatNote')}</Text>
				</Pressable>

				<Pressable accessibilityRole="button" style={styles.secondary} onPress={onLeave}>
					<Text style={styles.secondaryLabel}>{t('common.back')}</Text>
				</Pressable>
			</ScrollView>
		</SafeAreaView>
	);
}

function PlaySurface({
	accountId,
	mission,
	catalogVersion,
	twoPlayer,
	equippedSkin,
	result,
	onFinished,
	onLeave,
}: {
	accountId: string;
	mission: Mission;
	catalogVersion: string;
	twoPlayer: boolean;
	/** Settled before play begins, so the board cannot repaint mid-move. */
	equippedSkin: string | null;
	result: PlayResult | null;
	onFinished: (result: PlayResult) => void;
	onLeave: () => void;
}) {
	const { t } = useTranslation();

	const session = usePlaySession({ accountId, mission, catalogVersion, twoPlayer, onFinished });
	// Which unit the student has picked up. Benteng only — Congklak has no
	// two-step move, and giving it one would add a tap for nothing.
	const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

	const state = session.state as (CongklakState | BentengState) | null;

	if (!state) {
		return (
			<SafeAreaView style={styles.screen}>
				<EmptyState title={t('common.loading')} body="" />
			</SafeAreaView>
		);
	}

	if (result) {
		return (
			<SafeAreaView testID="result-screen" style={styles.screen}>
				<ScrollView contentContainerStyle={styles.resultBody}>
					<Text style={styles.resultTitle}>
						{result.outcome === 'success' ? t('result.success') : t('result.failure')}
					</Text>

					{/*
						The result is provisional until the server has re-executed the
						replay. Saying so is not a caveat — an unmarked provisional
						number that later changes reads as the system cheating.
					*/}
					<Text testID="result-pending-sync" style={styles.pending}>
						{t('result.pendingSync')}
					</Text>

					{result.outcome !== 'success' ? (
						<Text style={styles.diagnostic}>
							{t(Object.values(mission.failureKeys ?? {})[0] ?? 'result.failure')}
						</Text>
					) : null}

					<Pressable
						testID="result-continue"
						accessibilityRole="button"
						style={styles.primary}
						onPress={onLeave}
					>
						<Text style={styles.primaryLabel}>{t('result.nextMission')}</Text>
					</Pressable>
				</ScrollView>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView testID="play-screen" style={styles.screen}>
			<View style={styles.header}>
				<Pressable accessibilityRole="button" onPress={onLeave} hitSlop={12}>
					<Text style={styles.leave}>{t('play.quit')}</Text>
				</Pressable>
				{/*
					Whose turn it is, said in the mode's own words. "Opponent's
					turn" is accurate against the machine and useless when the
					opponent is the person sitting next to you — two students in a
					noisy classroom will move on each other's turn, and a move made
					by the wrong person cannot be taken back (TRD-MP-001).
				*/}
				<Text
					accessibilityRole="header"
					style={[styles.turn, session.seatToMove === 'guest' && styles.turnGuest]}
				>
					{session.seatToMove === 'you'
						? t('play.yourTurn')
						: session.seatToMove === 'guest'
							? t('play.guestTurn')
							: t('play.opponentTurn')}
				</Text>
			</View>

			<Text style={styles.brief}>{t(mission.briefKey)}</Text>

			{mission.game === 'benteng' ? (
				<BentengBoard
					state={state as BentengState}
					selectedUnitId={selectedUnitId}
					onSelectUnit={setSelectedUnitId}
					onMove={(unitId, x, y) => {
						setSelectedUnitId(null);
						session.play({ kind: 'move', unitId, x, y });
					}}
					legalTargets={session.legalMoves as { unitId: string; x: number; y: number }[]}
					disabled={session.animating || session.seatToMove === 'machine'}
					skin={boardSkinOf(accountId, equippedSkin, 'benteng')}
				/>
			) : (
				<CongklakBoard
					state={state as CongklakState}
					legalPits={(session.legalMoves as CongklakMove[])
						.filter((move) => move.kind === 'sow')
						.map((move) => move.pit)}
					disabled={session.animating || session.seatToMove === 'machine'}
					onPitPress={(pit) => session.play({ kind: 'sow', pit })}
					skin={boardSkinOf(accountId, equippedSkin, 'congklak')}
				/>
			)}

			{/*
				One tap finishes the animation. This is only safe because the
				logical state was already correct before the first frame — the
				animation is a replay of events that have happened.
			*/}
			{session.animating ? (
				<Pressable
					testID="skip-animation"
					accessibilityRole="button"
					style={styles.skip}
					onPress={session.skipAnimation}
				>
					<Text style={styles.skipLabel}>{t('play.skipAnimation')}</Text>
				</Pressable>
			) : null}

			{session.rejection ? (
				<Text accessibilityRole="alert" style={styles.rejection}>
					{t(session.rejection.reason, session.rejection.detail ?? {})}
				</Text>
			) : null}

			{session.hintShown ? (
				<Text style={styles.hint}>{t(mission.hintKeys?.[0] ?? 'play.hintNotAnswer')}</Text>
			) : (
				<Pressable accessibilityRole="button" style={styles.secondary} onPress={session.offerHint}>
					<Text style={styles.secondaryLabel}>{t('play.hintOffer')}</Text>
				</Pressable>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: palette.canvas, padding: spacing.lg, gap: spacing.md },
	header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	leave: { ...typography.label, color: palette.ink500 },
	turn: { ...typography.label, color: palette.blue700 },
	turnGuest: { color: palette.orange600 },

	chooserBody: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
	chooserTitle: { ...typography.title, color: palette.ink900, textAlign: 'center' },
	modeCard: {
		backgroundColor: palette.surface,
		borderRadius: radius.lg,
		padding: spacing.lg,
		gap: spacing.xs,
		minHeight: MIN_TOUCH_TARGET,
	},
	modeTitle: { ...typography.heading, color: palette.ink900 },
	modeBody: { ...typography.body, color: palette.ink700 },
	modeNote: { ...typography.caption, color: palette.ink500 },
	brief: { ...typography.body, color: palette.ink700 },
	skip: { minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
	skipLabel: { ...typography.caption, color: palette.ink500 },
	rejection: { ...typography.body, color: palette.danger600 },
	hint: { ...typography.body, color: palette.warning600 },

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

	resultBody: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
	resultTitle: { ...typography.display, color: palette.ink900 },
	pending: { ...typography.caption, color: palette.warning600 },
	diagnostic: { ...typography.body, color: palette.ink700, textAlign: 'center' },
});
