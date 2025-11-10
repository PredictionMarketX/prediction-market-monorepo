/**
 * Payment Types
 *
 * Abstract payment interfaces supporting multiple payment providers.
 * This allows seamless integration of different payment methods (crypto wallets, Stripe, etc.)
 */

/**
 * Supported payment provider types
 */
export enum PaymentProviderType {
  WALLET = 'wallet',        // Crypto wallet payments (EVM/Solana)
  STRIPE = 'stripe',        // Stripe credit card payments
  PAYPAL = 'paypal',        // PayPal payments
  CUSTOM = 'custom',        // Custom payment integrations
}

/**
 * Payment status
 */
export enum PaymentStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Currency type
 */
export interface Currency {
  code: string;           // e.g., 'USD', 'ETH', 'SOL'
  symbol: string;         // e.g., '$', 'Ξ', '◎'
  decimals: number;
  type: 'fiat' | 'crypto';
}

/**
 * Payment amount with currency
 */
export interface PaymentAmount {
  value: string | number;
  currency: Currency;
  displayValue?: string;  // Formatted display value
}

/**
 * Payment metadata
 */
export interface PaymentMetadata {
  orderId?: string;
  productId?: string;
  customerId?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Base payment provider interface
 * All payment providers must implement this interface
 */
export interface BasePaymentProvider {
  type: PaymentProviderType;
  name: string;
  enabled: boolean;

  /**
   * Initialize the payment provider
   */
  initialize(): Promise<void>;

  /**
   * Create a payment intent/session
   */
  createPayment(params: CreatePaymentParams): Promise<PaymentIntent>;

  /**
   * Confirm and execute the payment
   */
  confirmPayment(intentId: string): Promise<PaymentResult>;

  /**
   * Cancel a pending payment
   */
  cancelPayment(intentId: string): Promise<void>;

  /**
   * Get payment status
   */
  getPaymentStatus(intentId: string): Promise<PaymentStatus>;

  /**
   * Cleanup resources
   */
  cleanup?(): Promise<void>;
}

/**
 * Parameters for creating a payment
 */
export interface CreatePaymentParams {
  amount: PaymentAmount;
  recipient?: string;       // Recipient address/account
  metadata?: PaymentMetadata;
  returnUrl?: string;       // URL to return after payment
  cancelUrl?: string;       // URL to return on cancel
}

/**
 * Payment intent (created before execution)
 */
export interface PaymentIntent {
  id: string;
  status: PaymentStatus;
  amount: PaymentAmount;
  provider: PaymentProviderType;
  createdAt: number;
  expiresAt?: number;
  metadata?: PaymentMetadata;
  clientSecret?: string;    // For Stripe, etc.
  paymentUrl?: string;      // For redirect-based payments
}

/**
 * Payment result (after execution)
 */
export interface PaymentResult {
  success: boolean;
  intentId: string;
  transactionId?: string;   // Blockchain tx hash or payment processor ID
  status: PaymentStatus;
  amount: PaymentAmount;
  provider: PaymentProviderType;
  timestamp: number;
  receipt?: PaymentReceipt;
  error?: PaymentError;
}

/**
 * Payment receipt/confirmation
 */
export interface PaymentReceipt {
  receiptId: string;
  transactionId: string;
  amount: PaymentAmount;
  provider: PaymentProviderType;
  timestamp: number;
  recipient?: string;
  sender?: string;
  metadata?: PaymentMetadata;
  receiptUrl?: string;      // URL to view receipt
}

/**
 * Payment error details
 */
export interface PaymentError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Payment provider configuration
 */
export interface PaymentProviderConfig<T = unknown> {
  type: PaymentProviderType;
  enabled: boolean;
  config: T;
}

/**
 * Wallet payment provider specific config
 */
export interface WalletPaymentConfig {
  supportedChains: ('evm' | 'solana')[];
  defaultChain: 'evm' | 'solana';
}

/**
 * Stripe payment provider specific config
 */
export interface StripePaymentConfig {
  publishableKey: string;
  apiVersion?: string;
  currency?: string;
}

/**
 * PayPal payment provider specific config
 */
export interface PayPalPaymentConfig {
  clientId: string;
  currency?: string;
  environment?: 'sandbox' | 'production';
}

/**
 * Multi-provider payment configuration
 */
export interface MultiPaymentConfig {
  defaultProvider: PaymentProviderType;
  providers: {
    wallet?: PaymentProviderConfig<WalletPaymentConfig>;
    stripe?: PaymentProviderConfig<StripePaymentConfig>;
    paypal?: PaymentProviderConfig<PayPalPaymentConfig>;
    [key: string]: PaymentProviderConfig | undefined;
  };
}

/**
 * Payment method selection
 */
export interface PaymentMethod {
  id: string;
  type: PaymentProviderType;
  name: string;
  description?: string;
  icon?: string;
  supported: boolean;
  recommended?: boolean;
}
