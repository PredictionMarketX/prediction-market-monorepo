'use client';

import { MarketList } from '@/components/market';

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Prediction Markets
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Trade on the outcomes of future events
        </p>
      </div>

      <MarketList />
    </div>
  );
}
