# 企业知识库 RAG 助手

基于 RAG（Retrieval-Augmented Generation）的企业知识库问答系统。上传文档 → 向量化存储 → 自然语言提问 → 带来源引用的 AI 回答。

## 当前进度

| 步骤 | 内容 | 状态 |
|------|------|------|
| Step 1 | 项目脚手架（Next.js + TypeScript + Tailwind） | ✅ 已完成 |
| Step 2 | Supabase 初始化（pgvector + 数据库建表） | ✅ 已完成 |
| Step 3 | 首页 + 布局（项目介绍 + 功能入口卡片） | ✅ 已完成 |
| Step 4 | 文档上传 API（POST /api/documents） | 🚧 进行中 |
| Step 5 | 知识库管理页面 | ⬜ 待开始 |
| Step 6 | 问答 API（POST /api/chat） | ⬜ 待开始 |
| Step 7 | 问答页面 | ⬜ 待开始 |
| Step 8 | 错误处理 + 边界状态 | ⬜ 待开始 |
| Step 9 | 部署 | ⬜ 待开始 |

## 技术栈

| 组件 | 选型 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4 |
| 数据库 | Supabase (pgvector) |
| Embedding | SiliconFlow `BAAI/bge-m3`（1024 维） |
| Chat 生成 | DeepSeek Chat API |
| 部署 | Vercel |

## 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:3000`。

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```bash
# SiliconFlow — Embedding
SILICONFLOW_API_KEY=sk-xxxxxxxx
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-m3

# DeepSeek — Chat 生成
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_CHAT_MODEL=deepseek-v4-flash

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxx
```

## 数据库

通过 Supabase SQL Editor 执行 `supabase/migrations/001_init.sql` 建表：

- `documents` — 文档元信息
- `document_chunks` — 文档分段 + pgvector embedding

## MVP 范围

- 上传 TXT / Markdown 文件
- 自动文本切分 + 向量化入库
- 单轮问答 + 来源引用展示
- 文档列表查看与删除

## 后续计划

| 版本 | 内容 |
|------|------|
| V1.1 | PDF 支持、流式回答 |
| V1.2 | 多轮对话、对话历史 |
| V2.0 | 多知识库、混合检索 |
