'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection, useWallet as useSolanaWalletAdapter } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { PredictionMarketClient } from '@/app/lib/solana/client';
import type {
  Market,
  Config,
  UserInfo,
  CreateMarketParams,
  SwapParams,
  AddLiquidityParams,
  WithdrawLiquidityParams,
  MintCompleteSetParams,
  RedeemCompleteSetParams,
  TransactionResult,
  MarketListItem,
} from '@/app/lib/solana/types';

/**
 * Hook for interacting with the Prediction Market program
 */
export function usePredictionMarket() {
  const { connection } = useConnection();
  const wallet = useSolanaWalletAdapter();

  const [markets, setMarkets] = useState<{ address: PublicKey; data: Market }[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create client instance
  const client = useMemo(() => {
    if (!wallet || !wallet.publicKey) return null;
    return new PredictionMarketClient(connection, wallet);
  }, [connection, wallet]);

  /**
   * Fetch global config
   */
  const fetchConfig = useCallback(async () => {
    if (!client) return;

    try {
      setLoading(true);
      const configData = await client.getConfig();
      setConfig(configData);
      setError(null);
    } catch (err: any) {
      // Config might not be initialized yet - this is not an error
      console.warn('Config not found - program may not be initialized yet');
      setConfig(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  /**
   * Fetch all markets
   */
  const fetchMarkets = useCallback(async () => {
    if (!client) return;

    try {
      setLoading(true);
      const marketsData = await client.getAllMarkets();
      setMarkets(marketsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, [client]);

  /**
   * Fetch a specific market
   */
  const fetchMarket = useCallback(
    async (marketAddress: PublicKey): Promise<Market | null> => {
      if (!client) return null;

      try {
        setLoading(true);
        const market = await client.getMarket(marketAddress);
        setError(null);
        return market;
      } catch (err: any) {
        setError(err.message || 'Failed to fetch market');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /**
   * Fetch user info for a market
   */
  const fetchUserInfo = useCallback(
    async (marketAddress: PublicKey): Promise<UserInfo | null> => {
      if (!client || !wallet.publicKey) return null;

      try {
        setLoading(true);
        const userInfo = await client.getUserInfo(wallet.publicKey, marketAddress);
        setError(null);
        return userInfo;
      } catch (err: any) {
        setError(err.message || 'Failed to fetch user info');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey]
  );

  /**
   * Create a new market
   */
  const createMarket = useCallback(
    async (params: CreateMarketParams): Promise<TransactionResult> => {
      if (!client) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      try {
        setLoading(true);
        const result = await client.createMarket(params);
        if (result.success) {
          // Refresh markets list
          await fetchMarkets();
        }
        setError(null);
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to create market';
        setError(errorMsg);
        return { signature: '', success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [client, fetchMarkets]
  );

  /**
   * Swap tokens
   */
  const swap = useCallback(
    async (params: SwapParams): Promise<TransactionResult> => {
      if (!client) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      try {
        setLoading(true);
        const result = await client.swap(params);
        setError(null);
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to swap';
        setError(errorMsg);
        return { signature: '', success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /**
   * Add liquidity
   */
  const addLiquidity = useCallback(
    async (params: AddLiquidityParams): Promise<TransactionResult> => {
      if (!client) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      try {
        setLoading(true);
        const result = await client.addLiquidity(params);
        setError(null);
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to add liquidity';
        setError(errorMsg);
        return { signature: '', success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /**
   * Withdraw liquidity
   */
  const withdrawLiquidity = useCallback(
    async (params: WithdrawLiquidityParams): Promise<TransactionResult> => {
      if (!client) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      try {
        setLoading(true);
        const result = await client.withdrawLiquidity(params);
        setError(null);
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to withdraw liquidity';
        setError(errorMsg);
        return { signature: '', success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /**
   * Mint complete set
   */
  const mintCompleteSet = useCallback(
    async (params: MintCompleteSetParams): Promise<TransactionResult> => {
      if (!client) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      try {
        setLoading(true);
        const result = await client.mintCompleteSet(params);
        setError(null);
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to mint complete set';
        setError(errorMsg);
        return { signature: '', success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /**
   * Redeem complete set
   */
  const redeemCompleteSet = useCallback(
    async (params: RedeemCompleteSetParams): Promise<TransactionResult> => {
      if (!client) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      try {
        setLoading(true);
        const result = await client.redeemCompleteSet(params);
        setError(null);
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to redeem complete set';
        setError(errorMsg);
        return { signature: '', success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /**
   * Calculate token price
   */
  const calculatePrice = useCallback(
    (market: Market, tokenType: 0 | 1): number => {
      if (!client) return 0;
      return client.calculatePrice(market, tokenType);
    },
    [client]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (client) {
      fetchConfig();
      fetchMarkets();
    }
  }, [client, fetchConfig, fetchMarkets]);

  return {
    // State
    markets,
    config,
    loading,
    error,
    isConnected: !!wallet.publicKey,

    // Read functions
    fetchConfig,
    fetchMarkets,
    fetchMarket,
    fetchUserInfo,
    calculatePrice,

    // Write functions
    createMarket,
    swap,
    addLiquidity,
    withdrawLiquidity,
    mintCompleteSet,
    redeemCompleteSet,
  };
}
