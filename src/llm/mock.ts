// ============================================================
// MockLLM — 离线确定性测试用的 mock LLM provider
// ============================================================

import type { Message, ToolChoice, LLMResponse, Action } from '../types'
import type { LLMProvider } from './interface'

export class MockLLM implements LLMProvider {
  // one-shot 持久兜底：每次 chat 返回同一 action，不被消费
  private oneShot: Action | null = null
  // 队列模式：按序消费，弹出即弃
  private queue: Action[] = []
  // 记录传入的对话历史
  private history: Message[] = []

  // one-shot 兼容；调用时重置队列（互斥语义：后者覆盖前者）
  setResponse(action: Action): void {
    this.oneShot = action
    this.queue = []
  }

  // 队列模式；调用时重置 one-shot（互斥语义：后者覆盖前者）
  setResponses(actions: Action[]): void {
    this.queue = [...actions]
    this.oneShot = null
  }

  getHistory(): Message[] {
    return this.history
  }

  async chat(messages: Message[], _tools: ToolChoice[]): Promise<LLMResponse> {
    // 记录传入消息到对话历史
    this.history.push(...messages)

    let action: Action
    if (this.queue.length > 0) {
      // 队列模式：按序消费
      action = this.queue.shift() as Action
    } else if (this.oneShot !== null) {
      // one-shot 持久兜底：不被消费
      action = this.oneShot
    } else {
      throw new Error('No preset response configured')
    }

    // content 由 action 推导：done → answer，其余为空字符串
    const content = action.type === 'done' ? (action.answer ?? '') : ''

    return {
      action,
      message: { role: 'assistant', content },
    }
  }
}
