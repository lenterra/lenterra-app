module.exports = function (api) {
	api.cache(true);
	return {
		presets: ["babel-preset-expo"],
		plugins: [
			// Reanimated 4 moved its worklet transform into `react-native-worklets`.
			// `react-native-reanimated/plugin` is now a shim that requires this one,
			// and loading it directly fails at Babel config time — which surfaces as
			// every test suite failing to run rather than as a dependency error.
			"react-native-worklets/plugin",
		],
	};
};
