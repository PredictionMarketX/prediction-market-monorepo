import { getSolanaClient } from '../blockchain/solana/client.js';
import type { SwapParams, MintRedeemParams } from '../blockchain/types.js';
import { logger } from '../utils/logger.js';

export class TradingService {
  private get solanaClient() {
    return getSolanaClient();
  }

  async swap(params: SwapParams) {
    logger.info({ params }, 'Executing swap');

    const result = await this.solanaClient.swap({
      marketAddress: params.marketAddress,
      direction: params.direction,
      tokenType: params.tokenType,
      amount: params.amount,
      slippage: params.slippage,
      userAddress: params.userAddress,
    });

    return result;
  }

  async mintCompleteSet(params: MintRedeemParams) {
    logger.info({ params }, 'Minting complete set');

    const result = await this.solanaClient.mintCompleteSet({
      marketAddress: params.marketAddress,
      amount: params.amount,
      userAddress: params.userAddress,
    });

    return result;
  }

  async redeemCompleteSet(params: MintRedeemParams) {
    logger.info({ params }, 'Redeeming complete set');

    const result = await this.solanaClient.redeemCompleteSet({
      marketAddress: params.marketAddress,
      amount: params.amount,
      userAddress: params.userAddress,
    });

    return result;
  }
}
