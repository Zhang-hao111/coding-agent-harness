/**
 * 机制演示（§A.6）——不依赖真实 LLM 与网络
 * ① 治理护栏拦截危险动作（三态分级）
 * ② 注入失败，反馈闭环使 agent 收到反馈并据此改变下一步动作
 * ③ 重点维度（反馈闭环）多轮确定性行为
 */
import { describe, it, expect } from 'vitest'
import { guardrail, DEFAULT_DANGEROUS_PATTERNS } from '../src/guardrail'
import { runAgent } from '../src/harness'
import { MockLLM } from '../src/llm/mock'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import { FileMemory } from '../src/memory'
import { Tracer } from '../src/tracer'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

const DEMO = path.join(os.tmpdir(), 'agent-harness-demo-' + Date.now())
function setup(memFile = 'memory.json', traceDir = 'traces') {
  fs.mkdirSync(DEMO, { recursive: true })
  const llm = new MockLLM()
  const reg = new ToolRegistry()
  reg.register(new ReadFileTool()); reg.register(new WriteFileTool()); reg.register(new ShellTool(30))
  return { llm, reg, mem: new FileMemory(path.join(DEMO, memFile)), tr: new Tracer(path.join(DEMO, traceDir)) }
}

describe('① Guardrail 三态拦截', () => {
  it('escalates rm -rf / (确定)', () => {
    const a = { type: 'call_tool' as const, tool: 'shell', args: { command: 'rm -rf /' } }
    const r = guardrail(a, DEFAULT_DANGEROUS_PATTERNS)
    expect(r.disposition).toBe('escalate'); expect(r.reason).toBeDefined()
    expect(guardrail(a, DEFAULT_DANGEROUS_PATTERNS)).toEqual(r) // 确定性
  })

  it('denies fork bomb', () => {
    const a = { type: 'call_tool' as const, tool: 'shell', args: { command: ':(){ :|:& };:' } }
    expect(guardrail(a, DEFAULT_DANGEROUS_PATTERNS).disposition).toBe('deny')
  })

  it('allows safe command', () => {
    const a = { type: 'call_tool' as const, tool: 'shell', args: { command: 'ls -la' } }
    expect(guardrail(a, DEFAULT_DANGEROUS_PATTERNS).disposition).toBe('allow')
  })
})

describe('② 反馈闭环使 agent 改变下一步动作', () => {
  it('失败→反馈→改走 done', async () => {
    const { llm, reg, mem, tr } = setup()
    llm.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: '/nonexistent_demo_xyz' } },
      { type: 'done', answer: 'changed approach after feedback' },
    ])
    const r = await runAgent('demo feedback', llm, reg, { maxSteps: 10, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory: mem, tracer: tr })
    expect(r).toContain('changed approach')      // 改变了动作
    const trace = tr.getTrace()
    expect(trace.some(t => t.feedback !== undefined)).toBe(true)  // 收到反馈
    expect(trace.some(t => t.action.type === 'done')).toBe(true)  // 第二步改走 done
  })
})

describe('③ 反馈闭环多轮确定性行为', () => {
  it('连续失败→每轮注入反馈→达 maxSteps 停机', async () => {
    const { llm, reg, mem, tr } = setup('m2.json', 't2')
    llm.setResponses([
      { type: 'call_tool', tool: 'read_file', args: { path: '/no_x1' } },
      { type: 'call_tool', tool: 'read_file', args: { path: '/no_x2' } },
      { type: 'call_tool', tool: 'read_file', args: { path: '/no_x3' } },
    ])
    const r = await runAgent('demo multi', llm, reg, { maxSteps: 3, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS, memory: mem, tracer: tr })
    expect(r).toContain('达到最大步数')
    const feedbacks = tr.getTrace().filter(t => t.feedback !== undefined)
    expect(feedbacks.length).toBe(3)            // 每轮都注入反馈，确定性
  })
})
