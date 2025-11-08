//! ✅ v3.0: 添加流动性（单币LP - 仅USDC）
//!
//! **核心变更**：
//! - 用户只需提供 USDC
//! - 合约内部铸造 YES/NO 代币并添加到池子
//! - 移除用户 YES/NO ATA 依赖
//!
//! **算法**：
//! 1. 首次LP：50/50 分配（铸造完整集 + 直接添加USDC）
//! 2. 后续LP：Uniswap-style 等比例添加
//!    - 根据当前池子比例计算需要的 YES/NO 数量
//!    - 铸造 max(needed_yes, needed_no) 完整集
//!    - 赎回多余的配对代币
//!
//! **前置条件**：
//! - 必须先调用 set_mint_authority（market PDA 需要 mint 权限）

use crate::{
    constants::{CONFIG, GLOBAL, LPPOSITION, MARKET, MARKET_USDC_VAULT, MIN_LIQUIDITY},
    errors::PredictionMarketError,
    events::AddLiquidityEvent,
    state::{config::Config, market::{LPPosition, Market}},
    utils::ReentrancyGuard,  // ✅ v3.1.4: 重入保护
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount},
};

/// 账户集合：添加LP所需账户（v3.0 单币LP）
#[derive(Accounts)]
pub struct AddLiquidity<'info> {
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

    /// ✅ v3.0.2: Global 的 YES Token ATA（统一代币托管）
    #[account(
        mut,
        associated_token::mint = yes_token,
        associated_token::authority = global_vault,
    )]
    pub global_yes_ata: Account<'info, TokenAccount>,

    /// ✅ v3.0.2: Global 的 NO Token ATA（统一代币托管）
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

    /// 用户 USDC ATA
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = user,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// LP Position（如不存在则创建）
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + std::mem::size_of::<LPPosition>(),
        seeds = [LPPOSITION.as_bytes(), market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub lp_position: Box<Account<'info, LPPosition>>,

    /// 用户
    #[account(mut)]
    pub user: Signer<'info>,

    /// SPL Token 程序
    pub token_program: Program<'info, Token>,

    /// 系统程序
    pub system_program: Program<'info, System>,

    /// Associated Token 程序
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<AddLiquidity>, usdc_amount: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let lp_position = &mut ctx.accounts.lp_position;
    let user = &ctx.accounts.user;
    let current_timestamp = Clock::get()?.unix_timestamp;

    msg!("✅ v3.0: Adding single-coin liquidity (USDC only): {}", usdc_amount);

    // ✅ v3.1.4: RAII 重入保护（与 swap/withdraw_liquidity/claim_rewards 保持一致）
    let _reentrancy_guard = ReentrancyGuard::new(&mut market.add_liquidity_in_progress)?;

    // ═══════════════════════════════════════════════════════════════
    // 1. 基础验证
    // ═══════════════════════════════════════════════════════════════

    require!(
        usdc_amount >= ctx.accounts.global_config.min_usdc_liquidity,
        PredictionMarketError::ValueTooSmall
    );

    require!(!market.is_completed, PredictionMarketError::MarketIsCompleted);
    // ✅ v3.1.2: 市场级暂停保护
    require!(
        !market.market_paused,
        PredictionMarketError::MarketPaused
    );

    // ═══════════════════════════════════════════════════════════════
    // 2. 计算 LP 份额
    // ═══════════════════════════════════════════════════════════════

    let (lp_shares, yes_to_mint, no_to_mint, usdc_to_pool) = if market.total_lp_shares == 0 {
        // ═══════════════════════════════════════════════════════════════
        // 首次LP：根据 initial_yes_prob 动态调整注入比例（v3.0.3）
        // ═══════════════════════════════════════════════════════════════

        // ✅ v3.0.3: 动态根据 initial_yes_prob 计算 YES/NO 注入比例
        //
        // 目标：注入的流动性应使初始市场价格与 initial_yes_prob 一致
        //
        // 策略：
        // - 总 USDC 分为两部分：complete_set_value + direct_usdc
        // - complete_set_value: 铸造等量 YES/NO（保证基础流动性）
        // - 额外注入偏向性代币以达到目标比例
        //
        // 示例：initial_yes_prob = 7000 (70%)
        // - 目标: pool_yes / (pool_yes + pool_no) ≈ 0.70
        // - 如果 usdc_amount = 100 USDC
        //   - complete_set = 50 USDC (铸造 50 YES + 50 NO)
        //   - 额外铸造 20 YES (使总 YES = 70)
        //   - 最终: pool_yes=70, pool_no=50, ratio=70/(70+50)=58.3%
        //
        // 更精确的公式：
        // - yes_ratio = initial_yes_prob / 10000
        // - no_ratio = (10000 - initial_yes_prob) / 10000
        // - yes_to_mint = usdc_amount * yes_ratio
        // - no_to_mint = usdc_amount * no_ratio

        let yes_ratio_bps = market.initial_yes_prob as u64;
        let no_ratio_bps = (10000 - market.initial_yes_prob) as u64;

        // 计算要铸造的 YES/NO 代币数量
        // yes_to_mint = usdc_amount * (yes_ratio_bps / 10000)
        let yes_to_mint = (usdc_amount as u128)
            .checked_mul(yes_ratio_bps as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PredictionMarketError::MathOverflow)?
            as u64;

        let no_to_mint = (usdc_amount as u128)
            .checked_mul(no_ratio_bps as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PredictionMarketError::MathOverflow)?
            as u64;

        // 验证总和等于 usdc_amount（允许 1 单位的舍入误差）
        let total_minted = yes_to_mint.checked_add(no_to_mint)
            .ok_or(PredictionMarketError::MathOverflow)?;

        require!(
            total_minted >= usdc_amount.saturating_sub(1) && total_minted <= usdc_amount.saturating_add(1),
            PredictionMarketError::InvalidAmount
        );

        // ✅ v3.0.5: 修正资金守恒（P1修复）
        // 先计算完整集数量（需要锁定的抵押）
        let complete_sets = yes_to_mint.min(no_to_mint);

        // 剩余 USDC 注入池子作为流动性
        // 守恒公式：pool_usdc + locked_collateral = usdc_amount
        let direct_usdc = usdc_amount.saturating_sub(complete_sets);

        // LP份额 = 投入USDC（Uniswap V2风格）
        // 首次LP锁定 MIN_LIQUIDITY 份额（防止除零）
        let shares = usdc_amount.saturating_sub(MIN_LIQUIDITY);

        msg!(
            "✅ v3.0.5: First LP with dynamic ratio. initial_yes_prob={} ({}%), yes_to_mint={}, no_to_mint={}, complete_sets={}, direct_usdc={}, shares={}",
            market.initial_yes_prob,
            yes_ratio_bps / 100,
            yes_to_mint,
            no_to_mint,
            complete_sets,
            direct_usdc,
            shares
        );

        // 验证比例是否符合预期（允许 ±5% 误差，因为舍入）
        let actual_yes_ratio = if yes_to_mint + no_to_mint > 0 {
            (yes_to_mint as u128 * 10000) / ((yes_to_mint + no_to_mint) as u128)
        } else {
            0
        };

        let ratio_diff = if actual_yes_ratio > yes_ratio_bps as u128 {
            actual_yes_ratio - yes_ratio_bps as u128
        } else {
            yes_ratio_bps as u128 - actual_yes_ratio
        };

        require!(
            ratio_diff <= 200, // 允许 ±2% 误差（200 bps），v3.0.3安全加强
            PredictionMarketError::InvalidParameter
        );

        (shares, yes_to_mint, no_to_mint, direct_usdc)
    } else {
        // 后续LP：等比例添加
        // shares / total_shares = usdc_amount / total_pool_value
        //
        // ✅ v3.0.1: 使用 LMSR 边际价格估值 YES/NO 代币
        // total_pool_value = pool_collateral + (pool_yes × yes_price) + (pool_no × no_price)

        // ✅ v3.0.11: Gas 优化 - 获取当前 YES/NO 价格（定点数，精度 10^18）
        // 同时计算 BPS 用于日志，避免重复调用 LMSR (~500-800 CU)
        let yes_price = market.lmsr_get_yes_price()?;
        let no_price = market.lmsr_get_no_price()?;

        // 直接从定点数价格转换为 BPS（避免再次调用 calculate_yes_price_bps）
        // yes_price 是 10^18 精度，转换为 BPS（万分之一）：yes_price * 10000 / 10^18
        let yes_price_pct = crate::math::to_u64(
            crate::math::fp_mul(yes_price, crate::math::from_u64(10000))?
        );
        let no_price_pct = 10000 - yes_price_pct;

        // ✅ v3.0.11: Gas 优化 - 缓存字段访问，避免重复解引用 (~200-400 CU)
        let pool_collateral = market.pool_collateral_reserve;
        let pool_yes = market.pool_yes_reserve;
        let pool_no = market.pool_no_reserve;

        // 计算 YES 代币的 USDC 等值（pool_yes × yes_price）
        let yes_value_fp = crate::math::fp_mul(
            crate::math::from_u64(pool_yes),
            yes_price
        )?;
        let yes_value = crate::math::to_u64(yes_value_fp);

        // 计算 NO 代币的 USDC 等值（pool_no × no_price）
        let no_value_fp = crate::math::fp_mul(
            crate::math::from_u64(pool_no),
            no_price
        )?;
        let no_value = crate::math::to_u64(no_value_fp);

        // total_pool_value = collateral + yes_value + no_value
        let total_pool_value = pool_collateral
            .checked_add(yes_value)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_add(no_value)
            .ok_or(PredictionMarketError::MathOverflow)?;

        msg!(
            "Pool valuation: collateral={}, yes_value={} (price={}%), no_value={} (price={}%), total={}",
            pool_collateral,  // ✅ v3.0.11: 使用缓存
            yes_value,
            yes_price_pct / 100,
            no_value,
            no_price_pct / 100,
            total_pool_value
        );

        // ✅ v3.0.11: 缓存 total_lp_shares 以避免重复访问
        let total_lp_shares = market.total_lp_shares;

        let shares = (usdc_amount as u128)
            .checked_mul(total_lp_shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(total_pool_value as u128)
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        // 计算需要的 YES/NO 数量（保持池子比例）
        let needed_yes = (pool_yes as u128)  // ✅ v3.0.11: 使用缓存
            .checked_mul(shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(total_lp_shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        let needed_no = (pool_no as u128)  // ✅ v3.0.11: 使用缓存
            .checked_mul(shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(total_lp_shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        let needed_usdc = (pool_collateral as u128)  // ✅ v3.0.11: 使用缓存
            .checked_mul(shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)?
            .checked_div(total_lp_shares as u128)
            .ok_or(PredictionMarketError::MathOverflow)? as u64;

        // 铸造完整集数量 = max(needed_yes, needed_no)
        let complete_sets = needed_yes.max(needed_no);

        msg!(
            "Subsequent LP: shares={}, needed_yes={}, needed_no={}, needed_usdc={}, complete_sets={}",
            shares,
            needed_yes,
            needed_no,
            needed_usdc,
            complete_sets
        );

        (shares, complete_sets, complete_sets, needed_usdc)
    };

    // ═══════════════════════════════════════════════════════════════
    // 3. 转移用户 USDC 到市场金库
    // ═══════════════════════════════════════════════════════════════

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_usdc_ata.to_account_info(),
                to: ctx.accounts.market_usdc_ata.to_account_info(),
                authority: user.to_account_info(),
            },
        ),
        usdc_amount,
    )?;

    msg!("✅ Transferred {} USDC from user to market vault", usdc_amount);

    // ═══════════════════════════════════════════════════════════════
    // 4. 内部铸造 YES/NO 代币（使用 market PDA 签名）
    // ═══════════════════════════════════════════════════════════════

    // ✅ v3.0.5: 使用 ctx.bumps 避免运行期 PDA 计算（微优化）
    let market_key = market.key();
    let market_signer_seeds: &[&[&[u8]]] = &[&[
        MARKET.as_bytes(),
        &ctx.accounts.yes_token.key().to_bytes(),
        &ctx.accounts.no_token.key().to_bytes(),
        &[ctx.bumps.market],
    ]];

    if yes_to_mint > 0 {
        // ✅ v3.0.2: 铸币到全局ATA，统一代币托管
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.yes_token.to_account_info(),
                    to: ctx.accounts.global_yes_ata.to_account_info(),
                    authority: market.to_account_info(),
                },
                market_signer_seeds,
            ),
            yes_to_mint,
        )?;

        msg!("✅ Minted {} YES tokens to market ATA", yes_to_mint);
    }

    if no_to_mint > 0 {
        // ✅ v3.0.2: 铸币到全局ATA，统一代币托管
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.no_token.to_account_info(),
                    to: ctx.accounts.global_no_ata.to_account_info(),
                    authority: market.to_account_info(),
                },
                market_signer_seeds,
            ),
            no_to_mint,
        )?;

        msg!("✅ Minted {} NO tokens to global ATA", no_to_mint);
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. 更新市场状态（Pool Ledger + Settlement Ledger）
    // ═══════════════════════════════════════════════════════════════

    // Pool Ledger
    market.pool_collateral_reserve = market
        .pool_collateral_reserve
        .checked_add(usdc_to_pool)
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.pool_yes_reserve = market
        .pool_yes_reserve
        .checked_add(yes_to_mint)
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.pool_no_reserve = market
        .pool_no_reserve
        .checked_add(no_to_mint)
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.total_lp_shares = market
        .total_lp_shares
        .checked_add(lp_shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // Settlement Ledger（仅记录铸造的完整集）
    let complete_sets_minted = yes_to_mint.min(no_to_mint);

    // ✅ v3.0.5: 资金守恒断言（P1 修复验证）
    // 确保：pool_usdc + locked_collateral = usdc_amount
    require!(
        usdc_to_pool.checked_add(complete_sets_minted).ok_or(PredictionMarketError::MathOverflow)? == usdc_amount,
        PredictionMarketError::InvalidAmount
    );

    market.total_collateral_locked = market
        .total_collateral_locked
        .checked_add(complete_sets_minted)
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.total_yes_minted = market
        .total_yes_minted
        .checked_add(yes_to_mint)
        .ok_or(PredictionMarketError::MathOverflow)?;

    market.total_no_minted = market
        .total_no_minted
        .checked_add(no_to_mint)
        .ok_or(PredictionMarketError::MathOverflow)?;

    // ✅ v3.0: 首次LP时记录初始储备（用于熔断触发条件2）
    if market.initial_yes_reserve == 0 {
        market.initial_yes_reserve = market.pool_yes_reserve;
        market.initial_no_reserve = market.pool_no_reserve;
        market.withdraw_tracking_start = current_timestamp;
        msg!("✅ Recorded initial reserves: YES={}, NO={}", market.initial_yes_reserve, market.initial_no_reserve);
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. 更新 LP Position
    // ═══════════════════════════════════════════════════════════════

    let is_new_position = lp_position.lp_shares == 0;

    lp_position.user = user.key();
    lp_position.market = market_key;
    lp_position.lp_shares = lp_position
        .lp_shares
        .checked_add(lp_shares)
        .ok_or(PredictionMarketError::MathOverflow)?;

    lp_position.invested_usdc = lp_position
        .invested_usdc
        .checked_add(usdc_amount)
        .ok_or(PredictionMarketError::MathOverflow)?;

    lp_position.last_fee_per_share = market.fee_per_share_cumulative;

    // ✅ v3.0: 时间锁字段
    if is_new_position {
        lp_position.created_at = current_timestamp;
    }
    lp_position.last_add_at = current_timestamp;

    msg!(
        "✅ LP position updated: shares={}, invested_usdc={}, created_at={}, last_add_at={}",
        lp_position.lp_shares,
        lp_position.invested_usdc,
        lp_position.created_at,
        lp_position.last_add_at
    );

    // ═══════════════════════════════════════════════════════════════
    // 7. 发射事件
    // ═══════════════════════════════════════════════════════════════

    emit!(AddLiquidityEvent {
        market: market_key,
        user: user.key(),
        usdc_amount,
        yes_amount: yes_to_mint,
        no_amount: no_to_mint,
        lp_shares,
        total_lp_shares: market.total_lp_shares,
        pool_collateral_reserve: market.pool_collateral_reserve,
        pool_yes_reserve: market.pool_yes_reserve,
        pool_no_reserve: market.pool_no_reserve,
        locked_collateral: complete_sets_minted,  // v3.0.5: 资金守恒验证
        pool_usdc: usdc_to_pool,  // v3.0.5: 资金守恒验证
    });

    msg!(
        "🎉 Single-coin LP added successfully: {} USDC → {} shares (total: {})",
        usdc_amount,
        lp_shares,
        market.total_lp_shares
    );

    Ok(())
}
