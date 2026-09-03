import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.ts';

// Retrieve environment variables
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Clean the Supabase URL (remove /rest/v1/ or trailing slashes if present)
const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  let cleaned = url.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
};

export const SUPABASE_URL = sanitizeUrl(rawSupabaseUrl);
export const SUPABASE_ANON_KEY = rawSupabaseAnonKey.trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_ANON_KEY.length > 10
  );
};

// Singleton Supabase client instance
let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to initialize Supabase client:', error);
  }
}

export const supabase = supabaseInstance;
