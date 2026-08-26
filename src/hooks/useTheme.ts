import { useState, useEffect } from 'react';
import type { ThemeMode, AccentColor } from '../types/index.ts';

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
    return (localStorage.getItem('lanitapp_theme_mode') as ThemeMode) || 'navy';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    return (localStorage.getItem('lanitapp_accent_color') as AccentColor) || '#147DF0';
  });

  const applyTheme = (mode: ThemeMode, color: AccentColor) => {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
    root.classList.add(`theme-${mode}`);

    // Set dynamic primary color variable
    root.style.setProperty('--primary', color);

    // Convert hex to rgb for opacity helpers if needed
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
  };

  useEffect(() => {
    applyTheme(themeMode, accentColor);
  }, [themeMode, accentColor]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('lanitapp_theme_mode', mode);
  };

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    localStorage.setItem('lanitapp_accent_color', color);
  };

  return {
    themeMode,
    accentColor,
    setThemeMode,
    setAccentColor,
  };
}
