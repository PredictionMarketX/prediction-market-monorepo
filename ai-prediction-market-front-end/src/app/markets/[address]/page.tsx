'use client';

import { useParams } from 'next/navigation';
import { useMarket } from '@/features/markets/hooks';
import { MarketStats } from '@/components/market';
import { TradingPanel } from '@/components/market/TradingPanel';
import { LiquidityPanel } from '@/components/market/LiquidityPanel';
import { LoadingPage, ErrorDisplay } from '@/components/common';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';

export default function MarketDetailPage() {
  const params = useParams();
  const address = params.address as string;

  const { data: market, isLoading, isError, error, refetch } = useMarket(address);

  if (isLoading) {
    return <LoadingPage message="Loading market..." />;
  }

  if (isError || !market) {
    return (
      <ErrorDisplay
        title="Failed to load market"
        message={error instanceof Error ? error.message : 'Market not found'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div>
      {/* Market header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {market.name}
        </h1>
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            market.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : market.status === 'resolved'
              ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}
        >
          {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
        </span>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Trading */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="trade">
            <TabsList>
              <TabsTrigger value="trade">Trade</TabsTrigger>
              <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
            </TabsList>

            <TabsContent value="trade">
              <TradingPanel market={market} />
            </TabsContent>

            <TabsContent value="liquidity">
              <LiquidityPanel market={market} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column: Stats */}
        <div>
          <MarketStats market={market} />
        </div>
      </div>
    </div>
  );
}
