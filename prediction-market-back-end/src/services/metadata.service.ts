/**
 * Metadata Service
 *
 * Manages market metadata using the ai_markets table.
 * This service is used for manual market creation from the frontend.
 * AI-generated markets also use ai_markets but go through the worker pipeline.
 */

import { getDb, isDatabaseConfigured } from '../db/client.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { config } from '../config/index.js';

// Supported chain IDs
export type ChainId =
  | 'solana-devnet'
  | 'solana-mainnet'
  | 'ethereum-mainnet'
  | 'ethereum-sepolia'
  | 'base-mainnet'
  | 'base-sepolia'
  | string; // Allow custom chain IDs for future expansion

export interface MarketMetadata {
  id: string;
  chainId: ChainId;
  marketAddress?: string;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
  createdAt: Date;
}

export interface CreateMetadataParams {
  chainId?: ChainId;
  name: string;
  symbol: string;
  description?: string;
  category?: string;
  resolutionSource?: string;
}

// Database row type
interface AiMarketRow {
  id: string;
  chain_id: string;
  market_address?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  resolution?: { sources?: string[] } | null;
  created_at: Date;
}

export class MetadataService {
  /**
   * Create metadata entry in ai_markets for manual market creation
   */
  async create(params: CreateMetadataParams): Promise<MarketMetadata> {
    if (!isDatabaseConfigured()) {
      throw new BadRequestError('Database not configured');
    }

    const sql = getDb();

    // Use centralized config for defaults
    const chainId = params.chainId || config.defaults.chainId;
    const { validCategories, category: defaultCategory } = config.defaults;
    const category = (params.category && validCategories.includes(params.category as typeof validCategories[number]))
      ? params.category
      : defaultCategory;

    const description = params.description || '';
    const resolutionJson = JSON.stringify({
      expiry: null,
      sources: params.resolutionSource ? [params.resolutionSource] : [],
      must_meet_all: [],
    });

    const result = await sql<AiMarketRow[]>`
      INSERT INTO ai_markets (
        chain_id,
        title,
        description,
        category,
        ai_version,
        confidence_score,
        resolution,
        status,
        created_by
      )
      VALUES (
        ${chainId},
        ${params.name},
        ${description},
        ${category},
        'manual',
        ${1.0},
        ${resolutionJson}::jsonb,
        'pending_publish',
        'manual'
      )
      RETURNING id, chain_id, title as name, description, category, resolution, created_at
    `;
    const row = result[0];

    return {
      id: row.id,
      chainId: row.chain_id,
      name: row.name,
      symbol: params.symbol, // Symbol not stored in ai_markets, return input
      description: row.description || undefined,
      category: row.category || undefined,
      resolutionSource: row.resolution?.sources?.[0] || undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * Get metadata by ID
   */
  async getById(id: string): Promise<MarketMetadata> {
    if (!isDatabaseConfigured()) {
      throw new BadRequestError('Database not configured');
    }

    const sql = getDb();

    const [row] = await sql<AiMarketRow[]>`
      SELECT id, chain_id, market_address, title as name, description, category, resolution, created_at
      FROM ai_markets
      WHERE id = ${id}
    `;

    if (!row) {
      throw new NotFoundError(`Metadata with id ${id} not found`);
    }

    return this.mapRow(row);
  }

  /**
   * Get metadata by market address
   */
  async getByMarketAddress(marketAddress: string): Promise<MarketMetadata | null> {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const sql = getDb();

    const [row] = await sql<AiMarketRow[]>`
      SELECT id, chain_id, market_address, title as name, description, category, resolution, created_at
      FROM ai_markets
      WHERE market_address = ${marketAddress}
    `;

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  /**
   * Link metadata to market address after on-chain creation
   */
  async linkToMarket(metadataId: string, marketAddress: string): Promise<MarketMetadata> {
    if (!isDatabaseConfigured()) {
      throw new BadRequestError('Database not configured');
    }

    const sql = getDb();

    const [row] = await sql<AiMarketRow[]>`
      UPDATE ai_markets
      SET
        market_address = ${marketAddress},
        status = 'active',
        published_at = NOW()
      WHERE id = ${metadataId}
      RETURNING id, chain_id, market_address, title as name, description, category, resolution, created_at
    `;

    if (!row) {
      throw new NotFoundError(`Metadata with id ${metadataId} not found`);
    }

    return this.mapRow(row);
  }

  private mapRow(row: AiMarketRow): MarketMetadata {
    return {
      id: row.id,
      chainId: row.chain_id,
      marketAddress: row.market_address || undefined,
      name: row.name,
      symbol: '', // Not stored in ai_markets
      description: row.description || undefined,
      category: row.category || undefined,
      resolutionSource: row.resolution?.sources?.[0] || undefined,
      createdAt: row.created_at,
    };
  }
}

export const metadataService = new MetadataService();
