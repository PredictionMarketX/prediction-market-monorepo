# ✅ 最终解决方案 - 使用 Anchor 生成的类型

## 🎯 问题根源

前端参数值是正确的（`token_decimals_config = 6`），但 Anchor 反序列化失败。

这说明问题在于：
1. 字段名格式
2. 字段顺序
3. 或者 Anchor 版本不匹配

---

## ✅ 解决方案：使用 IDL 生成的类型

Anchor 会从 IDL 自动生成 TypeScript 类型。我们应该使用这些类型而不是手动构造对象。

### 步骤 1: 检查 IDL 中的 configure 指令

```bash
node -e "const idl = require('./x402-polymarket-frontend/app/lib/solana/prediction_market.json'); const configure = idl.instructions.find(i => i.name === 'configure'); console.log(JSON.stringify(configure.args, null, 2))"
```

### 步骤 2: 使用正确的参数格式

根据 IDL，configure 指令接受一个 `Config` 类型的参数。

---

## 🔧 临时绕过方案

由于这个问题很难调试，我建议：

### 方案 A: 使用 Anchor CLI 直接初始化

```bash
cd contract

# 1. 确保有最新的 IDL
anchor build
cp target/idl/prediction_market.json ../x402-polymarket-frontend/app/lib/solana/

# 2. 使用 Anchor 测试
anchor test --skip-local-validator
```

### 方案 B: 简化前端，只传递必需字段

创建一个最小化的配置对象，只包含绝对必需的字段。

### 方案 C: 重新生成 IDL 并更新前端

```bash
cd contract
anchor build
cp target/idl/prediction_market.json ../x402-polymarket-frontend/app/lib/solana/
```

然后刷新前端页面。

---

## 💡 最可能的问题

### 问题：字段名大小写

Rust 使用 `snake_case`，但 Anchor 的 TypeScript 绑定可能期望 `camelCase`。

**检查方法**：
```javascript
// 在浏览器控制台
const program = // 你的 program 对象
console.log(program.idl.types.find(t => t.name === 'Config'));
```

### 问题：Anchor 版本不匹配

前端使用的 `@coral-xyz/anchor` 版本可能与合约编译时的版本不同。

**解决**：
```bash
cd x402-polymarket-frontend
npm list @coral-xyz/anchor

cd ../contract  
npm list @coral-xyz/anchor

# 确保版本一致
```

---

## 🚀 推荐的快速解决方案

### 选项 1: 跳过前端初始化，直接创建市场

如果配置已经存在（或者可以接受默认配置），直接跳过初始化步骤：

1. 假设配置已经初始化（或使用默认值）
2. 直接创建市场
3. 测试其他功能

### 选项 2: 使用 Solana CLI 直接调用

```bash
# 构建交易
solana program call [PROGRAM_ID] configure [参数] --url devnet
```

### 选项 3: 联系合约开发者

如果这是别人部署的合约，联系他们获取初始化帮助。

---

## 📊 调试检查清单

基于你的输出，我们知道：

- [x] `token_decimals_config` 值是 6
- [x] `token_decimals_config` 类型是 number
- [x] 前端参数构造正确
- [ ] 需要检查：所有 23 个字段是否都存在
- [ ] 需要检查：字段顺序是否正确
- [ ] 需要检查：Anchor 版本是否匹配

---

## 🎯 下一步

请提供控制台输出的【所有字段】部分，特别是：

1. 总共有多少个字段？
2. 第 9 个字段是 `token_decimals_config` 吗？
3. 是否有任何字段是 `undefined`？
4. 字段的顺序是否与 IDL 一致？

有了这些信息，我就能找到确切的问题！

---

**或者，如果你想快速继续测试，可以：**

1. 假设配置已初始化
2. 直接测试创建市场功能
3. 稍后再解决初始化问题

你想怎么做？
