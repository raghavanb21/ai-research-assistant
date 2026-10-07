import React, { useEffect, useState } from 'react';
import { 
  BookOpen, 
  Search, 
  FolderArchive, 
  Sun, 
  Moon, 
  Database,
  CheckCircle2
} from 'lucide-react';
import { BackendHealth } from './types';
import { checkHealth } from './services/api';
import SearchPanel from './components/SearchPanel';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'search' | 'library'>('search');
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-container">
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
              <span className="nav-counter">0</span>
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Backend Health Badge */}
          <div className="status-pill">
            <span className={`status-dot ${health?.status === 'healthy' ? 'online' : 'offline'}`} />
            <span style={{ fontWeight: 500 }}>
              {health?.status === 'healthy' ? (
                <>Backend Connected ({health.database})</>
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
            Search open-access academic repositories (OpenAlex & arXiv) with zero required API keys.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="status-pill" style={{ padding: '0.35rem 0.85rem' }}>
              <Database size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>SQLite Persistent DB</span>
            </div>
            <div className="status-pill" style={{ padding: '0.35rem 0.85rem' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--accent-success)' }} />
              <span>100% Free Public Search</span>
            </div>
          </div>
        </section>

        {/* Tab Content */}
        {activeTab === 'search' && <SearchPanel />}

        {activeTab === 'library' && (
          <div className="empty-results-card">
            <FolderArchive size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3>Your Persistent Library</h3>
            <p>Paper library saving and persistence will be enabled in Phase 3. Search papers in the "Search Papers" tab above.</p>
          </div>
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
