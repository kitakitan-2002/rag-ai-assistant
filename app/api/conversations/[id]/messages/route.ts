import { NextResponse } from "next/server";
import { checkDemoPassword } from "@/lib/auth/password";
import { getServerClient } from "@/lib/supabase/server";

const SCHEMA_MISSING_ERROR =
  "多轮对话数据库表未初始化，请先执行 supabase/migrations/003_conversations_messages.sql";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = checkDemoPassword(request);
  if (authError) return authError;

  const { id } = await context.params;
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, sources, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[conversations] messages failed:", error);
    return NextResponse.json(
      {
        error:
          error.code === "42P01" ? SCHEMA_MISSING_ERROR : "获取消息列表失败",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}
