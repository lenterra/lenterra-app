/**
 * The leaderboard.
 *
 * Every name, point total and rank on this screen used to be a string literal:
 * a `topThree` array with "Faiz 43", "You 40", "Nadya 38", and a bundled photo
 * per person. It also contradicted the profile tab, which claimed the same
 * student was rank #3 with 40 points while this screen put them at #2 — two
 * screens inventing different numbers for one student.
 *
 * Three things this screen has to be honest about:
 *
 *  - **Points, never mastery.** Ranking children by inferred ability is a
 *    different and more harmful product (10-03).
 *  - **When the data is from.** A cached board shown offline must say so, or a
 *    student reads a stale standing as current (PRD-APP-032).
 *  - **When a teacher has switched it off.** Not an empty board, which looks
 *    like nobody has played.
 */

import { useMemo } from 'react';
import {
	RefreshControl,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { activeAccountId } from '@/src/data/cache/storage';
import { useLeaderboard, type LeaderboardEntry } from '@/src/data/queries/hooks';
import { RpcError } from '@/src/data/nakama/rpc';
import { Avatar } from '@/src/ui/components/Avatar';
import {
	EmptyState,
	ErrorState,
	LoadingState,
} from '@/src/ui/components/ScreenState';
import { palette, radius, spacing, typography } from '@/src/ui/tokens';

export default function BoardScreen() {
	const { t } = useTranslation();
	const accountId = activeAccountId();
	const board = useLeaderboard(accountId, 'class', 'week');

	const entries: LeaderboardEntry[] = board.data?.entries ?? [];
	const podium = useMemo(() => entries.slice(0, 3), [entries]);
	const rest = useMemo(() => entries.slice(3), [entries]);

	// A teacher turning the board off is a deliberate state with its own
	// message, not an error and not an empty list.
	if (board.error instanceof RpcError && board.error.code === 'FORBIDDEN') {
		return (
			<SafeAreaView style={styles.container}>
				<EmptyState title={t('board.title')} body={t('board.disabled')} />
			</SafeAreaView>
		);
	}

	// Only show a spinner when there is genuinely nothing to show. With cached
	// data the board renders and refreshes behind it.
	if (board.isLoading && entries.length === 0) {
		return (
			<SafeAreaView style={styles.container}>
				<LoadingState />
			</SafeAreaView>
		);
	}

	if (board.isError && entries.length === 0) {
		return (
			<SafeAreaView style={styles.container}>
				<ErrorState
					onRetry={() => board.refetch()}
					message={
						board.error instanceof RpcError && board.error.code === 'OFFLINE'
							? t('error.offline')
							: undefined
					}
				/>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar style="auto" />
			<ScrollView
				contentContainerStyle={styles.scrollView}
				refreshControl={
					<RefreshControl refreshing={board.isRefetching} onRefresh={() => board.refetch()} />
				}
			>
				<View style={styles.header}>
					<Text style={styles.headerTitle}>{t('board.title')}</Text>
					<Text style={styles.period}>{t('board.thisWeek')}</Text>
				</View>

				{entries.length === 0 ? (
					<EmptyState title={t('board.emptyTitle')} body={t('board.emptyBody')} />
				) : (
					<>
						<View style={styles.podium}>
							{podium.map((entry) => (
								<View key={entry.userId} style={styles.podiumItem}>
									<Avatar name={entry.displayName} size={entry.rank === 1 ? 64 : 52} highlighted={entry.isSelf} />
									<Text style={styles.podiumRank}>{entry.rank}</Text>
									<Text numberOfLines={1} style={styles.podiumName}>
										{entry.isSelf ? t('board.you') : entry.displayName}
									</Text>
									<Text style={styles.podiumPoints}>
										{t('home.points', { count: entry.points })}
									</Text>
								</View>
							))}
						</View>

						<View style={styles.list}>
							{rest.map((entry) => (
								<View
									key={entry.userId}
									style={[styles.row, entry.isSelf && styles.rowSelf]}
								>
									<Text style={styles.rowRank}>{entry.rank}</Text>
									<Avatar name={entry.displayName} size={36} highlighted={entry.isSelf} />
									<Text numberOfLines={1} style={styles.rowName}>
										{entry.isSelf ? t('board.you') : entry.displayName}
									</Text>
									<Text style={styles.rowPoints}>{entry.points}</Text>
								</View>
							))}
						</View>
					</>
				)}

				{/*
					A cached board looks identical to a live one, so it has to say
					when it was generated. Without this a student on a bus reads a
					three-day-old standing as this morning's.
				*/}
				{board.data?.generatedAt ? (
					<Text style={styles.asOf}>
						{t('board.asOf', { time: new Date(board.data.generatedAt).toLocaleString() })}
					</Text>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: palette.canvas },
	scrollView: { padding: spacing.lg, gap: spacing.lg },
	header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
	headerTitle: { ...typography.title, color: palette.ink900 },
	period: { ...typography.caption, color: palette.ink500 },
	podium: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'flex-end',
		backgroundColor: palette.surface,
		borderRadius: radius.lg,
		padding: spacing.lg,
		gap: spacing.sm,
	},
	podiumItem: { alignItems: 'center', gap: spacing.xs, flex: 1 },
	podiumRank: { ...typography.heading, color: palette.blue600 },
	podiumName: { ...typography.label, color: palette.ink900, maxWidth: 96, textAlign: 'center' },
	podiumPoints: { ...typography.caption, color: palette.ink500 },
	list: { backgroundColor: palette.surface, borderRadius: radius.lg, overflow: 'hidden' },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: palette.ink100,
	},
	rowSelf: { backgroundColor: palette.blue050 },
	rowRank: { ...typography.label, color: palette.ink500, width: 24 },
	rowName: { ...typography.body, color: palette.ink900, flex: 1 },
	rowPoints: { ...typography.label, color: palette.ink700 },
	asOf: { ...typography.caption, color: palette.ink300, textAlign: 'center' },
});
