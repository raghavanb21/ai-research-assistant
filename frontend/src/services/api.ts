import { BackendHealth, Paper, PaperSummary, QAMessage, QAHistoryResponse, SearchResponse } from '../types';

const API_BASE = '/api';

export async function checkHealth(): Promise<BackendHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  return res.json();
}

export async function searchPapers(query: string, source = 'arxiv', limit = 10): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, source, limit: limit.toString() });
  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Search failed with status: ${res.status}`);
  }
  return res.json();
}

export async function getSavedPapers(query?: string, source?: string): Promise<Paper[]> {
  const params = new URLSearchParams();
  if (query && query.trim()) params.append('q', query.trim());
  if (source && source !== 'all') params.append('source', source);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/papers${queryString}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch saved papers: ${res.status}`);
  }
  return res.json();
}

export async function getPaperById(paperId: number): Promise<Paper> {
  const res = await fetch(`${API_BASE}/papers/${paperId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch paper with ID ${paperId}`);
  }
  return res.json();
}

export async function savePaper(paper: Partial<Paper>): Promise<Paper> {
  const res = await fetch(`${API_BASE}/papers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paper),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to save paper`);
  }
  return res.json();
}

export async function deletePaper(paperId: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/papers/${paperId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete paper`);
  }
  return res.json();
}

export async function uploadPDF(file: File): Promise<Paper> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/pdf/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed with status: ${res.status}`);
  }
  return res.json();
}

export async function getPaperSummary(paperId: number): Promise<PaperSummary> {
  const res = await fetch(`${API_BASE}/ai/summary/${paperId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch paper summary`);
  }
  return res.json();
}

export async function generatePaperSummary(paperId: number, forceRegenerate = false): Promise<PaperSummary> {
  const params = forceRegenerate ? '?force_regenerate=true' : '';
  const res = await fetch(`${API_BASE}/ai/summarize/${paperId}${params}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to generate paper summary`);
  }
  return res.json();
}

export async function askPaperQuestion(paperId: number, question: string): Promise<QAMessage> {
  const res = await fetch(`${API_BASE}/ai/qa/${paperId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to answer question`);
  }
  return res.json();
}

export async function getPaperQAHistory(paperId: number): Promise<QAHistoryResponse> {
  const res = await fetch(`${API_BASE}/ai/qa/${paperId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch Q&A history`);
  }
  return res.json();
}

export async function clearPaperQAHistory(paperId: number): Promise<{ success: boolean; deleted_messages: number }> {
  const res = await fetch(`${API_BASE}/ai/qa/${paperId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to clear Q&A history`);
  }
  return res.json();
}

