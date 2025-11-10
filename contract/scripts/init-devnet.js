const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair } = require("@solana/web3.js");
const fs = require("fs");

async function main() {
  console.log("🚀 初始化 Devnet 配置...\n");

  // 设置 devnet 连接
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  
  // 读取本地密钥
  const keypairPath = "/Users/alanluo/.config/solana/id.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  console.log("📍 使用钱包:", wallet.publicKey.toString());
  
  // 检查余额
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("💰 余额:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL\n");

  // 设置 Provider
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // 加载程序 - 使用 devnet 程序 ID
  const programId = new PublicKey("CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM");
  
  // 加载 IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/prediction_market.json", "utf-8"));
  const program = new anchor.Program(idl, programId, provider);

  console.log("📋 程序 ID:", programId.toString());

  // 查找配置 PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("🔑 配置 PDA:", configPda.toString());

  // 检查配置是否已存在
  try {
    const configAccount = await program.account.config.fetch(configPda);
    console.log("\n✅ 配置已存在！");
    console.log("Authority:", configAccount.authority.toString());
    console.log("Team Wallet:", configAccount.teamWallet.toString());
    console.log("Platform Buy Fee:", configAccount.platformBuyFee.toString(), "bps");
    console.log("USDC Mint:", configAccount.usdcMint.toString());
    return;
  } catch (err) {
    console.log("\n⚠️  配置不存在，开始初始化...\n");
  }

  // 初始化配置
  try {
    // Devnet USDC mint (官方测试代币)
    // 如果没有官方的，我们使用一个占位符，后续可以更新
    const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet USDC
    
    // 创建配置对象 - 必须匹配Config结构体
    const newConfig = {
      authority: wallet.publicKey,
      pendingAuthority: anchor.web3.PublicKey.default,
      teamWallet: wallet.publicKey,
      platformBuyFee: new anchor.BN(100),  // 1% (100 bps)
      platformSellFee: new anchor.BN(100),  // 1%
      lpBuyFee: new anchor.BN(50),  // 0.5%
      lpSellFee: new anchor.BN(50),  // 0.5%
      tokenSupplyConfig: new anchor.BN(10000000000),  // 10000 USDC (必须 >= initial_real_token_reserves_config)
      tokenDecimalsConfig: 6,  // USDC精度，必须是6
      initialRealTokenReservesConfig: new anchor.BN(1000000000),  // 1000 USDC (LMSR b参数)
      minSolLiquidity: new anchor.BN(0),  // 废弃字段
      minTradingLiquidity: new anchor.BN(1000000000),  // 1000 USDC
      initialized: true,
      isPaused: false,
      whitelistEnabled: false,
      usdcMint: usdcMint,
      usdcVaultMinBalance: new anchor.BN(5000),  // 0.005 USDC
      minUsdcLiquidity: new anchor.BN(10000000),  // 10 USDC
      lpInsurancePoolBalance: new anchor.BN(0),
      lpInsuranceAllocationBps: 2000,  // 20%
      insuranceLossThresholdBps: 1000,  // 10%
      insuranceMaxCompensationBps: 5000,  // 50%
      insurancePoolEnabled: false  // 初期禁用
    };

    console.log("📝 配置参数:");
    console.log("  - Authority:", newConfig.authority.toString());
    console.log("  - Team Wallet:", newConfig.teamWallet.toString());
    console.log("  - Platform Buy Fee:", newConfig.platformBuyFee.toString(), "bps");
    console.log("  - Platform Sell Fee:", newConfig.platformSellFee.toString(), "bps");
    console.log("  - Token Decimals:", newConfig.tokenDecimalsConfig);
    console.log("  - USDC Mint:", newConfig.usdcMint.toString());
    console.log("  - Initial Reserves:", newConfig.initialRealTokenReservesConfig.toString());
    console.log("\n开始交易...\n");

    const tx = await program.methods
      .configure(newConfig)
      .accounts({
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ 初始化成功！");
    console.log("📝 交易签名:", tx);
    console.log("🔗 查看交易: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
    console.log("\n等待确认...");
    
    await connection.confirmTransaction(tx, "confirmed");
    
    // 验证配置
    const configAccount = await program.account.config.fetch(configPda);
    console.log("\n✅ 配置验证成功！");
    console.log("Authority:", configAccount.authority.toString());
    console.log("Team Wallet:", configAccount.teamWallet.toString());
    console.log("Platform Buy Fee:", configAccount.platformBuyFee.toString(), "bps");
    console.log("Platform Sell Fee:", configAccount.platformSellFee.toString(), "bps");
    console.log("Token Decimals:", configAccount.tokenDecimalsConfig);
    console.log("USDC Mint:", configAccount.usdcMint.toString());
    console.log("Paused:", configAccount.isPaused);
    
  } catch (err) {
    console.error("\n❌ 初始化失败:", err);
    if (err.logs) {
      console.error("\n程序日志:");
      err.logs.forEach(log => console.error(log));
    }
    throw err;
  }
}

main()
  .then(() => {
    console.log("\n🎉 完成！");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
