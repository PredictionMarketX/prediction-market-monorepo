'use client';

import { Search, SlidersHorizontal, ArrowUpDown, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { UI_STYLES } from '@/components/landing/constants';

export type SortOption = 'newest' | 'oldest' | 'liquidity_high' | 'liquidity_low' | 'volume';
export type StatusFilter = 'all' | 'active' | 'resolved' | 'paused';

interface MarketFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  resultCount?: number;
  onFeelingLucky?: () => void;
  isLuckyMode?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'liquidity_high', label: 'Highest Liquidity' },
  { value: 'liquidity_low', label: 'Lowest Liquidity' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'paused', label: 'Paused' },
];

export function MarketFilters({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  statusFilter,
  onStatusChange,
  showFilters,
  onToggleFilters,
  resultCount,
  onFeelingLucky,
  isLuckyMode,
}: MarketFiltersProps) {
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || sortBy !== 'newest' || isLuckyMode;

  return (
    <div className="space-y-4">
      {/* Search bar and filter toggle */}
      <div className="flex gap-3">
        {/* Search input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`
              w-full pl-10 pr-4 py-2.5 rounded-xl text-white placeholder-gray-400
              ${UI_STYLES.card.base} focus:outline-none focus:ring-2 focus:ring-purple-500/50
              transition-all
            `}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Feeling Lucky button */}
        {onFeelingLucky && (
          <Button
            variant="outline"
            onClick={onFeelingLucky}
            className={`
              flex items-center gap-2 border-purple-900/30 transition-all
              ${isLuckyMode
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/50'
                : 'text-gray-300 hover:text-amber-400 hover:border-amber-500/50'
              }
            `}
          >
            <Sparkles className={`w-4 h-4 ${isLuckyMode ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">Feeling Lucky</span>
          </Button>
        )}

        {/* Filter toggle button */}
        <Button
          variant="outline"
          onClick={onToggleFilters}
          className={`
            flex items-center gap-2 border-purple-900/30
            ${showFilters ? 'bg-purple-900/30 text-purple-400' : 'text-gray-300 hover:text-white'}
          `}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-purple-500 rounded-full" />
          )}
        </Button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className={`p-4 rounded-xl ${UI_STYLES.card.base} space-y-4`}>
          <div className="flex flex-wrap gap-4">
            {/* Sort dropdown */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm text-gray-400 mb-2 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as SortOption)}
                className={`
                  w-full px-3 py-2 rounded-lg bg-gray-800/50 text-white
                  border border-purple-900/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                `}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm text-gray-400 mb-2">
                Status
              </label>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onStatusChange(option.value)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${statusFilter === option.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800/50 text-gray-400 hover:text-white border border-purple-900/30'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
              <span className="text-sm text-gray-400">
                {resultCount !== undefined && `${resultCount} market${resultCount !== 1 ? 's' : ''} found`}
              </span>
              <button
                onClick={() => {
                  onSearchChange('');
                  onSortChange('newest');
                  onStatusChange('all');
                }}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
