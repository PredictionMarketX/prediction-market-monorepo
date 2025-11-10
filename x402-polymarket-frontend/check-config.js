#!/usr/bin/env node

const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const idl = require('./app/lib/solana/prediction_market.json');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const programId = new PublicKey('CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM');

// Create a dummy wallet for read-only operations
const dummyKeypair = { publicKey: PublicKey.default, secretKey: new Uint8Array(64) };
const provider = new AnchorProvider(connection, new Wallet(dummyKeypair), { commitment: 'confirmed' });
const program = new Program(idl, provider);

const [configPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('config')],
  programId
);

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║         PREDICTION MARKET CONFIG CHECKER                      ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Config PDA:', configPDA.toBase58());
console.log('Program ID:', programId.toBase58());
console.log('Network: Devnet');
console.log('');
console.log('Fetching configuration...');
console.log('');

program.account.config.fetch(configPDA).then(config => {
  console.log('✅ Configuration Found!');
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    GLOBAL CONFIG                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('📋 Basic Info:');
  console.log('  Authority:', config.authority.toBase58());
  console.log('  Team Wallet:', config.teamWallet.toBase58());
  console.log('  USDC Mint:', config.usdcMint.toBase58());
  console.log('  Initialized:', config.initialized);
  console.log('  Paused:', config.isPaused);
  console.log('');

  console.log('💰 Fees:');
  console.log('  Platform Buy Fee:', config.platformBuyFee, 'bps', `(${config.platformBuyFee / 100}%)`);
  console.log('  Platform Sell Fee:', config.platformSellFee, 'bps', `(${config.platformSellFee / 100}%)`);
  console.log('  LP Buy Fee:', config.lpBuyFee, 'bps', `(${config.lpBuyFee / 100}%)`);
  console.log('  LP Sell Fee:', config.lpSellFee, 'bps', `(${config.lpSellFee / 100}%)`);
  console.log('');

  console.log('🔒 Liquidity Requirements:');
  const minUsdcRaw = config.minUsdcLiquidity?.toString() || '0';
  const minUsdcAmount = Number(minUsdcRaw) / 1_000_000;
  console.log('  Min USDC Liquidity (raw):', minUsdcRaw);
  console.log('  Min USDC Liquidity (USDC):', minUsdcAmount);
  console.log('  Min Trading Liquidity:', config.minTradingLiquidity?.toString() || '0');
  console.log('');

  console.log('🎯 Token Config:');
  console.log('  Token Decimals:', config.tokenDecimalsConfig);
  console.log('  Token Supply:', config.tokenSupplyConfig?.toString() || '0');
  console.log('  Initial Reserves:', config.initialRealTokenReservesConfig?.toString() || '0');
  console.log('');

  console.log('🛡️  Insurance Pool:');
  console.log('  Enabled:', config.insurancePoolEnabled);
  console.log('  Balance:', config.lpInsurancePoolBalance?.toString() || '0');
  console.log('  Allocation:', config.lpInsuranceAllocationBps, 'bps', `(${config.lpInsuranceAllocationBps / 100}%)`);
  console.log('  Loss Threshold:', config.insuranceLossThresholdBps, 'bps', `(${config.insuranceLossThresholdBps / 100}%)`);
  console.log('  Max Compensation:', config.insuranceMaxCompensationBps, 'bps', `(${config.insuranceMaxCompensationBps / 100}%)`);
  console.log('');

  console.log('👥 Whitelist:');
  console.log('  Enabled:', config.whitelistEnabled);
  console.log('');

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    VERIFICATION                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (minUsdcAmount === 10) {
    console.log('✅ Min Liquidity is correctly set to 10 USDC');
  } else if (minUsdcAmount === 100) {
    console.log('⚠️  Min Liquidity is still 100 USDC (needs to be updated to 10)');
  } else {
    console.log('❓ Min Liquidity is set to', minUsdcAmount, 'USDC');
  }
  console.log('');

}).catch(err => {
  console.error('❌ Error fetching config:', err.message);
  process.exit(1);
});
