import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calendar as CalendarIcon,
  Check,
} from 'lucide-react';
import type {
  FixedExpense,
  MonthlyFixedOverride,
  VariableExpense,
  Debt,
  DebtPayment,
  FixedIncome,
  MonthlyFixedIncomeOverride,
  VariableIncome,
  SavingsGoal,
  SavingContribution,
  Category,
  Account,
  ExchangeRatesData,
  FortnightType,
} from '../../types/index.ts';
import {
  db,
  setFortnightExpensePaid,
  unmarkFortnightExpensePaid,
} from '../../lib/db.ts';
import { MonthPicker } from '../MonthPicker.tsx';
import { CalendarMonthlySidebar, type CalendarFilterType } from './CalendarMonthlySidebar.tsx';
import { CalendarDayDetailModal, type CalendarDayItem } from './CalendarDayDetailModal.tsx';

interface MonthlyPlanningCalendarProps {
  selectedYear: number;
  selectedMonth: number;
  onChangePeriod: (year: number, month: number) => void;
  fixedExpenses: FixedExpense[];
  monthlyOverrides: MonthlyFixedOverride[];
  variableExpenses?: VariableExpense[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  fixedIncomes: FixedIncome[];
  monthlyIncomeOverrides: MonthlyFixedIncomeOverride[];
  variableIncomes?: VariableIncome[];
  savingsGoals: SavingsGoal[];
  savingContributions: SavingContribution[];
  categories?: Category[];
  accounts?: Account[];
  rates?: ExchangeRatesData;
  userId?: string;
  onOpenQuickPayment?: (debtId?: string) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const MonthlyPlanningCalendar: React.FC<MonthlyPlanningCalendarProps> = ({
  selectedYear,
  selectedMonth,
  onChangePeriod,
  fixedExpenses,
  monthlyOverrides,
  variableExpenses = [],
  debts,
  debtPayments,
  fixedIncomes,
  monthlyIncomeOverrides: _mio,
  variableIncomes = [],
  savingsGoals,
  savingContributions,
  categories: _categories = [],
  accounts: _accounts = [],
  rates,
  userId,
  onOpenQuickPayment,
}) => {
  const [activeFilter, setActiveFilter] = useState<CalendarFilterType>('all');
  const [selectedDayForModal, setSelectedDayForModal] = useState<number | null>(null);

  // Live queries for reactive updates
  const allFortnightStates = useLiveQuery(() => db.fortnight_item_states.toArray(), []) || [];
  const planningNote = useLiveQuery(
    () => db.planning_notes.get(`pn_${userId || ''}_${selectedYear}_${selectedMonth}`),
    [userId, selectedYear, selectedMonth]
  );

  const monthName = MONTH_NAMES[selectedMonth];
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // First day weekday (0 = Sunday, 1 = Monday, etc.) -> Convert to Monday = 0
  const firstDayRaw = new Date(selectedYear, selectedMonth, 1).getDay();
  const startDayOffset = (firstDayRaw + 6) % 7; // 0 for Mon, 6 for Sun

  // Today marker
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() === selectedMonth;
  const currentDayNum = isCurrentMonth ? today.getDate() : -1;

  // Build items grouped by day number (1..daysInMonth)
  const daysData = useMemo(() => {
    const map = new Map<number, CalendarDayItem[]>();
    for (let d = 1; d <= daysInMonth; d++) {
      map.set(d, []);
    }

    // 1. Fixed Expenses
    fixedExpenses.forEach((exp) => {
      // Check monthly override for active/amount
      const override = monthlyOverrides.find(
        (o) => o.fixed_expense_id === exp.id && o.year === selectedYear && o.month === selectedMonth
      );
      const isActive = override ? override.is_active : exp.is_active;
      if (!isActive || exp.assumed_by_third_party) return;

      const amount = override?.custom_amount !== undefined ? override.custom_amount : exp.amount;

      // Determine payment day
      const targetDays: number[] = [];
      if (exp.due_day && exp.due_day >= 1 && exp.due_day <= daysInMonth) {
        targetDays.push(exp.due_day);
      } else {
        if (exp.default_fortnight === 'q1') {
          targetDays.push(15);
        } else if (exp.default_fortnight === 'q2') {
          targetDays.push(Math.min(30, daysInMonth));
        } else {
          // both
          targetDays.push(15);
          targetDays.push(Math.min(30, daysInMonth));
        }
      }

      targetDays.forEach((targetDay) => {
        const fortnight: FortnightType = targetDay <= 15 ? 'q1' : 'q2';
        const periodKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${fortnight === 'q1' ? '15' : '30'}`;
        const stateId = `fixed_expense_${exp.id}_${periodKey}`;
        const state = allFortnightStates.find((s) => s.id === stateId);
        const isPaid = state?.status === 'paid';
        const isSkipped = state?.status === 'skipped';

        const item: CalendarDayItem = {
          id: `fe_${exp.id}_day_${targetDay}`,
          type: 'fixed_expense',
          title: exp.name,
          subtitle: 'Gasto Fijo',
          amount,
          currency: exp.currency,
          isPaid,
          isSkipped,
          rawExpense: exp,
        };

        const list = map.get(targetDay) || [];
        list.push(item);
        map.set(targetDay, list);
      });
    });

    // 2. Debts (Cashea, Préstamos, Tarjetas)
    debts.forEach((debt) => {
      if (debt.status === 'paid' && debt.current_balance <= 0) {
        // Still check if paid in this month
        const hasPaymentThisMonth = debtPayments.some(
          (p) => p.debt_id === debt.id && p.year === selectedYear && p.month === selectedMonth
        );
        if (!hasPaymentThisMonth) return;
      }

      const installmentAmount = debt.installment_amount || (debt.total_amount / (debt.total_installments || 1));
      let targetDay = debt.due_day;

      if (!targetDay && debt.due_date) {
        const parsedDate = new Date(debt.due_date);
        if (!isNaN(parsedDate.getTime())) {
          targetDay = parsedDate.getDate();
        }
      }

      if (!targetDay) {
        targetDay = debt.fortnight_due === 'q2' ? Math.min(30, daysInMonth) : 15;
      }

      if (targetDay > daysInMonth) targetDay = daysInMonth;

      const fortnight: FortnightType = targetDay <= 15 ? 'q1' : 'q2';
      const paidPayment = debtPayments.find(
        (p) => p.debt_id === debt.id && p.year === selectedYear && p.month === selectedMonth && p.fortnight === fortnight
      );

      const isPaid = Boolean(paidPayment && paidPayment.amount > 0);

      const item: CalendarDayItem = {
        id: `debt_${debt.id}_day_${targetDay}`,
        type: 'debt',
        title: debt.creditor || 'Deuda',
        subtitle: debt.platform ? `Cuota ${debt.platform.toUpperCase()}` : 'Cuota de Deuda',
        amount: paidPayment?.amount || installmentAmount,
        currency: debt.currency,
        isPaid,
        rawDebt: debt,
      };

      const list = map.get(targetDay) || [];
      list.push(item);
      map.set(targetDay, list);
    });

    // 3. Variable Expenses
    variableExpenses.forEach((ve) => {
      if (ve.year === selectedYear && ve.month === selectedMonth) {
        const day = ve.fortnight === 'q1' ? 15 : Math.min(30, daysInMonth);
        const item: CalendarDayItem = {
          id: `ve_${ve.id}`,
          type: 'variable_expense',
          title: ve.description,
          subtitle: 'Gasto Variable',
          amount: ve.amount,
          currency: ve.currency,
          isPaid: true, // variable expenses already logged
        };
        const list = map.get(day) || [];
        list.push(item);
        map.set(day, list);
      }
    });

    // 4. Incomes (Fixed & Variable)
    fixedIncomes.forEach((inc) => {
      if (!inc.is_active) return;
      const targetDays: number[] = [];
      if (inc.default_fortnight === 'q1') {
        targetDays.push(15);
      } else if (inc.default_fortnight === 'q2') {
        targetDays.push(Math.min(30, daysInMonth));
      } else if (inc.default_fortnight === 'split') {
        targetDays.push(15);
        targetDays.push(Math.min(30, daysInMonth));
      } else {
        targetDays.push(15);
        targetDays.push(Math.min(30, daysInMonth));
      }

      targetDays.forEach((d) => {
        const splitAmount = inc.default_fortnight === 'split' ? inc.amount / 2 : inc.amount;
        const item: CalendarDayItem = {
          id: `fi_${inc.id}_day_${d}`,
          type: 'income',
          title: inc.name,
          subtitle: 'Ingreso Fijo',
          amount: splitAmount,
          currency: inc.currency,
          isPaid: true,
        };
        const list = map.get(d) || [];
        list.push(item);
        map.set(d, list);
      });
    });

    variableIncomes.forEach((vi) => {
      if (vi.year === selectedYear && vi.month === selectedMonth) {
        const d = vi.fortnight === 'q1' ? 15 : Math.min(30, daysInMonth);
        const item: CalendarDayItem = {
          id: `vi_${vi.id}`,
          type: 'income',
          title: vi.description,
          subtitle: 'Ingreso Extra',
          amount: vi.amount,
          currency: vi.currency,
          isPaid: true,
        };
        const list = map.get(d) || [];
        list.push(item);
        map.set(d, list);
      }
    });

    // 5. Savings Goals
    savingsGoals.forEach((goal) => {
      if (goal.status !== 'active') return;
      const targetDays: number[] = [];
      if (goal.frequency === 'monthly') {
        targetDays.push(goal.target_fortnight === 30 ? Math.min(30, daysInMonth) : 15);
      } else {
        targetDays.push(15);
        targetDays.push(Math.min(30, daysInMonth));
      }

      targetDays.forEach((d) => {
        const fortnight: FortnightType = d <= 15 ? 'q1' : 'q2';
        const contrib = savingContributions.find(
          (c) => c.goal_id === goal.id && c.year === selectedYear && c.month === selectedMonth && c.fortnight === fortnight
        );
        const isPaid = Boolean(contrib && !contrib.is_skipped && contrib.amount > 0);
        const isSkipped = Boolean(contrib && contrib.is_skipped);

        const item: CalendarDayItem = {
          id: `sg_${goal.id}_day_${d}`,
          type: 'saving',
          title: goal.name,
          subtitle: 'Meta de Ahorro',
          amount: goal.amount_per_period,
          isPaid,
          isSkipped,
          rawGoal: goal,
        };
        const list = map.get(d) || [];
        list.push(item);
        map.set(d, list);
      });
    });

    return map;
  }, [
    daysInMonth,
    fixedExpenses,
    monthlyOverrides,
    debts,
    debtPayments,
    variableExpenses,
    fixedIncomes,
    variableIncomes,
    savingsGoals,
    savingContributions,
    allFortnightStates,
    selectedYear,
    selectedMonth,
  ]);

  // Aggregate monthly metrics
  const monthlyMetrics = useMemo(() => {
    let totalCommitted = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalQ1 = 0;
    let totalQ2 = 0;

    daysData.forEach((items, day) => {
      const isQ1 = day <= 15;
      items.forEach((item) => {
        if (item.type === 'fixed_expense' || item.type === 'debt' || item.type === 'variable_expense') {
          totalCommitted += item.amount;
          if (isQ1) totalQ1 += item.amount;
          else totalQ2 += item.amount;

          if (item.isPaid) {
            totalPaid += item.amount;
          } else if (!item.isSkipped) {
            totalPending += item.amount;
          }
        }
      });
    });

    return { totalCommitted, totalPaid, totalPending, totalQ1, totalQ2 };
  }, [daysData]);

  // Filter items for display
  const getFilteredItems = (items: CalendarDayItem[]) => {
    if (activeFilter === 'all') return items;
    if (activeFilter === 'fixed_expenses') return items.filter((i) => i.type === 'fixed_expense');
    if (activeFilter === 'debts') return items.filter((i) => i.type === 'debt');
    if (activeFilter === 'pending') return items.filter((i) => !i.isPaid && !i.isSkipped && (i.type === 'fixed_expense' || i.type === 'debt'));
    if (activeFilter === 'paid') return items.filter((i) => i.isPaid);
    return items;
  };

  const handleToggleExpensePaid = async (expense: FixedExpense, isCurrentlyPaid: boolean) => {
    const day = selectedDayForModal || 15;
    const fortnight: FortnightType = day <= 15 ? 'q1' : 'q2';
    if (isCurrentlyPaid) {
      await unmarkFortnightExpensePaid({
        expenseId: expense.id,
        year: selectedYear,
        month: selectedMonth,
        fortnight,
      });
    } else {
      await setFortnightExpensePaid({
        expense,
        year: selectedYear,
        month: selectedMonth,
        fortnight,
        amount: expense.amount,
      });
    }
  };

  // Calendar Day Detail Modal Data
  const selectedDayItems = selectedDayForModal ? daysData.get(selectedDayForModal) || [] : [];
  const selectedDayOfWeekName = selectedDayForModal
    ? WEEKDAY_NAMES[(new Date(selectedYear, selectedMonth, selectedDayForModal).getDay() + 6) % 7]
    : '';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Bar with Month Navigation & Quincenas Indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-card border border-app shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-app">
              Calendario de Planificación
            </h2>
            <p className="text-xs text-muted">
              Visualización diaria de vencimientos, compromisos y tareas
            </p>
          </div>
        </div>

        {/* Month Selector & Navigation */}
        <div className="flex items-center gap-2">
          <MonthPicker
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={onChangePeriod}
          />
        </div>
      </div>

      {/* Main Grid + Sidebar Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Calendar Grid (9 Columns on large screens) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-3">
          {/* Quincenas Indicator Header Bar */}
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2.5 rounded-2xl bg-primary-custom/10 border border-primary-custom/30 text-primary-custom flex items-center justify-between px-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-custom" />
                Quincena 15 (Días 1 al 15)
              </span>
              <span className="text-app font-black">${monthlyMetrics.totalQ1.toFixed(2)}</span>
            </div>
            <div className="p-2.5 rounded-2xl bg-[#FF914D]/10 border border-[#FF914D]/30 text-[#FF914D] flex items-center justify-between px-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF914D]" />
                Quincena 30 (Días 16 al {daysInMonth})
              </span>
              <span className="text-app font-black">${monthlyMetrics.totalQ2.toFixed(2)}</span>
            </div>
          </div>

          {/* Calendar Table Box */}
          <div className="bg-card border border-app rounded-3xl shadow-xl overflow-hidden">
            {/* Weekdays Header */}
            <div className="grid grid-cols-7 border-b border-app bg-surface-hover/60 text-center text-xs font-black text-muted py-2.5 uppercase tracking-wider">
              {WEEKDAY_SHORT.map((wd, i) => (
                <div key={wd} className={i >= 5 ? 'text-slate-500' : ''}>
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 auto-rows-fr gap-[1px] bg-app/50 p-[1px]">
              {/* Padding empty days before day 1 */}
              {Array.from({ length: startDayOffset }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="min-h-[95px] lg:min-h-[115px] p-2 bg-surface/30 opacity-40 select-none"
                />
              ))}

              {/* Month Days 1..N */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const isToday = dayNum === currentDayNum;
                const rawItems = daysData.get(dayNum) || [];
                const filteredItems = getFilteredItems(rawItems);
                const dayTotal = rawItems
                  .filter((item) => item.type === 'fixed_expense' || item.type === 'debt' || item.type === 'variable_expense')
                  .reduce((sum, item) => sum + item.amount, 0);

                const isQ1 = dayNum <= 15;
                const allPaid = rawItems.length > 0 && rawItems.every((it) => it.isPaid || it.isSkipped);

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => setSelectedDayForModal(dayNum)}
                    className={`min-h-[95px] lg:min-h-[115px] p-2 flex flex-col justify-between transition-all cursor-pointer group relative ${
                      isToday
                        ? 'bg-primary-custom/10 border-2 border-primary-custom/80 shadow-md'
                        : isQ1
                        ? 'bg-surface/90 hover:bg-surface-hover/90'
                        : 'bg-surface/75 hover:bg-surface-hover/90'
                    }`}
                  >
                    {/* Cell Top Bar: Day Number & Total Due Badge */}
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-black rounded-lg w-6 h-6 flex items-center justify-center transition-colors ${
                          isToday
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-app group-hover:text-primary-custom'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {dayTotal > 0 && (
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border tracking-tight ${
                            allPaid
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          ${dayTotal.toFixed(0)}
                        </span>
                      )}
                    </div>

                    {/* Cell Items Chips List */}
                    <div className="flex-1 my-1 space-y-1 overflow-hidden">
                      {filteredItems.slice(0, 3).map((item) => {
                        const isIncome = item.type === 'income';
                        const isSaving = item.type === 'saving';
                        const isDebt = item.type === 'debt';

                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between px-1.5 py-0.5 rounded-md text-[10px] font-bold border truncate transition-all ${
                              item.isPaid
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : isIncome
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : isSaving
                                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                                : isDebt
                                ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                            }`}
                            title={`${item.title}: $${item.amount.toFixed(2)} (${item.isPaid ? 'Pagado' : 'Pendiente'})`}
                          >
                            <span className="truncate flex items-center gap-1">
                              {item.isPaid ? (
                                <Check className="w-2.5 h-2.5 shrink-0 text-emerald-400" />
                              ) : isDebt ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                              )}
                              {item.title}
                            </span>
                            <span className="shrink-0 ml-1 font-black">
                              ${item.amount.toFixed(0)}
                            </span>
                          </div>
                        );
                      })}

                      {filteredItems.length > 3 && (
                        <span className="text-[9px] font-extrabold text-muted block text-center">
                          +{filteredItems.length - 3} más...
                        </span>
                      )}
                    </div>

                    {/* Subtle footer indicator for Quincena milestone */}
                    {(dayNum === 15 || dayNum === 30) && (
                      <div className="text-[9px] font-extrabold text-primary-custom uppercase tracking-wider flex items-center justify-center pt-0.5 border-t border-app/40">
                        Corte Q{dayNum === 15 ? '15' : '30'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Planning Sidebar (3 Columns on large screens) */}
        <div className="lg:col-span-4 xl:col-span-3">
          <CalendarMonthlySidebar
            year={selectedYear}
            month={selectedMonth}
            monthName={monthName}
            totalCommittedMonth={monthlyMetrics.totalCommitted}
            totalPaidMonth={monthlyMetrics.totalPaid}
            totalPendingMonth={monthlyMetrics.totalPending}
            totalQ1={monthlyMetrics.totalQ1}
            totalQ2={monthlyMetrics.totalQ2}
            rates={rates}
            activeFilter={activeFilter}
            onChangeFilter={setActiveFilter}
            planningNote={planningNote}
            userId={userId}
          />
        </div>
      </div>

      {/* Day Detail Modal */}
      <CalendarDayDetailModal
        isOpen={selectedDayForModal !== null}
        onClose={() => setSelectedDayForModal(null)}
        dayNumber={selectedDayForModal || 1}
        monthName={monthName}
        year={selectedYear}
        dayOfWeekName={selectedDayOfWeekName}
        items={selectedDayItems}
        rates={rates}
        onToggleExpensePaid={handleToggleExpensePaid}
        onOpenQuickPayment={onOpenQuickPayment}
      />
    </div>
  );
};
