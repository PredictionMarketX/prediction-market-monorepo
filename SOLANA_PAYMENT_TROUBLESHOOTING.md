# Solana Devnet 支付故障排除指南

## ✅ 已修复的问题

1. **无效的接收地址** - 已更新为有效的 Solana 地址
2. **余额检查** - 添加了余额验证
3. **交易确认** - 添加了交易确认等待
4. **错误处理** - 改进了错误消息提示

---

## 🔧 常见问题和解决方案

### 1. 余额不足错误

**错误信息**: "Insufficient balance" 或 "Insufficient SOL balance"

**原因**: 钱包中没有足够的 SOL 来支付交易

**解决方案**:
```bash
# 访问 Solana Devnet 水龙头获取测试 SOL
https://faucet.solana.com/

# 或使用命令行
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

**步骤**:
1. 复制你的钱包地址
2. 访问 https://faucet.solana.com/
3. 粘贴地址并选择 Devnet
4. 点击 "Request Airdrop"
5. 等待几秒钟
6. 刷新钱包查看余额

---

### 2. 钱包未连接

**错误信息**: "Please connect your Solana wallet"

**解决方案**:
1. 确保已安装 Solana 钱包扩展（推荐 Phantom）
2. 点击页面右上角的钱包按钮
3. 选择 "Solana" 链
4. 点击 "Connect Wallet"
5. 在钱包弹窗中批准连接

---

### 3. 网络配置错误

**错误信息**: "Network error" 或 "RPC error"

**解决方案**:

检查钱包网络设置：
1. 打开 Phantom 钱包
2. 点击左上角的网络选择器
3. 选择 "Devnet"
4. 刷新页面

或者更新 RPC 端点：
```bash
# 编辑 .env.local
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com

# 或使用其他 RPC 提供商
# NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

---

### 4. 交易被拒绝

**错误信息**: "User rejected" 或 "Transaction was rejected by user"

**原因**: 用户在钱包中取消了交易

**解决方案**:
1. 重新尝试支付
2. 在钱包弹窗中点击 "Approve" 或 "确认"
3. 不要关闭钱包弹窗

---

### 5. 交易超时

**错误信息**: "Transaction expired" 或 "blockhash not found"

**原因**: 交易在确认前过期

**解决方案**:
1. 检查网络连接
2. 重新尝试交易
3. 如果问题持续，尝试使用不同的 RPC 端点

---

### 6. 无效的接收地址

**错误信息**: "Invalid recipient address"

**解决方案**:

检查环境变量配置：
```bash
# .env.local
NEXT_PUBLIC_SOLANA_RECIPIENT=CmGgLQL36Y9ubtTsy2zmE46TAxwCBm66onZmPPhUWNqv
```

确保地址是有效的 Solana 公钥（Base58 编码，32-44 字符）

---

## 🧪 测试支付流程

### 完整测试步骤

1. **准备钱包**
   ```bash
   # 安装 Phantom 钱包
   https://phantom.app/
   
   # 切换到 Devnet
   设置 -> 开发者设置 -> 测试网络 -> Devnet
   ```

2. **获取测试 SOL**
   ```bash
   # 访问水龙头
   https://faucet.solana.com/
   
   # 请求 2 SOL（足够测试使用）
   ```

3. **连接钱包**
   - 访问 http://localhost:3000
   - 点击右上角钱包按钮
   - 选择 "Solana"
   - 连接 Phantom 钱包

4. **测试支付**
   - 访问 http://localhost:3000/paywall?amount=0.01&description=Test
   - 点击 "Pay with Solana Wallet"
   - 在 Phantom 中确认交易
   - 等待确认（通常 1-2 秒）

---

## 🔍 调试技巧

### 1. 检查钱包余额

在浏览器控制台运行：
```javascript
// 获取连接的钱包地址
const wallet = window.solana;
const publicKey = wallet.publicKey.toString();
console.log("Wallet:", publicKey);

// 检查余额
const connection = new Connection("https://api.devnet.solana.com");
const balance = await connection.getBalance(wallet.publicKey);
console.log("Balance:", balance / 1e9, "SOL");
```

### 2. 查看交易详情

访问 Solana Explorer：
```
https://explorer.solana.com/?cluster=devnet
```

输入交易签名查看详细信息

### 3. 检查 RPC 连接

```javascript
const connection = new Connection("https://api.devnet.solana.com");
const version = await connection.getVersion();
console.log("RPC Version:", version);
```

### 4. 查看浏览器控制台

打开开发者工具（F12）查看：
- 错误消息
- 交易签名
- 网络请求
- 钱包连接状态

---

## 📊 支付金额说明

### Devnet 测试金额

推荐的测试金额：
- **0.001 SOL** - 最小测试金额
- **0.01 SOL** - 标准测试金额
- **0.1 SOL** - 较大测试金额

### 交易费用

Solana 交易费用通常为：
- **0.000005 SOL** (5,000 lamports) - 标准交易
- 总成本 = 支付金额 + 交易费用

### 示例

支付 0.01 SOL：
- 支付金额: 0.01 SOL
- 交易费用: ~0.000005 SOL
- 总计: ~0.010005 SOL

---

## 🛠️ 高级配置

### 使用自定义 RPC

如果公共 RPC 不稳定，可以使用付费 RPC：

```bash
# Helius
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# QuickNode
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://YOUR_ENDPOINT.devnet.quiknode.pro/YOUR_KEY/

# Alchemy
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://solana-devnet.g.alchemy.com/v2/YOUR_KEY
```

### 调整交易确认级别

在代码中修改确认级别：
```typescript
// 更快但不太安全
await connection.confirmTransaction(signature, 'processed');

// 平衡（默认）
await connection.confirmTransaction(signature, 'confirmed');

// 最安全但较慢
await connection.confirmTransaction(signature, 'finalized');
```

---

## 📱 支持的钱包

### 推荐钱包

1. **Phantom** ⭐ 推荐
   - 最流行的 Solana 钱包
   - 支持 Devnet
   - 用户友好
   - https://phantom.app/

2. **Solflare**
   - 功能丰富
   - 支持硬件钱包
   - https://solflare.com/

3. **Backpack**
   - 新兴钱包
   - 现代界面
   - https://backpack.app/

### 钱包配置

所有钱包都需要：
1. 切换到 Devnet 网络
2. 获取测试 SOL
3. 授权网站连接

---

## 🔐 安全提示

### Devnet 安全

1. **仅用于测试** - Devnet 代币没有价值
2. **不要使用主网钱包** - 为测试创建单独的钱包
3. **不要分享私钥** - 即使是测试钱包

### 最佳实践

1. 定期清理测试钱包
2. 使用合理的测试金额
3. 验证接收地址
4. 检查交易详情

---

## 📞 获取帮助

### 资源

- **Solana 文档**: https://docs.solana.com/
- **Solana Discord**: https://discord.gg/solana
- **Phantom 支持**: https://help.phantom.app/

### 常用命令

```bash
# 检查 Solana CLI 版本
solana --version

# 查看钱包余额
solana balance YOUR_ADDRESS --url devnet

# 请求空投
solana airdrop 2 YOUR_ADDRESS --url devnet

# 查看交易
solana confirm SIGNATURE --url devnet
```

---

## ✅ 验证修复

运行以下检查确保一切正常：

1. ✅ 环境变量配置正确
2. ✅ 钱包已连接到 Devnet
3. ✅ 钱包有足够的 SOL
4. ✅ 接收地址有效
5. ✅ RPC 端点可访问
6. ✅ 浏览器控制台无错误

---

**如果问题仍然存在，请查看浏览器控制台的详细错误信息！** 🔍
