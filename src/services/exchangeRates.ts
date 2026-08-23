import type { ExchangeRatesData } from '../types/index.ts';

const CACHE_KEY = 'lanitapp_exchange_rates_cache';

// Fallback rates if offline and no cache is present
const DEFAULT_FALLBACK_RATES: ExchangeRatesData = {
  bcvDollar: 65.40,
  parallelDollar: 77.20,
  bcvEuro: 70.80,
  spreadPercentage: 18.04,
  lastUpdated: new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
};

export async function fetchExchangeRates(): Promise<ExchangeRatesData> {
  try {
    // 1. Check cached data first
    const cached = localStorage.getItem(CACHE_KEY);
    let cachedData: ExchangeRatesData | null = null;
    if (cached) {
      try {
        cachedData = JSON.parse(cached);
      } catch (e) {
        console.warn('Error reading exchange rates cache', e);
      }
    }

    if (!navigator.onLine && cachedData) {
      return cachedData;
    }

    // 2. Fetch live data from DolarAPI
    const [dolaresRes, eurosRes] = await Promise.allSettled([
      fetch('https://ve.dolarapi.com/v1/dolares', { headers: { Accept: 'application/json' } }),
      fetch('https://ve.dolarapi.com/v1/euros', { headers: { Accept: 'application/json' } }),
    ]);

    let bcvDollar = cachedData?.bcvDollar || DEFAULT_FALLBACK_RATES.bcvDollar;
    let parallelDollar = cachedData?.parallelDollar || DEFAULT_FALLBACK_RATES.parallelDollar;
    let bcvEuro = cachedData?.bcvEuro || DEFAULT_FALLBACK_RATES.bcvEuro;
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
    console.error('Error fetching exchange rates from DolarAPI:', error);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return DEFAULT_FALLBACK_RATES;
      }
    }
    return DEFAULT_FALLBACK_RATES;
  }
}
