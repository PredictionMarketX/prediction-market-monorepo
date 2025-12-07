'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, Button, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useAddLiquidity, useWithdrawLiquidity } from '@/features/liquidity/hooks';
import type { Market } from '@/types';

interface LiquidityPanelProps {
  market: Market;
}

export function LiquidityPanel({ market }: LiquidityPanelProps) {
  const { connected } = useWallet();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');

  const addLiquidityMutation = useAddLiquidity();
  const withdrawLiquidityMutation = useWithdrawLiquidity();

  const isLoading = addLiquidityMutation.isPending || withdrawLiquidityMutation.isPending;

  const handleSubmit = async () => {
    if (!connected || !amount || parseFloat(amount) <= 0) return;

    if (mode === 'add') {
      await addLiquidityMutation.mutateAsync({
        marketAddress: market.address,
        amount: parseFloat(amount),
      });
    } else {
      await withdrawLiquidityMutation.mutateAsync({
        marketAddress: market.address,
        lpAmount: parseFloat(amount),
      });
    }

    // Reset form on success
    setAmount('');
  };

  return (
    <Card variant="bordered">
      <CardContent>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Liquidity
        </h3>

        {/* Current liquidity info */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Total Liquidity
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(market.totalLiquidity)}
          </div>
        </div>

        {/* Mode selection */}
        <Tabs defaultValue="add" onChange={(v) => setMode(v as 'add' | 'remove')}>
          <TabsList className="mb-4">
            <TabsTrigger value="add">Add Liquidity</TabsTrigger>
            <TabsTrigger value="remove">Remove Liquidity</TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <div className="space-y-4">
              <Input
                label="Amount (USDC)"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                rightAddon="USDC"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You will receive LP tokens representing your share of the pool.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="remove">
            <div className="space-y-4">
              <Input
                label="LP Tokens"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                rightAddon="LP"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Burn your LP tokens to withdraw your share of the liquidity.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Submit button */}
        <Button
          className="w-full mt-6"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!connected || !amount || parseFloat(amount) <= 0 || isLoading}
        >
          {connected
            ? mode === 'add'
              ? 'Add Liquidity'
              : 'Remove Liquidity'
            : 'Connect Wallet'}
        </Button>
      </CardContent>
    </Card>
  );
}
