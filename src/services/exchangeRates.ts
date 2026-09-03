import type { ExchangeRatesData } from '../types/index.ts';
import { logger } from '../utils/logger.ts';

// URL base configurable para la API de tasas de cambio con fallback seguro
const DOLAR_API_BASE_URL = import.meta.env.VITE_DOLAR_API_BASE_URL || 'https://ve.dolarapi.com/v1';

const CACHE_KEY = 'lanitapp_exchange_rates_cache';

// Fallback configurable desde variables de entorno con valores por defecto seguros
const ENV_FALLBACK_USD = Number(import.meta.env.VITE_FALLBACK_USD_RATE);
const ENV_FALLBACK_PARALLEL = Number(import.meta.env.VITE_FALLBACK_PARALLEL_RATE);
const ENV_FALLBACK_EUR = Number(import.meta.env.VITE_FALLBACK_EUR_RATE);

/**
 * Genera tasas de cambio de respaldo de forma dinámica:
 * 1. Prioriza variables de entorno VITE_FALLBACK_*_RATE si están configuradas.
 * 2. Si no están configuradas, usa una base conservadora documentada.
 */
export const getFallbackRates = (): ExchangeRatesData => {
  const bcvDollar = Number.isFinite(ENV_FALLBACK_USD) && ENV_FALLBACK_USD > 0 ? ENV_FALLBACK_USD : 65.40;
  const parallelDollar = Number.isFinite(ENV_FALLBACK_PARALLEL) && ENV_FALLBACK_PARALLEL > 0 ? ENV_FALLBACK_PARALLEL : 77.20;
  const bcvEuro = Number.isFinite(ENV_FALLBACK_EUR) && ENV_FALLBACK_EUR > 0 ? ENV_FALLBACK_EUR : 70.80;
  const spreadPercentage = bcvDollar > 0
    ? Number((((parallelDollar - bcvDollar) / bcvDollar) * 100).toFixed(2))
    : 0;

  return {
    bcvDollar,
    parallelDollar,
    bcvEuro,
    spreadPercentage,
    lastUpdated: new Date().toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

export const DEFAULT_FALLBACK_RATES: ExchangeRatesData = getFallbackRates();

export async function fetchExchangeRates(): Promise<ExchangeRatesData> {
  const fallbackRates = getFallbackRates();
  try {
    // 1. Check cached data first
    const cached = localStorage.getItem(CACHE_KEY);
    let cachedData: ExchangeRatesData | null = null;
    if (cached) {
      try {
        cachedData = JSON.parse(cached);
      } catch (e) {
        logger.warn('Error reading exchange rates cache', e);
      }
    }

    if (!navigator.onLine && cachedData) {
      return cachedData;
    }

    // 2. Fetch live data from DolarAPI
    const [dolaresRes, eurosRes] = await Promise.allSettled([
      fetch(`${DOLAR_API_BASE_URL}/dolares`, { headers: { Accept: 'application/json' } }),
      fetch(`${DOLAR_API_BASE_URL}/euros`, { headers: { Accept: 'application/json' } }),
    ]);

    let bcvDollar = cachedData?.bcvDollar || fallbackRates.bcvDollar;
    let parallelDollar = cachedData?.parallelDollar || fallbackRates.parallelDollar;
    let bcvEuro = cachedData?.bcvEuro || fallbackRates.bcvEuro;
    let updateTime = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    if (dolaresRes.status === 'fulfilled' && dolaresRes.value.ok) {
      const dolaresData = await dolaresRes.value.json();
      if (Array.isArray(dolaresData)) {
        const oficial = dolaresData.find((d: any) => d.fuente === 'oficial' || d.nombre?.toLowerCase().includes('oficial') || d.fuente === 'bcv');
        const paralelo = dolaresData.find((d: any) => d.fuente === 'paralelo' || d.nombre?.toLowerCase().includes('paralelo') || d.fuente === 'promedio');

        if (oficial?.promedio) bcvDollar = Number(oficial.promedio);
        if (paralelo?.promedio) parallelDollar = Number(paralelo.promedio);
        if (oficial?.fechaActualizacion) {
          updateTime = new Date(oficial.fechaActualizacion).toLocaleString('es-VE', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      }
    }

    if (eurosRes.status === 'fulfilled' && eurosRes.value.ok) {
      const eurosData = await eurosRes.value.json();
      if (Array.isArray(eurosData)) {
        const euroOficial = eurosData.find((e: any) => e.fuente === 'oficial' || e.fuente === 'bcv' || e.nombre?.toLowerCase().includes('oficial'));
        if (euroOficial?.promedio) bcvEuro = Number(euroOficial.promedio);
      } else if (eurosData?.promedio) {
        bcvEuro = Number(eurosData.promedio);
      }
    }

    const spreadPercentage = bcvDollar > 0
      ? Number((((parallelDollar - bcvDollar) / bcvDollar) * 100).toFixed(2))
      : 0;

    const result: ExchangeRatesData = {
      bcvDollar,
      parallelDollar,
      bcvEuro,
      spreadPercentage,
      lastUpdated: updateTime,
    };

    // Save to local cache
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    return result;
  } catch (error) {
    logger.error('Error fetching exchange rates from DolarAPI:', error);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return fallbackRates;
      }
    }
    return fallbackRates;
  }
};
