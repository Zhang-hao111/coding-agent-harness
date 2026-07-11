// ============================================================
// ShellTool — 执行 shell 命令（带超时）
// ============================================================

import { execSync } from 'child_process'
import type { ToolDef, ToolResult } from '../types'

export class ShellTool implements ToolDef {
  name = 'shell'
  description = '执行 shell 命令并返回 stdout'
  private timeout: number  // 秒

  constructor(timeout: number = 30) {
    this.timeout = timeout
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args.command
    if (typeof command !== 'string' || command.length === 0) {
      return { success: false, error: '缺少 command 参数' }
    }

    try {
      // execSync 的 timeout 单位为毫秒
      const stdout = execSync(command, {
        timeout: this.timeout * 1000,
        maxBuffer: 10 * 1024 * 1024,  // 10MB
        encoding: 'utf-8',
      })
      return { success: true, data: stdout }
    } catch (e) {
      // 命令失败：返回已捕获的 stdout 与 stderr
      const err = e as { stdout?: string; stderr?: string; message?: string }
      const stdout = err.stdout ?? ''
      const stderr = err.stderr ?? err.message ?? ''
      return { success: false, data: stdout, error: stderr }
    }
  }
}
