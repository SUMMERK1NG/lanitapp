import React from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Receipt,
  CreditCard,
  Briefcase,
  PiggyBank,
  Check,
} from 'lucide-react';
import type {
  FixedExpense,
  Debt,
  SavingsGoal,
  ExchangeRatesData,
  Category,
} from '../../types/index.ts';
import { formatCurrencyVE } from '../../utils/numberFormat.ts';

export interface CalendarDayItem {
  id: string;
  type: 'fixed_expense' | 'debt' | 'variable_expense' | 'income' | 'saving';
  title: string;
  subtitle?: string;
  amount: number;
  currency?: string;
  isPaid: boolean;
  isSkipped?: boolean;
  statusText?: string;
  category?: Category;
  platform?: string;
  rawExpense?: FixedExpense;
  rawDebt?: Debt;
  rawGoal?: SavingsGoal;
}

interface CalendarDayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumber: number;
  monthName: string;
  year: number;
  dayOfWeekName: string;
  items: CalendarDayItem[];
  rates?: ExchangeRatesData;
  onToggleExpensePaid?: (expense: FixedExpense, isCurrentlyPaid: boolean) => void;
  onOpenQuickPayment?: (debtId?: string) => void;
  onAddTaskForDay?: (day: number, text: string) => void;
}

export const CalendarDayDetailModal: React.FC<CalendarDayDetailModalProps> = ({
  isOpen,
  onClose,
  dayNumber,
  monthName,
  year,
  dayOfWeekName,
  items,
  rates,
  onToggleExpensePaid,
  onOpenQuickPayment,
}) => {
  if (!isOpen) return null;

  const totalCommitted = items
    .filter((i) => i.type === 'fixed_expense' || i.type === 'debt' || i.type === 'variable_expense')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalIncomes = items
    .filter((i) => i.type === 'income')
    .reduce((sum, i) => sum + i.amount, 0);

  const bcvRate = rates?.bcvDollar || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg bg-surface border border-app rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-app bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-custom/20 text-primary-custom flex flex-col items-center justify-center font-bold">
              <span className="text-[10px] uppercase tracking-wider">{dayOfWeekName.slice(0, 3)}</span>
              <span className="text-lg leading-tight">{dayNumber}</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-app">
                {dayOfWeekName}, {dayNumber} de {monthName} {year}
              </h3>
              <p className="text-xs text-muted">
                {dayNumber <= 15 ? '📌 Quincena 15' : '📌 Quincena 30'} • {items.length} movimientos programados
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-app hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Metric Highlights */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-surface-hover/40 border-b border-app">
          <div className="p-3 rounded-2xl bg-card border border-app">
            <span className="text-[11px] text-muted font-bold block uppercase tracking-wider">
              Total a Pagar en el Día
            </span>
            <span className="text-lg font-black text-rose-400">
              ${totalCommitted.toFixed(2)}
            </span>
            {bcvRate > 0 && (
              <span className="text-[11px] text-muted block mt-0.5 font-medium">
                Bs. {formatCurrencyVE(totalCommitted * bcvRate)} (BCV)
              </span>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-card border border-app">
            <span className="text-[11px] text-muted font-bold block uppercase tracking-wider">
              Ingresos del Día
            </span>
            <span className="text-lg font-black text-emerald-400">
              +${totalIncomes.toFixed(2)}
            </span>
            {bcvRate > 0 && (
              <span className="text-[11px] text-muted block mt-0.5 font-medium">
                Bs. {formatCurrencyVE(totalIncomes * bcvRate)} (BCV)
              </span>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No hay pagos ni cobros programados para este día.</p>
              <p className="text-xs mt-1">Los gastos y deudas asignados a este día aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            items.map((item) => {
              const isIncome = item.type === 'income';
              const isSaving = item.type === 'saving';
              const isDebt = item.type === 'debt';
              const isExpense = item.type === 'fixed_expense' || item.type === 'variable_expense';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    item.isPaid
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : item.isSkipped
                      ? 'bg-slate-800/40 border-slate-700/50 opacity-60'
                      : 'bg-card border-app hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : isSaving
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : isDebt
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}
                    >
                      {isIncome ? (
                        <Briefcase className="w-5 h-5" />
                      ) : isSaving ? (
                        <PiggyBank className="w-5 h-5" />
                      ) : isDebt ? (
                        <CreditCard className="w-5 h-5" />
                      ) : (
                        <Receipt className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-app truncate">{item.title}</span>
                        {item.isPaid && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Pagado
                          </span>
                        )}
                        {item.isSkipped && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-300">
                            Omitido
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate">
                        {item.subtitle || (isDebt ? 'Deuda / Cuota' : isExpense ? 'Gasto Fijo' : 'Compromiso')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span
                        className={`text-sm font-black block ${
                          isIncome ? 'text-emerald-400' : 'text-app'
                        }`}
                      >
                        {isIncome ? '+' : '-'}${item.amount.toFixed(2)}
                      </span>
                      {bcvRate > 0 && (
                        <span className="text-[10px] text-muted block">
                          Bs. {formatCurrencyVE(item.amount * bcvRate)}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    {item.type === 'fixed_expense' && item.rawExpense && onToggleExpensePaid && (
                      <button
                        onClick={() => onToggleExpensePaid(item.rawExpense!, item.isPaid)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          item.isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                            : 'bg-primary-custom text-white hover:opacity-90 shadow-md'
                        }`}
                        title={item.isPaid ? 'Desmarcar como pagado' : 'Marcar como pagado'}
                      >
                        {item.isPaid ? <CheckCircle2 className="w-4 h-4" /> : 'Pagar'}
                      </button>
                    )}

                    {item.type === 'debt' && onOpenQuickPayment && (
                      <button
                        onClick={() => onOpenQuickPayment(item.rawDebt?.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/40 text-xs font-bold transition-all cursor-pointer"
                      >
                        Abonar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-app bg-card/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-surface-hover hover:bg-card text-app text-xs font-bold border border-app transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
