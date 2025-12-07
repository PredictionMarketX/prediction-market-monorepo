import { config } from '@/config';
import type {
  ApiResponse,
  ListMarketsResponse,
  CreateMarketRequest,
  CreateMarketResponse,
  SwapRequest,
  SwapResponse,
  MintRedeemRequest,
  MintRedeemResponse,
  AddLiquidityRequest,
  WithdrawLiquidityRequest,
  LiquidityResponse,
} from '@/types';
import type { Market } from '@/types';

// Metadata types
export interface CreateMetadataRequest {
  chainId?: string; // e.g., 'solana-devnet', 'ethereum-mainnet'
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
}

export interface CreateMetadataResponse {
  id: string;
  url: string;
}

// Config types
export interface Category {
  id: string;
  label: string;
}

export interface ChainContract {
  chainId: string;
  chainName: string;
  network: string;
  programId: string;
  rpcUrl: string;
  explorerUrl: string;
  usdcMint?: string;
  enabled: boolean;
}

export interface AppConfigResponse {
  categories: Category[];
}

export interface ContractsResponse {
  contracts: ChainContract[];
}

class APIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.error?.code || 'UNKNOWN_ERROR',
            message: data.error?.message || 'An error occurred',
          },
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  // Markets
  async listMarkets(limit = 10, offset = 0): Promise<ApiResponse<ListMarketsResponse>> {
    return this.request<ListMarketsResponse>(
      `/api/markets?limit=${limit}&offset=${offset}`
    );
  }

  async getMarket(address: string): Promise<ApiResponse<Market>> {
    return this.request<Market>(`/api/markets/${address}`);
  }

  async createMarket(
    params: CreateMarketRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<CreateMarketResponse>> {
    return this.request<CreateMarketResponse>('/api/markets/create', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  // Trading
  async swap(
    params: SwapRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<SwapResponse>> {
    return this.request<SwapResponse>('/api/trading/swap', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  async mintCompleteSet(
    params: MintRedeemRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<MintRedeemResponse>> {
    return this.request<MintRedeemResponse>('/api/trading/mint', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  async redeemCompleteSet(
    params: MintRedeemRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<MintRedeemResponse>> {
    return this.request<MintRedeemResponse>('/api/trading/redeem', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  // Liquidity
  async addLiquidity(
    params: AddLiquidityRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<LiquidityResponse>> {
    return this.request<LiquidityResponse>('/api/liquidity/add', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  async withdrawLiquidity(
    params: WithdrawLiquidityRequest,
    paymentHeader?: string
  ): Promise<ApiResponse<LiquidityResponse>> {
    return this.request<LiquidityResponse>('/api/liquidity/withdraw', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: paymentHeader ? { 'X-Payment': paymentHeader } : undefined,
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Metadata
  async createMetadata(
    params: CreateMetadataRequest
  ): Promise<ApiResponse<CreateMetadataResponse>> {
    return this.request<CreateMetadataResponse>('/api/metadata', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Config
  async getConfig(): Promise<ApiResponse<AppConfigResponse>> {
    return this.request<AppConfigResponse>('/api/config');
  }

  // Contracts
  async getContracts(): Promise<ApiResponse<ContractsResponse>> {
    return this.request<ContractsResponse>('/api/config/contracts');
  }

  async getContractByChainId(chainId: string): Promise<ApiResponse<ChainContract>> {
    return this.request<ChainContract>(`/api/config/contracts/${chainId}`);
  }
}

// Singleton instance
export const apiClient = new APIClient();
