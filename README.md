# X402 Polymarket

A decentralized prediction market platform built on Solana, featuring multi-chain payment support through the X402 protocol.

## Features

- **Prediction Markets**: Create and trade on binary outcome markets using YES/NO tokens
- **Multi-Chain Payments**: Support for both EVM (Base Sepolia) and Solana (Devnet) via X402 protocol
- **Single-Sided Liquidity**: Provide liquidity using only USDC - the contract automatically mints YES/NO tokens
- **LMSR Pricing**: Logarithmic Market Scoring Rule for dynamic market pricing
- **Real-Time Trading**: Buy and sell prediction tokens with instant settlement

## Project Structure

```
x402-ploymarket/
├── contract/                      # Solana smart contract (Anchor)
│   └── programs/prediction-market/
│       └── src/
│           ├── instructions/     # Market operations
│           ├── state/           # Account structures
│           └── lib.rs
├── x402-polymarket-frontend/     # Next.js frontend
│   ├── app/
│   │   ├── lib/solana/         # Solana client & types
│   │   ├── hooks/              # React hooks
│   │   └── providers/          # Wallet providers
│   └── components/
│       ├── market/             # Market UI components
│       └── wallet/             # Wallet components
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Solana CLI tools
- Anchor framework
- A Solana wallet (Phantom, Backpack, etc.)

### Frontend Setup

```bash
cd x402-polymarket-frontend
pnpm install
pnpm dev
```

The frontend will run on `http://localhost:3000`

### Contract Deployment

```bash
cd contract
anchor build
anchor deploy
```

## How It Works

### Creating Markets

Markets are created with:
- Binary outcome (YES/NO)
- Initial probability (e.g., 70% YES)
- USDC as collateral
- LMSR pricing mechanism

### Trading

1. **Buy YES/NO Tokens**: Purchase prediction tokens at market price
2. **Sell Tokens**: Sell back to the pool at current price
3. **Redeem Complete Sets**: Burn 1 YES + 1 NO → Receive 1 USDC

### Liquidity Provision

#### Important: Minimum Liquidity Requirements

- **First LP**: Minimum **1000 USDC** required
- **Subsequent LP**: Minimum **10 USDC** required

The first LP requires 1000 USDC due to the Uniswap V2-style `MIN_LIQUIDITY` constant (1,000,000,000 base units). This prevents division-by-zero attacks.

**How LP Works:**

1. Deposit USDC only (single-sided)
2. Contract automatically:
   - Mints YES/NO tokens proportionally
   - Adds to liquidity pool
   - Issues LP shares

3. LP shares calculation:
   - **First LP**: `shares = usdc_amount - MIN_LIQUIDITY`
   - **Subsequent LP**: Proportional to pool value

4. Withdraw:
   - Burn LP shares
   - Receive USDC + YES/NO tokens proportionally

#### Known Issue: LP Shares = 0

If you added less than 1000 USDC as the first LP:
- Your USDC is tracked in `invested_usdc` field
- But `lp_shares` = 0 because: `shares = usdc_amount - 1_000_000_000`
- **Withdrawal is currently blocked** until contract is updated
- Your funds are safe but locked

**Workaround**: Add more liquidity to reach 1000+ USDC total, which will trigger proper LP share calculation.

## Multi-Chain Payments (X402 Protocol)

The platform supports payments on both chains:

### EVM (Base Sepolia)
- Uses USDC token transfers via EIP-712 signatures
- Payment requirements verified on-chain
- No gas required from user (meta-transactions)

### Solana (Devnet)
- Direct SOL transfers
- Instant confirmation
- Low transaction fees

Switch between chains using the wallet selector in the header.

## Tech Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Anchor**: Solana program framework
- **Wagmi + Reown AppKit**: EVM wallet connections
- **Solana Wallet Adapter**: Solana wallet support

### Smart Contract
- **Anchor Framework**: Solana program development
- **Rust**: Smart contract language
- **SPL Token**: Token program for YES/NO tokens
- **USDC**: Collateral token (Devnet)

## Key Contracts

### Solana Program
- Program ID: `CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM`
- Network: Devnet
- USDC Mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

### EVM Contracts (Base Sepolia)
- USDC Token: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Payment Recipient: `0x209693Bc6afc0C5328bA36FaF03C514EF312287C`

## Environment Variables

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_SOLANA_RECIPIENT=your_solana_address
```

## Trading Example

```typescript
// Buy 10 USDC worth of YES tokens
await swap({
  market: marketAddress,
  tokenType: TokenType.Yes,
  direction: TradeDirection.Buy,
  amount: 10,
  minOutput: 9.5 // 5% slippage tolerance
});
```

## LP Example

```typescript
// Add 1000 USDC liquidity (first LP)
await addLiquidity({
  market: marketAddress,
  usdcAmount: 1000
});

// Withdraw 500 LP shares
await withdrawLiquidity({
  market: marketAddress,
  lpSharesAmount: 500
});
```

## Security Considerations

- **Reentrancy Protection**: All state-changing functions use reentrancy guards
- **Integer Overflow**: Safe math operations with checked arithmetic
- **Access Control**: Market creator and admin permissions
- **Slippage Protection**: Min output requirements for swaps
- **Market Pausing**: Circuit breaker for emergency situations

## Known Limitations

1. **First LP Minimum**: 1000 USDC required (contract constant)
2. **Devnet Only**: Currently deployed on Solana Devnet and Base Sepolia
3. **No Governance**: Market parameters are fixed at creation
4. **Limited Resolution**: Manual market resolution by creator

## Contributing

This is a hackathon project. Contributions welcome!

## License

MIT

## Support

For issues or questions:
- Check the smart contract logs for detailed error messages
- Review the frontend console for transaction details
- Ensure sufficient balance for transactions (including fees)

## Roadmap

- [ ] Lower MIN_LIQUIDITY or add dynamic minimum based on market size
- [ ] Add withdrawal support for 0-share LP positions
- [ ] Mainnet deployment
- [ ] Governance token for market creation/resolution
- [ ] Advanced charting and analytics
- [ ] Mobile responsive improvements
- [ ] Multi-outcome markets (beyond binary)
