import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import type { PredictionMarket } from './types';
import IDL from './prediction_market.json';

/**
 * Prediction Market Program Configuration
 */
export const PROGRAM_CONFIG = {
  programId: new PublicKey('78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR'),
  programDataAddress: new PublicKey('3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq'),
  authority: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),
  network: 'devnet' as const,
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
};

/**
 * PDA Seeds for account derivation
 */
export const PDA_SEEDS = {
  CONFIG: Buffer.from('config'),
  GLOBAL: Buffer.from('global'),
  MARKET: Buffer.from('market'),
  USERINFO: Buffer.from('userinfo'),
  METADATA: Buffer.from('metadata'),
  WHITELIST: Buffer.from('wl-seed'),
} as const;

/**
 * Token names used in the program
 */
export const TOKEN_NAMES = {
  YES: 'agree',
  NO: 'disagree',
} as const;

/**
 * Get Prediction Market Program instance
 */
export function getPredictionMarketProgram(
  connection: Connection,
  wallet: any
): Program<PredictionMarket> {
  const provider = new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions()
  );

  return new Program(IDL as PredictionMarket, provider);
}

/**
 * PDA Derivation Helpers
 */
export class PDAHelper {
  /**
   * Get Config PDA
   */
  static getConfigPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.CONFIG],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get Global Vault PDA
   */
  static getGlobalVaultPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.GLOBAL],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get Market PDA
   */
  static getMarketPDA(yesToken: PublicKey, noToken: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.MARKET,
        yesToken.toBuffer(),
        noToken.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get UserInfo PDA
   */
  static getUserInfoPDA(user: PublicKey, market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.USERINFO,
        user.toBuffer(),
        market.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get Whitelist PDA
   */
  static getWhitelistPDA(creator: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        PDA_SEEDS.WHITELIST,
        creator.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }

  /**
   * Get LP Position PDA
   */
  static getLPPositionPDA(user: PublicKey, market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('lp_position'),
        user.toBuffer(),
        market.toBuffer(),
      ],
      PROGRAM_CONFIG.programId
    );
  }
}

/**
 * Format amounts for display (USDC has 6 decimals)
 */
export function formatUSDC(amount: BN | number): string {
  const num = typeof amount === 'number' ? amount : amount.toNumber();
  return (num / 1_000_000).toFixed(2);
}

/**
 * Parse USDC amount to smallest unit
 */
export function parseUSDC(amount: string | number): BN {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new BN(Math.floor(num * 1_000_000));
}

/**
 * Format percentage
 */
export function formatPercentage(numerator: BN | number, denominator: BN | number): string {
  const num = typeof numerator === 'number' ? numerator : numerator.toNumber();
  const denom = typeof denominator === 'number' ? denominator : denominator.toNumber();

  if (denom === 0) return '0.00';
  return ((num / denom) * 100).toFixed(2);
}
