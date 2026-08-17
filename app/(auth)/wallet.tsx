/**
 * Attach a wallet to an account that already exists.
 *
 * This is the *only* screen in the app that says the word wallet, and reaching
 * it takes a deliberate tap in settings. Everything else — every mission, every
 * lesson, every certificate — works without one, so nothing here is allowed to
 * read as a step somebody has skipped.
 *
 * What it is actually for is recovery. An account made from a class code has no
 * password and no email, so a lost phone means asking a teacher to hand the
 * profile back. Somebody who already has a wallet can use it as the thing they
 * present instead.
 *
 * It replaces the two-step email screen that used to live at this point in the
 * flow. Only external wallets are offered: an in-app wallet would have to be
 * unlocked by an email code, which is the dependency being removed.
 */

import { useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { activeAccountId } from "@/src/data/cache/storage";
import {
	AuthError,
	EXTERNAL_WALLETS,
	upgradeAccount,
	type ExternalWalletId,
} from "@/src/features/onboarding/auth";
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from "@/src/ui/tokens";

/** Names people recognise. The identifiers are thirdweb's and are never shown. */
const WALLET_NAMES: Record<ExternalWalletId, string> = {
	"io.metamask": "MetaMask",
	"com.coinbase.wallet": "Coinbase Wallet",
	"me.rainbow": "Rainbow",
};

export default function WalletScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const [busy, setBusy] = useState<ExternalWalletId | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	async function onConnect(walletId: ExternalWalletId) {
		const accountId = activeAccountId();
		if (!accountId) return;

		setBusy(walletId);
		setError(null);
		try {
			await upgradeAccount(accountId, walletId);
			setDone(true);
		} catch (err) {
			// Cancelling is the ordinary outcome of opening a wallet app, reading
			// what is being asked, and deciding not to. It is not an error and
			// must not be shown as one.
			if (err instanceof AuthError && err.reason === "cancelled") {
				setError(null);
			} else if (err instanceof AuthError && err.reason === "verifier_unreachable") {
				setError(t("error.offline"));
			} else if (err instanceof AuthError && err.detail === "address_in_use") {
				setError(t("profile.walletInUse"));
			} else {
				setError(t("error.generic"));
			}
		} finally {
			setBusy(null);
		}
	}

	if (done) {
		return (
			<View testID="wallet-done" style={styles.screen}>
				<Text style={styles.title}>{t("profile.walletConnected")}</Text>
				<Text style={styles.help}>{t("profile.walletConnectedBody")}</Text>
				<Pressable
					accessibilityRole="button"
					style={styles.primary}
					onPress={() => router.back()}
				>
					<Text style={styles.primaryLabel}>{t("common.continue")}</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<ScrollView testID="wallet-screen" contentContainerStyle={styles.screen}>
			<Text style={styles.title}>{t("profile.connectWallet")}</Text>
			<Text style={styles.help}>{t("profile.connectWalletBody")}</Text>

			{EXTERNAL_WALLETS.map((walletId) => (
				<Pressable
					key={walletId}
					testID={`wallet-${walletId}`}
					accessibilityRole="button"
					style={[styles.option, busy !== null && styles.disabled]}
					disabled={busy !== null}
					onPress={() => onConnect(walletId)}
				>
					{busy === walletId ? (
						<ActivityIndicator color={palette.blue700} />
					) : (
						<Text style={styles.optionLabel}>{WALLET_NAMES[walletId]}</Text>
					)}
				</Pressable>
			))}

			{error ? (
				<Text testID="wallet-error" accessibilityRole="alert" style={styles.error}>
					{error}
				</Text>
			) : null}

			<Pressable
				testID="wallet-skip"
				accessibilityRole="button"
				style={styles.link}
				disabled={busy !== null}
				onPress={() => router.back()}
			>
				<Text style={styles.linkLabel}>{t("common.back")}</Text>
			</Pressable>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flexGrow: 1,
		backgroundColor: palette.canvas,
		padding: spacing.xl,
		gap: spacing.md,
		justifyContent: "center",
	},
	title: { ...typography.title, color: palette.ink900 },
	help: { ...typography.caption, color: palette.ink500 },
	option: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.surface,
		borderColor: palette.ink100,
		borderWidth: 1,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.lg,
	},
	optionLabel: { ...typography.label, color: palette.ink900 },
	primary: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.blue700,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
	},
	primaryLabel: { ...typography.label, color: palette.surface },
	disabled: { opacity: 0.6 },
	error: { ...typography.caption, color: palette.danger600 },
	link: { minHeight: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
	linkLabel: { ...typography.label, color: palette.blue700 },
});
