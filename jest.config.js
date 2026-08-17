/**
 * Jest configuration, and the coverage floor.
 *
 * TRD-TEST-001 puts the core at 95% and says thresholds elsewhere are lower
 * *deliberately*. That is the right call rather than a concession: the core is
 * pure logic where every branch is reachable from a function call, while this
 * package is mostly React components whose branches are render paths. Chasing a
 * high number here buys shallow render tests, and shallow render tests are the
 * kind that pass while the screen is broken.
 *
 * So the floor covers what is worth covering — the offline queue, the catalog
 * cache, lesson progress, the animator — and is set as a ratchet just under
 * where those sit today. It stops coverage sliding without pretending a
 * component tree is as testable as a pure function.
 */

module.exports = {
  preset: 'jest-expo',

  /**
   * Coverage is collected from the layers that hold logic, not from screens.
   *
   * A screen that reads a hook and renders it has no behaviour of its own worth
   * asserting in a unit test; what it does have is a layout, which a unit test
   * cannot check and an E2E run can.
   */
  collectCoverageFrom: [
    'src/data/**/*.{ts,tsx}',
    'src/features/**/*.{ts,tsx}',
    'src/game/**/*.{ts,tsx}',
    'src/lib/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
  ],

  /**
   * A ratchet, not a target.
   *
   * These numbers are set just under what the suite reaches today so coverage
   * cannot slide, and they are frankly low. The reason is where the untested
   * code is: hooks that orchestrate React state and native modules, and two
   * board renderers. Unit-testing those means mocking the world, and the tests
   * that result assert that the mocks were called — which is the kind that
   * passes while the screen is broken.
   *
   * What is covered instead is everything a wrong answer would be invisible in:
   * the outbox and its drain, the catalog cache and its integrity checks, the
   * course reader, lesson progress, and the animator. The screens are covered by
   * the offline E2E flow, which is the only thing that can tell whether a
   * student can actually finish a mission on a bus.
   *
   * Raising these is a one-line change and should follow real tests, not a
   * narrower `collectCoverageFrom`.
   */
  coverageThreshold: {
    global: {
      branches: 28,
      functions: 30,
      lines: 35,
      statements: 35,
    },
  },

  // The stray Expo 52 template committed under `lenterra/` is not part of this
  // app's build graph and must not be part of its test run either.
  testPathIgnorePatterns: ['/node_modules/', '/lenterra/'],
};
