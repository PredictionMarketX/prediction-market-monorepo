//! Pool 初始化指令：为新创建的市场注入初始流动性
//! ✅ 双账本系统：只操作 Pool Ledger
//!
//! 解决问题：
//! - 市场刚创建时，pool_*_reserve 全为 0
//! - Swap 无法使用（没有库存）
//! - LP 添加流动性需要自带 YES/NO 代币（鸡蛋问题）
//!
//! 方案：
//! - 管理员/创建者提供 USDC
//! - 自动铸造等量 YES + NO 代币到 Pool
//! - 初始化 LMSR 参数
//! - 可选：给管理员铸造初始 LP 份额

use crate::{
    constants::{CONFIG, GLOBAL, LPPOSITION, MARKET, MARKET_USDC_VAULT},  // 🔒 v1.2.7: 添加 MARKET_USDC_VAULT
    errors::PredictionMarketError,
    state::{config::*, market::*},
};
use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token::{self, Mint, Token, TokenAccount},
};

/// 账户集合：Pool 种子流动性注入
#[derive(Accounts)]
pub struct SeedPool<'info> {
    /// 全局配置
    #[account(
        mut,
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    global_config: Box<Account<'info, Config>>,

    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump,
        constraint = !market.is_completed @PredictionMarketError::CurveAlreadyCompleted,
        constraint = market.pool_collateral_reserve == 0 @PredictionMarketError::PoolAlreadySeeded,
    )]
    market: Account<'info, Market>,

    /// 全局金库（存放 USDC）
    /// CHECK: global vault pda which stores USDC
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

    /// 全局 YES/NO 代币账户（Pool 库存）
    #[account(
        mut,
        associated_token::mint = yes_token,
        associated_token::authority = global_vault,
    )]
    pub global_yes_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = no_token,
        associated_token::authority = global_vault,
    )]
    pub global_no_ata: Box<Account<'info, TokenAccount>>,

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

    /// 🔒 v1.2.7: 市场专用 USDC 金库（存储初始流动性）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v1.1.0: 种子提供者 USDC ATA
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = seeder,
    )]
    pub seeder_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// 种子提供者的 LP Position（可选，如果想给初始 LP 份额）
    /// ✅ v3.0.2: 修复种子顺序为 [LPPOSITION, market, user]
    #[account(
        init_if_needed,
        payer = seeder,
        space = 8 + std::mem::size_of::<LPPosition>(),
        seeds = [LPPOSITION.as_bytes(), &market.key().to_bytes(), &seeder.key().to_bytes()],
        bump
    )]
    pub seeder_lp_position: Box<Account<'info, LPPosition>>,

    /// 种子提供者（通常是管理员或市场创建者）
    #[account(
        mut,
        constraint = global_config.authority == seeder.key() || market.creator == seeder.key() @PredictionMarketError::IncorrectAuthority
    )]
    pub seeder: Signer<'info>,

    /// 系统/代币/ATA程序
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    #[account(address = associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> SeedPool<'info> {
    /// 处理 Pool 种子流动性注入
    ///
    /// ✅ 双账本系统：只操作 Pool Ledger
    /// 🔒 v1.2.7: 修复金库错误 - USDC 存入市场专用金库
    ///
    /// # 参数
    /// - usdc_amount: 注入的 USDC 数量
    /// - _issue_lp_shares: 🔒 已废弃（现在总是发行 LP 份额）
    /// - global_vault_bump: PDA bump seed（用于铸造 YES/NO 代币）
    /// - market_bump: 市场 PDA 的 bump（当 authority=market 时使用）
    /// - market_usdc_vault_bump: 市场专用金库 PDA bump seed
    ///
    /// # 安全修复 (v1.0.3)
    /// - 🔒 **强制发行 LP 份额**，防止首位 LP 盗取种子流动性
    /// - 原漏洞：issue_lp_shares=false 时，total_lp_shares=0 但池子有储备
    /// - 攻击场景：首位 LP 用 1 USDC 获得 100% 份额，立即提走全部种子资产
    /// - 修复：忽略 issue_lp_shares 参数，总是铸造 LP 份额给种子提供者
    pub fn handler(
        &mut self,
        usdc_amount: u64,
        _issue_lp_shares: bool,
        global_vault_bump: u8,
        market_bump: u8,
        _market_usdc_vault_bump: u8,
    ) -> Result<()> {
        msg!(
            "🔒 SeedPool handler start: sol={} (ALWAYS issue LP shares)",
            usdc_amount
        );

        // ✅ v3.0.9: Gas 优化 - 统一获取 Clock，避免重复 syscall (~2,000-3,000 CU)
        let clock = Clock::get()?;
        let current_timestamp = clock.unix_timestamp;
        let current_slot = clock.slot;

        // ═══════════════════════════════════════════════════════════
        // 1. 验证前置条件
        // ═══════════════════════════════════════════════════════════

        // ✅ v1.2.3: 验证 USDC 精度（必须为 6）
        require!(
            self.usdc_mint.decimals == crate::constants::USDC_DECIMALS,
            PredictionMarketError::InvalidParameter
        );
        msg!("✅ USDC decimals validated: {}", self.usdc_mint.decimals);

        // ✅ v3.0.10: 验证当前 mint authority（支持两种状态）
        use anchor_lang::solana_program::program_option::COption;
        let yes_mint = &self.yes_token;
        if yes_mint.mint_authority == COption::Some(self.market.key()) {
            msg!("✅ v3.0.10: Confirmed market PDA as mint authority");
        } else {
            msg!("✅ v3.0.10: Confirmed global_vault as mint authority");
        }

        require!(
            !self.global_config.is_paused,
            PredictionMarketError::ContractPaused
        );

        require!(usdc_amount > 0, PredictionMarketError::InvalidAmount);

        // ═══════════════════════════════════════════════════════════
        // 🔒 v1.1.0: SECURITY - 强制最小种子流动性
        // ═══════════════════════════════════════════════════════════
        //
        // **风险**: 种子流动性过低会导致价格失真
        //
        // **场景**:
        // - 管理员意外注入 1 USDC 种子流动性
        // - LMSR b参数设置为 1000 USDC
        // - 导致价格曲线计算异常，用户无法正常交易
        //
        // **修复**: 使用配置的 min_usdc_liquidity 作为最小种子流动性要求
        // - 典型值: 100 USDC (100_000_000 最小单位)
        // - 确保初始流动性足够支撑正常交易
        require!(
            usdc_amount >= self.global_config.min_usdc_liquidity,
            PredictionMarketError::ValueTooSmall
        );

        msg!(
            "✅ Seed liquidity check: {} >= {} (min_usdc_liquidity)",
            usdc_amount,
            self.global_config.min_usdc_liquidity
        );

        // 验证 Pool 尚未被初始化
        require!(
            self.market.pool_collateral_reserve == 0,
            PredictionMarketError::PoolAlreadySeeded
        );
        require!(
            self.market.total_lp_shares == 0,
            PredictionMarketError::PoolAlreadySeeded
        );

        // 🔒 v1.2.7: 2. 转移 USDC 到 market_usdc_ata（修复金库错误）
        msg!("Transferring {} USDC to market vault", usdc_amount);
        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.seeder_usdc_ata.to_account_info(),
                    to: self.market_usdc_ata.to_account_info(),
                    authority: self.seeder.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // ═══════════════════════════════════════════════════════════
        // 3. 铸造 YES + NO 代币到 Pool
        // ═══════════════════════════════════════════════════════════

        // ✅ v3.0.10: 判断当前 mint authority 并选择合适的 signer
        let yes_mint = &self.yes_token;
        let (signer_pda_info, signer_seeds): (&AccountInfo, &[&[&[u8]]]) =
            if yes_mint.mint_authority == COption::Some(self.market.key()) {
                // authority 已转移到 market PDA
                msg!("✅ v3.0.10: Using market PDA as mint authority");
                (
                    &self.market.to_account_info(),
                    &[&[crate::constants::MARKET.as_bytes(),
                        &self.yes_token.key().to_bytes(),
                        &self.no_token.key().to_bytes(),
                        &[market_bump]]]
                )
            } else {
                // authority 还是 global_vault（默认情况）
                msg!("✅ v3.0.10: Using global_vault as mint authority");
                (
                    &self.global_vault.to_account_info(),
                    &[&[crate::constants::GLOBAL.as_bytes(), &[global_vault_bump]]]
                )
            };

        // ✅ v1.1.0: 铸造 YES 代币（数量 = USDC 数量，保持 1:1）
        msg!("Minting {} YES tokens to pool", usdc_amount);
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.yes_token.to_account_info(),
                    to: self.global_yes_ata.to_account_info(),
                    authority: signer_pda_info.clone(),
                },
                signer_seeds,
            ),
            usdc_amount,
        )?;

        // ✅ v1.1.0: 铸造 NO 代币（数量 = USDC 数量，保持 1:1）
        msg!("Minting {} NO tokens to pool", usdc_amount);
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.no_token.to_account_info(),
                    to: self.global_no_ata.to_account_info(),
                    authority: signer_pda_info.clone(),
                },
                signer_seeds,
            ),
            usdc_amount,
        )?;

        // ═══════════════════════════════════════════════════════════
        // 4. 更新 Pool Ledger
        // ═══════════════════════════════════════════════════════════

        self.market.pool_collateral_reserve = usdc_amount;
        self.market.pool_yes_reserve = usdc_amount;
        self.market.pool_no_reserve = usdc_amount;

        // ═══════════════════════════════════════════════════════════
        // 4.5. ✅ v1.0.12: 同步更新 Settlement Ledger (CRITICAL FIX)
        // ═══════════════════════════════════════════════════════════
        //
        // **问题**: 之前只更新 Pool Ledger，导致 total_collateral_locked = 0
        // **影响**: 用户从池中买齐 YES+NO 后无法通过 redeem_complete_set 赎回 USDC
        // **原因**: redeem_complete_set 校验 total_collateral_locked >= amount
        // **修复**: 与 mint_complete_set 保持一致的会计处理
        //
        // 参考：Polymarket 的核心套利机制依赖"完整套件可随时 1:1 赎回"

        self.market.total_collateral_locked = self
            .market
            .total_collateral_locked
            .checked_add(usdc_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        self.market.total_yes_minted = self
            .market
            .total_yes_minted
            .checked_add(usdc_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        self.market.total_no_minted = self
            .market
            .total_no_minted
            .checked_add(usdc_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        self.market.token_yes_total_supply = self
            .market
            .token_yes_total_supply
            .checked_add(usdc_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        self.market.token_no_total_supply = self
            .market
            .token_no_total_supply
            .checked_add(usdc_amount)
            .ok_or(PredictionMarketError::MathOverflow)?;

        msg!(
            "✅ Settlement Ledger synced: collateral_locked={}, yes_minted={}, no_minted={}",
            self.market.total_collateral_locked,
            self.market.total_yes_minted,
            self.market.total_no_minted
        );

        // ═══════════════════════════════════════════════════════════
        // 5. 🔒 强制铸造初始 LP 份额给种子提供者（安全修复）
        // ═══════════════════════════════════════════════════════════

        // 🔒 安全修复：总是发行 LP 份额，防止首位 LP 盗取种子流动性
        // ✅ v1.1.0: 初始 LP 份额 = USDC 数量
        self.market.total_lp_shares = usdc_amount;

        // 初始化 LP Position
        if self.seeder_lp_position.lp_shares == 0 {
            self.seeder_lp_position.user = self.seeder.key();
            self.seeder_lp_position.market = self.market.key();
            self.seeder_lp_position.last_fee_claim_slot = current_slot;  // ✅ v3.0.9: 使用缓存
            // ✅ 初始化 last_fee_per_share 为当前值
            self.seeder_lp_position.last_fee_per_share = self.market.fee_per_share_cumulative;
        }

        self.seeder_lp_position.lp_shares = usdc_amount;
        // ✅ v3.0: 使用 invested_usdc 字段（删除 deposited_sol/yes/no）
        self.seeder_lp_position.invested_usdc = usdc_amount;

        // ✅ v3.0: 初始化时间锁字段
        // ✅ v3.0.9: 使用预先缓存的 current_timestamp (line 165)
        self.seeder_lp_position.created_at = current_timestamp;
        self.seeder_lp_position.last_add_at = current_timestamp;

        msg!(
            "✅ Issued {} LP shares to seeder (FORCED for security)",
            usdc_amount
        );

        // ═══════════════════════════════════════════════════════════
        // 6. 初始化 LMSR 参数（如果尚未设置）
        // ═══════════════════════════════════════════════════════════

        // LMSR q 参数初始化为 0（中立价格）
        // 后续 swap 会自动调整
        if self.market.lmsr_q_yes == 0 && self.market.lmsr_q_no == 0 {
            self.market.lmsr_q_yes = 0;
            self.market.lmsr_q_no = 0;
            msg!("✅ Initialized LMSR q parameters to neutral (0, 0)");
        }

        msg!(
            "✅ Pool seeded: collateral={}, yes={}, no={}, lp_shares={}",
            self.market.pool_collateral_reserve,
            self.market.pool_yes_reserve,
            self.market.pool_no_reserve,
            self.market.total_lp_shares
        );

        // ✅ v1.1.1: 发射种子流动性事件（增强可追溯性）
        // ✅ v3.0.9: 使用预先缓存的 clock (line 164)
        emit!(crate::events::SeedPoolEvent {
            seeder: self.seeder.key(),
            market: self.market.key(),
            usdc_amount,
            yes_amount: usdc_amount,  // seed_pool: YES = USDC 数量
            no_amount: usdc_amount,   // seed_pool: NO = USDC 数量
            lp_shares_minted: usdc_amount,  // 初始 LP 份额 = USDC 数量
            timestamp: current_timestamp,  // ✅ v3.0.9: 复用缓存
        });

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

        emit!(crate::events::VaultBalanceSnapshot {
            market: self.market.key(),
            market_usdc_balance,
            pool_collateral_reserve: self.market.pool_collateral_reserve,
            total_collateral_locked: self.market.total_collateral_locked,
            accumulated_lp_fees: self.market.accumulated_lp_fees,
            balance_discrepancy,
            operation: "seed_pool".to_string(),
            timestamp: clock.unix_timestamp,
        });

        msg!("SeedPool completed successfully");
        Ok(())
    }
}
