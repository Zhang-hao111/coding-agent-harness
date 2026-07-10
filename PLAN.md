# MVP 实现计划 — Coding Agent Harness

> **对于 agent 执行者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 来逐 task 实现本计划。步骤使用复选框（`- [ ]`）语法追踪进度。

**目标：** 构建 Coding Agent Harness 的 MVP：agent 主循环、3 个基础工具、治理护栏、基础反馈注入、记忆系统、可观测性、CLI 入口、凭据管理、Docker 分发。

**架构：** 模块化 harness，中央 while 循环。每个组件（LLM、工具、护栏、记忆、追踪器）是独立的模块，实现定义的接口。Harness 在启动时装配并在循环中运行。

**技术栈：** TypeScript 5.x, Node.js 20+, npm, commander, vitest, tsup, openai npm 包, Node.js crypto。

## 全局约束

- 所有 API Key 必须加密存储（AES-256-GCM），绝不硬编码。
- 每个核心机制必须有 mock-LLM 单元测试，不依赖网络。
- TDD：先写失败测试，再实现，再提交。
- 代码风格：匹配现有代码风格，不做无关重构。
- Commit 消息：`<类型>: <描述>` 格式，标注 subagent 和人工修改。
- 文件路径：使用 `path` 模块实现跨平台兼容。
- Shell 命令：所有 shell 执行设 `timeout = 30s`。
- 配置：使用 `~/.agent-harness/` 目录存储所有持久化数据。

---

## 文件结构

```
coding-agent-harness/
├── src/
│   ├── index.ts              # CLI entry (commander)
│   ├── harness.ts            # Agent loop
│   ├── types.ts              # Shared type definitions
│   ├── guardrail.ts          # Dangerous action interception
│   ├── memory.ts             # File-based key-value memory
│   ├── tracer.ts             # Step-by-step observability
│   ├── config.ts             # Config loading
│   ├── credentials.ts        # Encrypted credential storage
│   ├── llm/
│   │   ├── interface.ts      # LLMProvider interface
│   │   ├── mock.ts           # MockLLM for testing
│   │   └── deepseek.ts       # DeepSeek implementation
│   └── tools/
│       ├── registry.ts       # ToolRegistry
│       ├── read_file.ts      # ReadFileTool
│       ├── write_file.ts     # WriteFileTool
│       └── shell.ts          # ShellTool
├── tests/
│   ├── llm.test.ts
│   ├── tools.test.ts
│   ├── guardrail.test.ts
│   ├── memory.test.ts
│   ├── tracer.test.ts
│   ├── harness.test.ts
│   ├── credentials.test.ts
│   └── mechanism-demo.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── Dockerfile
├── .gitignore
├── SPEC.md
├── PLAN.md
├── README.md
├── AGENT_LOG.md
└── REFLECTION.md
```

---

### 任务 1：项目脚手架

**文件：**
- 创建： `package.json`
- 创建： `tsconfig.json`
- 创建： `tsup.config.ts`
- 创建： `vitest.config.ts`
- 创建： `.gitignore` (update existing)

**接口：**
- 产出： build system that compiles `src/` to `dist/`, runs tests via `vitest`

- [ ] **步骤 1: Write package.json**

```json
{
  "name": "coding-agent-harness",
  "version": "0.1.0",
  "description": "A lightweight coding agent harness with feedback-driven self-correction loops",
  "type": "module",
  "bin": {
    "agent-harness": "dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "agent-harness": "node dist/index.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "openai": "^4.0.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsup": "^8.0.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0"
  }
}
```

- [ ] **步骤 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **步骤 3: Write tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
})
```

- [ ] **步骤 4: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **步骤 5: Update .gitignore**

```
node_modules/
dist/
.env
*.log
~/.agent-harness/
.idea/
```

- [ ] **步骤 6: Verify scaffold**

```bash
npm install
ls node_modules/.package-lock.json
```

预期： `node_modules/` populated, `package-lock.json` present.

- [ ] **步骤 7: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore
git commit -m "chore: 初始化项目脚手架

TypeScript 5.x + tsup + vitest + commander 技术栈。
由主 agent 完成。"
```

---

### 任务 2：类型定义

**前置依赖：** Task 1 (脚手架)

**文件：**
- 创建： `src/types.ts`

**接口：**
- 产出： `Action`, `ToolResult`, `GuardrailResult`, `TraceEntry`, `MemoryEntry`, `SessionState`, `Message`, `LLMResponse`, `ToolDef`

- [ ] **步骤 1：编写失败测试**

Create `tests/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Action } from '../src/types'

describe('Type definitions', () => {
  it('Action type is valid', () => {
    const action: Action = { type: 'done', answer: 'test' }
    expect(action.type).toBe('done')
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/types.test.ts
```

预期： FAIL — `src/types.ts` not found, therefore `import { Action }` fails.

- [ ] **步骤 3: Write types.ts**

```typescript
// ── Action ──
export type ActionType = 'call_tool' | 'done' | 'take_note' | 'spawn_subagent' | 'use_skill'

export interface Action {
  type: ActionType
  tool?: string
  args?: Record<string, unknown>
  answer?: string
  note?: string
  subtask?: string
  scope?: string
  skillName?: string
}

// ── Tool ──
export interface ToolDef {
  name: string
  description: string
  execute(args: Record<string, unknown>): Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  data: string
  error?: string
}

// ── LLM ──
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ToolChoice {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface LLMResponse {
  message: Message
  action: Action | null
}

// ── Guardrail ──
export interface GuardrailResult {
  allowed: boolean
  reason?: string
}

// ── Trace ──
export interface TraceEntry {
  step: number
  action: Action
  result: string
  timestamp: string
  feedback?: string
}

// ── Memory ──
export interface MemoryEntry {
  key: string
  value: string
  createdAt: string
  updatedAt: string
}

// ── Session ──
export interface SessionState {
  goal: string
  steps: number
  maxSteps: number
  context: Message[]
  done: boolean
  answer: string | null
}

// ── Config ──
export interface HarnessConfig {
  maxSteps: number
  dangerousPatterns: RegExp[]
  memoryPath: string
  tracesDir: string
  credentialsPath: string
}
```

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/types.test.ts
```

预期： PASS.

- [ ] **步骤 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: 定义核心类型（Action、ToolResult、TraceEntry 等）

由主 agent 完成。"
```

---

### 任务 3：LLM 抽象层

**前置依赖：** Task 1, Task 2

**文件：**
- 创建： `src/llm/interface.ts`
- 创建： `src/llm/mock.ts`
- 创建： `src/llm/deepseek.ts`

**接口：**
- 依赖： `Message`, `ToolChoice`, `LLMResponse`, `Action` (from `src/types.ts`)
- 产出： `LLMProvider` interface, `MockLLM` class, `DeepSeekProvider` class

- [ ] **步骤 1：编写失败测试**

Create `tests/llm.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { MockLLM } from '../src/llm/mock'
import { Message, ToolChoice } from '../src/types'

describe('MockLLM', () => {
  let mock: MockLLM

  beforeEach(() => {
    mock = new MockLLM()
  })

  it('returns a preset response', async () => {
    mock.setResponse({ type: 'done', answer: 'Task complete' })
    const result = await mock.chat(
      [{ role: 'user', content: 'hello' }],
      []
    )
    expect(result.action?.type).toBe('done')
    expect(result.action?.answer).toBe('Task complete')
  })

  it('throws when no response is preset', async () => {
    await expect(
      mock.chat([{ role: 'user', content: 'hello' }], [])
    ).rejects.toThrow('No preset response configured')
  })

  it('records conversation history', async () => {
    mock.setResponse({ type: 'done', answer: 'ok' })
    await mock.chat([{ role: 'user', content: 'first' }], [])
    expect(mock.getHistory().length).toBeGreaterThan(0)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/llm.test.ts
```

预期： FAIL — `src/llm/mock.ts` not found.

- [ ] **步骤 3: Write interface.ts**

```typescript
import { Message, ToolChoice, LLMResponse } from '../types'

export interface LLMProvider {
  chat(messages: Message[], tools: ToolChoice[]): Promise<LLMResponse>
}
```

- [ ] **步骤 4: Write mock.ts**

```typescript
import { LLMProvider } from './interface'
import { Message, ToolChoice, LLMResponse, Action } from '../types'

export class MockLLM implements LLMProvider {
  private presetResponse: Action | null = null
  private history: Message[] = []
  private delayMs: number = 0

  setResponse(action: Action): void {
    this.presetResponse = action
  }

  setDelay(ms: number): void {
    this.delayMs = ms
  }

  getHistory(): Message[] {
    return [...this.history]
  }

  async chat(messages: Message[], tools: ToolChoice[]): Promise<LLMResponse> {
    this.history = [...messages]
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs))
    }
    if (!this.presetResponse) {
      throw new Error('No preset response configured')
    }
    const action = this.presetResponse
    this.presetResponse = null // one-shot by default
    return {
      message: { role: 'assistant', content: action.type === 'done' ? action.answer || '' : '' },
      action,
    }
  }
}
```

- [ ] **步骤 5: Write deepseek.ts**

```typescript
import OpenAI from 'openai'
import { LLMProvider } from './interface'
import { Message, ToolChoice, LLMResponse, Action } from '../types'

export class DeepSeekProvider implements LLMProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string = 'deepseek-chat') {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    })
    this.model = model
  }

  async chat(messages: Message[], tools: ToolChoice[]): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const content = response.choices[0]?.message?.content || ''
    // For MVP: parse text response for action keywords
    // Deep phase: use structured output / function calling
    const action = this.parseAction(content)
    return {
      message: { role: 'assistant', content },
      action,
    }
  }

  private parseAction(content: string): Action | null {
    // Simple heuristic: detect "DONE" marker in response
    if (content.includes('DONE')) {
      return { type: 'done', answer: content.replace('DONE', '').trim() }
    }
    // Default: treat as a tool call request
    return null
  }
}
```

- [ ] **步骤 6: Run test to verify it passes**

```bash
npm test -- tests/llm.test.ts
```

预期： PASS.

- [ ] **步骤 7: Commit**

```bash
git add src/llm/interface.ts src/llm/mock.ts src/llm/deepseek.ts tests/llm.test.ts
git commit -m "feat: 实现 LLM 抽象层（MockLLM + DeepSeekProvider）

由主 agent 完成。"
```

---

### 任务 4：工具系统

**前置依赖：** Task 1, Task 2

**文件：**
- 创建： `src/tools/registry.ts`
- 创建： `src/tools/read_file.ts`
- 创建： `src/tools/write_file.ts`
- 创建： `src/tools/shell.ts`

**接口：**
- 依赖： `ToolDef`, `ToolResult` (from `src/types.ts`)
- 产出： `ToolRegistry` class, `ReadFileTool`, `WriteFileTool`, `ShellTool`

- [ ] **步骤 1：编写失败测试**

Create `tests/tools.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TMP_DIR = path.join(os.tmpdir(), 'agent-harness-test-' + Date.now())

describe('ToolRegistry', () => {
  it('registers and lists tools', () => {
    const reg = new ToolRegistry()
    reg.register(new ReadFileTool())
    reg.register(new WriteFileTool())
    reg.register(new ShellTool(30))
    const names = reg.list().map(t => t.name)
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
    expect(names).toContain('shell')
  })

  it('executes a registered tool', async () => {
    const reg = new ToolRegistry()
    reg.register(new ReadFileTool())
    await expect(reg.execute('read_file', { path: '/nonexistent' })).resolves.toBeDefined()
  })

  it('throws for unknown tool', async () => {
    const reg = new ToolRegistry()
    await expect(reg.execute('unknown', {})).rejects.toThrow('Unknown tool')
  })
})

describe('ReadFileTool', () => {
  beforeEach(() => { fs.mkdirSync(TMP_DIR, { recursive: true }) })
  afterEach(() => { fs.rmSync(TMP_DIR, { recursive: true, force: true }) })

  it('reads an existing file', async () => {
    const filePath = path.join(TMP_DIR, 'test.txt')
    fs.writeFileSync(filePath, 'hello world', 'utf-8')
    const tool = new ReadFileTool()
    const result = await tool.execute({ path: filePath })
    expect(result.success).toBe(true)
    expect(result.data).toBe('hello world')
  })

  it('returns error for missing file', async () => {
    const tool = new ReadFileTool()
    const result = await tool.execute({ path: path.join(TMP_DIR, 'missing.txt') })
    expect(result.success).toBe(false)
    expect(result.error).toContain('不存在')
  })
})

describe('WriteFileTool', () => {
  beforeEach(() => { fs.mkdirSync(TMP_DIR, { recursive: true }) })
  afterEach(() => { fs.rmSync(TMP_DIR, { recursive: true, force: true }) })

  it('writes content to a file', async () => {
    const filePath = path.join(TMP_DIR, 'output.txt')
    const tool = new WriteFileTool()
    const result = await tool.execute({ path: filePath, content: 'test content' })
    expect(result.success).toBe(true)
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('test content')
  })

  it('creates directories automatically', async () => {
    const filePath = path.join(TMP_DIR, 'sub/deep/output.txt')
    const tool = new WriteFileTool()
    const result = await tool.execute({ path: filePath, content: 'nested' })
    expect(result.success).toBe(true)
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('nested')
  })
})

describe('ShellTool', () => {
  it('executes a command and returns output', async () => {
    const tool = new ShellTool(30)
    const result = await tool.execute({ command: 'echo hello' })
    expect(result.success).toBe(true)
    expect(result.data).toContain('hello')
  })

  it('captures stderr on failure', async () => {
    const tool = new ShellTool(30)
    const result = await tool.execute({ command: 'nonexistent_cmd_xyz' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/tools.test.ts
```

预期： FAIL — tool files not found.

- [ ] **步骤 3: Write read_file.ts**

```typescript
import { ToolDef, ToolResult } from '../types'
import * as fs from 'fs'

export class ReadFileTool implements ToolDef {
  name = 'read_file'
  description = 'Read the contents of a file at the given path'

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.path as string
    if (!filePath) {
      return { success: false, data: '', error: '缺少 path 参数' }
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (err: any) {
      return { success: false, data: '', error: `文件不存在或无法读取: ${err.message}` }
    }
  }
}
```

- [ ] **步骤 4: Write write_file.ts**

```typescript
import { ToolDef, ToolResult } from '../types'
import * as fs from 'fs'
import * as path from 'path'

export class WriteFileTool implements ToolDef {
  name = 'write_file'
  description = 'Write content to a file at the given path, creating directories as needed'

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.path as string
    const content = args.content as string
    if (!filePath) {
      return { success: false, data: '', error: '缺少 path 参数' }
    }
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, content || '', 'utf-8')
      return { success: true, data: `写入成功: ${filePath}` }
    } catch (err: any) {
      return { success: false, data: '', error: `写入失败: ${err.message}` }
    }
  }
}
```

- [ ] **步骤 5: Write shell.ts**

```typescript
import { ToolDef, ToolResult } from '../types'
import { execSync } from 'child_process'

export class ShellTool implements ToolDef {
  name = 'shell'
  description = 'Execute a shell command and return its output'
  private timeout: number

  constructor(timeout: number = 30) {
    this.timeout = timeout
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args.command as string
    if (!command) {
      return { success: false, data: '', error: '缺少 command 参数' }
    }
    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        timeout: this.timeout * 1000,
        maxBuffer: 10 * 1024 * 1024,
      })
      return { success: true, data: output.trim() }
    } catch (err: any) {
      const stderr = err.stderr?.toString() || err.message || ''
      return { success: false, data: err.stdout?.toString() || '', error: stderr }
    }
  }
}
```

- [ ] **步骤 6: Write registry.ts**

```typescript
import { ToolDef, ToolResult } from '../types'

export class ToolRegistry {
  private tools: Map<string, ToolDef> = new Map()

  register(tool: ToolDef): void {
    this.tools.set(tool.name, tool)
  }

  list(): ToolDef[] {
    return Array.from(this.tools.values())
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name)
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`)
    }
    return tool.execute(args)
  }
}
```

- [ ] **步骤 7: Run test to verify it passes**

```bash
npm test -- tests/tools.test.ts
```

预期： PASS.

- [ ] **步骤 8: Commit**

```bash
git add src/tools/ tests/tools.test.ts
git commit -m "feat: 实现工具系统（read_file / write_file / shell + registry）

由主 agent 完成。"
```

---

### 任务 5：治理护栏（Guardrail）

**前置依赖：** Task 1, Task 2

**文件：**
- 创建： `src/guardrail.ts`

**接口：**
- 依赖： `Action`, `GuardrailResult` (from `src/types.ts`)
- 产出： `guardrail(action, dangerousPatterns?)` function

- [ ] **步骤 1：编写失败测试**

Create `tests/guardrail.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { guardrail, DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import { Action } from '../src/types'

describe('guardrail', () => {
  it('allows safe shell commands', () => {
    const action: Action = { type: 'call_tool', tool: 'shell', args: { command: 'ls -la' } }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(true)
  })

  it('blocks rm -rf /', () => {
    const action: Action = { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('blocks dd if=/dev/zero', () => {
    const action: Action = { type: 'call_tool', tool: 'shell', args: { command: 'dd if=/dev/zero of=/dev/sda' } }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(false)
  })

  it('blocks mkfs commands', () => {
    const action: Action = { type: 'call_tool', tool: 'shell', args: { command: 'mkfs.ext4 /dev/sda1' } }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(false)
  })

  it('allows non-shell actions', () => {
    const action: Action = { type: 'call_tool', tool: 'read_file', args: { path: 'test.txt' } }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(true)
  })

  it('allows done action', () => {
    const action: Action = { type: 'done', answer: 'done' }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(true)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/guardrail.test.ts
```

预期： FAIL — `src/guardrail.ts` not found.

- [ ] **步骤 3: Write guardrail.ts**

```typescript
import { Action, GuardrailResult } from './types'

export const DEFAULT_DANGEROUS_PATTERNS: RegExp[] = [
  /^rm\s+-rf\s+\//,
  /^dd\s+if=/,  
  /^mkfs/,
  /^:\(\)\{\s*:\s*\|\|:\s*&\};:/,
  /^>\/dev\/sda/,
  /^fdisk/,
]

export function guardrail(
  action: Action,
  patterns: RegExp[] = DEFAULT_DANGEROUS_PATTERNS
): GuardrailResult {
  if (action.type !== 'call_tool' || action.tool !== 'shell') {
    return { allowed: true }
  }

  const command = (action.args?.command as string) || ''
  for (const pattern of patterns) {
    if (pattern.test(command.trim())) {
      return { allowed: false, reason: `危险命令被拦截: 匹配模式 ${pattern}` }
    }
  }

  return { allowed: true }
}
```

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/guardrail.test.ts
```

预期： PASS.

- [ ] **步骤 5: Commit**

```bash
git add src/guardrail.ts tests/guardrail.test.ts
git commit -m "feat: 实现 guardrail 危险命令拦截

由主 agent 完成。"
```

---

### 任务 6：记忆系统

**前置依赖：** Task 1, Task 2

**文件：**
- 创建： `src/memory.ts`

**接口：**
- 依赖： `MemoryEntry` (from `src/types.ts`)
- 产出： `FileMemory` class

- [ ] **步骤 1：编写失败测试**

Create `tests/memory.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileMemory } from '../src/memory'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const MEM_PATH = path.join(os.tmpdir(), 'agent-harness-mem-test.json')

describe('FileMemory', () => {
  let mem: FileMemory

  beforeEach(() => {
    try { fs.unlinkSync(MEM_PATH) } catch {}
    mem = new FileMemory(MEM_PATH)
  })

  afterEach(() => {
    try { fs.unlinkSync(MEM_PATH) } catch {}
  })

  it('returns null for unknown key', async () => {
    const result = await mem.read('nonexistent')
    expect(result).toBeNull()
  })

  it('stores and retrieves a value', async () => {
    await mem.write('project_language', 'TypeScript')
    const result = await mem.read('project_language')
    expect(result).toBe('TypeScript')
  })

  it('overwrites existing key', async () => {
    await mem.write('key', 'value1')
    await mem.write('key', 'value2')
    const result = await mem.read('key')
    expect(result).toBe('value2')
  })

  it('persists data to disk', async () => {
    await mem.write('persist', 'data')
    const mem2 = new FileMemory(MEM_PATH)
    const result = await mem2.read('persist')
    expect(result).toBe('data')
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/memory.test.ts
```

预期： FAIL.

- [ ] **步骤 3: Write memory.ts**

```typescript
import { MemoryEntry } from './types'
import * as fs from 'fs'
import * as path from 'path'

export class FileMemory {
  private filePath: string
  private data: Map<string, MemoryEntry> = new Map()
  private dirty: boolean = false

  constructor(filePath: string) {
    this.filePath = filePath
    this.load()
  }

  async read(key: string): Promise<string | null> {
    const entry = this.data.get(key)
    return entry ? entry.value : null
  }

  async write(key: string, value: string): Promise<void> {
    const now = new Date().toISOString()
    const existing = this.data.get(key)
    this.data.set(key, {
      key,
      value,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    })
    this.dirty = true
  }

  async consolidate(): Promise<void> {
    if (!this.dirty) return
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      const entries = Array.from(this.data.values())
      fs.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), 'utf-8')
      this.dirty = false
    } catch (err: any) {
      console.error(`Memory consolidate failed: ${err.message}`)
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const entries: MemoryEntry[] = JSON.parse(raw)
        for (const entry of entries) {
          this.data.set(entry.key, entry)
        }
      }
    } catch {
      this.data.clear()
    }
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/memory.test.ts
```

预期： PASS.

- [ ] **步骤 5: Commit**

```bash
git add src/memory.ts tests/memory.test.ts
git commit -m "feat: 实现文件级记忆系统（FileMemory）

由主 agent 完成。"
```

---

### 任务 7：可观测性（Tracer）

**前置依赖：** Task 1, Task 2

**文件：**
- 创建： `src/tracer.ts`

**接口：**
- 依赖： `TraceEntry`, `Action` (from `src/types.ts`)
- 产出： `Tracer` class

- [ ] **步骤 1：编写失败测试**

Create `tests/tracer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Tracer } from '../src/tracer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TRACE_DIR = path.join(os.tmpdir(), 'agent-harness-trace-test')

describe('Tracer', () => {
  let tracer: Tracer

  beforeEach(() => {
    try { fs.rmSync(TRACE_DIR, { recursive: true, force: true }) } catch {}
    tracer = new Tracer(TRACE_DIR)
  })

  afterEach(() => {
    try { fs.rmSync(TRACE_DIR, { recursive: true, force: true }) } catch {}
  })

  it('records a step', () => {
    tracer.record(1, { type: 'call_tool', tool: 'read_file', args: { path: 'test.txt' } }, 'file content')
    const trace = tracer.getTrace()
    expect(trace.length).toBe(1)
    expect(trace[0].step).toBe(1)
  })

  it('returns empty trace when nothing recorded', () => {
    const trace = tracer.getTrace()
    expect(trace.length).toBe(0)
  })

  it('flushes trace to disk', async () => {
    tracer.record(1, { type: 'done', answer: 'done' }, '')
    await tracer.flush()
    const files = fs.readdirSync(TRACE_DIR)
    expect(files.length).toBeGreaterThan(0)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/tracer.test.ts
```

预期： FAIL.

- [ ] **步骤 3: Write tracer.ts**

```typescript
import { TraceEntry, Action } from './types'
import * as fs from 'fs'
import * as path from 'path'

export class Tracer {
  private traces: TraceEntry[] = []
  private dir: string

  constructor(dir: string) {
    this.dir = dir
  }

  record(step: number, action: Action, result: string, feedback?: string): void {
    this.traces.push({
      step,
      action,
      result,
      timestamp: new Date().toISOString(),
      feedback,
    })
  }

  getTrace(): TraceEntry[] {
    return [...this.traces]
  }

  async flush(): Promise<void> {
    if (this.traces.length === 0) return
    try {
      fs.mkdirSync(this.dir, { recursive: true })
      const fileName = `trace-${Date.now()}.json`
      fs.writeFileSync(
        path.join(this.dir, fileName),
        JSON.stringify(this.traces, null, 2),
        'utf-8'
      )
    } catch (err: any) {
      console.error(`Tracer flush failed: ${err.message}`)
    }
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/tracer.test.ts
```

预期： PASS.

- [ ] **步骤 5: Commit**

```bash
git add src/tracer.ts tests/tracer.test.ts
git commit -m "feat: 实现可观测性 Tracer

由主 agent 完成。"
```

---

### 任务 8：Agent 主循环（Harness Core）

**前置依赖：** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7

**文件：**
- 创建： `src/harness.ts`
- 创建： `src/config.ts`

**接口：**
- 依赖： `LLMProvider`, `ToolRegistry`, `guardrail`, `FileMemory`, `Tracer`, all types
- 产出： `runAgent(goal, llm, registry, config)` function

- [ ] **步骤 1：编写失败测试**

Create `tests/harness.test.ts`:

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
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TMP_DIR = path.join(os.tmpdir(), 'agent-harness-loop-test-' + Date.now())

describe('runAgent', () => {
  let llm: MockLLM
  let registry: ToolRegistry
  let mem: FileMemory
  let tracer: Tracer

  beforeEach(() => {
    llm = new MockLLM()
    registry = new ToolRegistry()
    registry.register(new ReadFileTool())
    registry.register(new WriteFileTool())
    registry.register(new ShellTool(30))
    mem = new FileMemory(path.join(TMP_DIR, 'memory.json'))
    tracer = new Tracer(path.join(TMP_DIR, 'traces'))
    try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}
  }, { timeout: 10000 })

  it('completes when LLM returns a done action', async () => {
    llm.setResponse({ type: 'done', answer: 'Task completed successfully' })
    const result = await runAgent('test goal', llm, registry, {
      maxSteps: 10, memory: mem, tracer,
      dangerousPatterns: [/^rm\s+-rf\s+\//],
    })
    expect(result).toContain('completed')
  })

  it('stops after maxSteps', async () => {
    // Set up LLM to never return done
    llm.setResponse({ type: 'call_tool', tool: 'read_file', args: { path: 'nonexistent' } })
    const result = await runAgent('test goal', llm, registry, {
      maxSteps: 3, memory: mem, tracer,
      dangerousPatterns: [/^rm\s+-rf\s+\//],
    })
    expect(result).toContain('达到最大步数')
  })

  it('injects feedback when tool fails', async () => {
    // First call: do a tool that will fail
    llm.setResponse({ type: 'call_tool', tool: 'read_file', args: { path: '/nonexistent_file_xyz' } })
    // We just verify it doesn't crash and returns something
    const result = await runAgent('test with feedback', llm, registry, {
      maxSteps: 3, memory: mem, tracer,
      dangerousPatterns: [/^rm\s+-rf\s+\//],
    })
    expect(result).toBeDefined()
    // Check that tracer recorded the feedback
    const trace = tracer.getTrace()
    expect(trace.length).toBeGreaterThan(0)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/harness.test.ts
```

预期： FAIL — `src/harness.ts` not found.

- [ ] **步骤 3: Write config.ts**

```typescript
import { HarnessConfig } from './types'
import * as path from 'path'
import * as os from 'os'

const DATA_DIR = path.join(os.homedir(), '.agent-harness')

export function loadConfig(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return {
    maxSteps: overrides.maxSteps ?? 50,
    dangerousPatterns: overrides.dangerousPatterns ?? [
      /^rm\s+-rf\s+\//,
      /^dd\s+if=/,
      /^mkfs/,
      /^:\(\)\{\s*:\s*\|\|:\s*&\};:/,
      /^>\/dev\/sda/,
      /^fdisk/,
    ],
    memoryPath: overrides.memoryPath ?? path.join(DATA_DIR, 'memory.json'),
    tracesDir: overrides.tracesDir ?? path.join(DATA_DIR, 'traces'),
    credentialsPath: overrides.credentialsPath ?? path.join(DATA_DIR, 'credentials.enc'),
  }
}
```

- [ ] **步骤 4: Write harness.ts**

```typescript
import { LLMProvider } from './llm/interface'
import { ToolRegistry } from './tools/registry'
import { guardrail } from './guardrail'
import { FileMemory } from './memory'
import { Tracer } from './tracer'
import { Message, Action } from './types'

export interface RunOptions {
  maxSteps: number
  dangerousPatterns: RegExp[]
  memory: FileMemory
  tracer: Tracer
}

export async function runAgent(
  goal: string,
  llm: LLMProvider,
  tools: ToolRegistry,
  options: RunOptions
): Promise<string> {
  const context: Message[] = [
    { role: 'system', content: 'You are a coding agent. Use tools to accomplish tasks. Reply with DONE when finished.' },
    { role: 'user', content: goal },
  ]

  // Load memory
  const memoryContext = await options.memory.read('project_context')
  if (memoryContext) {
    context.push({ role: 'system', content: `Project context: ${memoryContext}` })
  }

  const toolChoices = tools.list().map(t => ({
    name: t.name,
    description: t.description,
    parameters: {},
  }))

  let steps = 0
  let done = false
  let answer = ''

  while (!done && steps < options.maxSteps) {
    steps++

    // Call LLM
    const response = await llm.chat(context, toolChoices)
    const action = response.action

    if (!action) {
      // If LLM returned no action, inject text response and continue
      context.push(response.message)
      continue
    }

    // Guardrail check
    const gResult = guardrail(action, options.dangerousPatterns)
    if (!gResult.allowed) {
      context.push({ role: 'user', content: `该动作被策略拦截: ${gResult.reason}` })
      options.tracer.record(steps, action, gResult.reason!)
      continue
    }

    // Execute
    if (action.type === 'done') {
      done = true
      answer = action.answer || 'Task completed'
      options.tracer.record(steps, action, answer)
      context.push({ role: 'assistant', content: answer })
      continue
    }

    if (action.type === 'call_tool' && action.tool) {
      try {
        const result = await tools.execute(action.tool, action.args || {})
        const resultText = result.success ? result.data : `错误: ${result.error}`
        context.push({ role: 'user', content: resultText })
        options.tracer.record(steps, action, resultText)

        // ── MVP Feedback Loop ──
        // If tool failed, inject error feedback into context
        if (!result.success) {
          const feedback = `工具执行失败: ${result.error}。请修正你的方法后重试。`
          context.push({ role: 'user', content: feedback })
          options.tracer.record(steps, action, resultText, feedback)
        }
      } catch (err: any) {
        const errorMsg = `工具执行异常: ${err.message}`
        context.push({ role: 'user', content: errorMsg })
        options.tracer.record(steps, action, errorMsg)
        // Also inject feedback on exception
        context.push({ role: 'user', content: `工具执行异常: ${err.message}。请修正你的方法后重试。` })
      }
      continue
    }

    if (action.type === 'take_note') {
      const note = action.note || ''
      const [key, ...valueParts] = note.split(':')
      if (key && valueParts.length > 0) {
        await options.memory.write(key.trim(), valueParts.join(':').trim())
      }
      context.push({ role: 'user', content: `笔记已记录: ${note}` })
      options.tracer.record(steps, action, `note: ${note}`)
      continue
    }

    // Unknown action type
    context.push({ role: 'user', content: `未知动作类型: ${action.type}` })
    options.tracer.record(steps, action, 'unknown action type')
  }

  // Cleanup
  await options.memory.consolidate()
  await options.tracer.flush()

  if (!done) {
    return `达到最大步数 (${options.maxSteps})，任务未完成。最后状态: ${answer || '无'}`
  }

  return answer
}
```

- [ ] **步骤 5: Run test to verify it passes**

```bash
npm test -- tests/harness.test.ts
```

预期： PASS.

- [ ] **步骤 6: Commit**

```bash
git add src/harness.ts src/config.ts tests/harness.test.ts
git commit -m "feat: 实现 agent 主循环（harness core）

由主 agent 完成。"
```

---

### 任务 9：凭据管理

**前置依赖：** Task 1, Task 2

**文件：**
- 创建： `src/credentials.ts`

**接口：**
- 依赖： `HarnessConfig` (from `src/config.ts`)
- 产出： `CredentialManager` class

- [ ] **步骤 1：编写失败测试**

Create `tests/credentials.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CredentialManager } from '../src/credentials'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const CRED_PATH = path.join(os.tmpdir(), 'agent-harness-cred-test.enc')

describe('CredentialManager', () => {
  let mgr: CredentialManager

  beforeEach(() => {
    try { fs.unlinkSync(CRED_PATH) } catch {}
    mgr = new CredentialManager(CRED_PATH)
  })

  afterEach(() => {
    try { fs.unlinkSync(CRED_PATH) } catch {}
  })

  it('returns null when no credentials stored', () => {
    expect(mgr.isConfigured()).toBe(false)
  })

  it('stores and retrieves an API key', async () => {
    await mgr.save('sk-test-key-12345', 'test-password')
    const result = await mgr.load('test-password')
    expect(result).toBe('sk-test-key-12345')
  })

  it('fails to load with wrong password', async () => {
    await mgr.save('sk-test-key', 'correct-password')
    await expect(mgr.load('wrong-password')).rejects.toThrow()
  })

  it('clears stored credentials', async () => {
    await mgr.save('sk-test-key', 'password')
    await mgr.clear()
    expect(mgr.isConfigured()).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/credentials.test.ts
```

预期： FAIL.

- [ ] **步骤 3: Write credentials.ts**

```typescript
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT_LENGTH = 32

export class CredentialManager {
  private filePath: string
  private configured: boolean = false

  constructor(filePath: string) {
    this.filePath = filePath
    this.configured = fs.existsSync(filePath)
  }

  isConfigured(): boolean {
    return this.configured
  }

  async save(apiKey: string, masterPassword: string): Promise<void> {
    const salt = crypto.randomBytes(SALT_LENGTH)
    const key = crypto.pbkdf2Sync(masterPassword, salt, 100000, KEY_LENGTH, 'sha256')
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([
      cipher.update(apiKey, 'utf-8'),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()

    const payload = Buffer.concat([salt, iv, tag, encrypted])
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, payload)
    this.configured = true
  }

  async load(masterPassword: string): Promise<string> {
    if (!fs.existsSync(this.filePath)) {
      throw new Error('No credentials stored')
    }

    const payload = fs.readFileSync(this.filePath)
    const salt = payload.subarray(0, SALT_LENGTH)
    const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    const encrypted = payload.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

    const key = crypto.pbkdf2Sync(masterPassword, salt, 100000, KEY_LENGTH, 'sha256')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    return decrypted.toString('utf-8')
  }

  async clear(): Promise<void> {
    try {
      fs.unlinkSync(this.filePath)
    } catch {}
    this.configured = false
  }
}
```

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/credentials.test.ts
```

预期： PASS.

- [ ] **步骤 5: Commit**

```bash
git add src/credentials.ts tests/credentials.test.ts
git commit -m "feat: 实现凭据加密存储（AES-256-GCM）

由主 agent 完成。"
```

---

### 任务 10：CLI 入口

**前置依赖：** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9

**文件：**
- 创建： `src/index.ts`

**接口：**
- 依赖： all modules
- 产出： CLI entry with `run`, `config`, `web` commands

- [ ] **步骤 1：编写失败测试**

Create `tests/cli.test.ts` (lightweight — just verify the module loads):

```typescript
import { describe, it, expect } from 'vitest'

describe('CLI entry', () => {
  it('module loads without error', async () => {
    // Just verify the module can be imported
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

```bash
npm test -- tests/cli.test.ts
```

预期： FAIL — `src/index.ts` not found.

- [ ] **步骤 3: Write index.ts**

```typescript
#!/usr/bin/env node
import { Command } from 'commander'
import { runAgent } from './harness'
import { DeepSeekProvider } from './llm/deepseek'
import { MockLLM } from './llm/mock'
import { ToolRegistry } from './tools/registry'
import { ReadFileTool } from './tools/read_file'
import { WriteFileTool } from './tools/write_file'
import { ShellTool } from './tools/shell'
import { FileMemory } from './memory'
import { Tracer } from './tracer'
import { loadConfig } from './config'
import { CredentialManager } from './credentials'
import * as readline from 'readline'

const program = new Command()

program
  .name('agent-harness')
  .description('Coding Agent Harness — feedback-driven self-correction for LLM agents')
  .version('0.1.0')

program
  .command('run')
  .description('Run agent with a given goal')
  .argument('<goal>', 'the task description')
  .option('--mock', 'use mock LLM instead of DeepSeek (for testing)')
  .option('--max-steps <number>', 'max loop iterations', '50')
  .action(async (goal, options) => {
    try {
      const config = loadConfig()
      const creds = new CredentialManager(config.credentialsPath)
      const memory = new FileMemory(config.memoryPath)
      const tracer = new Tracer(config.tracesDir)
      const registry = new ToolRegistry()
      registry.register(new ReadFileTool())
      registry.register(new WriteFileTool())
      registry.register(new ShellTool(30))

      let llm: DeepSeekProvider | MockLLM
      if (options.mock) {
        llm = new MockLLM()
      } else {
        if (!creds.isConfigured() && !process.env.DEEPSEEK_API_KEY) {
          console.error('错误: 未配置 API Key。请运行 agent-harness config')
          process.exit(1)
        }
        let apiKey = process.env.DEEPSEEK_API_KEY
        if (!apiKey) {
          apiKey = await creds.load(await promptPassword())
        }
        llm = new DeepSeekProvider(apiKey)
      }

      const result = await runAgent(goal, llm, registry, {
        maxSteps: parseInt(options.maxSteps),
        dangerousPatterns: config.dangerousPatterns,
        memory,
        tracer,
      })

      console.log('\n' + result)
      process.exit(0)
    } catch (err: any) {
      console.error('错误:', err.message)
      process.exit(1)
    }
  })

program
  .command('config')
  .description('Configure API key')
  .option('--status', 'check if API key is configured')
  .option('--clear', 'remove stored API key')
  .action(async (options) => {
    const config = loadConfig()
    const creds = new CredentialManager(config.credentialsPath)

    if (options.status) {
      if (creds.isConfigured()) {
        console.log('API Key 已配置。')
      } else {
        console.log('API Key 未配置。请运行 agent-harness config 进行配置。')
      }
      return
    }

    if (options.clear) {
      await creds.clear()
      console.log('API Key 已清除。')
      return
    }

    // Interactive config
    const apiKey = await promptHidden('请输入 DeepSeek API Key: ')
    const password = await promptHidden('请设置主密码（用于加密存储）: ')
    const confirm = await promptHidden('确认主密码: ')

    if (password !== confirm) {
      console.error('两次输入的密码不一致')
      process.exit(1)
    }

    await creds.save(apiKey, password)
    console.log('API Key 已安全存储。')
  })

program
  .command('web')
  .description('Start WebUI debug panel')
  .action(() => {
    console.log('WebUI 调试面板将在后续阶段实现。')
    console.log('当前阶段请使用: agent-harness run "<goal>"')
  })

function promptPassword(): Promise<string> {
  return promptHidden('请输入主密码: ')
}

function promptHidden(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// 仅在作为主入口运行时解析参数
const isMain = process.argv[1]?.includes('index')
if (isMain) {
  program.parse(process.argv)
}
```

- [ ] **步骤 4：运行测试确认通过**

```bash
npm test -- tests/cli.test.ts
```

预期： PASS.

- [ ] **步骤 5: Build and verify CLI works**

```bash
npm run build
node dist/index.js --help
```

预期： help text with `run`, `config`, `web` commands.

- [ ] **步骤 6: Commit**

```bash
git add src/index.ts tests/cli.test.ts
git commit -m "feat: 实现 CLI entry（commander + run/config/web 命令）

由主 agent 完成。"
```

---

### 任务 11：机制演示测试

**前置依赖：** Task 1, Task 2, Task 3, Task 4, Task 5, Task 8

**文件：**
- 创建： `tests/mechanism-demo.test.ts`

**接口：**
- 依赖： all modules
- 产出： deterministic demo of ① guardrail拦截 ② feedback闭环 ③ 重点维度行为

- [ ] **步骤 1: Write mechanism-demo.test.ts**

```typescript
/**
 * 机制演示 — 不依赖真实 LLM 与网络
 *
 * 演示内容（对应 §A.6 要求）：
 * ① 治理护栏拦截一个危险动作
 * ② 注入一次失败，反馈闭环使 agent 收到反馈
 * ③ 重点维度（反馈闭环）的确定性行为
 */
import { describe, it, expect } from 'vitest'
import { guardrail, DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import { Action } from '../src/types'
import { MockLLM } from '../src/llm/mock'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import { FileMemory } from '../src/memory'
import { Tracer } from '../src/tracer'
import { runAgent } from '../src/harness'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

const DEMO_DIR = path.join(os.tmpdir(), 'agent-harness-demo-' + Date.now())

describe('Mechanism Demo — ① Guardrail 拦截危险动作', () => {
  it('拦截 rm -rf / 并返回 reason', () => {
    const action: Action = { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
    // 确定性的：每次都返回相同结果
    const result2 = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result2).toEqual(result)
  })

  it('放行安全命令', () => {
    const action: Action = { type: 'call_tool', tool: 'shell', args: { command: 'ls -la' } }
    const result = guardrail(action, DEFAULT_DANGEROUS_PATTERNS)
    expect(result.allowed).toBe(true)
  })
})

describe('Mechanism Demo — ② 反馈闭环', () => {
  it('工具失败后错误信息被回灌到上下文', async () => {
    const llm = new MockLLM()
    const registry = new ToolRegistry()
    registry.register(new ReadFileTool())
    registry.register(new WriteFileTool())
    registry.register(new ShellTool(30))
    const mem = new FileMemory(path.join(DEMO_DIR, 'memory.json'))
    const tracer = new Tracer(path.join(DEMO_DIR, 'traces'))
    try { fs.mkdirSync(DEMO_DIR, { recursive: true }) } catch {}

    // LLM 尝试读取一个不存在的文件 —— 触发反馈
    llm.setResponse({ type: 'call_tool', tool: 'read_file', args: { path: '/nonexistent_demo_file' } })
    await runAgent('demo feedback', llm, registry, {
      maxSteps: 10, memory: mem, tracer,
      dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS,
    })

    // 验证：tracer 中至少有一条 feedback 记录
    const trace = tracer.getTrace()
    const hasFeedback = trace.some(t => t.feedback !== undefined)
    expect(hasFeedback).toBe(true)
  }, { timeout: 10000 })
})

describe('Mechanism Demo — ③ Mock LLM 主循环确定性行为', () => {
  it('mock LLM 下主循环在 done 时返回正确结果', async () => {
    const llm = new MockLLM()
    const registry = new ToolRegistry()
    registry.register(new ReadFileTool())
    registry.register(new WriteFileTool())
    registry.register(new ShellTool(30))
    const mem = new FileMemory(path.join(DEMO_DIR, 'memory2.json'))
    const tracer = new Tracer(path.join(DEMO_DIR, 'traces2'))
    try { fs.mkdirSync(DEMO_DIR, { recursive: true }) } catch {}

    llm.setResponse({ type: 'done', answer: 'Demo task complete' })
    const result = await runAgent('demo goal', llm, registry, {
      maxSteps: 50, memory: mem, tracer,
      dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS,
    })
    expect(result).toBe('Demo task complete')
  }, { timeout: 10000 })

  it('mock LLM 下主循环在 maxSteps 时停止', async () => {
    const llm = new MockLLM()
    const registry = new ToolRegistry()
    registry.register(new ReadFileTool())
    registry.register(new WriteFileTool())
    registry.register(new ShellTool(30))
    const mem = new FileMemory(path.join(DEMO_DIR, 'memory3.json'))
    const tracer = new Tracer(path.join(DEMO_DIR, 'traces3'))
    try { fs.mkdirSync(DEMO_DIR, { recursive: true }) } catch {}

    llm.setResponse({ type: 'call_tool', tool: 'read_file', args: { path: 'nonexistent' } })
    const result = await runAgent('demo goal', llm, registry, {
      maxSteps: 3, memory: mem, tracer,
      dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS,
    })
    expect(result).toContain('达到最大步数')
  }, { timeout: 10000 })
})
```

- [ ] **步骤 2: Run mechanism demo tests**

```bash
npm test -- tests/mechanism-demo.test.ts
```

预期： PASS.

- [ ] **步骤 3: Commit**

```bash
git add tests/mechanism-demo.test.ts
git commit -m "test: 添加机制演示（guardrail + feedback + mock loop）

由主 agent 完成。"
```

---

### 任务 12：Dockerfile

**文件：**
- 创建： `Dockerfile`

- [ ] **步骤 1: Write Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
RUN npm ci --production
EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
```

- [ ] **步骤 2: Build Docker image**

```bash
docker build -t coding-agent-harness .
```

预期： Build succeeds.

- [ ] **步骤 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: 添加 Dockerfile

由主 agent 完成。"
```

---

### 任务 13：AGENT_LOG.md

**文件：**
- 创建： `AGENT_LOG.md`

- [ ] **步骤 1: Write AGENT_LOG.md**

```markdown
# AGENT_LOG.md

> 按时间顺序记录关键节点。

## 2026-07-10

| 时间 | Task | 技能 | 关键事件 | 人工干预 |
|------|------|------|---------|---------|
| 10:00 | — | brainstorming | 完成 SPEC.md 设计文档 | — |
| 11:30 | — | writing-plans | 完成 PLAN.md 实现计划 | — |
```

- [ ] **步骤 2: Commit**

```bash
git add AGENT_LOG.md
git commit -m "docs: 初始化 AGENT_LOG.md

由主 agent 完成。"
```

---

## 全部完成后：验证

所有 13 个 task 完成后，运行以下验证：

- [ ] Run full test suite: `npm test` — all tests pass
- [ ] Run mechanism demo: `npm test -- tests/mechanism-demo.test.ts` — 3 demos pass
- [ ] Build: `npm run build` — dist/ generated
- [ ] CLI help: `node dist/index.js --help` — shows commands
- [ ] Docker: `docker build -t coding-agent-harness .` — builds successfully

> **注意：** Task 1（脚手架）是所有其他 task 的前置依赖。必须在 Task 1 完成后，才能开始任何其他 task。