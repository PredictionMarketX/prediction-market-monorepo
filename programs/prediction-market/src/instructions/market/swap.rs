//! 市场指令：代币交换（买/卖 YES 或 NO）

use crate::{
    constants::{CONFIG, GLOBAL, MARKET, MARKET_USDC_VAULT, USERINFO},
    errors::PredictionMarketError,
    state::{config::*, market::*},
};
use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token::{self, Mint, Token, TokenAccount},
};

/// 账户集合：交易所需账户
#[derive(Accounts)]
pub struct Swap<'info> {
    /// 全局配置
    #[account(
        mut,
        seeds = [CONFIG.as_bytes()],
        bump,
    )]
    global_config: Box<Account<'info, Config>>,

    /// ✅ v1.1.0: 团队钱包（仅用于验证 team_usdc_ata 的 authority）
    /// CHECK: Verified against global_config.team_wallet
    #[account(
        constraint = global_config.team_wallet == team_wallet.key() @ PredictionMarketError::IncorrectAuthority
    )]
    pub team_wallet: AccountInfo<'info>,

    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump
    )]
    market: Box<Account<'info, Market>>,

    /// ✅ v1.1.0: 全局金库（PDA，用于验证 mint authority 和 USDC 转账）
    /// CHECK: global vault pda used as authority
    #[account(
        mut,
        seeds = [GLOBAL.as_bytes()],
        bump,
    )]
    pub global_vault: AccountInfo<'info>,

    /// YES/NO 代币mint
    pub yes_token: Box<Account<'info, Mint>>,
    pub no_token: Box<Account<'info, Mint>>,

    /// ✅ v3.1.4: 全局金库的YES/NO ATA（使用 Box<Account<TokenAccount>> 统一类型）
    #[account(
        mut,
        associated_token::mint = yes_token,
        associated_token::authority = global_vault,
    )]
    pub global_yes_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v3.1.4: 全局金库的 NO Token ATA
    #[account(
        mut,
        associated_token::mint = no_token,
        associated_token::authority = global_vault,
    )]
    pub global_no_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v3.1.4: 用户的 YES ATA（不存在则创建）
    /// 代币先发送到这里，如果指定了recipient则再转账
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = yes_token,
        associated_token::authority = user,
    )]
    pub user_yes_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v3.1.4: 用户的 NO ATA（不存在则创建）
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = no_token,
        associated_token::authority = user,
    )]
    pub user_no_ata: Box<Account<'info, TokenAccount>>,

    /// 用户信息（按需初始化）
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + std::mem::size_of::<UserInfo>(),
        seeds = [USERINFO.as_bytes(), &user.key().to_bytes(), &market.key().to_bytes()],
        bump
    )]
    pub user_info: Box<Account<'info, UserInfo>>,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v1.1.0: USDC 相关账户
    // ═══════════════════════════════════════════════════════════════

    /// ✅ v1.1.0: USDC Mint
    #[account(
        constraint = usdc_mint.key() == global_config.usdc_mint @ PredictionMarketError::InvalidMint
    )]
    pub usdc_mint: Box<Account<'info, Mint>>,

    /// 🔒 v1.2.7: 市场专用 USDC 金库（隔离流动性）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = market_usdc_vault,
    )]
    pub market_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// 🔒 v1.2.7: 市场USDC金库PDA（签名权限）
    /// CHECK: market-specific usdc vault pda
    #[account(
        seeds = [MARKET_USDC_VAULT.as_bytes(), market.key().as_ref()],
        bump,
    )]
    pub market_usdc_vault: AccountInfo<'info>,

    /// ✅ v1.1.0: 用户 USDC ATA
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = user,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// ✅ v1.1.0: 团队钱包 USDC ATA（用于接收平台手续费）
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = team_wallet,
    )]
    pub team_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// 用户签名者（支付USDC的人）
    #[account(mut)]
    pub user: Signer<'info>,

    /// ✅ v1.2.0: 代币接收者（可选，接收YES/NO代币的人）
    /// 支持代买功能：可以与 user 不同
    /// 如果不提供，代币保留在user的ATA中
    /// CHECK: Token recipient for proxy buying
    pub recipient: Option<AccountInfo<'info>>,

    /// ✅ v1.2.0: 接收者的YES ATA（可选，仅在指定recipient时需要）
    /// CHECK: Recipient's YES token account
    pub recipient_yes_ata: Option<AccountInfo<'info>>,

    /// ✅ v1.2.0: 接收者的NO ATA（可选，仅在指定recipient时需要）
    /// CHECK: Recipient's NO token account
    pub recipient_no_ata: Option<AccountInfo<'info>>,

    /// 系统/代币/ATA程序
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    #[account(address = associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Swap<'info> {
    /// 处理交易：校验市场时间/状态，准备用户账户，委托给 `Market::swap`
    ///
    /// # 参数
    /// * `deadline` - 交易过期时间戳（Unix timestamp in seconds），如果为 0 则不检查
    pub fn handler(&mut self, amount: u64, direction: u8, token_type: u8 ,minimum_receive_amount: u64, deadline: i64, global_vault_bump:u8, market_usdc_vault_bump: u8) -> Result<()> {
        // ✅ v3.0.5: 重入锁已移至 Market::swap 内部（market.rs:456）
        // 避免双重上锁导致所有交易失败（P0 修复）

        // ✅ v1.2.3: 验证 USDC 精度（必须为 6）
        require!(
            self.usdc_mint.decimals == crate::constants::USDC_DECIMALS,
            PredictionMarketError::InvalidParameter
        );
        #[cfg(feature = "verbose-logs")]
        msg!("✅ USDC decimals validated: {}", self.usdc_mint.decimals);

        // ✅ v1.0.17: 验证 global_vault 已正确初始化（owner = program_id）
        // 防止在未执行 configure 初始化的情况下调用指令
        require!(
            self.global_vault.owner == &crate::ID,
            PredictionMarketError::InvalidAuthority
        );

        // ✅ FIX: 检查合约是否暂停
        require!(
            !self.global_config.is_paused,
            PredictionMarketError::ContractPaused
        );

        // ✅ v3.1.2: 检查市场级暂停
        require!(
            !self.market.market_paused,
            PredictionMarketError::MarketPaused
        );

        // ✅ v3.0.7: Gas 优化 - 统一获取 Clock (节省 ~300-500 CU)
        let clock = Clock::get()?;
        let current_timestamp = clock.unix_timestamp;
        let current_slot = clock.slot;

        // ✅ FIX MEDIUM-2: 检查交易是否已过期（防止交易长时间在 mempool 中等待）
        if deadline > 0 {
            require!(
                current_timestamp <= deadline,
                PredictionMarketError::TransactionExpired
            );
        }

        // ✅ v3.0.7: Gas 优化 - 提前缓存 key() 调用避免重复计算 (~150-300 CU)
        // 必须在获取可变引用之前缓存，否则会产生借用冲突
        let market_key = self.market.key();
        let _no_token_key = self.no_token.key();
        let _yes_token_key = self.yes_token.key();
        let user_key = self.user.key();

        let market = &mut self.market;

        // 校验结束时间
        // 🔒 v1.1.0: 统一使用 MarketEnded 错误码（与 market.rs 保持一致）
        if let Some(ending_slot) = market.ending_slot {
            require!(
                ending_slot >= current_slot,
                PredictionMarketError::MarketEnded
            )
        }

        // 不能在完成后再交易
        require!(
            market.is_completed == false,
            PredictionMarketError::CurveAlreadyCompleted
        );

        // ✅ v1.0.19 + v1.0.22: 强制检查 min_trading_liquidity（感谢审计发现!）
        //
        // 🔴 原问题：配置项 min_trading_liquidity 存在但未实际检查
        //    运营/前端容易误以为启用了最小流动性保护
        //
        // ✅ v1.0.19 修复：在交易前检查 pool_collateral_reserve 是否满足最小要求
        // ✅ v1.0.22 优化：使用更精确的错误类型 MarketBelowMinLiquidity
        //
        // 🔍 错误语义区分：
        //   - InsufficientLiquidity: 临时状态，池中资金不足完成此次交易
        //   - MarketBelowMinLiquidity: 市场总储备低于安全阈值，需管理员介入
        require!(
            market.pool_collateral_reserve >= self.global_config.min_trading_liquidity,
            PredictionMarketError::MarketBelowMinLiquidity
        );

        let user_info_pda = &mut self.user_info;

        // 初始化用户信息（如未初始化）
        if user_info_pda.is_initialized == false {
            msg!("User info does not exist, initializing...");
            user_info_pda.user = self.user.key();
            // ✅ FIX CRITICAL-2: 不再初始化已删除的余额字段
            user_info_pda.is_lp = false;
            user_info_pda.is_initialized = true;
            msg!("User info initialized.");
        } else {
            msg!("User info already exists.");
        }

        // ✅ v1.6.0: 验证枚举参数有效性（替代魔法数字）
        use crate::types::{TradeDirection, TokenType};

        let trade_direction = TradeDirection::from_u8(direction)
            .ok_or(PredictionMarketError::InvalidTradeDirection)?;
        let trade_token_type = TokenType::from_u8(token_type)
            .ok_or(PredictionMarketError::InvalidTokenType)?;

        msg!(
            "✅ v1.6.0 Swap started. amount: {}, direction: {:?}, token_type: {:?}, minimum_receive_amount: {}",
            amount,
            trade_direction,
            trade_token_type,
            minimum_receive_amount
        );

        // ✅ v3.1.4: ATA 验证通过 Anchor 约束自动处理
        // - init_if_needed 自动创建不存在的 ATA
        // - associated_token::mint + associated_token::authority 约束自动验证类型和所有权
        // - 无需手动 try_deserialize 和 require 检查（节省 ~1400-2100 CU）

        // ✅ v3.1.4: 获取可变 AccountInfo 以兼容市场 swap 方法签名（YES/NO ATA 为 AccountInfo）
        let source = &mut self.global_vault.to_account_info();
        let team_wallet = &mut self.team_wallet;

        let yes_token = &mut self.yes_token;
        let global_yes_ata_info = &mut self.global_yes_ata.to_account_info();
        let user_yes_ata_info = &mut self.user_yes_ata.to_account_info();

        let no_token = &mut self.no_token;
        let global_no_ata_info = &mut self.global_no_ata.to_account_info();
        let user_no_ata_info = &mut self.user_no_ata.to_account_info();

        // PDA种子
        let signer_seeds: &[&[&[u8]]] = &[&[
            GLOBAL.as_bytes(),
            &[global_vault_bump],
        ]];

        // ✅ v3.1.4: 交由市场逻辑处理交换
        let swap_result = market.swap(
            &mut self.global_config,
            yes_token.as_ref(),
            global_yes_ata_info,
            user_yes_ata_info,
            no_token.as_ref(),
            global_no_ata_info,
            user_no_ata_info,
            source,
            team_wallet,
            amount,
            direction,
            token_type,
            minimum_receive_amount,
            &self.user,
            signer_seeds,
            user_info_pda,
            &self.token_program,
            &self.system_program,
            // 🔒 v1.2.7: USDC 相关账户 (使用市场专用金库)
            &self.usdc_mint,
            &self.market_usdc_ata,
            &self.market_usdc_vault,
            market_usdc_vault_bump,
            &self.user_usdc_ata,
            &self.team_usdc_ata,
        )?;

        // ✅ v1.2.0: 如果指定了recipient，将代币转账给recipient
        if let Some(recipient) = &self.recipient {
            let recipient_ata = if token_type == 0 {
                self.recipient_no_ata.as_ref().ok_or(PredictionMarketError::InvalidParameter)?
            } else {
                self.recipient_yes_ata.as_ref().ok_or(PredictionMarketError::InvalidParameter)?
            };

            // 🔒 v1.2.3: 安全校验 - 验证 recipient ATA 的 mint 和 owner
            let expected_mint = if token_type == 0 {
                self.no_token.key()
            } else {
                self.yes_token.key()
            };

            let recipient_token_account = anchor_spl::token::TokenAccount::try_deserialize(
                &mut &recipient_ata.try_borrow_data()?[..]
            )?;

            require!(
                recipient_token_account.mint == expected_mint,
                PredictionMarketError::InvalidMint
            );

            require!(
                recipient_token_account.owner == recipient.key(),
                PredictionMarketError::IncorrectAuthority
            );

            let user_ata = if token_type == 0 {
                &self.user_no_ata
            } else {
                &self.user_yes_ata
            };

            // 只在买入时转账（卖出时代币从user扣除，USDC发送给user）
            if direction == 0 {
                anchor_spl::token::transfer(
                    CpiContext::new(
                        self.token_program.to_account_info(),
                        anchor_spl::token::Transfer {
                            from: user_ata.to_account_info(),
                            to: recipient_ata.to_account_info(),
                            authority: self.user.to_account_info(),
                        },
                    ),
                    swap_result.token_amount,
                )?;
                msg!("✅ Transferred {} tokens to recipient", swap_result.token_amount);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // ✅ v1.0.12: 发射准确的交易事件
        // ✅ v1.2.0: 添加 recipient 字段（支持代买，可选）
        // ═══════════════════════════════════════════════════════════════
        // ✅ v3.0.7: 复用之前获取的 clock (line 219)
        #[cfg(feature = "event-debug")]
        let recipient_key = self.recipient.as_ref().map(|r| r.key()).unwrap_or(user_key);

        // ✅ v3.0.6: Gas 优化 - 条件编译事件
        // 生产模式: 精简事件 (~100 字节)
        // 调试模式: 完整事件 (~200 字节)
        #[cfg(not(feature = "event-debug"))]
        emit!(crate::events::SwapExecuted {
            market: market_key,  // ✅ v3.0.7: 复用缓存的 key
            user: user_key,      // ✅ v3.0.7: 复用缓存的 key
            is_yes: token_type == 1,
            amount_in: if direction == 0 { swap_result.usdc_amount } else { swap_result.token_amount },
            amount_out: if direction == 0 { swap_result.token_amount } else { swap_result.usdc_amount },
            fee: swap_result.fee_usdc,
            timestamp: current_timestamp,  // ✅ v3.0.7: 复用 clock
        });

        #[cfg(feature = "event-debug")]
        emit!(TradeEvent {
            user: user_key,                             // ✅ v3.0.7: 复用缓存的 key
            recipient: recipient_key,                   // ✅ v1.2.0: 代币接收者（如果未指定则为user）
            token_yes: yes_token_key,                   // ✅ v3.0.7: 复用缓存的 key
            token_no: no_token_key,                     // ✅ v3.0.7: 复用缓存的 key
            market_info: market_key,                    // ✅ v3.0.7: 复用缓存的 key
            usdc_amount: swap_result.usdc_amount,       // ✅ v1.1.0: 实际 USDC 数量（买=支付，卖=收到）
            token_amount: swap_result.token_amount,     // ✅ 实际代币数量（买=收到，卖=支付）
            fee_usdc: swap_result.fee_usdc,             // ✅ v1.1.0: 实际手续费（USDC）
            is_buy: direction == 0,
            is_yes_no: token_type == 1,
            real_usdc_reserves: self.market.pool_collateral_reserve,  // ✅ v1.1.0: USDC 储备
            real_token_yes_reserves: self.market.pool_yes_reserve,
            real_token_no_reserves: self.market.pool_no_reserve,
            timestamp: current_timestamp,  // ✅ v3.0.7: 复用 clock
        });

        // ═══════════════════════════════════════════════════════════════
        // ✅ v1.5.2: 发射市场风险指标事件（用于前端风险仪表盘）
        // ✅ v3.0.6: Gas 优化 - 仅调试模式发射风险指标（节省 ~5,000 CU）
        // ═══════════════════════════════════════════════════════════════

        #[cfg(feature = "event-debug")]
        {
        // 计算当前YES价格
        let current_yes_price_bps = self.market.calculate_yes_price_bps()?;

        // 计算持仓不平衡度
        // ✅ v2.2: 直接使用 u64，修复事件字段类型溢出问题
        let position_imbalance = self.market.lmsr_q_yes.abs_diff(self.market.lmsr_q_no);

        // 估算LP最大潜在损失（假设单边全赢的情况）
        // 最大损失 ≈ |q_yes - q_no| / 2（简化估算）
        let max_lp_loss_estimate = position_imbalance / 2;

        // 计算保险池覆盖率
        let insurance_pool_coverage_bps = if max_lp_loss_estimate > 0 {
            ((self.global_config.lp_insurance_pool_balance as u128)
                .checked_mul(crate::constants::BASIS_POINTS_DIVISOR as u128)
                .unwrap_or(0)
                .checked_div(max_lp_loss_estimate as u128)
                .unwrap_or(0) as u64)
                .min(crate::constants::BASIS_POINTS_DIVISOR)
        } else {
            crate::constants::BASIS_POINTS_DIVISOR // 100%（无风险）
        } as u16;

        // 计算距离结算的时间（小时）
        let time_to_settlement_hours = if let Some(ending_slot) = self.market.ending_slot {
            let current_slot = clock.slot;
            if current_slot < ending_slot {
                let slots_remaining = ending_slot.saturating_sub(current_slot);
                // 每个槽位约0.4秒 = 0.4/3600小时
                ((slots_remaining as u128)
                    .checked_mul(4)
                    .unwrap_or(0)
                    .checked_div(36000) // 0.4s * 10 / 3600s = 4 / 36000
                    .unwrap_or(0) as u64)
            } else {
                0
            }
        } else {
            u64::MAX // 无结束时间
        };

        // 获取当前生效的b值（已经在交易时计算过）
        let effective_lmsr_b = self.market.calculate_effective_lmsr_b()?;

        // 计算最大单笔交易额
        let max_single_trade_size = (self.market.pool_collateral_reserve as u128)
            .checked_mul(crate::constants::MAX_SINGLE_TRADE_BPS as u128)
            .unwrap_or(0)
            .checked_div(crate::constants::BASIS_POINTS_DIVISOR as u128)
            .unwrap_or(0) as u64;

        emit!(MarketRiskMetrics {
            market: market_key,  // ✅ v3.0.7: 复用缓存的 key
            current_yes_price_bps,
            position_imbalance,
            max_lp_loss_estimate,
            insurance_pool_coverage_bps,
            time_to_settlement_hours,
            effective_lmsr_b,
            max_single_trade_size,
            timestamp: current_timestamp,  // ✅ v3.0.7: 复用 clock
        });
        } // ✅ v3.0.6: 结束 event-debug 条件编译块

        Ok(())
    }
}
