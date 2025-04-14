import { Tabs } from "expo-router";
import React from "react";

import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function TabLayout() {
	const colorScheme = useColorScheme();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
				headerShown: false,
			}}
		>
			<Tabs.Screen
				name="board"
				options={{
					title: "Board",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "stats-chart" : "stats-chart-outline"}
							color={color}
						/>
					),
				}}
			/>	
			<Tabs.Screen
				name="games"
				options={{
					title: "Games",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "star" : "star-outline"}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "home" : "home-outline"}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="courses"
				options={{
					title: "Courses",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "library" : "library-outline"}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: "Profile",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "person" : "person-outline"}
							color={color}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
