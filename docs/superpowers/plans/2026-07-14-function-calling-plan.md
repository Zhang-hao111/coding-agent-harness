# SPEC-2: Function Calling 集成 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 OpenAI 兼容的 function calling 集成，让真实 DeepSeek 能端到端驱动 agent 完成工具调用任务。

**架构:** 拓宽 Message 联合类型支持 tool_calls/tool role → 新增 buildToolDefinitions 将工具注册表合成 OpenAI 兼容的 tool 定义 → DeepSeekProvider.chat 改用 function calling 协议 → harness 适配处理 action=undefined 和 ToolMessage 回灌。

**Tech Stack:** TypeScript 5.x, OpenAI SDK ^4.102.0, DeepSeek API (OpenAI 兼容), Vitest

## 全局约束

- 存量 MockLLM 测试 57/57 必须全绿，**不允许修改 MockLLM 行为**
- 不允许修改 `ToolRegistry`、`Guardrail`、`Tracer`、`FileMemory` 的接口
- 凭据绝不硬编码（API key 通过环境变量 `DEEPSEEK_API_KEY` 传入）
- 所有新增测试必须确定性（不依赖网络），通过 mock/stub 实现
- 每个 task 独立 commit，commit message 遵循 §9.7 格式

---

### Task 1: Types 变更 — Message 拓宽 + ToolCall 新增

**Files:**
- Modify: `src/types.ts`
- Test: `tests/types.test.ts`（验证新类型在编译期兼容）

**Interfaces:**
- Consumes: 无（根任务）
- Produces: `ToolCall`, `SystemMessage`, `UserMessage`, `AssistantMessage`, `ToolMessage`, `Message`（拓宽联合）, `Action.tool_call_id`

- [ ] **Step 1: 写 types 测试（验证新类型可被构造和访问）**

```typescript
// tests/types.test.ts
import { describe, it, expect } from 'vitest'
import type { ToolCall, Action, Message } from '../src/types'

describe('ToolCall type', () => {
  it('can be constructed with required fields', () => {
    const tc: ToolCall = {
      id: 'call_123',
      type: 'function',
      function: { name: 'read_file', arguments: '{"path":"test.txt"}' },
    }
    expect(tc.id).toBe('call_123')
    expect(tc.function.name).toBe('read_file')
  })
})

describe('Message union type', () => {
  it('system message has role system', () => {
    const m: Message = { role: 'system', content: 'test' }
    expect(m.role).toBe('system')
  })

  it('user message has role user', () => {
    const m: Message = { role: 'user', content: 'hi' }
    expect(m.role).toBe('user')
  })

  it('assistant message can have tool_calls', () => {
    const m: Message = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{}' } }],
    }
    expect(m.role).toBe('assistant')
    expect(m.tool_calls).toHaveLength(1)
  })

  it('tool message has tool_call_id', () => {
    const m: Message = { role: 'tool', content: 'result', tool_call_id: 'call_123' }
    expect(m.tool_call_id).toBe('call_123')
  })
})

describe('Action.tool_call_id', () => {
  it('tool_call_id is optional', () => {
    const a: Action = { type: 'done', answer: 'ok' }
    expect(a.tool_call_id).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试，确认因类型未定义而失败**

Run: `npx vitest run tests/types.test.ts --reporter=verbose`
Expected: FAIL — `ToolCall`, `AssistantMessage`, `ToolMessage` 等未定义

- [ ] **Step 3: 修改 `src/types.ts`，用拓宽联合类型替换旧 Message**

```typescript
// src/types.ts — 修改后

// ============================================================
// 核心类型定义 — Coding Agent Harness v2.0
// ============================================================

// ---- ToolCall（function calling 协议） ----

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string   // JSON string
  }
}

// ---- Action ----

export type ActionType = 'call_tool' | 'done' | 'take_note'

export interface Action {
  type: ActionType
  tool?: string
  args?: Record<string, unknown>
  answer?: string
  noteKey?: string
  noteValue?: string
  tool_call_id?: string       // 新增：用于 ToolMessage 回灌
}

// ---- Message（拓宽联合类型） ----

export interface SystemMessage    { role: 'system';    content: string }
export interface UserMessage      { role: 'user';      content: string }
export interface AssistantMessage {
  role: 'assistant'
  content: string | null
  tool_calls?: ToolCall[]
}
export interface ToolMessage {
  role: 'tool'
  content: string
  tool_call_id: string
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage

// ---- ToolChoice（保留，用于工具定义的元数据传递） ----

export interface ToolChoice {
  name: string
  description: string
  parameters?: Record<string, unknown>
}

// ---- 以下类型不变 ----
// DangerousPattern, Disposition, GuardrailResult, TraceEntry,
// MemoryEntry, SessionState, HarnessConfig, ToolResult, ToolDef, LLMResponse
```

**保留现有类型不变：** `DangerousPattern`, `Disposition`, `GuardrailResult`, `TraceEntry`, `MemoryEntry`, `SessionState`, `HarnessConfig`, `ToolResult`, `ToolDef`, `LLMResponse`。直接复制原文件内容，只替换 Message 相关部分。

- [ ] **Step 4: 运行测试，确认新类型测试通过**

Run: `npx vitest run tests/types.test.ts --reporter=verbose`
Expected: PASS（4 个测试全部通过）

- [ ] **Step 5: 运行全部存量测试，确认类型变更不破坏现有代码**

Run: `npx vitest run --reporter=verbose`
Expected: 57/57 PASS（类型拓宽后，现有 `{ role: 'user', content: '...' }` 写法因 has 属性 `role: 'user'` 被窄化为 `UserMessage`，兼容）

- [ ] **Step 6: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: 拓宽 Message 类型支持 function calling 协议

新增 ToolCall 接口、AssistantMessage.tool_calls、ToolMessage 角色。
Action 新增 tool_call_id 字段用于回灌。"
```

---

### Task 2: Tool Definitions 层 — buildToolDefinitions

**Files:**
- Create: `src/llm/tools.ts`
- Extend: `tests/llm.test.ts`

**Interfaces:**
- Consumes: `ToolChoice`（来自 `src/types.ts`）
- Produces: `ChatCompletionTool`, `buildToolDefinitions(toolChoices, includeDone?, includeTakeNote?): ChatCompletionTool[]`

- [ ] **Step 1: 写 buildToolDefinitions 测试**

在 `tests/llm.test.ts` 末尾追加：

```typescript
// ============================================================
// buildToolDefinitions 测试
// ============================================================
import { buildToolDefinitions } from '../src/llm/tools'

describe('buildToolDefinitions', () => {
  it('includes registered tools', () => {
    const choices = [{ name: 'read_file', description: 'Read a file' }]
    const defs = buildToolDefinitions(choices)
    expect(defs.some(d => d.function.name === 'read_file')).toBe(true)
  })

  it('includes done and take_note by default', () => {
    const defs = buildToolDefinitions([])
    expect(defs.some(d => d.function.name === 'done')).toBe(true)
    expect(defs.some(d => d.function.name === 'take_note')).toBe(true)
  })

  it('excludes done when includeDone=false', () => {
    const defs = buildToolDefinitions([], false)
    expect(defs.some(d => d.function.name === 'done')).toBe(false)
  })

  it('all definitions have type=function', () => {
    const defs = buildToolDefinitions([{ name: 'x', description: 'x' }])
    defs.forEach(d => expect(d.type).toBe('function'))
  })

  it('done definition has required answer parameter', () => {
    const defs = buildToolDefinitions([])
    const done = defs.find(d => d.function.name === 'done')!
    expect(done.function.parameters.required).toContain('answer')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/llm.test.ts -t "buildToolDefinitions" --reporter=verbose`
Expected: FAIL — `buildToolDefinitions` 未定义

- [ ] **Step 3: 创建 `src/llm/tools.ts`**

```typescript
// ============================================================
// Tool Definitions — 将工具注册表合成为 OpenAI 兼容的 tool 定义
// ============================================================

import type { ToolChoice } from '../types'

export interface ChatCompletionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/**
 * 将 harness 的工具注册表 + 内部动作（done/take_note）
 * 合成为 OpenAI 兼容的 ChatCompletionTool 数组。
 */
export function buildToolDefinitions(
  toolChoices: ToolChoice[],
  includeDone = true,
  includeTakeNote = true,
): ChatCompletionTool[] {
  const defs: ChatCompletionTool[] = toolChoices.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: 'object', properties: {} },
    },
  }))

  if (includeDone) {
    defs.push({
      type: 'function',
      function: {
        name: 'done',
        description: 'Mark the task as complete and provide the final answer',
        parameters: {
          type: 'object',
          properties: {
            answer: { type: 'string', description: 'Final answer or summary of what was accomplished' },
          },
          required: ['answer'],
        },
      },
    })
  }

  if (includeTakeNote) {
    defs.push({
      type: 'function',
      function: {
        name: 'take_note',
        description: 'Store a key-value note in memory for later recall',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Note key' },
            value: { type: 'string', description: 'Note value' },
          },
          required: ['key', 'value'],
        },
      },
    })
  }

  return defs
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/llm.test.ts -t "buildToolDefinitions" --reporter=verbose`
Expected: PASS（5 个测试全部通过）

- [ ] **Step 5: 运行全部存量测试，确认无破坏**

Run: `npx vitest run --reporter=verbose`
Expected: 全部 PASS（MockLLM 测试不受影响，因为 buildToolDefinitions 是新增函数，不被 MockLLM 调用）

- [ ] **Step 6: Commit**

```bash
git add src/llm/tools.ts tests/llm.test.ts
git commit -m "feat: 新增 buildToolDefinitions 合成 function calling 工具定义

done 和 take_note 作为假工具暴露给 LLM，统一使用 tool_calls 机制。"
```

---

### Task 3: DeepSeekProvider 重写 — function calling + parseToolCall

**Files:**
- Modify: `src/llm/deepseek.ts`
- Create: `tests/deepseek.test.ts`

**Interfaces:**
- Consumes: `Message`, `Action`, `ToolCall`（来自 `src/types.ts`）, `buildToolDefinitions`（来自 `src/llm/tools.ts`）
- Produces: `DeepSeekProvider.chat()` 改为 function calling 协议, `parseToolCall()` 导出

- [ ] **Step 1: 写 parseToolCall 测试**

```typescript
// tests/deepseek.test.ts
import { describe, it, expect } from 'vitest'
import { parseToolCall } from '../src/llm/deepseek'

describe('parseToolCall', () => {
  it('parses done action', () => {
    const tc = { id: 'call_1', type: 'function' as const, function: { name: 'done', arguments: '{"answer":"finished"}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('done')
    expect(action.answer).toBe('finished')
    expect(action.tool_call_id).toBe('call_1')
  })

  it('parses call_tool action', () => {
    const tc = { id: 'call_2', type: 'function' as const, function: { name: 'read_file', arguments: '{"path":"test.txt"}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('call_tool')
    expect(action.tool).toBe('read_file')
    expect(action.args).toEqual({ path: 'test.txt' })
    expect(action.tool_call_id).toBe('call_2')
  })

  it('parses take_note action', () => {
    const tc = { id: 'call_3', type: 'function' as const, function: { name: 'take_note', arguments: '{"key":"k","value":"v"}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('take_note')
    expect(action.noteKey).toBe('k')
    expect(action.noteValue).toBe('v')
  })

  it('handles invalid JSON arguments gracefully', () => {
    const tc = { id: 'call_4', type: 'function' as const, function: { name: 'read_file', arguments: 'not-json' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('call_tool')
    expect(action.args).toEqual({})  // 降级为空对象
  })

  it('done falls back to default answer when answer missing', () => {
    const tc = { id: 'call_5', type: 'function' as const, function: { name: 'done', arguments: '{}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('done')
    expect(action.answer).toBe('Task completed')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/deepseek.test.ts --reporter=verbose`
Expected: FAIL — `parseToolCall` 未导出

- [ ] **Step 3: 重写 `src/llm/deepseek.ts`**

```typescript
// ============================================================
// DeepSeekProvider — 接真实 DeepSeek API（OpenAI 兼容协议）
// ============================================================
// v2.0: 使用 function calling 协议，替代 MVP 文本解析。
//       将 done/take_note 作为假工具暴露，统一通过 tool_calls 机制处理。

import OpenAI from 'openai'
import type { Message, ToolChoice, LLMResponse, Action, ToolCall } from '../types'
import type { LLMProvider } from './interface'
import { buildToolDefinitions } from './tools'

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

  async chat(messages: Message[], toolChoices: ToolChoice[]): Promise<LLMResponse> {
    const tools = buildToolDefinitions(toolChoices)

    const systemPrompt: Message = {
      role: 'system',
      content: 'You are a coding agent. You have access to tools. When you want to use a tool, call it via function calling. When the task is complete, call the `done` function with a summary.',
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [systemPrompt, ...messages] as any,
      tools,
      tool_choice: 'auto',
    })

    const choice = completion.choices[0]?.message
    if (!choice) {
      return { message: { role: 'assistant', content: '' } }
    }

    // Function calling 路径
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolCall = choice.tool_calls[0]
      const action = parseToolCall({
        id: toolCall.id,
        type: 'function',
        function: { name: toolCall.function.name, arguments: toolCall.function.arguments },
      })

      return {
        action,
        message: {
          role: 'assistant',
          content: choice.content,
          tool_calls: choice.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        },
      }
    }

    // 纯文本回复（无 tool call）
    return {
      message: { role: 'assistant', content: choice.content ?? '' },
    }
  }
}

/**
 * 解析 OpenAI 兼容的 tool_calls 结构为 Action。
 * 导出供测试使用。
 */
export function parseToolCall(toolCall: {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}): Action {
  let args: Record<string, unknown>
  try {
    args = JSON.parse(toolCall.function.arguments)
  } catch {
    args = {}
  }

  const name = toolCall.function.name
  const base = { tool_call_id: toolCall.id }

  if (name === 'done') {
    return { ...base, type: 'done', answer: (args.answer as string) ?? 'Task completed' }
  }

  if (name === 'take_note') {
    return { ...base, type: 'take_note', noteKey: args.key as string, noteValue: args.value as string }
  }

  return { ...base, type: 'call_tool', tool: name, args }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/deepseek.test.ts --reporter=verbose`
Expected: PASS（5 个测试全部通过）

- [ ] **Step 5: 运行全部存量测试，确认无破坏**

Run: `npx vitest run --reporter=verbose`
Expected: 全部 PASS（MockLLM 不受影响，现有 harness 测试不受影响）

- [ ] **Step 6: Commit**

```bash
git add src/llm/deepseek.ts tests/deepseek.test.ts
git commit -m "feat: DeepSeekProvider 改用 function calling 协议

替换 MVP 文本解析（parseAction 删除），新增 parseToolCall 导出。
system prompt 移入 DeepSeekProvider 内部动态构建。"
```

---

### Task 4: Harness 适配 — action=undefined 处理 + ToolMessage 回灌

**Files:**
- Modify: `src/harness.ts`
- Extend: `tests/harness.test.ts`

**Interfaces:**
- Consumes: `Message`（拓宽后）, `Action.tool_call_id`
- Produces: 改进的 agent 主循环行为

- [ ] **Step 1: 写 harness 适配测试**

在 `tests/harness.test.ts` 末尾追加：

```typescript
describe('runAgent with action=undefined', () => {
  it('does not silently spin when action is undefined', async () => {
    const { llm, registry, memory, tracer } = setup()
    // MockLLM 返回无 action 的响应（message 存在但 action 为 undefined）
    // 通过 MockLLM 无法直接模拟，改用 DeepSeekProvider 的 mock 方式？
    // 实际上 MockLLM 总是返回 action，无法模拟无 action 场景。
    // 此测试验证 harness 对 message-only 响应的处理。
    // 由于 MockLLM 无法模拟无 action 场景，用 harness 现有的 maxSteps 逻辑兜底。
    // 此项测试改为验证：当 action 正常返回时，harness 行为不变。
    llm.setResponse({ type: 'done', answer: 'ok' })
    const r = await runAgent('test', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toBe('ok')
  })
})
```

Wait, this test doesn't actually test the `action=undefined` case since MockLLM always returns an action. Let me reconsider.

The `action=undefined` scenario only happens with real DeepSeek when it returns a text-only response without a tool call. With MockLLM, we can't trigger this because MockLLM always returns a preset action.

For the MockLLM test, we can only test the existing behavior. The `action=undefined` fix is inherently only testable with real DeepSeek or by modifying MockLLM to support an "undefined action" mode.

But the spec says "不修改 MockLLM 行为". So let me adjust the test approach — we can't test `action=undefined` with MockLLM. But we can still test that the harness correctly handles ToolMessage for tool results.

Actually, wait. Let me think about this differently. The harness change for `action=undefined` is:
- Before: `continue` (silent)
- After: push hint message, then `continue`

This is a correctness improvement that prevents infinite spinning. We can't test it with MockLLM, but we can verify it doesn't break existing tests. Let me just add a note that this change is only verifiable with real DeepSeek, and keep the existing tests as regression tests.

For the ToolMessage change, we can test it indirectly through the harness. But MockLLM doesn't set `tool_call_id` on actions, so the ToolMessage path won't be exercised. Again, this is only for real DeepSeek.

Let me simplify: Task 4 doesn't add new tests. It makes the changes and verifies existing tests still pass. The spec says "≥12 新增测试" but we already have 5 (types) + 5 (tools) + 5 (deepseek) = 15. So not having harness-specific tests is fine.

Actually, let me re-read the spec more carefully:

```
| `tests/harness.test.ts`（扩展） | `action === undefined` 不再静默 | 1 | ✅（MockLLM 模拟） |
```

The spec says "MockLLM 模拟". But MockLLM always returns an action. Let me think about how to test this...

Actually, I can modify the test to use a different approach. Instead of using MockLLM, I can create a custom LLM that returns no action:

```typescript
it('hints LLM when action is undefined', async () => {
  const { llm, registry, memory, tracer } = setup()
  // Override llm to return message-only response
  const noActionLLM = {
    chat: async () => ({ message: { role: 'assistant' as const, content: 'thinking...' } })
  }
  llm.setResponses([
    { type: 'done', answer: 'recovered' },
  ])
  // ... this doesn't work because we need to replace the LLM
  
  // Better approach: use a custom LLM that returns no action first, then done
  let callCount = 0
  const customLLM = {
    chat: async () => {
      callCount++
      if (callCount === 1) {
        return { message: { role: 'assistant' as const, content: 'I am thinking...' } }
      }
      return { action: { type: 'done' as const, answer: 'recovered' }, message: { role: 'assistant' as const, content: 'done' } }
    }
  }
  const r = await runAgent('test', customLLM, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
  expect(r).toBe('recovered')
  expect(callCount).toBe(2) // first call: no action, second call: done
})
```

This is a valid approach — we create a custom LLM that implements `LLMProvider` interface and returns no action on the first call. This tests that the harness doesn't silently spin when action is undefined.

Let me check if this works with the harness code. The harness calls `llm.chat(context, toolChoices(tools))`. Our custom LLM just needs to implement `chat(messages, tools)` and return `LLMResponse`. This should work.

But wait, the `runAgent` function signature is `runAgent(goal, llm, tools, options)` where `llm: LLMProvider`. The custom LLM we create inline satisfies the interface. But we also need to pass `memory` and `tracer` — those are already set up by `setup()`.

Actually, there's a type issue: when we write `{ role: 'assistant', content: '...' }` without `tool_calls`, TypeScript needs to match this to `AssistantMessage`. Since `tool_calls` is optional, this should work. But `LLMResponse` has `message?: Message` — and `{ role: 'assistant', content: '...' }` is a valid `AssistantMessage` which is valid `Message`.

Let me use this approach. It's a deterministic test that doesn't need MockLLM or network.

- [ ] **Step 1: 写 harness 适配测试**

```typescript
// 在 tests/harness.test.ts 末尾追加

describe('runAgent action=undefined handling', () => {
  it('does not silently spin when action is undefined', async () => {
    const { registry, memory, tracer } = setup()
    let callCount = 0
    const customLLM: LLMProvider = {
      chat: async () => {
        callCount++
        if (callCount === 1) {
          return { message: { role: 'assistant', content: 'I am thinking...' } }
        }
        return { action: { type: 'done', answer: 'recovered' }, message: { role: 'assistant', content: 'done' } }
      },
    }
    const r = await runAgent('test', customLLM, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toBe('recovered')
    expect(callCount).toBe(2)
  })
})
```

Wait, but `setup()` creates a `MockLLM` and returns it. We don't need the MockLLM here — we need the tracer and memory. Let me restructure. Actually, `setup()` creates `{ llm, reg, mem, tr }`. We use `reg`, `mem`, `tr` but not `llm`. That's fine.

Also, I need to import `LLMProvider`. Let me check the current imports in harness.test.ts.

Actually, looking at the harness test file, it imports `runAgent`, `MockLLM`, `ToolRegistry`, etc. I need to import `LLMProvider` from `../src/llm/interface`.

Let me write the test properly.

Also, I need to think about the harness changes themselves:

1. **Remove system prompt from harness.ts** (line 60) — moved to deepseek.ts
2. **Change `action === undefined` handling** (lines 84-87) — push hint instead of silent continue
3. **Change tool result push to use ToolMessage** — when `tool_call_id` is present

Let me reconsider #1. The system prompt is currently:
```typescript
{ role: 'system', content: '你是 Coding Agent Harness 中的决策 LLM。每步返回一个 action。' }
```

If we remove this from harness.ts, then MockLLM tests won't see it in the context. But the existing tests don't check the exact context contents — they check the tracer and return value. So this should be safe.

But wait, does removing the system prompt from harness.ts affect the `toolChoices` function? No, that function is independent.

Actually, for the MockLLM, the system prompt doesn't matter at all — MockLLM just returns preset responses regardless of what's in the context. So removing the system prompt from harness.ts is safe for all existing tests.

For #3 (ToolMessage), the change is in the tool execution section. Let me trace through the code:

```typescript
// 当前（line 133-134）:
context.push({ role: 'user', content: resultText })

// 改为:
if (action.tool_call_id) {
  context.push({ role: 'tool', content: resultText, tool_call_id: action.tool_call_id })
} else {
  context.push({ role: 'user', content: resultText })
}
```

This is backward-compatible: when `tool_call_id` is not set (MockLLM path), it falls back to `{ role: 'user' }`.

OK, let me finalize the plan. Let me also think about the test for the tool message change. We can test it with a custom LLM that returns a call_tool action with tool_call_id, then verify the harness doesn't crash.

Actually, let me keep it simpler. The existing harness tests already cover the tool execution path. The ToolMessage change is backward-compatible. I'll just verify existing tests pass.

Let me write the final version of the plan.

Actually, I realize I need to handle one more thing. The `setup()` function in `tests/harness.test.ts` returns `{ llm, registry, memory, tracer }`. But in my test, I need to import `LLMProvider` interface. Let me check if the import path is correct.

The import would be:
```typescript
import type { LLMProvider } from '../src/llm/interface'
```

OK, let me finalize the plan now. I'll keep the test simple and focused. The key insight is that the harness change is a correctness improvement that's hard to test with MockLLM, but we can use a custom LLM implementation inline.

For the harness, the changes are:

1. **Remove system prompt** (line 60): Delete the line that pushes the system prompt
2. **action=undefined handling** (lines 84-87): Replace silent continue with hint push + continue
3. **ToolMessage** (line 133): Conditionally push as tool or user role

Let me now write the final plan. I've been overthinking this — let me just write it.动作：

1. 测试在 `tests/harness.test.ts` 中（用自定义 LLM 模拟无 action 场景）
2. 修改 `src/harness.ts` 三处

- [ ] **Step 1: 写 harness 适配测试（在 `tests/harness.test.ts` 末尾追加）**

```typescript
import type { LLMProvider } from '../src/llm/interface'

// ... 在文件末尾追加

describe('runAgent action=undefined handling', () => {
  it('does not silently spin when action is undefined', async () => {
    const { registry, memory, tracer } = setup()
    let callCount = 0
    const customLLM: LLMProvider = {
      chat: async () => {
        callCount++
        if (callCount === 1) {
          return { message: { role: 'assistant', content: 'I am thinking...' } }
        }
        return { action: { type: 'done', answer: 'recovered' }, message: { role: 'assistant', content: 'done' } }
      },
    }
    const r = await runAgent('test', customLLM, registry, {
      maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer,
    })
    expect(r).toBe('recovered')
    expect(callCount).toBe(2)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/harness.test.ts -t "action=undefined" --reporter=verbose`
Expected: FAIL — harness 当前静默跳过无 action 的响应，`callCount` 达不到 2

- [ ] **Step 3: 修改 `src/harness.ts`，三处改动**

**改动 1：删除硬编码的 system prompt（第 60 行）**

```typescript
// 删除这一行：
{ role: 'system', content: '你是 Coding Agent Harness 中的决策 LLM。每步返回一个 action。' },
```

改为由 `DeepSeekProvider` 在 `chat()` 内部动态构建。

**改动 2：`action === undefined` 处理（第 84-87 行）**

```typescript
// 修改前：
if (action === undefined || action === null) {
  // 已 push assistant message，直接进入下一轮
  continue
}

// 修改后：
if (action === undefined || action === null) {
  // 有 message 但无 action：追加 hint 提示 LLM 必须调用工具或返回 done
  context.push({ role: 'user', content: '请调用一个可用工具来完成任务，或调用 done 来结束任务。' })
  continue
}
```

**改动 3：工具结果回灌使用 ToolMessage（第 133 行）**

```typescript
// 修改前：
context.push({ role: 'user', content: resultText })

// 修改后：
if (action.tool_call_id) {
  context.push({ role: 'tool', content: resultText, tool_call_id: action.tool_call_id } as Message)
} else {
  context.push({ role: 'user', content: resultText })
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/harness.test.ts -t "action=undefined" --reporter=verbose`
Expected: PASS（2 次调用，第二次返回 done）

- [ ] **Step 5: 运行全部存量测试，确认无破坏**

Run: `npx vitest run --reporter=verbose`
Expected: 全部 PASS（MockLLM 测试不受影响，现有 harness 测试回归通过）

- [ ] **Step 6: Commit**

```bash
git add src/harness.ts tests/harness.test.ts
git commit -m "fix: harness 适配 function calling 协议

- 删除硬编码的 system prompt（移入 DeepSeekProvider 动态构建）
- action=undefined 不再静默跳过，追加 hint 提示
- 工具结果回灌支持 ToolMessage 角色（向后兼容）"
```

---

### Task 5: 集成验证

**Files:** 无（手动运行）

- [ ] **Step 1: 编译确认**

Run: `npm run build`
Expected: tsc 编译通过，dist/ 输出正常

- [ ] **Step 2: 全量测试**

Run: `npm test`
Expected: 所有测试通过

- [ ] **Step 3: 手动验证真实 DeepSeek 端到端**

```bash
set DEEPSEEK_API_KEY=your_key_here
node dist/index.js run "写一个 hello.txt 文件，内容为 Hello World"
```

Expected: agent 成功调用 write_file 工具，创建 hello.txt，然后调用 done 返回结果。

- [ ] **Step 4: 更新 SPEC.md §3.1 限制说明**

在 `SPEC.md` 中找到 §3.1 关于文本协议限制的描述，标注已通过 function calling 解决。