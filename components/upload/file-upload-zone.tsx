"use client";

import { useRef, useState } from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface Props {
  onUploadSuccess: () => void;
  password?: string;
}

export function FileUploadZone({ onUploadSuccess, password }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): boolean => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "md") {
      setMessage({ type: "error", text: "仅支持 TXT 和 Markdown 文件" });
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage({ type: "error", text: "文件大小超过限制（5MB）" });
      return false;
    }
    return true;
  };

  const upload = async (file: File) => {
    setMessage(null);
    if (!validate(file)) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const headers: Record<string, string> = {};
      if (password) headers["x-demo-password"] = password;

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");
      setMessage({ type: "success", text: `${file.name} 上传成功` });
      onUploadSuccess();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "上传失败",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border border-dashed bg-white p-10 text-center shadow-sm transition ${
          dragging
            ? "border-slate-950 bg-slate-100"
            : "border-slate-300 hover:border-slate-400"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-6 w-6 animate-spin text-slate-400"
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
            <p className="text-sm font-medium text-slate-600">
              文件处理中…
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">
              拖拽 TXT / Markdown 文件到此处
            </p>
            <p className="mt-2 text-xs text-slate-500">
              或点击选择文件，最大 5MB
            </p>
          </>
        )}
      </div>

      {message && (
        <div
          className={`mt-4 rounded-md px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
