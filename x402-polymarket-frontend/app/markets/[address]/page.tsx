'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { usePredictionMarket } from '@/app/hooks/usePredictionMarket';
import { TradingInterface } from '@/components/market/TradingInterface';
import { LiquidityInterface } from '@/components/market/LiquidityInterface';
import { formatUSDC } from '@/app/lib/solana/program';
import type { Market, UserInfo, TokenType } from '@/app/lib/solana/types';
import Link from 'next/link';

export default function MarketDetailPage() {
  const params = useParams();
  const address = params.address as string;

  const { fetchMarket, fetchUserInfo, loading, isConnected, calculatePrice } =
    usePredictionMarket();

  const [market, setMarket] = useState<Market | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'trade' | 'liquidity'>('trade');
  const [marketAddress, setMarketAddress] = useState<PublicKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (address) {
      try {
        const pubkey = new PublicKey(address);
        setMarketAddress(pubkey);
      } catch (error) {
        console.error('Invalid market address:', error);
        setError('Invalid market address');
        setIsLoading(false);
      }
    }
  }, [address]);

  const refreshMarketData = () => {
    console.log('[MarketDetail] Refreshing market data...');
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    const loadMarketData = async () => {
      if (!marketAddress) return;

      try {
        setIsLoading(true);
        setError(null);

        console.log('[MarketDetail] Fetching market:', marketAddress.toBase58());
        const marketData = await fetchMarket(marketAddress);

        if (!marketData) {
          console.error('[MarketDetail] Market not found');
          setError('Market not found. It may not exist or has not been initialized yet.');
          setIsLoading(false);
          return;
        }

        console.log('[MarketDetail] Market loaded:', marketData);
        setMarket(marketData);

        if (isConnected) {
          const userInfoData = await fetchUserInfo(marketAddress);
          setUserInfo(userInfoData);
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('[MarketDetail] Error loading market:', err);
        setError(err.message || 'Failed to load market data');
        setIsLoading(false);
      }
    };

    loadMarketData();
    // Removed auto-refresh to prevent page reloads while user is interacting
  }, [marketAddress, isConnected, fetchMarket, fetchUserInfo, refreshKey]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
            {error}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Market address: {address}
          </p>
          <Link
            href="/markets"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !market) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading market data...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">{address}</p>
        </div>
      </div>
    );
  }

  const yesPrice = calculatePrice(market, 0 as TokenType);
  const noPrice = calculatePrice(market, 1 as TokenType);
  const totalLiquidity = (market.poolYesReserve && market.poolNoReserve)
    ? formatUSDC(market.poolYesReserve.add(market.poolNoReserve))
    : '0.00';
  const isResolved = market.status === 2;
  const isPaused = market.status === 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/markets"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← Back to Markets
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Market Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market Header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Market #{address.slice(0, 8)}...
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {address}
                  </p>
                </div>
                {isResolved ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    Resolved:{' '}
                    {market.outcome === 1 ? 'YES' : market.outcome === 2 ? 'NO' : 'INVALID'}
                  </span>
                ) : isPaused ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    Paused
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    Active
                  </span>
                )}
              </div>

              {/* Price Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">YES</div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {(yesPrice * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    ${yesPrice.toFixed(3)} per token
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">NO</div>
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {(noPrice * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    ${noPrice.toFixed(3)} per token
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Total Liquidity
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  ${totalLiquidity}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Total Fees
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  ${formatUSDC(market.totalFeesCollected)}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  YES Minted
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatUSDC(market.totalYesMinted)}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  NO Minted
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatUSDC(market.totalNoMinted)}
                </div>
              </div>
            </div>

            {/* User Position */}
            {isConnected && userInfo && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Your Position
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      YES Tokens
                    </div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {formatUSDC(userInfo.yesAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      NO Tokens
                    </div>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {formatUSDC(userInfo.noAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      LP Shares
                    </div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {formatUSDC(userInfo.lpShares)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Realized PnL
                    </div>
                    <div
                      className={`text-lg font-semibold ${
                        userInfo.realizedPnl?.isNeg()
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {userInfo.realizedPnl?.isNeg() ? '-' : '+'}$
                      {userInfo.realizedPnl ? formatUSDC(userInfo.realizedPnl.abs()) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Trading/LP Interface */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-4">
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('trade')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'trade'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Trade
                </button>
                <button
                  onClick={() => setActiveTab('liquidity')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'liquidity'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Liquidity
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'trade' ? (
                  <TradingInterface market={market} marketAddress={marketAddress} onSuccess={refreshMarketData} />
                ) : (
                  <LiquidityInterface market={market} marketAddress={marketAddress} onSuccess={refreshMarketData} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
