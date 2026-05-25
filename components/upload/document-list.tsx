interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  chunk_count: number | null;
  created_at: string;
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
        加载文档列表…
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
    <div className="mt-10 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-5 py-3 font-medium text-slate-600">文件名</th>
            <th className="px-5 py-3 font-medium text-slate-600">类型</th>
            <th className="px-5 py-3 font-medium text-slate-600">状态</th>
            <th className="px-5 py-3 font-medium text-slate-600">分块数</th>
            <th className="px-5 py-3 font-medium text-slate-600">上传时间</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const sc = statusConfig[doc.status] ?? {
              label: doc.status,
              color: "bg-slate-100 text-slate-700",
            };
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
