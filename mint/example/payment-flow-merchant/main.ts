import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import {
    encodePayURL,
    findTransactionSignature,
    FindTransactionSignatureError,
    validatePayTransactionSignature,
} from '../../src';
import { MERCHANT_WALLET } from './constants';
import { establishConnection } from './establishConnection';
import { simulateCheckout } from './simulateCheckout';
import { simulateWalletInteraction } from './simulateWalletInteraction';

async function main() {
    console.log("Let's simulate a Solana Pay flow ... \n");
    let paymentStatus: string;

    console.log('1. ✅ Establish connection to the cluster');
    const connection = await establishConnection();

    /**
     * Simulate a checkout experience
     *
     * Recommendation:
     * `amount` and `reference` should be created in a trusted environment (server).
     * The `reference` should be unique to a single customer session,
     * and will be used to find and validate the payment in the future.
     *
     * Read our [getting started guide](#getting-started) for more information on the parameters.
     */
    console.log('\n2. 🛍 Simulate a customer checkout \n');
    const { label, message, memo, amount, reference } = await simulateCheckout();

    /**
     * Create a payment request link
     *
     * Solana Pay uses a standard URL scheme across wallets for native SOL and SPL Token payments.
     * Several parameters are encoded within the link representing an intent to collect payment from a customer.
     */
    console.log('3. 💰 Create a payment request link \n');
    const url = encodePayURL({ recipient: MERCHANT_WALLET, amount, reference, label, message, memo });

    /**
     * Simulate wallet interaction
     *
     * This is only for example purposes. This interaction will be handled by a wallet provider
     */
    console.log('4. 🔐 Simulate wallet interaction \n');
    simulateWalletInteraction(connection, url);

    // Update payment status
    paymentStatus = 'pending';

    /**
     * Wait for payment to be confirmed
     *
     * When a customer approves the payment request in their wallet, this transaction exists on-chain.
     * You can use any references encoded into the payment link to find the exact transaction on-chain.
     * Important to note that we can only find the transaction when it's **confirmed**
     */
    console.log('\n5. Find the transaction');
    let signatureInfo;

    const { signature } = await new Promise((resolve, reject) => {
        /**
         * Retry until we find the transaction
         *
         * If a transaction with the given reference can't be found, the `findTransactionSignature`
         * function will throw an error. There are a few reasons why this could be a false negative:
         *
         * - Transaction is not yet confirmed
         * - Customer is yet to approve/complete the transaction
         *
         * You can implement a polling strategy to query for the transaction periodically.
         */
        const interval = setInterval(async () => {
            console.count('Checking for transaction...');
            try {
                signatureInfo = await findTransactionSignature(connection, reference, undefined, 'confirmed');
                console.log('\n 🖌  Signature found: ', signatureInfo.signature);
                clearInterval(interval);
                resolve(signatureInfo);
            } catch (error: any) {
                if (!(error instanceof FindTransactionSignatureError)) {
                    console.error(error);
                    clearInterval(interval);
                    reject(error);
                }
            }
        }, 250);
    });

    // Update payment status
    paymentStatus = 'confirmed';

    /**
     * Validate transaction
     *
     * Once the `findTransactionSignature` function returns a signature,
     * it confirms that a transaction with reference to this order has been recorded on-chain.
     *
     * `validateTransactionSignature` allows you to validate that the transaction signature
     * found matches the transaction that you expected.
     */
    console.log('\n6. 🔗 Validate transaction \n');

    try {
        await validatePayTransactionSignature(
            connection,
            signature,
            MERCHANT_WALLET,
            amount,
            undefined,
            reference
        );

        // Update payment status
        paymentStatus = 'validated';
        console.log('✅ Payment validated');
        console.log('📦 Ship order to customer');
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
