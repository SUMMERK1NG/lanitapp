import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.ts';

// Recuperar variables de entorno de Supabase
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Limpiar la URL de Supabase para evitar dobles barras o rutas residuales
const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  let cleaned = url.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
};

export const SUPABASE_URL = sanitizeUrl(rawSupabaseUrl);
export const SUPABASE_ANON_KEY = rawSupabaseAnonKey.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  logger.error('❌ Faltan variables de entorno de Supabase (VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY)');
}

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_ANON_KEY.length > 10
  );
};

/**
 * Cliente singleton de Supabase con inyección explícita de `apikey` en global.headers.
 * Esto previene de raíz el error 400 "No API key found in request" en operaciones PATCH/POST/DELETE.
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
