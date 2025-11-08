//! # 事件定义模块
//!
//! 定义预测市场合约中发出的各种事件
//! 事件用于记录重要的状态变化和操作，便于前端监听和索引
//!
//! ## ✅ v3.0.1: 事件性能优化
//!
//! **优化策略**：
//! - 条件编译：调试模式发射详细事件，生产模式精简
//! - 事件分级：关键事件(Critical) vs 调试事件(Debug)
//! - 字段精简：移除可从其他来源获取的冗余数据
//!
//! **使用方法**：
//! ```rust
//! // 关键事件：始终发射
//! emit!(SwapExecuted { ... });
//!
//! // 调试事件：仅在 feature="event-debug" 时发射
//! #[cfg(feature = "event-debug")]
//! emit!(SwapDebugInfo { ... });
//! ```
//!
//! **性能影响**：
//! - 生产模式：减少 ~30% 事件序列化开销
//! - 调试模式：完整事件用于开发和测试

use anchor_lang::prelude::*;

/// 全局更新事件
/// 
/// 当全局配置发生更新时发出
/// 包括管理员变更、代币配置更新等
#[event]
pub struct GlobalUpdateEvent {
    /// 全局管理员公钥
    pub global_authority: Pubkey,
    
    /// 初始真实代币储备
    pub initial_real_token_reserves: u64,
    
    /// 代币总供应量
    pub token_total_supply: u64,
    
    /// 代币精度
    pub mint_decimals: u8,
}

/// 市场创建事件
/// 
/// 当新的预测市场被创建时发出
/// 包含市场的基本信息和代币配置
#[event]
pub struct CreateEvent {
    /// 市场创建者
    pub creator: Pubkey,
    
    /// 市场账户地址
    pub market: Pubkey,

    /// YES代币地址
    pub token_yes: Pubkey,
    
    /// YES代币元数据地址
    pub metadata_yes: Pubkey,
    
    /// YES代币总供应量
    pub token_yes_total_supply: u64,

    /// NO代币地址
    pub token_no: Pubkey,

    /// NO代币元数据地址
    pub metadata_no: Pubkey,

    /// NO代币总供应量
    pub token_no_total_supply: u64,

    /// 开始槽位
    pub start_slot: u64,
    
    /// 结束槽位
    pub ending_slot: u64,
}

/// 提取事件
/// 
/// 当从金库提取资金时发出
/// 用于记录手续费提取等操作
#[event]
pub struct WithdrawEvent {
    /// 提取授权者
    pub withdraw_authority: Pubkey,
    
    /// 代币铸造地址
    pub mint: Pubkey,
    
    /// 手续费金库地址
    pub fee_vault: Pubkey,

    /// 本次提取数量
    pub withdrawn: u64,
    
    /// 累计提取数量
    pub total_withdrawn: u64,

    /// 提取时间戳
    pub withdraw_time: i64,
}

/// 交易事件
///
/// 当用户进行代币交易时发出
/// 包含交易的详细信息，便于分析和索引
#[event]
pub struct TradeEvent {
    /// 交易用户（支付USDC的人）
    pub user: Pubkey,

    /// ✅ v1.2.0: 代币接收者（接收YES/NO代币的人，支持代买）
    pub recipient: Pubkey,

    /// YES代币地址
    pub token_yes: Pubkey,

    /// NO代币地址
    pub token_no: Pubkey,

    /// 市场信息账户
    pub market_info: Pubkey,

    /// ✅ v1.1.0: USDC 交易数量（原 sol_amount）
    pub usdc_amount: u64,

    /// 代币交易数量
    pub token_amount: u64,

    /// ✅ v1.1.0: 手续费（USDC 单位，原 fee_lamports）
    pub fee_usdc: u64,

    /// 是否为买入操作
    pub is_buy: bool,

    /// 是否为YES代币交易
    pub is_yes_no: bool,

    /// ✅ v1.1.0: 真实 USDC 储备（原 real_sol_reserves）
    pub real_usdc_reserves: u64,

    /// 真实YES代币储备
    pub real_token_yes_reserves: u64,

    /// 真实NO代币储备
    pub real_token_no_reserves: u64,

    /// 交易时间戳
    pub timestamp: i64,
}

/// 完成事件
/// 
/// 当市场完成或曲线完成时发出
/// 记录最终的状态信息
#[event]
pub struct CompleteEvent {
    /// 操作用户
    pub user: Pubkey,
    
    /// 代币铸造地址
    pub mint: Pubkey,
    
    /// ✅ v1.1.0: 虚拟 USDC 储备（原 virtual_sol_reserves）
    pub virtual_usdc_reserves: u64,

    /// 虚拟代币储备
    pub virtual_token_reserves: u64,

    /// ✅ v1.1.0: 真实 USDC 储备（原 real_sol_reserves）
    pub real_usdc_reserves: u64,

    /// 真实代币储备
    pub real_token_reserves: u64,
    
    /// 完成时间戳
    pub timestamp: i64,
}

/// 添加流动性事件（✅ v3.0: 单币LP - 用户只提供USDC）
///
/// 当LP添加流动性时发出
#[event]
pub struct AddLiquidityEvent {
    /// 市场账户
    pub market: Pubkey,

    /// LP用户（支付USDC的人）
    pub user: Pubkey,

    /// ✅ v3.0: 用户投入的 USDC 数量
    pub usdc_amount: u64,

    /// ✅ v3.0: 内部铸造的 YES 代币数量（仅供监控，用户不直接收到）
    pub yes_amount: u64,

    /// ✅ v3.0: 内部铸造的 NO 代币数量（仅供监控，用户不直接收到）
    pub no_amount: u64,

    /// 铸造的LP份额数量
    pub lp_shares: u64,

    /// 🔍 Pool 状态快照：总 LP 份额
    pub total_lp_shares: u64,

    /// 🔍 Pool 状态快照：USDC 储备
    pub pool_collateral_reserve: u64,

    /// 🔍 Pool 状态快照：YES 储备
    pub pool_yes_reserve: u64,

    /// 🔍 Pool 状态快照：NO 储备
    pub pool_no_reserve: u64,

    /// ✅ v3.0.5: 资金守恒验证字段（仅首次LP）
    /// 锁定的抵押品数量（完整集数量）
    pub locked_collateral: u64,

    /// ✅ v3.0.5: 资金守恒验证字段（仅首次LP）
    /// 注入池子的纯 USDC 数量
    pub pool_usdc: u64,
}

/// 提取流动性事件（✅ v3.0: 单币LP - 用户只收到USDC）
///
/// 当LP提取流动性时发出
#[event]
pub struct WithdrawLiquidityEvent {
    /// 市场账户
    pub market: Pubkey,

    /// LP用户
    pub user: Pubkey,

    /// 销毁的LP份额数量
    pub lp_shares_burned: u64,

    /// ✅ v3.0: 用户收到的 USDC 净额（扣除惩罚后 + 保险补偿后）
    pub usdc_out: u64,

    /// ✅ v3.0: 早退惩罚金额（USDC，0%-3%）
    pub early_exit_penalty: u64,

    /// ✅ v3.0: 早退惩罚费率（基点，0-300）
    pub early_exit_penalty_bps: u16,

    /// ✅ v3.0: LP保险池补偿金额（USDC）
    pub insurance_compensation: u64,

    /// ✅ v3.0: LP损失率（基点，0-10000）
    pub loss_rate_bps: u16,

    /// ✅ v3.0: 是否触发熔断器
    pub circuit_breaker_triggered: bool,

    /// ✅ v3.1.0: 内部交换滑点（基点，0-10000）
    /// 如果没有发生内部交换（完全配对赎回），此值为0
    pub internal_swap_slippage_bps: u16,

    /// ✅ v3.1.0: 剩余YES代币数量（需要内部交换的）
    pub leftover_yes: u64,

    /// ✅ v3.1.0: 剩余NO代币数量（需要内部交换的）
    pub leftover_no: u64,

    /// ✅ v3.1.0: 内部交换获得的USDC（扣除滑点后）
    pub internal_swap_usdc: u64,

    /// 🔍 Pool 状态快照：USDC 储备
    pub pool_collateral_reserve: u64,

    /// 🔍 Pool 状态快照：YES 储备
    pub pool_yes_reserve: u64,

    /// 🔍 Pool 状态快照：NO 储备
    pub pool_no_reserve: u64,
}

/// 市场解决事件
///
/// 当市场结算时发出
#[event]
pub struct ResolutionEvent {
    /// 管理员
    pub authority: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// 获胜方代币类型 (0=NO, 1=YES, 2=平局)
    pub winner_token_type: u8,

    /// YES方比例
    pub yes_ratio: u64,

    /// NO方比例
    pub no_ratio: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// 用户领取奖励事件
///
/// 当用户在市场结算后领取奖励时发出
#[event]
pub struct ClaimRewardsEvent {
    /// 用户
    pub user: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// 销毁的 YES 代币数量
    pub yes_burned: u64,

    /// 销毁的 NO 代币数量
    pub no_burned: u64,

    /// ✅ v1.1.0: 用户收到的 USDC 奖励（原 sol_payout）
    pub usdc_payout: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// Pool 结算事件
///
/// 当管理员结算 Pool 时发出
#[event]
pub struct SettlePoolEvent {
    /// 管理员
    pub authority: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// 获胜方代币类型 (0=NO, 1=YES, 2=平局)
    pub winner_token_type: u8,

    /// Pool 中销毁的输家代币数量 (v1.0.28: 改为销毁而非转移)
    pub loser_tokens_burned: u64,

    /// ✅ v1.1.0: Pool 释放的 USDC 数量（原 sol_released）
    /// 注意：settle_pool 不释放 USDC，保留给 LP 提取，此字段保持为 0
    pub usdc_released: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// 暂停合约事件
///
/// 当管理员暂停合约时发出
#[event]
pub struct PauseEvent {
    /// 管理员
    pub authority: Pubkey,

    /// 时间戳
    pub timestamp: i64,
}

/// 恢复合约事件
///
/// 当管理员恢复合约时发出
#[event]
pub struct UnpauseEvent {
    /// 管理员
    pub authority: Pubkey,

    /// 时间戳
    pub timestamp: i64,
}

/// 白名单更新事件
///
/// 当管理员添加或移除白名单地址时发出
#[event]
pub struct WhitelistUpdateEvent {
    /// 管理员
    pub authority: Pubkey,

    /// 被添加/移除的地址
    pub target: Pubkey,

    /// 操作类型: true=添加, false=移除
    pub is_add: bool,

    /// 时间戳
    pub timestamp: i64,
}

/// LP 费用领取事件
///
/// 当 LP 领取手续费时发出
#[event]
pub struct ClaimLpFeesEvent {
    /// LP 地址
    pub lp: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// ✅ v1.1.0: 领取的费用数量（USDC 最小单位）
    pub fees_claimed: u64,

    /// LP 持有的份额
    pub lp_shares: u64,

    /// 领取前的累积费用
    pub accumulated_fees_before: u64,

    /// 领取后的累积费用
    pub accumulated_fees_after: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v1.1.1: 配置更新事件（修复审计发现的日志记录不全问题）
///
/// 当全局配置被初始化或更新时发出
/// 用于追踪关键参数变更，便于监控和审计
#[event]
pub struct ConfigUpdateEvent {
    /// 操作者（初始化者或管理员）
    pub authority: Pubkey,

    /// 是否为初始化操作（true=首次创建，false=更新）
    pub is_initialization: bool,

    /// 新的权限地址
    pub new_authority: Pubkey,

    /// 团队钱包地址
    pub team_wallet: Pubkey,

    /// ✅ LMSR b 参数（流动性深度配置）
    pub initial_real_token_reserves_config: u64,

    /// 代币总供应配置
    pub token_supply_config: u64,

    /// 代币精度配置
    pub token_decimals_config: u8,

    /// 平台买入手续费（基点）
    pub platform_buy_fee: u64,

    /// 平台卖出手续费（基点）
    pub platform_sell_fee: u64,

    /// LP 买入手续费（基点）
    pub lp_buy_fee: u64,

    /// LP 卖出手续费（基点）
    pub lp_sell_fee: u64,

    /// 是否暂停
    pub is_paused: bool,

    /// 是否启用白名单
    pub whitelist_enabled: bool,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v3.1.1: 市场级费率覆盖事件
/// 当为某个市场开启/更新/关闭费率覆盖时发出
#[event]
pub struct MarketFeeOverrideEvent {
    /// 市场账户
    pub market: Pubkey,

    /// 是否启用覆盖
    pub enabled: bool,

    /// 平台买入费（bps）
    pub platform_buy_fee: u64,

    /// 平台卖出费（bps）
    pub platform_sell_fee: u64,

    /// LP 买入费（bps）
    pub lp_buy_fee: u64,

    /// LP 卖出费（bps）
    pub lp_sell_fee: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v3.1.2: 市场级暂停事件
#[event]
pub struct MarketPauseEvent {
    pub authority: Pubkey,
    pub market: Pubkey,
    pub paused: bool,
    pub timestamp: i64,
}

/// ✅ v1.1.1: 铸造完整集合事件（修复事件记录缺失）
///
/// 当用户铸造 YES+NO 完整集合时发出
#[event]
pub struct MintCompleteSetEvent {
    /// 用户
    pub user: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// USDC 抵押数量
    pub usdc_locked: u64,

    /// 铸造的 YES 代币数量
    pub yes_minted: u64,

    /// 铸造的 NO 代币数量
    pub no_minted: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v1.1.1: 赎回完整集合事件
///
/// 当用户赎回 YES+NO 换回 USDC 时发出
#[event]
pub struct RedeemCompleteSetEvent {
    /// 用户
    pub user: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// 销毁的 YES 代币数量
    pub yes_burned: u64,

    /// 销毁的 NO 代币数量
    pub no_burned: u64,

    /// 返还的 USDC 数量
    pub usdc_returned: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v1.1.1: 种子流动性注入事件
///
/// 当管理员或创建者为 Pool 注入初始流动性时发出
#[event]
pub struct SeedPoolEvent {
    /// 种子提供者
    pub seeder: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// 注入的 USDC 数量
    pub usdc_amount: u64,

    /// 注入的 YES 代币数量
    pub yes_amount: u64,

    /// 注入的 NO 代币数量
    pub no_amount: u64,

    /// 铸造的 LP 份额
    pub lp_shares_minted: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v1.2.0: 市场名称更新事件
///
/// 当创建者更新市场显示名称时发出
#[event]
pub struct UpdateMarketNameEvent {
    /// 市场创建者
    pub creator: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// 旧名称
    pub old_name: String,

    /// 新名称
    pub new_name: String,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v1.2.2: 尾款回收事件
///
/// 当管理员回收市场尾款时发出
#[event]
pub struct ReclaimDustEvent {
    /// 管理员
    pub authority: Pubkey,

    /// 市场账户
    pub market: Pubkey,

    /// 回收金额
    pub amount_reclaimed: u64,

    /// 回收前金库余额
    pub vault_balance_before: u64,

    /// 回收后金库余额
    pub vault_balance_after: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v1.5.2: 市场风险指标事件
///
/// 当用户进行交易时发出，为前端风险仪表盘提供数据
/// 用于实时监控LP风险、价格偏斜度、保险池覆盖率等关键指标
#[event]
pub struct MarketRiskMetrics {
    /// 市场账户
    pub market: Pubkey,

    /// 当前YES价格（基点，0-10000）
    /// 用于判断市场偏斜度（如YES=90%时，风险较高）
    pub current_yes_price_bps: u16,

    /// 持仓不平衡度（|q_yes - q_no|）
    /// 绝对值越大，表示市场越偏向某一方，LP风险越高
    /// ✅ v2.2: 修改为 u64（修复事件字段类型溢出问题）
    pub position_imbalance: u64,

    /// LP最大潜在损失估算（USDC）
    /// 基于当前持仓计算，假设最坏情况（单边全赢）的LP损失
    pub max_lp_loss_estimate: u64,

    /// 保险池覆盖率（基点）
    /// 保险池余额 / LP最大潜在损失，用于评估保险池是否充足
    /// 10000 bps = 100%，表示保险池可全额覆盖
    pub insurance_pool_coverage_bps: u16,

    /// 距离结算时间（小时）
    /// 用于前端展示倒计时和风险警告（越接近结算风险越高）
    pub time_to_settlement_hours: u64,

    /// ✅ v1.5.0: 当前生效的b值（经过动态调整）
    /// 用于展示当前流动性深度
    pub effective_lmsr_b: u64,

    /// ✅ v1.5.1: 最大单笔交易额（USDC）
    /// 用于前端输入验证和用户提示
    pub max_single_trade_size: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// 🔒 v1.2.7: 金库余额快照事件
///
/// 在所有涉及市场 USDC 金库的操作后发出，用于监控账本-金库一致性
/// 前端可订阅此事件实时检测余额异常
#[event]
pub struct VaultBalanceSnapshot {
    /// 市场账户
    pub market: Pubkey,

    /// 🔒 市场专用 USDC 金库实际余额（从 ATA 查询）
    /// 这是区块链上的真实 USDC 余额
    pub market_usdc_balance: u64,

    /// 📊 账本记录：Pool 抵押品储备
    /// 应该 <= market_usdc_balance（因为还有 LP 费用等）
    pub pool_collateral_reserve: u64,

    /// 📊 账本记录：用户锁定抵押品总量
    /// mint_complete_set 时锁定，redeem_complete_set 时释放
    pub total_collateral_locked: u64,

    /// 📊 账本记录：累积 LP 费用
    /// swap 时积累，claim_lp_fees 时扣除
    pub accumulated_lp_fees: u64,

    /// ⚠️ 余额差异（market_usdc_balance - 预期总额）
    /// 预期总额 = pool_collateral_reserve + total_collateral_locked + accumulated_lp_fees
    /// 理想情况下应该接近 0（允许少量尾差）
    pub balance_discrepancy: i64,

    /// 操作类型（用于审计）
    /// "seed_pool", "mint_complete_set", "redeem_complete_set", "claim_lp_fees", "swap", "withdraw_liquidity"
    pub operation: String,

    /// 时间戳
    pub timestamp: i64,
}

/// 事件转换特征
///
/// 提供将结构体转换为事件的通用接口
/// 用于简化事件创建过程
pub trait IntoEvent<T: anchor_lang::Event> {
    /// 将当前结构体转换为指定的事件类型
    ///
    /// # 返回
    /// * `T` - 转换后的事件
    fn into_event(&self) -> T;
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.0.1: 性能优化事件（精简版）
// ═══════════════════════════════════════════════════════════════

/// ✅ v3.0.1: 精简交易事件
///
/// **优化目标**: 减少高频交易事件的序列化开销
///
/// **移除字段**:
/// - `token_yes`, `token_no`: 可从 `market_info` 查询
/// - `real_*_reserves`: 可从链上状态查询
/// - `recipient`: 大多数情况等于 `user`
///
/// **保留字段**: 仅保留交易执行必需的数据
///
/// **使用场景**:
/// - 生产环境：使用此精简事件
/// - 调试环境：使用完整的 `TradeEvent`
#[event]
pub struct SwapExecuted {
    /// 市场账户地址（索引器可从此查询所有市场信息）
    pub market: Pubkey,

    /// 交易用户
    pub user: Pubkey,

    /// 是否为 YES 代币交易（false = NO）
    pub is_yes: bool,

    /// 输入金额（买入时为 USDC，卖出时为代币）
    pub amount_in: u64,

    /// 输出金额（买入时为代币，卖出时为 USDC）
    pub amount_out: u64,

    /// 平台手续费（USDC）
    pub fee: u64,

    /// 时间戳
    pub timestamp: i64,
}

/// ✅ v3.0.1: 调试模式详细交易事件
///
/// **仅在 `feature="event-debug"` 时发射**
///
/// 包含完整的市场状态快照，用于调试和分析
#[cfg(feature = "event-debug")]
#[event]
pub struct SwapDebugInfo {
    pub market: Pubkey,
    pub user: Pubkey,

    // 交易详情
    pub is_yes: bool,
    pub amount_in: u64,
    pub amount_out: u64,
    pub fee: u64,

    // 市场状态快照（交易后）
    pub pool_yes_reserve: u64,
    pub pool_no_reserve: u64,
    pub pool_collateral: u64,

    // LMSR 参数
    pub lmsr_b: u64,
    pub lmsr_q_yes: i64,
    pub lmsr_q_no: i64,

    // 价格信息（基点，10000=100%）
    pub yes_price_bps: u64,
    pub no_price_bps: u64,

    pub timestamp: i64,
}

/// ✅ v3.0.1: 精简流动性事件
///
/// **优化**: 移除可从市场状态查询的冗余字段
#[event]
pub struct LiquidityChanged {
    pub market: Pubkey,
    pub provider: Pubkey,

    /// true=添加, false=移除
    pub is_add: bool,

    /// USDC 投入/提取数量
    pub usdc_amount: u64,

    /// LP 份额变化
    pub lp_shares_delta: u64,

    /// 总 LP 份额（快照）
    pub total_lp_shares: u64,

    pub timestamp: i64,
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.0.1: 事件性能宏
// ═══════════════════════════════════════════════════════════════

/// 条件事件发射宏
///
/// 根据编译特性选择发射哪个事件
///
/// **用法**:
/// ```rust
/// emit_optimized!(
///     SwapExecuted { ... },           // 生产版本
///     SwapDebugInfo { ... }           // 调试版本（需 feature="event-debug"）
/// );
/// ```
#[macro_export]
macro_rules! emit_optimized {
    ($prod:expr, $debug:expr) => {
        #[cfg(feature = "event-debug")]
        emit!($debug);

        #[cfg(not(feature = "event-debug"))]
        emit!($prod);
    };
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.0.2: 紧急管理事件
// ═══════════════════════════════════════════════════════════════

/// 紧急暂停/恢复事件
///
/// 当管理员触发紧急暂停或恢复时发出
/// 用于监控系统安全状态
#[event]
pub struct EmergencyPauseEvent {
    /// 执行操作的管理员
    pub authority: Pubkey,

    /// 暂停/恢复原因或消息
    pub reason: String,

    /// 操作时间戳
    pub timestamp: i64,

    /// true=暂停, false=恢复
    pub paused: bool,
}

/// 权限提名事件
///
/// 当当前管理员提名新管理员时发出
#[event]
pub struct AuthorityNominatedEvent {
    /// 当前管理员
    pub current_authority: Pubkey,

    /// 被提名的新管理员
    pub nominated_authority: Pubkey,

    /// 操作时间戳
    pub timestamp: i64,
}

/// 权限转移事件
///
/// 当新管理员接受权限转移时发出
#[event]
pub struct AuthorityTransferredEvent {
    /// 旧管理员
    pub old_authority: Pubkey,

    /// 新管理员
    pub new_authority: Pubkey,

    /// 操作时间戳
    pub timestamp: i64,
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.1.0: 内部交换滑点透明度事件
// ═══════════════════════════════════════════════════════════════

/// 内部交换事件
///
/// 当LP撤出流动性时，剩余单边代币通过内部交换卖回池子
/// 此事件记录内部交换的详细信息，包括滑点数据，用于透明度和分析
///
/// **使用场景**:
/// - 前端展示LP撤出时的滑点损失
/// - 链下分析内部交换对池子的影响
/// - 监控池子失衡状态下的滑点分布
///
/// **关键字段**:
/// - `slippage_bps`: 实际滑点（基点），计算公式：(expected - actual) / expected × 10000
/// - `pool_imbalance_ratio`: 交换前的池子失衡比例（放大100倍）
#[event]
pub struct InternalSwapEvent {
    /// 市场账户
    pub market: Pubkey,

    /// LP用户
    pub user: Pubkey,

    /// 交换的代币类型（true=YES, false=NO）
    pub is_yes: bool,

    /// 输入代币数量（YES或NO）
    pub token_amount_in: u64,

    /// 输出USDC数量（实际获得）
    pub usdc_amount_out: u64,

    /// 理论USDC数量（无滑点情况，1 token = 1 USDC）
    pub usdc_expected: u64,

    /// 实际滑点（基点，0-10000）
    /// 计算公式：(usdc_expected - usdc_amount_out) * 10000 / usdc_expected
    pub slippage_bps: u16,

    /// 交换前的池子失衡比例（放大100倍精度）
    /// 例如：150 = 1.5:1, 200 = 2:1, 400 = 4:1
    pub pool_imbalance_ratio_before: u128,

    /// 交换后的池子失衡比例（放大100倍精度）
    pub pool_imbalance_ratio_after: u128,

    /// 交换前的池子储备快照
    pub pool_yes_reserve_before: u64,
    pub pool_no_reserve_before: u64,
    pub pool_collateral_reserve_before: u64,

    /// 交换后的池子储备快照
    pub pool_yes_reserve_after: u64,
    pub pool_no_reserve_after: u64,
    pub pool_collateral_reserve_after: u64,

    /// LMSR价格变化（交易后的YES价格，基点）
    pub yes_price_after_bps: u16,

    /// 时间戳
    pub timestamp: i64,
}
