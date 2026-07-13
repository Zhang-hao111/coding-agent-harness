// ============================================================
// Agent 主循环（Harness Core）— 自实现决策封装
// ============================================================
//
// 决策封装维度：组织上下文 → 调用 LLM → 解析动作 → 分发执行
// → 回灌结果 → 停机判断。不寄生任何现成 agent 框架。
//
// 主循环分支严格按 SPEC §5.2 数据流实现（见 task-8-brief 9 点）：
// 1. 初始 context = system prompt + goal；从 memory 读 project_context 注入
// 2. while(!done && steps<maxSteps)：steps++，调 llm.chat
// 3. action 为 null → push assistant message、continue
// 4. guardrail(action, dangerousPatterns)：allow/deny/escalate 三态分流
// 5. done → answer、done=true、record、continue
// 6. call_tool → tools.execute：成功 push 结果；失败 push 结果 + 反馈、record（含 feedback）
// 7. take_note → 用 action.noteKey/noteValue 写 memory（不 split 字符串）
// 8. 未知 action type → push "未知动作类型"、record
// 9. 循环结束：memory.consolidate()、tracer.flush()；未 done 返回最大步数提示

import type {
  Action,
  DangerousPattern,
  Message,
  ToolChoice,
} from './types'
import type { LLMProvider } from './llm/interface'
import type { ToolRegistry } from './tools/registry'
import type { FileMemory } from './memory'
import type { Tracer } from './tracer'
import type { Approver } from './guardrail'
import { guardrail } from './guardrail'

// ---- RunOptions ----

export interface RunOptions {
  maxSteps: number
  dangerousPatterns: DangerousPattern[]
  memory: FileMemory
  tracer: Tracer
  approver?: Approver
}

// 工具元数据（MVP：仅作元数据传入，未启用 function calling）
function toolChoices(tools: ToolRegistry): ToolChoice[] {
  return tools.list().map((t) => ({ name: t.name, description: t.description }))
}

/**
 * agent 主循环。返回最终 answer（或达到最大步数时的提示文本）。
 */
export async function runAgent(
  goal: string,
  llm: LLMProvider,
  tools: ToolRegistry,
  options: RunOptions,
): Promise<string> {
  const { maxSteps, dangerousPatterns, memory, tracer, approver } = options

  // ---- 1. 初始 context = system prompt + goal；注入 project_context ----
  const context: Message[] = [
    { role: 'system', content: '你是 Coding Agent Harness 中的决策 LLM。每步返回一个 action。' },
    { role: 'user', content: goal },
  ]
  const projectContext = await memory.read('project_context')
  if (projectContext !== null) {
    context.push({ role: 'system', content: `project_context: ${projectContext}` })
  }

  let steps = 0
  let done = false
  let answer = ''

  // ---- 2. while(!done && steps<maxSteps) ----
  while (!done && steps < maxSteps) {
    steps++
    const response = await llm.chat(context, toolChoices(tools))
    const action: Action | undefined = response.action

    // assistant message 回灌（无论是否 actionable）
    if (response.message) {
      context.push(response.message)
    }

    // ---- 3. action 为 null → continue ----
    if (action === undefined || action === null) {
      // 已 push assistant message，直接进入下一轮
      continue
    }

    // ---- 4. guardrail 三态分流（传 options.dangerousPatterns，非默认） ----
    const guard = guardrail(action, dangerousPatterns)
    if (guard.disposition === 'deny') {
      const feedback = `该动作被策略拦截: ${guard.reason ?? '未知原因'}`
      context.push({ role: 'user', content: feedback })
      tracer.record(steps, action, feedback, feedback)
      continue
    }
    if (guard.disposition === 'escalate') {
      // 无 approver 时 escalate 降级为 deny（MVP 默认行为）
      if (!approver) {
        const feedback = `该动作需人工审批但无 approver，已降级拒绝: ${guard.reason ?? '未知原因'}`
        context.push({ role: 'user', content: feedback })
        tracer.record(steps, action, feedback, feedback)
        continue
      }
      const ok = await approver(action)
      if (!ok) {
        const feedback = `人工审批拒绝: ${guard.reason ?? '未知原因'}`
        context.push({ role: 'user', content: feedback })
        tracer.record(steps, action, feedback, feedback)
        continue
      }
      // ok=true → 放行执行（fall through 到下方 action 分发）
    }

    // ---- 5. done ----
    if (action.type === 'done') {
      answer = action.answer ?? 'Task completed'
      done = true
      tracer.record(steps, action, answer)
      continue
    }

    // ---- 6. call_tool ----
    if (action.type === 'call_tool') {
      const toolName = action.tool ?? ''
      const args = action.args ?? {}
      let resultText: string
      let feedback: string | undefined
      try {
        const result = await tools.execute(toolName, args)
        if (result.success) {
          resultText = result.data ?? ''
          context.push({ role: 'user', content: resultText })
          tracer.record(steps, action, resultText)
        } else {
          // 失败：push 结果文本 + push 反馈（重点维度反馈闭环核心）
          resultText = result.error ?? '工具执行失败（无错误信息）'
          feedback = `工具执行失败: ${resultText}。请修正你的方法后重试。`
          context.push({ role: 'user', content: resultText })
          context.push({ role: 'user', content: feedback })
          tracer.record(steps, action, resultText, feedback)
        }
      } catch (e) {
        // 异常：push 异常文本 + 反馈
        const msg = e instanceof Error ? e.message : String(e)
        feedback = `工具执行失败: ${msg}。请修正你的方法后重试。`
        context.push({ role: 'user', content: feedback })
        tracer.record(steps, action, msg, feedback)
      }
      continue
    }

    // ---- 7. take_note ----
    if (action.type === 'take_note') {
      const key = action.noteKey ?? ''
      const value = action.noteValue ?? ''
      await memory.write(key, value)
      const noteText = `已记录 ${key}=${value}`
      tracer.record(steps, action, noteText)
      continue
    }

    // ---- 8. 未知 action type ----
    const unknownText = `未知动作类型: ${action.type}`
    context.push({ role: 'user', content: unknownText })
    tracer.record(steps, action, unknownText)
  }

  // ---- 9. 循环结束：consolidate + flush ----
  await memory.consolidate()
  await tracer.flush()

  if (!done) {
    return `达到最大步数 (${maxSteps})，任务未完成。`
  }
  return answer
}
