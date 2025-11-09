//! ✅ v3.0.2: 紧急暂停功能
//!
//! **功能**：
//! - 管理员可以紧急暂停所有市场操作
//! - 用于发现严重漏洞或异常活动时快速止损
//! - 暂停后禁止: swap, add_liquidity, withdraw_liquidity
//! - 不影响: claim_rewards, claim_lp_fees（让用户能提走已有资金）
//!
//! **安全设计**：
//! - 仅global_config.authority可调用
//! - 发射EmergencyPauseEvent事件供链下监控
//! - 暂停状态存储在global_config.is_paused

use crate::{
    constants::CONFIG,
    errors::PredictionMarketError,
    events::EmergencyPauseEvent,
    state::config::Config,
};
use anchor_lang::prelude::*;

/// 账户集合：紧急暂停
#[derive(Accounts)]
pub struct EmergencyPause<'info> {
    /// 全局配置
    #[account(
        mut,
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    /// 管理员（必须是global_config.authority）
    #[account(
        constraint = authority.key() == global_config.authority @ PredictionMarketError::InvalidAuthority
    )]
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<EmergencyPause>, reason: String) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    let authority = &ctx.accounts.authority;
    let clock = Clock::get()?;

    msg!("🚨 EMERGENCY PAUSE initiated by authority: {}", authority.key());
    msg!("🚨 Reason: {}", reason);

    // 验证原因字符串长度（防止恶意大数据）
    require!(
        reason.len() <= 200,
        PredictionMarketError::InvalidParameter
    );

    // 设置暂停状态
    global_config.is_paused = true;

    // 发射事件
    emit!(EmergencyPauseEvent {
        authority: authority.key(),
        reason: reason.clone(),
        timestamp: clock.unix_timestamp,
        paused: true,
    });

    msg!("✅ System successfully paused. All critical operations are now disabled.");
    msg!("ℹ️  Users can still claim rewards and LP fees.");

    Ok(())
}
