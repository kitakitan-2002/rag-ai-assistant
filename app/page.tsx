import Link from "next/link";

const capabilities = [
  "文档解析与语义分块",
  "向量检索与相似度过滤",
  "基于来源片段的中文问答",
  "回答结果附带文档引用",
];

const entryCards = [
  {
    title: "知识库管理",
    description: "管理企业文档入口，后续用于上传 TXT/Markdown 并查看处理状态。",
    href: "/knowledge-base",
    action: "进入知识库",
  },
  {
    title: "智能问答",
    description: "基于已入库文档进行多轮问答，支持上下文记忆、流式回答与来源引用。",
    href: "/chat",
    action: "开始问答",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-16">
      <section className="grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            RAG Portfolio Project
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            企业知识库 AI 助手
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            一个轻量级企业文档问答系统，用完整 RAG 工程链路把文档转化为可追溯的知识回答。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/knowledge-base"
              className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              管理知识库
            </Link>
            <Link
              href="/chat"
              className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100"
            >
              体验问答
            </Link>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">核心能力</h2>
          <div className="mt-5 grid gap-3">
            {capabilities.map((capability) => (
              <div
                key={capability}
                className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                {capability}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 pb-12 md:grid-cols-2">
        {entryCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-md border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-950">
                {card.title}
              </h2>
              {card.href === "/knowledge-base" ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  目前仅支持单知识库
                </span>
              ) : null}
            </div>
            <p className="mt-3 min-h-14 text-sm leading-6 text-slate-600">
              {card.description}
            </p>
            <span className="mt-6 inline-flex text-sm font-semibold text-slate-900 group-hover:text-slate-600">
              {card.action}
            </span>
          </Link>
        ))}
      </section>

      <footer className="border-t border-slate-200 py-6 text-sm text-slate-500">
        Next.js App Router · TypeScript · Tailwind CSS · Supabase pgvector ·
        SiliconFlow · DeepSeek
      </footer>
    </div>
  );
}
