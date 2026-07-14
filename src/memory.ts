// ============================================================
// 记忆系统 — 文件级持久化（FileMemory）
// ============================================================
//
// 记忆维度：跨会话持久化 + 按需检索而非全量载入。
// 存储与检索自实现（不接框架 memory）：
// - 内存维护 Map<string, MemoryEntry> 索引
// - 序列化为 MemoryEntry[] JSON 落盘，load 时还原成 Map
// - write 置 dirty=true 后立即 consolidate（满足"write 后落盘"语义）
// - consolidate 仅 dirty 时写盘，无 write 调 consolidate 不重复写盘

import type { MemoryEntry } from './types'
import * as fs from 'fs'
import * as path from 'path'

export class FileMemory {
  private readonly filePath: string
  private readonly entries: Map<string, MemoryEntry> = new Map()
  private dirty: boolean = false

  constructor(filePath: string) {
    this.filePath = filePath
    this.load()
  }

  /**
   * 构造时加载：文件不存在 → 空 Map；
   * 文件损坏（JSON 解析失败或非数组）→ 清空、不抛。
   */
  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        // 非数组视为损坏 → 清空
        return
      }
      for (const entry of parsed as MemoryEntry[]) {
        if (entry && typeof entry.key === 'string') {
          this.entries.set(entry.key, entry)
        }
      }
    } catch {
      // 文件不存在或 JSON 解析失败 → 清空、不抛
    }
  }

  /**
   * 读取记忆。未知 key → null。
   */
  async read(key: string): Promise<string | null> {
    const entry = this.entries.get(key)
    return entry ? entry.value : null
  }

  /**
   * 写入记忆（upsert）：新建 createdAt / 更新 updatedAt。
   * 置 dirty=true 后立即 consolidate，保证 write 后数据已落盘。
   */
  async write(key: string, value: string): Promise<void> {
    const now = new Date().toISOString()
    const existing = this.entries.get(key)
    this.entries.set(key, {
      key,
      value,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    })
    this.dirty = true
    await this.consolidate()
  }

  /**
   * 仅 dirty 时写盘：mkdirSync(dirname, {recursive:true}) + 序列化 MemoryEntry[] + 清 dirty。
   */
  async consolidate(): Promise<void> {
    if (!this.dirty) return
    const dir = path.dirname(this.filePath)
    fs.mkdirSync(dir, { recursive: true })
    const arr: MemoryEntry[] = Array.from(this.entries.values())
    fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 2), 'utf-8')
    this.dirty = false
  }
}
