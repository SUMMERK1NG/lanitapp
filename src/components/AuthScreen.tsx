import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  CreditCard,
  ArrowRight,
  Shield,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Check,
} from 'lucide-react';
import { ForgotPasswordModal } from './ForgotPasswordModal.tsx';

const NAME_ALLOWED_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const EMAIL_VALID_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const cleanNameInput = (val: string): string =>
  val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g, '').slice(0, 35);

const cleanEmailInput = (val: string): string =>
  val.replace(/\s/g, '').slice(0, 80);

export interface PasswordStrength {
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  score: number;
  isValid: boolean;
}

export const evaluatePasswordStrength = (password: string): PasswordStrength => {
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (hasUpper && hasLower) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;

  const isValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  return {
    hasMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    score,
    isValid,
  };
};

interface AuthScreenProps {
  onSignIn: (cedula: string, password: string, keepConnected?: boolean) => Promise<{ success: boolean; error?: string }>;
  onSignUp: (data: {
    firstName: string;
    lastName: string;
    cedula: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onResetPassword: (
    identifier: string,
    documentType?: 'cedula' | 'email'
  ) => Promise<{ success: boolean; message: string; error?: string }>;
  checkCedulaExists?: (cedula: string) => Promise<boolean>;
  checkEmailExists?: (email: string) => Promise<boolean>;
  isLoading?: boolean;
  externalError?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSignIn,
  onSignUp,
  onResetPassword,
  checkCedulaExists,
  checkEmailExists,
  isLoading = false,
  externalError = null,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form fields (Cédula Only)
  const [loginPrefix, setLoginPrefix] = useState<string>('V');
  const [loginCedula, setLoginCedula] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [keepConnected, setKeepConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lanitapp_keep_connected') === 'true';
    } catch {
      return false;
    }
  });

  // Register form fields
  const [regPrefix, setRegPrefix] = useState<string>('V');
  const [regFirstName, setRegFirstName] = useState<string>('');
  const [regLastName, setRegLastName] = useState<string>('');
  const [regCedula, setRegCedula] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState<boolean>(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [cedulaDuplicateError, setCedulaDuplicateError] = useState<string | null>(null);
  const [emailDuplicateError, setEmailDuplicateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);

  const errorToDisplay = formError || externalError;

  const handleCedulaBlur = async () => {
    const rawCedula = regCedula.trim();
    if (!checkCedulaExists || !rawCedula || rawCedula.length < 5) {
      setCedulaDuplicateError(null);
      return;
    }
    const full = rawCedula.includes('-') ? rawCedula.toUpperCase() : `${regPrefix}-${rawCedula}`;
    try {
      const exists = await checkCedulaExists(full);
      if (exists) {
        setCedulaDuplicateError('La cédula ya se encuentra registrada.');
      } else {
        setCedulaDuplicateError(null);
      }
    } catch {
      setCedulaDuplicateError(null);
    }
  };

  const handleEmailBlur = async () => {
    const rawEmail = regEmail.trim().toLowerCase();
    if (!checkEmailExists || !rawEmail || !EMAIL_VALID_REGEX.test(rawEmail)) {
      setEmailDuplicateError(null);
      return;
    }
    try {
      const exists = await checkEmailExists(rawEmail);
      if (exists) {
        setEmailDuplicateError('El correo ya se encuentra registrado.');
      } else {
        setEmailDuplicateError(null);
      }
    } catch {
      setEmailDuplicateError(null);
    }
  };

  const pwdStrength = evaluatePasswordStrength(regPassword);

  const getStrengthMeta = (score: number, length: number) => {
    if (length === 0) return { label: '', colorText: '', barColor: '' };
    if (score <= 1) return { label: 'Muy Débil', colorText: 'text-rose-400', barColor: 'bg-rose-500' };
    if (score === 2) return { label: 'Débil', colorText: 'text-amber-400', barColor: 'bg-amber-500' };
    if (score === 3) return { label: 'Aceptable', colorText: 'text-cyan-400', barColor: 'bg-cyan-500' };
    return { label: 'Segura y Robusta', colorText: 'text-emerald-400', barColor: 'bg-emerald-500' };
  };

  const strengthMeta = getStrengthMeta(pwdStrength.score, regPassword.length);

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

    try {
      localStorage.setItem('lanitapp_keep_connected', keepConnected ? 'true' : 'false');
    } catch {}
    const res = await onSignIn(fullCedula, loginPassword, keepConnected);
    setIsSubmitting(false);

    if (!res.success && res.error) {
      setFormError(res.error);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawFirstName = regFirstName.replace(/\s+/g, ' ').trim();
    const rawLastName = regLastName.replace(/\s+/g, ' ').trim();
    const rawCedula = regCedula.trim();
    const rawEmail = regEmail.trim().toLowerCase();

    if (!rawFirstName || !rawCedula || !rawEmail || !regPassword || !regConfirmPassword) {
      setFormError('Por favor completa todos los campos requeridos para crear tu cuenta.');
      return;
    }

    if (rawFirstName.length < 2 || !NAME_ALLOWED_REGEX.test(rawFirstName)) {
      setFormError('El nombre debe contener solo letras (sin números ni símbolos especiales).');
      return;
    }

    if (rawLastName && (rawLastName.length < 2 || !NAME_ALLOWED_REGEX.test(rawLastName))) {
      setFormError('Los apellidos deben contener solo letras (sin números ni símbolos especiales).');
      return;
    }

    if (!EMAIL_VALID_REGEX.test(rawEmail)) {
      setFormError('Por favor ingresa un formato de correo electrónico válido (ejemplo: usuario@correo.com).');
      return;
    }

    const pwdStrength = evaluatePasswordStrength(regPassword);
    if (!pwdStrength.isValid) {
      if (!pwdStrength.hasMinLength) {
        setFormError('La contraseña debe tener al menos 8 caracteres.');
      } else if (!pwdStrength.hasUpper || !pwdStrength.hasLower) {
        setFormError('La contraseña debe incluir al menos una letra mayúscula y una minúscula.');
      } else if (!pwdStrength.hasNumber) {
        setFormError('La contraseña debe incluir al menos un número.');
      } else if (!pwdStrength.hasSpecial) {
        setFormError('La contraseña debe incluir al menos un carácter especial (@, #, $, *, -, etc.).');
      } else {
        setFormError('La contraseña no cumple con los requisitos mínimos de seguridad.');
      }
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setFormError('Las contraseñas no coinciden. Por favor verifica que ambas sean idénticas.');
      return;
    }

    if (cedulaDuplicateError) {
      setFormError(cedulaDuplicateError);
      return;
    }

    if (emailDuplicateError) {
      setFormError(emailDuplicateError);
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
                  placeholder="Ej. 12345678"
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

            {/* Checkbox Mantenerme Conectado - Diseño Moderno */}
            <div
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                keepConnected
                  ? 'bg-gradient-to-r from-primary-custom/10 to-cyan-400/10 border-primary-custom/50 shadow-md shadow-primary-custom/10'
                  : 'bg-card/50 border-app hover:border-primary-custom/30'
              }`}
              onClick={() => {
                const nextVal = !keepConnected;
                setKeepConnected(nextVal);
                try {
                  localStorage.setItem('lanitapp_keep_connected', nextVal ? 'true' : 'false');
                } catch {}
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    keepConnected
                      ? 'bg-primary-custom text-white shadow-md shadow-primary-custom/30'
                      : 'bg-surface text-muted'
                  }`}
                >
                  {keepConnected ? (
                    <Shield className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-app">
                    Mantenerme conectado
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {keepConnected
                      ? 'Sesión activa indefinidamente'
                      : 'Se cerrará tras 5 min de inactividad'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div
                className={`w-12 h-6 rounded-full transition-all relative shrink-0 ml-3 p-0.5 ${
                  keepConnected
                    ? 'bg-gradient-to-r from-primary-custom to-cyan-400 shadow-md shadow-primary-custom/30'
                    : 'bg-card border border-app'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                    keepConnected ? 'left-6' : 'left-0.5'
                  }`}
                />
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
                  maxLength={35}
                  placeholder="Tu nombre"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(cleanNameInput(e.target.value))}
                  className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Apellidos
                </label>
                <input
                  type="text"
                  maxLength={35}
                  placeholder="Tus apellidos"
                  value={regLastName}
                  onChange={(e) => setRegLastName(cleanNameInput(e.target.value))}
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
                  onChange={(e) => {
                    setRegPrefix(e.target.value);
                    if (cedulaDuplicateError) setCedulaDuplicateError(null);
                  }}
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
                  placeholder="Ej. 12345678"
                  value={regCedula}
                  onChange={(e) => {
                    const numericVal = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setRegCedula(numericVal);
                    if (cedulaDuplicateError) setCedulaDuplicateError(null);
                    if (formError) setFormError(null);
                  }}
                  onBlur={handleCedulaBlur}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={9}
                  className={`flex-1 min-w-0 bg-[#0B132B]/90 border rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                    cedulaDuplicateError
                      ? 'border-rose-500/60 focus:ring-rose-500 text-rose-200'
                      : 'border-white/15 focus:ring-[#147DF0]'
                  }`}
                />
              </div>
              {cedulaDuplicateError && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between text-[11px] text-rose-400 animate-in fade-in">
                  <span className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {cedulaDuplicateError}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setLoginCedula(regCedula);
                      setLoginPrefix(regPrefix);
                      setFormError(null);
                      setCedulaDuplicateError(null);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-bold ml-2 shrink-0 underline cursor-pointer text-[10px]"
                  >
                    Iniciar Sesión &rarr;
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#00C2C7]" /> Correo Electrónico
              </label>
              <input
                type="email"
                required
                maxLength={80}
                placeholder="nombre@ejemplo.com"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(cleanEmailInput(e.target.value));
                  if (emailDuplicateError) setEmailDuplicateError(null);
                  if (formError) setFormError(null);
                }}
                onBlur={handleEmailBlur}
                className={`w-full bg-[#0B132B]/90 border rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                  emailDuplicateError
                    ? 'border-rose-500/60 focus:ring-rose-500 text-rose-200'
                    : 'border-white/15 focus:ring-[#147DF0]'
                }`}
              />
              {emailDuplicateError && (
                <div className="mt-1.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-1.5 text-[11px] text-rose-400 font-medium animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{emailDuplicateError}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Lock className="w-3 text-[#10B981]" /> Contraseña
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  maxLength={64}
                  placeholder="Escribe tu contraseña"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value.slice(0, 64))}
                  className="w-full bg-[#0B132B]/90 border border-white/15 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147DF0]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  title={showRegPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Indicador interactivo y dinámico de seguridad de la contraseña */}
              {regPassword.length > 0 && (
                <div className="mt-2.5 p-3 bg-[#0B132B]/95 border border-white/15 rounded-2xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-400">Nivel de seguridad:</span>
                    <span className={`text-[10px] font-extrabold ${strengthMeta.colorText}`}>
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
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px]">
                    <div className={`flex items-center gap-1.5 transition-colors ${pwdStrength.hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                      <Check className={`w-3 h-3 shrink-0 ${pwdStrength.hasMinLength ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <span>Mínimo 8 caracteres</span>
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
                      <span>Carácter especial (!@#$...)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirmar Contraseña (Doble check) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Lock className="w-3 text-[#10B981]" /> Confirmar Contraseña
              </label>
              <div className="relative">
                <input
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  required
                  maxLength={64}
                  placeholder="Repite tu contraseña"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value.slice(0, 64))}
                  className={`w-full bg-[#0B132B]/90 border rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                    regConfirmPassword.length > 0
                      ? regPassword === regConfirmPassword
                        ? 'border-emerald-500/60 focus:ring-emerald-500'
                        : 'border-rose-500/60 focus:ring-rose-500'
                      : 'border-white/15 focus:ring-[#147DF0]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  title={showRegConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Validación visual de coincidencia en tiempo real */}
              {regConfirmPassword.length > 0 && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                  {regPassword === regConfirmPassword ? (
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

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#147DF0] to-[#00C2C7] text-white text-xs font-black shadow-lg shadow-[#147DF0]/30 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1"
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
