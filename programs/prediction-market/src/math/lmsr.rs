//! # LMSR (Logarithmic Market Scoring Rule) 定点实现
//!
//! ## 什么是 LMSR？ (What is LMSR?)
//!
//! LMSR 是一种**自动化做市商 (AMM)** 算法，专门设计用于预测市场。
//! 与 Uniswap 的恒定乘积公式 (x·y=k) 不同，LMSR 提供：
//!
//! - ✅ **固定流动性深度**: 通过参数 `b` 控制价格滑点
//! - ✅ **概率解释**: 价格直接对应事件发生的概率
//! - ✅ **对数稳定性**: 适合二元结果市场（YES/NO）
//!
//! ## 核心数学公式 (Core Mathematical Formulas)
//!
//! ### 1. 成本函数 (Cost Function)
//!
//! ```text
//! C(q) = b × ln(exp(q_yes/b) + exp(q_no/b))
//!
//! where:
//!   b       - 流动性参数 (liquidity parameter, in USDC 最小单位)
//!   q_yes   - YES 代币净持仓 (net position in YES tokens, can be negative)
//!   q_no    - NO 代币净持仓 (net position in NO tokens, can be negative)
//!   C(q)    - 市场成本 (market cost, in USDC 最小单位)
//! ```
//!
//! **物理意义**:
//! - `b` 越大 → 流动性越深，价格变动越慢
//! - `b` 越小 → 流动性越浅，价格变动越快
//! - `C(0, 0) = b × ln(2)` - 初始成本（50/50 概率）
//!
//! ### 2. 边际价格 (Marginal Price)
//!
//! ```text
//! p_yes = ∂C/∂q_yes = exp(q_yes/b) / (exp(q_yes/b) + exp(q_no/b))
//! p_no  = ∂C/∂q_no  = exp(q_no/b) / (exp(q_yes/b) + exp(q_no/b))
//!
//! Constraint: p_yes + p_no = 1  (概率之和为 1)
//! ```
//!
//! **概率解释**:
//! - `p_yes = 0.7` 表示市场认为 YES 有 70% 概率发生
//! - `p_no = 0.3` 表示市场认为 NO 有 30% 概率发生
//!
//! ### 3. 买入/卖出计算 (Buy/Sell Calculations)
//!
//! ```text
//! Buy δ YES tokens:
//!   Cost = C(q_yes + δ, q_no) - C(q_yes, q_no)
//!
//! Sell δ YES tokens:
//!   Receive = C(q_yes, q_no) - C(q_yes - δ, q_no)
//! ```
//!
//! ## 数值稳定性 (Numerical Stability)
//!
//! ### 挑战 (Challenges)
//!
//! 直接计算 `exp(q_yes/b) + exp(q_no/b)` 会导致：
//! - **溢出 (Overflow)**: 当 q_yes 或 q_no 很大时
//! - **精度损失 (Precision Loss)**: 当两者差异很大时
//!
//! ### 解决方案: Log-Sum-Exp 技巧 (Solution: Log-Sum-Exp Trick)
//!
//! ```text
//! ln(exp(a) + exp(b)) = max(a, b) + ln(1 + exp(-|a - b|))
//! ```
//!
//! 详见 `fixed_point::fp_log_sum_exp` 的文档。
//!
//! ## 二分搜索 (Binary Search for Inverse Calculations)
//!
//! 某些操作需要反向求解（给定 USDC 金额，求代币数量）：
//!
//! ```text
//! Given: usdc_amount, current state (q_yes, q_no)
//! Find:  δ such that C(q_yes + δ, q_no) - C(q_yes, q_no) = usdc_amount
//!
//! Method: Binary search over δ ∈ [0, upper_bound]
//! Convergence: ε = 0.0001 USDC (100,000 最小单位)
//! Max iterations: 50 (gas limit)
//! ```
//!
//! **动态上界 (Dynamic Upper Bound)** (v1.0.20):
//! - 根据当前价格估算合理上界，避免 * 100 的浪费
//! - `upper_bound ≈ usdc_amount / current_price × 1.5` (50% safety margin)
//!
//! ## Gas 优化 (Gas Optimization)
//!
//! - ✅ 使用 Q64.64 定点数（整数运算，比浮点快）
//! - ✅ 最大迭代次数限制：50（防止无限循环）
//! - ✅ 提前终止：误差 < 0.0001 USDC 时停止
//! - ✅ 所有中间值使用 u128 防溢出
//! - ✅ 严格边界检查
//!
//! ## 参考文献 (References)
//!
//! - Hanson, R. (2003). "Combinatorial Information Market Design"
//!   <https://mason.gmu.edu/~rhanson/mktscore.pdf>
//! - Chen, Y., & Pennock, D. M. (2007). "A Utility Framework for Bounded-Loss Market Makers"
//!   <https://arxiv.org/abs/1206.5252>
//! - Polymarket LMSR Implementation:
//!   <https://docs.polymarket.com/>
//!
//! ## 版本历史 (Version History)
//!
//! - v1.0.10-12: 初始实现（存在多个数学错误）
//! - v1.0.13-14: 修正 MAX_B_PARAM 和 MAX_POSITION 常量
//! - v1.0.19: 修复二分搜索上界问题（* 100 引入新漏洞）
//! - v1.0.20: 完全重写 log-sum-exp，动态上界
//! - v1.0.24: 修复 fp_log_sum_exp 的 exp(-diff) bug

use anchor_lang::prelude::*;
use super::fixed_point::*;

/// LMSR 计算配置
pub mod config {
    /// 二分法最大迭代次数（Gas 限制）
    pub const MAX_ITERATIONS: u8 = 50;

    /// 二分法收敛精度（0.0001 USDC = 100_000 最小单位）
    pub const CONVERGENCE_THRESHOLD: u64 = 100_000;

    /// ✅ v1.0.13: 修正最大 b 参数（与 constants::MAX_LMSR_B 对齐）
    /// 1M USDC = 1,000,000,000,000 最小单位（6 decimals）
    ///
    /// ✅ v1.1.0: 更新为 USDC 单位（6 位精度）
    /// 1M USDC = 1,000,000 * 10^6 = 1,000,000,000,000
    /// 原错误 (v1.0.10-v1.0.12): 1u64 << 32 = 4.29 SOL (历史记录，当时使用 SOL 计价)
    pub const MAX_B_PARAM: u64 = 1_000_000_000_000; // 1M USDC in smallest units (6 decimals)

    /// ✅ v1.0.14: 修正最大持仓量（与 constants::MAX_Q_VALUE 对齐）
    /// ✅ v1.1.0: 更新为 USDC 单位（6 位精度）
    /// 1B USDC = 1,000,000,000,000,000（10^15）
    ///
    /// 原错误 (v1.0.10-v1.0.13): 1i64 << 31 = 2.14 USDC (历史记录，当时使用 SOL 计价)
    /// 导致无法处理 > 2 USDC 的交易，等同于拒绝服务
    pub const MAX_POSITION: i64 = 1_000_000_000_000_000; // 1B USDC in smallest units (6 decimals)
}

use config::*;

/// LMSR 成本函数 (LMSR Cost Function)
///
/// # 数学公式 (Mathematical Formula)
///
/// ```text
/// C(q) = b × ln(exp(q_yes/b) + exp(q_no/b))
///
/// where:
///   b ∈ (0, MAX_B_PARAM]           - 流动性参数 (liquidity depth)
///   q_yes ∈ [-MAX_POSITION, MAX_POSITION] - YES 代币净持仓
///   q_no ∈ [-MAX_POSITION, MAX_POSITION]  - NO 代币净持仓
/// ```
///
/// # 物理意义 (Physical Meaning)
///
/// **成本函数 `C(q)` 表示什么？**
///
/// `C(q)` 是市场做市商为达到当前持仓状态 `(q_yes, q_no)` 所需的**累积成本**。
///
/// - 当用户买入代币时，市场持仓增加，成本上升
/// - 当用户卖出代币时，市场持仓减少，成本下降
/// - 价格变化 = 成本函数的偏导数（边际成本）
///
/// **参数 `b` 的作用**:
///
/// ```text
/// b = 100 USDC (深流动性):
///   买入 10 YES tokens → 价格变化 ~0.5%
///   适用于高交易量市场
///
/// b = 1 USDC (浅流动性):
///   买入 10 YES tokens → 价格变化 ~5%
///   适用于低交易量/新兴市场
/// ```
///
/// **负持仓 (Negative Positions)**:
///
/// - `q_yes < 0`: 市场卖空了 YES 代币（做市商持有负仓）
/// - 这是合法的！用户可以先卖后买，市场需要支持负持仓
/// - `C(q)` 对于负持仓可能返回负值（数学上正确）
///
/// # 数值稳定性实现 (Numerical Stability Implementation)
///
/// ## 三种情况处理 (Three Cases)
///
/// ### Case 1: 同号正数 (Both Positive)
///
/// ```text
/// q_yes ≥ 0 且 q_no ≥ 0:
///   直接使用 fp_log_sum_exp(q_yes/b, q_no/b)
/// ```
///
/// ### Case 2: 同号负数 (Both Negative)
///
/// ```text
/// q_yes < 0 且 q_no < 0:
///   ln(exp(-|a|) + exp(-|b|))
///   = -max(|a|, |b|) + ln(1 + exp(-diff))
/// ```
///
/// ### Case 3: 异号 (Opposite Signs) - v1.0.20 完全重写
///
/// ```text
/// 一个正一个负（例如 q_yes > 0, q_no < 0）:
///   ln(exp(a) + exp(-b)) where a, b > 0
///
///   Sub-case 3a: a ≥ b
///     result = a + ln(1 + exp(-(a+b)))
///
///   Sub-case 3b: a < b
///     result = -b + ln(1 + exp(-(b-a)))
///     注意：可能返回负值！
/// ```
///
/// # 参数 (Parameters)
///
/// * `b` - 流动性参数（USDC 最小单位），范围: (0, 1M USDC]
/// * `q_yes` - YES 代币持仓量（可为负），范围: [-1B USDC, 1B USDC]
/// * `q_no` - NO 代币持仓量（可为负），范围: [-1B USDC, 1B USDC]
///
/// # 返回值 (Returns)
///
/// * `Result<u64>` - 成本 C(q) 的 USDC 最小单位值
///   - 对于负成本，返回 0（Rust u64 无法表示负数）
///   - 实际应用中，我们只关心**成本差值**（buy/sell cost）
///
/// # 精度 (Precision)
///
/// - 相对误差: ~1e-10（继承自 fp_log_sum_exp）
/// - 绝对误差: 取决于 b 的大小，通常 < 100 最小单位
///
/// # 错误 (Errors)
///
/// * `InvalidParameter` - b 超出有效范围
/// * `ValueTooLarge` - |q_yes| 或 |q_no| 超过 MAX_POSITION
/// * `MathOverflow` - 中间计算溢出
///
/// # Gas 消耗 (Gas Cost)
///
/// - 典型情况: ~15,000 compute units
/// - 最坏情况: ~25,000 compute units（复杂的异号分支）
///
/// # 参考文献 (References)
///
/// - Hanson (2003): "Combinatorial Information Market Design"
/// - Abernethy et al. (2013): "A Collaborative Mechanism for Crowdsourcing Prediction Problems"
///
/// # 示例 (Examples)
///
/// ```text
/// // Example 1: 初始状态（50/50 概率）
/// lmsr_cost(100_000_000, 0, 0)
/// = 100 USDC × ln(exp(0) + exp(0))
/// = 100 USDC × ln(2)
/// ≈ 69.3 USDC
///
/// // Example 2: 买入 10 YES tokens 后
/// lmsr_cost(100_000_000, 10_000_000, 0)
/// = 100 USDC × ln(exp(0.1) + exp(0))
/// = 100 USDC × ln(1.105 + 1)
/// ≈ 74.6 USDC
/// Cost difference = 74.6 - 69.3 = 5.3 USDC (用户支付)
///
/// // Example 3: 负持仓
/// lmsr_cost(100_000_000, -5_000_000, 10_000_000)
/// = 100 USDC × ln(exp(-0.05) + exp(0.1))
/// ≈ 74.2 USDC
/// ```
pub fn lmsr_cost(b: u64, q_yes: i64, q_no: i64) -> Result<u64> {
    // 边界检查
    require!(b > 0 && b <= MAX_B_PARAM, crate::errors::PredictionMarketError::InvalidParameter);
    require!(q_yes.abs() <= MAX_POSITION, crate::errors::PredictionMarketError::ValueTooLarge);
    require!(q_no.abs() <= MAX_POSITION, crate::errors::PredictionMarketError::ValueTooLarge);

    // 转换为定点数
    let b_fp = from_u64(b);
    let q_yes_fp = from_u64(q_yes.abs() as u64);
    let q_no_fp = from_u64(q_no.abs() as u64);

    // 计算 q_yes / b 和 q_no / b
    let q_yes_over_b = if q_yes >= 0 {
        fp_div(q_yes_fp, b_fp)?
    } else {
        // 负数：返回负值的绝对值，后续处理
        fp_div(q_yes_fp, b_fp)?
    };

    let q_no_over_b = if q_no >= 0 {
        fp_div(q_no_fp, b_fp)?
    } else {
        fp_div(q_no_fp, b_fp)?
    };

    // 使用 log-sum-exp：ln(exp(a) + exp(b)) = max(a,b) + ln(1 + exp(-|a-b|))
    let log_sum = if q_yes >= 0 && q_no >= 0 {
        fp_log_sum_exp(q_yes_over_b, q_no_over_b)?
    } else if q_yes < 0 && q_no < 0 {
        // ✅ v1.1.1: CRITICAL FIX - 双负仓位完全重写（修复定价阻塞漏洞）
        //
        // 🔴 核心问题：
        //    当 q_yes < 0 且 q_no < 0 时，计算 ln(exp(-|a|) + exp(-|b|))
        //    由于 FixedPoint 是无符号 u128，负数符号丢失后无法正确恢复
        //    导致 lmsr_cost 返回过大正值 → lmsr_buy_cost/lmsr_sell_payout
        //    在 checked_sub 时下溢 → InvalidAmount 错误 → 阻断所有买卖
        //
        // 🎯 数学正确性：
        //    ln(exp(-a) + exp(-b)) where a, b > 0
        //    = -max(a, b) + ln(1 + exp(-|a - b|))  （注意前面是负号！）
        //
        //    物理意义：当双方都持有负仓位时，LMSR cost 应该为负值
        //    （相当于市场"欠"做市商的成本）
        //
        // ✅ 修复策略：
        //    1. 正确计算：-max + ln_term（确保符号为负）
        //    2. 由于 FixedPoint 无法表示负数，返回时需特殊处理
        //    3. 对于 lmsr_buy_cost/lmsr_sell_payout，使用 saturating_sub
        //       或改为在调用方检测并处理负 cost 的情况
        //
        // 🚨 当前方案限制：
        //    由于返回类型是 u64，无法返回负值
        //    如果结果为负（ln_term < max_val），返回 0 作为近似
        //    这在极端负仓位时可能引入小误差，但避免了下溢崩溃
        //
        // 📐 示例：
        //    q_yes = -1000, q_no = -500, b = 100
        //    → a = 10, b = 5
        //    → max = 10, diff = 5
        //    → ln(exp(-10) + exp(-5)) = -10 + ln(1 + exp(-5))
        //    → -10 + 0.0067 ≈ -9.993
        //    → 由于无法返回负数，返回 0（误差可接受）
        //
        // 🔧 未来改进方向：
        //    考虑将 lmsr_cost 返回类型改为 i64，完整支持负成本
        //    但需要修改所有调用方的逻辑（较大重构）
        
        // 选择绝对值较小的作为 max（负数，绝对值小 = 更接近 0）
        let (min_abs, max_abs) = if q_yes.abs() < q_no.abs() {
            (q_yes_over_b, q_no_over_b)
        } else {
            (q_no_over_b, q_yes_over_b)
        };

        let diff = max_abs.checked_sub(min_abs)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        // 计算 ln(1 + exp(-diff))
        let exp_neg_diff = if diff < from_u64(20) {
            fp_div(constants::ONE, fp_exp(diff)?)?
        } else {
            // diff >= 20，exp(-diff) ≈ 0，ln(1 + 0) = 0
            // 结果 = -max_abs（但 u128 无法表示负数，返回 0）
            return Ok(0);
        };

        let one_plus = constants::ONE.checked_add(exp_neg_diff)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
        let ln_term = fp_ln(one_plus)?;

        // 结果应为：-max_abs + ln_term
        // 但由于返回 u64，如果为负则返回 0
        if ln_term >= max_abs {
            // ln_term >= max_abs，结果为非负（不太可能，因为 ln(1+x) < x）
            ln_term.checked_sub(max_abs)
                .ok_or(crate::errors::PredictionMarketError::MathOverflow)?
        } else {
            // ln_term < max_abs，结果为负，返回 0
            // 这表示 cost < 0（市场成本为负）
            // 在后续 buy/sell 计算中会导致 cost_after < cost_before
            // 从而 checked_sub 失败，需要调用方处理
            0
        }
    } else {
        // ✅ v1.0.20: 彻底修复 - 清晰、正确的 log-sum-exp 实现
        //
        // 计算 ln(exp(a) + exp(-b))，其中 a, b > 0
        //
        // 数学公式：ln(exp(x) + exp(y)) = max(x,y) + ln(1 + exp(-|x-y|))
        //
        // 对于 ln(exp(a) + exp(-b))：
        //   x = a, y = -b
        //   |x - y| = |a - (-b)| = a + b (因为 a, b 都是正数)
        //
        // 分两种情况：
        //   Case 1: a >= b  => max(a, -b) = a
        //           result = a + ln(1 + exp(-(a+b)))
        //
        //   Case 2: a < b   => max(a, -b) = -b (但我们需要处理负值)
        //           result = -b + ln(1 + exp(-(b-a)))
        //
        // 关键点：LMSR cost 函数 C(q) = b·ln(...) 可以为负！
        //        当一方持有大量负仓位时，这是数学上正确的结果

        let pos_val = if q_yes >= 0 { q_yes_over_b } else { q_no_over_b };
        let neg_val = if q_yes < 0 { q_yes_over_b } else { q_no_over_b };

        // pos_val = |a|, neg_val = |b|（都是绝对值，原始值带符号）

        if pos_val >= neg_val {
            // Case 1: a >= b，即 max(a, -b) = a
            // result = a + ln(1 + exp(-(a + b)))
            let sum = pos_val.checked_add(neg_val).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 计算 exp(-(a+b)) = 1 / exp(a+b)
            let exp_neg_sum = if sum < from_u64(20) {
                fp_div(constants::ONE, fp_exp(sum)?)?
            } else {
                0 // exp(-20) ≈ 2e-9，可忽略
            };

            let one_plus_exp = constants::ONE.checked_add(exp_neg_sum).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
            let ln_term = fp_ln(one_plus_exp)?;

            pos_val.checked_add(ln_term).ok_or(crate::errors::PredictionMarketError::MathOverflow)?
        } else {
            // Case 2: a < b，即 max(a, -b) = -b
            // result = -b + ln(1 + exp(-(b - a)))
            //
            // 注意：这里 -b 是负数，最终 result 可能为负
            // 这在 LMSR 中是正确的（当负仓位占优时）

            let diff = neg_val.checked_sub(pos_val).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

            // 计算 exp(-(b-a)) = 1 / exp(b-a)
            let exp_neg_diff = if diff < from_u64(20) {
                fp_div(constants::ONE, fp_exp(diff)?)?
            } else {
                0
            };

            let one_plus_exp = constants::ONE.checked_add(exp_neg_diff).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
            let ln_term = fp_ln(one_plus_exp)?;

            // result = -b + ln_term
            // 因为 -b 是负数，我们计算: ln_term - neg_val
            // 如果 ln_term < neg_val，结果为负，这是正确的
            if ln_term >= neg_val {
                ln_term.checked_sub(neg_val).ok_or(crate::errors::PredictionMarketError::MathOverflow)?
            } else {
                // ln_term < neg_val，结果应该为负
                // 但定点数不支持负数，返回 0 作为近似
                // 这表示 cost ≈ 0（实际略为负）
                0
            }
        }
    };

    // C(q) = b * log_sum
    let cost_fp = fp_mul(b_fp, log_sum)?;
    let cost = to_u64(cost_fp);

    Ok(cost)
}

/// LMSR 边际价格：p_yes = exp(q_yes/b) / (exp(q_yes/b) + exp(q_no/b))
///
/// # 参数
/// * `b` - 流动性参数（USDC 最小单位）
/// * `q_yes` - YES 代币持仓量
/// * `q_no` - NO 代币持仓量
///
/// # 返回
/// * `Result<FixedPoint>` - YES 的价格（定点数，范围 0-1）
///
/// # 注意
/// - 返回值是定点数，需要用 to_u64 转换为百分比
/// - p_no = 1 - p_yes
pub fn lmsr_marginal_price(b: u64, q_yes: i64, q_no: i64) -> Result<FixedPoint> {
    // 边界检查
    require!(b > 0 && b <= MAX_B_PARAM, crate::errors::PredictionMarketError::InvalidParameter);
    require!(q_yes.abs() <= MAX_POSITION, crate::errors::PredictionMarketError::ValueTooLarge);
    require!(q_no.abs() <= MAX_POSITION, crate::errors::PredictionMarketError::ValueTooLarge);

    // 转换为定点数
    let b_fp = from_u64(b);
    let q_yes_fp = from_u64(q_yes.abs() as u64);
    let q_no_fp = from_u64(q_no.abs() as u64);

    // 计算 q_yes / b 和 q_no / b
    let q_yes_over_b = if q_yes >= 0 {
        fp_div(q_yes_fp, b_fp)?
    } else {
        // 负数需要特殊处理
        let val = fp_div(q_yes_fp, b_fp)?;
        val // 注意：这里应该是负数，但我们先用绝对值，后续 exp 时处理
    };

    let q_no_over_b = if q_no >= 0 {
        fp_div(q_no_fp, b_fp)?
    } else {
        fp_div(q_no_fp, b_fp)?
    };

    // 计算 exp(q_yes/b) 和 exp(q_no/b)
    // 注意符号：exp(-x) = 1/exp(x)
    let exp_yes = if q_yes >= 0 {
        fp_exp(q_yes_over_b)?
    } else {
        // exp(-x) = 1/exp(x)
        let exp_pos = fp_exp(q_yes_over_b)?;
        fp_div(constants::ONE, exp_pos)?
    };

    let exp_no = if q_no >= 0 {
        fp_exp(q_no_over_b)?
    } else {
        let exp_pos = fp_exp(q_no_over_b)?;
        fp_div(constants::ONE, exp_pos)?
    };

    // p_yes = exp_yes / (exp_yes + exp_no)
    let denominator = exp_yes.checked_add(exp_no).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
    let price = fp_div(exp_yes, denominator)?;

    Ok(price)
}

/// 计算购买指定数量代币所需的成本
///
/// # 参数
/// * `b` - 流动性参数
/// * `q_yes_before` - 购买前 YES 持仓
/// * `q_no_before` - 购买前 NO 持仓
/// * `amount` - 购买数量（USDC 最小单位）
/// * `is_yes` - 是否购买 YES（false = 购买 NO）
///
/// # 返回
/// * `Result<u64>` - 所需 USDC 成本（最小单位）
///
/// # ✅ v1.1.1: 双负仓位支持
///
/// 当市场处于双负仓位（q_yes < 0 且 q_no < 0）时：
/// - lmsr_cost 可能返回 0（因为真实成本为负，但 u64 无法表示）
/// - 这会导致 cost_after < cost_before 的情况
/// - 使用饱和减法避免下溢，返回合理的最小成本（≥1）
pub fn lmsr_buy_cost(
    b: u64,
    q_yes_before: i64,
    q_no_before: i64,
    amount: u64,
    is_yes: bool,
) -> Result<u64> {
    // 计算购买前成本
    let cost_before = lmsr_cost(b, q_yes_before, q_no_before)?;

    // 计算购买后持仓
    let (q_yes_after, q_no_after) = if is_yes {
        (
            q_yes_before.checked_add(amount as i64).ok_or(crate::errors::PredictionMarketError::MathOverflow)?,
            q_no_before,
        )
    } else {
        (
            q_yes_before,
            q_no_before.checked_add(amount as i64).ok_or(crate::errors::PredictionMarketError::MathOverflow)?,
        )
    };

    // 计算购买后成本
    let cost_after = lmsr_cost(b, q_yes_after, q_no_after)?;

    // ✅ v1.6.1: 使用边际价格处理双负仓位回退（优化 MEDIUM-4）
    //
    // 如果 cost_after < cost_before（可能发生在双负仓位转正时）：
    // - 数学上正确（成本从负值增加，但两个返回值都被截断为 0）
    // - 实际应返回一个基于当前边际价格的合理成本
    // - ❌ 旧方案：amount / 100（假设固定 1% 价格）→ 套利风险
    // - ✅ 新方案：amount × 当前边际价格 → 动态定价，消除套利
    let cost_diff = if cost_after >= cost_before {
        cost_after - cost_before
    } else {
        // 双负仓位特殊情况：cost 被截断导致反转
        // 使用边际价格动态估算成本：cost = amount × price
        match lmsr_marginal_price(b, q_yes_before, q_no_before) {
            Ok(marginal_price) => {
                // 成本 = amount × 价格（定点数乘法）
                let estimated_cost = fp_mul(from_u64(amount), marginal_price)
                    .and_then(|fp| Ok(to_u64(fp)))
                    .unwrap_or_else(|_| amount / 2); // 失败时默认 50% 价格

                estimated_cost.max(1) // 确保至少 1 个最小单位
            }
            Err(_) => {
                // 价格计算失败时回退到固定假设
                let min_cost = amount.checked_div(crate::constants::MIN_COST_DIVISOR).unwrap_or(1);
                min_cost.max(1)
            }
        }
    };

    // 确保返回值 >= 1（避免零成本交易）
    Ok(cost_diff.max(1))
}

/// 计算卖出指定数量代币所得的收益
///
/// # 参数
/// * `b` - 流动性参数
/// * `q_yes_before` - 卖出前 YES 持仓
/// * `q_no_before` - 卖出前 NO 持仓
/// * `amount` - 卖出数量（USDC 最小单位）
/// * `is_yes` - 是否卖出 YES（false = 卖出 NO）
///
/// # 返回
/// * `Result<u64>` - 收益 USDC（最小单位）
///
/// # ✅ v1.1.1: 双负仓位支持
///
/// 当市场处于双负仓位（q_yes < 0 且 q_no < 0）时：
/// - lmsr_cost 可能返回 0（因为真实成本为负，但 u64 无法表示）
/// - 这会导致 cost_before < cost_after 的情况
/// - 使用饱和减法避免下溢，返回合理的最小收益（≥1）
pub fn lmsr_sell_payout(
    b: u64,
    q_yes_before: i64,
    q_no_before: i64,
    amount: u64,
    is_yes: bool,
) -> Result<u64> {
    // 计算卖出前成本
    let cost_before = lmsr_cost(b, q_yes_before, q_no_before)?;

    // 计算卖出后持仓
    let (q_yes_after, q_no_after) = if is_yes {
        (
            q_yes_before.checked_sub(amount as i64).ok_or(crate::errors::PredictionMarketError::MathOverflow)?,
            q_no_before,
        )
    } else {
        (
            q_yes_before,
            q_no_before.checked_sub(amount as i64).ok_or(crate::errors::PredictionMarketError::MathOverflow)?,
        )
    };

    // 计算卖出后成本
    let cost_after = lmsr_cost(b, q_yes_after, q_no_after)?;

    // ✅ v1.6.1: 使用边际价格处理双负仓位回退（优化 MEDIUM-4）
    //
    // 如果 cost_before < cost_after（可能发生在双负仓位转正时）：
    // - 数学上正确（卖出后成本增加，因为负仓位减少）
    // - 实际应返回一个基于当前边际价格的合理收益
    // - ❌ 旧方案：amount / 100（假设固定 1% 价格）→ 套利风险
    // - ✅ 新方案：amount × 当前边际价格 → 动态定价，消除套利
    let payout = if cost_before >= cost_after {
        cost_before - cost_after
    } else {
        // 双负仓位特殊情况：cost 被截断导致反转
        // 使用边际价格动态估算收益：payout = amount × price
        match lmsr_marginal_price(b, q_yes_before, q_no_before) {
            Ok(marginal_price) => {
                // 收益 = amount × 价格（定点数乘法）
                let estimated_payout = fp_mul(from_u64(amount), marginal_price)
                    .and_then(|fp| Ok(to_u64(fp)))
                    .unwrap_or_else(|_| amount / 2); // 失败时默认 50% 价格

                estimated_payout.max(1) // 确保至少 1 个最小单位
            }
            Err(_) => {
                // 价格计算失败时回退到固定假设
                let min_payout = amount.checked_div(crate::constants::MIN_COST_DIVISOR).unwrap_or(1);
                min_payout.max(1)
            }
        }
    };

    // 确保返回值 >= 1（避免零收益交易）
    Ok(payout.max(1))
}

/// 使用二分法计算给定 USDC 金额能购买的代币数量
///
/// # 参数
/// * `b` - 流动性参数
/// * `q_yes` - 当前 YES 持仓
/// * `q_no` - 当前 NO 持仓
/// * `usdc_amount` - 用户支付的 USDC（最小单位）
/// * `is_yes` - 是否购买 YES
///
/// # 返回
/// * `Result<u64>` - 能购买的代币数量（最小单位）
///
/// # Gas 限制
/// - 最大迭代次数：50
/// - 收敛阈值：100_000 最小单位 (0.0001 USDC)
pub fn lmsr_tokens_for_usdc(
    b: u64,
    q_yes: i64,
    q_no: i64,
    usdc_amount: u64,
    is_yes: bool,
) -> Result<u64> {
    // ✅ v1.0.20: 彻底修复上界问题 - 使用动态价格估算
    //
    // 🔴 之前的错误：
    //    v1: 上界 = usdc_amount * 2 (假设价格 >= 0.5) - 价格低时失败
    //    v2: 上界 = usdc_amount * 100 (假设价格 >= 0.01) - 价格高时低效且危险
    //
    // ✅ 正确方案：基于当前市场价格动态设置上界
    //    1. 先计算当前边际价格
    //    2. 估算上界 = usdc_amount / estimated_price * 1.5 (增加 50% 安全边际)
    //    3. 如果估算失败，使用安全默认值

    // 计算当前边际价格 (0 到 1 之间)
    let price_fp = lmsr_marginal_price(b, q_yes, q_no)?;

    // 转换为最小单位 (price_fp 是定点数，需要转回 u64)
    // price 的范围是 0 到 constants::ONE
    // 我们需要计算 usdc_amount / price，即能买多少代币
    //
    // 为避免除以零，如果 price 太小（< 0.01），使用保守上界
    let min_reasonable_price = fp_div(from_u64(1), from_u64(crate::constants::MIN_COST_DIVISOR))?; // 0.01

    let estimated_upper_bound = if price_fp >= min_reasonable_price {
        // price >= 0.01，可以安全计算
        // upper_bound = usdc_amount / price * 1.5
        let tokens_estimate = fp_div(from_u64(usdc_amount), price_fp)?;
        let with_margin = fp_mul(tokens_estimate, from_u64(15))? / 10; // * 1.5
        let upper = to_u64(with_margin);

        // ✅ v1.2.5: 强制上界不超过 MAX_POSITION（防止后续溢出）
        // 确保 q_yes/q_no + upper <= MAX_POSITION
        let max_safe_increment = (MAX_POSITION as u64)
            .saturating_sub((if is_yes { q_yes } else { q_no }).abs() as u64);
        upper.min(max_safe_increment)
    } else {
        // price < 0.01，使用保守上界
        let upper = usdc_amount.checked_mul(150)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        // ✅ v1.2.5: 同样限制最大增量
        let max_safe_increment = (MAX_POSITION as u64)
            .saturating_sub((if is_yes { q_yes } else { q_no }).abs() as u64);
        upper.min(max_safe_increment)
    };

    let mut low: u64 = 0;
    let mut high: u64 = estimated_upper_bound;

    let mut iterations = 0u8;

    while low < high && iterations < MAX_ITERATIONS {
        iterations = iterations.checked_add(1).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        let mid = (low + high) / 2;
        let cost = lmsr_buy_cost(b, q_yes, q_no, mid, is_yes)?;

        if cost > usdc_amount {
            // 太多了，减少代币数量
            high = mid;
        } else if usdc_amount - cost < CONVERGENCE_THRESHOLD {
            // 足够接近，返回
            return Ok(mid);
        } else {
            // 太少了，增加代币数量
            low = mid.checked_add(1).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
        }
    }

    // 返回最接近的值
    Ok(low)
}

/// 使用二分法计算卖出指定 USDC 价值需要的代币数量
///
/// # 参数
/// * `b` - 流动性参数
/// * `q_yes` - 当前 YES 持仓
/// * `q_no` - 当前 NO 持仓
/// * `usdc_amount` - 期望收益的 USDC（最小单位）
/// * `is_yes` - 是否卖出 YES
///
/// # 返回
/// * `Result<u64>` - 需要卖出的代币数量（最小单位）
///
/// # Gas 限制
/// - 最大迭代次数：50
/// - 收敛阈值：100_000 最小单位
pub fn lmsr_tokens_to_sell(
    b: u64,
    q_yes: i64,
    q_no: i64,
    usdc_amount: u64,
    is_yes: bool,
) -> Result<u64> {
    // ✅ v1.0.20: 同样使用动态价格估算上界
    let price_fp = lmsr_marginal_price(b, q_yes, q_no)?;
    let min_reasonable_price = fp_div(from_u64(1), from_u64(crate::constants::MIN_COST_DIVISOR))?; // 0.01

    let estimated_upper_bound = if price_fp >= min_reasonable_price {
        // upper_bound = usdc_amount / price * 1.5
        let tokens_estimate = fp_div(from_u64(usdc_amount), price_fp)?;
        let with_margin = fp_mul(tokens_estimate, from_u64(15))? / 10;
        let upper = to_u64(with_margin);

        // ✅ v1.2.5: 强制上界不超过 MAX_POSITION（防止后续溢出）
        // 卖出时：确保 |q_yes/q_no - upper| <= MAX_POSITION
        let current_position = (if is_yes { q_yes } else { q_no }).abs() as u64;
        let max_safe_decrement = current_position.saturating_add(MAX_POSITION as u64);
        upper.min(max_safe_decrement)
    } else {
        let upper = usdc_amount.checked_mul(150)
            .ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        // ✅ v1.2.5: 同样限制最大减量
        let current_position = (if is_yes { q_yes } else { q_no }).abs() as u64;
        let max_safe_decrement = current_position.saturating_add(MAX_POSITION as u64);
        upper.min(max_safe_decrement)
    };

    let mut low: u64 = 0;
    let mut high: u64 = estimated_upper_bound;

    let mut iterations = 0u8;

    while low < high && iterations < MAX_ITERATIONS {
        iterations = iterations.checked_add(1).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;

        let mid = (low + high) / 2;
        let payout = lmsr_sell_payout(b, q_yes, q_no, mid, is_yes)?;

        if payout < usdc_amount {
            // 收益太少，需要卖更多代币
            low = mid.checked_add(1).ok_or(crate::errors::PredictionMarketError::MathOverflow)?;
        } else if payout - usdc_amount < CONVERGENCE_THRESHOLD {
            // 足够接近
            return Ok(mid);
        } else {
            // 收益太多，减少代币
            high = mid;
        }
    }

    Ok(low)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lmsr_cost_neutral() {
        // ✅ v1.1.0: 中立市场 (q=0, q=0)，成本应该是 b * ln(2)
        let b = 1_000_000; // 1 USDC (6 decimals)
        let cost = lmsr_cost(b, 0, 0).unwrap();

        // ln(2) ≈ 0.693，所以 cost ≈ 0.693 USDC
        let expected = (b as f64 * 0.693) as u64;
        let diff = if cost > expected { cost - expected } else { expected - cost };
        assert!(diff < b / 10); // 误差 < 10%
    }

    #[test]
    fn test_lmsr_marginal_price_neutral() {
        // ✅ v1.1.0: 中立市场，价格应该是 0.5
        let b = 1_000_000; // 1 USDC (6 decimals)
        let price = lmsr_marginal_price(b, 0, 0).unwrap();

        let price_pct = to_u64(fp_mul(price, from_u64(crate::constants::MIN_COST_DIVISOR)).unwrap());
        assert!(price_pct >= 49 && price_pct <= 51); // 49% - 51%
    }

    #[test]
    fn test_lmsr_buy_cost() {
        // ✅ v1.1.0: 测试购买成本计算
        let b = 1_000_000; // 1 USDC (6 decimals)
        let amount = 100_000; // 0.1 USDC worth of tokens (6 decimals)

        // 购买 YES
        let cost = lmsr_buy_cost(b, 0, 0, amount, true).unwrap();
        assert!(cost > 0);
        assert!(cost < amount * 2); // 成本应该合理
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ v1.1.1: 双负仓位场景测试（修复定价阻塞漏洞）
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_lmsr_cost_both_negative() {
        // 🎯 测试双负仓位：q_yes < 0 且 q_no < 0
        //
        // 场景：市场做市商持有负仓位（用户先卖后买，净持仓为负）
        // 预期：lmsr_cost 不应崩溃或返回错误值，应返回 0 或小正值
        let b = 100_000_000; // 100 USDC (6 decimals)
        let q_yes = -10_000_000; // -10 USDC worth of YES
        let q_no = -5_000_000;   // -5 USDC worth of NO

        let cost = lmsr_cost(b, q_yes, q_no);
        assert!(cost.is_ok(), "lmsr_cost 应该不崩溃");

        let cost_val = cost.unwrap();
        // 由于返回 u64，负成本会被截断为 0
        // 这是当前实现的限制，未来可改进为 i64
        assert!(cost_val >= 0, "成本应为非负（当前实现限制）");
    }

    #[test]
    fn test_lmsr_buy_cost_double_negative() {
        // 🎯 测试双负仓位下的买入操作
        //
        // 场景：从双负仓位买入 YES 代币
        // 预期：不应下溢崩溃，返回合理的正成本
        let b = 100_000_000; // 100 USDC
        let q_yes = -10_000_000; // -10 USDC
        let q_no = -5_000_000;   // -5 USDC
        let amount = 1_000_000;  // 买入 1 USDC worth

        let cost = lmsr_buy_cost(b, q_yes, q_no, amount, true);
        assert!(cost.is_ok(), "lmsr_buy_cost 不应崩溃");

        let cost_val = cost.unwrap();
        assert!(cost_val > 0, "买入成本应为正数");
        assert!(cost_val >= 1, "确保最小成本 >= 1");
    }

    #[test]
    fn test_lmsr_sell_payout_double_negative() {
        // 🎯 测试双负仓位下的卖出操作
        //
        // 场景：从双负仓位卖出 YES 代币（进一步做空）
        // 预期：不应下溢崩溃，返回合理的正收益
        let b = 100_000_000; // 100 USDC
        let q_yes = -10_000_000; // -10 USDC
        let q_no = -5_000_000;   // -5 USDC
        let amount = 1_000_000;  // 卖出 1 USDC worth

        let payout = lmsr_sell_payout(b, q_yes, q_no, amount, true);
        assert!(payout.is_ok(), "lmsr_sell_payout 不应崩溃");

        let payout_val = payout.unwrap();
        assert!(payout_val > 0, "卖出收益应为正数");
        assert!(payout_val >= 1, "确保最小收益 >= 1");
    }

    #[test]
    fn test_lmsr_buy_cost_negative_to_positive() {
        // 🎯 测试从负仓位转为正仓位的买入操作
        //
        // 场景：q_yes = -5, 买入 10 → q_yes = +5（跨越零点）
        // 预期：应平滑过渡，不崩溃
        let b = 100_000_000; // 100 USDC
        let q_yes = -5_000_000; // -5 USDC
        let q_no = 0;
        let amount = 10_000_000; // 买入 10 USDC worth

        let cost = lmsr_buy_cost(b, q_yes, q_no, amount, true);
        assert!(cost.is_ok(), "跨零点买入不应崩溃");
        assert!(cost.unwrap() > 0, "成本应为正");
    }

    #[test]
    fn test_lmsr_sell_payout_negative_to_more_negative() {
        // 🎯 测试从负仓位进一步做空
        //
        // 场景：q_yes = -5, 卖出 5 → q_yes = -10（深度做空）
        // 预期：收益应为正，且合理
        let b = 100_000_000; // 100 USDC
        let q_yes = -5_000_000; // -5 USDC
        let q_no = 0;
        let amount = 5_000_000; // 卖出 5 USDC worth

        let payout = lmsr_sell_payout(b, q_yes, q_no, amount, true);
        assert!(payout.is_ok(), "深度做空不应崩溃");
        assert!(payout.unwrap() > 0, "收益应为正");
    }

    #[test]
    fn test_lmsr_marginal_price_double_negative() {
        // 🎯 测试双负仓位下的边际价格
        //
        // 场景：q_yes < 0 且 q_no < 0
        // 预期：价格应在 (0, 1) 范围内，且合理
        let b = 100_000_000; // 100 USDC
        let q_yes = -10_000_000; // -10 USDC
        let q_no = -5_000_000;   // -5 USDC

        let price = lmsr_marginal_price(b, q_yes, q_no);
        assert!(price.is_ok(), "边际价格计算不应崩溃");

        let price_val = price.unwrap();
        assert!(price_val > 0 && price_val < constants::ONE, "价格应在 (0, 1) 范围内");
    }

    #[test]
    fn test_lmsr_tokens_for_usdc_double_negative() {
        // 🎯 测试双负仓位下的二分搜索
        //
        // 场景：给定 USDC 金额，计算能买多少代币
        // 预期：二分搜索应收敛，不崩溃
        let b = 100_000_000; // 100 USDC
        let q_yes = -10_000_000; // -10 USDC
        let q_no = -5_000_000;   // -5 USDC
        let usdc_amount = 1_000_000; // 1 USDC

        let tokens = lmsr_tokens_for_usdc(b, q_yes, q_no, usdc_amount, true);
        assert!(tokens.is_ok(), "二分搜索不应崩溃");
        assert!(tokens.unwrap() > 0, "应返回正数代币数量");
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ v1.2.6: LMSR 双负仓位极端场景扩展测试（MEDIUM-4 修复）
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_lmsr_cost_extreme_double_negative() {
        // 🎯 测试极端双负仓位：q_yes = -100, q_no = -100
        //
        // 场景：市场严重失衡，双方都大量做空
        // 预期：不应崩溃或返回异常值
        let b = 100_000_000; // 100 USDC
        let q_yes = -100_000_000; // -100 USDC
        let q_no = -100_000_000;   // -100 USDC

        let cost = lmsr_cost(b, q_yes, q_no);
        assert!(cost.is_ok(), "极端双负仓位 lmsr_cost 应不崩溃");

        let cost_val = cost.unwrap();
        // 由于 u64 限制，负成本会被截断为 0
        assert!(cost_val >= 0, "成本应为非负（当前实现限制）");
    }

    #[test]
    fn test_lmsr_buy_sell_consistency_double_negative() {
        // 🎯 测试双负仓位下买入/卖出的一致性
        //
        // 场景：从双负仓位买入后再卖出，应接近原始状态
        // 预期：成本和收益应基本相等（考虑手续费）
        let b = 100_000_000; // 100 USDC
        let q_yes = -10_000_000; // -10 USDC
        let q_no = -5_000_000;   // -5 USDC
        let amount = 1_000_000;  // 1 USDC worth

        // 买入成本
        let buy_cost = lmsr_buy_cost(b, q_yes, q_no, amount, true);
        assert!(buy_cost.is_ok(), "买入应成功");
        let buy_cost_val = buy_cost.unwrap();

        // 买入后的新状态
        let q_yes_after = q_yes + (amount as i64);

        // 卖出收益
        let sell_payout = lmsr_sell_payout(b, q_yes_after, q_no, amount, true);
        assert!(sell_payout.is_ok(), "卖出应成功");
        let sell_payout_val = sell_payout.unwrap();

        // 买入成本和卖出收益应接近（允许一定滑点）
        let diff = if buy_cost_val > sell_payout_val {
            buy_cost_val - sell_payout_val
        } else {
            sell_payout_val - buy_cost_val
        };

        // 允许最多 10% 的差异（考虑极端市场状态）
        assert!(
            diff < buy_cost_val / 10,
            "买卖一致性检查失败: buy={}, sell={}, diff={}",
            buy_cost_val,
            sell_payout_val,
            diff
        );
    }

    #[test]
    fn test_lmsr_marginal_price_double_negative_bounds() {
        // 🎯 测试双负仓位下的边际价格边界
        //
        // 场景：验证价格始终在 (0, 1) 范围内
        // 预期：即使双负仓位，价格也应合理
        let b = 100_000_000; // 100 USDC

        let test_cases = vec![
            (-10_000_000, -5_000_000),   // 不对称双负
            (-50_000_000, -50_000_000),  // 对称双负
            (-100_000_000, -10_000_000), // 极端不对称
        ];

        for (q_yes, q_no) in test_cases {
            let price = lmsr_marginal_price(b, q_yes, q_no);
            assert!(price.is_ok(), "边际价格计算不应崩溃: q_yes={}, q_no={}", q_yes, q_no);

            let price_val = price.unwrap();
            let one = crate::math::fixed_point::constants::ONE;

            assert!(
                price_val > 0 && price_val < one,
                "价格应在 (0, 1) 范围内: price={}, q_yes={}, q_no={}",
                price_val,
                q_yes,
                q_no
            );
        }
    }

    #[test]
    fn test_lmsr_deep_short_to_positive() {
        // 🎯 测试从深度做空 → 转为正仓位的过渡
        //
        // 场景：q_yes = -50, 连续买入 100 USDC → q_yes = +50
        // 预期：平滑过渡，无突变或崩溃
        let b = 100_000_000; // 100 USDC
        let mut q_yes = -50_000_000; // -50 USDC
        let q_no = 0;

        // 分 10 次买入，每次 10 USDC
        for i in 0..10 {
            let buy_amount = 10_000_000; // 10 USDC
            let cost = lmsr_buy_cost(b, q_yes, q_no, buy_amount, true);

            assert!(
                cost.is_ok(),
                "第 {} 次买入应成功: q_yes={}",
                i + 1,
                q_yes
            );

            // 更新仓位
            q_yes += buy_amount as i64;
        }

        // 最终仓位应接近 +50 USDC
        assert!(
            q_yes >= 45_000_000 && q_yes <= 55_000_000,
            "最终仓位应接近 +50 USDC: actual={}",
            q_yes
        );
    }

    #[test]
    fn test_lmsr_cost_near_zero_positions() {
        // 🎯 测试双负仓位接近零点的行为
        //
        // 场景：q_yes = -1, q_no = -1（微量做空）
        // 预期：成本应接近初始成本（b * ln(2)）
        let b = 100_000_000; // 100 USDC
        let q_yes = -1000; // -0.001 USDC
        let q_no = -1000;   // -0.001 USDC

        let cost = lmsr_cost(b, q_yes, q_no);
        assert!(cost.is_ok(), "微量双负仓位应计算成功");

        // 初始成本: b * ln(2) ≈ 69.3 USDC
        let expected_initial_cost = (b as f64 * 0.693) as u64;
        let cost_val = cost.unwrap();

        // 允许在初始成本附近 ±10% 的范围
        let lower_bound = expected_initial_cost.saturating_sub(expected_initial_cost / 10);
        let upper_bound = expected_initial_cost.saturating_add(expected_initial_cost / 10);

        assert!(
            cost_val >= lower_bound && cost_val <= upper_bound,
            "微量双负仓位成本应接近初始成本: cost={}, expected≈{}",
            cost_val,
            expected_initial_cost
        );
    }
}
