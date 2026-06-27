import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/rag/embedder";
import { retrieveChunks } from "@/lib/rag/retriever";
import {
  rewriteSearchQuestion,
  streamAnswer,
  type ChatHistoryMessage,
} from "@/lib/rag/generator";
import { checkDemoPassword } from "@/lib/auth/password";

const CONTENT_PREVIEW_LENGTH = 200;
const DISPLAY_SOURCE_THRESHOLD = 0.32;
const HISTORY_LIMIT = 8;
const SCHEMA_MISSING_ERROR =
  "多轮对话数据库表未初始化，请先执行 supabase/migrations/003_conversations_messages.sql";

interface Source {
  document_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;
  similarity: number;
}

function isMissingSchemaError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "42P01"
  );
}

function encodeSse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

export async function POST(request: Request) {
  const authError = checkDemoPassword(request);
  if (authError) return authError;

  let question: string;
  let conversationId: string | undefined;

  try {
    const body = (await request.json()) as {
      question?: string;
      conversationId?: string;
    };
    question = (body.question ?? "").trim();
    conversationId = body.conversationId;
  } catch (e) {
    console.error("[chat] parse body failed:", e);
    return NextResponse.json(
      { error: "请求体格式错误" },
      { status: 400 }
    );
  }

  if (!question) {
    return NextResponse.json(
      { error: "问题不能为空" },
      { status: 400 }
    );
  }

  const supabase = getServerClient();
  let conversation: { id: string; title: string };

  try {
    if (conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title")
        .eq("id", conversationId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "对话不存在或已被删除" },
          { status: 404 }
        );
      }

      conversation = data;
    } else {
      const title = question.length > 24 ? question.slice(0, 24) + "…" : question;
      const { data, error } = await supabase
        .from("conversations")
        .insert({ title })
        .select("id, title")
        .single();

      if (error || !data) {
        console.error("[chat] create conversation failed:", error);
        return NextResponse.json(
          {
            error:
              error?.code === "42P01" ? SCHEMA_MISSING_ERROR : "创建对话失败",
          },
          { status: 500 }
        );
      }

      conversation = data;
    }
  } catch (e) {
    console.error("[chat] prepare conversation failed:", e);
    return NextResponse.json(
      { error: "准备对话失败" },
      { status: 500 }
    );
  }

  let history: ChatHistoryMessage[] = [];

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    if (error) throw error;

    history = ((data ?? []) as ChatHistoryMessage[]).reverse();

    const { error: insertUserError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: question,
      sources: [],
    });

    if (insertUserError) throw insertUserError;
  } catch (e) {
    console.error("[chat] persist user message failed:", e);
    return NextResponse.json(
      {
        error:
          e && typeof e === "object" && "code" in e && e.code === "42P01"
            ? SCHEMA_MISSING_ERROR
            : "保存用户消息失败",
      },
      { status: 500 }
    );
  }

  let searchQuestion = question;

  try {
    searchQuestion = await rewriteSearchQuestion({ question, history });
  } catch (e) {
    console.error("[chat] rewrite search question failed:", e);
  }

  let queryEmbedding: number[][];

  try {
    queryEmbedding = await embedTexts([searchQuestion]);
  } catch (e) {
    console.error("[chat] embed failed:", e);
    return NextResponse.json(
      { error: "生成查询向量失败" },
      { status: 500 }
    );
  }

  let chunks;

  try {
    chunks = await retrieveChunks(queryEmbedding[0]);
  } catch (e) {
    console.error("[chat] retrieve failed:", e);
    return NextResponse.json(
      { error: "文档检索失败" },
      { status: 500 }
    );
  }

  const sources: Source[] = chunks
    .filter((chunk) => chunk.similarity >= DISPLAY_SOURCE_THRESHOLD)
    .map((chunk) => ({
      document_id: chunk.document_id,
      filename: chunk.chunk_filename,
      chunk_index: chunk.chunk_index,
      content_preview:
        chunk.chunk_content.length > CONTENT_PREVIEW_LENGTH
          ? chunk.chunk_content.slice(0, CONTENT_PREVIEW_LENGTH) + "…"
          : chunk.chunk_content,
      similarity: chunk.similarity,
    }));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";

      controller.enqueue(encodeSse("meta", { conversation, sources }));

      try {
        for await (const delta of streamAnswer({ question, chunks, history })) {
          answer += delta;
          controller.enqueue(encodeSse("delta", { content: delta }));
        }

        if (!answer) {
          answer = "模型未返回有效回答。";
          controller.enqueue(encodeSse("delta", { content: answer }));
        }
      } catch (e) {
        console.error("[chat] stream generate failed:", e);
        controller.enqueue(encodeSse("error", { error: "生成回答失败" }));
        controller.close();
        return;
      }

      try {
        const now = new Date().toISOString();
        const { error: insertAssistantError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: answer,
            sources,
          });

        if (insertAssistantError) throw insertAssistantError;

        const { error: updateConversationError } = await supabase
          .from("conversations")
          .update({ updated_at: now })
          .eq("id", conversation.id);

        if (updateConversationError) throw updateConversationError;
      } catch (e) {
        console.error("[chat] persist assistant message failed:", e);
        controller.enqueue(
          encodeSse("error", {
            error: isMissingSchemaError(e)
              ? SCHEMA_MISSING_ERROR
              : "保存助手消息失败",
          })
        );
        controller.close();
        return;
      }

      controller.enqueue(encodeSse("done", { conversation, sources }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
