import React from 'react';
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, PiggyBank } from 'lucide-react';

interface MetricsCardsProps {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  currency?: string;
  monthName?: string;
  bcvRate?: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  balance,
  totalIncome,
  totalExpense,
  currency = '$',
  monthName = 'Mes Actual',
  bcvRate,
}) => {
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;
  const rate = bcvRate && bcvRate > 0 ? bcvRate : 0;
  const balanceBs = balance * rate;

  const formatCurrency = (val: number) => {
    return `${currency}${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-3">
      {/* Primary Balance Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#147df0] via-[#106ad0] to-[#203657] text-white p-5 shadow-xl shadow-[#147df0]/20 border border-[#147df0]/30">
        {/* Background decorative glows */}
        <div className="absolute -right-8 -top-8 w-36 h-36 bg-[#00c2c7]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-[#ff914d]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between text-blue-100/90 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[#00c2c7]" />
              Balance Disponible
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20">
              {monthName}
            </span>
          </div>

          <div className="my-2">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-sm">
              {formatCurrency(balance)}
            </h2>
            <p className="text-xs md:text-sm font-medium text-slate-300 mt-1">
              ≈ Bs. {balanceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: Bs. {rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs border-t border-white/15">
            <div className="flex items-center gap-1.5 text-blue-100">
              <PiggyBank className="w-3.5 h-3.5 text-[#00c2c7]" />
              <span>Tasa de Ahorro: <strong className="text-white font-bold">{savingsRate}%</strong></span>
            </div>
            <div className="flex items-center gap-1 text-[#00c2c7] font-bold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{balance >= 0 ? 'Saludable' : 'Déficit'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Income & Expense Split Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Income Card */}
        <div className="bg-[#203657] border border-[#2a4365] p-3.5 sm:p-4 rounded-2xl shadow-sm hover:border-[#00c2c7]/40 transition-all">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#00c2c7]/20 border border-[#00c2c7]/30 flex items-center justify-center text-[#00c2c7]">
              <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-xs font-semibold text-[#9ba3af]">Ingresos</span>
          </div>
          <p className="text-base sm:text-xl font-black text-[#00c2c7]">
            +{formatCurrency(totalIncome)}
          </p>
        </div>

        {/* Expense Card */}
        <div className="bg-[#203657] border border-[#2a4365] p-3.5 sm:p-4 rounded-2xl shadow-sm hover:border-[#ff914d]/40 transition-all">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#ff914d]/20 border border-[#ff914d]/30 flex items-center justify-center text-[#ff914d]">
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-xs font-semibold text-[#9ba3af]">Gastos & Pagos</span>
          </div>
          <p className="text-base sm:text-xl font-black text-[#ff914d]">
            -{formatCurrency(totalExpense)}
          </p>
        </div>
      </div>
    </div>
  );
};
