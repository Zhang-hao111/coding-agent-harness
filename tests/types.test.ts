import { describe, it, expect } from 'vitest'
// 用命名空间 import + 运行时断言，确保 import 不被 esbuild 当作 type-only 剥离
// （type-only import 删掉 src/types.ts 后测试仍会过，红灯失效）
import * as Types from '../src/types'

describe('Type definitions', () => {
  it('module is exported at runtime', () => {
    expect(Types).toBeDefined()
  })

  it('take_note uses noteKey/noteValue', () => {
    const action: Types.Action = { type: 'take_note', noteKey: 'lang', noteValue: 'TypeScript' }
    expect(action.noteKey).toBe('lang')
    expect(action.noteValue).toBe('TypeScript')
  })

  it('GuardrailResult is three-state', () => {
    const r: Types.GuardrailResult = { disposition: 'escalate', reason: 'rm -rf /' }
    const d: Types.Disposition = 'allow'
    expect(['allow', 'deny', 'escalate']).toContain(r.disposition)
    expect(['allow', 'deny', 'escalate']).toContain(d)
  })

  it('ActionType has no spawn_subagent', () => {
    const t: Types.ActionType = 'call_tool'
    expect(t).not.toBe('spawn_subagent')
  })
})