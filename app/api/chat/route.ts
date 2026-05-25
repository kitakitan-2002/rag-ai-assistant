import { NextResponse } from "next/server";
import { embedTexts } from "@/lib/rag/embedder";
import { retrieveChunks } from "@/lib/rag/retriever";
import { generateAnswer } from "@/lib/rag/generator";
import { checkDemoPassword } from "@/lib/auth/password";

const CONTENT_PREVIEW_LENGTH = 200;
const DISPLAY_SOURCE_THRESHOLD = 0.32;

interface Source {
  document_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;
  similarity: number;
}

export async function POST(request: Request) {
  const authError = checkDemoPassword(request);
  if (authError) return authError;

  let question: string;

  try {
    const body = (await request.json()) as { question?: string };
    question = (body.question ?? "").trim();
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

  let queryEmbedding: number[][];

  try {
    queryEmbedding = await embedTexts([question]);
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

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: "当前知识库中没有足够信息来回答这个问题。",
      sources: [],
    });
  }

  let answer: string;

  try {
    answer = await generateAnswer({ question, chunks });
  } catch (e) {
    console.error("[chat] generate failed:", e);
    return NextResponse.json(
      { error: "生成回答失败" },
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

  return NextResponse.json({ answer, sources });
}
