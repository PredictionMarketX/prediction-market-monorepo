# 🔍 调试 InvalidParameter 错误

## 🎯 当前状态

错误仍然是：
```
AnchorError thrown in programs/prediction-market/src/instructions/admin/configure.rs:87
Error Code: InvalidParameter
Error Number: 6028
```

第 87 行的检查是：
```rust
require!(
    new_config.token_decimals_config == crate::constants::USDC_DECIMALS,
    InvalidParameter
);
```

这意味着 `token_decimals_config` 不等于 6。

---

## 🔍 调试步骤

### 步骤 1: 打开浏览器控制台

1. 访问 http://localhost:3000/admin/initialize
2. 按 F12 打开开发者工具
3. 切换到 "Console" 标签

### 步骤 2: 连接钱包并初始化

点击 "Initialize Configuration"

### 步骤 3: 查看控制台输出

应该看到类似这样的输出：
```
🔍 Configuration Parameters:
token_decimals_config: 6
token_supply_config: 1000000000000
initial_real_token_reserves_config: 500000000
Full config: { ... }
```

### 步骤 4: 检查 token_decimals_config

**关键问题**：`token_decimals_config` 的值是什么？

- ✅ 如果是 `6` - 那么问题在其他地方
- ❌ 如果不是 `6` - 找到问题了

---

## 🐛 可能的原因

### 原因 1: 类型问题

JavaScript 的数字类型可能有问题：

```typescript
// ❌ 错误
token_decimals_config: "6"  // 字符串

// ✅ 正确
token_decimals_config: 6    // 数字
```

### 原因 2: 字段顺序问题

Anchor 可能对字段顺序敏感。让我检查 IDL 中的字段顺序。

### 原因 3: BN 类型问题

某些字段可能需要 BN 类型：

```typescript
// 可能需要
token_decimals_config: new BN(6)
```

---

## 🔧 临时解决方案

### 方案 1: 使用命令行脚本

如果前端一直失败，使用命令行脚本：

```bash
cd contract
ts-node scripts/initialize-program.ts
```

### 方案 2: 简化配置

尝试最小配置：

```typescript
const configParams = {
  authority: wallet.publicKey,
  pending_authority: PublicKey.default,
  team_wallet: wallet.publicKey,
  platform_buy_fee: 30,
  platform_sell_fee: 30,
  lp_buy_fee: 20,
  lp_sell_fee: 20,
  token_supply_config: new BN(1000000000000),
  token_decimals_config: 6,  // 确保是数字
  initial_real_token_reserves_config: new BN(500000000),
  // ... 其他字段
};
```

---

## 📊 检查清单

请在控制台检查以下内容：

- [ ] `token_decimals_config` 的类型是 `number`
- [ ] `token_decimals_config` 的值是 `6`
- [ ] 没有其他字段覆盖了这个值
- [ ] BN 类型的字段正确使用了 `new BN()`
- [ ] PublicKey 类型的字段正确使用了 `PublicKey`

---

## 🎯 下一步

1. **打开浏览器控制台**
2. **尝试初始化**
3. **查看输出的 `token_decimals_config` 值**
4. **截图并告诉我看到了什么**

这样我们就能准确定位问题所在。

---

## 💡 快速测试

在浏览器控制台运行：

```javascript
// 测试 token_decimals_config
const testConfig = {
  token_decimals_config: 6
};
console.log('Type:', typeof testConfig.token_decimals_config);
console.log('Value:', testConfig.token_decimals_config);
console.log('Equals 6:', testConfig.token_decimals_config === 6);
```

应该输出：
```
Type: number
Value: 6
Equals 6: true
```

---

**请刷新页面，打开控制台，然后尝试初始化并告诉我看到了什么！** 🔍
