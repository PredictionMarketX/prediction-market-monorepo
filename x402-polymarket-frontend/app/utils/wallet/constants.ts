/**
 * Wallet Constants
 *
 * Network configurations and constant values for wallet operations.
 */

import { EVMNetworkConfig, SolanaNetworkConfig } from './types';

/**
 * Supported EVM networks
 */
export const EVM_NETWORKS: Record<string, EVMNetworkConfig> = {
  mainnet: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  'base-sepolia': {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://eth-sepolia.public.blastapi.io',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SEP',
      decimals: 18,
    },
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

/**
 * Supported Solana networks
 */
export const SOLANA_NETWORKS: Record<string, SolanaNetworkConfig> = {
  mainnet: {
    name: 'Solana Mainnet Beta',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    blockExplorerUrl: 'https://explorer.solana.com',
    cluster: 'mainnet-beta',
  },
  devnet: {
    name: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    blockExplorerUrl: 'https://explorer.solana.com',
    cluster: 'devnet',
  },
  testnet: {
    name: 'Solana Testnet',
    rpcUrl: 'https://api.testnet.solana.com',
    blockExplorerUrl: 'https://explorer.solana.com',
    cluster: 'testnet',
  },
};

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  EVM_DEFAULT_CHAIN_ID: 1,
  SOLANA_DEFAULT_NETWORK: 'devnet' as const,
  ADDRESS_DISPLAY_START_CHARS: 6,
  ADDRESS_DISPLAY_END_CHARS: 4,
  TRANSACTION_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 10000,
} as const;

/**
 * Lamports per SOL
 */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Common token decimals
 */
export const TOKEN_DECIMALS = {
  ETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  SOL: 9,
} as const;
