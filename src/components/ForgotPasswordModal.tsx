import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, Send, ArrowLeft, AlertTriangle } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetPassword: (
    identifier: string,
    documentType?: 'cedula' | 'email'
  ) => Promise<{ success: boolean; message: string; error?: string }>;
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
    const cleanInput = identifier.trim();
    if (!cleanInput) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const docType: 'cedula' | 'email' = cleanInput.includes('@') ? 'email' : 'cedula';
      const result = await onResetPassword(cleanInput, docType);

      if (!result.success) {
        setFeedback({
          type: 'error',
          message: result.message || result.error || 'Ocurrió un inconveniente al procesar la solicitud. Por favor intenta de nuevo.',
        });
        return;
      }

      setFeedback({
        type: 'success',
        message:
          result.message ||
          'Si existe una cuenta asociada a ese correo o cédula, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y spam.',
      });
      setIdentifier('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Error de conexión. Por favor verifica tu conexión a internet e intenta de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
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
          <div
            className={`p-4 rounded-2xl mb-4 space-y-1 animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-rose-500/10 border border-rose-500/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>
              <div className="text-left">
                <p
                  className={`text-xs font-bold ${
                    feedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {feedback.type === 'success' ? 'Solicitud procesada con éxito' : 'Aviso de Seguridad'}
                </p>
                <p
                  className={`text-[11px] mt-0.5 leading-relaxed ${
                    feedback.type === 'success' ? 'text-emerald-300/80' : 'text-rose-300/90'
                  }`}
                >
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
              disabled={isSubmitting}
              placeholder="Ej. V-12345678 o tuemail@ejemplo.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-card border border-app rounded-2xl px-4 py-3 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom disabled:opacity-50"
            />
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Te enviaremos las instrucciones de restablecimiento de contraseña a la dirección de correo asociada a tu cuenta.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-primary-custom text-white text-xs font-extrabold shadow-lg shadow-primary-custom/25 hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Enlace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
