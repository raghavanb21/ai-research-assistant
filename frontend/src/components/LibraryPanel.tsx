import React, { useState, useMemo } from 'react';
import { 
  FolderArchive, 
  Search, 
  Filter, 
  ArrowUpDown, 
  RefreshCw, 
  AlertCircle,
  BookOpen,
  FileSearch,
  UploadCloud
} from 'lucide-react';
import { Paper } from '../types';
import PaperCard from './PaperCard';

interface LibraryPanelProps {
  papers: Paper[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDeletePaper: (paperId: number) => Promise<void>;
  onNavigateToSearch: () => void;
  onOpenUploadModal?: () => void;
  onPreviewPDF?: (paper: Paper) => void;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  papers,
  loading,
  error,
  onRefresh,
  onDeletePaper,
  onNavigateToSearch,
  onOpenUploadModal,
  onPreviewPDF
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'year' | 'title'>('newest');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Source counts calculation
  const stats = useMemo(() => {
    const total = papers.length;
    const openalex = papers.filter((p) => p.source === 'openalex').length;
    const arxiv = papers.filter((p) => p.source === 'arxiv').length;
    const upload = papers.filter((p) => p.source === 'upload').length;
    return { total, openalex, arxiv, upload };
  }, [papers]);

  // Filtering and sorting
  const filteredPapers = useMemo(() => {
    let result = [...papers];

    // Filter by source
    if (sourceFilter !== 'all') {
      result = result.filter((p) => p.source.toLowerCase() === sourceFilter.toLowerCase());
    }

    // Filter by text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const abstractMatch = p.abstract ? p.abstract.toLowerCase().includes(q) : false;
        const authorMatch = p.authors ? p.authors.some((a) => a.toLowerCase().includes(q)) : false;
        const arxivMatch = p.arxiv_id ? p.arxiv_id.toLowerCase().includes(q) : false;
        const doiMatch = p.doi ? p.doi.toLowerCase().includes(q) : false;
        return titleMatch || abstractMatch || authorMatch || arxivMatch || doiMatch;
      });
    }

    // Sort papers
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : (a.id || 0);
        const dateB = b.created_at ? new Date(b.created_at).getTime() : (b.id || 0);
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : (a.id || 0);
        const dateB = b.created_at ? new Date(b.created_at).getTime() : (b.id || 0);
        return dateA - dateB;
      }
      if (sortBy === 'year') {
        const yearA = a.publication_year || 0;
        const yearB = b.publication_year || 0;
        return yearB - yearA;
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  }, [papers, sourceFilter, searchQuery, sortBy]);

  const handleDelete = async (paperId: number) => {
    setDeletingId(paperId);
    try {
      await onDeletePaper(paperId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="library-panel">
      {/* Top Library Header & Stats Bar */}
      <div className="library-header-card">
        <div className="library-header-main">
          <div className="library-title-group">
            <div className="library-icon-badge">
              <FolderArchive size={24} />
            </div>
            <div>
              <h2 className="library-main-heading">Persistent Research Library</h2>
              <p className="library-sub-heading">
                All saved papers and uploaded PDFs are persisted in your local SQLite database across refreshes and restarts.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {onOpenUploadModal && (
              <button
                type="button"
                className="upload-trigger-btn"
                onClick={onOpenUploadModal}
                title="Upload PDF research paper"
              >
                <UploadCloud size={16} />
                <span>Upload PDF</span>
              </button>
            )}

            <button
              type="button"
              className="refresh-btn"
              onClick={onRefresh}
              title="Refresh saved papers from database"
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'spinner' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Library Metrics Stats Grid */}
        <div className="library-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Saved Papers</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">OpenAlex Papers</span>
            <span className="stat-value">{stats.openalex}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">arXiv Preprints</span>
            <span className="stat-value">{stats.arxiv}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Uploaded PDFs</span>
            <span className="stat-value">{stats.upload}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search within Library & Source Filters */}
      {papers.length > 0 && (
        <div className="library-controls-bar">
          <div className="library-search-wrapper">
            <Search size={17} className="library-search-icon" />
            <input
              type="text"
              className="library-search-input"
              placeholder="Search saved papers by title, author, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setSearchQuery('')}
                title="Clear filter"
              >
                &times;
              </button>
            )}
          </div>

          <div className="library-filter-group">
            <div className="source-toggles">
              <span className="control-label">
                <Filter size={13} />
                <span>Source:</span>
              </span>
              <button
                type="button"
                className={`source-pill-btn ${sourceFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSourceFilter('all')}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                className={`source-pill-btn ${sourceFilter === 'openalex' ? 'active' : ''}`}
                onClick={() => setSourceFilter('openalex')}
              >
                OpenAlex ({stats.openalex})
              </button>
              <button
                type="button"
                className={`source-pill-btn ${sourceFilter === 'arxiv' ? 'active' : ''}`}
                onClick={() => setSourceFilter('arxiv')}
              >
                arXiv ({stats.arxiv})
              </button>
              <button
                type="button"
                className={`source-pill-btn ${sourceFilter === 'upload' ? 'active' : ''}`}
                onClick={() => setSourceFilter('upload')}
              >
                Uploads ({stats.upload})
              </button>
            </div>

            <div className="sort-selector">
              <span className="control-label">
                <ArrowUpDown size={13} />
                <span>Sort:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="select-dropdown"
              >
                <option value="newest">Recently Saved</option>
                <option value="oldest">Oldest Saved</option>
                <option value="year">Publication Year</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert-banner alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && papers.length === 0 && (
        <div className="skeleton-container">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      )}

      {/* Empty State: Library is completely empty */}
      {!loading && papers.length === 0 && (
        <div className="empty-library-card">
          <div className="empty-icon-circle">
            <BookOpen size={40} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3>Your persistent library is currently empty</h3>
          <p>
            Search for academic papers across OpenAlex and arXiv or upload PDF research papers directly to store them in your local SQLite database for future analysis and Q&A.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {onOpenUploadModal && (
              <button
                type="button"
                className="upload-trigger-btn"
                onClick={onOpenUploadModal}
              >
                <UploadCloud size={17} />
                <span>Upload PDF Paper</span>
              </button>
            )}
            <button
              type="button"
              className="search-submit-btn"
              style={{ display: 'inline-flex', width: 'auto' }}
              onClick={onNavigateToSearch}
            >
              <Search size={17} />
              <span>Search Papers to Add</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State: Filter yielded no results */}
      {!loading && papers.length > 0 && filteredPapers.length === 0 && (
        <div className="empty-results-card">
          <FileSearch size={44} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3>No matching saved papers found</h3>
          <p>No papers in your saved library match the current search query or source filter.</p>
          <button
            type="button"
            className="clear-search-btn"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              setSearchQuery('');
              setSourceFilter('all');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Papers Grid */}
      {filteredPapers.length > 0 && (
        <div className="library-results-section">
          <div className="results-header">
            <span className="results-count-badge">
              Showing {filteredPapers.length} of {papers.length} saved {papers.length === 1 ? 'paper' : 'papers'}
            </span>
          </div>

          <div className="papers-grid">
            {filteredPapers.map((paper) => (
              <PaperCard
                key={`lib-${paper.id}`}
                paper={paper}
                mode="library"
                isSaved={true}
                isDeleting={deletingId === paper.id}
                onDelete={handleDelete}
                onPreviewPDF={onPreviewPDF}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryPanel;
