# Solana Prediction Market Frontend Integration

Complete implementation of the Solana Prediction Market contract frontend.

## Overview

This frontend provides a full-featured interface for interacting with the Solana prediction market smart contract deployed at:

**Program ID**: `78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR`

## Features Implemented

### ✅ Core Integration
- **Program Client**: Full Anchor program integration with type-safe IDL
- **PDA Helpers**: Automatic derivation of all program accounts
- **React Hooks**: Custom `usePredictionMarket` hook for state management
- **Wallet Integration**: Seamless Solana wallet adapter integration

### ✅ Market Listing (`/markets`)
- View all active prediction markets
- Real-time YES/NO price display
- Market status indicators (Active/Paused/Resolved)
- Total liquidity and fees tracking
- Responsive card grid layout

### ✅ Market Creation (`/markets/create`)
- Create new binary prediction markets
- Configure market parameters:
  - Market question/YES symbol
  - Metadata URI (optional)
  - LMSR B parameter (default 500 USDC)
  - Start/end slots (optional)
- Form validation and error handling
- Success confirmation and redirect

### ✅ Market Detail Page (`/markets/[address]`)
- Comprehensive market information display
- Real-time price updates
- User position tracking
- Market statistics (liquidity, fees, minted tokens)
- Tabbed interface for trading and liquidity

### ✅ Trading Interface
- **Swap**: Buy/sell YES or NO tokens
  - Direction selector (Buy/Sell)
  - Token type selector (YES/NO)
  - Slippage tolerance configuration
  - LMSR-based pricing
- **Mint Complete Set**: Convert USDC to YES + NO tokens (1:1)
- **Redeem Complete Set**: Burn YES + NO tokens to get USDC back
- Real-time transaction feedback
- Input validation and error handling

### ✅ Liquidity Provider Interface
- **Add Liquidity**: Single-sided LP with USDC
  - Automatic YES + NO token minting
  - Proportional LP share calculation
- **Withdraw Liquidity**: Remove liquidity with LP shares
  - Receive USDC, YES, and NO tokens
  - Early withdrawal penalty protection
- Pool statistics display
- Reserve breakdown (YES, NO, USDC, LMSR B)

## File Structure

```
app/
├── lib/solana/
│   ├── program.ts              # Program config, PDA helpers, utilities
│   ├── client.ts               # Program client wrapper
│   ├── types.ts                # TypeScript types and enums
│   ├── prediction_market.json  # IDL (generated from contract)
│   └── index.ts                # Exports
├── hooks/
│   └── usePredictionMarket.ts  # React hook for program interaction
├── markets/
│   ├── page.tsx                # Market listing page
│   ├── create/page.tsx         # Market creation form
│   └── [address]/page.tsx      # Market detail page
components/market/
├── MarketCard.tsx              # Market card component
├── MarketList.tsx              # Markets grid component
├── TradingInterface.tsx        # Trade/mint/redeem interface
├── LiquidityInterface.tsx      # LP add/withdraw interface
└── index.ts                    # Exports
```

## Usage Guide

### 1. View Markets

Navigate to `/markets` to see all available prediction markets:

```typescript
// Markets are automatically fetched on page load
// Each card shows:
// - Market address (truncated)
// - YES/NO prices and percentages
// - Total liquidity and fees
// - Market status (Active/Paused/Resolved)
```

### 2. Create a Market

Click "Create Market" button or navigate to `/markets/create`:

```typescript
// Required:
// - Market question (YES token symbol)
// - Wallet must be whitelisted

// Optional:
// - Metadata URI (JSON format)
// - LMSR B parameter (default 500)
// - Start/end slots
```

### 3. Trade on a Market

Click on any market card to open the detail page:

**Swap Tokens:**
```typescript
// 1. Select Buy or Sell
// 2. Choose YES or NO token
// 3. Enter USDC amount
// 4. Set slippage tolerance (default 1%)
// 5. Confirm transaction
```

**Mint Complete Set:**
```typescript
// 1. Enter USDC amount
// 2. Receive equal amounts of YES + NO tokens
// 3. Always 1:1 exchange rate
// 4. No price impact
```

**Redeem Complete Set:**
```typescript
// 1. Enter amount of sets to redeem
// 2. Must have equal YES and NO tokens
// 3. Burn both to receive USDC
// 4. Always 1:1 exchange rate
```

### 4. Provide Liquidity

Switch to "Liquidity" tab on market detail page:

**Add Liquidity:**
```typescript
// 1. Enter USDC amount
// 2. Contract auto-mints YES + NO tokens
// 3. Receive LP shares
// 4. Earn fees from swaps
```

**Withdraw Liquidity:**
```typescript
// 1. Enter LP shares to burn
// 2. Receive proportional USDC, YES, and NO
// 3. Early withdrawal may have penalty
```

## Code Examples

### Using the Hook

```typescript
import { usePredictionMarket } from '@/app/hooks/usePredictionMarket';

function MyComponent() {
  const {
    markets,
    loading,
    error,
    isConnected,
    fetchMarkets,
    createMarket,
    swap,
    mintCompleteSet,
    addLiquidity,
  } = usePredictionMarket();

  // Fetch markets
  useEffect(() => {
    if (isConnected) {
      fetchMarkets();
    }
  }, [isConnected]);

  // Create a market
  const handleCreate = async () => {
    const result = await createMarket({
      yesSymbol: 'Will Bitcoin reach $100k?',
      yesUri: 'https://example.com/metadata.json',
      lmsrB: 500,
    });

    if (result.success) {
      console.log('Market created!', result.signature);
    }
  };

  return (
    // Your UI
  );
}
```

### Direct Client Usage

```typescript
import { Connection } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { PredictionMarketClient } from '@/app/lib/solana/client';

function MyComponent() {
  const wallet = useWallet();
  const connection = new Connection('https://api.devnet.solana.com');
  const client = new PredictionMarketClient(connection, wallet);

  const handleSwap = async () => {
    const result = await client.swap({
      market: marketAddress,
      tokenType: 0, // YES
      direction: 0, // Buy
      amount: 10, // 10 USDC
      minOutput: 9.9, // 1% slippage
    });

    console.log('Swap result:', result);
  };
}
```

## Configuration

### Environment Variables

```bash
# Required for Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

### Program Configuration

Edit `app/lib/solana/program.ts`:

```typescript
export const PROGRAM_CONFIG = {
  programId: new PublicKey('78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR'),
  programDataAddress: new PublicKey('3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq'),
  authority: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),
  network: 'devnet',
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
};
```

## Testing Checklist

### Prerequisites
- [ ] Solana wallet installed (Phantom/Solflare)
- [ ] Connected to Solana Devnet
- [ ] Have devnet SOL for transaction fees
- [ ] Have devnet USDC for trading

### Market Listing
- [ ] Navigate to `/markets`
- [ ] See list of markets (or empty state)
- [ ] Market cards show correct prices
- [ ] Status indicators work (Active/Paused/Resolved)

### Market Creation
- [ ] Navigate to `/markets/create`
- [ ] Fill out form with valid data
- [ ] Submit transaction
- [ ] See success message
- [ ] Redirect to markets list
- [ ] New market appears in list

### Trading
- [ ] Click on a market
- [ ] See market details
- [ ] **Swap Test**:
  - [ ] Select Buy/Sell
  - [ ] Choose YES/NO
  - [ ] Enter amount
  - [ ] Submit transaction
  - [ ] See success message
- [ ] **Mint Test**:
  - [ ] Enter USDC amount
  - [ ] Submit transaction
  - [ ] Receive YES + NO tokens
- [ ] **Redeem Test**:
  - [ ] Have equal YES and NO
  - [ ] Enter amount
  - [ ] Submit transaction
  - [ ] Receive USDC

### Liquidity
- [ ] Switch to "Liquidity" tab
- [ ] **Add LP**:
  - [ ] Enter USDC amount
  - [ ] Submit transaction
  - [ ] Receive LP shares
- [ ] **Withdraw LP**:
  - [ ] Enter LP shares
  - [ ] Submit transaction
  - [ ] Receive USDC + tokens

## Troubleshooting

### Wallet Issues
- **Error**: "Wallet not connected"
  - **Solution**: Click wallet button in header, select Solana, connect wallet

- **Error**: "Insufficient SOL"
  - **Solution**: Get devnet SOL from https://faucet.solana.com

### Transaction Failures
- **Error**: "Transaction simulation failed"
  - **Causes**:
    - Insufficient USDC balance
    - Market is paused
    - Slippage too low
    - Not whitelisted (for market creation)
  - **Solution**: Check error message details

- **Error**: "Account not found"
  - **Causes**:
    - Market doesn't exist
    - Wrong network (mainnet vs devnet)
  - **Solution**: Verify program ID and network

### UI Issues
- **Problem**: Prices not updating
  - **Solution**: Check RPC connection, reload page

- **Problem**: "No markets found"
  - **Causes**:
    - No markets created yet
    - Wrong network
  - **Solution**: Create a market or check network

## Next Steps

### Suggested Enhancements
1. **User Portfolio**: Track all positions across markets
2. **Price Charts**: Historical price data with charts
3. **Market Resolution UI**: Admin interface for resolving markets
4. **Notifications**: Transaction status notifications
5. **Mobile Optimization**: Enhanced mobile UX
6. **Market Search**: Filter and search markets
7. **ENS Support**: Display ENS names for creators
8. **Transaction History**: View past trades and LP actions

### Production Checklist
- [ ] Switch to mainnet program ID
- [ ] Update RPC endpoint to mainnet
- [ ] Add error monitoring (Sentry)
- [ ] Add analytics (Google Analytics)
- [ ] Optimize bundle size
- [ ] Add SEO metadata
- [ ] Test on multiple browsers
- [ ] Mobile responsiveness testing
- [ ] Load testing with multiple concurrent users
- [ ] Security audit

## Resources

- **Contract Repo**: `../contract/`
- **Contract README**: `../contract/README.md`
- **Deploy Guide**: `../contract/DEPLOY_GUIDE.md`
- **Frontend Integration Example**: `../contract/frontend-integration-example.ts`
- **Deployment Config**: `./DEPLOYMENT_CONFIG.md`

## Support

For issues or questions:
1. Check this documentation
2. Review contract README
3. Check program logs: `solana logs 78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR --url devnet`
4. Open an issue in the repository
