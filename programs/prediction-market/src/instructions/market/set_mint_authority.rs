//! ✅ v3.0: 转移 YES/NO Mint 权限到 Market PDA
//!
//! **为什么需要这个指令？**
//! - create_market 时，yes_token 的 mint authority 必须是 global_vault
//! - 因为 market PDA 的地址派生依赖 yes_token.key()，创建时还不存在
//! - 但单币LP需要 market PDA 作为 mint authority 来内部铸造代币
//! - 因此需要两步：1) create_market (authority=global_vault) 2) set_mint_authority (transfer to market)
//!
//! **调用时机**：
//! - 在 create_market 之后立即调用
//! - 前端可以将两个指令原子化打包在一个 Transaction 中

use crate::{
    constants::{CONFIG, GLOBAL, MARKET},
    errors::PredictionMarketError,
    state::{config::Config, market::Market},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, spl_token::instruction::AuthorityType, Mint, SetAuthority, Token};

/// 账户集合：转移 Mint 权限
#[derive(Accounts)]
pub struct SetMintAuthority<'info> {
    /// ✅ v3.0.2: 全局配置（用于权限验证）
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    /// 全局金库（当前的 mint authority）
    /// CHECK: global vault PDA, current mint authority
    #[account(
        mut,
        seeds = [GLOBAL.as_bytes()],
        bump,
    )]
    pub global_vault: AccountInfo<'info>,

    /// YES 代币 Mint
    #[account(
        mut,
        constraint = yes_token.mint_authority == anchor_lang::solana_program::program_option::COption::Some(global_vault.key())
            @ PredictionMarketError::InvalidMintAuthority
    )]
    pub yes_token: Account<'info, Mint>,

    /// NO 代币 Mint
    #[account(
        mut,
        constraint = no_token.mint_authority == anchor_lang::solana_program::program_option::COption::Some(global_vault.key())
            @ PredictionMarketError::InvalidMintAuthority
    )]
    pub no_token: Account<'info, Mint>,

    /// 市场 PDA（新的 mint authority）
    #[account(
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// ✅ v3.0.2: 调用者（必须是管理员或市场创建者）
    #[account(
        constraint = authority.key() == global_config.authority || authority.key() == market.creator
            @ PredictionMarketError::InvalidAuthority
    )]
    pub authority: Signer<'info>,

    /// SPL Token 程序
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SetMintAuthority>) -> Result<()> {
    let global_vault = &ctx.accounts.global_vault;
    let yes_token = &ctx.accounts.yes_token;
    let no_token = &ctx.accounts.no_token;
    let market = &ctx.accounts.market;
    let token_program = &ctx.accounts.token_program;
    let authority = &ctx.accounts.authority;

    // ✅ v3.0.2: 记录调用者
    msg!(
        "✅ v3.0.2: set_mint_authority called by: {} (authority: {}, creator: {})",
        authority.key(),
        ctx.accounts.global_config.authority,
        market.creator
    );

    // ✅ v3.0.8: Gas 优化 - 使用 Anchor 提供的 bump，避免重复 PDA 计算 (~700-1,000 CU)
    let signer_seeds: &[&[&[u8]]] = &[&[GLOBAL.as_bytes(), &[ctx.bumps.global_vault]]];

    msg!(
        "✅ v3.0: Transferring mint authority from global_vault to market PDA: {}",
        market.key()
    );

    // 转移 YES Token mint authority
    token::set_authority(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            SetAuthority {
                current_authority: global_vault.to_account_info(),
                account_or_mint: yes_token.to_account_info(),
            },
            signer_seeds,
        ),
        AuthorityType::MintTokens,
        Some(market.key()),
    )?;

    msg!("✅ YES token mint authority transferred to market PDA");

    // 转移 NO Token mint authority
    token::set_authority(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            SetAuthority {
                current_authority: global_vault.to_account_info(),
                account_or_mint: no_token.to_account_info(),
            },
            signer_seeds,
        ),
        AuthorityType::MintTokens,
        Some(market.key()),
    )?;

    msg!("✅ NO token mint authority transferred to market PDA");
    msg!(
        "🎉 Mint authority transfer complete. Market PDA can now mint YES/NO tokens internally."
    );

    Ok(())
}
