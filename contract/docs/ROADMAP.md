# Ploymarket 合约路线图（单一规划总览）

目的
- 统一记录后续所有规划，避免“一个规划一个文件”的分散管理。
- 为产品、合约、前端与运维提供一致的目标、阶段与验收标准。

说明
- 状态：pending / in_progress / done / parked
- 变更流程：PR + 评审 + 路线图更新；关键项建议附时间窗与负责人。

## Phase 0 — 基础文档与现状（done）
- 建立集中路线图文件（本文件） [done]
- 记录硬编码可行性与参数治理化评估（参考：contract/docs/parameter-governance-assessment.md） [done]

## Phase 1 — 参数治理化 v1（pending）
目标：在不破坏现有接口的前提下，将核心风控参数从常量改为可配置，提升应对极端行情的响应速度。

- 配置项（Config 扩展）
  - 交易：max_single_trade_bps（替换 constants 中硬编码） [pending]
  - LP：撤出上限四档 bps（平衡/轻度/中度/高度失衡） [pending]
  - LP：早退惩罚 bps（7/14/30 天） [pending]
  - 安全（可选）：熔断阈值 bps 与 24h 撤出占比上限 [parked]
- 校验与兼容
  - configure 指令集中边界校验（≤10000 bps、上下界与互斥关系） [pending]
  - 配置账户 realloc 扩容，默认值与当前常量一致（保持行为不变） [pending]
- 落地与事件
  - swap/withdraw/withdraw_preview 改为读取 Config 值 [pending]
  - 发射 Config 参数快照事件（含版本号/序号） [pending]
- 发布与回滚
  - Staging 回归、主网灰度；提供一键回滚旧参数预案 [pending]

验收标准
- 关键参数可在不升级程序的前提下通过治理交易调整；边界校验完整，默认行为无变化。

## Phase 2 — 治理增强（pending）
目标：降低单点权限与误操作风险。

- 多签治理：将 authority 切换为多签 PDA [pending]
- 时间锁：关键参数变更延迟生效（支持紧急通道） [pending]
- 变更速率限制：单位时间内变更次数/步长限制 [pending]

验收标准
- 关键参数的变更需满足多签与时间锁策略，并具备紧急处置流程与公告事件。

## Phase 3 — 可观测性与风控看板（pending）
目标：提升运维透明度与异常响应速度。

- 事件审计：
  - 保留 VaultBalanceSnapshot（账本-金库一致性） [in_progress]
  - 新增 ParamSnapshot（参数变更快照） [pending]
- 链下看板与告警：
  - LP 风险指标（失衡度、可提上限、熔断状态） [pending]
  - 金库余额对账偏差、参数变更日志 [pending]

验收标准
- 关键运行指标与参数变更在看板可见并触发告警阈值。

## Phase 4 — LP 保护机制精细化（pending）
目标：在不牺牲用户体验的前提下进一步降低系统性风险。

- 自适应最大单笔：随池深/有效 b 值动态调整上限 [pending]
- 撤出队列（可选）：极端行情下队列化批处理提现 [parked]
- 保险池动态注入：随成交与波动调整注入比例/上限 [pending]

验收标准
- 大额交易与极端行情下的价格冲击与提现波动显著降低（以回测/仿真验证）。

## Phase 5 — 运维与清理（pending）
目标：完善生命周期收尾，降低链上残留与运维成本。

- `reclaim_dust` 运维手册与 CLI 脚本（批量化） [pending]
- “哨兵 NO 代币”清理（可选管理指令） [parked]

验收标准
- 市场完结/结算/回收尾款流程成体系，残留余额可被准确识别与回收。

## Phase 6 — 安全与测试（pending）
目标：增加纵深防御与质量保证。

- ReentrancyGuard 失败路径回归测试 [pending]
- Fuzz 框架与边界测试（LMSR/取整/溢出路径） [pending]

验收标准
- 关键路径 fuzz 零崩溃；重入与边界用例全绿。

---
维护说明
- 本文件作为单一“路线图总览”，新增/调整规划请直接修改本文件，并在 PR 描述中引用相应任务/设计文档。
