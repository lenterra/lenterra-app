/**
 * Configuration, for tests.
 *
 * The real module defaults every value to production, which is right for a
 * build and wrong for a test: a unit test that quietly resolved
 * lenterra-api.faizath.com would be a unit test that talks to a real server.
 *
 * Setting the variables does not help either: Expo's Babel preset inlines
 * `EXPO_PUBLIC_*` reads as literals at transform time, so a value assigned at
 * runtime is never seen. A manual mock is the honest way round it.
 *
 * The values are obvious placeholders pointing nowhere. Anything reaching a
 * network in a unit test is a bug in the test.
 */

import type { AppConfig } from '../config';

export const config: AppConfig = {
  environment: 'development',
  nakama: {
    host: 'localhost',
    port: '7350',
    serverKey: 'defaultkey',
    useSsl: false,
    timeoutMs: 15_000,
  },
  verifierUrl: 'http://localhost:8787',
  thirdwebClientId: 'test-client-id',
  clientVersion: '0.0.0-test',
};
