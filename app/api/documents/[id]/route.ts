import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = getServerClient();

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, filename, file_type, status, chunk_count, created_at")
    .eq("id", id)
    .single();

  if (documentError || !document) {
    console.error("[documents] detail failed:", documentError);
    return NextResponse.json({ error: "文档不存在或读取失败" }, { status: 404 });
  }

  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, content, created_at")
    .eq("document_id", id)
    .order("chunk_index", { ascending: true });

  if (chunksError) {
    console.error("[documents] chunks failed:", chunksError);
    return NextResponse.json({ error: "获取文档内容失败" }, { status: 500 });
  }

  return NextResponse.json({
    document,
    chunks: chunks ?? [],
  });
}
