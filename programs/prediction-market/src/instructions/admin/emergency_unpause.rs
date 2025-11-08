//! ✅ v3.0.2: 紧急恢复功能
//!
//! **功能**：
//! - 管理员在修复问题后恢复系统正常运行
//! - 恢复所有被暂停的操作
//!
//! **安全设计**：
//! - 仅global_config.authority可调用
//! - 发射EmergencyPauseEvent事件（paused=false）供链下监控

use crate::{
    constants::CONFIG,
    errors::PredictionMarketError,
    events::EmergencyPauseEvent,
    state::config::Config,
};
use anchor_lang::prelude::*;

/// 账户集合：恢复运行
#[derive(Accounts)]
pub struct EmergencyUnpause<'info> {
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

pub fn handler(ctx: Context<EmergencyUnpause>, message: String) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    let authority = &ctx.accounts.authority;
    let clock = Clock::get()?;

    msg!("✅ EMERGENCY UNPAUSE initiated by authority: {}", authority.key());
    msg!("✅ Message: {}", message);

    // 验证消息字符串长度
    require!(
        message.len() <= 200,
        PredictionMarketError::InvalidParameter
    );

    // 检查当前是否处于暂停状态
    require!(
        global_config.is_paused,
        PredictionMarketError::NotPaused
    );

    // 恢复运行
    global_config.is_paused = false;

    // 发射事件
    emit!(EmergencyPauseEvent {
        authority: authority.key(),
        reason: message.clone(),
        timestamp: clock.unix_timestamp,
        paused: false,
    });

    msg!("🎉 System successfully unpaused. All operations are now enabled.");

    Ok(())
}
