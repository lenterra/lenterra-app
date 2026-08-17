/**
 * Email sign-in, and the same two steps used to add an email to an account that
 * has none.
 *
 * Two steps, because the second needs the code the student read off their own
 * phone. No password: a password is one more thing to lose on a shared device,
 * and a one-time code is what the audience already knows from banking SMS.
 *
 * `?upgrade=1` is the class-code student adding an email to the account they
 * already have. The screen is identical because the student's experience is
 * identical; what differs is that the second step attaches the address to the
 * signed-in account rather than creating one, and never forks them into a
 * second account with none of their history.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { activeAccountId } from "@/src/data/cache/storage";
import {
	AuthError,
	sendEmailCode,
	signIn,
	upgradeAccount,
} from "@/src/features/onboarding/auth";
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from "@/src/ui/tokens";

export default function EmailScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const { upgrade } = useLocalSearchParams<{ upgrade?: string }>();
	const isUpgrade = upgrade === "1";
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSend() {
		setBusy(true);
		setError(null);
		try {
			await sendEmailCode(email.trim());
			setSent(true);
		} catch (err) {
			setError(err instanceof AuthError ? t("error.generic") : t("error.offline"));
		} finally {
			setBusy(false);
		}
	}

	async function onVerify() {
		setBusy(true);
		setError(null);
		try {
			if (isUpgrade) {
				const accountId = activeAccountId();
				if (!accountId) throw new AuthError("unknown", "No signed-in account to upgrade");
				await upgradeAccount(accountId, "email", email.trim());
			} else {
				await signIn("email", email.trim());
			}
			router.replace("/(tabs)");
		} catch (err) {
			setError(
				err instanceof AuthError && err.reason === "verifier_unreachable"
					? t("error.offline")
					: t("error.generic"),
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<View testID="email-screen" style={styles.screen}>
			<Text style={styles.title}>{t(isUpgrade ? "profile.addEmail" : "auth.signInEmail")}</Text>

			<TextInput
				testID="email-input"
				accessibilityLabel="Email"
				style={styles.input}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				editable={!sent && !busy}
				placeholder="nama@email.com"
				placeholderTextColor={palette.ink300}
			/>

			{sent ? (
				<TextInput
					testID="otp-input"
					accessibilityLabel={t("auth.codeLabel")}
					style={styles.input}
					value={code}
					onChangeText={setCode}
					keyboardType="number-pad"
					autoComplete="one-time-code"
					editable={!busy}
					placeholder="123456"
					placeholderTextColor={palette.ink300}
				/>
			) : null}

			<Pressable
				testID="email-submit"
				accessibilityRole="button"
				style={[styles.primary, busy && styles.disabled]}
				disabled={busy || email.length === 0}
				onPress={sent ? onVerify : onSend}
			>
				{busy ? (
					<ActivityIndicator color={palette.surface} />
				) : (
					<Text style={styles.primaryLabel}>{t("common.continue")}</Text>
				)}
			</Pressable>

			{error ? (
				<Text accessibilityRole="alert" style={styles.error}>
					{error}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: palette.canvas, padding: spacing.xl, gap: spacing.lg },
	title: { ...typography.title, color: palette.ink900, marginTop: spacing.xxl },
	input: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.surface,
		borderColor: palette.ink100,
		borderWidth: 1,
		borderRadius: radius.md,
		paddingHorizontal: spacing.lg,
		...typography.body,
		color: palette.ink900,
	},
	primary: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.blue600,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
	},
	primaryLabel: { ...typography.label, color: palette.surface },
	disabled: { opacity: 0.6 },
	error: { ...typography.caption, color: palette.danger600 },
});
