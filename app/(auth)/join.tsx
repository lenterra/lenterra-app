/**
 * Class-code join.
 *
 * The path that matters most for reach: a student with no email, on a borrowed
 * phone, joining from a code their teacher wrote on the board.
 *
 * It is **not available yet**, and this screen says so rather than pretending.
 * Provisioning an account here depends on a thirdweb capability that has not
 * been verified against a live integration (OQ-04), and an account that cannot
 * later be linked to an email would strand the student's certificates at R3 —
 * a year after they would have any chance of noticing.
 */

import { useRouter } from "expo-router";
import { StyleSheet, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from "@/src/ui/tokens";

export default function JoinScreen() {
	const { t } = useTranslation();
	const router = useRouter();

	return (
		<View style={styles.screen}>
			<Text style={styles.title}>{t("auth.joinWithCode")}</Text>
			<Text style={styles.body}>
				Cara masuk dengan kode kelas belum tersedia. Untuk sekarang, gunakan email
				atau akun Google.
			</Text>
			<Pressable
				accessibilityRole="button"
				style={styles.primary}
				onPress={() => router.replace("/(auth)/welcome")}
			>
				<Text style={styles.primaryLabel}>{t("common.back")}</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: palette.canvas,
		padding: spacing.xl,
		gap: spacing.lg,
		justifyContent: "center",
	},
	title: { ...typography.title, color: palette.ink900 },
	body: { ...typography.body, color: palette.ink700 },
	primary: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.blue600,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
	},
	primaryLabel: { ...typography.label, color: palette.surface },
});
