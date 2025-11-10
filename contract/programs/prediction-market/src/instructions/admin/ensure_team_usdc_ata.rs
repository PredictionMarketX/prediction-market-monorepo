//! 管理员指令：确保团队 USDC ATA 存在（若无则创建）
//!
//! 目的：
//! - 许多路径会向团队钱包的 USDC ATA 转账平台费
//! - 若部署时未预先创建团队 USDC ATA，相关交易会失败
//! - 提供一个仅管理员可调用的便捷指令，由管理员作为 payer 支付租金创建该 ATA

use crate::constants::CONFIG;
use crate::errors::PredictionMarketError;
use crate::state::config::Config;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
pub struct EnsureTeamUsdcAta<'info> {
    /// 全局配置（用于权限与 USDC mint 验证）
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Box<Account<'info, Config>>,

    /// 管理员（payer）
    #[account(
        mut,
        constraint = admin.key() == global_config.authority @ PredictionMarketError::InvalidAuthority
    )]
    pub admin: Signer<'info>,

    /// USDC Mint（必须与全局配置一致）
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// 团队钱包（必须与配置一致）
    /// CHECK: Validated against global_config.team_wallet
    #[account(
        constraint = global_config.team_wallet == team_wallet.key() @ PredictionMarketError::IncorrectAuthority
    )]
    pub team_wallet: AccountInfo<'info>,

    /// 团队 USDC ATA（若不存在则创建）
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = team_wallet,
    )]
    pub team_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(address = anchor_lang::system_program::ID)]
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> EnsureTeamUsdcAta<'info> {
    pub fn handler(&mut self) -> Result<()> {
        // 所有工作由账户约束完成（init_if_needed 负责创建）
        msg!(
            "✅ Team USDC ATA ensured: {} (mint: {})",
            self.team_usdc_ata.key(),
            self.usdc_mint.key()
        );
        Ok(())
    }
}

