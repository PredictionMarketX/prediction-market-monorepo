'use client';

import React, { useMemo } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';

// Solana imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import Solana wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * EVM Wallet Provider Props
 */
interface EVMWalletProviderProps {
  children: React.ReactNode;
  projectId?: string;
}

/**
 * EVM Wallet Provider
 * Provides wagmi configuration for EVM wallet connections
 */
export function EVMWalletProvider({ children, projectId }: EVMWalletProviderProps) {
  const queryClient = useMemo(() => new QueryClient(), []);

  const config = useMemo(() => {
    const connectorsList = [
      injected(),
      metaMask(),
    ];

    // Add WalletConnect if projectId is provided
    if (projectId) {
      connectorsList.push(
        walletConnect({
          projectId,
          showQrModal: true,
        })
      );
    }

    return createConfig({
      chains: [mainnet, base, baseSepolia, sepolia],
      connectors: connectorsList,
      transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [baseSepolia.id]: http(),
        [sepolia.id]: http(),
      },
    });
  }, [projectId]);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * Solana Wallet Provider Props
 */
interface SolanaWalletProviderProps {
  children: React.ReactNode;
  network?: WalletAdapterNetwork;
  endpoint?: string;
  autoConnect?: boolean;
}

/**
 * Solana Wallet Provider
 * Provides Solana wallet adapter configuration
 */
export function SolanaWalletProviderComponent({
  children,
  network = WalletAdapterNetwork.Devnet,
  endpoint,
  autoConnect = false,
}: SolanaWalletProviderProps) {
  // Use custom endpoint or default cluster URL
  const solanaEndpoint = useMemo(
    () => endpoint || clusterApiUrl(network),
    [endpoint, network]
  );

  // Initialize wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={solanaEndpoint}>
      <WalletProvider wallets={wallets} autoConnect={autoConnect}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * Multi-Chain Wallet Provider Props
 */
interface MultiChainWalletProviderProps {
  children: React.ReactNode;
  walletConnectProjectId?: string;
  solanaNetwork?: WalletAdapterNetwork;
  solanaEndpoint?: string;
  solanaAutoConnect?: boolean;
}

/**
 * Multi-Chain Wallet Provider
 * Combines both EVM and Solana wallet providers
 *
 * @example
 * ```tsx
 * // In your root layout or app component
 * <MultiChainWalletProvider
 *   walletConnectProjectId="your-project-id"
 *   solanaNetwork={WalletAdapterNetwork.Mainnet}
 * >
 *   <YourApp />
 * </MultiChainWalletProvider>
 * ```
 */
export function MultiChainWalletProvider({
  children,
  walletConnectProjectId,
  solanaNetwork = WalletAdapterNetwork.Devnet,
  solanaEndpoint,
  solanaAutoConnect = false,
}: MultiChainWalletProviderProps) {
  return (
    <EVMWalletProvider projectId={walletConnectProjectId}>
      <SolanaWalletProviderComponent
        network={solanaNetwork}
        endpoint={solanaEndpoint}
        autoConnect={solanaAutoConnect}
      >
        {children}
      </SolanaWalletProviderComponent>
    </EVMWalletProvider>
  );
}
