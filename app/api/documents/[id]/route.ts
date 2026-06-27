import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { checkDemoPassword } from "@/lib/auth/password";

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

export async function DELETE(request: Request, context: RouteContext) {
  const authError = checkDemoPassword(request);
  if (authError) return authError;

  const { id } = await context.params;
  const supabase = getServerClient();

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id")
    .eq("id", id)
    .single();

  if (documentError || !document) {
    console.error("[documents] delete lookup failed:", documentError);
    return NextResponse.json({ error: "文档不存在或已被删除" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("[documents] delete failed:", deleteError);
    return NextResponse.json({ error: "删除文档失败" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
