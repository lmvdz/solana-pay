import {
    encodeMintURL,
    findTransactionSignature,
    FindTransactionSignatureError,
    validateCleanupMintTransactionSignature,
    validateMintTransactionSignature,
} from '../../src';

import { CUSTOMER_WALLET, MERCHANT_WALLET } from './constants';
import { establishConnection } from './establishConnection';
import { simulateMint } from './simulateMint';
import { simulateWalletInteraction } from './simulateWalletInteraction';

async function main() {
    console.log("Let's simulate a Solana Mint flow ... \n");

    console.log('1. ✅ Establish connection to the cluster');
    const connection = await establishConnection();

    /**
     * Simulate a mint experience
     *
     * The only thing we really need is the candymachineId
     *
     */
    console.log('\n2. 🛍 Simulate a nft mint \n');
    const { label, message, candymachineId } = await simulateMint();
    /**
     * Create a mint link
     *
     * Solana Pay uses a standard URL scheme across wallets for native SOL and SPL Token payments.
     * Several parameters are encoded within the link representing an intent to mint a nft.
     */
    console.log('3. 💰 Create a payment request link \n');
    const url = encodeMintURL({ recipient: MERCHANT_WALLET, candymachineId, label, message });

    console.log(url);
    /**
     * Simulate wallet interaction
     *
     * This is only for example purposes. This interaction will be handled by a wallet provider
     */
    console.log('4. 🔐 Simulate wallet interaction \n');

    const { txSig, cleanupSig } = await simulateWalletInteraction(connection, url);
    
    console.log(`\n6. 🔗 Validating transaction${cleanupSig !== undefined ? 's ' + txSig + ' ' + cleanupSig : ' ' + txSig} ${txSig} \n`);

    try {
        await validateMintTransactionSignature(
            connection,
            txSig,
            CUSTOMER_WALLET.publicKey,
            candymachineId
        );

        if (cleanupSig !== undefined) {
            await validateCleanupMintTransactionSignature(
                connection,
                cleanupSig,
                CUSTOMER_WALLET.publicKey,
                candymachineId
            );
        }
        console.log('✅ Payment validated');
        console.log('📦 NFT minted');
    } catch (error) {
        console.error('❌ Payment failed', error);
    }

}

main().then(
    () => process.exit(),
    (err) => {
        console.error(err);
        process.exit(-1);
    }
);
