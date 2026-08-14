# REFLECTION.md — Coding Agent Harness 开发反思

## 一、对 Agent = LLM × Harness 的理解

开工前我把 agent 等同于"聪明 prompt + 工具调用"，做完才体会：harness 才是 agent 可控、可验证的根。LLM 的不确定性是给定的，能注入确定性的只有 harness——护栏拦危险动作、反馈回灌客观结果。换掉真实 LLM 用 mock，系统仍能确定性复现，说明"agent 性"落在 harness 而非 LLM。

## 二、反馈闭环设计

选择**反馈闭环**为深入维度。主循环按 SPEC 九点数据流实现：`call_tool` 返回 `{success:false}` 时，harness 把失败信息拼成 feedback 推回 context，下一轮 LLM 据此改动作。机制是代码不是提示词，有 mock-LLM 确定性测试兜底。其余维度做可运行最低实现，避免为只用一次的代码搞抽象。

## 三、过程方法的价值

严格走 Superpowers 七步。评审挡下两个真问题：Task 5 guardrail regex 覆盖不足、Task 13 Dockerfile 漏拷 `tsconfig.json`（tsup 容器内抛错，本地能跑是因本地有该文件）。**本地成功 ≠ 容器成功**，无评审+CI 兜底交了才发现。冷启动验证也有效：没看过实现的 agent 凭 SPEC+PLAN 实现 Task 1-2，暴露了隐含假设，修订后 15 个 task 几乎无 spec 歧义返工。

## 四、困难与解决

一是 classifier 间歇不可用：Task 9 起安全分类下线，push 被拦，应对是"等用户手动 merge"。**spec 术语含糊必须澄清而非臆测**。

## 五、不足

Task 1/2 在确立"push 后等手动 merge"约定前是本地直接 merge，无 GitHub PR 证据。历史 ladder 偏碎但这是 §9.9 + §4.7 双重要求产物，不能 squash。反思报告本人改写为真实想法再提交，否则不是"反思"而是生成作文。

## 六、收获

最大收获是 `Agent = LLM × Harness` 从概念落到工程：每项不大但缺一不可，必须用代码而非提示词才能验证。其次是"机制即代码"的可验证价值——所有核心机制有 mock-LLM 确定性测试，机制演示①②③在 mock 下确定。最后是过程纪律的复利——TDD 先红再绿、两阶段评审，每步慢一点却减少返工。`npm test` 全绿、CI 最后一次 pass，这些绿灯门是让我能说"做完了"的依据。