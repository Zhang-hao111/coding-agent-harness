import { describe, it, expect, afterEach } from 'vitest'
import { startWebServer } from '../src/web/server'
import { Tracer } from '../src/tracer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const D = path.join(os.tmpdir(), 'agent-harness-web-test-' + Date.now())

describe('WebUI server', () => {
  let stop: () => Promise<void>

  afterEach(async () => {
    if (stop) await stop()
    try { fs.rmSync(D, { recursive: true, force: true }) } catch {}
  })

  it('serves panel at /', async () => {
    fs.mkdirSync(D, { recursive: true })
    const srv = await startWebServer(D, 3456)
    stop = srv.close
    const res = await fetch('http://localhost:3456/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Agent') // 面板标题等
  })

  it('returns empty sessions when no traces', async () => {
    fs.mkdirSync(D, { recursive: true })
    const srv = await startWebServer(D, 3457)
    stop = srv.close
    const res = await fetch('http://localhost:3457/api/traces')
    const json = await res.json()
    expect(json.sessions).toEqual([])
  })

  it('returns sessions from trace files', async () => {
    fs.mkdirSync(D, { recursive: true })
    const tr = new Tracer(D)
    tr.record(1, { type: 'done', answer: 'hi' }, 'hi')
    await tr.flush()
    const srv = await startWebServer(D, 3458)
    stop = srv.close
    const json = await (await fetch('http://localhost:3458/api/traces')).json()
    expect(json.sessions.length).toBe(1)
    expect(json.sessions[0][0].step).toBe(1)
  })
})