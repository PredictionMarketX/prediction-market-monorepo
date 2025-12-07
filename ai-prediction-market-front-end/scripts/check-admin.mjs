#!/usr/bin/env node

import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = 'CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM';

// Seeds from contract
const CONFIG_SEED = 'config';
const WHITELIST_SEED = 'wl-seed';

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);

  console.log('Program ID:', PROGRAM_ID);
  console.log('RPC:', RPC_URL);
  console.log('');

  // 1. Find and fetch Config PDA to get authority
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId
  );

  console.log('=== CONFIG PDA ===');
  console.log('Address:', configPDA.toBase58());

  try {
    const configAccount = await connection.getAccountInfo(configPDA);
    if (configAccount) {
      console.log('Config account exists!');
      console.log('Data length:', configAccount.data.length, 'bytes');

      // The authority is typically at offset 8 (after discriminator) and is 32 bytes
      // Let's try to extract it
      if (configAccount.data.length >= 40) {
        const authorityBytes = configAccount.data.slice(8, 40);
        const authority = new PublicKey(authorityBytes);
        console.log('Authority (Admin):', authority.toBase58());
      }
    } else {
      console.log('Config account does NOT exist (protocol not initialized)');
    }
  } catch (error) {
    console.log('Error fetching config:', error.message);
  }

  console.log('');
  console.log('=== WHITELIST ACCOUNTS ===');

  // 2. Find all accounts owned by the program with whitelist discriminator
  try {
    // Get all program accounts
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        { dataSize: 40 }, // Whitelist account is 8 (discriminator) + 32 (pubkey) = 40 bytes
      ],
    });

    if (accounts.length === 0) {
      console.log('No whitelist accounts found');
    } else {
      console.log(`Found ${accounts.length} potential whitelist account(s):`);

      for (const { pubkey, account } of accounts) {
        // Extract the creator pubkey from the whitelist account
        if (account.data.length >= 40) {
          const creatorBytes = account.data.slice(8, 40);
          const creator = new PublicKey(creatorBytes);

          // Verify this is indeed a whitelist PDA by checking seeds
          const [expectedPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from(WHITELIST_SEED), creator.toBytes()],
            programId
          );

          if (expectedPDA.equals(pubkey)) {
            console.log('  - Whitelisted:', creator.toBase58());
          }
        }
      }
    }
  } catch (error) {
    console.log('Error fetching whitelist accounts:', error.message);
  }
}

main().catch(console.error);
