import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  scrollRef: React.RefObject<HTMLElement | null>;
  onRefresh?: () => Promise<void> | void;
  threshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  scrollRef,
  onRefresh,
  threshold = 65,
}) => {
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const startYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const triggeredHapticRef = useRef<boolean>(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([20, 40]);
      }
      if (onRefresh) {
        await onRefresh();
      } else {
        // Recarga completa nativa (equivalente a F5 en PWA móvil)
        setTimeout(() => {
          window.location.reload();
        }, 150);
      }
    } catch {
      window.location.reload();
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 400);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      // Solo iniciar si el scroll está en el tope
      if (el.scrollTop <= 0) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
        triggeredHapticRef.current = false;
      } else {
        isPullingRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;

      // Si el elemento se desplazó hacia abajo, cancelar pull
      if (el.scrollTop > 0) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0) {
        // Prevenir el comportamiento por defecto de rebote para control suave
        if (e.cancelable) {
          e.preventDefault();
        }

        // Resistencia no lineal
        const distance = Math.min(diff * 0.45, 95);
        setPullDistance(distance);

        // Haptic feedback al cruzar el umbral
        if (distance >= threshold && !triggeredHapticRef.current) {
          triggeredHapticRef.current = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(25);
          }
        } else if (distance < threshold) {
          triggeredHapticRef.current = false;
        }
      } else {
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!isPullingRef.current || isRefreshing) return;
      isPullingRef.current = false;

      if (pullDistance >= threshold) {
        handleRefresh();
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scrollRef, isRefreshing, pullDistance, threshold, handleRefresh]);

  const isTriggered = pullDistance >= threshold;
  const isVisible = pullDistance > 10 || isRefreshing;

  if (!isVisible) return null;

  return (
    <div
      className="fixed top-14 inset-x-0 flex justify-center z-50 pointer-events-none transition-transform duration-100 ease-out"
      style={{
        transform: `translateY(${isRefreshing ? 12 : Math.max(0, pullDistance - 25)}px)`,
      }}
    >
      <div
        className={`flex items-center gap-2 px-3.5 py-2 rounded-full shadow-2xl backdrop-blur-md border text-xs font-bold transition-all ${
          isTriggered || isRefreshing
            ? 'bg-primary-custom text-white border-white/20 scale-105'
            : 'bg-slate-900/90 text-slate-200 border-slate-700/60'
        }`}
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: !isRefreshing ? `rotate(${pullDistance * 4}deg)` : undefined,
          }}
        />
        <span>
          {isRefreshing
            ? 'Recargando...'
            : isTriggered
            ? 'Suelta para recargar'
            : 'Desliza hacia abajo'}
        </span>
      </div>
    </div>
  );
};
