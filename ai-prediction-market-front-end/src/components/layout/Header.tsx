"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectButton } from "@/components/wallet";
import { useIsAdmin } from "@/features/admin/hooks/useIsAdmin";
import { Shield, Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/components/landing/constants";
import { cn } from "@/lib/utils";

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center space-x-2"
    >
      <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center rotate-45">
        <div className="w-4 h-4 bg-white rounded-sm" />
      </div>
      <span className="text-xl font-bold text-white">PredictX</span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { connected } = useWallet();
  const { isAdmin, isWhitelisted } = useIsAdmin();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showAdminButton = connected && (isAdmin || isWhitelisted);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-purple-900/30 bg-gray-950/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-gray-900/50 border border-purple-900/30 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Logo />

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center space-x-2 bg-gray-900/50 border border-purple-900/30 rounded-full px-4 py-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                    pathname === link.href
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border border-purple-900/30 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-gray-300">Solana</span>
            </div>

            {showAdminButton && (
              <Link href="/admin">
                <div className="p-2 rounded-full bg-gray-900/50 border border-purple-900/30 text-purple-400 hover:text-white hover:bg-purple-600 transition-colors">
                  <Shield size={20} />
                </div>
              </Link>
            )}

            <ConnectButton />
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 border-t border-purple-900/30 mt-2 pt-4">
            <div className="flex flex-col space-y-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                    pathname === link.href
                      ? "bg-purple-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-gray-800/50"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {showAdminButton && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                    pathname === "/admin"
                      ? "bg-purple-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-gray-800/50"
                  )}
                >
                  <Shield size={16} />
                  Admin
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
