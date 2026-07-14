// ============================================================
// DeepSeekProvider — 接真实 DeepSeek API（OpenAI 兼容协议）
// ============================================================
// MVP 限制：未启用 function calling，用文本解析 action（检测 DONE 标记）。
// 深入阶段切换为 function calling / tool use，届时移除文本解析逻辑。

import OpenAI from 'openai'
import type { Message, ToolChoice, LLMResponse, Action } from '../types'
import type { LLMProvider } from './interface'

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

  async chat(messages: Message[], _tools: ToolChoice[]): Promise<LLMResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      // Message.role 为窄联合 'system'|'user'|'assistant'，与 SDK 的
      // ChatCompletionMessageParam 结构兼容，直接传入。
      messages,
    })

    const content = completion.choices[0]?.message?.content ?? ''

    // MVP 文本解析：检测 DONE 标记
    const action = parseAction(content)

    return {
      action,
      message: { role: 'assistant', content },
    }
  }
}

// MVP 文本解析：检测 DONE 标记判 done，否则返回 undefined（带原始 message）。
// 深入阶段切换 function calling 后由结构化 tool_calls 取代。
function parseAction(content: string): Action | undefined {
  // 约定：content 含 DONE 标记（作为独立词）即视为完成
  if (/\bDONE\b/.test(content)) {
    // answer 为去掉标记后的文本，去空；无剩余则用整段 content
    const answer = content.replace(/\bDONE\b/g, '').trim() || content
    return { type: 'done', answer }
  }
  // MVP 限制：未约定文本协议时无法可靠解析 call_tool，
  // 返回 undefined，由主循环处理。
  return undefined
}
