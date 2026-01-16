# AI PPT Creator

智能演示文稿生成器 - 输入主题，AI帮你生成专业PPT。

## 功能特性

- **智能生成**：输入主题、选择语言和演讲时长，AI自动生成PPT
- **联网搜索**：实时搜索相关资料，确保内容准确专业
- **多语言支持**：支持中文和英文生成
- **即时导出**：一键下载PPTX文件
- **历史记录**：本地保存生成历史，随时查看下载

## 技术栈

- **框架**: Next.js 16 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **状态管理**: Zustand
- **PPT生成**: PptxGenJS
- **语言**: TypeScript

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制环境变量模板并填入你的API密钥：

```bash
cp .env.example .env.local
```

需要配置的环境变量：

```env
# AI服务 (二选一)
OPENAI_API_KEY=your_openai_api_key
# 或
ANTHROPIC_API_KEY=your_anthropic_api_key

# 联网搜索 (二选一)
TAVILY_API_KEY=your_tavily_api_key
# 或
SERP_API_KEY=your_serp_api_key
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首页 - 输入表单
│   ├── generate/          # 生成页 - 进度显示
│   ├── result/            # 结果页 - 预览下载
│   ├── history/           # 历史页 - 记录列表
│   └── api/generate/      # API路由
├── components/            # React组件
│   ├── header.tsx        # 顶部导航
│   └── ui/               # shadcn/ui组件
├── store/                 # Zustand状态管理
├── types/                 # TypeScript类型定义
└── lib/                   # 工具函数
```

## 可用脚本

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run start    # 运行生产版本
npm run lint     # 代码检查
```

## 文档

- [产品需求文档](./docs/PRD.md)
- [UI设计规范](./docs/ui/design-system.md)

## License

MIT
