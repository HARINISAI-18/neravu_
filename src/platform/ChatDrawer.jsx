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

  const suggestions = ['chat.suggestion.1', 'chat.suggestion.2', 'chat.suggestion.3'].map(t);

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
    const timeoutId = window.setTimeout(() => controller.abort(), 90000);

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
      const failureNotice = controller.signal.aborted
        ? t('chat.requestTimeout')
        : (caught instanceof Error ? caught.message : t('chat.serviceUnavailable'));
      setError(failureNotice);
      const failedHistory = historyRef.current.map((msg) =>
        msg.id === assistantId ? { ...msg, content: failureNotice } : msg
      );
      historyRef.current = failedHistory;
      updateData({ chatHistory: failedHistory });
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
        aria-label={t('chat.open')}
        title={t('chat.open')}
      >
        <div className="btn-icon-wrap">
          <Sparkles size={18} />
        </div>
        <span className="assistant-btn-text">{t('chat.askAssistant')}</span>
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
        aria-label={t('chat.title')}
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
              <h3>{t('chat.title')}</h3>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={clearChat}
              disabled={busy || !history.length}
              title={t('chat.newConversation')}
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label={t('chat.close')}
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
              <h2 style={{ fontSize: '18px' }}>{t('chat.welcome')}</h2>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                {t('chat.description')}
              </p>
              <div className="suggested-questions" style={{ flexDirection: 'column', gap: '8px' }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendQuestion(s)}
                    style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', lineHeight: '1.4' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-history" style={{ padding: 0 }}>
              {history.map((msg) => (
                <article className={`chat-message ${msg.role}`} key={msg.id}>
                  <div className="message-label">
                    {msg.role === 'user' ? t('chat.you') : t('chat.title')}
                  </div>
                  {msg.content ? (
                    <div className="chat-body-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div className="chat-searching-indicator">
                      <span className="dot dot-1" />
                      <span className="dot dot-2" />
                      <span className="dot dot-3" />
                      <span style={{ marginLeft: 8, fontSize: '12px', color: '#6b7280' }}>
                        {t('chat.verifying')}
                      </span>
                    </div>
                  )}

                  {/* Evidence Sources */}
                  {msg.role === 'assistant' && msg.sources?.length > 0 && (
                    <div className="source-list" style={{ marginTop: '10px' }}>
                      <strong>{t('chat.sources')}</strong>
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
              placeholder={t('chat.placeholder')}
              disabled={busy}
              style={{ padding: '10px 14px', fontSize: '13px', borderRadius: '10px' }}
            />
            <button
              type="submit"
              className="button button-primary"
              aria-label={t('chat.send')}
              disabled={busy || !question.trim()}
              style={{ minWidth: '44px', padding: '0 12px', borderRadius: '10px' }}
            >
              <ArrowRight size={17} />
            </button>
          </form>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <small style={{ fontSize: '10px', color: '#888' }}>
              {t('chat.language', { language: language.toUpperCase() })}
            </small>
            <small style={{ fontSize: '10px', color: '#888' }}>
              {t('chat.closeHint')}
            </small>
          </div>
        </div>
      </aside>
    </>
  );
}
