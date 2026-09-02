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
  const lastActivityTimestampRef = useRef<number>(Date.now());
  const isWarningActiveRef = useRef<boolean>(false);

  console.log('[SessionTimeout] Hook ejecutado - isEnabled:', isEnabled);

  const clearAllTimers = useCallback(() => {
    console.log('[SessionTimeout] Limpiando todos los timers');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    isWarningActiveRef.current = false;
  }, []);

  const resetTimers = useCallback(() => {
    console.log('[SessionTimeout] Reset timers llamado - isEnabled:', isEnabled);
    clearAllTimers();
    onClearWarning();

    if (!isEnabled) {
      console.log('[SessionTimeout] Hook deshabilitado, no crear timers');
      return;
    }

    console.log('[SessionTimeout] Creando timers - Timeout: 5min, Warning: 3min');

    // Advertencia a los 3 minutos (5 - 2 = 3 min de inactividad)
    warningRef.current = setTimeout(() => {
      console.log('[SessionTimeout] ⚠️ ADVERTENCIA DISPARADA - Quedan 2 minutos');
      isWarningActiveRef.current = true;
      let secondsLeft = Math.floor(WARNING_BEFORE_TIMEOUT / 1000);
      onWarning(secondsLeft);

      // Countdown de 2 minutos (120 segundos)
      countdownRef.current = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          console.log('[SessionTimeout] 🔴 Countdown terminado');
          if (countdownRef.current) clearInterval(countdownRef.current);
        } else {
          onWarning(secondsLeft);
        }
      }, 1000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Cierre de sesión automático a los 5 minutos
    timeoutRef.current = setTimeout(() => {
      console.log('[SessionTimeout] 🛑 TIMEOUT DISPARADO - Cerrando sesión');
      if (countdownRef.current) clearInterval(countdownRef.current);
      clearAllTimers();
      onTimeout();
    }, INACTIVITY_TIMEOUT);

    console.log('[SessionTimeout] Timers configurados correctamente');
  }, [isEnabled, onTimeout, onWarning, onClearWarning, clearAllTimers]);

  useEffect(() => {
    console.log('[SessionTimeout] useEffect ejecutado - isEnabled:', isEnabled);

    if (!isEnabled) {
      console.log('[SessionTimeout] Deshabilitado, limpiando timers');
      clearAllTimers();
      onClearWarning();
      return;
    }

    // Eventos de interacción de usuario
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      const now = Date.now();
      // Throttle de actividad a mínimo 2 segundos para evitar saturar timers por eventos repetitivos
      if (now - lastActivityTimestampRef.current < 2000) {
        return;
      }
      lastActivityTimestampRef.current = now;

      // Si la advertencia ya está visible en pantalla, no la cerramos silenciosamente por un clic o tecla accidental.
      // El usuario debe presionar "Mantener sesión activa" o "Cerrar sesión" en el modal.
      if (isWarningActiveRef.current) {
        console.log('[SessionTimeout] Actividad detectada mientras el modal de advertencia está abierto. Manteniendo advertencia.');
        return;
      }

      console.log('[SessionTimeout] 🖱️ Actividad detectada -', new Date().toLocaleTimeString());
      resetTimers();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
      console.log(`[SessionTimeout] Event listener agregado: ${event}`);
    });

    resetTimers();

    return () => {
      console.log('[SessionTimeout] Cleanup - removiendo event listeners');
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [isEnabled, resetTimers, clearAllTimers, onClearWarning]);

  return { resetTimers, clearAllTimers };
};
