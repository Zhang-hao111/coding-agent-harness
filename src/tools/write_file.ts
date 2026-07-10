// ============================================================
// WriteFileTool — 写入文件，自动创建父目录
// ============================================================

import * as fs from 'fs'
import * as path from 'path'
import type { ToolDef, ToolResult } from '../types'

export class WriteFileTool implements ToolDef {
  name = 'write_file'
  description = '将内容写入指定路径的文件，自动创建父目录'

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const raw = args.path
    if (typeof raw !== 'string' || raw.length === 0) {
      return { success: false, error: '缺少 path 参数' }
    }

    const content = typeof args.content === 'string' ? args.content : ''
    const filePath = path.resolve(raw)

    try {
      // 自动创建父目录（递归）
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true, data: `已写入 ${filePath}` }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, error: `写入失败: ${msg}` }
    }
  }
}
