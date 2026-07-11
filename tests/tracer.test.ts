import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Tracer } from '../src/tracer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const D = path.join(os.tmpdir(), 'agent-harness-trace-test')

describe('Tracer', () => {
  let t: Tracer
  beforeEach(() => { try { fs.rmSync(D, { recursive: true, force: true }) } catch {} t = new Tracer(D) })
  afterEach(() => { try { fs.rmSync(D, { recursive: true, force: true }) } catch {} })

  it('records a step', () => {
    t.record(1, { type: 'call_tool', tool: 'read_file', args: { path: 'x' } }, 'content')
    expect(t.getTrace().length).toBe(1)
    expect(t.getTrace()[0].step).toBe(1)
  })

  it('records feedback when provided', () => {
    t.record(1, { type: 'call_tool', tool: 'read_file', args: { path: 'x' } }, 'err', '工具失败')
    expect(t.getTrace()[0].feedback).toBe('工具失败')
  })

  it('returns empty when nothing recorded', () => {
    expect(t.getTrace().length).toBe(0)
  })

  it('flushes to disk', async () => {
    t.record(1, { type: 'done', answer: 'done' }, '')
    await t.flush()
    expect(fs.readdirSync(D).length).toBeGreaterThan(0)
  })
})
