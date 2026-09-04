import { useState, useEffect, useCallback } from 'react';
import type { ThemeMode, AccentColor } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { getUserPreferences, updatePreference } from '../lib/profilePreferences.ts';
import { logger } from '../utils/logger.ts';

export const THEME_MODE_OPTIONS: { id: ThemeMode; name: string; icon: string; desc: string; previewBg: string; borderSample: string }[] = [
  { id: 'navy', name: 'Azul Marino Profundo', icon: '🌊', desc: 'Fondo Navy #0B132B', previewBg: '#0B132B', borderSample: '#203657' },
  { id: 'dark', name: 'Oscuro Medianoche', icon: '🌑', desc: 'OLED Puro #080C14', previewBg: '#080C14', borderSample: '#111726' },
  { id: 'emerald', name: 'Bosque Esmeralda', icon: '🌲', desc: 'Cyber Forest #051813', previewBg: '#051813', borderSample: '#0E2A22' },
  { id: 'purple', name: 'Nebulosa Violeta', icon: '🌌', desc: 'Cyber Violet #12091F', previewBg: '#12091F', borderSample: '#24143D' },
  { id: 'moca', name: 'Café Moca Cálido', icon: '☕', desc: 'Dark Moca #17120E', previewBg: '#17120E', borderSample: '#2C211B' },
  { id: 'light', name: 'Fondo Claro', icon: '☀️', desc: 'Alto Contraste #F8FAFC', previewBg: '#F8FAFC', borderSample: '#E2E8F0' },
];

export const ACCENT_COLOR_OPTIONS: { name: string; color: AccentColor; bgClass: string }[] = [
  { name: 'Azul', color: '#147DF0', bgClass: 'bg-[#147DF0]' },
  { name: 'Turquesa', color: '#00C2C7', bgClass: 'bg-[#00C2C7]' },
  { name: 'Naranja', color: '#FF914D', bgClass: 'bg-[#FF914D]' },
  { name: 'Rosa', color: '#EC4899', bgClass: 'bg-[#EC4899]' },
  { name: 'Morado', color: '#8B5CF6', bgClass: 'bg-[#8B5CF6]' },
  { name: 'Verde', color: '#10B981', bgClass: 'bg-[#10B981]' },
  { name: 'Oro Ámbar', color: '#F59E0B', bgClass: 'bg-[#F59E0B]' },
  { name: 'Rojo Coral', color: '#EF4444', bgClass: 'bg-[#EF4444]' },
  { name: 'Cian Hielo', color: '#06B6D4', bgClass: 'bg-[#06B6D4]' },
  { name: 'Menta', color: '#14B8A6', bgClass: 'bg-[#14B8A6]' },
];

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('lanitapp_theme_mode') as ThemeMode) || 'navy';
    }
    return 'navy';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('lanitapp_accent_color') as AccentColor) || '#147DF0';
    }
    return '#147DF0';
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyTheme = (mode: ThemeMode, color: AccentColor) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // Remover clases previas
    root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
    root.classList.add(`theme-${mode}`);

    // Variables dinámicas de acento
    root.style.setProperty('--primary', color);
    root.style.setProperty('--primary-custom', color);

    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
  };

  // Cargar preferencias desde Supabase al montar
  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        if (isSupabaseConfigured() && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user;
          const expiresAt = session?.expires_at || 0;
          const isExpired = expiresAt && expiresAt < Math.floor(Date.now() / 1000);

          if (user && !isExpired && isMounted) {
            const prefs = await getUserPreferences(user.id);
            if (prefs && isMounted) {
              if (prefs.theme_mode) {
                setThemeModeState(prefs.theme_mode as ThemeMode);
              }
              if (prefs.accent_color) {
                setAccentColorState(prefs.accent_color as AccentColor);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error cargando preferencias de tema desde Supabase:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  // Aplicar cambios al DOM cada vez que cambian themeMode o accentColor
  useEffect(() => {
    applyTheme(themeMode, accentColor);
  }, [themeMode, accentColor]);

  // Actualizar tema con sincronización a Supabase y caché de respaldo
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);

    // Caché rápido local para respuesta visual inmediata
    try {
      localStorage.setItem('lanitapp_theme_mode', mode);
    } catch {}

    // Persistir en Supabase profiles
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await updatePreference(user.id, 'theme_mode', mode);
        }
      }
    } catch (error) {
      logger.error('Error guardando tema en Supabase:', error);
    }
  }, []);

  // Actualizar color de acento con sincronización a Supabase y caché de respaldo
  const setAccentColor = useCallback(async (color: AccentColor) => {
    setAccentColorState(color);

    // Caché rápido local para respuesta visual inmediata
    try {
      localStorage.setItem('lanitapp_accent_color', color);
    } catch {}

    // Persistir en Supabase profiles
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await updatePreference(user.id, 'accent_color', color);
        }
      }
    } catch (error) {
      logger.error('Error guardando color de acento en Supabase:', error);
    }
  }, []);

  return {
    themeMode,
    accentColor,
    setThemeMode,
    setAccentColor,
    updateTheme: setThemeMode,
    updateAccentColor: setAccentColor,
    isLoading,
  };
}
