/**
 * PDA (Program Derived Address) utilities for Solana program interactions
 */
import { PublicKey } from '@solana/web3.js';
import { solanaConfig } from './config';

// Metaplex Token Metadata Program ID
export const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export function getGlobalPDA(programId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(solanaConfig.seeds.GLOBAL)],
    new PublicKey(programId)
  );
}

export function getConfigPDA(programId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(solanaConfig.seeds.CONFIG)],
    new PublicKey(programId)
  );
}

export function getWhitelistPDA(creatorPubkey: PublicKey, programId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(solanaConfig.seeds.WHITELIST), creatorPubkey.toBytes()],
    new PublicKey(programId)
  );
}

export function getMarketPDAFromMints(yesToken: PublicKey, noToken: PublicKey, programId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(solanaConfig.seeds.MARKET), yesToken.toBytes(), noToken.toBytes()],
    new PublicKey(programId)
  );
}

export function getMetadataPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(),
      mint.toBytes(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
}

export function getUserInfoPDA(user: PublicKey, market: PublicKey, programId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(solanaConfig.seeds.USERINFO), user.toBytes(), market.toBytes()],
    new PublicKey(programId)
  );
}

export function getLPPositionPDA(market: PublicKey, user: PublicKey, programId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(solanaConfig.seeds.LP_POSITION), market.toBytes(), user.toBytes()],
    new PublicKey(programId)
  );
}

export function getMarketUsdcVaultPDA(market: PublicKey, programId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(solanaConfig.seeds.MARKET_USDC_VAULT), market.toBytes()],
    new PublicKey(programId)
  );
}
