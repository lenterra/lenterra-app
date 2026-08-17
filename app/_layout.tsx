/**
 * App entry.
 *
 * Authentication moves here from the profile tab (PRD-APP-057). Today
 * `profile.tsx` gates itself on `!!account` while `index`, `games`, `board` and
 * `courses` render regardless — so a signed-out user is shown four screens of
 * fabricated points, ranks and friends. Gating at the root is what makes
 * "signed out" mean the same thing everywhere.
 *
 * `index.js` keeps its import order — the thirdweb adapter and reanimated
 * before `expo-router/entry` — because the adapter installs polyfills that must
 * precede everything else.
 */

import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo } from "react";
import { ThirdwebProvider } from "thirdweb/react";

import { useColorScheme } from "@/hooks/useColorScheme";
import { createQueryClient, restoreQueryCache } from "@/src/data/queries/client";
import { recoverInflight } from "@/src/data/outbox/queue";
import { SyncProvider } from "@/src/features/sync/SyncProvider";
import { useSession } from "@/src/features/onboarding/useSession";
import { initI18n } from "@/src/i18n";
import { startConnectivityWatch } from "@/src/lib/net";

SplashScreen.preventAutoHideAsync();

initI18n();

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const [loaded] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
	});

	const queryClient = useMemo(() => createQueryClient(), []);
	const session = useSession();

	useEffect(() => startConnectivityWatch(), []);

	useEffect(() => {
		if (!session.accountId) return;
		// Restore the cached answers before the first render that needs them, so
		// a student who opens the app offline sees their progress rather than a
		// spinner over data we already have.
		restoreQueryCache(queryClient, session.accountId);
		// Anything left mid-send by a killed app is safe to retry — the
		// idempotency key makes a duplicate free.
		recoverInflight(session.accountId);
	}, [queryClient, session.accountId]);

	useEffect(() => {
		if (loaded && session.status !== "loading") {
			SplashScreen.hideAsync();
		}
	}, [loaded, session.status]);

	if (!loaded || session.status === "loading") {
		return null;
	}

	return (
		<ThirdwebProvider>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
					<SessionRouter status={session.status} accountId={session.accountId} />
				</ThemeProvider>
			</QueryClientProvider>
		</ThirdwebProvider>
	);
}

function SessionRouter({
	status,
	accountId,
}: {
	status: ReturnType<typeof useSession>["status"];
	accountId: string | null;
}) {
	if (status === "unauthenticated") {
		return <Redirect href="/(auth)/welcome" />;
	}
	if (status === "needs-onboarding") {
		return <Redirect href="/(auth)/name" />;
	}

	// Sync lives here rather than in a screen: a student who regains signal on
	// the leaderboard tab should sync and pull content just as readily as one
	// sitting on the home screen.
	return (
		<SyncProvider accountId={accountId}>
			<Stack>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="(auth)" options={{ headerShown: false }} />
				<Stack.Screen name="play/[missionId]" options={{ headerShown: false }} />
				<Stack.Screen name="+not-found" />
			</Stack>
		</SyncProvider>
	);
}
