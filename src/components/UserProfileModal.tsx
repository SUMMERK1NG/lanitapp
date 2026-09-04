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
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { UserProfile, ThemeMode, AccentColor } from '../types/index.ts';
import { THEME_MODE_OPTIONS, ACCENT_COLOR_OPTIONS } from '../hooks/useTheme.ts';
import { evaluatePasswordStrength } from './AuthScreen.tsx';
import { saveUserProfile } from '../lib/db.ts';
import { supabase } from '../lib/supabase.ts';
import { logger } from '../utils/logger.ts';
import { SignOutConfirmModal } from './SignOutConfirmModal.tsx';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile;
  currentThemeMode: ThemeMode;
  currentAccentColor: AccentColor;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onChangeAccentColor: (color: AccentColor) => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  onChangePassword?: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
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

export const SHEEP_AVATARS = [
  { id: 'sheep_king', name: 'Rey Lanita', src: '/avatars/sheep/sheep_king.png' },
  { id: 'sheep_cool', name: 'Lanita Cool', src: '/avatars/sheep/sheep_cool.png' },
  { id: 'sheep_wizard', name: 'Mago Estelar', src: '/avatars/sheep/sheep_wizard.png' },
  { id: 'sheep_baker', name: 'Chef Panadero', src: '/avatars/sheep/sheep_baker.png' },
  { id: 'sheep_steampunk', name: 'Ingeniero Steampunk', src: '/avatars/sheep/sheep_steampunk.png' },
  { id: 'sheep_plain', name: 'Lanita Clásica', src: '/avatars/sheep/sheep_plain.png' },
  { id: 'sheep_gamer_blue', name: 'Gamer Casual', src: '/avatars/sheep/sheep_gamer_blue.png' },
  { id: 'sheep_gamer_pro', name: 'Pro Gamer', src: '/avatars/sheep/sheep_gamer_pro.png' },
  { id: 'sheep_black_chef', name: 'Pizzero Nocturno', src: '/avatars/sheep/sheep_black_chef.png' },
  { id: 'sheep_black_nerd', name: 'Científico Geek', src: '/avatars/sheep/sheep_black_nerd.png' },
  { id: 'sheep_black_dj', name: 'DJ Beatmaster', src: '/avatars/sheep/sheep_black_dj.png' },
  { id: 'sheep_black_baker', name: 'Panadero Nocturno', src: '/avatars/sheep/sheep_black_baker.png' },
  { id: 'sheep_black_mage', name: 'Nigromante', src: '/avatars/sheep/sheep_black_mage.png' },
  { id: 'sheep_cyberpunk', name: 'Hacker Cyberpunk', src: '/avatars/sheep/sheep_cyberpunk.png' },
  { id: 'sheep_astronaut', name: 'Astronauta', src: '/avatars/sheep/sheep_astronaut.png' },
  { id: 'sheep_pirate', name: 'Pirata Mecánico', src: '/avatars/sheep/sheep_pirate.png' },
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
  onChangePassword,
  onShowToast,
  onNavigateToSettings: _onNavigateToSettings,
  isAdmin: _propIsAdmin,
  onSignOut,
}) => {
  const [name, setName] = useState<string>(profile?.name || 'Usuario');
  const [avatar, setAvatar] = useState<string>(() => {
    return profile?.avatar_url || profile?.avatar || '👨‍💻';
  });
  const [avatarCategory, setAvatarCategory] = useState<'sheep' | 'emojis'>(() => {
    const cur = profile?.avatar_url || profile?.avatar || '';
    return cur.startsWith('/') || cur.startsWith('http') ? 'sheep' : 'sheep';
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState<boolean>(false);

  // Estados para cambio de contraseña
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  const pwdStrength = evaluatePasswordStrength(newPassword);

  const getStrengthMeta = (score: number, length: number) => {
    if (length === 0) return { label: '', colorText: '', barColor: '' };
    if (score <= 1) return { label: 'Muy Débil', colorText: 'text-rose-400', barColor: 'bg-rose-500' };
    if (score === 2) return { label: 'Débil', colorText: 'text-amber-400', barColor: 'bg-amber-500' };
    if (score === 3) return { label: 'Aceptable', colorText: 'text-cyan-400', barColor: 'bg-cyan-500' };
    return { label: 'Segura y Robusta', colorText: 'text-emerald-400', barColor: 'bg-emerald-500' };
  };
  const strengthMeta = getStrengthMeta(pwdStrength.score, newPassword.length);


  React.useEffect(() => {
    if (profile) {
      setName(profile.name);
      setAvatar(profile.avatar_url || profile.avatar || '👨‍💻');
    }
  }, [profile, isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      setIsPasswordSectionOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(null);
    }
  }, [isOpen]);

  const handleChangePasswordSubmit = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    const curPwd = currentPassword.trim();
    const newPwd = newPassword.trim();
    const confPwd = confirmPassword.trim();

    if (!curPwd) {
      setPasswordError('Por favor ingresa tu contraseña actual.');
      return;
    }

    if (!newPwd || !confPwd) {
      setPasswordError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (curPwd === newPwd) {
      setPasswordError('La nueva contraseña debe ser diferente a la contraseña actual.');
      return;
    }

    if (!pwdStrength.isValid) {
      if (!pwdStrength.hasMinLength) {
        setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
      } else if (!pwdStrength.hasUpper || !pwdStrength.hasLower) {
        setPasswordError('La nueva contraseña debe incluir al menos una letra mayúscula y una minúscula.');
      } else if (!pwdStrength.hasNumber) {
        setPasswordError('La nueva contraseña debe incluir al menos un número.');
      } else if (!pwdStrength.hasSpecial) {
        setPasswordError('La nueva contraseña debe incluir al menos un carácter especial (@, #, $, *, -, etc.).');
      } else {
        setPasswordError('La nueva contraseña no cumple con los requisitos mínimos de seguridad.');
      }
      return;
    }

    if (newPwd !== confPwd) {
      setPasswordError('Las nuevas contraseñas no coinciden. Por favor verifica que ambas sean iguales.');
      return;
    }

    setIsChangingPassword(true);
    try {
      let res: { success: boolean; error?: string };
      if (onChangePassword) {
        res = await onChangePassword(curPwd, newPwd);
      } else if (supabase) {
        const userEmail = profile?.email || (await supabase.auth.getUser()).data?.user?.email;
        if (userEmail) {
          const { error: verifyErr } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: curPwd,
          });
          if (verifyErr) {
            res = { success: false, error: 'La contraseña actual ingresada no es correcta.' };
          } else {
            const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd });
            res = { success: !updateErr, error: updateErr?.message };
          }
        } else {
          res = { success: false, error: 'No se pudo identificar la sesión del usuario.' };
        }
      } else {
        res = { success: false, error: 'Servicio de autenticación no disponible.' };
      }

      if (!res.success) {
        setPasswordError(res.error || 'No se pudo actualizar la contraseña.');
      } else {
        setPasswordSuccess('¡Contraseña actualizada con éxito!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onShowToast) {
          onShowToast('Contraseña actualizada con éxito');
        }
        setTimeout(() => {
          setIsPasswordSectionOpen(false);
          setPasswordSuccess(null);
        }, 2200);
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Error inesperado al cambiar la contraseña.');
    } finally {
      setIsChangingPassword(false);
    }
  };

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
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!authError && user) {
          logger.dev('[UPDATE] Usuario:', user.id, 'Tabla: profiles (avatar)');
          const { error } = await supabase
            .from('profiles')
            .update({
              avatar: emoji,
              avatar_url: emoji,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          if (error) {
            logger.error('Error al guardar avatar automáticamente:', error);
          }
        }
      } catch (err) {
        logger.error('Error al guardar avatar en Supabase:', err);
      }
    }
  };

  const handleSelectAvatarPreset = handleSelectAvatar;

  const handleSignOutClick = () => {
    setIsSignOutConfirmOpen(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-app rounded-3xl shadow-2xl text-app max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 cursor-default"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fijo arriba para que el scrollbar no sobresalga en las esquinas */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-app shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">Mi Perfil</h3>
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

        {/* Contenido con scrollbar interno seguro */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
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
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted">
                Avatar Oficial
              </label>
              <div className="w-10 h-10 rounded-xl bg-card border-2 border-primary-custom flex items-center justify-center text-xl shadow-md overflow-hidden">
                {avatar.startsWith('/') || avatar.startsWith('http') ? (
                  <img src={avatar} alt="Avatar seleccionado" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <span className="select-none leading-none">{avatar}</span>
                )}
              </div>
            </div>

            {/* Selector de categoría de avatar */}
            <div className="flex items-center gap-1.5 p-1 bg-card rounded-xl border border-app text-xs font-bold">
              <button
                type="button"
                onClick={() => setAvatarCategory('sheep')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  avatarCategory === 'sheep'
                    ? 'bg-primary-custom text-white shadow-sm'
                    : 'text-muted hover:text-app'
                }`}
              >
                <span>🐑 Lanitas ({SHEEP_AVATARS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAvatarCategory('emojis')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  avatarCategory === 'emojis'
                    ? 'bg-primary-custom text-white shadow-sm'
                    : 'text-muted hover:text-app'
                }`}
              >
                <span>✨ Emojis ({AVATAR_PRESETS.length})</span>
              </button>
            </div>

            {/* Presets Grid */}
            {avatarCategory === 'sheep' ? (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2 bg-card rounded-2xl border border-app max-h-48 overflow-y-auto no-scrollbar">
                {SHEEP_AVATARS.map((s) => {
                  const isSelected = avatar === s.src;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectAvatarPreset(s.src)}
                      title={s.name}
                      className={`h-12 rounded-xl flex items-center justify-center p-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary-custom/25 border-2 border-primary-custom scale-105 shadow-sm ring-1 ring-primary-custom'
                          : 'hover:bg-surface-hover border border-transparent'
                      }`}
                    >
                      <img src={s.src} alt={s.name} className="w-full h-full object-contain" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 bg-card rounded-2xl border border-app max-h-48 overflow-y-auto no-scrollbar">
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
            )}
          </div>

          {/* Theme Mode Selector */}
          <div className="space-y-2 pt-2 border-t border-app">
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary-custom" />
              <label className="text-xs font-bold text-muted uppercase tracking-wider">
                Tema de Fondo
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
              Color de Acento
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-2.5 bg-card rounded-2xl border border-app">
              {ACCENT_COLOR_OPTIONS.map((opt) => {
                const isSelected = currentAccentColor === opt.color;
                return (
                  <button
                    key={opt.color}
                    type="button"
                    onClick={() => onChangeAccentColor(opt.color)}
                    title={opt.name}
                    className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110 shadow-md'
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: opt.color }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN SEGURIDAD: CAMBIO DE CONTRASEÑA (Para cualquier usuario y admin) */}
          <div className="p-4 rounded-2xl bg-card border border-app space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/15 text-primary-custom flex items-center justify-center font-bold shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-app flex items-center gap-1.5">
                    Seguridad y Acceso
                  </h4>
                  <p className="text-[10px] text-muted">Cambia tu contraseña de ingreso cuando lo desees</p>
                </div>
              </div>
              {!isPasswordSectionOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordSectionOpen(true);
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-primary-custom/30 bg-primary-custom/10 hover:bg-primary-custom/20 text-primary-custom text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Cambiar Contraseña</span>
                </button>
              )}
            </div>

            {isPasswordSectionOpen && (
              <div className="pt-3 border-t border-app space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Mensajes de feedback */}
                {passwordError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2 text-xs text-rose-400 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-snug text-[11px]">{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-400 animate-in fade-in font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="text-[11px]">{passwordSuccess}</span>
                  </div>
                )}

                {/* Campo 1: Contraseña Actual (Validación de Seguridad) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#FF914D]" /> Contraseña Actual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      maxLength={64}
                      placeholder="Ingresa tu contraseña actual"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value.slice(0, 64));
                        if (passwordError) setPasswordError(null);
                      }}
                      className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                      title={showCurrentPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Campo 2: Nueva Contraseña */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#10B981]" /> Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      maxLength={64}
                      placeholder="Escribe tu nueva contraseña"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value.slice(0, 64));
                        if (passwordError) setPasswordError(null);
                      }}
                      className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                      title={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Indicador interactivo y dinámico de seguridad */}
                  {newPassword.length > 0 && (
                    <div className="mt-2 p-2.5 bg-[#0B132B]/95 border border-white/15 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400">Nivel de seguridad:</span>
                        <span className={`text-[10px] font-extrabold ${strengthMeta.colorText}`}>
                          {strengthMeta.label}
                        </span>
                      </div>

                      {/* Barra de progreso de 4 segmentos */}
                      <div className="grid grid-cols-4 gap-1 h-1.5 w-full">
                        <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 1 ? strengthMeta.barColor : 'bg-white/10'}`} />
                        <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 2 ? strengthMeta.barColor : 'bg-white/10'}`} />
                        <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 3 ? strengthMeta.barColor : 'bg-white/10'}`} />
                        <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 4 ? strengthMeta.barColor : 'bg-white/10'}`} />
                      </div>

                      {/* Checklist interactivo de requisitos */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[9px]">
                        <div className={`flex items-center gap-1 transition-colors ${pwdStrength.hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasMinLength ? 'text-emerald-400' : 'text-slate-600'}`} />
                          <span>Mín. 8 caracteres</span>
                        </div>
                        <div className={`flex items-center gap-1 transition-colors ${pwdStrength.hasUpper && pwdStrength.hasLower ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasUpper && pwdStrength.hasLower ? 'text-emerald-400' : 'text-slate-600'}`} />
                          <span>Mayús. y minús.</span>
                        </div>
                        <div className={`flex items-center gap-1 transition-colors ${pwdStrength.hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasNumber ? 'text-emerald-400' : 'text-slate-600'}`} />
                          <span>Al menos un número</span>
                        </div>
                        <div className={`flex items-center gap-1 transition-colors ${pwdStrength.hasSpecial ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasSpecial ? 'text-emerald-400' : 'text-slate-600'}`} />
                          <span>Carácter especial (@#$...)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Campo 3: Confirmar Nueva Contraseña */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#10B981]" /> Confirmar Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      maxLength={64}
                      placeholder="Repite la nueva contraseña"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value.slice(0, 64));
                        if (passwordError) setPasswordError(null);
                      }}
                      className={`w-full bg-[#0B132B]/90 border rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                        confirmPassword.length > 0
                          ? newPassword === confirmPassword
                            ? 'border-emerald-500/60 focus:ring-emerald-500'
                            : 'border-rose-500/60 focus:ring-rose-500'
                          : 'border-white/15 focus:ring-[#147DF0]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                      title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {confirmPassword.length > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                      {newPassword === confirmPassword ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Las contraseñas coinciden
                        </span>
                      ) : (
                        <span className="text-rose-400 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" /> Las contraseñas no coinciden
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón de Actualizar Contraseña */}
                <div className="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordSectionOpen(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-surface hover:bg-surface-hover text-muted hover:text-app text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleChangePasswordSubmit}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#147DF0] to-[#00C2C7] text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isChangingPassword ? 'Verificando...' : 'Actualizar Contraseña'}</span>
                  </button>
                </div>
              </div>
            )}
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
                className="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión en LANITAPP</span>
              </button>
            )}
          </div>
        </form>
        </div>
      </div>

      {/* Confirmation Modal for Sign Out */}
      <SignOutConfirmModal
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        onConfirm={() => {
          setIsSignOutConfirmOpen(false);
          onClose();
          if (onSignOut) onSignOut();
        }}
      />
    </div>
  );
};
