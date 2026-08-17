/**
 * Class-code join.
 *
 * The path that matters most for reach: a student with no email, on a borrowed
 * phone, joining from a code their teacher wrote on the board. No inbox, no
 * password, no wallet app, and no adult needed halfway through.
 *
 * Three decisions here are about the room rather than the screen.
 *
 * The code is upper-cased as it is typed, because a code read off a whiteboard
 * is written in capitals and a student who types lower-case should not be told
 * they got it wrong.
 *
 * The failures are told apart. A mistyped code, a full class, and too many
 * attempts each have a different next action — retype it, ask the teacher, or
 * wait — and collapsing them into "something went wrong" leaves thirty students
 * tapping the same button while one lesson runs out.
 *
 * And a returning student is offered their old profile rather than expected to
 * explain themselves. The names shown are masked and the list is capped: a full
 * class roster handed to anyone holding a six-character code is a safeguarding
 * problem, not a convenience. Picking one only *asks*; the teacher decides, and
 * play continues on the new account meanwhile.
 */

import { useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
	AuthError,
	requestReclaim,
	signInWithClassCode,
	type ClassCodeSession,
} from "@/src/features/onboarding/auth";
import { MIN_TOUCH_TARGET, palette, radius, spacing, typography } from "@/src/ui/tokens";

/** Six characters, from an alphabet with no 0/O or 1/I — students read these aloud. */
const CODE_LENGTH = 6;

const DETAIL_KEYS: Record<string, string> = {
	invalid_code: "auth.codeInvalid",
	missing_code: "auth.codeInvalid",
	class_full: "auth.codeClassFull",
	too_many_attempts: "auth.codeTooManyTries",
};

export default function JoinScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [joined, setJoined] = useState<ClassCodeSession | null>(null);

	async function onJoin() {
		setBusy(true);
		setError(null);
		try {
			const session = await signInWithClassCode(code);
			if (session.candidates.length > 0) {
				setJoined(session);
			} else {
				// Straight to naming: they are signed in and in the class, and the
				// name is the only thing left that only they can decide.
				router.replace("/(auth)/name");
			}
		} catch (err) {
			if (err instanceof AuthError && err.reason === "verifier_unreachable") {
				setError(t("error.offline"));
			} else if (err instanceof AuthError && err.detail) {
				setError(t(DETAIL_KEYS[err.detail] ?? "error.generic"));
			} else {
				setError(t("error.generic"));
			}
		} finally {
			setBusy(false);
		}
	}

	async function onRecognize(reclaimToken: string) {
		if (!joined) return;
		setBusy(true);
		try {
			await requestReclaim(joined.accountId, joined.classId, reclaimToken);
		} catch {
			// Deliberately not surfaced as a blocking failure. The request is a
			// message to a teacher, and a student who cannot send it right now
			// must still be able to start playing.
		} finally {
			setBusy(false);
			router.replace("/(auth)/name");
		}
	}

	if (joined) {
		return (
			<ScrollView testID="recognize-screen" contentContainerStyle={styles.screen}>
				<Text style={styles.title}>{t("auth.recognizeYourself")}</Text>
				<Text style={styles.help}>{t("auth.recognizeHelp")}</Text>

				{joined.candidates.map((candidate) => (
					<Pressable
						key={candidate.reclaimToken}
						testID={`recognize-${candidate.maskedName}`}
						accessibilityRole="button"
						style={[styles.candidate, busy && styles.disabled]}
						disabled={busy}
						onPress={() => onRecognize(candidate.reclaimToken)}
					>
						<Text style={styles.candidateLabel}>{candidate.maskedName}</Text>
					</Pressable>
				))}

				<Pressable
					testID="recognize-skip"
					accessibilityRole="button"
					style={styles.link}
					disabled={busy}
					onPress={() => router.replace("/(auth)/name")}
				>
					<Text style={styles.linkLabel}>{t("common.continue")}</Text>
				</Pressable>
			</ScrollView>
		);
	}

	return (
		<View testID="join-screen" style={styles.screen}>
			<Text style={styles.title}>{t("auth.joinWithCode")}</Text>
			<Text style={styles.help}>{t("auth.codePlaceholder")}</Text>

			<TextInput
				testID="join-code-input"
				accessibilityLabel={t("auth.codeLabel")}
				style={styles.input}
				value={code}
				onChangeText={(next) => setCode(next.toUpperCase().replace(/\s/g, ""))}
				autoCapitalize="characters"
				autoCorrect={false}
				maxLength={CODE_LENGTH}
				editable={!busy}
				placeholder="ABC123"
				placeholderTextColor={palette.ink300}
			/>

			<Pressable
				testID="join-submit"
				accessibilityRole="button"
				style={[styles.primary, busy && styles.disabled]}
				disabled={busy || code.length < CODE_LENGTH}
				onPress={onJoin}
			>
				{busy ? (
					<ActivityIndicator color={palette.surface} />
				) : (
					<Text style={styles.primaryLabel}>{t("common.continue")}</Text>
				)}
			</Pressable>

			{error ? (
				<Text testID="join-error" accessibilityRole="alert" style={styles.error}>
					{error}
				</Text>
			) : null}

			<Pressable
				accessibilityRole="button"
				style={styles.link}
				disabled={busy}
				onPress={() => router.replace("/(auth)/welcome")}
			>
				<Text style={styles.linkLabel}>{t("common.back")}</Text>
			</Pressable>
		</View>
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
	input: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.surface,
		borderColor: palette.ink100,
		borderWidth: 1,
		borderRadius: radius.md,
		paddingHorizontal: spacing.lg,
		...typography.title,
		letterSpacing: 4,
		textAlign: "center",
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
	candidate: {
		minHeight: MIN_TOUCH_TARGET,
		backgroundColor: palette.surface,
		borderColor: palette.ink100,
		borderWidth: 1,
		borderRadius: radius.md,
		paddingHorizontal: spacing.lg,
		justifyContent: "center",
	},
	candidateLabel: { ...typography.label, color: palette.ink900 },
	disabled: { opacity: 0.6 },
	error: { ...typography.caption, color: palette.danger600 },
	link: { minHeight: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
	linkLabel: { ...typography.label, color: palette.blue600 },
});
