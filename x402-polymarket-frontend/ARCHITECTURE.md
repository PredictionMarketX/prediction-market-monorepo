# Architecture Documentation

## Overview

This application uses a modular, scalable architecture designed to support multiple blockchain networks (EVM, Solana) and payment providers (crypto wallets, Stripe, etc.).

## Directory Structure

```
app/
├── hooks/
│   └── wallet/                    # Wallet-specific React hooks
│       ├── useEVMWallet.ts       # EVM wallet hook
│       ├── useSolanaWallet.ts    # Solana wallet hook
│       ├── useWallet.ts          # Unified wallet hook
│       └── index.ts              # Exports
│
├── providers/
│   ├── WalletProviders.tsx       # Wallet context providers
│   └── index.ts                  # Exports
│
├── utils/
│   ├── wallet/                   # Wallet utilities (modular)
│   │   ├── types.ts             # Type definitions
│   │   ├── errors.ts            # Error classes
│   │   ├── constants.ts         # Network configs & constants
│   │   ├── utils.ts             # Utility functions
│   │   └── index.ts             # Main export
│   │
│   └── payment/                  # Payment abstraction layer
│       ├── types.ts             # Payment type definitions
│       ├── errors.ts            # Payment error classes
│       ├── PaymentManager.ts    # Central payment orchestrator
│       ├── providers/           # Payment provider implementations
│       │   ├── WalletPaymentProvider.ts    # Crypto wallet payments
│       │   └── StripePaymentProvider.ts    # Stripe payments (ready for impl)
│       └── index.ts             # Main export
│
components/
└── wallet/                       # Wallet UI components
    ├── WalletButton.tsx         # Connection & display components
    └── index.ts                 # Exports
```

## Architecture Layers

### 1. **Wallet Layer** (`app/utils/wallet/`)

Handles blockchain-specific wallet operations for EVM and Solana.

**Modules:**
- **types.ts**: Core interfaces and type definitions
- **errors.ts**: Wallet-specific error classes
- **constants.ts**: Network configurations, default values
- **utils.ts**: Helper functions for address formatting, validation, etc.

**Design Principles:**
- **Modular**: Each concern is in a separate file
- **Type-safe**: Full TypeScript coverage
- **Extensible**: Easy to add new networks or utilities

### 2. **Payment Layer** (`app/utils/payment/`)

Abstract payment interface supporting multiple payment providers.

**Key Components:**

#### Payment Manager
Central orchestrator for all payment operations:
```typescript
const manager = createPaymentManager({
  defaultProvider: PaymentProviderType.WALLET,
  providers: {
    wallet: {
      enabled: true,
      config: { supportedChains: ['evm', 'solana'] }
    },
    stripe: {
      enabled: false, // Enable when ready
      config: { publishableKey: 'pk_...' }
    }
  }
});
```

#### Provider Interface
All payment providers implement `BasePaymentProvider`:
```typescript
interface BasePaymentProvider {
  initialize(): Promise<void>;
  createPayment(params): Promise<PaymentIntent>;
  confirmPayment(intentId): Promise<PaymentResult>;
  cancelPayment(intentId): Promise<void>;
  getPaymentStatus(intentId): Promise<PaymentStatus>;
}
```

**Benefits:**
- **Provider-agnostic**: Switch between crypto/fiat seamlessly
- **Unified API**: Same interface for all payment methods
- **Future-ready**: Add Stripe/PayPal without changing consuming code

### 3. **Hooks Layer** (`app/hooks/wallet/`)

React hooks for wallet state management.

```typescript
// Use specific chain
const evmWallet = useEVMWallet();
const solanaWallet = useSolanaWallet();

// Or use unified interface
const { activeWallet, chainType, switchChainType } = useWallet();
```

**Features:**
- State management for wallet connections
- Transaction execution helpers
- Chain switching
- Error handling

### 4. **Provider Layer** (`app/providers/`)

React context providers for global state.

```typescript
<MultiChainWalletProvider
  walletConnectProjectId="..."
  solanaNetwork={WalletAdapterNetwork.Devnet}
>
  <App />
</MultiChainWalletProvider>
```

### 5. **Component Layer** (`components/wallet/`)

Reusable UI components.

```typescript
<WalletButton />              // Connect/disconnect
<ChainSwitcher />            // Switch between EVM/Solana
<WalletInfo showBalance />   // Display wallet info
```

## Data Flow

### Wallet Connection Flow

```
User clicks "Connect"
  → WalletButton calls activeWallet.connect()
  → Hook invokes wagmi/solana-adapter
  → Provider updates context
  → All consuming components re-render with new state
```

### Payment Flow (Future Stripe Integration)

```
User initiates payment
  → PaymentManager.createPayment(params, 'stripe')
  → StripePaymentProvider.createPayment()
  → Returns PaymentIntent
  → User confirms (Stripe UI)
  → PaymentManager.confirmPayment(intentId)
  → Returns PaymentResult
```

## Extensibility

### Adding a New Payment Provider

1. **Create Provider Class**:
```typescript
// app/utils/payment/providers/PayPalPaymentProvider.ts
export class PayPalPaymentProvider implements BasePaymentProvider {
  // Implement interface methods
}
```

2. **Add Type Definition**:
```typescript
// app/utils/payment/types.ts
export interface PayPalPaymentConfig {
  clientId: string;
  // ...
}
```

3. **Register in PaymentManager**:
```typescript
// app/utils/payment/PaymentManager.ts
if (this.config.providers.paypal?.enabled) {
  const provider = new PayPalPaymentProvider(config);
  this.providers.set(PaymentProviderType.PAYPAL, provider);
}
```

4. **Use It**:
```typescript
await paymentManager.createPayment(params, PaymentProviderType.PAYPAL);
```

### Adding a New Blockchain

1. **Add Network Config**:
```typescript
// app/utils/wallet/constants.ts
export const MY_CHAIN_NETWORKS = {
  mainnet: { ... }
};
```

2. **Create Utility Class**:
```typescript
// app/utils/wallet/utils.ts
export class MyChainWalletUtils {
  static formatAddress(address: string): string { ... }
  static isValidAddress(address: string): boolean { ... }
}
```

3. **Create Hook**:
```typescript
// app/hooks/wallet/useMyChainWallet.ts
export function useMyChainWallet(): MyChainWallet { ... }
```

## Configuration

### Environment Variables

```env
# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com

# Payment Providers (future)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
```

### Runtime Configuration

```typescript
// app/config/payment.ts
export const paymentConfig: MultiPaymentConfig = {
  defaultProvider: PaymentProviderType.WALLET,
  providers: {
    wallet: {
      enabled: true,
      config: {
        supportedChains: ['evm', 'solana'],
        defaultChain: 'evm',
      }
    },
    stripe: {
      enabled: process.env.NODE_ENV === 'production',
      config: {
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        currency: 'usd',
      }
    }
  }
};
```

## Error Handling

### Error Hierarchy

```
Error
└── WalletError (wallet/errors.ts)
    ├── WalletConnectionError
    ├── WalletSignatureError
    ├── WalletTransactionError
    └── WalletNetworkError

Error
└── PaymentError (payment/errors.ts)
    ├── PaymentInitializationError
    ├── PaymentCreationError
    ├── PaymentExecutionError
    └── PaymentCancelledError
```

### Usage

```typescript
try {
  await wallet.sendTransaction(tx);
} catch (error) {
  if (error instanceof WalletTransactionError) {
    console.error('Transaction failed:', error.message);
  } else if (isWalletError(error)) {
    console.error('Wallet error:', formatWalletError(error));
  }
}
```

## Testing Strategy

### Unit Tests
- Utility functions (formatAddress, validation, etc.)
- Error handling
- Payment provider logic

### Integration Tests
- Wallet connection flows
- Transaction signing
- Payment creation and confirmation

### E2E Tests
- Full user flows
- Multi-chain switching
- Payment completion

## Performance Considerations

1. **Code Splitting**: Payment providers loaded on-demand
2. **Memoization**: Hooks use `useMemo` and `useCallback`
3. **Lazy Loading**: Wallet adapters loaded only when needed
4. **Caching**: Network configs and providers cached

## Security Best Practices

1. **Never store private keys** in the application
2. **Validate all addresses** before transactions
3. **Verify transaction params** before signing
4. **Use HTTPS** for all RPC endpoints
5. **Sanitize user input** in payment metadata
6. **Implement rate limiting** for payment operations

## Future Enhancements

### Planned Features
- [ ] Multi-sig wallet support
- [ ] Hardware wallet integration
- [ ] Batch transactions
- [ ] Transaction history
- [ ] Payment analytics
- [ ] Recurring payments (Stripe)
- [ ] Refund handling

### Stripe Integration Checklist
- [ ] Install Stripe SDK: `pnpm add @stripe/stripe-js @stripe/react-stripe-js`
- [ ] Implement StripePaymentProvider methods
- [ ] Create Stripe checkout components
- [ ] Add webhook handlers for payment confirmations
- [ ] Implement refund logic
- [ ] Add payment history tracking

## Maintenance

### Adding Dependencies
```bash
# Wallet dependencies
pnpm add @solana/web3.js wagmi viem

# Payment dependencies (when needed)
pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

### Updating Network Configs
Edit `app/utils/wallet/constants.ts`:
```typescript
export const EVM_NETWORKS = {
  // Add new network
  newchain: {
    chainId: 12345,
    name: 'New Chain',
    rpcUrl: 'https://...',
    // ...
  }
};
```

## Troubleshooting

### Common Issues

**Issue**: Wallet won't connect
- Check if wallet extension is installed
- Verify network configuration
- Check console for error messages

**Issue**: Transaction fails
- Verify sufficient balance
- Check gas fees
- Ensure correct network

**Issue**: Type errors after updates
- Run `pnpm install` to update dependencies
- Check TypeScript version compatibility

## Resources

- [Wallet Integration Guide](./WALLET_INTEGRATION_GUIDE.md)
- [Example Component](./app/wallet-example.tsx)
- [Wagmi Documentation](https://wagmi.sh)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Stripe Documentation](https://stripe.com/docs)
