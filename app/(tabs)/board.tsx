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
 *    student reads a stale standing as current.
 *  - **When a teacher has switched it off.** Not an empty board, which looks
 *    like nobody has played.
 */

import { useMemo, useState } from 'react';
import {
	Pressable,
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
import {
	useClassGoal,
	useLeaderboard,
	type ClassGoal,
	type LeaderboardEntry,
} from '@/src/data/queries/hooks';
import { RpcError } from '@/src/data/nakama/rpc';
import { avatarColorOf, titleKeyOf } from '@/src/features/rewards/wardrobe';
import { Avatar } from '@/src/ui/components/Avatar';
import {
	EmptyState,
	ErrorState,
	LoadingState,
} from '@/src/ui/components/ScreenState';
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from '@/src/ui/tokens';

type Scope = 'class' | 'school';
type Period = 'week' | 'all';

const SCOPES: Scope[] = ['class', 'school'];
const PERIODS: Period[] = ['week', 'all'];

export default function BoardScreen() {
	const { t } = useTranslation();
	const accountId = activeAccountId();
	// Class and week are the defaults because they are the scope and period a
	// student can actually influence today. Regional
	// and national are deliberately absent in R1.
	const [scope, setScope] = useState<Scope>('class');
	const [period, setPeriod] = useState<Period>('week');
	const board = useLeaderboard(accountId, scope, period);
	const goal = useClassGoal(accountId);

	const entries: LeaderboardEntry[] = board.data?.entries ?? [];
	const podium = useMemo(() => entries.slice(0, 3), [entries]);
	const rest = useMemo(() => entries.slice(3), [entries]);

	// A teacher turning the board off is a deliberate state with its own
	// message, not an error and not an empty list.
	if (board.error instanceof RpcError && board.error.code === 'FORBIDDEN') {
		return (
			<SafeAreaView style={styles.container}>
				{/*
					The ranking is off; the shared goal is not. A teacher switching
					competition off should not also switch off the one mechanic where
					a stronger student gains from a weaker one improving.
				*/}
				<ClassGoalCard goal={goal.data ?? null} />
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
					{board.data ? (
						<Text style={styles.period}>
							{t('board.updatedAt', {
								time: new Date(board.data.generatedAt).toLocaleString(),
							})}
						</Text>
					) : null}
				</View>

				<ClassGoalCard goal={goal.data ?? null} />

				<View style={styles.filters}>
					<Segmented
						options={SCOPES}
						value={scope}
						onChange={setScope}
						label={(option) => t(`board.scope.${option}`)}
					/>
					<Segmented
						options={PERIODS}
						value={period}
						onChange={setPeriod}
						label={(option) => t(`board.period.${option}`)}
					/>
				</View>

				{entries.length === 0 ? (
					<EmptyState title={t('board.emptyTitle')} body={t('board.emptyBody')} />
				) : (
					<>
						<View style={styles.podium}>
							{podium.map((entry) => (
								<View key={entry.userId} style={styles.podiumItem}>
									<Avatar
										name={entry.displayName}
										size={entry.rank === 1 ? 64 : 52}
										highlighted={entry.isSelf}
										color={avatarColorOf(accountId, entry.avatarColor)}
									/>
									<Text style={styles.podiumRank}>{entry.rank}</Text>
									<Text numberOfLines={1} style={styles.podiumName}>
										{entry.isSelf ? t('board.you') : entry.displayName}
									</Text>
									<RewardTitle accountId={accountId} itemId={entry.title} />
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
									<Avatar
										name={entry.displayName}
										size={36}
										highlighted={entry.isSelf}
										color={avatarColorOf(accountId, entry.avatarColor)}
									/>
									<View style={styles.rowIdentity}>
										<Text numberOfLines={1} style={styles.rowName}>
											{entry.isSelf ? t('board.you') : entry.displayName}
										</Text>
										<RewardTitle accountId={accountId} itemId={entry.title} />
									</View>
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

/**
 * The title a student is wearing, under their name.
 *
 * Renders nothing at all when there is no title, when the catalogue on this
 * device does not know the id, or when the string is missing from the locale.
 * A row without a title must look like a row that never had one — falling back
 * to the raw id would show `title.pemikir` to a classmate, and an empty line
 * would leave a gap that reads as a rendering fault.
 */
function RewardTitle({ accountId, itemId }: { accountId: string | null; itemId: string | null }) {
	const { t } = useTranslation();
	const key = titleKeyOf(accountId, itemId);
	if (!key) return null;

	const label = t(key);
	if (label === key) return null;

	return (
		<Text numberOfLines={1} style={styles.rewardTitle}>
			{label}
		</Text>
	);
}

/**
 * A two-or-three option switch.
 *
 * Segmented rather than a dropdown: with two options a picker costs a tap to
 * discover what the choices even are, and on a low-end device the modal it
 * opens is the slowest thing on the screen.
 */
function Segmented<T extends string>({
	options,
	value,
	onChange,
	label,
}: {
	options: T[];
	value: T;
	onChange: (next: T) => void;
	label: (option: T) => string;
}) {
	return (
		<View accessibilityRole="tablist" style={styles.segmented}>
			{options.map((option) => (
				<Pressable
					key={option}
					accessibilityRole="tab"
					accessibilityState={{ selected: option === value }}
					onPress={() => onChange(option)}
					style={[styles.segment, option === value && styles.segmentActive]}
				>
					<Text style={[styles.segmentLabel, option === value && styles.segmentLabelActive]}>
						{label(option)}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

/**
 * The class's shared goal.
 *
 * The only thing on this screen that is not a ranking. Everything else here is
 * zero-sum — helping a classmate can only cost you position — and this is the
 * counterweight: a class total that moves when *anyone* reaches Proficient on a
 * skill they had not before.
 *
 * It counts skills rather than missions on purpose. Missions are what a strong
 * student can farm alone by replaying ones they have already beaten, which
 * would complete the goal without anybody else's learning moving at all.
 */
function ClassGoalCard({ goal }: { goal: ClassGoal | null }) {
	const { t } = useTranslation();
	if (!goal || goal.classId === null) return null;

	const percent = Math.round(goal.progress * 100);

	return (
		<View style={styles.goalCard}>
			<Text style={styles.goalLabel}>{t('board.classGoal')}</Text>
			<Text style={styles.goalHeadline}>
				{t('board.classGoalCount', { reached: goal.reached, target: goal.target })}
			</Text>

			<View
				accessibilityRole="progressbar"
				accessibilityLabel={t('board.classGoalCount', {
					reached: goal.reached,
					target: goal.target,
				})}
				accessibilityValue={{ min: 0, max: goal.target, now: goal.reached }}
				style={styles.goalTrack}
			>
				<View style={[styles.goalFill, { width: `${percent}%` }]} />
			</View>

			{/*
				Contributors alongside the total, because the two together say
				something neither says alone: "40 of 90, from 11 of 30 students" is
				a sentence a teacher can act on, and a bare total is not.
			*/}
			<Text style={styles.goalMeta}>
				{t('board.classGoalContributors', {
					contributors: goal.contributors,
					members: goal.memberCount,
				})}
			</Text>

			<Text style={styles.goalMine}>{t('board.classGoalMine', { count: goal.mine })}</Text>

			{goal.achieved ? <Text style={styles.goalDone}>{t('board.classGoalDone')}</Text> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	goalCard: {
		backgroundColor: palette.success100,
		borderRadius: radius.lg,
		padding: spacing.lg,
		margin: spacing.lg,
		marginBottom: 0,
		gap: spacing.xs,
	},
	goalLabel: { ...typography.caption, color: palette.success600, fontWeight: '700' },
	goalHeadline: { ...typography.heading, color: palette.ink900 },
	goalTrack: {
		height: 8,
		borderRadius: radius.pill,
		backgroundColor: palette.surface,
		marginVertical: spacing.xs,
	},
	goalFill: { height: 8, borderRadius: radius.pill, backgroundColor: palette.success600 },
	goalMeta: { ...typography.caption, color: palette.ink700 },
	goalMine: { ...typography.caption, color: palette.ink500 },
	goalDone: { ...typography.label, color: palette.success600 },

	filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
	segmented: {
		flex: 1,
		flexDirection: 'row',
		backgroundColor: palette.ink100,
		borderRadius: radius.pill,
		padding: 2,
	},
	segment: {
		flex: 1,
		minHeight: MIN_TOUCH_TARGET - 8,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: radius.pill,
	},
	segmentActive: { backgroundColor: palette.surface },
	segmentLabel: { ...typography.caption, color: palette.ink500 },
	segmentLabelActive: { color: palette.ink900, fontWeight: '700' },
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
	podiumRank: { ...typography.heading, color: palette.blue700 },
	podiumName: { ...typography.label, color: palette.ink900, maxWidth: 96, textAlign: 'center' },
	podiumPoints: { ...typography.caption, color: palette.ink500 },
	// Smaller and lighter than the name it sits under: a title is decoration a
	// student chose, and it must not compete with the one thing on the row that
	// identifies a person.
	rewardTitle: { ...typography.caption, color: palette.ink500, fontStyle: 'italic' },
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
	rowIdentity: { flex: 1, gap: 2 },
	rowName: { ...typography.body, color: palette.ink900 },
	rowPoints: { ...typography.label, color: palette.ink700 },
	asOf: { ...typography.caption, color: palette.ink300, textAlign: 'center' },
});
