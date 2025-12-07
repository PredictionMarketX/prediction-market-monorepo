export type MarketStatus = 'active' | 'paused' | 'resolved';

export interface Market {
  address: string;
  name: string;
  metadataUri: string;
  creator: string;
  yesMint: string;
  noMint: string;
  collateralVault: string;
  status: MarketStatus;
  bParameter: number;
  totalLiquidity: number;
  yesPrice: number;
  noPrice: number;
  createdAt: number;
}

export interface MarketMetadata {
  question: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
  resolutionDate?: string;
  imageUrl?: string;
}

export interface UserPosition {
  marketAddress: string;
  yesBalance: number;
  noBalance: number;
  lpBalance: number;
  realizedPnl: number;
}

export interface CreateMarketParams {
  name: string;
  metadataUri: string;
  bParameter: number;
}

export interface SwapParams {
  marketAddress: string;
  direction: 'buy' | 'sell';
  tokenType: 'yes' | 'no';
  amount: number;
  slippage?: number;
}

export interface MintRedeemParams {
  marketAddress: string;
  amount: number;
}

export interface AddLiquidityParams {
  marketAddress: string;
  amount: number;
}

export interface WithdrawLiquidityParams {
  marketAddress: string;
  lpAmount: number;
}
