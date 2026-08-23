import { useState, useEffect } from 'react';
import type { ThemeMode, AccentColor } from '../types/index.ts';

export const ACCENT_COLOR_OPTIONS: { name: string; color: AccentColor; bgClass: string }[] = [
  { name: 'Azul', color: '#147DF0', bgClass: 'bg-[#147DF0]' },
  { name: 'Turquesa', color: '#00C2C7', bgClass: 'bg-[#00C2C7]' },
  { name: 'Naranja', color: '#FF914D', bgClass: 'bg-[#FF914D]' },
  { name: 'Rosa', color: '#EC4899', bgClass: 'bg-[#EC4899]' },
  { name: 'Morado', color: '#8B5CF6', bgClass: 'bg-[#8B5CF6]' },
  { name: 'Verde', color: '#10B981', bgClass: 'bg-[#10B981]' },
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
    root.classList.remove('theme-navy', 'theme-dark', 'theme-light');
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
