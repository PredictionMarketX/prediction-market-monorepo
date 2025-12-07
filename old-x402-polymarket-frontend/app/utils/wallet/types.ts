/**
 * Wallet Type Definitions
 *
 * Core interfaces and types for wallet functionality.
 * These types are blockchain-agnostic and support multiple wallet providers.
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import {
  Address,
  Hash,
  TransactionRequest,
  WalletClient,
  PublicClient,
} from 'viem';

/**
 * Supported blockchain types
 */
export enum BlockchainType {
  EVM = 'evm',
  SOLANA = 'solana',
}

/**
 * Wallet connection state
 */
export enum WalletConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * Wallet event types for listening to state changes
 */
export enum WalletEventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ACCOUNT_CHANGED = 'accountChanged',
  CHAIN_CHANGED = 'chainChanged',
  ERROR = 'error',
}

/**
 * Base wallet interface
 * All wallet implementations should extend this
 */
export interface BaseWallet {
  address: string | null;
  chainType: BlockchainType;
  connectionState: WalletConnectionState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * EVM wallet interface
 */
export interface EVMWallet extends BaseWallet {
  chainType: BlockchainType.EVM;
  address: Address | null;
  chainId: number | null;
  walletClient: WalletClient | null;
  publicClient: PublicClient | null;
  switchChain: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<Hash>;
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>;
}

/**
 * Solana wallet interface
 */
export interface SolanaWallet extends BaseWallet {
  chainType: BlockchainType.SOLANA;
  address: string | null;
  publicKey: PublicKey | null;
  connection: Connection | null;
  walletAdapter: WalletContextState | null;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  sendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<string>;
}

/**
 * Unified wallet type (discriminated union)
 */
export type Wallet = EVMWallet | SolanaWallet;

/**
 * Transaction result interface
 */
export interface TransactionResult {
  success: boolean;
  signature?: string;
  hash?: Hash;
  error?: Error;
  timestamp?: number;
}

/**
 * Network configuration for EVM chains
 */
export interface EVMNetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Network configuration for Solana
 */
export interface SolanaNetworkConfig {
  name: string;
  rpcUrl: string;
  blockExplorerUrl?: string;
  cluster: 'mainnet-beta' | 'devnet' | 'testnet';
}

/**
 * Wallet event payload
 */
export interface WalletEvent {
  type: WalletEventType;
  payload?: unknown;
  timestamp: number;
}

/**
 * Wallet event listener
 */
export type WalletEventListener = (event: WalletEvent) => void;

/**
 * Generic payment configuration
 * Extensible for different payment providers (Stripe, crypto, etc.)
 */
export interface PaymentConfig {
  provider: 'wallet' | 'stripe' | 'other';
  enabled: boolean;
  config?: Record<string, unknown>;
}

/**
 * Wallet provider configuration
 */
export interface WalletProviderConfig {
  // EVM configuration
  evm?: {
    enabled: boolean;
    defaultChainId?: number;
    supportedChains?: number[];
    walletConnectProjectId?: string;
  };
  // Solana configuration
  solana?: {
    enabled: boolean;
    network?: 'mainnet-beta' | 'devnet' | 'testnet';
    customEndpoint?: string;
    autoConnect?: boolean;
  };
}
