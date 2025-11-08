//! ✅ v3.0: LP 撤出预览（前端辅助）
//!
//! **功能**：
//! - 只读指令，不修改链上状态
//! - 帮助前端计算撤出流动性时的预期收益和惩罚
//! - 返回详细的撤出信息供用户决策
//!
//! **返回信息**：
//! - 预期 USDC 收益（扣除所有费用和惩罚后）
//! - 早期退出惩罚（如有）
//! - 动态撤出限制（当前最多可撤出百分比）
//! - 熔断器状态
//! - 保险池补偿（如符合条件）

use crate::{
    constants::{
        BALANCED_MAX_WITHDRAW_BPS, CONFIG,
        EARLY_EXIT_PENALTY_14D, EARLY_EXIT_PENALTY_30D, EARLY_EXIT_PENALTY_7D,
        HIGH_IMBALANCE_MAX_WITHDRAW_BPS, IMBALANCE_RATIO_HIGH,
        IMBALANCE_RATIO_MILD, IMBALANCE_RATIO_MODERATE, LPPOSITION, MARKET,
        MILD_IMBALANCE_MAX_WITHDRAW_BPS, MODERATE_IMBALANCE_MAX_WITHDRAW_BPS,
        TIME_THRESHOLD_14D, TIME_THRESHOLD_30D, TIME_THRESHOLD_7D,
    },
    state::{config::Config, market::{LPPosition, Market}},
};
use anchor_lang::prelude::*;
use crate::math::LmsrCalculator;

/// 账户集合：撤出预览
#[derive(Accounts)]
pub struct WithdrawPreview<'info> {
    /// 全局配置（只读）
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    /// 市场账户（只读）
    #[account(
        seeds = [MARKET.as_bytes(), &market.yes_token_mint.to_bytes(), &market.no_token_mint.to_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// LP 仓位（只读）
    #[account(
        seeds = [LPPOSITION.as_bytes(), market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub lp_position: Account<'info, LPPosition>,

    /// 用户（无需签名，只读查询）
    /// CHECK: read-only query, no signature required
    pub user: AccountInfo<'info>,
}

/// 撤出预览结果
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WithdrawPreviewResult {
    /// 预期 USDC 收益（扣除所有费用后）
    pub estimated_usdc_out: u64,

    /// 早期退出惩罚金额（USDC）
    pub early_exit_penalty: u64,

    /// 早期退出惩罚百分比（基点）
    pub early_exit_penalty_bps: u16,

    /// 当前最大允许撤出份额（基点）
    pub max_withdraw_bps: u16,

    /// 当前最大允许撤出份额（绝对值）
    pub max_withdraw_shares: u64,

    /// 熔断器是否激活
    pub circuit_breaker_active: bool,

    /// 池子不平衡比例（放大 100 倍）
    pub pool_imbalance_ratio: u128,

    /// 持有时间（秒）
    pub holding_period_seconds: i64,

    /// 保险池补偿金额（如符合条件）
    pub insurance_compensation: u64,

    /// 损失率（基点，如有）
    pub loss_rate_bps: u16,

    /// ✅ v3.1.1: 内部交换明细（用于前端更直观展示）
    /// 剩余待内部卖出的 YES 数量
    pub leftover_yes: u64,

    /// 剩余待内部卖出的 NO 数量
    pub leftover_no: u64,

    /// 内部卖出获得的 USDC（精确 LMSR 估算值）
    pub leftover_usdc_estimate: u64,

    /// 内部卖出滑点（bps），相对理想 1:1 兑换
    pub internal_slippage_bps: u16,

    /// 交换前池子状态（便于前端对比展示）
    pub pool_yes_reserve_before: u64,
    pub pool_no_reserve_before: u64,
    pub pool_collateral_reserve_before: u64,

    /// 交换后池子状态（预估，不上链）
    pub pool_yes_reserve_after: u64,
    pub pool_no_reserve_after: u64,
    pub pool_collateral_reserve_after: u64,
}

pub fn handler(
    ctx: Context<WithdrawPreview>,
    lp_shares: u64,
) -> Result<WithdrawPreviewResult> {
    let market = &ctx.accounts.market;
    let lp_position = &ctx.accounts.lp_position;
    let global_config = &ctx.accounts.global_config;
    let current_timestamp = Clock::get()?.unix_timestamp;

    msg!("📊 Withdraw preview for {} shares", lp_shares);

    // 1. 检查熔断器状态
    let circuit_breaker_active = market.circuit_breaker_active;

    // 2. 计算池子不平衡比例
    let pool_imbalance_ratio = market.get_imbalance_ratio();

    // 3. 计算动态撤出限制
    let max_withdraw_bps = if pool_imbalance_ratio < IMBALANCE_RATIO_MILD {
        BALANCED_MAX_WITHDRAW_BPS
    } else if pool_imbalance_ratio < IMBALANCE_RATIO_MODERATE {
        MILD_IMBALANCE_MAX_WITHDRAW_BPS
    } else if pool_imbalance_ratio < IMBALANCE_RATIO_HIGH {
        MODERATE_IMBALANCE_MAX_WITHDRAW_BPS
    } else {
        HIGH_IMBALANCE_MAX_WITHDRAW_BPS
    };

    let max_withdraw_shares = (market.total_lp_shares as u128)
        .checked_mul(max_withdraw_bps as u128)
        .unwrap_or(0)
        .checked_div(10000)
        .unwrap_or(0) as u64;

    // 4. 计算份额对应的资产
    let share_ratio = (lp_shares as u128)
        .checked_mul(1_000_000_000_000_000_000) // 10^18 精度
        .unwrap_or(0)
        .checked_div(market.total_lp_shares as u128)
        .unwrap_or(0);

    let usdc_share = ((market.pool_collateral_reserve as u128)
        .checked_mul(share_ratio)
        .unwrap_or(0)
        / 1_000_000_000_000_000_000) as u64;

    let yes_share = ((market.pool_yes_reserve as u128)
        .checked_mul(share_ratio)
        .unwrap_or(0)
        / 1_000_000_000_000_000_000) as u64;

    let no_share = ((market.pool_no_reserve as u128)
        .checked_mul(share_ratio)
        .unwrap_or(0)
        / 1_000_000_000_000_000_000) as u64;

    // 5. 配对赎回 + 内部交换模拟（使用 LMSR 精确计算，避免价格近似误差）
    let (paired, leftover_yes, leftover_no) = if yes_share < no_share {
        (yes_share, 0, no_share - yes_share)
    } else {
        (no_share, yes_share - no_share, 0)
    };

    // 使用 LmsrCalculator 与 withdraw_liquidity 内部卖出逻辑一致，获得更精确的 USDC 估计
    let calculator = LmsrCalculator::new(market);
    let leftover_usdc_estimate = if leftover_yes > 0 {
        calculator.sell_yes_proceeds(leftover_yes).unwrap_or(0)
    } else if leftover_no > 0 {
        calculator.sell_no_proceeds(leftover_no).unwrap_or(0)
    } else {
        0
    };

    // 计算内部交换滑点（理想 1:1 兑换 → expected = amount）
    let internal_slippage_bps: u16 = if leftover_yes > 0 {
        let expected = leftover_yes;
        if expected > 0 && leftover_usdc_estimate < expected {
            (((expected - leftover_usdc_estimate) as u128)
                .saturating_mul(10000)
                .checked_div(expected as u128)
                .unwrap_or(0)) as u16
        } else { 0 }
    } else if leftover_no > 0 {
        let expected = leftover_no;
        if expected > 0 && leftover_usdc_estimate < expected {
            (((expected - leftover_usdc_estimate) as u128)
                .saturating_mul(10000)
                .checked_div(expected as u128)
                .unwrap_or(0)) as u16
        } else { 0 }
    } else {
        0
    };

    // 记录池子状态（前/后）
    let pool_yes_reserve_before = market.pool_yes_reserve;
    let pool_no_reserve_before = market.pool_no_reserve;
    let pool_collateral_reserve_before = market.pool_collateral_reserve;

    let (pool_yes_reserve_after, pool_no_reserve_after, pool_collateral_reserve_after) = if leftover_yes > 0 {
        (
            pool_yes_reserve_before.saturating_add(leftover_yes),
            pool_no_reserve_before,
            pool_collateral_reserve_before.saturating_sub(leftover_usdc_estimate),
        )
    } else if leftover_no > 0 {
        (
            pool_yes_reserve_before,
            pool_no_reserve_before.saturating_add(leftover_no),
            pool_collateral_reserve_before.saturating_sub(leftover_usdc_estimate),
        )
    } else {
        (
            pool_yes_reserve_before,
            pool_no_reserve_before,
            pool_collateral_reserve_before,
        )
    };

    let total_usdc_before_penalty = usdc_share + paired + leftover_usdc_estimate;

    // 6. 计算早期退出惩罚
    let holding_period_seconds = current_timestamp - lp_position.created_at;
    let early_exit_penalty_bps = if holding_period_seconds < TIME_THRESHOLD_7D {
        EARLY_EXIT_PENALTY_7D
    } else if holding_period_seconds < TIME_THRESHOLD_14D {
        EARLY_EXIT_PENALTY_14D
    } else if holding_period_seconds < TIME_THRESHOLD_30D {
        EARLY_EXIT_PENALTY_30D
    } else {
        0
    };

    let early_exit_penalty = (total_usdc_before_penalty as u128)
        .checked_mul(early_exit_penalty_bps as u128)
        .unwrap_or(0)
        .checked_div(10000)
        .unwrap_or(0) as u64;

    let estimated_usdc_out = total_usdc_before_penalty.saturating_sub(early_exit_penalty);

    // 7. 计算损失率和保险池补偿
    let invested_usdc = lp_position.invested_usdc;
    let (loss_rate_bps, insurance_compensation) = if estimated_usdc_out < invested_usdc {
        let loss = invested_usdc - estimated_usdc_out;
        let loss_rate = ((loss as u128)
            .checked_mul(10000)
            .unwrap_or(0)
            .checked_div(invested_usdc as u128)
            .unwrap_or(0)) as u16;

        // 检查是否符合保险池补偿条件
        let compensation = if global_config.insurance_pool_enabled
            && loss_rate >= global_config.insurance_loss_threshold_bps
        {
            let max_compensation = (loss as u128)
                .checked_mul(global_config.insurance_max_compensation_bps as u128)
                .unwrap_or(0)
                .checked_div(10000)
                .unwrap_or(0) as u64;

            // 实际补偿 = min(计算值, 保险池余额, 市场贡献额)
            max_compensation
                .min(global_config.lp_insurance_pool_balance)
                .min(market.insurance_pool_contribution)
        } else {
            0
        };

        (loss_rate, compensation)
    } else {
        (0, 0)
    };

    msg!(
        "✅ Preview result: USDC={}, penalty={} ({}bps), max_withdraw={}bps, circuit_breaker={}, ratio={}",
        estimated_usdc_out,
        early_exit_penalty,
        early_exit_penalty_bps,
        max_withdraw_bps,
        circuit_breaker_active,
        pool_imbalance_ratio
    );

    Ok(WithdrawPreviewResult {
        estimated_usdc_out,
        early_exit_penalty,
        early_exit_penalty_bps,
        max_withdraw_bps,
        max_withdraw_shares,
        circuit_breaker_active,
        pool_imbalance_ratio,
        holding_period_seconds,
        insurance_compensation,
        loss_rate_bps,
        leftover_yes,
        leftover_no,
        leftover_usdc_estimate,
        internal_slippage_bps,
        pool_yes_reserve_before,
        pool_no_reserve_before,
        pool_collateral_reserve_before,
        pool_yes_reserve_after,
        pool_no_reserve_after,
        pool_collateral_reserve_after,
    })
}
