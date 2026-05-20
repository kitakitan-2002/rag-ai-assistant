import { getServerClient } from "@/lib/supabase/server";
import { parseTxt } from "@/lib/parser/txt-parser";
import { parseMd } from "@/lib/parser/md-parser";
import { chunk } from "@/lib/rag/chunker";
import { embedTexts } from "@/lib/rag/embedder";

interface IngestDocumentParams {
  documentId: string;
  fileType: "txt" | "md";
  content: string;
}

export async function ingestDocument(
  params: IngestDocumentParams
): Promise<{ chunkCount: number }> {
  const { documentId, fileType, content } = params;
  const supabase = getServerClient();

  try {
    const text = fileType === "md" ? parseMd(content) : parseTxt(content);

    const chunks = await chunk(text);
    if (chunks.length === 0) {
      throw new Error("文档切分为空，无法生成有效分段");
    }

    const embeddings = await embedTexts(chunks);
    if (embeddings.length !== chunks.length) {
      throw new Error(
        `向量数量(${embeddings.length})与分段数量(${chunks.length})不一致`
      );
    }

    const { error: insertError } = await supabase.from("document_chunks").insert(
      chunks.map((content, index) => ({
        document_id: documentId,
        chunk_index: index,
        content,
        embedding: embeddings[index],
        metadata: {},
      }))
    );

    if (insertError) {
      throw insertError;
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      throw updateError;
    }

    return { chunkCount: chunks.length };
  } catch (error) {
    await supabase
      .from("documents")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    throw error;
  }
}