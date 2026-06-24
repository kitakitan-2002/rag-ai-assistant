"use client";

import { useState } from "react";

interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  chunk_count: number | null;
  created_at: string;
}

interface DocumentChunk {
  id: string;
  chunk_index: number;
  content: string;
  created_at: string;
}

interface DocumentDetail {
  document: Document;
  chunks: DocumentChunk[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  processing: { label: "处理中", color: "bg-amber-100 text-amber-800" },
  ready: { label: "已就绪", color: "bg-green-100 text-green-800" },
  failed: { label: "失败", color: "bg-red-100 text-red-800" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  documents: Document[];
  loading: boolean;
  error?: string | null;
}

export function DocumentList({ documents, loading, error }: Props) {
  const [selected, setSelected] = useState<DocumentDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function handleView(doc: Document) {
    setDetailLoadingId(doc.id);
    setDetailError(null);

    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setDetailError((json as { error?: string })?.error ?? "获取文档内容失败");
        return;
      }

      setSelected(json as DocumentDetail);
    } catch {
      setDetailError("网络请求失败，请稍后重试");
    } finally {
      setDetailLoadingId(null);
    }
  }

  if (error) {
    return (
      <div className="mt-10 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-10 flex items-center gap-3 text-sm text-slate-500">
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
        加载文档列表...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="mt-10 rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">
          暂无文档，请上传 TXT 或 Markdown 文件
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-10 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-3 font-medium text-slate-600">文件名</th>
              <th className="px-5 py-3 font-medium text-slate-600">类型</th>
              <th className="px-5 py-3 font-medium text-slate-600">状态</th>
              <th className="px-5 py-3 font-medium text-slate-600">分块数</th>
              <th className="px-5 py-3 font-medium text-slate-600">
                上传时间
              </th>
              <th className="px-5 py-3 font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const sc = statusConfig[doc.status] ?? {
                label: doc.status,
                color: "bg-slate-100 text-slate-700",
              };
              const isLoading = detailLoadingId === doc.id;

              return (
                <tr
                  key={doc.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {doc.filename}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{doc.file_type}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}
                    >
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {doc.chunk_count ?? "-"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {formatTime(doc.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => void handleView(doc)}
                      disabled={isLoading || doc.status !== "ready"}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? "加载中" : "查看"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailError ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {detailError}
        </div>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Knowledge Content
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  {selected.document.filename}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  共 {selected.chunks.length} 个分块
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                关闭
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              {selected.chunks.length === 0 ? (
                <p className="text-sm text-slate-500">暂无可查看的分块内容</p>
              ) : (
                <div className="space-y-4">
                  {selected.chunks.map((chunk) => (
                    <section
                      key={chunk.id}
                      className="rounded-md border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-2 text-xs font-medium text-slate-500">
                        第 {chunk.chunk_index + 1} 段
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-800">
                        {chunk.content}
                      </pre>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
