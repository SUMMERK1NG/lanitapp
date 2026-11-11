import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/logger.ts'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { setAuthFlashError } from './lib/authFlash.ts'
import { supabase, isSupabaseConfigured } from './lib/supabase.ts'

// Interceptar y neutralizar enlaces de recuperación expirados o inválidos antes de montar la app
try {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (
    hash.includes('error=') ||
    hash.includes('error_code=') ||
    search.includes('error=') ||
    search.includes('error_code=')
  ) {
    // 1. Cerrar inmediatamente cualquier sesión activa en Supabase
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }

    // 2. Extraer el motivo del error y preparar mensaje en memoria para la pantalla de Login
    let friendlyMsg = 'El enlace de recuperación ha expirado o ya fue utilizado. Por favor solicita uno nuevo.';
    try {
      const hashParams = new URLSearchParams(hash.replace(/^#/, '?'));
      const searchParams = new URLSearchParams(search);
      const errCode = hashParams.get('error_code') || searchParams.get('error_code') || '';
      const errDesc = hashParams.get('error_description') || searchParams.get('error_description') || '';
      if (errCode === 'otp_expired' || errDesc.toLowerCase().includes('expired')) {
        friendlyMsg = 'El enlace de recuperación ha expirado o ya fue utilizado. Por favor solicita uno nuevo.';
      }
    } catch {}

    setAuthFlashError(friendlyMsg);

    // 3. Limpiar inmediatamente la barra de direcciones (quitar el hash de error largo)
    try {
      window.history.replaceState(null, '', window.location.origin + window.location.pathname);
    } catch {}
  }
} catch (e) {
  console.error('Error comprobando parámetros de URL:', e);
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

