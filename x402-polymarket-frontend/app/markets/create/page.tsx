'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePredictionMarket } from '@/app/hooks/usePredictionMarket';
import { useWallet } from '@/app/hooks/wallet';
import { BlockchainType } from '@/app/utils/wallet';
import type { CreateMarketParams } from '@/app/lib/solana/types';

export default function CreateMarketPage() {
  const router = useRouter();
  const { createMarket, loading, isConnected } = usePredictionMarket();
  const { chainType, switchChainType, isConnected: anyWalletConnected } = useWallet();

  const [formData, setFormData] = useState<CreateMarketParams>({
    yesSymbol: '',
    yesUri: '',
    startSlot: undefined,
    endingSlot: undefined,
    lmsrB: 500, // Default LMSR B parameter (500 USDC)
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showMetadataExample, setShowMetadataExample] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isConnected) {
      setError('Please connect your Solana wallet first');
      return;
    }

    if (!formData.yesSymbol.trim()) {
      setError('Please provide a market question/symbol');
      return;
    }

    try {
      const result = await createMarket(formData);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/markets');
        }, 2000);
      } else {
        setError(result.error || 'Failed to create market');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    }
  };

  if (!isConnected) {
    // Check if user has an EVM wallet connected but needs to switch to Solana
    if (anyWalletConnected && chainType === BlockchainType.EVM) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
              <svg
                className="w-8 h-8 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Switch to Solana Network
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Market creation is only available on Solana. Please switch your network and connect your Solana wallet.
            </p>
            <button
              onClick={() => switchChainType(BlockchainType.SOLANA)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Switch to Solana
            </button>
          </div>
        </div>
      );
    }

    // No wallet connected at all
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
            <svg
              className="w-8 h-8 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please connect your Solana wallet to create a market. Use the wallet button in the header to get started.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>Look for the wallet button in the top right corner</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Prediction Market
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create a new binary prediction market using USDC collateral
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-800 dark:text-green-200">
                Market created successfully! Redirecting...
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-800 dark:text-red-200">{error}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-lg">
          {/* Market Question */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Market Question *
            </label>
            <input
              type="text"
              value={formData.yesSymbol}
              onChange={(e) =>
                setFormData({ ...formData, yesSymbol: e.target.value })
              }
              placeholder="Will Bitcoin reach $100k by 2025?"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This will be the YES token symbol/question
            </p>
          </div>

          {/* Metadata URI */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Metadata URI
            </label>
            <input
              type="url"
              value={formData.yesUri}
              onChange={(e) =>
                setFormData({ ...formData, yesUri: e.target.value })
              }
              placeholder="https://example.com/market-metadata.json"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="mt-2 space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Optional: Link to additional market metadata (JSON format)
              </p>

              {/* Expandable Example */}
              <button
                type="button"
                onClick={() => setShowMetadataExample(!showMetadataExample)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {showMetadataExample ? '▼' : '▶'} View example JSON structure
              </button>

              {showMetadataExample && (
                <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Example metadata.json:
                  </p>
                  <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
{`{
  "name": "Will Bitcoin reach $100k by 2025?",
  "description": "This market resolves YES if Bitcoin (BTC) reaches $100,000 USD on any major exchange before January 1, 2025, 00:00 UTC.",
  "image": "https://example.com/images/btc-100k.png",
  "category": "Cryptocurrency",
  "tags": ["bitcoin", "crypto", "price prediction"],
  "resolutionSource": "CoinMarketCap, Binance, Coinbase",
  "resolutionCriteria": "Market resolves YES if BTC/USD reaches or exceeds $100,000 on CoinMarketCap, Binance, or Coinbase. Price must be sustained for at least 1 minute.",
  "endDate": "2024-12-31T23:59:59Z",
  "creator": {
    "name": "Market Creator",
    "contact": "creator@example.com"
  },
  "additionalInfo": {
    "market_type": "binary",
    "settlement_delay": "24h after resolution"
  }
}`}
                  </pre>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    <strong>Required fields:</strong> name<br/>
                    <strong>Recommended fields:</strong> description, resolutionCriteria, resolutionSource<br/>
                    <strong>Optional fields:</strong> image, category, tags, endDate, creator, additionalInfo
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* LMSR B Parameter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LMSR B Parameter (USDC)
            </label>
            <input
              type="number"
              value={formData.lmsrB}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  lmsrB: parseFloat(e.target.value) || 500,
                })
              }
              min="100"
              step="50"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Liquidity sensitivity parameter (default: 500 USDC). Higher values = less price movement per trade
            </p>
          </div>

          {/* Start Slot */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Slot (Optional)
            </label>
            <input
              type="number"
              value={formData.startSlot || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  startSlot: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="Leave empty to start immediately"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Ending Slot */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ending Slot (Optional)
            </label>
            <input
              type="number"
              value={formData.endingSlot || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  endingSlot: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="Leave empty for no automatic end"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Important Notes:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>You must be whitelisted to create markets</li>
              <li>Markets use USDC as collateral (6 decimals)</li>
              <li>1 USDC = 1 YES token + 1 NO token</li>
              <li>LMSR pricing algorithm determines token prices</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || success}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating Market...
              </span>
            ) : success ? (
              'Market Created!'
            ) : (
              'Create Market'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
