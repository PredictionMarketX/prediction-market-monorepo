//! ✅ v3.1.1: 卖出预览（前端辅助，只读）
//!
//! 计算在当前市场状态下，卖出给定数量的 YES/NO 代币可获得的 USDC、
//! 各类费用（平台/LP/保险分配）、以及是否会触发金库最小余额保护。

use crate::{
    constants::{CONFIG, MARKET, MARKET_USDC_VAULT, BASIS_POINTS_DIVISOR},
    state::{config::Config, market::Market},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct SellPreview<'info> {
    /// 全局配置（只读）
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    /// 市场账户（只读）
    #[account(
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// YES/NO mint（用于市场 PDA 推导）
    pub yes_token: Account<'info, Mint>,
    pub no_token: Account<'info, Mint>,

    /// USDC mint（只读校验）
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ crate::errors::PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// 市场专用 USDC 金库 PDA（只读）
    /// CHECK: derived PDA, read-only
    #[account(
        seeds = [MARKET_USDC_VAULT.as_bytes(), market.key().as_ref()],
        bump,
    )]
    pub market_usdc_vault: AccountInfo<'info>,

    /// 市场 USDC ATA（读取余额用于最小余额保护预估）
    #[account(
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Account<'info, TokenAccount>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SellPreviewResult {
    pub token_type: u8,                // 0=NO, 1=YES
    pub token_amount_in: u64,          // 用户卖出的代币数量
    pub usdc_out_before_fee: u64,      // 费用前可获得的 USDC（LMSR 计算）
    pub platform_fee: u64,             // 平台费（USDC）
    pub lp_fee: u64,                   // LP 费（USDC）
    pub total_fee: u64,                // 总费用
    pub amount_after_fee: u64,         // 用户实际到手（USDC）
    pub team_fee: u64,                 // 平台费中分配给团队的钱
    pub insurance_allocation: u64,     // 平台费中分配给保险池的份额
    pub vault_balance_before: u64,     // 市场金库当前余额
    pub min_balance: u64,              // 配置的最小余额
    pub projected_remaining: u64,      // 预计本次转账后的余额（四舍五入到0，不返回负数）
    pub will_violate_min_balance: bool,// 是否触发最小余额保护
}

pub fn handler(
    ctx: Context<SellPreview>,
    token_amount: u64,
    token_type: u8, // 0=NO, 1=YES
) -> Result<SellPreviewResult> {
    let market = &ctx.accounts.market;
    let cfg = &ctx.accounts.global_config;

    require!(token_amount > 0, crate::errors::PredictionMarketError::InvalidAmount);
    require!(token_type <= 1, crate::errors::PredictionMarketError::InvalidTokenType);

    // 计算卖出可获得 USDC（只读，使用 LMSR）
    let is_yes = token_type == 1;
    let usdc_out = market.lmsr_calculate_sol_for_token_amount(
        token_amount,
        market.lmsr_q_yes,
        market.lmsr_q_no,
        market.lmsr_b,
        is_yes,
    )?;

    // 读取生效费率（支持市场级覆盖）
    let platform_sell_bps = if market.has_fee_override { market.platform_sell_fee_override } else { cfg.platform_sell_fee };
    let lp_sell_bps = if market.has_fee_override { market.lp_sell_fee_override } else { cfg.lp_sell_fee };

    let platform_fee = (usdc_out as u128)
        .checked_mul(platform_sell_bps as u128)
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
        .checked_div(BASIS_POINTS_DIVISOR as u128)
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64;

    let lp_fee = (usdc_out as u128)
        .checked_mul(lp_sell_bps as u128)
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
        .checked_div(BASIS_POINTS_DIVISOR as u128)
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64;

    let total_fee = platform_fee
        .checked_add(lp_fee)
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

    let amount_after_fee = usdc_out
        .checked_sub(total_fee)
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

    // 保险池分配（来自平台费的一部分）
    let insurance_allocation = if platform_fee > 0 {
        (platform_fee as u128)
            .checked_mul(cfg.lp_insurance_allocation_bps as u128)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR as u128)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)? as u64
    } else { 0 };

    let team_fee = platform_fee
        .checked_sub(insurance_allocation)
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

    // 最小余额保护预估：SELL 完成后，金库需 ≥ min_balance
    let vault_balance_before = ctx.accounts.market_usdc_ata.amount;
    let projected_remaining_i = (vault_balance_before as i128)
        .checked_sub(amount_after_fee as i128)
        .and_then(|v| v.checked_sub(team_fee as i128))
        .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
    let projected_remaining = if projected_remaining_i < 0 { 0 } else { projected_remaining_i as u64 };
    let will_violate = projected_remaining < cfg.usdc_vault_min_balance;

    Ok(SellPreviewResult {
        token_type,
        token_amount_in: token_amount,
        usdc_out_before_fee: usdc_out,
        platform_fee,
        lp_fee,
        total_fee,
        amount_after_fee,
        team_fee,
        insurance_allocation,
        vault_balance_before,
        min_balance: cfg.usdc_vault_min_balance,
        projected_remaining,
        will_violate_min_balance: will_violate,
    })
}

