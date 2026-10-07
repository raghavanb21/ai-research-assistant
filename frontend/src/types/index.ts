export interface Paper {
  id?: number;
  title: string;
  authors: string[];
  publication_year?: number | null;
  abstract?: string | null;
  url?: string | null;
  doi?: string | null;
  arxiv_id?: string | null;
  source: 'openalex' | 'arxiv' | 'upload' | string;
  pdf_file_path?: string | null;
  full_text?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaperSummary {
  id?: number;
  paper_id: number;
  summary_text: string;
  key_points: string[];
  model_used?: string;
  created_at?: string;
}

export interface QAMessage {
  id?: number;
  paper_id: number;
  role: 'user' | 'assistant';
  message: string;
  context_used?: string | null;
  created_at?: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  source_used?: string;
  results: Paper[];
  warning?: string | null;
}

export interface BackendHealth {
  status: string;
  database: string;
  llm_provider: string;
  llm_model: string;
  has_gemini_key: boolean;
  has_openai_key: boolean;
}
