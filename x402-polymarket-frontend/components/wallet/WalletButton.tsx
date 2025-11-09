'use client';

import React from 'react';
import { useWallet } from '@/app/hooks/wallet';
import { BlockchainType, WalletUtils } from '@/app/utils/wallet';

/**
 * Wallet Button Props
 */
interface WalletButtonProps {
  className?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Wallet connection button component
 * Handles both EVM and Solana wallet connections
 */
export function WalletButton({
  className = '',
  onConnect,
  onDisconnect,
}: WalletButtonProps) {
  const { activeWallet, isConnected, address, chainType } = useWallet();

  const handleClick = async () => {
    try {
      if (isConnected) {
        await activeWallet.disconnect();
        onDisconnect?.();
      } else {
        await activeWallet.connect();
        onConnect?.();
      }
    } catch (error) {
      console.error('Wallet action failed:', error);
    }
  };

  const displayAddress = address
    ? WalletUtils.formatAddress(address, chainType)
    : null;

  const buttonText = isConnected
    ? displayAddress || 'Connected'
    : 'Connect Wallet';

  const baseClassName = `px-6 py-3 rounded-lg font-semibold transition-all ${className}`;
  const stateClassName = isConnected
    ? 'bg-green-600 hover:bg-green-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <button
      onClick={handleClick}
      className={`${baseClassName} ${stateClassName}`}
      type="button"
    >
      {buttonText}
    </button>
  );
}

/**
 * Chain Switcher Props
 */
interface ChainSwitcherProps {
  className?: string;
  onChange?: (chainType: BlockchainType) => void;
}

/**
 * Chain type switcher component
 * Allows users to switch between EVM and Solana
 */
export function ChainSwitcher({ className = '', onChange }: ChainSwitcherProps) {
  const { chainType, switchChainType } = useWallet();

  const handleSwitch = (newChainType: BlockchainType) => {
    switchChainType(newChainType);
    onChange?.(newChainType);
  };

  return (
    <div className={`inline-flex rounded-lg border border-gray-300 ${className}`}>
      <button
        onClick={() => handleSwitch(BlockchainType.EVM)}
        className={`px-4 py-2 font-medium transition-colors ${
          chainType === BlockchainType.EVM
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        } rounded-l-lg`}
        type="button"
      >
        EVM
      </button>
      <button
        onClick={() => handleSwitch(BlockchainType.SOLANA)}
        className={`px-4 py-2 font-medium transition-colors ${
          chainType === BlockchainType.SOLANA
            ? 'bg-purple-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        } rounded-r-lg`}
        type="button"
      >
        Solana
      </button>
    </div>
  );
}

/**
 * Wallet Info Props
 */
interface WalletInfoProps {
  className?: string;
  showBalance?: boolean;
}

/**
 * Wallet information display component
 */
export function WalletInfo({ className = '' }: WalletInfoProps) {
  const { activeWallet, isConnected, address, chainType } = useWallet();

  if (!isConnected || !address) {
    return null;
  }

  const displayAddress = WalletUtils.formatAddress(address, chainType);

  return (
    <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Chain:</span>
          <span className="font-medium">
            {chainType === BlockchainType.EVM ? 'EVM' : 'Solana'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Address:</span>
          <span className="font-mono text-sm">{displayAddress}</span>
        </div>
        {chainType === BlockchainType.EVM && 'chainId' in activeWallet && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Chain ID:</span>
            <span className="font-medium">{activeWallet.chainId}</span>
          </div>
        )}
      </div>
    </div>
  );
}
