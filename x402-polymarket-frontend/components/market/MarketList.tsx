'use client';

import React from 'react';
import { usePredictionMarket } from '@/app/hooks/usePredictionMarket';
import { MarketCard } from './MarketCard';
import { PublicKey } from '@solana/web3.js';
import type { TokenType } from '@/app/lib/solana/types';

export function MarketList() {
  const {
    markets,
    loading,
    loadingMore,
    error,
    fetchMarkets,
    calculatePrice,
    loadMoreMarkets,
    hasMore,
    total
  } = usePredictionMarket();

  // Markets are fetched automatically in usePredictionMarket, no wallet needed for viewing

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-64"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Error Loading Markets
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchMarkets}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Markets Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Be the first to create a prediction market!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {markets.map(({ address, data }) => {
          const yesPrice = calculatePrice(data, 0 as TokenType);
          const noPrice = calculatePrice(data, 1 as TokenType);

          return (
            <MarketCard
              key={address.toBase58()}
              address={address}
              market={data}
              yesPrice={yesPrice}
              noPrice={noPrice}
            />
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {markets.length} of {total} markets
          </p>
          <button
            onClick={loadMoreMarkets}
            disabled={loadingMore}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              'Load More Markets'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
