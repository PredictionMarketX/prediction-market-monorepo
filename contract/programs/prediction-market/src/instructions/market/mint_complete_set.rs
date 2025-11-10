//! ✅ v1.1.0: 铸造完整集合指令：用户存入 USDC，获得等量的 YES + NO 代币
//!
//! 这是条件代币的核心机制：
//! - 用户存入 X USDC
//! - 系统铸造 X YES + X NO
//! - 确保 YES + NO 价值 = X USDC

use crate::{
    constants::{CONFIG, GLOBAL, MARKET, MARKET_USDC_VAULT, USERINFO},  // 🔒 v1.2.7: 添加 MARKET_USDC_VAULT
    errors::PredictionMarketError,
    state::{config::*, market::*},
};
use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token::{self, Mint, Token, TokenAccount},
};

/// 账户集合：铸造完整集合所需账户
#[derive(Accounts)]
pub struct MintCompleteSet<'info> {
    /// 全局配置
    #[account(
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Box<Account<'info, Config>>,

    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump
    )]
    pub market: Box<Account<'info, Market>>,

    /// ✅ v1.1.0: 全局金库（PDA，用于验证 mint authority）
    /// CHECK: global vault pda used as mint authority
    #[account(
        mut,
        seeds = [GLOBAL.as_bytes()],
        bump,
    )]
    pub global_vault: AccountInfo<'info>,

    /// YES 代币 mint
    /// ✅ v3.0.10: 支持两种 authority（global_vault 或 market PDA）
    /// - authority = global_vault：seed_pool 之前的状态
    /// - authority = market：set_mint_authority 之后的状态
    #[account(
        mut,
        constraint = {
            let auth = yes_token.mint_authority;
            use anchor_lang::solana_program::program_option::COption;
            auth == COption::Some(global_vault.key()) || auth == COption::Some(market.key())
        } @ PredictionMarketError::InvalidAuthority
    )]
    pub yes_token: Box<Account<'info, Mint>>,

    /// NO 代币 mint
    /// ✅ v3.0.10: 支持两种 authority（global_vault 或 market PDA）
    #[account(
        mut,
        constraint = {
            let auth = no_token.mint_authority;
            use anchor_lang::solana_program::program_option::COption;
            auth == COption::Some(global_vault.key()) || auth == COption::Some(market.key())
        } @ PredictionMarketError::InvalidAuthority
    )]
    pub no_token: Box<Account<'info, Mint>>,

    /// 用户的 YES ATA
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = yes_token,
        associated_token::authority = user,
    )]
    pub user_yes_ata: Box<Account<'info, TokenAccount>>,

    /// 用户的 NO ATA
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = no_token,
        associated_token::authority = user,
    )]
    pub user_no_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v1.1.0: USDC Mint
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// 🔒 v1.2.7: 市场USDC金库PDA（签名权限）
    /// CHECK: market-specific usdc vault pda
    #[account(
        seeds = [MARKET_USDC_VAULT.as_bytes(), market.key().as_ref()],
        bump,
    )]
    pub market_usdc_vault: AccountInfo<'info>,

    /// 🔒 v1.2.7: 市场专用 USDC 金库（存储 USDC 抵押品）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v1.1.0: 用户 USDC ATA
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = user,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// 用户信息
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + std::mem::size_of::<UserInfo>(),
        seeds = [USERINFO.as_bytes(), &user.key().to_bytes(), &market.key().to_bytes()],
        bump
    )]
    pub user_info: Box<Account<'info, UserInfo>>,

    /// 用户签名者
    #[account(mut)]
    pub user: Signer<'info>,

    /// 系统/代币/ATA程序
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    #[account(address = associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> MintCompleteSet<'info> {
    /// 处理铸造完整集合
    ///
    /// 🔒 v1.2.7: 修复金库错误 - USDC 存入市场专用金库
    /// ✅ v3.0.10: 支持两种 authority（global_vault 或 market PDA）
    ///
    /// # 参数
    /// * `amount` - USDC 数量（6 位精度）
    /// * `global_vault_bump` - 全局金库的 bump（用于铸造 YES/NO）
    /// * `market_bump` - 市场 PDA 的 bump（当 authority=market 时使用）
    ///
    /// # 流程
    /// 1. 🔒 v1.2.7: 用户转 USDC 到市场专用 USDC 金库（抵押）
    /// 2. 根据当前 mint authority 判断使用哪个 signer（global_vault 或 market）
    /// 3. 铸造等量的 YES 代币给用户
    /// 4. 铸造等量的 NO 代币给用户
    /// 5. 更新市场统计
    pub fn handler(&mut self, amount: u64, global_vault_bump: u8, market_bump: u8) -> Result<()> {
        msg!("MintCompleteSet start: amount={}", amount);

        // ✅ v1.2.3: 验证 USDC 精度（必须为 6）
        require!(
            self.usdc_mint.decimals == crate::constants::USDC_DECIMALS,
            PredictionMarketError::InvalidParameter
        );
        msg!("✅ USDC decimals validated: {}", self.usdc_mint.decimals);

        // ✅ v1.0.17: 验证 global_vault 已正确初始化（owner = program_id）
        require!(
            self.global_vault.owner == &crate::ID,
            PredictionMarketError::InvalidAuthority
        );

        // ✅ 检查合约是否暂停
        require!(
            !self.global_config.is_paused,
            PredictionMarketError::ContractPaused
        );

        // 验证金额
        require!(amount > 0, PredictionMarketError::InvalidAmount);

        // 验证市场未完成
        require!(
            !self.market.is_completed,
            PredictionMarketError::CurveAlreadyCompleted
        );

        // 初始化用户信息（如果需要）
        if !self.user_info.is_initialized {
            self.user_info.user = self.user.key();
            // ✅ FIX CRITICAL-2: 不再初始化余额字段（已删除）
            self.user_info.is_lp = false;
            self.user_info.is_initialized = true;
        }

        // 🔒 v1.2.7: 1. 用户转 USDC 到市场专用 USDC 金库（修复金库错误）
        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.user_usdc_ata.to_account_info(),
                    to: self.market_usdc_ata.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;
        msg!("✅ Locked {} USDC as collateral in market vault", amount);

        // ✅ v3.0.10: 判断当前 mint authority 并选择合适的 signer
        use anchor_lang::solana_program::program_option::COption;
        let yes_mint = &self.yes_token;
        let (signer_pda_info, signer_seeds): (&AccountInfo, &[&[&[u8]]]) =
            if yes_mint.mint_authority == COption::Some(self.market.key()) {
                // authority 已转移到 market PDA
                msg!("✅ v3.0.10: Using market PDA as mint authority");
                (
                    &self.market.to_account_info(),
                    &[&[MARKET.as_bytes(),
                        &self.yes_token.key().to_bytes(),
                        &self.no_token.key().to_bytes(),
                        &[market_bump]]]
                )
            } else {
                // authority 还是 global_vault（默认情况）
                msg!("✅ v3.0.10: Using global_vault as mint authority");
                (
                    &self.global_vault.to_account_info(),
                    &[&[GLOBAL.as_bytes(), &[global_vault_bump]]]
                )
            };

        // 2. 铸造等量的 YES 代币给用户
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.yes_token.to_account_info(),
                    to: self.user_yes_ata.to_account_info(),
                    authority: signer_pda_info.clone(),
                },
                signer_seeds,
            ),
            amount,
        )?;
        msg!("✅ Minted {} YES tokens", amount);

        // 3. 铸造等量的 NO 代币给用户
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.no_token.to_account_info(),
                    to: self.user_no_ata.to_account_info(),
                    authority: signer_pda_info.clone(),
                },
                signer_seeds,
            ),
            amount,
        )?;
        msg!("✅ Minted {} NO tokens", amount);

        // 4. 保存 market key（避免后续借用检查冲突）
        let market_key = self.market.key();

        // 5. 更新市场状态
        let market = &mut self.market;
        market.total_collateral_locked = market
            .total_collateral_locked
            .checked_add(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;
        market.total_yes_minted = market
            .total_yes_minted
            .checked_add(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;
        market.total_no_minted = market
            .total_no_minted
            .checked_add(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        // ✅ FIX: 同步 AMM 供应量计数，否则 swap 卖出时会因 checked_sub 下溢失败
        market.token_yes_total_supply = market
            .token_yes_total_supply
            .checked_add(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;
        market.token_no_total_supply = market
            .token_no_total_supply
            .checked_add(amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        // ✅ FIX CRITICAL-2: 不再更新 user_info 余额（已删除）
        // 余额由 SPL Token ATA 自动追踪，无需在 user_info 中重复

        msg!(
            "✅ MintCompleteSet completed: {} USDC → {} YES + {} NO",
            amount,
            amount,
            amount
        );
        msg!(
            "   Market totals: collateral={}, yes_minted={}, no_minted={}",
            market.total_collateral_locked,
            market.total_yes_minted,
            market.total_no_minted
        );

        // ✅ v1.1.1: 发射铸造事件（增强可追溯性）
        let clock = Clock::get()?;
        emit!(crate::events::MintCompleteSetEvent {
            user: self.user.key(),
            market: market_key,
            usdc_locked: amount,
            yes_minted: amount,
            no_minted: amount,
            timestamp: clock.unix_timestamp,
        });

        // 🔒 v1.2.7: 发射金库余额快照事件（监控账本-金库一致性）
        // ⚠️ PRODUCT DECISION: reload() 必须保留
        // 用途：获取转账后的实时余额，用于计算准确的 balance_discrepancy
        // 成本：~500-1,000 CU，但对监控账本-金库一致性至关重要
        // 如果移除：balance_discrepancy 会显示错误值，失去监控意义
        self.market_usdc_ata.reload()?;
        let market_usdc_balance = self.market_usdc_ata.amount;

        // 保存需要的值（market_key已在前面保存）
        let pool_collateral_reserve = market.pool_collateral_reserve;
        let total_collateral_locked = market.total_collateral_locked;
        let accumulated_lp_fees = market.accumulated_lp_fees;

        // 计算预期余额（pool + locked + lp_fees）
        let expected_balance = pool_collateral_reserve
            .checked_add(total_collateral_locked)
            .and_then(|sum| sum.checked_add(accumulated_lp_fees))
            .ok_or(PredictionMarketError::MathOverflow)?;

        let balance_discrepancy = (market_usdc_balance as i128)
            .checked_sub(expected_balance as i128)
            .ok_or(PredictionMarketError::MathOverflow)? as i64;

        emit!(crate::events::VaultBalanceSnapshot {
            market: market_key,
            market_usdc_balance,
            pool_collateral_reserve,
            total_collateral_locked,
            accumulated_lp_fees,
            balance_discrepancy,
            operation: "mint_complete_set".to_string(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}
