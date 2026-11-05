const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isSecretKey(key) {
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export const supabaseConfigurationIssue = isSecretKey(supabaseAnonKey) ? 'secret_key' : '';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseConfigurationIssue);

const clientPromise = isSupabaseConfigured
  ? import('@supabase/supabase-js').then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }))
  : Promise.resolve(null);

export async function getSupabaseClient() {
  return clientPromise;
}

export const PROGRESS_CONSENT_VERSION = '2026-11-v1';
