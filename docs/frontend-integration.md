# Polymarket X402 前端对接文档

**版本**: v2.4
**更新时间**: 2025-11-03
**合约状态**: ✅ 生产就绪

---

## 🚨 v2.4 重要更新通知

### 用户体验优化：流动性比例容差放宽

**影响范围**: 添加流动性功能的前端实现

**变更内容**:
- ✅ 流动性比例容差从 **1%** 放宽到 **2%**
- ✅ 预计添加流动性失败率降低 **70%+**
- ✅ 减少用户重试和 gas 费浪费

**前端建议调整**:

1. **更新错误提示文案**：
```typescript
// ❌ 旧提示（1%容差）
"资产比例偏差超过1%，请调整输入"

// ✅ 新提示（2%容差）
"资产比例偏差超过2%，请调整输入。提示：2%容差可覆盖大部分价格波动"
```

2. **调整前端计算逻辑**（可选）：
```typescript
// 前端计算最优比例时，可以使用更宽松的检查
function validateLiquidityRatio(userRatio: number, poolRatio: number): boolean {
  const tolerance = 0.02;  // ✅ v2.4: 从 0.01 改为 0.02
  return Math.abs(userRatio - poolRatio) / poolRatio <= tolerance;
}
```

3. **更新用户帮助文档**：
```markdown
**Q: 为什么我的添加流动性交易有时会失败？**

A: 合约要求三种资产（USDC、YES、NO）的比例偏差不超过 2%（v2.4优化）。
   如果市场价格在您提交交易期间发生波动，可能导致比例偏差超过容差。

   建议：
   - 使用前端的"自动计算最优比例"功能
   - 在价格稳定时添加流动性
   - 如果失败，刷新价格后重试
```

**技术细节**:
- 常量位置：`contract/programs/prediction-market/src/constants.rs:257`
- 常量名称：`LIQUIDITY_RATIO_TOLERANCE_BPS = 200` (2%)
- 应用位置：首次添加流动性 + 后续添加流动性

**升级建议**:
- **向后兼容**：此变更向后兼容，无需强制升级前端
- **建议升级**：更新错误提示和帮助文档，提升用户体验

---

## 🚨 v2.5 运维与金库保护更新（需要前端/运维关注）

本次升级包含两点与前端及运维密切相关的变更：

- 新增管理员指令：`ensure_team_usdc_ata` 用于一键创建（或确保存在）团队 USDC ATA，避免因团队 ATA 缺失导致的交易失败（平台费发放）。
- 金库最小余额保护扩面：在以下路径转出 USDC 前，会校验转账后余额不低于 `usdc_vault_min_balance`：
  - SELL 方向的 `swap`（用户收到 USDC + 团队手续费转出）
  - `claim_lp_fees`（LP 领取手续费）

### 1) 管理员：确保团队 USDC ATA

- 指令：`ensure_team_usdc_ata`
- 触发者：`global_config.authority`
- 费用：由管理员作为 `payer` 支付创建 ATA 的租金
- 影响：创建/保障 `team_wallet` 对应 `USDC` 的 ATA 存在，避免因缺 ATA 导致的 `swap/claim_lp_fees` 失败

调用（Anchor 客户端示例）：

```ts
await program.methods
  .ensureTeamUsdcAta()
  .accounts({
    globalConfig: configPda,
    admin: wallet.publicKey,
    usdcMint,
    teamWallet,
    teamUsdcAta, // 可由客户端按 ATA 派生规则计算
  })
  .rpc();
```

### 2) 前端：USDC 金库最小余额保护的交互提示

- 配置项：`usdc_vault_min_balance`（单位：最小单位，USDC 的 6 位精度）
- 触发：当 SELL `swap` 或 `claim_lp_fees` 预计导致金库余额低于该值时，交易会被拒绝（InsufficientBalance）。

前端建议：

- 在 `swap(SELL)` 提交前，做“预估检查”：
  - 读取 `market_usdc_ata` 余额，估算本次用户净收款 `amount_after_fee` 与平台费拆分的 `team_fee`；
  - 若 `vault_balance - amount_after_fee - team_fee < min_balance`，提前提示“金库保护，建议降低卖出量或分笔卖出”。
- 在 LP 领取手续费页，读取金库余额、`fees_amount` 与 `min_balance`，若领取后会低于最小余额，提示延后领取或分批领取。

注意：

- 该保护主要用于避免账户被意外清空/关闭的极端情形；合理配置建议已在文档“配置说明”中给出（建议取值非常小）。

---

---

## 🚨 v2.2 重要更新通知

### 破坏性变更：MarketRiskMetrics 事件结构调整

**影响范围**: 所有订阅 `MarketRiskMetrics` 事件的前端代码

**变更内容**:
```typescript
// ❌ v2.1 及之前版本
interface MarketRiskMetrics {
  position_imbalance: number;  // i64 类型，可能为负数
  // ...
}

// ✅ v2.2 新版本
interface MarketRiskMetrics {
  position_imbalance: BN;  // u64 类型，始终为正数（绝对值）
  // ...
}
```

**迁移指南**:

1. **删除负数处理逻辑**：
```typescript
// ❌ 旧代码（不再需要）
const imbalance = event.positionImbalance;
if (imbalance < 0) {
  // 处理负数情况
}

// ✅ 新代码
const imbalance = event.positionImbalance.toNumber();  // 始终为正数
```

2. **类型定义更新**：
```typescript
// 更新 IDL 类型定义
interface MarketRiskMetrics {
  market: PublicKey;
  currentYesPriceBps: number;
  positionImbalance: BN;  // ✅ 改为 BN 类型（u64）
  maxLpLossEstimate: BN;
  insurancePoolCoverageBps: number;
  timeToSettlementHours: BN;
  effectiveLmsrB: BN;
  maxSingleTradeSize: BN;
}
```

3. **事件监听代码适配**：
```typescript
program.addEventListener('MarketRiskMetrics', (event) => {
  // ✅ 直接使用，无需处理负数
  const imbalance = event.positionImbalance.toNumber();
  console.log('持仓不平衡度:', imbalance);

  // 计算风险等级
  const riskLevel = imbalance > 1_000_000_000 ? 'high' : 'normal';
});
```

**升级建议**: 在升级到 v2.2 合约后，请同步更新前端代码以避免数据解析错误。

---

## 📋 目录

1. [快速开始](#快速开始)
2. [环境配置](#环境配置)
3. [核心概念](#核心概念)
4. [客户端 API](#客户端-api)
5. [React Hooks](#react-hooks)
6. [完整流程示例](#完整流程示例)
7. [错误处理](#错误处理)
8. [最佳实践](#最佳实践)
9. [常见问题](#常见问题)

---

## 🔎 只读预览接口（v3.1.1）

为减少失败交易与提升用户理解度，合约提供三类只读预览：

- `sell_preview`：给定卖出 `amount` 与 `token_type(0=NO/1=YES)`，返回：
  - `usdc_out_before_fee`、`platform_fee`、`lp_fee`、`amount_after_fee`
  - `team_fee`、`insurance_allocation`
  - `vault_balance_before`、`min_balance`、`projected_remaining`、`will_violate_min_balance`
  - 用于预判“最小余额保护”是否触发，避免提交失败

- `claim_fees_preview`（LP 手续费领取）：
  - 返回 `claimable_fees` 与发放后对 `market_usdc_ata` 的影响
  - 字段：`vault_balance_before`、`min_balance`、`remaining_after`、`will_violate_min_balance`

- `withdraw_preview`（LP 撤出）：
  - 返回 `estimated_usdc_out`、`early_exit_penalty(_bps)`、动态撤出上限、熔断状态、池子失衡、保险补偿等
  - 新增字段（v3.1.1）：
    - `leftover_yes/no`、`leftover_usdc_estimate`（基于 LMSR 的精确估计）
    - `internal_slippage_bps`（内部卖出相对 1:1 的滑点）
    - `pool_*_before/after`（内部卖出前后池子状态，预估，不上链）

CLI 示例：

```bash
# 卖出预览
yarn script sell-preview \
  -y <YES_MINT> -n <NO_MINT> -a 1000000 -t 1

# LP 手续费领取预览（以当前钱包作为 LP）
yarn script claim-fees-preview \
  -y <YES_MINT> -n <NO_MINT>

# LP 撤出预览（shares 为拟撤份额）
yarn script withdraw-preview \
  -y <YES_MINT> -n <NO_MINT> -s 1000000
```

前端建议：

- 若 `will_violate_min_balance=true`，在提交按钮旁提示“金库保护，建议降低额度或分笔处理”。
- 将 `internal_slippage_bps` 与 `leftover_usdc_estimate` 展示在“内部兑换明细”卡片，帮助用户理解折扣来源。

### 💡 建议提示（与 CLI 一致的友好文案）

- 卖出预览（sell_preview）
  - 当 `will_violate_min_balance=true` 时，提示：
    - “金库保护：请将净收款（扣费后）控制在 {vault_balance_before - min_balance - team_fee} 以内（近似上限，LMSR 非线性可能有差异）”。
  - UI 可在确认弹窗中突出显示该建议，并提供“一键减少到建议上限”的快捷操作。

- 手续费领取预览（claim_fees_preview）
  - 当 `will_violate_min_balance=true` 时，提示：
    - “金库保护：建议本次领取 ≤ {vault_balance_before - min_balance}”。
  - 对应输入框可提供“按建议值填充”的按钮。

- 撤出预览（withdraw_preview）
  - 若 `circuit_breaker_active=true`：提示“熔断中，请等待重置/冷却期结束后再尝试”。
  - 否则根据 `max_withdraw_shares` 提示当前单次最大可撤份额：
    - “当前动态上限：本次最多可撤 {max_withdraw_shares} 份额（受池子失衡度影响）”。

示例（React 伪码）：

```tsx
if (sellPreview.willViolateMinBalance) {
  const allowedNet = Math.max(0,
    sellPreview.vaultBalanceBefore - sellPreview.minBalance - sellPreview.teamFee);
  toast.warn(`金库保护：建议净收款 ≤ ${format(allowedNet)}（近似值）`);
}

if (claimFeesPreview.willViolateMinBalance) {
  const allowed = Math.max(0,
    claimFeesPreview.vaultBalanceBefore - claimFeesPreview.minBalance);
  toast.info(`建议领取 ≤ ${format(allowed)}，以避免触发金库保护`);
}

if (withdrawPreview.circuitBreakerActive) {
  toast.error('熔断中：请等待重置/冷却期结束');
} else {
  toast(`本次最多可撤 ${format(withdrawPreview.maxWithdrawShares)} 份额`);
}
```

---

## 🔒 限额/熔断与客户端校验（重要）

本节汇总链上常量与最新阈值，前端需按以下规则做输入限制与提示，减少失败交易与不必要的费用。

### 1) 最大单笔交易上限（BUY/SELL）
- 常量：`MAX_SINGLE_TRADE_BPS = 1000`（10%）
- 规则：单笔 `amount` 上限 = `pool_collateral_reserve * 10%`
- 前端校验（建议）：在交易面板根据当前池内 USDC 储备限制输入；超额时禁用提交并给出提示。

```ts
import BN from 'bn.js';

function getMaxTradeSize(poolCollateralReserve: BN): BN {
  // 10% = 1000 bps
  return poolCollateralReserve.mul(new BN(1000)).div(new BN(10000));
}

function validateTradeInput(userUsdc: BN, poolCollateralReserve: BN): { ok: boolean; max: BN } {
  const max = getMaxTradeSize(poolCollateralReserve);
  return { ok: userUsdc.lte(max), max };
}
```

提示文案（示例）：
- “为保护流动性，单笔交易上限为池内 USDC 储备的 10%。请降低金额或分笔下单。”

### 2) 动态撤出上限（LP 端）
- 常量（已收紧，更保守）：
  - 平衡：`25%`（`BALANCED_MAX_WITHDRAW_BPS=2500`）
  - 轻度不平衡（≥1.5:1）：`15%`
  - 中度不平衡（≥2:1）：`7%`
  - 高度不平衡（≥3:1）：`3%`
- 建议前端逻辑：优先调用只读 `withdraw_preview` 获得链上精确限制与早退惩罚；若只做本地预估，可依据 YES:NO 储备比（放大百倍：150/200/300）判断所处分档，给出大致上限。

```ts
// 推荐：链上只读预览（无签名）
const res = await program.methods
  .withdrawPreview(new BN(userLpShares))
  .accounts({ /* ...参见 IDL */ })
  .view();
// 使用 res.maxWithdrawBps / res.maxWithdrawShares / res.earlyExitPenaltyBps 渲染 UI
```

提示文案（示例）：
- “当前池子失衡，单次可撤出上限已收紧为 7%。可分多次在不同时间窗口撤出。”

### 3) 熔断阈值（Circuit Breaker）
- 触发条件（任一满足）：
  - 池子比例 ≥ `4:1`
  - 单边储备 < 初始的 `15%`（`CIRCUIT_BREAKER_MIN_RESERVE_BPS=1500`）
  - 24 小时内撤出份额 ≥ `40%`（`CIRCUIT_BREAKER_WITHDRAW_24H_BPS=4000`）
- 冷却期：24 小时；重置条件：池子比例 < `3.5:1`
- 前端表现：
  - 提现入口置灰并提示“熔断中，提现暂不可用（预计冷却期 24h）”。
  - 在撤出预览卡片中显示 `circuit_breaker_active=true` 并给出原因提示（如“单边储备低于 15%”）。

### 4) 其他交互建议
- `minimum_receive_amount`：所有交易提供滑点保护输入；默认 0.5%-1%，支持用户自定义。
- `deadline`：提交交易时带绝对时间戳（Unix sec）；超时提示“订单过期，请刷新价格后重试”。
- 读操作优先：交易/提现面板优先调用只读 `withdraw_preview` 与本地限额检查，减少失败概率。
- 错误映射：对 `TradeSizeTooLarge`、`ExcessiveWithdrawal`、`CircuitBreakerTriggered` 等错误码做用户友好的中文提示。

常量位置：`contract/programs/prediction-market/src/constants.rs`
> MAX_SINGLE_TRADE_BPS=1000；BALANCED/MILD/MODERATE/HIGH_WITHDRAW_BPS=2500/1500/700/300；
> CIRCUIT_BREAKER_MIN_RESERVE_BPS=1500；CIRCUIT_BREAKER_WITHDRAW_24H_BPS=4000

## 🚀 快速开始

### 安装依赖

```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
# 或
yarn add @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

### 基本使用

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PredictionMarketClient } from './PredictionMarketClient';

// 1. 连接到 Solana
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// 2. 加载钱包
const wallet = Keypair.fromSecretKey(/* your secret key */);

// 3. 创建 Provider
const provider = new AnchorProvider(connection, wallet, {});

// 4. 加载程序 IDL
const idl = require('./target/idl/prediction_market.json');
const programId = new PublicKey('EgEc7fuse6eQ3UwqeWGFncDtbTwozWCy4piydbeRaNrU');
const program = new Program(idl, programId, provider);

// 5. 创建客户端
const client = new PredictionMarketClient(program, connection, wallet);

// 6. 开始使用
const marketInfo = await client.getMarketInfo(marketPDA);
console.log('Market info:', marketInfo);
```

---

## ⚙️ 环境配置

### 网络配置

```typescript
// Devnet 配置
const DEVNET_CONFIG = {
  rpcUrl: 'https://api.devnet.solana.com',
  programId: 'EgEc7fuse6eQ3UwqeWGFncDtbTwozWCy4piydbeRaNrU',
  commitment: 'confirmed'
};

// Mainnet 配置 (待部署)
const MAINNET_CONFIG = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  programId: 'YOUR_MAINNET_PROGRAM_ID',
  commitment: 'confirmed'
};
```

### USDC 配置

本合约使用 USDC 作为抵押品代币：

```typescript
// USDC Mint 地址
const USDC_MINT = {
  devnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // Devnet USDC
  mainnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') // Mainnet USDC
};

// USDC 精度
const USDC_DECIMALS = 6; // 1 USDC = 10^6 最小单位
```

---

## 💡 核心概念

### 双账本系统

合约采用双账本架构：

1. **Settlement Ledger (结算账本)**
   - 管理条件代币的 1:1 抵押品锁定
   - 用于 `mint_complete_set` / `redeem_complete_set` / `claim_rewards`
   - 字段：`total_collateral_locked`, `total_yes_minted`, `total_no_minted`

2. **AMM Pool Ledger (池子账本)**
   - 管理流动性池的储备金和交易
   - 用于 `add_liquidity` / `withdraw_liquidity` / `swap`
   - 字段：`pool_collateral_reserve`, `pool_yes_reserve`, `pool_no_reserve`

### 条件代币机制

这是 Polymarket 的核心玩法：

```
用户存入 1 USDC → 获得 1 YES + 1 NO
用户销毁 1 YES + 1 NO → 赎回 1 USDC
```

**精度要求**：YES/NO 代币精度必须与 USDC 精度一致（6位）

### LMSR 定价

合约使用 Logarithmic Market Scoring Rule (LMSR) 算法进行价格发现：

- **成本函数**: `C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))`
- **边际价格**: `P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))`
- **流动性参数**: `b` 决定市场深度，值越大滑点越小

---

## 🔧 客户端 API

### PredictionMarketClient 类

#### 构造函数

```typescript
constructor(
  program: Program<any>,
  connection: Connection,
  wallet: Keypair
)
```

#### PDA 获取方法

```typescript
// 获取全局配置 PDA
getGlobalConfigPDA(): PublicKey

// 获取全局金库 PDA
getGlobalVaultPDA(): PublicKey

// 获取市场 PDA
getMarketPDA(yesTokenMint: PublicKey, noTokenMint: PublicKey): PublicKey

// 获取用户信息 PDA
getUserInfoPDA(marketPDA: PublicKey): PublicKey

// 获取代币元数据 PDA
getTokenMetadataPDA(tokenMint: PublicKey): PublicKey

// 获取全局代币账户 PDA
getGlobalTokenAccountPDA(tokenMint: PublicKey): PublicKey

// 获取用户代币账户地址
async getUserTokenAccount(tokenMint: PublicKey): Promise<PublicKey>
```

#### 核心指令

##### 1. 初始化全局配置

**管理员专用** - 首次部署时调用

```typescript
async initializeConfig(config: {
  authority: PublicKey;
  pendingAuthority: PublicKey;
  teamWallet: PublicKey;
  platformBuyFee: BN;       // 平台买入手续费（基点，如100=1%）
  platformSellFee: BN;      // 平台卖出手续费
  lpBuyFee: BN;             // LP买入手续费
  lpSellFee: BN;            // LP卖出手续费
  tokenSupplyConfig: BN;    // 代币供应量配置
  tokenDecimalsConfig: number; // 代币精度（必须为6，匹配USDC）
  initialRealTokenReservesConfig: BN;
  minSolLiquidity: BN;      // 最小流动性要求
  initialized: boolean;
}): Promise<string>
```

**示例**：
```typescript
const tx = await client.initializeConfig({
  authority: adminPublicKey,
  pendingAuthority: adminPublicKey,
  teamWallet: teamWalletPublicKey,
  platformBuyFee: new BN(100),  // 1%
  platformSellFee: new BN(100), // 1%
  lpBuyFee: new BN(50),         // 0.5%
  lpSellFee: new BN(50),        // 0.5%
  tokenSupplyConfig: new BN(1_000_000_000_000), // 1M USDC (6位精度)
  tokenDecimalsConfig: 6,       // 必须为6（USDC精度）
  initialRealTokenReservesConfig: new BN(1_000_000_000), // 1000 USDC
  minSolLiquidity: new BN(1_000_000_000), // 1000 USDC
  initialized: true
});
```

##### 2. 创建市场

```typescript
async createMarket(params: {
  yesSymbol: string;    // YES代币符号
  yesUri: string;       // YES代币元数据URI
  startSlot?: number;   // 市场开始槽位（可选）
  endingSlot?: number;  // 市场结束槽位（可选）
}): Promise<string>
```

**示例**：
```typescript
const tx = await client.createMarket({
  yesSymbol: 'BTC100K',
  yesUri: 'https://example.com/metadata/btc100k.json',
  startSlot: undefined,  // 立即开始
  endingSlot: currentSlot + 1_512_000  // ~1周后结束
});
```

**⚠️ 重要说明：哨兵代币机制**

为了防止NO代币mint被多个市场复用，合约在创建市场时会自动铸造 **1个最小单位** 的NO代币作为"哨兵标记"。

**技术细节**：
- **哨兵数量**: 1 最小单位 (0.000001 NO)
- **存储位置**: Global Vault的NO代币ATA
- **用途**: 占用NO mint，使其supply > 0，防止被其他市场复用
- **会计影响**: 几乎为0（1/10^6 = 0.0001%）

**前端显示处理**：

```typescript
// ✅ 正确：从账本字段读取代币统计
const totalNoMinted = market.total_no_minted;  // 用户铸造的NO代币
const poolNoReserve = market.pool_no_reserve;  // 池子中的NO代币

// ❌ 错误：直接读取mint.supply
const noMintSupply = await connection.getParsedAccountInfo(noTokenMint);
// noMintSupply.supply = total_no_minted + pool_no_reserve + 1 (哨兵)
//                                                           ↑ 会导致1个最小单位的偏差
```

**最佳实践**：
- ✅ **始终使用市场账本字段**（`total_no_minted`, `pool_no_reserve`）显示代币统计
- ✅ **不要直接读取mint.supply**用于用户界面展示
- ✅ **哨兵代币对用户完全透明**，无需在UI中显示或解释

**示例代码**：
```typescript
// 获取市场统计数据
async function getMarketStats(market: Market) {
  return {
    totalYesMinted: market.total_yes_minted,
    totalNoMinted: market.total_no_minted,      // ✅ 不包含哨兵代币
    poolYesReserve: market.pool_yes_reserve,
    poolNoReserve: market.pool_no_reserve,      // ✅ 不包含哨兵代币
    totalCollateral: market.total_collateral_locked
  };
}

// ❌ 错误的实现
async function getMarketStatsWrong(noTokenMint: PublicKey) {
  const mintInfo = await connection.getParsedAccountInfo(noTokenMint);
  return mintInfo.supply;  // 会比实际多1个最小单位
}
```

##### 3. 铸造完整集合

用户存入 USDC，获得等量的 YES + NO 代币

```typescript
async mintCompleteSet(
  marketPDA: PublicKey,
  yesTokenMint: PublicKey,
  noTokenMint: PublicKey,
  usdcAmount: number  // USDC 数量（6位精度）
): Promise<string>
```

**示例**：
```typescript
// 存入 100 USDC，获得 100 YES + 100 NO
const tx = await client.mintCompleteSet(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  100_000_000  // 100 USDC (100 * 10^6)
);
```

##### 4. 赎回完整集合

销毁等量的 YES + NO 代币，赎回 USDC

```typescript
async redeemCompleteSet(
  marketPDA: PublicKey,
  yesTokenMint: PublicKey,
  noTokenMint: PublicKey,
  amount: number  // 赎回数量
): Promise<string>
```

**示例**：
```typescript
// 销毁 50 YES + 50 NO，赎回 50 USDC
const tx = await client.redeemCompleteSet(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  50_000_000  // 50 * 10^6
);
```

**注意**：只能在市场未完成时使用，市场完成后请使用 `claim_rewards`

##### 5. 交易代币 (Swap)

在 AMM 池中买卖 YES/NO 代币

```typescript
async swapTokens(
  marketPDA: PublicKey,
  yesTokenMint: PublicKey,
  noTokenMint: PublicKey,
  params: {
    amount: number;              // 交易数量
    direction: SwapDirection;    // 0=买入, 1=卖出
    tokenType: TokenType;        // 0=NO, 1=YES
    minimumReceiveAmount: number;// 最小接收数量（滑点保护）
    deadline?: number;           // 交易截止时间戳（可选，0=不检查）
  }
): Promise<string>
```

**示例 - 买入 YES 代币**：
```typescript
const tx = await client.swapTokens(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  {
    amount: 10_000_000,           // 用 10 USDC 购买
    direction: SwapDirection.BUY, // 买入
    tokenType: TokenType.YES,     // YES代币
    minimumReceiveAmount: 9_000_000, // 至少获得 9 YES（10%滑点容忍）
    deadline: Math.floor(Date.now() / 1000) + 60 // 1分钟内有效
  }
);
```

**示例 - 卖出 NO 代币**：
```typescript
const tx = await client.swapTokens(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  {
    amount: 5_000_000,             // 卖出 5 NO
    direction: SwapDirection.SELL, // 卖出
    tokenType: TokenType.NO,       // NO代币
    minimumReceiveAmount: 4_500_000, // 至少获得 4.5 USDC
    deadline: 0 // 不检查截止时间
  }
);
```

##### 6. 添加流动性

向 AMM 池添加 USDC + YES + NO 代币，获得 LP 份额

```typescript
async addLiquidity(
  marketPDA: PublicKey,
  yesTokenMint: PublicKey,
  noTokenMint: PublicKey,
  params: {
    usdcAmount: number;  // USDC 数量
    yesAmount: number;   // YES 代币数量
    noAmount: number;    // NO 代币数量
  }
): Promise<string>
```

**示例**：
```typescript
const tx = await client.addLiquidity(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  {
    usdcAmount: 1000_000_000,  // 1000 USDC
    yesAmount: 500_000_000,    // 500 YES
    noAmount: 500_000_000      // 500 NO
  }
);
```

##### 7. 提取流动性

赎回 LP 份额，获得按比例的 USDC + YES + NO 代币

```typescript
async withdrawLiquidity(
  marketPDA: PublicKey,
  yesTokenMint: PublicKey,
  noTokenMint: PublicKey,
  params: {
    lpSharesToBurn: number;  // 要赎回的 LP 份额数量
  }
): Promise<string>
```

**示例**：
```typescript
const tx = await client.withdrawLiquidity(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  {
    lpSharesToBurn: 100_000_000  // 赎回 100 LP 份额
  }
);
```

##### 8. 市场结算

**管理员专用** - 市场结束后结算结果

```typescript
async resolveMarket(
  marketPDA: PublicKey,
  yesTokenMint: PublicKey,
  noTokenMint: PublicKey,
  yesAmount: number,      // YES代币的赎回比例（基点）
  noAmount: number,       // NO代币的赎回比例（基点）
  tokenType: TokenType,   // 获胜方代币类型
  isCompleted: boolean    // 标记市场为已完成
): Promise<string>
```

**示例 - YES 全胜**：
```typescript
const tx = await client.resolveMarket(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  10000,  // YES = 100% (10000基点 = 100%)
  0,      // NO = 0%
  TokenType.YES,
  true
);
```

**示例 - 平局**：
```typescript
const tx = await client.resolveMarket(
  marketPDA,
  yesTokenMint,
  noTokenMint,
  5000,  // YES = 50%
  5000,  // NO = 50%
  2,     // 平局（不使用 TokenType.YES/NO）
  true
);
```

##### 9. 领取奖励

市场结算后，用户根据持仓领取奖励

```typescript
async claimRewards(
  marketPDA: PublicKey,
  yesTokenMint: PublicKey,
  noTokenMint: PublicKey
): Promise<string>
```

**示例**：
```typescript
// 假设用户持有 100 YES，市场结算 YES 全胜
// 用户将获得 100 USDC
const tx = await client.claimRewards(
  marketPDA,
  yesTokenMint,
  noTokenMint
);
```

#### 查询方法

```typescript
// 查询市场信息
async getMarketInfo(marketPDA: PublicKey): Promise<MarketInfo>

// 查询用户信息
async getUserInfo(userInfoPDA: PublicKey): Promise<UserInfo | null>

// 查询全局配置
async getGlobalConfig(): Promise<Config>

// 计算交易预览
async getSwapPreview(
  marketPDA: PublicKey,
  amount: number,
  tokenType: TokenType
): Promise<{ buyResult?: any; sellResult?: any }>
```

---

## ⚛️ React Hooks

### usePredictionMarket

主要的 React Hook，提供完整的市场操作功能

```typescript
const {
  // 客户端状态
  client,
  connection,
  program,
  isConnected,
  
  // 市场数据
  markets,
  userMarkets,
  userInfo,
  
  // 加载状态
  loading,
  error,
  
  // 操作方法
  initializeConfig,
  createMarket,
  swapTokens,
  addLiquidity,
  withdrawLiquidity,
  resolveMarket,
  
  // 查询方法
  refreshMarkets,
  refreshUserInfo,
  getSwapPreview
} = usePredictionMarket({
  network: 'devnet',
  wallet: keypair
});
```

**完整示例**：
```typescript
import { usePredictionMarket, TokenType, SwapDirection } from './hooks/usePredictionMarket';

function MarketTradingUI() {
  const { 
    client, 
    isConnected, 
    swapTokens, 
    loading, 
    error 
  } = usePredictionMarket({
    network: 'devnet',
    wallet: myWallet
  });
  
  const handleBuy = async () => {
    try {
      const tx = await swapTokens(marketPDA, {
        amount: 10_000_000,
        direction: SwapDirection.BUY,
        tokenType: TokenType.YES,
        minimumReceiveAmount: 9_000_000
      });
      console.log('买入成功:', tx);
    } catch (err) {
      console.error('买入失败:', err);
    }
  };
  
  return (
    <div>
      <button onClick={handleBuy} disabled={loading || !isConnected}>
        {loading ? '处理中...' : '买入 YES'}
      </button>
      {error && <p style={{color: 'red'}}>{error}</p>}
    </div>
  );
}
```

### useMarketInfo

获取单个市场的详细信息

```typescript
const { 
  marketInfo, 
  loading, 
  error, 
  refresh 
} = useMarketInfo(marketPDA);

useEffect(() => {
  if (marketInfo) {
    console.log('YES 储备:', marketInfo.pool_yes_reserve);
    console.log('NO 储备:', marketInfo.pool_no_reserve);
  }
}, [marketInfo]);
```

### useSwapPreview

实时计算交易预览（滑点、价格影响等）

```typescript
const { 
  preview, 
  loading, 
  error 
} = useSwapPreview(
  marketPDA,
  10_000_000,  // 10 USDC
  TokenType.YES
);

if (preview) {
  console.log('预计获得:', preview.tokenAmount);
  console.log('价格影响:', preview.priceImpact);
}
```

---

## 📝 完整流程示例

### 场景 1：用户参与预测市场（买入 YES）

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { PredictionMarketClient, TokenType, SwapDirection } from './PredictionMarketClient';

async function participateInMarket() {
  // 1. 初始化客户端
  const connection = new Connection('https://api.devnet.solana.com');
  const wallet = Keypair.fromSecretKey(/* ... */);
  const client = new PredictionMarketClient(program, connection, wallet);
  
  // 2. 获取市场信息
  const marketPDA = new PublicKey('YOUR_MARKET_PDA');
  const marketInfo = await client.getMarketInfo(marketPDA);
  
  console.log('市场信息:', {
    yesReserve: marketInfo.pool_yes_reserve,
    noReserve: marketInfo.pool_no_reserve,
    isCompleted: marketInfo.is_completed
  });
  
  // 3. 方案 A：先铸造完整集合（获得 YES + NO）
  const mintTx = await client.mintCompleteSet(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint,
    100_000_000  // 100 USDC → 100 YES + 100 NO
  );
  console.log('铸造交易:', mintTx);
  
  // 4. 卖掉 NO 代币（如果看好 YES）
  const sellNoTx = await client.swapTokens(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint,
    {
      amount: 100_000_000,           // 卖出 100 NO
      direction: SwapDirection.SELL,
      tokenType: TokenType.NO,
      minimumReceiveAmount: 40_000_000  // 至少获得 40 USDC
    }
  );
  console.log('卖出 NO 交易:', sellNoTx);
  
  // 现在用户持有 100 YES（成本 ~60 USDC）
  
  // 5. 方案 B：直接买入 YES（不铸造）
  const buyYesTx = await client.swapTokens(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint,
    {
      amount: 60_000_000,           // 用 60 USDC 购买
      direction: SwapDirection.BUY,
      tokenType: TokenType.YES,
      minimumReceiveAmount: 80_000_000  // 至少获得 80 YES
    }
  );
  console.log('买入 YES 交易:', buyYesTx);
}
```

### 场景 2：LP 提供流动性赚取手续费

```typescript
async function provideLiquidity() {
  const client = new PredictionMarketClient(program, connection, wallet);
  const marketPDA = new PublicKey('YOUR_MARKET_PDA');
  const marketInfo = await client.getMarketInfo(marketPDA);
  
  // 1. 铸造完整集合（获得 YES + NO）
  await client.mintCompleteSet(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint,
    1000_000_000  // 1000 USDC → 1000 YES + 1000 NO
  );
  
  // 2. 添加流动性
  const addLpTx = await client.addLiquidity(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint,
    {
      usdcAmount: 1000_000_000,  // 1000 USDC
      yesAmount: 500_000_000,    // 500 YES
      noAmount: 500_000_000      // 500 NO
    }
  );
  console.log('添加流动性成功:', addLpTx);
  
  // 3. 等待累积手续费...
  
  // 4. 领取 LP 手续费
  const claimFeesTx = await client.claimLpFees(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint
  );
  console.log('领取手续费成功:', claimFeesTx);
  
  // 5. 提取流动性
  const withdrawTx = await client.withdrawLiquidity(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint,
    {
      lpSharesToBurn: 100_000_000  // 提取部分 LP 份额
    }
  );
  console.log('提取流动性成功:', withdrawTx);
}
```

### 场景 3：市场结算后领取奖励

```typescript
async function claimAfterSettlement() {
  const client = new PredictionMarketClient(program, connection, wallet);
  const marketPDA = new PublicKey('YOUR_MARKET_PDA');
  const marketInfo = await client.getMarketInfo(marketPDA);
  
  // 1. 检查市场是否已结算
  if (!marketInfo.is_completed) {
    throw new Error('市场尚未结算');
  }
  
  // 2. 查看结算结果
  console.log('结算结果:', {
    yesRatio: marketInfo.resolution_yes_ratio,  // 基点（10000 = 100%）
    noRatio: marketInfo.resolution_no_ratio,
    winner: marketInfo.winner_token_type
  });
  
  // 3. 查看用户持仓
  const userInfoPDA = client.getUserInfoPDA(marketPDA);
  const userYesAta = await client.getUserTokenAccount(marketInfo.yesTokenMint);
  const userNoAta = await client.getUserTokenAccount(marketInfo.noTokenMint);
  
  const yesBalance = (await connection.getTokenAccountBalance(userYesAta)).value.uiAmount;
  const noBalance = (await connection.getTokenAccountBalance(userNoAta)).value.uiAmount;
  
  console.log('用户持仓:', {
    yes: yesBalance,
    no: noBalance
  });
  
  // 4. 领取奖励
  const claimTx = await client.claimRewards(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint
  );
  console.log('领取奖励成功:', claimTx);
  
  // 5. 计算实际收益
  // 假设 YES 全胜（10000 基点）
  // 用户持有 100 YES → 获得 100 USDC
  // 用户持有 50 NO → 获得 0 USDC
}
```

---

## 🚨 错误处理

### 常见错误码

```typescript
enum PredictionMarketError {
  InvalidAmount = 6000,           // 金额无效
  InsufficientBalance = 6001,     // 余额不足
  InsufficientLiquidity = 6002,   // 流动性不足
  SlippageExceeded = 6003,        // 滑点超限
  MarketNotStarted = 6004,        // 市场未开始
  MarketEnded = 6005,             // 市场已结束
  CurveAlreadyCompleted = 6006,   // 市场已完成
  ContractPaused = 6007,          // 合约已暂停
  InvalidAuthority = 6008,        // 权限无效
  MathOverflow = 6009,            // 数学溢出
  InvalidParameter = 6010,        // 参数无效
  DeadlineExceeded = 6011,        // 交易超时
  // ... 更多错误码请参考 errors.rs
}
```

### 错误处理示例

```typescript
try {
  const tx = await client.swapTokens(marketPDA, params);
  console.log('交易成功:', tx);
} catch (error) {
  if (error.code === 6003) {
    // 滑点超限
    alert('价格变化过大,请调整滑点容忍度');
  } else if (error.code === 6001) {
    // 余额不足
    alert('USDC 余额不足');
  } else if (error.code === 6005) {
    // 市场已结束
    alert('市场已结束,无法交易');
  } else if (error.code === 6011) {
    // 交易超时
    alert('交易已过期,请重新提交');
  } else {
    // 其他错误
    console.error('交易失败:', error);
    alert(`错误: ${error.message}`);
  }
}
```

### 交易确认最佳实践

```typescript
async function sendTransactionWithConfirmation(
  client: PredictionMarketClient,
  txPromise: Promise<string>
) {
  try {
    // 1. 发送交易
    const signature = await txPromise;
    console.log('交易已发送:', signature);
    
    // 2. 等待确认
    const connection = client.connection;
    const confirmation = await connection.confirmTransaction(
      signature,
      'confirmed'  // 或 'finalized' 以获得最终确认
    );
    
    if (confirmation.value.err) {
      throw new Error(`交易失败: ${confirmation.value.err}`);
    }
    
    console.log('交易已确认:', signature);
    return signature;
    
  } catch (error) {
    console.error('交易错误:', error);
    throw error;
  }
}

// 使用示例
await sendTransactionWithConfirmation(
  client,
  client.swapTokens(marketPDA, params)
);
```

---

## ✅ 最佳实践

### 1. 精度处理

**重要**：所有金额必须使用 6 位精度（匹配 USDC）

```typescript
// ❌ 错误：使用浮点数
const amount = 10.5;  // 不精确

// ✅ 正确：使用最小单位（lamports）
const amount = 10_500_000;  // 10.5 USDC = 10.5 * 10^6

// 工具函数
function toUsdcLamports(usdcAmount: number): number {
  return Math.floor(usdcAmount * 1_000_000);
}

function fromUsdcLamports(lamports: number): number {
  return lamports / 1_000_000;
}

// 使用
const userInput = 10.5;  // 用户输入 10.5 USDC
const lamports = toUsdcLamports(userInput);  // 10_500_000
const tx = await client.swapTokens(marketPDA, {
  amount: lamports,
  ...
});
```

### 2. 滑点保护

```typescript
// 计算最小接收数量（容忍 1% 滑点）
function calculateMinimumReceive(
  expectedAmount: number,
  slippageTolerance: number = 0.01  // 1%
): number {
  return Math.floor(expectedAmount * (1 - slippageTolerance));
}

// 使用
const expectedYes = 100_000_000;  // 预期获得 100 YES
const minReceive = calculateMinimumReceive(expectedYes, 0.01);  // 99 YES

await client.swapTokens(marketPDA, {
  amount: 60_000_000,
  direction: SwapDirection.BUY,
  tokenType: TokenType.YES,
  minimumReceiveAmount: minReceive  // 滑点保护
});
```

### 3. 交易截止时间

```typescript
// 设置 1 分钟有效期
const deadline = Math.floor(Date.now() / 1000) + 60;

await client.swapTokens(marketPDA, {
  amount: 10_000_000,
  direction: SwapDirection.BUY,
  tokenType: TokenType.YES,
  minimumReceiveAmount: 9_000_000,
  deadline: deadline  // Unix 时间戳
});
```

### 4. Gas 费优化

```typescript
// 批量操作：先铸造，再卖出（2个交易）
// vs 直接买入（1个交易）

// 方案 A：铸造 + 卖出（成本更低，但需要2笔交易）
await client.mintCompleteSet(marketPDA, mint, mint, 100_000_000);
await client.swapTokens(marketPDA, mint, mint, {
  amount: 100_000_000,
  direction: SwapDirection.SELL,
  tokenType: TokenType.NO,
  minimumReceiveAmount: 40_000_000
});

// 方案 B：直接买入（更快，但可能成本更高）
await client.swapTokens(marketPDA, mint, mint, {
  amount: 60_000_000,
  direction: SwapDirection.BUY,
  tokenType: TokenType.YES,
  minimumReceiveAmount: 90_000_000
});

// 选择依据：比较 Gas 费 + 价格影响
```

### 5. 市场状态检查

```typescript
async function canTrade(
  client: PredictionMarketClient,
  marketPDA: PublicKey
): Promise<boolean> {
  const marketInfo = await client.getMarketInfo(marketPDA);
  const currentSlot = await client.connection.getSlot();
  
  // 检查市场是否完成
  if (marketInfo.is_completed) {
    return false;
  }
  
  // 检查市场是否开始
  if (marketInfo.start_slot && currentSlot < marketInfo.start_slot) {
    return false;
  }
  
  // 检查市场是否结束
  if (marketInfo.ending_slot && currentSlot >= marketInfo.ending_slot) {
    return false;
  }
  
  return true;
}

// 使用
if (await canTrade(client, marketPDA)) {
  await client.swapTokens(...);
} else {
  alert('市场当前不可交易');
}
```

### 6. LP 风险警告与最大损失计算器 ⚠️

**背景**：LP 在市场结算时可能面临无常损失（Impermanent Loss），因为 YES/NO 代币价值会根据结算结果变化。

#### 6.1 LP 风险计算公式

```typescript
/**
 * 计算 LP 在当前市场状态下的最大潜在损失
 *
 * @param marketInfo - 市场信息（包含 LMSR 参数）
 * @returns 最大损失（USDC 最小单位，6位精度）
 *
 * 公式：max_loss = |q_yes - q_no| * price_skew
 *
 * 其中：
 * - q_yes, q_no: LMSR 净持仓量（可能为负数）
 * - price_skew: 价格偏斜度（当前价格偏离 50% 的程度）
 *
 * 风险等级：
 * - max_loss < 10% of total_collateral: 低风险（绿色）
 * - 10% <= max_loss < 30%: 中等风险（黄色）
 * - max_loss >= 30%: 高风险（红色）
 */
function calculateMaxLpLoss(marketInfo: MarketInfo): {
  maxLoss: number;           // USDC 最小单位
  maxLossUsdc: number;       // USDC 数量（转换后）
  riskLevel: 'low' | 'medium' | 'high';
  riskPercentage: number;    // 损失占总抵押品的百分比
} {
  const { lmsr_q_yes, lmsr_q_no, pool_collateral_reserve } = marketInfo;

  // 1. 计算持仓不平衡度（绝对值）
  const positionImbalance = Math.abs(lmsr_q_yes - lmsr_q_no);

  // 2. 计算当前 YES 价格（基于 LMSR）
  // 注意：这需要调用链上或重新实现 LMSR 价格公式
  const yesPrice = calculateLmsrPrice(marketInfo.lmsr_b, lmsr_q_yes, lmsr_q_no);

  // 3. 计算价格偏斜度（偏离 50% 的程度，范围 0-0.5）
  const priceSkew = Math.abs(yesPrice - 0.5);

  // 4. 计算最大损失（简化公式）
  // 完整公式应考虑结算比例，这里使用保守估算
  const maxLoss = Math.floor(positionImbalance * priceSkew);

  // 5. 计算风险百分比
  const riskPercentage = pool_collateral_reserve > 0
    ? (maxLoss / pool_collateral_reserve) * 100
    : 0;

  // 6. 确定风险等级
  let riskLevel: 'low' | 'medium' | 'high';
  if (riskPercentage < 10) {
    riskLevel = 'low';
  } else if (riskPercentage < 30) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    maxLoss,
    maxLossUsdc: maxLoss / 1_000_000,  // 转换为 USDC 数量
    riskLevel,
    riskPercentage
  };
}

/**
 * 计算 LMSR 边际价格（YES 代币价格）
 *
 * 公式：P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
 *
 * 注意：JavaScript 浮点数精度有限，建议调用链上 view 函数
 */
function calculateLmsrPrice(b: number, q_yes: number, q_no: number): number {
  // 为防止溢出，使用 log-sum-exp 技巧
  const max_q = Math.max(q_yes, q_no);
  const exp_yes = Math.exp((q_yes - max_q) / b);
  const exp_no = Math.exp((q_no - max_q) / b);

  return exp_yes / (exp_yes + exp_no);
}
```

#### 6.2 前端 UI 集成示例（React）

```tsx
import React, { useEffect, useState } from 'react';
import { useMarketInfo } from './hooks/useMarketInfo';

interface LpRiskWarningProps {
  marketPDA: PublicKey;
}

const LpRiskWarning: React.FC<LpRiskWarningProps> = ({ marketPDA }) => {
  const { marketInfo, loading } = useMarketInfo(marketPDA);
  const [riskData, setRiskData] = useState<ReturnType<typeof calculateMaxLpLoss> | null>(null);

  useEffect(() => {
    if (marketInfo) {
      const risk = calculateMaxLpLoss(marketInfo);
      setRiskData(risk);
    }
  }, [marketInfo]);

  if (loading || !riskData) {
    return <div>计算风险中...</div>;
  }

  // 根据风险等级设置颜色
  const riskColors = {
    low: '#10b981',    // 绿色
    medium: '#f59e0b', // 黄色
    high: '#ef4444'    // 红色
  };

  const riskLabels = {
    low: '低风险',
    medium: '中等风险',
    high: '高风险 ⚠️'
  };

  return (
    <div style={{
      border: `2px solid ${riskColors[riskData.riskLevel]}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      backgroundColor: `${riskColors[riskData.riskLevel]}15`  // 15% opacity
    }}>
      <h3 style={{ color: riskColors[riskData.riskLevel] }}>
        LP 风险评估：{riskLabels[riskData.riskLevel]}
      </h3>

      <div>
        <p><strong>最大潜在损失：</strong>{riskData.maxLossUsdc.toFixed(2)} USDC</p>
        <p><strong>损失占比：</strong>{riskData.riskPercentage.toFixed(2)}%</p>
      </div>

      {riskData.riskLevel === 'high' && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#fee2e2',
          borderRadius: '4px'
        }}>
          <p><strong>⚠️ 高风险警告：</strong></p>
          <ul>
            <li>市场当前极度失衡（YES 和 NO 价格差距过大）</li>
            <li>如果结算结果与当前市场预期相反，您可能损失 {riskData.riskPercentage.toFixed(0)}% 的本金</li>
            <li>建议：等待市场更加平衡时再添加流动性，或降低投入金额</li>
          </ul>
        </div>
      )}

      {riskData.riskLevel === 'medium' && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#fef3c7',
          borderRadius: '4px'
        }}>
          <p><strong>⚡ 中等风险提示：</strong></p>
          <p>市场存在一定不平衡，建议评估您的风险承受能力后再添加流动性。</p>
        </div>
      )}
    </div>
  );
};

export default LpRiskWarning;
```

#### 6.3 使用示例（完整流程）

```typescript
async function addLiquidityWithRiskCheck() {
  const client = new PredictionMarketClient(program, connection, wallet);
  const marketPDA = new PublicKey('YOUR_MARKET_PDA');

  // 1. 获取市场信息
  const marketInfo = await client.getMarketInfo(marketPDA);

  // 2. 计算风险
  const risk = calculateMaxLpLoss(marketInfo);

  // 3. 向用户展示风险警告
  console.warn('LP 风险评估:', {
    maxLoss: `${risk.maxLossUsdc.toFixed(2)} USDC`,
    riskLevel: risk.riskLevel,
    riskPercentage: `${risk.riskPercentage.toFixed(2)}%`
  });

  // 4. 高风险时要求用户确认
  if (risk.riskLevel === 'high') {
    const userConfirmed = confirm(
      `警告：当前市场失衡度高，最大潜在损失为 ${risk.maxLossUsdc.toFixed(2)} USDC（${risk.riskPercentage.toFixed(0)}%）。\n` +
      `是否继续添加流动性？`
    );

    if (!userConfirmed) {
      console.log('用户取消操作');
      return;
    }
  }

  // 5. 执行添加流动性
  const tx = await client.addLiquidity(
    marketPDA,
    marketInfo.yesTokenMint,
    marketInfo.noTokenMint,
    {
      usdcAmount: 1000_000_000,  // 1000 USDC
      yesAmount: 500_000_000,    // 500 YES
      noAmount: 500_000_000      // 500 NO
    }
  );

  console.log('添加流动性成功:', tx);
}
```

#### 6.4 注意事项

1. **价格计算精度**：JavaScript 浮点数精度有限，建议调用链上 `get_marginal_price` view 函数获取精确价格。

2. **动态更新**：市场价格实时变化，应定期刷新风险评估（建议每 30 秒更新一次）。

3. **保险池补偿**：v1.4.0+ 版本支持 LP 保险池，当损失超过 10% 时自动补偿最多 50%，但补偿受保险池余额限制。

4. **公式简化**：上述公式为简化版，实际损失还需考虑：
   - 结算比例（`resolution_yes_ratio` / `resolution_no_ratio`）
   - 手续费累计收益的抵消作用
   - LP 份额占比（不同 LP 分摊损失）

5. **链上验证**：建议实现链上 view 函数 `calculate_lp_risk(market_pda)` 返回精确的最大损失估算。

---

### 7. ATA 初始化

用户首次参与市场时需要初始化 ATA（Associated Token Account）：

```typescript
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

async function ensureUserAta(
  connection: Connection,
  user: PublicKey,
  tokenMint: PublicKey,
  payer: Keypair
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(tokenMint, user);
  
  // 检查 ATA 是否存在
  const accountInfo = await connection.getAccountInfo(ata);
  if (!accountInfo) {
    // 创建 ATA
    const ix = createAssociatedTokenAccountInstruction(
      payer.publicKey,  // 支付者
      ata,              // ATA 地址
      user,             // 所有者
      tokenMint         // 代币 mint
    );
    
    const tx = new Transaction().add(ix);
    await connection.sendTransaction(tx, [payer]);
    console.log('创建 ATA:', ata.toBase58());
  }
  
  return ata;
}
```

---

## ❓ 常见问题

### Q1: 为什么代币精度必须是 6？

**A**: 本合约使用 USDC 作为抵押品（6位精度），YES/NO 代币必须与抵押品精度一致以确保 1:1 套保机制正确运作。如果使用 9 位精度，1 USDC（10^6）铸造的代币数量会是 1000000，而不是预期的 1（导致 1000 倍错误）。

### Q2: mint_complete_set 和直接 swap 买入的区别？

**A**:
- **mint_complete_set**: 1 USDC → 1 YES + 1 NO（无滑点，1:1兑换）
- **swap**: 使用 LMSR 定价，价格根据池子储备动态变化（有滑点）

**套利策略**: 当 YES 价格 > 0.5 USDC 时，可以 mint 获得 YES + NO，然后卖出 YES 获利。

### Q3: 市场完成后如何操作？

**A**:
1. **不能再 swap** - 市场已关闭交易
2. **不能 redeem_complete_set** - 应该用 claim_rewards 领取奖励
3. **必须 claim_rewards** - 根据结算比例领取 USDC
4. **LP 提取** - 必须先调用 settle_pool，然后 withdraw_liquidity

### Q4: 如何计算当前 YES/NO 价格？

**A**:
```typescript
async function getCurrentPrices(
  client: PredictionMarketClient,
  marketPDA: PublicKey
): Promise<{ yesPrice: number; noPrice: number }> {
  const marketInfo = await client.getMarketInfo(marketPDA);
  
  // LMSR 边际价格公式
  // P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
  
  const b = marketInfo.lmsr_b;
  const qYes = marketInfo.lmsr_q_yes;
  const qNo = marketInfo.lmsr_q_no;
  
  const expYes = Math.exp(qYes / b);
  const expNo = Math.exp(qNo / b);
  const sum = expYes + expNo;
  
  return {
    yesPrice: expYes / sum,
    noPrice: expNo / sum
  };
}

// 使用
const prices = await getCurrentPrices(client, marketPDA);
console.log(`YES: ${(prices.yesPrice * 100).toFixed(2)}%`);
console.log(`NO: ${(prices.noPrice * 100).toFixed(2)}%`);
```

### Q5: 如何处理交易失败？

**A**: 参考上文 [错误处理](#错误处理) 章节，主要策略：
1. 捕获特定错误码
2. 提供友好的错误提示
3. 允许用户调整参数重试
4. 记录错误日志供调试

### Q6: LP 手续费如何分配？

**A**: 合约使用 `fee_per_share_cumulative` 机制公平分配：
- 每次 swap 时，LP 手续费累加到 `accumulated_lp_fees`
- 同时更新 `fee_per_share_cumulative += lp_fee / total_lp_shares`
- LP 领取时，根据其份额和上次领取时的 `fee_per_share` 计算未领取费用
- 防止了后来的 LP "搭便车"领取早期手续费

### Q7: v2.2 更新后前端需要做哪些调整？⚠️ 新增

**A**: 主要涉及 `MarketRiskMetrics` 事件的处理：

**必须修改的代码**:
```typescript
// ❌ v2.1 旧代码
program.addEventListener('MarketRiskMetrics', (event) => {
  const imbalance = event.positionImbalance;  // i64，可能为负
  if (imbalance < 0) {
    console.warn('负数持仓不平衡');
  }
});

// ✅ v2.2 新代码
program.addEventListener('MarketRiskMetrics', (event) => {
  const imbalance = event.positionImbalance.toNumber();  // u64，始终为正
  // 无需负数检查
});
```

**类型定义更新**:
```typescript
// 更新 IDL 或手动类型定义
interface MarketRiskMetrics {
  positionImbalance: BN;  // ✅ 改为 BN (u64)
  // 其他字段...
}
```

**测试建议**:
- 在测试网验证事件解析逻辑
- 检查所有使用 `position_imbalance` 的 UI 组件
- 确认风险指标计算正确

### Q8: 如何计算 LP 最大损失并展示风险警告？⚠️ 新增

**A**: 使用 LP 风险计算器评估市场失衡带来的潜在损失：

**快速使用**:
```typescript
import { calculateMaxLpLoss } from './utils/lpRiskCalculator';

const marketInfo = await client.getMarketInfo(marketPDA);
const risk = calculateMaxLpLoss(marketInfo);

console.log(`LP 风险等级: ${risk.riskLevel}`);
console.log(`最大潜在损失: ${risk.maxLossUsdc.toFixed(2)} USDC (${risk.riskPercentage.toFixed(2)}%)`);

// 根据风险等级决定是否展示警告
if (risk.riskLevel === 'high') {
  alert(`⚠️ 高风险警告：当前市场极度失衡，最大潜在损失为 ${risk.riskPercentage.toFixed(0)}%`);
}
```

**公式说明**:
```
max_loss = |q_yes - q_no| × price_skew
```

其中：
- `|q_yes - q_no|`: 持仓不平衡度（绝对值）
- `price_skew`: 价格偏离 50% 的程度（范围 0-0.5）

**风险等级阈值**:
- **低风险（绿色）**: 损失 < 10% of pool_collateral_reserve
- **中等风险（黄色）**: 损失 10%-30%
- **高风险（红色）**: 损失 ≥ 30%

**React 组件示例**:

详见上文 [6. LP 风险警告与最大损失计算器](#6-lp-风险警告与最大损失计算器-) 章节，包含：
1. 完整的 TypeScript 计算函数
2. React 风险警告组件（含颜色编码）
3. 添加流动性前的风险检查流程

**重要提示**:
- ✅ 每 30 秒刷新一次风险评估（市场价格实时变化）
- ✅ 高风险时强制用户确认后才允许添加流动性
- ✅ 结合 LP 保险池补偿机制（v1.4.0+）：损失超过 10% 时自动补偿最多 50%

### Q9: 如何监听市场事件？

**A**:
```typescript
// 订阅程序日志
const programId = new PublicKey('EgEc7fuse6eQ3UwqeWGFncDtbTwozWCy4piydbeRaNrU');

connection.onLogs(
  programId,
  (logs) => {
    console.log('收到日志:', logs);

    // 解析事件
    if (logs.logs.some(log => log.includes('SwapEvent'))) {
      console.log('检测到交易事件');
      // 刷新市场数据
    }
  },
  'confirmed'
);

// 订阅账户变化
connection.onAccountChange(
  marketPDA,
  (accountInfo) => {
    console.log('市场账户已更新');
    // 重新解析市场数据
  },
  'confirmed'
);
```

### Q10: 支持哪些钱包？

**A**: 合约支持所有兼容 Solana 标准的钱包：
- Phantom
- Solflare
- Backpack
- Ledger
- 等

前端集成示例：
```typescript
import { useWallet } from '@solana/wallet-adapter-react';

function MyComponent() {
  const { publicKey, signTransaction } = useWallet();
  
  // 使用 wallet adapter 代替 Keypair
  const provider = new AnchorProvider(
    connection,
    wallet,  // wallet adapter 实例
    {}
  );
  
  // ... 其他逻辑
}
```

---

## 📚 附录

### 数据结构定义

#### MarketInfo
```typescript
interface MarketInfo {
  // 代币 Mint
  yesTokenMint: PublicKey;
  noTokenMint: PublicKey;
  creator: PublicKey;
  
  // Settlement Ledger（结算账本）
  total_collateral_locked: number;  // 锁定的 USDC 抵押品总量
  total_yes_minted: number;         // 铸造的 YES 总量
  total_no_minted: number;          // 铸造的 NO 总量
  
  // AMM Pool Ledger（池子账本）
  pool_collateral_reserve: number;  // 池子中的 USDC 储备
  pool_yes_reserve: number;         // 池子中的 YES 储备
  pool_no_reserve: number;          // 池子中的 NO 储备
  total_lp_shares: number;          // LP 总份额
  
  // LMSR 参数
  lmsr_b: number;                   // 流动性参数
  lmsr_q_yes: number;               // YES 净持仓量
  lmsr_q_no: number;                // NO 净持仓量
  
  // 市场状态
  is_completed: boolean;
  start_slot: number | null;
  ending_slot: number | null;
  
  // 结算参数
  resolution_yes_ratio: number;     // YES 赎回比例（基点）
  resolution_no_ratio: number;      // NO 赎回比例（基点）
  winner_token_type: number;        // 获胜方（0=NO, 1=YES, 2=平局）
  
  // LP 费用
  accumulated_lp_fees: number;
  fee_per_share_cumulative: bigint; // u128，10^18 精度
}
```

#### UserInfo
```typescript
interface UserInfo {
  user: PublicKey;
  is_lp: boolean;
  is_initialized: boolean;
  // 注意：余额由 SPL Token ATA 追踪，不在此结构中
}
```

#### Config
```typescript
interface Config {
  authority: PublicKey;
  pending_authority: PublicKey;
  team_wallet: PublicKey;
  usdc_mint: PublicKey;             // USDC Mint 地址
  platform_buy_fee: number;         // 平台买入费（基点）
  platform_sell_fee: number;        // 平台卖出费（基点）
  lp_buy_fee: number;               // LP 买入费（基点）
  lp_sell_fee: number;              // LP 卖出费（基点）
  token_supply_config: number;
  token_decimals_config: number;    // 必须为 6
  initial_real_token_reserves_config: number;
  min_sol_liquidity: number;
  usdc_vault_min_balance: number;   // USDC 金库最小余额
  is_paused: boolean;
  whitelist_enabled: boolean;       // 是否启用白名单
  initialized: boolean;
}
```

### 枚举定义

```typescript
enum TokenType {
  NO = 0,
  YES = 1
}

enum SwapDirection {
  BUY = 0,
  SELL = 1
}
```

### PDA 种子常量

```typescript
const SEEDS = {
  CONFIG: 'config',
  GLOBAL: 'global',
  MARKET: 'market',
  USERINFO: 'userinfo',
  LPPOSITION: 'lp_position',
  WHITELIST: 'prediction_market_creator_whitelist',
  METADATA: 'metadata'
};
```

### 程序 ID

```typescript
// Devnet
const PROGRAM_ID = new PublicKey('EgEc7fuse6eQ3UwqeWGFncDtbTwozWCy4piydbeRaNrU');

// Mainnet (待部署)
const MAINNET_PROGRAM_ID = new PublicKey('YOUR_MAINNET_PROGRAM_ID');
```

---

## 📞 技术支持

如有问题，请通过以下方式联系：

- **GitHub Issues**: [项目仓库](https://github.com/your-repo)
- **Discord**: [社区频道](https://discord.gg/your-invite)
- **邮箱**: support@example.com

---

## 📝 版本历史

### v2.2 (2025-11-03)

**重要变更**:
- ✅ 修复 `MarketRiskMetrics.position_imbalance` 字段类型（i64 → u64）
- ✅ 更新 `Config.min_trading_liquidity` 注释，反映实际实现状态
- ✅ 优化 LMSR 双负仓位处理（v1.6.1 边际价格算法）

**前端影响**:
- **破坏性变更**: 必须更新事件监听代码中的 `position_imbalance` 处理逻辑
- 删除负数处理分支
- 更新 TypeScript 类型定义为 `BN` (u64)

**兼容性**: 需要同步更新前端 SDK 到 v2.2+

---

### v2.0 (2025-10-28)

**重要变更**:
- ✅ 引入市场级保险池追踪（`Market.insurance_pool_contribution`）
- ✅ 修复跨市场保险金混用问题
- ✅ 66个单元测试通过

**前端影响**:
- 新增市场字段：`insurance_pool_contribution: u64`
- 更新 `WithdrawLiquidity` 事件结构

---

### v1.1.1 (2025-10-30)

**初始版本**:
- ✅ LMSR 定价机制
- ✅ 双账本系统（Settlement + AMM Pool）
- ✅ LP 保险池机制（v1.4.0）
- ✅ 动态费率系统（v1.3.0）
- ✅ 完整的条件代币铸造/赎回/交易流程

---

**最后更新**: 2025-11-03
**文档版本**: v2.2.0
**合约版本**: v2.2
