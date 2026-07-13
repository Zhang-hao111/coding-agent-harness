// ============================================================
// 可观测性 — Tracer（决策与反馈追踪）
// ============================================================
//
// 可观测性维度：记录 agent 每步决策（action）与执行结果（result），
// 可选回灌反馈（feedback）。便于调试与复盘。
// - record 推入 TraceEntry，timestamp 取 runtime ISO 时间
// - getTrace 返回副本，避免外部修改污染内部记录
// - flush 无记录直接返回；否则建目录后写 trace-<Date.now()>.json

import type { TraceEntry, Action } from './types'
import * as fs from 'fs'
import * as path from 'path'

export class Tracer {
  private readonly dir: string
  private readonly entries: TraceEntry[] = []

  constructor(dir: string) {
    this.dir = dir
  }

  /**
   * 记录一步决策与结果。feedback 可选。
   */
  record(step: number, action: Action, result: string, feedback?: string): void {
    const entry: TraceEntry = {
      step,
      action,
      result,
      timestamp: new Date().toISOString(),
    }
    if (feedback !== undefined) {
      entry.feedback = feedback
    }
    this.entries.push(entry)
  }

  /**
   * 返回 trace 副本（浅拷贝数组），防止外部修改污染内部记录。
   */
  getTrace(): TraceEntry[] {
    return this.entries.slice()
  }

  /**
   * 落盘：无记录直接返回；否则 mkdirSync(dir,{recursive:true})
   * 后写 trace-<Date.now()>.json。
   */
  async flush(): Promise<void> {
    if (this.entries.length === 0) return
    fs.mkdirSync(this.dir, { recursive: true })
    const file = path.join(this.dir, `trace-${Date.now()}.json`)
    fs.writeFileSync(file, JSON.stringify(this.entries, null, 2), 'utf-8')
  }
}
