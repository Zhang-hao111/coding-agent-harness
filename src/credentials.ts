// ============================================================
// 凭据管理 — AES-256-GCM 加密存储
// ============================================================
//
// §9.3 凭据安全核心：API Key 绝不硬编码、不进 Git、不写日志/history/明文配置。
// 本模块用 AES-256-GCM 对称加密，把 apiKey 以二进制 .enc 文件持久化。
// 主密码（masterPassword）经 PBKDF2 派生出 256 位密钥，本身不入库。
//
// 安全约束（硬性）：
// - 禁止任何 console.log/error 打印明文 apiKey 或 masterPassword
// - 加密文件为二进制 Buffer，非明文
// - 每次 save 用 crypto.randomBytes 生成 salt/iv（防重放）

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// ---- 加密常量（逐字匹配 brief） ----

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT_LENGTH = 32
const PBKDF2_ITERATIONS = 100000

// ============================================================
// CredentialManager
// ============================================================

export class CredentialManager {
  private readonly filePath: string
  private configured: boolean

  constructor(filePath: string) {
    this.filePath = filePath
    this.configured = fs.existsSync(filePath)
  }

  /**
   * 是否已存在凭据文件。
   */
  isConfigured(): boolean {
    return this.configured
  }

  /**
   * 加密并写入 apiKey。
   * payload 布局：salt(32) | iv(16) | tag(16) | encrypted
   */
  async save(apiKey: string, masterPassword: string): Promise<void> {
    // 随机 salt/iv，每次不同（防重放）
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    // 由 masterPassword + salt 派生 256 位密钥
    const key = crypto.pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag() // TAG_LENGTH=16

    // 确保目录存在（跨平台 path 拼接）
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const payload = Buffer.concat([salt, iv, tag, encrypted])
    fs.writeFileSync(this.filePath, payload)
    this.configured = true
  }

  /**
   * 读取并解密 apiKey。
   * 错密码时 GCM auth tag 校验失败，decipher.final() 自然抛错。
   */
  async load(masterPassword: string): Promise<string> {
    const payload = fs.readFileSync(this.filePath)

    // 按 SALT/IV/TAG 长度切片
    const salt = payload.subarray(0, SALT_LENGTH)
    const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    const encrypted = payload.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

    const key = crypto.pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    // 错密码时 final() 抛错（GCM 校验失败，正常）
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  }

  /**
   * 删除凭据文件。
   */
  async clear(): Promise<void> {
    try {
      fs.unlinkSync(this.filePath)
    } catch {
      // 文件不存在则忽略
    }
    this.configured = false
  }
}
