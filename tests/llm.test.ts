import { describe, it, expect, beforeEach } from 'vitest'
import { MockLLM } from '../src/llm/mock'
import { DeepSeekProvider } from '../src/llm/deepseek'
import { Action } from '../src/types'

describe('MockLLM', () => {
  let mock: MockLLM
  beforeEach(() => { mock = new MockLLM() })

  it('returns a one-shot preset response', async () => {
    mock.setResponse({ type: 'done', answer: 'Task complete' })
    const result = await mock.chat([{ role: 'user', content: 'hi' }], [])
    expect(result.action?.type).toBe('done')
    expect(result.action?.answer).toBe('Task complete')
  })

  it('one-shot is not consumed', async () => {
    mock.setResponse({ type: 'done', answer: 'x' })
    await mock.chat([{ role: 'user', content: 'a' }], [])
    const r2 = await mock.chat([{ role: 'user', content: 'b' }], [])
    expect(r2.action?.answer).toBe('x')
  })

  it('throws when no response configured', async () => {
    await expect(mock.chat([{ role: 'user', content: 'hi' }], [])).rejects.toThrow('No preset response configured')
  })

  it('serves a response queue in order', async () => {
    mock.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: 'x' } },
      { type: 'done', answer: 'done' },
    ])
    const r1 = await mock.chat([{ role: 'user', content: 'go' }], [])
    const r2 = await mock.chat([{ role: 'user', content: 'go' }], [])
    expect(r1.action?.type).toBe('call_tool')
    expect(r2.action?.type).toBe('done')
  })

  it('setResponses resets one-shot (mutual exclusion)', async () => {
    mock.setResponse({ type: 'done', answer: 'one-shot' })
    mock.setResponses([{ type: 'done', answer: 'queue' }])
    const r = await mock.chat([{ role: 'user', content: 'go' }], [])
    expect(r.action?.answer).toBe('queue')
  })

  it('throws when queue exhausted', async () => {
    mock.setResponses([{ type: 'done', answer: 'x' }])
    await mock.chat([{ role: 'user', content: 'go' }], [])
    await expect(mock.chat([{ role: 'user', content: 'go' }], [])).rejects.toThrow('No preset response configured')
  })

  it('records conversation history', async () => {
    mock.setResponse({ type: 'done', answer: 'ok' })
    await mock.chat([{ role: 'user', content: 'first' }], [])
    expect(mock.getHistory().length).toBeGreaterThan(0)
  })
})

describe('DeepSeekProvider', () => {
  it('constructs without network', () => {
    const p = new DeepSeekProvider('sk-fake', 'deepseek-chat')
    expect(p).toBeDefined()
  })
})
