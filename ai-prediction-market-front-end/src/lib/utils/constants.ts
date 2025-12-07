// Application constants

export const APP_NAME = 'AI Prediction Market';

// Trading
export const DEFAULT_SLIPPAGE = 5; // 5%
export const MIN_SLIPPAGE = 0.1;
export const MAX_SLIPPAGE = 50;

// Market creation
export const MARKET_CREATION_FEE = 1.0; // USDC
export const DEFAULT_B_PARAMETER = 500;
export const MIN_B_PARAMETER = 1;
export const MAX_B_PARAMETER = 10000;

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// Timeouts
export const TRANSACTION_TIMEOUT = 60000; // 60 seconds
export const API_TIMEOUT = 30000; // 30 seconds

// Decimals
export const USDC_DECIMALS = 6;
export const TOKEN_DECIMALS = 6;

// Routes
export const ROUTES = {
  HOME: '/',
  MARKETS: '/markets',
  MARKET_DETAIL: (address: string) => `/markets/${address}`,
  CREATE_MARKET: '/markets/create',
  PORTFOLIO: '/portfolio',
  ADMIN: '/admin',
  ADMIN_INITIALIZE: '/admin/initialize',
} as const;

// External links
export const EXTERNAL_LINKS = {
  SOLANA_EXPLORER: (signature: string, network: string) =>
    `https://explorer.solana.com/tx/${signature}${network === 'devnet' ? '?cluster=devnet' : ''}`,
  SOLSCAN: (signature: string, network: string) =>
    `https://solscan.io/tx/${signature}${network === 'devnet' ? '?cluster=devnet' : ''}`,
} as const;
