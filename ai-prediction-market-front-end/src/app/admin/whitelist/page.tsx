'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { toast } from 'react-toastify';
import { useBlockchain } from '@/lib/blockchain/provider';
import { PublicKey } from '@solana/web3.js';

export default function WhitelistPage() {
  const { connected, publicKey } = useWallet();
  const { adapter } = useBlockchain();
  const [addressToAdd, setAddressToAdd] = useState('');
  const [addressToRemove, setAddressToRemove] = useState('');
  const [addressToCheck, setAddressToCheck] = useState('');
  const [isAddLoading, setIsAddLoading] = useState(false);
  const [isRemoveLoading, setIsRemoveLoading] = useState(false);
  const [isCheckLoading, setIsCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<boolean | null>(null);

  const isValidAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddToWhitelist = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!addressToAdd || !isValidAddress(addressToAdd)) {
      toast.error('Please enter a valid Solana address');
      return;
    }

    setIsAddLoading(true);

    try {
      const solanaAdapter = adapter as any;
      if (!solanaAdapter.addToWhitelist) {
        toast.error('Whitelist function not available');
        return;
      }

      const result = await solanaAdapter.addToWhitelist(addressToAdd);

      if (result.success) {
        toast.success(`Address added to whitelist! TX: ${result.signature.slice(0, 8)}...`);
        setAddressToAdd('');
      } else {
        toast.error(result.error || 'Failed to add to whitelist');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add to whitelist'
      );
    } finally {
      setIsAddLoading(false);
    }
  };

  const handleRemoveFromWhitelist = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!addressToRemove || !isValidAddress(addressToRemove)) {
      toast.error('Please enter a valid Solana address');
      return;
    }

    setIsRemoveLoading(true);

    try {
      const solanaAdapter = adapter as any;
      if (!solanaAdapter.removeFromWhitelist) {
        toast.error('Whitelist function not available');
        return;
      }

      const result = await solanaAdapter.removeFromWhitelist(addressToRemove);

      if (result.success) {
        toast.success(`Address removed from whitelist! TX: ${result.signature.slice(0, 8)}...`);
        setAddressToRemove('');
      } else {
        toast.error(result.error || 'Failed to remove from whitelist');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove from whitelist'
      );
    } finally {
      setIsRemoveLoading(false);
    }
  };

  const handleCheckWhitelist = async () => {
    if (!addressToCheck || !isValidAddress(addressToCheck)) {
      toast.error('Please enter a valid Solana address');
      return;
    }

    setIsCheckLoading(true);
    setCheckResult(null);

    try {
      const isWhitelisted = await adapter.isWhitelisted?.(addressToCheck);
      setCheckResult(isWhitelisted ?? false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to check whitelist status'
      );
    } finally {
      setIsCheckLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Manage Whitelist
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Add or remove addresses from the market creator whitelist
        </p>
      </div>

      {/* Check Whitelist Status */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Check Whitelist Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address to Check
              </label>
              <Input
                type="text"
                placeholder="Enter Solana address..."
                value={addressToCheck}
                onChange={(e) => {
                  setAddressToCheck(e.target.value);
                  setCheckResult(null);
                }}
                className="w-full font-mono text-sm"
              />
            </div>

            {checkResult !== null && (
              <div className={`p-3 rounded-lg ${
                checkResult
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <p className={`text-sm ${checkResult ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {checkResult ? 'Address is whitelisted' : 'Address is NOT whitelisted'}
                </p>
              </div>
            )}

            <Button
              onClick={handleCheckWhitelist}
              isLoading={isCheckLoading}
              variant="outline"
              disabled={!addressToCheck}
            >
              Check Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add to Whitelist */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Add to Whitelist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Adding an address to the whitelist allows it to create prediction markets.
                Only the protocol admin can perform this action.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Creator Address
              </label>
              <Input
                type="text"
                placeholder="Enter Solana address to whitelist..."
                value={addressToAdd}
                onChange={(e) => setAddressToAdd(e.target.value)}
                className="w-full font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleAddToWhitelist}
              isLoading={isAddLoading}
              disabled={!connected || !addressToAdd}
            >
              {connected ? 'Add to Whitelist' : 'Connect Wallet First'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Remove from Whitelist */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Remove from Whitelist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Warning:</strong> Removing an address from the whitelist will prevent it from creating new markets.
                Existing markets created by this address will not be affected.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Creator Address
              </label>
              <Input
                type="text"
                placeholder="Enter Solana address to remove..."
                value={addressToRemove}
                onChange={(e) => setAddressToRemove(e.target.value)}
                className="w-full font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleRemoveFromWhitelist}
              isLoading={isRemoveLoading}
              disabled={!connected || !addressToRemove}
              variant="outline"
            >
              {connected ? 'Remove from Whitelist' : 'Connect Wallet First'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Connection Info */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Connection Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              <strong>Status:</strong>{' '}
              <span className={connected ? 'text-green-600' : 'text-red-600'}>
                {connected ? 'Connected' : 'Not Connected'}
              </span>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              <strong>Your Address:</strong>{' '}
              <span className="font-mono">{publicKey?.toBase58() || 'N/A'}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
