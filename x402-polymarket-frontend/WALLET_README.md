# Multi-Chain Wallet System

A comprehensive wallet integration system supporting both EVM (Ethereum, Base, etc.) and Solana blockchains.

## 🎯 Features

- ✅ **EVM Support**: Ethereum, Base, Base Sepolia, Sepolia
- ✅ **Solana Support**: Mainnet, Devnet, Testnet
- ✅ **Unified Interface**: Single API for both blockchain types
- ✅ **React Hooks**: Easy-to-use hooks for wallet interactions
- ✅ **TypeScript**: Full type safety
- ✅ **UI Components**: Pre-built wallet buttons and displays
- ✅ **Utility Functions**: Address formatting, validation, explorer links
- ✅ **Error Handling**: Specific error types for different scenarios

## 📁 File Structure

```
app/
├── utils/
│   └── wallet.ts                 # Core types, interfaces, and utilities
├── hooks/
│   ├── useEVMWallet.ts          # EVM wallet hook
│   ├── useSolanaWallet.ts       # Solana wallet hook
│   ├── useWallet.ts             # Unified wallet hook
│   └── index.ts                 # Exports
├── providers/
│   ├── WalletProviders.tsx      # Provider components
│   └── index.ts                 # Exports
└── wallet-example.tsx           # Example usage component

components/
└── wallet/
    ├── WalletButton.tsx         # Wallet UI components
    └── index.ts                 # Exports

WALLET_INTEGRATION_GUIDE.md      # Comprehensive integration guide
WALLET_README.md                  # This file
```

## 🚀 Quick Start

### 1. Setup Providers

In your `app/layout.tsx`:

```tsx
import { MultiChainWalletProvider } from '@/app/providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MultiChainWalletProvider>
          {children}
        </MultiChainWalletProvider>
      </body>
    </html>
  );
}
```

### 2. Use in Components

```tsx
'use client';

import { useWallet } from '@/app/hooks';
import { WalletButton } from '@/components/wallet';

export function MyComponent() {
  const { isConnected, address, activeWallet } = useWallet();

  return (
    <div>
      <WalletButton />
      {isConnected && <p>Connected: {address}</p>}
    </div>
  );
}
```

## 📚 Documentation

See [WALLET_INTEGRATION_GUIDE.md](./WALLET_INTEGRATION_GUIDE.md) for:
- Detailed setup instructions
- Usage examples for EVM and Solana
- Error handling patterns
- Best practices
- API reference

## 🎨 Example Component

See [app/wallet-example.tsx](./app/wallet-example.tsx) for a complete working example with:
- Wallet connection UI
- Chain switching
- Message signing
- Transaction sending
- Balance checking

## 🔧 Configuration

### Environment Variables (Optional)

```env
# WalletConnect Project ID (for EVM)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Solana RPC Endpoint
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com

# Solana Network
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

## 📦 Core Exports

### Hooks
- `useWallet()` - Unified hook for both chains
- `useEVMWallet()` - EVM-specific hook
- `useSolanaWallet()` - Solana-specific hook

### Components
- `WalletButton` - Connect/disconnect button
- `ChainSwitcher` - Switch between EVM and Solana
- `WalletInfo` - Display wallet information

### Providers
- `MultiChainWalletProvider` - Combined provider
- `EVMWalletProvider` - EVM-only provider
- `SolanaWalletProviderComponent` - Solana-only provider

### Utilities
- `WalletUtils` - Generic wallet utilities
- `EVMWalletUtils` - EVM-specific utilities
- `SolanaWalletUtils` - Solana-specific utilities

### Types
- `BlockchainType` - EVM | SOLANA
- `WalletConnectionState` - Connection status enum
- `EVMWallet` - EVM wallet interface
- `SolanaWallet` - Solana wallet interface
- `Wallet` - Unified wallet type

## 🔐 Error Types

- `WalletError` - Base error class
- `WalletConnectionError` - Connection failures
- `WalletSignatureError` - Signing failures
- `WalletTransactionError` - Transaction failures

## 🌐 Supported Wallets

### EVM
- MetaMask
- Injected wallets
- WalletConnect (optional)

### Solana
- Phantom
- Solflare
- Torus

## 💡 Example Usage Patterns

### Sign a Message (EVM)
```tsx
const { evmWallet } = useWallet();
const signature = await evmWallet.signMessage('Hello!');
```

### Sign a Message (Solana)
```tsx
const { solanaWallet } = useWallet();
const message = new TextEncoder().encode('Hello!');
const signature = await solanaWallet.signMessage(message);
```

### Send Transaction (EVM)
```tsx
const { evmWallet } = useWallet();
const hash = await evmWallet.sendTransaction({
  to: '0x...',
  value: parseEther('0.01'),
});
```

### Send Transaction (Solana)
```tsx
const { solanaWallet } = useWallet();
const transaction = new Transaction().add(/* instructions */);
const signature = await solanaWallet.sendTransaction(transaction);
```

## 🛠️ Development

All TypeScript types are fully defined. Use your IDE's autocomplete to explore available methods and properties.

## 📄 License

MIT

## 🤝 Contributing

This is part of the x402-polymarket-frontend project.

## ✨ Next Steps

1. Read the [Integration Guide](./WALLET_INTEGRATION_GUIDE.md)
2. Check out the [Example Component](./app/wallet-example.tsx)
3. Configure your environment variables
4. Start building!
