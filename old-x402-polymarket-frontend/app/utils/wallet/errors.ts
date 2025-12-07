/**
 * Wallet Error Classes
 *
 * Centralized error handling for wallet operations.
 * These errors provide specific context for different failure scenarios.
 */

/**
 * Base wallet error class
 */
export class WalletError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'WalletError';
  }
}

/**
 * Error thrown when wallet connection fails
 */
export class WalletConnectionError extends WalletError {
  constructor(message: string) {
    super(message, 'WALLET_CONNECTION_ERROR');
    this.name = 'WalletConnectionError';
  }
}

/**
 * Error thrown when message/transaction signing fails
 */
export class WalletSignatureError extends WalletError {
  constructor(message: string) {
    super(message, 'WALLET_SIGNATURE_ERROR');
    this.name = 'WalletSignatureError';
  }
}

/**
 * Error thrown when transaction execution fails
 */
export class WalletTransactionError extends WalletError {
  constructor(message: string) {
    super(message, 'WALLET_TRANSACTION_ERROR');
    this.name = 'WalletTransactionError';
  }
}

/**
 * Error thrown when network/chain switching fails
 */
export class WalletNetworkError extends WalletError {
  constructor(message: string) {
    super(message, 'WALLET_NETWORK_ERROR');
    this.name = 'WalletNetworkError';
  }
}

/**
 * Error thrown when wallet is not supported
 */
export class WalletNotSupportedError extends WalletError {
  constructor(message: string) {
    super(message, 'WALLET_NOT_SUPPORTED_ERROR');
    this.name = 'WalletNotSupportedError';
  }
}

/**
 * Type guard to check if an error is a wallet error
 */
export function isWalletError(error: unknown): error is WalletError {
  return error instanceof WalletError;
}

/**
 * Helper to format error messages consistently
 */
export function formatWalletError(error: unknown): string {
  if (isWalletError(error)) {
    return `${error.name}: ${error.message}${error.code ? ` (${error.code})` : ''}`;
  }
  return error instanceof Error ? error.message : String(error);
}
