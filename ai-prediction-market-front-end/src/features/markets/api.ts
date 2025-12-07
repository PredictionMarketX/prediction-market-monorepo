import { apiClient } from '@/lib/api/client';
import { getSolanaAdapter } from '@/lib/blockchain';
import type { Market, CreateMarketParams } from '@/types';

// Fetch markets from blockchain directly
export async function fetchMarkets(limit = 10, offset = 0): Promise<{
  markets: Market[];
  total: number;
}> {
  const adapter = getSolanaAdapter();

  const [markets, total] = await Promise.all([
    adapter.getMarkets(limit, offset),
    adapter.getMarketsCount(),
  ]);

  return { markets, total };
}

// Fetch single market
export async function fetchMarket(address: string): Promise<Market | null> {
  const adapter = getSolanaAdapter();
  return adapter.getMarket(address);
}

// Create market via backend (for x402 payment)
export async function createMarketViaBackend(
  params: CreateMarketParams & { creatorAddress?: string },
  paymentHeader?: string
) {
  const response = await apiClient.createMarket(
    {
      yesSymbol: params.yesSymbol,
      yesUri: params.yesUri,
      displayName: params.displayName,
      initialYesProb: params.initialYesProb,
      startSlot: params.startSlot,
      endingSlot: params.endingSlot,
      creatorAddress: params.creatorAddress,
    },
    paymentHeader
  );

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create market');
  }

  return response.data;
}

// Create market directly via wallet
export async function createMarketDirect(params: CreateMarketParams) {
  const adapter = getSolanaAdapter();
  const result = await adapter.createMarket(params);

  if (!result.success) {
    throw new Error(result.error || 'Failed to create market');
  }

  return result;
}
