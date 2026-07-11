# ============================================================
# 多阶段构建 — Coding Agent Harness
# ============================================================
#
# builder：装全部依赖（含 devDeps）+ tsup 构建 dist
# 运行阶段：只装生产依赖 + 拷 dist，镜像精简

# --- builder 阶段 ---
FROM node:20-alpine AS builder
WORKDIR /app
# 先拷依赖清单，利用层缓存（依赖不变则 npm ci 层命中）
COPY package.json package-lock.json ./
RUN npm ci
# 再拷源码与构建配置
COPY tsup.config.ts tsconfig.json ./
COPY src ./src
RUN npm run build

# --- 运行阶段 ---
FROM node:20-alpine
WORKDIR /app
# 只装生产依赖（dependencies，不含 devDeps）
COPY package.json package-lock.json ./
RUN npm ci --production
# 拷构建产物（自包含：内联 HTML，无需额外静态资源）
COPY --from=builder /app/dist ./dist
# WebUI 调试面板端口（Task 12）
EXPOSE 3000
# 默认入口：agent-harness <command>，如 docker run <img> web
ENTRYPOINT ["node", "dist/index.js"]
