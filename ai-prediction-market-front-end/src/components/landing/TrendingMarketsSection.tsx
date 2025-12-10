'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { useMarkets } from '@/features/markets/hooks/useMarkets';
import { MarketCard, MarketCardSkeleton } from '@/components/market/MarketCard';

export function TrendingMarketsSection() {
  const { data, isLoading } = useMarkets({ limit: 3 });
  const markets = data?.markets ?? [];

  return (
    <section className="py-16">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Trending Markets</h2>
          <p className="text-gray-400">Most active prediction markets</p>
        </div>
        <Link href="/markets">
          <Button variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
            View All Markets
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <MarketCardSkeleton variant="trending" />
            <MarketCardSkeleton variant="trending" />
            <MarketCardSkeleton variant="trending" />
          </>
        ) : markets.length > 0 ? (
          markets.map((market, i) => (
            <div key={market.address} className="animate-fade-in-up" style={{ animationDelay: `${i * 150}ms` }}>
              <MarketCard market={market} variant="trending" />
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center py-12">
            <p className="text-gray-400">No markets available yet.</p>
            <Link href="/propose" className="text-purple-400 hover:underline mt-2 inline-block">
              Propose a new market
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
