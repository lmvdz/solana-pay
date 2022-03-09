import { Connection, LAMPORTS_PER_SOL, sendAndConfirmRawTransaction, sendAndConfirmTransaction, Signer } from '@solana/web3.js';
import { createMintTransaction, parseMintURL } from '../../src';
import { CUSTOMER_WALLET } from './constants';

export async function simulateWalletInteraction(connection: Connection, url: string) {
    /**
     * For example only
     *
     * The URL that triggers the wallet interaction; follows the Solana Pay URL scheme
     * The parameters needed to create the correct nft mint transaction is encoded within the URL
     */
    const { message, candymachineId, label } = parseMintURL(url);
    console.log('label: ', label);
    console.log('message: ', message);

    /**
     * For example only
     *
     * Attempts to airdrop the customers wallet some SOL for a succeful transaction
     */
    await getPayer(connection);

    /**
     * Create the nft mint transaction with the parameters decoded from the URL
     */
    const { transaction, cleanupTransaction, signers } = await createMintTransaction(connection, CUSTOMER_WALLET, { candymachineId });

    // add the required paramters to the transaction (here we're using send raw transaction)
    transaction.feePayer = CUSTOMER_WALLET.publicKey
    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
    transaction.sign(...signers)

    /**
     * Send the nft mint transaction to the network
     */
    const txSig = await sendAndConfirmRawTransaction(connection, transaction.serialize(), { skipPreflight: true });
    
    /**
     * return the txSig, and if there are any cleanupInstructions send the cleanupTransaction transaction
     */
    return { txSig, cleanupSig: cleanupTransaction !== undefined ? await sendAndConfirmTransaction(connection, cleanupTransaction, [], { skipPreflight: true }) : undefined };
}

async function getPayer(connection: Connection) {
    try {
        const airdropSignature = await connection.requestAirdrop(CUSTOMER_WALLET.publicKey, LAMPORTS_PER_SOL * 2);
        await connection.confirmTransaction(airdropSignature);
    } catch (error) {
        // Fail silently
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return;
}
