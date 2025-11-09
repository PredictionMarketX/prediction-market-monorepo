'use client';

import { useState, useCallback } from 'react';
import { useEVMWallet } from './useEVMWallet';
import { useSolanaWallet } from './useSolanaWallet';
import { BlockchainType, Wallet, EVMWallet, SolanaWallet } from '@/app/utils/wallet';

/**
 * Options for the unified wallet hook
 */
export interface UseWalletOptions {
  defaultChainType?: BlockchainType;
}

/**
 * Return type for the unified wallet hook
 */
export interface UseWalletReturn {
  chainType: BlockchainType;
  evmWallet: EVMWallet;
  solanaWallet: SolanaWallet;
  activeWallet: Wallet;
  switchChainType: (type: BlockchainType) => void;
  isConnected: boolean;
  address: string | null;
}

/**
 * Unified wallet hook that manages both EVM and Solana wallets
 *
 * This hook provides a single interface to interact with both blockchain types,
 * allowing users to switch between them seamlessly.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     activeWallet,
 *     chainType,
 *     switchChainType,
 *     isConnected,
 *     address
 *   } = useWallet({ defaultChainType: BlockchainType.EVM });
 *
 *   const handleConnect = async () => {
 *     await activeWallet.connect();
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={() => switchChainType(BlockchainType.SOLANA)}>
 *         Switch to Solana
 *       </button>
 *       <button onClick={handleConnect}>Connect Wallet</button>
 *       {isConnected && <p>Connected: {address}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWallet(options?: UseWalletOptions): UseWalletReturn {
  const { defaultChainType = BlockchainType.EVM } = options || {};

  const [chainType, setChainType] = useState<BlockchainType>(defaultChainType);

  const evmWallet = useEVMWallet();
  const solanaWallet = useSolanaWallet();

  /**
   * Switch between blockchain types
   */
  const switchChainType = useCallback((type: BlockchainType) => {
    setChainType(type);
  }, []);

  /**
   * Get the active wallet based on current chain type
   */
  const activeWallet: Wallet = chainType === BlockchainType.EVM ? evmWallet : solanaWallet;

  /**
   * Check if any wallet is connected
   */
  const isConnected = evmWallet.connectionState === 'connected' ||
                      solanaWallet.connectionState === 'connected';

  /**
   * Get active address based on chain type
   */
  const address = activeWallet.address;

  return {
    chainType,
    evmWallet,
    solanaWallet,
    activeWallet,
    switchChainType,
    isConnected,
    address,
  };
}
