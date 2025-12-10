/**
 * Solana blockchain adapter module
 */

// Main adapter
export { SolanaAdapter, getSolanaAdapter } from './client';

// Constants
export { USDC_DECIMALS, USDC_MULTIPLIER, COMPUTE_BUDGET, TRANSACTION_DEFAULTS, LP_PENALTY_THRESHOLDS } from './constants';

// PDA utilities
export {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  getGlobalPDA,
  getConfigPDA,
  getWhitelistPDA,
  getMarketPDAFromMints,
  getMetadataPDA,
  getUserInfoPDA,
  getLPPositionPDA,
  getMarketUsdcVaultPDA,
} from './pda';

// Utility functions
export {
  checkAtaExists,
  createAtaInstructionIfNeeded,
  calculateEarlyExitPenalty,
  getMarketStatus,
  calculateLmsrPrice,
  formatMarketAccount,
} from './utils';

// Config
export { solanaConfig } from './config';
