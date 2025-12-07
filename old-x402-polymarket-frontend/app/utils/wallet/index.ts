/**
 * Wallet Module - Main Export
 *
 * Centralized exports for all wallet functionality.
 */

// Types
export type {
  BaseWallet,
  EVMWallet,
  SolanaWallet,
  Wallet,
  TransactionResult,
  EVMNetworkConfig,
  SolanaNetworkConfig,
  WalletEvent,
  WalletEventListener,
  PaymentConfig,
  WalletProviderConfig,
} from './types';

export {
  BlockchainType,
  WalletConnectionState,
  WalletEventType,
} from './types';

// Errors
export {
  WalletError,
  WalletConnectionError,
  WalletSignatureError,
  WalletTransactionError,
  WalletNetworkError,
  WalletNotSupportedError,
  isWalletError,
  formatWalletError,
} from './errors';

// Constants
export {
  EVM_NETWORKS,
  SOLANA_NETWORKS,
  DEFAULT_CONFIG,
  LAMPORTS_PER_SOL,
  TOKEN_DECIMALS,
} from './constants';

// Utilities
export {
  EVMWalletUtils,
  SolanaWalletUtils,
  WalletUtils,
} from './utils';
