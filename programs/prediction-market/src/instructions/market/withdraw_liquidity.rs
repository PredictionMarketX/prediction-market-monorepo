//! ✅ v3.0: 撤出流动性（单币LP - 仅返还USDC）
//!
//! **核心变更**：
//! - 用户只收到 USDC
//! - 合约内部配对赎回 YES/NO → USDC
//! - 剩余单边代币通过内部交换卖回池子（无手续费）
//! - 移除用户 YES/NO ATA 依赖
//!
//! **四层 LP 保护机制**：
//! 1. 硬上限（2b）：在 swap 中限制最坏情况为 88% 价格
//! 2. 动态撤出限额：根据池子失衡度限制单次撤出比例（5%-30%）
//! 3. 时间锁 + 早退惩罚：根据持有时长收取 0%-3% 惩罚费
//! 4. 熔断器：极端失衡时暂停所有 LP 撤出
//!
//! **熔断器触发条件**（任一满足即触发）：
//! - 池子比例 >= 4:1（IMBALANCE_RATIO_CIRCUIT）
//! - 单边储备 < 初始储备的 10%（CIRCUIT_BREAKER_MIN_RESERVE_BPS）
//! - 24小时内撤出 > 总流动性的 50%（CIRCUIT_BREAKER_WITHDRAW_24H_BPS）

use crate::{
    constants::{
        BALANCED_MAX_WITHDRAW_BPS, BASIS_POINTS_DIVISOR, CIRCUIT_BREAKER_MIN_RESERVE_BPS,
        CIRCUIT_BREAKER_RATIO, CIRCUIT_BREAKER_WITHDRAW_24H_BPS, CONFIG, GLOBAL,
        EARLY_EXIT_PENALTY_14D, EARLY_EXIT_PENALTY_30D, EARLY_EXIT_PENALTY_7D,
        IMBALANCE_RATIO_HIGH, IMBALANCE_RATIO_MILD, IMBALANCE_RATIO_MODERATE, MARKET,
        MARKET_USDC_VAULT, HIGH_IMBALANCE_MAX_WITHDRAW_BPS, MILD_IMBALANCE_MAX_WITHDRAW_BPS,
        MODERATE_IMBALANCE_MAX_WITHDRAW_BPS,
    },
    errors::PredictionMarketError,
    events::WithdrawLiquidityEvent,
    state::{config::Config, market::{LPPosition, Market}},
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount},
};

/// 账户集合：撤出LP所需账户（v3.0 单币LP）
#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    /// 全局配置
    #[account(
        mut,
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    pub global_config: Box<Account<'info, Config>>,

    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump,
    )]
    pub market: Box<Account<'info, Market>>,

    /// YES Token Mint（✅ v3.0: authority 必须是 market PDA）
    #[account(
        mut,
        constraint = yes_token.mint_authority == anchor_lang::solana_program::program_option::COption::Some(market.key())
            @ PredictionMarketError::MintAuthorityNotTransferred
    )]
    pub yes_token: Account<'info, Mint>,

    /// NO Token Mint（✅ v3.0: authority 必须是 market PDA）
    #[account(
        mut,
        constraint = no_token.mint_authority == anchor_lang::solana_program::program_option::COption::Some(market.key())
            @ PredictionMarketError::MintAuthorityNotTransferred
    )]
    pub no_token: Account<'info, Mint>,

    /// ✅ v3.0.2: Global Vault PDA（用于签名代币操作）
    /// CHECK: global vault pda used as authority
    #[account(
        seeds = [GLOBAL.as_bytes()],
        bump,
    )]
    pub global_vault: AccountInfo<'info>,

    /// ✅ v3.0.2: Global 的 YES Token ATA（统一代币托管，销毁源）
    #[account(
        mut,
        associated_token::mint = yes_token,
        associated_token::authority = global_vault,
    )]
    pub global_yes_ata: Account<'info, TokenAccount>,

    /// ✅ v3.0.2: Global 的 NO Token ATA（统一代币托管，销毁源）
    #[account(
        mut,
        associated_token::mint = no_token,
        associated_token::authority = global_vault,
    )]
    pub global_no_ata: Account<'info, TokenAccount>,

    /// USDC Mint
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// Market USDC ATA（市场专用金库）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// Market USDC Vault PDA（签名权限）
    /// CHECK: market-specific usdc vault pda
    #[account(
        seeds = [MARKET_USDC_VAULT.as_bytes(), market.key().as_ref()],
        bump,
    )]
    pub market_usdc_vault: AccountInfo<'info>,

    /// 用户 USDC ATA（仅返还 USDC）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = user,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// LP Position
    #[account(
        mut,
        seeds = [crate::constants::LPPOSITION.as_bytes(), market.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = lp_position.lp_shares > 0 @ PredictionMarketError::InsufficientBalance
    )]
    pub lp_position: Box<Account<'info, LPPosition>>,

    /// 用户
    #[account(mut)]
    pub user: Signer<'info>,

    /// SPL Token 程序
    pub token_program: Program<'info, Token>,

    /// Associated Token 程序
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(
    ctx: Context<WithdrawLiquidity>,
    lp_shares: u64,
    min_usdc_out: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let lp_position = &mut ctx.accounts.lp_position;
    let user = &ctx.accounts.user;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // ✅ v3.0.12: Gas 优化 - 缓存类型转换，避免重复 cast (~50-100 CU)
    const BASIS_POINTS_DIVISOR_U128: u128 = BASIS_POINTS_DIVISOR as u128;

    msg!("✅ v3.0: Withdrawing single-coin liquidity: {} shares", lp_shares);

    // ✅ v3.0.10: Gas 优化 - 使用 Anchor 提供的 bump，避免 find_program_address (~700-1,000 CU)
    // Accounts 结构体的 global_vault (line 76-80) 已定义 bump，Anchor 自动提供
    let global_signer_seeds: &[&[&[u8]]] = &[&[GLOBAL.as_bytes(), &[ctx.bumps.global_vault]]];

    // ✅ v3.0.2: 重入保护（RAII模式，函数退出时自动解锁）
    let _reentrancy_guard = crate::utils::ReentrancyGuard::new(&mut market.withdraw_in_progress)?;

    // ═══════════════════════════════════════════════════════════════
    // 1. 基础验证
    // ═══════════════════════════════════════════════════════════════

    // ✅ v3.1.2: 市场级暂停保护
    require!(
        !market.market_paused,
        PredictionMarketError::MarketPaused
    );

    require!(!ctx.accounts.global_config.is_paused, PredictionMarketError::ContractPaused);
    require!(lp_shares > 0, PredictionMarketError::InvalidAmount);
    require!(lp_position.lp_shares >= lp_shares, PredictionMarketError::InsufficientBalance);
    require!(market.total_lp_shares > 0, PredictionMarketError::InsufficientLiquidity);

    // 市场已完成但未结算：限制提现
    if market.is_completed && !market.pool_settled {
        let usdc_to_withdraw = (lp_shares as u128)
            .checked_mul(market.pool_collateral_reserve as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(market.total_lp_shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        let reserve_after = market.pool_collateral_reserve
            .checked_sub(usdc_to_withdraw)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            reserve_after >= market.total_collateral_locked,
            PredictionMarketError::InsufficientLiquidity
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. 四层 LP 保护：Layer 4 - 熔断器检查（必须首先检查）
    // ═══════════════════════════════════════════════════════════════

    require!(
        !market.circuit_breaker_active,
        PredictionMarketError::CircuitBreakerTriggered
    );

    // ═══════════════════════════════════════════════════════════════
    // 3. 四层 LP 保护：Layer 2 - 动态撤出限额
    // ═══════════════════════════════════════════════════════════════

    let imbalance_ratio = market.get_imbalance_ratio();
    let max_withdraw_bps = if imbalance_ratio < IMBALANCE_RATIO_MILD {
        BALANCED_MAX_WITHDRAW_BPS
    } else if imbalance_ratio < IMBALANCE_RATIO_MODERATE {
        MILD_IMBALANCE_MAX_WITHDRAW_BPS
    } else if imbalance_ratio < IMBALANCE_RATIO_HIGH {
        MODERATE_IMBALANCE_MAX_WITHDRAW_BPS
    } else {
        HIGH_IMBALANCE_MAX_WITHDRAW_BPS
    };

    let max_withdraw_shares = (market.total_lp_shares as u128)
        .checked_mul(max_withdraw_bps as u128)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(BASIS_POINTS_DIVISOR_U128)  // ✅ v3.0.12: 使用缓存
        .ok_or(PredictionMarketError::MathOverflow)? as u64;

    require!(
        lp_shares <= max_withdraw_shares,
        PredictionMarketError::ExcessiveWithdrawal
    );

    msg!(
        "✅ Layer 2: Pool imbalance ratio={}%, max_withdraw={}bps, requesting {} shares (max {} shares)",
        imbalance_ratio,
        max_withdraw_bps,
        lp_shares,
        max_withdraw_shares
    );

    // ═══════════════════════════════════════════════════════════════
    // 4. 四层 LP 保护：Layer 3 - 时间锁 + 早退惩罚
    // ═══════════════════════════════════════════════════════════════

    // ✅ v3.0.1: 使用 created_at（首次添加时间）而非 last_add_at
    // 防止用户通过分批添加流动性来重置计时器规避早退惩罚
    let holding_period = current_timestamp - lp_position.created_at;
    let early_exit_penalty_bps = if holding_period < 7 * 24 * 3600 {
        EARLY_EXIT_PENALTY_7D
    } else if holding_period < 14 * 24 * 3600 {
        EARLY_EXIT_PENALTY_14D
    } else if holding_period < 30 * 24 * 3600 {
        EARLY_EXIT_PENALTY_30D
    } else {
        0
    };

    msg!(
        "✅ Layer 3: Holding period={} days, early_exit_penalty={}bps",
        holding_period / 86400,
        early_exit_penalty_bps
    );

    // ═══════════════════════════════════════════════════════════════
    // 5. 计算按比例返还的资产数量（Pool Ledger）
    // ═══════════════════════════════════════════════════════════════

    let share_fraction_numerator = lp_shares as u128;
    let share_fraction_denominator = market.total_lp_shares as u128;

    // ✅ v3.0.10: 使用辅助函数简化份额计算，提高代码可读性和可维护性
    let usdc_share = crate::utils::calculate_proportional_share(
        market.pool_collateral_reserve,
        share_fraction_numerator,
        share_fraction_denominator,
    )?;

    let yes_share = crate::utils::calculate_proportional_share(
        market.pool_yes_reserve,
        share_fraction_numerator,
        share_fraction_denominator,
    )?;

    let no_share = crate::utils::calculate_proportional_share(
        market.pool_no_reserve,
        share_fraction_numerator,
        share_fraction_denominator,
    )?;

    msg!(
        "Share allocation: usdc={}, yes={}, no={}",
        usdc_share,
        yes_share,
        no_share
    );

    // ═══════════════════════════════════════════════════════════════
    // 6. 内部配对赎回：min(YES, NO) → USDC
    // ═══════════════════════════════════════════════════════════════

    let paired_sets = yes_share.min(no_share);
    let leftover_yes = yes_share.saturating_sub(paired_sets);
    let leftover_no = no_share.saturating_sub(paired_sets);

    msg!(
        "Paired redemption: {} sets → {} USDC. Leftover: YES={}, NO={}",
        paired_sets,
        paired_sets,
        leftover_yes,
        leftover_no
    );

    // ✅ v3.0.2: 保留market_key用于后续事件和签名
    let market_key = market.key();

    if paired_sets > 0 {
        // ✅ v3.0.2: 从global ATA销毁（统一代币托管），但仍需global_vault签名
        // 需要global_vault签名，因为它是global ATAs的authority
        // ✅ v3.0.7: 使用预先计算的 PDA (line 162-164)

        // Burn YES
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.yes_token.to_account_info(),
                    from: ctx.accounts.global_yes_ata.to_account_info(),
                    authority: ctx.accounts.global_vault.to_account_info(),
                },
                global_signer_seeds,
            ),
            paired_sets,
        )?;

        // Burn NO
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.no_token.to_account_info(),
                    from: ctx.accounts.global_no_ata.to_account_info(),
                    authority: ctx.accounts.global_vault.to_account_info(),
                },
                global_signer_seeds,
            ),
            paired_sets,
        )?;

        msg!("✅ Burned {} paired YES/NO sets from global ATA", paired_sets);
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. 内部交换：剩余单边代币卖回池子（无手续费）
    // ✅ v3.1.0: 记录滑点数据并发射详细事件
    // ═══════════════════════════════════════════════════════════════

    let (leftover_usdc, internal_swap_result) = if leftover_yes > 0 {
        // ✅ v3.1.0: 记录交换前的池子状态
        let pool_yes_before = market.pool_yes_reserve;
        let pool_no_before = market.pool_no_reserve;
        let pool_collateral_before = market.pool_collateral_reserve;

        let swap_result = market.internal_sell_yes(leftover_yes)?;
        msg!(
            "✅ Internal swap: {} YES → {} USDC (expected: {}, slippage: {}bps, no fees)",
            leftover_yes,
            swap_result.usdc_amount_out,
            swap_result.usdc_expected,
            swap_result.slippage_bps
        );

        // ✅ v3.0.2: 从global ATA销毁，需要global_vault签名
        // ✅ v3.0.7: 使用预先计算的 PDA (line 162-164)

        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.yes_token.to_account_info(),
                    from: ctx.accounts.global_yes_ata.to_account_info(),
                    authority: ctx.accounts.global_vault.to_account_info(),
                },
                global_signer_seeds,
            ),
            leftover_yes,
        )?;

        // ✅ v3.1.0: 发射内部交换事件
        emit!(crate::events::InternalSwapEvent {
            market: market_key,
            user: user.key(),
            is_yes: true,
            token_amount_in: swap_result.token_amount_in,
            usdc_amount_out: swap_result.usdc_amount_out,
            usdc_expected: swap_result.usdc_expected,
            slippage_bps: swap_result.slippage_bps,
            pool_imbalance_ratio_before: swap_result.pool_imbalance_before,
            pool_imbalance_ratio_after: swap_result.pool_imbalance_after,
            pool_yes_reserve_before: pool_yes_before,
            pool_no_reserve_before: pool_no_before,
            pool_collateral_reserve_before: pool_collateral_before,
            pool_yes_reserve_after: market.pool_yes_reserve,
            pool_no_reserve_after: market.pool_no_reserve,
            pool_collateral_reserve_after: market.pool_collateral_reserve,
            yes_price_after_bps: market.calculate_yes_price_bps().unwrap_or(5000),
            timestamp: current_timestamp,
        });

        (swap_result.usdc_amount_out, Some(swap_result))
    } else if leftover_no > 0 {
        // ✅ v3.1.0: 记录交换前的池子状态
        let pool_yes_before = market.pool_yes_reserve;
        let pool_no_before = market.pool_no_reserve;
        let pool_collateral_before = market.pool_collateral_reserve;

        let swap_result = market.internal_sell_no(leftover_no)?;
        msg!(
            "✅ Internal swap: {} NO → {} USDC (expected: {}, slippage: {}bps, no fees)",
            leftover_no,
            swap_result.usdc_amount_out,
            swap_result.usdc_expected,
            swap_result.slippage_bps
        );

        // ✅ v3.0.2: 从global ATA销毁，需要global_vault签名
        // ✅ v3.0.7: 使用预先计算的 PDA (line 162-164)

        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.no_token.to_account_info(),
                    from: ctx.accounts.global_no_ata.to_account_info(),
                    authority: ctx.accounts.global_vault.to_account_info(),
                },
                global_signer_seeds,
            ),
            leftover_no,
        )?;

        // ✅ v3.1.0: 发射内部交换事件
        emit!(crate::events::InternalSwapEvent {
            market: market_key,
            user: user.key(),
            is_yes: false,
            token_amount_in: swap_result.token_amount_in,
            usdc_amount_out: swap_result.usdc_amount_out,
            usdc_expected: swap_result.usdc_expected,
            slippage_bps: swap_result.slippage_bps,
            pool_imbalance_ratio_before: swap_result.pool_imbalance_before,
            pool_imbalance_ratio_after: swap_result.pool_imbalance_after,
            pool_yes_reserve_before: pool_yes_before,
            pool_no_reserve_before: pool_no_before,
            pool_collateral_reserve_before: pool_collateral_before,
            pool_yes_reserve_after: market.pool_yes_reserve,
            pool_no_reserve_after: market.pool_no_reserve,
            pool_collateral_reserve_after: market.pool_collateral_reserve,
            yes_price_after_bps: market.calculate_yes_price_bps().unwrap_or(5000),
            timestamp: current_timestamp,
        });

        (swap_result.usdc_amount_out, Some(swap_result))
    } else {
        (0, None)
    };

    // ═══════════════════════════════════════════════════════════════
    // 8. 汇总 USDC 并扣除早退惩罚
    // ═══════════════════════════════════════════════════════════════

    let gross_usdc = usdc_share
        .checked_add(paired_sets)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_add(leftover_usdc)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let early_exit_penalty = (gross_usdc as u128)
        .checked_mul(early_exit_penalty_bps as u128)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(BASIS_POINTS_DIVISOR_U128)  // ✅ v3.0.12: 使用缓存
        .ok_or(PredictionMarketError::MathOverflow)? as u64;

    let usdc_after_penalty = gross_usdc
        .checked_sub(early_exit_penalty)
        .ok_or(PredictionMarketError::MathOverflow)?;

    msg!(
        "USDC calculation: gross={}, penalty={} ({}bps), net={}",
        gross_usdc,
        early_exit_penalty,
        early_exit_penalty_bps,
        usdc_after_penalty
    );

    // 惩罚费归入平台（可选：归入保险池）
    if early_exit_penalty > 0 {
        // 这里保留在金库，不转出
        msg!("Early exit penalty {} USDC retained in pool", early_exit_penalty);
    }

    // ═══════════════════════════════════════════════════════════════
    // 9. 保险池补偿计算（仅在启用时）
    // ═══════════════════════════════════════════════════════════════

    // ✅ v3.0.10: 使用辅助函数计算投资本金份额
    let invested_usdc_share = crate::utils::calculate_proportional_share(
        lp_position.invested_usdc,
        share_fraction_numerator,
        share_fraction_denominator,
    )?;

    let (insurance_compensation, loss_rate_bps) = if ctx.accounts.global_config.insurance_pool_enabled
        && usdc_after_penalty < invested_usdc_share
        && invested_usdc_share > 0
    {
        let loss = invested_usdc_share
            .checked_sub(usdc_after_penalty)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let loss_bps = ((loss as u128)
            .checked_mul(BASIS_POINTS_DIVISOR_U128)  // ✅ v3.0.12: 使用缓存
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(invested_usdc_share as u128)
            .ok_or(PredictionMarketError::MathOverflow)?) as u16;

        if loss_bps > ctx.accounts.global_config.insurance_loss_threshold_bps {
            let max_compensation = (loss as u128)
                .checked_mul(ctx.accounts.global_config.insurance_max_compensation_bps as u128)
                .ok_or(PredictionMarketError::MathOverflow)?
                .checked_div(BASIS_POINTS_DIVISOR_U128)  // ✅ v3.0.12: 使用缓存
                .ok_or(PredictionMarketError::MathOverflow)? as u64;

            let actual_compensation = max_compensation
                .min(ctx.accounts.global_config.lp_insurance_pool_balance)
                .min(market.insurance_pool_contribution);

            if actual_compensation > 0 {
                msg!(
                    "✅ Insurance compensation triggered: loss={}bps, compensation={} USDC",
                    loss_bps,
                    actual_compensation
                );
                (actual_compensation, loss_bps)
            } else {
                (0, loss_bps)
            }
        } else {
            (0, loss_bps)
        }
    } else {
        (0, 0)
    };

    let final_usdc_out = usdc_after_penalty
        .checked_add(insurance_compensation)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // ═══════════════════════════════════════════════════════════════
    // 10. 滑点保护
    // ═══════════════════════════════════════════════════════════════

    require!(
        final_usdc_out >= min_usdc_out,
        PredictionMarketError::SlippageExceeded
    );

    msg!(
        "✅ Slippage check passed: final_usdc={}, min_usdc={}",
        final_usdc_out,
        min_usdc_out
    );

    // ═══════════════════════════════════════════════════════════════
    // 11. CEI Pattern: 更新状态
    // ═══════════════════════════════════════════════════════════════

    // 更新 Settlement Ledger
    let complete_sets_redeemed = paired_sets;
    market.total_collateral_locked = market
        .total_collateral_locked
        .checked_sub(complete_sets_redeemed)
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.total_yes_minted = market
        .total_yes_minted
        .checked_sub(yes_share)
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.total_no_minted = market
        .total_no_minted
        .checked_sub(no_share)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // ✅ v3.0.1: Pool Ledger 更新时序说明
    //
    // pool_collateral_reserve 需要扣除的总额：
    // 1. usdc_share: LP直接获得的USDC份额
    // 2. paired_sets: 配对赎回释放的USDC (1 YES + 1 NO = 1 USDC)
    // 3. leftover_usdc: 内部卖出剩余单边代币得到的USDC
    //
    // 其中 leftover_usdc 已在 internal_sell_yes/no 中扣除（Line 1334-1336）
    // 这里只需扣除 usdc_share + paired_sets
    market.pool_collateral_reserve = market
        .pool_collateral_reserve
        .checked_sub(usdc_share)        // 扣除直接分配的USDC
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_sub(paired_sets)       // 扣除配对赎回释放的USDC
        .ok_or(PredictionMarketError::MathOverflow)?;

    // pool_yes/no_reserve 需要扣除的总额：
    // 1. paired_sets: 配对赎回销毁的代币
    // 2. leftover_yes/no: 剩余单边代币
    //
    // 其中 leftover 部分已在 internal_sell_yes/no 中增加（Line 1330-1332）
    // 这里只需扣除 paired_sets
    market.pool_yes_reserve = market
        .pool_yes_reserve
        .checked_sub(paired_sets)       // 扣除配对赎回销毁的YES
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.pool_no_reserve = market
        .pool_no_reserve
        .checked_sub(paired_sets)       // 扣除配对赎回销毁的NO
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.total_lp_shares = market
        .total_lp_shares
        .checked_sub(lp_shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0.1: 熔断器预检查（在实际提现前验证是否会触发）
    // ═══════════════════════════════════════════════════════════════

    // 计算提现后的 24h 撤出总额
    let tracking_duration = current_timestamp - market.withdraw_tracking_start;
    let projected_withdraw_24h = if tracking_duration >= 86400 {
        // 超过 24 小时，这笔提现将成为新周期的第一笔
        final_usdc_out
    } else {
        // 累加到当前周期
        market.withdraw_last_24h
            .checked_add(final_usdc_out)
            .ok_or(PredictionMarketError::MathOverflow)?
    };

    // 预检查：计算提现后的池子状态
    let pool_yes_after = market.pool_yes_reserve.checked_sub(yes_share).unwrap_or(0);
    let pool_no_after = market.pool_no_reserve.checked_sub(no_share).unwrap_or(0);
    let pool_usdc_after = market.pool_collateral_reserve.checked_sub(usdc_share).unwrap_or(0);

    let total_pool_value_after = pool_usdc_after
        .checked_add(pool_yes_after)
        .and_then(|v| v.checked_add(pool_no_after))
        .ok_or(PredictionMarketError::MathOverflow)?;

    // 预检查条件 1: 4:1 比例失衡
    let (larger, smaller) = if pool_yes_after > pool_no_after {
        (pool_yes_after, pool_no_after)
    } else {
        (pool_no_after, pool_yes_after)
    };
    let ratio_check_after = smaller > 0 && (larger / smaller >= CIRCUIT_BREAKER_RATIO);

    // 预检查条件 2: 单边储备 < 10% 初始值
    let min_reserve_threshold_yes = market.initial_yes_reserve / 10;
    let min_reserve_threshold_no = market.initial_no_reserve / 10;
    let reserve_check_after = (market.initial_yes_reserve > 0 && pool_yes_after < min_reserve_threshold_yes)
        || (market.initial_no_reserve > 0 && pool_no_after < min_reserve_threshold_no);

    // 预检查条件 3: 24h 撤出 > 50% 池子价值
    let withdraw_threshold_after = total_pool_value_after / 2;
    let withdraw_check_after = projected_withdraw_24h > withdraw_threshold_after;

    // 如果预检查显示会触发熔断器，拒绝本次提现
    if ratio_check_after || reserve_check_after || withdraw_check_after {
        msg!(
            "❌ Withdrawal would trigger circuit breaker: ratio={}, reserve={}, withdraw={}",
            ratio_check_after,
            reserve_check_after,
            withdraw_check_after
        );
        return Err(PredictionMarketError::WouldTriggerCircuitBreaker.into());
    }

    // 更新 24 小时撤出追踪（仅在预检查通过后）
    if tracking_duration >= 86400 {
        // 超过 24 小时，重置计数器
        market.withdraw_last_24h = final_usdc_out;
        market.withdraw_tracking_start = current_timestamp;
    } else {
        market.withdraw_last_24h = projected_withdraw_24h;
    }

    // 更新 LP Position
    lp_position.lp_shares = lp_position
        .lp_shares
        .checked_sub(lp_shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    lp_position.invested_usdc = lp_position
        .invested_usdc
        .checked_sub(invested_usdc_share)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // 保险池更新
    if insurance_compensation > 0 {
        ctx.accounts.global_config.lp_insurance_pool_balance = ctx
            .accounts
            .global_config
            .lp_insurance_pool_balance
            .checked_sub(insurance_compensation)
            .ok_or(PredictionMarketError::MathOverflow)?;

        market.insurance_pool_contribution = market
            .insurance_pool_contribution
            .checked_sub(insurance_compensation)
            .ok_or(PredictionMarketError::MathOverflow)?;
    }

    msg!(
        "✅ State updated: pool_collateral={}, pool_yes={}, pool_no={}, total_lp={}",
        market.pool_collateral_reserve,
        market.pool_yes_reserve,
        market.pool_no_reserve,
        market.total_lp_shares
    );

    // ═══════════════════════════════════════════════════════════════
    // 12. 四层 LP 保护：Layer 4 - 熔断器触发检查
    // ═══════════════════════════════════════════════════════════════

    let should_trigger_circuit_breaker = {
        // 条件 1: 池子比例 >= 4:1
        let (larger, smaller) = if market.pool_yes_reserve > market.pool_no_reserve {
            (market.pool_yes_reserve, market.pool_no_reserve)
        } else {
            (market.pool_no_reserve, market.pool_yes_reserve)
        };

        let ratio_check = if smaller > 0 {
            larger / smaller >= CIRCUIT_BREAKER_RATIO
        } else {
            true // 单边池子，触发熔断
        };

        // 条件 2: 单边储备 < 初始储备的 10%
        let min_reserve_threshold_yes = (market.initial_yes_reserve as u128)
            .checked_mul(CIRCUIT_BREAKER_MIN_RESERVE_BPS as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR_U128)  // ✅ v3.0.12: 使用缓存
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        let min_reserve_threshold_no = (market.initial_no_reserve as u128)
            .checked_mul(CIRCUIT_BREAKER_MIN_RESERVE_BPS as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR_U128)  // ✅ v3.0.12: 使用缓存
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        let reserve_check = market.pool_yes_reserve < min_reserve_threshold_yes
            || market.pool_no_reserve < min_reserve_threshold_no;

        // 条件 3: 24小时撤出 > 总流动性的 50%
        let total_pool_value = market
            .pool_collateral_reserve
            .checked_add(market.pool_yes_reserve)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_add(market.pool_no_reserve)
            .ok_or(PredictionMarketError::MathOverflow)?;

        let withdraw_threshold = (total_pool_value as u128)
            .checked_mul(CIRCUIT_BREAKER_WITHDRAW_24H_BPS as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR_U128)  // ✅ v3.0.12: 使用缓存
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        let withdraw_check = market.withdraw_last_24h > withdraw_threshold;

        msg!(
            "Circuit breaker check: ratio={}, reserve={}, withdraw_24h={}",
            ratio_check,
            reserve_check,
            withdraw_check
        );

        ratio_check || reserve_check || withdraw_check
    };

    if should_trigger_circuit_breaker {
        market.circuit_breaker_active = true;
        market.circuit_breaker_triggered_at = current_timestamp;
        msg!("⚠️ Circuit breaker TRIGGERED after withdrawal");
    }

    // ═══════════════════════════════════════════════════════════════
    // 13. 转账：Market Vault → 用户
    // ═══════════════════════════════════════════════════════════════

    if final_usdc_out > 0 {
        let market_key_for_vault = market_key;
        let vault_signer_seeds: &[&[&[u8]]] = &[&[
            MARKET_USDC_VAULT.as_bytes(),
            market_key_for_vault.as_ref(),
            &[ctx.bumps.market_usdc_vault],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.market_usdc_ata.to_account_info(),
                    to: ctx.accounts.user_usdc_ata.to_account_info(),
                    authority: ctx.accounts.market_usdc_vault.to_account_info(),
                },
                vault_signer_seeds,
            ),
            final_usdc_out,
        )?;

        msg!(
            "✅ Transferred {} USDC to user (gross={}, penalty={}, insurance={})",
            final_usdc_out,
            gross_usdc,
            early_exit_penalty,
            insurance_compensation
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // 14. 发射事件（✅ v3.1.0: 增加内部交换滑点数据）
    // ═══════════════════════════════════════════════════════════════

    emit!(WithdrawLiquidityEvent {
        market: market_key,
        user: user.key(),
        lp_shares_burned: lp_shares,
        usdc_out: final_usdc_out,
        early_exit_penalty,
        early_exit_penalty_bps,
        insurance_compensation,
        loss_rate_bps,
        circuit_breaker_triggered: should_trigger_circuit_breaker,
        // ✅ v3.1.0: 内部交换滑点透明度字段
        internal_swap_slippage_bps: internal_swap_result.as_ref().map(|r| r.slippage_bps).unwrap_or(0),
        leftover_yes,
        leftover_no,
        internal_swap_usdc: leftover_usdc,
        pool_collateral_reserve: market.pool_collateral_reserve,
        pool_yes_reserve: market.pool_yes_reserve,
        pool_no_reserve: market.pool_no_reserve,
    });

    msg!(
        "🎉 Single-coin LP withdrawal completed: {} shares → {} USDC",
        lp_shares,
        final_usdc_out
    );

    Ok(())
}
