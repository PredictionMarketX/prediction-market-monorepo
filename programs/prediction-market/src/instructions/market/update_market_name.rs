//! 市场指令：更新市场显示名称
//! ✅ v1.2.0: 仅创建者可以更新市场显示名称

use crate::{
    constants::{MARKET},
    errors::PredictionMarketError,
    events::UpdateMarketNameEvent,
    state::market::*,
};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

/// 账户集合：更新市场名称所需账户
#[derive(Accounts)]
pub struct UpdateMarketName<'info> {
    /// 市场账户
    #[account(
        mut,
        seeds = [MARKET.as_bytes(), &yes_token.key().to_bytes(), &no_token.key().to_bytes()],
        bump,
        constraint = market.creator == creator.key() @ PredictionMarketError::IncorrectAuthority
    )]
    pub market: Account<'info, Market>,

    /// YES/NO 代币mint（用于验证市场PDA）
    pub yes_token: Account<'info, Mint>,
    pub no_token: Account<'info, Mint>,

    /// 创建者（必须是市场的创建者）
    pub creator: Signer<'info>,
}

impl<'info> UpdateMarketName<'info> {
    /// 处理更新市场名称
    ///
    /// # 参数
    /// * `new_name` - 新的市场显示名称（最大64字符）
    ///
    /// # 返回
    /// * `Result<()>` - 操作结果
    pub fn handler(&mut self, new_name: String) -> Result<()> {
        msg!("UpdateMarketName start: new_name={}", new_name);

        // 验证名称长度
        // 🔒 v1.2.2: 使用 Market::MAX_DISPLAY_NAME_LEN 常量
        require!(
            new_name.len() <= Market::MAX_DISPLAY_NAME_LEN,
            PredictionMarketError::InvalidParameter
        );
        require!(
            !new_name.is_empty(),
            PredictionMarketError::InvalidParameter
        );

        // 更新市场名称
        let old_name = self.market.display_name.clone();
        self.market.display_name = new_name.clone();

        msg!(
            "✅ Market name updated successfully: '{}' -> '{}'",
            old_name,
            new_name
        );

        // ✅ v1.2.2: 发射市场名称更新事件
        let clock = Clock::get()?;
        emit!(UpdateMarketNameEvent {
            creator: self.creator.key(),
            market: self.market.key(),
            old_name,
            new_name,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}
