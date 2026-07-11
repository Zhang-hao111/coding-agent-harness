# MVP 实现计划 — Coding Agent Harness

> **对于 agent 执行者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐 task 实现本计划。步骤使用复选框（`- [ ]`）语法追踪进度。

**目标：** 构建 Coding Agent Harness 的 MVP：agent 主循环、3 个基础工具、三态分级治理护栏（含 HITL approver 注入点）、基础反馈注入（含"改变下一步动作"演示）、记忆系统、可观测性、凭据加密存储、CLI 入口、本地 WebUI 调试面板、GitHub Actions CI、Docker 分发。

**架构：** 模块化 harness，中央 while 循环。每个组件（LLM、工具、护栏、记忆、追踪器）是独立模块，实现定义的接口。Harness 启动时装配并在循环中运行。护栏返回三态处置（allow / deny / escalate），escalate 经 `approver` 注入点触发 HITL。

**技术栈：** TypeScript 5.x, Node.js 20+, npm, commander, vitest, tsup, openai npm 包, Node.js crypto, express, dotenv, Open Design。

**代码粒度约定（要点式）：**
- 每个 task 给出**完整的失败测试代码**（含断言）+ **接口签名** + **关键约束/边界**。
- **实现代码完全交给 subagent 自主编写**——本计划不提供实现代码，subagent 写最少代码让测试通过。
- 这样 TDD 的"红"由测试定义，"绿"由 subagent 独立完成，满足 §4.3/§4.5/§4.6 与 §A.4(C)。

## 全局约束

- 所有 API Key 必须加密存储（AES-256-GCM），绝不硬编码、不进 Git、不写日志/history/明文配置。
- 环境变量经 dotenv 从 `.env` 加载，不用命令行 `export`。
- 每个核心机制必须有 mock-LLM 单元测试，不依赖网络与真实 LLM。
- TDD：先写失败测试、确认失败，再实现、确认通过，再提交。
- **绿灯门 = `npm test` 通过 AND `npx tsc --noEmit` 零错误**（vitest 经 esbuild 剥离类型，不做跨文件类型检查；类型错误只有 `tsc` 能暴露）。
- 每个 task 完成后做两阶段评审（spec 合规 + 代码质量），Critical issue 必须修复才能进入下一 task。
- 代码风格：匹配现有代码风格，不做无关重构；YAGNI，不写投机性代码。
- Commit 消息：`<类型>: <描述>`，标注 subagent 来源与人工修改。
- 文件路径：用 `path` 模块实现跨平台兼容。
- Shell 命令：所有 shell 执行设 `timeout = 30s`。
- 配置：持久化数据统一存 `~/.agent-harness/`。
- 分支策略：每个 task 开 git worktree，对应一个 PR；拒绝单次 commit 提交全部代码。

---

## 文件结构

```
coding-agent-harness/
├── src/
│   ├── index.ts              # CLI entry (commander): run / config / web
│   ├── harness.ts            # Agent 主循环
│   ├── config.ts             # Config 装配（复用 guardrail 默认模式表）
│   ├── types.ts              # 共享类型定义
│   ├── guardrail.ts          # 三态分级护栏 + HITL approver 类型
│   ├── memory.ts             # 文件级 key-value 记忆
│   ├── tracer.ts             # 逐步可观测性
│   ├── credentials.ts        # AES-256-GCM 加密凭据存储
│   ├── llm/
│   │   ├── interface.ts      # LLMProvider 接口
│   │   ├── mock.ts           # MockLLM（含 response 序列）
│   │   └── deepseek.ts       # DeepSeek 实现（MVP 文本解析）
│   ├── tools/
│   │   ├── registry.ts       # ToolRegistry
│   │   ├── read_file.ts      # ReadFileTool
│   │   ├── write_file.ts     # WriteFileTool
│   │   └── shell.ts          # ShellTool
│   └── web/
│       ├── server.ts         # Express 服务器
│       └── public/           # Open Design 静态面板
├── tests/
│   ├── types.test.ts
│   ├── llm.test.ts
│   ├── tools.test.ts
│   ├── guardrail.test.ts
│   ├── memory.test.ts
│   ├── tracer.test.ts
│   ├── harness.test.ts
│   ├── credentials.test.ts
│   ├── web.test.ts
│   └── mechanism-demo.test.ts
├── .github/workflows/ci.yml # GitHub Actions: unit-test + docker-build
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── Dockerfile
├── .gitignore
├── .env.example              # 环境变量样例（不含真实 key）
├── SPEC.md
├── PLAN.md
├── README.md
├── AGENT_LOG.md
└── REFLECTION.md
```

---

### Task 1：项目脚手架

> 状态：✅ 完成 ｜ 实现: 66234db ｜ merge: c8522d0 ｜ 分支: task/1

**前置依赖：** 无

**文件：**
- 创建： `package.json`、`tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`、`.gitignore`、`.env.example`

**接口：**
- 产出： 可将 `src/` 编译到 `dist/`、用 vitest 跑测试的构建系统

**关键约束：**
- `package.json` 的 `type: "module"`；`bin` 指向 `dist/index.js`。
- 依赖：`commander`、`openai`、`express`、`dotenv`；开发依赖：`typescript`、`tsup`、`vitest`、`@types/node`、`@types/express`。
- 脚本：`build`=`tsup`、`test`=`vitest run`、`test:watch`=`vitest`、`start`=`node dist/index.js`。
- `tsconfig`：`target` ES2022、`module` ESNext、`moduleResolution` bundler、`strict` true。
- `vitest.config`：`globals` true、`environment` node、`include` `tests/**/*.test.ts`。
- `.gitignore` 含：`node_modules/`、`dist/`、`.env`、`*.log`、`~/.agent-harness/`。
- `.env.example` 含 `DEEPSEEK_API_KEY=` 占位（注明明文风险）。

- [ ] **步骤 1：创建配置文件**

按上述约束创建 `package.json`、`tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`、`.gitignore`、`.env.example`。

- [ ] **步骤 2：验证脚手架**

```bash
npm install
ls node_modules/.package-lock.json
```

预期： `node_modules/` 已填充，`package-lock.json` 存在。

> 注意：**不要**在此步运行 `npm run build`——入口 `src/index.ts` 直到任务 10 才创建，此时 build 必失败。构建验证在任务 10 之后。

- [ ] **步骤 3：两阶段评审 + 提交**

spec 合规：依赖/脚本/配置是否与约束一致。代码质量：配置是否最小、无多余项。

```bash
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore .env.example
git commit -m "chore: 初始化项目脚手架

TypeScript 5.x + tsup + vitest + commander + dotenv 技术栈。
由主 agent 完成。"
```

---

### Task 2：类型定义

> 状态：✅ 完成 ｜ 实现: 653997e ｜ merge: 8a67b78 ｜ 分支: task/2

**前置依赖：** 任务 1

**文件：**
- 创建： `src/types.ts`
- 测试： `tests/types.test.ts`

**接口：**
- 产出： `Action`、`ActionType`、`ToolDef`、`ToolResult`、`Message`、`ToolChoice`、`LLMResponse`、`GuardrailResult`、`Disposition`、`DangerousPattern`、`TraceEntry`、`MemoryEntry`、`SessionState`、`HarnessConfig`

**关键约束：**
- `ActionType = 'call_tool' | 'done' | 'take_note'`（不预定义 `spawn_subagent`/`use_skill`，YAGNI）。
- `Action` 的 `take_note` 用 `noteKey?: string` + `noteValue?: string`，**不用**单字符串 `note`。
- `Message = { role: 'system' | 'user' | 'assistant'; content: string }`（role 为窄联合，直接兼容 openai SDK）。
- `ToolChoice = { name: string; description: string; parameters?: Record<string, unknown> }`。
- `GuardrailResult = { disposition: 'allow' | 'deny' | 'escalate'; reason?: string }`。
- `Disposition = 'allow' | 'deny' | 'escalate'`。
- **`DangerousPattern` 定义在 `types.ts`**（含 `pattern: RegExp`、`disposition: Disposition`、`reason: string`），`guardrail.ts` 用 `export type { DangerousPattern } from './types'` 再导出——避免 `guardrail.ts` 产出该类型又 import `types.ts` 的循环依赖。
- `HarnessConfig` 含 `maxSteps`、`dangerousPatterns: DangerousPattern[]`、`memoryPath`、`tracesDir`、`credentialsPath`。

- [ ] **步骤 1：编写失败测试**

创建 `tests/types.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
// 用命名空间 import + 运行时断言，确保 import 不被 esbuild 当作 type-only 剥离
// （type-only import 删掉 src/types.ts 后测试仍会过，红灯失效）
import * as Types from '../src/types'

describe('Type definitions', () => {
  it('module is exported at runtime', () => {
    expect(Types).toBeDefined()
  })

  it('take_note uses noteKey/noteValue', () => {
    const action: Types.Action = { type: 'take_note', noteKey: 'lang', noteValue: 'TypeScript' }
    expect(action.noteKey).toBe('lang')
    expect(action.noteValue).toBe('TypeScript')
  })

  it('GuardrailResult is three-state', () => {
    const r: Types.GuardrailResult = { disposition: 'escalate', reason: 'rm -rf /' }
    const d: Types.Disposition = 'allow'
    expect(['allow', 'deny', 'escalate']).toContain(r.disposition)
    expect(['allow', 'deny', 'escalate']).toContain(d)
  })

  it('ActionType has no spawn_subagent', () => {
    const t: Types.ActionType = 'call_tool'
    expect(t).not.toBe('spawn_subagent')
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/types.test.ts
```

预期： FAIL — `src/types.ts` 不存在，`import` 失败。

- [ ] **步骤 3：实现 `src/types.ts`**（subagent 自主编写，满足上述接口与约束）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/types.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：类型字段是否与 SPEC §6 一致（三态、noteKey/noteValue、ActionType 收窄）。代码质量：无投机类型、注释风格一致。

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: 定义核心类型（Action、GuardrailResult 三态、TraceEntry 等）

由 subagent-X 完成。"
```

---

### Task 3：LLM 抽象层

> 状态：✅ 完成 ｜ 实现: 34a6b15 ｜ merge: a8911c0（PR #1）｜ 分支: task/3

**前置依赖：** 任务 1、任务 2

**文件：**
- 创建： `src/llm/interface.ts`、`src/llm/mock.ts`、`src/llm/deepseek.ts`
- 测试： `tests/llm.test.ts`

**接口：**
- 依赖： `Message`、`ToolChoice`、`LLMResponse`、`Action`（from `src/types.ts`）
- 产出：
  - `interface LLMProvider { chat(messages: Message[], tools: ToolChoice[]): Promise<LLMResponse> }`
  - `class MockLLM`：`setResponse(action: Action): void`（one-shot 兼容）、`setResponses(actions: Action[]): void`（队列）、`getHistory(): Message[]`、`chat(...)`
  - `class DeepSeekProvider`：`constructor(apiKey: string, model?: string)`、`chat(...)`

**关键约束：**
- `MockLLM.chat`：若配了队列则按序弹出下一个 action；队列空且无 one-shot 时抛 `"No preset response configured"`。
- `setResponse`/`setResponses` 互斥语义：每个 setter 调用时**重置对方状态**（调 `setResponses` 清空 one-shot；调 `setResponse` 清空队列），使"后者覆盖前者"双向成立。
- one-shot 语义：one-shot 为**持久兜底**，每次 `chat` 返回同一 action、**不被消费**；队列模式才按序消费。
- `MockLLM` 返回的 `LLMResponse.message` 角色为 `assistant`，content 由 action 推导（done→answer，其余可空）。
- `DeepSeekProvider` 用 `openai` 包，`baseURL: 'https://api.deepseek.com/v1'`，默认 model `deepseek-chat`。MVP 用文本解析 action（检测 `DONE` 标记），**未启用 function calling**——这是已知 MVP 限制，在文件顶部注释标明，深入阶段切换。
- **类型摩擦**：`Message.role` 为窄联合 `'system'|'user'|'assistant'`，传入 `openai` SDK 的 `ChatCompletionMessageParam` 时可直接用（无需断言）；若实现为宽 `string` 则需在传入处收敛为联合类型。

- [ ] **步骤 1：编写失败测试**

创建 `tests/llm.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { MockLLM } from '../src/llm/mock'
import { DeepSeekProvider } from '../src/llm/deepseek'
import { Action } from '../src/types'

describe('MockLLM', () => {
  let mock: MockLLM
  beforeEach(() => { mock = new MockLLM() })

  it('returns a one-shot preset response', async () => {
    mock.setResponse({ type: 'done', answer: 'Task complete' })
    const result = await mock.chat([{ role: 'user', content: 'hi' }], [])
    expect(result.action?.type).toBe('done')
    expect(result.action?.answer).toBe('Task complete')
  })

  it('one-shot is not consumed', async () => {
    mock.setResponse({ type: 'done', answer: 'x' })
    await mock.chat([{ role: 'user', content: 'a' }], [])
    const r2 = await mock.chat([{ role: 'user', content: 'b' }], [])
    expect(r2.action?.answer).toBe('x')
  })

  it('throws when no response configured', async () => {
    await expect(mock.chat([{ role: 'user', content: 'hi' }], [])).rejects.toThrow('No preset response configured')
  })

  it('serves a response queue in order', async () => {
    mock.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: 'x' } },
      { type: 'done', answer: 'done' },
    ])
    const r1 = await mock.chat([{ role: 'user', content: 'go' }], [])
    const r2 = await mock.chat([{ role: 'user', content: 'go' }], [])
    expect(r1.action?.type).toBe('call_tool')
    expect(r2.action?.type).toBe('done')
  })

  it('setResponses resets one-shot (mutual exclusion)', async () => {
    mock.setResponse({ type: 'done', answer: 'one-shot' })
    mock.setResponses([{ type: 'done', answer: 'queue' }])
    const r = await mock.chat([{ role: 'user', content: 'go' }], [])
    expect(r.action?.answer).toBe('queue')
  })

  it('throws when queue exhausted', async () => {
    mock.setResponses([{ type: 'done', answer: 'x' }])
    await mock.chat([{ role: 'user', content: 'go' }], [])
    await expect(mock.chat([{ role: 'user', content: 'go' }], [])).rejects.toThrow('No preset response configured')
  })

  it('records conversation history', async () => {
    mock.setResponse({ type: 'done', answer: 'ok' })
    await mock.chat([{ role: 'user', content: 'first' }], [])
    expect(mock.getHistory().length).toBeGreaterThan(0)
  })
})

describe('DeepSeekProvider', () => {
  it('constructs without network', () => {
    const p = new DeepSeekProvider('sk-fake', 'deepseek-chat')
    expect(p).toBeDefined()
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/llm.test.ts
```

预期： FAIL — `src/llm/mock.ts` 不存在。

- [ ] **步骤 3：实现 `interface.ts`、`mock.ts`、`deepseek.ts`**（subagent 自主编写）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/llm.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：队列语义、one-shot 兼容、DeepSeek 文本解析限制注释。代码质量：错误信息清晰、无投机逻辑。

```bash
git add src/llm/ tests/llm.test.ts
git commit -m "feat: 实现 LLM 抽象层（MockLLM 含 response 序列 + DeepSeekProvider）

由 subagent-X 完成。"
```

---

### Task 4：工具系统

> 状态：✅ 完成 ｜ 实现: bb88951 ｜ merge: aa9a6a3（PR #2）｜ 分支: task/4

**前置依赖：** 任务 1、任务 2

**文件：**
- 创建： `src/tools/registry.ts`、`src/tools/read_file.ts`、`src/tools/write_file.ts`、`src/tools/shell.ts`
- 测试： `tests/tools.test.ts`

**接口：**
- 依赖： `ToolDef`、`ToolResult`（from `src/types.ts`）
- 产出： `class ToolRegistry`（`register`/`list`/`get`/`execute`）、`class ReadFileTool`、`class WriteFileTool`、`class ShellTool`，均 `implements ToolDef`

**关键约束：**
- `ToolDef`：`name: string`、`description: string`、`execute(args): Promise<ToolResult>`。
- `ReadFileTool`：缺 `path` 参数 → `{ success:false, error:'缺少 path 参数' }`；文件不存在 → `{ success:false, error }` 且 error 含"不存在"。
- `WriteFileTool`：自动 `mkdirSync(path.dirname(filePath), {recursive:true})`；缺 `path` → 报错。
- `ShellTool`：构造接收 `timeout`（秒，默认 30），`execSync` 时 `timeout*1000`、`maxBuffer` 10MB；失败时返回 `{ success:false, data: stdout, error: stderr }`。
- `ToolRegistry.execute`：未知工具名抛 `"Unknown tool: <name>"`。

- [ ] **步骤 1：编写失败测试**

创建 `tests/tools.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TMP = path.join(os.tmpdir(), 'agent-harness-tool-' + Date.now())

describe('ToolRegistry', () => {
  it('registers and lists tools', () => {
    const reg = new ToolRegistry()
    reg.register(new ReadFileTool()); reg.register(new WriteFileTool()); reg.register(new ShellTool(30))
    const names = reg.list().map(t => t.name)
    expect(names).toEqual(expect.arrayContaining(['read_file', 'write_file', 'shell']))
  })

  it('throws for unknown tool', async () => {
    const reg = new ToolRegistry()
    await expect(reg.execute('unknown', {})).rejects.toThrow('Unknown tool')
  })
})

describe('ReadFileTool', () => {
  beforeEach(() => fs.mkdirSync(TMP, { recursive: true }))
  afterEach(() => fs.rmSync(TMP, { recursive: true, force: true }))

  it('reads an existing file', async () => {
    const p = path.join(TMP, 't.txt'); fs.writeFileSync(p, 'hello', 'utf-8')
    const r = await new ReadFileTool().execute({ path: p })
    expect(r.success).toBe(true); expect(r.data).toBe('hello')
  })

  it('returns error for missing file', async () => {
    const r = await new ReadFileTool().execute({ path: path.join(TMP, 'no.txt') })
    expect(r.success).toBe(false); expect(r.error).toContain('不存在')
  })
})

describe('WriteFileTool', () => {
  beforeEach(() => fs.mkdirSync(TMP, { recursive: true }))
  afterEach(() => fs.rmSync(TMP, { recursive: true, force: true }))

  it('creates directories automatically', async () => {
    const p = path.join(TMP, 'sub/deep/o.txt')
    const r = await new WriteFileTool().execute({ path: p, content: 'nested' })
    expect(r.success).toBe(true); expect(fs.readFileSync(p, 'utf-8')).toBe('nested')
  })
})

describe('ShellTool', () => {
  it('executes a command', async () => {
    const r = await new ShellTool(30).execute({ command: 'echo hello' })
    expect(r.success).toBe(true); expect(r.data).toContain('hello')
  })

  it('captures failure', async () => {
    const r = await new ShellTool(30).execute({ command: 'nonexistent_cmd_xyz' })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/tools.test.ts
```

预期： FAIL — 工具文件不存在。

- [ ] **步骤 3：实现 `read_file.ts`、`write_file.ts`、`shell.ts`、`registry.ts`**（subagent 自主编写）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/tools.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：边界（自动建目录、timeout、错误含"不存在"）。代码质量：错误处理最小、无投机分支。

```bash
git add src/tools/ tests/tools.test.ts
git commit -m "feat: 实现工具系统（read_file / write_file / shell + registry）

由 subagent-X 完成。"
```

---

### Task 5：治理护栏（三态分级 + HITL）

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1、任务 2

**文件：**
- 创建： `src/guardrail.ts`
- 测试： `tests/guardrail.test.ts`

**接口：**
- 依赖： `Action`、`GuardrailResult`、`Disposition`、`DangerousPattern`（from `src/types.ts`）
- 产出：
  - `const DEFAULT_DANGEROUS_PATTERNS: DangerousPattern[]`（`DangerousPattern` 定义在 `types.ts`，本文件 `export type { DangerousPattern } from './types'` 再导出）
  - `function guardrail(action: Action, patterns?: DangerousPattern[]): GuardrailResult`
  - `type Approver = (action: Action) => Promise<boolean>`

**关键约束：**
- 默认分级表（MVP）：

  | 模式 | disposition | reason |
  |------|-------------|--------|
  | `/^rm\s+-rf\s+\//` | escalate | 删除文件系统 |
  | `/^mkfs/` | escalate | 格式化磁盘 |
  | `/^dd\s+if=/` | escalate | 覆写磁盘 |
  | `/^>\/dev\/sda/` | escalate | 覆写磁盘 |
  | `/^fdisk/` | escalate | 改分区表 |
  | `/^:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&/` | deny | fork 炸弹（单管道标准形态） |

- 非 shell 工具或非 `call_tool` 的 action → `{ disposition: 'allow' }`。
- 匹配时返回**该模式**的 disposition + reason；不匹配 → `allow`。
- `approver` 类型在此定义（纯类型，不含实现）；真实 `approver` 实现（readline）在任务 10 挂载，mock `approver` 在测试里给定。

- [ ] **步骤 1：编写失败测试**

创建 `tests/guardrail.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { guardrail, DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import { Action } from '../src/types'

describe('guardrail', () => {
  it('allows safe shell', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'ls -la' } }
    expect(guardrail(a).disposition).toBe('allow')
  })

  it('escalates rm -rf /', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } }
    const r = guardrail(a)
    expect(r.disposition).toBe('escalate'); expect(r.reason).toBeDefined()
  })

  it('escalates mkfs', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'mkfs.ext4 /dev/sda1' } }
    expect(guardrail(a).disposition).toBe('escalate')
  })

  it('denies fork bomb', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: ':(){ :|:& };:' } }
    expect(guardrail(a).disposition).toBe('deny')
  })

  it('allows non-shell action', () => {
    const a: Action = { type: 'call_tool', tool: 'read_file', args: { path: 'x' } }
    expect(guardrail(a).disposition).toBe('allow')
  })

  it('allows done action', () => {
    expect(guardrail({ type: 'done', answer: 'ok' }).disposition).toBe('allow')
  })

  it('is deterministic', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } }
    expect(guardrail(a)).toEqual(guardrail(a))
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/guardrail.test.ts
```

预期： FAIL — `src/guardrail.ts` 不存在。

- [ ] **步骤 3：实现 `src/guardrail.ts`**（subagent 自主编写，满足分级表与三态语义）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/guardrail.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：三态分级与 SPEC §3.3/§11.2 表一致；approver 为注入点。代码质量：纯函数、确定性、无副作用。

```bash
git add src/guardrail.ts tests/guardrail.test.ts
git commit -m "feat: 实现三态分级 guardrail（allow/deny/escalate + approver 注入点）

由 subagent-X 完成。"
```

---

### Task 6：记忆系统

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1、任务 2

**文件：**
- 创建： `src/memory.ts`
- 测试： `tests/memory.test.ts`

**接口：**
- 依赖： `MemoryEntry`（from `src/types.ts`）
- 产出： `class FileMemory`：`constructor(filePath)`、`read(key): Promise<string|null>`、`write(key, value): Promise<void>`、`consolidate(): Promise<void>`

**关键约束：**
- 内存中维护 `Map<string, MemoryEntry>`，`write` 置 `dirty=true`。
- `consolidate`：仅 `dirty` 时写盘；写盘前 `mkdirSync(dirname, {recursive:true})`；序列化为 `MemoryEntry[]` JSON。
- 构造时 `load`：文件损坏（JSON 解析失败）→ 清空、不抛。
- `read` 未知 key → `null`。

- [ ] **步骤 1：编写失败测试**

创建 `tests/memory.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileMemory } from '../src/memory'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const P = path.join(os.tmpdir(), 'agent-harness-mem-test.json')

describe('FileMemory', () => {
  let mem: FileMemory
  beforeEach(() => { try { fs.unlinkSync(P) } catch {} mem = new FileMemory(P) })
  afterEach(() => { try { fs.unlinkSync(P) } catch {} })

  it('returns null for unknown key', async () => {
    expect(await mem.read('nope')).toBeNull()
  })

  it('stores and retrieves', async () => {
    await mem.write('lang', 'TypeScript')
    expect(await mem.read('lang')).toBe('TypeScript')
  })

  it('overwrites existing key', async () => {
    await mem.write('k', 'v1'); await mem.write('k', 'v2')
    expect(await mem.read('k')).toBe('v2')
  })

  it('persists to disk', async () => {
    await mem.write('persist', 'data')
    const m2 = new FileMemory(P)
    expect(await m2.read('persist')).toBe('data')
  })

  it('recovers from corrupted file', async () => {
    fs.writeFileSync(P, '{not json', 'utf-8')
    const m = new FileMemory(P)
    expect(await m.read('any')).toBeNull()
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/memory.test.ts
```

预期： FAIL。

- [ ] **步骤 3：实现 `src/memory.ts`**（subagent 自主编写）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/memory.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：dirty、损坏恢复、null 语义。代码质量：无投机抽象。

```bash
git add src/memory.ts tests/memory.test.ts
git commit -m "feat: 实现文件级记忆系统（FileMemory）

由 subagent-X 完成。"
```

---

### Task 7：可观测性（Tracer）

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1、任务 2

**文件：**
- 创建： `src/tracer.ts`
- 测试： `tests/tracer.test.ts`

**接口：**
- 依赖： `TraceEntry`、`Action`（from `src/types.ts`）
- 产出： `class Tracer`：`constructor(dir)`、`record(step, action, result, feedback?): void`、`getTrace(): TraceEntry[]`、`flush(): Promise<void>`

**关键约束：**
- `record` 推入 `{ step, action, result, timestamp, feedback? }`，`timestamp` 用 `new Date().toISOString()`。
- `getTrace` 返回副本。
- `flush`：无记录时直接返回；否则 `mkdirSync(dir,{recursive:true})` 后写 `trace-<Date.now()>.json`。

- [ ] **步骤 1：编写失败测试**

创建 `tests/tracer.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Tracer } from '../src/tracer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const D = path.join(os.tmpdir(), 'agent-harness-trace-test')

describe('Tracer', () => {
  let t: Tracer
  beforeEach(() => { try { fs.rmSync(D, { recursive: true, force: true }) } catch {} t = new Tracer(D) })
  afterEach(() => { try { fs.rmSync(D, { recursive: true, force: true }) } catch {} })

  it('records a step', () => {
    t.record(1, { type: 'call_tool', tool: 'read_file', args: { path: 'x' } }, 'content')
    expect(t.getTrace().length).toBe(1)
    expect(t.getTrace()[0].step).toBe(1)
  })

  it('records feedback when provided', () => {
    t.record(1, { type: 'call_tool', tool: 'read_file', args: { path: 'x' } }, 'err', '工具失败')
    expect(t.getTrace()[0].feedback).toBe('工具失败')
  })

  it('returns empty when nothing recorded', () => {
    expect(t.getTrace().length).toBe(0)
  })

  it('flushes to disk', async () => {
    t.record(1, { type: 'done', answer: 'done' }, '')
    await t.flush()
    expect(fs.readdirSync(D).length).toBeGreaterThan(0)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/tracer.test.ts
```

预期： FAIL。

- [ ] **步骤 3：实现 `src/tracer.ts`**（subagent 自主编写）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/tracer.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：feedback 字段、副本返回、flush 行为。代码质量：最小实现。

```bash
git add src/tracer.ts tests/tracer.test.ts
git commit -m "feat: 实现可观测性 Tracer

由 subagent-X 完成。"
```

---

### Task 8：Agent 主循环（Harness Core）

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1、2、3、4、5、6、7

**文件：**
- 创建： `src/harness.ts`、`src/config.ts`
- 测试： `tests/harness.test.ts`

**接口：**
- 依赖： `LLMProvider`、`ToolRegistry`、`guardrail`/`DEFAULT_DANGEROUS_PATTERNS`/`Approver`、`FileMemory`、`Tracer`、全类型
- 产出：
  - `interface RunOptions { maxSteps: number; dangerousPatterns: DangerousPattern[]; memory: FileMemory; tracer: Tracer; approver?: Approver }`
  - `function runAgent(goal: string, llm: LLMProvider, tools: ToolRegistry, options: RunOptions): Promise<string>`
  - `function loadConfig(overrides?: Partial<HarnessConfig>): HarnessConfig`（`config.ts`，**复用** `DEFAULT_DANGEROUS_PATTERNS`，不重复定义正则）

**关键约束（主循环按 SPEC §5.2 数据流分支，subagent 据此实现）：**
1. 初始 context = system prompt + goal；从 memory 读 `project_context` 注入（若有）。
2. `while (!done && steps < maxSteps)`：`steps++`，调 `llm.chat`。
3. `action` 为 null → push assistant message、continue。
4. `guardrail(action)`：
   - `allow` → 执行
   - `deny` → 回灌"该动作被策略拦截: {reason}"、record、continue（agent 继续循环换路径）
   - `escalate` → 若 `options.approver` 存在，`const ok = await approver(action)`；`ok` 为 true → 放行执行；false → 回灌拒绝、record、continue。**无 approver 时 escalate 降级为 deny**（MVP 默认行为，在注释标明）。
5. `done` → `answer = action.answer || 'Task completed'`、done=true、record、continue。
6. `call_tool` → `tools.execute`：成功 push 结果文本；失败 push 结果文本**并** push 反馈 `工具执行失败: {error}。请修正你的方法后重试。`、record（含 feedback）。异常 → push 异常文本 + 反馈、record。
7. `take_note` → 用 `action.noteKey`/`noteValue`（**不 split 字符串**）写 memory。
8. 未知 action type → push "未知动作类型"、record。
9. 循环结束：`memory.consolidate()`、`tracer.flush()`；未 done → 返回 `达到最大步数 ({maxSteps})...`；否则返回 answer。
- `config.ts` 必须从 `guardrail.ts` import `DEFAULT_DANGEROUS_PATTERNS` 复用（DRY）。

- [ ] **步骤 1：编写失败测试**

创建 `tests/harness.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { runAgent } from '../src/harness'
import { MockLLM } from '../src/llm/mock'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import { FileMemory } from '../src/memory'
import { Tracer } from '../src/tracer'
import { DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TMP = path.join(os.tmpdir(), 'agent-harness-loop-' + Date.now())

function setup() {
  fs.mkdirSync(TMP, { recursive: true })
  const llm = new MockLLM()
  const registry = new ToolRegistry()
  registry.register(new ReadFileTool()); registry.register(new WriteFileTool()); registry.register(new ShellTool(30))
  const memory = new FileMemory(path.join(TMP, 'memory.json'))
  const tracer = new Tracer(path.join(TMP, 'traces'))
  return { llm, registry, memory, tracer }
}

describe('runAgent', () => {
  beforeEach(() => { try { fs.rmSync(TMP, { recursive: true, force: true }) } catch {} })

  it('completes on done action', async () => {
    const { llm, registry, memory, tracer } = setup()
    llm.setResponse({ type: 'done', answer: 'Task completed' })
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toContain('completed')
  })

  it('stops after maxSteps', async () => {
    const { llm, registry, memory, tracer } = setup()
    llm.setResponse({ type: 'call_tool', tool: 'read_file', args: { path: 'nonexistent' } })
    const r = await runAgent('goal', llm, registry, { maxSteps: 3, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toContain('达到最大步数')
  })

  it('feedback changes next action (demo② core)', async () => {
    const { llm, registry, memory, tracer } = setup()
    llm.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: '/nonexistent_demo_xyz' } },
      { type: 'done', answer: 'switched approach after feedback' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    // 验证：agent 收到反馈后改变动作（第二步 done 而非重试同一失败动作）
    expect(r).toContain('switched approach')
    const trace = tracer.getTrace()
    expect(trace.some(t => t.feedback !== undefined)).toBe(true)
    expect(trace.some(t => t.action.type === 'done')).toBe(true)
  })

  it('deny disposition lets agent continue loop', async () => {
    const { llm, registry, memory, tracer } = setup()
    // fork 炸弹 → deny → 回灌 → 第二步 done
    llm.setResponses([
      { type: 'call_tool', tool: 'shell', args: { command: ':(){ :|:& };:' } },
      { type: 'done', answer: 'avoided fork bomb' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toContain('avoided fork bomb')
  })

  it('escalate calls approver; false → rejection feedback', async () => {
    const { llm, registry, memory, tracer } = setup()
    let called = false
    const approver = async () => { called = true; return false }
    llm.setResponses([
      { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } },
      { type: 'done', answer: 'gave up destructive action' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer, approver })
    expect(called).toBe(true)
    expect(r).toContain('gave up')
  })

  it('escalate approver true executes action (safe custom pattern)', async () => {
    const { llm, registry, memory, tracer } = setup()
    // 用自定义分级表：把安全的 echo 升级为 escalate，approver true → 真执行 echo
    const patterns = [{ pattern: /^echo/, disposition: 'escalate' as const, reason: 'test escalate' }]
    const approver = async () => true
    llm.setResponses([
      { type: 'call_tool', tool: 'shell', args: { command: 'echo hi' } },
      { type: 'done', answer: 'done' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: patterns, memory, tracer, approver })
    expect(r).toContain('done')
    expect(tracer.getTrace().some(t => t.result.includes('hi'))).toBe(true)
  })
}, { timeout: 15000 })
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/harness.test.ts
```

预期： FAIL — `src/harness.ts` 不存在。

- [ ] **步骤 3：实现 `src/harness.ts`、`src/config.ts`**（subagent 自主编写，严格按上述分支约束）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/harness.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：三态分流、deny/escalate 语义、反馈改变动作、take_note 用 noteKey/noteValue、config 复用 DEFAULT_DANGEROUS_PATTERNS。代码质量：分支清晰、无投机代码、错误处理最小。

```bash
git add src/harness.ts src/config.ts tests/harness.test.ts
git commit -m "feat: 实现 agent 主循环（三态护栏分流 + 反馈闭环 + HITL approver）

由 subagent-X 完成。"
```

---

### Task 9：凭据管理

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1、任务 2

**文件：**
- 创建： `src/credentials.ts`
- 测试： `tests/credentials.test.ts`

**接口：**
- 依赖： `HarnessConfig`（from `src/config.ts`，即任务 8 产出）
- 产出： `class CredentialManager`：`constructor(filePath)`、`isConfigured(): boolean`、`save(apiKey, masterPassword): Promise<void>`、`load(masterPassword): Promise<string>`、`clear(): Promise<void>`

**关键约束：**
- 算法 `aes-256-gcm`；`KEY_LENGTH=32`、`IV_LENGTH=16`、`TAG_LENGTH=16`、`SALT_LENGTH=32`。
- 密钥派生 `crypto.pbkdf2Sync(masterPassword, salt, 100000, 32, 'sha256')`。
- payload 布局：`Buffer.concat([salt, iv, tag, encrypted])`。
- `save` 后 `configured=true`；`load` 错误密码 → 抛（GCM auth tag 校验失败）；`clear` 删文件、`configured=false`。
- 构造时 `configured = fs.existsSync(filePath)`。

- [ ] **步骤 1：编写失败测试**

创建 `tests/credentials.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CredentialManager } from '../src/credentials'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const P = path.join(os.tmpdir(), 'agent-harness-cred-test.enc')

describe('CredentialManager', () => {
  let m: CredentialManager
  beforeEach(() => { try { fs.unlinkSync(P) } catch {} m = new CredentialManager(P) })
  afterEach(() => { try { fs.unlinkSync(P) } catch {} })

  it('not configured initially', () => {
    expect(m.isConfigured()).toBe(false)
  })

  it('stores and retrieves', async () => {
    await m.save('sk-test-123', 'pw')
    expect(await m.load('pw')).toBe('sk-test-123')
    expect(m.isConfigured()).toBe(true)
  })

  it('fails with wrong password', async () => {
    await m.save('sk-test', 'correct')
    await expect(m.load('wrong')).rejects.toThrow()
  })

  it('clears credentials', async () => {
    await m.save('sk-test', 'pw')
    await m.clear()
    expect(m.isConfigured()).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/credentials.test.ts
```

预期： FAIL。

- [ ] **步骤 3：实现 `src/credentials.ts`**（subagent 自主编写）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/credentials.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：AES-256-GCM、pbkdf2 100000、payload 布局、不回显明文。代码质量：crypto 用法正确、无明文泄露路径。

```bash
git add src/credentials.ts tests/credentials.test.ts
git commit -m "feat: 实现凭据加密存储（AES-256-GCM）

由 subagent-X 完成。"
```

---

### Task 10：CLI 入口

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1–9

**文件：**
- 创建： `src/index.ts`
- 测试： `tests/cli.test.ts`

**接口：**
- 依赖： 全部模块
- 产出： CLI 入口，含 `run` / `config` / `web` 三个命令

**关键约束：**
- 顶部 `import 'dotenv/config'`（从 `.env` 加载环境变量）。
- `run <goal>`：装配 ToolRegistry（read/write/shell）、CredentialManager、FileMemory、Tracer；`--mock` 用 MockLLM，否则用 DeepSeekProvider。真实模式：未配置 key 且无 `DEEPSEEK_API_KEY` → 报错退出；key 取自 env 或 `creds.load(promptPassword())`。
- `config`：`--status` 显示"已配置/未配置"不回显明文；`--clear` 清除；无选项→交互式隐藏输入 key + 主密码 + 确认。
- `web`：启动任务 12 的 Express 服务器。
- **主入口守卫**：`const isMain = process.argv[1]?.includes('index')`，仅 `isMain` 时 `program.parse(process.argv)`——防止 vitest import 时触发 CLI 解析。

- [ ] **步骤 1：编写失败测试**

创建 `tests/cli.test.ts`（轻量，仅验证模块可加载）：

```typescript
import { describe, it, expect } from 'vitest'

describe('CLI entry', () => {
  it('module loads without error', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/cli.test.ts
```

预期： FAIL — `src/index.ts` 不存在。

- [ ] **步骤 3：实现 `src/index.ts`**（subagent 自主编写，含上述三命令 + 主入口守卫 + dotenv 加载）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/cli.test.ts
npm run build
node dist/index.js --help
```

预期： 测试 PASS；help 文本含 `run`、`config`、`web`。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：dotenv 加载、隐藏输入、不回显、主入口守卫、web 命令接任务 12。代码质量：错误信息可读、无 process.exit 滥用。

```bash
git add src/index.ts tests/cli.test.ts
git commit -m "feat: 实现 CLI entry（run/config/web + dotenv + 主入口守卫）

由 subagent-X 完成。"
```

---

### Task 11：机制演示测试

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1、2、3、4、5、8

**文件：**
- 测试： `tests/mechanism-demo.test.ts`

**接口：**
- 产出： §A.6 机制演示——mock LLM 下确定性复现 ① 护栏拦截危险动作 ② 反馈闭环使 agent 改变下一步动作 ③ 反馈闭环多轮确定性行为

> 本 task 的测试代码是交付物（机制演示），给完整代码。三个演示均不依赖网络与真实 LLM。

- [ ] **步骤 1：编写 `tests/mechanism-demo.test.ts`**

```typescript
/**
 * 机制演示（§A.6）——不依赖真实 LLM 与网络
 * ① 治理护栏拦截危险动作（三态分级）
 * ② 注入失败，反馈闭环使 agent 收到反馈并据此改变下一步动作
 * ③ 重点维度（反馈闭环）多轮确定性行为
 */
import { describe, it, expect } from 'vitest'
import { guardrail, DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import { runAgent } from '../src/harness'
import { MockLLM } from '../src/llm/mock'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import { FileMemory } from '../src/memory'
import { Tracer } from '../src/tracer'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

const DEMO = path.join(os.tmpdir(), 'agent-harness-demo-' + Date.now())
function setup(memFile = 'memory.json', traceDir = 'traces') {
  fs.mkdirSync(DEMO, { recursive: true })
  const llm = new MockLLM()
  const reg = new ToolRegistry()
  reg.register(new ReadFileTool()); reg.register(new WriteFileTool()); reg.register(new ShellTool(30))
  return { llm, reg, mem: new FileMemory(path.join(DEMO, memFile)), tr: new Tracer(path.join(DEMO, traceDir)) }
}

describe('① Guardrail 三态拦截', () => {
  it('escalates rm -rf / (确定)', () => {
    const a = { type: 'call_tool' as const, tool: 'shell', args: { command: 'rm -rf /' } }
    const r = guardrail(a, DEFAULT_DANGEROUS_PATTERNS)
    expect(r.disposition).toBe('escalate'); expect(r.reason).toBeDefined()
    expect(guardrail(a, DEFAULT_DANGEROUS_PATTERNS)).toEqual(r) // 确定性
  })

  it('denies fork bomb', () => {
    const a = { type: 'call_tool' as const, tool: 'shell', args: { command: ':(){ :|:& };:' } }
    expect(guardrail(a, DEFAULT_DANGEROUS_PATTERNS).disposition).toBe('deny')
  })

  it('allows safe command', () => {
    const a = { type: 'call_tool' as const, tool: 'shell', args: { command: 'ls -la' } }
    expect(guardrail(a, DEFAULT_DANGEROUS_PATTERNS).disposition).toBe('allow')
  })
})

describe('② 反馈闭环使 agent 改变下一步动作', () => {
  it('失败→反馈→改走 done', async () => {
    const { llm, reg, mem, tr } = setup()
    llm.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: '/nonexistent_demo_xyz' } },
      { type: 'done', answer: 'changed approach after feedback' },
    ])
    const r = await runAgent('demo feedback', llm, reg, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory: mem, tracer: tr })
    expect(r).toContain('changed approach')      // 改变了动作
    const trace = tr.getTrace()
    expect(trace.some(t => t.feedback !== undefined)).toBe(true)  // 收到反馈
    expect(trace.some(t => t.action.type === 'done')).toBe(true)  // 第二步改走 done
  })
})

describe('③ 反馈闭环多轮确定性行为', () => {
  it('连续失败→每轮注入反馈→达 maxSteps 停机', async () => {
    const { llm, reg, mem, tr } = setup('m2.json', 't2')
    llm.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: '/no_x1' } },
      { type: 'call_tool', tool: 'read_file', args: { path: '/no_x2' } },
      { type: 'call_tool', tool: 'read_file', args: { path: '/no_x3' } },
    ])
    const r = await runAgent('demo multi', llm, reg, { maxSteps: 3, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory: mem, tracer: tr })
    expect(r).toContain('达到最大步数')
    const feedbacks = tr.getTrace().filter(t => t.feedback !== undefined)
    expect(feedbacks.length).toBe(3)            // 每轮都注入反馈，确定性
  })
})
```

- [ ] **步骤 2：运行演示**

```bash
npm test -- tests/mechanism-demo.test.ts
```

预期： PASS（三个 describe 全绿）。

- [ ] **步骤 3：两阶段评审 + 提交**

spec 合规：三演示对应 §A.6①②③；②验证"改变动作"而非仅"有反馈"；均确定性、无网络。代码质量：演示自包含、可独立复现。

```bash
git add tests/mechanism-demo.test.ts
git commit -m "test: 机制演示（护栏三态 + 反馈改变动作 + 多轮确定性）

由 subagent-X 完成。"
```

---

### Task 12：本地 WebUI 调试面板

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1、7

**文件：**
- 创建： `src/web/server.ts`、`src/web/public/index.html`（+ Open Design 样式）
- 测试： `tests/web.test.ts`

**接口：**
- 依赖： `HarnessConfig.tracesDir`、`Tracer` 产出的 trace JSON
- 产出： `function startWebServer(tracesDir: string, port?: number): Promise<{ url: string; close(): Promise<void> }>`；`index.ts` 的 `web` 命令调用它

**关键约束：**
- Express 服务器：`GET /` 返回 Open Design 面板 HTML；`GET /api/traces` 返回 `{ sessions: TraceEntry[][] }`（读 `tracesDir` 下所有 `trace-*.json`）。
- 无 trace 文件时 `/api/traces` 返回 `{ sessions: [] }`（空状态）。
- 默认端口 3000，可被 `port` 参数覆盖；`startWebServer` 返回 `close()` 以便测试关闭。
- 面板展示：会话列表 → 决策轨迹（step、action、result、feedback）。使用 Open Design 设计系统。
- 不依赖真实 LLM/网络（仅读本地 JSON）。

- [ ] **步骤 1：编写失败测试**

创建 `tests/web.test.ts`：

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { startWebServer } from '../src/web/server'
import { Tracer } from '../src/tracer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const D = path.join(os.tmpdir(), 'agent-harness-web-test-' + Date.now())

describe('WebUI server', () => {
  let stop: () => Promise<void>

  afterEach(async () => {
    if (stop) await stop()
    try { fs.rmSync(D, { recursive: true, force: true }) } catch {}
  })

  it('serves panel at /', async () => {
    fs.mkdirSync(D, { recursive: true })
    const srv = await startWebServer(D, 3456)
    stop = srv.close
    const res = await fetch('http://localhost:3456/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Agent') // 面板标题等
  })

  it('returns empty sessions when no traces', async () => {
    fs.mkdirSync(D, { recursive: true })
    const srv = await startWebServer(D, 3457)
    stop = srv.close
    const res = await fetch('http://localhost:3457/api/traces')
    const json = await res.json()
    expect(json.sessions).toEqual([])
  })

  it('returns sessions from trace files', async () => {
    fs.mkdirSync(D, { recursive: true })
    const tr = new Tracer(D)
    tr.record(1, { type: 'done', answer: 'hi' }, 'hi')
    await tr.flush()
    const srv = await startWebServer(D, 3458)
    stop = srv.close
    const json = await (await fetch('http://localhost:3458/api/traces')).json()
    expect(json.sessions.length).toBe(1)
    expect(json.sessions[0][0].step).toBe(1)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/web.test.ts
```

预期： FAIL — `src/web/server.ts` 不存在。

- [ ] **步骤 3：实现 `src/web/server.ts` + `public/index.html`**（subagent 自主编写，Open Design 面板）

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/web.test.ts
```

预期： PASS。

- [ ] **步骤 5：两阶段评审 + 提交**

spec 合规：读 traces、空状态、端口可覆盖、返回 close()、Open Design。代码质量：无投机路由、错误处理最小。

```bash
git add src/web/ tests/web.test.ts
git commit -m "feat: 实现本地 WebUI 调试面板（Express + Open Design 读 traces）

由 subagent-X 完成。"
```

---

### Task 13：Dockerfile

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1–12

**文件：**
- 创建： `Dockerfile`

**关键约束：**
- 多阶段构建：builder 阶段 `npm ci` + `npm run build`；运行阶段拷 `dist` + `package.json`，`npm ci --production`。
- 基础镜像 `node:20-alpine`；`EXPOSE 3000`；`ENTRYPOINT ["node","dist/index.js"]`。

- [ ] **步骤 1：编写 `Dockerfile`**（按约束，多阶段）

- [ ] **步骤 2：构建验证**

```bash
docker build -t coding-agent-harness .
```

预期： 构建成功。

- [ ] **步骤 3：两阶段评审 + 提交**

spec 合规：多阶段、alpine、EXPOSE 3000、ENTRYPOINT 正确。代码质量：层缓存合理（先拷 package.json）。

```bash
git add Dockerfile
git commit -m "chore: 添加多阶段 Dockerfile

由主 agent 完成。"
```

---

### Task 14：GitHub Actions CI

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1–13

**文件：**
- 创建： `.github/workflows/ci.yml`

**关键约束：**
- 两个 job：`unit-test`（`on: push`，`npm ci` + `npm test`）与 `docker-build`（`docker build`）。
- `unit-test` 必须名为 `unit-test`（通用要求 §五第6条硬约束）。
- 注明：通用要求示例为 `.gitlab-ci.yml`，本项目用 GitHub Actions 等价实现（与公开 GitHub 仓库一致）。
- Node 20、`actions/checkout`、`actions/setup-node`。

- [ ] **步骤 1：编写 `.github/workflows/ci.yml`**（含 unit-test + docker-build 两 job）

- [ ] **步骤 2：验证**

确认 YAML 语法正确、job 名含 `unit-test`。push 后 GitHub Actions 运行结果须为 pass（§4.8 + §五第7条）。

- [ ] **步骤 3：两阶段评审 + 提交**

spec 合规：job 名、触发条件、镜像构建。代码质量：最小配置、无多余 job。

```bash
git add .github/workflows/ci.yml
git commit -m "chore: 添加 GitHub Actions CI（unit-test + docker-build）

由主 agent 完成。"
```

---

### Task 15：AGENT_LOG.md 初始化

> 状态：⬜ 未开始 ｜ commit: — ｜ PR: —

**前置依赖：** 任务 1–14

**文件：**
- 创建： `AGENT_LOG.md`

**关键约束：**
- 按时间顺序记录；每条含时间戳、task 编号、触发的 Superpowers 技能、关键事件、人工干预。
- 初始条目记录 brainstorming → writing-plans → 冷启动验证 → 本轮审核与决策。

- [ ] **步骤 1：编写 `AGENT_LOG.md` 初始内容**（按约束）

- [ ] **步骤 2：提交**

```bash
git add AGENT_LOG.md
git commit -m "docs: 初始化 AGENT_LOG.md

由主 agent 完成。"
```

> **REFLECTION.md（1500–2500 字）由学生本人手写，不由 agent 生成，单独提交。**

---

## 全部完成后：验证

所有 15 个 task 完成后，运行以下验证：

- [ ] 全量测试：`npm test` — all green
- [ ] 机制演示：`npm test -- tests/mechanism-demo.test.ts` — ①②③ 全过
- [ ] 构建：`npm run build` — `dist/` 生成
- [ ] CLI：`node dist/index.js --help` — 含 run/config/web
- [ ] WebUI：`node dist/index.js web` → 浏览器访问 `localhost:3000` 展示 trace
- [ ] Docker：`docker build -t coding-agent-harness .` — 构建成功
- [ ] CI：push 后 GitHub Actions `unit-test` + `docker-build` 均 pass

> **注意：** 任务 1（脚手架）是所有其他 task 的前置依赖。每个 task 开独立 worktree、对应一个 PR；每完成一个 task 即更新本 task 标题的状态块（`✅ 完成 ｜ commit: <hash> ｜ PR: #<n>`）。
