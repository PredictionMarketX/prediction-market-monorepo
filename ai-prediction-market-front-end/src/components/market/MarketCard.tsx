'use client';

import Link from 'next/link';
import { formatPercent, formatCurrency } from '@/lib/utils';
import { UI_STYLES, getStatusColorClass } from '@/components/landing/constants';
import type { MarketWithMetadata } from '@/features/markets/types';

type MarketCardVariant = 'default' | 'trending';

interface MarketCardProps {
  market: MarketWithMetadata;
  variant?: MarketCardVariant;
}

export function MarketCard({ market, variant = 'default' }: MarketCardProps) {
  const yesPercent = market.yesPrice * 100;
  const { metadata } = market;
  const statusColor = getStatusColorClass(market.status);

  if (variant === 'trending') {
    return (
      <Link href={`/markets/${market.address}`}>
        <div className={`group relative ${UI_STYLES.card.base} ${UI_STYLES.card.padding.sm} overflow-hidden ${UI_STYLES.card.hover}`}>
          <div className={`absolute top-0 left-0 w-full h-full ${UI_STYLES.card.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
              </span>
            </div>

            <h3 className="text-white font-semibold mb-4 min-h-[48px] line-clamp-2">{market.name}</h3>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-green-600/20 rounded-xl py-3 px-4 text-center border border-green-600/30">
                <div className="text-green-300 text-xs font-medium mb-1">YES</div>
                <div className="text-white text-xl font-bold">${market.yesPrice.toFixed(2)}</div>
              </div>
              <div className="flex-1 bg-red-600/20 rounded-xl py-3 px-4 text-center border border-red-600/30">
                <div className="text-red-300 text-xs font-medium mb-1">NO</div>
                <div className="text-white text-xl font-bold">${market.noPrice.toFixed(2)}</div>
              </div>
            </div>

            <div className="flex justify-between text-sm text-gray-400">
              <span>Liquidity: {formatCurrency(market.totalLiquidity)}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link href={`/markets/${market.address}`}>
      <div className={`group relative ${UI_STYLES.card.base} ${UI_STYLES.card.padding.sm} overflow-hidden ${UI_STYLES.card.hover} h-full flex flex-col`}>
        <div className={`absolute top-0 left-0 w-full h-full ${UI_STYLES.card.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
        <div className="relative z-10 flex flex-col flex-grow">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>
                {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
              </span>
              {metadata?.category && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-900 text-blue-200">
                  {metadata.category}
                </span>
              )}
            </div>
          </div>

          <h3 className="font-semibold text-white mb-2 line-clamp-2 flex-grow">{market.name}</h3>

          <div className="space-y-2 my-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-400 font-medium">Yes {formatPercent(market.yesPrice)}</span>
              <span className="text-red-400 font-medium">No {formatPercent(market.noPrice)}</span>
            </div>
            <div className="w-full bg-red-500/30 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-sm text-gray-400 pt-3 border-t border-gray-800">
            <span>Liquidity</span>
            <span className="font-medium text-white">{formatCurrency(market.totalLiquidity)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MarketCardSkeleton({ variant = 'default' }: { variant?: MarketCardVariant }) {
  const baseClasses = `${UI_STYLES.card.base} ${UI_STYLES.card.padding.sm} ${UI_STYLES.skeleton.base}`;

  if (variant === 'trending') {
    return (
      <div className={baseClasses}>
        <div className="flex justify-between items-start mb-4">
          <div className={`h-6 w-16 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.roundedFull}`} />
        </div>
        <div className={`h-12 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.rounded} mb-4`} />
        <div className="flex gap-3 mb-4">
          <div className={`flex-1 h-20 ${UI_STYLES.skeleton.base} rounded-xl`} />
          <div className={`flex-1 h-20 ${UI_STYLES.skeleton.base} rounded-xl`} />
        </div>
        <div className={`h-4 w-32 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.rounded}`} />
      </div>
    );
  }

  return (
    <div className={`${baseClasses} h-full`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`h-5 w-16 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.roundedFull}`} />
        <div className={`h-4 w-12 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.rounded}`} />
      </div>
      <div className={`h-12 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.rounded} mb-4`} />
      <div className="space-y-2 mb-4">
        <div className={`h-4 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.rounded}`} />
        <div className={`h-2.5 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.roundedFull}`} />
      </div>
      <div className={`h-8 ${UI_STYLES.skeleton.base} ${UI_STYLES.skeleton.rounded} mt-auto`} />
    </div>
  );
}
