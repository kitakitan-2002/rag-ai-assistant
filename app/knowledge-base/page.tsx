import Link from "next/link";

export default function KnowledgeBasePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Knowledge Base
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          知识库管理
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          这里将承载文档上传、处理状态和文档列表。当前 Step 3 仅提供页面占位，避免路由 404。
        </p>
      </div>

      <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          文档上传能力将在后续步骤实现
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Step 4 之前不会接入上传 API、Supabase 写入或向量化流程。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
