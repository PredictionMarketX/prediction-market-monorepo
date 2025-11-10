# 获取 Devnet SOL 以完成部署

## 当前状态
- **钱包地址**: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
- **当前余额**: 4.41 SOL
- **所需余额**: ~10 SOL (用于升级程序)
- **程序ID**: `CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM`

## 问题
devnet 上已部署的程序是旧版本，程序ID不匹配。需要升级程序但余额不足。

## 解决方案

### 方案1: 使用 Solana 官方水龙头 (推荐)
访问: https://faucet.solana.com/

1. 选择网络: **Devnet**
2. 输入地址: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
3. 选择金额: **5 SOL** (可以多次请求)
4. 完成验证码
5. 点击 "Request Airdrop"

### 方案2: 使用 QuickNode 水龙头
访问: https://faucet.quicknode.com/solana/devnet

1. 输入地址: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
2. 完成验证
3. 请求空投

### 方案3: 使用 SolFaucet
访问: https://solfaucet.com/

1. 选择 Devnet
2. 输入地址: `2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr`
3. 请求空投

### 方案4: 等待 CLI 空投限制解除
```bash
# 等待 1-2 小时后重试
solana airdrop 5
```

## 获取 SOL 后的操作

### 1. 检查余额
```bash
solana balance
# 应该显示 > 9 SOL
```

### 2. 升级程序到 devnet
```bash
cd contract

# 升级程序
solana program deploy target/deploy/prediction_market.so \
  --program-id target/deploy/prediction_market-keypair-new.json \
  --upgrade-authority /Users/alanluo/.config/solana/id.json
```

### 3. 初始化配置
```bash
anchor run init-devnet
```

### 4. 验证部署
```bash
# 检查程序
solana program show CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM

# 应该看到:
# - Authority: 2eExwMwQPhsAKXKygjpA6VChkr1iMgPugjrX47F6Tkyr
# - 最新的部署时间
```

### 5. 启动前端测试
```bash
cd x402-polymarket-frontend
npm run dev
```

访问: http://localhost:3000

## 快速命令汇总

```bash
# 1. 检查当前余额
solana balance

# 2. 升级程序 (有足够SOL后)
cd contract
solana program deploy target/deploy/prediction_market.so \
  --program-id target/deploy/prediction_market-keypair-new.json \
  --upgrade-authority /Users/alanluo/.config/solana/id.json

# 3. 初始化配置
anchor run init-devnet

# 4. 验证
solana program show CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM

# 5. 启动前端
cd ../x402-polymarket-frontend
npm run dev
```

## 注意事项

1. **程序ID已更新**: 新的程序ID是 `CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM`
2. **前端配置已更新**: `.env.local` 已指向新程序ID
3. **IDL已更新**: 前端的IDL文件已同步
4. **本地网络可用**: 如果devnet有问题，可以使用本地网络测试

## 本地网络测试 (备选方案)

如果devnet空投困难，可以先在本地网络测试：

```bash
# 1. 切换到本地网络
solana config set --url localhost

# 2. 启动本地验证器 (新终端)
solana-test-validator

# 3. 空投SOL
solana airdrop 100

# 4. 使用本地网络
cd x402-polymarket-frontend

# 5. 更新 .env.local
# NEXT_PUBLIC_SOLANA_NETWORK=localhost
# NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=http://localhost:8899
# NEXT_PUBLIC_PROGRAM_ID=G9h26GViC3ma7Zg58HAbLaqEXgYEWLCCiNjfWkooevq2

# 6. 启动前端
npm run dev
```

本地网络的程序已经部署并初始化完成，可以直接使用！
