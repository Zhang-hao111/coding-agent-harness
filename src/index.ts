// ============================================================
// CLI 入口 — run / config / web 三命令
// ============================================================
//
// 决策封装维度的装配点：loadConfig → CredentialManager → LLM（Mock/DeepSeek）
// → ToolRegistry → FileMemory → Tracer → runAgent。
// - 真实模式默认不挂 approver（escalate 降级为 deny，见 harness.ts）
// - 凭据安全：key 绝不 console.log，config --status 仅显示已配置/未配置
// - 主入口守卫防止 vitest import 时触发 program.parse

import 'dotenv/config'
import { Command } from 'commander'
import * as readline from 'readline'
import { loadConfig } from './config'
import { runAgent } from './harness'
import { CredentialManager } from './credentials'
import { MockLLM } from './llm/mock'
import { DeepSeekProvider } from './llm/deepseek'
import { ToolRegistry } from './tools/registry'
import { ReadFileTool } from './tools/read_file'
import { WriteFileTool } from './tools/write_file'
import { ShellTool } from './tools/shell'
import { FileMemory } from './memory'
import { Tracer } from './tracer'
import { DEFAULT_DANGEROUS_PATTERNS } from './guardrail'
import type { LLMProvider } from './llm/interface'

// ============================================================
// 隐藏输入（MVP：接受明文回显，但绝不打印已存储的值）
// ============================================================

/**
 * 交互式读取一行输入。
 * 跨平台稳定隐藏回显不可靠（Windows setRawMode 受限），
 * MVP 接受明文回显——但绝不打印已存储的 key/主密码。
 */
function prompt(promptText: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// ============================================================
// run <goal>
// ============================================================

async function runCommand(goal: string, options: { mock?: boolean }): Promise<void> {
  const cfg = loadConfig()
  const creds = new CredentialManager(cfg.credentialsPath)

  // ---- LLM 装配：--mock 用 MockLLM；否则 DeepSeek ----
  let llm: LLMProvider
  if (options.mock) {
    llm = new MockLLM()
  } else {
    // 真实模式：env 有则用，否则凭据文件，否则报错退出
    const envKey = process.env.DEEPSEEK_API_KEY
    let apiKey: string | undefined
    if (envKey) {
      apiKey = envKey
    } else if (creds.isConfigured()) {
      const masterPassword = await prompt('请输入主密码: ')
      apiKey = await creds.load(masterPassword)
    } else {
      // 绝不打印 key；仅报错
      console.error('未配置 DeepSeek API Key。请先运行 `agent-harness config`，或设置 DEEPSEEK_API_KEY 环境变量。')
      process.exit(1)
    }
    llm = new DeepSeekProvider(apiKey as string)
  }

  // ---- 工具注册 ----
  const tools = new ToolRegistry()
  tools.register(new ReadFileTool())
  tools.register(new WriteFileTool())
  tools.register(new ShellTool())

  // ---- 记忆 + 可观测性 ----
  const memory = new FileMemory(cfg.memoryPath)
  const tracer = new Tracer(cfg.tracesDir)

  // ---- 主循环（真实模式不挂 approver，escalate 降级 deny）----
  const result = await runAgent(goal, llm, tools, {
    maxSteps: cfg.maxSteps,
    dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS,
    memory,
    tracer,
  })
  console.log(result)
}

// ============================================================
// config
// ============================================================

async function configCommand(options: { status?: boolean; clear?: boolean }): Promise<void> {
  const cfg = loadConfig()
  const creds = new CredentialManager(cfg.credentialsPath)

  if (options.status) {
    // 仅显示已配置/未配置，绝不 load、绝不回显 key
    console.log(creds.isConfigured() ? '已配置' : '未配置')
    return
  }

  if (options.clear) {
    await creds.clear()
    console.log('已清除')
    return
  }

  // 无选项 → 交互式保存（输入新 key + 主密码 + 确认）
  const apiKey = await prompt('请输入 DeepSeek API Key: ')
  const masterPassword = await prompt('请输入主密码: ')
  const confirm = await prompt('请再次输入主密码: ')
  if (masterPassword !== confirm) {
    console.error('两次输入的主密码不一致，已取消保存。')
    process.exit(1)
  }
  await creds.save(apiKey, masterPassword)
  console.log('已保存')
}

// ============================================================
// web — Task 12 将替换为真实 Express server
// ============================================================

function webCommand(): void {
  // Task 12 将替换为真实 Express server
  console.log('Web UI 尚未实现（见 Task 12）')
  process.exit(0)
}

// ============================================================
// 主程序
// ============================================================

const program = new Command()

program
  .name('agent-harness')
  .description('Coding Agent Harness — 自实现 agent 主循环的 CLI 入口')

program
  .command('run <goal>')
  .description('运行 agent 主循环完成目标')
  .option('--mock', '使用 MockLLM（离线测试）')
  .action(async (goal: string, options: { mock?: boolean }) => {
    await runCommand(goal, options)
  })

program
  .command('config')
  .description('管理凭据（API Key 加密存储）')
  .option('--status', '显示已配置/未配置（不回显 key）')
  .option('--clear', '清除已存储的凭据')
  .action(async (options: { status?: boolean; clear?: boolean }) => {
    await configCommand(options)
  })

program
  .command('web')
  .description('启动 Web UI（Task 12）')
  .action(() => {
    webCommand()
  })

// ============================================================
// 主入口守卫
// ============================================================
// 防止 vitest import 时触发 CLI 解析（测试用例直接 import 模块）
const isMain = process.argv[1]?.includes('index')
if (isMain) {
  program.parse(process.argv)
}

export { program, runCommand, configCommand, webCommand }
