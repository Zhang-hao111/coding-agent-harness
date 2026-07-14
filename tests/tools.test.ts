import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ToolRegistry } from '../src/tools/registry'
import { ReadFileTool } from '../src/tools/read_file'
import { WriteFileTool } from '../src/tools/write_file'
import { ShellTool } from '../src/tools/shell'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TMP = path.join(os.tmpdir(), 'agent-harness-tool-' + Date.now())

describe('ToolRegistry', () => {
  it('registers and lists tools', () => {
    const reg = new ToolRegistry()
    reg.register(new ReadFileTool()); reg.register(new WriteFileTool()); reg.register(new ShellTool(30))
    const names = reg.list().map(t => t.name)
    expect(names).toEqual(expect.arrayContaining(['read_file', 'write_file', 'shell']))
  })

  it('throws for unknown tool', async () => {
    const reg = new ToolRegistry()
    await expect(reg.execute('unknown', {})).rejects.toThrow('Unknown tool')
  })
})

describe('ReadFileTool', () => {
  beforeEach(() => fs.mkdirSync(TMP, { recursive: true }))
  afterEach(() => fs.rmSync(TMP, { recursive: true, force: true }))

  it('reads an existing file', async () => {
    const p = path.join(TMP, 't.txt'); fs.writeFileSync(p, 'hello', 'utf-8')
    const r = await new ReadFileTool().execute({ path: p })
    expect(r.success).toBe(true); expect(r.data).toBe('hello')
  })

  it('returns error for missing file', async () => {
    const r = await new ReadFileTool().execute({ path: path.join(TMP, 'no.txt') })
    expect(r.success).toBe(false); expect(r.error).toContain('不存在')
  })
})

describe('WriteFileTool', () => {
  beforeEach(() => fs.mkdirSync(TMP, { recursive: true }))
  afterEach(() => fs.rmSync(TMP, { recursive: true, force: true }))

  it('creates directories automatically', async () => {
    const p = path.join(TMP, 'sub/deep/o.txt')
    const r = await new WriteFileTool().execute({ path: p, content: 'nested' })
    expect(r.success).toBe(true); expect(fs.readFileSync(p, 'utf-8')).toBe('nested')
  })
})

describe('ShellTool', () => {
  it('executes a command', async () => {
    const r = await new ShellTool(30).execute({ command: 'echo hello' })
    expect(r.success).toBe(true); expect(r.data).toContain('hello')
  })

  it('captures failure', async () => {
    const r = await new ShellTool(30).execute({ command: 'nonexistent_cmd_xyz' })
    expect(r.success).toBe(false)
  })
})
