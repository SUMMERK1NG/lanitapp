import { useState, useEffect, useCallback } from 'react';
import { fetchExchangeRates } from '../services/exchangeRates.ts';
import type { ExchangeRatesData } from '../types/index.ts';

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRatesData>({
    bcvDollar: 65.40,
    parallelDollar: 77.20,
    bcvEuro: 70.80,
    spreadPercentage: 18.04,
    lastUpdated: 'Cargando...',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const refreshRates = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchExchangeRates();
      setRates(data);
    } catch (e) {
      console.warn('Error refreshing exchange rates:', e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRates();
    // Auto refresh every 10 minutes if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        refreshRates();
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshRates]);

  return {
    rates,
    loading,
    isRefreshing,
    refreshRates,
  };
}
