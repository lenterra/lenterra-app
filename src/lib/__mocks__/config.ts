/**
 * Configuration, for tests.
 *
 * The real module reads `EXPO_PUBLIC_*` variables and throws at import when any
 * required one is missing. That is the right behaviour — a build shipped
 * without a server address should fail immediately rather than reach a login
 * screen and fail per request — but it makes the module unimportable in a unit
 * test.
 *
 * Setting the variables does not help: Expo's Babel preset inlines
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
