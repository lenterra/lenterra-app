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
  // The React Compiler rules, new in eslint-plugin-react-hooks 7 and shipped as
  // errors by eslint-config-expo 57, are left at their defaults. They fired on
  // three effects — the session gate, the play session's resume, and the sync
  // engine's startup drain — and were downgraded to warnings while there was no
  // device to check the fix against.
  //
  // All three are now resolved by computing state during render instead of
  // correcting it afterwards, which is both what the rule asks for and what the
  // screens wanted: no frame of "loading" over a question already answered, no
  // board mounting empty before a resumed game appears in it, no pending count
  // reading zero for a student who has work waiting. The rules are back at
  // error so the next one is dealt with rather than accumulated.

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
