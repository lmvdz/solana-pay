import {
  createApproveInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createRevokeInstruction,
  MintLayout,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { ConfirmOptions, Connection, Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_RENT_PUBKEY, SYSVAR_SLOT_HASHES_PUBKEY, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Wallet } from "@zetamarkets/sdk";

import { CANDY_MACHINE_PROGRAM, SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID } from "./constants";

import pkg from '@project-serum/anchor';
const { Program, Provider } = pkg;

export interface CandyMachine {
  id: PublicKey,
  connection: Connection;
  program: pkg.Program;
}

interface CandyMachineState {
  state: any,
  candyMachine: CandyMachine;
  itemsAvailable: number;
  itemsRedeemed: number;
  itemsRemaining: number;
  goLiveDate: Date,
}

export const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: PublicKey,
  payer: PublicKey,
  walletAddress: PublicKey,
  splTokenMintAddress: PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

export const getCandyMachineState = async (
  candyMachineId: PublicKey,
  connection: Connection,
  wallet: Wallet
): Promise<CandyMachineState> => {

  const provider = new Provider(connection, wallet, { preflightCommitment: 'processed' });

  const idl = await Program.fetchIdl(
    CANDY_MACHINE_PROGRAM, provider
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const program = new Program(idl!, CANDY_MACHINE_PROGRAM, provider);

  const candyMachine = {
    id: candyMachineId,
    connection,
    program,
  }

  const state: any = await program.account.candyMachine.fetch(candyMachineId);

  const itemsAvailable = state.data.itemsAvailable.toNumber();
  const itemsRedeemed = state.itemsRedeemed.toNumber();
  const itemsRemaining = itemsAvailable - itemsRedeemed;

  let goLiveDate = state.data.goLiveDate.toNumber();
  goLiveDate = new Date(goLiveDate * 1000);

  return {
    state,
    candyMachine,
    itemsAvailable,
    itemsRedeemed,
    itemsRemaining,
    goLiveDate,
  };
}

export const getMasterEdition = async (
  mint: PublicKey
): Promise<PublicKey> => {
  return (
    await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

export const getMetadata = async (
  mint: PublicKey
): Promise<PublicKey> => {
  return (
    await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

export const getTokenWallet = async (
  wallet: PublicKey,
  mint: PublicKey
) => {
  return (
    await PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )
  )[0];
};

export const getCandyMachineCreator = async (
  candyMachine: PublicKey,
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [Buffer.from('candy_machine'), candyMachine.toBuffer()],
    CANDY_MACHINE_PROGRAM,
  );
};

export const getAtaForMint = async (
  mint: PublicKey,
  buyer: PublicKey,
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  );
};

export const getCollectionPDA = async (
  candyMachineAddress: PublicKey,
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [Buffer.from('collection'), candyMachineAddress.toBuffer()],
    CANDY_MACHINE_PROGRAM,
  );
};


export const getCollectionAuthorityRecordPDA = async (
  mint: PublicKey,
  newAuthority: PublicKey,
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from('collection_authority'),
      newAuthority.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
};


export const mintOneToken = async (
  candyMachineState: CandyMachineState,
  userWallet: Wallet,
): Promise<{ instructions: Array<TransactionInstruction>, cleanupInstructions: Array<TransactionInstruction>, signers: Array<Keypair> }> => {

  const mint = Keypair.generate();
  const token = await getTokenWallet(userWallet.publicKey, mint.publicKey);
  const { connection, program } = candyMachineState.candyMachine;
  const metadata = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);


  const remainingAccounts = [];
  const signers = [mint, userWallet.payer];
  const cleanupInstructions = [];

  const instructions = [
    SystemProgram.createAccount({
      fromPubkey: userWallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MintLayout.span,
      lamports: await connection.getMinimumBalanceForRentExemption(
        MintLayout.span
      ),
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mint.publicKey,
      0,
      userWallet.publicKey,
      userWallet.publicKey,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountInstruction(
      token,
      userWallet.publicKey,
      userWallet.publicKey,
      mint.publicKey
    ),
    createMintToInstruction(
      
      mint.publicKey,
      token,
      userWallet.publicKey,
      1,
      [],
      TOKEN_PROGRAM_ID,
    ),
  ]
  if ((candyMachineState.state as any).data.whitelistMintSettings) {
    const mint = new PublicKey(
      (candyMachineState.state as any).data.whitelistMintSettings.mint,
    );

    const whitelistToken = (
      await getAtaForMint(mint, userWallet.publicKey)
    )[0];

    remainingAccounts.push({
      pubkey: whitelistToken,
      isWritable: true,
      isSigner: false,
    });

    if ((candyMachineState.state as any).data.whitelistMintSettings.mode.burnEveryTime) {
      const whitelistBurnAuthority = Keypair.generate();

      remainingAccounts.push({
        pubkey: mint,
        isWritable: true,
        isSigner: false,
      });
      remainingAccounts.push({
        pubkey: whitelistBurnAuthority.publicKey,
        isWritable: false,
        isSigner: true,
      });
      signers.push(whitelistBurnAuthority);
      const exists = await connection.getAccountInfo(
        whitelistToken,
      );
      if (exists) {
        instructions.push(
          createApproveInstruction(
            whitelistToken,
            whitelistBurnAuthority.publicKey,
            userWallet.publicKey,
            1,
            [],
            TOKEN_PROGRAM_ID,
          ),
        );
        cleanupInstructions.push(
          createRevokeInstruction(
            whitelistToken,
            userWallet.publicKey,
            [],
            TOKEN_PROGRAM_ID,
          ),
        );
      }
    }
  }

  let tokenAccount;
  if ((candyMachineState.state as any).tokenMint) {
    const transferAuthority = Keypair.generate();

    tokenAccount = await getTokenWallet(
      userWallet.publicKey,
      (candyMachineState.state as any).tokenMint,
    );

    remainingAccounts.push({
      pubkey: tokenAccount,
      isWritable: true,
      isSigner: false,
    });
    remainingAccounts.push({
      pubkey: transferAuthority.publicKey,
      isWritable: false,
      isSigner: true,
    });

    instructions.push(
      createApproveInstruction(
        tokenAccount,
        transferAuthority.publicKey,
        userWallet.publicKey,
        (candyMachineState.state as any).data.price.toNumber(),
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    signers.push(transferAuthority);
    cleanupInstructions.push(
      createRevokeInstruction(
        tokenAccount,
        userWallet.publicKey,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }


  const collectionPDA = (await getCollectionPDA(candyMachineState.candyMachine.id))[0];
  const collectionPDAAccount =
    await connection.getAccountInfo(collectionPDA);

  if (collectionPDAAccount) {
    try {
      const collectionMint = (await program.account.collectionPda.fetch(
        collectionPDA,
      )) as { mint: PublicKey };
      const collectionAuthorityRecord = (
        await getCollectionAuthorityRecordPDA(
          collectionMint.mint,
          collectionPDA,
        )
      )[0];
      if (collectionMint) {
        const collectionMetadata = await getMetadata(collectionMint.mint);
        const collectionMasterEdition = await getMasterEdition(
          collectionMint.mint,
        );
        remainingAccounts.push(
          ...[
            {
              pubkey: collectionPDA,
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: collectionMint.mint,
              isWritable: false,
              isSigner: false,
            },
            {
              pubkey: collectionMetadata,
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: collectionMasterEdition,
              isWritable: false,
              isSigner: false,
            },
            {
              pubkey: collectionAuthorityRecord,
              isWritable: false,
              isSigner: false,
            },
          ],
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  const [candyMachineCreator, creatorBump] = (await getCandyMachineCreator(candyMachineState.candyMachine.id));

  const accounts = {
    candyMachine: candyMachineState.candyMachine.id,
    candyMachineCreator,
    payer: userWallet.publicKey,
    wallet: candyMachineState.state.wallet,
    mint: mint.publicKey,
    metadata,
    masterEdition,
    mintAuthority: userWallet.publicKey,
    updateAuthority: userWallet.publicKey,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
    recentBlockhashes: SYSVAR_SLOT_HASHES_PUBKEY,
    instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
  };

  const instr = await program.instruction.mintNft(creatorBump, {
    accounts,
    remainingAccounts: remainingAccounts.length > 0 ? remainingAccounts : undefined
  });

  instructions.push(
    instr
  );
  
  return { instructions, cleanupInstructions, signers };

}

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};