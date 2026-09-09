import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchExchangeRates, getFallbackRates } from '../services/exchangeRates.ts';
import type { ExchangeRatesData } from '../types/index.ts';
import { logger } from '../utils/logger.ts';

const AUTO_REFRESH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
const MIN_REFOCUS_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos mínimo entre re-enfoques de pantalla

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRatesData>(() => getFallbackRates());
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);

  const refreshRates = useCallback(async (force = false) => {
    setIsRefreshing(true);
    try {
      const data = await fetchExchangeRates(force);
      setRates(data);
      lastFetchTimeRef.current = Date.now();
    } catch (e) {
      logger.warn('Error refreshing exchange rates:', e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial forzada para obtener los datos más frescos
    refreshRates(true);

    // 1. Sondeo periódico cada 3 minutos si hay conexión
    const interval = setInterval(() => {
      if (navigator.onLine) {
        refreshRates(false);
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    // 2. Refresco inteligente al volver a la app o desbloquear pantalla
    const handleVisibilityOrFocus = () => {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine &&
        Date.now() - lastFetchTimeRef.current > MIN_REFOCUS_INTERVAL_MS
      ) {
        logger.dev('[ExchangeRates] App en primer plano, actualizando tasas en vivo...');
        refreshRates(false);
      }
    };

    // 3. Refresco inmediato al recuperar conexión a internet
    const handleOnline = () => {
      logger.dev('[ExchangeRates] Conexión recuperada, sincronizando tasas...');
      refreshRates(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshRates]);

  return {
    rates,
    loading,
    isRefreshing,
    refreshRates,
  };
}
