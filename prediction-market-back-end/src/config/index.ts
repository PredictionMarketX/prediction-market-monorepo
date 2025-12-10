import { env } from './env.js';

// Default chain ID format: {chain}-{network}
const DEFAULT_CHAIN_ID = `solana-${env.SOLANA_NETWORK}` as const;

// Valid categories for ai_markets table (matches database constraint)
const VALID_CATEGORIES = ['politics', 'product_launch', 'finance', 'sports', 'entertainment', 'technology', 'misc'] as const;

export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',

  solana: {
    rpcUrl: env.SOLANA_RPC_URL,
    network: env.SOLANA_NETWORK,
    programId: env.PROGRAM_ID,
    backendPrivateKey: env.BACKEND_PRIVATE_KEY,
  },

  x402: {
    paymentAddress: env.X402_PAYMENT_ADDRESS,
    facilitatorUrl: env.X402_FACILITATOR_URL,
  },

  cors: {
    origin: env.CORS_ORIGIN,
  },

  auth: {
    jwtSecret: env.INTERNAL_JWT_SECRET,
    adminAddresses: env.ADMIN_ADDRESSES?.split(',').map((a) => a.trim()).filter(Boolean) || [],
    superAdminAddresses: env.SUPER_ADMIN_ADDRESSES?.split(',').map((a) => a.trim()).filter(Boolean) || [],
  },

  defaults: {
    chainId: DEFAULT_CHAIN_ID,
    category: 'misc' as const,
    validCategories: VALID_CATEGORIES,
  },
} as const;

export { env };
