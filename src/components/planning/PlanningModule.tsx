import React, { useState } from 'react';
import {
  Columns3,
  CalendarDays,
} from 'lucide-react';
import type {
  FixedIncome,
  MonthlyFixedIncomeOverride,
  VariableIncome,
  FixedExpense,
  MonthlyFixedOverride,
  VariableExpense,
  Debt,
  DebtPayment,
  SavingsGoal,
  SavingContribution,
  Account,
  Category,
  ExchangeRatesData,
} from '../../types/index.ts';
import { FortnightPlanner } from '../FortnightPlanner.tsx';
import { MonthlyPlanningCalendar } from './MonthlyPlanningCalendar.tsx';

export type PlanningSubView = 'biweekly' | 'calendar';

interface PlanningModuleProps {
  selectedYear: number;
  selectedMonth: number;
  onChangePeriod: (year: number, month: number) => void;
  fixedIncomes: FixedIncome[];
  monthlyIncomeOverrides: MonthlyFixedIncomeOverride[];
  variableIncomes: VariableIncome[];
  fixedExpenses: FixedExpense[];
  monthlyOverrides: MonthlyFixedOverride[];
  variableExpenses?: VariableExpense[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  savingsGoals: SavingsGoal[];
  savingContributions: SavingContribution[];
  accounts?: Account[];
  categories?: Category[];
  rates?: ExchangeRatesData;
  currency?: string;
  userEmail?: string;
  userName?: string;
  userId?: string;
  initialSubView?: PlanningSubView;
  onOpenQuickPayment?: (debtId?: string) => void;
  onNavigateToIncomes?: () => void;
  onNavigateToSavings?: () => void;
  onNavigateToDebts?: () => void;
  onNavigateToFixedExpenses?: () => void;
}

export const PlanningModule: React.FC<PlanningModuleProps> = ({
  selectedYear,
  selectedMonth,
  onChangePeriod,
  fixedIncomes,
  monthlyIncomeOverrides,
  variableIncomes,
  fixedExpenses,
  monthlyOverrides,
  variableExpenses = [],
  debts,
  debtPayments,
  savingsGoals,
  savingContributions,
  accounts = [],
  categories = [],
  rates,
  currency = '$',
  userEmail,
  userName,
  userId,
  initialSubView = 'biweekly',
  onOpenQuickPayment,
  onNavigateToIncomes,
  onNavigateToSavings,
  onNavigateToDebts,
  onNavigateToFixedExpenses,
}) => {
  const [subView, setSubView] = useState<PlanningSubView>(initialSubView);

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-2xl bg-card border border-app shadow-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto p-1 bg-surface rounded-xl border border-app">
          {/* Sub-tab 1: Gestión Quincenal */}
          <button
            onClick={() => setSubView('biweekly')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subView === 'biweekly'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app hover:bg-surface-hover'
            }`}
          >
            <Columns3 className="w-4 h-4" />
            <span>Gestión Quincenal (15 y 30)</span>
          </button>

          {/* Sub-tab 2: Calendario Mensual */}
          <button
            onClick={() => setSubView('calendar')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subView === 'calendar'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app hover:bg-surface-hover'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Calendario de Planificación</span>
          </button>
        </div>

        <div className="text-xs text-muted font-medium px-2 hidden md:block">
          {subView === 'biweekly'
            ? '💡 Matriz de liquidez, asignación y balance por quincena'
            : '📅 Visión global de pagos, cobros y tareas por día'}
        </div>
      </div>

      {/* Dynamic Sub-view Render */}
      {subView === 'biweekly' ? (
        <div className="animate-in fade-in duration-200">
          <FortnightPlanner
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChangePeriod={onChangePeriod}
            fixedIncomes={fixedIncomes}
            monthlyIncomeOverrides={monthlyIncomeOverrides}
            variableIncomes={variableIncomes}
            fixedExpenses={fixedExpenses}
            monthlyOverrides={monthlyOverrides}
            variableExpenses={variableExpenses}
            debts={debts}
            debtPayments={debtPayments}
            savingsGoals={savingsGoals}
            savingContributions={savingContributions}
            accounts={accounts}
            categories={categories}
            rates={rates}
            currency={currency}
            userEmail={userEmail}
            userName={userName}
            onOpenQuickPayment={onOpenQuickPayment}
            onNavigateToIncomes={onNavigateToIncomes}
            onNavigateToSavings={onNavigateToSavings}
            onNavigateToDebts={onNavigateToDebts}
            onNavigateToFixedExpenses={onNavigateToFixedExpenses}
          />
        </div>
      ) : (
        <div className="animate-in fade-in duration-200">
          <MonthlyPlanningCalendar
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChangePeriod={onChangePeriod}
            fixedExpenses={fixedExpenses}
            monthlyOverrides={monthlyOverrides}
            variableExpenses={variableExpenses}
            debts={debts}
            debtPayments={debtPayments}
            fixedIncomes={fixedIncomes}
            monthlyIncomeOverrides={monthlyIncomeOverrides}
            variableIncomes={variableIncomes}
            savingsGoals={savingsGoals}
            savingContributions={savingContributions}
            categories={categories}
            accounts={accounts}
            rates={rates}
            userId={userId}
            onOpenQuickPayment={onOpenQuickPayment}
          />
        </div>
      )}
    </div>
  );
};
