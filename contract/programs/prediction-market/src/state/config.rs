//! # 配置状态模块
//! 
//! 定义预测市场合约的全局配置结构
//! 包括管理员权限、手续费设置、代币配置等

use crate::errors::*;
use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize};
// 解决 derive(AnchorSerialize/Deserialize) 中 `borsh` 名称解析歧义：
// 显式使用 Anchor 预导出的 borsh 版本，避免与测试环境的 --extern 冲突
use anchor_lang::prelude::borsh;
use core::fmt::Debug;

/// 全局配置账户
/// 
/// 存储预测市场合约的全局配置参数
/// 包括管理员权限、手续费设置、代币配置等
#[account]
#[derive(Debug)]
pub struct Config {
    /// 当前管理员公钥
    pub authority: Pubkey,
    
    /// 待确认的管理员公钥（用于两步权限转移）
    /// 当前管理员提名新管理员后，新管理员需要调用accept_authority来确认
    pub pending_authority: Pubkey,

    /// 团队钱包地址
    /// 用于接收平台手续费
    pub team_wallet: Pubkey,

    /// 平台买入手续费（基点，如1000表示10%）
    pub platform_buy_fee: u64,
    
    /// 平台卖出手续费（基点，如1000表示10%）
    pub platform_sell_fee: u64,

    /// 流动性提供者买入手续费（基点）
    pub lp_buy_fee: u64,
    
    /// 流动性提供者卖出手续费（基点）
    pub lp_sell_fee: u64,

    /// ⚠️ 已废弃：代币总供应量配置（v1.1.0+）
    ///
    /// **废弃原因**：
    /// - 预测市场采用动态铸造模型，无固定总供应量上限
    /// - YES/NO 代币通过 mint_complete_set 按需铸造，通过 redeem_complete_set 销毁
    /// - 代币供应量由市场需求决定，不需要预设上限
    ///
    /// **历史背景**：
    /// - 此字段原本用于 bonding curve 固定供应量模型
    /// - 预测市场模型不适用固定供应量约束
    ///
    /// **当前状态**：
    /// - 此字段未在任何指令中使用
    /// - 保留以维持账户结构兼容性
    /// - 部署时应设置为 0 以明确表示未启用
    ///
    /// **未来计划**：
    /// - v2.0 可考虑移除（需要账户迁移）
    /// - 或者用于限制单个市场的最大代币铸造量（需要实现额度校验）
    ///
    /// 默认值: 0 (未启用)
    pub token_supply_config: u64,
    
    /// 代币精度配置
    /// ✅ v1.1.0: 强制要求为 6（USDC decimals）
    /// 在 configure 指令中验证 token_decimals_config == 6
    pub token_decimals_config: u8,

    /// 初始真实代币储备配置
    pub initial_real_token_reserves_config: u64,

    /// ⚠️ 已废弃：最小流动性要求（保留以兼容旧版本）
    /// 实际使用 min_usdc_liquidity 和 min_trading_liquidity
    pub min_sol_liquidity: u64,

    /// ✅ 最小交易流动性要求（已启用）
    ///
    /// **用途**: 限制 swap 操作的最小池子流动性，防止池子过度枯竭
    /// **实现**: 在 swap 指令中强制校验 pool_collateral_reserve >= min_trading_liquidity
    /// **默认值**: 1000 USDC（1000 * 10^6 = 1,000,000,000 最小单位）
    ///
    /// **实现位置**:
    /// - `contract/programs/prediction-market/src/instructions/market/swap.rs`
    /// - 在交易前进行流动性枯竭检查
    ///
    /// **历史**: v2.2 更新注释以反映实际实现状态
    pub min_trading_liquidity: u64,

    /// 配置是否已初始化
    pub initialized: bool,

    /// ✅ 紧急暂停开关
    pub is_paused: bool,

    /// ✅ 白名单开关（true=强制创建者需白名单）
    pub whitelist_enabled: bool,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v1.1.0: USDC 迁移相关字段
    // ═══════════════════════════════════════════════════════════════

    /// USDC Token Mint 地址
    /// 用于验证所有 USDC 操作使用正确的 USDC mint
    pub usdc_mint: Pubkey,

    /// USDC 金库最小余额（用于租金豁免保护）
    ///
    /// ⚠️ **重要配置建议** (v1.2.2):
    /// 防止 USDC 金库余额低于租金豁免要求,避免账户被关闭
    ///
    /// **尾款锁定风险**:
    /// - redeem_complete_set 和 withdraw_liquidity 都强制要求操作后余额 ≥ min_balance
    /// - 这意味着每个市场会永久锁定约等于此值的 USDC
    /// - 如果部署时误配过大值,会导致大量资金永久锁定
    ///
    /// **配置建议**:
    /// - 建议值: 2000-5000 USDC 最小单位 (约 0.002-0.005 USDC)
    /// - 参考 Solana 租金豁免要求: ~0.001 SOL ≈ $0.1
    /// - 过小: 风险账户被关闭
    /// - 过大: 每个市场锁定过多资金
    ///
    /// **清算机制**:
    /// - 当前版本无专门清算路径回收尾款
    /// - 计划在 v2.0 添加管理员清算功能
    /// - 部署前务必仔细评估此值
    pub usdc_vault_min_balance: u64,

    /// 最小 USDC 流动性要求（用于 add_liquidity 验证）
    /// 防止添加过少的流动性
    /// 建议值：100 USDC（100 * 10^6）
    pub min_usdc_liquidity: u64,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v1.4.0: LP保险池机制（对齐Polymarket）
    // ═══════════════════════════════════════════════════════════════

    /// LP保险池累计余额（USDC最小单位）
    ///
    /// **资金来源**:
    /// - 平台手续费的一定比例（由 lp_insurance_allocation_bps 控制）
    /// - 例如：platform_buy_fee/sell_fee 总额的 20% 注入保险池
    ///
    /// **用途**:
    /// - 补偿LP在市场结算时的本金损失
    /// - 提高LP信心，降低提供流动性的风险
    ///
    /// **补偿条件**:
    /// - LP撤出流动性时损失超过 insurance_loss_threshold_bps（如10%）
    /// - 自动触发保险池补偿（最多补偿损失的50%）
    ///
    /// **补偿限制**:
    /// - 单次最多补偿损失的 insurance_max_compensation_bps（如50%）
    /// - 补偿总额不超过保险池当前余额
    ///
    /// 默认值: 0 (初始化时设置)
    pub lp_insurance_pool_balance: u64,

    /// 平台费分配给保险池的比例（基点）
    ///
    /// **示例**:
    /// - 2000 bps = 20% → 平台费的20%注入保险池
    /// - 如果某笔交易平台费=100 USDC，则20 USDC进入保险池
    ///
    /// **建议值**:
    /// - 初期（保险池<10万USDC）：2000 bps（20%）
    /// - 稳定期（保险池>50万USDC）：1000 bps（10%）
    ///
    /// **调整策略**:
    /// - 管理员可通过 update_config 动态调整
    /// - 保险池充足时可降低比例，增加团队收入
    ///
    /// 默认值: 2000 (20%)
    pub lp_insurance_allocation_bps: u16,

    /// 触发保险补偿的LP损失阈值（基点）
    ///
    /// **触发条件**:
    /// - LP撤出流动性时，损失率 > 此阈值时触发补偿
    /// - 损失率 = (投入USDC - 取回USDC) / 投入USDC
    ///
    /// **示例**:
    /// - 1000 bps = 10% → 损失超过10%时触发补偿
    /// - LP投入10000 USDC，取回8500 USDC，损失率=15% → 触发补偿
    ///
    /// **平衡考虑**:
    /// - 过低（如5%）：保险池消耗过快，可能枯竭
    /// - 过高（如20%）：仅极端情况补偿，LP保护不足
    ///
    /// 默认值: 1000 (10%)
    pub insurance_loss_threshold_bps: u16,

    /// 保险池最大补偿比例（基点）
    ///
    /// **补偿上限**:
    /// - 最多补偿LP损失的此比例
    /// - 实际补偿 = min(损失 × 此比例, 保险池余额)
    ///
    /// **示例**:
    /// - 5000 bps = 50% → 最多补偿损失的50%
    /// - LP损失1000 USDC，最多补偿500 USDC
    ///
    /// **保险池可持续性**:
    /// - 50%补偿可平衡LP保护与保险池消耗速度
    /// - 避免单个极端市场耗尽整个保险池
    ///
    /// 默认值: 5000 (50%)
    pub insurance_max_compensation_bps: u16,

    // ═══════════════════════════════════════════════════════════════
    // ✅ v3.0: 保险池控制开关
    // ═══════════════════════════════════════════════════════════════

    /// 保险池是否启用
    ///
    /// **用途**:
    /// - 控制保险池功能的全局开关
    /// - 禁用时，所有保险池相关逻辑（注入、补偿）都不执行
    ///
    /// **启用条件**:
    /// - 必须配置 platform_buy_fee > 0 或 platform_sell_fee > 0
    /// - 否则保险池无资金来源，无法运作
    ///
    /// **使用场景**:
    /// - 初期（平台费=0%）：insurance_pool_enabled = false
    /// - 后期（启用平台费）：通过 configure 指令设置为 true
    ///
    /// **验证逻辑**:
    /// - configure 指令中验证：
    ///   if insurance_pool_enabled && platform_buy_fee == 0 && platform_sell_fee == 0 {
    ///       return Err(CannotEnableInsuranceWithoutPlatformFee)
    ///   }
    ///
    /// 默认值: false (禁用)
    pub insurance_pool_enabled: bool,
}

/// 数量配置枚举
/// 
/// 用于验证输入值是否在允许的范围内
/// 支持范围验证和枚举值验证两种模式
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum AmountConfig<T: PartialEq + PartialOrd + Debug> {
    /// 范围验证模式
    /// min: 最小值（可选）
    /// max: 最大值（可选）
    Range { min: Option<T>, max: Option<T> },
    
    /// 枚举值验证模式
    /// 只允许指定的值列表中的值
    Enum(Vec<T>),
}

impl<T: PartialEq + PartialOrd + Debug> AmountConfig<T> {
    /// 验证输入值是否符合配置要求
    /// 
    /// # 参数
    /// * `value` - 要验证的值
    /// 
    /// # 返回
    /// * `Result<()>` - 验证结果，如果不符合要求则返回错误
    pub fn validate(&self, value: &T) -> Result<()> {
        match self {
            Self::Range { min, max } => {
                // 检查最小值限制
                if let Some(min) = min {
                    if value < min {
                        return Err(ValueTooSmall.into());
                    }
                }
                
                // 检查最大值限制
                if let Some(max) = max {
                    if value > max {
                        return Err(ValueTooLarge.into());
                    }
                }

                Ok(())
            }
            Self::Enum(options) => {
                // 检查值是否在允许的枚举列表中
                if options.contains(value) {
                    Ok(())
                } else {
                    Err(ValueInvalid.into())
                }
            }
        }
    }
}
