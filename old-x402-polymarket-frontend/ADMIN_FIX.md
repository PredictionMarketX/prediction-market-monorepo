# Admin Page Initialization Fix

## Issue

When trying to initialize the program through the admin page, you encountered this error:

```
AnchorError: AnchorError thrown in programs/prediction-market/src/instructions/admin/configure.rs:264
Error Code: IncorrectAuthority
Error Number: 6004
Error Message: IncorrectAuthority
```

## Root Cause

The `configure` instruction performs an authority check during initialization (line 262-265 in `configure.rs`):

```rust
require!(
    new_config.authority == self.payer.key(),
    PredictionMarketError::IncorrectAuthority
);
```

The admin page was incorrectly passing:
- ❌ `admin: wallet.publicKey`
- ✅ Should be: `authority: wallet.publicKey`

Additionally, the Config struct requires ALL fields to be provided, not just a subset.

## Fix Applied

Updated `/app/admin/page.tsx` to pass the complete Config struct with correct field names:

```typescript
const tx = await program.methods
  .configure({
    authority: wallet.publicKey,                    // ✅ Changed from 'admin'
    pendingAuthority: PublicKey.default,            // ✅ Added
    teamWallet: teamWalletPubkey,
    platformBuyFee: new BN(swapFee),                // ✅ Changed from 'swapFee'
    platformSellFee: new BN(swapFee),               // ✅ Added
    lpBuyFee: new BN(lpFee),                        // ✅ Changed from 'lpFee'
    lpSellFee: new BN(lpFee),                       // ✅ Added
    tokenSupplyConfig: tokenSupply,
    tokenDecimalsConfig: tokenDecimals,
    initialRealTokenReservesConfig: initialReserves,
    minSolLiquidity: new BN(0),                     // ✅ Added (deprecated field)
    minTradingLiquidity: new BN(1000_000_000),      // ✅ Added (1000 USDC)
    initialized: true,                              // ✅ Added
    isPaused: false,                                // ✅ Added
    whitelistEnabled: formData.whitelistEnabled,
    usdcMint: USDC_MINT_DEVNET,
    usdcVaultMinBalance: new BN(5000),              // ✅ Added (0.005 USDC)
    minUsdcLiquidity: new BN(100_000_000),          // ✅ Added (100 USDC)
    lpInsurancePoolBalance: new BN(0),              // ✅ Added
    lpInsuranceAllocationBps: 2000,                 // ✅ Added (20%)
    insuranceLossThresholdBps: 1000,                // ✅ Added (10%)
    insuranceMaxCompensationBps: 5000,              // ✅ Added (50%)
    insurancePoolEnabled: false,                    // ✅ Added
  })
```

## Config Struct Reference

The complete Config struct from `/contract/programs/prediction-market/src/state/config.rs`:

| Field | Type | Purpose |
|-------|------|---------|
| `authority` | Pubkey | Current admin public key |
| `pending_authority` | Pubkey | Pending admin (for 2-step transfer) |
| `team_wallet` | Pubkey | Receives platform fees |
| `platform_buy_fee` | u64 | Platform buy fee (basis points) |
| `platform_sell_fee` | u64 | Platform sell fee (basis points) |
| `lp_buy_fee` | u64 | LP buy fee (basis points) |
| `lp_sell_fee` | u64 | LP sell fee (basis points) |
| `token_supply_config` | u64 | Deprecated, set to 0 |
| `token_decimals_config` | u8 | Must be 6 (USDC decimals) |
| `initial_real_token_reserves_config` | u64 | Default LMSR b parameter |
| `min_sol_liquidity` | u64 | Deprecated, set to 0 |
| `min_trading_liquidity` | u64 | Minimum pool liquidity for swaps |
| `initialized` | bool | Config initialization flag |
| `is_paused` | bool | Global pause flag |
| `whitelist_enabled` | bool | Creator whitelist enforcement |
| `usdc_mint` | Pubkey | USDC token mint address |
| `usdc_vault_min_balance` | u64 | Minimum vault balance (rent) |
| `min_usdc_liquidity` | u64 | Minimum LP deposit amount |
| `lp_insurance_pool_balance` | u64 | Insurance pool balance |
| `lp_insurance_allocation_bps` | u16 | Insurance allocation % |
| `insurance_loss_threshold_bps` | u16 | Loss threshold for payout |
| `insurance_max_compensation_bps` | u16 | Max compensation % |
| `insurance_pool_enabled` | bool | Insurance pool toggle |

## Testing

After this fix, initialization should work:

1. Navigate to `/admin`
2. Connect your Solana wallet (must be program authority)
3. Fill out the form
4. Click "Initialize Program"
5. Approve the transaction

The transaction should now succeed and you'll see:
```
✅ Program initialized successfully! Transaction: <signature>...
```

## Security Note

The `configure` instruction enforces that during initialization:
- The `authority` field in the config must equal the wallet calling the transaction
- This prevents anyone else from initializing your program with malicious settings

This is why the `IncorrectAuthority` error occurred - it's a security feature to ensure only you can initialize the program!
