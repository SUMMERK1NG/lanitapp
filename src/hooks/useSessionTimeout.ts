import { useEffect, useRef, useCallback } from 'react';

// 15 minutos de inactividad
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
// 2 minutos de advertencia antes del cierre
export const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000;

export interface UseSessionTimeoutOptions {
  isEnabled: boolean;
  onTimeout: () => void;
  onWarning: (remainingSeconds: number) => void;
}

export const useSessionTimeout = ({
  isEnabled,
  onTimeout,
  onWarning,
}: UseSessionTimeoutOptions) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isWarningActiveRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as any);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current as any);
      warningRef.current = null;
    }
    isWarningActiveRef.current = false;
  }, []);

  const resetTimers = useCallback(() => {
    if (!isEnabled) {
      clearTimers();
      return;
    }

    lastActivityRef.current = Date.now();
    clearTimers();

    // 1. Configurar advertencia 2 minutos antes del timeout
    warningRef.current = setTimeout(() => {
      isWarningActiveRef.current = true;
      const remainingSeconds = Math.floor(WARNING_BEFORE_TIMEOUT_MS / 1000);
      onWarning(remainingSeconds);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS);

    // 2. Configurar cierre de sesión tras 15 minutos
    timeoutRef.current = setTimeout(() => {
      clearTimers();
      onTimeout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [isEnabled, onTimeout, onWarning, clearTimers]);

  useEffect(() => {
    if (!isEnabled) {
      clearTimers();
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      // Si la ventana de advertencia ya está activa, no reseteamos silenciosamente con cualquier movimiento
      if (!isWarningActiveRef.current) {
        lastActivityRef.current = Date.now();
        resetTimers();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timers
    resetTimers();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [isEnabled, resetTimers, clearTimers]);

  return { resetTimers, clearTimers };
};
