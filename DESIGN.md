---
name: "Coding Agent Harness · 调试面板设计令牌"
description: "Agent 决策轨迹 WebUI 调试面板的设计系统契约。参考 Open Design 的 DESIGN.md 9-section schema（github.com/nexu-io/open-design），本文件为面板的设计令牌契约。"
---

# 设计令牌 — Coding Agent Harness 调试面板

<!-- 参考 Open Design 的 DESIGN.md 9-section schema（github.com/nexu-io/open-design），本文件为面板的设计令牌契约。 -->

## colors

浅色面板：白底 + 中性灰边框 + 蓝色强调。所有值均为 hex。

| 令牌 | 值 | 说明 |
|------|-----|------|
| `--color-primary` | `#2563eb` | 主强调色（链接、高亮边框） |
| `--color-primary-muted` | `#dbeafe` | 主色浅底（hover 背景、badge 背景） |
| `--color-surface` | `#ffffff` | 页面 / 卡片主背景 |
| `--color-surface-secondary` | `#f8fafc` | 次级背景（行 hover、斑马纹） |
| `--color-border` | `#e2e8f0` | 边框 / 分隔线 |
| `--color-border-hover` | `#cbd5e1` | 边框 hover 加深 |
| `--color-ink` | `#0f172a` | 主文字色 |
| `--color-ink-muted` | `#64748b` | 次要 / 辅助文字色 |
| `--color-success` | `#16a34a` | 成功 / 通过 |
| `--color-danger` | `#dc2626` | 危险 / 失败 |

## typography

系统字体栈，不引外部 CDN。

| 令牌 | fontFamily | fontSize | fontWeight | lineHeight |
|------|-----------|----------|------------|------------|
| `--font-display` | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | `24px` | `700` | `1.3` |
| `--font-title` | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | `18px` | `600` | `1.4` |
| `--font-body` | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | `14px` | `400` | `1.6` |
| `--font-caption` | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | `12px` | `400` | `1.5` |
| `--font-mono` | `"SF Mono", "Cascadia Code", "Fira Code", Menlo, monospace` | `13px` | `400` | `1.5` |

## spacing

| 令牌 | 值 |
|------|-----|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |

## components

| 组件 | 令牌 | 值 |
|------|------|-----|
| card | `--card-radius` | `8px` |
| card | `--card-padding` | `var(--space-4)` |
| card | `--card-border` | `1px solid var(--color-border)` |
| card | `--card-shadow` | `0 1px 3px rgba(0,0,0,0.08)` |
| badge | `--badge-radius` | `4px` |
| badge | `--badge-padding` | `2px 8px` |
| badge | `--badge-font-size` | `12px` |
| step-row | `--step-row-radius` | `4px` |
| step-row | `--step-row-padding` | `var(--space-2) var(--space-3)` |
| step-row | `--step-row-bg` | `var(--color-surface-secondary)` |
| step-row | `--step-row-border` | `1px solid var(--color-border)` |