//! # 错误定义模块
//! 
//! 定义预测市场合约中可能出现的各种错误类型
//! 使用Anchor的错误处理机制提供详细的错误信息

use anchor_lang::prelude::*;

// 导出所有错误类型以便使用
pub use PredictionMarketError::*;

/// 预测市场错误枚举
/// 
/// 定义了合约中可能出现的所有错误类型
/// 每个错误都有对应的错误码和描述信息
#[error_code]
pub enum PredictionMarketError {
    /// 数值过小错误
    /// 当输入值小于允许的最小值时触发
    #[msg("ValueTooSmall")]
    ValueTooSmall,

    /// 数值过大错误
    /// 当输入值大于允许的最大值时触发
    #[msg("ValueTooLarge")]
    ValueTooLarge,

    /// 数值无效错误
    /// 当输入值不在允许的范围内时触发
    #[msg("ValueInvalid")]
    ValueInvalid,

    /// 配置账户错误
    /// 当提供的配置账户不正确时触发
    #[msg("IncorrectConfigAccount")]
    IncorrectConfigAccount,

    /// 权限错误
    /// 当调用者没有足够权限时触发
    #[msg("IncorrectAuthority")]
    IncorrectAuthority,

    /// 溢出或下溢错误
    /// 当数值计算发生溢出或下溢时触发
    #[msg("Overflow or underflow occured")]
    OverflowOrUnderflowOccurred,

    /// 无效金额错误
    /// 当提供的金额无效时触发
    #[msg("Amount is invalid")]
    InvalidAmount,

    /// 团队钱包地址错误
    /// 当团队钱包地址不正确时触发
    #[msg("Incorrect team wallet address")]
    IncorrectTeamWallet,

    /// 曲线未完成错误
    /// 当尝试在曲线未完成时执行某些操作时触发
    #[msg("Curve is not completed")]
    CurveNotCompleted,

    /// 曲线已完成错误
    /// 当尝试在曲线完成后执行交易时触发
    #[msg("Can not swap after the curve is completed")]
    CurveAlreadyCompleted,

    /// 铸造权限未撤销错误
    /// 当代币的铸造权限未被撤销时触发
    #[msg("Mint authority should be revoked")]
    MintAuthorityEnabled,

    /// 冻结权限未撤销错误
    /// 当代币的冻结权限未被撤销时触发
    #[msg("Freeze authority should be revoked")]
    FreezeAuthorityEnabled,

    /// 返回金额过小错误
    /// 当实际返回金额小于最小接收金额时触发（滑点保护）
    #[msg("Return amount is too small compared to the minimum received amount")]
    ReturnAmountTooSmall,

    /// AMM已存在错误
    /// 当尝试创建已存在的AMM时触发
    #[msg("AMM is already exist")]
    AmmAlreadyExists,

    /// 未初始化错误
    /// 当全局配置未初始化时触发
    #[msg("Global Not Initialized")]
    NotInitialized,

    /// 无效的全局权限错误
    /// 当全局权限验证失败时触发
    #[msg("Invalid Global Authority")]
    InvalidGlobalAuthority,

    /// 白名单错误
    /// 当创建者不在白名单中时触发
    #[msg("This creator is not in whitelist")]
    NotWhiteList,

    /// 启动阶段错误
    /// 当操作不在正确的启动阶段时触发
    #[msg("IncorrectLaunchPhase")]
    IncorrectLaunchPhase,

    /// 代币余额不足错误
    /// 当没有足够的代币完成卖出订单时触发
    #[msg("Not enough tokens to complete the sell order.")]
    InsufficientTokens,

    /// USDC 余额不足错误（历史命名保留以兼容）
    /// ⚠️ 已更新为 USDC 业务逻辑，错误名保留以避免破坏现有错误码映射
    /// 当没有足够的 USDC 完成操作时触发
    #[msg("Not enough USDC/collateral to complete operation")]
    InsufficientSol,

    /// 卖出失败错误
    /// 当卖出操作失败时触发
    #[msg("Sell Failed")]
    SellFailed,

    /// 买入失败错误
    /// 当买入操作失败时触发
    #[msg("Buy Failed")]
    BuyFailed,

    /// 非绑定曲线代币错误
    /// 当代币不是绑定曲线代币时触发
    #[msg("This token is not a bonding curve token")]
    NotBondingCurveMint,

    /// 非USDC代币错误（历史命名保留为向后兼容）
    /// ✅ v3.1.4: 重命名为 NotUSDC（功能等同旧 NotSOL，仅保留错误码以确保兼容性）
    /// 当 USDC mint 验证失败或代币类型不匹配时触发
    #[msg("Not USDC quote mint")]
    NotUSDC,

    /// 无效的迁移权限错误
    /// 当迁移权限验证失败时触发
    #[msg("Invalid Migration Authority")]
    InvalidMigrationAuthority,

    /// 绑定曲线未完成错误
    /// 当绑定曲线未完成时触发
    #[msg("Bonding curve is not completed")]
    NotCompleted,

    /// 无效的Meteora程序错误
    /// 当Meteora程序验证失败时触发
    #[msg("Invalid Meteora Program")]
    InvalidMeteoraProgram,

    /// 算术错误
    /// 当算术运算出现错误时触发
    #[msg("Arithmetic Error")]
    ArithmeticError,

    /// 无效参数错误
    /// 当提供的参数无效时触发
    #[msg("Invalid Parameter")]
    InvalidParameter,

    /// 无效开始时间错误
    /// 当开始时间在过去时触发
    #[msg("Start time is in the past")]
    InvalidStartTime,

    /// 无效结束时间错误
    /// 当结束时间在过去时触发
    #[msg("End time is in the past")]
    InvalidEndTime,

    /// 已初始化错误
    /// 当尝试重复初始化时触发
    #[msg("Global Already Initialized")]
    AlreadyInitialized,

    /// 无效权限错误
    /// 当权限验证失败时触发
    #[msg("Invalid Authority")]
    InvalidAuthority,

    /// 无效参数错误
    /// 当提供的参数无效时触发
    #[msg("Invalid Argument")]
    InvalidArgument,

    /// 市场未完成错误
    /// 当市场尚未结束时触发
    #[msg("The market has already ended.")]
    MarketNotCompleted,

    /// 市场已完成错误
    /// 当市场已经结束时触发
    #[msg("The market already ended.")]
    MarketIsCompleted,

    /// 获胜代币类型错误
    /// 当获胜代币类型设置错误时触发
    #[msg("The winner token type error.")]
    RESOLUTIONTOKEYTYPEERROR,

    /// 获胜YES代币数量错误
    /// 当YES代币奖励数量设置错误时触发
    #[msg("The winner yes token amount error.")]
    RESOLUTIONYESAMOUNTERROR,

    /// 获胜NO代币数量错误
    /// 当NO代币奖励数量设置错误时触发
    #[msg("The winner no token amount error.")]
    RESOLUTIONNOAMOUNTERROR,

    /// 提取数量错误
    /// 当提取的 USDC/代币数量无效时触发
    #[msg("The withdraw sol amount error.")]
    WITHDRAWLIQUIDITYSOLAMOUNTERROR,

    /// 非LP提取错误
    /// 当非流动性提供者尝试提取流动性时触发
    #[msg("The withdraw: not lp error.")]
    WITHDRAWNOTLPERROR,

    /// 余额不足错误
    /// 当账户余额不足以完成操作时触发
    #[msg("Insufficient balance")]
    InsufficientBalance,

    /// 流动性不足错误
    /// 当市场流动性不足时触发
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,

    /// 数学溢出错误
    /// 当数学运算发生溢出时触发
    #[msg("Math overflow")]
    MathOverflow,

    /// 滑点超过限制错误
    /// 当实际价格滑点超过用户设定的限制时触发
    #[msg("Slippage exceeded")]
    SlippageExceeded,

    /// 无效的元数据账户错误
    /// 当提供的元数据账户不正确时触发
    #[msg("Invalid metadata account")]
    InvalidMetadataAccount,

    /// 合约已暂停错误
    /// 当合约处于暂停状态时尝试执行操作时触发
    #[msg("Contract is paused")]
    ContractPaused,

    /// 🔒 v1.1.0: 合约已经处于暂停状态
    /// 当尝试暂停一个已经暂停的合约时触发
    #[msg("Contract is already paused")]
    AlreadyPaused,

    /// 🔒 v1.1.0: 合约未暂停
    /// 当尝试恢复一个未暂停的合约时触发
    #[msg("Contract is not paused")]
    NotPaused,

    /// 市场未到结束时间错误
    /// 当尝试在市场结束前进行结算时触发
    #[msg("Market has not ended yet")]
    MarketNotEnded,

    /// 交易已过期错误
    /// 当交易超过指定的截止时间时触发（防止长时间停留在mempool）
    #[msg("Transaction has expired")]
    TransactionExpired,

    /// 重入攻击检测错误
    /// 当检测到重入攻击尝试时触发
    #[msg("Reentrancy detected")]
    ReentrancyDetected,

    /// Pool 已初始化错误
    /// 当尝试重复初始化 Pool 流动性时触发
    #[msg("Pool has already been seeded with initial liquidity")]
    PoolAlreadySeeded,

    /// 流动性比例错误
    /// 当添加流动性时，USDC/YES/NO三种资产的比例与池子当前比例不匹配
    #[msg("Liquidity ratio mismatch: USDC, YES, and NO must maintain pool proportions (max 1% deviation)")]
    InvalidLiquidityRatio,

    /// 市场已结算，无法提取流动性
    /// 当市场已完成结算后，LP尝试提取流动性
    #[msg("Market is resolved, LP withdrawal locked until all settlements complete")]
    MarketResolvedLpLocked,

    /// 市场尚未开始错误
    /// 当尝试在市场开始前进行交易时触发
    #[msg("Market has not started yet")]
    MarketNotStarted,

    /// 市场已结束错误
    /// 当尝试在市场结束后进行交易时触发
    #[msg("Market has already ended")]
    MarketEnded,

    /// 创建者未在白名单中
    /// 当启用白名单模式时，创建市场的用户必须在白名单中
    #[msg("Creator is not whitelisted")]
    CreatorNotWhitelisted,

    /// 除零错误
    /// 当尝试除以零时触发
    #[msg("Division by zero")]
    DivisionByZero,

    /// 无效的代币 Mint
    /// 当 ATA 账户的 mint 与预期不符时触发（v1.0.18 纵深防御）
    #[msg("Invalid token mint for this ATA")]
    InvalidMint,

    /// 市场流动性低于最小要求
    /// 当市场的 pool_collateral_reserve 低于配置的 min_trading_liquidity 时触发（v1.0.22）
    /// 这与 InsufficientLiquidity 不同：
    /// - InsufficientLiquidity: 池中资金不足以完成交易（临时状态）
    /// - MarketBelowMinLiquidity: 市场总储备低于安全阈值（需要管理员干预）
    #[msg("Market collateral reserve below minimum trading liquidity threshold")]
    MarketBelowMinLiquidity,

    /// NO Token 已被其他市场使用
    /// 当尝试使用已有供应（supply > 0）的 NO mint 创建市场时触发（v1.1.0 安全修复）
    /// 防止攻击者复用现有市场的 NO mint，导致多个市场共享同一个 NO 代币账户
    /// **安全关键**：此错误防止市场间的库存篡改攻击
    #[msg("NO token mint is already in use (supply > 0). Each market must use a fresh NO mint.")]
    TokenAlreadyInUse,

    /// Pool 尚未结算
    /// 当尝试回收尾款但市场 Pool 尚未结算时触发（v1.2.2）
    #[msg("Pool has not been settled yet")]
    PoolNotSettled,

    /// 抵押品仍被锁定
    /// 当尝试回收尾款但仍有用户抵押品锁定时触发（v1.2.2）
    #[msg("Collateral is still locked, cannot reclaim dust")]
    CollateralStillLocked,

    /// LP 份额仍然存在
    /// 当尝试回收尾款但仍有 LP 份额未提取时触发（v1.2.2）
    #[msg("LP shares still exist, cannot reclaim dust")]
    LPSharesStillExist,

    /// 单笔交易金额过大
    /// 当单笔交易金额超过池子储备的10%时触发（v1.5.1 防止巨鲸操纵）
    /// 这是为了保护LP免受大额订单的价格冲击
    #[msg("Trade size exceeds maximum allowed (10% of pool reserve)")]
    TradeSizeTooLarge,

    /// 无效的交易方向
    /// 当提供的 direction 参数不是有效值时触发（v1.6.0）
    /// 有效值：0=Buy, 1=Sell
    #[msg("Invalid trade direction (must be 0=Buy or 1=Sell)")]
    InvalidTradeDirection,

    /// 无效的代币类型
    /// 当提供的 token_type 参数不是有效值时触发（v1.6.0）
    /// 有效值：0=No, 1=Yes
    #[msg("Invalid token type (must be 0=No or 1=Yes)")]
    InvalidTokenType,

    /// 无效的市场结果
    /// 当提供的 outcome 参数不是有效值时触发（v1.6.0）
    /// 有效值：0=NoWins, 1=YesWins, 2=Draw
    #[msg("Invalid market outcome (must be 0=NoWins, 1=YesWins, or 2=Draw)")]
    InvalidMarketOutcome,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: 单币 LP 相关错误
    // ═══════════════════════════════════════════════════════════════

    /// 池子过于不平衡
    /// 当 |q_yes - q_no| >= 2b 时禁止买入多数方（v3.0 硬上限）
    /// 这是为了保护LP免受极端价格下的无常损失
    #[msg("Pool is too imbalanced (|q_yes - q_no| >= 2b), cannot buy majority side")]
    PoolTooImbalanced,

    /// 无效的铸币权限
    /// 当代币的 mint authority 不是预期的账户时触发（v3.0）
    #[msg("Invalid mint authority (expected market PDA)")]
    InvalidMintAuthority,

    /// Mint 权限尚未转移
    /// 当尝试执行需要 market PDA 为 mint authority 的操作时触发（v3.0）
    /// 需要先调用 set_mint_authority 指令转移权限
    #[msg("Mint authority has not been transferred to market PDA yet")]
    MintAuthorityNotTransferred,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: LP 保护机制相关错误
    // ═══════════════════════════════════════════════════════════════

    /// 超出撤出限制
    /// 当LP尝试撤出的份额超过当前允许的最大比例时触发（v3.0）
    /// 撤出限制随池子不平衡程度动态调整：5%-30%
    #[msg("Withdrawal amount exceeds current limit (5%-30% based on pool imbalance)")]
    ExcessiveWithdrawal,

    /// 熔断已触发
    /// 当熔断机制激活时，禁止所有LP撤出操作（v3.0）
    /// 触发条件：池子比例>=4:1 或 单边储备<10% 或 24h撤出>50%
    #[msg("Circuit breaker is active, LP withdrawals are temporarily disabled")]
    CircuitBreakerTriggered,

    /// 熔断未激活
    /// 当尝试重置一个未激活的熔断器时触发（v3.0）
    #[msg("Circuit breaker is not active")]
    CircuitBreakerNotActive,

    /// 熔断冷却期未过
    /// 当尝试在24小时冷却期内重置熔断器时触发（v3.0）
    #[msg("Circuit breaker cooldown period (24h) has not elapsed")]
    CircuitBreakerCooldownNotElapsed,

    /// 熔断重置条件不满足
    /// 当池子比例仍>=3:1时无法重置熔断器（v3.0）
    #[msg("Circuit breaker reset conditions not met (pool ratio must be < 3:1)")]
    CircuitBreakerConditionsNotMet,

    /// 提现将触发熔断器
    /// 当提现会导致触发熔断机制时，拒绝该笔提现（v3.0.1）
    /// 这是为了防止用户在熔断触发前立即发起大额提现
    #[msg("This withdrawal would trigger the circuit breaker and is rejected")]
    WouldTriggerCircuitBreaker,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: 保险池相关错误
    // ═══════════════════════════════════════════════════════════════

    /// 保险池未启用
    /// 当尝试使用保险池功能但其处于禁用状态时触发（v3.0）
    #[msg("Insurance pool is not enabled")]
    InsurancePoolNotEnabled,

    /// 无平台费用无法启用保险池
    /// 当尝试启用保险池但 platform_fee = 0 时触发（v3.0）
    /// 保险池需要平台费用注入才能运作
    #[msg("Cannot enable insurance pool without platform fees (platform_fee must be > 0)")]
    CannotEnableInsuranceWithoutPlatformFee,

    /// 无效的保险池配置
    /// 当保险池相关参数（allocation/threshold/max_compensation）超过100%时触发（v3.0）
    #[msg("Invalid insurance pool configuration (parameters must be <= 10000 bps)")]
    InvalidInsuranceConfig,

    /// 代币供应量不匹配
    /// 当池子代币余额超过铸造总量时触发（v3.0.4）
    /// 表明代币统计存在问题
    #[msg("Token supply mismatch: pool balance exceeds total minted")]
    TokenSupplyMismatch,

    /// 市场级暂停
    #[msg("Market is paused")]
    MarketPaused,
}
