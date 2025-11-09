//! # 工具函数模块
//!
//! 提供预测市场合约中使用的各种工具函数
//! 包括数值转换、代币转账、SOL转账等功能

use crate::*;
use crate::errors::PredictionMarketError;
use anchor_spl::token::{self, Token};
use anchor_lang::system_program::{transfer, Transfer};
use std::ops::{Div, Mul};

/// 将代币数量转换为浮点数
///
/// ⚠️ DEPRECATED: 不再使用，所有计算已迁移至整数运算
/// 保留此函数仅供向后兼容，建议在未来版本移除
///
/// 根据代币的精度将原始数量转换为可读的浮点数
///
/// # 参数
/// * `value` - 原始代币数量
/// * `decimals` - 代币精度
///
/// # 返回
/// * `f64` - 转换后的浮点数
///
/// # 示例
/// ```rust,ignore
/// // Doctest ignored: deprecated function, kept for backward compatibility only
/// let tokens = convert_to_float(1000000000, 9); // 1.0
/// ```
#[deprecated(since = "1.0.17", note = "All calculations migrated to integer arithmetic")]
#[allow(dead_code)]
pub fn convert_to_float(value: u64, decimals: u8) -> f64 {
    (value as f64).div(f64::powf(10.0, decimals as f64))
}

/// 将浮点数转换为代币数量
///
/// ⚠️ DEPRECATED: 不再使用，所有计算已迁移至整数运算
/// 保留此函数仅供向后兼容，建议在未来版本移除
///
/// 根据代币的精度将浮点数转换为原始代币数量
///
/// # 参数
/// * `value` - 浮点数值
/// * `decimals` - 代币精度
///
/// # 返回
/// * `u64` - 转换后的代币数量
///
/// # 示例
/// ```rust,ignore
/// // Doctest ignored: deprecated function, kept for backward compatibility only
/// let amount = convert_from_float(1.5, 9); // 1500000000
/// ```
#[deprecated(since = "1.0.17", note = "All calculations migrated to integer arithmetic")]
#[allow(dead_code)]
pub fn convert_from_float(value: f64, decimals: u8) -> u64 {
    value.mul(f64::powf(10.0, decimals as f64)) as u64
}

/// 从用户账户转账 SOL（⚠️ 仅用于 Solana 原生 SOL，如租金等）
/// 
/// 使用系统程序从签名者账户向目标账户转账SOL
/// 
/// # 参数
/// * `signer` - 签名者账户（资金源）
/// * `destination` - 目标账户
/// * `system_program` - 系统程序
/// * `amount` - 转账金额（lamports）
/// 
/// # 注意
/// ⚠️ 此函数用于 Solana 原生 SOL 转账（如支付租金），非业务逻辑 USDC 转账
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn sol_transfer_from_user<'info>(
    signer: &Signer<'info>,
    destination: AccountInfo<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
) -> Result<()> {
    // ✅ v1.0.21: 统一使用 Anchor CPI 风格（感谢审计发现!）
    //
    // 🔴 原问题：此函数使用低级 system_instruction::transfer + invoke
    //    而其他地方使用 Anchor 的 system_program::transfer CPI
    //    风格不一致，增加维护成本
    //
    // ✅ 修复：统一使用 Anchor CPI 风格
    let cpi_ctx = CpiContext::new(
        system_program.to_account_info(),
        Transfer {
            from: signer.to_account_info(),
            to: destination,
        },
    );

    transfer(cpi_ctx, amount)
}

/// 从用户账户转账代币
/// 
/// 使用SPL代币程序从用户账户转账代币
/// 
/// # 参数
/// * `from` - 源代币账户
/// * `authority` - 授权签名者
/// * `to` - 目标代币账户
/// * `token_program` - SPL代币程序
/// * `amount` - 转账数量
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn token_transfer_user<'info>(
    from: AccountInfo<'info>,
    authority: &Signer<'info>,
    to: AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    // 创建CPI上下文
    let cpi_ctx: CpiContext<_> = CpiContext::new(
        token_program.to_account_info(),
        token::Transfer {
            from,
            authority: authority.to_account_info(),
            to,
        },
    );
    
    // 执行代币转账
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

/// 从PDA账户转账代币
/// 
/// 使用PDA作为授权者进行代币转账
/// 需要提供PDA的签名种子
/// 
/// # 参数
/// * `from` - 源代币账户
/// * `authority` - PDA授权账户
/// * `to` - 目标代币账户
/// * `token_program` - SPL代币程序
/// * `signer_seeds` - PDA签名种子
/// * `amount` - 转账数量
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn token_transfer_with_signer<'info>(
    from: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    to: AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    // 创建带签名的CPI上下文
    let cpi_ctx: CpiContext<_> = CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::Transfer {
            from,
            to,
            authority,
        },
        signer_seeds,
    );
    
    // 执行代币转账
    token::transfer(cpi_ctx, amount)?;
    Ok(())
}

/// 从PDA账户转账SOL
/// 
/// 使用PDA作为签名者进行SOL转账
/// 需要提供PDA的签名种子
/// 
/// # 参数
/// * `source` - 源账户（PDA）
/// * `destination` - 目标账户
/// * `system_program` - 系统程序
/// * `signers_seeds` - PDA签名种子
/// * `amount` - 转账金额（lamports）
/// 
/// # 注意
/// ⚠️ 此函数用于 Solana 原生 SOL 转账（如支付租金），非业务逻辑 USDC 转账
/// 
/// # 返回
/// * `Result<()>` - 操作结果
pub fn sol_transfer_with_signer<'info>(
    source: AccountInfo<'info>,
    destination: AccountInfo<'info>,
    system_program: &Program<'info, System>,
    signers_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    // ✅ v1.0.21: 统一使用 Anchor CPI 风格（感谢审计发现!）
    //
    // 🔴 原问题：此函数使用低级 system_instruction::transfer + invoke_signed
    //    而其他地方使用 Anchor 的 system_program::transfer CPI
    //    风格不一致，增加维护成本
    //
    // ✅ 修复：统一使用 Anchor CPI 风格
    let cpi_ctx = CpiContext::new_with_signer(
        system_program.to_account_info(),
        Transfer {
            from: source,
            to: destination,
        },
        signers_seeds,
    );

    transfer(cpi_ctx, amount)
}

/// 从PDA账户销毁代币
///
/// 使用PDA作为授权者销毁代币
/// 销毁的代币将从总供应量中永久移除
///
/// # 参数
/// * `mint` - 代币铸造账户（Mint）
/// * `from` - 要销毁代币的账户（TokenAccount）
/// * `authority` - PDA授权账户
/// * `token_program` - SPL代币程序
/// * `signer_seeds` - PDA签名种子
/// * `amount` - 销毁数量
///
/// # 返回
/// * `Result<()>` - 操作结果
///
/// # 修复历史
/// ✅ v1.0.17: 修复 mint 参数错误传递 from 的bug
pub fn token_burn_with_signer<'info>(
    mint: AccountInfo<'info>, // ✅ FIX: 新增 mint 参数
    from: AccountInfo<'info>, // 要销毁代币的账户
    authority: AccountInfo<'info>, // PDA授权账户
    token_program: &Program<'info, Token>, // SPL代币程序
    signer_seeds: &[&[&[u8]]], // PDA签名种子
    amount: u64, // 销毁数量
) -> Result<()> {
    // 创建带签名的CPI上下文
    let cpi_ctx: CpiContext<_> = CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::Burn {
            mint, // ✅ FIX: 使用正确的 mint 参数
            from, // 要销毁的账户
            authority, // PDA授权账户
        },
        signer_seeds,
    );

    // 执行代币销毁
    token::burn(cpi_ctx, amount)?;
    Ok(())
}

/// 计算基点（BPS）乘法
///
/// 用于计算手续费等基于基点的计算
/// 防止溢出并提供安全的数值计算
///
/// # 参数
/// * `bps` - 基点值（如1000表示10%）
/// * `value` - 基础值
/// * `divisor` - 除数（通常为10000）
///
/// # 返回
/// * `Option<u64>` - 计算结果，如果溢出则返回None
///
/// # 注意
/// ⚠️ 此函数目前未被项目使用，如需启用请确保参数有效
pub fn bps_mul(bps: u64, value: u64, divisor: u64) -> Option<u64> {
    // ✅ FIX: 移除 unwrap()，使用 ? 链式调用
    bps_mul_raw(bps, value, divisor)?.try_into().ok()
}

/// 基点乘法的原始实现
/// 
/// 使用u128进行中间计算以防止溢出
/// 
/// # 参数
/// * `bps` - 基点值
/// * `value` - 基础值
/// * `divisor` - 除数
/// 
/// # 返回
/// * `Option<u128>` - 计算结果
pub fn bps_mul_raw(bps: u64, value: u64, divisor: u64) -> Option<u128> {
    (value as u128)
        .checked_mul(bps as u128)?
        .checked_div(divisor as u128)
}

// ═══════════════════════════════════════════════════════════════
// ✅ v1.2.3: RAII 重入保护守卫
// ═══════════════════════════════════════════════════════════════

/// 重入保护守卫
///
/// 在构造时检查并设置锁标志，在析构时（Drop）自动清除锁标志
///
/// # Safety
/// 使用原始指针绕过 Rust 借用检查器的限制。这是安全的，因为：
/// 1. 指针在守卫生命周期内始终有效
/// 2. 单线程执行环境（Solana 运行时）
/// 3. 锁标志在 Drop 时必定被清除
///
/// # 用法
/// ```ignore
/// let _guard = ReentrancyGuard::new(&mut self.market.withdraw_in_progress)?;
/// // ... 执行业务逻辑 ..
/// // 函数返回时（无论成功还是失败），_guard 被 drop，锁自动清除
/// ```
pub struct ReentrancyGuard {
    /// 锁标志的原始指针（使用unsafe绕过借用检查器）
    flag: *mut bool,
}

impl ReentrancyGuard {
    /// 创建守卫并设置锁
    ///
    /// # 参数
    /// * `flag` - 锁标志的可变引用
    ///
    /// # 返回
    /// * `Result<Self>` - 成功返回守卫，失败返回 ReentrancyDetected 错误
    ///
    /// # 错误
    /// 如果锁已被持有（`*flag == true`），返回 `ReentrancyDetected`
    ///
    /// # Safety
    /// 此函数在内部使用 unsafe 代码，但对外是安全的
    pub fn new(flag: &mut bool) -> Result<Self> {
        // 检查锁是否已被持有
        require!(!*flag, crate::errors::PredictionMarketError::ReentrancyDetected);

        // 设置锁
        *flag = true;

        msg!("✅ Reentrancy guard acquired");

        // 将引用转换为原始指针，立即释放借用
        Ok(Self {
            flag: flag as *mut bool,
        })
    }
}

impl Drop for ReentrancyGuard {
    /// 自动清除锁（析构函数）
    ///
    /// 无论函数如何退出，Rust 都会调用此方法释放锁
    fn drop(&mut self) {
        unsafe {
            *self.flag = false;
        }
        msg!("✅ Reentrancy guard released");
    }
}

// ═══════════════════════════════════════════════════════════════
// ✅ v3.0.10: 数学辅助函数
// ═══════════════════════════════════════════════════════════════

/// 计算按比例分配的份额
///
/// 用于计算 LP 份额对应的资产数量，避免重复的 checked_mul + checked_div 代码
///
/// # 参数
/// * `total` - 总量（如池子储备量、LP投资额等）
/// * `numerator` - 份额分子（如用户的 LP 份额）
/// * `denominator` - 份额分母（如总 LP 份额）
///
/// # 返回
/// * `Result<u64>` - 计算结果: `(total * numerator) / denominator`
///
/// # 示例
/// ```rust,ignore
/// // 用户持有 100 份额，总共 1000 份额，池子有 5000 USDC
/// let user_usdc = calculate_proportional_share(5000, 100, 1000)?;
/// // user_usdc = 500
/// ```
///
/// # 性能
/// - 使用 u128 中间值避免溢出
/// - inline 提示编译器内联优化
/// - 统一错误处理减少代码重复
#[inline]
pub fn calculate_proportional_share(
    total: u64,
    numerator: u128,
    denominator: u128,
) -> Result<u64> {
    let result = (total as u128)
        .checked_mul(numerator)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(denominator)
        .ok_or(PredictionMarketError::MathOverflow)? as u64;
    Ok(result)
}
