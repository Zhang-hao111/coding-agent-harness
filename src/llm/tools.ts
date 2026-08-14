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
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: 'object', properties: {} },
    },
  }))

  if (includeDone) {
    defs.push({
      type: 'function' as const,
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
      type: 'function' as const,
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