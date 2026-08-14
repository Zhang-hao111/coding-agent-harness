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

// ============================================================
// Task 1: ToolCall + Message 拓宽联合类型 + Action.tool_call_id
// ============================================================

describe('ToolCall type', () => {
  it('can be constructed with required fields', () => {
    const tc: Types.ToolCall = {
      id: 'call_123',
      type: 'function',
      function: { name: 'read_file', arguments: '{"path":"test.txt"}' },
    }
    expect(tc.id).toBe('call_123')
    expect(tc.function.name).toBe('read_file')
  })
})

describe('Message union type', () => {
  it('system message has role system', () => {
    const m: Types.Message = { role: 'system', content: 'test' }
    expect(m.role).toBe('system')
  })

  it('user message has role user', () => {
    const m: Types.Message = { role: 'user', content: 'hi' }
    expect(m.role).toBe('user')
  })

  it('assistant message can have tool_calls', () => {
    const m: Types.Message = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{}' } }],
    }
    expect(m.role).toBe('assistant')
    expect(m.tool_calls).toHaveLength(1)
  })

  it('tool message has tool_call_id', () => {
    const m: Types.Message = { role: 'tool', content: 'result', tool_call_id: 'call_123' }
    expect(m.tool_call_id).toBe('call_123')
  })
})

describe('Action.tool_call_id', () => {
  it('tool_call_id is optional', () => {
    const a: Types.Action = { type: 'done', answer: 'ok' }
    expect(a.tool_call_id).toBeUndefined()
  })
})