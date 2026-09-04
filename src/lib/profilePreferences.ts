import { supabase, isSupabaseConfigured } from './supabase.ts';
import { logger } from '../utils/logger.ts';

export interface UserPreferences {
  theme_mode: string;
  accent_color: string;
  last_active_view: string;
  keep_session: boolean;
  currency: string;
  dashboard_widgets?: any;
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
