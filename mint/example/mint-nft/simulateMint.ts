import { PublicKey } from '@solana/web3.js';

import { CANDY_MACHINE_ID } from './constants';

/**
 * Simulate a nft mint experience
 *
 */

export async function simulateMint(): Promise<{
    label: string;
    message: string;
    candymachineId: PublicKey; 
}> {
    return {
        label: 'NFT Mint',
        message: 'NFT Mint - your mint - #001234',
        candymachineId: CANDY_MACHINE_ID,
    };
}
