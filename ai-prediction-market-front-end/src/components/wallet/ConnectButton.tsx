'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui';
import { formatAddress } from '@/lib/utils';
import { LogOut, Wallet } from 'lucide-react';
import { useState } from 'react';

export function ConnectButton() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [showDisconnect, setShowDisconnect] = useState(false);

  if (connected && publicKey) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setShowDisconnect(true)}
        onMouseLeave={() => setShowDisconnect(false)}
      >
        <Button variant="outline" className="border-purple-600 bg-purple-900/30 text-white hover:bg-purple-900/50">
          <Wallet className="mr-2 h-4 w-4" />
          {formatAddress(publicKey.toBase58(), 4)}
        </Button>
        {showDisconnect && (
          <Button
            variant="danger"
            size="sm"
            onClick={disconnect}
            className="absolute top-full mt-2 right-0 w-full animate-fade-in-up"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button onClick={() => setVisible(true)} className="bg-purple-600 hover:bg-purple-700">
      <Wallet className="mr-2 h-4 w-4" />
      Connect Wallet
    </Button>
  );
}
