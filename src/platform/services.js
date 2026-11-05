import { getSupabaseClient, isSupabaseConfigured, supabaseConfigurationIssue } from './supabase';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
let guestSession;

export const authService = {
  get mode() {
    return isSupabaseConfigured ? 'supabase' : 'demo';
  },
  async signIn(email, password) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signUp(email, password, displayName, redirectTo) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: redirectTo || `${window.location.origin}/login`
      }
    });
    if (error) throw error;
    return data;
  },
  async signInWithGoogle(redirectTo) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) throw error;
    return data;
  },
  async sendPhoneCode(phone, shouldCreateUser) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser }
    });
    if (error) throw error;
    return data;
  },
  async verifyPhoneCode(phone, token) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
    return data;
  },
  async sendPasswordReset(email, redirectTo) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },
  async updatePassword(password) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return data;
  },
  async signOut() {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  async getSession() {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
  async onAuthStateChange(callback) {
    const supabase = await getSupabaseClient();
    if (!supabase) return { unsubscribe() {} };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => callback(session), 0);
    });
    return data.subscription;
  },
  async getProgressConsent(userId) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, progress_consent_version')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },
  async grantProgressConsent(userId) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user.id !== userId) throw new Error('The active session does not match this account.');
    const { error } = await supabase.rpc('grant_progress_consent');
    if (error) throw error;
  },
  async getProgress(userId) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase
      .from('patient_progress')
      .select('progress, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async saveProgress(userId, progress) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase
      .from('patient_progress')
      .upsert({ user_id: userId, progress }, { onConflict: 'user_id' });
    if (error) throw error;
  },
  async deleteProgress(userId) {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.from('patient_progress').delete().eq('user_id', userId);
    if (error) throw error;
  }
};

export { isSupabaseConfigured, supabaseConfigurationIssue };

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((source) => {
    if (typeof source === 'string') return [{ title: source, url: '' }];
    if (!source || typeof source !== 'object') return [];
    const title = source.title || source.name || source.source || '';
    const rawUrl = source.url || source.href || '';
    let url = '';
    if (typeof rawUrl === 'string' && rawUrl) {
      try {
        const parsedUrl = new URL(rawUrl);
        if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') url = parsedUrl.href;
      } catch {
        url = '';
      }
    }
    return typeof title === 'string' && title.trim() ? [{ title: title.trim(), url }] : [];
  });
}

async function getGuestSession() {
  if (!guestSession) {
    guestSession = fetch(`${apiBaseUrl}/api/guest-session`, {
      method: 'POST',
      headers: { Accept: 'application/json' }
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.session_token || !result.user_id) {
        throw new Error(result.detail || 'Could not start a guest chat session.');
      }
      return result;
    }).catch((error) => {
      guestSession = null;
      throw error;
    });
  }
  return guestSession;
}

export async function getChatIdentity() {
  const session = await authService.getSession();
  if (session?.user.id) return session.user.id;
  const guest = await getGuestSession();
  return guest.user_id;
}

function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
  const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    throw new Error('The chat service returned an invalid streaming response.');
  }
}

export async function askGuidance({ question, language, conversationId = null, signal, onChunk, stream = true }) {
  const session = await authService.getSession();
  const headers = { 'Content-Type': 'application/json', Accept: stream ? 'text/event-stream' : 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    const guest = await getGuestSession();
    headers['X-Guest-Session'] = guest.session_token;
  }

  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: question, conversation_id: conversationId, language, stream }),
    signal
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.detail || `Chat service returned ${response.status}.`);
  }

  if (!stream) {
    const result = await response.json();
    if (typeof result?.answer !== 'string' || !result.answer.trim()) {
      throw new Error('The chat service returned no answer.');
    }
    return { ...result, answer: result.answer.trim(), sources: normalizeSources(result.sources) };
  }

  if (!response.body) throw new Error('The chat service did not return a readable response stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult;
  const consume = (frame) => {
    const parsed = parseSseFrame(frame);
    if (!parsed) return;
    if (parsed.event === 'delta') {
      if (typeof parsed.data.text === 'string') onChunk?.(parsed.data.text);
      return;
    }
    if (parsed.event === 'error') throw new Error(parsed.data.message || 'The chat service could not complete this request.');
    if (parsed.event === 'done') finalResult = parsed.data;
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';
    frames.forEach(consume);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!finalResult || typeof finalResult.answer !== 'string' || !finalResult.answer.trim()) {
    throw new Error('The chat service ended without a final answer.');
  }
  return { ...finalResult, sources: normalizeSources(finalResult.sources) };
}

export const isRagConfigured = true;
