import { NextResponse } from "next/server";
import { checkDemoPassword } from "@/lib/auth/password";
import { getServerClient } from "@/lib/supabase/server";

const SCHEMA_MISSING_ERROR =
  "多轮对话数据库表未初始化，请先执行 supabase/migrations/003_conversations_messages.sql";

export async function GET(request: Request) {
  const authError = checkDemoPassword(request);
  if (authError) return authError;

  const supabase = getServerClient();

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[conversations] list failed:", error);
    return NextResponse.json(
      {
        error:
          error.code === "42P01" ? SCHEMA_MISSING_ERROR : "获取对话列表失败",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const authError = checkDemoPassword(request);
  if (authError) return authError;

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .insert({ title: "新对话" })
    .select("id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[conversations] create failed:", error);
    return NextResponse.json(
      {
        error:
          error?.code === "42P01" ? SCHEMA_MISSING_ERROR : "创建对话失败",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
