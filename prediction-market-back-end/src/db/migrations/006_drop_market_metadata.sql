-- Migration: 006_drop_market_metadata.sql
-- Description: Drop legacy market_metadata table (consolidated into ai_markets)
-- Created: 2024-12-09

-- Drop the legacy market_metadata table if it exists
-- All market metadata is now stored in ai_markets table
DROP TABLE IF EXISTS market_metadata;
