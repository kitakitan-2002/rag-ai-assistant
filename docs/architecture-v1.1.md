# 企业知识库 RAG 助手 — V1.1 规划

## 1. V1.1 定位

V1.0 MVP 已完成文档上传、Embedding 入库、pgvector 检索、RAG 问答、来源引用和 Vercel 部署。

V1.1 不做大功能重构，重点补齐上线后 Demo 的安全保护、文档管理和演示体验。

## 2. V1.1 目标

- 防止公开 Vercel 地址被陌生人随意上传文档或调用问答 API
- 防止测试文档污染知识库
- 提升来源引用展示的可信度
- 保持系统简单，不引入正式登录和复杂权限系统

## 3. V1.1 功能范围

### Step 1：Demo Access Password 保护

目标：

- 保护 `/api/documents` 上传接口
- 保护 `/api/chat` 问答接口
- 前端 `/knowledge-base` 和 `/chat` 页面增加演示密码输入框

实现：

- 新增环境变量 `DEMO_ACCESS_PASSWORD`
- 前端请求时通过 header 传递 `x-demo-password`
- 后端校验密码
- 密码错误返回：`401 { error: "演示密码错误" }`
- 密码保存在浏览器 localStorage，key 为 `demo_access_password`

不做：

- 不接 Clerk
- 不接 Supabase Auth
- 不做正式用户系统
- 不做多用户隔离

### Step 2：文档删除功能

目标：

- 支持删除测试文档
- 防止旧文档污染检索结果
- 方便演示时清理知识库

实现：

- 新增删除接口：`DELETE /api/documents?id=xxx`
- 删除时同时删除：
  - `document_chunks`
  - `documents`
- 删除操作也需要 Demo Access Password
- `/knowledge-base` 文档列表增加删除按钮
- 删除前弹出确认提示

不做：

- 不做批量删除
- 不做回收站
- 不做文件恢复
- 不做 Supabase Storage 文件删除，因为 V1 当前没有保存原始文件

### Step 3：来源引用展示优化

目标：

- 避免低相关文档作为 sources 展示
- 保证用户看到的来源更可信

已完成/待确认：

- 检索阶段使用 `SIMILARITY_THRESHOLD=0.3`
- 展示阶段使用 `DISPLAY_SOURCE_THRESHOLD=0.32`
- sources 最多展示 3 条

说明：

- 检索阈值关注 recall，避免漏掉相关 chunk
- 展示阈值关注 precision，避免低相关来源影响可信度

### Step 4：README 更新

目标：

- 在 README 中增加版本记录
- 标明 V1.0 MVP 已完成
- 标明 V1.1 增强内容

示例：

| 版本 | 内容 |
|------|------|
| V1.0 MVP | 文档上传、Embedding 入库、RAG 问答、来源引用、Vercel 部署 |
| V1.1 | Demo 密码保护、文档删除、来源展示优化 |

### Step 5：线上部署验证

目标：

- Vercel 配置 `DEMO_ACCESS_PASSWORD`
- 重新部署
- 在线验证上传和问答必须输入密码

验收：

- 未输入密码：上传和问答失败
- 密码错误：返回"演示密码错误"
- 密码正确：上传和问答正常
- 文档删除正常
- sources 展示不再出现低相关引用

## 4. V1.1 不做内容

- 不做正式登录
- 不做用户注册
- 不做多租户
- 不做多知识库
- 不做 PDF 上传
- 不做 Streaming
- 不做多轮对话
- 不做 Rerank
- 不做 BM25
- 不做后台任务队列

## 5. 后续版本规划

| 版本 | 方向 |
|------|------|
| V1.2 | 多轮对话、历史记录、文档删除优化、Streaming |
| V2.0 | 正式登录、权限管理、多知识库、多用户隔离 |
| V2.1 | Rerank、BM25 混合检索、检索评测体系 |
