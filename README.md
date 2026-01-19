# AI PPT Creator

智能演示文稿生成器 - 输入主题，AI 帮你生成专业 PPT。

## 功能特性

- **智能生成**：输入主题、选择语言，AI 自动生成 PPT
- **联网搜索**：实时搜索相关资料，确保内容准确专业
- **多语言支持**：支持中文和英文生成
- **主题选择**：8 种配色主题可选
- **即时导出**：一键下载 PPTX 文件
- **历史记录**：本地保存生成历史，随时查看下载

## 技术栈

- **框架**: Next.js 16.1.2 (App Router) + React 19.2.3
- **UI**: Tailwind CSS 4 + shadcn/ui
- **状态管理**: Zustand 5.x
- **AI**: OpenAI SDK / Anthropic SDK（支持 OpenAI 兼容 API）
- **联网搜索**: Tavily API / SerpAPI
- **PPT 生成**: PptxGenJS 4.x
- **语言**: TypeScript

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 填入配置：

```env
# ===== AI 服务配置 =====
# 模型提供商: openai 或 anthropic
AI_PROVIDER=openai
# 请求地址（可选，用于 OpenAI 兼容 API）
BASE_URL=https://api.deepseek.com
# API 密钥
API_KEY=your_api_key
# 模型名称
MODEL=deepseek-reasoner

# ===== 联网搜索配置（二选一）=====
# Tavily Search API（推荐）- https://tavily.com/
TAVILY_API_KEY=your_tavily_key
# SerpAPI - https://serpapi.com/
SERP_API_KEY=your_serp_key
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 部署

### Docker 部署（推荐）

1. 创建 `.env` 文件并填入配置

2. 构建并启动：

```bash
docker compose up -d --build
```

3. 查看日志：

```bash
# 实时日志
docker exec -it ppt-creator-ppt-creator-1 tail -f /app/logs/combined.log

# 或使用 Docker 日志
docker logs -f ppt-creator-ppt-creator-1
```

4. 停止服务：

```bash
docker compose down
```

### PM2 部署

1. 安装 PM2：

```bash
npm install -g pm2
```

2. 构建并启动：

```bash
npm run build
npm run pm2:start
```

3. 常用命令：

```bash
npm run pm2:logs     # 查看日志
npm run pm2:status   # 查看状态
npm run pm2:restart  # 重启服务
npm run pm2:stop     # 停止服务
```

4. 开机自启（可选）：

```bash
pm2 startup
pm2 save
```

5. 日志轮转（可选）：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 手动部署

```bash
npm run build
npm run start
```

## 项目结构

```
ppt-creator/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页 - 输入表单
│   │   ├── generate/           # 生成页 - 进度显示
│   │   ├── result/             # 结果页 - 主题选择与下载
│   │   ├── history/            # 历史页 - 记录列表
│   │   └── api/                # API 路由
│   │       └── session/        # 会话相关 API
│   ├── components/             # React 组件
│   │   ├── header.tsx          # 顶部导航
│   │   └── ui/                 # shadcn/ui 组件
│   ├── lib/                    # 核心逻辑
│   │   ├── ai.ts               # AI 客户端
│   │   ├── session.ts          # 会话管理
│   │   ├── search.ts           # 搜索客户端
│   │   ├── scraper.ts          # 网页抓取
│   │   ├── generator.ts        # 大纲生成
│   │   ├── dsl-generator.ts    # DSL 生成
│   │   ├── dsl-parser.ts       # DSL 解析
│   │   └── dsl-renderer.ts     # PPTX 渲染
│   ├── store/                  # Zustand 状态管理
│   └── types/                  # TypeScript 类型定义
├── docs/                       # 文档
├── public/                     # 静态资源
├── .sessions/                  # 会话存储（gitignored）
├── logs/                       # 日志文件（gitignored）
├── docker-compose.yml          # Docker Compose 配置
├── Dockerfile                  # Docker 构建文件
└── ecosystem.config.js         # PM2 配置
```

## 可用脚本

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 运行生产版本
npm run lint         # 代码检查

# PM2 生产部署
npm run pm2:start    # 启动 PM2 进程
npm run pm2:stop     # 停止 PM2 进程
npm run pm2:restart  # 重启 PM2 进程
npm run pm2:logs     # 查看实时日志
npm run pm2:status   # 查看进程状态
```

## 主题配色

| 主题   | 颜色    | 描述             |
| ------ | ------- | ---------------- |
| blue   | #2563EB | 专业商务（默认） |
| green  | #16A34A | 自然清新         |
| teal   | #0D9488 | 科技现代         |
| purple | #9333EA | 创意优雅         |
| orange | #EA580C | 活力热情         |
| red    | #DC2626 | 大胆醒目         |
| rose   | #E11D48 | 温暖柔和         |
| slate  | #475569 | 简约现代         |

## 文档

- [产品需求文档](./docs/PRD.md)
- [UI 设计规范](./docs/ui/design-system.md)
- [部署指南](./docs/deployment.md)

## License

MIT
