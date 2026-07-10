# SPEC · Coding Agent Harness

> 项目：AI4SE 2026 期末项目 A · Coding Agent Harness
> 版本：v1.0
> 状态：待冷启动验证

---

## 1. 问题陈述

### 1.1 要解决什么问题

LLM 本身只具备"思考"能力——给定上下文，它决定下一步做什么。但要让一个 LLM 可靠地完成编码任务，需要一套工程基础设施：能调用工具、能感知自身行为结果、能在危险时被拦截、能跨会话记住信息。这套基础设施就是 **Coding Agent Harness**。

本项目的核心公式是 **Agent = LLM × Harness**。LLM 是 CPU，Harness 是让它可靠工作的操作系统。本项目构建一个面向编码场景的轻量级 agent harness，核心能力是**反馈驱动的自我修正循环**：agent 改代码 → 自动运行检查 → 结果回灌 → 自我修正。

### 1.2 目标用户

- 希望通过自然语言指令编写和修改代码的开发者
- 需要可观测、可控、可审计的编码 agent 的用户
- 对 agent 内部机制（而非黑盒输出）感兴趣的 AI4SE 学习者

### 1.3 为什么值得做

市面上已有 Claude Code、Codex CLI、Cursor Agent 等产品级 harness，但它们的内部机制对用户不透明。本项目提供了一个**可读、可测、可拆解**的 harness 实现，核心机制全部是代码而非提示词，每层都能独立验证。这是理解"LLM 之外的那些工程到底做了什么"的最佳学习路径。

---

## 2. 用户故事

> 遵循 INVEST 原则（Independent, Negotiable, Valuable, Estimable, Small, Testable）

| 编号 | 标题 | 故事 |
|------|------|------|
| US-1 | 编写代码 | 作为开发者，我可以通过自然语言指令让 agent 读写文件，这样我就能用对话方式编写代码。 |
| US-2 | 执行命令 | 作为开发者，我可以让 agent 在 shell 中运行构建和测试命令，这样它就能验证代码是否正确。 |
| US-3 | 安全护栏 | 作为开发者，我希望 agent 在尝试执行危险命令（如 `rm -rf /`）时被自动拦截，这样我的系统就不会被意外破坏。 |
| US-4 | 自我修正 | 作为开发者，我希望 agent 在写出有错误的代码后能自动运行检查并自我修正，这样我就不需要手动指出每处错误。 |
| US-5 | 跨会话记忆 | 作为开发者，我希望 agent 能记住我项目的约定和历史决策，这样每次启动新会话时不需要重复说明。 |
| US-6 | 可观测性 | 作为开发者，我可以通过 WebUI 查看 agent 的每一步决策和工具调用，这样我就能理解它为什么做出了某个操作。 |
| US-7 | 凭据管理 | 作为开发者，我可以通过安全的方式配置 API Key，这样我的凭据就不会泄露到代码或日志中。 |

---

## 3. 功能规约

### 3.1 决策封装（核心主循环）

| 项目 | 内容 |
|------|------|
| 输入 | goal（字符串形式的任务描述）、可选配置参数 |
| 行为 | 按顺序执行：组织上下文 → 调用 LLM → 解析 action → guardrail 检查 → 分发执行 → 结果回灌 → 停机判断 |
| 输出 | 最终答案文本 |
| 边界条件 | `MAX_STEPS = 50` 上限；步骤超限后强制返回当前结果 |
| 错误处理 | LLM 调用失败（网络错误/超时）后重试 2 次，仍失败则返回错误信息 |

### 3.2 工具系统

| 工具 | 输入 | 行为 | 输出 |
|------|------|------|------|
| `read_file` | `path: string` | 读取文件内容 | 文件文本内容 |
| `write_file` | `path, content: string` | 写入文件 | 成功/失败信息 |
| `shell` | `command: string` | 执行 shell 命令 | stdout + stderr + exit code |

**边界条件：**
- `read_file`：路径不存在 → 返回错误"文件不存在"
- `write_file`：路径不存在则自动创建目录；写入失败返回具体错误
- `shell`：`timeout = 30s`，超时自动终止

### 3.3 治理护栏

| 项目 | 内容 |
|------|------|
| 输入 | Action 对象 |
| 行为 | 对 `call_tool(shell)` 的命令做危险模式匹配 |
| 输出 | `{ allowed: boolean, reason?: string }` |
| 危险模式 | `rm -rf /`、`dd if=/dev/zero`、`mkfs`、fork 炸弹等 |
| 边界 | 非 shell 工具的 action 默认放行；拦截后返回"该动作被策略拦截" |

### 3.4 反馈闭环（MVP）

| 项目 | 内容 |
|------|------|
| 输入 | 工具调用执行结果（成功/失败） |
| 行为 | 工具执行失败时，将错误信息作为 user message 回灌上下文 |
| 输出 | 追加到上下文的反馈文本 |
| 边界 | 工具执行成功 → 不做额外反馈 |

> 深入阶段扩展为：自动运行测试/lint/类型检查 → 解析结构化输出 → 分类失败 → 回灌 → 多轮修正 → 升级给人。

### 3.5 记忆系统

| 项目 | 内容 |
|------|------|
| 输入 | key: string, value: string |
| 行为 | 按 key 写入/读取，会话末固化为文件 |
| 存储位置 | `~/.agent-harness/memory.json` |
| 输出 | 按 key 匹配的 memory 值 |
| 边界 | key 不存在 → 返回 null；存储文件损坏 → 重建空记忆 |

### 3.6 可观测性

| 项目 | 内容 |
|------|------|
| 输入 | 每轮的 step 编号、action、工具结果 |
| 行为 | 每一步记录决策 + 动作 + 结果，会话末落盘 |
| 存储位置 | `~/.agent-harness/traces/` |
| 输出 | 完整的 trace 记录，可被 WebUI 读取 |

### 3.7 WebUI 调试面板

| 项目 | 内容 |
|------|------|
| 触发 | `agent-harness web` 启动本地服务器 |
| 功能 | 展示会话列表、决策轨迹、工具调用记录、反馈回灌过程 |
| 设计系统 | Open Design |
| 端口 | 默认 3000 |
| 边界 | 无 trace 数据时展示空状态 |

### 3.8 凭据管理

| 项目 | 内容 |
|------|------|
| 首次运行 | 引导输入 DeepSeek API Key（隐藏输入） |
| 存储 | 主密码加密，存到 `~/.agent-harness/credentials.enc` |
| 读取 | 解密后使用；备选 `DEEPSEEK_API_KEY` 环境变量 |
| 查看状态 | 提示"已配置"/"未配置"，不回显明文 |
| 更新 | 重新运行配置命令覆盖 |
| 清除 | 删除加密文件 |

---

## 4. 非功能性需求

### 4.1 性能

- 单轮 agent 循环延迟上限：LLM 调用时间 + 工具执行时间，工具执行超时 30s
- 记忆文件大小上限：1MB（超过则按 LRU 淘汰旧条目）
- Trace 记录上限：每会话 1000 条

### 4.2 安全（含凭据威胁模型）

- **凭据存储**：加密文件使用 AES-256-GCM，主密码在内存中明文使用后即时擦除
- **威胁模型**：
  - 攻击者读取磁盘 → 加密文件受主密码保护，无主密码无法解密
  - 攻击者读取进程内存 → 运行时 API Key 可能在内存中，属已知风险（与 Claude Code 等产品级工具一致）
  - 攻击者获取 `.env` 文件 → 明文风险，在文档中明确警告
- **Shell 安全**：guardrail 拦截危险命令，沙箱不在 MVP 范围内
- **日志安全**：任何日志不写入 API Key 明文

### 4.3 可用性

- 单条命令启动：`npx coding-agent-harness` 或 Docker 方式
- 首次运行有引导式配置流程
- 失败时给出可读的错误信息，而非堆栈

### 4.4 可观测性

- 每轮循环记录决策、动作、结果
- 支持通过 WebUI 实时查看 agent 执行过程
- Trace 数据可导出为 JSON

---

## 5. 系统架构

### 5.1 组件图

```
┌─────────────────────────────────────────────────────┐
│                    CLI Layer                         │
│            commander · 命令解析与分发                  │
├─────────────────────────────────────────────────────┤
│                   Harness Core                       │
│  ┌──────────────────────────────────────────────┐   │
│  │            Agent Loop (while)                 │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │   │
│  │  │LLM   │→│Guard │→│Tool  │→│Feedback  │→Loop │   │
│  │  │Call  │ │rail  │ │Exec  │ │Inject    │    │   │
│  │  └──────┘ └──────┘ └──────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Memory  │ │  Tracer  │ │  Config  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────┤
│                   LLM Layer                          │
│  ┌──────────────────────────────────────────────┐   │
│  │  LLMProvider Interface ← MockLLM / DeepSeek  │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                   WebUI Layer                        │
│  ┌──────────────────────────────────────────────┐   │
│  │  Express Server + Open Design 调试面板        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 5.2 数据流

```
用户输入 goal
    ↓
Agent Loop 启动
    ├── 1. 拼装 context（system prompt + rules + memory + goal）
    ├── 2. LLM(context, tools) → Action
    ├── 3. Guardrail.allow(action)? → 拦截则返回
    ├── 4. 分发执行 action
    │   ├── call_tool → 执行工具 → 结果
    │   ├── take_note → 写入 memory
    │   └── done → 退出循环
    ├── 5. 工具结果回灌 context
    ├── 6. (MVP) 工具失败 → 错误信息回灌
    │   (深入) 自动运行传感器 → 解析 → 分类 → 回灌
    └── 7. 回到步骤 2
    ↓
循环退出 → memory.consolidate() → tracer.flush() → 返回 answer
```

### 5.3 外部依赖

| 依赖 | 用途 | 类型 |
|------|------|------|
| DeepSeek API | LLM 调用 | 运行时（通过 `openai` npm 包） |
| Open Design | WebUI 设计系统 | 构建时（CSS/组件） |
| Express | WebUI 服务器 | 运行时 |
| commander | CLI 参数解析 | 运行时 |
| vitest | 测试框架 | 开发时 |

---

## 6. 数据模型

### 6.1 Action

```typescript
type ActionType = 'call_tool' | 'done' | 'take_note' | 'spawn_subagent' | 'use_skill'

interface Action {
  type: ActionType
  tool?: string          // call_tool 时
  args?: Record<string, unknown>  // call_tool 时
  answer?: string        // done 时
  note?: string           // take_note 时
}
```

### 6.2 TraceEntry

```typescript
interface TraceEntry {
  step: number
  action: Action
  result: string
  timestamp: string
  feedback?: string       // 反馈回灌内容（如有）
}
```

### 6.3 MemoryEntry

```typescript
interface MemoryEntry {
  key: string
  value: string
  createdAt: string
  updatedAt: string
}
```

### 6.4 GuardrailResult

```typescript
interface GuardrailResult {
  allowed: boolean
  reason?: string
}
```

### 6.5 会话状态

```typescript
interface SessionState {
  goal: string
  steps: number
  maxSteps: number
  context: Message[]
  done: boolean
  answer: string | null
}
```

---

## 7. 凭据与分发设计

### 7.1 凭据存储方案

**存储层次：**

```
1. 加密文件（首选）
   ~/.agent-harness/credentials.enc
   └── AES-256-GCM 加密，主密码保护

2. 环境变量（备选）
   DEEPSEEK_API_KEY=sk-xxx
   └── 明文风险，需在文档中明确警告
```

**操作流程：**

| 操作 | 命令 | 行为 |
|------|------|------|
| 首次配置 | `agent-harness config` | 提示输入 API Key，隐藏输入，加密存储 |
| 查看状态 | `agent-harness config --status` | 显示"已配置"或"未配置"，不回显 key |
| 更新 | `agent-harness config --update` | 重新输入并覆盖 |
| 清除 | `agent-harness config --clear` | 删除加密文件 |

### 7.2 分发方案

**首要方式：Docker 镜像**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
```

**使用方式：**
```bash
docker build -t coding-agent-harness .
docker run -it -v ~/.agent-harness:/root/.agent-harness coding-agent-harness
```

**备选方式：npm 包**
```bash
npx coding-agent-harness
```

### 7.3 目标平台

- Docker：Linux (amd64)，Windows/Mac 通过 Docker Desktop
- npm：跨平台，需 Node.js 20+

---

## 8. 技术选型与理由

| 选型 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript 5.x | 类型安全，与 CLI/WebUI 生态一致，npm 分发方便 |
| 运行时 | Node.js 20+ | LTS，原生 fetch，生态成熟 |
| 包管理 | npm | 标准 |
| 构建 | tsup | 零配置 TypeScript 打包 |
| 测试 | vitest | 快速，兼容 jest API |
| LLM 调用 | openai npm 包 | DeepSeek 兼容 OpenAI 协议，直接复用 |
| CLI | commander | 最成熟的 Node.js CLI 框架 |
| WebUI 服务器 | Express | 极简，单页服务 |
| WebUI 设计系统 | Open Design | 项目要求，一致的 UI 体系 |
| 加密 | Node.js crypto | 内置，无需额外依赖 |

---

## 9. 验收标准

| 功能 | 验收标准 |
|------|---------|
| 主循环 | 给定 goal，harness 能在 mock LLM 下完成 ≤5 轮循环并返回 answer |
| 工具系统 | 三种工具（read/write/shell）都能正确执行并返回结果 |
| 治理护栏 | 传入危险命令 → guardrail 拦截并返回 reason；非危险命令 → 放行 |
| 反馈闭环 | 工具执行失败 → 错误信息出现在上下文中的下一条 user message |
| 记忆系统 | 写入 key-value → 重新读取 → 返回正确的 value |
| 可观测性 | 每轮 trace 记录 action、result、timestamp |
| WebUI | 启动后浏览器可访问，展示 trace 数据 |
| 凭据管理 | 加密存储、不回显明文、支持更新和清除 |
| Docker | 容器构建成功，运行后能执行 agent 循环 |

---

## 10. 风险与未决问题

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| DeepSeek API 兼容性问题 | LLM 调用失败 | 使用标准 OpenAI 协议，有备选供应商 |
| 危险命令模式匹配不足 | 漏拦危险操作 | MVP 覆盖最常见模式，深入阶段扩展 |
| 加密文件被暴力破解 | 凭据泄露 | 使用 AES-256-GCM + 建议强密码 |
| WebUI 本地启动无法满足"线上部署"要求 | 交付物扣分 | SPEC 注明后续部署，当前先本地 |

**未决问题：**
- 深入阶段的具体传感器列表（TypeScript compiler / ESLint 等）—— 在深入阶段规划时决定
- WebUI 的线上部署平台（Railway / Render / 自建 VPS）—— 后续决定

---

## 11. 领域与机制设计

> 本节是 Coding Agent Harness 项目（A 类）的额外要求。呼应 §A.4 的"机制必须是代码"原则。

### 11.1 编码领域的反馈信号

| 反馈信号 | 来源 | MVP 处理 | 深入阶段处理 |
|---------|------|---------|------------|
| 工具执行失败 | 操作系统/文件系统 | 错误信息直接回灌 | 同上 + 分类错误类型 |
| 编译错误 | tsc | 不实现 | 运行 `tsc --noEmit` → 解析错误 |
| Lint 错误 | ESLint | 不实现 | 运行 `eslint` → 解析错误 |
| 测试失败 | vitest/jest | 不实现 | 运行 `npm test` → 解析失败 |

**代码实现方式：** 每个传感器是实现了 `Sensor` 接口的类，Parser 是纯函数，Classifier 是状态机。所有环节都是确定性代码，不需要 LLM 参与。

### 11.2 编码领域的危险动作

| 危险动作 | 检测方式 | 实现 |
|---------|---------|------|
| 删除文件系统 | shell 命令正则匹配 | `guardrail.ts` 中的模式匹配 |
| 格式化磁盘 | shell 命令正则匹配 | 同上 |
| 无限递归/fork 炸弹 | shell 命令正则匹配 | 同上 |
| 大规模网络请求 | 超出 MVP 范围 | 后续扩展 |

**代码实现方式：** `guardrail.ts` 导出一个纯函数，输入 Action，输出 `{ allowed, reason }`。不需要 LLM 判断。

### 11.3 编码领域所需工具

| 工具 | 用途 | 实现 |
|------|------|------|
| `read_file` | 读取上下文/代码 | `tools/read_file.ts` |
| `write_file` | 修改/创建代码 | `tools/write_file.ts` |
| `shell` | 运行命令/测试 | `tools/shell.ts` |

### 11.4 编码领域的记忆需求

| 记忆内容 | 来源 | 存储方式 |
|---------|------|---------|
| 项目约定 | CLAUDE.md | 文件级键值存储 |
| 历史决策 | 会话中 agent 主动记录 | `take_note` action → memory |
| 用户偏好 | 配置 | 配置文件 |

### 11.5 重点维度：反馈闭环

**为什么选择反馈闭环作为重点维度：**

1. **天然是代码**：传感器、解析器、分类器、注入器都是确定性代码，不需要 LLM 参与，完美契合 §A.4(B)"机制必须是代码"的要求。
2. **深度可量化**：从简单的"错误回灌"到完整的"传感器管道 + 失败分类 + 多轮修正 + 升级给人"，有清晰的深度演进路径。
3. **可测试性最强**：移除 LLM 后，每个环节都可以独立写单元测试验证。
4. **项目价值最高**：反馈闭环是 Harness Engineering 的灵魂——让机器护栏告诉 agent 做错没（Kent Beck 的"augmented coding"理念）。

**机制如何编码实现（呼应 §A.4）：**

```
MVP 阶段: 一行 try/catch 实现
  try { result = tool.execute() } catch(e) { result = "工具失败: " + e.message }

深入阶段: 完整的传感器管道
  Sensor.run()        → 返回 SensorResult（原始输出）
  Parser.parse()      → 返回 Failure[]（结构化错误列表）
  Classifier.classify() → 返回 ClassifiedFailure[]（带分类标签）
  Injector.inject()   → 返回 string（格式化后的反馈文本，追加到 context）
```

**判定标准（呼应 §A.4(C)）：** 移除真实 LLM 后，以下测试仍然通过：
- 给定一个 `write_file` action 写入有语法错误的代码 → 手动触发传感器 → 断言 parser 解析出至少 1 个 failure
- 给定一个分类后的 failure 数组 → 断言 injector 产出的文本包含"类型错误"等关键词
- 给定一个危险 shell 命令 → 断言 guardrail 返回 `{ allowed: false }`

---

## 12. 附录：项目阶段划分

### 阶段一：MVP（核心功能可运行）

- 主循环 + LLM 抽象层 + MockLLM
- 3 个基础工具（read_file / write_file / shell）
- Guardrail（危险命令拦截）
- 基础反馈闭环（工具失败回灌）
- 文件记忆系统
- Tracer 基本记录
- 凭据加密存储
- 全部单元测试
- Docker 构建

### 阶段二：深入（反馈闭环做深）

- 传感器管道：Parser → Classifier → Injector
- 自动运行 TypeScript compiler / ESLint / 测试
- 多轮修正循环 + 重复失败检测 + escalate_to_human
- 深度单元测试覆盖

### 阶段三：WebUI 与分发

- Open Design 调试面板
- Express 服务器
- 线上部署