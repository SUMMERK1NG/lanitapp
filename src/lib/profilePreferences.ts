import { supabase, isSupabaseConfigured } from './supabase.ts';

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
    const { data, error } = await supabase
      .from('profiles')
      .select('theme_mode, accent_color, last_active_view, keep_session, currency, dashboard_widgets')
      .eq('id', userId)
      .single();

    if (error) {
      // Si la columna no existe aún (código 42703), no bloquear la aplicación
      return null;
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
    const { error } = await supabase
      .from('profiles')
      .update({
        [key]: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      return false;
    }
    return true;
  } catch {
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
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
