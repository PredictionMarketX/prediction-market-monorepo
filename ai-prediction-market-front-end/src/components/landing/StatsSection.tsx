'use client';

import { LANDING_CONFIG, UI_STYLES } from './constants';
import { featureIcons, type FeatureIconType } from '@/components/icons';
import { useEffect, useState, useRef } from 'react';

const useCountUp = (end: number, duration = 2000) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const stepTime = Math.abs(Math.floor(duration / end));
          const timer = setInterval(() => {
            start += 1;
            setCount(start);
            if (start === end) {
              clearInterval(timer);
            }
          }, stepTime);
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1,
      },
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [end, duration]);

  return { count, ref };
};

interface StatCardProps {
  id: string;
  value: string;
  label: string;
  iconType: FeatureIconType;
}

function StatCard({ value, label, iconType }: StatCardProps) {
  const Icon = featureIcons[iconType];
  const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
  const { count, ref } = useCountUp(numericValue);
  const hasSuffix = value.includes('+');
  const hasPercent = value.includes('%');

  return (
    <div
      ref={ref}
      className={`${UI_STYLES.card.base} ${UI_STYLES.card.padding.md} text-center transition-transform duration-300 hover:scale-105`}
    >
      <Icon className="w-10 h-10 text-purple-400 mx-auto mb-4" />
      <div className="text-4xl lg:text-5xl font-bold mb-2 text-white">
        {count}
        {hasSuffix ? '+' : ''}
        {hasPercent ? '%' : ''}
      </div>
      <div className="text-gray-400">{label}</div>
    </div>
  );
}

export function StatsSection() {
  return (
    <section className="py-16">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {LANDING_CONFIG.stats.map((stat) => (
          <StatCard
            key={stat.id}
            id={stat.id}
            value={stat.value}
            label={stat.label}
            iconType={stat.iconType}
          />
        ))}
      </div>
    </section>
  );
}
