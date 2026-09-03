import React, { useMemo } from 'react';
import {
  CheckCircle2,
  Filter,
  TrendingUp,
  PiggyBank,
  Wallet,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  PlanningNote,
  ExchangeRatesData,
  SavingsGoal,
  SavingContribution,
  Account,
} from '../../types/index.ts';
import { db } from '../../lib/db.ts';
import { formatCurrencyVE } from '../../utils/numberFormat.ts';

export type CalendarFilterType = 'all' | 'fixed_expenses' | 'debts' | 'pending' | 'paid';

interface CalendarMonthlySidebarProps {
  year: number;
  month: number;
  monthName: string;
  totalCommittedMonth: number;
  totalPaidMonth: number;
  totalPendingMonth: number;
  totalQ1: number;
  totalQ2: number;
  rates?: ExchangeRatesData;
  activeFilter: CalendarFilterType;
  onChangeFilter: (filter: CalendarFilterType) => void;
  planningNote?: PlanningNote;
  userId?: string;
  savingsGoals?: SavingsGoal[];
  savingContributions?: SavingContribution[];
  accounts?: Account[];
}

export const CalendarMonthlySidebar: React.FC<CalendarMonthlySidebarProps> = ({
  year,
  month,
  monthName,
  totalCommittedMonth,
  totalPaidMonth,
  totalPendingMonth,
  totalQ1,
  totalQ2,
  rates,
  activeFilter,
  onChangeFilter,
  savingsGoals: propSavingsGoals,
  savingContributions: propSavingContributions,
  accounts: propAccounts,
}) => {
  // Queries reactivas en vivo como fallback continuo
  const liveGoals = useLiveQuery(() => db.savings_goals.toArray(), []) || [];
  const liveContribs = useLiveQuery(() => db.saving_contributions.toArray(), []) || [];
  const liveAccounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
  const liveTransactions = useLiveQuery(() => db.transactions.toArray(), []) || [];

  const savingsGoals = propSavingsGoals && propSavingsGoals.length > 0 ? propSavingsGoals : liveGoals;
  const savingContributions = propSavingContributions && propSavingContributions.length > 0 ? propSavingContributions : liveContribs;
  const accounts = propAccounts && propAccounts.length > 0 ? propAccounts : liveAccounts;

  // 1. Filtrar aportes de ahorro que correspondan al año y mes seleccionado
  const monthContributions = useMemo(() => {
    return savingContributions.filter((c) => {
      return c.year === year && c.month === month && !c.is_skipped;
    });
  }, [savingContributions, year, month]);

  const totalContributedMonth = useMemo(() => {
    return monthContributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [monthContributions]);

  const activeGoals = useMemo(() => {
    return savingsGoals.filter((g) => g.status !== 'completed');
  }, [savingsGoals]);

  // 2. Cálculo reactivo de saldos de capital por cuenta
  const getAccountBalance = (account: Account) => {
    const accTxs = liveTransactions.filter((t) => t.account_id === account.id);
    const income = accTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const expense = accTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return (Number(account.initial_balance) || 0) + income - expense;
  };

  const { totalCapitalUSD, totalUSD: _totalUSD, totalVES, totalEUR } = useMemo(() => {
    let capUSD = 0;
    let uUSD = 0;
    let uVES = 0;
    let uEUR = 0;
    const bcvDollar = rates?.bcvDollar && rates.bcvDollar > 0 ? rates.bcvDollar : 1;
    const bcvEuro = rates?.bcvEuro && rates.bcvEuro > 0 ? rates.bcvEuro : 1;

    accounts.forEach((acc) => {
      const bal = getAccountBalance(acc);
      if (acc.currency === 'VES') {
        uVES += bal;
        capUSD += bal / bcvDollar;
      } else if (acc.currency === 'EUR') {
        uEUR += bal;
        capUSD += (bal * bcvEuro) / bcvDollar;
      } else {
        uUSD += bal;
        capUSD += bal;
      }
    });

    return { totalCapitalUSD: capUSD, totalUSD: uUSD, totalVES: uVES, totalEUR: uEUR };
  }, [accounts, liveTransactions, rates]);

  const bcvRate = rates?.bcvDollar || 0;
  const progressPercent = totalCommittedMonth > 0
    ? Math.min(100, Math.round((totalPaidMonth / totalCommittedMonth) * 100))
    : 0;

  return (
    <aside className="w-full flex flex-col space-y-4">
      {/* 1. Interactive Calendar Filter (Al inicio para acceso rápido) */}
      <div className="p-3.5 rounded-3xl bg-card border border-app space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-primary-custom" /> Filtrar Calendario
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
          <button
            onClick={() => onChangeFilter('all')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-primary-custom text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => onChangeFilter('fixed_expenses')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'fixed_expenses'
                ? 'bg-[#147DF0] text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Gastos
          </button>
          <button
            onClick={() => onChangeFilter('debts')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'debts'
                ? 'bg-[#FF914D] text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Deudas
          </button>
          <button
            onClick={() => onChangeFilter('pending')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => onChangeFilter('paid')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer col-span-2 ${
              activeFilter === 'paid'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Cubiertos / Pagados
          </button>
        </div>
      </div>

      {/* 2. Global Monthly Summary Card */}
      <div className="p-4 rounded-3xl bg-card border border-app shadow-md space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-app uppercase tracking-wider">
                Resumen de {monthName}
              </h4>
              <span className="text-[10px] text-muted font-medium">Compromisos del mes</span>
            </div>
          </div>

          <span className="text-sm font-black text-primary-custom">
            ${totalCommittedMonth.toFixed(2)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Cubierto: ${totalPaidMonth.toFixed(2)}
            </span>
            <span className="text-slate-400">
              Pendiente: ${totalPendingMonth.toFixed(2)}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60 flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>{progressPercent}% completado</span>
            {bcvRate > 0 && (
              <span>Bs. {formatCurrencyVE(totalCommittedMonth * bcvRate)}</span>
            )}
          </div>
        </div>

        {/* Quincena 15 vs Quincena 30 Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-app">
          <div className="p-2.5 rounded-2xl bg-surface/80 border border-app">
            <span className="text-[10px] font-bold text-muted block uppercase">Quincena 15</span>
            <span className="text-xs font-black text-app block">${totalQ1.toFixed(2)}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-surface/80 border border-app">
            <span className="text-[10px] font-bold text-muted block uppercase">Quincena 30</span>
            <span className="text-xs font-black text-app block">${totalQ2.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 3. Planes de Ahorro & Avance de este mes */}
      <div className="p-4 rounded-3xl bg-card border border-app shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-app uppercase tracking-wider">
                Planes de Ahorro
              </h4>
              <span className="text-[10px] text-muted font-medium">
                Avance de este mes
              </span>
            </div>
          </div>

          {totalContributedMonth > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#00C2C7]/15 text-[#00C2C7] border border-[#00C2C7]/30">
              +${totalContributedMonth.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Resumen del Aporte Mensual */}
        <div className="p-3 rounded-2xl bg-surface border border-app flex items-center justify-between">
          <div>
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">
              Aportado en {monthName}
            </span>
            <span className="text-base font-black text-[#00C2C7]">
              ${totalContributedMonth.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">
              Metas Activas
            </span>
            <span className="text-xs font-bold text-app">
              {activeGoals.length} {activeGoals.length === 1 ? 'meta' : 'metas'}
            </span>
          </div>
        </div>

        {/* Lista de Metas con barra de progreso y aportes del mes */}
        {activeGoals.length === 0 ? (
          <div className="py-3 text-center text-muted text-xs">
            <span>Sin metas de ahorro activas</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
            {activeGoals.slice(0, 4).map((goal) => {
              const goalMonthContrib = monthContributions
                .filter((c) => c.goal_id === goal.id)
                .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
              const currentAmount = Number(goal.current_amount) || 0;
              const targetAmount = Number(goal.target_amount) || 1;
              const progress = Math.min(Math.round((currentAmount / targetAmount) * 100), 100);

              return (
                <div key={goal.id} className="p-2.5 rounded-xl bg-surface border border-app space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-app truncate">{goal.name}</span>
                    {goalMonthContrib > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        +${goalMonthContrib.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted font-mono">{progress}%</span>
                    )}
                  </div>
                  <div className="w-full bg-card rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#00C2C7] h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                    <span>${currentAmount.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    <span>Meta: ${targetAmount.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Balance de Capital */}
      <div className="p-4 rounded-3xl bg-card border border-app shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-app uppercase tracking-wider">
                Balance de Capital
              </h4>
              <span className="text-[10px] text-muted font-medium">
                Cuentas y saldos actuales
              </span>
            </div>
          </div>
        </div>

        {/* Resumen de Capital Total Estimado */}
        <div className="p-3 rounded-2xl bg-surface border border-app flex items-center justify-between">
          <div>
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">
              Capital Total Est.
            </span>
            <span className="text-base font-black text-app">
              ${totalCapitalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
          <div className="text-right text-[10px] space-y-0.5">
            {totalVES > 0 && (
              <div className="text-emerald-400 font-bold">
                Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
            {totalEUR > 0 && (
              <div className="text-blue-400 font-bold">
                €{totalEUR.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

        {/* Desglose por Cuentas */}
        {accounts.length === 0 ? (
          <div className="py-3 text-center text-muted text-xs">
            <span>Sin cuentas registradas en Capital</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto no-scrollbar pr-1">
            {accounts.map((acc) => {
              const bal = getAccountBalance(acc);
              const currSymbol = acc.currency === 'VES' ? 'Bs.' : acc.currency === 'EUR' ? '€' : '$';
              return (
                <div key={acc.id} className="flex items-center justify-between p-2 rounded-xl bg-surface border border-app text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: acc.color || '#00C2C7' }}
                    />
                    <span className="font-semibold text-app truncate">{acc.name}</span>
                  </div>
                  <span className={`font-black shrink-0 font-mono ${bal < 0 ? 'text-rose-400' : 'text-app'}`}>
                    {currSymbol} {bal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
