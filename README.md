# Coding Agent Harness

> Agent = LLM × Harness — 一个轻量级的编码智能体框架，核心是反馈驱动的自我修正循环。

构建一个面向编码场景的 agent harness，让 LLM 能可靠地读写文件、执行命令、自我修正。本项目是 AI4SE 2026 期末项目 A 的交付产物。

## 核心特性

- **Agent 主循环** — 自实现的 while 循环：组织上下文 → 调用 LLM → 解析动作 → 分发执行 → 回灌结果 → 停机判断
- **工具系统** — 读写文件、执行 shell 命令
- **治理护栏** — 危险命令自动拦截，拦截逻辑是代码而非提示词
- **反馈闭环** — 工具执行失败时自动回灌错误信息，驱动 agent 自我修正
- **记忆系统** — 跨会话键值存储，按需检索
- **可观测性** — 每步决策与动作完整记录，支持 WebUI 调试面板
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

# 配置 API Key（首次运行）
npm run agent-harness config
```

### 运行

```bash
# 运行 agent
npm run agent-harness run "你的任务描述"

# 启动 WebUI 调试面板
npm run agent-harness web
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
│   ├── llm/               # LLM 抽象层（interface + DeepSeek 实现）
│   ├── tools/             # 工具系统（read_file / write_file / shell）
│   ├── guardrail.ts       # 治理护栏
│   ├── feedback/          # 反馈闭环（传感器 → 解析器 → 分类器 → 注入器）
│   ├── memory.ts          # 跨会话记忆
│   ├── tracer.ts          # 可观测性
│   ├── config.ts          # 配置加载
│   └── types.ts           # 共享类型
├── webui/                 # Open Design 调试面板
├── tests/                 # 单元测试（含 mock-LLM 测试）
├── SPEC.md                # 设计文档
├── PLAN.md                # 实现计划
├── AGENT_LOG.md           # 过程日志
├── Dockerfile
└── README.md
```

## 凭据安全

- **API Key 绝不硬编码**进源码，绝不提交进 Git
- 加密存储到 `~/.agent-harness/credentials.enc`（AES-256-GCM）
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
| WebUI 设计系统 | Open Design |
| 分发 | Docker / npm |

## 项目状态

本项目处于 **MVP 阶段**，核心功能已可运行。后续规划：

- 反馈闭环深入：自动运行 tsc/lint/test → 结构化解析 → 失败分类 → 多轮修正
- WebUI 调试面板完善
- 线上部署

## 许可证

MIT

## 课程信息

- 课程：AI4SE 2026 · 南京大学软件学院
- 项目文档：`SPEC.md`、`PLAN.md`、`AGENT_LOG.md`、`SPEC_PROCESS.md`、`REFLECTION.md`