import Link from "next/link";

export default function ChatPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          RAG Chat
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          智能问答
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          这里将展示单轮问答、AI 回答和来源引用。当前 Step 3 仅提供页面占位，避免路由 404。
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-8 shadow-sm">
        <div className="rounded-md bg-slate-50 p-5">
          <p className="text-sm font-medium text-slate-500">问答区域占位</p>
          <p className="mt-3 text-base leading-7 text-slate-700">
            Step 6 和 Step 7 完成后，这里会接入问题输入、回答展示和来源引用卡片。
          </p>
        </div>
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
