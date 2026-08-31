import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calendar as CalendarIcon,
  List,
  LayoutGrid,
  Check,
  Receipt,
  CreditCard,
  Briefcase,
  PiggyBank,
  Sparkles,
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
  const [calendarViewMode, setCalendarViewMode] = useState<'grid' | 'agenda'>('grid');
  const [selectedDayForModal, setSelectedDayForModal] = useState<number | null>(null);
  const [selectedDayInline, setSelectedDayInline] = useState<number>(15);

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
      const override = monthlyOverrides.find(
        (o) => o.fixed_expense_id === exp.id && o.year === selectedYear && o.month === selectedMonth
      );
      const isActive = override ? override.is_active : exp.is_active;
      if (!isActive || exp.assumed_by_third_party) return;

      const amount = override?.custom_amount !== undefined ? override.custom_amount : exp.amount;

      const targetDays: number[] = [];
      if (exp.due_day && exp.due_day >= 1 && exp.due_day <= daysInMonth) {
        targetDays.push(exp.due_day);
      } else {
        if (exp.default_fortnight === 'q1') {
          targetDays.push(15);
        } else if (exp.default_fortnight === 'q2') {
          targetDays.push(Math.min(30, daysInMonth));
        } else {
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

    // 2. Debts
    debts.forEach((debt) => {
      if (debt.status === 'paid' && debt.current_balance <= 0) {
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
          isPaid: true,
        };
        const list = map.get(day) || [];
        list.push(item);
        map.set(day, list);
      }
    });

    // 4. Incomes
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
    const day = selectedDayForModal || selectedDayInline || 15;
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

  // Days that have at least one event (for Agenda / Timeline view)
  const activeDaysList = useMemo(() => {
    const list: { day: number; items: CalendarDayItem[]; totalCommitted: number; totalIncome: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const allItems = daysData.get(d) || [];
      const filtered = getFilteredItems(allItems);
      if (filtered.length > 0) {
        const totalCommitted = filtered
          .filter((i) => i.type === 'fixed_expense' || i.type === 'debt' || i.type === 'variable_expense')
          .reduce((s, i) => s + i.amount, 0);
        const totalIncome = filtered
          .filter((i) => i.type === 'income')
          .reduce((s, i) => s + i.amount, 0);
        list.push({ day: d, items: filtered, totalCommitted, totalIncome });
      }
    }
    return list;
  }, [daysData, daysInMonth, activeFilter]);

  const selectedDayItems = selectedDayForModal ? daysData.get(selectedDayForModal) || [] : [];
  const selectedDayOfWeekName = selectedDayForModal
    ? WEEKDAY_NAMES[(new Date(selectedYear, selectedMonth, selectedDayForModal).getDay() + 6) % 7]
    : '';

  const inlineDayItems = daysData.get(selectedDayInline) || [];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header: Period, View Mode Switcher (Grid vs Agenda) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-3xl bg-card border border-app shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-app">
              Planificación de {monthName} {selectedYear}
            </h2>
            <p className="text-[11px] text-muted hidden sm:block">
              {activeDaysList.length} días con movimientos programados • ${monthlyMetrics.totalCommitted.toFixed(2)} total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-surface p-1 rounded-xl border border-app">
            <button
              onClick={() => setCalendarViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                calendarViewMode === 'grid'
                  ? 'bg-primary-custom text-white shadow-sm'
                  : 'text-muted hover:text-app'
              }`}
              title="Vista Cuadrícula Compacta"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cuadrícula</span>
            </button>
            <button
              onClick={() => setCalendarViewMode('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                calendarViewMode === 'agenda'
                  ? 'bg-primary-custom text-white shadow-sm'
                  : 'text-muted hover:text-app'
              }`}
              title="Vista Agenda / Lista Cronológica"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cronograma</span>
            </button>
          </div>

          <MonthPicker
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={onChangePeriod}
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main Content (Grid or Agenda) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-3">
          {/* Quincenas Indicator Header */}
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-primary-custom/10 border border-primary-custom/30 text-primary-custom flex items-center justify-between px-3 sm:px-4">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs">
                <span className="w-2 h-2 rounded-full bg-primary-custom" />
                Quincena 15
              </span>
              <span className="text-app font-black text-xs sm:text-sm">
                ${monthlyMetrics.totalQ1.toFixed(2)}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-2xl bg-[#FF914D]/10 border border-[#FF914D]/30 text-[#FF914D] flex items-center justify-between px-3 sm:px-4">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs">
                <span className="w-2 h-2 rounded-full bg-[#FF914D]" />
                Quincena 30
              </span>
              <span className="text-app font-black text-xs sm:text-sm">
                ${monthlyMetrics.totalQ2.toFixed(2)}
              </span>
            </div>
          </div>

          {/* VIEW MODE 1: COMPACT CALENDAR GRID */}
          {calendarViewMode === 'grid' ? (
            <div className="space-y-3">
              <div className="bg-card border border-app rounded-3xl shadow-lg overflow-hidden">
                {/* Weekdays Header */}
                <div className="grid grid-cols-7 border-b border-app bg-surface-hover/50 text-center text-[10px] sm:text-xs font-black text-muted py-2 uppercase tracking-wider">
                  {WEEKDAY_SHORT.map((wd, i) => (
                    <div key={wd} className={i >= 5 ? 'text-slate-500' : ''}>
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Calendar Cells Grid */}
                <div className="grid grid-cols-7 gap-[1px] bg-app/40 p-[1px]">
                  {/* Empty leading padding */}
                  {Array.from({ length: startDayOffset }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="h-14 sm:h-20 lg:h-24 p-1 sm:p-1.5 bg-surface/20 opacity-30 select-none"
                    />
                  ))}

                  {/* Days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const isToday = dayNum === currentDayNum;
                    const isSelected = selectedDayInline === dayNum;
                    const rawItems = daysData.get(dayNum) || [];
                    const filteredItems = getFilteredItems(rawItems);
                    const dayTotal = rawItems
                      .filter((item) => item.type === 'fixed_expense' || item.type === 'debt' || item.type === 'variable_expense')
                      .reduce((sum, item) => sum + item.amount, 0);

                    const hasIncome = rawItems.some((item) => item.type === 'income');
                    const hasDebt = rawItems.some((item) => item.type === 'debt');
                    const hasExpense = rawItems.some((item) => item.type === 'fixed_expense' || item.type === 'variable_expense');
                    const allPaid = rawItems.length > 0 && rawItems.every((it) => it.isPaid || it.isSkipped);

                    return (
                      <div
                        key={`day-${dayNum}`}
                        onClick={() => {
                          setSelectedDayInline(dayNum);
                          // On desktop or mobile double click / direct open:
                          if (window.innerWidth < 768) {
                            // On mobile, select day inline
                          } else {
                            setSelectedDayForModal(dayNum);
                          }
                        }}
                        className={`h-14 sm:h-20 lg:h-24 p-1 sm:p-1.5 flex flex-col justify-between transition-all cursor-pointer relative group ${
                          isSelected
                            ? 'bg-primary-custom/20 border border-primary-custom shadow-inner'
                            : isToday
                            ? 'bg-primary-custom/10 border border-primary-custom/60'
                            : rawItems.length > 0
                            ? 'bg-surface hover:bg-surface-hover'
                            : 'bg-surface/60 hover:bg-surface-hover/80'
                        }`}
                      >
                        {/* Day Number + Total Pill */}
                        <div className="flex items-center justify-between gap-0.5">
                          <span
                            className={`text-[10px] sm:text-xs font-black rounded-md w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center transition-colors ${
                              isToday
                                ? 'bg-primary-custom text-white'
                                : isSelected
                                ? 'bg-white/20 text-white font-black'
                                : 'text-app group-hover:text-primary-custom'
                            }`}
                          >
                            {dayNum}
                          </span>

                          {dayTotal > 0 && (
                            <span
                              className={`text-[9px] sm:text-[10px] font-black px-1 py-0.2 rounded border tracking-tight ${
                                allPaid
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              ${dayTotal.toFixed(0)}
                            </span>
                          )}
                        </div>

                        {/* Mobile Indicators: Colorful Event Dots */}
                        <div className="sm:hidden flex items-center justify-center gap-1 py-1">
                          {hasIncome && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          {hasDebt && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                          {hasExpense && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                        </div>

                        {/* Desktop Compact Chips (Visible from sm breakpoint) */}
                        <div className="hidden sm:block space-y-0.5 overflow-hidden flex-1 my-0.5">
                          {filteredItems.slice(0, 2).map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between px-1 py-0.2 rounded text-[9px] font-bold border truncate ${
                                item.isPaid
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : item.type === 'income'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : item.type === 'debt'
                                  ? 'bg-orange-500/10 text-orange-300 border-orange-500/30'
                                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                              }`}
                            >
                              <span className="truncate flex items-center gap-1">
                                {item.isPaid ? (
                                  <Check className="w-2 h-2 text-emerald-400 shrink-0" />
                                ) : (
                                  <span
                                    className={`w-1 h-1 rounded-full shrink-0 ${
                                      item.type === 'debt' ? 'bg-orange-400' : 'bg-indigo-400'
                                    }`}
                                  />
                                )}
                                {item.title}
                              </span>
                              <span className="shrink-0 font-black ml-0.5">
                                ${item.amount.toFixed(0)}
                              </span>
                            </div>
                          ))}

                          {filteredItems.length > 2 && (
                            <span className="text-[8px] font-extrabold text-muted block text-center leading-none">
                              +{filteredItems.length - 2} más
                            </span>
                          )}
                        </div>

                        {/* Quincena Marker */}
                        {(dayNum === 15 || dayNum === 30) && (
                          <div className="text-[8px] font-extrabold text-primary-custom text-center leading-none">
                            Q{dayNum === 15 ? '15' : '30'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Quick Day Detail Inspector Card (Below grid) */}
              <div className="block sm:hidden p-4 rounded-3xl bg-card border border-app space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-app">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-app">
                      📅 Día {selectedDayInline} de {monthName}
                    </span>
                    <span className="text-[10px] text-muted font-bold">
                      ({inlineDayItems.length} movimientos)
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDayForModal(selectedDayInline)}
                    className="text-[11px] font-bold text-primary-custom hover:underline"
                  >
                    Ver Detalle Completo
                  </button>
                </div>

                {inlineDayItems.length === 0 ? (
                  <div className="py-4 text-center text-muted text-xs">
                    Sin compromisos para este día. Toca otro día del calendario.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inlineDayItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-2xl bg-surface border border-app flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              item.type === 'income'
                                ? 'bg-emerald-400'
                                : item.type === 'debt'
                                ? 'bg-orange-400'
                                : 'bg-indigo-400'
                            }`}
                          />
                          <span className="font-bold text-app truncate">{item.title}</span>
                          {item.isPaid && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="font-black text-app shrink-0">
                          {item.type === 'income' ? '+' : '-'}${item.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VIEW MODE 2: CHRONOLOGICAL AGENDA / TIMELINE */
            <div className="space-y-3">
              {activeDaysList.length === 0 ? (
                <div className="p-8 rounded-3xl bg-card border border-app text-center text-muted space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm font-bold text-app">No hay compromisos con los filtros seleccionados</p>
                  <p className="text-xs">Cambia de mes o ajusta los filtros en el panel lateral.</p>
                </div>
              ) : (
                activeDaysList.map(({ day, items, totalCommitted, totalIncome }) => {
                  const dayName = WEEKDAY_NAMES[(new Date(selectedYear, selectedMonth, day).getDay() + 6) % 7];
                  const isQ1 = day <= 15;

                  return (
                    <div
                      key={`agenda-day-${day}`}
                      className="p-3.5 sm:p-4 rounded-3xl bg-card border border-app space-y-3 hover:border-slate-600 transition-all shadow-sm"
                    >
                      {/* Day Title & Badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-2xl bg-primary-custom/20 text-primary-custom flex flex-col items-center justify-center font-bold">
                            <span className="text-[9px] uppercase leading-none">{dayName.slice(0, 3)}</span>
                            <span className="text-sm leading-tight font-black">{day}</span>
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-app">
                              {dayName}, {day} de {monthName}
                            </h4>
                            <span className="text-[10px] text-muted font-semibold">
                              {isQ1 ? '📌 Quincena 15' : '📌 Quincena 30'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          {totalCommitted > 0 && (
                            <span className="text-xs sm:text-sm font-black text-rose-400 block">
                              -${totalCommitted.toFixed(2)}
                            </span>
                          )}
                          {totalIncome > 0 && (
                            <span className="text-xs sm:text-sm font-black text-emerald-400 block">
                              +${totalIncome.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-1.5 pt-1 border-t border-app">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs ${
                              item.isPaid
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-surface border-app'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                  item.type === 'income'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : item.type === 'saving'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : item.type === 'debt'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : 'bg-indigo-500/20 text-indigo-400'
                                }`}
                              >
                                {item.type === 'income' ? (
                                  <Briefcase className="w-3.5 h-3.5" />
                                ) : item.type === 'saving' ? (
                                  <PiggyBank className="w-3.5 h-3.5" />
                                ) : item.type === 'debt' ? (
                                  <CreditCard className="w-3.5 h-3.5" />
                                ) : (
                                  <Receipt className="w-3.5 h-3.5" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-app truncate">{item.title}</span>
                                  {item.isPaid && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                      ✓ Pagado
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted truncate block">{item.subtitle}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black text-app">
                                {item.type === 'income' ? '+' : '-'}${item.amount.toFixed(2)}
                              </span>

                              {item.type === 'fixed_expense' && item.rawExpense && (
                                <button
                                  onClick={() => handleToggleExpensePaid(item.rawExpense!, item.isPaid)}
                                  className={`px-2 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    item.isPaid
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-primary-custom text-white hover:opacity-90'
                                  }`}
                                >
                                  {item.isPaid ? '✓' : 'Pagar'}
                                </button>
                              )}

                              {item.type === 'debt' && onOpenQuickPayment && (
                                <button
                                  onClick={() => onOpenQuickPayment(item.rawDebt?.id)}
                                  className="px-2 py-1 rounded-xl bg-orange-500/20 text-orange-400 text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  Abonar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Monthly Planning Sidebar */}
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
