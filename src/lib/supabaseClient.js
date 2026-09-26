/**
 * @file supabaseClient.js
 * @description Supabase client initialization for VayuGati Nowcast .
 * Handles persistent authentication sessions and real-time database subscriptions
 * with Row Level Security (RLS) enforcement on PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function getConfigurationError() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    const isLocalDevelopment = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== 'https:' && !(isLocalDevelopment && parsedUrl.protocol === 'http:')) {
      return 'Supabase URL must use HTTPS outside local development.';
    }
  } catch {
    return 'VITE_SUPABASE_URL is not a valid URL.';
  }

  if (/placeholder|your-project|dummy|change[-_ ]?me/i.test(supabaseUrl) || /placeholder|your-anon-key|dummy|change[-_ ]?me/i.test(supabaseAnonKey)) {
    return 'Supabase configuration still contains placeholder values.';
  }

  if (!supabaseAnonKey.startsWith('sb_publishable_')) {
    const jwtPayload = supabaseAnonKey.split('.')[1];
    if (!jwtPayload) return 'VITE_SUPABASE_ANON_KEY must be a Supabase publishable/anon key.';
    try {
      const normalizedPayload = jwtPayload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
      const claims = JSON.parse(atob(paddedPayload));
      if (claims.role === 'service_role') return 'A service-role key must never be used in frontend code; configure the Supabase anon key.';
      if (claims.role !== 'anon') return 'VITE_SUPABASE_ANON_KEY must have the anon role.';
    } catch {
      return 'VITE_SUPABASE_ANON_KEY is not a valid Supabase anon key.';
    }
  }

  return null;
}

export const supabaseConfigurationError = getConfigurationError();
export const isSupabaseConfigured = supabaseConfigurationError === null;

// Do not create a fake client: callers must report the unavailable database.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error(supabaseConfigurationError || 'Supabase is unavailable.');
  return supabase;
}

export default supabase;
