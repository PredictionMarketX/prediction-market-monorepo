# 🚀 程序重新部署指南

## 📋 重要提示

由于我们修改了白名单种子常量（从 `"prediction_market_creator_whitelist"` 改为 `"wl-seed"`），**所有使用旧种子的 PDA 地址都会改变**。这意味着：

1. ✅ 程序已重新构建完成
2. ⚠️ 需要重新部署程序
3. ⚠️ 如果之前有白名单账户，需要重新创建（因为 PDA 地址不同）

---

## 🎯 部署选项

### 选项 1: 部署到本地测试网络 (Localnet) ⭐ 推荐用于开发测试

#### 前置条件
```bash
# 1. 确保本地 validator 正在运行
solana-test-validator

# 如果未运行，在另一个终端启动：
solana-test-validator --reset
```

#### 部署步骤

```bash
cd /Users/aricredemption/Projects/ploymarketX402/contract

# 1. 设置本地网络配置
solana config set --url localhost

# 2. 检查钱包余额（需要 SOL 支付租金）
solana balance -k keys/admin.json

# 3. 如果余额不足，空投一些 SOL
solana airdrop 10 -k keys/admin.json

# 4. 部署程序
anchor deploy

# 5. 验证部署
solana program show target/deploy/prediction_market-keypair.json
```

#### 验证部署成功

```bash
# 检查程序信息
solana program show $(solana address -k target/deploy/prediction_market-keypair.json)

# 应该看到：
# - Program Id: <程序地址>
# - Owner: BPFLoaderUpgradeab1e11111111111111111111111
# - Data: <数据大小>
```

---

### 选项 2: 部署到开发网络 (Devnet) ⭐ 推荐用于测试

#### 前置条件
```bash
# 1. 切换到 devnet
solana config set --url devnet

# 2. 检查钱包余额
solana balance -k keys/admin.json

# 3. 如果余额不足，从 devnet 水龙头获取
solana airdrop 2 -k keys/admin.json --url devnet
```

#### 部署步骤

```bash
cd /Users/aricredemption/Projects/ploymarketX402/contract

# 1. 更新 Anchor.toml 中的程序 ID（如果需要）
# 注意：如果之前已部署，程序 ID 应该保持不变

# 2. 部署到 devnet
anchor deploy --provider.cluster devnet

# 3. 验证部署
solana program show $(solana address -k target/deploy/prediction_market-keypair.json) --url devnet
```

#### 更新程序（如果已存在）

如果程序已经部署过，需要升级：

```bash
# 1. 获取程序 ID
PROGRAM_ID=$(solana address -k target/deploy/prediction_market-keypair.json)

# 2. 升级程序
anchor upgrade target/deploy/prediction_market.so --provider.cluster devnet --program-id $PROGRAM_ID
```

---

### 选项 3: 部署到主网 (Mainnet) ⚠️ 生产环境

**⚠️ 警告：主网部署需要谨慎，建议先在 devnet 充分测试**

```bash
# 1. 切换到 mainnet
solana config set --url mainnet-beta

# 2. 确认钱包有足够的 SOL（建议至少 5 SOL）
solana balance -k keys/admin.json

# 3. 部署（首次部署）
anchor deploy --provider.cluster mainnet-beta

# 或升级现有程序
anchor upgrade target/deploy/prediction_market.so --provider.cluster mainnet-beta --program-id <PROGRAM_ID>
```

---

## 🔧 部署后验证

### 1. 验证程序已部署

```bash
# 获取程序 ID
PROGRAM_ID=$(solana address -k target/deploy/prediction_market-keypair.json)

# 检查程序信息
solana program show $PROGRAM_ID --url <network>
```

### 2. 运行测试验证

```bash
# 运行测试套件验证程序功能
anchor test

# 或运行特定测试
anchor test --skip-build tests/amm-fund-model.test.ts
```

### 3. 验证白名单 PDA 地址

```bash
# 使用新的种子计算白名单 PDA
node -e "
const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const PROGRAM_ID = new PublicKey('$(solana address -k target/deploy/prediction_market-keypair.json)');
const [whitelistPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('wl-seed'), Buffer.alloc(32)],
  PROGRAM_ID
);
console.log('Whitelist PDA:', whitelistPDA.toString());
"
```

---

## 📝 常见问题

### Q1: 部署失败 - "Insufficient funds"

**解决方案**:
```bash
# 获取更多 SOL
solana airdrop 2 -k keys/admin.json --url <network>
```

### Q2: 部署失败 - "Program already deployed"

**解决方案**:
```bash
# 使用 upgrade 命令而不是 deploy
anchor upgrade target/deploy/prediction_market.so --provider.cluster <network> --program-id <PROGRAM_ID>
```

### Q3: 如何确认使用的是新种子？

**验证方法**:
```bash
# 检查常量文件
grep "WHITELIST" programs/prediction-market/src/constants.rs
# 应该显示: pub const WHITELIST: &str = "wl-seed";
```

### Q4: 部署后测试失败 - "Account not found"

**可能原因**:
- 白名单账户使用旧种子创建，需要重新创建
- 配置未初始化，需要先运行 `configure` 指令

**解决方案**:
```bash
# 1. 确保配置已初始化
# 2. 如果使用白名单，需要重新添加创建者到白名单（使用新种子）
```

---

## 🎯 快速部署命令（本地网络）

```bash
# 一键部署到 localnet
cd /Users/aricredemption/Projects/ploymarketX402/contract && \
solana config set --url localhost && \
solana airdrop 10 -k keys/admin.json 2>/dev/null || true && \
anchor deploy
```

---

## 📚 相关文档

- [DEPLOYMENT_READINESS.md](./docs/DEPLOYMENT_READINESS.md) - 完整部署准备检查
- [ANCHOR_BUILD_GUIDE.md](./docs/ANCHOR_BUILD_GUIDE.md) - 构建指南
- [TEST_FRAMEWORK_GUIDE.md](./docs/TEST_FRAMEWORK_GUIDE.md) - 测试框架

---

**最后更新**: 2024-11-08  
**当前版本**: v1.1.1 (白名单种子修复)




