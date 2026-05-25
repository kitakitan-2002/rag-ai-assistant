# 企业知识库 RAG 助手

Enterprise Knowledge Base RAG Assistant — 基于 RAG（Retrieval-Augmented Generation）的企业知识库问答系统。已实现文档上传、文本切分、Embedding 向量化、pgvector 检索与 DeepSeek 自然语言问答，支持来源引用。

## 当前进度

| 步骤 | 内容 | 状态 |
|------|------|------|
| Step 1 | 项目脚手架（Next.js + TypeScript + Tailwind） | ✅ 已完成 |
| Step 2 | Supabase 初始化（pgvector + 数据库建表） | ✅ 已完成 |
| Step 3 | 首页 + 布局（项目介绍 + 功能入口卡片） | ✅ 已完成 |
| Step 4 | 文档上传 API + 文本切分 + Embedding 入库 | ✅ 已完成 |
| Step 5 | 知识库管理页面 | ✅ 已完成 |
| Step 6 | 问答 API（POST /api/chat） | ✅ 已完成 |
| Step 7 | 问答页面 | ✅ 已完成 |
| Step 8 | 错误处理 + 边界状态 | ✅ 已完成 |
| Step 9 | 部署 | ✅ 已完成 |

## 在线预览

- Vercel: https://rag-ai-assistant-bay.vercel.app

## 已实现功能

- 首页与导航（项目介绍 + 功能入口卡片）
- `/knowledge-base` 知识库管理页面
- 文件上传组件（拖拽 + 点击上传）
- 文档列表展示
- 文档状态展示 `processing` / `ready` / `failed`
- `GET /api/documents` 文档列表接口
- `POST /api/documents` 文档上传 API
- TXT / Markdown 文件校验
- 5MB 文件大小限制
- 文本解析（txt-parser / md-parser）
- 文本切分（RecursiveCharacterTextSplitter）
- SiliconFlow `BAAI/bge-m3` Embedding
- 写入 `documents` / `document_chunks`
- `POST /api/chat` RAG 问答接口
- Supabase RPC `match_document_chunks` 相似度检索
- DeepSeek 回答生成
- `/chat` 问答页面
- 来源引用展示
- 错误提示和空状态处理

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端框架 | Next.js 16 App Router |
| 开发语言 | TypeScript |
| UI | Tailwind CSS 4 |
| 数据库 | Supabase PostgreSQL |
| 向量检索 | Supabase pgvector |
| Embedding | SiliconFlow `BAAI/bge-m3` |
| Chat 生成 | DeepSeek Chat API |
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
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 |
| `DEEPSEEK_CHAT_MODEL` | DeepSeek Chat 模型 |
| `DEEPSEEK_PRO_MODEL` | DeepSeek 高质量模型 |
| `RETRIEVAL_TOP_K` | RAG 检索返回片段数量，默认 5 |
| `SIMILARITY_THRESHOLD` | 相似度召回阈值，当前 MVP 建议 0.3 |

## 数据库

通过 Supabase SQL Editor 执行：

```text
supabase/migrations/001_init.sql
supabase/migrations/002_match_document_chunks.sql
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

RAG 问答：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"员工出差报销需要几天内提交材料？\"}"
```

成功响应示例：

```json
{
  "answer": "员工出差报销需要在 7 个工作日内提交发票和审批单。",
  "sources": [
    {
      "document_id": "doc-id",
      "filename": "expense-policy.md",
      "chunk_index": 0,
      "content_preview": "员工出差报销需要在 7 个工作日内...",
      "similarity": 0.92
    }
  ]
}
```

## 后续计划

| 方向 | 内容 |
|------|------|
| 后续优化 | PDF 支持、Streaming、多轮对话、Rerank、BM25、登录权限 |
| 国内访问优化 | 可后续评估 Zeabur、腾讯云 EdgeOne Pages 或云服务器部署 |
