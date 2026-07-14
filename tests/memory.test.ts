import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileMemory } from '../src/memory'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const P = path.join(os.tmpdir(), 'agent-harness-mem-test.json')

describe('FileMemory', () => {
  let mem: FileMemory
  beforeEach(() => { try { fs.unlinkSync(P) } catch {} mem = new FileMemory(P) })
  afterEach(() => { try { fs.unlinkSync(P) } catch {} })

  it('returns null for unknown key', async () => {
    expect(await mem.read('nope')).toBeNull()
  })

  it('stores and retrieves', async () => {
    await mem.write('lang', 'TypeScript')
    expect(await mem.read('lang')).toBe('TypeScript')
  })

  it('overwrites existing key', async () => {
    await mem.write('k', 'v1'); await mem.write('k', 'v2')
    expect(await mem.read('k')).toBe('v2')
  })

  it('persists to disk', async () => {
    await mem.write('persist', 'data')
    const m2 = new FileMemory(P)
    expect(await m2.read('persist')).toBe('data')
  })

  it('recovers from corrupted file', async () => {
    fs.writeFileSync(P, '{not json', 'utf-8')
    const m = new FileMemory(P)
    expect(await m.read('any')).toBeNull()
  })
})
