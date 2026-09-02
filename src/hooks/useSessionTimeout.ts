import { useEffect, useRef, useCallback } from 'react';

export const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos (300 segundos)
export const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // 2 minutos antes (120 segundos)

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

  // Timestamps de ejecución programada para inspección en Debug
  const warningTargetTimeRef = useRef<number | null>(null);
  const timeoutTargetTimeRef = useRef<number | null>(null);

  // Guardar callbacks en refs para garantizar estabilidad y evitar que re-renders de App reseteen los timers
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);
  const onClearWarningRef = useRef(onClearWarning);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onWarningRef.current = onWarning;
    onClearWarningRef.current = onClearWarning;
  });

  console.log('🔵 [SessionTimeout] Hook llamado - isEnabled:', isEnabled, 'Timestamp:', new Date().toLocaleTimeString());

  const clearAllTimers = useCallback(() => {
    console.log('🔴 [SessionTimeout] Limpiando timers');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      console.log('✅ Timeout limpiado');
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
      console.log('✅ Warning limpiado');
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
      console.log('✅ Countdown limpiado');
    }
    isWarningActiveRef.current = false;
    warningTargetTimeRef.current = null;
    timeoutTargetTimeRef.current = null;
  }, []);

  const resetTimers = useCallback(() => {
    console.log('🟡 [SessionTimeout] resetTimers llamado - isEnabled:', isEnabled);
    console.log('[SessionTimeout] Fecha actual:', new Date().toLocaleString());

    clearAllTimers();
    onClearWarningRef.current();

    if (!isEnabled) {
      console.log('⚠️ [SessionTimeout] Hook deshabilitado, NO crear timers');
      return;
    }

    const now = Date.now();
    const warningTime = INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT; // 3 minutos = 180,000 ms

    warningTargetTimeRef.current = now + warningTime;
    timeoutTargetTimeRef.current = now + INACTIVITY_TIMEOUT;

    console.log(`⏰ [SessionTimeout] Configurando timers:`);
    console.log(`   - Warning en: ${warningTime / 1000}s (${warningTime / 60000} min)`);
    console.log(`   - Timeout en: ${INACTIVITY_TIMEOUT / 1000}s (${INACTIVITY_TIMEOUT / 60000} min)`);
    console.log(`   - Warning se disparará a las: ${new Date(now + warningTime).toLocaleTimeString()}`);
    console.log(`   - Timeout se disparará a las: ${new Date(now + INACTIVITY_TIMEOUT).toLocaleTimeString()}`);

    // Advertencia a los 3 minutos
    console.log('🟠 [SessionTimeout] Creando warningRef...');
    warningRef.current = setTimeout(() => {
      console.log('🟠🟠 [SessionTimeout] ⚠️ WARNING DISPARADO - Timestamp:', new Date().toLocaleTimeString());
      isWarningActiveRef.current = true;
      let secondsLeft = Math.floor(WARNING_BEFORE_TIMEOUT / 1000);
      onWarningRef.current(secondsLeft);

      // Countdown de 2 minutos (120 segundos)
      countdownRef.current = setInterval(() => {
        secondsLeft -= 1;
        console.log(`⏳ [SessionTimeout] Countdown: ${secondsLeft}s restantes`);
        if (secondsLeft <= 0) {
          console.log('🛑 [SessionTimeout] Countdown terminado');
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        } else {
          onWarningRef.current(secondsLeft);
        }
      }, 1000);
    }, warningTime);

    // Timeout final a los 5 minutos
    console.log('🔴 [SessionTimeout] Creando timeoutRef...');
    timeoutRef.current = setTimeout(() => {
      console.log('🔴🔴🔴 [SessionTimeout] TIMEOUT FINAL DISPARADO - Timestamp:', new Date().toLocaleTimeString());
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      clearAllTimers();
      onTimeoutRef.current();
    }, INACTIVITY_TIMEOUT);

    console.log('✅ [SessionTimeout] Timers configurados correctamente');
    console.log('   [SessionTimeout] timeoutRef ID:', timeoutRef.current);
    console.log('   [SessionTimeout] warningRef ID:', warningRef.current);
  }, [isEnabled, clearAllTimers]);

  useEffect(() => {
    console.log('🟣 [SessionTimeout] useEffect montado/actualizado - isEnabled:', isEnabled);

    if (!isEnabled) {
      console.log('⚠️ [SessionTimeout] Deshabilitado, limpiando');
      clearAllTimers();
      onClearWarningRef.current();
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = (e: Event) => {
      const now = Date.now();
      // Throttle de actividad a 2.5s para no disparar reinicios innecesarios por eventos seguidos
      if (now - lastActivityTimestampRef.current < 2500) {
        return;
      }
      lastActivityTimestampRef.current = now;

      // Si el modal de advertencia ya está visible en pantalla, no lo cerramos con cualquier toque accidental
      if (isWarningActiveRef.current) {
        console.log('[SessionTimeout] Actividad detectada mientras el modal de advertencia está abierto. Manteniendo advertencia.');
        return;
      }

      console.log(`🖱️ [SessionTimeout] Actividad detectada (${e.type}): ${new Date().toLocaleTimeString()} - Reset timers`);
      resetTimers();
    };

    console.log('[SessionTimeout] Agregando event listeners...');
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
      console.log(`  ✅ Listener agregado: ${event}`);
    });

    // Iniciar temporizador
    resetTimers();

    return () => {
      console.log('🧹 [SessionTimeout] Cleanup - removiendo listeners');
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      clearAllTimers();
    };
  }, [isEnabled, resetTimers, clearAllTimers]);

  // Función para debug: inspeccionar estado actual de timers
  const getTimerStatus = useCallback(() => {
    const now = Date.now();
    const warningIn = warningTargetTimeRef.current ? Math.max(0, Math.round((warningTargetTimeRef.current - now) / 1000)) : null;
    const timeoutIn = timeoutTargetTimeRef.current ? Math.max(0, Math.round((timeoutTargetTimeRef.current - now) / 1000)) : null;

    return {
      isEnabled,
      hasTimeout: timeoutRef.current !== null,
      hasWarning: warningRef.current !== null,
      hasCountdown: countdownRef.current !== null,
      isWarningActive: isWarningActiveRef.current,
      warningTargetTime: warningTargetTimeRef.current ? new Date(warningTargetTimeRef.current).toLocaleTimeString() : 'N/A',
      timeoutTargetTime: timeoutTargetTimeRef.current ? new Date(timeoutTargetTimeRef.current).toLocaleTimeString() : 'N/A',
      secondsToWarning: warningIn,
      secondsToTimeout: timeoutIn,
    };
  }, [isEnabled]);

  return { resetTimers, clearAllTimers, getTimerStatus };
};
