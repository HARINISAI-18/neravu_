import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, RotateCcw, Sparkles, Trash2, X, ExternalLink, ShieldCheck, Mic, Square, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { usePlatform } from './PlatformContext';
import { translate, useLanguage } from './i18n';
import { languageOptions } from './data';
import { askGuidance, getChatIdentity, isRagConfigured, sendVoiceChat, synthesizeSpeech } from './services';
import { createWavRecorder } from './wavRecorder';

export function openChatAssistant(initialQuestion = '') {
  window.dispatchEvent(new CustomEvent('open-neravu-chat', { detail: { question: initialQuestion } }));
}

export function ChatAssistantWidget() {
  const { data, updateData, user } = usePlatform();
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const languageName = languageOptions.find((option) => option.code === language)?.nativeName || language;

  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chatIdentity, setChatIdentity] = useState('');
  const [conversationId, setConversationId] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [synthesizingId, setSynthesizingId] = useState(null);

  const chatEndRef = useRef(null);
  const requestControllerRef = useRef(null);
  const historyRef = useRef(data.chatHistory || []);
  const history = data.chatHistory || [];
  historyRef.current = history;

  const wavRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const currentAudioRef = useRef(null);

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

  const playAudioMessage = (msgId, base64Audio) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (playingMessageId === msgId) {
      setPlayingMessageId(null);
      return;
    }
    const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
    audio.onended = () => setPlayingMessageId(null);
    audio.onerror = () => setPlayingMessageId(null);
    currentAudioRef.current = audio;
    audio.play().catch(() => setPlayingMessageId(null));
    setPlayingMessageId(msgId);
  };

  const handleTogglePlayback = async (msg) => {
    if (playingMessageId === msg.id) {
      currentAudioRef.current?.pause();
      setPlayingMessageId(null);
      return;
    }
    if (msg.audio_base64) {
      playAudioMessage(msg.id, msg.audio_base64);
      return;
    }
    setSynthesizingId(msg.id);
    try {
      const targetLang = msg.language || language;
      const res = await synthesizeSpeech({ text: msg.content, language: targetLang });
      if (res?.audio_base64) {
        const nextHistory = historyRef.current.map((m) =>
          m.id === msg.id ? { ...m, audio_base64: res.audio_base64 } : m
        );
        historyRef.current = nextHistory;
        updateData({ chatHistory: nextHistory });
        playAudioMessage(msg.id, res.audio_base64);
      }
    } catch {
      setError(t('chat.serviceUnavailable') || 'Failed to synthesize speech.');
    } finally {
      setSynthesizingId(null);
    }
  };

  const sendVoiceQuestion = async (audioBlob) => {
    if (!audioBlob || busy || !chatIdentity) return;
    setError('');
    setQuestion('');

    const currentHistory = historyRef.current;
    const userMsgId = `${Date.now()}-user`;
    let pending = [...currentHistory, { id: userMsgId, role: 'user', content: '🎤 ...', isVoice: true }];
    setBusy(true);

    const assistantId = `${Date.now()}-assistant`;
    pending = [...pending, { id: assistantId, role: 'assistant', content: '', sources: [], audio_base64: null }];
    historyRef.current = pending;
    updateData({ chatHistory: pending });

    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 90000);

    try {
      const result = await sendVoiceChat({
        audioBlob,
        conversationId,
        language: 'auto',
        enableTts: true,
        signal: controller.signal,
      });

      setConversationId(result.conversation_id || null);
      if (conversationStorageKey && result.conversation_id) {
        try {
          sessionStorage.setItem(conversationStorageKey, result.conversation_id);
        } catch {}
      }

      const completedHistory = historyRef.current.map((msg) => {
        if (msg.id === userMsgId) {
          return { ...msg, content: result.transcript ? `🎤 ${result.transcript}` : '🎤 (Voice message)' };
        }
        if (msg.id === assistantId) {
          return {
            ...msg,
            content: result.answer,
            sources: result.sources,
            audio_base64: result.audio_base64,
            language: result.language,
          };
        }
        return msg;
      });
      historyRef.current = completedHistory;
      updateData({ chatHistory: completedHistory });

      if (result.audio_base64) {
        playAudioMessage(assistantId, result.audio_base64);
      }
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

  const startRecording = async () => {
    if (busy) return;
    setError('');
    try {
      const recorder = await createWavRecorder();
      wavRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 30) {
            void stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setError(t('chat.voiceError') || 'Microphone access denied or not supported.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = wavRecorderRef.current;
    wavRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);

    if (recorder) {
      try {
        const wavBlob = await recorder.stop();
        if (wavBlob && wavBlob.size > 0) {
          void sendVoiceQuestion(wavBlob);
        }
      } catch {
        setError('Failed to process recorded audio.');
      }
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = wavRecorderRef.current;
    wavRecorderRef.current = null;
    if (recorder) {
      recorder.cancel();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    return () => {
      currentAudioRef.current?.pause();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (wavRecorderRef.current) {
        wavRecorderRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      currentAudioRef.current?.pause();
      setPlayingMessageId(null);
      if (isRecording) {
        cancelRecording();
      }
    }
  }, [isOpen]);

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
      {pathname !== '/assistant' && <button
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
      </button>}

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

                  {/* Audio Speech Playback (Sarvam Bulbul TTS) */}
                  {msg.role === 'assistant' && msg.content && (
                    <div>
                      <button
                        type="button"
                        className={`voice-playback-btn ${playingMessageId === msg.id ? 'playing' : ''}`}
                        onClick={() => void handleTogglePlayback(msg)}
                        disabled={busy || synthesizingId === msg.id}
                        title={playingMessageId === msg.id ? t('chat.pauseVoice') : t('chat.playVoice')}
                      >
                        {synthesizingId === msg.id ? (
                          <>
                            <Loader2 size={12} className="spin" />
                            <span>{t('chat.voiceProcessing')}</span>
                          </>
                        ) : playingMessageId === msg.id ? (
                          <>
                            <VolumeX size={13} />
                            <span>{t('chat.pauseVoice')}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={13} />
                            <span>{t('chat.playVoice')}</span>
                          </>
                        )}
                      </button>
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
          
          {isRecording ? (
            <div className="recording-status-banner">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="recording-indicator-dot" />
                <strong>{t('chat.voiceRecording')}</strong>
                <span style={{ marginLeft: '8px', fontFamily: 'monospace', fontWeight: 600 }}>
                  {`0:${recordingSeconds.toString().padStart(2, '0')} / 0:30`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={cancelRecording}
                  style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px' }}
                >
                  {t('chat.voiceCancel')}
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={stopRecording}
                  style={{ padding: '4px 10px', fontSize: '11px', minHeight: '28px', backgroundColor: '#dc2626' }}
                >
                  <Square size={11} style={{ marginRight: '4px' }} />
                  {t('chat.voiceSend')}
                </button>
              </div>
            </div>
          ) : (
            <form className="chat-input-row" onSubmit={handleSend} style={{ border: 'none', padding: 0 }}>
              <button
                type="button"
                className="voice-mic-btn"
                onClick={startRecording}
                disabled={busy}
                title={t('chat.voicePrompt')}
                aria-label={t('chat.voicePrompt')}
              >
                <Mic size={17} />
              </button>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('chat.placeholder')}
                disabled={busy}
                style={{ padding: '10px 14px', fontSize: '13px', borderRadius: '10px', flex: 1 }}
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
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <small style={{ fontSize: '10px', color: '#888' }}>
              {t('chat.language', { language: languageName })}
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
