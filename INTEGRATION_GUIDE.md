# 前端与合约集成指南

## 🎉 集成完成状态

前端已成功对接 Solana 预测市场合约，开发服务器正在运行！

### ✅ 已完成的工作

1. **依赖安装** - 所有必需的包已安装
2. **环境配置** - 创建了 `.env.local` 配置文件
3. **合约集成** - 前端已集成预测市场合约
4. **开发服务器** - 正在运行于 `http://localhost:3000`

---

## 🚀 快速开始

### 访问应用

打开浏览器访问：
```
http://localhost:3000
```

或通过网络访问：
```
http://192.168.2.1:3000
```

### 停止服务器

如需停止开发服务器，在终端按 `Ctrl + C`

---

## 📋 项目配置

### 环境变量 (`.env.local`)

```bash
# Solana 配置
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR

# X402 支付协议
NEXT_PUBLIC_RECEIVER_ADDRESS=0x209693Bc6afc0C5328bA36FaF03C514EF312287C
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_FACILITATOR_URL=https://x402.org/facilitator
NEXT_PUBLIC_CDP_CLIENT_KEY=3uyu43EHCwgVIQx6a8cIfSkxp6cXgU30

# WalletConnect (需要配置)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### 🔑 获取 WalletConnect Project ID

1. 访问 https://cloud.walletconnect.com/
2. 注册并创建新项目
3. 复制 Project ID
4. 更新 `.env.local` 中的 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

---

## 🏗️ 架构概览

### 合约信息

- **Program ID**: `78LNFkZn5wjKjscWWDXe7ChmmZ9Fu1g6rhGfCJPy7BmR`
- **网络**: Solana Devnet
- **RPC**: https://api.devnet.solana.com

### 核心文件结构

```
x402-polymarket-frontend/
├── app/
│   ├── lib/solana/
│   │   ├── client.ts          # 预测市场客户端
│   │   ├── program.ts         # 程序配置和 PDA 辅助函数
│   │   ├── types.ts           # TypeScript 类型定义
│   │   └── prediction_market.json  # IDL 文件
│   ├── hooks/
│   │   └── usePredictionMarket.ts  # React Hook
│   ├── markets/               # 市场页面
│   └── components/
│       └── market/            # 市场组件
├── components/
│   ├── wallet/                # 钱包组件
│   └── market/                # 市场 UI 组件
└── .env.local                 # 环境配置
```

---

## 🔧 主要功能

### 1. 预测市场客户端 (`PredictionMarketClient`)

提供与合约交互的所有方法：

```typescript
import { PredictionMarketClient } from '@/app/lib/solana/client';

// 创建客户端实例
const client = new PredictionMarketClient(connection, wallet);

// 获取市场数据
const market = await client.getMarket(marketAddress);

// 交易代币
await client.swap({
  market: marketAddress,
  tokenType: 0, // 0=YES, 1=NO
  direction: 0, // 0=买入, 1=卖出
  amount: 10,   // USDC 金额
});

// 添加流动性
await client.addLiquidity({
  market: marketAddress,
  usdcAmount: 100,
});
```

### 2. React Hook (`usePredictionMarket`)

简化的 React 集成：

```typescript
import { usePredictionMarket } from '@/app/hooks/usePredictionMarket';

function MarketComponent() {
  const {
    markets,
    config,
    loading,
    error,
    createMarket,
    swap,
    addLiquidity,
  } = usePredictionMarket();

  // 使用市场数据和功能
}
```

### 3. 支持的操作

- ✅ **创建市场** - 创建新的预测市场
- ✅ **交易代币** - 买入/卖出 YES/NO 代币
- ✅ **添加流动性** - 为市场提供流动性
- ✅ **提取流动性** - 移除流动性
- ✅ **铸造完整集** - 用 USDC 铸造 YES+NO 代币对
- ✅ **赎回完整集** - 销毁 YES+NO 代币对换回 USDC
- ✅ **查询市场** - 获取市场数据和统计信息
- ✅ **查询用户信息** - 获取用户持仓信息

---

## 📱 页面路由

### 主要页面

- `/` - 首页
- `/markets` - 市场列表
- `/markets/create` - 创建新市场
- `/markets/[address]` - 市场详情页
- `/admin` - 管理员页面

### 组件

- `MarketList` - 市场列表组件
- `MarketCard` - 市场卡片
- `TradingInterface` - 交易界面
- `LiquidityInterface` - 流动性管理界面
- `WalletButton` - 钱包连接按钮

---

## 🔍 调试信息

### 当前状态

- ✅ 依赖已安装
- ✅ 环境配置完成
- ✅ 开发服务器运行中
- ⚠️ WalletConnect 需要配置真实的 Project ID

### 已知警告

1. **WalletConnect 403 错误** - 需要配置真实的 Project ID
2. **Middleware 弃用警告** - Next.js 16 的正常警告，不影响功能

---

## 🛠️ 开发命令

```bash
# 进入前端目录
cd x402-polymarket-frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

---

## 📚 相关文档

### 项目文档

- `README.md` - 项目概述
- `ARCHITECTURE.md` - 架构说明
- `WALLET_INTEGRATION_GUIDE.md` - 钱包集成指南
- `PREDICTION_MARKET_INTEGRATION.md` - 预测市场集成详情

### 合约文档

- `contract/README.md` - 合约说明
- `contract/DEPLOY_GUIDE.md` - 部署指南
- `contract/frontend-integration-example.ts` - 集成示例

---

## 🎯 下一步

### 推荐配置

1. **配置 WalletConnect**
   - 获取真实的 Project ID
   - 更新 `.env.local`

2. **测试功能**
   - 连接 Solana 钱包
   - 浏览市场列表
   - 尝试创建市场
   - 测试交易功能

3. **自定义样式**
   - 修改 `app/globals.css`
   - 自定义组件样式

### 生产部署

1. 更新环境变量为生产配置
2. 运行 `pnpm build`
3. 部署到 Vercel/Netlify 等平台

---

## 🐛 故障排除

### 钱包连接问题

如果钱包无法连接：
1. 确保浏览器安装了 Solana 钱包扩展
2. 检查网络设置（应为 Devnet）
3. 查看浏览器控制台错误信息

### 交易失败

如果交易失败：
1. 确保钱包有足够的 SOL（用于交易费）
2. 确保钱包有足够的 USDC（用于交易）
3. 检查市场是否处于活跃状态
4. 查看交易错误信息

### RPC 问题

如果 RPC 连接失败：
1. 尝试使用其他 RPC 端点
2. 检查网络连接
3. 考虑使用付费 RPC 服务（如 Helius、QuickNode）

---

## 📞 支持

如有问题，请查看：
- 项目文档
- Solana 官方文档: https://docs.solana.com/
- Anchor 文档: https://www.anchor-lang.com/

---

**集成完成！祝开发顺利！** 🚀
