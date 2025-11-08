# Changelog

集中记录与汇总历史版本的重要变更、修复与里程碑。自本版本起，历史文档合并至此文件，避免分散在多个独立 md 中。

约定
- 版本条目按时间倒序排列。
- 仅记录面向产品/合约行为的关键变化；实现细节请参考对应 PR。

## v4.0（草案）
- Signed-cost RFC 收录与讨论要点（由 docs/v4.0-signed-cost-rfc.md 汇总）。
- 目标：在不破坏现有接口的前提下，提升成本函数签名化与可验证性。

## v3.1
- LMSR 改进提案与滑点分析指引（由 docs/v3.1-lmsr-improvement-proposal.md、docs/v3.1-slippage-analytics-guide.md 汇总）。
- 重点：
  - 定点实现与二分精度的稳定性评估
  - 临近结算期 b 值权重与价格平滑

## v3.0
- 单币 LP（USDC）与四层 LP 保护上线：
  - 单币 LP：LP 仅需 USDC，内部配对铸造/赎回 YES/NO。
  - 四层保护：硬上限（2b 多数方限制）、动态撤出上限（按失衡度 5%-30%）、时间锁早退惩罚（7/14/30 天），熔断器（≥4:1、单边<10%、24h 撤出>50%）。
  - 只读撤出预览：返回预估 USDC、惩罚、可提上限、熔断状态与保险估算。
- 费用与做市：
  - LP 费固定化（透明度提升），平台费按比例拆分至团队与保险池。
  - 最大单笔交易 10%（可根据池深与运营需要再治理化）。
- 铸币权限：
  - 新增 `set_mint_authority`，将 YES/NO mint 权限从 global_vault 转移至 market PDA，单币 LP 前置条件。
- 事件与 Gas：
  - 生产构建默认精简事件与日志；调试下提供丰富指标（含风险指标事件）。

## v3.0.2
- 安全修复、遗留问题与测试总结（由 docs/v3.0.2-security-fixes.md、docs/v3.0.2-remaining-issues.md、docs/v3.0.2-test-summary.md 汇总）。
- 重点：
  - 市场专用 USDC 金库（隔离流动性）
  - 重入防护 RAII 守卫与 CEI 模式
  - 账户/ATA 运行时校验与最小流动性阈值
  - b 值动态权重阶段性修复：将 max_trade_size 检查移入闭包，确保任何失败路径后都会恢复原始 b（避免永久污染）。

## v2.0
- 保险池追踪增强：
  - 全局保险池余额（集中记账）与市场级贡献（分市场限额）双账本，避免跨市场挪用。
- LP 费用分配公平化：
  - 引入累计每份额收益 `fee_per_share_cumulative` 与 LPPosition `last_fee_per_share`，防止抢跑与重复领取。
- 监控与对账：
  - 保留 `VaultBalanceSnapshot`，对账（pool + locked + fees）与金库余额差值监控。
 - 代币统计不变量：明确 `total_*_minted` 仅统计铸造/赎回（含 seed_pool），swap 仅转移不改供应；在结算中引入 `TokenSupplyMismatch` 校验与池内代币销毁逻辑，保障“有抵押品代币”一致性。

## v1.2.7
- 金库架构与监控规范（由 docs/v1.2.7-vault-architecture.md、docs/v1.2.7-vault-monitoring.md 汇总）。
- 重点：
  - 双账本一致性（Settlement/Pool）
  - VaultBalanceSnapshot 与账本对账

## v1.x（关键里程碑汇总）
- v1.6.0
  - 替代魔法数字：TradeDirection/TokenType/MarketOutcome 枚举化，入参与校验一致；Claim/Resolution 流程健壮性增强。
- v1.5.1 / v1.5.0
  - 最大单笔交易上限 10%（BPS）；引入结算期临近动态 b 值权重（72h: 1.5x，7d: 1.2x）。
- v1.4.0
  - 保险池引入：平台费按比例注入保险池；LPPosition 增加 `invested_usdc` 用于亏损率与补偿计算。
- v1.3.0
  - 市场初始概率 `initial_yes_prob` 与创建时间字段，INIT_SPACE 计算修正。
- v1.2.4 ~ v1.2.1
  - 基点常量/精度统一、配置上限校验（vault 最小余额/最小流动性）；start/end slot 合理性检查（未来时间/先后关系）。
- v1.2.3 / v1.2.2
  - RAII 重入锁引入并覆盖关键路径；`global_vault` 所有权与 USDC decimals=6 运行时校验；Resolution 清算 PDA 代币、同步 Pool 账本。
- v1.2.0
  - 白名单开关、代买 `recipient` 支持、元数据集成（前端/链下可创建）。
- v1.1.1 / v1.1.0
  - `configure` 初始化权限与 b>0 强校验；USDC 迁移（decimals=6）与 NO mint 唯一性“哨兵 1 单位”安全修复。
- v1.0.x
  - 定点 LMSR/二分反解、滑点保护、最小交易流动性、基础事件体系与错误码规范化。

## 安全审计反馈
- v3.0.1 审计响应摘要（由 docs/security-audit-response-v3.0.1.md 汇总）。

---
附录：设计决策摘记（历史文档合并）
- Scopeguard/RefCell RAII 讨论（原 SCOPEGUARD_REFCELL_SOLUTION）
  - 现状：采用“临时 b 值 + 作用域结束恢复”并在关键检查移动至闭包内，保证恢复路径健壮；重入使用 RAII 守卫避免锁遗留。
  - 备选：RefCell + scopeguard 实现真正 RAII（panic 安全，零 unsafe），或重构为纯函数式（不修改 lmsr_b，只以参数传入）。
  - 结论：当前路径稳定可控；未来可在不破坏接口的前提下逐步演进至纯函数实现（见 ROADMAP）。
- 代币统计改进（原 TOKEN_TRACKING_SOLUTION）
  - 原则：铸造/销毁才改变 `total_yes_minted/total_no_minted`；swap 不改变供应。
  - 结算：销毁池内代币并与统计对账，异常时抛出 `TokenSupplyMismatch` 以阻断不一致状态。
