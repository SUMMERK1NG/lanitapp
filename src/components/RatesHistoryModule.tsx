import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronDown,
  RefreshCw,
  LineChart as LineChartIcon,
  Check,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export type RateTypeOption = 'bcv_usd' | 'parallel_usd' | 'bcv_eur';
export type TimeframeOption = '7d' | '15d' | '30d' | 'all';

interface HistoricalRateEntry {
  fecha: string;
  promedio: number;
  compra?: number | null;
  venta?: number | null;
  fuente?: string;
}

// URL base configurable para la API de tasas de cambio con fallback seguro
const DOLAR_API_BASE_URL = import.meta.env.VITE_DOLAR_API_BASE_URL || 'https://ve.dolarapi.com/v1';

const RATE_OPTIONS: { id: RateTypeOption; label: string; icon: string; color: string; url: string }[] = [
  {
    id: 'bcv_usd',
    label: 'BCV Dólar Oficial',
    icon: '🏛️',
    color: '#147DF0',
    url: `${DOLAR_API_BASE_URL}/historicos/dolares/oficial`,
  },
  {
    id: 'parallel_usd',
    label: 'Dólar Promedio',
    icon: '⚡',
    color: '#FF914D',
    url: `${DOLAR_API_BASE_URL}/historicos/dolares/paralelo`,
  },
  {
    id: 'bcv_eur',
    label: 'Euro BCV Oficial',
    icon: '🇪🇺',
    color: '#00C2C7',
    url: `${DOLAR_API_BASE_URL}/historicos/euros/oficial`,
  },
];

const TIMEFRAMES: { id: TimeframeOption; label: string; days: number }[] = [
  { id: '7d', label: '7 días', days: 7 },
  { id: '15d', label: '15 días', days: 15 },
  { id: '30d', label: '30 días', days: 30 },
  { id: 'all', label: 'Todo', days: 365 },
];

const SPANISH_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SPANISH_MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function formatSpanishDate(dateStr: string): { labelShort: string; fullFormatted: string } {
  const d = parseLocalDate(dateStr);
  const dayName = SPANISH_DAYS_SHORT[d.getDay()];
  const dayNum = d.getDate();
  const monthName = SPANISH_MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();

  return {
    labelShort: `${dayName} ${dayNum} ${monthName}`,
    fullFormatted: `${dayName}, ${dayNum} de ${monthName} de ${year}`,
  };
}

export const RatesHistoryModule: React.FC = () => {
  const [selectedRateType, setSelectedRateType] = useState<RateTypeOption>('bcv_usd');
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('15d');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [historyData, setHistoryData] = useState<Record<RateTypeOption, HistoricalRateEntry[]>>({
    bcv_usd: [],
    parallel_usd: [],
    bcv_eur: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch historical data with localStorage cache
  const fetchHistoricalData = async (rateType: RateTypeOption) => {
    const config = RATE_OPTIONS.find((r) => r.id === rateType);
    if (!config) return;

    const cacheKey = `lanitapp_hist_${rateType}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistoryData((prev) => ({ ...prev, [rateType]: parsed }));
        }
      } catch (e) {
        console.warn('Error reading history cache', e);
      }
    }

    if (!navigator.onLine && cached) return;

    setIsLoading(true);
    try {
      const res = await fetch(config.url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Sort by date ascending
          const sorted = [...data].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
          setHistoryData((prev) => ({ ...prev, [rateType]: sorted }));
          localStorage.setItem(cacheKey, JSON.stringify(sorted));
        }
      }
    } catch (err) {
      console.error('Error fetching historical rates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData(selectedRateType);
  }, [selectedRateType]);

  const activeConfig = RATE_OPTIONS.find((r) => r.id === selectedRateType) || RATE_OPTIONS[0];
  const rawList = historyData[selectedRateType] || [];

  // Filter based on selected timeframe
  const filteredList = useMemo(() => {
    if (rawList.length === 0) return [];
    const tf = TIMEFRAMES.find((t) => t.id === selectedTimeframe) || TIMEFRAMES[1];
    if (tf.id === 'all') return rawList;
    return rawList.slice(-tf.days);
  }, [rawList, selectedTimeframe]);

  // Format list for chart
  const chartData = useMemo(() => {
    return filteredList.map((item, idx, arr) => {
      const d = parseLocalDate(item.fecha);
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const dateLabel = `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}`;

      let changePct = 0;
      if (idx > 0 && arr[idx - 1].promedio > 0) {
        const prev = arr[idx - 1].promedio;
        changePct = +(((item.promedio - prev) / prev) * 100).toFixed(2);
      }

      return {
        date: dateLabel,
        fullDate: formatSpanishDate(item.fecha).fullFormatted,
        rate: Number(item.promedio.toFixed(2)),
        changePct,
      };
    });
  }, [filteredList]);

  // Reversed list for chronological change log (most recent first)
  const changeLog = useMemo(() => {
    if (filteredList.length === 0) return [];
    const reversed = [...filteredList].reverse();
    return reversed.map((item) => {
      const idxInRaw = rawList.findIndex((r) => r.fecha === item.fecha);
      let changePct = 0;
      if (idxInRaw > 0 && rawList[idxInRaw - 1].promedio > 0) {
        const prev = rawList[idxInRaw - 1].promedio;
        changePct = +(((item.promedio - prev) / prev) * 100).toFixed(2);
      }

      const { labelShort } = formatSpanishDate(item.fecha);

      return {
        id: item.fecha,
        dateFormatted: labelShort,
        rate: item.promedio,
        changePct,
      };
    });
  }, [filteredList, rawList]);

  const minRate = useMemo(() => {
    if (chartData.length === 0) return 0;
    const min = Math.min(...chartData.map((d) => d.rate));
    return Math.floor(min * 0.98);
  }, [chartData]);

  const maxRate = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map((d) => d.rate));
    return Math.ceil(max * 1.02);
  }, [chartData]);

  return (
    <div className="space-y-4">
      {/* Selector Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-surface border border-app shadow-md">
        {/* Custom Rate Selector Dropdown */}
        <div className="relative">
          <label className="block text-[10px] uppercase font-bold text-muted mb-1">
            Tasa Seleccionada
          </label>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-card border border-app hover:border-app-hover text-xs font-bold text-app transition-all cursor-pointer min-w-[210px]"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{activeConfig.icon}</span>
              <span style={{ color: activeConfig.color }}>{activeConfig.label}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isDropdownOpen ? 'rotate-180 text-primary-custom' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-surface border border-app rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in-50 zoom-in-95">
              {RATE_OPTIONS.map((opt) => {
                const isSelected = opt.id === selectedRateType;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedRateType(opt.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected ? 'bg-card font-bold text-app' : 'hover:bg-card/60 text-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-xs font-bold" style={{ color: isSelected ? opt.color : undefined }}>
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4" style={{ color: opt.color }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Timeframe Pills & Refresh */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="flex items-center gap-1 p-1 bg-card rounded-2xl border border-app">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setSelectedTimeframe(tf.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedTimeframe === tf.id
                    ? 'bg-primary-custom text-white shadow-sm'
                    : 'text-muted hover:text-app'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchHistoricalData(selectedRateType)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-card border border-app text-muted hover:text-app transition-colors cursor-pointer"
            title="Actualizar histórico"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary-custom' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid: Chart + Registered Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart Card */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
                style={{ backgroundColor: `${activeConfig.color}25`, color: activeConfig.color }}
              >
                <LineChartIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-app uppercase tracking-wider">
                  Evolución de la Tasa
                </h3>
                <span className="text-[10px] text-muted">
                  Comportamiento histórico en Bolívares (Bs.)
                </span>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="text-right">
                <span className="text-[10px] text-muted block uppercase">Última Cotización</span>
                <span className="text-base font-black" style={{ color: activeConfig.color }}>
                  Bs. {chartData[chartData.length - 1].rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted">
              {isLoading ? 'Cargando datos históricos...' : 'No hay datos históricos disponibles'}
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gradient_${selectedRateType}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" opacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#2a4365' }}
                  />
                  <YAxis
                    domain={[minRate, maxRate]}
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#2a4365' }}
                    tickFormatter={(val) => `Bs.${val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 rounded-xl bg-surface border border-app shadow-2xl text-xs space-y-1">
                            <span className="text-[10px] text-muted block font-semibold">{data.fullDate}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm" style={{ color: activeConfig.color }}>
                                Bs. {data.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                              </span>
                              {data.changePct !== 0 && (
                                <span
                                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                    data.changePct > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                                  }`}
                                >
                                  {data.changePct > 0 ? `▲ +${data.changePct}%` : `▼ ${data.changePct}%`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke={activeConfig.color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#gradient_${selectedRateType})`}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: activeConfig.color }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Registered Changes Table Card */}
        <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-app pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-app uppercase tracking-wider">
                  Cambios Registrados
                </h3>
                <span className="text-[10px] text-muted">Historial de variaciones</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-muted">
              {changeLog.length} registros
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {changeLog.length === 0 ? (
              <p className="text-xs text-muted py-8 text-center">Sin registros recientes</p>
            ) : (
              changeLog.map((log) => {
                const isPositive = log.changePct > 0;
                const isNegative = log.changePct < 0;

                return (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-2xl bg-card border border-app hover:border-app-hover transition-all flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-xs font-bold text-app block">{log.dateFormatted}</span>
                      <span className="text-[10px] text-muted">{log.id}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Variation badge */}
                      <span
                        className={`text-[11px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : isNegative
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-muted/10 text-muted'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : isNegative ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        <span>{isPositive ? `+${log.changePct}%` : log.changePct === 0 ? '0%' : `${log.changePct}%`}</span>
                      </span>

                      {/* Value */}
                      <span className="text-xs font-black text-app">
                        {log.rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
