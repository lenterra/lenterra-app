/**
 * Build-time configuration (TRD-APP-002).
 *
 * Replaces `new Client("defaultkey", "127.0.0.1", "7350")` in
 * `lib/nakama-client.ts`. That address only resolves on a simulator loopback,
 * so the app could never have talked to a real server from a physical device —
 * and `defaultkey` is Nakama's published default, which means anyone could have
 * talked to the server.
 *
 * Everything here comes from `EXPO_PUBLIC_*` variables resolved at build time.
 * They are **not secrets**: an `EXPO_PUBLIC_` value is embedded in the bundle
 * and readable by anyone with the APK. The Nakama server key is one of these by
 * design — it identifies the client application, it does not authorise anything
 * (that is what the session token does). The assertion HMAC secret is never
 * here; it lives only on the verifier and the server.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    // Failing at module load beats failing at the first request. A build that
    // shipped without a server address should not get as far as a login screen.
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in, or set it in the EAS build profile.`,
    );
  }
  return value;
}

export interface AppConfig {
  nakama: { host: string; port: string; serverKey: string; useSsl: boolean; timeoutMs: number };
  verifierUrl: string;
  thirdwebClientId: string;
  environment: 'development' | 'staging' | 'production';
  clientVersion: string;
}

const environment = (process.env.EXPO_PUBLIC_ENV ?? 'development') as AppConfig['environment'];

export const config: AppConfig = {
  nakama: {
    host: required('EXPO_PUBLIC_NAKAMA_HOST', process.env.EXPO_PUBLIC_NAKAMA_HOST),
    port: process.env.EXPO_PUBLIC_NAKAMA_PORT ?? '7350',
    serverKey: required('EXPO_PUBLIC_NAKAMA_SERVER_KEY', process.env.EXPO_PUBLIC_NAKAMA_SERVER_KEY),
    // Plain HTTP is only ever acceptable against a local development server.
    // Children's learning records must not cross a school network in the clear.
    useSsl: (process.env.EXPO_PUBLIC_NAKAMA_SSL ?? (environment === 'development' ? 'false' : 'true')) === 'true',
    // Long enough for a slow 3G handshake, short enough that a dead server does
    // not leave a student staring at a spinner.
    timeoutMs: Number(process.env.EXPO_PUBLIC_NAKAMA_TIMEOUT_MS ?? 15000),
  },
  verifierUrl: required('EXPO_PUBLIC_VERIFIER_URL', process.env.EXPO_PUBLIC_VERIFIER_URL),
  thirdwebClientId: required(
    'EXPO_PUBLIC_THIRDWEB_CLIENT_ID',
    process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID,
  ),
  environment,
  clientVersion: process.env.EXPO_PUBLIC_CLIENT_VERSION ?? '0.1.0',
};

export const isProduction = config.environment === 'production';
