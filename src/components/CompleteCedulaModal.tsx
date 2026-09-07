import React, { useState } from 'react';
import { CreditCard, ArrowRight, AlertCircle, LogOut, CheckCircle2 } from 'lucide-react';

interface CompleteCedulaModalProps {
  isOpen: boolean;
  userName?: string;
  userEmail?: string;
  onSaveCedula: (fullCedula: string) => Promise<{ success: boolean; error?: string }>;
  onSignOut: () => Promise<void>;
  checkCedulaExists?: (cedula: string) => Promise<boolean>;
}

export const CompleteCedulaModal: React.FC<CompleteCedulaModalProps> = ({
  isOpen,
  userName,
  userEmail,
  onSaveCedula,
  onSignOut,
  checkCedulaExists,
}) => {
  const [prefix, setPrefix] = useState<string>('V');
  const [cedulaNumber, setCedulaNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBlur = async () => {
    const raw = cedulaNumber.trim();
    if (!checkCedulaExists || !raw || raw.length < 5) {
      setDuplicateError(null);
      return;
    }
    const full = `${prefix}-${raw}`;
    try {
      const exists = await checkCedulaExists(full);
      if (exists) {
        setDuplicateError(`La cédula ${full} ya está registrada en otra cuenta.`);
      } else {
        setDuplicateError(null);
      }
    } catch {
      setDuplicateError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const raw = cedulaNumber.trim();
    if (!raw || raw.length < 5) {
      setError('Por favor ingresa un número de cédula válido (mínimo 5 dígitos).');
      return;
    }

    if (duplicateError) {
      setError(duplicateError);
      return;
    }

    const fullCedula = `${prefix}-${raw}`;
    setIsSubmitting(true);

    try {
      if (checkCedulaExists) {
        const exists = await checkCedulaExists(fullCedula);
        if (exists) {
          setIsSubmitting(false);
          setError(`La cédula ${fullCedula} ya se encuentra registrada en el sistema.`);
          return;
        }
      }

      const res = await onSaveCedula(fullCedula);
      if (!res.success) {
        setError(res.error || 'No se pudo guardar la cédula. Por favor intenta de nuevo.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-md bg-[#1C2A4A] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 animate-in zoom-in-95"
        role="dialog"
      >
        {/* Header con Icono */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-white/10 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#147DF0] to-[#00C2C7] flex items-center justify-center shadow-lg shadow-[#147DF0]/30 shrink-0">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Completa tu Registro</h2>
            <p className="text-xs text-slate-400">Vincula tu cédula de identidad</p>
          </div>
        </div>

        {/* Info del usuario autenticado vía Google */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 mb-5 flex items-center justify-between text-xs">
          <div className="min-w-0 flex-1 pr-2">
            <p className="font-semibold text-white truncate">{userName || 'Usuario de Google'}</p>
            <p className="text-slate-400 text-[11px] truncate">{userEmail || ''}</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Verificado
          </span>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Para asociar tus transacciones, caja y operaciones de forma segura, ingresa tu número de cédula de identidad:
        </p>

        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-start gap-2 mb-4 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#147DF0]" />
              Cédula de Identidad
            </label>
            <div className="flex gap-2">
              <select
                value={prefix}
                onChange={(e) => {
                  setPrefix(e.target.value);
                  setDuplicateError(null);
                  setError(null);
                }}
                className="bg-[#0B132B]/90 border border-white/15 rounded-2xl px-3 py-3 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#147DF0] cursor-pointer shrink-0"
              >
                <option value="V" className="bg-[#0B132B] text-white">V</option>
                <option value="E" className="bg-[#0B132B] text-white">E</option>
                <option value="J" className="bg-[#0B132B] text-white">J</option>
                <option value="G" className="bg-[#0B132B] text-white">G</option>
              </select>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ej. 12345678"
                value={cedulaNumber}
                onChange={(e) => {
                  const num = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setCedulaNumber(num);
                  if (duplicateError) setDuplicateError(null);
                  if (error) setError(null);
                }}
                onBlur={handleBlur}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={9}
                className={`flex-1 min-w-0 bg-[#0B132B]/90 border rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                  duplicateError
                    ? 'border-rose-500/60 focus:ring-rose-500 text-rose-200'
                    : 'border-white/15 focus:ring-[#147DF0]'
                }`}
              />
            </div>
            {duplicateError && (
              <p className="mt-1.5 text-[11px] text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {duplicateError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !cedulaNumber.trim() || Boolean(duplicateError)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#147DF0] to-[#00C2C7] text-white text-sm font-black shadow-lg shadow-[#147DF0]/30 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Guardando...' : 'Completar y Entrar'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Opción para cerrar sesión */}
        <div className="mt-5 pt-4 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            ¿Cuenta equivocada? Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};
