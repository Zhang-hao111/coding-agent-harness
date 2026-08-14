import { describe, it, expect } from 'vitest'
import { parseToolCall } from '../src/llm/deepseek'

describe('parseToolCall', () => {
  it('parses done action', () => {
    const tc = { id: 'call_1', type: 'function' as const, function: { name: 'done', arguments: '{"answer":"finished"}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('done')
    expect(action.answer).toBe('finished')
    expect(action.tool_call_id).toBe('call_1')
  })

  it('parses call_tool action', () => {
    const tc = { id: 'call_2', type: 'function' as const, function: { name: 'read_file', arguments: '{"path":"test.txt"}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('call_tool')
    expect(action.tool).toBe('read_file')
    expect(action.args).toEqual({ path: 'test.txt' })
    expect(action.tool_call_id).toBe('call_2')
  })

  it('parses take_note action', () => {
    const tc = { id: 'call_3', type: 'function' as const, function: { name: 'take_note', arguments: '{"key":"k","value":"v"}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('take_note')
    expect(action.noteKey).toBe('k')
    expect(action.noteValue).toBe('v')
  })

  it('handles invalid JSON arguments gracefully', () => {
    const tc = { id: 'call_4', type: 'function' as const, function: { name: 'read_file', arguments: 'not-json' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('call_tool')
    expect(action.args).toEqual({})  // 降级为空对象
  })

  it('done falls back to default answer when answer missing', () => {
    const tc = { id: 'call_5', type: 'function' as const, function: { name: 'done', arguments: '{}' } }
    const action = parseToolCall(tc)
    expect(action.type).toBe('done')
    expect(action.answer).toBe('Task completed')
  })
})
