# 企业知识库 RAG 助手 — 架构设计文档（原始完整方案）

## 1. 产品功能大纲

### MVP（第一版）

```
知识库管理
├── 文档上传（PDF / TXT / Markdown）
├── 文档列表（查看、删除）
└── 上传状态反馈（解析中 → 已就绪 → 失败）

智能问答
├── 对话式问答界面
├── 基于知识库的 RAG 回答
└── 来源引用（文件名 + 段落编号）

对话管理
├── 新建对话
├── 对话历史列表
└── 删除对话
```

### 后续迭代（V2+）

| 功能 | 说明 |
|------|------|
| 多知识库 | 按主题/部门隔离知识库 |
| 文档预览 | 在线查看已上传文档内容 |
| 批量上传 | 一次上传多个文件 |
| Word/PPT/HTML 支持 | 扩展文档格式 |
| 表格/图片理解 | OCR + 多模态 |
| 混合检索 | 关键词 BM25 + 向量混合 |
| 重排序 (Rerank) | Cohere Rerank 提升召回精度 |
| 引用高亮 | 回答中点击引用跳转到原文位置 |

---

## 2. 页面结构

```
/                          → 首页（产品介绍 + 入口）
/knowledge-base            → 知识库管理（上传 + 文档列表）
/chat                      → 新建对话（默认跳转到新对话）
/chat/[conversationId]     → 具体对话（问答界面）
```

**页面关系：**

```
首页
├── 知识库管理
│   ├── 上传区域（拖拽上传）
│   └── 文档列表（名称、类型、状态、日期、删除按钮）
└── 智能问答
    └── 左侧：对话历史列表
    └── 右侧：问答区域
        ├── 消息列表（用户问题 + AI 回答 + 来源引用）
        ├── 输入框
        └── 新建对话按钮
```

---

## 3. 数据库表设计

使用 Supabase pgvector，共 4 张表：

### `documents`

```sql
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,                    -- 原始文件名
  file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'txt', 'md')),
  file_size     INTEGER NOT NULL,                 -- 字节数
  file_url      TEXT NOT NULL,                    -- Supabase Storage URL
  status        TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'ready', 'failed')),
  chunk_count   INTEGER DEFAULT 0,                -- 切分后的 chunk 数量
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### `document_chunks`

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,                 -- 片段序号（第几段）
  content       TEXT NOT NULL,                    -- 原始文本
  embedding     VECTOR(1536),                     -- OpenAI text-embedding-3-small
  metadata      JSONB DEFAULT '{}',               -- { page: 3, section: "xx" }
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 向量相似度索引（IVFFlat，百万级够用）
CREATE INDEX ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### `conversations`

```sql
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT DEFAULT '新对话',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### `messages`

```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  sources         JSONB DEFAULT '[]',  -- 来源引用，仅 assistant 消息有值
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

### `sources` JSONB 结构

```json
[
  {
    "document_id": "uuid",
    "filename": "员工手册.pdf",
    "chunk_index": 3,
    "content_preview": "根据公司规定，员工每年享有..."
  }
]
```

---

## 4. API 路由设计

Next.js App Router 方式，全部放在 `/app/api/` 下：

```
/api
├── documents
│   ├── route.ts              POST   → 上传文档
│   ├── route.ts              GET    → 文档列表
│   └── [id]
│       └── route.ts          DELETE → 删除文档（级联删除 chunks + storage file）
│
├── chat
│   └── route.ts              POST   → 发送消息（RAG 核心）
│
└── conversations
    ├── route.ts              GET    → 对话列表
    └── [id]
        └── route.ts          GET    → 对话详情（含消息列表）
        └── route.ts          DELETE → 删除对话
```

### 接口详情

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| `POST` | `/api/documents` | 上传文档 | `FormData { file }` |
| `GET` | `/api/documents` | 文档列表 | — |
| `DELETE` | `/api/documents/[id]` | 删除文档 | — |
| `POST` | `/api/chat` | 发送消息 | `{ conversationId, message }` |
| `GET` | `/api/conversations` | 对话列表 | — |
| `GET` | `/api/conversations/[id]` | 对话消息 | — |
| `DELETE` | `/api/conversations/[id]` | 删除对话 | — |

---

## 5. RAG 核心流程

```
┌─────────────────────────────────────────────────────────┐
│                    文档入库（Ingestion）                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  用户上传 PDF/TXT/MD                                     │
│       │                                                 │
│       ▼                                                 │
│  存入 Supabase Storage  ←──── 返回 file_url              │
│       │                                                 │
│       ▼                                                 │
│  解析文本内容                                            │
│  ├── PDF  → pdf-parse / pdfjs-dist                      │
│  ├── TXT  → 直接读取                                    │
│  └── MD   → 直接读取（后续可保留标题层级）                 │
│       │                                                 │
│       ▼                                                 │
│  文本切分（langchain/text-splitter）                      │
│  ├── chunk_size = 500 字符                              │
│  └── chunk_overlap = 50 字符                            │
│       │                                                 │
│       ▼                                                 │
│  批量向量化（OpenAI text-embedding-3-small, 1536维）      │
│  ├── batch size = 20（控制 API 调用频率）                 │
│  └── 带 retry 的指数退避                                │
│       │                                                 │
│       ▼                                                 │
│  存入 document_chunks 表（embedding + content + metadata）│
│       │                                                 │
│       ▼                                                 │
│  更新 documents.status = 'ready'                         │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    问答查询（Query）                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  用户输入问题                                            │
│       │                                                 │
│       ▼                                                 │
│  向量化问题（同一 embedding 模型）                        │
│       │                                                 │
│       ▼                                                 │
│  pgvector 余弦相似度检索                                  │
│  └── SELECT * FROM document_chunks                      │
│      ORDER BY embedding <=> query_embedding              │
│      LIMIT 5;   ← 返回 top-5 最相关片段                  │
│       │                                                 │
│       ▼                                                 │
│  构建 Prompt                                            │
│  ┌─────────────────────────────────────┐                │
│  │ 你是一个企业知识库助手。              │                │
│  │ 根据以下文档片段回答用户问题。         │                │
│  │ 如果片段中没有相关信息，请如实说明。   │                │
│  │                                     │                │
│  │ 文档片段：                           │                │
│  │ [来源1: 员工手册.pdf, 第3段]          │                │
│  │ 根据公司规定...                      │                │
│  │                                     │                │
│  │ [来源2: 报销制度.md, 第5段]           │                │
│  │ 报销流程如下...                      │                │
│  │                                     │                │
│  │ 用户问题：公司的报销规则是什么？       │                │
│  └─────────────────────────────────────┘                │
│       │                                                 │
│       ▼                                                 │
│  OpenAI Chat Completion（gpt-4o-mini, streaming）        │
│       │                                                 │
│       ▼                                                 │
│  返回回答 + sources                                      │
│       │                                                 │
│       ▼                                                 │
│  存储 messages（user ← message, assistant ← answer）     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 相似度阈值

检索时设置 `similarity_threshold = 0.75`，低于此值的片段不纳入上下文。如果 top-5 都不满足阈值，直接告知用户"知识库中暂无相关内容"。

### 对话上下文

取最近 6 条历史消息拼入 prompt，实现多轮对话。

---

## 6. 文件目录结构

```
enterprise-kb-rag/
├── .env.local                      ← API keys, Supabase URL
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── app/
│   ├── layout.tsx                  ← 根布局（HTML + 全局样式）
│   ├── page.tsx                    ← 首页
│   ├── globals.css
│   │
│   ├── knowledge-base/
│   │   └── page.tsx                ← 知识库管理页
│   │
│   ├── chat/
│   │   ├── page.tsx                ← /chat 重定向到新对话
│   │   └── [conversationId]/
│   │       └── page.tsx            ← 对话详情页
│   │
│   └── api/
│       ├── documents/
│       │   ├── route.ts            ← POST (上传) + GET (列表)
│       │   └── [id]/
│       │       └── route.ts        ← DELETE
│       │
│       ├── chat/
│       │   └── route.ts            ← POST (RAG 问答)
│       │
│       └── conversations/
│           ├── route.ts            ← GET (列表)
│           └── [id]/
│               └── route.ts        ← GET (详情) + DELETE
│
├── components/
│   ├── ui/                         ← 通用 UI 组件
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── spinner.tsx
│   │
│   ├── upload/
│   │   ├── file-upload-zone.tsx    ← 拖拽上传区域
│   │   └── document-list.tsx       ← 文档列表
│   │
│   ├── chat/
│   │   ├── chat-container.tsx      ← 问答主容器
│   │   ├── chat-message.tsx        ← 单条消息气泡
│   │   ├── chat-input.tsx          ← 输入框
│   │   ├── source-citation.tsx     ← 来源引用展示
│   │   └── conversation-sidebar.tsx← 对话历史侧边栏
│   │
│   └── layout/
│       └── navbar.tsx              ← 顶部导航
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts              ← 浏览器端 Supabase 客户端
│   │   └── server.ts              ← 服务端 Supabase 客户端（含 pgvector）
│   │
│   ├── rag/
│   │   ├── chunker.ts             ← 文本切分逻辑
│   │   ├── embedder.ts            ← OpenAI Embedding 调用
│   │   ├── retriever.ts           ← pgvector 相似度检索
│   │   ├── prompt-builder.ts      ← System/user prompt 构建
│   │   └── generator.ts           ← OpenAI Chat Completion（流式）
│   │
│   ├── parser/
│   │   ├── pdf-parser.ts          ← PDF 文本提取
│   │   ├── txt-parser.ts          ← TXT 文本提取
│   │   └── md-parser.ts           ← MD 文本提取
│   │
│   ├── ingestion/
│   │   └── pipeline.ts            ← 完整入库流水线编排
│   │
│   └── utils.ts                   ← 通用工具函数
│
├── types/
│   └── index.ts                   ← 共享 TypeScript 类型定义
│
├── public/
│   └── ...                        ← 静态资源
│
└── supabase/
    └── migrations/
        └── 001_init.sql           ← 数据库初始化 DDL
```

---

## 7. 开发步骤

| 步骤 | 内容 | 预计耗时 |
|------|------|----------|
| **1** | 初始化项目：`create-next-app` + Tailwind + TypeScript | 30min |
| **2** | Supabase 项目创建，执行 migration 建表，配置 pgvector | 30min |
| **3** | 搭建基础布局：Navbar + 首页 UI | 1h |
| **4** | 文档上传功能：上传 API + 文件存储（Supabase Storage） | 1.5h |
| **5** | 文档解析 + 文本切分 + Embedding + 入库流水线 | 3h |
| **6** | 知识库管理页面：文档列表 + 删除 | 1.5h |
| **7** | RAG 问答 API：检索 + prompt + streaming 回答 | 3h |
| **8** | 对话界面 UI：消息列表 + 输入框 + 来源引用展示 | 2h |
| **9** | 对话历史管理：侧边栏 + 新建/切换/删除对话 | 1.5h |
| **10** | 错误处理 + loading 状态 + 空状态 + edge cases | 1.5h |
| **11** | 部署 Vercel + 环境变量配置 | 30min |

**总计约 16 小时**，适合一个周末集中开发。

---

## 8. MVP 阶段不应该做的功能

| 不该做 | 理由 |
|--------|------|
| **用户认证/登录** | MVP 验证 RAG 核心价值，单人使用不需要登录。面试时说："第一版聚焦 RAG 管道质量，认证属于基础设施，可以随时加上 Clerk/Auth.js，不会影响架构" |
| **多知识库/多租户** | 增加表结构和查询复杂度，单知识库够用 |
| **Word/PPT/Excel 解析** | 解析复杂度成倍增加（依赖 python/unstructured），PDF + TXT + MD 已覆盖 80% 场景 |
| **文档预览/在线阅读** | 核心价值是问答，不是文档浏览器 |
| **混合检索（BM25 + 向量）** | pgvector 纯向量检索对 MVP 足够，面试时可以说"后续引入 BM25 解决专有名词精确匹配问题" |
| **Rerank 重排序** | 调用 Cohere Rerank 增加外部依赖和成本，top-5 直接返回够用 |
| **流式进度推送（WebSocket）** | 文档处理用 polling 替代，避免引入 WebSocket 基础设施 |
| **图表/图片理解** | 需要多模态模型，MVP 只做纯文本 |
| **用量统计/计费** | 作品集项目不需要 |
| **Docker 部署** | Vercel 一键部署更适合展示 |
| **后台任务队列（BullMQ/Redis）** | 同步处理就够，面试时说"如果文档大到需要异步处理，引入队列即可，处理逻辑不用改" |
| **自动化评测（RAGAS）** | 作品集项目用人工看结果就行 |
