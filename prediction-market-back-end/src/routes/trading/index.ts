import { FastifyInstance } from 'fastify';
import { swapHandler, mintHandler, redeemHandler } from './handlers.js';

export async function tradingRoutes(app: FastifyInstance) {
  // POST /api/trading/swap - Execute swap (with x402 payment)
  app.post('/swap', {
    schema: {
      description: 'Swap tokens in a prediction market (requires x402 payment)',
      body: {
        type: 'object',
        required: ['marketAddress', 'direction', 'amount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          direction: { type: 'string', enum: ['buy', 'sell'] },
          tokenType: { type: 'string', enum: ['yes', 'no'] },
          amount: { type: 'number', minimum: 0 },
          slippage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, swapHandler);

  // POST /api/trading/mint - Mint complete set
  app.post('/mint', {
    schema: {
      description: 'Mint a complete set of YES and NO tokens',
      body: {
        type: 'object',
        required: ['marketAddress', 'amount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, mintHandler);

  // POST /api/trading/redeem - Redeem complete set
  app.post('/redeem', {
    schema: {
      description: 'Redeem a complete set of YES and NO tokens for USDC',
      body: {
        type: 'object',
        required: ['marketAddress', 'amount', 'userAddress'],
        properties: {
          marketAddress: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          userAddress: { type: 'string' },
        },
      },
    },
  }, redeemHandler);
}
