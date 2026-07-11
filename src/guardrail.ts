// ============================================================
// 治理护栏 — 三态分级（allow / deny / escalate）
// ============================================================
//
// 机制是代码不是提示词：guardrail 是纯函数，对 action 做确定性检查。
// - allow  : 放行执行
// - deny   : 拦截 + 反馈给 agent 自我修正
// - escalate: 暂停，等待 HITL 审批（approver 注入点见任务 10）
//
// 真实 approver（readline）在任务 10 挂载；本文件仅定义纯类型。

import type { Action, GuardrailResult, DangerousPattern } from './types'

// 再导出 DangerousPattern，避免在 guardrail.ts 重新定义导致循环依赖
export type { DangerousPattern } from './types'

// ---- 默认危险模式分级表（MVP） ----

export const DEFAULT_DANGEROUS_PATTERNS: DangerousPattern[] = [
  { pattern: /^rm\s+-rf\s+\//,        disposition: 'escalate', reason: '删除文件系统' },
  { pattern: /^mkfs/,                  disposition: 'escalate', reason: '格式化磁盘' },
  { pattern: /^dd\s+if=/,              disposition: 'escalate', reason: '覆写磁盘' },
  { pattern: /^>\/dev\/sda/,           disposition: 'escalate', reason: '覆写磁盘' },
  { pattern: /^fdisk/,                 disposition: 'escalate', reason: '改分区表' },
  // fork 炸弹：单管道标准形态 :(){ :|:& };: —— 不要"修正"成双管道 ||
  { pattern: /^:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&/, disposition: 'deny', reason: 'fork 炸弹（单管道标准形态）' },
]

// ---- approver 注入点（纯类型，实现见任务 10） ----

export type Approver = (action: Action) => Promise<boolean>

// ---- guardrail 主函数 ----

/**
 * 对 action 做确定性检查。
 * - 非 call_tool 或非 shell 工具 → allow
 * - 匹配某危险模式 → 返回该模式的 disposition + reason
 * - 不匹配 → allow
 */
export function guardrail(action: Action, patterns: DangerousPattern[] = DEFAULT_DANGEROUS_PATTERNS): GuardrailResult {
  // 非 shell 工具或非 call_tool 的 action 一律放行
  if (action.type !== 'call_tool' || action.tool !== 'shell') {
    return { disposition: 'allow' }
  }

  const command = (action.args?.command as string | undefined) ?? ''

  for (const p of patterns) {
    if (p.pattern.test(command)) {
      return { disposition: p.disposition, reason: p.reason }
    }
  }

  return { disposition: 'allow' }
}
