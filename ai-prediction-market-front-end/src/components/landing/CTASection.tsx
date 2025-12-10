'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { LANDING_CONFIG } from './constants';

export function CTASection() {
  const { cta } = LANDING_CONFIG;

  return (
    <section className="py-16">
      <div className="relative bg-gray-900/50 rounded-3xl p-12 text-center overflow-hidden border border-purple-900/30">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-transparent" />
        <div className="relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">{cta.title}</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">{cta.description}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/markets">
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 transition-transform duration-300 hover:scale-105"
              >
                {cta.primaryButton}
              </Button>
            </Link>
            <Link href="/propose">
              <Button
                variant="outline"
                size="lg"
                className="border-gray-600 text-white hover:bg-gray-800 transition-transform duration-300 hover:scale-105"
              >
                {cta.secondaryButton}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
