/**
 * Query hooks — the only way a screen gets server data (TRD-APP-001).
 *
 * No component constructs an RPC call, holds a token, or touches the Nakama
 * client. The demo's pattern — a `useEffect` in `profile.tsx` calling Nakama
 * directly — is what this exists to make impossible.
 *
 * Responses are validated at the boundary. A server that changes a field name
 * fails here, naming the RPC, rather than producing an `undefined` in a
 * component with no clue where it came from.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { z } from 'zod';

import { rpc } from '../nakama/rpc';
import { listFriends } from '../nakama/friends';
import { config } from '../../lib/config';
import { queryKeys } from './client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const BandSchema = z.enum(['not_started', 'emerging', 'developing', 'proficient', 'mastered']);

const BootstrapSchema = z.object({
  profile: z.object({
    userId: z.string(),
    displayName: z.string(),
    friendCode: z.string(),
    role: z.string(),
    locale: z.string(),
    schoolId: z.string().nullable(),
    onboarded: z.boolean(),
  }),
  class: z
    .object({ id: z.string(), name: z.string(), leaderboardEnabled: z.boolean() })
    .nullable(),
  entitlements: z.array(z.string()),
  catalog: z.object({
    currentVersion: z.string(),
    clientVersion: z.string().nullable(),
    updateRequired: z.boolean(),
  }),
  summary: z.object({
    points: z.number(),
    streakDays: z.number(),
    rank: z.number().nullable(),
  }),
  serverTime: z.string(),
  minSupportedClient: z.string(),
});

export type Bootstrap = z.infer<typeof BootstrapSchema>;

const RecommendationSchema = z.object({
  missionId: z.string(),
  contentVersion: z.number(),
  gameId: z.string(),
  reason: z.enum(['gap', 'unevidenced', 'reinforce', 'placement', 'recovery']),
  primarySkillNodeId: z.string(),
  predictedSuccess: z.number(),
  displayReasonKey: z.string(),
});

const RecommendSchema = z.object({
  primary: RecommendationSchema.nullable(),
  alternatives: z.array(RecommendationSchema),
  assignment: z
    .object({
      id: z.string(),
      kind: z.enum(['mission', 'lesson']),
      targetId: z.string(),
      note: z.string().optional(),
    })
    .nullable(),
});

const ProgressSchema = z.object({
  // Bands, never raw values. The student app is structurally incapable of
  // showing a mastery number because the contract does not carry one.
  mastery: z.array(
    z.object({
      skillNodeId: z.string(),
      band: BandSchema,
      evidenceCount: z.number(),
      trend: z.enum(['up', 'flat', 'down']),
    }),
  ),
  games: z.array(
    z.object({
      gameId: z.string(),
      missionsCompleted: z.number(),
      missionsAvailable: z.number(),
      highestRank: z.number(),
    }),
  ),
  courses: z.array(z.object({ courseId: z.string(), lessonsCompleted: z.number() })),
  certificates: z.array(
    z.object({ id: z.string(), definitionId: z.string(), issuedAt: z.string() }),
  ),
  // Weeks with no play are absent rather than zero — the server sends what
  // happened, the client fills the gaps for the range it asked about.
  weeklyActivity: z.array(
    z.object({ date: z.string(), attempts: z.number(), minutes: z.number() }),
  ),
});

const LeaderboardSchema = z.object({
  scope: z.string(),
  period: z.string(),
  // What the client displays when it is showing a cached board offline
  // (PRD-APP-032). A leaderboard with no timestamp is a lie by omission.
  generatedAt: z.string(),
  entries: z.array(
    z.object({
      rank: z.number(),
      userId: z.string(),
      displayName: z.string(),
      points: z.number(),
      isSelf: z.boolean(),
    }),
  ),
  self: z.object({ rank: z.number(), points: z.number() }).nullable(),
  cursor: z.string().nullable(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardSchema>['entries'][number];
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;

const ClassGoalSchema = z.object({
  classId: z.string().nullable(),
  className: z.string().nullable(),
  reached: z.number(),
  target: z.number(),
  progress: z.number(),
  achieved: z.boolean(),
  contributors: z.number(),
  memberCount: z.number(),
  mine: z.number(),
});

export type ClassGoal = z.infer<typeof ClassGoalSchema>;

/**
 * The class's shared goal (PRD-SOC-009).
 *
 * Fetched separately from the leaderboard rather than folded into it, because
 * a teacher who switches the ranking off is switching off competition — and
 * this is the mechanic that has to survive that.
 */
export function useClassGoal(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.classGoal(accountId ?? 'none'),
    enabled: accountId !== null,
    queryFn: () => rpc(accountId as string, 'v1.class.goal', {}, { schema: ClassGoalSchema }),
  });
}

const PointsSchema = z.object({
  balance: z.number(),
  entries: z.array(z.object({ delta: z.number(), reasonKey: z.string(), at: z.string() })),
  cursor: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBootstrap(accountId: string | null): UseQueryResult<Bootstrap> {
  return useQuery({
    queryKey: queryKeys.bootstrap(accountId ?? 'none'),
    enabled: accountId !== null,
    queryFn: () =>
      rpc(accountId as string, 'v1.session.bootstrap', {
        clientVersion: config.clientVersion,
        coreVersion: '0.1.0',
      }, { schema: BootstrapSchema }),
    // The one query worth refetching often: it carries `updateRequired` and
    // the catalog version everything else keys off.
    staleTime: 5 * 60_000,
  });
}

export function useRecommendations(accountId: string | null, gameId?: string) {
  return useQuery({
    queryKey: queryKeys.recommendations(accountId ?? 'none', gameId),
    enabled: accountId !== null,
    queryFn: () =>
      rpc(accountId as string, 'v1.mission.recommend', { limit: 4, gameId }, {
        schema: RecommendSchema,
      }),
  });
}

export function useProgress(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.progress(accountId ?? 'none'),
    enabled: accountId !== null,
    queryFn: () => rpc(accountId as string, 'v1.progress.get', {}, { schema: ProgressSchema }),
  });
}

export function useLeaderboard(
  accountId: string | null,
  scope: 'class' | 'school' = 'class',
  period: 'week' | 'all' = 'week',
) {
  return useQuery({
    queryKey: queryKeys.leaderboard(accountId ?? 'none', scope, period),
    enabled: accountId !== null,
    queryFn: () =>
      rpc(accountId as string, 'v1.leaderboard.list', { scope, period, limit: 25 }, {
        schema: LeaderboardSchema,
      }),
  });
}

const CertificateSchema = z.object({
  earned: z.array(
    z.object({
      id: z.string(),
      definitionId: z.string(),
      issuedAt: z.string(),
      // What the certificate is allowed to say about itself (PRD-RWD-013):
      // which skills, how many validated attempts, over what period.
      evidenceSummary: z.object({
        nodes: z.array(z.string()),
        attempts: z.number(),
        periodDays: z.number(),
      }),
      verifiable: z.boolean(),
      publicVerifiable: z.boolean(),
    }),
  ),
  // What is left to earn, and why — so an empty tab explains itself instead
  // of saying only "none yet".
  progress: z.array(
    z.object({
      definitionId: z.string(),
      requiredNodes: z.array(z.string()),
      nodesRemaining: z.number(),
      remaining: z.array(z.object({ skillNodeId: z.string(), reason: z.string() })),
    }),
  ),
});

export type Certificate = z.infer<typeof CertificateSchema>['earned'][number];
export type CertificateProgress = z.infer<typeof CertificateSchema>['progress'][number];

export function useCertificates(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.certificates(accountId ?? 'none'),
    enabled: accountId !== null,
    queryFn: () =>
      rpc(accountId as string, 'v1.certificate.list', {}, { schema: CertificateSchema }),
  });
}

/**
 * The friend graph.
 *
 * Not through `rpc()`: friends are Nakama's own API, guarded by the
 * `beforeAddFriends` hook rather than by an RPC of ours.
 */
export function useFriends(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.friends(accountId ?? 'none'),
    enabled: accountId !== null,
    queryFn: () => listFriends(accountId as string),
    // Requests are the one thing here a student is waiting on, so this
    // refreshes more eagerly than the rest.
    staleTime: 30_000,
  });
}

export function usePoints(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.points(accountId ?? 'none'),
    enabled: accountId !== null,
    queryFn: () =>
      rpc(accountId as string, 'v1.points.history', { limit: 50 }, { schema: PointsSchema }),
  });
}
