'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { formatCurrency, formatAddress } from '@/lib/utils';

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Portfolio
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Connect your wallet to view your positions and trading history
        </p>
        <Button onClick={() => setVisible(true)} size="lg">
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Portfolio
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {formatAddress(publicKey?.toBase58() || '', 8)}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Total Value
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(0)}
            </p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Active Positions
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Total P&L
            </p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Positions */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Your Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No positions yet.</p>
            <p className="text-sm mt-2">Start trading to see your positions here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
