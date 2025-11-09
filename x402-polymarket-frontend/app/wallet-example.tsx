'use client';

/**
 * Example component demonstrating multi-chain wallet integration
 *
 * This file shows how to use the wallet system in your app.
 * Copy and adapt the patterns shown here for your own components.
 */

import React, { useState } from 'react';
import { useWallet } from '@/app/hooks';
import { BlockchainType, WalletUtils, EVMWalletUtils, SolanaWalletUtils } from '@/app/utils/wallet';
import { WalletButton, ChainSwitcher, WalletInfo } from '@/components/wallet';
import { parseEther } from 'viem';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

export function WalletExamplePage() {
  const {
    evmWallet,
    solanaWallet,
    isConnected,
    address,
    chainType,
  } = useWallet({ defaultChainType: BlockchainType.EVM });

  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Clear messages after 5 seconds
  const showMessage = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } else {
      setStatus(msg);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  // EVM Examples
  const handleEVMSignMessage = async () => {
    try {
      const signature = await evmWallet.signMessage('Hello from EVM!');
      showMessage(`Message signed: ${signature.slice(0, 20)}...`);
    } catch (err) {
      showMessage((err as Error).message, true);
    }
  };

  const handleEVMSendTransaction = async () => {
    try {
      // Example: Send 0.001 ETH
      const hash = await evmWallet.sendTransaction({
        to: '0x0000000000000000000000000000000000000000', // Replace with actual address
        value: parseEther('0.001'),
      });
      showMessage(`Transaction sent: ${hash}`);

      // Get explorer URL
      const explorerUrl = EVMWalletUtils.getTransactionUrl(hash, 'base-sepolia');
      console.log('View on explorer:', explorerUrl);
    } catch (err) {
      showMessage((err as Error).message, true);
    }
  };

  const handleSwitchToBase = async () => {
    try {
      await evmWallet.switchChain(8453); // Base mainnet
      showMessage('Switched to Base network');
    } catch (err) {
      showMessage((err as Error).message, true);
    }
  };

  // Solana Examples
  const handleSolanaSignMessage = async () => {
    try {
      const message = new TextEncoder().encode('Hello from Solana!');
      const signature = await solanaWallet.signMessage(message);
      showMessage(`Message signed: ${signature.length} bytes`);
    } catch (err) {
      showMessage((err as Error).message, true);
    }
  };

  const handleSolanaSendTransaction = async () => {
    try {
      if (!solanaWallet.publicKey || !solanaWallet.connection) {
        throw new Error('Wallet not connected');
      }

      // Example: Send 0.001 SOL
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: solanaWallet.publicKey,
          toPubkey: new PublicKey('11111111111111111111111111111111'), // Replace with actual address
          lamports: 0.001 * LAMPORTS_PER_SOL,
        })
      );

      const signature = await solanaWallet.sendTransaction(transaction);
      showMessage(`Transaction sent: ${signature}`);

      // Get explorer URL
      const explorerUrl = SolanaWalletUtils.getTransactionUrl(signature, 'devnet');
      console.log('View on explorer:', explorerUrl);
    } catch (err) {
      showMessage((err as Error).message, true);
    }
  };

  const handleGetSolanaBalance = async () => {
    try {
      if (!solanaWallet.publicKey || !solanaWallet.connection) {
        throw new Error('Wallet not connected');
      }

      const balance = await solanaWallet.connection.getBalance(solanaWallet.publicKey);
      const sol = SolanaWalletUtils.lamportsToSol(balance);
      showMessage(`Balance: ${sol.toFixed(4)} SOL`);
    } catch (err) {
      showMessage((err as Error).message, true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Multi-Chain Wallet Demo</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect and interact with both EVM and Solana wallets
          </p>
        </div>

        {/* Chain Switcher */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Select Blockchain</h2>
          <ChainSwitcher className="w-full justify-center" />
        </div>

        {/* Wallet Connection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>
          <div className="space-y-4">
            <WalletButton className="w-full" />
            {isConnected && <WalletInfo />}
          </div>
        </div>

        {/* Status Messages */}
        {(status || error) && (
          <div
            className={`p-4 rounded-lg ${
              error
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}
          >
            {error || status}
          </div>
        )}

        {/* EVM Actions */}
        {isConnected && chainType === BlockchainType.EVM && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">EVM Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleEVMSignMessage}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Sign Message
              </button>
              <button
                onClick={handleSwitchToBase}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Switch to Base
              </button>
              <button
                onClick={handleEVMSendTransaction}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Send Test TX
              </button>
            </div>
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <strong>Chain ID:</strong> {evmWallet.chainId || 'Not connected'}
              </p>
            </div>
          </div>
        )}

        {/* Solana Actions */}
        {isConnected && chainType === BlockchainType.SOLANA && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Solana Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleSolanaSignMessage}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Sign Message
              </button>
              <button
                onClick={handleGetSolanaBalance}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Get Balance
              </button>
              <button
                onClick={handleSolanaSendTransaction}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Send Test TX
              </button>
            </div>
          </div>
        )}

        {/* Utilities Demo */}
        {isConnected && address && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Utility Functions</h2>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Full Address:</strong>{' '}
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {address}
                </code>
              </p>
              <p>
                <strong>Formatted:</strong>{' '}
                {WalletUtils.formatAddress(address, chainType)}
              </p>
              <p>
                <strong>Valid:</strong>{' '}
                {WalletUtils.isValidAddress(address, chainType) ? '✅ Yes' : '❌ No'}
              </p>
              <p>
                <strong>Explorer:</strong>{' '}
                {chainType === BlockchainType.EVM ? (
                  <a
                    href={EVMWalletUtils.getAddressUrl(address as `0x${string}`, 'base-sepolia')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View on BaseScan
                  </a>
                ) : (
                  <a
                    href={SolanaWalletUtils.getAddressUrl(address, 'devnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline"
                  >
                    View on Solana Explorer
                  </a>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isConnected && (
          <div className="bg-blue-50 dark:bg-blue-900 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
            <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Select your preferred blockchain (EVM or Solana)</li>
              <li>Click &quot;Connect Wallet&quot; to connect your wallet</li>
              <li>Try the various actions available for each chain</li>
              <li>Check the WALLET_INTEGRATION_GUIDE.md for more details</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default WalletExamplePage;
