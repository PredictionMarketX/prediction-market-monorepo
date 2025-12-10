/**
 * Utility functions for Solana adapter
 */
import { Connection, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import type { Market } from '@/types';
import { LP_PENALTY_THRESHOLDS } from './constants';

/**
 * Check if an Associated Token Account exists
 */
export async function checkAtaExists(
  connection: Connection,
  ata: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(ata);
  return info !== null;
}

/**
 * Create instruction to create ATA if it doesn't exist
 */
export function createAtaInstructionIfNeeded(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  allowOwnerOffCurve = false
) {
  const ata = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
  return {
    ata,
    createInstruction: createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
  };
}

/**
 * Calculate early exit penalty based on holding period
 */
export function calculateEarlyExitPenalty(holdingDays: number): number {
  if (holdingDays < LP_PENALTY_THRESHOLDS.HIGH.days) {
    return LP_PENALTY_THRESHOLDS.HIGH.percent;
  } else if (holdingDays < LP_PENALTY_THRESHOLDS.MEDIUM.days) {
    return LP_PENALTY_THRESHOLDS.MEDIUM.percent;
  } else if (holdingDays < LP_PENALTY_THRESHOLDS.LOW.days) {
    return LP_PENALTY_THRESHOLDS.LOW.percent;
  }
  return 0;
}

/**
 * Get market status from account data
 */
export function getMarketStatus(account: any): 'active' | 'paused' | 'resolved' {
  if (account.isCompleted) return 'resolved';
  if (account.marketPaused) return 'paused';
  if (account.status?.active) return 'active';
  if (account.status?.paused) return 'paused';
  if (account.status?.resolved) return 'resolved';
  return 'active';
}

/**
 * Calculate LMSR price for a token type
 */
export function calculateLmsrPrice(account: any, tokenType: 'yes' | 'no'): number {
  const rawB = (account.lmsrB || account.lmsr_b || account.bParameter)?.toNumber() || 500000000;
  const rawQYes = (account.lmsrQYes || account.lmsr_q_yes || account.qYes)?.toNumber() || 0;
  const rawQNo = (account.lmsrQNo || account.lmsr_q_no || account.qNo)?.toNumber() || 0;

  const b = rawB / 1e6;
  const qYes = rawQYes / 1e6;
  const qNo = rawQNo / 1e6;

  const expYes = Math.exp(qYes / b);
  const expNo = Math.exp(qNo / b);
  const total = expYes + expNo;

  if (tokenType === 'yes') {
    return total > 0 ? expYes / total : 0.5;
  } else {
    return total > 0 ? expNo / total : 0.5;
  }
}

/**
 * Format market account data into Market type
 */
export function formatMarketAccount(publicKey: PublicKey, account: any): Market {
  const createdAtSeconds = account.createdAt?.toNumber() || 0;
  const createdAtMs = createdAtSeconds > 0 ? createdAtSeconds * 1000 : Date.now();

  const yesPrice = calculateLmsrPrice(account, 'yes');
  const noPrice = calculateLmsrPrice(account, 'no');

  const poolCollateralReserve = ((account.poolCollateralReserve || account.totalLiquidity)?.toNumber() || 0) / 1e6;
  const poolYesReserve = ((account.poolYesReserve)?.toNumber() || 0) / 1e6;
  const poolNoReserve = ((account.poolNoReserve)?.toNumber() || 0) / 1e6;
  const totalLpShares = ((account.totalLpShares)?.toNumber() || 0) / 1e6;

  const yesValue = poolYesReserve * yesPrice;
  const noValue = poolNoReserve * noPrice;
  const totalPoolValue = poolCollateralReserve + yesValue + noValue;

  return {
    address: publicKey.toBase58(),
    name: account.displayName || account.name || '',
    metadataUri: account.metadataUri || account.yesUri || '',
    creator: account.creator?.toBase58() || '',
    yesMint: (account.yesTokenMint || account.yesMint)?.toBase58() || '',
    noMint: (account.noTokenMint || account.noMint)?.toBase58() || '',
    collateralVault: account.collateralVault?.toBase58() || '',
    status: getMarketStatus(account),
    bParameter: (account.lmsrB || account.bParameter)?.toNumber() || 500,
    totalLiquidity: poolCollateralReserve,
    poolYesReserve,
    poolNoReserve,
    totalLpShares,
    totalPoolValue,
    yesPrice,
    noPrice,
    createdAt: createdAtMs,
  };
}
