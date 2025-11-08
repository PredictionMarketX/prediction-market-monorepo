//! 管理员指令：市场级暂停/恢复

use crate::{
    constants::{CONFIG, MARKET},
    errors::PredictionMarketError,
    events::MarketPauseEvent,
    state::{config::Config, market::Market},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct PauseMarket<'info> {
    /// 全局配置（权限校验）
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    /// 目标市场
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// YES/NO mint（用于推导 market PDA）
    pub yes_token: AccountInfo<'info>,
    pub no_token: AccountInfo<'info>,

    /// 管理员
    #[account(
        constraint = admin.key() == global_config.authority @ PredictionMarketError::InvalidAuthority
    )]
    pub admin: Signer<'info>,
}

impl<'info> PauseMarket<'info> {
    pub fn pause(&mut self) -> Result<()> {
        self.market.market_paused = true;
        let clock = Clock::get()?;
        emit!(MarketPauseEvent {
            authority: self.admin.key(),
            market: self.market.key(),
            paused: true,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn unpause(&mut self) -> Result<()> {
        self.market.market_paused = false;
        let clock = Clock::get()?;
        emit!(MarketPauseEvent {
            authority: self.admin.key(),
            market: self.market.key(),
            paused: false,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }
}

