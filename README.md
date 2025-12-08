# X402 Polymarket

A decentralized prediction market platform built on Solana, featuring multi-chain payment support through the X402 protocol and AI-powered market generation.

## Features

- **Prediction Markets**: Create and trade on binary outcome markets using YES/NO tokens
- **Multi-Chain Payments**: Support for both EVM (Base Sepolia) and Solana (Devnet) via X402 protocol
- **Single-Sided Liquidity**: Provide liquidity using only USDC - the contract automatically mints YES/NO tokens
- **LMSR Pricing**: Logarithmic Market Scoring Rule for dynamic market pricing
- **Real-Time Trading**: Buy and sell prediction tokens with instant settlement
- **AI Market Generation**: Automated market creation from news and user proposals
- **Deterministic Resolution**: Rule-based market resolution with dispute handling

## Project Structure

```
x402-ploymarket/
├── contract/                           # Solana smart contract (Anchor)
│   └── programs/prediction-market/
├── ai-prediction-market-front-end/     # Next.js frontend
├── prediction-market-back-end/         # Fastify API server
│   ├── src/
│   │   ├── routes/                     # API endpoints
│   │   │   ├── v1/                     # AI features API
│   │   │   │   ├── propose.ts          # User proposal endpoints
│   │   │   │   └── admin/              # Admin review endpoints
│   │   ├── services/ai/                # AI service layer
│   │   └── db/migrations/              # Database migrations
├── workers/                            # AI worker processes
│   └── src/
│       ├── generator.ts                # Market generation from proposals
│       ├── validator.ts                # Draft market validation
│       ├── publisher.ts                # On-chain market publishing
│       ├── resolver.ts                 # Market resolution
│       ├── scheduler.ts                # Cron jobs for resolution/finalization
│       └── dispute-agent.ts            # Dispute review AI
├── packages/
│   └── shared-types/                   # Shared TypeScript types
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Solana CLI tools
- Anchor framework
- PostgreSQL database (or Neon)
- RabbitMQ (for AI workers)
- OpenAI API key (for AI features)
- A Solana wallet (Phantom, Backpack, etc.)

### 1. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

### 2. Environment Setup

#### Backend (.env)

Create `prediction-market-back-end/.env`:

```env
# Server
PORT=3001
NODE_ENV=development

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
BACKEND_PRIVATE_KEY=your_base58_private_key

# x402
X402_PAYMENT_ADDRESS=your_payment_address
X402_FACILITATOR_URL=https://x402.org/facilitator

# CORS
CORS_ORIGIN=http://localhost:3000

# Database (PostgreSQL/Neon)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# RabbitMQ (for AI workers)
RABBITMQ_URL=amqp://localhost:5672

# OpenAI (for AI features)
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo

# Rate Limits
RATE_LIMIT_PROPOSE_PER_MIN=5
RATE_LIMIT_PROPOSE_PER_HOUR=20
RATE_LIMIT_PROPOSE_PER_DAY=50

# Internal Auth
INTERNAL_JWT_SECRET=your_jwt_secret
```

#### Workers (.env)

Create `workers/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
PUBLISHER_PRIVATE_KEY=your_base58_private_key

# API
API_BASE_URL=http://localhost:3001
WORKER_API_KEY=your_worker_api_key

# Feature Flags
DRY_RUN=true  # Set to false for production
```

#### Frontend (.env.local)

Create `ai-prediction-market-front-end/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_SOLANA_RECIPIENT=your_solana_address
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Database Setup

Run migrations to create the AI tables:

```bash
cd prediction-market-back-end
pnpm dev  # This will auto-run migrations on startup
```

Or manually:

```bash
# The migrations are run automatically when the backend starts
# Tables created: ai_markets, proposals, news_items, candidates,
#                 resolutions, disputes, audit_logs, ai_config, etc.
```

### 4. Start Services

#### Start RabbitMQ (Docker)

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

#### Start Backend

```bash
cd prediction-market-back-end
pnpm dev
# Server runs on http://localhost:3001
```

#### Start Frontend

```bash
cd ai-prediction-market-front-end
pnpm dev
# App runs on http://localhost:3000
```

#### Start AI Workers

Each worker runs as a separate process:

```bash
cd workers

# Start individual workers (in separate terminals)
pnpm dev:generator       # Market generation from proposals
pnpm dev:validator       # Draft validation
pnpm dev:publisher       # On-chain publishing
pnpm dev:resolver        # Market resolution
pnpm dev:scheduler       # Cron jobs
pnpm dev:dispute-agent   # Dispute handling
```

For production, use the compiled versions:

```bash
pnpm build
pnpm start:generator
pnpm start:validator
# etc.
```

## AI Market Generation Flow

### User Proposal Flow

1. **User submits proposal** via `POST /api/v1/propose`
   ```json
   {
     "proposal_text": "Will Apple release iPhone 16 before October 2024?",
     "category_hint": "product_launch"
   }
   ```

2. **Rate limiting** checks (5/min, 20/hour, 50/day per user)

3. **Duplicate detection** using pg_trgm similarity

4. **Generator Worker** creates draft market using LLM:
   - Title, description, resolution criteria
   - must_meet_all conditions
   - allowed_sources for verification
   - Confidence score

5. **Validator Worker** checks:
   - Clarity and unambiguity
   - Source reachability
   - Safety (no forbidden topics)
   - Routes to: approved, rejected, or needs_human

6. **Admin Review** (if needs_human):
   - `GET /api/v1/admin/proposals` - List pending proposals
   - `POST /api/v1/admin/proposals/:id/review` - Approve/reject

7. **Publisher Worker** deploys to Solana

### Market Resolution Flow

1. **Scheduler** detects markets past expiry

2. **Resolver Worker**:
   - Fetches evidence from allowed_sources
   - LLM evaluates must_meet_all conditions
   - Stores resolution with evidence hash
   - 24-hour dispute window starts

3. **Dispute Handling** (if disputed):
   - `POST /api/v1/disputes` - Submit dispute
   - Dispute Agent Worker reviews
   - Outcomes: upheld, overturned, or escalated

4. **Finalization** after dispute window

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/propose` | Submit market proposal |
| GET | `/api/v1/proposals/:id` | Get proposal status |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/proposals` | List proposals needing review |
| GET | `/api/v1/admin/proposals/:id` | Get proposal details |
| POST | `/api/v1/admin/proposals/:id/review` | Approve/reject proposal |
| GET | `/api/v1/admin/disputes` | List disputes |
| GET | `/api/v1/admin/disputes/:id` | Get dispute details |
| POST | `/api/v1/admin/disputes/:id/review` | Review dispute |

### Existing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | List all markets |
| GET | `/api/markets/:address` | Get market details |
| POST | `/api/trading/swap` | Execute trade |
| POST | `/api/liquidity/add` | Add liquidity |
| POST | `/api/liquidity/withdraw` | Withdraw liquidity |

## Message Queues

| Queue | Publisher | Consumer | Purpose |
|-------|-----------|----------|---------|
| `news.raw` | Crawler | Extractor | Raw news items |
| `candidates` | Extractor/API | Generator | Market candidates |
| `drafts.validate` | Generator | Validator | Drafts for validation |
| `markets.publish` | Validator | Publisher | Approved markets |
| `markets.resolve` | Scheduler | Resolver | Markets to resolve |
| `disputes` | API | Dispute Agent | Disputes to review |
| `config.refresh` | Admin | All workers | Config updates |

## Database Schema (AI Tables)

Key tables:

- `ai_markets` - AI-generated market metadata
- `proposals` - User proposals with status tracking
- `candidates` - Market candidates from news/proposals
- `resolutions` - Market resolution records with evidence
- `disputes` - User disputes with AI/admin review
- `audit_logs` - Audit trail for all actions
- `rate_limits` - Per-user rate limiting

## Development

### Run Type Checking

```bash
# Backend
cd prediction-market-back-end && pnpm typecheck

# Workers
cd workers && pnpm typecheck

# Shared types
cd packages/shared-types && pnpm typecheck
```

### Run Linting

```bash
cd prediction-market-back-end && pnpm lint
cd workers && pnpm lint
```

## Security Considerations

- **Rate Limiting**: Sliding window rate limits on proposal submission
- **Duplicate Detection**: pg_trgm similarity prevents duplicate markets
- **Evidence Hashing**: SHA-256 hash of resolution evidence for accountability
- **Audit Logging**: All major actions logged for accountability
- **DLQ Support**: Failed messages go to dead letter queue for inspection
- **Retry Logic**: Exponential backoff (1s, 5s, 30s) before DLQ

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `RABBITMQ_URL` | For AI | `amqp://localhost:5672` | RabbitMQ connection |
| `OPENAI_API_KEY` | For AI | - | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-3.5-turbo` | LLM model to use |
| `PROGRAM_ID` | Yes | - | Solana program ID |
| `SOLANA_RPC_URL` | No | Devnet | Solana RPC endpoint |
| `DRY_RUN` | No | `false` | Skip on-chain transactions |

## Troubleshooting

### Workers not processing messages

1. Check RabbitMQ is running: `docker ps`
2. Check queue status: http://localhost:15672 (guest/guest)
3. Check worker logs for errors

### Database connection issues

1. Verify `DATABASE_URL` is correct
2. Check SSL mode for Neon: `?sslmode=require`
3. Ensure migrations have run

### LLM errors

1. Verify `OPENAI_API_KEY` is valid
2. Check rate limits on OpenAI dashboard
3. Review worker logs for specific errors

## License

MIT

## Support

For issues or questions:
- Check the backend/worker logs for detailed error messages
- Review the RabbitMQ management UI for queue status
- Ensure all required environment variables are set
