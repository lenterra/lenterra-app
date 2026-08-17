/**
 * Profile.
 *
 * This file was 1,176 lines and almost none of it was true. The header showed
 * the literals `40`, `#3` and `20` for points, rank and friends; the Record tab
 * had three hardcoded progress bars; Statistics drew a fixed 40/40/20 pie over
 * a `pieChartData` constant; the Friends tab listed Justin Bieber, Rihanna and
 * Selena Gomez; the Certificates tab opened a bundled `certificate.png`; and
 * the whole screen was gated behind a wallet `ConnectButton` with eight wallet
 * options, while the four other tabs rendered regardless.
 *
 * The rank shown here also disagreed with the rank on the board tab, because
 * both were made up separately.
 *
 * Four things this establishes:
 *
 *  - **Every number comes from the server**, so the profile and the board
 *    cannot contradict each other about the same student.
 *  - **Mastery is shown as bands, never numbers** (PRD-ADPT-005). The contract
 *    does not carry a value, so the screen is structurally incapable of it.
 *  - **The identity a student shares is a friend code**, not the `0x…` wallet
 *    address the demo printed as "Your ID" (PRD-SOC-011).
 *  - **Authentication is not here.** It happens at app entry, so "signed out"
 *    means the same thing on every screen (PRD-APP-057).
 */

import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { activeAccountId, signOut } from '@/src/data/cache/storage';
import { queryKeys } from '@/src/data/queries/client';
import {
  useBootstrap,
  useCertificates,
  useFriends,
  useProgress,
  type Certificate,
  type CertificateProgress,
  type Progress,
} from '@/src/data/queries/hooks';
import {
  addFriend,
  blockUser,
  findByCode,
  removeFriend,
  reportUser,
  type Friend,
} from '@/src/data/nakama/friends';
import { rpc } from '@/src/data/nakama/rpc';
import { useSync } from '@/src/features/sync/SyncProvider';
import { Avatar } from '@/src/ui/components/Avatar';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PendingMark,
} from '@/src/ui/components/ScreenState';
import {
  MIN_TOUCH_TARGET,
  bandColors,
  domainColors,
  palette,
  radius,
  spacing,
  typography,
  type DomainName,
} from '@/src/ui/tokens';

type Tab = 'record' | 'statistics' | 'friends' | 'certificates';
const TABS: Tab[] = ['record', 'statistics', 'friends', 'certificates'];

/** Under three days of history, a chart is decoration pretending to be data. */
const MIN_WEEKS_FOR_CHART = 2;

function domainOf(skillNodeId: string): DomainName {
  if (skillNodeId.startsWith('comp.')) return 'computation';
  if (skillNodeId.startsWith('sec.')) return 'security';
  return 'algorithms';
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const accountId = activeAccountId();
  const sync = useSync();

  const bootstrap = useBootstrap(accountId);
  const progress = useProgress(accountId);
  const [tab, setTab] = useState<Tab>('record');

  if (bootstrap.isLoading && !bootstrap.data) {
    return (
      <SafeAreaView style={styles.screen}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (bootstrap.isError && !bootstrap.data) {
    return (
      <SafeAreaView style={styles.screen}>
        <ErrorState onRetry={() => bootstrap.refetch()} />
      </SafeAreaView>
    );
  }

  const profile = bootstrap.data?.profile;
  const summary = bootstrap.data?.summary;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={progress.isRefetching}
            onRefresh={() => {
              void bootstrap.refetch();
              void progress.refetch();
            }}
          />
        }
      >
        <View style={styles.header}>
          <Avatar name={profile?.displayName ?? ''} size={72} />
          <Text style={styles.name}>{profile?.displayName ?? ''}</Text>
          {bootstrap.data?.class ? (
            <Text style={styles.className}>{bootstrap.data.class.name}</Text>
          ) : null}
        </View>

        {/*
          Points, rank and friends — all three from server state, so this
          header and the board tab cannot disagree about the same student.
          The pending mark appears when unsynced attempts would change the
          number, rather than showing a figure that will silently move.
        */}
        <View style={styles.statRow}>
          <Stat
            label={t('profile.points')}
            value={summary ? String(summary.points) : '—'}
            pending={sync.pending > 0}
          />
          <Stat
            label={t('board.title')}
            value={summary?.rank != null ? `#${summary.rank}` : '—'}
          />
          <Stat label={t('profile.friends')} value={<FriendCount accountId={accountId} />} />
        </View>

        <FriendCode code={profile?.friendCode ?? ''} accountId={accountId} />

        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map((name) => (
            <Pressable
              key={name}
              testID={`profile-tab-${name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === name }}
              style={[styles.tab, tab === name && styles.tabActive]}
              onPress={() => setTab(name)}
            >
              <Text style={[styles.tabLabel, tab === name && styles.tabLabelActive]}>
                {t(`profile.tab.${name}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'record' ? <RecordTab progress={progress.data} /> : null}
        {tab === 'statistics' ? (
          <View testID="profile-statistics">
            <StatisticsTab progress={progress.data} />
          </View>
        ) : null}
        {tab === 'friends' ? <FriendsTab accountId={accountId} /> : null}
        {tab === 'certificates' ? <CertificatesTab accountId={accountId} /> : null}

        <Settings accountId={accountId} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  pending = false,
}: {
  label: string;
  value: React.ReactNode;
  pending?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
        {pending ? <PendingMark /> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FriendCount({ accountId }: { accountId: string | null }) {
  const friends = useFriends(accountId);
  return <>{friends.data ? String(friends.data.friends.length) : '—'}</>;
}

/**
 * The identifier a student shares.
 *
 * The demo printed the raw wallet address here. Under ADR-002 the address is
 * invisible plumbing: showing a `0x…` string to a 14-year-old is confusing,
 * unshareable out loud, and a privacy leak, since it is a permanent public
 * identifier that follows them off this product entirely.
 */
function FriendCode({ code, accountId }: { code: string; accountId: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rotating, setRotating] = useState(false);

  const rotate = async () => {
    if (!accountId) return;
    setRotating(true);
    try {
      await rpc(accountId, 'v1.profile.update', {
        rotateFriendCode: true,
        idempotencyKey: `rotate-${Date.now()}`,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap(accountId) });
    } catch {
      // Nothing changed; the old code still works.
    } finally {
      setRotating(false);
    }
  };

  return (
    <View style={styles.codeCard}>
      <Text style={styles.codeLabel}>{t('profile.friendCode')}</Text>
      <Text accessibilityLabel={code.split('').join(' ')} style={styles.code}>
        {code}
      </Text>
      <Text style={styles.codeHelp}>{t('profile.friendCodeHelp')}</Text>
      {/* Rotation exists because a code written on a whiteboard is a code
          that leaves the room, and a student must be able to take it back. */}
      <Pressable
        accessibilityRole="button"
        disabled={rotating}
        onPress={() => void rotate()}
        style={styles.linkButton}
      >
        <Text style={styles.linkLabel}>{t('profile.rotateFriendCode')}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

function RecordTab({ progress }: { progress: Progress | undefined }) {
  const { t } = useTranslation();

  if (!progress) return <LoadingState />;
  if (progress.games.length === 0) {
    return <EmptyState title={t('profile.noRecordTitle')} body={t('profile.noRecordBody')} />;
  }

  return (
    <View style={styles.section}>
      {progress.games.map((game) => {
        const ratio =
          game.missionsAvailable === 0 ? 0 : game.missionsCompleted / game.missionsAvailable;
        return (
          <View key={game.gameId} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{t(`games.${game.gameId}`)}</Text>
              <Text style={styles.cardMeta}>
                {t('profile.missionsOf', {
                  done: game.missionsCompleted,
                  total: game.missionsAvailable,
                })}
              </Text>
            </View>
            {/* Width reflects distinct missions passed. The demo's bars were
                fixed at 70/50/50 and moved for nobody. */}
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: game.missionsAvailable, now: game.missionsCompleted }}
              style={styles.barTrack}
            >
              <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function StatisticsTab({ progress }: { progress: Progress | undefined }) {
  const { t } = useTranslation();

  const byDomain = useMemo(() => {
    const groups: Record<DomainName, Progress['mastery']> = {
      computation: [],
      algorithms: [],
      security: [],
    };
    for (const node of progress?.mastery ?? []) groups[domainOf(node.skillNodeId)].push(node);
    return groups;
  }, [progress]);

  if (!progress) return <LoadingState />;

  const weeks = progress.weeklyActivity;
  const peak = weeks.reduce((max, week) => Math.max(max, week.attempts), 0);

  return (
    <View style={styles.section}>
      {/*
        Under two weeks of history there is no chart worth drawing. The demo
        drew the same shape for everyone including a student on day one, which
        makes the chart a decoration that looks like evidence.
      */}
      {weeks.length < MIN_WEEKS_FOR_CHART ? (
        <EmptyState title={t('profile.notEnoughDataTitle')} body={t('profile.notEnoughDataBody')} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.activity')}</Text>
          <View style={styles.chart}>
            {weeks.map((week) => (
              <View key={week.date} style={styles.chartColumn}>
                <View
                  accessibilityLabel={t('profile.weekSummary', {
                    date: week.date,
                    attempts: week.attempts,
                    minutes: week.minutes,
                  })}
                  style={[
                    styles.chartBar,
                    { height: peak === 0 ? 2 : Math.max(2, (week.attempts / peak) * 80) },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/*
        Bands per node, grouped by domain (PRD-APP-053). No percentages: the
        underlying value is a probability estimate, and asking a 14-year-old to
        interpret one invites both comparison and gaming.
      */}
      {(Object.keys(byDomain) as DomainName[]).map((domain) => {
        const nodes = byDomain[domain];
        if (nodes.length === 0) return null;
        return (
          <View key={domain} style={styles.card}>
            <View style={[styles.domainTag, { backgroundColor: domainColors[domain].bg }]}>
              <Text style={[styles.domainTagText, { color: domainColors[domain].fg }]}>
                {t(`progress.domain.${domain}`)}
              </Text>
            </View>

            {nodes.map((node) => (
              <View key={node.skillNodeId} style={styles.nodeRow}>
                <Text style={styles.nodeName}>{t(`skill.${node.skillNodeId}`)}</Text>
                <View style={styles.nodeRight}>
                  {/* The band name carries the meaning; colour only
                      reinforces it (PRD-ACC-013). */}
                  <View
                    style={[styles.bandChip, { backgroundColor: bandColors[node.band].bg }]}
                  >
                    <Text style={[styles.bandText, { color: bandColors[node.band].fg }]}>
                      {t(`progress.band.${node.band}`)}
                    </Text>
                  </View>
                  {node.evidenceCount === 1 ? (
                    <Text style={styles.thin}>{t('progress.needsSecondSource')}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

function FriendsTab({ accountId }: { accountId: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const friends = useFriends(accountId);
  const [code, setCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [subject, setSubject] = useState<Friend | null>(null);

  const refresh = () => {
    if (accountId) void queryClient.invalidateQueries({ queryKey: queryKeys.friends(accountId) });
  };

  const lookup = async (value: string) => {
    if (!accountId || value.length < 4) return;
    setLookupError(null);
    try {
      const found = await findByCode(accountId, value);
      if (!found) {
        // The server does not distinguish "no such code" from "another
        // school", so neither does this message.
        setLookupError(t('profile.friendCodeNotFound'));
        return;
      }
      await addFriend(accountId, found.userId);
      setCode('');
      refresh();
    } catch {
      setLookupError(t('error.offline'));
    }
  };

  if (friends.isLoading && !friends.data) return <LoadingState />;
  if (friends.isError && !friends.data) {
    return <ErrorState onRetry={() => friends.refetch()} />;
  }

  const lists = friends.data;

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile.addFriend')}</Text>
        <CodeInput value={code} onChange={setCode} onSubmit={() => void lookup(code)} />
        {lookupError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {lookupError}
          </Text>
        ) : null}
      </View>

      {lists && lists.incoming.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.requests')}</Text>
          {lists.incoming.map((friend: Friend) => (
            <View key={friend.userId} style={styles.friendRow}>
              <Avatar name={friend.displayName} size={36} />
              <Text style={styles.friendName}>{friend.displayName}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  accountId && void addFriend(accountId, friend.userId).then(refresh)
                }
              >
                <Text style={styles.linkLabel}>{t('common.accept')}</Text>
              </Pressable>
              {/* Refusing is as prominent as accepting. A request a child
                  cannot decline is not a request (PRD-SOC-012). */}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  accountId && void removeFriend(accountId, friend.userId).then(refresh)
                }
              >
                <Text style={styles.declineLabel}>{t('common.decline')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile.friends')}</Text>
        {!lists || lists.friends.length === 0 ? (
          <Text style={styles.muted}>{t('profile.noFriendsYet')}</Text>
        ) : (
          lists.friends.map((friend: Friend) => (
            <Pressable
              key={friend.userId}
              accessibilityRole="button"
              accessibilityLabel={friend.displayName}
              style={styles.friendRow}
              onLongPress={() => setSubject(friend)}
            >
              <Avatar name={friend.displayName} size={36} />
              <Text style={styles.friendName}>{friend.displayName}</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setSubject(friend)}
              >
                <Text style={styles.linkLabel}>{t('common.more')}</Text>
              </Pressable>
            </Pressable>
          ))
        )}
      </View>

      {lists && lists.outgoing.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.pending')}</Text>
          {lists.outgoing.map((friend: Friend) => (
            <View key={friend.userId} style={styles.friendRow}>
              <Avatar name={friend.displayName} size={36} />
              <Text style={styles.friendName}>{friend.displayName}</Text>
              <Text style={styles.muted}>{t('profile.awaitingReply')}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <SafetySheet
        friend={subject}
        accountId={accountId}
        onClose={() => setSubject(null)}
        onDone={refresh}
      />
    </View>
  );
}

/** Codes are short and typed by children, so the field is deliberately plain. */
function CodeInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.codeInputRow}>
      <TextInput
        accessibilityLabel={t('profile.friendCode')}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        onChangeText={(next: string) => onChange(next.toUpperCase())}
        onSubmitEditing={onSubmit}
        placeholder="ABC123"
        placeholderTextColor={palette.ink500}
        returnKeyType="done"
        style={styles.codeInput}
        value={value}
      />
      <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.codeSubmit}>
        <Text style={styles.codeSubmitLabel}>{t('common.add')}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Block and report.
 *
 * Offered together because a child who has been bullied should not have to
 * work out which one they wanted. Blocking protects them now; reporting is
 * what reaches an adult (PRD-SOC-014, TRD-SEC-016).
 */
function SafetySheet({
  friend,
  accountId,
  onClose,
  onDone,
}: {
  friend: Friend | null;
  accountId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  if (!friend) return null;

  const act = async (action: 'remove' | 'block' | 'report') => {
    if (!accountId) return;
    try {
      if (action === 'remove') await removeFriend(accountId, friend.userId);
      if (action === 'block') await blockUser(accountId, friend.userId);
      if (action === 'report') {
        await reportUser(accountId, friend.userId, 'bullying', 'friends');
        // Blocking follows a report automatically. Telling a child their
        // report is "being reviewed" while leaving the other person able to
        // reach them is not protection.
        await blockUser(accountId, friend.userId);
        Alert.alert(t('profile.reportSentTitle'), t('profile.reportSentBody'));
      }
      onDone();
    } finally {
      onClose();
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{friend.displayName}</Text>

          <Pressable accessibilityRole="button" style={styles.sheetItem} onPress={() => void act('remove')}>
            <Text style={styles.sheetLabel}>{t('profile.removeFriend')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.sheetItem} onPress={() => void act('block')}>
            <Text style={styles.sheetLabel}>{t('profile.block')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.sheetItem} onPress={() => void act('report')}>
            <Text style={styles.sheetDanger}>{t('profile.report')}</Text>
          </Pressable>
          <Text style={styles.sheetHelp}>{t('profile.reportHelp')}</Text>

          <Pressable accessibilityRole="button" style={styles.sheetItem} onPress={onClose}>
            <Text style={styles.sheetLabel}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

function CertificatesTab({ accountId }: { accountId: string | null }) {
  const { t } = useTranslation();
  const certificates = useCertificates(accountId);

  if (certificates.isLoading && !certificates.data) return <LoadingState />;
  if (certificates.isError && !certificates.data) {
    return <ErrorState onRetry={() => certificates.refetch()} />;
  }

  const earned = certificates.data?.earned ?? [];
  const remaining = certificates.data?.progress ?? [];

  return (
    <View style={styles.section}>
      {earned.map((certificate: Certificate) => (
        <CertificateCard key={certificate.id} certificate={certificate} />
      ))}

      {earned.length === 0 ? (
        <EmptyState title={t('profile.noCertificatesTitle')} body={t('profile.noCertificatesBody')} />
      ) : null}

      {/* What is left, and how much of it. An empty tab saying only "none
          yet" tells a student nothing about how to change that. */}
      {remaining.map((item: CertificateProgress) => (
        <View key={item.definitionId} style={styles.card}>
          <Text style={styles.cardTitle}>{t(`certificate.${item.definitionId}.title`)}</Text>
          <Text style={styles.muted}>
            {t('profile.certificateRemaining', {
              remaining: item.nodesRemaining,
              total: item.requiredNodes.length,
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CertificateCard({ certificate }: { certificate: Certificate }) {
  const { t } = useTranslation();
  const issued = new Date(certificate.issuedAt);

  return (
    <View style={styles.certificate}>
      <Text style={styles.certificateTitle}>
        {t(`certificate.${certificate.definitionId}.title`)}
      </Text>
      <Text style={styles.certificateIssuer}>{t('certificate.issuer')}</Text>
      <Text style={styles.certificateDate}>
        {t('certificate.issuedOn', { date: issued.toLocaleDateString() })}
      </Text>

      {/*
        A certificate has to state its own limits (PRD-RWD-013). Naming the
        evidence behind it — how many validated attempts, over how long — is
        what keeps it from being read as a qualification it is not.
      */}
      <Text style={styles.certificateEvidence}>
        {t('certificate.evidence', {
          attempts: certificate.evidenceSummary.attempts,
          days: certificate.evidenceSummary.periodDays,
          skills: certificate.evidenceSummary.nodes.length,
        })}
      </Text>
      <Text style={styles.certificateDisclaimer}>{t('certificate.disclaimer')}</Text>

      {/* Inert in R1 and labelled as such, rather than a button that
          silently does nothing (20-11). */}
      <Text style={styles.certificateVerify}>{t('certificate.verifySoon')}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function Settings({ accountId }: { accountId: string | null }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const sync = useSync();
  const bootstrap = useBootstrap(accountId);

  const confirmSignOut = () => {
    // The warning is the point: signing out on a borrowed phone with work
    // still queued must not silently look like a clean exit (PRD-ONB-015).
    const body =
      sync.pending > 0
        ? t('profile.signOutPendingBody', { count: sync.pending })
        : t('profile.signOutBody');

    Alert.alert(t('profile.signOut'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: () => {
          if (accountId) signOut(accountId);
        },
      },
    ]);
  };

  const requestDeletion = () => {
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.continue'),
        style: 'destructive',
        onPress: () => {
          if (!accountId) return;
          void rpc(accountId, 'v1.account.delete.request', {
            confirm: true,
            idempotencyKey: `delete-${accountId}`,
          })
            .then(() => Alert.alert(t('profile.deleteScheduledTitle'), t('profile.deleteScheduledBody')))
            .catch(() => Alert.alert(t('error.generic')));
        },
      },
    ]);
  };

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language === 'id' ? 'en' : 'id');
  };

  /**
   * Offer a way back in to a student who joined with a class code.
   *
   * They have no password and no email, so losing this phone means asking a
   * teacher to hand the profile back. Somebody who already has a wallet can use
   * that instead — which is worth saying plainly rather than burying in a
   * settings row.
   *
   * What it does **not** say is that anything is missing. A certificate is
   * issued and meaningful without a wallet, and a row that implied otherwise
   * would be pressuring a child toward a crypto app to get something they
   * already have.
   */
  const startUpgrade = () => {
    Alert.alert(t('profile.connectWallet'), t('profile.connectWalletBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.continue'), onPress: () => router.push('/(auth)/wallet') },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

      <Row label={t('profile.language')} value={i18n.language === 'id' ? 'Bahasa Indonesia' : 'English'} onPress={toggleLanguage} />
      {bootstrap.data?.class ? (
        <Row label={t('profile.class')} value={bootstrap.data.class.name} />
      ) : null}
      {bootstrap.data?.profile.hasWallet === false ? (
        <Row testID="profile-connect-wallet" label={t('profile.connectWallet')} onPress={startUpgrade} />
      ) : null}
      <Row label={t('profile.signOut')} onPress={confirmSignOut} />
      <Row label={t('profile.deleteAccount')} onPress={requestDeletion} danger />
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  danger = false,
  testID,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      onPress={onPress}
      style={styles.settingRow}
    >
      <Text style={[styles.settingLabel, danger && styles.settingDanger]}>{label}</Text>
      {value ? <Text style={styles.settingValue}>{value}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },

  header: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.title, color: palette.ink900 },
  className: { ...typography.caption, color: palette.ink500 },

  statRow: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue: { ...typography.display, color: palette.blue700 },
  statLabel: { ...typography.caption, color: palette.ink500 },

  codeCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
  },
  codeLabel: { ...typography.caption, color: palette.ink500 },
  code: { ...typography.display, color: palette.ink900, letterSpacing: 4 },
  codeHelp: { ...typography.caption, color: palette.ink500 },

  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  tabActive: { backgroundColor: palette.blue700 },
  tabLabel: { ...typography.caption, color: palette.ink700 },
  tabLabelActive: { color: palette.surface, fontWeight: '700' },

  section: { gap: spacing.md },
  sectionTitle: { ...typography.heading, color: palette.ink900 },

  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { ...typography.label, color: palette.ink900 },
  cardMeta: { ...typography.caption, color: palette.ink500 },

  barTrack: { height: 8, borderRadius: radius.pill, backgroundColor: palette.ink100 },
  barFill: { height: 8, borderRadius: radius.pill, backgroundColor: palette.blue700 },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: 92 },
  chartColumn: { flex: 1, justifyContent: 'flex-end' },
  chartBar: { borderRadius: radius.sm, backgroundColor: palette.blue700 },

  domainTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  domainTagText: { ...typography.caption, fontWeight: '700' },

  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
  },
  nodeName: { ...typography.body, color: palette.ink700, flex: 1 },
  nodeRight: { alignItems: 'flex-end', gap: spacing.xs },
  bandChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  bandText: { ...typography.caption, fontWeight: '700' },
  thin: { ...typography.caption, color: palette.warning600 },

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  friendName: { ...typography.body, color: palette.ink900, flex: 1 },
  muted: { ...typography.caption, color: palette.ink500 },
  error: { ...typography.caption, color: palette.danger600 },

  codeInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  codeInput: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ink100,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: palette.ink900,
    letterSpacing: 2,
  },
  codeSubmit: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.blue700,
  },
  codeSubmitLabel: { ...typography.label, color: palette.surface },

  linkButton: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  linkLabel: { ...typography.label, color: palette.blue700 },
  declineLabel: { ...typography.label, color: palette.ink500 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sheetTitle: { ...typography.heading, color: palette.ink900, marginBottom: spacing.sm },
  sheetItem: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  sheetLabel: { ...typography.body, color: palette.ink900 },
  sheetDanger: { ...typography.body, color: palette.danger600, fontWeight: '700' },
  sheetHelp: { ...typography.caption, color: palette.ink500, marginBottom: spacing.sm },

  certificate: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: palette.blue600,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  certificateTitle: { ...typography.heading, color: palette.ink900 },
  certificateIssuer: { ...typography.caption, color: palette.ink500 },
  certificateDate: { ...typography.caption, color: palette.ink500 },
  certificateEvidence: { ...typography.body, color: palette.ink700, marginTop: spacing.sm },
  certificateDisclaimer: { ...typography.caption, color: palette.ink500, fontStyle: 'italic' },
  certificateVerify: { ...typography.caption, color: palette.ink500 },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  settingLabel: { ...typography.body, color: palette.ink900 },
  settingDanger: { color: palette.danger600 },
  settingValue: { ...typography.caption, color: palette.ink500 },
});
