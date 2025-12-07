# Program ID Update

## Change Summary

Updated the Solana Prediction Market program ID to the new deployment.

### Old Program ID
```
78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR
```

### New Program ID
```
CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
```

---

## Files Updated

### 1. `/app/lib/solana/program.ts`
**Line 10**: Updated `PROGRAM_CONFIG.programId`

```typescript
export const PROGRAM_CONFIG = {
  programId: new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM'), // ✅ Updated
  programDataAddress: new PublicKey('3jbSDdUupCHdM3ygqRDy3FfavndnNPay9bSad4voZVpq'), // TODO: Update if changed
  authority: new PublicKey('2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr'),
  network: 'devnet' as const,
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
};
```

### 2. `/app/lib/solana/prediction_market.json`
**Line 2**: Updated IDL address field

```json
{
  "address": "CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM", // ✅ Updated
  "metadata": {
    "name": "prediction_market",
    "version": "1.1.1",
    ...
  }
}
```

---

## What This Changes

### PDAs (Program Derived Addresses)
All PDAs will be derived from the new program ID. This means:

- ✅ **Config PDA**: New address (will need re-initialization)
- ✅ **Global Vault PDA**: New address
- ✅ **Market PDAs**: New addresses
- ✅ **User Info PDAs**: New addresses
- ✅ **LP Position PDAs**: New addresses

**Important**: Since the program ID changed, all PDAs are different. This means:
1. Previous initialization data is on the old program
2. You'll need to **re-initialize** the program at `/admin`
3. All previous markets, positions, and liquidity are on the old program

---

## Action Items

### 1. Update Program Data Address (Optional but Recommended)

If the program was upgraded (not a fresh deployment), you may need to update the `programDataAddress`:

```bash
# Check the program data address
solana program show CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM --url devnet

# Look for "ProgramData Address" in the output
# Then update line 11 in /app/lib/solana/program.ts
```

### 2. Re-Initialize the Program

Since this is a new program ID, you need to initialize it:

1. Navigate to `http://localhost:3001/admin` (or 3000)
2. Connect your wallet (must be authority: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`)
3. Fill out the initialization form
4. Click "Initialize Program"

**New Config PDA**: Will be derived from new program ID using seed `[b"config"]`

### 3. Verify Integration

After initialization, test:
- ✅ Config loads correctly
- ✅ Can create markets
- ✅ Can add liquidity
- ✅ Can trade (swap)
- ✅ Can mint/redeem complete sets

---

## Technical Details

### PDA Derivation
All PDAs use the program ID as the base:

```typescript
PublicKey.findProgramAddressSync(
  [seed, ...otherSeeds],
  PROGRAM_CONFIG.programId  // ← This changed
)
```

**Example - Config PDA**:
```
Old: findPDA([b"config"], 78LNFkZn...) = G2GawQFgq...
New: findPDA([b"config"], CzddKJkrk...) = <different address>
```

### Migration Notes

**If you had data on the old program**:
- Old data remains accessible at the old program ID
- To migrate, you would need to:
  1. Read state from old program
  2. Initialize new program
  3. Recreate markets on new program
  4. Notify users to withdraw from old markets

**If this is a fresh start**:
- No migration needed
- Just initialize and use the new program

---

## Verification Commands

### Check Program Exists
```bash
solana program show CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM --url devnet
```

### Expected Output
```
Program Id: CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: <some-address>
Authority: 2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr
Last Deployed In Slot: <slot-number>
Data Length: <bytes>
```

### Check Config PDA (After Initialization)
```bash
# Derive config PDA (use Solana CLI or web3.js)
# Then check it exists:
solana account <config-pda> --url devnet
```

---

## Summary

✅ **Program ID Updated**: `CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM`
✅ **Files Updated**: 2 files (`program.ts`, `prediction_market.json`)
⚠️ **Re-initialization Required**: All PDAs are new
⚠️ **TODO**: Update `programDataAddress` if needed

**Status**: Ready for initialization at `/admin`

---

**Date**: 2025-01-09
**Updated By**: Claude Code
