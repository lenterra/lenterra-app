/**
 * The thirdweb client.
 *
 * Replaces `constants/thirdweb.ts`. Two things are deliberately gone:
 *
 *  - **`usdcContract`.** It pointed at Base *mainnet* USDC while the app chain
 *    was Base Sepolia, was imported nowhere, and implies a feature — money in a
 *    13-year-old's account — that is hard-blocked pending a safeguarding and
 *    regulatory review (OQ-07). A live mainnet token contract sitting in the
 *    source of a children's app is not a neutral leftover.
 *  - **The contract handle.** Nothing in R1 reads or writes a chain. It returns
 *    with certificate minting, on a contract that has been written and audited.
 *
 * What stays is the client, because in-app wallets need it, and the chain,
 * because R3 certificates will be anchored there.
 */

import { createThirdwebClient } from 'thirdweb';
import { baseSepolia } from 'thirdweb/chains';

import { config } from './config';

export const thirdwebClient = createThirdwebClient({
  clientId: config.thirdwebClientId,
});

/**
 * Base Sepolia — a testnet.
 *
 * Certificates are R3 and are meaningful off-chain from the day they are
 * issued. Anchoring them on a testnet whose state can be wiped would make a
 * verifiable credential unverifiable, so the move to mainnet is part of the R3
 * decision, not an afterthought.
 */
export const chain = baseSepolia;
