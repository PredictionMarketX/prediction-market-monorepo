/**
 * Payment Manager
 *
 * Central manager for handling payments across multiple providers.
 * Orchestrates payment operations and provider selection.
 */

import {
  BasePaymentProvider,
  PaymentProviderType,
  PaymentIntent,
  PaymentResult,
  PaymentStatus,
  CreatePaymentParams,
  MultiPaymentConfig,
  PaymentMethod,
} from './types';
import {
  PaymentProviderNotSupportedError,
  PaymentInitializationError,
} from './errors';
import { WalletPaymentProvider } from './providers/WalletPaymentProvider';
import { StripePaymentProvider } from './providers/StripePaymentProvider';

/**
 * Payment Manager class
 * Manages multiple payment providers and routes payments
 */
export class PaymentManager {
  private providers: Map<PaymentProviderType, BasePaymentProvider> = new Map();
  private config: MultiPaymentConfig;
  private initialized = false;

  constructor(config: MultiPaymentConfig) {
    this.config = config;
  }

  /**
   * Initialize all enabled payment providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('PaymentManager already initialized');
      return;
    }

    const initPromises: Promise<void>[] = [];

    // Initialize wallet provider
    if (this.config.providers.wallet?.enabled && this.config.providers.wallet.config) {
      const provider = new WalletPaymentProvider(this.config.providers.wallet.config);
      this.providers.set(PaymentProviderType.WALLET, provider);
      initPromises.push(provider.initialize());
    }

    // Initialize Stripe provider
    if (this.config.providers.stripe?.enabled && this.config.providers.stripe.config) {
      const provider = new StripePaymentProvider(this.config.providers.stripe.config);
      this.providers.set(PaymentProviderType.STRIPE, provider);
      initPromises.push(provider.initialize());
    }

    // Initialize other providers as needed...

    try {
      await Promise.all(initPromises);
      this.initialized = true;
      console.log('PaymentManager initialized with providers:', Array.from(this.providers.keys()));
    } catch (error) {
      throw new PaymentInitializationError(
        error instanceof Error ? error.message : 'Failed to initialize payment providers'
      );
    }
  }

  /**
   * Get a specific payment provider
   */
  getProvider(type: PaymentProviderType): BasePaymentProvider {
    const provider = this.providers.get(type);

    if (!provider) {
      throw new PaymentProviderNotSupportedError(type);
    }

    if (!provider.enabled) {
      throw new PaymentProviderNotSupportedError(`${type} (disabled)`);
    }

    return provider;
  }

  /**
   * Get the default payment provider
   */
  getDefaultProvider(): BasePaymentProvider {
    return this.getProvider(this.config.defaultProvider);
  }

  /**
   * Get all available payment methods
   */
  getAvailablePaymentMethods(): PaymentMethod[] {
    const methods: PaymentMethod[] = [];

    for (const [type, provider] of this.providers.entries()) {
      if (provider.enabled) {
        methods.push({
          id: type,
          type,
          name: provider.name,
          supported: true,
          recommended: type === this.config.defaultProvider,
        });
      }
    }

    return methods;
  }

  /**
   * Create a payment using a specific provider
   */
  async createPayment(
    params: CreatePaymentParams,
    providerType?: PaymentProviderType
  ): Promise<PaymentIntent> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getDefaultProvider();

    return provider.createPayment(params);
  }

  /**
   * Confirm a payment
   */
  async confirmPayment(
    intentId: string,
    providerType?: PaymentProviderType
  ): Promise<PaymentResult> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getDefaultProvider();

    return provider.confirmPayment(intentId);
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(
    intentId: string,
    providerType?: PaymentProviderType
  ): Promise<void> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getDefaultProvider();

    return provider.cancelPayment(intentId);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    intentId: string,
    providerType?: PaymentProviderType
  ): Promise<PaymentStatus> {
    const provider = providerType
      ? this.getProvider(providerType)
      : this.getDefaultProvider();

    return provider.getPaymentStatus(intentId);
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(type: PaymentProviderType): boolean {
    const provider = this.providers.get(type);
    return provider !== undefined && provider.enabled;
  }

  /**
   * Cleanup all providers
   */
  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    for (const provider of this.providers.values()) {
      if (provider.cleanup) {
        cleanupPromises.push(provider.cleanup());
      }
    }

    await Promise.all(cleanupPromises);
    this.providers.clear();
    this.initialized = false;
  }
}

/**
 * Create a default payment manager instance
 */
export function createPaymentManager(config: MultiPaymentConfig): PaymentManager {
  return new PaymentManager(config);
}
