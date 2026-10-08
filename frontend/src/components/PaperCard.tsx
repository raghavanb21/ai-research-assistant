import React, { useState } from 'react';
import { 
  ExternalLink, 
  Calendar, 
  Users, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  BookmarkPlus, 
  Trash2, 
  Loader2,
  Check,
  AlertTriangle,
  Eye,
  Sparkles,
  MessageSquare
} from 'lucide-react';

import { Paper } from '../types';

interface PaperCardProps {
  paper: Paper;
  mode?: 'search' | 'library';
  isSaved?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  onSave?: (paper: Paper) => void;
  onDelete?: (paperId: number) => void;
  onPreviewPDF?: (paper: Paper) => void;
  onSummarize?: (paper: Paper) => void;
  onQA?: (paper: Paper) => void;
}

export const PaperCard: React.FC<PaperCardProps> = ({ 
  paper, 
  mode = 'search',
  isSaved = false,
  isSaving = false,
  isDeleting = false,
  onSave,
  onDelete,
  onPreviewPDF,
  onSummarize,
  onQA
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Defensive field processing
  const authorsList = paper.authors && paper.authors.length > 0
    ? paper.authors.join(', ')
    : 'Unknown Author(s)';
  
  const publicationYear = paper.publication_year
    ? paper.publication_year.toString()
    : 'Year N/A';

  const hasAbstract = Boolean(paper.abstract && paper.abstract.trim().length > 0);
  const abstractText = hasAbstract
    ? paper.abstract!
    : 'No abstract provided by the academic index.';

  const isLongAbstract = hasAbstract && abstractText.length > 280;

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSave && !isSaved && !isSaving) {
      onSave(paper);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    if (onDelete && paper.id) {
      onDelete(paper.id);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handlePreviewPDF = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreviewPDF) {
      onPreviewPDF(paper);
    } else {
      const pdfUrl = paper.pdf_url || (paper.id ? `/api/pdf/${paper.id}/view` : null);
      if (pdfUrl) {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleSummarize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSummarize) {
      onSummarize(paper);
    }
  };

  const handleQA = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQA) {
      onQA(paper);
    }
  };

  const formattedSavedDate = paper.created_at
    ? new Date(paper.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null;

  const isUploadedPDF = Boolean(paper.source === 'upload' || paper.has_pdf || paper.pdf_url);
  const resolvedPdfUrl = paper.pdf_url || (paper.id ? `/api/pdf/${paper.id}/view` : null);

  return (
    <article className={`paper-card ${mode === 'library' ? 'library-card' : ''} ${isSaved ? 'is-saved' : ''}`}>
      <div className="paper-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`source-badge badge-${paper.source}`}>
            {paper.source === 'openalex' ? 'OpenAlex' : paper.source === 'arxiv' ? 'arXiv' : paper.source === 'upload' ? 'PDF Upload' : paper.source}
          </span>
          {paper.arxiv_id && (
            <span className="source-badge badge-meta">
              arXiv:{paper.arxiv_id}
            </span>
          )}
          {paper.doi && (
            <span className="source-badge badge-meta">
              DOI:{paper.doi}
            </span>
          )}
          {mode === 'library' && paper.id && (
            <span className="source-badge badge-id">
              ID #{paper.id}
            </span>
          )}
          {paper.has_summary && (
            <span className="source-badge badge-summary-ready" title="AI summary is already cached">
              <Sparkles size={11} style={{ marginRight: 3 }} />
              Summary Ready
            </span>
          )}
        </div>

        {/* Paper Link / PDF View Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {paper.url ? (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="paper-link-btn"
              title="Open original paper link in external repository"
            >
              <span>View Paper</span>
              <ExternalLink size={14} />
            </a>
          ) : isUploadedPDF && resolvedPdfUrl ? (
            <button
              type="button"
              className="paper-pdf-btn"
              onClick={handlePreviewPDF}
              title="Preview uploaded PDF research paper"
            >
              <FileText size={14} />
              <span>Preview PDF</span>
            </button>
          ) : (
            <span className="paper-link-disabled" title="No direct paper link available">
              No Link Available
            </span>
          )}
        </div>
      </div>

      <h3 className="paper-card-title">{paper.title}</h3>

      <div className="paper-card-meta">
        <div className="meta-item">
          <Users size={15} style={{ flexShrink: 0 }} />
          <span className={paper.authors && paper.authors.length > 0 ? '' : 'meta-muted'}>
            {authorsList}
          </span>
        </div>
        <div className="meta-item">
          <Calendar size={15} style={{ flexShrink: 0 }} />
          <span className={paper.publication_year ? '' : 'meta-muted'}>
            {publicationYear}
          </span>
        </div>
        {mode === 'library' && formattedSavedDate && (
          <div className="meta-item meta-saved-date">
            <span>Saved {formattedSavedDate}</span>
          </div>
        )}
      </div>

      <div className="paper-card-abstract">
        <div className="abstract-header">
          <FileText size={14} style={{ color: 'var(--text-muted)' }} />
          <span>Abstract</span>
        </div>
        <p className={`abstract-text ${!isExpanded && isLongAbstract ? 'abstract-clamped' : ''} ${!hasAbstract ? 'meta-muted' : ''}`}>
          {abstractText}
        </p>
        {isLongAbstract && (
          <button
            className="expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
          >
            <span>{isExpanded ? 'Show less' : 'Read full abstract'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Action Footer */}
      <div className="paper-card-footer">
        {mode === 'search' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
            {isSaved ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span className="saved-indicator-pill">
                  <Check size={14} />
                  <span>Saved in Library</span>
                </span>
                {onSummarize && paper.id && (
                  <button
                    type="button"
                    className="ai-card-btn summarize-btn"
                    onClick={handleSummarize}
                    title="Generate AI summary of paper"
                  >
                    <Sparkles size={13} />
                    <span>{paper.has_summary ? 'View Summary' : 'Summarize'}</span>
                  </button>
                )}
                {onQA && paper.id && (
                  <button
                    type="button"
                    className="ai-card-btn qa-btn"
                    onClick={handleQA}
                    title="Ask natural-language questions about this paper"
                  >
                    <MessageSquare size={13} />
                    <span>Ask Q&A</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="save-action-btn"
                onClick={handleSaveClick}
                disabled={isSaving}
                title="Save paper to persistent local database"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="spinner" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={15} />
                    <span>Save to Library</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="library-card-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* AI Summarize Action */}
              {onSummarize && (
                <button
                  type="button"
                  className={`ai-card-btn summarize-btn ${paper.has_summary ? 'active' : ''}`}
                  onClick={handleSummarize}
                  title="Generate or view structured LLM summary"
                >
                  <Sparkles size={13} />
                  <span>{paper.has_summary ? 'View Summary' : 'Summarize'}</span>
                </button>
              )}

              {/* AI Q&A Action */}
              {onQA && (
                <button
                  type="button"
                  className="ai-card-btn qa-btn"
                  onClick={handleQA}
                  title="Ask natural-language questions about this paper"
                >
                  <MessageSquare size={13} />
                  <span>Ask Q&A</span>
                </button>
              )}

              {/* PDF Preview Button */}
              {isUploadedPDF && (
                <button
                  type="button"
                  className="card-quick-preview-btn"
                  onClick={handlePreviewPDF}
                  title="Open PDF Preview"
                >
                  <Eye size={13} />
                  <span>View PDF</span>
                </button>
              )}
            </div>

            {/* Delete Confirmation or Delete Button */}
            {showDeleteConfirm ? (
              <div className="delete-confirm-box">
                <span className="delete-confirm-text">
                  <AlertTriangle size={13} style={{ color: 'var(--accent-danger)' }} />
                  <span>Delete paper?</span>
                </span>
                <button
                  type="button"
                  className="confirm-delete-btn"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 size={13} className="spinner" /> : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  className="cancel-delete-btn"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="delete-action-btn"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                title="Remove paper from persistent library"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="spinner" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default PaperCard;
