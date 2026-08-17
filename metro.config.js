// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// thirdweb resolves its own modules through package `exports`, and picks a
// different build per condition. Removing either of these breaks the bundle.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
	"react-native",
	"browser",
	"require",
];

/**
 * Node core modules that thirdweb reaches for, mapped to their React Native
 * equivalents.
 *
 * `thirdweb/x402` imports `crypto` directly. There is no `crypto` in Hermes, so
 * without this the bundle fails to resolve — not at runtime, at build time, on
 * a module nothing in this app calls. The project already depends on
 * `react-native-quick-crypto`, which is the implementation the thirdweb adapter
 * installs as the global anyway, so this points the bare import at the same
 * thing rather than adding a second one.
 *
 * `stream` and `buffer` are mapped for the same reason and pre-emptively: they
 * are the two that follow `crypto` in every Node-shaped dependency, and
 * discovering them one failed build at a time is the slow way.
 */
config.resolver.extraNodeModules = {
	...config.resolver.extraNodeModules,
	crypto: require.resolve("react-native-quick-crypto"),
	stream: require.resolve("readable-stream"),
	buffer: require.resolve("@craftzdog/react-native-buffer"),
};

module.exports = config;
