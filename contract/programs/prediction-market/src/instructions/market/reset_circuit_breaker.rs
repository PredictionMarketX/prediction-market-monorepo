//! ✅ v3.0: 重置熔断器
//!
//! **功能**：
//! - 管理员在池子恢复平衡后重置熔断器
//! - 允许 LP 继续撤出流动性
//!
//! **重置条件**：
//! 1. 熔断器当前处于激活状态
//! 2. 已过 24 小时冷却期
//! 3. ✅ v3.0.1: 池子比例恢复到 < 3.5:1（增加缓冲区，减少频繁切换）
//!
//! **权限**：仅管理员可调用

use crate::{
    constants::{
        CIRCUIT_BREAKER_COOLDOWN_SECONDS, CIRCUIT_BREAKER_RESET_RATIO_DENOMINATOR,
        CIRCUIT_BREAKER_RESET_RATIO_NUMERATOR, CONFIG, MARKET,
    },
    errors::PredictionMarketError,
    state::{config::Config, market::Market},
};
use anchor_lang::prelude::*;

/// 账户集合：重置熔断器
#[derive(Accounts)]
pub struct ResetCircuitBreaker<'info> {
    /// 全局配置
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &market.yes_token_mint.to_bytes(), &market.no_token_mint.to_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// 管理员（必须是 config.authority）
    #[account(
        constraint = admin.key() == global_config.authority @ PredictionMarketError::InvalidAuthority
    )]
    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<ResetCircuitBreaker>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let current_timestamp = Clock::get()?.unix_timestamp;

    msg!("🔧 Admin resetting circuit breaker for market: {}", market.key());

    // 验证 1: 熔断器必须处于激活状态
    require!(
        market.circuit_breaker_active,
        PredictionMarketError::CircuitBreakerNotActive
    );

    // 验证 2: 24 小时冷却期已过
    let elapsed = current_timestamp - market.circuit_breaker_triggered_at;
    require!(
        elapsed >= CIRCUIT_BREAKER_COOLDOWN_SECONDS,
        PredictionMarketError::CircuitBreakerCooldownNotElapsed
    );

    // ✅ v3.0.1: 验证池子比例已恢复到 < 3.5:1（7/2）
    // 使用分数比较避免浮点数：larger / smaller < 7/2
    // 等价于：larger * 2 < smaller * 7
    let (larger, smaller) = if market.pool_yes_reserve > market.pool_no_reserve {
        (market.pool_yes_reserve, market.pool_no_reserve)
    } else {
        (market.pool_no_reserve, market.pool_yes_reserve)
    };

    if smaller > 0 {
        // larger / smaller < 7/2  =>  2*larger < 7*smaller
        let left_side = larger
            .checked_mul(CIRCUIT_BREAKER_RESET_RATIO_DENOMINATOR)
            .ok_or(PredictionMarketError::MathOverflow)?;
        let right_side = smaller
            .checked_mul(CIRCUIT_BREAKER_RESET_RATIO_NUMERATOR)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            left_side < right_side,
            PredictionMarketError::CircuitBreakerConditionsNotMet
        );

        // 计算实际比例用于日志（近似值）
        let ratio_display = if smaller > 0 {
            (larger * 100) / smaller // 以 0.01x 为单位
        } else {
            0
        };

        msg!(
            "✅ Pool ratio recovered: {:.2}:1 (threshold: < 3.5:1)",
            ratio_display as f64 / 100.0
        );
    } else {
        // 单边池子，不允许重置
        return Err(PredictionMarketError::CircuitBreakerConditionsNotMet.into());
    }

    // 重置熔断器
    market.circuit_breaker_active = false;
    market.circuit_breaker_triggered_at = 0;

    // 重置 24 小时撤出追踪
    market.withdraw_last_24h = 0;
    market.withdraw_tracking_start = current_timestamp;

    msg!(
        "🎉 Circuit breaker reset successfully. LP withdrawals are now enabled. Cooldown period: {} hours",
        elapsed / 3600
    );

    Ok(())
}
