/**
 * Kept as a re-export so existing screen imports keep working while they are
 * migrated one at a time. The real definitions live in `src/lib/thirdweb.ts`.
 *
 * **`usdcContract` is gone.** It pointed at Base *mainnet* USDC while the app
 * chain was Base Sepolia, it was imported nowhere, and it implies a feature —
 * transferable money in a 13-year-old's account — that is hard-blocked pending
 * a safeguarding and regulatory review (OQ-07). A live mainnet token contract
 * sitting in the source of a children's app is not a neutral leftover.
 *
 * **The `contract` handle is gone too.** Nothing in R1 reads or writes a chain;
 * it returns with certificate minting, against a contract that has been written
 * and audited.
 */

export { chain, thirdwebClient as client } from '@/src/lib/thirdweb';
