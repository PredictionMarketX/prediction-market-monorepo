# Devnet 部署状态

## ✅ 已完成

### 1. 本地网络部署成功
- **程序 ID**: `G9h26GViC3ma7Zg58HAbLaqEXgYEWLCCiNjfWkooevq2`
- **网络**: localhost (本地测试验证器)
- **状态**: ✅ 已部署并初始化配置
- **Authority**: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`

### 2. Devnet 程序部署
- **程序 ID**: `CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM`
- **网络**: devnet
- **状态**: ✅ 已部署（旧版本）
- **Authority**: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
- **程序大小**: 1,225,472 bytes
- **锁定余额**: 8.5304892 SOL

## ⚠️ 待完成

### 升级 Devnet 程序
由于 devnet 空投限制，当前钱包余额不足以升级程序。

**当前余额**: 4.41 SOL  
**所需余额**: ~8.54 SOL (用于写入缓冲区)

**解决方案**:
1. **等待空投限制解除** (推荐)
   ```bash
   # 等待一段时间后重试
   solana airdrop 5
   ```

2. **使用 Solana 水龙头网站**
   - 访问: https://faucet.solana.com/
   - 输入地址: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
   - 请求空投

3. **完成升级部署**
   ```bash
   cd contract
   
   # 方法1: 直接升级
   solana program deploy target/deploy/prediction_market.so \
     --program-id target/deploy/prediction_market-keypair-new.json \
     --upgrade-authority /Users/alanluo/.config/solana/id.json
   
   # 方法2: 分步升级
   # 步骤1: 写入缓冲区
   solana program write-buffer target/deploy/prediction_market.so
   
   # 步骤2: 设置缓冲区权限并升级
   solana program set-buffer-authority <BUFFER_ADDRESS> \
     --new-buffer-authority /Users/alanluo/.config/solana/id.json
   
   solana program upgrade <BUFFER_ADDRESS> CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
   ```

4. **初始化配置**
   ```bash
   cd contract
   anchor run init-devnet
   ```

## 📋 配置信息

### 程序配置参数
```javascript
{
  authority: "2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr",
  teamWallet: "2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr",
  platformBuyFee: 100,  // 1%
  platformSellFee: 100,  // 1%
  lpBuyFee: 50,  // 0.5%
  lpSellFee: 50,  // 0.5%
  tokenSupplyConfig: 10000000000,  // 10000 USDC
  tokenDecimalsConfig: 6,  // USDC 精度
  initialRealTokenReservesConfig: 1000000000,  // 1000 USDC (LMSR b参数)
  minTradingLiquidity: 1000000000,  // 1000 USDC
  usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",  // Devnet USDC
  usdcVaultMinBalance: 5000,  // 0.005 USDC
  minUsdcLiquidity: 100000000,  // 100 USDC
  lpInsuranceAllocationBps: 2000,  // 20%
  insuranceLossThresholdBps: 1000,  // 10%
  insuranceMaxCompensationBps: 5000,  // 50%
  insurancePoolEnabled: false
}
```

### 前端配置
已更新 `x402-polymarket-frontend/.env.local`:
```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
```

### IDL 文件
已更新前端 IDL: `x402-polymarket-frontend/app/lib/solana/prediction_market.json`

## 🔧 文件更新

### 合约文件
- ✅ `contract/programs/prediction-market/src/lib.rs` - 更新程序ID
- ✅ `contract/Anchor.toml` - 添加 devnet 配置
- ✅ `contract/scripts/init-devnet.js` - 创建 devnet 初始化脚本

### 前端文件
- ✅ `x402-polymarket-frontend/.env.local` - 更新网络配置
- ✅ `x402-polymarket-frontend/app/lib/solana/prediction_market.json` - 更新 IDL

## 📝 下一步操作

1. **获取足够的 SOL**
   - 使用水龙头或等待空投限制解除
   - 目标: 至少 10 SOL

2. **升级程序**
   ```bash
   cd contract
   solana program deploy target/deploy/prediction_market.so \
     --program-id target/deploy/prediction_market-keypair-new.json \
     --upgrade-authority /Users/alanluo/.config/solana/id.json
   ```

3. **初始化配置**
   ```bash
   anchor run init-devnet
   ```

4. **验证部署**
   ```bash
   solana program show CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM
   ```

5. **测试前端**
   ```bash
   cd x402-polymarket-frontend
   npm run dev
   ```
   访问 http://localhost:3000/admin/initialize 初始化配置

## 🔗 有用链接

- **Solana Explorer (Devnet)**: https://explorer.solana.com/?cluster=devnet
- **程序地址**: https://explorer.solana.com/address/CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM?cluster=devnet
- **钱包地址**: https://explorer.solana.com/address/2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr?cluster=devnet
- **Devnet 水龙头**: https://faucet.solana.com/

## ⚡ 快速命令

```bash
# 检查余额
solana balance

# 请求空投
solana airdrop 5

# 检查程序状态
solana program show CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM

# 升级程序（有足够余额后）
cd contract
solana program deploy target/deploy/prediction_market.so \
  --program-id target/deploy/prediction_market-keypair-new.json \
  --upgrade-authority /Users/alanluo/.config/solana/id.json

# 初始化配置
anchor run init-devnet

# 启动前端
cd x402-polymarket-frontend
npm run dev
```
