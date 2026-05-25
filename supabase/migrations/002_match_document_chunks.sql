-- ============================================================
-- Migration: 002_match_document_chunks
-- Description: RPC function for pgvector cosine similarity search
-- Used by: lib/rag/retriever.ts (retrieval pipeline)
-- ============================================================

-- match_document_chunks
--   Performs cosine similarity search over document_chunks,
--   joined with documents for filename metadata.
--   Only returns chunks from documents with status = 'ready'.
--
-- Parameters:
--   query_embedding      vector(1024)  — embedding from SiliconFlow BGE-M3
--   match_count          int           — max results (default 5)
--   similarity_threshold double precision — min cosine similarity (default 0.4)
--
-- Returns:
--   chunk_id      — chunk id
--   document_id   — parent document id
--   chunk_filename — original filename (for source citation)
--   chunk_index   — chunk sequence index
--   chunk_content — chunk text content
--   similarity    — cosine similarity score [0, 1]

CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding VECTOR(1024),
  match_count INT DEFAULT 5,
  similarity_threshold DOUBLE PRECISION DEFAULT 0.4
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  chunk_filename TEXT,
  chunk_index INT,
  chunk_content TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id           AS chunk_id,
    dc.document_id  AS document_id,
    d.filename      AS chunk_filename,
    dc.chunk_index  AS chunk_index,
    dc.content      AS chunk_content,
    (1 - (dc.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
  FROM document_chunks dc
  INNER JOIN documents d ON d.id = dc.document_id
  WHERE d.status = 'ready'
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
