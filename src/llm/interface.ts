// ============================================================
// LLMProvider 接口 — agent 主循环通过此抽象层调用 LLM
// ============================================================

import type { Message, ToolChoice, LLMResponse } from '../types'

// ---- LLMProvider ----

export interface LLMProvider {
  chat(messages: Message[], tools: ToolChoice[]): Promise<LLMResponse>
}
