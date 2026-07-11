# AGENT_LOG.md — Coding Agent Harness 开发过程日志

> 按时间顺序记录开发全过程。每条含：时间戳、task 编号、触发的 Superpowers 技能、关键事件（prompt 配置 / subagent 输出 / commit hash）、人工干预与原因、学到的教训。
>
> 时间戳取自 git commit 日期（`git log --date=short`）。commit hash 为各 task 的实现提交（`task/N` 分支）与 merge 提交（`feat/mvp`）。

---

## 一、设计阶段（2026-07-10）

### 2026-07-10 — brainstorming → SPEC.md

- **技能：** superpowers:brainstorming
- **事件：** 与用户对话确定项目方向（AI4SE A 类项目：Coding Agent Harness）。明确核心公式 `Agent = LLM × Harness`，六个维度（决策封装/工具/反馈信号/危险动作/记忆/配置），选**反馈闭环**为深入维度。产出 `SPEC.md`（`00f52b4` 初始项目结构：SPEC/README/CLAUDE.md）。
- **关键决策：** 自实现主循环（不寄生 LangChain/AutoGen 等）；机制即代码（护栏/反馈信号=自写校验器，非提示词）；LLM 抽象层可注入 mock；DeepSeek（OpenAI 兼容）；TypeScript 5.x + Docker + Open Design WebUI。

### 2026-07-10 — writing-plans → PLAN.md

- **技能：** superpowers:writing-plans
- **事件：** 产出 `PLAN.md` 实现计划（`8279f99`），拆为 15 个 task，每个 task 含文件/接口/失败测试代码/绿灯门。
- **约束固化：** 绿灯门 = `npm test` 通过 AND `npx tsc --noEmit` 零错误；TDD 先红再绿再重构；凭据 AES-256-GCM 加密不进 Git；持久化统一 `~/.agent-harness/`。

### 2026-07-10 — 冷启动验证 → SPEC_PROCESS.md

- **技能：** §4.5 冷启动验证（用与主开发 agent 不同的 agent，全新 session 仅凭 SPEC + PLAN 实现 1–2 个 task）
- **事件：** dispatch 第二个 agent（独立上下文）凭 SPEC + PLAN 实现 Task 1–2，记录其在何处暂停、暴露的 spec 缺陷。产出 `SPEC_PROCESS.md` 并据反馈修订 SPEC/PLAN（`58a31c4`）。
- **人工干预：** 冷启动 agent 暴露 brief 字段名与 config.ts 真实签名不一致等问题，修订 spec 消歧。
- **教训：** 冷启动验证有效——只有"没看过实现"的 agent 才能暴露 spec 的隐含假设。

### 2026-07-10 — 第二轮审核重写

- **事件：** 第二轮审核（`e492485`）将 SPEC/PLAN 重写为要点式，消除冗长叙述。`e12f2d2` 中英文标签统一为中文。
- **2026-07-11 `6aa3066`：** PLAN 标题改为 `Task N` 格式以兼容 subagent-driven-development 的 `task-brief` 脚本提取。

---

## 二、实现阶段（2026-07-11 ~ 2026-07-12）

> 执行模式：superpowers:subagent-driven-development —— 每 task 一个 fresh implementer subagent（sonnet=glm-5.2，Task 12 起因 classifier 问题改用 haiku=deepseek-v4-pro）+ 两阶段评审（spec 合规 + 代码质量）。每 task 开 `task/N` 分支 → push → 用户手动开 PR + merge → controller 更新 PLAN/ledger → 下一 task。

### Task 1：项目脚手架（2026-07-11）

- **技能：** subagent-driven-development
- **事件：** 实现 `66234db` on task/1，merge `c8522d0`。6 个配置文件（package.json/tsconfig/tsup.config/vitest.config/.gitignore/README）+ npm install。
- **绿灯门：** tsc 0。

### Task 2：类型定义（2026-07-11）

- **事件：** 实现 `653997e` on task/2，merge `8a67b78`。14 类型定义（Action 三态/GuardrailResult/TraceEntry/MemoryEntry/HarnessConfig 等）。
- **Minor（留 final triage）：** 末尾换行、扁平 Action、ActionType 弱断言。

### Task 3：LLM 抽象层（2026-07-11）

- **事件：** 实现 `34a6b15` on task/3，merge `a8911c0` PR #1。MockLLM（含 response 序列 setResponse/setResponses）+ DeepSeekProvider（OpenAI 兼容）。
- **Minor：** 互斥反向未测、getHistory 不含 assistant、history 未拷贝、parseAction answer 兜底、DeepSeek 无网络错误处理。

### Task 4：工具系统（2026-07-11）

- **事件：** 实现 `bb88951` on task/4，merge `aa9a6a3` PR #2。read_file/write_file/shell/registry + 7 测试。Spec ✅ + Approved，无 Critical/Important；绿灯门 19/19 + tsc 0。
- **Minor：** report 疑虑#1 事实性误报（subagent 自己笔误修回后误归因为 brief 笔误）；ShellTool 失败测试 console 噪音（Windows cmd）；tsconfig exclude tests。

### Task 5：治理护栏 三态分级 + HITL（2026-07-11）

- **事件：** 实现 `013aeef` + fix `4cf506d` on task/5，merge `f20dfc7` PR #3。三态 guardrail（allow/deny/escalate）+ 6 默认危险模式（含 fork bomb 单 pipe regex）+ approver 注入点。
- **人工干预（Important fix）：** 评审发现 dd/>/dev/sda/fdisk 三项 regex 测试覆盖不足，dispatch fix subagent 补测试覆盖。
- **教训：** 两阶段评审的 Important 分级有效驱动补测，不止于 Minor 堆积。

### Task 6：记忆系统（2026-07-11）

- **事件：** 实现 `f7b1699` on task/6，merge `3ca283f` PR #4。FileMemory（dirty/consolidate/write 内联 consolidate 落盘）。
- **Minor：** 脏数据跳过守卫。

### Task 7：可观测性 Tracer（2026-07-11）

- **事件：** 实现 `9f567b7` on task/7，merge `5418cc6` PR #5。Tracer（record/getTrace 返回副本/flush 写 trace-<ts>.json）。
- **Minor：** getTrace 浅拷贝。

### Task 8：Agent 主循环（重点集成 task）（2026-07-11）

- **技能：** subagent-driven-development（集成与判断 task）
- **事件：** 实现 `c24d69d` on task/8，merge `502270a` PR #6。主循环按 SPEC §5.2 数据流 9 点分支：三态护栏分流 + 反馈闭环回灌 + HITL approver + take_note noteKey。绿灯门 48/48 + tsc 0。
- **关键测试（反馈闭环核心，机制演示②基础）：** `feedback changes next action`——agent 第一步 call_tool 失败回灌反馈，第二步改走 done。机制为代码（harness.ts 主循环回灌 feedback），非提示词。
- **Minor（留 final triage）：** 死 import HarnessConfig（harness.ts:79）；冗余 `(action as Action)` 断言（harness.ts:222）。

### Task 9：凭据管理（安全核心）（2026-07-11）

- **事件：** 实现 `3a87454` on task/9，merge `466bb0a` PR #7。CredentialManager（AES-256-GCM + pbkdf2 100k sha256 + salt/iv/tag/encrypted payload 布局）。Spec ✅ + Approved。
- **安全核心验证：** 无明文 console 打印 apiKey/masterPassword；GCM auth tag 错密码抛错；iv 用 randomBytes 防重放。
- **人工干预（流程变更）：** dispatch 后 `gh pr create`/`gh pr merge` 一气呵成被 classifier（glm-5.2 安全分类）间歇不可用拦截。用户手动 merge Task 9，并立约定：**"下次 push 后直接暂停等我来 merge"**——后续所有 task 推送后停下等用户手动开 PR + merge。
- **教训：** classifier 间歇不可用是环境波动，非规则问题；换目标模型（sonnet→haiku）无效，因 classifier 拦的是"spawn 动作安全判定"本身，判定仍走 glm-5.2。
- **Minor：** save 加 mkdirSync 微扩展；async 包同步 fs 假异步。

### Task 10：CLI 入口（2026-07-11）

- **事件：** 实现 `ba6698c` on task/10，merge `63b989c` PR #8。run/config/web 三命令 + dotenv + 主入口守卫（`process.argv[1]?.includes('index')` 防止 vitest import 时副作用解析 argv）。绿灯门 49/49 + tsc 0。
- **人工干预（brief 笔误）：** brief 写 `cfg.tracerDir`，但 config.ts 真实字段是 `cfg.tracesDir`。implementer 按真实签名使用（精准修改原则，未改 config.ts）。controller 确认是 brief 笔误，非代码问题。
- **教训：** controller 写 brief 时字段名须核对真实签名；implementer 不应顺手"修正"spec 而应反馈。
- **Minor（留 final triage）：** `as string` 类型断言（index.ts:90）；prompt readline 永不 reject（index.ts:54-62）；内部函数导出轻微越界（index.ts:198）。

### Task 11：机制演示测试（2026-07-12）

- **事件：** 实现 `14d82f8` on task/11，merge `75f5842` PR #9。§A.6 三演示：①护栏三态（escalate/deny/allow + 确定性）②反馈闭环改变下一步动作 ③多轮每轮注入反馈达 maxSteps feedback=3。Spec ✅ + Approved；绿灯门 54/54 + tsc 0。
- **机制为代码非提示词：** ①调 guardrail 纯函数；②③调 runAgent 主循环回灌 feedback（ReadFileTool 返回 {success:false} 触发）。全程 MockLLM，无网络无真实 LLM。
- **Minor（均来自 brief 逐字，非实现偏差）：** DEMO 目录 Date.now() 固定一次但子文件名互不干扰；WriteFileTool 注册未调用；测试文件无 `// ====` 分隔符。

### Task 12：本地 WebUI 调试面板（2026-07-12）

- **技能：** subagent-driven-development（Task 12 起改用 haiku=deepseek-v4-pro，因 classifier 间歇不可用 + 用户指定）
- **事件：** 实现 `7977779` + fix `7ae3bbc` on task/12，merge `b66dbc6` PR #10。Express server + Open Design DESIGN.md 设计系统面板。绿灯门 57/57 + tsc 0。
- **人工干预（Open Design 澄清，关键）：** SPEC/CLAUDE.md 把 "Open Design" 列为 WebUI 设计系统但未给包名/URL。controller 向用户澄清，用户给出 `github.com/nexu-io/open-design`。经查（curl README）确认 Open Design 不是 CSS/npm 包，而是 agent-native 工作流工具，其"设计系统"形态是 **`DESIGN.md` 契约**（纯文本 Markdown，9-section schema：colors/typography/spacing/components/motion/voice/brand/anti-patterns）。落地决策：项目根建 `DESIGN.md` + 面板内联 CSS 用 CSS 变量映射 DESIGN.md 令牌，**不引外部 CDN**（系统字体栈，符合"不依赖网络"）。
- **人工干预（看效果）：** 用户要求看 WebUI 效果。controller 生成 demo trace（read_file 失败+反馈→shell 成功→done）到 `~/.agent-harness/traces/`，后台启动 `node dist/index.js web`，用户浏览器访问 localhost:3000 查看，确认后停掉 server 再推送。
- **教训：** spec 术语含糊时必须向用户澄清而非臆测——Open Design 若按"引 CSS 库"臆测会违反"不依赖网络"且偏离课程要求。
- **Minor#1 已 controller 人工修复：** DESIGN.md `--badge-font-size` 由 `var(--font-caption)`（字体族 shorthand，非字号值）改为 `12px`，契约与 CSS 实现一致。
- **Minor#2（留 final triage）：** DESIGN.md/index.html 末尾缺 trailing newline。

### Task 13：Dockerfile（2026-07-12）

- **事件：** 主 agent 实现 `f591c58` + fix `1db3ac2` on task/13，merge `21dfc5c` PR #11。多阶段 Dockerfile（node:20-alpine：builder npm ci+build / 运行 npm ci --production+拷 dist，EXPOSE 3000，ENTRYPOINT node dist/index.js）+ .dockerignore（.env 不进镜像=安全，node_modules/.git/.superpowers 不进 context=提效）。
- **人工干预（Critical C1 修复）：** 评审发现 builder 阶段缺 `COPY tsconfig.json`——tsup `dts: true` 会调 `loadTsConfig`，缺它在容器内 `npm run build` 抛 `Unable to find tsconfig.json`。reviewer 查 tsup 源码佐证。controller 补 `COPY tsup.config.ts tsconfig.json ./`。复审 Approved。
- **教训：** 本地 build 成功不代表 Docker build 成功——本地有 tsconfig.json 而 builder 阶段没拷。评审查源码佐证的 Critical 比"感觉有问题"更可信。
- **Minor（留 final triage）：** `npm ci --production` deprecated（建议 --omit=dev，但 PLAN 逐字要求 --production，保留）；.dockerignore 未排除 tests/。
- **构建验证：** 本地无 docker，留待 Task 14 CI docker-build job 验证。

### Task 14：GitHub Actions CI（2026-07-12）

- **事件：** 主 agent 实现 `7b4173e` + fix `f1b3ecf` on task/14，merge `09bea69` PR #12。`.github/workflows/ci.yml`：unit-test job（硬约束名，Node 20，npm ci + npm test）+ docker-build job（docker build，`needs: unit-test`）。触发 push（branches: feat/mvp,master）+ pull_request。YAML 经 js-yaml 验证。
- **人工干预（Minor#1 修复）：** docker-build 加 `needs: unit-test`——测试失败不应继续构建镜像，省 runner。
- **CI 首次实际运行 pass（§9.6 闭环）：** `09bea69` push 触发 CI，run 结论 success。这验证了：Dockerfile 在 CI ubuntu docker 上 build 成功（闭环 Task 13 "本地无 docker"）；npm test 在 Linux runner 上全过（web.test.ts fetch、harness.test.ts shell 在 Linux 正常，无 Windows cmd 噪音）。

### Task 15：AGENT_LOG.md 初始化（2026-07-12）

- **事件：** 主 agent 编写本文件（`docs: 初始化 AGENT_LOG.md`）。
- **约束：** REFLECTION.md（1500–2500 字）由学生本人手写，不由 agent 生成，单独提交。

---

## 三、关键人工干预汇总

| 时间 | Task | 干预 | 原因 |
|------|------|------|------|
| 07-10 | SPEC | 冷启动验证 + 修订 | 暴露 spec 隐含假设 |
| 07-10 | SPEC/PLAN | 第二轮审核重写为要点式 | 消除冗长叙述 |
| 07-11 | Task 5 | 补 dd/>/dev/sda/fdisk regex 测试 | 评审 Important 分级驱动补测 |
| 07-11 | Task 9 | 立"push 后暂停等用户手动 merge"约定 | classifier 间歇不可用拦 gh auto merge |
| 07-11 | Task 10 | 确认 brief `tracerDir` 为笔误 | config.ts 真实字段是 `tracesDir`，implementer 按真实签名用 |
| 07-12 | Task 12 | 澄清 Open Design = DESIGN.md 契约 | SPEC 未给包名/URL，须向用户确认而非臆测 |
| 07-12 | Task 12 | 启动 server 供用户看效果 | 用户要求可视化验证 WebUI |
| 07-12 | Task 13 | 补 COPY tsconfig.json | 评审 Critical C1，tsup dts 依赖 |
| 07-12 | Task 14 | docker-build 加 needs: unit-test | Minor#1，测试失败不应构建镜像 |

---

## 四、学到的教训

1. **classifier 间歇不可用是环境波动**——glm-5.2 安全分类服务间歇下线时，有副作用的 Bash（push/gh pr）与 spawn subagent 都被拦，只读操作不受影响。换目标模型无效（classifier 拦的是动作判定本身）。应对：推送后暂停等用户手动 merge；或用户用 `!` 前缀跑命令。

2. **TDD + 两阶段评审有效捕获缺陷**——Task 5 的 regex 覆盖不足（Important）、Task 13 的 tsconfig.json 拷贝缺失（Critical）都被评审挡下并修复，未流入下游 task。

3. **brief 笔误风险**——controller 写 brief 时字段名/签名须核对真实源码（Task 10 `tracerDir`→`tracesDir`）。implementer 不应顺手"修正"spec 而应反馈，由 controller 确认。

4. **冷启动验证的价值**——只有没看过实现的 agent 才能暴露 spec 的隐含假设；修订后的 SPEC/PLAN 在 15 个 task 实现中几乎没有因 spec 歧义返工。

5. **spec 术语含糊必须澄清**——Open Design 若按"引 CSS 库"臆测会违反"不依赖网络"且偏离课程要求；向用户澄清后确认为 DESIGN.md 契约，内联 CSS 实现反而更符合约束。

6. **本地成功 ≠ 容器成功**——本地 build 有 tsconfig.json，Docker builder 阶段没拷则失败。Dockerfile 必须显式 COPY 构建所需全部文件。

7. **机制即代码的可验证性**——所有核心机制（护栏、反馈闭环、凭据加密）有 mock-LLM 确定性单元测试，移除真实 LLM 后仍能验证（机制演示①②③）。这是与"提示词工程"的根本区别。

8. **Minor 不阻塞但需 triage**——累积的 Minor（Task 8 死 import、Task 7 getTrace 浅拷贝、Task 6 脏数据守卫等）记入 ledger，留 final whole-branch review 集中 triage，避免 roll-up 无人读导致静默丢弃。

---

## 五、下一步

- 全部 15 个 task 完成后：运行 PLAN §"全部完成后验证"（npm test 全绿、机制演示、build、CLI --help、WebUI、docker build、CI pass）。
- final whole-branch review（superpowers:requesting-code-review，最强模型，triage 累积 Minor）。
- finishing-a-development-branch（feat/mvp → master PR/merge）。
- REFLECTION.md 由学生本人手写。
