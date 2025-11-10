//! # 数学库模块
//!
//! 包含定点数运算和 LMSR 实现

pub mod calculator;    // 🆕 高层类型安全封装
pub mod fixed_point;
pub mod lmsr;
pub mod safe_cast;     // 🆕 安全类型转换

pub use calculator::*;
pub use fixed_point::*;
pub use lmsr::*;
pub use safe_cast::*;
