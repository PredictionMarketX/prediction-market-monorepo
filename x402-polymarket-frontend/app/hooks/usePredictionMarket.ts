'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection, useWallet as useSolanaWalletAdapter } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { PredictionMarketClient } from '@/app/lib/solana/client';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { X402_CONFIG } from '@/app/configs/x402';
import { SOLANA_CONFIG } from '@/app/configs/solana';
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Create client instance (works without wallet for read-only operations)
  const client = useMemo(() => {
    // Always create client - wallet is optional for read-only operations
    return new PredictionMarketClient(connection, wallet.publicKey ? wallet : undefined);
  }, [connection, wallet]);

  /**
   * Fetch global config (read-only, works without wallet)
   */
  const fetchConfig = useCallback(async () => {
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
   * Fetch initial markets (read-only, works without wallet)
   */
  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);
      const result = await client.getAllMarkets(0, 10);
      setMarkets(result.markets);
      setHasMore(result.hasMore);
      setTotal(result.total);
      setCurrentOffset(10);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, [client]);

  /**
   * Load more markets (pagination)
   */
  const loadMoreMarkets = useCallback(async () => {
    if (!hasMore || loadingMore) return;

    try {
      setLoadingMore(true);
      const result = await client.getAllMarkets(currentOffset, 10);
      setMarkets(prev => [...prev, ...result.markets]);
      setHasMore(result.hasMore);
      setCurrentOffset(prev => prev + 10);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load more markets');
    } finally {
      setLoadingMore(false);
    }
  }, [client, currentOffset, hasMore, loadingMore]);

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
   * Create a new market using x402 payment flow
   */
  const createMarketWithX402 = useCallback(
    async (params: CreateMarketParams): Promise<TransactionResult & { marketAddress?: string }> => {
      setLoading(true);
      setError(null);

      try {
        if (!wallet.publicKey || !wallet.signTransaction) {
          throw new Error('Wallet not connected');
        }

        console.log('[x402] Step 1: Requesting payment quote for market creation...');

        // Step 1: Request payment quote (should return 402)
        const quoteResponse = await fetch('/api/create-market', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...params,
            creator: wallet.publicKey.toBase58(),
          }),
        });

        // If not 402, handle as normal response
        if (quoteResponse.status !== 402) {
          const result = await quoteResponse.json();
          setLoading(false);
          return result;
        }

        // Parse 402 payment quote
        const quote = await quoteResponse.json();
        console.log('[x402] Payment quote received:', quote.payment);

        const recipientTokenAccount = new PublicKey(quote.payment.tokenAccount);
        const usdcMint = new PublicKey(quote.payment.mint);
        const amount = quote.payment.amount;

        console.log('[x402] Step 2: Creating USDC payment transaction...');
        console.log('[x402]   Amount:', quote.payment.amountUSDC, 'USDC (market creation fee)');
        console.log('[x402]   Recipient:', quote.payment.tokenAccount);

        // Step 2: Get payer's USDC token account
        const payerTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          wallet.publicKey
        );

        console.log('[x402]   Payer token account:', payerTokenAccount.toBase58());

        // Check if payer has USDC account and balance
        try {
          const payerAccount = await getAccount(connection, payerTokenAccount);
          const balance = Number(payerAccount.amount) / 1e6; // USDC has 6 decimals

          console.log('[x402]   Payer USDC balance:', balance);

          if (Number(payerAccount.amount) < amount) {
            throw new Error(
              `Insufficient USDC balance. Have: ${balance} USDC, Need: ${quote.payment.amountUSDC} USDC`
            );
          }
        } catch (err: any) {
          if (err.name === 'TokenAccountNotFoundError' ||
              err.message?.includes('could not find') ||
              err.message?.includes('Invalid') ||
              err.message?.includes('account does not exist')) {
            throw new Error(
              `You don't have a USDC token account yet. To use x402 payment, you need USDC in your wallet first. ` +
              `Please get some devnet USDC from a faucet or use the regular "Wallet" payment method instead.`
            );
          }
          throw err;
        }

        // Step 3: Check if recipient token account exists
        console.log('[x402] Step 3: Checking recipient token account...');
        let recipientAccountExists = false;
        try {
          await getAccount(connection, recipientTokenAccount);
          recipientAccountExists = true;
          console.log('[x402]   ✓ Recipient token account exists');
        } catch {
          console.log('[x402]   ⚠ Recipient token account needs to be created');
        }

        // Step 4: Create payment transaction
        console.log('[x402] Step 4: Building payment transaction...');
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        const tx = new Transaction({
          feePayer: wallet.publicKey,
          blockhash,
          lastValidBlockHeight,
        });

        // Add create account instruction if needed
        if (!recipientAccountExists) {
          const recipientWallet = new PublicKey(X402_CONFIG.paymentAddress);

          const createAccountIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            recipientTokenAccount,
            recipientWallet,
            usdcMint
          );

          tx.add(createAccountIx);
          console.log('[x402]   + Added create token account instruction');
        }

        // Add USDC transfer instruction
        const transferIx = createTransferInstruction(
          payerTokenAccount,
          recipientTokenAccount,
          wallet.publicKey,
          amount
        );

        tx.add(transferIx);
        console.log('[x402]   + Added transfer instruction');

        // Step 5: Sign the transaction
        console.log('[x402] Step 5: Requesting user signature...');
        const signedTx = await wallet.signTransaction(tx);

        // Serialize the signed transaction
        const serializedTx = signedTx.serialize().toString('base64');
        console.log('[x402]   ✓ Transaction signed');

        // Step 6: Create x402 payment proof
        console.log('[x402] Step 6: Creating payment proof...');
        const paymentProof = {
          x402Version: 1,
          scheme: 'exact',
          network: quote.payment.cluster === 'devnet' ? 'solana-devnet' : 'solana-mainnet',
          payload: {
            serializedTransaction: serializedTx,
          },
        };

        // Base64 encode the payment proof
        const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');
        console.log('[x402]   ✓ Payment proof created');

        // Step 7: Retry request with X-Payment header
        console.log('[x402] Step 7: Sending payment proof to server...');
        const paidResponse = await fetch('/api/create-market', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment': xPaymentHeader,
          },
          body: JSON.stringify({
            ...params,
            creator: wallet.publicKey.toBase58(),
          }),
        });

        const result = await paidResponse.json();

        if (result.success) {
          console.log('[x402] ✅ Market created successfully!');
          console.log('[x402]   Transaction:', result.signature);
          console.log('[x402]   Market Address:', result.marketAddress);

          // Refresh markets list
          await fetchMarkets();
        } else {
          console.error('[x402] ❌ Market creation failed:', result.error);
        }

        setLoading(false);
        return result;

      } catch (err: any) {
        console.error('[x402] Error:', err);
        const errorMessage = err.message || 'An unexpected error occurred';
        setError(errorMessage);
        setLoading(false);

        return {
          success: false,
          signature: '',
          error: errorMessage,
        };
      }
    },
    [connection, wallet, fetchMarkets]
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

  // Auto-fetch on mount (works without wallet for read-only operations)
  useEffect(() => {
    fetchConfig();
    fetchMarkets();
  }, [fetchConfig, fetchMarkets]);

  return {
    // State
    markets,
    config,
    loading,
    loadingMore,
    error,
    hasMore,
    total,
    isConnected: !!wallet.publicKey,

    // Read functions
    fetchConfig,
    fetchMarkets,
    fetchMarket,
    fetchUserInfo,
    calculatePrice,
    loadMoreMarkets,

    // Write functions
    createMarket,
    createMarketWithX402,
    swap,
    addLiquidity,
    withdrawLiquidity,
    mintCompleteSet,
    redeemCompleteSet,
  };
}
