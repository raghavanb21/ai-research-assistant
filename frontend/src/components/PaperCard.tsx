import React, { useState } from 'react';
import { ExternalLink, Calendar, Users, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Paper } from '../types';

interface PaperCardProps {
  paper: Paper;
  onSave?: (paper: Paper) => void;
  isSaved?: boolean;
}

export const PaperCard: React.FC<PaperCardProps> = ({ paper }) => {
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <article className="paper-card">
      <div className="paper-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`source-badge badge-${paper.source}`}>
            {paper.source === 'openalex' ? 'OpenAlex' : paper.source === 'arxiv' ? 'arXiv' : paper.source}
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
        </div>

        {paper.url ? (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="paper-link-btn"
            title="Open original paper link"
          >
            <span>View Paper</span>
            <ExternalLink size={14} />
          </a>
        ) : (
          <span className="paper-link-disabled" title="No direct paper link available">
            No Link Available
          </span>
        )}
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
    </article>
  );
};

export default PaperCard;
