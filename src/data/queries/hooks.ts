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
  games: z.array(z.unknown()),
  courses: z.array(z.object({ courseId: z.string(), lessonsCompleted: z.number() })),
  certificates: z.array(
    z.object({ id: z.string(), definitionId: z.string(), issuedAt: z.string() }),
  ),
  weeklyActivity: z.array(z.unknown()),
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

export function usePoints(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.points(accountId ?? 'none'),
    enabled: accountId !== null,
    queryFn: () =>
      rpc(accountId as string, 'v1.points.history', { limit: 50 }, { schema: PointsSchema }),
  });
}
