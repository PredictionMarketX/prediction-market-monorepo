# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

x402-ploymarket is a decentralized prediction market platform built on Solana with x402 payment protocol integration. The project consists of three main components: a Next.js frontend, a Fastify backend, and an Anchor smart contract.

## Commands

### Frontend (ai-prediction-market-front-end/)
```bash
pnpm dev         # Development server (port 3000)
pnpm build       # Production build
pnpm lint        # ESLint check
```

### Backend (prediction-market-back-end/)
```bash
pnpm dev         # Development server with watch (port 3001)
pnpm build       # TypeScript compilation
pnpm typecheck   # Type checking without emit
pnpm lint        # ESLint check
```

### Smart Contract (contract/)
```bash
anchor build                           # Compile program
anchor test                            # Full test suite with validator
yarn test                              # Run Mocha tests only
node scripts/init-localhost.js         # Initialize on localnet
node scripts/init-devnet.js            # Initialize on devnet
node scripts/test-market-flow.js       # End-to-end flow test
```

## Architecture

### Three-Layer Structure
- **Frontend**: Next.js 16 with App Router, React Query, Solana wallet adapters
- **Backend**: Fastify server handling API routes with x402 payment validation middleware
- **Contract**: Anchor-based Solana program using LMSR pricing algorithm

### Frontend Organization (ai-prediction-market-front-end/src/)
- `app/` - Next.js App Router pages
- `features/` - Feature modules (markets, trading, liquidity, portfolio) with co-located hooks, types, and API calls
- `lib/blockchain/` - Blockchain abstraction layer with `IBlockchainAdapter` interface for multi-chain support
- `lib/api/` - API client for backend communication
- `config/` - Environment and contract configuration
- `providers/` - React Context providers for wallet and app state

### Backend Organization (prediction-market-back-end/src/)
- `routes/` - API endpoints (markets, trading, liquidity, metadata, config)
- `services/` - Business logic layer
- `blockchain/solana/` - Solana client integration
- `middleware/` - x402 validation and error handling
- `config/` - Environment and contract configuration

### Smart Contract Organization (contract/programs/prediction-market/src/)
- `instructions/` - Instruction handlers split into `admin/` and `market/`
- `state/` - Account structures (config.rs, market.rs)
- `math/` - LMSR pricing, fixed-point arithmetic, calculators
- `lib.rs` - Program entry point with 30+ instruction declarations

## Key Concepts

### LMSR Pricing
The contract uses Logarithmic Market Scoring Rule for dynamic market pricing. Implementation in `contract/programs/prediction-market/src/math/lmsr.rs`.

### Blockchain Abstraction
Frontend uses `IBlockchainAdapter` interface (`lib/blockchain/`) allowing pluggable blockchain implementations (currently Solana, designed for future multi-chain support).

### x402 Payment Integration
Backend middleware validates x402 payments for meta-transaction support. Configuration in `src/config/x402.ts` (frontend) and `src/middleware/` (backend).

### Single-Sided Liquidity
Users deposit only USDC; the contract auto-mints YES/NO tokens proportionally.

## Important Configuration Files

- **Program IDs**: `contract/Anchor.toml` (per-network program IDs)
- **Frontend Config**: `ai-prediction-market-front-end/src/config/`
- **Backend Config**: `prediction-market-back-end/src/config/`
- **Frontend Port**: 3000
- **Backend Port**: 3001

## Current State

- Active branch: `new-version`
- Network: Devnet (configurable)
- Legacy frontend exists in `old-x402-polymarket-frontend/` (deprecated)
