const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount, getMint } = require("@solana/spl-token");
const fs = require("fs");

async function main() {
  console.log("🧪 开始测试预测市场完整流程 (使用测试USDC)\n");
  console.log("=" .repeat(60));

  // 设置连接
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  
  // 读取钱包
  const keypairPath = "/Users/alanluo/.config/solana/id.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  console.log("📍 测试钱包:", payer.publicKey.toString());
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log("💰 SOL 余额:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL\n");

  // 设置 Provider
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // 加载程序
  const program = anchor.workspace.PredictionMarket;
  console.log("📋 程序 ID:", program.programId.toString());

  // 获取配置
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  try {
    const config = await program.account.config.fetch(configPda);
    console.log("✅ 配置已加载");
    
    // ============================================================
    // 步骤 1: 创建测试 USDC 并铸造
    // ============================================================
    console.log("\n" + "=" .repeat(60));
    console.log("📝 步骤 1: 创建测试 USDC");
    console.log("=" .repeat(60));

    console.log("创建测试 USDC mint...");
    const usdcMint = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      6 // USDC 精度
    );
    console.log("✅ USDC Mint:", usdcMint.toString());

    // 创建用户的 USDC 账户并铸造
    const userUsdcAccount = await createAccount(
      connection,
      payer,
      usdcMint,
      payer.publicKey
    );
    console.log("✅ 用户 USDC 账户:", userUsdcAccount.toString());

    // 铸造 10000 USDC 用于测试
    await mintTo(
      connection,
      payer,
      usdcMint,
      userUsdcAccount,
      payer,
      10000_000_000 // 10000 USDC
    );
    console.log("✅ 铸造 10000 USDC 到用户账户\n");

    // ============================================================
    // 步骤 2: 创建市场
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 2: 创建预测市场");
    console.log("=" .repeat(60));

    const marketKeypair = Keypair.generate();
    const marketId = marketKeypair.publicKey;
    console.log("🆕 市场 ID:", marketId.toString());

    // 查找市场相关 PDA
    const [marketVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("market_vault"), marketId.toBuffer()],
      program.programId
    );

    const [yesTokenMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("yes_token"), marketId.toBuffer()],
      program.programId
    );

    const [noTokenMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("no_token"), marketId.toBuffer()],
      program.programId
    );

    const [globalVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("global")],
      program.programId
    );

    // 创建 NO token mint
    console.log("创建 NO token mint...");
    const noMintKeypair = Keypair.generate();
    const createNoMintTx = await program.methods
      .mintNoToken()
      .accounts({
        market: marketId,
        noToken: noMintKeypair.publicKey,
        globalVault: globalVault,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([noMintKeypair])
      .rpc();
    
    console.log("✅ NO token mint 创建:", noMintKeypair.publicKey.toString());
    await connection.confirmTransaction(createNoMintTx, "confirmed");

    const now = Math.floor(Date.now() / 1000);
    const resolutionTime = new anchor.BN(now + 7 * 24 * 3600); // 7天后

    // 查找元数据账户
    const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    
    const [yesMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        yesTokenMint.toBuffer(),
      ],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );

    const [noMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        noMintKeypair.publicKey.toBuffer(),
      ],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );

    const [globalYesTokenAccount] = PublicKey.findProgramAddressSync(
      [
        globalVault.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        yesTokenMint.toBuffer(),
      ],
      new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL") // Associated Token Program
    );

    const [globalNoTokenAccount] = PublicKey.findProgramAddressSync(
      [
        globalVault.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        noMintKeypair.publicKey.toBuffer(),
      ],
      new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    );

    try {
      const tx1 = await program.methods
        .createMarket({
          description: "测试市场：BTC价格会超过10万美元吗？",
          displayName: "BTC-100K",
          resolutionTime: resolutionTime,
          lmsrBParameter: new anchor.BN(1000_000_000), // 1000 USDC
        })
        .accounts({
          globalConfig: configPda,
          globalVault: globalVault,
          creator: payer.publicKey,
          yesToken: yesTokenMint,
          noToken: noMintKeypair.publicKey,
          market: marketId,
          yesTokenMetadataAccount: yesMetadata,
          noTokenMetadataAccount: noMetadata,
          globalYesTokenAccount: globalYesTokenAccount,
          globalNoTokenAccount: globalNoTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
          mplTokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          teamWallet: config.teamWallet,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([marketKeypair])
        .rpc();

      console.log("✅ 市场创建成功!");
      console.log("   交易:", tx1);
      console.log("   🔗 https://explorer.solana.com/tx/" + tx1 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx1, "confirmed");
    } catch (err) {
      console.error("❌ 创建市场失败:", err.message);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.slice(-10).forEach(log => console.error(log));
      }
      throw err;
    }

    // ============================================================
    // 步骤 3: 添加流动性
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 3: 添加流动性");
    console.log("=" .repeat(60));

    const lpAmount = new anchor.BN(500_000_000); // 500 USDC
    console.log("💧 添加流动性: 500 USDC");

    const [lpTokenMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_token"), marketId.toBuffer()],
      program.programId
    );

    const userLpTokenAccount = await createAccount(
      connection,
      payer,
      lpTokenMint,
      payer.publicKey
    );

    try {
      const tx2 = await program.methods
        .addLiquidity(lpAmount)
        .accounts({
          market: marketId,
          liquidityProvider: payer.publicKey,
          lpTokenMint: lpTokenMint,
          lpTokenAccount: userLpTokenAccount,
          userUsdcAccount: userUsdcAccount,
          marketVault: marketVault,
          globalConfig: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("✅ 流动性添加成功!");
      console.log("   交易:", tx2);
      console.log("   🔗 https://explorer.solana.com/tx/" + tx2 + "?cluster=devnet");

      await connection.confirmTransaction(tx2, "confirmed");

      const lpAccount = await getAccount(connection, userLpTokenAccount);
      console.log("💰 获得 LP Token:", Number(lpAccount.amount) / 1_000_000, "LP\n");
    } catch (err) {
      console.error("❌ 添加流动性失败:", err.message);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.slice(-10).forEach(log => console.error(log));
      }
      throw err;
    }

    // ============================================================
    // 步骤 4: 买入 YES token
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 4: 买入 YES Token");
    console.log("=" .repeat(60));

    const buyAmount = new anchor.BN(100_000_000); // 100 USDC
    console.log("💵 买入金额: 100 USDC");

    const userYesTokenAccount = await createAccount(
      connection,
      payer,
      yesTokenMint,
      payer.publicKey
    );

    try {
      const tx3 = await program.methods
        .swap(
          { yes: {} },
          buyAmount,
          new anchor.BN(1)
        )
        .accounts({
          market: marketId,
          user: payer.publicKey,
          userUsdcAccount: userUsdcAccount,
          userTokenAccount: userYesTokenAccount,
          marketVault: marketVault,
          tokenMint: yesTokenMint,
          globalConfig: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("✅ 买入 YES Token 成功!");
      console.log("   交易:", tx3);
      console.log("   🔗 https://explorer.solana.com/tx/" + tx3 + "?cluster=devnet");

      await connection.confirmTransaction(tx3, "confirmed");

      const yesAccount = await getAccount(connection, userYesTokenAccount);
      console.log("💰 获得 YES Token:", Number(yesAccount.amount) / 1_000_000, "YES\n");
    } catch (err) {
      console.error("❌ 买入 YES Token 失败:", err.message);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.slice(-10).forEach(log => console.error(log));
      }
      throw err;
    }

    // ============================================================
    // 步骤 5: 买入 NO token
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 5: 买入 NO Token");
    console.log("=" .repeat(60));

    const userNoTokenAccount = await createAccount(
      connection,
      payer,
      noTokenMint,
      payer.publicKey
    );

    try {
      const tx4 = await program.methods
        .swap(
          { no: {} },
          buyAmount,
          new anchor.BN(1)
        )
        .accounts({
          market: marketId,
          user: payer.publicKey,
          userUsdcAccount: userUsdcAccount,
          userTokenAccount: userNoTokenAccount,
          marketVault: marketVault,
          tokenMint: noTokenMint,
          globalConfig: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("✅ 买入 NO Token 成功!");
      console.log("   交易:", tx4);
      console.log("   🔗 https://explorer.solana.com/tx/" + tx4 + "?cluster=devnet");

      await connection.confirmTransaction(tx4, "confirmed");

      const noAccount = await getAccount(connection, userNoTokenAccount);
      console.log("💰 获得 NO Token:", Number(noAccount.amount) / 1_000_000, "NO\n");
    } catch (err) {
      console.error("❌ 买入 NO Token 失败:", err.message);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.slice(-10).forEach(log => console.error(log));
      }
    }

    // ============================================================
    // 步骤 6: 卖出部分 YES token
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 6: 卖出 YES Token");
    console.log("=" .repeat(60));

    try {
      const yesAccount = await getAccount(connection, userYesTokenAccount);
      const sellAmount = new anchor.BN(Number(yesAccount.amount) / 2); // 卖出一半
      
      console.log("💵 卖出数量:", Number(sellAmount) / 1_000_000, "YES");

      const tx5 = await program.methods
        .swap(
          { yes: {} },
          sellAmount,
          new anchor.BN(1)
        )
        .accounts({
          market: marketId,
          user: payer.publicKey,
          userUsdcAccount: userUsdcAccount,
          userTokenAccount: userYesTokenAccount,
          marketVault: marketVault,
          tokenMint: yesTokenMint,
          globalConfig: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("✅ 卖出 YES Token 成功!");
      console.log("   交易:", tx5);
      console.log("   🔗 https://explorer.solana.com/tx/" + tx5 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx5, "confirmed");
    } catch (err) {
      console.error("❌ 卖出 YES Token 失败:", err.message);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.slice(-10).forEach(log => console.error(log));
      }
    }

    // ============================================================
    // 步骤 7: 移除流动性
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 7: 移除流动性");
    console.log("=" .repeat(60));

    try {
      const lpAccount = await getAccount(connection, userLpTokenAccount);
      const removeLpAmount = new anchor.BN(Number(lpAccount.amount) / 2); // 移除一半
      
      console.log("💧 移除 LP Token:", Number(removeLpAmount) / 1_000_000, "LP");

      const tx6 = await program.methods
        .removeLiquidity(removeLpAmount)
        .accounts({
          market: marketId,
          liquidityProvider: payer.publicKey,
          lpTokenMint: lpTokenMint,
          lpTokenAccount: userLpTokenAccount,
          userUsdcAccount: userUsdcAccount,
          marketVault: marketVault,
          globalConfig: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("✅ 流动性移除成功!");
      console.log("   交易:", tx6);
      console.log("   🔗 https://explorer.solana.com/tx/" + tx6 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx6, "confirmed");
    } catch (err) {
      console.error("❌ 移除流动性失败:", err.message);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.slice(-10).forEach(log => console.error(log));
      }
    }

    // ============================================================
    // 最终状态
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📊 最终状态");
    console.log("=" .repeat(60));

    try {
      const market = await program.account.market.fetch(marketId);
      console.log("\n市场信息:");
      console.log("  描述:", market.description);
      console.log("  总流动性:", Number(market.totalLiquidity) / 1_000_000, "USDC");
      console.log("  YES 供应:", Number(market.yesTokenSupply) / 1_000_000);
      console.log("  NO 供应:", Number(market.noTokenSupply) / 1_000_000);
      console.log("  状态:", market.resolved ? "已结算" : "进行中");

      const usdcAcc = await getAccount(connection, userUsdcAccount);
      const yesAcc = await getAccount(connection, userYesTokenAccount);
      const noAcc = await getAccount(connection, userNoTokenAccount);
      const lpAcc = await getAccount(connection, userLpTokenAccount);

      console.log("\n用户余额:");
      console.log("  USDC:", Number(usdcAcc.amount) / 1_000_000, "USDC");
      console.log("  YES Token:", Number(yesAcc.amount) / 1_000_000);
      console.log("  NO Token:", Number(noAcc.amount) / 1_000_000);
      console.log("  LP Token:", Number(lpAcc.amount) / 1_000_000);

      console.log("\n🔗 市场浏览器链接:");
      console.log("   https://explorer.solana.com/address/" + marketId.toString() + "?cluster=devnet");
    } catch (err) {
      console.error("获取最终状态失败:", err.message);
    }

    console.log("\n" + "=" .repeat(60));
    console.log("🎉 测试完成！所有功能正常");
    console.log("=" .repeat(60));

  } catch (err) {
    console.error("\n❌ 测试失败:", err);
    throw err;
  }
}

main()
  .then(() => {
    console.log("\n✅ 所有测试通过");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ 测试失败");
    process.exit(1);
  });
