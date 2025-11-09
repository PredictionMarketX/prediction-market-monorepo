#![allow(ambiguous_glob_reexports)]

pub mod add_liquidity;
pub use add_liquidity::*;

pub mod claim_lp_fees;            // ✅ 新增：LP 费用领取（双账本系统）
pub use claim_lp_fees::*;

pub mod claim_rewards;            // ✅ 新增：领取奖励
pub use claim_rewards::*;

pub mod claim_rewards_preview;    // ✅ v3.1.4: 领取奖励预览（只读）
pub use claim_rewards_preview::*;

pub mod create_market;
pub use create_market::*;

pub mod mint_complete_set;        // ✅ 新增：铸造完整集合
pub use mint_complete_set::*;

pub mod mint_no_token;
pub use mint_no_token::*;

pub mod reclaim_dust;             // ✅ v1.2.2: 回收市场尾款
pub use reclaim_dust::*;

pub mod redeem_complete_set;      // ✅ 新增：赎回完整集合
pub use redeem_complete_set::*;

pub mod reset_circuit_breaker;    // ✅ v3.0: 重置熔断器
pub use reset_circuit_breaker::*;

pub mod resolution;
pub use resolution::*;

pub mod seed_pool;                // ✅ 新增：Pool 初始化（双账本系统）
pub use seed_pool::*;

pub mod set_mint_authority;       // ✅ v3.0: 转移 mint 权限到 market PDA
pub use set_mint_authority::*;

pub mod settle_pool;              // ✅ 新增：Pool 结算（双账本系统）
pub use settle_pool::*;

pub mod swap;
pub use swap::*;

pub mod update_market_name;       // ✅ v1.2.0: 更新市场显示名称
pub use update_market_name::*;

pub mod withdraw_liquidity;
pub use withdraw_liquidity::*;

pub mod withdraw_preview;         // ✅ v3.0: 撤出预览（只读）
pub use withdraw_preview::*;

pub mod sell_preview;             // ✅ v3.1.1: 卖出预览（只读）
pub use sell_preview::*;

pub mod claim_fees_preview;       // ✅ v3.1.1: LP 手续费领取预览（只读）
pub use claim_fees_preview::*;
