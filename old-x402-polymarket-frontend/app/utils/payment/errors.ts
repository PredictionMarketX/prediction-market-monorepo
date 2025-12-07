/**
 * Payment Error Classes
 *
 * Centralized error handling for payment operations.
 */

/**
 * Base payment error class
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Error thrown when payment provider initialization fails
 */
export class PaymentInitializationError extends PaymentError {
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_INITIALIZATION_ERROR', details);
    this.name = 'PaymentInitializationError';
  }
}

/**
 * Error thrown when payment creation fails
 */
export class PaymentCreationError extends PaymentError {
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_CREATION_ERROR', details);
    this.name = 'PaymentCreationError';
  }
}

/**
 * Error thrown when payment execution fails
 */
export class PaymentExecutionError extends PaymentError {
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_EXECUTION_ERROR', details);
    this.name = 'PaymentExecutionError';
  }
}

/**
 * Error thrown when payment is cancelled
 */
export class PaymentCancelledError extends PaymentError {
  constructor(message: string = 'Payment was cancelled') {
    super(message, 'PAYMENT_CANCELLED');
    this.name = 'PaymentCancelledError';
  }
}

/**
 * Error thrown when payment provider is not supported
 */
export class PaymentProviderNotSupportedError extends PaymentError {
  constructor(provider: string) {
    super(`Payment provider '${provider}' is not supported`, 'PAYMENT_PROVIDER_NOT_SUPPORTED');
    this.name = 'PaymentProviderNotSupportedError';
  }
}

/**
 * Error thrown when payment validation fails
 */
export class PaymentValidationError extends PaymentError {
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_VALIDATION_ERROR', details);
    this.name = 'PaymentValidationError';
  }
}

/**
 * Type guard to check if an error is a payment error
 */
export function isPaymentError(error: unknown): error is PaymentError {
  return error instanceof PaymentError;
}

/**
 * Helper to format payment error messages
 */
export function formatPaymentError(error: unknown): string {
  if (isPaymentError(error)) {
    return `${error.name}: ${error.message}${error.code ? ` (${error.code})` : ''}`;
  }
  return error instanceof Error ? error.message : String(error);
}
