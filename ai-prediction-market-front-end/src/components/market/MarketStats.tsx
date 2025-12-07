'use client';

import { Card, CardContent } from '@/components/ui';
import { formatPercent, formatCurrency, formatAddress } from '@/lib/utils';
import type { Market } from '@/types';

interface MarketStatsProps {
  market: Market;
}

export function MarketStats({ market }: MarketStatsProps) {
  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Market Stats
        </h3>
        <div className="space-y-4">
          {/* Current Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Yes Price
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatPercent(market.yesPrice)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                No Price
              </p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                {formatPercent(market.noPrice)}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span
                className={`font-medium ${
                  market.status === 'active'
                    ? 'text-green-600'
                    : market.status === 'resolved'
                    ? 'text-gray-600'
                    : 'text-yellow-600'
                }`}
              >
                {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                Total Liquidity
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(market.totalLiquidity)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                B Parameter
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {market.bParameter}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Creator</span>
              <span className="font-medium text-gray-900 dark:text-white font-mono">
                {formatAddress(market.creator, 6)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Address</span>
              <span className="font-medium text-gray-900 dark:text-white font-mono">
                {formatAddress(market.address, 6)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
