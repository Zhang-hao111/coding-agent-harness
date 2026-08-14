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
  tool?: string                 // call_tool 时
  args?: Record<string, unknown>  // call_tool 时
  answer?: string               // done 时
  noteKey?: string              // take_note 时：记忆键
  noteValue?: string            // take_note 时：记忆值
  tool_call_id?: string         // 新增：用于 ToolMessage 回灌
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

// ---- ToolChoice ----

export interface ToolChoice {
  name: string
  description: string
  parameters?: Record<string, unknown>    // 工具参数 JSON Schema，buildToolDefinitions 透传给 LLM（v2.0 function calling）
}

// ---- DangerousPattern & Guardrail ----

export type Disposition = 'allow' | 'deny' | 'escalate'

export interface DangerousPattern {
  pattern: RegExp
  disposition: Disposition
  reason: string
}

export interface GuardrailResult {
  disposition: Disposition
  reason?: string
}

// ---- TraceEntry ----

export interface TraceEntry {
  step: number
  action: Action
  result: string
  timestamp: string
  feedback?: string       // 反馈回灌内容（如有）
}

// ---- MemoryEntry ----

export interface MemoryEntry {
  key: string
  value: string
  createdAt: string
  updatedAt: string
}

// ---- SessionState ----

export interface SessionState {
  goal: string
  steps: number
  maxSteps: number
  context: Message[]
  done: boolean
  answer: string | null
}

// ---- HarnessConfig ----

export interface HarnessConfig {
  maxSteps: number
  dangerousPatterns: DangerousPattern[]
  memoryPath: string
  tracesDir: string
  credentialsPath: string
}

// ---- ToolDef & ToolResult ----

export interface ToolResult {
  success: boolean
  data?: string
  error?: string
}

export interface ToolDef {
  name: string
  description: string
  parameters?: Record<string, unknown>  // 参数 JSON Schema，用于 function calling
  execute(args: Record<string, unknown>): Promise<ToolResult>
}

// ---- LLMResponse ----

export interface LLMResponse {
  action?: Action
  message?: Message
}