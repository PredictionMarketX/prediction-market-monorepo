# ⚡ 快速解决 "Config not found" 问题

## 🎯 问题

创建市场时出现错误：
```
Config not found
```

## ✅ 解决方案（2 分钟）

### 方法 1: 使用前端界面（最简单）

#### 1️⃣ 访问初始化页面
```
http://localhost:3000/admin/initialize
```

#### 2️⃣ 连接钱包
- 点击右上角钱包按钮
- 选择 Solana
- 连接 Phantom 钱包

#### 3️⃣ 检查状态
点击 "Check Configuration Status"

#### 4️⃣ 初始化（如果需要）
如果显示 "Config not found"：
1. 点击 "Initialize Configuration"
2. 在钱包中批准交易
3. 等待 2-3 秒确认

#### 5️⃣ 完成！
现在可以创建市场了

---

### 方法 2: 使用命令行

```bash
# 进入合约目录
cd contract

# 运行初始化脚本
ts-node scripts/initialize-program.ts

# 或运行完整测试
ts-node scripts/test-all-functions.ts
```

---

## 📋 前提条件

### 必需
- ✅ 钱包有至少 **0.5 SOL**
- ✅ 钱包连接到 **Devnet**

### 获取测试 SOL
```
https://faucet.solana.com/
```

---

## 🔍 验证配置

### 检查配置是否成功

访问初始化页面并点击 "Check Configuration Status"

应该看到：
```
✅ Config exists!
Admin: xxx...
Team Wallet: xxx...
Swap Fee: 30 bp
LP Fee: 20 bp
```

---

## 🎯 完整测试流程

### 1. 初始化配置 ✅
```
http://localhost:3000/admin/initialize
```

### 2. 创建市场 ✅
```
http://localhost:3000/markets/create
```

填写：
- 问题: "Will Bitcoin reach $100k?"
- YES 符号: "YES"
- YES URI: "https://example.com/yes.json"

### 3. 添加流动性 ✅

**注意**: 需要先获取测试 USDC

获取 USDC:
```
https://spl-token-faucet.com/?token-name=USDC
```

然后在市场详情页添加流动性

### 4. 交易测试 ✅

在市场详情页：
- 买入 YES 代币
- 卖出 YES 代币
- 买入 NO 代币
- 卖出 NO 代币

---

## 🐛 常见问题

### Q: 初始化失败？

**A**: 检查：
1. 钱包是否有足够的 SOL（>0.5）
2. 钱包是否在 Devnet
3. 是否在钱包中批准了交易

### Q: 配置已存在？

**A**: 如果看到 "Config already exists"，说明已经初始化过了，可以直接创建市场

### Q: 交易超时？

**A**: 
1. 刷新页面
2. 重新尝试
3. 检查网络连接

---

## 📊 配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| Swap Fee | 30 bp | 0.3% 交易手续费 |
| LP Fee | 20 bp | 0.2% LP 手续费 |
| Token Decimals | 6 | USDC 精度 |
| Whitelist | false | 不需要白名单 |

---

## 🎉 成功标志

初始化成功后，你应该能够：

- ✅ 创建新市场
- ✅ 添加流动性
- ✅ 买卖代币
- ✅ 查看市场列表

---

## 📞 需要帮助？

查看详细文档：
- [测试指南.md](./测试指南.md) - 完整测试流程
- [README_CN.md](./README_CN.md) - 项目文档

---

**现在就开始初始化吧！** 🚀

访问: http://localhost:3000/admin/initialize
