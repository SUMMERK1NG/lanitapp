import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck, Check, ArrowLeft } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { evaluatePasswordStrength } from './AuthScreen.tsx';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
  onSignOut?: () => Promise<void>;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
  onSignOut,
}) => {
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const pwdStrength = evaluatePasswordStrength(newPassword);

  const getStrengthMeta = () => {
    switch (pwdStrength.score) {
      case 0:
      case 1:
        return { label: 'Débil', colorText: 'text-rose-400', barColor: 'bg-rose-500' };
      case 2:
        return { label: 'Regular', colorText: 'text-amber-400', barColor: 'bg-amber-500' };
      case 3:
        return { label: 'Buena', colorText: 'text-sky-400', barColor: 'bg-sky-500' };
      case 4:
      default:
        return { label: 'Excelente', colorText: 'text-emerald-400', barColor: 'bg-emerald-500' };
    }
  };

  const strengthMeta = getStrengthMeta();

  const handleCancelAndExit = async () => {
    try {
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      if (onSignOut) {
        await onSignOut();
      } else if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      sessionStorage.clear();
    } finally {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const newPwd = newPassword.trim();
    const confPwd = confirmPassword.trim();

    if (!newPwd || !confPwd) {
      setError('Por favor completa ambos campos.');
      return;
    }

    if (!pwdStrength.isValid) {
      if (!pwdStrength.hasMinLength) {
        setError('La nueva contraseña debe tener al menos 8 caracteres.');
      } else if (!pwdStrength.hasUpper || !pwdStrength.hasLower) {
        setError('La nueva contraseña debe incluir al menos una letra mayúscula y una minúscula.');
      } else if (!pwdStrength.hasNumber) {
        setError('La nueva contraseña debe incluir al menos un número.');
      } else if (!pwdStrength.hasSpecial) {
        setError('La nueva contraseña debe incluir al menos un carácter especial (@, #, $, *, -, etc.).');
      } else {
        setError('La nueva contraseña no cumple con los requisitos mínimos de seguridad.');
      }
      return;
    }

    if (newPwd !== confPwd) {
      setError('Las contraseñas no coinciden. Por favor verifica que ambas sean iguales.');
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setError('El servicio de autenticación no está disponible.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Actualizar contraseña en Supabase Auth
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPwd,
      });

      if (updateErr) {
        setError(updateErr.message || 'No se pudo actualizar la contraseña.');
        setIsSubmitting(false);
        return;
      }

      // 2. Limpiar hash y parámetros de recuperación de la URL inmediatamente
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // 3. Cerrar sesión para obligar a autenticarse en el Login con la nueva clave
      if (onSignOut) {
        await onSignOut();
      } else if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      sessionStorage.clear();

      // 4. Notificar con toast y cerrar modal
      if (onSuccessToast) {
        onSuccessToast('¡Contraseña actualizada con éxito! Por favor inicia sesión con tu nueva contraseña.');
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error inesperado al actualizar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      // Bloqueado clic afuera intencionalmente por seguridad
    >
      <div
        className="w-full max-w-md bg-[#1C2A4A]/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-5 animate-in zoom-in-95 cursor-default"
        role="dialog"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#147DF0]/20 text-[#147DF0] flex items-center justify-center border border-[#147DF0]/30 shadow-lg">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Crear Nueva Contraseña</h2>
            <p className="text-xs text-slate-300">Ingresa tu nueva contraseña para LANITAPP</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo 1: Nueva Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#147DF0]" />
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                maxLength={64}
                placeholder="Escribe tu nueva contraseña"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value.slice(0, 64));
                  if (error) setError(null);
                }}
                className="w-full bg-[#0B132B]/90 border border-white/15 rounded-2xl pl-4 pr-11 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Medidor dinámico de seguridad */}
            {newPassword.length > 0 && (
              <div className="mt-2.5 p-3 bg-[#0B132B]/95 border border-white/15 rounded-2xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-400">Nivel de seguridad:</span>
                  <span className={`text-[11px] font-extrabold ${strengthMeta.colorText}`}>
                    {strengthMeta.label}
                  </span>
                </div>

                {/* Barra de progreso de 4 segmentos */}
                <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                  <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 1 ? strengthMeta.barColor : 'bg-white/10'}`} />
                  <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 2 ? strengthMeta.barColor : 'bg-white/10'}`} />
                  <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 3 ? strengthMeta.barColor : 'bg-white/10'}`} />
                  <div className={`h-full rounded-full transition-all duration-300 ${pwdStrength.score >= 4 ? strengthMeta.barColor : 'bg-white/10'}`} />
                </div>

                {/* Checklist interactivo de requisitos */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-1 text-[10px]">
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdStrength.hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasMinLength ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Mín. 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdStrength.hasUpper && pwdStrength.hasLower ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasUpper && pwdStrength.hasLower ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Mayús. y minús.</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdStrength.hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasNumber ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Al menos un número</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${pwdStrength.hasSpecial ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasSpecial ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>Carácter especial (@#$...)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Campo 2: Confirmar Nueva Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00C2C7]" />
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                maxLength={64}
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value.slice(0, 64));
                  if (error) setError(null);
                }}
                className={`w-full bg-[#0B132B]/90 border rounded-2xl pl-4 pr-11 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                  confirmPassword.length > 0
                    ? newPassword === confirmPassword
                      ? 'border-emerald-500/60 focus:ring-emerald-500'
                      : 'border-rose-500/60 focus:ring-rose-500'
                    : 'border-white/15 focus:ring-[#00C2C7]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Coincidencia de contraseñas */}
            {confirmPassword.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                {newPassword === confirmPassword ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Las contraseñas coinciden
                  </span>
                ) : (
                  <span className="text-rose-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" /> Las contraseñas no coinciden
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCancelAndExit}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancelar y Salir
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#147DF0] to-[#00C0FA] hover:opacity-95 text-white text-xs font-extrabold shadow-lg shadow-[#147DF0]/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <span>Actualizar Contraseña</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
