//! 市场指令：回收市场尾款
//! 🔒 v1.2.7: 从市场专用金库回收已结束市场的最小余额锁定部分

use crate::{
    constants::{CONFIG, MARKET, MARKET_USDC_VAULT},
    errors::PredictionMarketError,
    events::ReclaimDustEvent,
    state::{config::*, market::*},
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount},
};

/// 账户集合：回收尾款所需账户
#[derive(Accounts)]
pub struct ReclaimDust<'info> {
    /// 全局配置
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
        constraint = global_config.authority == authority.key() @ PredictionMarketError::IncorrectAuthority
    )]
    pub global_config: Account<'info, Config>,

    /// 管理员（必须是配置中的 authority）
    pub authority: Signer<'info>,

    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &market.yes_token_mint.to_bytes(), &market.no_token_mint.to_bytes()],
        bump,
        constraint = market.pool_settled @ PredictionMarketError::PoolNotSettled,
        constraint = market.total_collateral_locked == 0 @ PredictionMarketError::CollateralStillLocked,
        constraint = market.total_lp_shares == 0 @ PredictionMarketError::LPSharesStillExist,
    )]
    pub market: Account<'info, Market>,

    /// 🔒 v1.2.7: 市场USDC金库PDA（签名权限）
    /// CHECK: market-specific usdc vault pda
    #[account(
        seeds = [MARKET_USDC_VAULT.as_bytes(), market.key().as_ref()],
        bump,
    )]
    pub market_usdc_vault: AccountInfo<'info>,

    /// USDC Mint
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// 🔒 v1.2.7: 市场专用 USDC 金库（回收来源）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Account<'info, TokenAccount>,

    /// 团队钱包
    /// CHECK: Verified against global_config.team_wallet
    #[account(
        constraint = global_config.team_wallet == team_wallet.key() @ PredictionMarketError::IncorrectAuthority
    )]
    pub team_wallet: AccountInfo<'info>,

    /// 团队钱包 USDC ATA（接收回收的尾款）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = team_wallet,
    )]
    pub team_usdc_ata: Account<'info, TokenAccount>,

    /// Token Program
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ReclaimDust<'info> {
    /// 处理回收尾款
    ///
    /// 🔒 v1.2.7: 从市场专用金库回收资金
    ///
    /// # 参数
    /// * `market_usdc_vault_bump` - 市场专用金库 PDA bump
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    ///
    /// # 安全检查
    /// 1. 仅管理员可调用
    /// 2. 市场必须已结算 (pool_settled = true)
    /// 3. 所有抵押品已被领取 (total_collateral_locked = 0)
    /// 4. 所有LP份额已提取 (total_lp_shares = 0)
    /// 5. 🔒 v1.2.7: 从该市场的专用金库回收全部剩余余额
    pub fn handler(&mut self, market_usdc_vault_bump: u8) -> Result<()> {
        msg!("ReclaimDust start for market: {}", self.market.key());

        // ✅ v1.2.3: 验证 USDC 精度（必须为 6）
        require!(
            self.usdc_mint.decimals == crate::constants::USDC_DECIMALS,
            PredictionMarketError::InvalidParameter
        );
        msg!("✅ USDC decimals validated: {}", self.usdc_mint.decimals);

        // 🔒 v1.2.7: 获取市场专用金库余额
        let vault_balance = self.market_usdc_ata.amount;

        msg!(
            "Market vault balance: {} (pool_collateral_reserve: {}, accumulated_lp_fees: {})",
            vault_balance,
            self.market.pool_collateral_reserve,
            self.market.accumulated_lp_fees
        );

        // 验证账本已清零（纵深防御）
        require!(
            self.market.pool_collateral_reserve == 0,
            PredictionMarketError::InsufficientLiquidity
        );
        require!(
            self.market.accumulated_lp_fees == 0,
            PredictionMarketError::InsufficientBalance
        );

        // 如果金库已空，无需回收
        require!(
            vault_balance > 0,
            PredictionMarketError::InsufficientBalance
        );

        // 🔒 v1.2.7: 回收市场专用金库的全部余额（尾款/精度误差）
        let reclaimable_amount = vault_balance;

        msg!("Reclaimable amount: {}", reclaimable_amount);

        // 🔒 v1.2.7: 从市场专用金库转账到团队钱包
        let market_key = self.market.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            crate::constants::MARKET_USDC_VAULT.as_bytes(),
            market_key.as_ref(),
            &[market_usdc_vault_bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.market_usdc_ata.to_account_info(),
                    to: self.team_usdc_ata.to_account_info(),
                    authority: self.market_usdc_vault.to_account_info(),
                },
                signer_seeds,
            ),
            reclaimable_amount,
        )?;

        msg!(
            "✅ Reclaimed {} USDC dust from market {}",
            reclaimable_amount,
            self.market.key()
        );

        // 发射事件
        let clock = Clock::get()?;
        emit!(ReclaimDustEvent {
            authority: self.authority.key(),
            market: self.market.key(),
            amount_reclaimed: reclaimable_amount,
            vault_balance_before: vault_balance,
            vault_balance_after: 0,  // 🔒 v1.2.7: 回收后应为0
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}
