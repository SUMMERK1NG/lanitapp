import React from 'react';
import { RefreshCw, Calculator, TrendingUp, DollarSign, Euro } from 'lucide-react';
import type { ExchangeRatesData } from '../types/index.ts';

interface ExchangeRateBannerProps {
  rates: ExchangeRatesData;
  loading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenConverter: () => void;
}

export const ExchangeRateBanner: React.FC<ExchangeRateBannerProps> = ({
  rates,
  loading,
  isRefreshing,
  onRefresh,
  onOpenConverter,
}) => {
  return (
    <div className="bg-[#1c2e4a]/95 border-y sm:border sm:rounded-2xl border-[#2a4365] px-3 sm:px-4 py-2.5 shadow-md">
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* Rates Display Group */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 text-xs">
          {/* BCV Dollar */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#203657]/80 border border-[#2a4365]">
            <div className="w-5 h-5 rounded-lg bg-[#147df0]/20 text-[#147df0] flex items-center justify-center font-bold text-[10px]">
              <DollarSign className="w-3 h-3" />
            </div>
            <div>
              <span className="text-[10px] text-[#9ba3af] font-medium block leading-none">Dólar BCV</span>
              <span className="text-xs font-bold text-white tracking-tight">
                Bs. {rates.bcvDollar.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Parallel Dollar */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#203657]/80 border border-[#2a4365]">
            <div className="w-5 h-5 rounded-lg bg-[#ff914d]/20 text-[#ff914d] flex items-center justify-center font-bold text-[10px]">
              <TrendingUp className="w-3 h-3" />
            </div>
            <div>
              <span className="text-[10px] text-[#9ba3af] font-medium block leading-none">Promedio</span>
              <span className="text-xs font-bold text-white tracking-tight">
                Bs. {rates.parallelDollar.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* BCV Euro */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#203657]/80 border border-[#2a4365]">
            <div className="w-5 h-5 rounded-lg bg-[#00c2c7]/20 text-[#00c2c7] flex items-center justify-center font-bold text-[10px]">
              <Euro className="w-3 h-3" />
            </div>
            <div>
              <span className="text-[10px] text-[#9ba3af] font-medium block leading-none">Euro BCV</span>
              <span className="text-xs font-bold text-white tracking-tight">
                Bs. {rates.bcvEuro.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Exchange Spread */}
          <div className="hidden md:flex items-center gap-1 text-[11px] font-semibold text-[#ff914d] bg-[#ff914d]/10 border border-[#ff914d]/30 px-2 py-1 rounded-lg">
            <span>Brecha:</span>
            <span>+{rates.spreadPercentage}%</span>
          </div>
        </div>

        {/* Action Controls: Refresh & Converter */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            onClick={onOpenConverter}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#147df0] to-[#00c2c7] text-white text-xs font-bold shadow-sm shadow-[#147df0]/30 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            title="Abrir Calculadora y Conversor de Divisas"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Calculadora</span>
            <span className="sm:hidden">Conversor</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing || loading}
            className="p-1.5 rounded-xl bg-[#203657] hover:bg-[#29446c] text-[#9ba3af] hover:text-white border border-[#2a4365] transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title={`Actualizado: ${rates.lastUpdated}. Clic para refrescar.`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00c2c7]' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
