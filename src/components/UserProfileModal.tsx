import React, { useState } from 'react';
import {
  User,
  Check,
  X,
  Sun,
  Moon,
  Image as ImageIcon,
  Palette,
  LogOut,
  CreditCard,
  Mail,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { UserProfile, ThemeMode, AccentColor } from '../types/index.ts';
import { ACCENT_COLOR_OPTIONS } from '../hooks/useTheme.ts';
import { saveUserProfile } from '../lib/db.ts';
import { supabase } from '../lib/supabase.ts';

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
  onSignOut?: () => void;
}

const AVATAR_PRESETS = ['👑', '👨‍💻', '👩‍💻', '🧑‍🚀', '🦁', '💼', '💡', '💰', '⭐', '🔥', '🚀', '🎯'];

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
  onSignOut,
}) => {
  const [name, setName] = useState<string>(profile?.name || 'Usuario');
  const [avatar, setAvatar] = useState<string>(() => {
    return profile?.avatar_url || profile?.avatar || (typeof localStorage !== 'undefined' ? localStorage.getItem('user_avatar') : null) || '👨‍💻';
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  React.useEffect(() => {
    if (profile) {
      setName(profile.name);
      setAvatar(profile.avatar_url || profile.avatar || localStorage.getItem('user_avatar') || '👨‍💻');
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    localStorage.setItem('user_avatar', avatar);

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
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectAvatar = async (emoji: string) => {
    // 1. Actualizar estado local inmediato para respuesta visual instantánea
    setAvatar(emoji);
    localStorage.setItem('user_avatar', emoji);

    // 2. Persistir automáticamente en Supabase sin requerir presionar "Guardar"
    if (onUpdateProfile) {
      try {
        await onUpdateProfile({ avatar: emoji, avatar_url: emoji });
      } catch (err) {
        console.warn('Profile instant update error:', err);
      }
    }

    if (supabase && profile?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar: emoji, avatar_url: emoji })
          .eq('id', profile.id);

        if (error) {
          console.error('Error al guardar avatar automáticamente:', error);
        }
      } catch (err) {
        console.error('Error al guardar avatar en Supabase:', err);
      }
    }
  };

  const handleSelectAvatarPreset = handleSelectAvatar;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (reader.result) {
          const dataUrl = reader.result.toString();
          setAvatar(dataUrl);
          localStorage.setItem('user_avatar', dataUrl);
          if (onUpdateProfile) {
            await onUpdateProfile({ avatar: dataUrl, avatar_url: dataUrl }).catch((err) =>
              console.warn('Profile image instant update error:', err)
            );
          }
          if (supabase && profile?.id) {
            try {
              await supabase
                .from('profiles')
                .update({ avatar: dataUrl, avatar_url: dataUrl })
                .eq('id', profile.id);
            } catch (err) {
              console.warn('Supabase image save err:', err);
            }
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignOutClick = () => {
    if (window.confirm('¿Seguro que deseas cerrar la sesión actual?')) {
      onClose();
      if (onSignOut) onSignOut();
    }
  };

  const isImageAvatar = Boolean(
    avatar && (avatar.startsWith('data:') || avatar.startsWith('http') || avatar.startsWith('/'))
  );

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

          {/* Avatar Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Avatar o Foto de Perfil
            </label>
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-12 h-12 rounded-2xl bg-card border-2 border-primary-custom flex items-center justify-center text-2xl overflow-hidden shrink-0 shadow-md">
                {isImageAvatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="select-none text-2xl leading-none">{avatar}</span>
                )}
              </div>

              <label className="flex-1 py-2 px-3 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-semibold border border-app flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5 text-primary-custom" />
                <span>Subir Foto Local</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-6 gap-1.5">
              {AVATAR_PRESETS.map((emoji) => {
                const isSelected = avatar === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectAvatarPreset(emoji)}
                    className={`h-9 rounded-xl flex items-center justify-center text-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary-custom/25 border-2 border-primary-custom scale-105 shadow-sm ring-1 ring-primary-custom'
                        : 'bg-card hover:bg-surface-hover border border-app'
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
                Tema de Fondo
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Modo Azul Marino */}
              <button
                type="button"
                onClick={() => onChangeThemeMode('navy')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  currentThemeMode === 'navy'
                    ? 'border-primary-custom bg-[#203657] text-white ring-2 ring-primary-custom'
                    : 'border-app bg-[#203657]/60 text-slate-300 hover:bg-[#203657]'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-[#0B132B] border border-white/20 mx-auto mb-1 flex items-center justify-center text-[8px]">
                  🌊
                </div>
                <span className="text-xs font-bold block">Azul Marino</span>
              </button>

              {/* Modo Oscuro Negro */}
              <button
                type="button"
                onClick={() => onChangeThemeMode('dark')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  currentThemeMode === 'dark'
                    ? 'border-primary-custom bg-[#111726] text-white ring-2 ring-primary-custom'
                    : 'border-app bg-[#0e1320] text-slate-300 hover:bg-[#111726]'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-[#000000] border border-white/20 mx-auto mb-1 flex items-center justify-center text-[8px]">
                  <Moon className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-xs font-bold block">Oscuro Negro</span>
              </button>

              {/* Modo Fondo Blanco */}
              <button
                type="button"
                onClick={() => onChangeThemeMode('light')}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  currentThemeMode === 'light'
                    ? 'border-primary-custom bg-white text-slate-900 ring-2 ring-primary-custom shadow-md'
                    : 'border-app bg-white/90 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300 mx-auto mb-1 flex items-center justify-center text-[8px]">
                  <Sun className="w-2.5 h-2.5 text-amber-500" />
                </div>
                <span className="text-xs font-bold block">Fondo Blanco</span>
              </button>
            </div>
          </div>

          {/* Accent Color Palette Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider">
              Color de Acento
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ACCENT_COLOR_OPTIONS.map((opt) => {
                const isSelected = currentAccentColor === opt.color;
                return (
                  <button
                    key={opt.color}
                    type="button"
                    onClick={() => onChangeAccentColor(opt.color)}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-app bg-card ring-2 ring-primary-custom shadow-md'
                        : 'border-app bg-card/60 hover:bg-card'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{ backgroundColor: opt.color }}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] font-bold text-app whitespace-nowrap text-center">
                      {opt.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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
