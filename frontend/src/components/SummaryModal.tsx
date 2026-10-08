import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  BrainCircuit,
  Calendar,
  Users
} from 'lucide-react';

import { Paper, PaperSummary } from '../types';
import { generatePaperSummary, getPaperSummary } from '../services/api';

interface SummaryModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenQA?: (paper: Paper) => void;
  onSummaryGenerated?: (paperId: number) => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  paper,
  isOpen,
  onClose,
  onOpenQA,
  onSummaryGenerated
}) => {
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchOrGenerateSummary = useCallback(async (force = false) => {
    if (!paper || !paper.id) return;
    setLoading(true);
    setError(null);

    try {
      if (!force) {
        // Try getting cached summary first
        try {
          const cached = await getPaperSummary(paper.id);
          setSummary(cached);
          setLoading(false);
          return;
        } catch {
          // No cached summary, proceed to generate
        }
      }

      // Generate new summary
      const generated = await generatePaperSummary(paper.id, force);
      setSummary(generated);
      if (onSummaryGenerated && paper.id) {
        onSummaryGenerated(paper.id);
      }
    } catch (err: any) {
      console.error('Summary generation error:', err);
      setError(err.message || 'Failed to generate summary with AI.');
    } finally {
      setLoading(false);
    }
  }, [paper, onSummaryGenerated]);

  useEffect(() => {
    if (isOpen && paper && paper.id) {
      setSummary(null);
      fetchOrGenerateSummary(false);
    }
  }, [isOpen, paper, fetchOrGenerateSummary]);

  if (!isOpen || !paper) return null;

  const handleCopySummary = () => {
    if (!summary) return;
    let fullContent = `# ${paper.title}\n\n`;
    if (summary.key_points && summary.key_points.length > 0) {
      fullContent += `## Key Takeaways\n${summary.key_points.map((pt) => `* ${pt}`).join('\n')}\n\n`;
    }
    fullContent += summary.summary_text;

    navigator.clipboard.writeText(fullContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSwitchToQA = () => {
    onClose();
    if (onOpenQA) {
      onOpenQA(paper);
    }
  };

  const authorsString = paper.authors && paper.authors.length > 0
    ? paper.authors.join(', ')
    : 'Unknown Author(s)';

  const hasFullText = Boolean(paper.full_text && paper.full_text.length > 100);

  // Helper to render markdown-like text nicely
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} style={{ height: '0.75rem' }} />;
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="summary-section-heading">
            {trimmed.replace('### ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={idx} className="summary-main-heading">
            {trimmed.replace('## ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const bulletContent = trimmed.replace(/^[\*\-]\s+/, '');
        return (
          <div key={idx} className="summary-bullet-item">
            <span className="bullet-dot">&bull;</span>
            <span>{renderInlineFormatting(bulletContent)}</span>
          </div>
        );
      }
      return (
        <p key={idx} className="summary-paragraph">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });
  };

  // Helper for inline **bold**
  const renderInlineFormatting = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container summary-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 className="modal-title">AI Research Summary</h2>
                <span className="source-badge badge-meta" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-primary)' }}>
                  <BrainCircuit size={12} style={{ marginRight: 4 }} />
                  {hasFullText ? 'Grounded in Full PDF Text' : 'Grounded in Academic Abstract'}
                </span>
              </div>
              <p className="modal-subtitle" style={{ marginTop: '0.2rem' }}>
                Structured synthesis generated from paper content by Google Gemini
              </p>
            </div>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose} title="Close summary">
            <X size={20} />
          </button>
        </div>

        {/* Paper Info Banner */}
        <div className="summary-paper-info-banner">
          <h3 className="summary-paper-title">{paper.title}</h3>
          <div className="summary-paper-meta-row">
            <span className="meta-item">
              <Users size={14} />
              <span>{authorsString}</span>
            </span>
            <span className="meta-item">
              <Calendar size={14} />
              <span>{paper.publication_year || 'Year N/A'}</span>
            </span>
            <span className="source-badge badge-meta">
              Source: {paper.source.toUpperCase()}
            </span>
            {summary?.model_used && (
              <span className="source-badge badge-meta" style={{ opacity: 0.85 }}>
                Model: {summary.model_used}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body summary-modal-body">
          {/* Loading State */}
          {loading && (
            <div className="summary-loading-state">
              <div className="ai-pulse-orb">
                <BrainCircuit size={36} className="ai-pulse-icon" />
              </div>
              <h3>Analyzing Paper Content with Gemini LLM...</h3>
              <p>
                Synthesizing core objective, methodology innovation, experimental findings, and limitations.
              </p>
              <div className="loading-steps">
                <div className="step-item active">
                  <CheckCircle2 size={15} />
                  <span>Loading paper content & context ({hasFullText ? 'Full Text' : 'Abstract'})</span>
                </div>
                <div className="step-item active">
                  <RefreshCw size={15} className="spinner" />
                  <span>Synthesizing structured findings & takeaways</span>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="alert-banner alert-error" style={{ margin: '1rem 0' }}>
              <AlertCircle size={20} />
              <div style={{ flex: 1 }}>
                <strong>Summary Generation Failed</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>{error}</p>
              </div>
              <button
                type="button"
                className="retry-btn"
                onClick={() => fetchOrGenerateSummary(true)}
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Summary Content */}
          {!loading && summary && (
            <div className="summary-content-wrapper">
              {/* Key Takeaways Card */}
              {summary.key_points && summary.key_points.length > 0 && (
                <div className="key-takeaways-card">
                  <div className="key-takeaways-header">
                    <Lightbulb size={18} style={{ color: '#f59e0b' }} />
                    <h4>Core Key Takeaways</h4>
                  </div>
                  <div className="key-takeaways-list">
                    {summary.key_points.map((point, index) => (
                      <div key={index} className="key-takeaway-item">
                        <span className="takeaway-number">{index + 1}</span>
                        <p>{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Markdown Structured Body */}
              <div className="summary-markdown-body">
                {renderFormattedMarkdown(summary.summary_text)}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="copy-summary-btn"
              onClick={handleCopySummary}
              disabled={!summary || loading}
              title="Copy summary to clipboard"
            >
              {copied ? (
                <>
                  <Check size={16} style={{ color: 'var(--accent-success)' }} />
                  <span style={{ color: 'var(--accent-success)' }}>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy Summary</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="regenerate-summary-btn"
              onClick={() => fetchOrGenerateSummary(true)}
              disabled={loading}
              title="Regenerate summary with fresh LLM analysis"
            >
              <RefreshCw size={15} className={loading ? 'spinner' : ''} />
              <span>Regenerate</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              className="ask-qa-transition-btn"
              onClick={handleSwitchToQA}
              title="Open interactive Q&A session about this paper"
            >
              <MessageSquare size={16} />
              <span>Ask Questions About Paper</span>
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
