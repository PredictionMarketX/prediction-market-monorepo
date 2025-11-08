//! LP 费用领取指令（公平分配版）
//! ✅ 双账本系统：只操作 Pool Ledger
//!
//! 功能：
//! - LP 按累计每份额收益公平领取手续费
//! - 使用 fee_per_share_cumulative 模型防止抢跑
//! - 更新 last_fee_per_share 防止重复领取
//! - 手续费从 accumulated_lp_fees 扣除
//!
//! 公平分配原理：
//! - 全局维护 fee_per_share_cumulative（每次 swap 后更新）
//! - 每个 LP 记录 last_fee_per_share（上次领取时的全局值）
//! - 可领取费用 = lp_shares * (current_fee_per_share - last_fee_per_share)
//! - 这样无论谁先领取，每个 LP 每份额只能领取一次对应收益
//!
//! 精度说明：
//! - fee_per_share_cumulative 使用 u128 存储，精度为 10^18
//! - 前端显示时需要除以 10^18 转换为实际 USDC 值
//! - 例如：fee_per_share_cumulative = 5 * 10^18，表示每份额累计收益 5 USDC
//!
//! 金库余额保护：
//! - 领取前检查 global_vault 余额是否充足
//! - 检查 market.accumulated_lp_fees >= 可领取金额
//! - 两级验证确保不会超额支付
//! - 即使 fee_per_share 计算值大于实际可用余额，也会被余额检查拦截

use crate::{
    constants::{CONFIG, LPPOSITION, MARKET, MARKET_USDC_VAULT},  // 🔒 v1.2.7: 添加 MARKET_USDC_VAULT
    errors::PredictionMarketError,
    state::{config::*, market::*},
    utils::ReentrancyGuard,  // ✅ v1.2.3: RAII 重入保护
};
use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

/// 账户集合：LP 费用领取
#[derive(Accounts)]
pub struct ClaimLpFees<'info> {
    /// 全局配置
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    global_config: Box<Account<'info, Config>>,

    /// YES/NO 代币mint（用于 PDA 推导）
    pub yes_token: AccountInfo<'info>,
    pub no_token: AccountInfo<'info>,

    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump,
    )]
    market: Account<'info, Market>,

    /// 🔒 v1.2.7: 市场USDC金库PDA（签名权限）
    /// CHECK: market-specific usdc vault pda
    #[account(
        seeds = [MARKET_USDC_VAULT.as_bytes(), market.key().as_ref()],
        bump,
    )]
    pub market_usdc_vault: AccountInfo<'info>,

    /// LP Position 账户
    /// ✅ v3.0.2: 修复种子顺序为 [LPPOSITION, market, user]
    #[account(
        mut,
        seeds = [LPPOSITION.as_bytes(), &market.key().to_bytes(), &lp.key().to_bytes()],
        bump,
        constraint = lp_position.lp_shares > 0 @PredictionMarketError::WITHDRAWNOTLPERROR
    )]
    pub lp_position: Box<Account<'info, LPPosition>>,

    /// LP 用户（手续费接收者）
    #[account(mut)]
    pub lp: Signer<'info>,

    /// ✅ v1.1.0: USDC Mint
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// 🔒 v1.2.7: 市场专用 USDC 金库（支付 LP 费用）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v1.1.0: LP 的 USDC ATA（接收费用）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = lp,
    )]
    pub lp_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// 系统程序
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,
    #[account(address = anchor_spl::associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ClaimLpFees<'info> {
    /// 处理 LP 费用领取（公平分配版）
    ///
    /// ✅ 双账本系统：只操作 Pool Ledger
    /// ✅ 公平分配：基于累计每份额收益模型
    /// 🔒 v1.2.7: 使用市场专用金库支付费用
    ///
    /// # 参数
    /// - market_usdc_vault_bump: 市场专用金库 PDA bump seed
    pub fn handler(&mut self, market_usdc_vault_bump: u8) -> Result<()> {
        msg!("ClaimLpFees handler start (fair distribution model)");

        // ✅ v1.2.3: RAII 重入保护 - 无论函数如何退出，锁都会自动释放
        // 修复 DoS 漏洞：之前的实现在 require! 失败时锁会永久保持
        // 注意：复用 claim_in_progress 锁（LP 费用领取与奖励领取互斥）
        let _reentrancy_guard = ReentrancyGuard::new(&mut self.market.claim_in_progress)?;

        // ═══════════════════════════════════════════════════════════
        // 1. 验证前置条件
        // ═══════════════════════════════════════════════════════════

        // ✅ v3.0.9: Gas 优化 - 统一获取 Clock，避免重复 syscall (~1,000 CU)
        let clock = Clock::get()?;
        let current_slot = clock.slot;
        let current_timestamp = clock.unix_timestamp;

        // ✅ v1.2.3: 验证 USDC 精度（必须为 6）
        require!(
            self.usdc_mint.decimals == crate::constants::USDC_DECIMALS,
            PredictionMarketError::InvalidParameter
        );
        msg!("✅ USDC decimals validated: {}", self.usdc_mint.decimals);

        require!(
            !self.global_config.is_paused,
            PredictionMarketError::ContractPaused
        );

        require!(
            self.market.total_lp_shares > 0,
            PredictionMarketError::InsufficientLiquidity
        );

        // ═══════════════════════════════════════════════════════════
        // 2. 计算可领取的手续费（公平分配模型）
        // ═══════════════════════════════════════════════════════════

        // 自上次领取以来，每份额累计收益增加量
        let fee_per_share_delta = self.market.fee_per_share_cumulative
            .checked_sub(self.lp_position.last_fee_per_share)
            .ok_or(PredictionMarketError::MathOverflow)?;

        // 该 LP 的总可领取费用 = lp_shares * fee_per_share_delta / 10^18
        let claimable_fees = (self.lp_position.lp_shares as u128)
            .checked_mul(fee_per_share_delta)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(crate::constants::FEE_PER_SHARE_PRECISION) // 除以 10^18 精度
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            claimable_fees <= u64::MAX as u128,
            PredictionMarketError::MathOverflow
        );

        let fees_amount = claimable_fees as u64;

        // 如果没有可领取费用，直接返回（锁会自动释放）
        if fees_amount == 0 {
            msg!("No fees to claim for this LP");
            // ✅ v1.2.3: ReentrancyGuard 的 Drop 会自动清除锁
            return Ok(());
        }

        msg!(
            "LP {} can claim {} USDC (lp_shares: {}, fee_delta: {})",
            self.lp.key(),
            fees_amount,
            self.lp_position.lp_shares,
            fee_per_share_delta
        );

        // ═══════════════════════════════════════════════════════════
        // 3. 验证金库和累积费用充足
        // ═══════════════════════════════════════════════════════════

        // 🔒 v1.2.7: 检查市场专用 USDC 金库余额充足
        let vault_usdc_balance = self.market_usdc_ata.amount;
        require!(
            vault_usdc_balance >= fees_amount,
            PredictionMarketError::InsufficientLiquidity
        );

        require!(
            self.market.accumulated_lp_fees >= fees_amount,
            PredictionMarketError::InsufficientBalance
        );

        // ═══════════════════════════════════════════════════════════
        // 🔒 4. CEI Pattern: 先更新状态，再执行转账
        // ═══════════════════════════════════════════════════════════

        // 从累积费用中扣除
        self.market.accumulated_lp_fees = self.market.accumulated_lp_fees
            .checked_sub(fees_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        // ✅ 关键：更新 last_fee_per_share 为当前值（防止重复领取）
        self.lp_position.last_fee_per_share = self.market.fee_per_share_cumulative;

        // 更新时间戳（可选，用于统计）
        self.lp_position.last_fee_claim_slot = current_slot;  // ✅ v3.0.9: 使用缓存

        // ═══════════════════════════════════════════════════════════
        // 5. 金库最小余额保护 & 转移手续费给 LP
        // ═══════════════════════════════════════════════════════════

        // 🔒 最小余额保护：确保转账后余额 ≥ 配置的最小值
        let remaining_after = (vault_usdc_balance as i128)
            .checked_sub(fees_amount as i128)
            .ok_or(PredictionMarketError::MathOverflow)? as i64;
        require!(
            remaining_after as u64 >= self.global_config.usdc_vault_min_balance,
            PredictionMarketError::InsufficientBalance
        );

        // 🔒 v1.2.7: 从市场专用 USDC 金库转移费用给 LP
        let market_key = self.market.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            crate::constants::MARKET_USDC_VAULT.as_bytes(),
            market_key.as_ref(),
            &[market_usdc_vault_bump],
        ]];

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.market_usdc_ata.to_account_info(),
                    to: self.lp_usdc_ata.to_account_info(),
                    authority: self.market_usdc_vault.to_account_info(),
                },
                signer_seeds,
            ),
            fees_amount,
        )?;

        msg!(
            "✅ LP claimed {} USDC (fair share). Remaining accumulated fees: {}",
            fees_amount,
            self.market.accumulated_lp_fees
        );

        // 🔒 v1.2.7: 发射金库余额快照事件（监控账本-金库一致性）
        // ⚠️ PRODUCT DECISION: reload() 必须保留
        // 用途：获取转账后的实时余额，用于计算准确的 balance_discrepancy
        // 成本：~500-1,000 CU，但对监控账本-金库一致性至关重要
        // 如果移除：balance_discrepancy 会显示错误值，失去监控意义
        self.market_usdc_ata.reload()?;
        let market_usdc_balance = self.market_usdc_ata.amount;

        // 计算预期余额（pool + locked + lp_fees）
        let expected_balance = self.market.pool_collateral_reserve
            .checked_add(self.market.total_collateral_locked)
            .and_then(|sum| sum.checked_add(self.market.accumulated_lp_fees))
            .ok_or(PredictionMarketError::MathOverflow)?;

        let balance_discrepancy = (market_usdc_balance as i128)
            .checked_sub(expected_balance as i128)
            .ok_or(PredictionMarketError::MathOverflow)? as i64;

        // ✅ v3.0.9: 使用预先缓存的 clock (line 136)
        emit!(crate::events::VaultBalanceSnapshot {
            market: self.market.key(),
            market_usdc_balance,
            pool_collateral_reserve: self.market.pool_collateral_reserve,
            total_collateral_locked: self.market.total_collateral_locked,
            accumulated_lp_fees: self.market.accumulated_lp_fees,
            balance_discrepancy,
            operation: "claim_lp_fees".to_string(),
            timestamp: current_timestamp,  // ✅ v3.0.9: 复用缓存
        });

        // ✅ v1.2.3: 不需要手动清除锁 - ReentrancyGuard 的 Drop 会自动清除

        msg!("ClaimLpFees completed successfully");
        Ok(())
    }
}
