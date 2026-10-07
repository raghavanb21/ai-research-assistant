import React, { useState, useMemo } from 'react';
import { Search, Sparkles, AlertCircle, Loader2, X, SlidersHorizontal, BookSearch } from 'lucide-react';
import { Paper } from '../types';
import { searchPapers } from '../services/api';
import PaperCard from './PaperCard';

const SAMPLE_QUERIES = [
  'Attention is all you need',
  'Large language models hallucination',
  'Retrieval augmented generation',
  'Diffusion probabilistic models',
  'Quantum error correction'
];

interface SearchPanelProps {
  savedPapers: Paper[];
  onSavePaper: (paper: Paper) => Promise<void>;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ savedPapers, onSavePaper }) => {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'openalex' | 'arxiv' | 'all'>('openalex');
  const [limit, setLimit] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Paper[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [savingPaperKey, setSavingPaperKey] = useState<string | null>(null);

  // Set of identifiers for fast lookup of already saved papers
  const savedKeysSet = useMemo(() => {
    const keys = new Set<string>();
    for (const p of savedPapers) {
      if (p.arxiv_id) keys.add(`arxiv:${p.arxiv_id.toLowerCase()}`);
      if (p.doi) keys.add(`doi:${p.doi.toLowerCase()}`);
      if (p.title) keys.add(`title:${p.title.trim().toLowerCase()}`);
    }
    return keys;
  }, [savedPapers]);

  const getPaperKey = (paper: Paper): string => {
    if (paper.arxiv_id) return `arxiv:${paper.arxiv_id.toLowerCase()}`;
    if (paper.doi) return `doi:${paper.doi.toLowerCase()}`;
    return `title:${paper.title.trim().toLowerCase()}`;
  };

  const isPaperSaved = (paper: Paper): boolean => {
    if (paper.arxiv_id && savedKeysSet.has(`arxiv:${paper.arxiv_id.toLowerCase()}`)) return true;
    if (paper.doi && savedKeysSet.has(`doi:${paper.doi.toLowerCase()}`)) return true;
    if (paper.title && savedKeysSet.has(`title:${paper.title.trim().toLowerCase()}`)) return true;
    return false;
  };

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = (customQuery ?? query).trim();
    if (!searchQuery) return;

    if (customQuery) {
      setQuery(customQuery);
    }

    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const response = await searchPapers(searchQuery, source, limit);
      setResults(response.results);
      if (response.warning) {
        setWarning(response.warning);
      }
      setSearched(true);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch search results.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (paper: Paper) => {
    const key = getPaperKey(paper);
    setSavingPaperKey(key);
    try {
      await onSavePaper(paper);
    } finally {
      setSavingPaperKey(null);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setWarning(null);
    setSearched(false);
  };

  return (
    <div className="search-panel">
      {/* Search Header and Bar */}
      <div className="search-header-container">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder="Search research papers by title, topic, or authors (e.g. 'Transformer attention')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setQuery('')}
                title="Clear input"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="search-submit-btn"
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Search Papers</span>
              </>
            )}
          </button>
        </form>

        {/* Search Controls & Source Filters */}
        <div className="search-controls">
          <div className="source-toggles">
            <span className="control-label">
              <SlidersHorizontal size={14} />
              <span>Source:</span>
            </span>
            <button
              type="button"
              className={`source-pill-btn ${source === 'openalex' ? 'active' : ''}`}
              onClick={() => setSource('openalex')}
            >
              OpenAlex (250M+ Papers / Free)
            </button>
            <button
              type="button"
              className={`source-pill-btn ${source === 'arxiv' ? 'active' : ''}`}
              onClick={() => setSource('arxiv')}
            >
              arXiv (Free Preprints)
            </button>
            <button
              type="button"
              className={`source-pill-btn ${source === 'all' ? 'active' : ''}`}
              onClick={() => setSource('all')}
            >
              All Sources (OpenAlex + arXiv)
            </button>
          </div>

          <div className="limit-selector">
            <span className="control-label">Results:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="select-dropdown"
            >
              <option value={5}>5 papers</option>
              <option value={10}>10 papers</option>
              <option value={20}>20 papers</option>
            </select>
          </div>
        </div>

        {/* Sample Query Suggestions */}
        {!searched && !loading && (
          <div className="sample-queries">
            <span className="sample-label">
              <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>Suggested topics:</span>
            </span>
            <div className="sample-chips">
              {SAMPLE_QUERIES.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="sample-chip"
                  onClick={() => handleSearch(undefined, sample)}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alert Banners */}
      {warning && (
        <div className="alert-banner alert-warning">
          <AlertCircle size={18} />
          <span>{warning}</span>
        </div>
      )}

      {error && (
        <div className="alert-banner alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      {loading && (
        <div className="skeleton-container">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      )}

      {!loading && searched && (
        <div className="search-results-section">
          <div className="results-header">
            <h2>Search Results</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="results-count-badge">
                {results.length} {results.length === 1 ? 'paper' : 'papers'} found
              </span>
              <button
                type="button"
                className="clear-search-btn"
                onClick={handleClear}
              >
                Clear Results
              </button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="empty-results-card">
              <BookSearch size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3>No research papers found</h3>
              <p>We couldn't find any papers matching "{query}". Try adjusting keywords or switching the search source to arXiv.</p>
            </div>
          ) : (
            <div className="papers-grid">
              {results.map((paper, idx) => {
                const key = getPaperKey(paper);
                const saved = isPaperSaved(paper);
                const isSaving = savingPaperKey === key;
                return (
                  <PaperCard 
                    key={`${paper.arxiv_id || paper.doi || idx}-${idx}`} 
                    paper={paper}
                    mode="search"
                    isSaved={saved}
                    isSaving={isSaving}
                    onSave={handleSave}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
