-- Migration: 007_add_chain_id_to_ai_markets.sql
-- Description: Add chain_id column to ai_markets for multi-chain support
-- Created: 2024-12-09

-- Add chain_id column with default for existing records
ALTER TABLE ai_markets
  ADD COLUMN IF NOT EXISTS chain_id TEXT NOT NULL DEFAULT 'solana-devnet';

-- Create index for chain_id lookups
CREATE INDEX IF NOT EXISTS idx_ai_markets_chain_id ON ai_markets(chain_id);
