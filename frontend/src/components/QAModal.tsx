import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  Trash2,
  Copy,
  Check,
  Sparkles,
  User,
  BrainCircuit,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Lightbulb
} from 'lucide-react';

import { Paper, QAMessage } from '../types';
import { askPaperQuestion, getPaperQAHistory, clearPaperQAHistory } from '../services/api';

interface QAModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSummary?: (paper: Paper) => void;
}

const SUGGESTED_QUESTIONS = [
  'What problem does this paper address?',
  'What is the main idea of the proposed approach?',
  'What datasets are used?',
  'What are the major limitations?',
  'How does this method compare with the baselines?'
];

export const QAModal: React.FC<QAModalProps> = ({
  paper,
  isOpen,
  onClose,
  onOpenSummary
}) => {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [question, setQuestion] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = useCallback(async () => {
    if (!paper || !paper.id) return;
    setLoadingHistory(true);
    setError(null);
    try {
      const history = await getPaperQAHistory(paper.id);
      setMessages(history.messages || []);
    } catch (err: any) {
      console.error('Failed to load QA history:', err);
      // If 404, just start fresh
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [paper]);

  useEffect(() => {
    if (isOpen && paper && paper.id) {
      setMessages([]);
      setQuestion('');
      setError(null);
      setShowClearConfirm(false);
      fetchHistory();
    }
  }, [isOpen, paper, fetchHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  if (!isOpen || !paper) return null;

  const handleSendQuestion = async (customQuestion?: string) => {
    const q = (customQuestion || question).trim();
    if (!q || !paper.id || sending) return;

    setError(null);
    setSending(true);
    if (!customQuestion) {
      setQuestion('');
    }

    // Optimistically append user message
    const tempUserMsg: QAMessage = {
      paper_id: paper.id,
      role: 'user',
      message: q,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const assistantMsg = await askPaperQuestion(paper.id, q);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Q&A error:', err);
      setError(err.message || 'Failed to get answer from AI.');
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion();
    }
  };

  const handleClearHistory = async () => {
    if (!paper.id) return;
    try {
      await clearPaperQAHistory(paper.id);
      setMessages([]);
      setShowClearConfirm(false);
    } catch (err: any) {
      console.error('Failed to clear history:', err);
      setError(err.message || 'Failed to clear chat history.');
    }
  };

  const handleCopyMessage = (msg: QAMessage, index: number) => {
    const idKey = msg.id || index;
    navigator.clipboard.writeText(msg.message).then(() => {
      setCopiedId(idKey);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const hasFullText = Boolean(paper.full_text && paper.full_text.length > 100);

  // Helper to render markdown formatting inside messages
  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} style={{ height: '0.5rem' }} />;
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="qa-section-heading">
            {trimmed.replace('### ', '')}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="qa-main-heading">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const bulletContent = trimmed.replace(/^[\*\-]\s+/, '');
        return (
          <div key={idx} className="qa-bullet-item">
            <span className="bullet-dot">&bull;</span>
            <span>{renderInlineFormatting(bulletContent)}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
        return (
          <div key={idx} className="qa-numbered-item">
            <span className="number-label">{numMatch ? numMatch[1] : '1.'}</span>
            <span>{renderInlineFormatting(numMatch ? numMatch[2] : trimmed)}</span>
          </div>
        );
      }
      return (
        <p key={idx} className="qa-paragraph">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });
  };

  const renderInlineFormatting = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{ color: 'inherit', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container qa-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            <div className="modal-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <MessageSquare size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 className="modal-title">Paper Q&A Assistant</h2>
                <span className="source-badge badge-meta" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--accent-success)' }}>
                  <BrainCircuit size={12} style={{ marginRight: 4 }} />
                  {hasFullText ? 'Grounded in Full PDF Text' : 'Grounded in Academic Abstract'}
                </span>
              </div>
              <p className="modal-subtitle" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                Ask natural-language questions grounded strictly in "{paper.title}"
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {messages.length > 0 && !showClearConfirm && (
              <button
                type="button"
                className="clear-chat-btn"
                onClick={() => setShowClearConfirm(true)}
                title="Clear Q&A history for this paper"
              >
                <Trash2 size={15} />
                <span>Clear History</span>
              </button>
            )}

            {showClearConfirm && (
              <div className="clear-confirm-pill">
                <span>Clear all messages?</span>
                <button type="button" className="confirm-yes" onClick={handleClearHistory}>Yes</button>
                <button type="button" className="confirm-no" onClick={() => setShowClearConfirm(false)}>No</button>
              </div>
            )}

            <button type="button" className="modal-close-btn" onClick={onClose} title="Close Q&A">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Suggested Question Chips Toolbar */}
        <div className="qa-suggested-bar">
          <div className="suggested-label">
            <Lightbulb size={13} style={{ color: '#f59e0b' }} />
            <span>Suggested Questions:</span>
          </div>
          <div className="suggested-chips-scroll">
            {SUGGESTED_QUESTIONS.map((sug, i) => (
              <button
                key={i}
                type="button"
                className="suggested-chip"
                onClick={() => handleSendQuestion(sug)}
                disabled={sending}
                title={`Ask: "${sug}"`}
              >
                <span>{sug}</span>
                <ArrowRight size={12} className="chip-arrow" />
              </button>
            ))}
          </div>
        </div>

        {/* Messages Body */}
        <div className="modal-body qa-modal-body">
          {/* Loading History State */}
          {loadingHistory && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', color: 'var(--text-muted)', gap: '0.5rem' }}>
              <Loader2 size={20} className="spinner" />
              <span>Loading conversation history...</span>
            </div>
          )}

          {/* Empty Conversation State */}
          {!loadingHistory && messages.length === 0 && (
            <div className="qa-empty-state">
              <div className="qa-empty-icon">
                <HelpCircle size={40} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h3>Ask Anything About This Paper</h3>
              <p>
                The AI assistant analyzes the paper's actual content with strict anti-hallucination guardrails.
                Click any suggestion above or type your own question below.
              </p>
              <div className="qa-prompt-showcase">
                <div className="prompt-card" onClick={() => handleSendQuestion('What problem does this paper address?')}>
                  <strong>Problem Formulation</strong>
                  <span>"What problem does this paper address?"</span>
                </div>
                <div className="prompt-card" onClick={() => handleSendQuestion('What is the main idea of the proposed approach?')}>
                  <strong>Core Approach</strong>
                  <span>"What is the main idea of the proposed approach?"</span>
                </div>
                <div className="prompt-card" onClick={() => handleSendQuestion('What datasets are used?')}>
                  <strong>Datasets & Benchmarks</strong>
                  <span>"What datasets are used?"</span>
                </div>
                <div className="prompt-card" onClick={() => handleSendQuestion('What are the major limitations?')}>
                  <strong>Limitations & Future Work</strong>
                  <span>"What are the major limitations?"</span>
                </div>
                <div className="prompt-card" onClick={() => handleSendQuestion('How does this method compare with the baselines?')}>
                  <strong>Baseline Comparison</strong>
                  <span>"How does this method compare with the baselines?"</span>
                </div>
              </div>
            </div>
          )}

          {/* Message List */}
          {!loadingHistory && messages.length > 0 && (
            <div className="qa-messages-list">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const msgIdKey = msg.id || index;
                const isCopied = copiedId === msgIdKey;

                return (
                  <div key={index} className={`qa-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                    <div className="qa-avatar">
                      {isUser ? <User size={16} /> : <Sparkles size={16} />}
                    </div>

                    <div className="qa-bubble">
                      <div className="qa-bubble-header">
                        <span className="qa-bubble-author">{isUser ? 'You' : 'AI Assistant'}</span>
                        {!isUser && msg.context_used && (
                          <span className="qa-model-pill">
                            {msg.context_used.includes('gemini') ? 'Gemini 3.5' : 'Grounded'}
                          </span>
                        )}
                        {!isUser && (
                          <button
                            type="button"
                            className="qa-copy-btn"
                            onClick={() => handleCopyMessage(msg, index)}
                            title="Copy answer"
                          >
                            {isCopied ? <Check size={13} style={{ color: 'var(--accent-success)' }} /> : <Copy size={13} />}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>

                      <div className="qa-bubble-content">
                        {isUser ? (
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                        ) : (
                          renderMessageContent(msg.message)
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Sending Indicator */}
              {sending && (
                <div className="qa-message-row assistant-row">
                  <div className="qa-avatar">
                    <Sparkles size={16} />
                  </div>
                  <div className="qa-bubble sending-bubble">
                    <div className="thinking-dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                    <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      Analyzing paper content & reasoning...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="alert-banner alert-error" style={{ margin: '0.75rem 0' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="qa-modal-footer">
          <div className="qa-input-wrapper">
            <textarea
              ref={textareaRef}
              className="qa-textarea"
              placeholder="Ask a question about this paper (e.g. datasets, approach, limitations)... [Enter to send]"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button
              type="button"
              className="qa-send-btn"
              onClick={() => handleSendQuestion()}
              disabled={!question.trim() || sending}
              title="Send question (Enter)"
            >
              {sending ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
            </button>
          </div>

          <div className="qa-footer-meta">
            <span className="qa-grounding-hint">
              <BrainCircuit size={13} />
              <span>Answers are strictly grounded in paper text and abstract with anti-hallucination guardrails.</span>
            </span>
            {onOpenSummary && (
              <button
                type="button"
                className="view-summary-link-btn"
                onClick={() => {
                  onClose();
                  onOpenSummary(paper);
                }}
              >
                <BookOpen size={14} />
                <span>View Full Summary</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QAModal;
