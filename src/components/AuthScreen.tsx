import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ForgotPasswordModal } from './ForgotPasswordModal.tsx';

interface AuthScreenProps {
  onSignIn: (cedula: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onSignUp: (data: {
    firstName: string;
    lastName: string;
    cedula: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onResetPassword: (identifier: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  isLoading?: boolean;
  externalError?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSignIn,
  onSignUp,
  onResetPassword,
  isLoading = false,
  externalError = null,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form fields (Cédula Only)
  const [loginPrefix, setLoginPrefix] = useState<string>('V');
  const [loginCedula, setLoginCedula] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Register form fields
  const [regPrefix, setRegPrefix] = useState<string>('V');
  const [regFirstName, setRegFirstName] = useState<string>('');
  const [regLastName, setRegLastName] = useState<string>('');
  const [regCedula, setRegCedula] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);

  const errorToDisplay = formError || externalError;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawNumber = loginCedula.trim();
    if (!rawNumber || !loginPassword) {
      setFormError('Por favor ingresa tu número de cédula y contraseña.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    // Format standard full document: e.g. V-28322083
    const fullCedula = rawNumber.includes('-')
      ? rawNumber.toUpperCase()
      : `${loginPrefix}-${rawNumber}`;

    const res = await onSignIn(fullCedula, loginPassword);
    setIsSubmitting(false);

    if (!res.success && res.error) {
      setFormError(res.error);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawFirstName = regFirstName.trim();
    const rawLastName = regLastName.trim();
    const rawCedula = regCedula.trim();
    const rawEmail = regEmail.trim();

    if (!rawFirstName || !rawCedula || !rawEmail || !regPassword) {
      setFormError('Por favor completa todos los campos requeridos para crear tu cuenta.');
      return;
    }

    if (regPassword.length < 6) {
      setFormError('La contraseña debe contener al menos 6 caracteres.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    // Format standard full document: e.g. V-28322083
    const fullCedula = rawCedula.includes('-')
      ? rawCedula.toUpperCase()
      : `${regPrefix}-${rawCedula}`;

    const res = await onSignUp({
      firstName: rawFirstName,
      lastName: rawLastName,
      cedula: fullCedula,
      email: rawEmail,
      password: regPassword,
    });
    setIsSubmitting(false);

    if (!res.success && res.error) {
      setFormError(res.error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B132B] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 selection:bg-[#147DF0] selection:text-white relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#147DF0]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[#00C2C7]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-[#FF914D]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-[#1C2A4A]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Branding Header con Logo Oficial */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <img src="/icon.png" alt="Lanitapp" className="w-16 h-16 object-contain drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">LANITAPP</h1>
            <p className="text-sm text-slate-400 font-medium">Control Financiero</p>
          </div>
        </div>

        {/* Corrección del Selector Iniciar Sesión / Crear Cuenta */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setFormError(null);
            }}
            className={`py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setFormError(null);
            }}
            className={`py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Error Notification Banner */}
        {errorToDisplay && (
          <div className="p-3.5 rounded-2xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorToDisplay}</p>
          </div>
        )}

        {/* LOGIN FORM: EXCLUSIVAMENTE CÉDULA */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#147DF0]" />
                Cédula de Identidad
              </label>
              <div className="flex gap-2">
                <select
                  value={loginPrefix}
                  onChange={(e) => setLoginPrefix(e.target.value)}
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
                  placeholder="Ej. 28322083"
                  value={loginCedula}
                  onChange={(e) => {
                    const numericVal = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setLoginCedula(numericVal);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={9}
                  className="flex-1 min-w-0 bg-[#0B132B]/90 border border-white/15 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0] transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#00C2C7]" />
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] font-bold text-[#00C2C7] hover:underline cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Tu clave secreta"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#0B132B]/90 border border-white/15 rounded-2xl pl-4 pr-11 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0] transition-all"
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
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#147DF0] to-[#00C2C7] text-white text-sm font-black shadow-lg shadow-[#147DF0]/30 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isSubmitting || isLoading ? 'Verificando...' : 'Iniciar Sesión'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-[#147DF0]" /> Nombres
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tu nombre"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Apellidos
                </label>
                <input
                  type="text"
                  placeholder="Tus apellidos"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-[#FF914D]" /> Cédula de Identidad (Usuario único)
              </label>
              <div className="flex gap-2">
                <select
                  value={regPrefix}
                  onChange={(e) => setRegPrefix(e.target.value)}
                  className="bg-[#0B132B]/90 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#147DF0] cursor-pointer shrink-0"
                >
                  <option value="V" className="bg-[#0B132B] text-white">V</option>
                  <option value="E" className="bg-[#0B132B] text-white">E</option>
                  <option value="J" className="bg-[#0B132B] text-white">J</option>
                  <option value="G" className="bg-[#0B132B] text-white">G</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Ej. 28322083"
                  value={regCedula}
                  onChange={(e) => {
                    const numericVal = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setRegCedula(numericVal);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={9}
                  className="flex-1 min-w-0 bg-[#0B132B]/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#00C2C7]" /> Correo Electrónico
              </label>
              <input
                type="email"
                required
                placeholder="nombre@ejemplo.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Lock className="w-3 text-[#10B981]" /> Contraseña
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white"
                >
                  {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#147DF0] to-[#00C2C7] text-white text-xs font-black shadow-lg shadow-[#147DF0]/30 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting || isLoading ? 'Creando cuenta...' : 'Crear mi Cuenta'}</span>
            </button>
          </form>
        )}

        {/* Security Footer Notice */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-2 border-t border-white/10">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Datos cifrados de extremo a extremo y soporte offline</span>
        </div>
      </div>

      {/* Password Reset Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onResetPassword={onResetPassword}
      />
    </div>
  );
};
