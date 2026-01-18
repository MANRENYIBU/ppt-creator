# AI PPT Creator 部署文档

本文档详细介绍如何部署 AI PPT Creator 应用到各种环境。

## 目录

- [系统要求](#系统要求)
- [环境变量配置](#环境变量配置)
- [本地开发](#本地开发)
- [生产构建](#生产构建)
- [Docker 部署](#docker-部署)
- [云平台部署](#云平台部署)
  - [Vercel 部署](#vercel-部署)
  - [Railway 部署](#railway-部署)
  - [自建服务器部署](#自建服务器部署)
- [反向代理配置](#反向代理配置)
- [常见问题](#常见问题)

---

## 系统要求

### 运行环境

| 依赖 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.17.0 | 20.x LTS |
| npm | 9.x | 10.x |
| 内存 | 512MB | 1GB+ |
| 磁盘空间 | 500MB | 1GB+ |

### 外部服务依赖

| 服务 | 必需 | 说明 |
|------|------|------|
| AI API | ✅ 是 | OpenAI / Anthropic / 兼容 API |
| Web 搜索 API | ⚠️ 推荐 | Tavily 或 SerpAPI（用于资料收集） |

---

## 环境变量配置

### 创建配置文件

```bash
# 复制示例配置文件
cp .env.example .env.local
```

### 必需配置

```env
# ===== AI 服务配置 =====

# AI 提供商：openai 或 anthropic
AI_PROVIDER=openai

# API 密钥
API_KEY=sk-your-api-key-here

# 模型名称（可选，有默认值）
# OpenAI 默认: gpt-4o
# Anthropic 默认: claude-sonnet-4-20250514
MODEL=gpt-4o
```

### 可选配置

```env
# 自定义 API 地址（用于 OpenAI 兼容 API，如 Azure、本地部署等）
BASE_URL=https://your-api-endpoint.com/v1

# ===== 联网搜索配置（二选一） =====

# Tavily Search API（推荐）
# 获取地址: https://tavily.com/
TAVILY_API_KEY=tvly-your-key-here

# SerpAPI（备选）
# 获取地址: https://serpapi.com/
SERP_API_KEY=your-serp-api-key
```

### 配置优先级

1. **AI 提供商**: 根据 `AI_PROVIDER` 选择 OpenAI 或 Anthropic SDK
2. **搜索服务**: Tavily > SerpAPI（优先使用 Tavily，未配置则尝试 SerpAPI）
3. **无搜索 API**: 仍可使用，但会跳过资料收集阶段

---

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local 填入你的 API 密钥
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 开发模式特点

- 热重载（代码修改自动刷新）
- 详细错误信息
- Source Maps 支持

---

## 生产构建

### 1. 构建应用

```bash
npm run build
```

构建输出位于 `.next/` 目录。

### 2. 启动生产服务器

```bash
npm run start
```

默认端口 3000，可通过 `-p` 参数修改：

```bash
npm run start -- -p 8080
```

### 生产模式特点

- 代码压缩和优化
- 静态页面预渲染
- 更快的首屏加载

---

## Docker 部署

### Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 创建会话存储目录
RUN mkdir -p .sessions && chown -R nextjs:nodejs .sessions

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### next.config.ts 配置

确保 `next.config.ts` 包含 standalone 输出配置：

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

### 构建和运行

```bash
# 构建镜像
docker build -t ai-ppt-creator .

# 运行容器
docker run -d \
  --name ppt-creator \
  -p 3000:3000 \
  -e AI_PROVIDER=openai \
  -e API_KEY=sk-your-key \
  -e TAVILY_API_KEY=tvly-your-key \
  -v ppt-sessions:/app/.sessions \
  ai-ppt-creator
```

### Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  ppt-creator:
    build: .
    ports:
      - "3000:3000"
    environment:
      - AI_PROVIDER=${AI_PROVIDER:-openai}
      - API_KEY=${API_KEY}
      - BASE_URL=${BASE_URL:-}
      - MODEL=${MODEL:-}
      - TAVILY_API_KEY=${TAVILY_API_KEY:-}
      - SERP_API_KEY=${SERP_API_KEY:-}
    volumes:
      - sessions:/app/.sessions
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  sessions:
```

运行：

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

---

## 云平台部署

### Vercel 部署

Vercel 是 Next.js 的官方托管平台，推荐使用。

#### 方法一：通过 GitHub 自动部署

1. 将代码推送到 GitHub 仓库
2. 访问 [vercel.com](https://vercel.com) 并登录
3. 点击 "New Project" → 导入 GitHub 仓库
4. 配置环境变量（在 Settings → Environment Variables）：
   - `AI_PROVIDER`
   - `API_KEY`
   - `TAVILY_API_KEY`（可选）
5. 点击 Deploy

#### 方法二：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产部署
vercel --prod
```

#### 环境变量配置

在 Vercel Dashboard 中设置：

```
AI_PROVIDER=openai
API_KEY=sk-xxx
MODEL=gpt-4o
TAVILY_API_KEY=tvly-xxx
```

#### 注意事项

- Vercel 的 Serverless Functions 有 10 秒超时限制（免费版）
- Pro 版本可延长至 60 秒
- PPT 生成可能需要较长时间，建议使用 Pro 版本或自建服务器

---

### Railway 部署

Railway 支持长时间运行的请求，适合本项目。

#### 部署步骤

1. 访问 [railway.app](https://railway.app) 并登录
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择你的仓库
4. 在 Variables 中添加环境变量
5. Railway 会自动检测 Next.js 并部署

#### 配置

在 `railway.json` 中（可选）：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100
  }
}
```

---

### 自建服务器部署

#### 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 构建应用
npm run build

# 使用 PM2 启动
pm2 start npm --name "ppt-creator" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs ppt-creator

# 设置开机自启
pm2 startup
pm2 save
```

#### PM2 配置文件

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'ppt-creator',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/ppt-creator',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

启动：

```bash
pm2 start ecosystem.config.js
```

---

## 反向代理配置

### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 增加超时时间（PPT 生成需要较长时间）
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # 静态资源缓存
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, immutable";
    }
}
```

### Caddy 配置

```caddyfile
your-domain.com {
    reverse_proxy localhost:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## 数据存储说明

### 会话存储

- **位置**: `.sessions/` 目录
- **格式**: JSON 文件（以 UUID 命名）
- **自动清理**: 24 小时后自动删除
- **Docker 部署**: 建议挂载 volume 持久化

### 生成的 PPTX

- PPTX 文件以 base64 Data URL 返回
- 不在服务器端存储文件
- 用户下载后即可删除会话

---

## 常见问题

### 1. 构建失败：内存不足

```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### 2. API 超时

PPT 生成需要多次 AI 调用，可能需要 30-60 秒。确保：

- 服务器/平台支持长时间请求
- Nginx 等反向代理配置了足够的超时时间
- 使用 Vercel Pro 或其他支持长请求的平台

### 3. 搜索功能不工作

检查搜索 API 配置：

```bash
# 确认环境变量已设置
echo $TAVILY_API_KEY
echo $SERP_API_KEY
```

如果两个都未配置，应用仍可运行，但会跳过资料收集阶段。

### 4. Docker 容器无法写入会话

确保会话目录有正确权限：

```bash
# 在 Dockerfile 中已处理
# 如果使用 volume，确保权限正确
docker run -v $(pwd)/.sessions:/app/.sessions:rw ...
```

### 5. 中文字体显示问题

PPTX 使用 "Microsoft YaHei" 字体。如果目标机器没有此字体：

- Windows: 默认已安装
- macOS/Linux: 会回退到系统字体
- 可在 `dsl-renderer.ts` 中修改 `FONTS` 配置

### 6. 代码高亮不生效

确保 shiki 包已正确安装：

```bash
npm install shiki
```

### 7. 环境变量未生效

- 开发环境使用 `.env.local`
- 生产环境需要在部署平台配置
- Docker 使用 `-e` 参数或 `docker-compose.yml` 中的 `environment`

---

## 健康检查

### API 端点

应用没有专门的健康检查端点，可以检查首页：

```bash
curl -I http://localhost:3000
```

### Docker 健康检查

```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000"]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## 性能优化建议

1. **使用 CDN**: 静态资源可以通过 CDN 加速
2. **启用 Gzip**: Nginx 开启 gzip 压缩
3. **Redis 缓存**: 可选添加 Redis 缓存 AI 响应
4. **负载均衡**: 高并发场景使用多实例 + 负载均衡

---

## 更新和维护

### 更新应用

```bash
# 拉取最新代码
git pull

# 安装依赖
npm install

# 重新构建
npm run build

# 重启服务
pm2 restart ppt-creator
# 或
docker-compose up -d --build
```

### 日志管理

```bash
# PM2 日志
pm2 logs ppt-creator --lines 100

# Docker 日志
docker logs -f ppt-creator --tail 100
```

---

## 技术支持

如有问题，请：

1. 查看本文档的常见问题部分
2. 检查应用日志获取详细错误信息
3. 在 GitHub Issues 中提交问题
