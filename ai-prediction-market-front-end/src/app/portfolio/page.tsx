'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui';
import { LoadingSpinner, EmptyState } from '@/components/common';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { usePortfolio } from '@/features/portfolio/hooks';
import { formatCurrency, ROUTES } from '@/lib/utils';
import { TrendingUp, TrendingDown, Layers, Wallet2 } from 'lucide-react';

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: positions, isLoading, error } = usePortfolio();

  const summary = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { totalValue: 0, activePositions: 0, totalPnl: 0 };
    }
    return positions.reduce(
      (acc, pos) => {
        const positionValue = pos.yesBalance + pos.noBalance + pos.lpBalance;
        return {
          totalValue: acc.totalValue + positionValue,
          activePositions: acc.activePositions + (positionValue > 0 ? 1 : 0),
          totalPnl: acc.totalPnl + pos.realizedPnl,
        };
      },
      { totalValue: 0, activePositions: 0, totalPnl: 0 }
    );
  }, [positions]);

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <Wallet2 className="mx-auto h-16 w-16 text-purple-400 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">View Your Portfolio</h1>
        <p className="text-gray-400 mb-8">Connect your wallet to track your positions and trading performance.</p>
        <Button onClick={() => setVisible(true)} size="lg" className="bg-purple-600 hover:bg-purple-700">
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">My Portfolio</h1>
        <p className="text-gray-500 font-mono">{publicKey?.toBase58()}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900/50 rounded-2xl p-6 border border-purple-900/30">
          <p className="text-sm text-gray-400 mb-2">Total Value</p>
          <p className="text-3xl font-bold text-white">
            {isLoading ? <LoadingSpinner size="sm" /> : formatCurrency(summary.totalValue)}
          </p>
        </div>
        <div className="bg-gray-900/50 rounded-2xl p-6 border border-purple-900/30">
          <p className="text-sm text-gray-400 mb-2">Active Positions</p>
          <p className="text-3xl font-bold text-white">
            {isLoading ? <LoadingSpinner size="sm" /> : summary.activePositions}
          </p>
        </div>
        <div className="bg-gray-900/50 rounded-2xl p-6 border border-purple-900/30">
          <p className="text-sm text-gray-400 mb-2">Total P&L</p>
          <p className={`text-3xl font-bold ${summary.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {isLoading ? <LoadingSpinner size="sm" /> : formatCurrency(summary.totalPnl)}
          </p>
        </div>
      </div>

      <div className="bg-gray-900/50 rounded-2xl border border-purple-900/30">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white">Positions</h2>
        </div>
        <div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>Failed to load positions.</p>
              <p className="text-sm text-gray-500">Please try again later.</p>
            </div>
          ) : !positions || positions.length === 0 ? (
            <div className="text-center py-12">
              <EmptyState
                title="No positions to show"
                description="When you trade on a market, your positions will appear here."
                action={
                  <Link href={ROUTES.MARKETS}>
                    <Button className="mt-4 bg-purple-600 hover:bg-purple-700">Explore Markets</Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {positions.map((position) => (
                <Link
                  key={position.marketAddress}
                  href={ROUTES.MARKET_DETAIL(position.marketAddress)}
                  className="block p-6 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white">{position.marketName || 'Market'}</span>
                    <span
                      className={`font-medium flex items-center ${
                        position.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {position.realizedPnl >= 0 ? (
                        <TrendingUp className="mr-1 h-4 w-4" />
                      ) : (
                        <TrendingDown className="mr-1 h-4 w-4" />
                      )}
                      {formatCurrency(position.realizedPnl)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 font-mono">{position.marketAddress}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    {position.yesBalance > 0 && (
                      <div>
                        <span className="text-gray-400">YES Shares</span>
                        <p className="font-bold text-green-400 text-lg">{position.yesBalance.toFixed(2)}</p>
                      </div>
                    )}
                    {position.noBalance > 0 && (
                      <div>
                        <span className="text-gray-400">NO Shares</span>
                        <p className="font-bold text-red-400 text-lg">{position.noBalance.toFixed(2)}</p>
                      </div>
                    )}
                    {position.lpBalance > 0 && (
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-purple-400" />
                        <div>
                          <span className="text-gray-400">LP Tokens</span>
                          <p className="font-bold text-purple-400 text-lg">{position.lpBalance.toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
