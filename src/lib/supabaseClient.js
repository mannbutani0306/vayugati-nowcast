/**
 * @file supabaseClient.js
 * @description Supabase client initialization for VayuGati Nowcast .
 * Handles persistent authentication sessions and real-time database subscriptions
 * with Row Level Security (RLS) enforcement on PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite runtime environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Fallback configuration flag to allow graceful fallback/simulation when credentials are pending
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

// Initialize Supabase client
// When unconfigured in local dev, provide safe mock target to prevent boot crashes
const effectiveUrl = isSupabaseConfigured ? supabaseUrl : 'https://vayugati-demo.supabase.co';
const effectiveKey = isSupabaseConfigured ? supabaseAnonKey : 'sb-anon-dummy-key-for-local-preview-only';

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
