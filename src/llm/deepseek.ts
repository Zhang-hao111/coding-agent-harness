// ============================================================
// DeepSeekProvider — 接真实 DeepSeek API（OpenAI 兼容协议）
// ============================================================
// v2.0: 使用 function calling 协议，替代 MVP 文本解析。
//       将 done/take_note 作为假工具暴露，统一通过 tool_calls 机制处理。

import OpenAI from 'openai'
import type { Message, ToolChoice, LLMResponse, Action } from '../types'
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
