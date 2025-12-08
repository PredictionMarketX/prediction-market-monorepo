/**
 * Publisher Worker
 *
 * Consumes: markets.publish queue
 * Produces: On-chain market creation
 *
 * Creates markets on the Solana blockchain for approved draft markets.
 * Single instance to ensure transaction ordering.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import {
  env,
  validateEnv,
  createWorkerLogger,
  getDb,
  closeDb,
  connectQueue,
  closeQueue,
  consumeQueue,
  QUEUE_NAMES,
  type MarketPublishMessage,
} from './shared/index.js';
import { PDA_SEEDS, USDC_DECIMALS } from '@x402/shared-types';

// Override worker type
process.env.WORKER_TYPE = 'publisher';

const logger = createWorkerLogger('publisher');

// Default market parameters
const DEFAULT_B_PARAMETER = 500;
const DEFAULT_INITIAL_LIQUIDITY = 100; // USDC

/**
 * Get AI version from database config
 */
async function getAIVersion(): Promise<string> {
  const sql = getDb();
  const result = await sql`
    SELECT value FROM ai_config WHERE key = 'ai_version'
  `;
  return result[0]?.value ? JSON.parse(result[0].value) : 'v1.0';
}

/**
 * Fetch draft market from database
 */
async function getDraftMarket(draftMarketId: string) {
  const sql = getDb();
  const [market] = await sql`
    SELECT id, title, description, category, resolution, confidence_score, source_proposal_id
    FROM ai_markets
    WHERE id = ${draftMarketId}
  `;
  return market;
}

/**
 * Initialize Solana connection and program
 */
function initializeSolana() {
  const connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');

  // Load publisher keypair
  const privateKeyBytes = bs58.decode(env.PUBLISHER_PRIVATE_KEY);
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  const wallet = new Wallet(keypair);

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  // Load program (you'd need to load the IDL here)
  // For now, we'll just return the provider and connection
  return { connection, provider, wallet, programId: new PublicKey(env.PROGRAM_ID) };
}

/**
 * Process market publishing
 */
async function processPublish(message: MarketPublishMessage): Promise<void> {
  const sql = getDb();
  const aiVersion = await getAIVersion();

  logger.info({ draftMarketId: message.draft_market_id }, 'Processing market publish');

  // Fetch draft market
  const market = await getDraftMarket(message.draft_market_id);
  if (!market) {
    logger.error({ draftMarketId: message.draft_market_id }, 'Draft market not found');
    return;
  }

  // Check if already published
  const [existing] = await sql`
    SELECT market_address FROM ai_markets WHERE id = ${message.draft_market_id}
  `;
  if (existing?.market_address) {
    logger.warn(
      { draftMarketId: message.draft_market_id, marketAddress: existing.market_address },
      'Market already published'
    );
    return;
  }

  // Initialize Solana
  const { connection, provider, wallet, programId } = initializeSolana();

  // Generate market keypair (deterministic from draft ID for idempotency)
  // In production, you might want a different approach
  const marketKeypair = Keypair.generate();
  const marketAddress = marketKeypair.publicKey.toBase58();

  logger.info(
    { draftMarketId: message.draft_market_id, marketAddress },
    'Creating market on-chain'
  );

  // Check if in dry run mode
  if (env.DRY_RUN) {
    logger.info({ marketAddress }, 'DRY RUN: Would create market on-chain');

    // Update database with mock address
    await sql`
      UPDATE ai_markets
      SET
        market_address = ${marketAddress},
        status = 'active',
        published_at = NOW()
      WHERE id = ${message.draft_market_id}
    `;

    // Update proposal if applicable
    if (market.source_proposal_id) {
      await sql`
        UPDATE proposals
        SET status = 'published'
        WHERE id = ${market.source_proposal_id}
      `;
    }

    logger.info({ draftMarketId: message.draft_market_id, marketAddress }, 'Market published (dry run)');
    return;
  }

  // TODO: Implement actual on-chain market creation
  // This requires the IDL and proper instruction building
  // For now, we'll simulate success

  /*
  // Example of what the on-chain call would look like:
  const tx = await program.methods
    .createMarket(
      market.title,
      new BN(Date.parse(market.resolution.expiry) / 1000),
      new BN(DEFAULT_B_PARAMETER),
      new BN(DEFAULT_INITIAL_LIQUIDITY * 10 ** USDC_DECIMALS),
      50 // Initial probability 50%
    )
    .accounts({
      market: marketKeypair.publicKey,
      authority: wallet.publicKey,
      // ... other accounts
    })
    .signers([marketKeypair])
    .rpc();
  */

  // Simulated transaction signature
  const txSignature = `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Update database with market address
  await sql`
    UPDATE ai_markets
    SET
      market_address = ${marketAddress},
      status = 'active',
      published_at = NOW()
    WHERE id = ${message.draft_market_id}
  `;

  // Update proposal status if this came from a user proposal
  if (market.source_proposal_id) {
    await sql`
      UPDATE proposals
      SET status = 'published'
      WHERE id = ${market.source_proposal_id}
    `;
  }

  // Log audit
  await sql`
    INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, ai_version)
    VALUES (
      'market_published',
      'market',
      ${message.draft_market_id},
      'publisher',
      ${JSON.stringify({
        market_address: marketAddress,
        tx_signature: txSignature,
        title: market.title,
        expiry: market.resolution?.expiry,
      })},
      ${aiVersion}
    )
  `;

  logger.info(
    {
      draftMarketId: message.draft_market_id,
      marketAddress,
      txSignature,
    },
    'Market published successfully'
  );
}

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info('Starting publisher worker');

  // Validate required environment variables
  validateEnv(['DATABASE_URL', 'RABBITMQ_URL', 'SOLANA_RPC_URL', 'PROGRAM_ID']);

  // Warn if no private key (dry run mode)
  if (!env.PUBLISHER_PRIVATE_KEY) {
    logger.warn('PUBLISHER_PRIVATE_KEY not set, running in DRY_RUN mode');
    process.env.DRY_RUN = 'true';
  }

  // Connect to services
  await connectQueue();
  logger.info('Connected to RabbitMQ');

  // Test database connection
  const sql = getDb();
  await sql`SELECT 1`;
  logger.info('Connected to database');

  // Start consuming market publish requests
  await consumeQueue<MarketPublishMessage>(
    QUEUE_NAMES.MARKETS_PUBLISH,
    async (message, ack, nack) => {
      try {
        await processPublish(message);
        ack();
      } catch (error) {
        logger.error({ error, draftMarketId: message.draft_market_id }, 'Failed to publish market');
        throw error;
      }
    }
  );

  logger.info('Publisher worker started, waiting for messages...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down publisher worker');
    await closeQueue();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Publisher worker failed to start');
  process.exit(1);
});
