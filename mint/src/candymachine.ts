import * as anchor from "@project-serum/anchor";

import {
  createInitializeMintInstruction,
  createMintToInstruction,
  MintLayout,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";

import { CANDY_MACHINE_PROGRAM, SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID } from "./constants";

export interface CandyMachine {
  id: anchor.web3.PublicKey,
  connection: anchor.web3.Connection;
  program: anchor.Program;
}

interface CandyMachineState {
  candyMachine: CandyMachine;
  itemsAvailable: number;
  itemsRedeemed: number;
  itemsRemaining: number;
  goLiveDate: Date,
}

export const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

export const getCandyMachineState = async (
  candyMachineId: anchor.web3.PublicKey,
  connection: anchor.web3.Connection,
): Promise<CandyMachineState> => {


  const idl = await anchor.Program.fetchIdl(
    CANDY_MACHINE_PROGRAM
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const program = new anchor.Program(idl!, CANDY_MACHINE_PROGRAM);

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

  console.log({
    itemsAvailable,
    itemsRedeemed,
    itemsRemaining,
    goLiveDate,
  })

  return {
    candyMachine,
    itemsAvailable,
    itemsRedeemed,
    itemsRemaining,
    goLiveDate,
  };
}

export const getMasterEdition = async (
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
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
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
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
  wallet: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
) => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )
  )[0];
};

export const mintOneToken = async (
  candyMachine: CandyMachine,
  config: anchor.web3.PublicKey, // feels like this should be part of candyMachine?
  payer: anchor.web3.PublicKey,
  treasury: anchor.web3.PublicKey,
): Promise<string> => {
  const mint = anchor.web3.Keypair.generate();
  const token = await getTokenWallet(payer, mint.publicKey);
  const { connection, program } = candyMachine;
  const metadata = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);

  const rent = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span
  );

  return await program.rpc.mintNft({
    accounts: {
      config,
      candyMachine: candyMachine.id,
      payer: payer,
      wallet: treasury,
      mint: mint.publicKey,
      metadata,
      masterEdition,
      mintAuthority: payer,
      updateAuthority: payer,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    },
    signers: [mint],
    instructions: [
      anchor.web3.SystemProgram.createAccount({
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
}

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};