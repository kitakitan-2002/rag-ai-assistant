// ── Database row types ──

export interface Document {
  id: string;
  filename: string;
  file_type: "txt" | "md";
  file_size: number;
  file_url: string | null;
  status: "processing" | "ready" | "failed";
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  created_at: string;
}

// ── API types ──

export interface Source {
  document_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;
  similarity?: number;
}

export interface UploadDocumentResponse {
  id: string;
  filename: string;
  file_type: "txt" | "md";
  status: "ready" | "failed";
  chunk_count: number;
}

export interface ApiErrorResponse {
  error: string;
}
