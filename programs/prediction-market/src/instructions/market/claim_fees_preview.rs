//! ✅ v3.1.1: LP 手续费领取预览（只读）
//!
//! 计算某 LP 当前可领取的手续费金额，并判断发放后是否会触发
//! 市场 USDC 金库的“最小余额保护”。便于前端在提交前给出友好提示。

use crate::constants::{CONFIG, MARKET, MARKET_USDC_VAULT, LPPOSITION, FEE_PER_SHARE_PRECISION};
use crate::errors::PredictionMarketError;
use crate::state::{config::Config, market::{Market, LPPosition}};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct ClaimFeesPreview<'info> {
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
    pub yes_token: AccountInfo<'info>,
    pub no_token: AccountInfo<'info>,

    /// USDC mint（用于校验）
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// 市场 USDC 金库 PDA + ATA（只读余额）
    /// CHECK: derived PDA
    #[account(
        seeds = [MARKET_USDC_VAULT.as_bytes(), market.key().as_ref()],
        bump,
    )]
    pub market_usdc_vault: AccountInfo<'info>,

    #[account(
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Account<'info, TokenAccount>,

    /// LP Position（只读）
    #[account(
        seeds = [LPPOSITION.as_bytes(), market.key().as_ref(), lp.key().as_ref()],
        bump,
    )]
    pub lp_position: Account<'info, LPPosition>,

    /// LP（只读身份标识，无需签名）
    /// CHECK: read-only identity for PDA seed
    pub lp: AccountInfo<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ClaimFeesPreviewResult {
    pub lp: Pubkey,
    pub market: Pubkey,
    pub lp_shares: u64,
    pub fee_per_share_delta: u128,
    pub claimable_fees: u64,
    pub vault_balance_before: u64,
    pub min_balance: u64,
    pub remaining_after: u64,
    pub will_violate_min_balance: bool,
}

pub fn handler(ctx: Context<ClaimFeesPreview>) -> Result<ClaimFeesPreviewResult> {
    let global = &ctx.accounts.global_config;
    let market = &ctx.accounts.market;
    let lp_pos = &ctx.accounts.lp_position;

    // 计算可领取金额：lp_shares * (fee_per_share_cumulative - last_fee_per_share) / 1e18
    let fee_per_share_delta = market
        .fee_per_share_cumulative
        .checked_sub(lp_pos.last_fee_per_share)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let claimable_u128 = (lp_pos.lp_shares as u128)
        .checked_mul(fee_per_share_delta)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(FEE_PER_SHARE_PRECISION)
        .ok_or(PredictionMarketError::MathOverflow)?;

    require!(claimable_u128 <= u64::MAX as u128, PredictionMarketError::MathOverflow);
    let claimable_fees = claimable_u128 as u64;

    // 读取金库余额并预估“最小余额保护”
    let vault_before = ctx.accounts.market_usdc_ata.amount;

    // 领取后剩余余额
    let remaining_after = vault_before.saturating_sub(claimable_fees);
    let will_violate = remaining_after < global.usdc_vault_min_balance;

    Ok(ClaimFeesPreviewResult {
        lp: ctx.accounts.lp.key(),
        market: market.key(),
        lp_shares: lp_pos.lp_shares,
        fee_per_share_delta,
        claimable_fees,
        vault_balance_before: vault_before,
        min_balance: global.usdc_vault_min_balance,
        remaining_after,
        will_violate_min_balance: will_violate,
    })
}

