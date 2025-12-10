'use client';

import { featureIcons, type FeatureIconType } from '@/components/icons';
import { LANDING_CONFIG } from './constants';
import { SectionHeader } from './SectionHeader';

interface FeatureCardProps {
  iconType: FeatureIconType;
  title: string;
  description: string;
}

function FeatureCard({ iconType, title, description }: FeatureCardProps) {
  const Icon = featureIcons[iconType];

  return (
    <div className="relative bg-gray-900/50 rounded-2xl p-6 border border-purple-900/30 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="w-14 h-14 bg-gray-800/50 rounded-xl flex items-center justify-center mb-4 border border-purple-900/50">
          <Icon className="w-8 h-8 text-purple-400" />
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section className="py-16">
      <SectionHeader
        title="Why Ploy Market?"
        description="A next-generation platform for decentralized prediction markets, powered by AI."
      />

      <div className="grid md:grid-cols-3 gap-8">
        {LANDING_CONFIG.features.map((feature, i) => (
          <div
            key={feature.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <FeatureCard
              iconType={feature.iconType}
              title={feature.title}
              description={feature.description}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
