# 企业知识库 RAG 助手

Enterprise Knowledge Base RAG Assistant — 基于 RAG（Retrieval-Augmented Generation）的企业知识库问答系统。当前版本已实现文档上传、文本切分、Embedding 向量化与 Supabase pgvector 入库。后续将接入自然语言问答与来源引用。

## 当前进度

| 步骤 | 内容 | 状态 |
|------|------|------|
| Step 1 | 项目脚手架（Next.js + TypeScript + Tailwind） | ✅ 已完成 |
| Step 2 | Supabase 初始化（pgvector + 数据库建表） | ✅ 已完成 |
| Step 3 | 首页 + 布局（项目介绍 + 功能入口卡片） | ✅ 已完成 |
| Step 4 | 文档上传 API + 文本切分 + Embedding 入库 | ✅ 已完成 |
| Step 5 | 知识库管理页面 | ⬜ 待开始 |
| Step 6 | 问答 API（POST /api/chat） | ⬜ 待开始 |
| Step 7 | 问答页面 | ⬜ 待开始 |
| Step 8 | 错误处理 + 边界状态 | ⬜ 待开始 |
| Step 9 | 部署 | ⬜ 待开始 |

## 已实现功能

- 首页与导航（项目介绍 + 功能入口卡片）
- `/knowledge-base` 占位页
- `/chat` 占位页
- `POST /api/documents` 文档上传 API
- TXT / Markdown 文件校验
- 5MB 文件大小限制
- 文本解析（txt-parser / md-parser）
- 文本切分（RecursiveCharacterTextSplitter）
- SiliconFlow `BAAI/bge-m3` Embedding
- 写入 `documents` / `document_chunks`
- 文档状态管理：`processing` / `ready` / `failed`

> DeepSeek 问答 API（`POST /api/chat`）尚未实现，将在 Step 6 完成。

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端框架 | Next.js 16 App Router |
| 开发语言 | TypeScript |
| UI | Tailwind CSS 4 |
| 数据库 | Supabase PostgreSQL |
| 向量检索 | Supabase pgvector |
| Embedding | SiliconFlow `BAAI/bge-m3` |
| Chat 生成 | DeepSeek Chat API（后续接入） |
| 部署 | Vercel |

## 本地运行

安装依赖：

```bash
npm install
```

复制环境变量文件：

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

启动开发服务器：

```bash
npm run dev
```

访问：

```text
http://localhost:3000
```

## 环境变量

在 `.env.local` 中配置以下变量。真实 key 不应提交到 GitHub。

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥，仅服务端使用 |
| `SILICONFLOW_API_KEY` | SiliconFlow API Key |
| `SILICONFLOW_BASE_URL` | SiliconFlow API 地址 |
| `EMBEDDING_MODEL` | Embedding 模型名 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key，Step 6 使用 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 |
| `DEEPSEEK_CHAT_MODEL` | DeepSeek Chat 模型 |
| `DEEPSEEK_PRO_MODEL` | DeepSeek 高质量模型 |

## 数据库

通过 Supabase SQL Editor 执行：

```text
supabase/migrations/001_init.sql
```

主要数据表：

| 数据表 | 说明 |
|--------|------|
| `documents` | 文档元信息 |
| `document_chunks` | 文档分段与向量 embedding |

## API 测试

上传 TXT 文件：

```bash
curl -X POST http://localhost:3000/api/documents -F "file=@your-file.txt"
```

成功响应示例：

```json
{
  "id": "document-id",
  "filename": "your-file.txt",
  "file_type": "txt",
  "status": "ready",
  "chunk_count": 1
}
```

## 后续计划

| 步骤 | 内容 |
|------|------|
| Step 5 | 知识库管理页面：上传组件、文档列表、删除 |
| Step 6 | 问答 API：pgvector 检索 + DeepSeek 生成 |
| Step 7 | 问答页面：输入框、回答展示、来源引用 |
| Step 8 | 错误处理与边界状态完善 |
| Step 9 | Vercel 部署 |
