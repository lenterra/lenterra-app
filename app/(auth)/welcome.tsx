/**
 * The sign-in screen.
 *
 * Replaces the login carousel and `ConnectButton` in `profile.tsx`, which
 * offered eight external wallets — MetaMask, Coinbase, Rainbow and the rest.
 * Asking a student in NTT to install a crypto wallet before they can play a
 * Congklak mission is the single largest access barrier the demo has.
 *
 * **There is one way in now: the code the teacher wrote on the board.** The
 * email and Google buttons that used to sit above it are gone. Each asked a
 * student to have an inbox, and the students this is built for often share a
 * phone and have never had one; each also put a third party between a child and
 * the start of a lesson.
 *
 * With one route in, this screen has no decision left on it. That is the point:
 * a student who cannot read the two options is not helped by being given them,
 * and thirty students onboarding at once means thirty chances for the wrong one
 * to be chosen.
 *
 * Nothing here mentions a wallet, a chain, or crypto — there is no longer one
 * to mention at sign-in at all.
 */

import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from "@/src/ui/tokens";

export default function WelcomeScreen() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<View testID="welcome-screen" style={styles.screen}>
			<View style={styles.hero}>
				<Text style={styles.title}>{t("auth.welcomeTitle")}</Text>
				<Text style={styles.body}>{t("auth.welcomeBody")}</Text>
			</View>

			<View style={styles.actions}>
				<Pressable
					accessibilityRole="button"
					testID="join-with-class-code"
					accessibilityLabel={t("auth.joinWithCode")}
					style={styles.primary}
					onPress={() => router.push("/(auth)/join")}
				>
					<Text style={styles.primaryLabel}>{t("auth.joinWithCode")}</Text>
				</Pressable>

				<Text style={styles.help}>{t("auth.codeFromTeacher")}</Text>
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
		backgroundColor: palette.blue700,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.lg,
	},
	primaryLabel: { ...typography.label, color: palette.surface },
	help: { ...typography.caption, color: palette.ink500, textAlign: "center" },
});
