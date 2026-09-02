import { useEffect, useRef, useCallback } from 'react';

export const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos de inactividad
export const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // 2 minutos antes del cierre

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

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    onClearWarning();

    if (!isEnabled) return;

    // Advertencia a los 3 minutos (5 - 2 = 3 min de inactividad)
    warningRef.current = setTimeout(() => {
      let secondsLeft = Math.floor(WARNING_BEFORE_TIMEOUT / 1000);
      onWarning(secondsLeft);

      // Countdown de 2 minutos (120 segundos)
      countdownRef.current = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        } else {
          onWarning(secondsLeft);
        }
      }, 1000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Cierre de sesión automático a los 5 minutos
    timeoutRef.current = setTimeout(() => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      onTimeout();
    }, INACTIVITY_TIMEOUT);
  }, [isEnabled, onTimeout, onWarning, onClearWarning, clearAllTimers]);

  useEffect(() => {
    if (!isEnabled) {
      clearAllTimers();
      onClearWarning();
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];

    const handleActivity = () => {
      resetTimers();
    };

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [isEnabled, resetTimers, clearAllTimers, onClearWarning]);

  return { resetTimers, clearAllTimers };
};
