/**
 * Choosing a display name.
 *
 * The validation here is not cosmetic. A display name is visible to a whole
 * class, and a child who puts their phone number in it has published it to
 * everyone — which is why `contains_contact` is checked before anything else.
 */

import { useRouter } from "expo-router";
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
import { rpc, RpcError } from "@/src/data/nakama/rpc";
import { newItemId } from "@/src/data/outbox/queue";
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from "@/src/ui/tokens";

const REASON_KEYS: Record<string, string> = {
	too_short: "auth.nameTooShort",
	too_long: "auth.nameTooLong",
	contains_contact: "auth.nameContainsContact",
	profanity: "auth.nameProfanity",
};

export default function NameScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSave() {
		const accountId = activeAccountId();
		if (!accountId) return;

		setBusy(true);
		setError(null);
		try {
			await rpc(accountId, "v1.profile.update", {
				displayName: name.trim(),
				idempotencyKey: newItemId(),
			});
			router.replace("/(tabs)");
		} catch (err) {
			// The server states which rule was broken; showing the specific
			// reason is what lets a student fix it in one attempt.
			const reason = err instanceof RpcError ? (err.details?.reason as string) : undefined;
			setError(reason ? t(REASON_KEYS[reason] ?? "error.generic") : t("error.generic"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<View style={styles.screen}>
			<Text style={styles.title}>{t("auth.nameLabel")}</Text>
			<Text style={styles.help}>{t("auth.nameHelp")}</Text>

			<TextInput
				accessibilityLabel={t("auth.nameLabel")}
				style={styles.input}
				value={name}
				onChangeText={setName}
				maxLength={24}
				editable={!busy}
				placeholderTextColor={palette.ink300}
			/>

			<Pressable
				accessibilityRole="button"
				style={[styles.primary, busy && styles.disabled]}
				disabled={busy || name.trim().length < 2}
				onPress={onSave}
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
	screen: { flex: 1, backgroundColor: palette.canvas, padding: spacing.xl, gap: spacing.md },
	title: { ...typography.title, color: palette.ink900, marginTop: spacing.xxl },
	help: { ...typography.caption, color: palette.ink500 },
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
