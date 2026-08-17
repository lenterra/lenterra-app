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

/**
 * Where the server is, unless a build says otherwise.
 *
 * Every value below is defaulted rather than required. A build with no
 * environment at all now produces an app that talks to production, which is
 * both the common case and the one that used to fail loudest: `required()`
 * threw at module load, so a missing variable meant a build that crashed on
 * launch rather than one that worked.
 *
 * None of this is secret. The Nakama server key identifies the client
 * application and authorises nothing — the session token does that — and every
 * value here is readable by anyone holding the APK. Overriding them is how a
 * build points at staging or at a laptop.
 */
const PRODUCTION = {
  host: 'lenterra-api.faizath.com',
  // The verifier sits behind the same name, so there is one DNS record and one
  // certificate to keep alive rather than two.
  verifierUrl: 'https://lenterra-api.faizath.com/verifier',
  serverKey: 'lenterra',
} as const;

export interface AppConfig {
  nakama: { host: string; port: string; serverKey: string; useSsl: boolean; timeoutMs: number };
  verifierUrl: string;
  thirdwebClientId: string;
  environment: 'development' | 'staging' | 'production';
  clientVersion: string;
}

const environment = (process.env.EXPO_PUBLIC_ENV ?? 'production') as AppConfig['environment'];

export const config: AppConfig = {
  nakama: {
    host: process.env.EXPO_PUBLIC_NAKAMA_HOST ?? PRODUCTION.host,
    // Behind TLS on the default port, so the port only needs setting for a
    // local server that is not.
    port: process.env.EXPO_PUBLIC_NAKAMA_PORT ?? (environment === 'development' ? '7350' : '443'),
    serverKey: process.env.EXPO_PUBLIC_NAKAMA_SERVER_KEY ?? PRODUCTION.serverKey,
    // Plain HTTP is only ever acceptable against a local development server.
    // Children's learning records must not cross a school network in the clear.
    useSsl: (process.env.EXPO_PUBLIC_NAKAMA_SSL ?? (environment === 'development' ? 'false' : 'true')) === 'true',
    // Long enough for a slow 3G handshake, short enough that a dead server does
    // not leave a student staring at a spinner.
    timeoutMs: Number(process.env.EXPO_PUBLIC_NAKAMA_TIMEOUT_MS ?? 15000),
  },
  verifierUrl: process.env.EXPO_PUBLIC_VERIFIER_URL ?? PRODUCTION.verifierUrl,
  // The one value with no sensible default: it belongs to a thirdweb account,
  // and a wrong one fails at the moment somebody connects a wallet. Empty is
  // honest — the wallet screen is the only thing that needs it, and it is
  // optional.
  thirdwebClientId: process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID ?? '',
  environment,
  clientVersion: process.env.EXPO_PUBLIC_CLIENT_VERSION ?? '0.1.0',
};

export const isProduction = config.environment === 'production';
