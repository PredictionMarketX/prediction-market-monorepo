/**
 * Wallet Payment Provider
 *
 * Implementation of the payment provider interface for cryptocurrency wallets.
 * Supports both EVM and Solana payments.
 */

import {
  BasePaymentProvider,
  PaymentProviderType,
  PaymentIntent,
  PaymentResult,
  PaymentStatus,
  CreatePaymentParams,
  WalletPaymentConfig,
} from '../types';
import {
  PaymentInitializationError,
  PaymentCreationError,
  PaymentExecutionError,
} from '../errors';

/**
 * Wallet-based payment provider
 */
export class WalletPaymentProvider implements BasePaymentProvider {
  type: PaymentProviderType = PaymentProviderType.WALLET;
  name = 'Crypto Wallet';
  enabled: boolean;

  private config: WalletPaymentConfig;
  private intents: Map<string, PaymentIntent> = new Map();

  constructor(config: WalletPaymentConfig) {
    this.config = config;
    this.enabled = config.supportedChains.length > 0;
  }

  /**
   * Initialize the wallet payment provider
   */
  async initialize(): Promise<void> {
    try {
      // Validate configuration
      if (!this.config.supportedChains || this.config.supportedChains.length === 0) {
        throw new PaymentInitializationError('No supported chains configured');
      }

      // Additional initialization can go here
      // For example: connecting to RPC nodes, loading ABIs, etc.

      console.log('WalletPaymentProvider initialized', this.config);
    } catch (error) {
      throw new PaymentInitializationError(
        error instanceof Error ? error.message : 'Failed to initialize wallet payment provider'
      );
    }
  }

  /**
   * Create a payment intent
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentIntent> {
    try {
      // Generate unique intent ID
      const intentId = `wallet_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const intent: PaymentIntent = {
        id: intentId,
        status: PaymentStatus.PENDING,
        amount: params.amount,
        provider: PaymentProviderType.WALLET,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        metadata: params.metadata,
      };

      // Store intent
      this.intents.set(intentId, intent);

      return intent;
    } catch (error) {
      throw new PaymentCreationError(
        error instanceof Error ? error.message : 'Failed to create payment intent'
      );
    }
  }

  /**
   * Confirm and execute the payment
   * Note: Actual wallet interaction should be handled by wallet hooks
   */
  async confirmPayment(intentId: string): Promise<PaymentResult> {
    try {
      const intent = this.intents.get(intentId);

      if (!intent) {
        throw new PaymentExecutionError('Payment intent not found');
      }

      if (intent.status !== PaymentStatus.PENDING) {
        throw new PaymentExecutionError(`Payment already ${intent.status}`);
      }

      // Check expiration
      if (intent.expiresAt && Date.now() > intent.expiresAt) {
        throw new PaymentExecutionError('Payment intent has expired');
      }

      // Update intent status
      intent.status = PaymentStatus.PROCESSING;
      this.intents.set(intentId, intent);

      // Note: Actual transaction execution happens in the wallet hooks
      // This method marks the intent as processing and returns a result
      // The actual blockchain transaction should be initiated separately

      const result: PaymentResult = {
        success: true,
        intentId,
        status: PaymentStatus.PROCESSING,
        amount: intent.amount,
        provider: PaymentProviderType.WALLET,
        timestamp: Date.now(),
      };

      return result;
    } catch (error) {
      throw new PaymentExecutionError(
        error instanceof Error ? error.message : 'Failed to confirm payment'
      );
    }
  }

  /**
   * Update payment with transaction hash
   */
  async updatePaymentWithTransaction(intentId: string, transactionId: string): Promise<void> {
    const intent = this.intents.get(intentId);

    if (intent) {
      intent.status = PaymentStatus.COMPLETED;
      intent.metadata = {
        ...intent.metadata,
        transactionId,
      };
      this.intents.set(intentId, intent);
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(intentId: string): Promise<void> {
    const intent = this.intents.get(intentId);

    if (intent) {
      intent.status = PaymentStatus.CANCELLED;
      this.intents.set(intentId, intent);
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(intentId: string): Promise<PaymentStatus> {
    const intent = this.intents.get(intentId);
    return intent?.status || PaymentStatus.FAILED;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Clear old intents (older than 1 hour)
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [id, intent] of this.intents.entries()) {
      if (intent.createdAt < oneHourAgo) {
        this.intents.delete(id);
      }
    }
  }
}
