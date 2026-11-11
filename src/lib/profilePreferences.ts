import { supabase, isSupabaseConfigured } from './supabase.ts';
import { logger } from '../utils/logger.ts';
import type { UserProfile } from '../types/index.ts';
import { ensureValidUuid } from '../utils/uuid.ts';
import { getActiveUserId } from './supabaseSession.ts';

export interface UserPreferences {
  theme_mode: string;
  accent_color: string;
  last_active_view: string;
  keep_session: boolean;
  currency: string;
  dashboard_widgets?: any;
  welcome_email_sent?: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme_mode: 'navy',
  accent_color: '#147DF0',
  last_active_view: 'dashboard',
  keep_session: false,
  currency: 'USD',
  dashboard_widgets: null,
};

/**
 * Obtener preferencias del usuario desde Supabase profiles
 */
export const getUserPreferences = async (userId: string): Promise<UserPreferences | null> => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return null;
  }

  try {
    let data: any = null;
    const res = await supabase
      .from('profiles')
      .select('theme_mode, accent_color, last_active_view, keep_session, currency, dashboard_widgets')
      .eq('id', userId)
      .maybeSingle();

    if (res.error) {
      // Si el error es de autenticación (401 / JWT expirado), abortar de inmediato sin reintentar
      const isAuthErr =
        res.error.code === 'PGRST301' ||
        res.error.message?.toLowerCase().includes('jwt') ||
        res.error.message?.toLowerCase().includes('unauthorized') ||
        res.status === 401;

      if (isAuthErr) {
        return null;
      }

      // Solo si la columna dashboard_widgets no existe aún en la tabla (42703/PGRST204), reintentar con las columnas previas
      if (res.error.code === '42703' || res.error.code === 'PGRST204' || res.error.message?.toLowerCase().includes('column')) {
        const fallbackRes = await supabase
          .from('profiles')
          .select('theme_mode, accent_color, last_active_view, keep_session, currency')
          .eq('id', userId)
          .maybeSingle();

        if (fallbackRes.error) {
          const minimalRes = await supabase
            .from('profiles')
            .select('currency')
            .eq('id', userId)
            .maybeSingle();
          data = minimalRes.data;
        } else {
          data = fallbackRes.data;
        }
      } else {
        return null;
      }
    } else {
      data = res.data;
    }

    if (!data) return null;

    return {
      theme_mode: data.theme_mode || DEFAULT_PREFERENCES.theme_mode,
      accent_color: data.accent_color || DEFAULT_PREFERENCES.accent_color,
      last_active_view: data.last_active_view || DEFAULT_PREFERENCES.last_active_view,
      keep_session: data.keep_session ?? DEFAULT_PREFERENCES.keep_session,
      currency: data.currency || DEFAULT_PREFERENCES.currency,
      dashboard_widgets: data.dashboard_widgets ?? DEFAULT_PREFERENCES.dashboard_widgets,
    };
  } catch {
    return null;
  }
};

/**
 * Actualizar una preferencia específica en la tabla profiles
 */
export const updatePreference = async (
  userId: string,
  key: keyof UserPreferences,
  value: any
): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return false;
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('[UPDATE ERROR] No hay usuario autenticado para actualizar preferencia:', key);
      return false;
    }

    const targetId = user.id || userId;
    logger.dev('[UPDATE] Usuario:', targetId, 'Tabla: profiles', 'Datos:', { [key]: value });

    const { error } = await supabase
      .from('profiles')
      .update({
        [key]: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    if (error) {
      logger.error('[UPDATE ERROR] Falló updatePreference en profiles:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[UPDATE ERROR] Excepción en updatePreference:', err);
    return false;
  }
};

/**
 * Actualizar múltiples preferencias a la vez
 */
export const updatePreferences = async (
  userId: string,
  updates: Partial<UserPreferences>
): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return false;
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error('[UPDATE ERROR] No hay usuario autenticado para actualizar preferencias');
      return false;
    }

    const { id: _forbiddenId, created_at: _forbiddenCreated, ...cleanUpdates } = updates as any;
    const targetId = user.id || userId;

    logger.dev('[UPDATE] Usuario:', targetId, 'Tabla: profiles', 'Datos:', cleanUpdates);

    const { error } = await supabase
      .from('profiles')
      .update({
        ...cleanUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    if (error) {
      logger.error('[UPDATE ERROR] Falló updatePreferences en profiles:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[UPDATE ERROR] Excepción en updatePreferences:', err);
    return false;
  }
};

/**
 * Fusiona campos específicos dentro de profiles.dashboard_widgets (jsonb) en Supabase.
 */
export const patchDashboardWidgets = async (
  userId: string,
  patch: Record<string, any>
): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase || !userId) return false;
  try {
    const { data: current } = await supabase
      .from('profiles')
      .select('dashboard_widgets')
      .eq('id', userId)
      .maybeSingle();

    const baseObj =
      current?.dashboard_widgets &&
      typeof current.dashboard_widgets === 'object' &&
      !Array.isArray(current.dashboard_widgets)
        ? current.dashboard_widgets
        : {};

    const merged = { ...baseObj, ...patch };
    return await updatePreference(userId, 'dashboard_widgets', merged);
  } catch (err) {
    logger.warn('patchDashboardWidgets notice:', err);
    return false;
  }
};

/**
 * Sincroniza/guarda el perfil del usuario directamente en Supabase profiles.
 */
export async function saveUserProfile(
  profile: Partial<UserProfile> & { name: string }
): Promise<UserProfile> {
  const id = ensureValidUuid(profile.id || getActiveUserId());
  const role = profile.role || 'user';
  const record: UserProfile = {
    id,
    email: profile.email,
    cedula: profile.cedula,
    first_name: profile.first_name,
    last_name: profile.last_name,
    name: profile.name,
    avatar: profile.avatar || '👤',
    avatar_url: profile.avatar_url || profile.avatar || '👤',
    role,
    is_active: profile.is_active !== undefined ? profile.is_active : true,
    currency: profile.currency || 'USD',
    theme_mode: profile.theme_mode || 'navy',
    accent_color: profile.accent_color || '#147DF0',
    last_active_view: profile.last_active_view,
    keep_session: profile.keep_session,
    welcome_email_sent: profile.welcome_email_sent,
    sync_status: 'synced',
    created_at: profile.created_at || new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const profilePayload: Record<string, any> = {
        id,
        email: record.email || `${id}@lanitapp.local`,
        cedula: record.cedula || '',
        first_name: record.first_name || record.name?.split(' ')[0] || '',
        last_name: record.last_name || record.name?.split(' ').slice(1).join(' ') || '',
        role: record.role || 'user',
        avatar: record.avatar || '👑',
        avatar_url: record.avatar_url || record.avatar || '👑',
        theme_mode: record.theme_mode || 'navy',
        accent_color: record.accent_color || '#147DF0',
        currency: record.currency || 'USD',
        updated_at: new Date().toISOString(),
      };
      if (record.last_active_view !== undefined) profilePayload.last_active_view = record.last_active_view;
      if (record.keep_session !== undefined) profilePayload.keep_session = record.keep_session;
      if (record.welcome_email_sent !== undefined) profilePayload.welcome_email_sent = record.welcome_email_sent;

      const { error } = await supabase.from('profiles').upsert(profilePayload);
      if (error) {
        logger.warn('[Supabase Profiles Upsert Warning]:', error.message);
      }
    } catch (e) {
      logger.warn('Profile direct upsert notice:', e);
    }
  }

  return record;
}
