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
