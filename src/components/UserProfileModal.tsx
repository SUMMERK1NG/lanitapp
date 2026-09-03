import React, { useState } from 'react';
import {
  User,
  Check,
  X,
  Palette,
  LogOut,
  CreditCard,
  Mail,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { UserProfile, ThemeMode, AccentColor } from '../types/index.ts';
import { THEME_MODE_OPTIONS, ACCENT_COLOR_OPTIONS } from '../hooks/useTheme.ts';
import { saveUserProfile } from '../lib/db.ts';
import { supabase } from '../lib/supabase.ts';
import { logger } from '../utils/logger.ts';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile;
  currentThemeMode: ThemeMode;
  currentAccentColor: AccentColor;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onChangeAccentColor: (color: AccentColor) => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  onShowToast?: (msg: string) => void;
  onNavigateToSettings?: (tab?: 'themes' | 'categories' | 'users' | 'backup') => void;
  isAdmin?: boolean;
  onSignOut?: () => void;
}

const AVATAR_PRESETS = [
  '👑', '👨‍💻', '👩‍💻', '🧑‍🚀', '🦁', '💼',
  '💡', '💰', '⭐', '🔥', '🚀', '🎯',
  '💎', '🏆', '🦊', '⚡', '🐼', '🦄',
  '💸', '🛡️', '🎩', '🥇', '📊', '🦅'
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  currentThemeMode,
  currentAccentColor,
  onChangeThemeMode,
  onChangeAccentColor,
  onUpdateProfile,
  onShowToast,
  onNavigateToSettings,
  isAdmin: propIsAdmin,
  onSignOut,
}) => {
  const [name, setName] = useState<string>(profile?.name || 'Usuario');
  const [avatar, setAvatar] = useState<string>(() => {
    return profile?.avatar_url || profile?.avatar || '👨‍💻';
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Seguridad: El rol debe provenir estrictamente de Supabase Auth / Profiles.
  // NO se permite validación de rol desde localStorage para prevenir escalada de privilegios.
  const isAdmin = propIsAdmin ?? (profile?.role === 'admin');

  React.useEffect(() => {
    if (profile) {
      setName(profile.name);
      setAvatar(profile.avatar_url || profile.avatar || '👨‍💻');
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);

    const updates = {
      name: name.trim(),
      avatar,
      avatar_url: avatar,
      theme_mode: currentThemeMode,
      accent_color: currentAccentColor,
    };

    try {
      if (onUpdateProfile) {
        await onUpdateProfile(updates);
      } else {
        await saveUserProfile({
          id: profile?.id,
          ...updates,
          role: profile?.role || 'user',
          is_active: true,
          currency: profile?.currency || 'USD',
        });
      }

      if (onShowToast) {
        onShowToast('Perfil y preferencias guardadas con éxito');
      }
      onClose();
    } catch (err) {
      logger.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectAvatar = async (emoji: string) => {
    // 1. Actualizar estado local inmediato para respuesta visual instantánea
    setAvatar(emoji);

    // 2. Persistir automáticamente en Supabase sin requerir presionar "Guardar"
    if (onUpdateProfile) {
      try {
        await onUpdateProfile({ avatar: emoji, avatar_url: emoji });
      } catch (err) {
        logger.warn('Profile instant update error:', err);
      }
    }

    if (supabase && profile?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar: emoji, avatar_url: emoji })
          .eq('id', profile.id);

        if (error) {
          logger.error('Error al guardar avatar automáticamente:', error);
        }
      } catch (err) {
        logger.error('Error al guardar avatar en Supabase:', err);
      }
    }
  };

  const handleSelectAvatarPreset = handleSelectAvatar;

  const handleSignOutClick = () => {
    if (window.confirm('¿Seguro que deseas cerrar la sesión actual?')) {
      onClose();
      if (onSignOut) onSignOut();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app max-h-[92vh] overflow-y-auto animate-in zoom-in-95"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">Mi Perfil & Preferencias</h3>
              <p className="text-[11px] text-muted">Ajustes personales y personalización</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Role & Identity Badge */}
        <div className="p-3.5 rounded-2xl bg-card border border-app mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary-custom" />
              <span className="text-xs font-bold text-app">Tipo de Cuenta</span>
            </div>
            {profile?.role === 'admin' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-primary-custom/20 text-primary-custom border border-primary-custom/30">
                ADMINISTRADOR
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#00C2C7]/20 text-[#00C2C7] border border-[#00C2C7]/30">
                USUARIO ESTÁNDAR
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-muted">
            {profile?.cedula && (
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#FF914D]" />
                <span>C.I: <strong className="text-app">{profile.cedula}</strong></span>
              </div>
            )}
            {profile?.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-[#00C2C7]" />
                <span className="truncate">{profile.email}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* User Name */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Nombre Visible
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo o alias..."
              className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
            />
          </div>

          {/* Avatar Selector - Emoji Presets Only */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted">
                Avatar Oficial ({AVATAR_PRESETS.length} disponibles)
              </label>
              <div className="w-9 h-9 rounded-xl bg-card border-2 border-primary-custom flex items-center justify-center text-xl shadow-md">
                <span className="select-none leading-none">{avatar}</span>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 bg-card rounded-2xl border border-app max-h-36 overflow-y-auto">
              {AVATAR_PRESETS.map((emoji) => {
                const isSelected = avatar === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectAvatarPreset(emoji)}
                    className={`h-10 rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-custom/25 border-2 border-primary-custom scale-105 shadow-sm ring-1 ring-primary-custom'
                        : 'hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <span className="select-none leading-none">{emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Mode Selector */}
          <div className="space-y-2 pt-2 border-t border-app">
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary-custom" />
              <label className="text-xs font-bold text-muted uppercase tracking-wider">
                Tema de Fondo ({THEME_MODE_OPTIONS.length})
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {THEME_MODE_OPTIONS.map((theme) => {
                const isSelected = currentThemeMode === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onChangeThemeMode(theme.id)}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary-custom bg-card text-app ring-2 ring-primary-custom'
                        : 'border-app bg-card/60 text-muted hover:bg-card'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 mx-auto mb-1 flex items-center justify-center text-[9px] shadow-inner"
                      style={{ backgroundColor: theme.previewBg }}
                    >
                      {theme.icon}
                    </div>
                    <span className="text-[11px] font-bold block text-app truncate">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Palette Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider">
              Color de Acento ({ACCENT_COLOR_OPTIONS.length})
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {ACCENT_COLOR_OPTIONS.map((opt) => {
                const isSelected = currentAccentColor === opt.color;
                return (
                  <button
                    key={opt.color}
                    type="button"
                    onClick={() => onChangeAccentColor(opt.color)}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary-custom bg-card ring-2 ring-primary-custom shadow-md'
                        : 'border-app bg-card/60 hover:bg-card'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{ backgroundColor: opt.color }}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[9px] font-bold text-app whitespace-nowrap text-center truncate w-full">
                      {opt.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accesos Rápidos de Administrador */}
          {isAdmin && (
            <div className="p-3.5 rounded-2xl bg-card border border-app space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-app uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                  Herramientas de Administrador
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                  ADMIN
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigateToSettings) {
                      onNavigateToSettings('users');
                    }
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-bold transition-all text-left cursor-pointer"
                >
                  <span className="text-base">👑</span>
                  <div>
                    <span className="block text-white">Gestionar Usuarios</span>
                    <span className="text-[10px] text-slate-400 font-normal">Roles y accesos</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigateToSettings) {
                      onNavigateToSettings('backup');
                    }
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all text-left cursor-pointer"
                >
                  <span className="text-base">💾</span>
                  <div>
                    <span className="block text-white">Respaldar Base de Datos</span>
                    <span className="text-[10px] text-slate-400 font-normal">Exportar JSON / Reset</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Actions: Guardar Cambios & Cerrar Sesión */}
          <div className="space-y-2 pt-3 border-t border-app">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>

            {onSignOut && (
              <button
                type="button"
                onClick={handleSignOutClick}
                className="w-full py-2.5 rounded-xl bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] border border-[#ef4444]/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión en LANITAPP</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
