import { describe, it, expect } from 'vitest'

describe('CLI entry', () => {
  it('module loads without error', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
  })
})
