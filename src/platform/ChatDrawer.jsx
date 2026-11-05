import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Sparkles, Trash2, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { usePlatform } from './PlatformContext';
import { translate, useLanguage } from './i18n';
import { askGuidance, getChatIdentity, isRagConfigured } from './services';

export function openChatAssistant(initialQuestion = '') {
  window.dispatchEvent(new CustomEvent('open-neravu-chat', { detail: { question: initialQuestion } }));
}

export function ChatAssistantWidget() {
  const { data, updateData, user } = usePlatform();
  const { language } = useLanguage();
  const t = (key) => translate(language, key);

  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chatIdentity, setChatIdentity] = useState('');
  const [conversationId, setConversationId] = useState(null);

  const chatEndRef = useRef(null);
  const requestControllerRef = useRef(null);
  const historyRef = useRef(data.chatHistory || []);
  const history = data.chatHistory || [];
  historyRef.current = history;

  const suggestions = [
    'What cancer treatments are covered under PM-JAY?',
    'Are senior citizens 70+ eligible without income limits?',
    'What documents are required to apply for hospital schemes?'
  ];

  const conversationStorageKey = chatIdentity ? `neravu.chat.drawer.${encodeURIComponent(chatIdentity)}` : '';

  // Listen to open event from promo buttons or anywhere across screens
  useEffect(() => {
    const handleOpen = (e) => {
      setIsOpen(true);
      if (e.detail?.question) {
        setQuestion(e.detail.question);
      }
    };
    window.addEventListener('open-neravu-chat', handleOpen);
    return () => window.removeEventListener('open-neravu-chat', handleOpen);
  }, []);

  // Escape key closes drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Initialize identity
  useEffect(() => {
    let active = true;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    getChatIdentity()
      .then((identity) => {
        if (!active) return;
        setChatIdentity(identity);
        try {
          setConversationId(sessionStorage.getItem(`neravu.chat.drawer.${encodeURIComponent(identity)}`));
        } catch {
          setConversationId(null);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [history, busy, isOpen]);

  const sendQuestion = async (text) => {
    const normalized = text.trim();
    if (!normalized || busy || !chatIdentity) return;
    setError('');
    setQuestion('');

    const currentHistory = historyRef.current;
    let pending = [...currentHistory, { id: `${Date.now()}-user`, role: 'user', content: normalized }];
    setBusy(true);

    const assistantId = `${Date.now()}-assistant`;
    pending = [...pending, { id: assistantId, role: 'assistant', content: '', sources: [] }];
    historyRef.current = pending;
    updateData({ chatHistory: pending });

    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 35000);

    try {
      const result = await askGuidance({
        question: normalized,
        language,
        conversationId,
        signal: controller.signal,
        onChunk: (chunk) => {
          const nextHistory = historyRef.current.map((msg) =>
            msg.id === assistantId ? { ...msg, content: `${msg.content}${chunk}` } : msg
          );
          historyRef.current = nextHistory;
          updateData({ chatHistory: nextHistory });
        }
      });

      setConversationId(result.conversation_id || null);
      if (conversationStorageKey && result.conversation_id) {
        try {
          sessionStorage.setItem(conversationStorageKey, result.conversation_id);
        } catch {}
      }

      const completedHistory = historyRef.current.map((msg) =>
        msg.id === assistantId ? { ...msg, content: result.answer, sources: result.sources } : msg
      );
      historyRef.current = completedHistory;
      updateData({ chatHistory: completedHistory });
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Chat service temporarily unavailable.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setBusy(false);
    }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    void sendQuestion(question);
  };

  const clearChat = () => {
    if (busy) return;
    setError('');
    setConversationId(null);
    historyRef.current = [];
    updateData({ chatHistory: [] });
    if (conversationStorageKey) {
      try { sessionStorage.removeItem(conversationStorageKey); } catch {}
    }
  };

  return (
    <>
      {/* Floating Bottom-Right Trigger Button */}
      <button
        type="button"
        className="floating-assistant-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open Neravu Chat Assistant"
        title="Ask Neravu AI Assistant"
      >
        <div className="btn-icon-wrap">
          <Sparkles size={18} />
        </div>
        <span className="assistant-btn-text">Ask Assistant</span>
        <span className="pulse-dot" />
      </button>

      {/* Backdrop */}
      <div
        className={`assistant-drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-over Right Sidebar Drawer (IDE Agent style) */}
      <aside
        className={`assistant-drawer ${isOpen ? 'open' : ''}`}
        aria-label="Neravu AI Assistant"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="assistant-drawer-header">
          <div className="assistant-drawer-title">
            <div className="assistant-avatar" style={{ width: '36px', height: '36px', borderRadius: '10px', margin: 0 }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3>Neravu Assistant</h3>
              <small>Hybrid RAG · Sarvam 105B</small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={clearChat}
              disabled={busy || !history.length}
              title="New Conversation"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close Assistant"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="assistant-drawer-body">
          {!history.length ? (
            <div className="chat-welcome" style={{ margin: 'auto 0' }}>
              <div className="assistant-avatar" style={{ width: '48px', height: '48px', margin: '0 auto 12px' }}>
                <Sparkles size={22} />
              </div>
              <h2 style={{ fontSize: '18px' }}>How can I help you today?</h2>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                Ask about scheme eligibility, evidence requirements, hospitals, or cancer care navigation.
              </p>
              <div className="suggested-questions" style={{ flexDirection: 'column', gap: '8px' }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendQuestion(s)}
                    style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', lineHeight: '1.4' }}
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-history" style={{ padding: 0 }}>
              {history.map((msg) => (
                <article className={`chat-message ${msg.role}`} key={msg.id}>
                  <div className="message-label">
                    {msg.role === 'user' ? 'You' : 'Neravu Assistant'}
                  </div>
                  <p>{msg.content || (busy && msg.role === 'assistant' ? 'Searching official schemes...' : '')}</p>

                  {/* Evidence Sources */}
                  {msg.role === 'assistant' && msg.sources?.length > 0 && (
                    <div className="source-list" style={{ marginTop: '10px' }}>
                      <strong>Official Sources:</strong>
                      {msg.sources.map((src, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {src.url ? (
                            <a href={src.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {src.title} <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span>{src.title}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {busy && (
                <div className="chat-message assistant" role="status" style={{ fontStyle: 'italic', color: '#777' }}>
                  Consulting official knowledge base...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="assistant-drawer-footer">
          {error && <p className="form-error" style={{ marginBottom: '8px', fontSize: '11px' }}>{error}</p>}
          <form className="chat-input-row" onSubmit={handleSend} style={{ border: 'none', padding: 0 }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about schemes, documents, or benefits..."
              disabled={busy}
              style={{ padding: '10px 14px', fontSize: '13px', borderRadius: '10px' }}
            />
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || !question.trim()}
              style={{ minWidth: '44px', padding: '0 12px', borderRadius: '10px' }}
            >
              <ArrowRight size={17} />
            </button>
          </form>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <small style={{ fontSize: '10px', color: '#888' }}>
              Official evidence verified · Language: {language.toUpperCase()}
            </small>
            <small style={{ fontSize: '10px', color: '#888' }}>
              Press Esc to close
            </small>
          </div>
        </div>
      </aside>
    </>
  );
}
