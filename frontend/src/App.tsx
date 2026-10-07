import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  Search,
  FolderArchive,
  Sun,
  Moon,
  Database,
  CheckCircle2,
  Check,
  AlertCircle,
  X,
  UploadCloud
} from 'lucide-react';
import { BackendHealth, Paper } from './types';
import { checkHealth, getSavedPapers, savePaper, deletePaper } from './services/api';
import SearchPanel from './components/SearchPanel';
import LibraryPanel from './components/LibraryPanel';
import PDFUploadModal from './components/PDFUploadModal';
import PDFViewerModal from './components/PDFViewerModal';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [activeTab, setActiveTab] = useState<'search' | 'library'>('search');
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Library state
  const [savedPapers, setSavedPapers] = useState<Paper[]>([]);
  const [libraryLoading, setLibraryLoading] = useState<boolean>(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [previewPaper, setPreviewPaper] = useState<Paper | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch initial health
  useEffect(() => {
    checkHealth()
      .then((data) => {
        setHealth(data);
        setHealthError(null);
      })
      .catch((err) => {
        console.error('Health check error:', err);
        setHealthError(err.message);
      });
  }, []);

  // Fetch saved papers from database
  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const papers = await getSavedPapers();
      setSavedPapers(papers);
    } catch (err: any) {
      console.error('Failed to load library:', err);
      setLibraryError(err.message || 'Could not load saved papers from database.');
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Handle saving paper from search
  const handleSavePaper = async (paper: Paper) => {
    try {
      const saved = await savePaper(paper);
      setSavedPapers((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === saved.id || (saved.arxiv_id && p.arxiv_id === saved.arxiv_id) || (saved.doi && p.doi === saved.doi));
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = saved;
          return copy;
        }
        return [saved, ...prev];
      });
      showToast(`"${paper.title.slice(0, 45)}${paper.title.length > 45 ? '...' : ''}" saved to library!`, 'success');
    } catch (err: any) {
      console.error('Save paper error:', err);
      showToast(err.message || 'Failed to save paper to database', 'error');
      throw err;
    }
  };

  // Handle newly uploaded PDF paper
  const handleUploadSuccess = (uploadedPaper: Paper) => {
    setSavedPapers((prev) => {
      const exists = prev.some((p) => p.id === uploadedPaper.id);
      if (exists) return prev;
      return [uploadedPaper, ...prev];
    });
    setActiveTab('library');
    showToast(`"${uploadedPaper.title.slice(0, 40)}..." extracted and saved to library!`, 'success');
  };

  // Handle deleting paper from SQLite
  const handleDeletePaper = async (paperId: number) => {
    try {
      await deletePaper(paperId);
      setSavedPapers((prev) => prev.filter((p) => p.id !== paperId));
      if (previewPaper && previewPaper.id === paperId) {
        setPreviewPaper(null);
      }
      showToast('Paper removed from library', 'info');
    } catch (err: any) {
      console.error('Delete paper error:', err);
      showToast(err.message || 'Failed to delete paper', 'error');
      throw err;
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            {toast.type === 'success' && <Check size={16} className="toast-icon" />}
            {toast.type === 'error' && <AlertCircle size={16} className="toast-icon" />}
            {toast.type === 'info' && <CheckCircle2 size={16} className="toast-icon" />}
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* PDF Upload Modal */}
      <PDFUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* In-App PDF Preview Viewer Modal */}
      <PDFViewerModal
        paper={previewPaper}
        isOpen={Boolean(previewPaper)}
        onClose={() => setPreviewPaper(null)}
      />

      {/* Top Navigation Bar */}
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="nav-brand">
            <div className="brand-icon">
              <BookOpen size={22} />
            </div>
            <span>AI Research Assistant</span>
            <span className="brand-badge">v0.1.0</span>
          </div>

          <nav className="nav-links" style={{ marginLeft: '1.5rem' }}>
            <button
              className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={17} />
              <span>Search Papers</span>
            </button>
            <button
              className={`nav-btn ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              <FolderArchive size={17} />
              <span>Library</span>
              <span className="nav-counter">{savedPapers.length}</span>
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Upload PDF Action Button */}
          <button
            type="button"
            className="navbar-upload-btn"
            onClick={() => setIsUploadModalOpen(true)}
            title="Upload PDF research paper"
          >
            <UploadCloud size={16} />
            <span>Upload PDF</span>
          </button>

          {/* Backend Health Badge */}
          <div className="status-pill">
            <span className={`status-dot ${health?.status === 'healthy' ? 'online' : 'offline'}`} />
            <span style={{ fontWeight: 500 }}>
              {health?.status === 'healthy' ? (
                <>SQLite Connected</>
              ) : (
                <>{healthError ? 'Backend Offline' : 'Connecting...'}</>
              )}
            </span>
          </div>

          {/* Theme Switcher */}
          <button
            className="nav-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ padding: '0.5rem' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <section className="hero-card" style={{ padding: '1.75rem 2rem', marginBottom: '1.5rem' }}>
          <h1 className="hero-title" style={{ fontSize: '1.9rem', marginBottom: '0.5rem' }}>
            Discover, Analyze & Query Academic Research
          </h1>
          <p className="hero-subtitle" style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>
            Search open-access academic repositories (OpenAlex & arXiv), upload PDF research papers locally, and organize your persistent research library.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="status-pill" style={{ padding: '0.35rem 0.85rem' }}>
              <Database size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>Persistent SQLite Database</span>
            </div>
            <div className="status-pill" style={{ padding: '0.35rem 0.85rem' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--accent-success)' }} />
              <span>100% Free Public Search</span>
            </div>
            <div className="status-pill" style={{ padding: '0.35rem 0.85rem' }}>
              <UploadCloud size={14} style={{ color: 'var(--accent-warning, #f59e0b)' }} />
              <span>Local PyMuPDF Extraction & PDF Preview</span>
            </div>
            <div className="status-pill" style={{ padding: '0.35rem 0.85rem' }}>
              <FolderArchive size={14} style={{ color: 'var(--accent-info)' }} />
              <span>{savedPapers.length} in Library</span>
            </div>
          </div>
        </section>

        {/* Tab Content */}
        {activeTab === 'search' && (
          <SearchPanel
            savedPapers={savedPapers}
            onSavePaper={handleSavePaper}
          />
        )}

        {activeTab === 'library' && (
          <LibraryPanel
            papers={savedPapers}
            loading={libraryLoading}
            error={libraryError}
            onRefresh={fetchLibrary}
            onDeletePaper={handleDeletePaper}
            onNavigateToSearch={() => setActiveTab('search')}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onPreviewPDF={(paper) => setPreviewPaper(paper)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>AI Research Assistant &bull; Single-User Architecture &bull; Built with FastAPI & React</p>
      </footer>
    </div>
  );
};

export default App;
