-- ============================================================
-- Migration: 001_init
-- Description: MVP init - pgvector extension + documents + document_chunks
-- Embedding: SiliconFlow BAAI/bge-m3 (1024 dims)
-- ============================================================

-- ============================================================
-- 1. Enable pgvector extension
-- ============================================================
-- pgvector provides vector storage and similarity search for PostgreSQL.
-- Supabase platform pre-installs this extension; CREATE EXTENSION runs once.
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================
-- 2. documents - uploaded document metadata
-- ============================================================
-- MVP supports TXT / Markdown text files only.
-- file_url allows NULL: Supabase Storage is not integrated yet,
--   original files are not persisted.
-- status states:
--   processing - upload accepted, ingestion pipeline running
--   ready      - all chunks vectorized and written
--   failed     - error during ingestion

CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('txt', 'md')),
  file_size     INTEGER NOT NULL,
  file_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'ready', 'failed')),
  chunk_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 3. document_chunks - text segments + vector embeddings
-- ============================================================
-- Each chunk maps to one text segment from the source document.
-- embedding uses SiliconFlow BAAI/bge-m3 model (1024 dimensions).

CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  embedding     VECTOR(1024),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 4. Indexes
-- ============================================================

-- 4.1 Vector similarity search index (IVFFlat)
-- Used for pgvector cosine similarity search (<=> operator).
-- lists = 100: suitable for 1K~100K rows, sufficient for MVP.
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4.2 document_id B-tree index
-- Query all chunks of a document (source citation display, deletion).
CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);

-- 4.3 document_id + chunk_index composite index
-- Order chunks by document and sequence (source citation ordering).
CREATE INDEX idx_chunks_doc_order ON document_chunks(document_id, chunk_index);


-- ============================================================
-- 5. Notes
-- ============================================================
-- - similarity_threshold is NOT defined at database level. It is
--   controlled by the SIMILARITY_THRESHOLD env var in lib/rag/retriever.ts
--   (default 0.4). This allows tuning without schema changes.
-- - No conversations / messages tables: MVP is single-turn Q&A.
-- - No RLS policies: MVP has no auth; API routes use service_role key.
-- - No full-text search (tsvector): MVP uses pure vector retrieval.
