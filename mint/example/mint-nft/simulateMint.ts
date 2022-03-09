import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Simulate a checkout experience
 *
 * Recommendation:
 * `amount` and `reference` should be created in a trusted environment (server).
 * The `reference` should be unique to a single customer session,
 * and will be used to find and validate the payment in the future.
 *
 * Read our [getting started guide](#getting-started-guide) for more information on what these parameters mean.
 */

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const CANDY_MACHINE_ID = new PublicKey(process.env.CANDY_MACHINE_ID!);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const CANDY_MACHINE_CONFIG = new PublicKey(process.env.CANDY_MACHINE_CONFIG!);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const CANDY_MACHINE_TREASURY = new PublicKey(process.env.CANDY_MACHINE_TREASURY!);

export async function simulateMint(): Promise<{
    label: string;
    message: string;
    memo: string;
    candymachineId: PublicKey; 
    config: PublicKey; 
    treasury: PublicKey;
    reference: PublicKey;
}> {
    return {
        label: 'NFT Mint',
        message: 'NFT Mint - your mint - #001234',
        memo: 'ABC#123123',
        candymachineId: CANDY_MACHINE_ID,
        config: CANDY_MACHINE_CONFIG,
        treasury: CANDY_MACHINE_TREASURY,
        reference: new Keypair().publicKey,
    };
}
