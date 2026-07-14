# SPEC_PROCESS.md

> 记录与 Superpowers 协作生成 SPEC 与 PLAN 的过程，以及冷启动验证结果。

---

## 一、Brainstorming 过程记录

### 1.1 关键节点

| 节点 | 内容 | 决策 |
|------|------|------|
| 项目理解 | 阅读 AI4SE Final Project 要求文件 | 选择 Coding Agent Harness（A类项目） |
| 技术栈选型 | 讨论语言选择 | 从 Python 转向 TypeScript |
| LLM 供应商 | 讨论可选供应商 | 选定 DeepSeek（OpenAI 兼容协议） |
| 重点维度 | 讨论六个维度中哪个做深 | 选定反馈闭环（Feedback Loop） |
| 分发方式 | 讨论分发形态 | 选定 Docker |
| 凭据存储 | 讨论安全方案 | 加密文件（AES-256-GCM）+ 环境变量备选 |
| WebUI | 讨论调试面板形态 | 使用 Open Design 设计系统，先本地后线上 |
| 实现策略 | 讨论 MVP 优先还是直接深入 | 先做 MVP 再做深入 |
| 约束检查 | 逐条核对项目文件 | 补充遗漏约束到 CLAUDE.md |

### 1.2 至少 3 轮关键迭代

**迭代 1：技术栈选型**

> **AI：** 我推荐 Go，单二进制分发、goroutine 并发、静态类型，比 Python 更适合做 harness。
> **我：** 我更倾向于使用 TypeScript。
> **AI：** 好的，TypeScript 也是很好的选择。npm 生态成熟，CLI 框架丰富，与 Superpowers 一致。

→ **决策：** 推翻 AI 推荐，选择 TypeScript。

**迭代 2：反馈闭环的深度策略**

> **AI：** 反馈闭环可以设计为 Sensor → Parser → Classifier → Injector 的完整管道，每个环节都是确定性代码。
> **我：** 我觉得是不是先实现 MVP，再进行深入？
> **AI：** 好主意。先做基础版（工具失败回灌），再做深（传感器管道）。

→ **决策：** 采纳 AI 的完整管道设计思路，但调整为先 MVP 后深入的执行策略。

**迭代 3：设计文档约束检查**

> **AI：** 检查完成，全部通过。
> **我：** 把这些约束都写到 CLAUDE.md 中。
> ...
> **我：** 再次审查项目文件中存在的约束条件，合并到 CLAUDE.md 中。
> **AI：** 重新逐条核对项目文件，补充了 9 个遗漏约束（提交规范、TDD 强制执行、冷启动验证、两阶段评审、GitHub 仓库纪律等）。

→ **决策：** 用户要求全面审查，AI 两次补充遗漏，最终 CLAUDE.md 覆盖了所有项目要求。

### 1.3 AI 建议与我采纳/推翻的决策

| AI 建议 | 采纳/推翻 | 理由 |
|---------|----------|------|
| 使用 Go 语言 | 推翻 | 用户更熟悉 TypeScript |
| 反馈闭环完整管道设计 | 采纳 | 架构合理，但调整为先 MVP 后深入 |
| 模块化 Hook-Driven 架构 | 采纳 | 解耦清晰，便于测试 |
| 一次完成全部约束检查 | 推翻 | 用户要求先写 README 推送，再回头补充约束 |

### 1.4 反思：Brainstorming 技能表现

**做得好：**
- 逐个问题确认，不一次性抛出多个问题，减少了决策负担
- 提供多选方案对比，帮助快速决策
- 主动检查与项目文件的约束一致性
- 设计分块呈现，每块确认后再继续

**不满意：**
- 第一次约束检查不够全面，遗漏了多条项目要求，导致需要用户要求后二次补充
- 在技术栈推荐上过于坚持推荐 Go，虽然最终尊重了用户选择
- 设计文档（SPEC）的验收标准部分可以更具体

---

## 二、冷启动验证

> 验证时间：2026-07-10
> 验证 agent：独立 agent（零对话历史，仅基于 SPEC.md 和 PLAN.md）
> 实现 task：Task 2（类型定义）+ Task 5（Guardrail 拦截）
> 测试结果：7/7 通过

### 2.1 验证过程

1. 独立 agent 完整阅读了 SPEC.md 和 PLAN.md
2. 自主推断出需要先完成 Task 1（脚手架）才能运行后续 task
3. 按 TDD 流程依次实现了 Task 2 和 Task 5
4. 遇到不确定之处时暂停并记录

### 2.2 发现的问题

| 编号 | 严重程度 | 位置 | 描述 | 修复措施 |
|------|---------|------|------|---------|
| F-1 | **P0** | PLAN.md Task 2, Step 2 | 测试文件未 import `types.ts`，导致即使 types.ts 不存在，测试也不会 FAIL，TDD 的"先红"不可复现 | 测试文件加了 `import { Action } from '../src/types'` |
| F-2 | **P1** | PLAN.md Task 1, Step 6 | 要求 `npm run build` 验证构建，但入口文件 `src/index.ts` 直到 Task 10 才创建，此时 build 必然失败 | 将 Step 6 改为仅验证 `npm install` 成功，构建验证移到 Task 10 之后 |
| F-3 | **P2** | PLAN.md 全篇 | Task 间依赖关系未显式标注，新 agent 需要自行推断 Task 1 是所有 task 的前置 | 每个 task 头部加 `Depends-on: Task 1` 标记，末尾加"前置依赖"说明 |
| F-4 | **P3** | SPEC.md §3.3 | 危险模式列表仅列举了部分，PLAN 中实际实现了更多模式（`>/dev/sda`、`fdisk`），两者不完全一致 | SPEC 中加脚注说明"完整模式列表以实际实现为准" |

### 2.3 对 SPEC / PLAN 的修订

**修订前（PLAN.md Task 2 测试文件）：**
```typescript
import { describe, it, expect } from 'vitest'
// 没有 import types.ts
```

**修订后：**
```typescript
import { describe, it, expect } from 'vitest'
import { Action } from '../src/types'  // 加了 import，确保 types.ts 不存在时 FAIL
```

**修订前（PLAN.md Task 1 Step 6）：**
```
npm run build  # 此时 index.ts 不存在，必失败
```

**修订后：**
```
npm install && ls node_modules/.package-lock.json  # 仅验证依赖安装成功
```

### 2.4 验证结论

SPEC.md 和 PLAN.md **基本满足冷启动要求**。一个不了解项目背景的新 agent 可以独立完成实现，但 PLAN.md 有两个影响 TDD 流程的问题（P0 和 P1）需要修正。修正后重新验证通过。

> ⚠️ **回看（见第三部分）**：冷启动"7/7 通过"其实是个**误导性信号**——冷启动 agent 基本是照抄 PLAN 里已写死的完整实现代码，报告也写"代码与 PLAN 一致"。它证明的是"PLAN 的代码跑得通"，**不是** §4.5 要的"spec 够清晰能让新 agent 独立实现"。PLAN 把代码写满，恰恰绕过了冷启动最该测的东西。这是本轮重写的直接触发点。

---

## 三、第二轮审核与 PLAN 重写

> 时间：2026-07-10
> 触发：用户在冷启动后复审全部文件，对照两个 FINAL_PROJECT 要求，逐条审核 SPEC/PLAN/SPEC_PROCESS。

### 3.1 触发点：用户质疑"为什么代码已经在 PLAN 里写了"

冷启动通过后，用户复审时提出一个直击方法论的问题：

> **用户：** "我有个问题，为什么现在的代码已经在 PLAN 里面写了？"

这暴露了 `writing-plans` 技能方法论与项目要求之间的根本张力：

| 要求来源 | 对 PLAN 的要求 | 与完整代码的关系 |
|---------|---------------|----------------|
| `writing-plans` 技能 | "Complete code in every step, no placeholders" | **要求**写满实现代码 |
| 通用要求 §4.3 | "目标、涉及文件、**预期实现要点**、验证步骤" | "要点"≠完整代码 |
| 通用要求 §4.5 冷启动 | 测"spec 是否够清晰让陌生 agent 独立实现" | PLAN 写满→冷启动变成抄写，测不出清晰度 |
| 通用要求 §4.6 | "subagent 驱动开发，每个 task 派新鲜 subagent **自主**完成" | PLAN 写满→subagent 沦为打字员 |
| A 文件 §A.4(C) | "移除 LLM 后机制能否单测验证 = 你**自己编码**了机制" | PLAN 预先给完整实现，模糊"谁在编码" |

**决策：** PLAN 改为**要点式**——每个 task 只给"失败测试代码（含断言）+ 接口签名 + 关键约束/边界"，**实现代码完全交给 subagent 自主写**。这样 TDD 的"红"由测试定义、"绿"由 subagent 独立完成，§4.3/§4.5/§4.6/§A.4(C) 四条同时满足。

### 3.2 审核发现的 11 项不符合项

对照两个 FINAL_PROJECT 文件，发现以下不符合项（已全部修订）：

| 编号 | 严重度 | 出处 | 问题 | 修订 |
|------|--------|------|------|------|
| G-1 | 🔴 | §A.6② | 演示②无法验证"反馈闭环使 agent 改变下一步动作"——MockLLM 是 one-shot，第二步抛异常 | MockLLM 加 `setResponses` 队列；演示②改为"第一步失败→第二步 done"，断言行为改变 |
| G-2 | 🔴 | §4.8/§9.5 | CI 配置 task 缺失 | 新增任务 14：`.github/workflows/ci.yml`（unit-test + docker-build） |
| G-3 | 🔴 | §4.7 | PLAN 缺 commit hash 追踪 | 每个 task 标题加状态块 `> 状态：⬜未开始 ｜ commit: — ｜ PR: —` |
| G-4 | 🔴 | §4.6 | 两阶段评审步骤缺失 | 每个 task 末尾加"spec 合规 + 代码质量"评审 step |
| G-5 | 🔴 | §3.1 | 凭据用 `process.env` 直读，无 `.env` 加载 | 加 dotenv；SPEC §7.1/§5.3/§8 注明从 `.env` 加载 |
| G-6 | 🔴 | §五第9条 | WebUI task 完全缺失（硬交付物） | 新增任务 12：本地 WebUI（Express + Open Design 读 traces）；公网部署列未决 |
| G-7 | 🟡 | DRY | `config.ts` 与 `guardrail.ts` 重复定义危险模式 | `config.ts` 复用 `DEFAULT_DANGEROUS_PATTERNS` |
| G-8 | 🟡 | §3.5 | `take_note` 用 `note.split(':')` 与 SPEC key/value 模型不一致 | Action 改用 `noteKey`/`noteValue` 字段 |
| G-9 | 🟡 | §3.1 | DeepSeekProvider 文本解析过弱，真实运行会空转到 MAX_STEPS | SPEC §3.1 标注 MVP 限制，深入阶段切 function calling |
| G-10 | 🟡 | §A.1 | HITL 仅有拦截、无"暂停等待人工审批" | guardrail 改三态（allow/deny/escalate），escalate 调 `approver` 注入点 |
| G-11 | 🟡 | YAGNI | `ActionType` 含 `spawn_subagent`/`use_skill` 死类型 | 收窄为 `call_tool \| done \| take_note` |

### 3.3 关键决策（11 项，逐一与用户确认）

本轮每项涉及取舍的决策都遵循 §2"先思考再写代码"——列出多选项与推荐，由用户拍板，而非自行选定：

| # | 决策点 | 用户选择 |
|---|--------|---------|
| 1 | PLAN 代码粒度 | **要点式**（失败测试+接口+约束，实现交 subagent） |
| 2 | MockLLM 接口 | **扩展**为支持 response 序列（保留 one-shot 兼容） |
| 3 | CI 形态 | **GitHub Actions**（`.github/workflows/`，含 unit-test + docker-build） |
| 4 | WebUI 范围 | **A**：当前 PLAN 加本地 WebUI task，公网部署留阶段三未决 |
| 5 | HITL 深度 | **分级**：根据危险动作"暂停情形"分流——deny 继续循环 / escalate 人工审批 |
| 6 | GuardrailResult | 三态 `allow/deny/escalate`，分级表默认见 SPEC §11.2 |
| 7 | take_note 字段 | `noteKey`/`noteValue`（不 split 字符串） |
| 8 | ActionType | 移除死类型，收窄 |
| 9 | DeepSeekProvider | MVP 标文本解析限制，深入阶段切 function calling |
| 10 | commit 追踪 | 状态块格式 `> 状态：… ｜ commit: … ｜ PR: …` |
| 11 | config DRY | 复用 guardrail 默认模式表 |

### 3.4 对 SPEC / PLAN 的修订（关键 diff）

**SPEC.md 修订：**
- §3.1 加 MVP 限制注（DeepSeek 文本解析）
- §3.3 Guardrail 改三态分级表
- §3.7 WebUI 补本地实现 + 公网未决说明
- §5.2 数据流改三态分流；§5.3 加 dotenv；§7.1 加 .env 加载；§8 加 dotenv 选型
- §6.1 Action：`noteKey`/`noteValue`、`ActionType` 收窄
- §6.4 GuardrailResult 改三态
- §9 验收标准补 HITL/演示②行为改变/CI 三条
- §10 风险表更新；§11.2/§11.5 三态化
- §12 阶段一补 CI/WebUI/序列/MockLLM

**PLAN.md 修订（整体重写为要点式，13 task → 15 task）：**
- 所有 task 去除实现代码，保留失败测试 + 接口签名 + 约束
- 每个 task 加状态块 + 两阶段评审 step
- 任务 5 guardrail 改三态 + `approver` 注入点
- 任务 8 主循环：三态分流 + 反馈改变动作 + HITL approver + config DRY
- 任务 11 演示②重写为"失败→反馈→改走 done"，演示③改多轮反馈确定性
- 新增任务 12（本地 WebUI）、任务 14（CI）

### 3.5 反思：writing-plans 技能表现

**做得好：**
- bite-sized task + TDD 红绿步骤的骨架，让"先红再绿"有可循路径
- 接口签名 + 前置依赖标注，对 subagent 派发友好

**不满意（本轮暴露）：**
- **"complete code in every step"在本项目是反模式**。它默认假设执行者只是"照抄实现的工程师"，但本项目恰恰要验证"subagent 能否自主实现"——写满代码直接消解了 §4.5/§4.6 的训练目标。技能的零歧义哲学与项目的"训练判断力"目标在这里冲突。
- 第一轮 PLAN 完全写满实现，**冷启动因此失真**——7/7 通过只证明代码跑得通，没暴露任何 spec 缺陷（除了 F-1/F-2 两处机械错误）。这是过程证据被绕过的典型：冷启动 agent 抄答案，自然"通过"。
- writing-plans 技能未提示"当 PLAN 被用作 subagent 自主实现的依据时，应降为实现要点式"——这是技能盲点。

**教训：** 技能方法论不是教条。`writing-plans` 的"完整代码"适用于"工程师照着实现"场景；一旦交付物要求里出现"subagent 自主完成/冷启动验证 spec 清晰度"，PLAN 必须主动降粒度为要点式，否则会架空项目的核心训练目标。这条判断应由我（而非技能）做出。

> **补充（要点式粒度的再校准）：** 重写后用户两度追问 PLAN 的测试粒度——"test 该由谁写""只给边界 vs 给全测试"。最终结论：**测试作为可执行的行为契约，应由我写、在 PLAN 给全**（不是"只给边界"）。只给边界会把验证权交给被验证者，subagent 自写弱断言即可"绿"而行为其实不符 spec，TDD 失去客观基准——这是"写满实现代码"的对称陷阱的另一面。实现自主性已由"不给实现代码"保证，不必再牺牲验证基准。故本轮 PLAN 的最终粒度=**失败测试（给全）+ 接口签名 + 约束，实现交 subagent**。

---

## 四、第二轮冷启动验证（要点式 PLAN）

> 验证时间：2026-07-10
> 验证 agent：独立 agent（零对话历史、零 memory，仅凭重写后的 SPEC.md + PLAN.md）
> 实现 task：任务 1（脚手架，前置）+ 任务 2（类型）+ 任务 3（LLM 抽象）+ 任务 5（三态护栏）
> 测试结果：16/16 通过、`tsc --noEmit` 零错误；全程未联网、未调真实 LLM

### 4.1 与第一轮的对比——验证要点式重写的价值

| 维度 | 第一轮（完整代码 PLAN） | 第二轮（要点式 PLAN） |
|------|----------------------|---------------------|
| 冷启动 agent 的工作 | 抄 PLAN 里已写死的实现代码 | 自己写实现让 PLAN 给的测试通过 |
| "通过"的含义 | 证明"PLAN 的代码跑得通"（自证） | 证明"凭 spec+PLAN 能独立实现"（他证） |
| 暴露的 spec 缺陷 | 仅 2 处机械错误（F-1/F-2） | **7 个疑问、4 个真缺陷** |
| 冷启动价值 | 失真（抄答案） | 真实压力测试 |

要点式重写**直接兑现了 §4.5 的设计意图**——冷启动这次真暴露了文档缺陷，而非上一轮的"抄写式通过"。

### 4.2 发现的 7 个疑问（4 真 + 3 歧义）

| 编号 | 严重度 | 位置 | 描述 | 判定 | 修订 |
|------|--------|------|------|------|------|
| A | 🔴 | PLAN 任务 5 | fork 炸弹正则 `/^:\(\)\{\s*:\s*\|\|.../` 是**双管道 `\|\|`**，但测试喂单管道 `:(){ :|:& };:`——正则匹配不上测试，**红灯无法转绿** | 文档写错 | 正则改为 `/^:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&/`（单管道标准形态） |
| B | 🔴 | PLAN 任务 2 | 测试全是 type-only import，vitest 经 esbuild **剥离类型 import**，删掉 types.ts 测试仍 4/4 过——**红灯根本不触发** | 测试方法学缺陷 | 改 `import * as Types` + 运行时断言 `expect(Types).toBeDefined()`；全局约束加**绿灯门 = `npm test` 过 AND `tsc --noEmit` 零错** |
| C | 🔴 | PLAN 任务 3 | DeepSeekProvider **零测试**，且 `Message.role` 与 openai SDK 窄联合冲突，`npm test` 全绿却掩盖类型错误 | 缺测试+类型摩擦 | 补 DeepSeekProvider 构造测试；约束注明 `Message.role` 用窄联合、直接兼容 SDK |
| D | 🟡 | PLAN 任务 2/5 | `DangerousPattern` 在 types.ts 与 guardrail.ts 间循环依赖未说明归属 | 歧义 | 明确：`DangerousPattern` 定义在 types.ts，guardrail.ts 再导出 |
| E | 🟡 | SPEC §6 / PLAN 任务 2 | `ToolChoice`/`Message` 字段未定义，冷启动 agent 只能推断 | 未定义 | SPEC §6.1 补 `Message`/`ToolChoice`/`DangerousPattern` 定义 |
| F | 🟢 | PLAN 任务 3 | `setResponse`/`setResponses` 互斥语义仅单向说明 | 低风险歧义 | 明确双向互斥：每个 setter 重置对方状态 |
| G | 🟢 | PLAN 任务 3 | one-shot 是否被消费未写清 | 低风险歧义 | 明确：one-shot 持久兜底、不被消费；队列才按序消费 |

### 4.3 对 SPEC / PLAN 的修订（关键 diff）

**PLAN.md：**
- 任务 5 fork 正则改单管道形态
- 任务 2 测试改 `import * as Types` + 运行时断言防剥离
- 全局约束加 `tsc --noEmit` 绿灯闸门
- 任务 3 补 DeepSeekProvider 构造测试 + `setResponse`/`setResponses` 双向互斥 + one-shot 不消费语义 + role 类型摩擦说明
- 任务 2 接口产出补 `Message`/`ToolChoice`/`DangerousPattern` 定义与归属
- 任务 5 接口更新 `DangerousPattern` 归属（types 定义、guardrail 再导出）

**SPEC.md：**
- §6.1 补 `Message`（role 窄联合）、`ToolChoice`、`DangerousPattern` 三个数据模型定义

### 4.4 结论

修复 4 条真缺陷后，要点式 SPEC/PLAN 可让零背景执行者独立、无需返工地完成任务 3 与任务 5。本轮冷启动与第一轮形成鲜明对比，**确证了 PLAN 从"完整代码"降为"要点式"的必要性**——同样的独立 agent，上一轮只能抄出"通过"，这一轮能压力出 4 个真缺陷。这是 §4.5 所要的"客观证据"。

**冷启动报告全文见 `C:\Users\24125\Desktop\Cold\冷启动验证报告.md`。**