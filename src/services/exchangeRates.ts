import type { ExchangeRatesData } from '../types/index.ts';
import { logger } from '../utils/logger.ts';

// Endpoints principales y de contingencia para tasas venezolanas
const DOLARFLOW_OFICIAL_URL = 'https://dolarflow.com/api/oficial/';
const DOLARFLOW_PARALELO_URL = 'https://dolarflow.com/api/paralelo/';
const DOLARVZLA_BCV_URL = 'https://rates.dolarvzla.com/bcv/current.json';
const DOLAR_API_BASE_URL = import.meta.env.VITE_DOLAR_API_BASE_URL || 'https://ve.dolarapi.com/v1';

const CACHE_KEY = 'lanitapp_exchange_rates_cache_v2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de tiempo de vida

// Fallback configurable desde variables de entorno con valores por defecto seguros
const ENV_FALLBACK_USD = Number(import.meta.env.VITE_FALLBACK_USD_RATE);
const ENV_FALLBACK_PARALLEL = Number(import.meta.env.VITE_FALLBACK_PARALLEL_RATE);
const ENV_FALLBACK_EUR = Number(import.meta.env.VITE_FALLBACK_EUR_RATE);

/**
 * Genera tasas de cambio de respaldo seguras en caso de desconexión total
 */
export const getFallbackRates = (): ExchangeRatesData => {
  const bcvDollar = Number.isFinite(ENV_FALLBACK_USD) && ENV_FALLBACK_USD > 0 ? ENV_FALLBACK_USD : 813.74;
  const parallelDollar = Number.isFinite(ENV_FALLBACK_PARALLEL) && ENV_FALLBACK_PARALLEL > 0 ? ENV_FALLBACK_PARALLEL : 965.00;
  const bcvEuro = Number.isFinite(ENV_FALLBACK_EUR) && ENV_FALLBACK_EUR > 0 ? ENV_FALLBACK_EUR : 945.65;
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

interface CachedPayload {
  data: ExchangeRatesData;
  timestamp: number;
}

/**
 * Realiza un fetch con timeout estricto y cache-busting para evitar respuestas viejas del navegador o CDN
 */
async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cacheBustUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;

  try {
    const response = await fetch(cacheBustUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta de tasas de cambio con arquitectura de triple redundancia:
 * 1. DolarFlow API (Scraping directo a BCV y P2P Binance/Bybit en tiempo real)
 * 2. DolarVzla CDN (JSON estático con tasa oficial del día y fecha valor)
 * 3. DolarAPI Venezuela (Multi-moneda de respaldo)
 */
export async function fetchExchangeRates(forceRefresh = false): Promise<ExchangeRatesData> {
  const fallbackRates = getFallbackRates();

  // 1. Revisar caché local si no es forzado y está vigente (< 5 min)
  let cachedPayload: CachedPayload | null = null;
  const cachedRaw = localStorage.getItem(CACHE_KEY);
  if (cachedRaw) {
    try {
      cachedPayload = JSON.parse(cachedRaw);
    } catch {
      cachedPayload = null;
    }
  }

  const isCacheValid = cachedPayload && (Date.now() - cachedPayload.timestamp < CACHE_TTL_MS);
  if (!forceRefresh && isCacheValid && cachedPayload) {
    // Si estamos offline o la caché es muy reciente, la usamos de inmediato
    if (!navigator.onLine || Date.now() - cachedPayload.timestamp < 60 * 1000) {
      return cachedPayload.data;
    }
  }

  // Valores base acumulativos (si un proveedor falla en una tasa, no perdemos las otras)
  let bcvDollar = cachedPayload?.data.bcvDollar || fallbackRates.bcvDollar;
  let parallelDollar = cachedPayload?.data.parallelDollar || fallbackRates.parallelDollar;
  let bcvEuro = cachedPayload?.data.bcvEuro || fallbackRates.bcvEuro;
  let hasBcvUpdated = false;
  let hasParallelUpdated = false;
  let hasEuroUpdated = false;
  let latestIsoTimestamp: string | null = null;

  // -------------------------------------------------------------
  // PROVEEDOR 1: DolarFlow API (BCV directo y P2P Binance en vivo)
  // -------------------------------------------------------------
  try {
    const [dfOficialRes, dfParaleloRes] = await Promise.allSettled([
      fetchWithTimeout(DOLARFLOW_OFICIAL_URL),
      fetchWithTimeout(DOLARFLOW_PARALELO_URL),
    ]);

    if (dfOficialRes.status === 'fulfilled' && dfOficialRes.value.ok) {
      const data = await dfOficialRes.value.json();
      const val = Number(data?.precio || data?.promedio);
      if (Number.isFinite(val) && val > 0) {
        bcvDollar = val;
        hasBcvUpdated = true;
        if (data.fechaActualizacion) latestIsoTimestamp = data.fechaActualizacion;
      }
    }

    if (dfParaleloRes.status === 'fulfilled' && dfParaleloRes.value.ok) {
      const data = await dfParaleloRes.value.json();
      const val = Number(data?.precio || data?.promedio);
      if (Number.isFinite(val) && val > 0) {
        parallelDollar = val;
        hasParallelUpdated = true;
        if (!latestIsoTimestamp && data.fechaActualizacion) {
          latestIsoTimestamp = data.fechaActualizacion;
        }
      }
    }
  } catch (err) {
    logger.warn('[ExchangeRates] DolarFlow no respondió, conmutando a respaldos...', err);
  }

  // -------------------------------------------------------------
  // PROVEEDOR 2: DolarVzla CDN (Respaldo directo para BCV y Euro)
  // -------------------------------------------------------------
  if (!hasBcvUpdated || !hasEuroUpdated) {
    try {
      const dvRes = await fetchWithTimeout(DOLARVZLA_BCV_URL);
      if (dvRes.ok) {
        const dvData = await dvRes.json();
        if (dvData?.current) {
          const dvUsd = Number(dvData.current.usd);
          const dvEur = Number(dvData.current.eur);

          if (!hasBcvUpdated && Number.isFinite(dvUsd) && dvUsd > 0) {
            bcvDollar = dvUsd;
            hasBcvUpdated = true;
          }
          if (Number.isFinite(dvEur) && dvEur > 0) {
            bcvEuro = dvEur;
            hasEuroUpdated = true;
          }
          if (dvData.current.date && !latestIsoTimestamp) {
            latestIsoTimestamp = dvData.current.date;
          }
        }
      }
    } catch (err) {
      logger.warn('[ExchangeRates] DolarVzla CDN no respondió, conmutando a DolarAPI...', err);
    }
  }

  // -------------------------------------------------------------
  // PROVEEDOR 3: DolarAPI Venezuela (Multi-moneda de contingencia)
  // -------------------------------------------------------------
  if (!hasBcvUpdated || !hasParallelUpdated || !hasEuroUpdated) {
    try {
      const [dolaresRes, eurosRes] = await Promise.allSettled([
        fetchWithTimeout(`${DOLAR_API_BASE_URL}/dolares`),
        fetchWithTimeout(`${DOLAR_API_BASE_URL}/euros`),
      ]);

      if (dolaresRes.status === 'fulfilled' && dolaresRes.value.ok) {
        const dolaresData = await dolaresRes.value.json();
        if (Array.isArray(dolaresData)) {
          const oficial = dolaresData.find((d: any) => d.fuente === 'oficial' || d.nombre?.toLowerCase().includes('oficial') || d.fuente === 'bcv');
          const paralelo = dolaresData.find((d: any) => d.fuente === 'paralelo' || d.nombre?.toLowerCase().includes('paralelo') || d.fuente === 'promedio');

          if (!hasBcvUpdated && oficial?.promedio) {
            bcvDollar = Number(oficial.promedio);
            hasBcvUpdated = true;
          }
          if (!hasParallelUpdated && paralelo?.promedio) {
            parallelDollar = Number(paralelo.promedio);
            hasParallelUpdated = true;
          }
          if (oficial?.fechaActualizacion && !latestIsoTimestamp) {
            latestIsoTimestamp = oficial.fechaActualizacion;
          }
        }
      }

      if (eurosRes.status === 'fulfilled' && eurosRes.value.ok) {
        const eurosData = await eurosRes.value.json();
        if (Array.isArray(eurosData)) {
          const euroOficial = eurosData.find((e: any) => e.fuente === 'oficial' || e.fuente === 'bcv' || e.nombre?.toLowerCase().includes('oficial'));
          if (euroOficial?.promedio) {
            bcvEuro = Number(euroOficial.promedio);
            hasEuroUpdated = true;
          }
        } else if (eurosData?.promedio) {
          bcvEuro = Number(eurosData.promedio);
          hasEuroUpdated = true;
        }
      }
    } catch (err) {
      logger.error('[ExchangeRates] Error en DolarAPI contingencia:', err);
    }
  }

  // Formatear hora de última actualización legible
  let formattedUpdated = new Date().toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (latestIsoTimestamp) {
    try {
      const parsedDate = new Date(latestIsoTimestamp);
      if (!isNaN(parsedDate.getTime())) {
        formattedUpdated = parsedDate.toLocaleString('es-VE', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {}
  }

  const spreadPercentage = bcvDollar > 0
    ? Number((((parallelDollar - bcvDollar) / bcvDollar) * 100).toFixed(2))
    : 0;

  const result: ExchangeRatesData = {
    bcvDollar,
    parallelDollar,
    bcvEuro,
    spreadPercentage,
    lastUpdated: formattedUpdated,
  };

  // Guardar en caché persistente con marca de tiempo
  try {
    const payloadToCache: CachedPayload = {
      data: result,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payloadToCache));
  } catch (e) {
    logger.warn('No se pudo guardar la tasa en localStorage', e);
  }

  return result;
}
