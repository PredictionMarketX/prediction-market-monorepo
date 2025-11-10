const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } = require("@solana/spl-token");
const fs = require("fs");

async function main() {
  console.log("🧪 开始测试预测市场完整流程\n");
  console.log("=" .repeat(60));

  // 设置连接
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  
  // 读取钱包
  const keypairPath = "/Users/alanluo/.config/solana/id.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  console.log("📍 测试钱包:", payer.publicKey.toString());
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log("💰 余额:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL\n");

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
  console.log("🔑 配置 PDA:", configPda.toString());

  try {
    const config = await program.account.config.fetch(configPda);
    console.log("✅ 配置已加载");
    console.log("   USDC Mint:", config.usdcMint.toString());
    console.log("   Platform Fee:", config.platformBuyFee.toString(), "bps\n");

    // ============================================================
    // 步骤 1: 创建测试 USDC 并铸造
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 1: 准备测试 USDC");
    console.log("=" .repeat(60));

    // 使用配置中的 USDC mint
    const usdcMint = config.usdcMint;
    console.log("USDC Mint:", usdcMint.toString());

    // 创建用户的 USDC 账户
    let userUsdcAccount;
    try {
      // 尝试获取现有账户
      const accounts = await connection.getTokenAccountsByOwner(
        payer.publicKey,
        { mint: usdcMint }
      );
      
      if (accounts.value.length > 0) {
        userUsdcAccount = accounts.value[0].pubkey;
        console.log("✅ 使用现有 USDC 账户:", userUsdcAccount.toString());
      } else {
        console.log("⚠️  未找到 USDC 账户，需要创建");
        console.log("   请先获取 devnet USDC: https://faucet.circle.com/");
        console.log("   或使用本地测试 mint");
        return;
      }

      const accountInfo = await getAccount(connection, userUsdcAccount);
      console.log("💰 USDC 余额:", accountInfo.amount.toString(), "最小单位");
      console.log("   (约", Number(accountInfo.amount) / 1_000_000, "USDC)\n");

      if (accountInfo.amount < 1000_000_000) {
        console.log("⚠️  USDC 余额不足，建议至少 1000 USDC 用于测试");
        console.log("   继续测试但可能失败...\n");
      }
    } catch (err) {
      console.error("❌ 获取 USDC 账户失败:", err.message);
      console.log("\n💡 提示: 请先获取 devnet USDC");
      console.log("   1. 访问: https://faucet.circle.com/");
      console.log("   2. 选择 Solana Devnet");
      console.log("   3. 输入地址:", payer.publicKey.toString());
      return;
    }

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

    console.log("   Market Vault:", marketVault.toString());
    console.log("   YES Token Mint:", yesTokenMint.toString());
    console.log("   NO Token Mint:", noTokenMint.toString());

    const now = Math.floor(Date.now() / 1000);
    const resolutionTime = new anchor.BN(now + 7 * 24 * 3600); // 7天后

    try {
      const tx1 = await program.methods
        .createMarket(
          "测试市场：BTC价格会超过10万美元吗？",
          "BTC-100K",
          resolutionTime,
          new anchor.BN(1000_000_000) // 1000 USDC LMSR b参数
        )
        .accounts({
          market: marketId,
          creator: payer.publicKey,
          globalConfig: configPda,
          usdcMint: usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([marketKeypair])
        .rpc();

      console.log("✅ 市场创建成功!");
      console.log("   交易:", tx1);
      console.log("   🔗 查看: https://explorer.solana.com/tx/" + tx1 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx1, "confirmed");
    } catch (err) {
      console.error("❌ 创建市场失败:", err);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.forEach(log => console.error(log));
      }
      return;
    }

    // ============================================================
    // 步骤 3: 添加流动性
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 3: 添加流动性");
    console.log("=" .repeat(60));

    const lpAmount = new anchor.BN(500_000_000); // 500 USDC
    console.log("💧 添加流动性:", lpAmount.toString(), "最小单位 (500 USDC)");

    // 查找 LP token mint
    const [lpTokenMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_token"), marketId.toBuffer()],
      program.programId
    );

    // 创建用户的 LP token 账户
    const userLpTokenAccount = await createAccount(
      connection,
      payer,
      lpTokenMint,
      payer.publicKey
    );

    console.log("   LP Token Mint:", lpTokenMint.toString());
    console.log("   用户 LP 账户:", userLpTokenAccount.toString());

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
      console.log("   🔗 查看: https://explorer.solana.com/tx/" + tx2 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx2, "confirmed");

      // 检查 LP token 余额
      const lpAccount = await getAccount(connection, userLpTokenAccount);
      console.log("💰 获得 LP Token:", lpAccount.amount.toString(), "最小单位\n");
    } catch (err) {
      console.error("❌ 添加流动性失败:", err);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.forEach(log => console.error(log));
      }
      return;
    }

    // ============================================================
    // 步骤 4: 买入 YES token
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 4: 买入 YES Token");
    console.log("=" .repeat(60));

    const buyAmount = new anchor.BN(100_000_000); // 100 USDC
    console.log("💵 买入金额:", buyAmount.toString(), "最小单位 (100 USDC)");

    // 创建用户的 YES token 账户
    const userYesTokenAccount = await createAccount(
      connection,
      payer,
      yesTokenMint,
      payer.publicKey
    );

    console.log("   用户 YES 账户:", userYesTokenAccount.toString());

    try {
      const tx3 = await program.methods
        .swap(
          { yes: {} }, // 买入 YES
          buyAmount,
          new anchor.BN(1) // 最小输出 (滑点保护)
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
      console.log("   🔗 查看: https://explorer.solana.com/tx/" + tx3 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx3, "confirmed");

      // 检查 YES token 余额
      const yesAccount = await getAccount(connection, userYesTokenAccount);
      console.log("💰 获得 YES Token:", yesAccount.amount.toString(), "最小单位\n");
    } catch (err) {
      console.error("❌ 买入 YES Token 失败:", err);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.forEach(log => console.error(log));
      }
      return;
    }

    // ============================================================
    // 步骤 5: 买入 NO token
    // ============================================================
    console.log("=" .repeat(60));
    console.log("📝 步骤 5: 买入 NO Token");
    console.log("=" .repeat(60));

    // 创建用户的 NO token 账户
    const userNoTokenAccount = await createAccount(
      connection,
      payer,
      noTokenMint,
      payer.publicKey
    );

    console.log("   用户 NO 账户:", userNoTokenAccount.toString());

    try {
      const tx4 = await program.methods
        .swap(
          { no: {} }, // 买入 NO
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
      console.log("   🔗 查看: https://explorer.solana.com/tx/" + tx4 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx4, "confirmed");

      const noAccount = await getAccount(connection, userNoTokenAccount);
      console.log("💰 获得 NO Token:", noAccount.amount.toString(), "最小单位\n");
    } catch (err) {
      console.error("❌ 买入 NO Token 失败:", err);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.forEach(log => console.error(log));
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
      const sellAmount = new anchor.BN(yesAccount.amount / 2n); // 卖出一半
      
      console.log("💵 卖出数量:", sellAmount.toString(), "YES Token");

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
      console.log("   🔗 查看: https://explorer.solana.com/tx/" + tx5 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx5, "confirmed");
    } catch (err) {
      console.error("❌ 卖出 YES Token 失败:", err);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.forEach(log => console.error(log));
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
      const removeLpAmount = new anchor.BN(lpAccount.amount / 2n); // 移除一半
      
      console.log("💧 移除 LP Token:", removeLpAmount.toString());

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
      console.log("   🔗 查看: https://explorer.solana.com/tx/" + tx6 + "?cluster=devnet\n");

      await connection.confirmTransaction(tx6, "confirmed");
    } catch (err) {
      console.error("❌ 移除流动性失败:", err);
      if (err.logs) {
        console.error("\n程序日志:");
        err.logs.forEach(log => console.error(log));
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
      console.log("  总流动性:", market.totalLiquidity.toString(), "USDC");
      console.log("  YES 供应:", market.yesTokenSupply.toString());
      console.log("  NO 供应:", market.noTokenSupply.toString());
      console.log("  状态:", market.resolved ? "已结算" : "进行中");

      const usdcAcc = await getAccount(connection, userUsdcAccount);
      const yesAcc = await getAccount(connection, userYesTokenAccount);
      const noAcc = await getAccount(connection, userNoTokenAccount);
      const lpAcc = await getAccount(connection, userLpTokenAccount);

      console.log("\n用户余额:");
      console.log("  USDC:", usdcAcc.amount.toString(), "(", Number(usdcAcc.amount) / 1_000_000, "USDC)");
      console.log("  YES Token:", yesAcc.amount.toString());
      console.log("  NO Token:", noAcc.amount.toString());
      console.log("  LP Token:", lpAcc.amount.toString());

      console.log("\n🔗 市场浏览器链接:");
      console.log("   https://explorer.solana.com/address/" + marketId.toString() + "?cluster=devnet");
    } catch (err) {
      console.error("获取最终状态失败:", err.message);
    }

    console.log("\n" + "=" .repeat(60));
    console.log("🎉 测试完成！");
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
    console.error("\n❌ 测试失败:", err);
    process.exit(1);
  });
