import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { ingestDocument } from "@/lib/ingestion/pipeline";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 });
  }

  const filename = file.name;
  const extension = filename.split(".").pop()?.toLowerCase();

  if (extension !== "txt" && extension !== "md") {
    return NextResponse.json(
      { error: "仅支持 TXT 和 Markdown 文件" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "文件大小超过限制（5MB）" },
      { status: 400 }
    );
  }

  const content = await file.text();
  const supabase = getServerClient();

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      filename,
      file_type: extension,
      file_size: file.size,
      file_url: null,
      status: "processing",
    })
    .select("id, filename, file_type")
    .single();

  if (insertError || !doc) {
    return NextResponse.json({ error: "文档创建失败" }, { status: 500 });
  }

  try {
    const result = await ingestDocument({
      documentId: doc.id,
      fileType: doc.file_type as "txt" | "md",
      content,
    });

    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      file_type: doc.file_type,
      status: "ready",
      chunk_count: result.chunkCount,
    });
  } catch {
    return NextResponse.json({ error: "文档处理失败" }, { status: 500 });
  }
}