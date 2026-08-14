import { describe, it, expect, beforeEach } from 'vitest'
import { runAgent } from '../src/harness'
import { MockLLM } from '../src/llm/mock'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import { FileMemory } from '../src/memory'
import { Tracer } from '../src/tracer'
import { DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import type { LLMProvider } from '../src/llm/interface'
import type { Message } from '../src/types'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TMP = path.join(os.tmpdir(), 'agent-harness-loop-' + Date.now())

function setup() {
  fs.mkdirSync(TMP, { recursive: true })
  const llm = new MockLLM()
  const registry = new ToolRegistry()
  registry.register(new ReadFileTool()); registry.register(new WriteFileTool()); registry.register(new ShellTool(30))
  const memory = new FileMemory(path.join(TMP, 'memory.json'))
  const tracer = new Tracer(path.join(TMP, 'traces'))
  return { llm, registry, memory, tracer }
}

describe('runAgent', () => {
  beforeEach(() => { try { fs.rmSync(TMP, { recursive: true, force: true }) } catch {} })

  it('completes on done action', async () => {
    const { llm, registry, memory, tracer } = setup()
    llm.setResponse({ type: 'done', answer: 'Task completed' })
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toContain('completed')
  })

  it('stops after maxSteps', async () => {
    const { llm, registry, memory, tracer } = setup()
    llm.setResponse({ type: 'call_tool', tool: 'read_file', args: { path: 'nonexistent' } })
    const r = await runAgent('goal', llm, registry, { maxSteps: 3, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toContain('达到最大步数')
  })

  it('feedback changes next action (demo② core)', async () => {
    const { llm, registry, memory, tracer } = setup()
    llm.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: '/nonexistent_demo_xyz' } },
      { type: 'done', answer: 'switched approach after feedback' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toContain('switched approach')
    const trace = tracer.getTrace()
    expect(trace.some(t => t.feedback !== undefined)).toBe(true)
    expect(trace.some(t => t.action.type === 'done')).toBe(true)
  })

  it('deny disposition lets agent continue loop', async () => {
    const { llm, registry, memory, tracer } = setup()
    llm.setResponses([
      { type: 'call_tool', tool: 'shell', args: { command: ':(){ :|:& };:' } },
      { type: 'done', answer: 'avoided fork bomb' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer })
    expect(r).toContain('avoided fork bomb')
  })

  it('escalate calls approver; false → rejection feedback', async () => {
    const { llm, registry, memory, tracer } = setup()
    let called = false
    const approver = async () => { called = true; return false }
    llm.setResponses([
      { type: 'call_tool', tool: 'shell', args: { command: 'rm -rf /' } },
      { type: 'done', answer: 'gave up destructive action' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer, approver })
    expect(called).toBe(true)
    expect(r).toContain('gave up')
  })

  it('escalate approver true executes action (safe custom pattern)', async () => {
    const { llm, registry, memory, tracer } = setup()
    const patterns = [{ pattern: /^echo/, disposition: 'escalate' as const, reason: 'test escalate' }]
    const approver = async () => true
    llm.setResponses([
      { type: 'call_tool', tool: 'shell', args: { command: 'echo hi' } },
      { type: 'done', answer: 'done' },
    ])
    const r = await runAgent('goal', llm, registry, { maxSteps: 10, dangerousPatterns: patterns, memory, tracer, approver })
    expect(r).toContain('done')
    expect(tracer.getTrace().some(t => t.result.includes('hi'))).toBe(true)
  })
})

describe('runAgent action=undefined handling', () => {
  it('does not silently spin when action is undefined', async () => {
    const { registry, memory, tracer } = setup()
    let callCount = 0
    let secondCallContext: Message[] = []
    const customLLM: LLMProvider = {
      chat: async (messages) => {
        callCount++
        if (callCount === 1) {
          return { message: { role: 'assistant', content: 'I am thinking...' } }
        }
        secondCallContext = messages
        return { action: { type: 'done', answer: 'recovered' }, message: { role: 'assistant', content: 'done' } }
      },
    }
    const r = await runAgent('test', customLLM, registry, {
      maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory, tracer,
    })
    expect(r).toBe('recovered')
    expect(callCount).toBe(2)
    // 第二轮 context 中应包含 hint，提示 LLM 必须调用工具或返回 done
    expect(secondCallContext.some(m => m.role === 'user' && m.content.includes('请调用'))).toBe(true)
  })
})
