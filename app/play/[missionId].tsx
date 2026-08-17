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
	AppState,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useTranslation } from 'react-i18next';

import type { CongklakMove, CongklakState, Mission } from '@lenterra/core';

import { activeAccountId } from '@/src/data/cache/storage';
import { currentCatalogVersion, findMission } from '@/src/data/cache/catalog';
import { usePlaySession, type PlayResult } from '@/src/features/play/usePlaySession';
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

	const [result, setResult] = useState<PlayResult | null>(null);
	const onFinished = useCallback((r: PlayResult) => setResult(r), []);

	// Landscape for the duration, portrait on the way out (PRD-APP-023). The
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

	return (
		<PlaySurface
			accountId={accountId}
			mission={found.mission}
			catalogVersion={found.catalogVersion}
			result={result}
			onFinished={onFinished}
			onLeave={() => router.back()}
		/>
	);
}

function PlaySurface({
	accountId,
	mission,
	catalogVersion,
	result,
	onFinished,
	onLeave,
}: {
	accountId: string;
	mission: Mission;
	catalogVersion: string;
	result: PlayResult | null;
	onFinished: (result: PlayResult) => void;
	onLeave: () => void;
}) {
	const { t } = useTranslation();

	const session = usePlaySession({ accountId, mission, catalogVersion, onFinished });
	const state = session.state as CongklakState | null;

	const legalPits = (session.legalMoves as CongklakMove[])
		.filter((move) => move.kind === 'sow')
		.map((move) => move.pit);

	if (!state) {
		return (
			<SafeAreaView style={styles.screen}>
				<EmptyState title={t('common.loading')} body="" />
			</SafeAreaView>
		);
	}

	if (result) {
		return (
			<SafeAreaView style={styles.screen}>
				<ScrollView contentContainerStyle={styles.resultBody}>
					<Text style={styles.resultTitle}>
						{result.outcome === 'success' ? t('result.success') : t('result.failure')}
					</Text>

					{/*
						The result is provisional until the server has re-executed the
						replay. Saying so is not a caveat — an unmarked provisional
						number that later changes reads as the system cheating.
					*/}
					<Text style={styles.pending}>{t('result.pendingSync')}</Text>

					{result.outcome !== 'success' ? (
						<Text style={styles.diagnostic}>
							{t(Object.values(mission.failureKeys ?? {})[0] ?? 'result.failure')}
						</Text>
					) : null}

					<Pressable accessibilityRole="button" style={styles.primary} onPress={onLeave}>
						<Text style={styles.primaryLabel}>{t('result.nextMission')}</Text>
					</Pressable>
				</ScrollView>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.header}>
				<Pressable accessibilityRole="button" onPress={onLeave} hitSlop={12}>
					<Text style={styles.leave}>{t('play.quit')}</Text>
				</Pressable>
				<Text style={styles.turn}>
					{state.toMove === state.playerSide ? t('play.yourTurn') : t('play.opponentTurn')}
				</Text>
			</View>

			<Text style={styles.brief}>{t(mission.briefKey)}</Text>

			<CongklakBoard
				state={state}
				legalPits={legalPits}
				disabled={session.animating || state.toMove !== state.playerSide}
				onPitPress={(pit) => session.play({ kind: 'sow', pit })}
			/>

			{/*
				One tap finishes the animation. This is only safe because the
				logical state was already correct before the first frame — the
				animation is a replay of events that have happened.
			*/}
			{session.animating ? (
				<Pressable accessibilityRole="button" style={styles.skip} onPress={session.skipAnimation}>
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
	turn: { ...typography.label, color: palette.blue600 },
	brief: { ...typography.body, color: palette.ink700 },
	skip: { minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
	skipLabel: { ...typography.caption, color: palette.ink500 },
	rejection: { ...typography.body, color: palette.danger600 },
	hint: { ...typography.body, color: palette.warning600 },

	primary: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.blue600,
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
	secondaryLabel: { ...typography.label, color: palette.blue600 },

	resultBody: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
	resultTitle: { ...typography.display, color: palette.ink900 },
	pending: { ...typography.caption, color: palette.warning600 },
	diagnostic: { ...typography.body, color: palette.ink700, textAlign: 'center' },
});
