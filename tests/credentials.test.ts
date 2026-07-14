import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CredentialManager } from '../src/credentials'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const P = path.join(os.tmpdir(), 'agent-harness-cred-test.enc')

describe('CredentialManager', () => {
  let m: CredentialManager
  beforeEach(() => { try { fs.unlinkSync(P) } catch {} m = new CredentialManager(P) })
  afterEach(() => { try { fs.unlinkSync(P) } catch {} })

  it('not configured initially', () => {
    expect(m.isConfigured()).toBe(false)
  })

  it('stores and retrieves', async () => {
    await m.save('sk-test-123', 'pw')
    expect(await m.load('pw')).toBe('sk-test-123')
    expect(m.isConfigured()).toBe(true)
  })

  it('fails with wrong password', async () => {
    await m.save('sk-test', 'correct')
    await expect(m.load('wrong')).rejects.toThrow()
  })

  it('clears credentials', async () => {
    await m.save('sk-test', 'pw')
    await m.clear()
    expect(m.isConfigured()).toBe(false)
  })
})
