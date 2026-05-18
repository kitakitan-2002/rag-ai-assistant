# 企业知识库 RAG 助手 — MVP 架构设计

## 项目目标

一个轻量级的企业知识库问答系统。用户上传文档，系统将文档内容向量化存入数据库，然后用户可以用自然语言提问，系统从知识库中检索相关内容并生成带来源引用的回答。

**核心价值主张**：不是简单套壳 ChatGPT，而是展示完整的 RAG 工程能力——文档解析、语义分块、向量检索、Prompt 编排、来源追溯。

---

## 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 前端框架 | Next.js (App Router) + TypeScript | — |
| UI | Tailwind CSS + shadcn/ui | — |
| 数据库 | Supabase (pgvector) | — |
| Embedding | OpenAI `text-embedding-3-small` | 1536 维，稳定可靠，中文效果好 |
| Chat 生成 | DeepSeek Chat API | 模型名由环境变量 `DEEPSEEK_CHAT_MODEL` 指定 |
| 部署 | Vercel | — |

### 模型供应商分离策略

Embedding 和 Chat 使用不同的模型供应商，解耦设计：

- **Embedding（OpenAI）**：向量化是 RAG 的基石。OpenAI embedding 服务经过大规模验证，稳定性和业界最好。MVP 阶段不应在 embedding 质量上引入变量。
- **Chat 生成（DeepSeek）**：DeepSeek 中文理解能力强，通常具备较低推理成本。Chat 模型通过环境变量配置，方便替换为其他供应商（如零一万物、通义千问、或切回 OpenAI）。
- **解耦收益**：`lib/rag/embedder.ts` 和 `lib/rag/generator.ts` 各自独立，互不依赖。更换任一供应商只需修改对应文件，另一端不受影响。

---

## MVP 范围

```
第一版只做一件事：上传文档 → 提问 → 得到带引用的回答

├── 文档上传（TXT / Markdown）
├── 文档列表（查看、删除）
├── 自动文本切分 + 向量化
├── 单轮问答（无对话历史）
└── 来源引用展示
```

**一句话总结**：单次问答 + 来源引用。不做多轮对话、不做登录、不做 PDF。

---

## 页面结构

```
/                  → 首页（项目介绍 + 功能入口）
/knowledge-base    → 知识库管理（上传 + 文档列表）
/chat              → 问答页面（单轮问答 + 来源引用）
```

### 页面说明

| 页面 | 路由 | 核心交互 |
|------|------|----------|
| 首页 | `/` | 展示项目名称、一句话说明、两个入口按钮（知识库 / 问答） |
| 知识库管理 | `/knowledge-base` | 拖拽/点击上传 TXT 或 MD 文件，查看已上传文档列表，支持删除 |
| 问答 | `/chat` | 输入框输入问题，展示 AI 回答 + 来源引用，无对话历史 |

### 页面布局

```
首页
├── Hero 区域（项目名称 + 简介）
├── 功能入口卡片（知识库管理 / 智能问答）
└── Footer（技术栈标签）

知识库管理
├── 顶部：上传区域（拖拽组件）
├── 中间：文档列表表格
│   ├── 文件名
│   ├── 类型（TXT / MD）
│   ├── 状态（处理中 / 已就绪 / 失败）
│   ├── 分段数
│   ├── 上传时间
│   └── 操作（删除）
└── 空状态：尚无文档，请上传

问答
├── 顶部：返回首页链接
├── 中间：问答展示区域
│   ├── 问题气泡
│   ├── 回答内容（Markdown 渲染）
│   └── 来源引用卡片
└── 底部：输入框 + 发送按钮
```

---

## 数据库表

MVP 阶段仅 2 张表，均为服务端使用（无前端直连）。

### `documents`

```sql
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('txt', 'md')),
  file_size     INTEGER NOT NULL,
  file_url      TEXT,                            -- MVP 阶段可为空，后续接 Storage
  status        TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'ready', 'failed')),
  chunk_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### `document_chunks`

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  embedding     VECTOR(1536),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 为什么只有两张表

- 不做对话历史存储 → 不需要 `conversations` 和 `messages` 表
- 问答状态由前端维护（`useState`），刷新即清空
- 这是刻意的设计选择，不是偷懒：面试时可以明确说"MVP 聚焦 RAG 管道，对话持久化属于产品体验层，加两张表 + 一套 CRUD API 即可，不影响核心架构"

---

## API 路由

3 个路由，覆盖上传、检索、问答全链路。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/documents` | 上传文档（FormData），触发入库流水线 |
| `GET` | `/api/documents` | 获取文档列表 |
| `DELETE` | `/api/documents/[id]` | 删除文档及关联 chunks（file_url 非空时同时清理 Storage） |
| `POST` | `/api/chat` | 问答接口：接收问题，返回回答 + sources |

### `POST /api/documents`

```
Request:  FormData { file: File }
Response: { id, filename, status: "processing" }

流程:
  1. 接收文件，读取文本内容
  2. 创建 documents 行 (status = 'processing', file_url = NULL)
  3. 调用入库流水线（解析 → 切分 → 向量化 → 写入 chunks）
  4. 更新 documents.status = 'ready'
  5. 任何步骤失败 → status = 'failed'

注意：MVP 阶段不依赖 Supabase Storage，文件内容直接读取后向量化，
原始文件不做持久化存储。file_url 字段预留后续接 Storage 时使用。
步骤 3-4 在同一个请求中同步执行，不做异步任务队列。
超过 30 秒的超大文件用 Vercel 函数超时兜底（后续可改为 edge function 分批）。
```

### `POST /api/chat`

```
Request:  { query: string }
Response: { answer: string, sources: Source[] }

流程:
  1. 将 query 向量化（OpenAI embedding）
  2. pgvector 余弦检索 top-5 chunks
  3. 过滤 similarity < SIMILARITY_THRESHOLD（默认 0.4，可配置）的结果
  4. 构建 system/user prompt
  5. 调用 DeepSeek Chat Completion（模型由 DEEPSEEK_CHAT_MODEL 环境变量指定，非流式）
  6. 返回 { answer, sources }

注意：MVP 不做 streaming。先验证 RAG 质量，streaming 是体验优化，在 generator.ts 中加 `stream: true` 参数即可，DeepSeek API 同样支持 SSE 流式。
```

### Source 结构

```typescript
interface Source {
  document_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;  // 前 150 字符
}
```

---

## 文件目录结构

```
enterprise-kb-rag/
├── .env.local                    # OPENAI_API_KEY, DEEPSEEK_API_KEY, SUPABASE 配置等
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
│
├── app/
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 首页
│   ├── globals.css               # Tailwind 全局样式
│   │
│   ├── knowledge-base/
│   │   └── page.tsx              # 知识库管理页
│   │
│   ├── chat/
│   │   └── page.tsx              # 问答页
│   │
│   └── api/
│       ├── documents/
│       │   ├── route.ts          # POST + GET
│       │   └── [id]/
│       │       └── route.ts      # DELETE
│       │
│       └── chat/
│           └── route.ts          # POST
│
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   │
│   ├── layout/
│   │   └── navbar.tsx
│   │
│   ├── upload/
│   │   ├── file-upload-zone.tsx  # 拖拽上传
│   │   └── document-table.tsx    # 文档列表
│   │
│   └── chat/
│       ├── question-input.tsx     # 输入框
│       ├── answer-display.tsx     # 回答展示
│       └── source-card.tsx        # 来源引用
│
├── lib/
│   ├── supabase/
│   │   └── server.ts            # 服务端 Supabase 客户端
│   │
│   ├── ingestion/
│   │   └── pipeline.ts          # 入库流水线（解析 → 切分 → embed → 入库）
│   │
│   ├── rag/
│   │   ├── embedder.ts          # OpenAI Embedding 封装（text-embedding-3-small）
│   │   ├── chunker.ts           # 文本切分
│   │   ├── retriever.ts         # pgvector 检索
│   │   ├── prompt-builder.ts    # Prompt 构建
│   │   └── generator.ts         # DeepSeek Chat Completion 封装
│   │
│   └── parser/
│       ├── txt-parser.ts        # TXT 解析
│       └── md-parser.ts         # Markdown 解析
│
├── types/
│   └── index.ts                 # 全局类型定义
│
└── supabase/
    └── migrations/
        └── 001_init.sql         # 数据库 DDL
```

---

## RAG 流程

### 入库（Ingestion）

```
用户上传 .txt / .md
      │
      ▼
┌─────────────────┐
│  读取文本内容     │
│  TXT → 直接读取  │
│  MD  → 直接读取  │
│  (MVP 不存原始文件)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  文本切分        │
│  chunk_size=500  │
│  overlap=50      │
│  使用 langchain  │
│  RecursiveChar…  │
│  TextSplitter    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  批量向量化      │
│  text-embedding  │
│  -3-small        │
│  batch=20        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  写入 chunks 表  │
│  更新 doc status │
│  → 'ready'       │
└─────────────────┘
```

### 问答（Query）

```
用户输入问题
      │
      ▼
┌─────────────────┐
│  Embedding 问题  │ → query_vector
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  pgvector 检索   │ → top-5, 过滤 < 阈值(0.4) 
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  构建 Prompt     │
│  system: 角色    │
│  + 检索到的片段   │
│  user: 原始问题   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DeepSeek Chat  │
│  生成回答        │
│  (模型可配置)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  返回前端        │
│  answer + sources│
└─────────────────┘
```

### Prompt 模板

```
你是一个企业知识库助手。请严格根据以下文档片段回答用户问题。
如果片段中没有足够信息，请明确说明"知识库中暂无相关信息"，不要编造。

文档片段：
---
[来源 {i+1}: {s.filename}, 第 {s.chunk_index + 1} 段]
{s.content}
---

用户问题：{query}

请用简洁、专业的中文回答，并在回答中引用来源编号。
```

### 关键参数

| 参数 | 值 | 说明 |
|------|-----|------|
| Chunk size | 500 字符 | 中文约 250 字，适配嵌入模型的上下文 |
| Chunk overlap | 50 字符 | 防止关键信息被切断 |
| Embedding 模型 | `text-embedding-3-small` | 1536 维，性价比最高 |
| 检索 Top-K | 5 | 控制上下文长度 |
| 相似度阈值 | 0.4（默认，抽离为配置常量） | 余弦相似度，后续根据测试数据调优。设 0.4 不设 0.75：避免 MVP 阶段因阈值过高导致无结果 |
| 生成模型 | 由 `DEEPSEEK_CHAT_MODEL` 环境变量指定（默认 `deepseek-chat`） | DeepSeek 中文能力强，推理成本较低；模型名可配置，方便切换 |

---

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API Key（仅用于 Embedding） | `sk-...` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（仅用于 Chat 生成） | `sk-...` |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 | `https://api.deepseek.com` |
| `DEEPSEEK_CHAT_MODEL` | Chat 模型名，方便后续切换 | `deepseek-chat` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJ...` |

### 代码中如何使用

```typescript
// lib/rag/embedder.ts — 固定使用 OpenAI
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embed(texts: string[]) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
```

```typescript
// lib/rag/generator.ts — 使用 DeepSeek，模型从环境变量读取
import OpenAI from "openai";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
});

export async function generate(systemPrompt: string, userPrompt: string) {
  const res = await deepseek.chat.completions.create({
    model: process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return res.choices[0].message.content;
}
```

> DeepSeek API 兼容 OpenAI Chat Completions 调用方式，可通过 OpenAI SDK 配置 `baseURL` 和 `apiKey` 接入。选择 OpenAI SDK 作为统一接口层可降低供应商锁定风险——后续任何兼容 OpenAI 调用格式的模型供应商，切换成本都很低。

---

## 开发顺序

按依赖关系排列，每一步完成后才能进入下一步。

### Step 1: 项目脚手架

| 项 | 内容 |
|------|------|
| 任务 | `create-next-app` + Tailwind + TypeScript + shadcn/ui 初始化 |
| 产出 | 项目能 `npm run dev` 启动，看到默认首页 |
| 验收 | `localhost:3000` 正常渲染 |

### Step 2: Supabase 初始化

| 项 | 内容 |
|------|------|
| 任务 | 创建 Supabase 项目，启用 pgvector 扩展，执行 migration 建表 |
| 产出 | `documents` 和 `document_chunks` 表可读写 |
| 验收 | 在 Supabase SQL Editor 中 `SELECT * FROM documents` 返回空结果（无报错） |

### Step 3: 首页 + 布局

| 项 | 内容 |
|------|------|
| 任务 | 搭建根布局（Navbar + 全局样式），实现首页 UI |
| 产出 | 首页有项目名称、简介、两个功能入口卡片 |
| 验收 | 视觉符合设计稿，两个入口按钮可点击跳转（目标页面可以先 404） |

### Step 4: 文档上传 API

| 项 | 内容 |
|------|------|
| 任务 | 实现 `POST /api/documents`：接收文件 → 读取文本 → 创建 documents 行 → 解析文本 → 切分 → embedding → 写入 chunks → 更新 status |
| 依赖 | Step 2（数据库就绪） |
| 产出 | 上传一个 TXT/MD 文件后，`documents` 和 `document_chunks` 表中有数据 |
| 验收 | 用 curl 上传测试文件，查数据库确认 chunks 的 embedding 字段非空，document status = 'ready' |

### Step 5: 知识库管理页面

| 项 | 内容 |
|------|------|
| 任务 | 实现 `/knowledge-base` 页面：上传组件 + 文档列表 + 删除 |
| 依赖 | Step 4（上传 API 就绪） |
| 产出 | 用户在页面上传文件后，列表中显示新文档，点击删除可移除 |
| 验收 | 上传 → 列表刷新 → 显示文档状态 → 删除 → 列表更新，全流程可用 |

### Step 6: 问答 API

| 项 | 内容 |
|------|------|
| 任务 | 实现 `POST /api/chat`：embedding 问题 → pgvector 检索 → 构建 prompt → 生成回答 → 返回 answer + sources |
| 依赖 | Step 4（chunks 中有数据） |
| 产出 | 传入问题，返回带来源引用的回答 |
| 验收 | 用 curl 测试，"根据上传的文档，XXX 是什么？"，回答中 sources 数组非空，内容与文档一致 |

### Step 7: 问答页面

| 项 | 内容 |
|------|------|
| 任务 | 实现 `/chat` 页面：输入框 + 回答展示 + 来源引用卡片 |
| 依赖 | Step 6（问答 API 就绪） |
| 产出 | 用户输入问题后看到 AI 回答和来源引用 |
| 验收 | 输入问题 → 展示回答 → 回答下方显示来源文件名和段落号 |

### Step 8: 错误处理 + 边界状态

| 项 | 内容 |
|------|------|
| 任务 | 处理上传失败、空知识库提问、API 超时、空状态、loading 态 |
| 依赖 | Step 5 + Step 7 |
| 产出 | 各页面在所有状态下都有合理的 UI 反馈 |
| 验收 | 逐个触发异常场景，确认有用户友好的提示而非白屏或报错堆栈 |

### Step 9: 部署

| 项 | 内容 |
|------|------|
| 任务 | 部署到 Vercel，配置环境变量，绑定自定义域名（可选） |
| 依赖 | Step 8 |
| 产出 | 公网可访问的 URL |
| 验收 | 线上完成一次完整流程（上传文档 → 提问 → 查看引用） |

---

## 各步骤验收标准汇总

| 步骤 | 验收标准（一句话） |
|------|-------------------|
| 1 | `npm run dev` 成功，`localhost:3000` 可访问 |
| 2 | `SELECT * FROM documents` 执行成功不报错 |
| 3 | 首页渲染正常，入口按钮可点击 |
| 4 | curl 上传文件后数据库有 embedding 数据 |
| 5 | 页面上传/查看/删除文档全流程可用 |
| 6 | curl 提问返回带 sources 的回答 |
| 7 | 页面提问看到回答 + 来源引用卡片 |
| 8 | 所有异常场景有合理 UI 反馈 |
| 9 | 线上可访问，完整流程通过 |

---

## 暂不实现的功能

| 功能 | 原因 | 后续成本 |
|------|------|----------|
| PDF 上传 | 需引入 pdf-parse/pdfjs-dist，跨平台兼容性问题多。TXT+MD 先跑通管道 | 加一个 parser 即可，架构不变 |
| 多轮对话/对话历史 | 需要 conversations + messages 表，前端需要状态管理。MVP 验证 RAG 质量优先 | 加 2 张表 + 2 个 API，架构不变 |
| 用户认证/登录 | 作品集项目单人使用，登录不体现 RAG 能力 | 加 Clerk/Auth.js，不影响业务代码 |
| Streaming 回答 | 非流式先验证质量，流式是体验优化 | `stream: true` 参数 + 前端 SSE 处理 |
| 多知识库 | 增加 tenant 隔离复杂度 | 加 `knowledge_base_id` 外键 |
| BM25 混合检索 | pgvector 纯向量检索对中文够用 | 加一个检索函数 + 加权融合 |
| Rerank 重排序 | 增加外部 API 依赖和延迟 | 在 retriever 后加一个 rerank 调用 |
| 文档预览 | 核心价值是问答，不是文档浏览器 | 加一个 Storage 签名 URL 即可 |
| OCR / 图片理解 | 需要多模态模型或额外 OCR 服务 | 独立模块，不影响现有管道 |
| 后台任务队列 | 同步处理 MVP 够用 | 引入 BullMQ + Redis，管道逻辑不变 |

---

## 后续迭代方向

```
V1 (当前)          V1.1              V1.2              V2.0
┌─────────┐      ┌─────────┐       ┌─────────┐       ┌─────────┐
│ TXT/MD  │  →   │ + PDF   │   →   │ + 多轮   │   →   │ + 多知识 │
│ 单轮问答 │      │ + 流式  │       │   对话   │       │   库    │
│ 基础引用 │      │   回答  │       │ + 历史   │       │ + 混合  │
│         │      │         │       │   管理   │       │   检索  │
└─────────┘      └─────────┘       └─────────┘       └─────────┘

V2.1              V2.2              V3.0
┌─────────┐      ┌─────────┐       ┌─────────┐
│ + Rerank│  →   │ + 引用  │   →   │ + 多模态 │
│ + 评测  │      │   高亮  │       │ + 自动化 │
│         │      │ + 更多  │       │   评测  │
│         │      │   格式  │       │         │
└─────────┘      └─────────┘       └─────────┘
```

每个迭代独立可上线，不互相阻塞，不做超前设计。
