import { getSupabaseClient, isSupabaseConfigured, supabaseConfigurationIssue } from './supabase';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
let guestSession;

/**
 * Fetch wrapper that automatically retries when the server is waking up
 * (Render free tier cold start returns 502/503/504 or network drops).
 */
export async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 502 && response.status <= 504 && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoff * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoff * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

/** Pre-warm the backend container so cold start latency doesn't hit user actions */
export function warmupBackend() {
  if (apiBaseUrl) {
    fetch(`${apiBaseUrl}/health`, { method: 'GET' }).catch(() => {});
  }
}

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
    guestSession = fetchWithRetry(`${apiBaseUrl}/api/guest-session`, {
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

  const response = await fetchWithRetry(`${apiBaseUrl}/api/chat`, {
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

export async function transcribeVoiceAudio({ audioBlob, language = 'auto', signal }) {
  const session = await authService.getSession();
  const headers = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    const guest = await getGuestSession();
    headers['X-Guest-Session'] = guest.session_token;
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.wav');
  if (language) formData.append('language', language);

  const response = await fetchWithRetry(`${apiBaseUrl}/api/voice/transcribe`, {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.detail || `Transcription failed with status ${response.status}.`);
  }

  return response.json();
}

export async function sendVoiceChat({
  audioBlob,
  conversationId = null,
  language = 'auto',
  enableTts = true,
  schemeId = null,
  patientFacts = null,
  signal,
}) {
  const session = await authService.getSession();
  const headers = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    const guest = await getGuestSession();
    headers['X-Guest-Session'] = guest.session_token;
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.wav');
  if (conversationId) formData.append('conversation_id', conversationId);
  if (language) formData.append('language', language);
  formData.append('enable_tts', String(enableTts));
  if (schemeId) formData.append('scheme_id', schemeId);
  if (patientFacts) formData.append('patient_facts_json', JSON.stringify(patientFacts));

  const response = await fetchWithRetry(`${apiBaseUrl}/api/voice/chat`, {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.detail || `Voice service returned error ${response.status}.`);
  }

  const result = await response.json();
  return {
    ...result,
    transcript: result.transcript || '',
    answer: (result.answer || '').trim(),
    audio_base64: result.audio_base64 || null,
    sources: normalizeSources(result.sources),
  };
}

export async function synthesizeSpeech({ text, language = 'en', signal }) {
  const session = await authService.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    const guest = await getGuestSession();
    headers['X-Guest-Session'] = guest.session_token;
  }

  const response = await fetchWithRetry(`${apiBaseUrl}/api/voice/synthesize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, language }),
    signal,
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.detail || `Speech synthesis failed with status ${response.status}.`);
  }

  return response.json();
}

export const isRagConfigured = true;

export async function getAuthHeaders() {
  const session = await authService.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export async function fetchHealth() {
  const res = await fetchWithRetry(`${apiBaseUrl}/api/health`);
  return res.json();
}

export async function fetchSchemes() {
  const res = await fetchWithRetry(`${apiBaseUrl}/api/schemes`);
  if (!res.ok) throw new Error(`Failed to fetch schemes: ${res.statusText}`);
  return res.json();
}

export async function fetchSchemeDetail(schemeId) {
  const res = await fetchWithRetry(`${apiBaseUrl}/api/schemes/${schemeId}`);
  if (!res.ok) throw new Error(`Failed to fetch scheme detail: ${res.statusText}`);
  return res.json();
}

export async function fetchSchemeJourney(schemeId) {
  const res = await fetchWithRetry(`${apiBaseUrl}/api/schemes/${schemeId}/journey`);
  if (!res.ok) throw new Error(`Failed to fetch scheme journey: ${res.statusText}`);
  return res.json();
}

export async function evaluateEligibility(schemeId, patientFacts) {
  const res = await fetch(`${apiBaseUrl}/api/schemes/${schemeId}/eligibility/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_facts: patientFacts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to evaluate eligibility: ${res.statusText}`);
  }
  return res.json();
}

export async function checkDocuments(schemeId, patientFacts = {}, documents = []) {
  const res = await fetch(`${apiBaseUrl}/api/schemes/${schemeId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_facts: patientFacts, documents }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to check documents: ${res.statusText}`);
  }
  return res.json();
}

// Privileged Admin Endpoints
export async function fetchAdminSchemes(limit = 100, offset = 0, token = null) {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes?limit=${limit}&offset=${offset}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Admin fetch schemes failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAdminScheme(schemeId, token = null) {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Admin fetch failed: ${res.statusText}`);
  }
  return res.json();
}

export async function createAdminScheme(payload, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authH },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Create scheme failed: ${res.statusText}`);
  }
  return res.json();
}

export async function updateAdminScheme(schemeId, payload, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authH },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Update scheme failed: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteAdminScheme(schemeId, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}`, {
    method: 'DELETE',
    headers: { ...authH },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Delete scheme failed: ${res.statusText}`);
  }
  return true;
}

export async function fetchAdminSources(schemeId, token = null) {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/sources`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Fetch sources failed: ${res.statusText}`);
  }
  return res.json();
}

export async function addEvidence(schemeId, payload, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authH },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Add evidence failed: ${res.statusText}`);
  }
  return res.json();
}

export async function reviewAdminSource(schemeId, sourceId, decision = 'approved', reason = null, reviewExpiresAt = '2028-12-31', token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/sources/${sourceId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authH },
    body: JSON.stringify({
      decision,
      reason,
      review_expires_at: decision === 'approved' ? reviewExpiresAt : null
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Review source failed: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteAdminSource(schemeId, sourceId, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/sources/${sourceId}`, {
    method: 'DELETE',
    headers: { ...authH },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Delete source failed: ${res.statusText}`);
  }
  return true;
}

export async function fetchAdminClaims(schemeId, token = null) {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/claims`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Fetch claims failed: ${res.statusText}`);
  }
  return res.json();
}

export async function createAdminClaim(schemeId, payload, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authH },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Create claim failed: ${res.statusText}`);
  }
  return res.json();
}

export async function reviewAdminClaim(schemeId, claimId, decision = 'approved', reason = null, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/claims/${claimId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authH },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Review claim failed: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteAdminClaim(schemeId, claimId, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/claims/${claimId}`, {
    method: 'DELETE',
    headers: { ...authH },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Delete claim failed: ${res.statusText}`);
  }
  return true;
}

export async function publishScheme(schemeId, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/publish`, {
    method: 'POST',
    headers: { ...authH },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Publish scheme failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAdminSyncStatus(schemeId, token = null) {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/sync`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Fetch sync status failed: ${res.statusText}`);
  }
  return res.json();
}

export async function retryAdminSync(schemeId, token = null) {
  const authH = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/sync/retry`, {
    method: 'POST',
    headers: { ...authH },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Retry sync failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAdminSchemeHistory(schemeId, limit = 50, token = null) {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${apiBaseUrl}/api/admin/schemes/${schemeId}/history?limit=${limit}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Fetch scheme history failed: ${res.statusText}`);
  }
  return res.json();
}


export async function fetchDirectoryNgos(params = {}) {
  const query = new URLSearchParams();
  if (params.state) query.append('state', params.state);
  if (params.supportType) query.append('support_type', params.supportType);
  if (params.directAid) query.append('direct_aid', params.directAid);
  if (params.search) query.append('search', params.search);
  const res = await fetch(`${apiBaseUrl}/api/directory/ngos?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch NGOs: ${res.statusText}`);
  return res.json();
}

export async function fetchDirectorySchemes(params = {}) {
  const query = new URLSearchParams();
  if (params.level) query.append('level', params.level);
  if (params.state) query.append('state', params.state);
  if (params.search) query.append('search', params.search);
  const res = await fetch(`${apiBaseUrl}/api/directory/schemes?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch directory schemes: ${res.statusText}`);
  return res.json();
}

export async function fetchDirectoryStates() {
  const res = await fetch(`${apiBaseUrl}/api/directory/states`);
  if (!res.ok) throw new Error(`Failed to fetch states: ${res.statusText}`);
  return res.json();
}

export async function fetchDirectoryTaxonomies() {
  const res = await fetch(`${apiBaseUrl}/api/directory/taxonomies`);
  if (!res.ok) throw new Error(`Failed to fetch taxonomies: ${res.statusText}`);
  return res.json();
}
