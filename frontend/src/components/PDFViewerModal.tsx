import React, { useEffect } from 'react';
import { X, ExternalLink, FileText } from 'lucide-react';
import { Paper } from '../types';

interface PDFViewerModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  paper,
  isOpen,
  onClose
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !paper) return null;

  const pdfUrl = paper.pdf_url || (paper.id ? `/api/pdf/${paper.id}/view` : null);

  return (
    <div className="modal-overlay pdf-viewer-overlay" onClick={onClose}>
      <div className="modal-card pdf-viewer-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header pdf-viewer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
            <div className="modal-icon-badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <FileText size={20} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h3 className="modal-title text-truncate" title={paper.title}>
                {paper.title}
              </h3>
              <p className="modal-subtitle">
                {paper.authors && paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Author(s)'}
                {paper.publication_year ? ` • ${paper.publication_year}` : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="paper-link-btn"
                title="Open PDF in new browser tab"
              >
                <span>Open Full Tab</span>
                <ExternalLink size={14} />
              </a>
            )}

            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              title="Close viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Embedded PDF Iframe */}
        <div className="pdf-viewer-body">
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="pdf-iframe"
              title={`PDF Viewer - ${paper.title}`}
            />
          ) : (
            <div className="empty-results-card">
              <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3>PDF file unavailable</h3>
              <p>Could not resolve the safe streaming endpoint for this document.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewerModal;
