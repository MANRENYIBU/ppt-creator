# AI PPT Creator

智能演示文稿生成器 - 输入主题，AI 帮你生成专业 PPT。

## 功能特性

- **智能生成**：输入主题、选择语言，AI 自动生成 PPT
- **双模式支持**：
  - **DSL 模式**（默认）：AI 生成结构化内容，渲染为 PPT
  - **图片模式**：AI 直接生成幻灯片图片，每张图片全屏展示
- **联网搜索**：实时搜索相关资料，确保内容准确专业
- **多语言支持**：支持中文和英文生成
- **主题选择**：8 种配色主题可选
- **即时导出**：一键下载 PPTX 文件
- **历史记录**：本地保存生成历史，随时查看下载

## 技术栈

- **框架**: Next.js 16.1.2 (App Router) + React 19.2.3
- **UI**: Tailwind CSS 4 + shadcn/ui
- **状态管理**: Zustand 5.x
- **AI**: OpenAI SDK（支持 OpenAI 兼容 API）
- **图片生成**: Gemini API（用于图片模式）
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
AI_PROVIDER=openai
BASE_URL=https://api.deepseek.com    # 可选，用于 OpenAI 兼容 API
API_KEY=your_api_key
MODEL=deepseek-reasoner

# ===== 图片生成配置（图片模式使用）=====
IMAGE_BASE_URL=                      # 可选，默认使用 BASE_URL
IMAGE_API_KEY=                       # 可选，默认使用 API_KEY
IMAGE_MODEL=gemini-2.0-flash-exp-image-generation

# ===== 联网搜索配置（二选一）=====
TAVILY_API_KEY=your_tavily_key       # Tavily（推荐）
SERP_API_KEY=your_serp_key           # SerpAPI
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 部署

### Docker 部署（推荐）

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker logs -f ppt-creator-ppt-creator-1

# 停止服务
docker compose down
```

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 构建并启动
npm run build
npm run pm2:start

# 常用命令
npm run pm2:logs     # 查看日志
npm run pm2:status   # 查看状态
npm run pm2:restart  # 重启服务
npm run pm2:stop     # 停止服务
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
│   │   └── api/session/        # 会话 API
│   ├── components/             # React 组件
│   ├── lib/                    # 核心逻辑
│   │   ├── ai.ts               # AI 客户端（AIClient, ImagesClient）
│   │   ├── session.ts          # 会话管理
│   │   ├── search.ts           # 搜索客户端
│   │   ├── generator.ts        # 大纲生成
│   │   ├── dsl-generator.ts    # DSL 模式 - 内容生成
│   │   ├── dsl-parser.ts       # DSL 模式 - 解析验证
│   │   ├── dsl-renderer.ts     # DSL 模式 - PPTX 渲染
│   │   ├── image-generator.ts  # 图片模式 - 图片生成
│   │   └── image-renderer.ts   # 图片模式 - PPTX 渲染
│   ├── store/                  # Zustand 状态管理
│   └── types/                  # TypeScript 类型定义
├── docs/                       # 文档
├── .sessions/                  # 会话存储（gitignored）
├── logs/                       # 日志文件（gitignored）
└── docker-compose.yml          # Docker 配置
```

## 可用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 运行生产版本
npm run lint         # 代码检查
npm run pm2:start    # PM2 启动
npm run pm2:stop     # PM2 停止
npm run pm2:logs     # PM2 日志
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
