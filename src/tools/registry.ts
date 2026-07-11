// ============================================================
// ToolRegistry — 工具注册表，统一调度 agent 可用工具
// ============================================================

import type { ToolDef, ToolResult } from '../types'

export class ToolRegistry {
  private tools: Map<string, ToolDef> = new Map()

  // 注册一个工具实例；同名工具会被覆盖（后注册者胜）
  register(tool: ToolDef): void {
    this.tools.set(tool.name, tool)
  }

  // 列出所有已注册工具
  list(): ToolDef[] {
    return [...this.tools.values()]
  }

  // 按名获取工具；不存在返回 undefined
  get(name: string): ToolDef | undefined {
    return this.tools.get(name)
  }

  // 执行指定工具；未知工具名抛错
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`)
    }
    return tool.execute(args)
  }
}
