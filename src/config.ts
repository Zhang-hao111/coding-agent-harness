// ============================================================
// 配置加载 — 声明式规则约束 agent 行为
// ============================================================
//
// config 维度：loadConfig 从默认值 + overrides 合成 HarnessConfig。
// - dangerousPatterns 复用 guardrail.ts 的 DEFAULT_DANGEROUS_PATTERNS（DRY，不重复定义正则）
// - 持久化数据默认统一存 ~/.agent-harness/
// - overrides 可覆盖任意字段（如测试用临时路径、自定义危险模式）

import type { HarnessConfig } from './types'
import { DEFAULT_DANGEROUS_PATTERNS } from './guardrail'
import * as path from 'path'
import * as os from 'os'

// 持久化数据根目录：~/.agent-harness/
const HARNESS_HOME = path.join(os.homedir(), '.agent-harness')

/**
 * 默认配置。dangerousPatterns 直接引用 guardrail.ts 的常量，不重复定义。
 */
export function loadConfig(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  const defaults: HarnessConfig = {
    maxSteps: 50,
    dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS,
    memoryPath: path.join(HARNESS_HOME, 'memory.json'),
    tracesDir: path.join(HARNESS_HOME, 'traces'),
    credentialsPath: path.join(HARNESS_HOME, 'credentials.json'),
  }
  return { ...defaults, ...overrides }
}
