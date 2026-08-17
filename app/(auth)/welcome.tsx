/**
 * The sign-in screen.
 *
 * Replaces the login carousel and `ConnectButton` in `profile.tsx`, which
 * offered eight external wallets — MetaMask, Coinbase, Rainbow and the rest.
 * Asking a student in NTT to install a crypto wallet before they can play a
 * Congklak mission is the single largest access barrier the demo has.
 *
 * Nothing on this screen mentions a wallet, a chain, or crypto. An address is
 * created behind the sign-in because R3 certificates need somewhere to live;
 * that is an implementation detail and it stays one.
 */

import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AuthError, signIn } from "@/src/features/onboarding/auth";
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from "@/src/ui/tokens";

export default function WelcomeScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onGoogle() {
		setBusy(true);
		setError(null);
		try {
			await signIn("google");
			router.replace("/(tabs)");
		} catch (err) {
			// The reason decides whether "try again" is useful advice. An
			// unreachable verifier during a class onboarding session is worth
			// retrying; a cancelled sheet is not an error at all.
			if (err instanceof AuthError && err.reason === "cancelled") {
				setError(null);
			} else if (err instanceof AuthError && err.reason === "verifier_unreachable") {
				setError(t("error.offline"));
			} else {
				setError(t("error.generic"));
			}
		} finally {
			setBusy(false);
		}
	}

	return (
		<View testID="welcome-screen" style={styles.screen}>
			<View style={styles.hero}>
				<Text style={styles.title}>{t("auth.welcomeTitle")}</Text>
				<Text style={styles.body}>{t("auth.welcomeBody")}</Text>
			</View>

			<View style={styles.actions}>
				<Pressable
					accessibilityRole="button"
					testID="sign-in-email"
					accessibilityLabel={t("auth.signInEmail")}
					style={[styles.primary, busy && styles.disabled]}
					disabled={busy}
					onPress={() => router.push("/(auth)/email")}
				>
					<Text style={styles.primaryLabel}>{t("auth.signInEmail")}</Text>
				</Pressable>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("auth.signInGoogle")}
					style={[styles.secondary, busy && styles.disabled]}
					disabled={busy}
					onPress={onGoogle}
				>
					{busy ? (
						<ActivityIndicator color={palette.blue600} />
					) : (
						<Text style={styles.secondaryLabel}>{t("auth.signInGoogle")}</Text>
					)}
				</Pressable>

				<Pressable
					accessibilityRole="button"
					style={styles.tertiary}
					testID="join-with-class-code"
					onPress={() => router.push("/(auth)/join")}
				>
					<Text style={styles.tertiaryLabel}>{t("auth.joinWithCode")}</Text>
				</Pressable>

				{error ? (
					<Text accessibilityRole="alert" style={styles.error}>
						{error}
					</Text>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: palette.canvas,
		padding: spacing.xl,
		justifyContent: "space-between",
	},
	hero: { flex: 1, justifyContent: "center", gap: spacing.md },
	title: { ...typography.display, color: palette.ink900 },
	body: { ...typography.body, color: palette.ink700 },
	actions: { gap: spacing.md, paddingBottom: spacing.xl },
	primary: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.blue600,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.lg,
	},
	primaryLabel: { ...typography.label, color: palette.surface },
	secondary: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.surface,
		borderColor: palette.blue600,
		borderWidth: 1,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
	},
	secondaryLabel: { ...typography.label, color: palette.blue600 },
	tertiary: { minHeight: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
	tertiaryLabel: { ...typography.label, color: palette.ink500 },
	disabled: { opacity: 0.6 },
	error: { ...typography.caption, color: palette.danger600, textAlign: "center" },
});
