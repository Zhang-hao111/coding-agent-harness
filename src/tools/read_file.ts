// ============================================================
// ReadFileTool — 读取文件内容
// ============================================================

import * as fs from 'fs'
import * as path from 'path'
import type { ToolDef, ToolResult } from '../types'

export class ReadFileTool implements ToolDef {
  name = 'read_file'
  description = '读取指定路径的文件内容'

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const raw = args.path
    if (typeof raw !== 'string' || raw.length === 0) {
      return { success: false, error: '缺少 path 参数' }
    }

    const filePath = path.resolve(raw)
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data }
    } catch (e) {
      // 文件不存在等错误；error 描述含"不存在"
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: `文件不存在或无法读取: ${msg}` }
    }
  }
}
