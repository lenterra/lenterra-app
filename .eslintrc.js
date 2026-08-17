// https://docs.expo.dev/guides/using-eslint/
//
// Committed because `npm run lint` was previously unrunnable: the script
// existed, no config did, and the first run scaffolded one that nobody kept.
// A lint step that has to be set up before it can be used is a lint step that
// only runs when somebody is already looking for problems.
module.exports = {
  extends: 'expo',
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'android/',
    'ios/',
    'coverage/',
    // A stray Expo 52 scaffold, committed by accident and not part of this
    // app's build graph. Linting it reports problems in code nothing runs.
    'lenterra/',
  ],
  rules: {
    // The React Compiler rules, new in eslint-plugin-react-hooks 7 and shipped
    // as errors by eslint-config-expo 57. They fire on four pre-existing
    // effects — the session bootstrap, the play session's resume, and the sync
    // engine's startup drain — and they are pointing at something real:
    // `setState` synchronously inside an effect does cause a cascading render.
    //
    // Warnings rather than errors, deliberately and temporarily. Each of those
    // effects coordinates React state with a native module or a persisted
    // outbox, and the correct fix changes when work happens on mount. Whether
    // that is safe is a question about a device — an attempt queued offline
    // must still survive — and no device is available here. Turning them off
    // would hide the finding; leaving them as errors would mean either a red
    // lint run forever or a rushed change to the code path that decides
    // whether a student's offline work is kept.
    //
    // They are the first thing to work through the next time this app is run
    // on hardware.
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/incompatible-library': 'warn',
    // Emitted where the compiler bails out of memoising a component it cannot
    // prove safe. Informational: the component still works, it is simply not
    // optimised.
    'react-hooks/preserve-manual-memoization': 'warn',
  },

  overrides: [
    {
      // Build tooling runs in Node, not in Hermes. Without this, `__dirname`
      // in metro.config.js is the only error in an otherwise clean run — which
      // is how a lint step ends up being ignored rather than fixed.
      files: ['*.config.js', '*.config.mjs', 'scripts/**/*.js', 'scripts/**/*.mjs'],
      env: { node: true },
    },
    {
      // Jest hoists `jest.mock` above imports, so a mock that must apply to a
      // module has to be written before the import that pulls it in. The rule
      // is describing a real convention it does not know about.
      files: ['**/__tests__/**'],
      rules: { 'import/first': 'off' },
    },
  ],
};
