import { useEffect, useRef, useCallback } from 'react';

// Leer el timeout desde variables de entorno, con fallback seguro a 5 minutos (300,000 ms)
const envTimeout = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT);
export const INACTIVITY_TIMEOUT =
  Number.isFinite(envTimeout) && envTimeout > 60000
    ? envTimeout
    : 5 * 60 * 1000; // Mínimo 1 minuto, fallback 5 minutos

// La advertencia se dispara 2 minutos antes del timeout (o la mitad del tiempo si el timeout es muy corto)
export const WARNING_BEFORE_TIMEOUT =
  INACTIVITY_TIMEOUT > 120000 ? 2 * 60 * 1000 : Math.floor(INACTIVITY_TIMEOUT / 2);

export interface UseSessionTimeoutOptions {
  isEnabled: boolean;
  onTimeout: () => void;
  onWarning: (remainingSeconds: number) => void;
  onClearWarning: () => void;
}

export const useSessionTimeout = ({
  isEnabled,
  onTimeout,
  onWarning,
  onClearWarning,
}: UseSessionTimeoutOptions) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityTimestampRef = useRef<number>(Date.now());
  const isWarningActiveRef = useRef<boolean>(false);

  // Guardar callbacks en refs para evitar que re-renders accidentales reseteen los temporizadores
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);
  const onClearWarningRef = useRef(onClearWarning);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onWarningRef.current = onWarning;
    onClearWarningRef.current = onClearWarning;
  });

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    isWarningActiveRef.current = false;
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    onClearWarningRef.current();

    if (!isEnabled) return;

    // Advertencia a los 3 minutos (5 - 2 = 3 min de inactividad)
    warningRef.current = setTimeout(() => {
      isWarningActiveRef.current = true;
      let secondsLeft = Math.floor(WARNING_BEFORE_TIMEOUT / 1000);
      onWarningRef.current(secondsLeft);

      // Countdown de 2 minutos (120 segundos)
      countdownRef.current = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        } else {
          onWarningRef.current(secondsLeft);
        }
      }, 1000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Cierre de sesión automático a los 5 minutos
    timeoutRef.current = setTimeout(() => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      clearAllTimers();
      onTimeoutRef.current();
    }, INACTIVITY_TIMEOUT);
  }, [isEnabled, clearAllTimers]);

  useEffect(() => {
    if (!isEnabled) {
      clearAllTimers();
      onClearWarningRef.current();
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      const now = Date.now();
      // Throttle de actividad a 2 segundos
      if (now - lastActivityTimestampRef.current < 2000) {
        return;
      }
      lastActivityTimestampRef.current = now;

      // Si la advertencia ya está visible en pantalla, no cerrarla con micro-movimientos
      if (isWarningActiveRef.current) {
        return;
      }

      resetTimers();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimers();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [isEnabled, resetTimers, clearAllTimers]);

  return { resetTimers };
};
