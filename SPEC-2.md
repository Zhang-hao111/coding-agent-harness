# SPEC-2：Function Calling 集成 — 真实 DeepSeek 端到端任务执行

> **版本：** 2.0（草案）
> **日期：** 2026-07-14
> **状态：** 设计文档，待评审
> **关联：** [SPEC.md](SPEC.md) §3.1（MVP 限制说明）

---

## 1. 动机与目标

### 1.1 现状

v1.0（MVP）已完成六大机制，57/57 测试全绿。但真实 LLM 通路是 **stub**：

- `DeepSeekProvider.chat()` 的 `_tools` 参数带 `_` 前缀，**被忽略**
- `parseAction()` 只识别文本 `\bDONE\b` 标记，返回 `{type:'done'}`
- 真实 DeepSeek 返回自然语言 → `action=undefined` → harness 静默跳过 → **必撞 maxSteps=50**
- 系统 prompt 未告知 LLM 可用的动作格式

### 1.2 目标

实现 OpenAI 兼容的 function calling 集成，让真实 DeepSeek 能端到端驱动 agent 完成"写文件、读文件、shell 命令"等任务。

| 指标 | 当前 | 目标 |
|------|------|------|
| `action` 解析成功率 | 0%（仅 DONE 文本标记） | 100%（function calling） |
| 端到端任务完成 | ✗ 撞 maxSteps | ✓ 一次调用完成 |
| mock 测试 | 57/57 | 57/57 不变 |
| 新增测试 | — | ≥ 10 项（工具定义、解析器、harness 适配） |

### 1.3 非目标

- 不改变 ToolDef 注册机制（`ToolRegistry` 不变）
- 不改变 Guardrail/HITL 逻辑
- 不改变 MockLLM 行为（存量测试不变）
- 不做流式 streaming（保持 `response_format` 为完整响应）

---

## 2. 总体设计

### 2.1 架构变化

```
v1.0 (MVP)                    v2.0 (Function Calling)
─────────────────             ─────────────────────
Harness                       Harness
  ↓                             ↓
DeepSeekProvider.chat          DeepSeekProvider.chat
  ↓ parseAction(text)            ↓ OpenAI SDK function calling
  ↓ 只认 DONE 标记               ↓ 解析 tool_calls
Action ✓ or ✗                  Action ✓
                                 ↓
                               ToolResult → ToolMessage 回灌
```

### 2.2 数据流

```
LLM ←── system prompt + conversation history
  │
  │  response.choices[0]:
  │    finish_reason === 'tool_calls'  →  parseToolCall()
  │    finish_reason === 'stop'        →  text reply (no action)
  │
  ▼
Harness loop:
  tool_calls  →  guardrail  →  execute  →  ToolMessage 回灌  →  next iteration
  stop        →  append to context (thinking visible)          →  next iteration
  undefined   →  push hint message                             →  next iteration (不再静默)
```

---

## 3. 接口变更

### 3.1 Types（`src/types.ts`）

**变更：** 拓宽 `Message` 联合类型，支持 function calling 的完整协议。

```typescript
// ── 新增：ToolCall 结构 ──
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string   // JSON string
  }
}

// ── Message 拓宽 ──
export interface SystemMessage    { role: 'system';    content: string }
export interface UserMessage      { role: 'user';      content: string }
export interface AssistantMessage {
  role: 'assistant'
  content: string | null
  tool_calls?: ToolCall[]         // function calling 返回
}
export interface ToolMessage {
  role: 'tool'
  content: string
  tool_call_id: string            // 关联 tool_calls[0].id
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage

// ── Action 新增字段 ──
export interface Action {
  // ... 现有字段不变 ...
  tool_call_id?: string            // 用于 ToolMessage 回灌
}

// ── 废弃 ──
// Message 旧定义（窄联合）删除
// ToolChoice 接口保留但不再被 LLMProvider 使用
```

### 3.2 LLMProvider 接口（`src/llm/interface.ts`）

**不变。** `chat(messages, tools)` 签名保持兼容：

```typescript
export interface LLMProvider {
  chat(messages: Message[], tools: ToolChoice[]): Promise<LLMResponse>
}
```

- `tools` 参数在 v2.0 中通过 `buildToolDefinitions()` 转为 `ChatCompletionTool[]`
- 向后兼容：MockLLM 不受影响

### 3.3 新增：Tool Definitions 层（`src/llm/tools.ts`）

```typescript
// src/llm/tools.ts（新建）

import type { ToolChoice } from '../types'

export interface ChatCompletionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export function buildToolDefinitions(
  toolChoices: ToolChoice[],
  includeDone?: boolean,
  includeTakeNote?: boolean,
): ChatCompletionTool[]
```

**关键决策：** `done` 和 `take_note` 不作为 `ToolChoice` 注册，而由 `buildToolDefinitions` 合成。原因是它们是 agent 循环的内部动作，不是可执行工具。

### 3.4 DeepSeekProvider 重写（`src/llm/deepseek.ts`）

**变更概要：**

| 成员 | 变更 |
|------|------|
| `constructor` | 不变（apiKey, model） |
| `chat()` | 重写：调用 OpenAI SDK，传入 `tools` 参数 |
| `parseAction()` | **删除** |
| 新增 `parseToolCall()` | 解析 `tool_calls` → `Action` |
| 新增 `buildSystemPrompt()` | 生成系统级提示 |

**`chat()` 流程：**

```
1. 用 `buildToolDefinitions(toolChoices)` 合成 `ChatCompletionTool[]`
2. 构建消息体：system prompt + conversation history
3. 调用 OpenAI SDK：POST /v1/chat/completions
   body: { model, messages, tools, tool_choice: 'auto' }
4. 解析 response.choices[0]:
   - finish_reason === 'tool_calls' → parseToolCall() → Action
   - finish_reason === 'stop'       → 封装为 message-only（无 action）
   - 其他 (length/error)            → 抛出异常
```

**`parseToolCall()` 流程：**

```
输入: ToolCall 对象
  ↓
1. 检查 name → 映射为 Action.type
   - 'done'          → { type: 'done', answer: args.answer }
   - 'take_note'     → { type: 'take_note', noteKey, noteValue }
   - 其他            → { type: 'call_tool', tool: name, args: parsed }
  ↓
2. 至少 tool_call_id 到 action.tool_call_id
  ↓
输出: Action
```

### 3.5 Harness 适配（`src/harness.ts`）

**两处改动：**

| 场景 | 当前行为 | 新行为 |
|------|---------|--------|
| `action === undefined` + `message` 有内容 | `continue`（静默跳过） | 追加 `message.content` 到 context，加 hint 提示必须调用工具 |
| `action === undefined` + `message` 无内容 | `continue`（静默跳过） | 追加 hint message，不静默 |

**说明：** 真实 LLM 可能返回一段思考文本然后才调用工具（`finish_reason: 'stop'`），也可能直接返回 `tool_calls`。改动确保 LLM 的中间思考不丢失，同时避免空转。

---

## 4. System Prompt 设计

### 4.1 原则

- 不通过 prompt 实现"机制"（如 guardrail、反馈闭环）
- prompt 只告诉 LLM **可用工具及其格式**，不教行为策略
- 与现有 harness 机制互补，不重复

### 4.2 System Prompt 内容

```
You are a coding agent. You have access to the following tools:

{工具列表（由 buildToolDefinitions 生成）}

When you want to use a tool, respond with a function call.
When the task is complete, call the 'done' function with a summary of what was accomplished.
```

**移除：** 当前 MVP 的 system prompt 硬编码在 `harness.ts` 中（`src/harness.ts:60`），v2.0 改为由 `DeepSeekProvider` 在 `chat()` 调用时动态构建。

---

## 5. 测试策略

### 5.1 存量测试（不变）

| 文件 | 测试数 | 策略 |
|------|--------|------|
| `tests/llm.test.ts` | 8 | 不变，MockLLM 不受影响 |
| `tests/harness.test.ts` | 6 | 不变，MockLLM 路径不动 |
| `tests/mechanism-demo.test.ts` | 5 | 不变，机制演示使用 MockLLM |
| 其他 8 个测试文件 | 38 | 不变 |

总计：**57/57 存量测试必须全绿。**

### 5.2 新增测试

| 文件 | 测试内容 | 数量 | 确定性 |
|------|---------|------|--------|
| `tests/llm.test.ts`（扩展） | `buildToolDefinitions` 输出包含 read_file/write_file/shell/done/take_note | 4 | ✅ |
| `tests/llm.test.ts`（扩展） | `includeDone=false` 排除 done | 1 | ✅ |
| `tests/deepseek.test.ts`（新建） | `parseToolCall` 解析不同 tool_calls 格式 | 5 | ✅ |
| `tests/deepseek.test.ts`（新建） | `parseToolCall` 异常输入（JSON 解析失败） | 1 | ✅ |
| `tests/harness.test.ts`（扩展） | `action === undefined` 不再静默 | 1 | ✅（MockLLM 模拟） |

新增总计：**≥ 12 项**，全部确定性。

### 5.3 手动/集成测试

| 场景 | 方式 | 前置条件 |
|------|------|---------|
| DeepSeek 端到端写文件 | 手动运行 | 环境变量 `DEEPSEEK_API_KEY` |
| 读文件后返回结果 | 手动运行 | 同上 |
| 多次 function call 链 | 手动运行 | 同上 |

**注意：** 集成测试不在 CI 中执行（需要真实的 API key）。

---

## 6. 迁移路径

### 6.1 步骤顺序

```
Step 1: Types 变更
  └─ 修改 src/types.ts（Message 拓宽、ToolCall 新增、Action 新增 tool_call_id）
  └─ 验证：tsc 编译通过，存量测试通过

Step 2: Tool Definitions 层
  └─ 新增 src/llm/tools.ts（buildToolDefinitions）
  └─ 新增 tests/llm.test.ts 用例（buildToolDefinitions 测试）
  └─ 验证：npm test 全绿

Step 3: DeepSeekProvider 重写
  └─ 修改 src/llm/deepseek.ts（chat 重写、parseToolCall 新增、parseAction 删除）
  └─ 新增 tests/deepseek.test.ts
  └─ 验证：npm test 全绿

Step 4: Harness 适配
  └─ 修改 src/harness.ts（action === undefined 处理）
  └─ 新增 tests/harness.test.ts 用例
  └─ 验证：npm test 全绿

Step 5: System Prompt 迁移
  └─ 修改 src/llm/deepseek.ts（buildSystemPrompt）
  └─ 验证：npm test 全绿

Step 6: 集成验证
  └─ 手动运行真实 DeepSeek 端到端
  └─ npm run build 确认
  └─ 更新 SPEC.md 中 §3.1 的限制说明
```

### 6.2 回滚策略

- 每个 Step 独立 commit，可单独 revert
- 不改动 MockLLM 和存量测试路径
- 如果 Step 3 导致真实 DeepSeek 调用失败，先排查 API 响应格式而非回退到文本协议

---

## 7. 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| DeepSeek function calling 与 OpenAI 格式不完全兼容 | 低 | 使用已验证的 `deepseek-chat` 模型；测试阶段先确认 API 响应格式 |
| 存量测试因 types 变更需要调整 | 中 | 仅 MockLLM 用的 `Message` 创建处需适配新的联合类型 |
| 真实 LLM 不调用 `done` 而无限循环 | 低 | maxSteps 仍然是安全网；system prompt 明确要求完成时调用 done |
| 工具调用参数解析失败 | 低 | `parseToolCall` 对 JSON 解析错误做异常处理，返回 message 提示重新尝试 |

---

## 8. 设计决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| Message 类型 | A: 拓宽联合 / B: 保持窄联合+可选 | A | 联合类型精确表达各 role 的字段差异，编译期安全检查 |
| 协议方式 | A: function calling / B: 文本协议增强 | A | OpenAI 兼容协议是标准方式，DeepSeek 原生支持；文本协议需自建格式，LLM 推理不稳定 |
| done/take_note 处理 | A: 作为假工具暴露 / B: 在 prompt 中描述 | A | 统一使用 tool_calls 机制，无需额外解析逻辑 |
| Tool Definitions 位置 | A: 新文件 / B: 放在 deepseek.ts | A | 职责分离，可独立测试，不被 llm 实现绑定 |
| parseAction 删除 | A: 删除 / B: 保留作为 fallback | A | 不再需要文本协议，function calling 覆盖所有场景 |

---

## 9. 附录：与现有文档的关系

- **SPEC.md §3.1**：标注"文本协议限制 → 深入阶段切换 function calling"，本设计实现该承诺
- **SPEC.md §3.2.2**：TestChoice 接口描述需更新，反映其被 `ChatCompletionTool` 替代
- **PLAN.md**：Task 16–20 对应本设计的 Step 1–5