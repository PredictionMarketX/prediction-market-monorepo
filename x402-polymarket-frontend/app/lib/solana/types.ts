import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

/**
 * Market outcome types
 */
export enum MarketOutcome {
  Invalid = 0,
  Yes = 1,
  No = 2,
}

/**
 * Market status
 */
export enum MarketStatus {
  Active = 0,
  Paused = 1,
  Resolved = 2,
}

/**
 * Trade direction
 */
export enum TradeDirection {
  Buy = 0,
  Sell = 1,
}

/**
 * Token type
 */
export enum TokenType {
  Yes = 0,
  No = 1,
}

/**
 * Market data structure
 */
export interface Market {
  yesToken: PublicKey;
  noToken: PublicKey;
  creator: PublicKey;
  yesReserve: BN;
  noReserve: BN;
  usdcReserve: BN;
  lpShares: BN;
  lmsrB: BN;
  outcome: MarketOutcome;
  status: MarketStatus;
  resolutionTime: BN;
  startSlot: BN;
  endingSlot: BN;
  totalYesMinted: BN;
  totalNoMinted: BN;
  totalFeesCollected: BN;
}

/**
 * Global config structure
 */
export interface Config {
  admin: PublicKey;
  teamWallet: PublicKey;
  swapFee: number;
  lpFee: number;
  emergencyStop: boolean;
  usdcMint: PublicKey;
  tokenDecimalsConfig: number;
  whitelistEnabled: boolean;
}

/**
 * User position info
 */
export interface UserInfo {
  market: PublicKey;
  user: PublicKey;
  yesAmount: BN;
  noAmount: BN;
  lpShares: BN;
  realizedPnl: BN;
}

/**
 * LP Position info
 */
export interface LPPosition {
  market: PublicKey;
  owner: PublicKey;
  lpShares: BN;
  depositTime: BN;
  initialUsdcValue: BN;
}

/**
 * Market creation parameters
 */
export interface CreateMarketParams {
  yesSymbol: string;
  yesUri: string;
  startSlot?: number;
  endingSlot?: number;
  lmsrB?: number;
}

/**
 * Swap parameters
 */
export interface SwapParams {
  market: PublicKey;
  tokenType: TokenType;
  direction: TradeDirection;
  amount: number; // in USDC
  minOutput?: number; // slippage protection
}

/**
 * Add liquidity parameters
 */
export interface AddLiquidityParams {
  market: PublicKey;
  usdcAmount: number;
}

/**
 * Withdraw liquidity parameters
 */
export interface WithdrawLiquidityParams {
  market: PublicKey;
  lpSharesAmount: number;
}

/**
 * Mint complete set parameters
 */
export interface MintCompleteSetParams {
  market: PublicKey;
  usdcAmount: number;
}

/**
 * Redeem complete set parameters
 */
export interface RedeemCompleteSetParams {
  market: PublicKey;
  amount: number; // number of sets to redeem
}

/**
 * Market statistics
 */
export interface MarketStats {
  totalLiquidity: number; // in USDC
  yesPrice: number; // percentage 0-100
  noPrice: number; // percentage 0-100
  volume24h: number; // in USDC
  totalVolume: number; // in USDC
  tvl: number; // total value locked in USDC
}

/**
 * Transaction result
 */
export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}

/**
 * Market list item (for UI display)
 */
export interface MarketListItem {
  address: PublicKey;
  question: string;
  yesPrice: number;
  noPrice: number;
  totalLiquidity: number;
  volume: number;
  endDate: Date;
  status: MarketStatus;
  outcome?: MarketOutcome;
}

// Re-export for convenience
export type { PredictionMarket } from './prediction_market';
