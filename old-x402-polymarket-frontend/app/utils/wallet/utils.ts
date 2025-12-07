/**
 * Wallet Utility Functions
 *
 * Helper functions for address formatting, validation, and blockchain operations.
 */

import { PublicKey } from '@solana/web3.js';
import { Address, Hash } from 'viem';
import { BlockchainType } from './types';
import { EVM_NETWORKS, SOLANA_NETWORKS, DEFAULT_CONFIG, LAMPORTS_PER_SOL } from './constants';

/**
 * EVM Wallet Utilities
 */
export class EVMWalletUtils {
  /**
   * Format address for display (0x1234...5678)
   */
  static formatAddress(
    address: Address,
    startChars = DEFAULT_CONFIG.ADDRESS_DISPLAY_START_CHARS,
    endChars = DEFAULT_CONFIG.ADDRESS_DISPLAY_END_CHARS
  ): string {
    if (!address) return '';
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }

  /**
   * Validate EVM address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get transaction explorer URL
   */
  static getTransactionUrl(txHash: Hash, network: keyof typeof EVM_NETWORKS): string {
    const networkConfig = EVM_NETWORKS[network];
    if (!networkConfig?.blockExplorerUrl) return '';
    return `${networkConfig.blockExplorerUrl}/tx/${txHash}`;
  }

  /**
   * Get address explorer URL
   */
  static getAddressUrl(address: Address, network: keyof typeof EVM_NETWORKS): string {
    const networkConfig = EVM_NETWORKS[network];
    if (!networkConfig?.blockExplorerUrl) return '';
    return `${networkConfig.blockExplorerUrl}/address/${address}`;
  }

  /**
   * Get network name from chain ID
   */
  static getNetworkName(chainId: number): string | null {
    for (const config of Object.values(EVM_NETWORKS)) {
      if (config.chainId === chainId) {
        return config.name;
      }
    }
    return null;
  }

  /**
   * Check if chain ID is supported
   */
  static isSupportedChain(chainId: number): boolean {
    return Object.values(EVM_NETWORKS).some(network => network.chainId === chainId);
  }
}

/**
 * Solana Wallet Utilities
 */
export class SolanaWalletUtils {
  /**
   * Format address for display
   */
  static formatAddress(
    address: string | PublicKey,
    startChars = DEFAULT_CONFIG.ADDRESS_DISPLAY_START_CHARS,
    endChars = DEFAULT_CONFIG.ADDRESS_DISPLAY_END_CHARS
  ): string {
    const addrStr = typeof address === 'string' ? address : address.toBase58();
    if (!addrStr) return '';
    return `${addrStr.slice(0, startChars)}...${addrStr.slice(-endChars)}`;
  }

  /**
   * Validate Solana address
   */
  static isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get transaction explorer URL
   */
  static getTransactionUrl(signature: string, cluster: keyof typeof SOLANA_NETWORKS = 'mainnet'): string {
    const networkConfig = SOLANA_NETWORKS[cluster];
    if (!networkConfig?.blockExplorerUrl) return '';
    const clusterParam = cluster === 'mainnet' ? '' : `?cluster=${cluster}`;
    return `${networkConfig.blockExplorerUrl}/tx/${signature}${clusterParam}`;
  }

  /**
   * Get address explorer URL
   */
  static getAddressUrl(address: string | PublicKey, cluster: keyof typeof SOLANA_NETWORKS = 'mainnet'): string {
    const addrStr = typeof address === 'string' ? address : address.toBase58();
    const networkConfig = SOLANA_NETWORKS[cluster];
    if (!networkConfig?.blockExplorerUrl) return '';
    const clusterParam = cluster === 'mainnet' ? '' : `?cluster=${cluster}`;
    return `${networkConfig.blockExplorerUrl}/address/${addrStr}${clusterParam}`;
  }

  /**
   * Convert lamports to SOL
   */
  static lamportsToSol(lamports: number): number {
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Convert SOL to lamports
   */
  static solToLamports(sol: number): number {
    return Math.floor(sol * LAMPORTS_PER_SOL);
  }

  /**
   * Format SOL amount with decimals
   */
  static formatSol(lamports: number, decimals = 4): string {
    return this.lamportsToSol(lamports).toFixed(decimals);
  }
}

/**
 * Generic wallet utilities
 */
export class WalletUtils {
  /**
   * Determine blockchain type from address format
   */
  static detectBlockchainType(address: string): BlockchainType | null {
    if (EVMWalletUtils.isValidAddress(address)) {
      return BlockchainType.EVM;
    }
    if (SolanaWalletUtils.isValidAddress(address)) {
      return BlockchainType.SOLANA;
    }
    return null;
  }

  /**
   * Format address based on blockchain type
   */
  static formatAddress(address: string, chainType: BlockchainType): string {
    if (chainType === BlockchainType.EVM) {
      return EVMWalletUtils.formatAddress(address as Address);
    }
    return SolanaWalletUtils.formatAddress(address);
  }

  /**
   * Validate address based on blockchain type
   */
  static isValidAddress(address: string, chainType: BlockchainType): boolean {
    if (chainType === BlockchainType.EVM) {
      return EVMWalletUtils.isValidAddress(address);
    }
    return SolanaWalletUtils.isValidAddress(address);
  }

  /**
   * Sleep utility for delays
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry a function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          await this.sleep(delayMs * attempt);
        }
      }
    }

    throw lastError!;
  }
}
