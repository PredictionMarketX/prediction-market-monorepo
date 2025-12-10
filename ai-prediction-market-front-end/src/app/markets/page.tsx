"use client";

import { useState, useCallback, useRef } from "react";
import { MarketList, CategoryBanner, MarketFilters } from "@/components/market";
import type { SortOption, StatusFilter } from "@/components/market";

const LUCKY_COUNT = 3;

function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function MarketsPage() {
  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [resultCount, setResultCount] = useState<number | undefined>();

  // Lucky mode state
  const [luckyMarkets, setLuckyMarkets] = useState<string[] | undefined>();
  const activeMarketsRef = useRef<string[]>([]);

  const handleResultCount = useCallback((count: number) => {
    setResultCount(count);
  }, []);

  const handleActiveMarketsReady = useCallback((addresses: string[]) => {
    activeMarketsRef.current = addresses;
  }, []);

  const handleFeelingLucky = useCallback(() => {
    // Always pick new random active markets (re-roll)
    const randomMarkets = getRandomItems(
      activeMarketsRef.current,
      LUCKY_COUNT
    );
    setLuckyMarkets(randomMarkets);
    // Clear other filters
    setSelectedCategory(null);
    setSearchQuery("");
    setSortBy("newest");
    setStatusFilter("all");
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Markets</h1>
        <p className="text-gray-400">Browse and trade on prediction markets</p>
      </div>

      {/* Category Banner */}
      <CategoryBanner
        selectedCategory={selectedCategory}
        onCategoryChange={(cat) => {
          setSelectedCategory(cat);
          setLuckyMarkets(undefined);
        }}
      />

      {/* Search & Filters */}
      <MarketFilters
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setLuckyMarkets(undefined);
        }}
        sortBy={sortBy}
        onSortChange={(s) => {
          setSortBy(s);
          setLuckyMarkets(undefined);
        }}
        statusFilter={statusFilter}
        onStatusChange={(s) => {
          setStatusFilter(s);
          setLuckyMarkets(undefined);
        }}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        resultCount={resultCount}
        onFeelingLucky={handleFeelingLucky}
        isLuckyMode={!!luckyMarkets}
      />

      {/* Lucky Mode Banner */}
      {luckyMarkets && luckyMarkets.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/30">
          <span className="text-amber-400 text-sm font-medium">
            Lucky markets
          </span>
          <button
            onClick={() => setLuckyMarkets(undefined)}
            className="text-amber-400/70 hover:text-amber-400 text-sm underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Market List */}
      <MarketList
        searchQuery={searchQuery}
        category={selectedCategory}
        sortBy={sortBy}
        statusFilter={statusFilter}
        onResultCount={handleResultCount}
        luckyMarkets={luckyMarkets}
        onActiveMarketsReady={handleActiveMarketsReady}
      />
    </div>
  );
}
