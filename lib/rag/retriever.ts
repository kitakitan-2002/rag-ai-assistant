import { getServerClient } from "@/lib/supabase/server";

const TOP_K = Number(process.env.RETRIEVAL_TOP_K) || 5;
const SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD) || 0.4;

interface MatchResult {
  chunk_id: string;
  document_id: string;
  chunk_filename: string;
  chunk_index: number;
  chunk_content: string;
  similarity: number;
}

export async function retrieveChunks(
  queryEmbedding: number[]
): Promise<MatchResult[]> {
  const supabase = getServerClient();

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count: TOP_K,
    similarity_threshold: SIMILARITY_THRESHOLD,
  });

  if (error) throw error;
  return (data as MatchResult[]) ?? [];
}
