'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui';
import { MarketCard, MarketCardSkeleton } from './MarketCard';
import { ErrorDisplay } from '@/components/common';
import { useMarkets } from '@/features/markets/hooks';
import { DEFAULT_PAGE_SIZE, CLIENT_FILTER_FETCH_LIMIT } from '@/lib/utils/constants';
import type { SortOption, StatusFilter } from './MarketFilters';
import type { MarketWithMetadata } from '@/features/markets/types';

interface MarketListProps {
  initialLimit?: number;
  // Filter props
  searchQuery?: string;
  category?: string | null;
  sortBy?: SortOption;
  statusFilter?: StatusFilter;
  onResultCount?: (count: number) => void;
  // Lucky mode
  luckyMarkets?: string[];
  onActiveMarketsReady?: (addresses: string[]) => void;
}

export function MarketList({
  initialLimit = DEFAULT_PAGE_SIZE,
  searchQuery = '',
  category = null,
  sortBy = 'newest',
  statusFilter = 'all',
  onResultCount,
  luckyMarkets,
  onActiveMarketsReady,
}: MarketListProps) {
  const [page, setPage] = useState(0);
  const offset = page * initialLimit;

  const { data, isLoading, isError, error, refetch } = useMarkets({
    limit: CLIENT_FILTER_FETCH_LIMIT,
    offset: 0,
  });

  const allMarkets = data?.markets || [];

  // Apply filters client-side
  const filteredMarkets = useMemo(() => {
    // Lucky mode: filter by specific market addresses
    if (luckyMarkets && luckyMarkets.length > 0) {
      return allMarkets.filter((m) => luckyMarkets.includes(m.address));
    }

    let result = [...allMarkets];

    // Filter by category
    if (category) {
      result = result.filter((m) => m.metadata?.category?.toLowerCase() === category.toLowerCase());
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.metadata?.description?.toLowerCase().includes(query) ||
          m.metadata?.category?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'liquidity_high':
          return b.totalLiquidity - a.totalLiquidity;
        case 'liquidity_low':
          return a.totalLiquidity - b.totalLiquidity;
        default:
          return 0;
      }
    });

    return result;
  }, [allMarkets, category, statusFilter, searchQuery, sortBy, luckyMarkets]);

  // Paginate filtered results
  const paginatedMarkets = useMemo(() => {
    const start = page * initialLimit;
    return filteredMarkets.slice(start, start + initialLimit);
  }, [filteredMarkets, page, initialLimit]);

  const totalPages = Math.ceil(filteredMarkets.length / initialLimit);

  // Report result count
  useEffect(() => {
    onResultCount?.(filteredMarkets.length);
  }, [filteredMarkets.length, onResultCount]);

  // Report active market addresses for lucky mode
  useEffect(() => {
    if (onActiveMarketsReady) {
      const activeAddresses = allMarkets
        .filter((m) => m.status === 'active')
        .map((m) => m.address);
      onActiveMarketsReady(activeAddresses);
    }
  }, [allMarkets, onActiveMarketsReady]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [category, statusFilter, searchQuery, sortBy, luckyMarkets]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: initialLimit }).map((_, i) => (
          <MarketCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorDisplay
        title="Failed to load markets"
        message={error instanceof Error ? error.message : 'An error occurred'}
        onRetry={() => refetch()}
      />
    );
  }

  if (paginatedMarkets.length === 0) {
    const hasFilters = searchQuery || category || statusFilter !== 'all';
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          {hasFilters
            ? 'No markets match your filters. Try adjusting your search criteria.'
            : 'No markets found. Be the first to create one!'
          }
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Market grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedMarkets.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
