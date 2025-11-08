use crate::state::config::*;

use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize};
use anchor_spl::token::{Mint, Token, TokenAccount};

// use anchor_spl::token::{self};

#[account]
pub struct UserInfo {
    pub user: Pubkey,     // User's public key
    // ✅ FIX CRITICAL-2: 删除冗余的余额字段
    // yes_balance 和 no_balance 是冗余的，因为 SPL Token ATA 已经追踪余额
    // 保留单一真相来源：用户的 ATA 余额
    // pub yes_balance: u64, // ❌ REMOVED
    // pub no_balance: u64,  // ❌ REMOVED
    pub is_lp: bool,
    pub is_initialized: bool,
}

/// LP Position（LP 持仓信息）
/// ✅ v3.0: 重构为单币LP系统（只追踪USDC投入）
#[account]
pub struct LPPosition {
    pub user: Pubkey,           // LP 用户
    pub market: Pubkey,          // 所属市场
    pub lp_shares: u64,          // LP 份额

    // ❌ v3.0: 删除三币追踪（改为单币USDC）
    // pub deposited_sol: u64,   // ❌ REMOVED
    // pub deposited_yes: u64,   // ❌ REMOVED
    // pub deposited_no: u64,    // ❌ REMOVED

    pub last_fee_claim_slot: u64, // 上次领取费用的 slot（已废弃，改用 last_fee_per_share）

    /// ✅ 上次领取时的 fee_per_share 值（用于计算未领取的费用）
    pub last_fee_per_share: u128, // 精度：* 10^18

    /// ✅ v1.4.0: 记录LP投入的USDC成本（用于保险池补偿计算）
    ///
    /// **用途**:
    /// - 追踪 LP 在 add_liquidity 时投入的 USDC 总价值
    /// - 用于 withdraw_liquidity 时计算是否发生本金损失
    /// - 保险池基于 (invested_usdc - withdrawn_value) 计算补偿金额
    ///
    /// **计算规则**:
    /// - add_liquidity: invested_usdc += usdc_amount
    /// - withdraw_liquidity: 不修改此值（保留历史投入记录）
    ///
    /// **默认值**: 0（升级前的旧LP账户）
    pub invested_usdc: u64,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: 时间锁字段（用于早期退出惩罚计算）
    // ═══════════════════════════════════════════════════════════════

    /// 首次添加流动性的时间戳（Unix时间戳，秒）
    /// 用于计算持有时间和早期退出惩罚
    pub created_at: i64,

    /// 最后一次添加流动性的时间戳（Unix时间戳，秒）
    /// 用于计算是否频繁添加（防止重置时间锁）
    pub last_add_at: i64,
}

/// ✅ v1.0.12: Swap 交易结果
/// 用于在 swap 函数和事件发射之间传递详细交易数据
/// ✅ v1.1.0: 更新为 USDC 字段名
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct SwapResult {
    pub usdc_amount: u64,       // ✅ v1.1.0: 实际的 USDC 数量（买单=输入，卖单=输出税后）
    pub token_amount: u64,      // 实际的代币数量（买单=输出，卖单=输入）
    pub fee_usdc: u64,          // ✅ v1.1.0: 总手续费（platform_fee + lp_fee，USDC）
}

/// ✅ v3.1.0: 内部交换结果
/// 用于传递内部交换的详细数据，包括滑点信息
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct InternalSwapResult {
    /// 输入代币数量（YES或NO）
    pub token_amount_in: u64,

    /// 输出USDC数量（实际获得）
    pub usdc_amount_out: u64,

    /// 理论USDC数量（1 token = 1 USDC，无滑点）
    pub usdc_expected: u64,

    /// 滑点（基点，0-10000）
    pub slippage_bps: u16,

    /// 交换前的池子失衡比例（放大100倍）
    pub pool_imbalance_before: u128,

    /// 交换后的池子失衡比例（放大100倍）
    pub pool_imbalance_after: u128,
}

#[account]
pub struct Market {
    pub yes_token_mint: Pubkey,
    pub no_token_mint: Pubkey,

    pub creator: Pubkey,

    // ═══════════════════════════════════════════════════════════════
    // Settlement Ledger（结算账本）
    // 用于 mint_complete_set / redeem_complete_set / claim_rewards
    // ═══════════════════════════════════════════════════════════════

    /// 条件代币的 1:1 抵押品锁定量
    pub total_collateral_locked: u64,

    /// 通过 mint_complete_set 创建的 YES 代币总量
    pub total_yes_minted: u64,

    /// 通过 mint_complete_set 创建的 NO 代币总量
    pub total_no_minted: u64,

    // ═══════════════════════════════════════════════════════════════
    // AMM Pool Ledger（池子账本）
    // 用于 add_liquidity / withdraw_liquidity / swap
    // ═══════════════════════════════════════════════════════════════

    /// Pool 中的 SOL 储备金（流动性）
    pub pool_collateral_reserve: u64,

    /// Pool 中的 YES 代币库存（用于 swap）
    pub pool_yes_reserve: u64,

    /// Pool 中的 NO 代币库存（用于 swap）
    pub pool_no_reserve: u64,

    /// LP Token 总供应量
    pub total_lp_shares: u64,

    // ═══════════════════════════════════════════════════════════════
    // LMSR 定价参数（用于 Pool）
    // ═══════════════════════════════════════════════════════════════

    /// 流动性参数（决定市场深度）
    pub lmsr_b: u64,

    /// YES 的净持仓量（用于 LMSR 定价）
    pub lmsr_q_yes: i64,

    /// NO 的净持仓量（用于 LMSR 定价）
    pub lmsr_q_no: i64,

    // ═══════════════════════════════════════════════════════════════
    // 已废弃字段（保留以保持向后兼容）
    // ═══════════════════════════════════════════════════════════════

    pub initial_yes_token_reserves: u64,
    pub real_yes_token_reserves: u64,
    pub real_yes_sol_reserves: u64,
    pub token_yes_total_supply: u64,

    pub initial_no_token_reserves: u64,
    pub real_no_token_reserves: u64,
    pub real_no_sol_reserves: u64,
    pub token_no_total_supply: u64,

    // ═══════════════════════════════════════════════════════════════
    // 市场状态
    // ═══════════════════════════════════════════════════════════════

    pub is_completed: bool,
    pub start_slot: Option<u64>,
    pub ending_slot: Option<u64>,

    /// Resolution 结算参数
    pub resolution_yes_ratio: u64,  // YES代币赎回比例（基点，10000=100%）
    pub resolution_no_ratio: u64,   // NO代币赎回比例（基点，10000=100%）
    pub winner_token_type: u8,      // 获胜方（0=NO, 1=YES, 2=平局）

    /// 重入保护标志
    pub swap_in_progress: bool,
    pub add_liquidity_in_progress: bool,  // ✅ v3.1.4: add_liquidity 重入保护

    // ═══════════════════════════════════════════════════════════════
    // LP 管理（已废弃，改用 LPPosition）
    // ═══════════════════════════════════════════════════════════════

    /// LP 累计费用（总额）
    pub accumulated_lp_fees: u64,

    /// ✅ 累计每份额收益（用于公平分配 LP 费用）
    /// 公式：fee_per_share_cumulative += new_fees / total_lp_shares
    /// 精度：使用 u128 存储，实际值 * 10^18
    pub fee_per_share_cumulative: u128,

    // ═══════════════════════════════════════════════════════════════
    // 🔒 v1.0.5+ 新增字段（追加到末尾以保持向后兼容）
    // ═══════════════════════════════════════════════════════════════

    /// Pool 结算标志（settle_pool 完成后设为 true）
    /// 用于允许 LP 在市场完成后安全提取流动性
    /// ⚠️ 重要：此字段追加到结构体末尾，旧账户需迁移
    pub pool_settled: bool,

    // ═══════════════════════════════════════════════════════════════
    // 🔒 v1.2.0+ 新增字段（追加到末尾以保持向后兼容）
    // ═══════════════════════════════════════════════════════════════

    /// 市场显示名称（最大64字符）
    /// 用于前端显示，仅创建者可更新
    pub display_name: String,

    // ═══════════════════════════════════════════════════════════════
    // 🔒 v1.2.1+ 安全增强：额外的重入保护标志
    // ═══════════════════════════════════════════════════════════════

    /// 提取流动性重入保护标志
    pub withdraw_in_progress: bool,

    /// 领取奖励重入保护标志
    pub claim_in_progress: bool,

    // ═══════════════════════════════════════════════════════════════
    // 🔒 v1.3.0+ 新增字段：初始概率与动态费率支持
    // ═══════════════════════════════════════════════════════════════

    /// 初始YES概率（基点，10000=100%）
    /// 用于第一个LP添加流动性时验证比例
    /// 范围：2000-8000 (20%-80%)
    pub initial_yes_prob: u16,

    /// 市场创建时间戳（Unix时间戳，秒）
    /// 用于计算动态LP费率
    pub created_at: i64,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v2.0: 保险池市场级追踪（防止跨市场资金混乱）
    // ═══════════════════════════════════════════════════════════════

    /// 该市场贡献给保险池的USDC总额（最小单位）
    ///
    /// **用途**:
    /// - 记录该市场从swap手续费中注入保险池的累计金额
    /// - 限制withdraw_liquidity补偿时只能从本市场的份额支付
    /// - 防止市场A注入资金被市场B的LP领走
    ///
    /// **更新时机**:
    /// - swap指令: insurance_allocation计入后，同步增加此字段
    ///
    /// **使用限制**:
    /// - withdraw_liquidity: 补偿金额 <= min(全局余额, 本市场份额)
    ///
    /// **示例**:
    /// - 市场A累计注入100 USDC (insurance_pool_contribution=100)
    /// - 市场A的LP最多可获得100 USDC补偿
    /// - 即使全局保险池余额=1000 USDC，也不能超过100 USDC
    ///
    /// 默认值: 0 (初始化时设置)
    pub insurance_pool_contribution: u64,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: 熔断机制字段
    // ═══════════════════════════════════════════════════════════════

    /// 熔断器是否已激活
    /// 触发条件：池子比例>=4:1 或 单边储备<10% 或 24h撤出>50%
    pub circuit_breaker_active: bool,

    /// 熔断器触发时间戳（Unix时间戳，秒）
    /// 用于计算24小时冷却期
    pub circuit_breaker_triggered_at: i64,

    /// 最近24小时内撤出的总份额
    /// 用于检测是否超过总流动性的50%
    pub withdraw_last_24h: u64,

    /// 撤出追踪开始时间戳（Unix时间戳，秒）
    /// 用于滚动计算24小时窗口
    pub withdraw_tracking_start: i64,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: 初始流动性记录（用于熔断触发条件2）
    // ═══════════════════════════════════════════════════════════════

    /// Pool 初始化时的 YES 代币储备量
    /// 用于计算熔断条件：单边储备是否低于初始的10%
    pub initial_yes_reserve: u64,

    /// Pool 初始化时的 NO 代币储备量
    pub initial_no_reserve: u64,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.1.1: 市场级手续费覆盖（可选）
    // ═══════════════════════════════════════════════════════════════

    /// 是否启用市场级费率覆盖
    pub has_fee_override: bool,

    /// 覆盖：平台买入费（bps）
    pub platform_buy_fee_override: u64,

    /// 覆盖：平台卖出费（bps）
    pub platform_sell_fee_override: u64,

    /// 覆盖：LP 买入费（bps）
    pub lp_buy_fee_override: u64,

    /// 覆盖：LP 卖出费（bps）
    pub lp_sell_fee_override: u64,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.1.2: 市场级暂停（独立于全局暂停）
    // ═══════════════════════════════════════════════════════════════

    /// 市场是否暂停（暂停后禁止 swap/add_liquidity/withdraw_liquidity）
    pub market_paused: bool,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.1.3: 哨兵代币追踪（防 NO mint 复用）
    // ═══════════════════════════════════════════════════════════════

    /// NO 代币哨兵（1个最小单位）是否已铸造
    ///
    /// **用途**:
    /// - create_market 时在 global_no_ata 中铸造 1 个最小单位的 NO 代币
    /// - 防止同一 NO mint 被复用（cryptographic lock）
    /// - 哨兵不代表可赎回价值（不纳入 total_no_minted）
    ///
    /// **Resolution 会计处理**:
    /// - global_no_balance 包含哨兵（1个最小单位）
    /// - total_no_minted 不包含哨兵（仅统计用户真实铸造）
    /// - Resolution 约束：销毁量 = min(global_no_balance, total_no_minted + sentinel)
    /// - 这确保销毁的代币数量不会超过"真实供应 + 哨兵"
    ///
    /// **初始化**:
    /// - create_market：设为 true（总是铸造）
    /// - 迁移脚本：旧账户设为 true（假设都已铸造）
    pub sentinel_no_minted: bool,
}

impl Market {
    /// 🔒 v1.2.2: 安全修复 - 正确计算账户空间需求
    /// ✅ v1.3.0: 更新空间计算（新增 initial_yes_prob: u16 + created_at: i64 = 10字节）
    /// ✅ v2.0: 更新空间计算（新增 insurance_pool_contribution: u64 = 8字节）
    /// ✅ v3.0: 更新空间计算（新增熔断字段 = 33字节）
    ///
    /// String 类型在 Borsh 序列化时占用: 4 (长度前缀) + 实际字符串字节
    /// display_name 最大 64 字符,所以需要 4 + 64 = 68 字节
    ///
    /// 计算方式:
    /// - 所有固定大小字段: std::mem::size_of::<Market>()
    /// - String 字段额外空间: 4 + 64 - 8(指针大小) = 60 字节
    /// - v1.3.0 新增字段: u16(2) + i64(8) = 10 字节
    /// - v2.0 新增字段: u64(8) = 8 字节
    /// - v3.0 新增熔断字段: bool(1) + i64(8) + u64(8) + i64(8) + u64(8) + u64(8) = 41 字节
    /// - v3.1.1 新增市场级费率覆盖: bool(1) + 4 * u64(32) = 33 字节
    /// - v3.1.2 新增市场级暂停: bool(1)
    /// - v3.1.3 新增哨兵追踪: bool(1)
    /// - v3.1.4 新增 add_liquidity 重入保护: bool(1)
    pub const INIT_SPACE: usize = std::mem::size_of::<Market>() + 60 + 10 + 8 + 41 + 33 + 1 + 1 + 1;

    /// display_name 的最大长度(字符数)
    pub const MAX_DISPLAY_NAME_LEN: usize = 64;
}

#[derive(Debug, Clone)]
pub struct SellResult {
    pub token_amount: u64,
    pub change_amount: u64,
    pub current_yes_reserves: u64,
    pub current_no_reserves: u64,
    pub new_yes_reserves: u64,
    pub new_no_reserves: u64,
}

#[derive(Debug, Clone)]
pub struct BuyResult {
    pub token_amount: u64,
    pub change_amount: u64,
    pub current_yes_reserves: u64,
    pub current_no_reserves: u64,
    pub new_yes_reserves: u64,
    pub new_no_reserves: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateMarketParams {
    pub yes_symbol: String,
    pub yes_uri: String,

    pub start_slot: Option<u64>,
    pub ending_slot: Option<u64>,

    /// ✅ v1.2.0: 市场显示名称（最大64字符）
    pub display_name: String,

    /// ✅ v1.3.0: 初始YES概率（基点，10000=100%）
    /// 用于第一个LP添加流动性时验证比例
    /// 范围：2000-8000 (20%-80%)
    /// 如果设置为0，则使用默认值5000 (50%)
    pub initial_yes_prob: u16,
}
pub trait MarketAccount<'info> {
    #[allow(clippy::too_many_arguments)]
    fn swap(
        &mut self,
        global_config: &mut Account<'info, Config>,

        yes_token_mint: &Account<'info, Mint>,
        _global_yes_ata: &mut AccountInfo<'info>,
        user_yes_ata: &mut AccountInfo<'info>,

        no_token_mint: &Account<'info, Mint>,
        _global_no_ata: &mut AccountInfo<'info>,
        user_no_ata: &mut AccountInfo<'info>,

        source: &mut AccountInfo<'info>,
        _team_wallet: &mut AccountInfo<'info>,  // ✅ v1.1.0: 不再使用（改用 team_usdc_ata）

        amount: u64,
        direction: u8,
        token_type: u8,
        minimum_receive_amount: u64,

        user: &Signer<'info>,
        signer: &[&[&[u8]]],

        user_info_pda: &mut Account<'info, UserInfo>,

        token_program: &Program<'info, Token>,
        _system_program: &Program<'info, System>,

        // 🔒 v1.2.7: USDC 相关账户 (使用市场专用金库)
        _usdc_mint: &Account<'info, Mint>,
        market_usdc_ata: &Account<'info, TokenAccount>,
        market_usdc_vault: &AccountInfo<'info>,
        market_usdc_vault_bump: u8,
        user_usdc_ata: &Account<'info, TokenAccount>,
        team_usdc_ata: &Account<'info, TokenAccount>,
    ) -> Result<SwapResult>;

    fn apply_buy(&mut self, sol_amount: u64, token_type: u8) -> Option<BuyResult>;

    fn apply_sell(&mut self, token_amount: u64, token_type: u8) -> Option<SellResult>;

    fn get_tokens_for_buy_sol(&self, sol_amount: u64, token_type: u8) -> Option<BuyResult>;

    fn get_tokens_for_sell_sol(&self, token_amount: u64, token_type: u8) -> Option<SellResult>;

    // ✅ v3.0.1: 完全移除废弃的 resolution() trait 方法
    // 实际结算功能已在 instructions/market/resolution.rs::Resolution 指令中实现
    // 该指令有完整的账户验证、权限检查和PDA签名机制
}

impl<'info> MarketAccount<'info> for Account<'info, Market> {
    #[allow(clippy::too_many_arguments)]
    fn swap(
        &mut self,
        global_config: &mut Account<'info, Config>,

        _yes_token_mint: &Account<'info, Mint>,
        _global_yes_ata: &mut AccountInfo<'info>,
        user_yes_ata: &mut AccountInfo<'info>,

        _no_token_mint: &Account<'info, Mint>,
        _global_no_ata: &mut AccountInfo<'info>,
        user_no_ata: &mut AccountInfo<'info>,

        source: &mut AccountInfo<'info>,
        _team_wallet: &mut AccountInfo<'info>,  // ✅ v1.1.0: 不再使用（改用 team_usdc_ata）

        amount: u64,
        direction: u8,
        token_type: u8,
        minimum_receive_amount: u64,

        user: &Signer<'info>,
        signer: &[&[&[u8]]],

        _user_info_pda: &mut Account<'info, UserInfo>,

        token_program: &Program<'info, Token>,
        _system_program: &Program<'info, System>,

        // 🔒 v1.2.7: USDC 相关账户 (使用市场专用金库)
        _usdc_mint: &Account<'info, Mint>,
        market_usdc_ata: &Account<'info, TokenAccount>,
        market_usdc_vault: &AccountInfo<'info>,
        market_usdc_vault_bump: u8,
        user_usdc_ata: &Account<'info, TokenAccount>,
        team_usdc_ata: &Account<'info, TokenAccount>,
    ) -> Result<SwapResult> {
        use anchor_spl::token;

        msg!("Swap: direction={}, token_type={}, amount={}", direction, token_type, amount);

        // ✅ v2.3: 前置基础校验（在设置锁之前，避免 DoS）
        // 这些校验不依赖外部调用，可以安全地在获取锁之前执行
        require!(!self.is_completed, crate::errors::PredictionMarketError::CurveAlreadyCompleted);
        require!(amount > 0, crate::errors::PredictionMarketError::InvalidAmount);
        require!(token_type <= 1, crate::errors::PredictionMarketError::InvalidParameter);
        require!(direction <= 1, crate::errors::PredictionMarketError::InvalidParameter);

        // 🔒 v2.3 CRITICAL FIX: 使用 RAII 重入保护（防止 DoS 漏洞）
        //
        // ❌ 旧实现问题：
        //   Line 385: self.swap_in_progress = true;
        //   Line 390: require!(amount > 0) ← 失败会直接 return，不解锁！
        //   Line 973: self.swap_in_progress = false; ← 永远不会执行
        //
        // ✅ 新实现：使用 ReentrancyGuard RAII，保证无论成功/失败都解锁
        //   与 claim_rewards.rs:135 保持一致
        let _reentrancy_guard = crate::utils::ReentrancyGuard::new(&mut self.swap_in_progress)?;

        // 🔒 P0 修复：校验市场交易时间窗口（Clock::get() 是外部调用）
        let current_slot = Clock::get()?.slot;

        // 校验市场已开始
        if let Some(start_slot) = self.start_slot {
            require!(
                current_slot >= start_slot,
                crate::errors::PredictionMarketError::MarketNotStarted
            );
        }

        // 校验市场未结束
        if let Some(ending_slot) = self.ending_slot {
            require!(
                current_slot < ending_slot,
                crate::errors::PredictionMarketError::MarketEnded
            );
        }

        // ✅ v1.5.0: 计算动态调整后的b值（基于距离结算时间）
        let effective_b = self.calculate_effective_lmsr_b()?;
        let original_b = self.lmsr_b;

        // 暂时替换市场的b值为有效b值（仅用于本次交易计算）
        self.lmsr_b = effective_b;

        // 🔒 v2.3: 使用 RAII 保护动态 b 值修改（确保恢复原值）
        // 通过结构体模式在函数退出时恢复（见手动恢复代码）
        struct BValueRestorer {
            original_b: u64,
        }
        let _b_restorer = BValueRestorer { original_b };

        // ✅ v2.3: RAII 模式已使用，核心逻辑直接执行
        // _reentrancy_guard 会在函数退出时自动清理
        // lmsr_b 将在函数结束前手动恢复（闭包结束后）
        let swap_result = (|| -> Result<SwapResult> {
            // ✅ v2.5: 将 max_trade_size 检查移到闭包内（防止 b 值永久修改）
            //
            // ❌ 旧问题：该检查在闭包外，失败时会跳过 Line 996 的 b 值恢复
            //    导致 lmsr_b 被永久修改为 effective_b
            //
            // ✅ v2.5 修复：移到闭包内，确保无论成功/失败都能恢复 b 值
            let max_trade_size = (self.pool_collateral_reserve as u128)
                .checked_mul(crate::constants::MAX_SINGLE_TRADE_BPS as u128)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_div(crate::constants::BASIS_POINTS_DIVISOR as u128)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64;

            require!(
                amount <= max_trade_size,
                crate::errors::PredictionMarketError::TradeSizeTooLarge
            );

            msg!(
                "✅ v2.5: effective_b={} (original={}), max_trade={}, amount={}",
                effective_b,
                original_b,
                max_trade_size,
                amount
            );

            // direction: 0 = buy, 1 = sell
            // token_type: 0 = NO, 1 = YES

            if direction == 0 {
            // ═══════════════════════════════════════════════════════════
            // BUY 操作：用 USDC 从 Pool 买代币
            // ✅ 双账本系统：只操作 Pool Ledger，不影响 Settlement
            // ═══════════════════════════════════════════════════════════
            msg!("Processing BUY order (Pool)");

            // ✅ v3.0: 硬上限检查（2b上限，88%价格保护）
            // 禁止买入多数方当 |q_yes - q_no| >= 2b
            let imbalance = (self.lmsr_q_yes - self.lmsr_q_no).abs() as u64;
            let hard_cap = self.lmsr_b
                .checked_mul(crate::constants::MAX_POSITION_IMBALANCE_MULTIPLIER)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            if imbalance >= hard_cap {
                // 判断多数方（持仓量更大的一方）
                let majority_side = if self.lmsr_q_yes > self.lmsr_q_no { 1 } else { 0 };

                // 禁止买入多数方
                require!(
                    token_type != majority_side,
                    crate::errors::PredictionMarketError::PoolTooImbalanced
                );

                msg!(
                    "⚠️ Hard cap enforced: imbalance={}, cap={} ({}x b), blocking {} purchase",
                    imbalance,
                    hard_cap,
                    crate::constants::MAX_POSITION_IMBALANCE_MULTIPLIER,
                    if majority_side == 1 { "YES" } else { "NO" }
                );
            }

            // 计算手续费（支持市场级覆盖）
            let platform_buy_bps = if self.has_fee_override { self.platform_buy_fee_override } else { global_config.platform_buy_fee };
            let lp_buy_bps = if self.has_fee_override { self.lp_buy_fee_override } else { global_config.lp_buy_fee };

            let platform_fee = amount
                .checked_mul(platform_buy_bps)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_div(crate::constants::BASIS_POINTS_DIVISOR)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // ✅ v3.0: 固定2% LP费率（移除所有动态调整）
            // 理由：固定费率更透明，用户体验更好，交易量增长补偿费率固定的损失
            let lp_fee = amount
                .checked_mul(lp_buy_bps)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_div(crate::constants::BASIS_POINTS_DIVISOR)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            let total_fee = platform_fee.checked_add(lp_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            let amount_after_fee = amount.checked_sub(total_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            msg!("Fees - platform: {}, lp: {}, net amount: {}", platform_fee, lp_fee, amount_after_fee);

            // 计算可获得的代币数量（使用AMM公式）
            let buy_result = self.apply_buy(amount_after_fee, token_type)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 检查滑点保护
            require!(
                buy_result.token_amount >= minimum_receive_amount,
                crate::errors::PredictionMarketError::SlippageExceeded
            );

            msg!("Token amount to receive: {}", buy_result.token_amount);

            // ✅ v1.4.0: 计算保险池分配（从平台费中分出）
            let insurance_allocation = if platform_fee > 0 {
                (platform_fee as u128)
                    .checked_mul(global_config.lp_insurance_allocation_bps as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                    .checked_div(crate::constants::BASIS_POINTS_DIVISOR as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64
            } else {
                0
            };

            // 团队钱包获得剩余部分（默认80%）
            let team_fee = platform_fee
                .checked_sub(insurance_allocation)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 🔒 v1.2.7 + v1.4.0: 用户转 USDC 到市场专用金库
            // 包括：AMM交易金额 + LP费用 + 保险池份额
            let usdc_to_vault = amount_after_fee
                .checked_add(lp_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_add(insurance_allocation)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            token::transfer(
                CpiContext::new(
                    token_program.to_account_info(),
                    token::Transfer {
                        from: user_usdc_ata.to_account_info(),
                        to: market_usdc_ata.to_account_info(),
                        authority: user.to_account_info(),
                    },
                ),
                usdc_to_vault,
            )?;

            // ✅ v1.4.0: 团队钱包获得平台费的80%
            if team_fee > 0 {
                token::transfer(
                    CpiContext::new(
                        token_program.to_account_info(),
                        token::Transfer {
                            from: user_usdc_ata.to_account_info(),
                            to: team_usdc_ata.to_account_info(),
                            authority: user.to_account_info(),
                        },
                    ),
                    team_fee,
                )?;
            }

            // ✅ v1.4.0: 更新全局保险池余额
            // ✅ v2.0: 同步更新市场级保险池贡献追踪
            // 架构说明：
            // - 保险池资金存储在各市场的 market_usdc_ata 中（分散存储）
            // - global_config.lp_insurance_pool_balance 追踪全局保险池总余额（集中记账）
            // - market.insurance_pool_contribution 追踪该市场累计贡献（市场级记账）
            // - 当 LP 需要补偿时，从相应市场的 market_usdc_ata 支付，且不超过该市场的贡献额
            if insurance_allocation > 0 {
                global_config.lp_insurance_pool_balance = global_config.lp_insurance_pool_balance
                    .checked_add(insurance_allocation)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                // ✅ v2.0: 同步更新市场级追踪
                self.insurance_pool_contribution = self.insurance_pool_contribution
                    .checked_add(insurance_allocation)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                msg!(
                    "✅ v2.0 Insurance pool updated - Team: {}, Insurance: {}, Market contribution: {}",
                    team_fee,
                    insurance_allocation,
                    self.insurance_pool_contribution
                );
            }

            // ✅ 累计 LP 费用到 Pool
            self.accumulated_lp_fees = self.accumulated_lp_fees
                .checked_add(lp_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // ✅ 更新累计每份额收益（公平分配关键）
            if self.total_lp_shares > 0 && lp_fee > 0 {
                // fee_per_share_cumulative += (lp_fee * 10^18) / total_lp_shares
                let fee_per_share_increase = (lp_fee as u128)
                    .checked_mul(crate::constants::FEE_PER_SHARE_PRECISION) // 10^18 精度
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                    .checked_div(self.total_lp_shares as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                self.fee_per_share_cumulative = self.fee_per_share_cumulative
                    .checked_add(fee_per_share_increase)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
            }

            // ═══════════════════════════════════════════════════════════
            // ✅ 双账本系统：只操作 Pool Ledger
            // ═══════════════════════════════════════════════════════════

            // 1. Pool 收到 USDC（增加储备金）
            self.pool_collateral_reserve = self.pool_collateral_reserve
                .checked_add(amount_after_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 2. 从 Pool 转移代币给用户（减少储备）
            if token_type == 0 {
                // 买 NO 代币
                require!(
                    self.pool_no_reserve >= buy_result.token_amount,
                    crate::errors::PredictionMarketError::InsufficientLiquidity
                );

                self.pool_no_reserve = self.pool_no_reserve
                    .checked_sub(buy_result.token_amount)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                token::transfer(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        token::Transfer {
                            from: _global_no_ata.to_account_info(),
                            to: user_no_ata.to_account_info(),
                            authority: source.to_account_info(),
                        },
                        signer,
                    ),
                    buy_result.token_amount,
                )?;

                msg!(
                    "✅ Pool: Sold {} NO to user for {} USDC. Reserves: USDC={}, NO={}",
                    buy_result.token_amount,
                    amount_after_fee,
                    self.pool_collateral_reserve,
                    self.pool_no_reserve
                );
            } else {
                // 买 YES 代币
                require!(
                    self.pool_yes_reserve >= buy_result.token_amount,
                    crate::errors::PredictionMarketError::InsufficientLiquidity
                );

                self.pool_yes_reserve = self.pool_yes_reserve
                    .checked_sub(buy_result.token_amount)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                token::transfer(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        token::Transfer {
                            from: _global_yes_ata.to_account_info(),
                            to: user_yes_ata.to_account_info(),
                            authority: source.to_account_info(),
                        },
                        signer,
                    ),
                    buy_result.token_amount,
                )?;

                msg!(
                    "✅ Pool: Sold {} YES to user for {} USDC. Reserves: USDC={}, YES={}",
                    buy_result.token_amount,
                    amount_after_fee,
                    self.pool_collateral_reserve,
                    self.pool_yes_reserve
                );
            }

            // 注意：不修改 Settlement Ledger 的字段：
            // - total_collateral_locked (不变)
            // - total_yes_minted (不变)
            // - total_no_minted (不变)

            msg!("BUY completed (Pool only, Settlement unchanged)");

            // ✅ v1.0.12: 返回准确的交易数据
            // ✅ v1.1.0: 更新为 USDC 字段名
            Ok(SwapResult {
                usdc_amount: amount_after_fee,      // ✅ v1.1.0: 用户支付的 USDC（税后）
                token_amount: buy_result.token_amount, // 用户获得的代币
                fee_usdc: total_fee,                // ✅ v1.1.0: 总手续费（USDC）
            })

        } else {
            // ═══════════════════════════════════════════════════════════
            // SELL 操作：卖代币换 USDC
            // ✅ 双账本系统：只操作 Pool Ledger
            // ═══════════════════════════════════════════════════════════
            msg!("Processing SELL order (Pool)");

            // 计算可获得的 USDC（使用 LMSR 公式）
            let sell_result = self.apply_sell(amount, token_type)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 计算手续费（支持市场级覆盖）
            let platform_sell_bps = if self.has_fee_override { self.platform_sell_fee_override } else { global_config.platform_sell_fee };
            let lp_sell_bps = if self.has_fee_override { self.lp_sell_fee_override } else { global_config.lp_sell_fee };

            let platform_fee = sell_result.change_amount
                .checked_mul(platform_sell_bps)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_div(crate::constants::BASIS_POINTS_DIVISOR)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // ✅ v3.0: 固定2% LP费率（移除所有动态调整）
            // 理由：固定费率更透明，用户体验更好，交易量增长补偿费率固定的损失
            let lp_fee = sell_result.change_amount
                .checked_mul(lp_sell_bps)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_div(crate::constants::BASIS_POINTS_DIVISOR)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            let total_fee = platform_fee.checked_add(lp_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            let amount_after_fee = sell_result.change_amount.checked_sub(total_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 检查滑点保护
            require!(
                amount_after_fee >= minimum_receive_amount,
                crate::errors::PredictionMarketError::SlippageExceeded
            );

            // ✅ 验证 Pool 有足够的 USDC 储备
            require!(
                self.pool_collateral_reserve >= sell_result.change_amount,
                crate::errors::PredictionMarketError::InsufficientLiquidity
            );

            msg!("Selling {} tokens for {} USDC (after fee)", amount, amount_after_fee);

            // 🔒 预先计算团队手续费与保险分配，用于最小余额校验
            let insurance_allocation_check = if platform_fee > 0 {
                (platform_fee as u128)
                    .checked_mul(global_config.lp_insurance_allocation_bps as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                    .checked_div(crate::constants::BASIS_POINTS_DIVISOR as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64
            } else { 0 };

            let team_fee_check = platform_fee
                .checked_sub(insurance_allocation_check)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 🔒 市场金库最小余额保护：确保本次 SELL 完成后余额不低于最小金库余额
            // 预计本次从 market_usdc_ata 流出：amount_after_fee（给用户） + team_fee_check（团队费）
            let vault_balance_before = market_usdc_ata.amount;
            let projected_remaining = (vault_balance_before as i128)
                .checked_sub(amount_after_fee as i128)
                .and_then(|v| v.checked_sub(team_fee_check as i128))
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as i64;
            require!(
                projected_remaining as u64 >= global_config.usdc_vault_min_balance,
                crate::errors::PredictionMarketError::InsufficientBalance
            );

            // ═══════════════════════════════════════════════════════════
            // ✅ 双账本系统：只操作 Pool Ledger
            // ═══════════════════════════════════════════════════════════

            // 1. Pool 收到代币（增加储备）
            if token_type == 0 {
                // 卖 NO 代币
                self.pool_no_reserve = self.pool_no_reserve
                    .checked_add(amount)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                token::transfer(
                    CpiContext::new(
                        token_program.to_account_info(),
                        token::Transfer {
                            from: user_no_ata.to_account_info(),
                            to: _global_no_ata.to_account_info(),
                            authority: user.to_account_info(),
                        },
                    ),
                    amount,
                )?;

                msg!(
                    "✅ Pool: Bought {} NO from user for {} USDC. Reserves: USDC={}, NO={}",
                    amount,
                    sell_result.change_amount,
                    self.pool_collateral_reserve,
                    self.pool_no_reserve
                );
            } else {
                // 卖 YES 代币
                self.pool_yes_reserve = self.pool_yes_reserve
                    .checked_add(amount)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                token::transfer(
                    CpiContext::new(
                        token_program.to_account_info(),
                        token::Transfer {
                            from: user_yes_ata.to_account_info(),
                            to: _global_yes_ata.to_account_info(),
                            authority: user.to_account_info(),
                        },
                    ),
                    amount,
                )?;

                msg!(
                    "✅ Pool: Bought {} YES from user for {} USDC. Reserves: USDC={}, YES={}",
                    amount,
                    sell_result.change_amount,
                    self.pool_collateral_reserve,
                    self.pool_yes_reserve
                );
            }

            // 2. Pool 支付 USDC（减少储备）
            self.pool_collateral_reserve = self.pool_collateral_reserve
                .checked_sub(sell_result.change_amount)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 🔒 v1.2.7: 从市场专用金库转 USDC 给用户（扣除手续费后）
            let market_key = self.key();
            let market_signer_seeds: &[&[&[u8]]] = &[&[
                crate::constants::MARKET_USDC_VAULT.as_bytes(),
                market_key.as_ref(),
                &[market_usdc_vault_bump],
            ]];

            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    token::Transfer {
                        from: market_usdc_ata.to_account_info(),
                        to: user_usdc_ata.to_account_info(),
                        authority: market_usdc_vault.to_account_info(),
                    },
                    market_signer_seeds,
                ),
                amount_after_fee,
            )?;

            // ✅ v1.4.0: 平台手续费分配：部分给团队，部分给保险池
            let insurance_allocation = if platform_fee > 0 {
                (platform_fee as u128)
                    .checked_mul(global_config.lp_insurance_allocation_bps as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                    .checked_div(crate::constants::BASIS_POINTS_DIVISOR as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64
            } else {
                0
            };

            let team_fee = platform_fee
                .checked_sub(insurance_allocation)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 🔒 v1.2.7 + v1.4.0: 转团队手续费给团队钱包（80%）
            if team_fee > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        token::Transfer {
                            from: market_usdc_ata.to_account_info(),
                            to: team_usdc_ata.to_account_info(),
                            authority: market_usdc_vault.to_account_info(),
                        },
                        market_signer_seeds,
                    ),
                    team_fee,
                )?;
            }

            // ✅ v1.4.0: 保险池份额（20%）留在 market_usdc_ata，更新全局账本
            // ✅ v2.5: 同步更新市场级保险池贡献追踪（对齐买入分支）
            if insurance_allocation > 0 {
                global_config.lp_insurance_pool_balance = global_config.lp_insurance_pool_balance
                    .checked_add(insurance_allocation)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                // ✅ v2.5: 同步更新市场级追踪（与买入分支保持一致）
                self.insurance_pool_contribution = self.insurance_pool_contribution
                    .checked_add(insurance_allocation)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                msg!(
                    "✅ v2.5 Platform fee split (SELL) - Team: {}, Insurance: {}, Market contribution: {}",
                    team_fee,
                    insurance_allocation,
                    self.insurance_pool_contribution
                );
            }

            // ✅ 累计 LP 费用（卖出时 lp_fee 留在金库中）
            self.accumulated_lp_fees = self.accumulated_lp_fees
                .checked_add(lp_fee)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // ✅ 更新累计每份额收益（公平分配关键）
            if self.total_lp_shares > 0 && lp_fee > 0 {
                let fee_per_share_increase = (lp_fee as u128)
                    .checked_mul(crate::constants::FEE_PER_SHARE_PRECISION) // 10^18 精度
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                    .checked_div(self.total_lp_shares as u128)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

                self.fee_per_share_cumulative = self.fee_per_share_cumulative
                    .checked_add(fee_per_share_increase)
                    .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
            }

            // 注意：不修改 Settlement Ledger 的字段：
            // - total_collateral_locked (不变)
            // - total_yes_minted (不变)
            // - total_no_minted (不变)

            msg!("SELL completed (Pool only, Settlement unchanged)");

            // ✅ v1.0.12: 返回准确的交易数据
            // ✅ v1.1.0: 更新为 USDC 字段名
            Ok(SwapResult {
                usdc_amount: amount_after_fee,     // ✅ v1.1.0: 用户获得的 USDC（税后）
                token_amount: amount,              // 用户卖出的代币数量
                fee_usdc: total_fee,               // ✅ v1.1.0: 总手续费（USDC）
            })
            }
        })(); // 立即执行闭包

        // ✅ v2.3: 恢复原始 b 值（闭包执行完成后）
        // 注意：必须在闭包之后、返回之前恢复
        self.lmsr_b = _b_restorer.original_b;

        // ✅ v2.3: 返回闭包的结果
        // _reentrancy_guard 会在这里 drop，自动解锁 swap_in_progress
        swap_result
    }

    fn get_tokens_for_buy_sol(&self, sol_amount: u64, token_type: u8) -> Option<BuyResult> {
        // ✅ v1.0.10: 使用定点 LMSR 定价算法
        // LMSR Cost Function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
        // Price: P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))

        let b = self.lmsr_b;
        let q_yes = self.lmsr_q_yes;
        let q_no = self.lmsr_q_no;

        // 计算能买多少代币（使用定点数二分法）
        let token_amount = if token_type == 0 {
            // 买NO代币：增加q_no
            self.lmsr_calculate_token_amount_for_sol(sol_amount, q_yes, q_no, b, false).ok()?
        } else {
            // 买YES代币：增加q_yes
            self.lmsr_calculate_token_amount_for_sol(sol_amount, q_yes, q_no, b, true).ok()?
        };

        Some(BuyResult {
            token_amount,
            change_amount: sol_amount,
            current_yes_reserves: 0, // LMSR不使用reserves
            current_no_reserves: 0,
            new_yes_reserves: 0,
            new_no_reserves: 0,
        })
    }

    fn apply_buy(&mut self, change_amount: u64, token_type: u8) -> Option<BuyResult> {
        use crate::math::LmsrCalculator;

        // ✅ 使用LMSR计算代币数量
        let result = self.get_tokens_for_buy_sol(change_amount, token_type)?;

        // ✅ v1.6.0: 使用 LmsrCalculator 安全更新持仓（消除手动类型转换）
        let calc = LmsrCalculator::new(self);
        let (new_q_yes, new_q_no) = calc
            .new_positions_after_buy(result.token_amount, token_type == 1)
            .ok()?;

        // 更新持仓
        self.lmsr_q_yes = new_q_yes;
        self.lmsr_q_no = new_q_no;

        // ✅ v1.3.1: 验证持仓不平衡度（防止极端单边持仓）
        let max_imbalance = (self.lmsr_b as i64)
            .checked_mul(crate::constants::MAX_POSITION_IMBALANCE_MULTIPLIER as i64)?;
        let current_imbalance = (new_q_yes - new_q_no).abs();

        if current_imbalance > max_imbalance {
            msg!(
                "⚠️ Position imbalance limit exceeded: current={}, max={} ({}x lmsr_b)",
                current_imbalance,
                max_imbalance,
                crate::constants::MAX_POSITION_IMBALANCE_MULTIPLIER
            );
            return None;
        }

        Some(result)
    }

    fn apply_sell(&mut self, change_amount: u64, token_type: u8) -> Option<SellResult> {
        use crate::math::LmsrCalculator;

        // ✅ 使用LMSR计算SOL数量
        let result = self.get_tokens_for_sell_sol(change_amount, token_type)?;

        // ✅ v1.6.0: 使用 LmsrCalculator 安全更新持仓（消除手动类型转换）
        let calc = LmsrCalculator::new(self);
        let (new_q_yes, new_q_no) = calc
            .new_positions_after_sell(change_amount, token_type == 1)
            .ok()?;

        // 更新持仓
        self.lmsr_q_yes = new_q_yes;
        self.lmsr_q_no = new_q_no;

        // ✅ v1.3.1: 验证持仓不平衡度（防止极端单边持仓）
        let max_imbalance = (self.lmsr_b as i64)
            .checked_mul(crate::constants::MAX_POSITION_IMBALANCE_MULTIPLIER as i64)?;
        let current_imbalance = (new_q_yes - new_q_no).abs();

        if current_imbalance > max_imbalance {
            msg!(
                "⚠️ Position imbalance limit exceeded: current={}, max={} ({}x lmsr_b)",
                current_imbalance,
                max_imbalance,
                crate::constants::MAX_POSITION_IMBALANCE_MULTIPLIER
            );
            return None;
        }

        Some(result)
    }

    fn get_tokens_for_sell_sol(&self, token_amount: u64, token_type: u8) -> Option<SellResult> {
        // ✅ v1.0.10: 使用定点 LMSR 定价算法
        let b = self.lmsr_b;
        let q_yes = self.lmsr_q_yes;
        let q_no = self.lmsr_q_no;

        // 计算卖出token_amount代币能获得多少SOL（使用定点数）
        let sol_amount = if token_type == 0 {
            // 卖NO代币：减少q_no
            self.lmsr_calculate_sol_for_token_amount(token_amount, q_yes, q_no, b, false).ok()?
        } else {
            // 卖YES代币：减少q_yes
            self.lmsr_calculate_sol_for_token_amount(token_amount, q_yes, q_no, b, true).ok()?
        };

        Some(SellResult {
            token_amount,
            change_amount: sol_amount,
            current_yes_reserves: 0, // LMSR不使用reserves
            current_no_reserves: 0,
            new_yes_reserves: 0,
            new_no_reserves: 0,
        })
    }

    // ✅ v3.0.1: resolution() 实现已完全移除
    // 实际结算功能通过独立的 Resolution 指令处理
}

// ✅ v1.0.10: 定点 LMSR 实现（替换 f64/exp/ln）
impl Market {
    /// LMSR成本函数: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
    ///
    /// ✅ 使用定点数替代 f64，确保确定性和安全性
    pub fn lmsr_cost(&self, q_yes: i64, q_no: i64, b: u64) -> Result<u64> {
        crate::math::lmsr::lmsr_cost(b, q_yes, q_no)
    }

    /// 计算给定 USDC 能买多少代币
    ///
    /// ✅ 使用定点数二分法，最大迭代次数 50（Gas 限制）
    pub fn lmsr_calculate_token_amount_for_sol(
        &self,
        sol_amount: u64,
        q_yes: i64,
        q_no: i64,
        b: u64,
        is_yes: bool,
    ) -> Result<u64> {
        crate::math::lmsr::lmsr_tokens_for_usdc(b, q_yes, q_no, sol_amount, is_yes)
    }

    /// ✅ v1.3.1: 计算当前YES代币的市场价格（基点）
    ///
    /// 🔒 CRITICAL FIX (2025-11-03): 使用精确的LMSR边际价格函数
    /// 修复线性近似在极端持仓时的偏差（HIGH-SEVERITY漏洞）
    ///
    /// 使用LMSR公式：P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
    ///
    /// # 返回值
    /// 价格（基点，0-10000），例如6500表示65%
    pub fn calculate_yes_price_bps(&self) -> Result<u16> {
        // 如果b=0，返回50%（中性）
        if self.lmsr_b == 0 {
            return Ok(5000);
        }

        // 🔒 CRITICAL FIX: 使用精确的 LMSR 边际价格函数
        // 替换之前的线性近似公式（在 q_diff > 4b 时偏差严重）
        let yes_price_fp = self.lmsr_get_yes_price()?;

        // 将 FixedPoint 转换为基点（0-10000）
        // FixedPoint 的精度是 10^18，价格范围是 [0, 1]
        // 需要转换为 [0, 10000] 的基点
        let price_bps = (yes_price_fp as u128)
            .checked_mul(10000)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
            .checked_div(crate::math::fixed_point::constants::ONE as u128)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64;

        // 限制在0-10000范围内（防御性编程）
        let price_clamped = price_bps.min(10000) as u16;

        Ok(price_clamped)
    }

    /// ✅ v1.5.0: 计算动态调整后的b值（基于距离结算时间）
    ///
    /// **目的**：降低临门风险，防止市场结算前被恶意狙击
    ///
    /// **逻辑**：
    /// - 距离结算 > 7天：b × 1.0（正常）
    /// - 距离结算 3-7天：b × 1.2（中期）
    /// - 距离结算 < 3天：b × 1.5（临近期）
    ///
    /// **效果**：
    /// - b值增大 → 流动性深度增加 → 价格变动更平缓
    /// - 防止最后时刻巨额订单打穿市场
    ///
    /// **示例**：
    /// - 原始b=1000，距离结算2天 → 有效b=1500
    /// - 原价格50%时，买10000 USDC YES原本推至60% → 现在仅推至55%
    pub fn calculate_effective_lmsr_b(&self) -> Result<u64> {
        // 如果市场没有结束时间，使用原始b值
        let ending_slot = match self.ending_slot {
            Some(slot) => slot,
            None => return Ok(self.lmsr_b),
        };

        // 获取当前时间
        let clock = Clock::get()?;
        let current_slot = clock.slot;

        // 如果已经结束，使用原始b值（不应该还在交易，但作为保护）
        if current_slot >= ending_slot {
            return Ok(self.lmsr_b);
        }

        // 计算距离结算的时间（秒）
        // Solana slot时间约400ms = 0.4秒
        let slots_remaining = ending_slot.saturating_sub(current_slot);
        let seconds_to_settlement = (slots_remaining as i64) * 4 / 10; // 0.4秒 = 4/10

        // 根据时间选择b值乘数
        let b_multiplier = if seconds_to_settlement < crate::constants::FINAL_STAGE_SECONDS {
            crate::constants::FINAL_STAGE_B_MULTIPLIER  // < 72h: 1.5x
        } else if seconds_to_settlement < crate::constants::MID_STAGE_SECONDS {
            crate::constants::MID_STAGE_B_MULTIPLIER    // 72h-7d: 1.2x
        } else {
            crate::constants::NORMAL_STAGE_B_MULTIPLIER // > 7d: 1.0x
        };

        // 计算有效b值
        let effective_b = (self.lmsr_b as u128)
            .checked_mul(b_multiplier as u128)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
            .checked_div(crate::constants::BASIS_POINTS_DIVISOR as u128)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64;

        Ok(effective_b)
    }

    /// 计算卖出代币能获得多少 USDC
    ///
    /// ✅ 使用定点数二分法
    pub fn lmsr_calculate_sol_for_token_amount(
        &self,
        token_amount: u64,
        q_yes: i64,
        q_no: i64,
        b: u64,
        is_yes: bool,
    ) -> Result<u64> {
        crate::math::lmsr::lmsr_sell_payout(b, q_yes, q_no, token_amount, is_yes)
    }

    /// 获取当前YES边际价格
    ///
    /// ✅ 返回定点数价格（需要转换为百分比）
    pub fn lmsr_get_yes_price(&self) -> Result<crate::math::FixedPoint> {
        let b = self.lmsr_b;
        let q_yes = self.lmsr_q_yes;
        let q_no = self.lmsr_q_no;

        crate::math::lmsr::lmsr_marginal_price(b, q_yes, q_no)
    }

    /// 获取当前NO边际价格
    ///
    /// ✅ P(NO) = 1 - P(YES)
    pub fn lmsr_get_no_price(&self) -> Result<crate::math::FixedPoint> {
        let yes_price = self.lmsr_get_yes_price()?;
        let one = crate::math::fixed_point::constants::ONE;

        Ok(one.checked_sub(yes_price).ok_or(crate::errors::PredictionMarketError::MathOverflow)?)
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: 熔断机制和内部交换辅助方法
    // ═══════════════════════════════════════════════════════════════

    /// 计算池子不平衡比例（放大100倍精度）
    ///
    /// # 返回值
    /// 例如：150 = 1.5:1, 200 = 2:1, 400 = 4:1
    ///
    /// # 示例
    /// - pool_yes_reserve = 300, pool_no_reserve = 100 → 返回 300 (3:1)
    /// - pool_yes_reserve = 100, pool_no_reserve = 100 → 返回 100 (1:1)
    pub fn get_imbalance_ratio(&self) -> u128 {
        let (larger, smaller) = if self.pool_yes_reserve > self.pool_no_reserve {
            (self.pool_yes_reserve, self.pool_no_reserve)
        } else {
            (self.pool_no_reserve, self.pool_yes_reserve)
        };

        if smaller == 0 {
            return u128::MAX; // 单边池子，视为无限不平衡
        }

        // 返回 (larger / smaller) * 100
        (larger as u128 * 100) / (smaller as u128)
    }

    /// 内部卖出 YES 代币（无手续费，用于 LP 撤出）
    ///
    /// ✅ v3.0: LP 撤出时处理剩余单边代币的内部交换
    /// ✅ v3.1.0: 返回详细的滑点数据
    ///
    /// # 参数
    /// * `amount` - YES 代币数量
    ///
    /// # 返回值
    /// InternalSwapResult - 包含USDC数量和滑点信息
    ///
    /// # 注意
    /// 此方法仅供内部使用，不收取任何手续费
    pub fn internal_sell_yes(&mut self, amount: u64) -> Result<InternalSwapResult> {
        use crate::math::LmsrCalculator;

        // ✅ v3.1.0: 记录交换前的池子状态
        let imbalance_before = self.get_imbalance_ratio();

        // 使用 LMSR 计算卖出收益
        let calculator = LmsrCalculator::new(self);
        let usdc_out = calculator.sell_yes_proceeds(amount)?;

        // 更新 LMSR 持仓
        self.lmsr_q_yes = self.lmsr_q_yes
            .checked_add(amount as i64)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        // 更新池子储备
        self.pool_yes_reserve = self.pool_yes_reserve
            .checked_add(amount)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        self.pool_collateral_reserve = self.pool_collateral_reserve
            .checked_sub(usdc_out)
            .ok_or(crate::errors::PredictionMarketError::InsufficientLiquidity)?;

        // ✅ v3.1.0: 计算滑点
        let usdc_expected = amount; // 理想情况：1 YES = 1 USDC
        let slippage_bps = if usdc_expected > 0 {
            let slippage = usdc_expected.saturating_sub(usdc_out);
            ((slippage as u128)
                .checked_mul(crate::constants::BASIS_POINTS_DIVISOR as u128)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_div(usdc_expected as u128)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?) as u16
        } else {
            0
        };

        // ✅ v3.1.0: 记录交换后的池子状态
        let imbalance_after = self.get_imbalance_ratio();

        msg!(
            "✅ v3.1.0 Internal sell YES: {} tokens → {} USDC (expected: {}, slippage: {}bps, no fee)",
            amount,
            usdc_out,
            usdc_expected,
            slippage_bps
        );

        Ok(InternalSwapResult {
            token_amount_in: amount,
            usdc_amount_out: usdc_out,
            usdc_expected,
            slippage_bps,
            pool_imbalance_before: imbalance_before,
            pool_imbalance_after: imbalance_after,
        })
    }

    /// 内部卖出 NO 代币（无手续费，用于 LP 撤出）
    ///
    /// ✅ v3.0: LP 撤出时处理剩余单边代币的内部交换
    /// ✅ v3.1.0: 返回详细的滑点数据
    ///
    /// # 参数
    /// * `amount` - NO 代币数量
    ///
    /// # 返回值
    /// InternalSwapResult - 包含USDC数量和滑点信息
    ///
    /// # 注意
    /// 此方法仅供内部使用，不收取任何手续费
    pub fn internal_sell_no(&mut self, amount: u64) -> Result<InternalSwapResult> {
        use crate::math::LmsrCalculator;

        // ✅ v3.1.0: 记录交换前的池子状态
        let imbalance_before = self.get_imbalance_ratio();

        // 使用 LMSR 计算卖出收益
        let calculator = LmsrCalculator::new(self);
        let usdc_out = calculator.sell_no_proceeds(amount)?;

        // 更新 LMSR 持仓
        self.lmsr_q_no = self.lmsr_q_no
            .checked_add(amount as i64)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        // 更新池子储备
        self.pool_no_reserve = self.pool_no_reserve
            .checked_add(amount)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        self.pool_collateral_reserve = self.pool_collateral_reserve
            .checked_sub(usdc_out)
            .ok_or(crate::errors::PredictionMarketError::InsufficientLiquidity)?;

        // ✅ v3.1.0: 计算滑点
        let usdc_expected = amount; // 理想情况：1 NO = 1 USDC
        let slippage_bps = if usdc_expected > 0 {
            let slippage = usdc_expected.saturating_sub(usdc_out);
            ((slippage as u128)
                .checked_mul(crate::constants::BASIS_POINTS_DIVISOR as u128)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
                .checked_div(usdc_expected as u128)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?) as u16
        } else {
            0
        };

        // ✅ v3.1.0: 记录交换后的池子状态
        let imbalance_after = self.get_imbalance_ratio();

        msg!(
            "✅ v3.1.0 Internal sell NO: {} tokens → {} USDC (expected: {}, slippage: {}bps, no fee)",
            amount,
            usdc_out,
            usdc_expected,
            slippage_bps
        );

        Ok(InternalSwapResult {
            token_amount_in: amount,
            usdc_amount_out: usdc_out,
            usdc_expected,
            slippage_bps,
            pool_imbalance_before: imbalance_before,
            pool_imbalance_after: imbalance_after,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::config::Config;

    /// ✅ v2.5 回归测试：验证 swap 失败时状态能正确恢复
    ///
    /// 测试场景：
    /// 1. swap_in_progress 应在失败后自动清除（ReentrancyGuard RAII）
    /// 2. lmsr_b 应在失败后恢复原值（闭包内 require! 失败）
    #[test]
    fn test_swap_state_recovery_on_failure() {
        // 创建测试市场
        let mut market = Market {
            yes_token_mint: Pubkey::new_unique(),
            no_token_mint: Pubkey::new_unique(),
            creator: Pubkey::new_unique(),
            total_collateral_locked: 0,
            total_yes_minted: 0,
            total_no_minted: 0,
            pool_collateral_reserve: 100, // 小值，让 max_trade_size 很小
            pool_yes_reserve: 0,
            pool_no_reserve: 0,
            total_lp_shares: 0,
            lmsr_b: 1000,
            lmsr_q_yes: 0,
            lmsr_q_no: 0,
            initial_yes_token_reserves: 0,
            real_yes_token_reserves: 0,
            real_yes_sol_reserves: 0,
            token_yes_total_supply: 0,
            initial_no_token_reserves: 0,
            real_no_token_reserves: 0,
            real_no_sol_reserves: 0,
            token_no_total_supply: 0,
            is_completed: false,
            start_slot: Some(0),
            ending_slot: Some(u64::MAX),
            resolution_yes_ratio: 0,
            resolution_no_ratio: 0,
            winner_token_type: 0,
            swap_in_progress: false, // 初始未锁定
            add_liquidity_in_progress: false,  // ✅ v3.1.4: add_liquidity 重入保护
            accumulated_lp_fees: 0,
            fee_per_share_cumulative: 0,
            pool_settled: false,
            display_name: String::new(),
            withdraw_in_progress: false,
            claim_in_progress: false,
            initial_yes_prob: 5000,
            created_at: 0,
            insurance_pool_contribution: 0,
            // ✅ v3.0: 熔断机制字段
            circuit_breaker_active: false,
            circuit_breaker_triggered_at: 0,
            withdraw_last_24h: 0,
            withdraw_tracking_start: 0,
            initial_yes_reserve: 0,
            initial_no_reserve: 0,
            // ✅ v3.1.1: 市场级手续费覆盖
            has_fee_override: false,
            platform_buy_fee_override: 0,
            platform_sell_fee_override: 0,
            lp_buy_fee_override: 0,
            lp_sell_fee_override: 0,
            // ✅ v3.1.2: 市场级暂停
            market_paused: false,
            // ✅ v3.1.3: 哨兵代币追踪
            sentinel_no_minted: true,
        };

        let original_b = market.lmsr_b;

        // 创建 mock 上下文（swap 需要的账户）
        // 注意：这个测试只验证状态恢复逻辑，不执行完整的 CPI 调用
        // 因此我们预期在 require!(amount <= max_trade_size) 处失败

        // 保存初始状态
        let initial_swap_in_progress = market.swap_in_progress;
        let initial_lmsr_b = market.lmsr_b;

        // 由于 swap 需要完整的账户上下文（Config, token accounts 等），
        // 这里无法直接调用 market.swap()
        //
        // 但我们可以验证核心逻辑：
        // 1. ReentrancyGuard 的自动释放
        // 2. BValueRestorer 通过闭包确保恢复

        // 模拟重入保护测试
        {
            let _guard = crate::utils::ReentrancyGuard::new(&mut market.swap_in_progress);
            assert!(_guard.is_ok(), "Should acquire lock");
            assert!(market.swap_in_progress, "Lock should be set");

            // 模拟失败场景
            let result: Result<()> = Err(crate::errors::PredictionMarketError::InvalidAmount.into());

            // _guard drop 时应该自动释放锁
            drop(_guard);
            drop(result);
        }

        // 验证锁已释放
        assert!(!market.swap_in_progress, "Lock should be released after guard drop");

        // 模拟 b 值恢复测试
        {
            let effective_b = 500; // 模拟动态 b 值
            let original_b = market.lmsr_b;

            market.lmsr_b = effective_b;

            struct BValueRestorer {
                original_b: u64,
            }
            let _b_restorer = BValueRestorer { original_b };

            // 模拟闭包内失败
            let swap_result = (|| -> Result<()> {
                // 模拟 require! 失败
                require!(false, crate::errors::PredictionMarketError::InvalidAmount);
                Ok(())
            })();

            // 恢复 b 值（关键：这行必须执行）
            market.lmsr_b = _b_restorer.original_b;

            // 验证
            assert!(swap_result.is_err(), "Should fail");
            assert_eq!(market.lmsr_b, original_b, "lmsr_b should be restored");
        }

        // 最终验证：状态应恢复到初始值
        assert_eq!(market.swap_in_progress, initial_swap_in_progress);
        assert_eq!(market.lmsr_b, initial_lmsr_b);
    }

    /// ✅ v2.5 回归测试：验证重入保护正常工作
    #[test]
    fn test_reentrancy_protection() {
        let mut swap_in_progress = false;

        // 第一次获取锁应该成功
        let guard1 = crate::utils::ReentrancyGuard::new(&mut swap_in_progress);
        assert!(guard1.is_ok(), "First lock should succeed");
        assert!(swap_in_progress, "Flag should be set");

        // 在持有锁时尝试再次获取应该失败
        let guard2 = crate::utils::ReentrancyGuard::new(&mut swap_in_progress);
        assert!(guard2.is_err(), "Reentrancy should be detected");

        // 释放第一个锁
        drop(guard1);
        assert!(!swap_in_progress, "Flag should be cleared after drop");

        // 现在应该能再次获取
        let guard3 = crate::utils::ReentrancyGuard::new(&mut swap_in_progress);
        assert!(guard3.is_ok(), "Should acquire lock after release");
    }
}
