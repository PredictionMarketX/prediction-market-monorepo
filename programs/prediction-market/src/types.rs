//! # 类型定义模块
//!
//! 定义合约中使用的枚举类型和常用结构
//! 用于替代魔法数字，提高代码可读性和类型安全

use anchor_lang::prelude::*;
// 解决 Anchor 派生宏中 `borsh` 名称解析歧义：统一使用 Anchor 预导出的 borsh
use anchor_lang::prelude::borsh;

/// 交易方向枚举
///
/// 用于 swap 指令，明确表示买入或卖出操作
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TradeDirection {
    /// 买入代币（用USDC购买YES或NO）
    Buy = 0,
    /// 卖出代币（将YES或NO换回USDC）
    Sell = 1,
}

impl TradeDirection {
    /// 从 u8 转换为 TradeDirection
    ///
    /// # 参数
    /// * `value` - u8 值（0=Buy, 1=Sell）
    ///
    /// # 返回
    /// * `Option<Self>` - 转换成功返回Some，失败返回None
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(TradeDirection::Buy),
            1 => Some(TradeDirection::Sell),
            _ => None,
        }
    }

    /// 转换为 u8
    pub fn to_u8(self) -> u8 {
        self as u8
    }

    /// 判断是否为买入
    pub fn is_buy(self) -> bool {
        matches!(self, TradeDirection::Buy)
    }

    /// 判断是否为卖出
    pub fn is_sell(self) -> bool {
        matches!(self, TradeDirection::Sell)
    }
}

/// 代币类型枚举
///
/// 用于区分 YES 和 NO 代币
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenType {
    /// NO 代币（表示"不同意"）
    No = 0,
    /// YES 代币（表示"同意"）
    Yes = 1,
}

impl TokenType {
    /// 从 u8 转换为 TokenType
    ///
    /// # 参数
    /// * `value` - u8 值（0=No, 1=Yes）
    ///
    /// # 返回
    /// * `Option<Self>` - 转换成功返回Some，失败返回None
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(TokenType::No),
            1 => Some(TokenType::Yes),
            _ => None,
        }
    }

    /// 转换为 u8
    pub fn to_u8(self) -> u8 {
        self as u8
    }

    /// 判断是否为 YES 代币
    pub fn is_yes(self) -> bool {
        matches!(self, TokenType::Yes)
    }

    /// 判断是否为 NO 代币
    pub fn is_no(self) -> bool {
        matches!(self, TokenType::No)
    }
}

/// 市场结算结果枚举
///
/// 用于 resolution 指令，表示市场最终结果
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketOutcome {
    /// NO 方获胜（100% NO, 0% YES）
    NoWins = 0,
    /// YES 方获胜（0% NO, 100% YES）
    YesWins = 1,
    /// 平局（50% NO, 50% YES）
    Draw = 2,
}

impl MarketOutcome {
    /// 从 u8 转换为 MarketOutcome
    ///
    /// # 参数
    /// * `value` - u8 值（0=NoWins, 1=YesWins, 2=Draw）
    ///
    /// # 返回
    /// * `Option<Self>` - 转换成功返回Some，失败返回None
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(MarketOutcome::NoWins),
            1 => Some(MarketOutcome::YesWins),
            2 => Some(MarketOutcome::Draw),
            _ => None,
        }
    }

    /// 转换为 u8
    pub fn to_u8(self) -> u8 {
        self as u8
    }

    /// 获取 YES 代币赎回比例（基点）
    ///
    /// # 返回
    /// * `u64` - YES 代币赎回比例（10000 = 100%）
    pub fn yes_ratio(self) -> u64 {
        match self {
            MarketOutcome::NoWins => 0,
            MarketOutcome::YesWins => crate::constants::BASIS_POINTS_DIVISOR,
            MarketOutcome::Draw => crate::constants::BASIS_POINTS_DIVISOR / 2,
        }
    }

    /// 获取 NO 代币赎回比例（基点）
    ///
    /// # 返回
    /// * `u64` - NO 代币赎回比例（10000 = 100%）
    pub fn no_ratio(self) -> u64 {
        match self {
            MarketOutcome::NoWins => crate::constants::BASIS_POINTS_DIVISOR,
            MarketOutcome::YesWins => 0,
            MarketOutcome::Draw => crate::constants::BASIS_POINTS_DIVISOR / 2,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trade_direction_conversion() {
        assert_eq!(TradeDirection::from_u8(0), Some(TradeDirection::Buy));
        assert_eq!(TradeDirection::from_u8(1), Some(TradeDirection::Sell));
        assert_eq!(TradeDirection::from_u8(2), None);

        assert_eq!(TradeDirection::Buy.to_u8(), 0);
        assert_eq!(TradeDirection::Sell.to_u8(), 1);
    }

    #[test]
    fn test_token_type_conversion() {
        assert_eq!(TokenType::from_u8(0), Some(TokenType::No));
        assert_eq!(TokenType::from_u8(1), Some(TokenType::Yes));
        assert_eq!(TokenType::from_u8(2), None);

        assert_eq!(TokenType::No.to_u8(), 0);
        assert_eq!(TokenType::Yes.to_u8(), 1);
    }

    #[test]
    fn test_market_outcome_ratios() {
        assert_eq!(MarketOutcome::NoWins.yes_ratio(), 0);
        assert_eq!(MarketOutcome::NoWins.no_ratio(), 10000);

        assert_eq!(MarketOutcome::YesWins.yes_ratio(), 10000);
        assert_eq!(MarketOutcome::YesWins.no_ratio(), 0);

        assert_eq!(MarketOutcome::Draw.yes_ratio(), 5000);
        assert_eq!(MarketOutcome::Draw.no_ratio(), 5000);
    }
}
