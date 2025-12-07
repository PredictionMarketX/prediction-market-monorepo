import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { marketKeys, CreateMarketFormValues } from '../types';
import { createMarketDirect, createMarketViaBackend } from '../api';
import { useBlockchain } from '@/lib/blockchain';
import { apiClient } from '@/lib/api/client';
import { solanaConfig } from '@/lib/blockchain/solana/config';
import type { CreateMarketParams } from '@/types';

// Get current chain ID based on blockchain config
function getCurrentChainId(): string {
  // For now, we're using Solana - format: solana-{network}
  return `solana-${solanaConfig.network}`;
}

interface CreateMarketOptions {
  useX402?: boolean;
  paymentHeader?: string;
}

// Solana slot duration in milliseconds (approximately 400ms)
const SLOT_DURATION_MS = 400;

// Convert a date to approximate Solana slot number
// This is a rough estimate - actual slot calculation depends on current slot
function dateToSlot(date: Date, currentSlot: number, currentTime: Date): number {
  const timeDiffMs = date.getTime() - currentTime.getTime();
  const slotDiff = Math.floor(timeDiffMs / SLOT_DURATION_MS);
  return Math.max(currentSlot + slotDiff, currentSlot);
}

export function useCreateMarket() {
  const queryClient = useQueryClient();
  const { address } = useBlockchain();

  return useMutation({
    mutationFn: async ({
      params,
      options = {},
    }: {
      params: CreateMarketParams;
      options?: CreateMarketOptions;
    }) => {
      if (options.useX402) {
        return createMarketViaBackend(
          {
            ...params,
            creatorAddress: address || undefined,
          },
          options.paymentHeader
        );
      } else {
        return createMarketDirect(params);
      }
    },
    onSuccess: () => {
      // Invalidate markets list to refetch
      queryClient.invalidateQueries({ queryKey: marketKeys.lists() });
      toast.success('Market created successfully!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create market');
    },
  });
}

// Generate metadata URI - tries backend first, falls back to data URI
async function generateMetadataUri(values: CreateMarketFormValues): Promise<string> {
  const chainId = getCurrentChainId();

  try {
    // Try to store metadata in backend database
    const response = await apiClient.createMetadata({
      chainId,
      name: values.question,
      symbol: values.yesSymbol,
      description: values.description,
      category: values.category,
      resolutionSource: values.resolutionSource,
    });

    if (response.success && response.data?.url) {
      return response.data.url;
    }
  } catch (error) {
    console.warn('Failed to store metadata in backend, using data URI fallback:', error);
  }

  // Fallback: use data URI (no external storage needed)
  const metadata = {
    chainId,
    name: values.question,
    symbol: values.yesSymbol,
    description: values.description || '',
    category: values.category || '',
    resolutionSource: values.resolutionSource || '',
    createdAt: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(metadata);
  return `data:application/json;base64,${btoa(jsonString)}`;
}

// Helper to convert form values to params
export async function formValuesToParams(
  values: CreateMarketFormValues,
  currentSlot?: number
): Promise<CreateMarketParams> {
  const now = new Date();
  const slot = currentSlot || 0;

  // Convert probability percentage (20-80) to basis points (2000-8000)
  const initialYesProb = Math.min(8000, Math.max(2000, values.initialYesProb * 100));

  // Convert dates to slots if provided
  let startSlot: number | undefined;
  let endingSlot: number | undefined;

  if (values.startDate) {
    const startDate = new Date(values.startDate);
    startSlot = dateToSlot(startDate, slot, now);
  }

  if (values.endDate) {
    const endDate = new Date(values.endDate);
    endingSlot = dateToSlot(endDate, slot, now);
  }

  // Get metadata URI (from backend or fallback to data URI)
  const yesUri = await generateMetadataUri(values);

  return {
    yesSymbol: values.yesSymbol,
    yesUri,
    displayName: values.question.slice(0, 64), // Max 64 chars
    initialYesProb,
    startSlot,
    endingSlot,
  };
}
