"use client";

import { useCallback, useEffect, useState } from "react";
import { FileUploadZone } from "@/components/upload/file-upload-zone";
import { DocumentList } from "@/components/upload/document-list";

interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  chunk_count: number | null;
  created_at: string;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError((json as { error?: string })?.error ?? "获取文档列表失败");
        setDocuments([]);
      } else {
        setDocuments(await res.json());
      }
    } catch {
      setError("网络请求失败，请检查网络连接");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 页面初始化加载
    void fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Knowledge Base
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          知识库管理
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          上传 TXT 或 Markdown 文件，系统将自动解析、分块并生成向量嵌入，用于后续 RAG 问答。
        </p>
      </div>

      <FileUploadZone onUploadSuccess={fetchDocuments} />

      <div className="mt-2">
        <DocumentList documents={documents} loading={loading} error={error} />
      </div>
    </div>
  );
}
