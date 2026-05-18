# 技术决策记录 (TDR)

V1 不做哪些事情，以及为什么。

---

## 1. 不做 PDF 上传

- **影响**：MVP 仅支持 TXT 和 Markdown
- **理由**：
  - PDF 文本提取依赖 `pdf-parse` 或 `pdfjs-dist`，不同 PDF 编码、字体、布局导致提取质量不可控
  - 跨平台构建兼容性问题（Node.js native addon）增加 CI/CD 调试成本
  - TXT + MD 已覆盖 MVP 验证 RAG 管道的核心需求
  - 解析层已抽象为 `parser/` 模块，加一个 `pdf-parser.ts` 即可接入，架构无需改动
- **何时做**：V1.1，RAG 管道在 TXT/MD 上验证通过后

---

## 2. 不做多轮对话 / 对话历史

- **影响**：/chat 页面无历史记录，刷新即清空；不存储 conversations 和 messages 表
- **理由**：
  - MVP 的核心目标是验证 RAG 检索 + 生成质量，而非产品体验
  - 对话持久化需要两张表 + 两套 CRUD API + 前端状态管理，增加约 30% 开发量
  - 面试时可以说"RAG 管道的核心价值在检索和生成，对话管理是标准 CRUD，技术上没有挑战，加两张表即可"
  - 单轮问答已足够展示完整的 RAG 流程：embedding → 检索 → prompt → 生成 → 引用
- **何时做**：V1.2，RAG 质量验证通过后

---

## 3. 不做用户认证 / 登录

- **影响**：无登录态，所有功能免登录使用
- **理由**：
  - 这是作品集项目，受众是面试官，不是真实多用户场景
  - 登录是基础设施（Clerk / Auth.js），不体现 RAG 能力
  - 从零接入认证只需 30 分钟，不影响任何业务代码架构
  - 过早接入反而增加面试官的试用门槛
- **何时做**：需要演示多用户场景时（面试官通常不需要）

---

## 4. 不做 Rerank 重排序

- **影响**：检索结果直接使用 pgvector 余弦相似度排序，不经过二次排序
- **理由**：
  - Rerank 需要额外调用 Cohere API（或开源 cross-encoder 模型），增加外部依赖、延迟和成本
  - pgvector 的余弦相似度在中文场景下对 MVP 足够
  - 面试时可以说明"向量检索 → Rerank → 生成是标准三段式，当前只做了第一段和第三段，第二段是下一步优化方向"
  - `retriever.ts` 设计为独立函数，后续在调用链中插入 rerank 调用即可
- **何时做**：V2.1，检索结果多样性不足时引入

---

## 5. 不做 BM25 混合检索

- **影响**：仅使用向量语义检索，不结合关键词匹配
- **理由**：
  - BM25 需要额外的全文索引（PostgreSQL `tsvector`）或独立的搜索引擎（Elasticsearch/Meilisearch）
  - 向量检索对中文语义理解已经足够好（尤其 text-embedding-3-small 对中文优化过）
  - 混合检索的难点在于融合策略（RRF / 加权求和），调参成本高
  - `retriever.ts` 可扩展为多策略检索 + 融合，架构已预留
- **何时做**：V2.0，出现专有名词/精确匹配场景时引入

---

## 6. 不做 Streaming 回答

- **影响**：API 返回完整回答，前端一次性渲染，用户需等待
- **理由**：
  - Streaming 提升的是体验（首字延迟），不是回答质量
  - MVP 先验证 prompt 效果和检索质量，streaming 是锦上添花
  - 实现上只需在 Chat Completion 调用中加 `stream: true`，前端改用 SSE 消费，改动量小
  - 非流式对调试更友好（完整 response 便于 log 和排查）
- **何时做**：V1.1，RAG 质量验证通过后

---

## 7. 不做后台任务队列

- **影响**：文档上传后在同一个 HTTP 请求内完成切分 + embedding，请求可能持续 10-30 秒
- **理由**：
  - MVP 阶段的文件规模（几十 KB 的 TXT/MD）同步处理完全够用
  - BullMQ + Redis 增加运维复杂度（本地开发需要 Redis，Vercel 需要 Upstash）
  - 面试时可以明确说"文档处理是同步的，如果文档大到需要异步，逻辑本身不用改，引入队列包装一次调用即可"
  - Vercel Function 默认超时 60s（Hobby）/ 300s（Pro），对 MVP 够用
- **何时做**：文档规模达到数百 KB 级别或需要批量上传时

---

## 8. 不做 Supabase Storage（V1 阶段）

- **影响**：原始文件不持久化存储，`file_url` 字段为 NULL
- **理由**：
  - MVP 的核心产物是向量（chunks），不是原始文件
  - 跳过 Storage 配置减少了 Supabase 初始化步骤和权限调试
  - 后续接 Storage 只需：创建 bucket → 上传文件 → 写 `file_url`，不涉及表结构变更
  - 如果后续需要文档预览/下载，再接入 Storage
- **何时做**：需要文档预览 / 下载原文件时

---

## 9. 为什么 V1 使用 OpenAI Embedding + DeepSeek Chat

- **影响**：RAG 管道的 embedding 和生成分别调用不同供应商
- **理由**：
  - Embedding 是 RAG 的基础设施，直接影响检索质量。OpenAI `text-embedding-3-small` 是业界标杆，在 MTEB 中文基准上表现稳定，没有必要为省几毛钱在 embedding 环节引入不确定性
  - DeepSeek Chat 的中文生成能力与 GPT-4o-mini 相当甚至更优，且通常具备较低的推理成本。对于作品集项目的调用量，这个差异不明显，但"会做成本控制"本身就是一个面试加分项
  - 两套 API 都兼容 OpenAI SDK 格式，统一使用 `openai` npm 包即可，不增加依赖
  - `lib/rag/embedder.ts` 和 `lib/rag/generator.ts` 各自独立，解耦意味着：
    - 后续想换 Azure OpenAI、零一万物、通义千问作为 Chat 供应商，只改 `generator.ts`
    - 想用 Cohere Embed 或本地 bge-small-zh 做 embedding，只改 `embedder.ts`
    - 两种变更互不阻塞
  - 面试时这是一个很好的架构话题："为什么 embedding 和生成不放在同一个供应商？"——答案就是解耦、降本、灵活替换
- **风险**：DeepSeek 的 API 稳定性不如 OpenAI，需在 `generator.ts` 中加入 retry 逻辑
- **何时重新评估**：如果 OpenAI 调整 embedding 定价，或 DeepSeek 服务频繁不可用，重新评估

---

## 决策原则

```
        有必要吗？                   马上做
           │
    ┌──────┴──────┐
    │ 否          │ 是
    ▼             ▼
 不做           现在做会阻塞
                  核心 RAG 验证吗？
                    │
           ┌────────┴────────┐
           │ 是              │ 否
           ▼                 ▼
        做                 推迟到 V1.1+
```

**核心思路**：每一行代码都要服务于"让面试官看到你理解 RAG"这个目标。不能直接证明这个能力的东西，一律推迟。
