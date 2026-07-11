import { describe, it, expect } from 'vitest'
import { guardrail, DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import { Action } from '../src/types'

describe('guardrail', () => {
  it('allows safe shell', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'ls -la' } }
    expect(guardrail(a).disposition).toBe('allow')
  })

  it('escalates rm -rf /', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } }
    const r = guardrail(a)
    expect(r.disposition).toBe('escalate'); expect(r.reason).toBeDefined()
  })

  it('escalates mkfs', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'mkfs.ext4 /dev/sda1' } }
    expect(guardrail(a).disposition).toBe('escalate')
  })

  it('denies fork bomb', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: ':(){ :|:& };:' } }
    expect(guardrail(a).disposition).toBe('deny')
  })

  it('allows non-shell action', () => {
    const a: Action = { type: 'call_tool', tool: 'read_file', args: { path: 'x' } }
    expect(guardrail(a).disposition).toBe('allow')
  })

  it('allows done action', () => {
    expect(guardrail({ type: 'done', answer: 'ok' }).disposition).toBe('allow')
  })

  it('is deterministic', () => {
    const a: Action = { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } }
    expect(guardrail(a)).toEqual(guardrail(a))
  })
})
