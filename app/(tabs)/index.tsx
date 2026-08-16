/**
 * Home.
 *
 * The demo greeted "Hi, Firsa" — a name in the source — above an "Exclusive
 * Offers / 50% OFF / Claim" card with no handler, then a hardcoded array of
 * four games with a "Play!" button that did nothing. Three of the four games
 * did not exist.
 *
 * What replaces it is the one screen where the adaptive engine becomes visible:
 * a recommendation, and a plain sentence saying *why* it was chosen. The reason
 * is not decoration. A system that tells a student what to do next without
 * saying why is asking to be trusted on nothing (P3), and it is the same claim
 * the teacher dashboard has to be able to answer.
 *
 * There is no discount card. The product has no paid tier a student can buy,
 * and a fake one on the first screen a child sees is not a placeholder, it is a
 * dark pattern rehearsal.
 */

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
	Pressable,
	RefreshControl,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { activeAccountId } from '@/src/data/cache/storage';
import {
	useBootstrap,
	useRecommendations,
	type Recommendation,
} from '@/src/data/queries/hooks';
import { pendingCount } from '@/src/data/outbox/queue';
import {
	EmptyState,
	ErrorState,
	LoadingState,
	OfflineNotice,
} from '@/src/ui/components/ScreenState';
import {
	MIN_TOUCH_TARGET,
	domainColors,
	palette,
	radius,
	spacing,
	typography,
} from '@/src/ui/tokens';

/** `algo.iteration` → `algorithms`, so a node maps to its domain colour. */
function domainOf(skillNodeId: string): keyof typeof domainColors {
	if (skillNodeId.startsWith('comp.')) return 'computation';
	if (skillNodeId.startsWith('sec.')) return 'security';
	return 'algorithms';
}

export default function HomeScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const accountId = activeAccountId();

	const bootstrap = useBootstrap(accountId);
	const recommendations = useRecommendations(accountId);
	const pending = accountId ? pendingCount(accountId) : 0;

	const openMission = useCallback(
		(missionId: string) => router.push(`/play/${missionId}`),
		[router],
	);

	const primary = recommendations.data?.primary ?? null;
	const alternatives: Recommendation[] = recommendations.data?.alternatives ?? [];
	const assignment = recommendations.data?.assignment ?? null;
	const summary = bootstrap.data?.summary;

	if (bootstrap.isLoading && !bootstrap.data) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<LoadingState />
			</SafeAreaView>
		);
	}

	if (bootstrap.isError && !bootstrap.data) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<ErrorState onRetry={() => bootstrap.refetch()} />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<OfflineNotice pending={pending} syncing={false} />

			<ScrollView
				contentContainerStyle={styles.container}
				refreshControl={
					<RefreshControl
						refreshing={recommendations.isRefetching}
						onRefresh={() => {
							void bootstrap.refetch();
							void recommendations.refetch();
						}}
					/>
				}
			>
				<View style={styles.header}>
					<Text style={styles.greeting}>
						{t('home.greeting', { name: bootstrap.data?.profile.displayName ?? '' })}
					</Text>
				</View>

				{summary ? (
					<View style={styles.summaryRow}>
						<View style={styles.summaryItem}>
							<Text style={styles.summaryValue}>{summary.points}</Text>
							<Text style={styles.summaryLabel}>{t('profile.points')}</Text>
						</View>
						<View style={styles.summaryDivider} />
						<View style={styles.summaryItem}>
							<Text style={styles.summaryValue}>{summary.streakDays}</Text>
							<Text style={styles.summaryLabel}>
								{t('home.streak', { count: summary.streakDays })}
							</Text>
						</View>
					</View>
				) : null}

				{/*
					A teacher's assignment outranks the engine's pick. The engine
					makes a recommendation; a teacher has made a decision.
				*/}
				{assignment ? (
					<Pressable
						accessibilityRole="button"
						style={styles.assignmentCard}
						onPress={() => openMission(assignment.targetId)}
					>
						<Text style={styles.assignmentLabel}>{t('home.assignmentFromTeacher')}</Text>
						<Text style={styles.assignmentTarget}>{assignment.targetId}</Text>
						{assignment.note ? <Text style={styles.assignmentNote}>{assignment.note}</Text> : null}
					</Pressable>
				) : null}

				<Text style={styles.sectionTitle}>{t('home.recommendedForYou')}</Text>

				{recommendations.isLoading && !primary ? (
					<LoadingState />
				) : !primary ? (
					<EmptyState title={t('home.emptyTitle')} body={t('home.emptyBody')} />
				) : (
					<>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`${primary.missionId}. ${t(primary.displayReasonKey)}`}
							style={styles.primaryCard}
							onPress={() => openMission(primary.missionId)}
						>
							<View style={styles.primaryTop}>
								<Text style={styles.primaryTitle}>{primary.missionId}</Text>
								<DomainTag node={primary.primarySkillNodeId} />
							</View>
							{/*
								The "why". A student who is told what to play next and
								not why has been given an instruction, not an
								explanation — and the same sentence is what a teacher
								sees when they ask the dashboard the same question.
							*/}
							<Text style={styles.reason}>{t(primary.displayReasonKey)}</Text>
							<View style={styles.playButton}>
								<Text style={styles.playButtonText}>{t('games.play')}</Text>
							</View>
						</Pressable>

						{alternatives.map((item) => (
							<Pressable
								key={item.missionId}
								accessibilityRole="button"
								style={styles.altCard}
								onPress={() => openMission(item.missionId)}
							>
								<View style={styles.altInfo}>
									<Text style={styles.altTitle}>{item.missionId}</Text>
									<Text style={styles.altReason}>{t(item.displayReasonKey)}</Text>
								</View>
								<DomainTag node={item.primarySkillNodeId} />
							</Pressable>
						))}
					</>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

function DomainTag({ node }: { node: string }) {
	const { t } = useTranslation();
	const domain = domainOf(node);
	const colors = domainColors[domain];

	return (
		<View style={[styles.tag, { backgroundColor: colors.bg }]}>
			{/* Colour is never the only channel — the label carries the same
			    information for a colour-blind student on a cheap panel. */}
			<Text style={[styles.tagText, { color: colors.fg }]}>
				{t(`progress.domain.${domain}`)}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: palette.canvas },
	container: { padding: spacing.lg, gap: spacing.lg },
	header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	greeting: { ...typography.title, color: palette.ink900 },

	summaryRow: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: palette.surface,
		borderRadius: radius.lg,
		paddingVertical: spacing.lg,
	},
	summaryItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
	summaryValue: { ...typography.display, color: palette.blue600 },
	summaryLabel: { ...typography.caption, color: palette.ink500 },
	summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: palette.ink100 },

	sectionTitle: { ...typography.heading, color: palette.ink900 },

	assignmentCard: {
		backgroundColor: palette.orange100,
		borderRadius: radius.lg,
		padding: spacing.lg,
		gap: spacing.xs,
		minHeight: MIN_TOUCH_TARGET,
	},
	assignmentLabel: { ...typography.caption, color: palette.orange600, fontWeight: '700' },
	assignmentTarget: { ...typography.heading, color: palette.ink900 },
	assignmentNote: { ...typography.body, color: palette.ink700 },

	primaryCard: {
		backgroundColor: palette.surface,
		borderRadius: radius.lg,
		padding: spacing.lg,
		gap: spacing.md,
	},
	primaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
	primaryTitle: { ...typography.heading, color: palette.ink900, flexShrink: 1 },
	reason: { ...typography.body, color: palette.ink700 },
	playButton: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.blue600,
		borderRadius: radius.md,
		alignItems: 'center',
		justifyContent: 'center',
	},
	playButtonText: { ...typography.label, color: palette.surface },

	altCard: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.md,
		backgroundColor: palette.surface,
		borderRadius: radius.md,
		padding: spacing.lg,
		minHeight: MIN_TOUCH_TARGET,
	},
	altInfo: { flex: 1, gap: spacing.xs },
	altTitle: { ...typography.label, color: palette.ink900 },
	altReason: { ...typography.caption, color: palette.ink500 },

	tag: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
	tagText: { ...typography.caption, fontWeight: '700' },
});
