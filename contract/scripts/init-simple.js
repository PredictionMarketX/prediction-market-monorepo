/**
 * 简单的初始化脚本 - 使用 JavaScript
 */

const anchor = require('@coral-xyz/anchor');
const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey('78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR');
const USDC_MINT_DEVNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

async function initialize() {
  console.log('🚀 初始化预测市场程序...\n');

  // 加载钱包
  const walletPath = path.join(process.env.HOME, '.config/solana/id.json');
  console.log(`📂 加载钱包: ${walletPath}`);
  
  if (!fs.existsSync(walletPath)) {
    throw new Error(`钱包文件不存在: ${walletPath}`);
  }

  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  console.log(`🔑 钱包地址: ${keypair.publicKey.toBase58()}\n`);

  // 创建连接
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // 加载 IDL
  const idlPath = path.join(__dirname, '../target/idl/prediction_market.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // 计算 PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  const [globalVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PROGRAM_ID
  );

  console.log('📋 PDA 地址:');
  console.log(`   Config: ${configPDA.toBase58()}`);
  console.log(`   Global Vault: ${globalVaultPDA.toBase58()}\n`);

  // 检查配置是否已存在
  try {
    const existingConfig = await program.account.config.fetch(configPDA);
    console.log('⚠️  配置已存在！');
    console.log(`   Admin: ${existingConfig.authority.toBase58()}`);
    console.log(`   Team Wallet: ${existingConfig.teamWallet.toBase58()}`);
    console.log('\n✅ 无需重新初始化');
    return;
  } catch (err) {
    console.log('✅ 配置不存在，开始初始化...\n');
  }

  // 获取 Global Vault USDC ATA
  const globalVaultUsdcAta = await anchor.utils.token.associatedAddress({
    mint: USDC_MINT_DEVNET,
    owner: globalVaultPDA,
  });

  console.log(`💰 Global Vault USDC ATA: ${globalVaultUsdcAta.toBase58()}\n`);

  // 检查余额
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`💵 SOL 余额: ${balance / 1e9} SOL\n`);

  if (balance < 0.1 * 1e9) {
    console.log('⚠️  余额不足！请先获取 SOL:');
    console.log('   solana airdrop 2 --url devnet\n');
    return;
  }

  // 准备配置参数
  const configParams = {
    authority: keypair.publicKey,
    pendingAuthority: PublicKey.default,
    teamWallet: keypair.publicKey,
    platformBuyFee: new anchor.BN(30),
    platformSellFee: new anchor.BN(30),
    lpBuyFee: new anchor.BN(20),
    lpSellFee: new anchor.BN(20),
    tokenSupplyConfig: new anchor.BN(1_000_000_000_000),
    tokenDecimalsConfig: 6,
    initialRealTokenReservesConfig: new anchor.BN(500_000_000),
    minSolLiquidity: new anchor.BN(5_000_000_000),
    minTradingLiquidity: new anchor.BN(100_000_000),
    initialized: false,
    isPaused: false,
    whitelistEnabled: false,
    usdcMint: USDC_MINT_DEVNET,
    usdcVaultMinBalance: new anchor.BN(1_000_000),
    minUsdcLiquidity: new anchor.BN(100_000_000),
    lpInsurancePoolBalance: new anchor.BN(0),
    lpInsuranceAllocationBps: 2000,
    insuranceLossThresholdBps: 1000,
    insuranceMaxCompensationBps: 5000,
    insurancePoolEnabled: false,
  };

  console.log('📤 发送交易...\n');

  try {
    const tx = await program.methods
      .configure(configParams)
      .accounts({
        payer: keypair.publicKey,
        config: configPDA,
        globalVault: globalVaultPDA,
        globalVaultUsdcAta,
        usdcMint: USDC_MINT_DEVNET,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log('✅ 初始化成功！');
    console.log(`   交易签名: ${tx}`);
    console.log(`   浏览器: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // 验证配置
    const config = await program.account.config.fetch(configPDA);
    console.log('🎉 配置已创建！');
    console.log(`   Admin: ${config.authority.toBase58()}`);
    console.log(`   Team Wallet: ${config.teamWallet.toBase58()}`);
    console.log(`   Token Decimals: ${config.tokenDecimalsConfig}`);
    console.log(`   Whitelist Enabled: ${config.whitelistEnabled}\n`);

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    if (error.logs) {
      console.error('\n程序日志:');
      error.logs.forEach(log => console.error('  ', log));
    }
    throw error;
  }
}

initialize()
  .then(() => {
    console.log('✨ 完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 错误:', error);
    process.exit(1);
  });
