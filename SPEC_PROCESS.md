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