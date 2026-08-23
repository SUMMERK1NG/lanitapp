import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, Send, ArrowLeft } from 'lucide-react';

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

    if (result.success) {
      setFeedback({
        type: 'success',
        message: result.message || 'Se ha enviado un enlace de recuperación a tu correo electrónico.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: result.error || 'No se pudo procesar la solicitud. Verifica los datos.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-6 shadow-2xl text-app animate-in zoom-in-95">
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
          <div
            className={`p-3.5 rounded-2xl mb-4 text-xs font-semibold flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                : 'bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <p className="leading-relaxed">{feedback.message}</p>
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
