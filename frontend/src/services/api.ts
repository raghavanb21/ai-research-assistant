import { BackendHealth, Paper, SearchResponse } from '../types';

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

export async function getSavedPapers(): Promise<Paper[]> {
  const res = await fetch(`${API_BASE}/papers`);
  if (!res.ok) {
    throw new Error(`Failed to fetch saved papers: ${res.status}`);
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
