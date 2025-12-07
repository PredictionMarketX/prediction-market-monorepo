# Deployment Configuration

## Solana Prediction Market Program

### Deployed Program Information

- **Program ID**: `78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR`
- **Program Data Address**: `3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq`
- **Authority**: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
- **Network**: Solana Devnet
- **Owner**: BPFLoaderUpgradeab1e11111111111111111111111
- **Program Version**: 1.1.1

### Frontend Configuration

The frontend has been configured to connect to the deployed program:

```typescript
// app/lib/solana/program.ts
export const PROGRAM_CONFIG = {
  programId: new PublicKey('78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR'),
  programDataAddress: new PublicKey('3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq'),
  authority: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),
  network: 'devnet',
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
};
```

### Environment Variables

Required `.env.local` variables:

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com

# X402 Payment Configuration (for paywall)
NEXT_PUBLIC_RECEIVER_ADDRESS=<your-receiver-address>
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_FACILITATOR_URL=https://facilitator.x402.com
NEXT_PUBLIC_CDP_CLIENT_KEY=<your-coinbase-key>
```

## Contract Features

### Market Operations

1. **Create Market**: Create binary prediction markets with YES/NO tokens
2. **Swap Tokens**: Buy/sell YES or NO tokens using LMSR pricing
3. **Mint Complete Set**: Convert 1 USDC → 1 YES + 1 NO token
4. **Redeem Complete Set**: Burn 1 YES + 1 NO → get 1 USDC back
5. **Add Liquidity**: Provide USDC liquidity to earn fees
6. **Withdraw Liquidity**: Remove liquidity and claim fees
7. **Resolution**: Admin resolves market outcome (YES/NO/INVALID)
8. **Claim Rewards**: Users claim winnings after resolution

### Key Constants

- **Collateral**: USDC (6 decimals)
- **1:1 Backing**: 1 USDC = 1 YES + 1 NO token
- **Pricing**: LMSR (Logarithmic Market Scoring Rule)
- **Default B Parameter**: 500 USDC
- **Swap Fee**: Configurable by admin
- **LP Fee**: Configurable by admin

### PDA Seeds

```typescript
CONFIG: "config"
GLOBAL: "global"
MARKET: "market"
USERINFO: "userinfo"
METADATA: "metadata"
WHITELIST: "wl-seed"
LP_POSITION: "lp_position"
```

## Frontend Integration

### Implemented Features

✅ **Program Integration**
- IDL integration with type safety
- Program client wrapper
- PDA derivation helpers
- React hooks for state management

✅ **Market Listing**
- View all active markets
- Real-time YES/NO prices
- Market status indicators (Active/Paused/Resolved)
- Liquidity and volume stats

✅ **Market Creation**
- Create new markets (whitelist required)
- Configure LMSR parameters
- Set start/end slots
- Metadata URI support

🚧 **In Progress**
- Trading interface (swap, mint, redeem)
- Liquidity provider interface
- Individual market detail page
- User portfolio tracking

## Testing on Devnet

### Prerequisites

1. **Solana Wallet**: Install Phantom, Solflare, or another Solana wallet
2. **Devnet SOL**: Get from https://faucet.solana.com
3. **Devnet USDC**: Need to acquire from a devnet USDC faucet or mint

### Test Flow

1. **Connect Wallet**: Click on wallet button in header, select Solana
2. **View Markets**: Navigate to `/markets` to see all markets
3. **Create Market**: Click "Create Market" (requires whitelist)
4. **Trade**: Click on a market to view details and trade (coming soon)
5. **Add Liquidity**: Provide USDC liquidity to earn fees (coming soon)

### Verification Commands

```bash
# Check program account
solana account 78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR --url devnet

# Check program data
solana account 3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq --url devnet

# Fetch program logs
solana logs 78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR --url devnet
```

## Troubleshooting

### Common Issues

1. **"Wallet not connected"**
   - Ensure Solana wallet is connected (not EVM)
   - Switch to Solana network in the header

2. **"Market creation failed"**
   - Check if you're whitelisted
   - Ensure you have enough SOL for transaction fees
   - Verify USDC balance

3. **"Transaction failed"**
   - Check devnet RPC connection
   - Verify program is not paused
   - Ensure sufficient SOL for fees

4. **"Account not found"**
   - Market may not exist
   - Check program ID is correct
   - Verify network is devnet

## Next Steps

1. ✅ Update program ID to deployed version
2. ✅ Verify IDL matches deployed program
3. 🔄 Implement trading interface
4. 🔄 Implement LP interface
5. 🔄 Create market detail page
6. 🔄 Add user portfolio tracking
7. 🔄 Implement market resolution UI (admin only)

## Links

- **Frontend**: http://localhost:3000 (dev)
- **Program Explorer**: https://explorer.solana.com/address/78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR?cluster=devnet
- **Contract README**: ../contract/README.md
- **Deployment Guide**: ../contract/DEPLOY_GUIDE.md
