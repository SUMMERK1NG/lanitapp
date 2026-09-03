import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, Send, ArrowLeft } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetPassword: (identifier: string) => Promise<{ success: boolean; error?: string; message?: string }>;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onResetPassword,
}) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    const result = await onResetPassword(identifier.trim());
    setIsSubmitting(false);

    // Siempre mostrar mensaje genérico seguro contra enumeración y limpiar el formulario
    setFeedback({
      type: 'success',
      message:
        result.message ||
        'Si existe una cuenta asociada a ese correo o cédula, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y spam.',
    });
    setIdentifier('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-app rounded-3xl p-6 shadow-2xl text-app animate-in zoom-in-95 cursor-default"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">Recuperar Contraseña</h3>
              <p className="text-[11px] text-muted">Ingresa tu cédula o correo registrado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div className="p-4 rounded-2xl mb-4 bg-emerald-500/10 border border-emerald-500/30 space-y-1 animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-emerald-400">
                  Solicitud procesada con éxito
                </p>
                <p className="text-[11px] text-emerald-300/80 mt-0.5 leading-relaxed">
                  {feedback.message}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Documento de Identidad o Correo Electrónico
              </label>
              <input
                type="text"
                required
                placeholder="Ej. V-12345678 o tuemail@ejemplo.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-card border border-app rounded-2xl px-4 py-3 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
              />
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Te enviaremos las instrucciones de restablecimiento de contraseña a la dirección de correo asociada a tu cuenta.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-primary-custom text-white text-xs font-extrabold shadow-lg shadow-primary-custom/25 hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Enviando...' : 'Enviar Enlace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
