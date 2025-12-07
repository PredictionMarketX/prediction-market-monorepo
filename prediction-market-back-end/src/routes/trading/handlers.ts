import { FastifyRequest, FastifyReply } from 'fastify';
import { TradingService } from '../../services/trading.service.js';

const tradingService = new TradingService();

interface SwapBody {
  marketAddress: string;
  direction: 'buy' | 'sell';
  tokenType: 'yes' | 'no';
  amount: number;
  slippage?: number;
  userAddress: string;
}

interface MintRedeemBody {
  marketAddress: string;
  amount: number;
  userAddress: string;
}

export async function swapHandler(
  request: FastifyRequest<{ Body: SwapBody }>,
  reply: FastifyReply
) {
  const { marketAddress, direction, tokenType, amount, slippage = 5, userAddress } = request.body;

  const result = await tradingService.swap({
    marketAddress,
    direction,
    tokenType,
    amount,
    slippage,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function mintHandler(
  request: FastifyRequest<{ Body: MintRedeemBody }>,
  reply: FastifyReply
) {
  const { marketAddress, amount, userAddress } = request.body;

  const result = await tradingService.mintCompleteSet({
    marketAddress,
    amount,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

export async function redeemHandler(
  request: FastifyRequest<{ Body: MintRedeemBody }>,
  reply: FastifyReply
) {
  const { marketAddress, amount, userAddress } = request.body;

  const result = await tradingService.redeemCompleteSet({
    marketAddress,
    amount,
    userAddress,
  });

  return reply.send({
    success: true,
    data: result,
  });
}
