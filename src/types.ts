// ============================================================
// 核心类型定义 — Coding Agent Harness MVP
// ============================================================

// ---- Action ----

export type ActionType = 'call_tool' | 'done' | 'take_note'

export interface Action {
  type: ActionType
  tool?: string                 // call_tool 时
  args?: Record<string, unknown>  // call_tool 时
  answer?: string               // done 时
  noteKey?: string              // take_note 时：记忆键
  noteValue?: string            // take_note 时：记忆值
}

// ---- Message ----

export interface Message {
  role: 'system' | 'user' | 'assistant'   // 窄联合，直接兼容 openai SDK
  content: string
}

// ---- ToolChoice ----

export interface ToolChoice {
  name: string
  description: string
  parameters?: Record<string, unknown>    // MVP 仅作元数据传入，未启用 function calling
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
  execute(args: Record<string, unknown>): Promise<ToolResult>
}

// ---- LLMResponse ----

export interface LLMResponse {
  action?: Action
  message?: Message
}