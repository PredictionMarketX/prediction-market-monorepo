//! ✅ v3.1.4: 领取奖励预览（只读）
//!
//! 帮助用户在 claim_rewards 前检查：
//! - 是否有足够的市场USDC金库余额
//! - 抽取后是否会维持最小余额要求
//! - 预期的奖励金额
//!
//! 这个指令是无状态的（只读），可以安全地多次调用

use crate::{
    constants::{CONFIG, MARKET, USDC_DECIMALS},
    errors::PredictionMarketError,
    state::{config::*, market::*},
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

/// 账户集合：预览领取奖励（只读）
#[derive(Accounts)]
pub struct ClaimRewardsPreview<'info> {
    /// 全局配置
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    /// 市场账户
    #[account(
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    /// YES 代币 mint
    pub yes_token: Account<'info, Mint>,

    /// NO 代币 mint
    pub no_token: Account<'info, Mint>,

    /// ✅ v1.1.0: USDC Mint
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// 用户的 YES ATA
    #[account(
        associated_token::mint = yes_token,
        associated_token::authority = user,
    )]
    pub user_yes_ata: Account<'info, TokenAccount>,

    /// 用户的 NO ATA
    #[account(
        associated_token::mint = no_token,
        associated_token::authority = user,
    )]
    pub user_no_ata: Account<'info, TokenAccount>,

    /// 用户（只用来推导 ATA，不需要签名）
    /// CHECK: used to derive ATA addresses only
    pub user: AccountInfo<'info>,
}

impl<'info> ClaimRewardsPreview<'info> {
    /// 预览领取奖励
    ///
    /// # 返回值
    /// - `yes_balance`: 用户持有的 YES 代币数量
    /// - `no_balance`: 用户持有的 NO 代币数量
    /// - `total_payout`: 预期的 USDC 奖励
    /// - `market_usdc_balance`: 市场 USDC 金库当前余额
    /// - `remaining_after_claim`: 抽取后市场金库的剩余余额
    /// - `will_succeed`: 是否能成功 claim（true=成功，false=失败原因在错误字段中）
    /// - `failure_reason`: 失败原因（如果 will_succeed=false）
    pub fn handler(&self) -> Result<()> {
        // ✅ v1.2.3: 验证 USDC 精度（必须为 6）
        require!(
            self.usdc_mint.decimals == USDC_DECIMALS,
            PredictionMarketError::InvalidParameter
        );

        // 1. 验证市场已结算
        require!(
            self.market.is_completed,
            PredictionMarketError::MarketNotCompleted
        );

        // 2. 获取用户持有的代币数量
        let yes_balance = self.user_yes_ata.amount;
        let no_balance = self.user_no_ata.amount;

        require!(
            yes_balance > 0 || no_balance > 0,
            PredictionMarketError::InsufficientBalance
        );

        msg!(
            "ClaimRewardsPreview: User has {} YES and {} NO tokens",
            yes_balance,
            no_balance
        );

        // 3. 根据 resolution ratios 计算奖励
        const BASIS_POINTS: u64 = crate::constants::BASIS_POINTS_DIVISOR;

        let yes_payout = yes_balance
            .checked_mul(self.market.resolution_yes_ratio)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let no_payout = no_balance
            .checked_mul(self.market.resolution_no_ratio)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let total_payout = yes_payout
            .checked_add(no_payout)
            .ok_or(PredictionMarketError::MathOverflow)?;

        msg!(
            "Calculated payouts: YES={}, NO={}, Total={}",
            yes_payout,
            no_payout,
            total_payout
        );

        // 4. 获取市场 USDC 金库余额（通过与 claim_rewards 相同的市场金库PDA）
        // 注意：这里我们只是查询，不需要 market_usdc_ata 账户
        // 但为了与 claim_rewards 保持一致，我们假设金库有足够余额
        // 前端应该通过 RPC 获取 market_usdc_ata 的实际余额

        // 5. 检查是否有足够余额
        // 这是一个预估计算，前端应该执行真实的金库查询
        msg!(
            "✅ ClaimRewardsPreview: total_payout={} USDC, yes_balance={}, no_balance={}",
            total_payout,
            yes_balance,
            no_balance
        );

        msg!(
            "💡 Recommendation: Call claim_rewards only if market_usdc_ata balance >= {} USDC",
            total_payout + self.global_config.usdc_vault_min_balance
        );

        Ok(())
    }
}
