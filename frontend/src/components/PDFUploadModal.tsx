import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Calendar, 
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { Paper } from '../types';
import { uploadPDF } from '../services/api';

interface PDFUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (paper: Paper) => void;
}

export const PDFUploadModal: React.FC<PDFUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedPaper, setExtractedPaper] = useState<Paper | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !uploading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, uploading]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (uploading) return;
    setSelectedFile(null);
    setError(null);
    setExtractedPaper(null);
    onClose();
  };

  const validateAndProcessFile = async (file: File) => {
    setError(null);
    setExtractedPaper(null);

    // Validate extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file (.pdf).');
      return;
    }

    // Validate size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setError(`File size exceeds 25MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      const paper = await uploadPDF(file);
      setExtractedPaper(paper);
      onUploadSuccess(paper);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to extract text from PDF.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="modal-icon-badge">
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 className="modal-title">Upload Research Paper PDF</h3>
              <p className="modal-subtitle">100% Local text & metadata extraction with PyMuPDF (Zero data leakage)</p>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={handleClose}
            disabled={uploading}
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Privacy & Security Guarantee Banner */}
          <div className="privacy-pill">
            <ShieldCheck size={15} style={{ color: 'var(--accent-success)' }} />
            <span>Local Processing: PDF documents are parsed in memory on this machine and never leave local storage.</span>
          </div>

          {!extractedPaper ? (
            <>
              {/* Drag and Drop Zone */}
              <div
                className={`dropzone ${isDragging ? 'drag-active' : ''} ${uploading ? 'uploading-state' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={uploading ? undefined : handleBrowseClick}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  disabled={uploading}
                />

                {uploading ? (
                  <div className="dropzone-uploading">
                    <Loader2 size={44} className="spinner dropzone-icon" />
                    <h4>Parsing & Extracting PDF Content...</h4>
                    <p>PyMuPDF is extracting the paper title, authors, publication year, and full body text.</p>
                    {selectedFile && (
                      <span className="file-tag">
                        <FileText size={14} />
                        <span>{selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="dropzone-idle">
                    <UploadCloud size={44} className="dropzone-icon" />
                    <h4>Drag and drop research paper PDF here</h4>
                    <p>or click to browse from your computer (max 25MB)</p>
                    <button type="button" className="browse-file-btn" onClick={(e) => { e.stopPropagation(); handleBrowseClick(); }}>
                      Select PDF File
                    </button>
                  </div>
                )}
              </div>

              {/* Error Banner */}
              {error && (
                <div className="alert-banner alert-error" style={{ marginTop: '1rem' }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            /* Success & Extracted Metadata Preview */
            <div className="extracted-preview-card">
              <div className="preview-header">
                <CheckCircle2 size={24} style={{ color: 'var(--accent-success)' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    Paper Successfully Extracted & Saved to Library!
                  </h4>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Extracted with local font-size heuristics and saved to SQLite database.
                  </span>
                </div>
              </div>

              <div className="extracted-meta-box">
                <div className="extracted-field">
                  <span className="field-label">Title</span>
                  <span className="field-value field-title">{extractedPaper.title}</span>
                </div>

                <div className="extracted-field">
                  <span className="field-label">
                    <Users size={14} />
                    <span>Authors</span>
                  </span>
                  <div className="authors-chips">
                    {extractedPaper.authors && extractedPaper.authors.length > 0 ? (
                      extractedPaper.authors.map((a, i) => (
                        <span key={i} className="author-chip">{a}</span>
                      ))
                    ) : (
                      <span className="meta-muted">Unknown Author(s)</span>
                    )}
                  </div>
                </div>

                <div className="extracted-row">
                  <div className="extracted-field">
                    <span className="field-label">
                      <Calendar size={14} />
                      <span>Publication Year</span>
                    </span>
                    <span className="field-value">
                      {extractedPaper.publication_year || 'Year N/A'}
                    </span>
                  </div>

                  <div className="extracted-field">
                    <span className="field-label">Source</span>
                    <span className="source-badge badge-upload">PDF Upload</span>
                  </div>
                </div>

                {extractedPaper.abstract && (
                  <div className="extracted-field">
                    <span className="field-label">Abstract</span>
                    <p className="abstract-snippet">
                      {extractedPaper.abstract.slice(0, 320)}
                      {extractedPaper.abstract.length > 320 ? '...' : ''}
                    </p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="search-submit-btn"
                  onClick={handleClose}
                >
                  <BookOpen size={16} />
                  <span>View in Library</span>
                </button>
                <button
                  type="button"
                  className="browse-file-btn"
                  onClick={() => {
                    setExtractedPaper(null);
                    setSelectedFile(null);
                    setError(null);
                  }}
                >
                  Upload Another Paper
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFUploadModal;
