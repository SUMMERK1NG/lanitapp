import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/logger.ts'
import './index.css'
import App from './App.tsx'

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
    // 1. Borrar inmediatamente cualquier token de sesión en localStorage para que NO abra el Dashboard
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.includes('lanitapp_keep_connected') || key.includes('lanitapp_last_active_view'))) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();

    // 2. Extraer el motivo del error y preparar mensaje para la pantalla de Login
    const hashParams = new URLSearchParams(hash.replace(/^#/, '?'));
    const searchParams = new URLSearchParams(search);
    const errCode = hashParams.get('error_code') || searchParams.get('error_code') || '';
    const errDesc = hashParams.get('error_description') || searchParams.get('error_description') || '';

    let friendlyMsg = 'El enlace de recuperación ha expirado o ya fue utilizado. Por favor solicita uno nuevo.';
    if (errCode === 'otp_expired' || errDesc.toLowerCase().includes('expired')) {
      friendlyMsg = 'El enlace de recuperación ha expirado o ya fue utilizado. Por favor solicita uno nuevo.';
    }

    sessionStorage.setItem('lanitapp_auth_flash_error', friendlyMsg);

    // 3. Limpiar inmediatamente la barra de direcciones (quitar el hash de error largo)
    window.history.replaceState(null, '', window.location.origin + window.location.pathname);
  }
} catch (e) {
  console.error('Error comprobando parámetros de URL:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
