import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddress, getMint, MintLayout, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction} from '@solana/spl-token';
import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { getCandyMachineState, getMasterEdition, getMetadata, getTokenWallet } from './candymachine';
import { MEMO_PROGRAM_ID, SOL_DECIMALS, TEN, TOKEN_METADATA_PROGRAM_ID } from './constants';

/**
 * Thrown when a valid transaction can't be created from the inputs provided.
 */
export class CreateTransactionError extends Error {
    name = 'CreateTransactionError';
}

/**
 * Optional parameters for creating a Solana Pay transaction.
 */
export interface CreatePayTransactionParams {
    /** `splToken` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#spl-token) */
    splToken?: PublicKey;
    /** `reference` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#reference) */
    reference?: PublicKey | PublicKey[];
    /** `memo` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#memo) */
    memo?: string;
}

export interface CreateMintTransactionParams {
    candymachineId: PublicKey, 
    config: PublicKey, 
    treasury: PublicKey
    /** `reference` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#reference) */
    reference?: PublicKey | PublicKey[];
    /** `memo` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#memo) */
    memo?: string;
}


/**
 * Create a Solana Mint transaction
 * @param {Connection} connection 
 * @param {PublicKey} payer 
 * @param {PublicKey} recipient 
 * @param {CreateMintTransactionParams} createMintTransactionParams 
 * @returns 
 */

export async function createMintTransaction(connection: Connection, payer: PublicKey, recipient: PublicKey, {  candymachineId, config, treasury, reference, memo } : CreateMintTransactionParams): Promise<Transaction> {
    // Check that the payer and recipient accounts exist
    const payerInfo = await connection.getAccountInfo(payer);
    if (!payerInfo) throw new CreateTransactionError('payer not found');

    const recipientInfo = await connection.getAccountInfo(recipient);
    if (!recipientInfo) throw new CreateTransactionError('recipient not found');

    const missingParams = [candymachineId, config, treasury].filter(param => param === undefined);
    if (missingParams.length > 0) {
        throw new CreateTransactionError(missingParams.join(', ') + ' undefined in CreateMintTransactionParams');
    }

    const candyMachineState = await getCandyMachineState(candymachineId, connection);
    const itemsAvailable = (await candyMachineState).itemsAvailable;
    if (itemsAvailable === 0) {
        throw new CreateTransactionError('No items left to mint!');
    }
    const mint = Keypair.generate();
    const token = await getTokenWallet(payer, mint.publicKey);
    const program = (await candyMachineState).candyMachine.program;
    const metadata = await getMetadata(mint.publicKey);
    const masterEdition = await getMasterEdition(mint.publicKey);

    const rent = await connection.getMinimumBalanceForRentExemption(
        MintLayout.span
    );

    const transactionIX = program.instruction.mintNft({
        accounts: {
            config,
            candyMachine: candyMachineState.candyMachine.id,
            payer: payer,
            wallet: treasury,
            mint: mint.publicKey,
            metadata,
            masterEdition,
            mintAuthority: payer,
            updateAuthority: payer,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [mint],
        instructions: [
            SystemProgram.createAccount({
                fromPubkey: payer,
                newAccountPubkey: mint.publicKey,
                space: MintLayout.span,
                lamports: rent,
                programId: TOKEN_PROGRAM_ID,
            }),
            createInitializeMintInstruction(
                mint.publicKey,
                0,
                payer,
                payer,
                TOKEN_PROGRAM_ID,
            ),
            createAssociatedTokenAccountInstruction(
                token,
                payer,
                payer,
                mint.publicKey
            ),
            createMintToInstruction(
                mint.publicKey,
                token,
                payer,
                1,
                [],
                TOKEN_PROGRAM_ID,
            ),
        ],
    });
    // If reference accounts are provided, add them to the transfer instruction
    if (reference) {
        if (!Array.isArray(reference)) {
            reference = [reference];
        }

        for (const pubkey of reference) {
            transactionIX.keys.push({ pubkey, isWritable: false, isSigner: false });
        }
    }
    const transaction = new Transaction();

    if (memo != null) {
        transaction.add(
            new TransactionInstruction({
                programId: MEMO_PROGRAM_ID,
                keys: [],
                data: Buffer.from(memo, 'utf8'),
            })
        );
    }

    transaction.add(transactionIX);
    
    return transaction;

}

/**
 * Create a Solana Pay transaction.
 *
 * **Reference** implementation for wallet providers.
 *
 * @param connection - A connection to the cluster.
 * @param payer - `PublicKey` of the payer.
 * @param recipient - `recipient` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#recipient)
 * @param amount - `amount` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#amount)
 * @param {CreateTransactionParams} createTransactionParams - Additional parameters
 * @param createTransactionParams.splToken
 * @param createTransactionParams.reference
 * @param createTransactionParams.memo
 */
export async function createPayTransaction(
    connection: Connection,
    payer: PublicKey,
    recipient: PublicKey,
    amount: BigNumber,
    { splToken, reference, memo }: CreatePayTransactionParams = {}
): Promise<Transaction> {
    // Check that the payer and recipient accounts exist
    const payerInfo = await connection.getAccountInfo(payer);
    if (!payerInfo) throw new CreateTransactionError('payer not found');

    const recipientInfo = await connection.getAccountInfo(recipient);
    if (!recipientInfo) throw new CreateTransactionError('recipient not found');

    // A native SOL or SPL token transfer instruction
    let instruction: TransactionInstruction;

    // If no SPL token mint is provided, transfer native SOL
    if (!splToken) {
        // Check that the payer and recipient are valid native accounts
        if (!payerInfo.owner.equals(SystemProgram.programId)) throw new CreateTransactionError('payer owner invalid');
        if (payerInfo.executable) throw new CreateTransactionError('payer executable');
        if (!recipientInfo.owner.equals(SystemProgram.programId))
            throw new CreateTransactionError('recipient owner invalid');
        if (recipientInfo.executable) throw new CreateTransactionError('recipient executable');

        // Check that the amount provided doesn't have greater precision than SOL
        if (amount.decimalPlaces() > SOL_DECIMALS) throw new CreateTransactionError('amount decimals invalid');

        // Convert input decimal amount to integer lamports
        amount = amount.times(LAMPORTS_PER_SOL).integerValue(BigNumber.ROUND_FLOOR);

        // Check that the payer has enough lamports
        const lamports = amount.toNumber();
        if (lamports > payerInfo.lamports) throw new CreateTransactionError('insufficient funds');

        // Create an instruction to transfer native SOL
        instruction = SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: recipient,
            lamports,
        });
    }
    // Otherwise, transfer SPL tokens from payer's ATA to recipient's ATA
    else {
        // Check that the token provided is an initialized mint
        const mint = await getMint(connection, splToken);
        if (!mint.isInitialized) throw new CreateTransactionError('mint not initialized');

        // Check that the amount provided doesn't have greater precision than the mint
        if (amount.decimalPlaces() > mint.decimals) throw new CreateTransactionError('amount decimals invalid');

        // Convert input decimal amount to integer tokens according to the mint decimals
        amount = amount.times(TEN.pow(mint.decimals)).integerValue(BigNumber.ROUND_FLOOR);

        // Get the payer's ATA and check that the account exists and can send tokens
        const payerATA = await getAssociatedTokenAddress(splToken, payer);
        const payerAccount = await getAccount(connection, payerATA);
        if (!payerAccount.isInitialized) throw new CreateTransactionError('payer not initialized');
        if (payerAccount.isFrozen) throw new CreateTransactionError('payer frozen');

        // Get the recipient's ATA and check that the account exists and can receive tokens
        const recipientATA = await getAssociatedTokenAddress(splToken, recipient);
        const recipientAccount = await getAccount(connection, recipientATA);
        if (!recipientAccount.isInitialized) throw new CreateTransactionError('recipient not initialized');
        if (recipientAccount.isFrozen) throw new CreateTransactionError('recipient frozen');

        // Check that the payer has enough tokens
        const tokens = BigInt(String(amount));
        if (tokens > payerAccount.amount) throw new CreateTransactionError('insufficient funds');

        // Create an instruction to transfer SPL tokens, asserting the mint and decimals match
        instruction = createTransferCheckedInstruction(payerATA, splToken, recipientATA, payer, tokens, mint.decimals);
    }

    // If reference accounts are provided, add them to the transfer instruction
    if (reference) {
        if (!Array.isArray(reference)) {
            reference = [reference];
        }

        for (const pubkey of reference) {
            instruction.keys.push({ pubkey, isWritable: false, isSigner: false });
        }
    }

    // Create the transaction
    const transaction = new Transaction();

    // If a memo is provided, add it to the transaction before adding the transfer instruction
    if (memo != null) {
        transaction.add(
            new TransactionInstruction({
                programId: MEMO_PROGRAM_ID,
                keys: [],
                data: Buffer.from(memo, 'utf8'),
            })
        );
    }

    // Add the transfer instruction to the transaction
    transaction.add(instruction);

    return transaction;
}
