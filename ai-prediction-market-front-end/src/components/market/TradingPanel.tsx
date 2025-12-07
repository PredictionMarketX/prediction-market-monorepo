'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, Button, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { formatPercent, formatCurrency } from '@/lib/utils';
import { DEFAULT_SLIPPAGE } from '@/lib/utils/constants';
import { useSwap } from '@/features/trading/hooks';
import type { Market } from '@/types';

interface TradingPanelProps {
  market: Market;
}

export function TradingPanel({ market }: TradingPanelProps) {
  const { connected } = useWallet();
  const [tradeType, setTradeType] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);

  const swapMutation = useSwap();

  const estimatedShares = parseFloat(amount) || 0;
  const price = tradeType === 'yes' ? market.yesPrice : market.noPrice;
  const estimatedCost = estimatedShares * price;

  const handleTrade = async () => {
    if (!connected || !amount || parseFloat(amount) <= 0) return;

    await swapMutation.mutateAsync({
      marketAddress: market.address,
      direction: 'buy',
      tokenType: tradeType,
      amount: parseFloat(amount),
      slippage,
    });

    // Reset form on success
    setAmount('');
  };

  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Trade
        </h3>

        {/* Token selection */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setTradeType('yes')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              tradeType === 'yes'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
            }`}
          >
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              Yes
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatPercent(market.yesPrice)}
            </div>
          </button>

          <button
            onClick={() => setTradeType('no')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              tradeType === 'no'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
            }`}
          >
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              No
            </div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {formatPercent(market.noPrice)}
            </div>
          </button>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <Input
            label="Amount (USDC)"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            rightAddon="USDC"
          />
        </div>

        {/* Slippage */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Slippage Tolerance
          </label>
          <div className="flex gap-2">
            {[1, 5, 10].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  slippage === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {value}%
              </button>
            ))}
            <Input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 5)}
              className="w-20"
              rightAddon="%"
            />
          </div>
        </div>

        {/* Estimate */}
        {parseFloat(amount) > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500 dark:text-gray-400">
                Estimated Shares
              </span>
              <span className="font-medium">
                {estimatedShares.toFixed(2)} {tradeType.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Price per Share
              </span>
              <span className="font-medium">{formatCurrency(price)}</span>
            </div>
          </div>
        )}

        {/* Trade button */}
        <Button
          className="w-full"
          onClick={handleTrade}
          isLoading={swapMutation.isPending}
          disabled={!connected || !amount || parseFloat(amount) <= 0 || swapMutation.isPending}
        >
          {connected
            ? `Buy ${tradeType.toUpperCase()}`
            : 'Connect Wallet to Trade'}
        </Button>
      </CardContent>
    </Card>
  );
}
