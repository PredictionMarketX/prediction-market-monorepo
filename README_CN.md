# Solana 预测市场 - 前端应用

## 📌 项目状态

✅ **前端已成功对接合约并运行**
✅ **Solana Devnet 支付功能已修复**
✅ **开发服务器运行中**

---

## 🌐 访问地址

- **本地**: http://localhost:3000
- **网络**: http://192.168.2.1:3000

---

## 🎯 快速开始

### 1. 准备工作

#### 安装 Phantom 钱包
```
访问: https://phantom.app/
下载并安装浏览器扩展
```

#### 切换到 Devnet
```
1. 打开 Phantom 钱包
2. 点击左上角网络选择器
3. 选择 "Devnet"
```

#### 获取测试 SOL
```
访问: https://faucet.solana.com/
输入钱包地址
请求 2 SOL 空投
```

---

### 2. 连接钱包

1. 访问 http://localhost:3000
2. 点击右上角钱包按钮
3. 选择 "Solana"
4. 连接 Phantom 钱包

---

### 3. 开始使用

#### 浏览市场
```
访问: http://localhost:3000/markets
查看所有预测市场
```

#### 创建市场
```
访问: http://localhost:3000/markets/create
填写市场信息并创建
```

#### 测试支付
```
访问: http://localhost:3000/paywall?amount=0.01&description=测试
使用 Solana 钱包支付
```

---

## 📁 项目结构

```
x402-polymarket-frontend/
├── app/
│   ├── page.tsx                    # 首页
│   ├── markets/                    # 市场页面
│   │   ├── page.tsx               # 市场列表
│   │   ├── create/                # 创建市场
│   │   └── [address]/             # 市场详情
│   ├── paywall/                    # 支付页面
│   ├── lib/solana/                 # Solana 集成
│   │   ├── client.ts              # 合约客户端
│   │   ├── program.ts             # 程序配置
│   │   ├── types.ts               # 类型定义
│   │   └── prediction_market.json # IDL 文件
│   └── hooks/
│       └── usePredictionMarket.ts # React Hook
├── components/
│   ├── market/                     # 市场组件
│   └── wallet/                     # 钱包组件
└── .env.local                      # 环境配置
```

---

## 🔧 核心功能

### 预测市场

- ✅ 创建市场
- ✅ 查看市场列表
- ✅ 交易 YES/NO 代币
- ✅ 添加/提取流动性
- ✅ 铸造/赎回完整集
- ✅ 查看市场统计

### 支付功能

- ✅ Solana 原生支付
- ✅ EVM 链支付（Base Sepolia）
- ✅ 自动余额检查
- ✅ 交易确认等待
- ✅ 友好的错误提示

---

## 🛠️ 开发命令

```bash
# 进入项目目录
cd x402-polymarket-frontend

# 安装依赖（已完成）
pnpm install

# 启动开发服务器（已运行）
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

---

## 📊 合约信息

### Solana Devnet

- **Program ID**: `78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR`
- **网络**: Devnet
- **RPC**: https://api.devnet.solana.com
- **Explorer**: https://explorer.solana.com/?cluster=devnet

### 支持的操作

| 操作 | 说明 | 权限 |
|------|------|------|
| 创建市场 | 创建新的预测市场 | 白名单用户 |
| 交易代币 | 买入/卖出 YES/NO | 所有用户 |
| 添加流动性 | 提供流动性赚取手续费 | 所有用户 |
| 提取流动性 | 移除流动性 | LP 提供者 |
| 铸造完整集 | 用 USDC 铸造 YES+NO | 所有用户 |
| 赎回完整集 | 销毁 YES+NO 换回 USDC | 所有用户 |

---

## 🐛 常见问题

### Q: 支付失败怎么办？

**A**: 检查以下几点：
1. 钱包是否连接到 Devnet
2. 钱包是否有足够的 SOL
3. 是否在钱包中批准了交易
4. 查看浏览器控制台的错误信息

详细解决方案：[支付问题解决方案.md](./支付问题解决方案.md)

---

### Q: 如何获取测试 SOL？

**A**: 访问 https://faucet.solana.com/
1. 输入钱包地址
2. 选择 Devnet
3. 点击 "Request Airdrop"
4. 等待几秒钟

---

### Q: 钱包无法连接？

**A**: 
1. 确保已安装 Phantom 钱包
2. 刷新页面
3. 检查钱包是否在 Devnet
4. 尝试断开重新连接

---

### Q: 看不到市场列表？

**A**:
1. 等待几秒让数据加载
2. 刷新页面
3. 检查 RPC 连接
4. 查看浏览器控制台

---

## 📚 文档索引

### 快速指南
- [使用说明.md](./使用说明.md) - 中文使用指南
- [支付问题解决方案.md](./支付问题解决方案.md) - 支付问题快速解决

### 详细文档
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - 完整集成指南
- [SOLANA_PAYMENT_TROUBLESHOOTING.md](./SOLANA_PAYMENT_TROUBLESHOOTING.md) - 支付故障排除
- [PAYMENT_FIX_SUMMARY.md](./PAYMENT_FIX_SUMMARY.md) - 修复总结

### 合约文档
- [contract/README.md](./contract/README.md) - 合约说明
- [contract/DEPLOY_GUIDE.md](./contract/DEPLOY_GUIDE.md) - 部署指南

---

## 🔐 安全提示

### Devnet 测试

1. ✅ 仅用于测试，代币无价值
2. ✅ 不要使用主网钱包
3. ✅ 不要分享私钥
4. ✅ 测试完成后清空钱包

### 最佳实践

1. 使用合理的测试金额
2. 验证交易详情
3. 检查接收地址
4. 保存交易签名

---

## 🎯 使用场景

### 场景 1: 交易者

```
1. 连接钱包
2. 浏览市场
3. 分析价格
4. 买入 YES/NO 代币
5. 等待结算
6. 获得收益
```

### 场景 2: 流动性提供者

```
1. 连接钱包
2. 选择市场
3. 添加流动性
4. 赚取手续费
5. 提取流动性
```

### 场景 3: 市场创建者

```
1. 连接管理员钱包
2. 创建市场
3. 设置参数
4. 添加初始流动性
5. 管理市场
```

---

## 💡 提示和技巧

### 交易技巧

1. **查看流动性** - 流动性高的市场滑点更小
2. **设置滑点保护** - 使用 minOutput 参数
3. **分批交易** - 大额交易分批执行
4. **监控价格** - 实时查看价格变化

### 流动性提供

1. **选择活跃市场** - 交易量大的市场手续费收入高
2. **分散风险** - 不要把所有资金放在一个市场
3. **及时提取** - 市场结算前提取流动性
4. **计算收益** - 关注 LP 份额价值

---

## 🚀 下一步

### 推荐操作

1. ✅ 配置 WalletConnect Project ID
2. ✅ 测试所有功能
3. ✅ 自定义样式
4. ✅ 添加更多功能

### 生产部署

1. 更新环境变量为生产配置
2. 切换到 Mainnet
3. 运行 `pnpm build`
4. 部署到 Vercel/Netlify

---

## 📞 获取帮助

### 资源

- **Solana 文档**: https://docs.solana.com/
- **Anchor 文档**: https://www.anchor-lang.com/
- **Next.js 文档**: https://nextjs.org/docs
- **Phantom 帮助**: https://help.phantom.app/

### 社区

- **Solana Discord**: https://discord.gg/solana
- **Solana 中文社区**: https://solana.com/zh/community

---

## ✨ 特性亮点

- 🚀 **快速启动** - 一键安装，立即使用
- 💰 **多链支持** - Solana + EVM 双链支持
- 🔒 **安全可靠** - 完整的错误处理和验证
- 🎨 **现代 UI** - 响应式设计，暗黑模式
- 📱 **移动友好** - 完美支持移动设备
- 🔧 **易于扩展** - 模块化架构，易于定制

---

## 🎉 开始使用

现在一切就绪！

1. 打开浏览器访问 http://localhost:3000
2. 连接你的 Solana 钱包
3. 开始探索预测市场
4. 享受去中心化预测市场的乐趣！

**祝你使用愉快！** 🚀
