# Multi-Chain Wallet Integration Guide

This guide explains how to integrate and use the EVM and Solana wallet functionality in your application.

## Overview

The wallet system provides a unified interface for connecting to both EVM (Ethereum, Base, etc.) and Solana wallets. It includes:

- **Wallet Utilities**: Core types, interfaces, and helper functions
- **React Hooks**: Easy-to-use hooks for wallet interactions
- **Provider Components**: Context providers for wallet state management
- **UI Components**: Pre-built wallet connection buttons and displays

## Installation

Dependencies are already installed. The system uses:

- **EVM**: `wagmi`, `viem`, `@tanstack/react-query`
- **Solana**: `@solana/wallet-adapter-react`, `@solana/web3.js`

## Setup

### 1. Wrap Your App with Providers

Update your root layout (`app/layout.tsx`):

```tsx
import { MultiChainWalletProvider } from '@/app/providers';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MultiChainWalletProvider
          walletConnectProjectId="your-walletconnect-project-id" // Optional
          solanaNetwork={WalletAdapterNetwork.Devnet} // or Mainnet, Testnet
          solanaAutoConnect={false}
        >
          {children}
        </MultiChainWalletProvider>
      </body>
    </html>
  );
}
```

### 2. Environment Variables

Create a `.env.local` file:

```env
# Optional: WalletConnect Project ID for EVM wallets
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Optional: Custom Solana RPC endpoint
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com

# Optional: Solana network (mainnet-beta, devnet, testnet)
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

## Usage Examples

### Basic Wallet Connection

```tsx
'use client';

import { useWallet } from '@/app/hooks';
import { BlockchainType } from '@/app/utils/wallet';

export function WalletExample() {
  const { activeWallet, isConnected, address, chainType } = useWallet({
    defaultChainType: BlockchainType.EVM,
  });

  const handleConnect = async () => {
    try {
      await activeWallet.connect();
      console.log('Connected:', address);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    await activeWallet.disconnect();
  };

  return (
    <div>
      {isConnected ? (
        <div>
          <p>Connected: {address}</p>
          <button onClick={handleDisconnect}>Disconnect</button>
        </div>
      ) : (
        <button onClick={handleConnect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Using Pre-built Components

```tsx
'use client';

import { WalletButton, ChainSwitcher, WalletInfo } from '@/components/wallet';

export function WalletPage() {
  return (
    <div className="space-y-4">
      <ChainSwitcher />
      <WalletButton />
      <WalletInfo showBalance={true} />
    </div>
  );
}
```

### EVM-Specific Operations

```tsx
'use client';

import { useEVMWallet } from '@/app/hooks';
import { parseEther } from 'viem';

export function EVMExample() {
  const wallet = useEVMWallet();

  const sendETH = async () => {
    if (!wallet.address) return;

    try {
      const hash = await wallet.sendTransaction({
        to: '0x...',
        value: parseEther('0.01'),
      });
      console.log('Transaction hash:', hash);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  const signMessage = async () => {
    try {
      const signature = await wallet.signMessage('Hello, Ethereum!');
      console.log('Signature:', signature);
    } catch (error) {
      console.error('Signing failed:', error);
    }
  };

  const switchToBase = async () => {
    try {
      await wallet.switchChain(8453); // Base mainnet
    } catch (error) {
      console.error('Chain switch failed:', error);
    }
  };

  return (
    <div>
      <button onClick={sendETH}>Send ETH</button>
      <button onClick={signMessage}>Sign Message</button>
      <button onClick={switchToBase}>Switch to Base</button>
    </div>
  );
}
```

### Solana-Specific Operations

```tsx
'use client';

import { useSolanaWallet } from '@/app/hooks';
import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';

export function SolanaExample() {
  const wallet = useSolanaWallet();

  const sendSOL = async () => {
    if (!wallet.publicKey || !wallet.connection) return;

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey('...'),
          lamports: 0.01 * LAMPORTS_PER_SOL,
        })
      );

      const signature = await wallet.sendTransaction(transaction);
      console.log('Transaction signature:', signature);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  const signMessage = async () => {
    try {
      const message = new TextEncoder().encode('Hello, Solana!');
      const signature = await wallet.signMessage(message);
      console.log('Signature:', signature);
    } catch (error) {
      console.error('Signing failed:', error);
    }
  };

  return (
    <div>
      <button onClick={sendSOL}>Send SOL</button>
      <button onClick={signMessage}>Sign Message</button>
    </div>
  );
}
```

### Switching Between Chains

```tsx
'use client';

import { useWallet } from '@/app/hooks';
import { BlockchainType } from '@/app/utils/wallet';

export function ChainSwitchExample() {
  const { chainType, switchChainType, evmWallet, solanaWallet } = useWallet();

  const handleSwitch = async (newType: BlockchainType) => {
    // Disconnect current wallet before switching
    if (chainType === BlockchainType.EVM && evmWallet.address) {
      await evmWallet.disconnect();
    } else if (chainType === BlockchainType.SOLANA && solanaWallet.address) {
      await solanaWallet.disconnect();
    }

    switchChainType(newType);
  };

  return (
    <div>
      <p>Current chain: {chainType}</p>
      <button onClick={() => handleSwitch(BlockchainType.EVM)}>
        Use EVM
      </button>
      <button onClick={() => handleSwitch(BlockchainType.SOLANA)}>
        Use Solana
      </button>
    </div>
  );
}
```

### Utility Functions

```tsx
import {
  EVMWalletUtils,
  SolanaWalletUtils,
  WalletUtils,
  BlockchainType,
} from '@/app/utils/wallet';

// Format addresses
const evmAddress = '0x1234567890123456789012345678901234567890';
const formattedEVM = EVMWalletUtils.formatAddress(evmAddress); // "0x1234...7890"

const solAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
const formattedSol = SolanaWalletUtils.formatAddress(solAddress); // "DYw8...NSKK"

// Validate addresses
const isValidEVM = EVMWalletUtils.isValidAddress(evmAddress); // true
const isValidSol = SolanaWalletUtils.isValidAddress(solAddress); // true

// Detect blockchain type from address
const chainType = WalletUtils.detectBlockchainType(evmAddress); // BlockchainType.EVM

// Get explorer URLs
const txUrl = EVMWalletUtils.getTransactionUrl('0x...', 'base');
const addressUrl = SolanaWalletUtils.getAddressUrl(solAddress, 'mainnet');

// Solana conversions
const lamports = SolanaWalletUtils.solToLamports(1.5); // 1500000000
const sol = SolanaWalletUtils.lamportsToSol(1000000000); // 1.0
```

## Error Handling

The wallet system provides specific error types:

```tsx
import {
  WalletConnectionError,
  WalletSignatureError,
  WalletTransactionError,
} from '@/app/utils/wallet';

try {
  await wallet.connect();
} catch (error) {
  if (error instanceof WalletConnectionError) {
    console.error('Connection error:', error.message);
  } else if (error instanceof WalletSignatureError) {
    console.error('Signature error:', error.message);
  } else if (error instanceof WalletTransactionError) {
    console.error('Transaction error:', error.message);
  }
}
```

## TypeScript Support

All components, hooks, and utilities are fully typed. Import types as needed:

```tsx
import type {
  EVMWallet,
  SolanaWallet,
  Wallet,
  TransactionResult,
  EVMNetworkConfig,
  SolanaNetworkConfig,
} from '@/app/utils/wallet';
```

## Supported Networks

### EVM Networks
- Ethereum Mainnet (chainId: 1)
- Base (chainId: 8453)
- Base Sepolia (chainId: 84532)
- Sepolia (chainId: 11155111)

### Solana Networks
- Mainnet Beta
- Devnet
- Testnet

## Best Practices

1. **Always check connection state** before attempting transactions
2. **Handle errors gracefully** with try-catch blocks
3. **Disconnect wallets** when switching chain types
4. **Use environment variables** for network configurations
5. **Test on testnets** before deploying to mainnet
6. **Validate addresses** before sending transactions
7. **Confirm transactions** before showing success messages

## Next Steps

- Configure your preferred networks in `.env.local`
- Add custom styling to wallet components
- Implement transaction confirmation UI
- Add balance display functionality
- Integrate with your smart contracts or Solana programs
