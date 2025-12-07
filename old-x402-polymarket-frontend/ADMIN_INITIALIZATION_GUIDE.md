# Admin Panel - Program Initialization Guide

## Quick Start

1. **Navigate to**: http://localhost:3000/admin
2. **Connect your Solana wallet** (must be program authority)
3. **Fill out the configuration form**
4. **Click "Initialize Program"**
5. **Approve the transaction** in your wallet

That's it! The program will be initialized and ready to use.

## Access

The admin page is accessible from the header navigation:
- **Home** → **Markets** → **Portfolio** → **Admin** (purple link)

Or directly: `/admin`

## Features

### 1. Automatic Config Check
- ✅ Automatically checks if program is already initialized
- ✅ Shows current config status
- ✅ Prevents re-initialization

### 2. Smart Defaults
- Team wallet defaults to your connected wallet
- Recommended fee percentages (0.3% swap, 0.2% LP)
- USDC decimals (6) pre-configured
- Sensible token supply and reserve values

### 3. Real-time Feedback
- Success messages with transaction signatures
- Error messages with details
- Loading states during transaction
- Program logs in console

### 4. Configuration Preview
- See your configuration before submitting
- All parameters clearly labeled
- Percentage calculations shown

## Configuration Parameters

### Team Wallet (Required)
- **Purpose**: Receives trading fees
- **Default**: Your connected wallet
- **Can be changed**: Yes, enter any valid Solana address

### Swap Fee (Required)
- **Purpose**: Fee charged on each token swap
- **Unit**: Basis points (100 bp = 1%)
- **Default**: 30 bp (0.3%)
- **Range**: 0 - 10000 bp (0% - 100%)
- **Recommended**: 20-50 bp (0.2% - 0.5%)

### LP Fee (Required)
- **Purpose**: Fee paid to liquidity providers
- **Unit**: Basis points
- **Default**: 20 bp (0.2%)
- **Range**: 0 - 10000 bp
- **Recommended**: 10-30 bp (0.1% - 0.3%)

### Token Decimals (Required)
- **Purpose**: Precision for YES/NO tokens
- **Default**: 6 (matches USDC)
- **Range**: 0 - 9
- **Important**: Must match USDC decimals (6)

### Token Supply (Required)
- **Purpose**: Maximum token supply
- **Unit**: USDC (will be converted to smallest units)
- **Default**: 1,000,000 USDC
- **Note**: This is a configuration parameter, not actual supply

### Initial Reserves (Required)
- **Purpose**: Initial liquidity reserves
- **Unit**: USDC
- **Default**: 500 USDC
- **Note**: Configuration for market creation

### Whitelist Enabled (Optional)
- **Purpose**: Control who can create markets
- **Default**: false (anyone can create)
- **Options**:
  - ✅ Enabled: Only whitelisted addresses can create markets
  - ❌ Disabled: Anyone can create markets

## Form Example

```
Team Wallet Address: 2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr
Swap Fee: 30 bp (0.3%)
LP Fee: 20 bp (0.2%)
Token Decimals: 6
Token Supply: 1000000 USDC
Initial Reserves: 500 USDC
☐ Enable Creator Whitelist
```

## What Happens During Initialization?

1. **Validation**: Checks all parameters are valid
2. **PDA Derivation**: Computes config and vault addresses
3. **ATA Creation**: Creates global vault USDC account
4. **Configure Call**: Invokes the `configure` instruction
5. **Transaction**: Sends transaction to Solana
6. **Confirmation**: Waits for confirmation
7. **Success**: Displays success message with tx signature

## After Initialization

Once initialized, you can:

✅ **View Markets**: Navigate to `/markets`
✅ **Create Markets**: Use the "Create Market" button (if whitelisted or whitelist disabled)
✅ **Trade**: Buy/sell YES or NO tokens
✅ **Add Liquidity**: Provide USDC to earn fees
✅ **Manage**: Use admin functions to update config

## Already Initialized?

If the program is already initialized, you'll see:
- ⚠️ Yellow warning banner
- "Already Initialized" status
- Disabled initialize button

To update the configuration:
- Use admin update functions (coming soon)
- Or re-deploy the program (devnet only)

## Troubleshooting

### Error: "Please connect your wallet"
**Solution**: Click the wallet button in header and connect your Solana wallet

### Error: "Account does not exist"
**Cause**: Trying to fetch config before initialization
**Solution**: This is expected - just initialize the program

### Error: "Invalid team wallet address"
**Solution**: Enter a valid Solana public key (base58 encoded, 32-44 characters)

### Error: "Transaction failed"
**Possible causes**:
1. Insufficient SOL for transaction fees
   - **Solution**: Get devnet SOL from https://faucet.solana.com
2. Wrong authority
   - **Solution**: Ensure you're using the program authority wallet
3. Network issues
   - **Solution**: Check your RPC connection, try again

### Error: "Already initialized"
**Cause**: Program has already been configured
**Solution**: This is not an error - program is ready to use!

## Security Notes

### Authority Control
- Only the program authority can initialize
- Authority is set to your connected wallet
- Keep your authority keypair secure

### Fee Configuration
- Fees are immutable after initialization (on current version)
- Test with reasonable fees first
- Too high fees will discourage trading

### Whitelist Setting
- Can be toggled later by admin
- Consider starting with whitelist disabled for testing
- Enable whitelist for production if needed

## Verification

After initialization, verify:

```bash
# Check config account exists
solana account G2GawQFgqmFVWekqSwKCmfMkHhDscHkQ818e5JRNosqd --url devnet

# View transaction on explorer
https://explorer.solana.com/tx/YOUR_TX_SIGNATURE?cluster=devnet
```

Or in the frontend:
- Navigate to `/markets` - should load without errors
- Check browser console - should show "Config exists"
- Try creating a market (if whitelisted)

## Network Information

**Current Network**: Solana Devnet
**USDC Mint**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
**Program ID**: `78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR`
**Config PDA**: `G2GawQFgqmFVWekqSwKCmfMkHhDscHkQ818e5JRNosqd`

## Support

- **Frontend Guide**: `./PREDICTION_MARKET_INTEGRATION.md`
- **Contract Docs**: `../contract/README.md`
- **Deployment**: `./DEPLOYMENT_CONFIG.md`

## Advanced: Manual Initialization

If you prefer to initialize via CLI instead of the web UI, see:
- `../contract/scripts/initialize-program.ts`
- `../contract/scripts/README.md`
