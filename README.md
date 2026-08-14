# Coding Agent Harness

> Agent = LLM × Harness — 一个轻量级的编码智能体框架，核心是反馈驱动的自我修正循环。

构建一个面向编码场景的 agent harness，让 LLM 能可靠地读写文件、执行命令、自我修正。本项目是 AI4SE 2026 期末项目 A 的交付产物。

## 核心特性

- **Agent 主循环** — 自实现的 while 循环：组织上下文 → 调用 LLM → 解析动作 → 分发执行 → 回灌结果 → 停机判断
- **工具系统** — 读写文件、执行 shell 命令（参数通过 JSON Schema 暴露给 LLM）
- **Function Calling** — DeepSeek 通过 OpenAI 兼容协议直接调用工具，无需文本协议解析
- **治理护栏** — 危险命令自动拦截，拦截逻辑是代码而非提示词
- **反馈闭环** — 工具执行失败时自动回灌错误信息，驱动 agent 自我修正
- **记忆系统** — 跨会话键值存储，按需检索
- **可观测性** — 每步决策与动作完整记录为 trace 文件，便于调试与复盘
- **凭据安全** — API Key 加密存储，不进入源码或日志

## 快速开始

### 前提

- Node.js 20+
- npm
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

### 安装与配置

```bash
# 克隆仓库
git clone https://github.com/Zhang-hao111/coding-agent-harness.git
cd coding-agent-harness

# 安装依赖
npm install

# 构建
npm run build

# 配置 API Key（首次运行，加密存储）
node dist/index.js config
```

### 运行

```bash
# 运行 agent（需要 DEEPSEEK_API_KEY 环境变量）
export DEEPSEEK_API_KEY=sk-your-key
node dist/index.js run "写一个 hello.txt 文件，内容为 Hello World"

# 或用 mock LLM 模式（无需 API Key，跑固定 canned 脚本验证 harness 主循环）
# --mock 会执行 write_file(hello.txt) + done，不调用真实 LLM
node dist/index.js run --mock "测试任务"
```

### Docker

```bash
docker build -t coding-agent-harness .
docker run -it -v ~/.agent-harness:/root/.agent-harness coding-agent-harness run "你的任务描述"
```

## 目录结构

```
coding-agent-harness/
├── src/
│   ├── index.ts           # CLI 入口
│   ├── harness.ts         # Harness 核心 + agent loop
│   ├── llm/               # LLM 抽象层（interface + DeepSeek + MockLLM + tools 定义）
│   ├── tools/             # 工具系统（read_file / write_file / shell）
│   ├── guardrail.ts       # 治理护栏
│   ├── memory.ts          # 跨会话记忆
│   ├── tracer.ts          # 可观测性（trace 文件）
│   ├── config.ts          # 配置加载
│   └── types.ts           # 共享类型
├── tests/                 # 单元测试（含 mock-LLM 测试）
├── SPEC.md                # 设计文档（v1.0）
├── SPEC-2.md              # 设计文档（v2.0 function calling）
├── PLAN.md                # 实现计划
├── AGENT_LOG.md           # 过程日志
├── Dockerfile
└── README.md
```

## 凭据安全

- **API Key 绝不硬编码**进源码，绝不提交进 Git
- 加密存储到 `~/.agent-harness/credentials.json`（AES-256-GCM，二进制 payload）
- 也支持通过 `DEEPSEEK_API_KEY` 环境变量读取（明文风险，详见 SPEC）
- 凭据状态查看时不回显明文

## 安全边界

- 危险 shell 命令（`rm -rf /`、`dd`、`mkfs` 等）被 guardrail 自动拦截
- 所有工具执行有超时限制（默认 30s）
- 日志不写入任何凭据信息

## 技术栈

| 层 | 选型 |
|----|------|
| 语言 | TypeScript 5.x |
| 运行时 | Node.js 20+ |
| LLM 供应商 | DeepSeek（OpenAI 兼容协议） |
| CLI | commander |
| 测试 | vitest |
| 分发 | Docker / npm |

## 项目状态

本项目已完成 **v1.0（MVP）** 和 **v2.0（Function Calling 集成）** 两个阶段，核心功能已可运行。

| 阶段 | 版本 | 内容 |
|------|------|------|
| v1.0 | `main` | 六大机制实现（决策封装、工具系统、反馈闭环、治理护栏、记忆、可观测性），Mock LLM 驱动，57/57 测试 |
| v2.0 | `task/16-function-calling` | DeepSeek 真实 LLM 端到端执行，OpenAI 兼容 function calling 协议，工具参数 JSON Schema 暴露 |

## 许可证

MIT

## 课程信息

- 课程：AI4SE 2026 · 南京大学软件学院
- 项目文档：`SPEC.md`、`PLAN.md`、`AGENT_LOG.md`、`SPEC_PROCESS.md`、`REFLECTION.md`