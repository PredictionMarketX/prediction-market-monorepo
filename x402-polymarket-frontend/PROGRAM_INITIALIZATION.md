# Program Initialization Guide

## Issue: Config Account Not Found

If you see this error:
```
Failed to fetch config: Error: Account does not exist or has no data
```

This means the Solana program has been deployed but **not yet initialized** with its global configuration.

## Why Initialization is Needed

The prediction market program requires a one-time initialization by the program authority to:
1. Create the global config account
2. Set the admin/authority address
3. Set the team wallet (for fee collection)
4. Configure USDC mint address
5. Set fee percentages (swap fee, LP fee)
6. Configure token decimals and initial reserves
7. Enable/disable whitelist

## Who Can Initialize

Only the **program authority** can initialize the config:
- **Authority Address**: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`

## How to Initialize

### Option 1: Using Anchor CLI (Recommended)

Navigate to the contract directory and use the CLI tool:

```bash
cd /Users/hongming/Documents/GitHub/x402-ploymarket/contract

# Initialize with default configuration
anchor run configure
```

Or manually with custom parameters:

```bash
# First, ensure you're using the authority wallet
solana config set --keypair /path/to/authority-keypair.json

# Then call the configure instruction
# You may need to create a script or use the CLI in contract/cli/
```

### Option 2: Using the Contract CLI

The contract has a CLI tool in `/contract/cli/`:

```bash
cd /Users/hongming/Documents/GitHub/x402-ploymarket/contract

# Install dependencies if not already done
npm install

# Run the configure command
npm run configure -- \
  --admin 2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr \
  --team-wallet YOUR_TEAM_WALLET_ADDRESS \
  --usdc-mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --swap-fee 30 \
  --lp-fee 20 \
  --network devnet
```

**Note**:
- USDC Devnet Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Fees are in basis points (30 = 0.3%, 20 = 0.2%)

### Option 3: Using the Frontend (Admin Only)

We can add an admin initialization UI to the frontend. This would be accessible only to the program authority.

## Required Configuration Parameters

```typescript
{
  admin: PublicKey,              // Program admin address
  teamWallet: PublicKey,         // Wallet to receive fees
  usdcMint: PublicKey,          // USDC mint address
  swapFee: number,              // Swap fee in basis points (e.g., 30 = 0.3%)
  lpFee: number,                // LP fee in basis points (e.g., 20 = 0.2%)
  tokenDecimalsConfig: number,  // Token decimals (should be 6 for USDC)
  tokenSupplyConfig: BN,        // Initial token supply
  initialRealTokenReservesConfig: BN, // Initial reserves
  whitelistEnabled: boolean,    // Enable creator whitelist
  emergencyStop: boolean,       // Emergency pause (should be false initially)
}
```

## Verification

After initialization, verify the config exists:

```bash
# Check the config account
solana account G2GawQFgqmFVWekqSwKCmfMkHhDscHkQ818e5JRNosqd --url devnet

# Or use the frontend - it should no longer show config errors
```

## Expected Config PDA

The config account is a Program Derived Address (PDA) with:
- **Seed**: `"config"`
- **Program ID**: `78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR`
- **Derived Address**: `G2GawQFgqmFVWekqSwKCmfMkHhDscHkQ818e5JRNosqd`

## Frontend Behavior Before Initialization

The frontend will:
- ✅ Not crash
- ✅ Show a warning in console: "Config not found - program may not be initialized yet"
- ✅ Display empty market list
- ❌ Cannot create markets (requires config)
- ❌ Cannot trade (requires config for fees)

## Frontend Behavior After Initialization

The frontend will:
- ✅ Successfully fetch config
- ✅ Display markets (if any exist)
- ✅ Allow market creation (if user is whitelisted or whitelist disabled)
- ✅ Allow trading with proper fee calculations
- ✅ Show team wallet address in config

## Temporary Workaround

If you need to test the frontend before initialization, you can:

1. **Mock the config** in the hook (for development only):
```typescript
// In usePredictionMarket.ts
const fetchConfig = useCallback(async () => {
  if (!client) return;

  try {
    const configData = await client.getConfig();
    setConfig(configData);
  } catch (err: any) {
    // TEMPORARY: Use mock config for testing
    setConfig({
      admin: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),
      teamWallet: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),
      usdcMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
      swapFee: 30,
      lpFee: 20,
      tokenDecimalsConfig: 6,
      whitelistEnabled: false,
      emergencyStop: false,
    });
  }
}, [client]);
```

**⚠️ Warning**: Remove this mock before production!

## Next Steps

1. **Contact Program Authority** (`2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`)
2. **Run initialization** using one of the methods above
3. **Verify config exists** on devnet
4. **Test frontend** - should now work fully

## Additional Resources

- Contract README: `/contract/README.md`
- Deploy Guide: `/contract/DEPLOY_GUIDE.md`
- CLI Scripts: `/contract/cli/`
- Frontend Integration: `./PREDICTION_MARKET_INTEGRATION.md`

## Contact

If you are the program authority and need help with initialization, check:
1. `/contract/cli/scripts.ts` - CLI implementation
2. `/contract/tests/` - Test files showing initialization examples
3. `/contract/frontend-integration-example.ts` - Example code for all instructions
