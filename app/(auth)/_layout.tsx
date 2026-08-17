import { Stack } from "expo-router";

export default function AuthLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="welcome" />
			<Stack.Screen name="join" />
			<Stack.Screen name="wallet" />
			<Stack.Screen name="name" />
		</Stack>
	);
}
