//! 管理员指令：配置市场级费率覆盖（可启用/关闭）

use crate::{
    constants::{CONFIG, MARKET},
    errors::PredictionMarketError,
    events::MarketFeeOverrideEvent,
    state::{config::Config, market::Market},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ConfigureMarketFees<'info> {
    /// 全局配置（用于权限验证与范围校验）
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

    /// 市场 YES/NO mint（用于推导 PDA）
    pub yes_token: AccountInfo<'info>,
    pub no_token: AccountInfo<'info>,

    /// 管理员
    #[account(
        constraint = admin.key() == global_config.authority @ PredictionMarketError::InvalidAuthority
    )]
    pub admin: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct MarketFeeOverrideParams {
    pub enabled: bool,
    pub platform_buy_fee_bps: u64,
    pub platform_sell_fee_bps: u64,
    pub lp_buy_fee_bps: u64,
    pub lp_sell_fee_bps: u64,
}

impl<'info> ConfigureMarketFees<'info> {
    pub fn handler(&mut self, params: MarketFeeOverrideParams) -> Result<()> {
        // 范围校验：bps ∈ [0, 10000]
        require!(
            params.platform_buy_fee_bps <= crate::constants::BASIS_POINTS_DIVISOR,
            PredictionMarketError::InvalidParameter
        );
        require!(
            params.platform_sell_fee_bps <= crate::constants::BASIS_POINTS_DIVISOR,
            PredictionMarketError::InvalidParameter
        );
        require!(
            params.lp_buy_fee_bps <= crate::constants::BASIS_POINTS_DIVISOR,
            PredictionMarketError::InvalidParameter
        );
        require!(
            params.lp_sell_fee_bps <= crate::constants::BASIS_POINTS_DIVISOR,
            PredictionMarketError::InvalidParameter
        );

        // 写入市场账户
        let market = &mut self.market;
        market.has_fee_override = params.enabled;
        market.platform_buy_fee_override = params.platform_buy_fee_bps;
        market.platform_sell_fee_override = params.platform_sell_fee_bps;
        market.lp_buy_fee_override = params.lp_buy_fee_bps;
        market.lp_sell_fee_override = params.lp_sell_fee_bps;

        // 事件
        let clock = Clock::get()?;
        emit!(MarketFeeOverrideEvent {
            market: market.key(),
            enabled: params.enabled,
            platform_buy_fee: params.platform_buy_fee_bps,
            platform_sell_fee: params.platform_sell_fee_bps,
            lp_buy_fee: params.lp_buy_fee_bps,
            lp_sell_fee: params.lp_sell_fee_bps,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

