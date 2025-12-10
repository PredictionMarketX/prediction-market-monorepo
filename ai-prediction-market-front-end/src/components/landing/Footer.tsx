'use client';

import Link from 'next/link';
import { Twitter, Disc, Github } from 'lucide-react';
import { LANDING_CONFIG } from './constants';

function Logo() {
  return (
    <Link href="/" className="flex items-center space-x-2">
      <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center rotate-45">
        <div className="w-4 h-4 bg-white rounded-sm" />
      </div>
      <span className="text-xl font-bold text-white">PloyMarket</span>
    </Link>
  );
}

export function Footer() {
  const { footer } = LANDING_CONFIG;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-purple-900/30 pt-12 pb-8 mt-16">
      <div className="container mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="text-gray-400 text-sm mt-4">
              Decentralized prediction markets powered by Solana and AI.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Platform</h4>
            <ul className="space-y-2">
              {footer.sections.platform.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              {footer.sections.support.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Community</h4>
            <div className="flex gap-4">
              <a
                href={footer.social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href={footer.social.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Discord"
              >
                <Disc size={20} />
              </a>
              <a
                href={footer.social.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <Github size={20} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-purple-900/30 pt-8 text-center text-gray-500 text-sm">
          &copy; {currentYear} PloyMarket. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
