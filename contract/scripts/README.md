# Program Initialization Scripts

## Quick Start

To initialize the deployed prediction market program, run:

```bash
cd /Users/hongming/Documents/GitHub/x402-ploymarket/contract

# Install dependencies if not already done
npm install

# Run initialization (must be program authority)
npx ts-node scripts/initialize-program.ts
```

## Prerequisites

1. **You must be the program authority**: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
2. **Authority keypair must be in**: `~/.config/solana/id.json`
3. **Have devnet SOL**: Get from https://faucet.solana.com
4. **Network**: Devnet

## What the Script Does

The `initialize-program.ts` script will:

1. ✅ Load your authority keypair
2. ✅ Verify you're the correct authority
3. ✅ Derive the config PDA and global vault PDA
4. ✅ Check if config already exists (won't re-initialize)
5. ✅ Create the global USDC ATA for the vault
6. ✅ Call the `configure` instruction with default parameters
7. ✅ Fetch and display the initialized configuration

## Default Configuration

```typescript
{
  authority: '2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr',
  teamWallet: '2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr', // ⚠️ CHANGE THIS
  usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Devnet USDC
  swapFee: 30,  // 0.3% (30 basis points)
  lpFee: 20,    // 0.2% (20 basis points)
  tokenDecimalsConfig: 6,
  tokenSupplyConfig: 1_000_000 USDC,
  initialRealTokenReservesConfig: 500 USDC,
  whitelistEnabled: false,  // Anyone can create markets
  emergencyStop: false,     // Normal operation
}
```

**⚠️ Important**: Edit `scripts/initialize-program.ts` to set your desired `teamWallet` address before running!

## Customizing Configuration

Edit `scripts/initialize-program.ts` and modify the `CONFIG_PARAMS` object:

```typescript
const CONFIG_PARAMS = {
  // Change this to your actual team wallet
  teamWallet: new PublicKey('YOUR_TEAM_WALLET_HERE'),

  // Adjust fees (in basis points)
  swapFee: 50,  // 0.5%
  lpFee: 30,    // 0.3%

  // Enable whitelist if you want to control who can create markets
  whitelistEnabled: true,

  // Other parameters...
};
```

## Verification

After running the script, verify the configuration:

```bash
# Check config account
solana account G2GawQFgqmFVWekqSwKCmfMkHhDscHkQ818e5JRNosqd --url devnet

# Or check in the frontend - should now load successfully
```

## Expected Output

```
🚀 Initializing Prediction Market Program...

📂 Loading authority keypair from: /Users/you/.config/solana/id.json
🔑 Authority: 2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr

📋 Configuration:
   Config PDA: G2GawQFgqmFVWekqSwKCmfMkHhDscHkQ818e5JRNosqd
   Global Vault: ...
   Team Wallet: ...
   USDC Mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
   Swap Fee: 30 bp (0.3%)
   LP Fee: 20 bp (0.2%)
   Whitelist Enabled: false

✅ Config does not exist yet - proceeding with initialization...

📤 Sending configure transaction...

✅ Configuration successful!
   Transaction signature: 3Jx...
   View on explorer: https://explorer.solana.com/tx/3Jx...?cluster=devnet

🎉 Program initialized successfully!

Final Configuration:
   Admin: 2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr
   Team Wallet: 2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr
   ...

✨ Initialization complete!
You can now use the prediction market program.
```

## Troubleshooting

### Error: "Wallet mismatch"
**Cause**: The keypair you're using doesn't match the program authority.
**Solution**: Ensure `~/.config/solana/id.json` contains the authority keypair.

### Error: "Config already exists"
**Cause**: Program has already been initialized.
**Solution**: This is not an error - the program is ready to use!

### Error: "Low SOL balance"
**Cause**: Not enough SOL for transaction fees.
**Solution**: Get more devnet SOL from https://faucet.solana.com

### Error: "Account not found"
**Cause**: The script might be looking for the wrong program ID.
**Solution**: Verify `PROGRAM_ID` in the script matches your deployed program.

## After Initialization

Once initialized, you can:

1. ✅ Use the frontend to interact with the program
2. ✅ Create markets (if whitelisted or whitelist disabled)
3. ✅ Trade on markets
4. ✅ Add/remove liquidity
5. ✅ Update configuration (using admin functions)

## Updating Configuration

To update the configuration after initialization, you'll need to use admin functions:

```typescript
// Update fees
await program.methods
  .configureMarketFees({ swapFee: 40, lpFee: 25 })
  .accounts({ /* ... */ })
  .rpc();

// Transfer authority
await program.methods
  .nominateNewAuthority(newAuthorityPubkey)
  .accounts({ /* ... */ })
  .rpc();

// Toggle whitelist
await program.methods
  .toggleWhitelist()
  .accounts({ /* ... */ })
  .rpc();
```

See the contract README for all admin functions.

## Security Notes

- ⚠️ Keep your authority keypair secure
- ⚠️ Test on devnet before mainnet
- ⚠️ Verify all configuration parameters before initializing
- ⚠️ Consider using a multisig for mainnet authority

## Support

- Contract README: `/contract/README.md`
- Deploy Guide: `/contract/DEPLOY_GUIDE.md`
- Frontend Guide: `/x402-polymarket-frontend/PROGRAM_INITIALIZATION.md`
