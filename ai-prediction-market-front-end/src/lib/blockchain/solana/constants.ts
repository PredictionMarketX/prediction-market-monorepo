/**
 * Solana blockchain constants
 */

// USDC decimals constant
export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = 10 ** USDC_DECIMALS;

// Compute budget defaults
export const COMPUTE_BUDGET = {
  DEFAULT_UNITS: 600_000,
  SWAP_UNITS: 1_400_000,
  HEAP_BYTES: 256 * 1024,
} as const;

// Transaction defaults
export const TRANSACTION_DEFAULTS = {
  DEADLINE_SECONDS: 300, // 5 minutes
} as const;

// Early exit penalty thresholds (in days)
export const LP_PENALTY_THRESHOLDS = {
  HIGH: { days: 7, percent: 3.0 },     // 300 bps
  MEDIUM: { days: 14, percent: 1.5 },  // 150 bps
  LOW: { days: 30, percent: 0.5 },     // 50 bps
} as const;
