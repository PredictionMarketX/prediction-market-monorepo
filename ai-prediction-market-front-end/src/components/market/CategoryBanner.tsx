'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { categoryIcons, type CategoryIconType } from '@/components/icons';

// Layout constants
const CATEGORY_SCROLL_AMOUNT = 280;
const CATEGORY_CARD_MIN_WIDTH = 160;

// Category configuration with colors and background styles
const CATEGORY_CONFIG = {
  all: {
    label: 'All Markets',
    subtitle: 'Browse everything',
    gradient: 'from-purple-600 via-purple-500 to-indigo-500',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.4) 0%, transparent 50%)',
  },
  crypto: {
    label: 'Crypto',
    subtitle: 'BTC, ETH & more',
    gradient: 'from-orange-500 via-amber-500 to-yellow-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(251, 146, 60, 0.4) 0%, transparent 50%)',
  },
  politics: {
    label: 'Politics',
    subtitle: 'Elections & policy',
    gradient: 'from-blue-600 via-blue-500 to-cyan-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.4) 0%, transparent 50%)',
  },
  sports: {
    label: 'Sports',
    subtitle: 'Games & leagues',
    gradient: 'from-green-500 via-emerald-500 to-teal-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(34, 197, 94, 0.4) 0%, transparent 50%)',
  },
  entertainment: {
    label: 'Entertainment',
    subtitle: 'Movies & culture',
    gradient: 'from-pink-500 via-rose-500 to-red-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.4) 0%, transparent 50%)',
  },
  science: {
    label: 'Science',
    subtitle: 'Tech & discovery',
    gradient: 'from-cyan-500 via-teal-500 to-emerald-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.4) 0%, transparent 50%)',
  },
  finance: {
    label: 'Finance',
    subtitle: 'Markets & economy',
    gradient: 'from-emerald-500 via-green-500 to-lime-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.4) 0%, transparent 50%)',
  },
  world: {
    label: 'World',
    subtitle: 'Global events',
    gradient: 'from-indigo-500 via-violet-500 to-purple-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.4) 0%, transparent 50%)',
  },
  other: {
    label: 'Other',
    subtitle: 'Miscellaneous',
    gradient: 'from-gray-500 via-slate-500 to-zinc-400',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(107, 114, 128, 0.4) 0%, transparent 50%)',
  },
} as const;

type CategoryId = keyof typeof CATEGORY_CONFIG;

interface CategoryBannerProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryBanner({ selectedCategory, onCategoryChange }: CategoryBannerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -CATEGORY_SCROLL_AMOUNT : CATEGORY_SCROLL_AMOUNT,
        behavior: 'smooth',
      });
    }
  };

  const categories = Object.entries(CATEGORY_CONFIG) as [CategoryId, typeof CATEGORY_CONFIG[CategoryId]][];

  return (
    <div className="relative group">
      {/* Scroll buttons */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-gray-900/90 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-gray-800 hover:scale-110 -translate-x-3 shadow-xl border border-gray-700/50"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-gray-900/90 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-gray-800 hover:scale-110 translate-x-3 shadow-xl border border-gray-700/50"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Category scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-2 px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map(([id, config]) => {
          const Icon = categoryIcons[id as CategoryIconType] || categoryIcons.other;
          const isSelected = selectedCategory === id || (id === 'all' && !selectedCategory);

          return (
            <button
              key={id}
              onClick={() => onCategoryChange(id === 'all' ? null : id)}
              className={`
                flex-shrink-0 relative overflow-hidden rounded-2xl
                transition-all duration-300 ease-out
                ${isSelected
                  ? 'scale-[1.02] shadow-2xl ring-2 ring-white/30'
                  : 'hover:scale-[1.02] hover:shadow-xl'
                }
              `}
              style={{ minWidth: CATEGORY_CARD_MIN_WIDTH }}
            >
              {/* Background gradient */}
              <div
                className={`
                  absolute inset-0 bg-gradient-to-br ${config.gradient}
                  ${isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}
                  transition-opacity duration-300
                `}
              />

              {/* Decorative pattern overlay */}
              <div
                className="absolute inset-0 opacity-60"
                style={{ background: config.bgPattern }}
              />

              {/* Glass overlay for unselected state */}
              {!isSelected && (
                <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]" />
              )}

              {/* Content */}
              <div className="relative z-10 px-5 py-4 flex flex-col items-start gap-1">
                <div className={`
                  p-2 rounded-xl mb-1
                  ${isSelected
                    ? 'bg-white/20 backdrop-blur-sm'
                    : 'bg-white/10'
                  }
                  transition-colors duration-300
                `}>
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-white/90'}`} />
                </div>
                <span className={`
                  font-semibold text-sm
                  ${isSelected ? 'text-white' : 'text-white/90'}
                `}>
                  {config.label}
                </span>
                <span className={`
                  text-xs
                  ${isSelected ? 'text-white/80' : 'text-white/60'}
                `}>
                  {config.subtitle}
                </span>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/50" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
