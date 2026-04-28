# TalkCody 本地 Coding Agent 后续开发计划

## 目标

将 TalkCody 从“具备本地 Coding Agent 核心工具能力的 Agent 平台”，推进到“可稳定完成本地开发闭环、支持外部 Coding Agent、支持手机远程控制、支持多 Agent 协作”的成熟产品。

本计划按新的优先级重排，并明确将 **Ralph Loop** 视为现有能力基础，而不是重复从零规划：

1. **最高优先级：Codex / Claude Code 接入**
2. **第二优先级：手机远程控制 TalkCody**
3. **第三优先级：Git 协作与回滚完善**
4. **第四优先级：基于 Ralph Loop 的执行闭环补强**
5. **第五优先级：基于 Ralph Loop 的自动验证、恢复、记忆打通**
6. **第六优先级：仓库理解、环境适配、权限审计、Agent Teams、IDE 联动与产品完成度**

---

## Ralph Loop 现状判断（已具备基础能力）

Ralph Loop 不是待设计概念，而是仓库中已经存在的执行机制基础。当前已具备的方向包括：

- 多轮迭代执行
- completion / blocked 明确停止信号
- max iterations / max wall time 限制
- completion hook pipeline 接入
- iteration artifacts 持久化
- stop criteria 框架（tests / lint / tsc / no errors）
- fresh context continuation
- 基础的任务内高信号记忆文件（summary / feedback / state）

因此，以下方向不再按“从零开始”规划：

- 自主执行闭环
- 自动验证与错误修复
- 失败恢复与可恢复执行
- 任务记忆参与执行

这些内容统一改为：**基于 Ralph Loop 补强、集成、产品化。**

但以下方向仍然是独立主线，Ralph Loop 不能替代：

- Codex / Claude Code 外部运行时接入
- 手机网页远程控制
- Git 安全闭环与回滚体验
- Agent Teams / shared task pool / teammate communication

---

## P0：必须优先补齐

### 1. 本地 Codex / Claude Code 直连接入

目标：让用户在创建新任务时就能直接选择并启动本地外部 Coding Agent，而不是仅停留在占位或半成品状态。

优先完成：

- 新任务创建时直接选择 `TalkCody / Codex / Claude Code`
- 完善统一 external agent runtime 抽象
- 打通 Codex CLI 的稳定执行链路
- 真正接入 Claude Code CLI，而不是仅保留 experimental 占位
- 对齐流式输出、状态回传、错误处理、中断与恢复逻辑
- 为后续 Ralph Loop 驱动外部 backend 做兼容准备

开发项：

- 统一 external agent 接口：availability / start / stream / abort / idle session
- 完善 Codex 会话生命周期管理
- 接入 Claude Code CLI 版本检测与非交互执行模式
- 兼容不同 CLI 输出格式（JSON 事件流 / 文本流）
- 在任务创建入口完成 backend 绑定，而不是事后切换
- 不可用时给出明确诊断信息与修复建议
- 定义 Ralph Loop 与 external backend 的集成边界

验收标准：

- 新任务创建时可直接选择 Codex / Claude Code / Native
- Codex 能稳定完成单轮任务执行并返回流式内容
- Claude Code 至少完成 MVP 级单轮任务执行
- 执行失败时能明确展示失败命令、错误摘要、当前阶段
- 后续可扩展接入 Ralph Loop 多轮执行

---

### 2. 手机远程控制 TalkCody（局域网 Web 控制台）

目标：让桌面版 TalkCody 暴露一个可控端口，手机浏览器进入页面后输入密码，即可查看和控制当前任务。

优先完成：

- 桌面端启动本地 HTTP 服务
- 手机通过局域网访问控制页
- 输入密码登录
- 查看任务状态、消息流、运行状态
- 可执行基础控制：发送消息、停止任务、查看输出

开发项：

- 在本地后端增加局域网控制服务（HTTP + WebSocket）
- 支持端口配置、开关配置、监听地址配置
- 提供密码登录与 session/token 机制
- 默认安全策略：默认仅本机访问，开启局域网访问需显式确认
- 实现手机端控制页：Dashboard / Task Console / 状态页
- 高风险操作增加二次确认与审计日志

验收标准：

- 手机可通过浏览器访问 `http://电脑IP:端口`
- 输入密码后能成功进入控制页面
- 可查看任务状态、流式消息、当前 backend
- 可发送消息与停止任务
- 开启局域网访问时具备基本安全保护与审计记录

---

### 3. Git 协作、回滚与安全提交

目标：让用户敢让 Agent 修改多个文件，并且随时能看 diff、能回滚、能提交。

开发项：

- 每轮任务开始前生成可回退快照
- 支持按任务查看 diff
- 支持按文件 / 按补丁预览变更
- 提供任务级撤销 / 回滚
- 生成建议 commit message
- 支持基于当前 diff 继续修复
- 优化 worktree / branch 状态可视化

验收标准：

- 任意一次任务修改都可回滚
- 用户可以在提交前清晰查看改动内容
- Agent 能读取当前 diff 继续迭代，而不是重复扫全仓库
- 多文件改动时工作区状态清晰可追踪

---

### 4. 基于 Ralph Loop 的执行闭环补强

目标：不重复发明执行闭环，而是在现有 Ralph Loop 基础上补强成真正可产品化的闭环能力。

当前已具备基础：

- 多轮迭代
- blocked / complete 停止语义
- max iterations / max wall time
- iteration state 持久化
- completion hook pipeline

需要补齐：

- 执行状态机可视化（plan / act / verify / retry / blocked / done）
- iteration artifacts UI 展示
- 中间状态与最终结果页产品化
- 与 external backend 的协同执行边界
- 与通知、审计、任务恢复入口打通

验收标准：

- 用户能清楚看到当前任务处于哪一阶段
- Ralph Loop 的每轮结果可查看、可理解、可定位
- blocked / complete / max-iterations 等终态在 UI 上清晰可见
- Native 与后续 external backend 都能接入统一闭环模型

---

## P1：体验关键项

### 5. 基于 Ralph Loop 的自动验证编排

目标：利用 Ralph Loop 已有 stop criteria 和工具摘要能力，补齐自动验证与失败反馈链路。

当前已具备基础：

- test / lint / tsc stop criteria 框架
- 工具结果摘要
- 命令模式识别基础

需要补齐：

- 自动发现项目的最小验证命令
- 根据改动范围决定验证策略
- 提炼失败摘要并反馈给下一轮修复
- 输出统一验证结果报告
- 将验证策略对齐 TS / Rust / monorepo 项目结构

验收标准：

- 改动后自动运行合适的验证命令
- 至少对 TS / Rust 两类项目稳定提取错误信息
- Ralph Loop 可基于验证结果继续下一轮修复
- 用户可清晰查看本轮/最终验证结果

---

### 6. 基于 Ralph Loop 的可恢复执行

目标：利用 Ralph Loop 已有 iteration state / final state 持久化基础，补出真正的恢复体验。

当前已具备基础：

- iteration artifacts
- state file
- stop reason
- final state 持久化

需要补齐：

- 任务中断后的恢复入口
- 常见失败的自动恢复策略
- 从上一次 iteration state 继续执行
- 恢复时展示上次失败点和当前建议动作

验收标准：

- 非致命失败不会直接让整个任务报废
- 用户可恢复上一次中断任务
- 恢复后不需要重复完整探索上下文

---

### 7. Ralph Loop 记忆与项目记忆打通

目标：将 Ralph Loop 的任务内跨轮次记忆，升级为和 TalkCody 项目记忆体系协同工作的能力。

当前已具备基础：

- summary / feedback / state 文件
- 高信号信息跨轮次保留

需要补齐：

- 区分全局记忆 / 项目记忆 / Ralph Loop 任务记忆
- 在执行计划和工具选择前读取项目记忆
- 把 Ralph Loop 的有效摘要注入 project memory
- 提供记忆修正、失效、清理机制

验收标准：

- 同一项目的后续任务明显更少重复探索
- Ralph Loop 的有效经验可服务后续任务
- 记忆不会污染无关项目

---

### 8. 仓库理解与跨文件推理

目标：增强 Agent 对大型代码库的理解能力，避免只做表层文本替换。

开发项：

- 完善 workspace symbol / references / definition / implementation 能力接入
- 建立“影响范围分析”能力：修改一个接口后自动找调用方
- 增加跨文件依赖摘要缓存
- 为大仓库提供上下文裁剪与优先级加载策略
- 提供面向任务的代码地图（入口、核心模块、调用链）

验收标准：

- 能对跨文件修改任务自动收集关键上下文
- 修改类型定义、接口、公共函数后，能主动定位主要受影响文件

---

### 9. 人机协作审批与权限控制

目标：让 Agent 更强，但始终可控，尤其是在远程控制和外部 CLI 接入后必须有更强权限边界。

开发项：

- 将权限审批细化到：读文件 / 写文件 / 运行命令 / 联网 / 安装依赖 / 跨工作区访问 / 远程控制操作
- 为高风险操作增加执行前预览
- 支持一次授权、本任务授权、永久授权
- 增加“为什么需要此权限”的结构化说明
- 增加操作审计日志

验收标准：

- 高风险操作必须显式确认
- 用户能清楚知道 Agent 做了什么、为什么做、做到了哪一步
- 手机远程控制下的敏感操作也能被单独审计

---

### 10. 本地开发环境自动识别与适配

开发项：

- 自动识别包管理器、测试框架、构建方式
- 自动识别 monorepo 根目录与子项目边界
- 优化 Windows / macOS / Linux 命令兼容
- 提供环境诊断结果页

验收标准：

- 新项目接入后无需大量手动配置即可开始工作
- 常见 monorepo 结构能识别正确工作目录

---

### 11. 编辑质量与补丁精度控制

开发项：

- 优先最小改动，不做无关格式化
- 增强局部替换命中率与失败回退策略
- 大文件修改前先做局部定位
- 增强多文件联动改动的一致性检查

验收标准：

- patch 更聚焦
- 多轮编辑后文件结构保持稳定

---

## P2：增强项

### 12. Agent Teams 与多 Agent 协同稳定化

目标：在 Codex / Claude Code / Native 运行时成熟后，进一步支持多 Agent 分工协作。

说明：Ralph Loop 负责单任务多轮迭代，Agent Teams 负责多 agent 横向协作，两者互补但不能互相替代。

开发项：

- shared task pool
- teammate communication
- 文件级冲突检测
- 子任务依赖排序
- 多 Agent 结果合并校验
- 并行执行后的统一验证
- 团队角色模型（planner / coder / reviewer / tester）
- 定义 Ralph Loop 在 team 内部的使用方式（每个 agent 是否独立 loop）

验收标准：

- 多 Agent 并行不产生高频文件冲突
- 合并后的结果可自动验证
- 用户能看见各 agent 的任务分工与状态

---

### 13. IDE 级联动体验

开发项：

- 支持基于当前打开文件、选区、诊断信息发起任务
- 支持内联 diff 与局部应用
- 支持错误位置快速跳转
- 支持测试失败定位回源代码

验收标准：

- 用户在代码上下文里直接发起和消费 Agent 结果
- 修改结果更贴近 IDE 原生体验

---

### 14. 产品完成度与默认可用性

开发项：

- 优化首次启动与模型配置流程
- 增加新手模式 / 高级模式
- 增强错误提示、排障指引、日志可读性
- 提供内置最佳实践模板
- 补全远程控制、外部 Agent、Git、Team 功能的统一设置入口

验收标准：

- 新用户能快速完成首次可用配置
- 常见错误能快速自助定位
- 多能力模块的入口与配置关系清晰

---

## 建议研发顺序

### 第一阶段

- Codex / Claude Code 直连接入
- 手机远程控制 MVP（端口、密码、任务查看与控制）
- Git diff / rollback / commit 基础闭环
- Ralph Loop 执行闭环 UI 与状态模型补强

### 第二阶段

- Ralph Loop 自动验证编排
- Ralph Loop 恢复执行能力
- Ralph Loop 记忆与项目记忆打通
- 仓库理解增强
- 权限审批与审计

### 第三阶段

- 环境适配与编辑质量提升
- Agent Teams 与多 Agent 协同稳定化
- IDE 级体验增强
- 产品完成度提升

---

## 里程碑建议

### M1：外部 Agent 可用版

目标：
- 新任务可直接选择 Codex / Claude Code / Native
- Codex 稳定可用
- Claude Code 完成 MVP 接入
- 基础错误处理、状态展示可用

### M2：手机远控与 Git 安全版

目标：
- 手机可通过局域网页面控制 TalkCody
- 支持密码登录与任务控制
- 支持基础 diff 预览、回滚、提交

### M3：Ralph Loop 工程化闭环版

目标：
- Ralph Loop 的多轮执行状态清晰可见
- 支持自动验证与至少两轮修复
- 支持任务恢复与验证反馈驱动下一轮修复

### M4：多 Agent 协作成熟版

目标：
- 支持 Agent Teams、shared task pool、teammate communication
- 并行能力可控可验证
- 具备成熟的审批、记忆、回滚和诊断体验

---

## 最终判断标准

当 TalkCody 满足以下条件时，可认为接近“完整本地 Coding Agent”：

- 用户创建任务时可自由选择 Native / Codex / Claude Code
- 手机可安全远程访问并控制桌面 TalkCody
- 改动可预览、可验证、可回滚、可提交
- Ralph Loop 驱动的多轮闭环可视、可恢复、可验证
- 对中大型仓库有稳定理解能力
- 失败后能自动恢复而不是直接中断
- 多 Agent 协作可控、可审计、可验证
