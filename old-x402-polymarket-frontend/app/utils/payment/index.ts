/**
 * Payment Module - Main Export
 *
 * Centralized exports for all payment functionality.
 * Supports multiple payment providers (wallets, Stripe, etc.)
 */

// Types
export type {
  Currency,
  PaymentAmount,
  PaymentMetadata,
  BasePaymentProvider,
  CreatePaymentParams,
  PaymentIntent,
  PaymentResult,
  PaymentReceipt,
  PaymentError as PaymentErrorType,
  PaymentProviderConfig,
  WalletPaymentConfig,
  StripePaymentConfig,
  PayPalPaymentConfig,
  MultiPaymentConfig,
  PaymentMethod,
} from './types';

export {
  PaymentProviderType,
  PaymentStatus,
} from './types';

// Errors
export {
  PaymentError,
  PaymentInitializationError,
  PaymentCreationError,
  PaymentExecutionError,
  PaymentCancelledError,
  PaymentProviderNotSupportedError,
  PaymentValidationError,
  isPaymentError,
  formatPaymentError,
} from './errors';

// Providers
export { WalletPaymentProvider } from './providers/WalletPaymentProvider';
export { StripePaymentProvider } from './providers/StripePaymentProvider';

// Payment Manager
export { PaymentManager, createPaymentManager } from './PaymentManager';
