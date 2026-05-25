"use client";

import { useState } from "react";

interface Source {
  document_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;
  similarity: number;
}

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("demo_access_password") ?? "";
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setLoading(true);
    setAnswer(null);
    setSources([]);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(password ? { "x-demo-password": password } : {}),
        },
        body: JSON.stringify({ question: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "请求失败");
      setAnswer(json.answer);
      setSources(json.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          RAG Chat
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          智能问答
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          基于已上传知识库进行 RAG 问答，AI 将根据文档内容生成回答并附上来源引用。
        </p>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600 whitespace-nowrap">
          演示密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            localStorage.setItem("demo_access_password", e.target.value);
          }}
          placeholder="请输入演示密码"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="请输入你想咨询的问题，例如：员工出差报销需要几天内提交材料？"
          disabled={loading}
          className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {loading ? "处理中..." : "发送问题"}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          正在检索知识库并生成回答...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {/* 回答 */}
      {answer && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-950">回答</h2>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {answer}
            </p>
          </div>
        </div>
      )}

      {/* 来源引用 */}
      {answer && sources.length === 0 && !loading && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-950">来源引用</h2>
          <div className="mt-4 rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-500">暂无来源引用</p>
          </div>
        </div>
      )}
      {sources.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-950">
            来源引用
            <span className="ml-2 text-sm font-normal text-slate-500">
              （共 {sources.length} 条）
            </span>
          </h2>
          <div className="mt-4 grid gap-4">
            {sources.map((source, i) => (
              <div
                key={`${source.document_id}-${source.chunk_index}`}
                className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    来源 {i + 1}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>{source.filename}</span>
                  <span className="text-slate-300">|</span>
                  <span>第 {source.chunk_index + 1} 段</span>
                  <span className="text-slate-300">|</span>
                  <span>相似度 {(source.similarity * 100).toFixed(1)}%</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {source.content_preview}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
