import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DollarSign,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  CreditCard,
  Plus,
  Sparkles,
  PiggyBank,
  ArrowRight,
  Check,
  RotateCcw,
  CornerDownRight,
  Wallet,
  X,
  Lightbulb,
  Clock,
  ShieldCheck,
  Coins,
  ArrowLeftRight,
} from 'lucide-react';
import type {
  FortnightType,
  FixedIncome,
  MonthlyFixedIncomeOverride,
  VariableIncome,
  FixedExpense,
  MonthlyFixedOverride,
  Debt,
  DebtPayment,
  SavingsGoal,
  SavingContribution,
  ExchangeRatesData,
  Account,
  Category,
} from '../types/index.ts';
import { MonthPicker } from './MonthPicker.tsx';
import {
  db,
  getFortnightPeriodKey,
  setFortnightExpensePaid,
  unmarkFortnightExpensePaid,
  setFortnightExpenseSkipped,
  unmarkFortnightExpenseSkipped,
  setFortnightDebtSkipped,
  unmarkFortnightDebtSkipped,
  addTransaction,
  saveVariableIncome,
} from '../lib/db.ts';
import { AddPaymentModal } from './AddPaymentModal.tsx';
import { AddDebtModal } from './AddDebtModal.tsx';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface FortnightPlannerProps {
  selectedYear: number;
  selectedMonth: number; // 0-11
  onChangePeriod: (year: number, month: number) => void;
  fixedIncomes: FixedIncome[];
  monthlyIncomeOverrides: MonthlyFixedIncomeOverride[];
  variableIncomes: VariableIncome[];
  fixedExpenses: FixedExpense[];
  monthlyOverrides: MonthlyFixedOverride[];
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
  onOpenQuickPayment?: (debtId?: string) => void;
  onNavigateToIncomes?: () => void;
  onNavigateToSavings?: () => void;
  onNavigateToDebts?: () => void;
  onNavigateToFixedExpenses?: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const FortnightPlanner: React.FC<FortnightPlannerProps> = ({
  selectedYear,
  selectedMonth,
  onChangePeriod,
  fixedIncomes,
  monthlyIncomeOverrides,
  variableIncomes,
  fixedExpenses,
  monthlyOverrides,
  debts,
  debtPayments,
  savingsGoals,
  savingContributions,
  accounts = [],
  categories = [],
  rates,
  currency = '$',
  onOpenQuickPayment: _onOpenQuickPayment,
  onNavigateToIncomes,
  onNavigateToSavings,
  onNavigateToDebts,
  onNavigateToFixedExpenses,
}) => {
  const [selectedFortnight, setSelectedFortnight] = useState<FortnightType>('q1');

  // Interactive Modals State
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    debtId?: string;
    amount?: number;
  }>({ isOpen: false });

  const [isDeficitLoanModalOpen, setIsDeficitLoanModalOpen] = useState<boolean>(false);
  const [isSavingsSurplusModalOpen, setIsSavingsSurplusModalOpen] = useState<boolean>(false);
  const [isBalanceSurplusModalOpen, setIsBalanceSurplusModalOpen] = useState<boolean>(false);

  // Surplus modal form inputs
  const [selectedSurplusGoalId, setSelectedSurplusGoalId] = useState<string>('');
  const [surplusSavingsAmount, setSurplusSavingsAmount] = useState<number>(0);
  const [selectedSurplusAccountId, setSelectedSurplusAccountId] = useState<string>('');
  const [surplusBalanceAmount, setSurplusBalanceAmount] = useState<number>(0);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Smart Deficit / Cover Modals State
  const [isCoverDeficitModalOpen, setIsCoverDeficitModalOpen] = useState<boolean>(false);
  const [coverDeficitAccountId, setCoverDeficitAccountId] = useState<string>('');
  const [coverDeficitAmount, setCoverDeficitAmount] = useState<number>(0);

  // Single-Salary / Advance from Other Fortnight Modal
  const [isAdvanceSalaryModalOpen, setIsAdvanceSalaryModalOpen] = useState<boolean>(false);
  const [advanceSalaryAmount, setAdvanceSalaryAmount] = useState<number>(0);

  // Skip Modal Confirmation State
  const [skipModalData, setSkipModalData] = useState<{
    isOpen: boolean;
    expense?: FixedExpense;
    debtId?: string;
    debtName?: string;
    amount?: number;
    isDebt?: boolean;
  }>({ isOpen: false });

  // Deficit Payment Warning Modal State (when clicking 'Pagado' with insufficient funds)
  const [deficitWarningData, setDeficitWarningData] = useState<{
    isOpen: boolean;
    expense?: FixedExpense;
    amount: number;
  }>({ isOpen: false, amount: 0 });

  // Reactive DB queries for Fortnight Item States
  const allFortnightStates = useLiveQuery(() => db.fortnight_item_states.toArray(), []) || [];

  const monthName = MONTH_NAMES[selectedMonth];
  const fortnightLabel = selectedFortnight === 'q1'
    ? `Quincena 15 de ${monthName} ${selectedYear}`
    : `Quincena 30 de ${monthName} ${selectedYear}`;

  const activePeriodKey = getFortnightPeriodKey(selectedYear, selectedMonth, selectedFortnight);

  // Previous fortnight period context (to detect postponed/rolled-over items)
  const prevPeriodInfo = useMemo(() => {
    if (selectedFortnight === 'q2') {
      return {
        year: selectedYear,
        month: selectedMonth,
        fortnight: 'q1' as FortnightType,
        key: getFortnightPeriodKey(selectedYear, selectedMonth, 'q1'),
        label: 'Q15',
      };
    } else {
      const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      return {
        year: prevYear,
        month: prevMonth,
        fortnight: 'q2' as FortnightType,
        key: getFortnightPeriodKey(prevYear, prevMonth, 'q2'),
        label: `Q30 de ${MONTH_NAMES[prevMonth]}`,
      };
    }
  }, [selectedYear, selectedMonth, selectedFortnight]);

  // 1. Active fixed incomes for this fortnight
  const activeFortnightFixedIncomes = useMemo(() => {
    const overrideMap = new Map(
      monthlyIncomeOverrides
        .filter((o) => o.year === selectedYear && o.month === selectedMonth)
        .map((o) => [o.fixed_income_id, o])
    );

    return fixedIncomes
      .filter((fi) => {
        const override = overrideMap.get(fi.id);
        const isActive = override?.is_active !== undefined ? override.is_active : fi.is_active;
        if (!isActive) return false;

        if (fi.default_fortnight === 'both' || fi.default_fortnight === 'split') return true;
        return fi.default_fortnight === selectedFortnight;
      })
      .map((fi) => {
        const override = overrideMap.get(fi.id);
        const amount = override?.custom_amount !== undefined ? override.custom_amount : fi.amount;
        const finalAmount = fi.default_fortnight === 'split' ? Number((amount / 2).toFixed(2)) : amount;
        const cleanNotes = (fi.notes || '').replace(/\[split\]/gi, '').trim();
        return {
          id: fi.id,
          name: fi.name,
          finalAmount,
          notes: cleanNotes || (fi.default_fortnight === 'split' ? '50% distribución de sueldo' : 'Ingreso fijo'),
          isFixed: true,
        };
      });
  }, [fixedIncomes, monthlyIncomeOverrides, selectedYear, selectedMonth, selectedFortnight]);

  // 2. Active variable incomes for this month and fortnight
  const activeFortnightVariables = useMemo(() => {
    return variableIncomes
      .filter(
        (vi) =>
          vi.year === selectedYear &&
          vi.month === selectedMonth &&
          vi.fortnight === selectedFortnight
      )
      .map((vi) => ({
        id: vi.id,
        name: vi.description,
        finalAmount: vi.amount,
        notes: vi.notes || 'Ingreso extra',
        isFixed: false,
      }));
  }, [variableIncomes, selectedYear, selectedMonth, selectedFortnight]);

  // All combined incomes for this fortnight
  const allFortnightIncomes = useMemo(() => {
    return [...activeFortnightFixedIncomes, ...activeFortnightVariables];
  }, [activeFortnightFixedIncomes, activeFortnightVariables]);

  const totalAvailable = allFortnightIncomes.reduce((sum, inc) => sum + inc.finalAmount, 0);

  // Other fortnight context for single-salary guidance (e.g. user gets paid only on Q30)
  const otherFortnight = selectedFortnight === 'q1' ? 'q2' : 'q1';
  const otherFortnightLabel = selectedFortnight === 'q1' ? 'Quincena 30' : 'Quincena 15';

  const otherFortnightIncomeTotal = useMemo(() => {
    const overrideMap = new Map(
      monthlyIncomeOverrides
        .filter((o) => o.year === selectedYear && o.month === selectedMonth)
        .map((o) => [o.fixed_income_id, o])
    );
    const fixedSum = fixedIncomes
      .filter((fi) => {
        const override = overrideMap.get(fi.id);
        const isActive = override?.is_active !== undefined ? override.is_active : fi.is_active;
        if (!isActive) return false;
        if (fi.default_fortnight === 'both' || fi.default_fortnight === 'split') return true;
        return fi.default_fortnight === otherFortnight;
      })
      .reduce((sum, fi) => {
        const override = overrideMap.get(fi.id);
        const amount = override?.custom_amount !== undefined ? override.custom_amount : fi.amount;
        return sum + (fi.default_fortnight === 'split' ? Number((amount / 2).toFixed(2)) : amount);
      }, 0);

    const varSum = variableIncomes
      .filter((vi) => vi.year === selectedYear && vi.month === selectedMonth && vi.fortnight === otherFortnight)
      .reduce((sum, vi) => sum + vi.amount, 0);

    return fixedSum + varSum;
  }, [fixedIncomes, monthlyIncomeOverrides, variableIncomes, selectedYear, selectedMonth, otherFortnight]);

  // 3. Active fixed expenses for this fortnight (including postponed from previous cut)
  const activeFortnightFixedExpenses = useMemo(() => {
    const overrideMap = new Map(
      monthlyOverrides
        .filter((o) => o.year === selectedYear && o.month === selectedMonth)
        .map((o) => [o.fixed_expense_id, o])
    );

    // Regular active fixed expenses scheduled for this fortnight
    const regularExpenses = fixedExpenses
      .filter((fe) => {
        const override = overrideMap.get(fe.id);
        const isActive = override?.is_active !== undefined ? override.is_active : fe.is_active;
        if (!isActive) return false;

        if (fe.default_fortnight === 'both') return true;
        return fe.default_fortnight === selectedFortnight;
      })
      .map((fe) => {
        const override = overrideMap.get(fe.id);
        const amount = override?.custom_amount !== undefined ? override.custom_amount : fe.amount;
        const state = allFortnightStates.find(
          (s) => s.item_id === fe.id && (s.item_type === 'fixed_expense' || s.item_type === 'expense') && s.period_key === activePeriodKey
        );

        return {
          ...fe,
          finalAmount: amount,
          isAssumed: override?.assumed_by_third_party || fe.assumed_by_third_party,
          isPaid: state?.status === 'paid',
          isSkipped: state?.status === 'skipped',
          isPostponedFromPrev: false,
          prevLabel: '',
        };
      });

    // Postponed expenses from previous fortnight that were marked 'skipped'
    const regularIds = new Set(regularExpenses.map((r) => r.id));
    const postponedExpenses = fixedExpenses
      .filter((fe) => {
        if (regularIds.has(fe.id)) return false;
        const prevSkippedState = allFortnightStates.find(
          (s) => s.item_id === fe.id && (s.item_type === 'fixed_expense' || s.item_type === 'expense') && s.period_key === prevPeriodInfo.key && s.status === 'skipped'
        );
        return Boolean(prevSkippedState);
      })
      .map((fe) => {
        const override = overrideMap.get(fe.id);
        const amount = override?.custom_amount !== undefined ? override.custom_amount : fe.amount;
        const state = allFortnightStates.find(
          (s) => s.item_id === fe.id && (s.item_type === 'fixed_expense' || s.item_type === 'expense') && s.period_key === activePeriodKey
        );

        return {
          ...fe,
          finalAmount: amount,
          isAssumed: override?.assumed_by_third_party || fe.assumed_by_third_party,
          isPaid: state?.status === 'paid',
          isSkipped: state?.status === 'skipped',
          isPostponedFromPrev: true,
          prevLabel: prevPeriodInfo.label,
        };
      });

    return [...regularExpenses, ...postponedExpenses];
  }, [fixedExpenses, monthlyOverrides, selectedYear, selectedMonth, selectedFortnight, allFortnightStates, activePeriodKey, prevPeriodInfo]);

  // Total cost of fixed expenses: excludes assumed and skipped
  const totalFixedCost = useMemo(() => {
    return activeFortnightFixedExpenses
      .filter((fe) => !fe.isAssumed && !fe.isSkipped)
      .reduce((sum, fe) => sum + fe.finalAmount, 0);
  }, [activeFortnightFixedExpenses]);

  // 4. Debts Due in this fortnight
  const debtsDueThisFortnight = useMemo(() => {
    return debts
      .filter((d) => {
        if (d.status === 'paid' || d.current_balance <= 0) return false;

        // Filter by start period if set
        if (d.start_year !== undefined && d.start_month !== undefined) {
          if (selectedYear < d.start_year) return false;
          if (selectedYear === d.start_year && selectedMonth < d.start_month) return false;
          if (
            selectedYear === d.start_year &&
            selectedMonth === d.start_month &&
            d.start_fortnight === 'q2' &&
            selectedFortnight === 'q1'
          ) {
            return false;
          }
        }

        if (!d.fortnight_due || d.fortnight_due === 'both') return true;
        return d.fortnight_due === selectedFortnight;
      })
      .map((d) => {
        const cuota = d.installment_amount || (d.pending_installments ? d.current_balance / d.pending_installments : d.current_balance);
        const hasPayment = debtPayments.some(
          (dp) =>
            dp.debt_id === d.id &&
            dp.year === selectedYear &&
            dp.month === selectedMonth &&
            dp.fortnight === selectedFortnight
        );
        const state = allFortnightStates.find(
          (s) => s.item_id === d.id && s.item_type === 'debt' && s.period_key === activePeriodKey
        );
        const isSkipped = state?.status === 'skipped';
        const isPaid = hasPayment || state?.status === 'paid';

        return {
          ...d,
          calculatedCuota: Math.min(d.current_balance, cuota),
          isPaid,
          isSkipped,
        };
      });
  }, [debts, debtPayments, selectedYear, selectedMonth, selectedFortnight, allFortnightStates, activePeriodKey]);

  // Actual debt payments recorded in this fortnight
  const actualDebtPayments = useMemo(() => {
    return debtPayments.filter(
      (dp) =>
        dp.year === selectedYear &&
        dp.month === selectedMonth &&
        dp.fortnight === selectedFortnight
    );
  }, [debtPayments, selectedYear, selectedMonth, selectedFortnight]);

  const actualDebtPaidTotal = actualDebtPayments.reduce((sum, dp) => sum + dp.amount, 0);

  // Planned non-skipped debts commitment
  const totalDebtInstallmentCommitment = useMemo(() => {
    return debtsDueThisFortnight
      .filter((d) => !d.isSkipped)
      .reduce((sum, d) => sum + d.calculatedCuota, 0);
  }, [debtsDueThisFortnight]);

  // Effective debt commitment: maximum of scheduled non-skipped debts vs actual paid
  const effectiveDebtCost = Math.max(totalDebtInstallmentCommitment, actualDebtPaidTotal);

  // 5. Planned Savings Goals for this Fortnight
  const fortnightSavingsGoals = useMemo(() => {
    return savingsGoals
      .filter((g) => g.status === 'active')
      .filter((g) => {
        if (g.frequency === 'fortnightly' || g.target_fortnight === null || (g.target_fortnight as any) === 'both') return true;
        return selectedFortnight === 'q1'
          ? g.target_fortnight === 15 || (g.target_fortnight as any) === 'q1'
          : g.target_fortnight === 30 || (g.target_fortnight as any) === 'q2';
      });
  }, [savingsGoals, selectedFortnight]);

  const plannedSavingsTotal = fortnightSavingsGoals.reduce((sum, g) => sum + g.amount_per_period, 0);

  // Check actual contributions in this fortnight
  const actualContributions = useMemo(() => {
    return savingContributions.filter(
      (sc) =>
        sc.year === selectedYear &&
        sc.month === selectedMonth &&
        sc.fortnight === selectedFortnight
    );
  }, [savingContributions, selectedYear, selectedMonth, selectedFortnight]);

  // Total Committed (Fixed Expenses + Debt Commitments)
  const totalCommitted = totalFixedCost + effectiveDebtCost;

  // Dinero Libre Real (after expenses, debts, and planned savings)
  const netRemaining = totalAvailable - (totalCommitted + plannedSavingsTotal);

  // Actions for Fixed Expenses
  const handleRequestMarkExpensePaid = (expense: FixedExpense, amount: number) => {
    // If in deficit / negative Dinero Libre or 0 available income, show the friendly option modal
    if (netRemaining < 0 || totalAvailable <= 0) {
      setDeficitWarningData({
        isOpen: true,
        expense,
        amount,
      });
      return;
    }

    // Otherwise mark paid directly
    handleExecuteMarkPaid(expense, amount, accounts[0]?.id || '');
  };

  const handleExecuteMarkPaid = async (expense: FixedExpense, amount: number, accountId?: string) => {
    try {
      await setFortnightExpensePaid({
        expense,
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
        amount,
        accountId: accountId || accounts[0]?.id || '',
      });
      setDeficitWarningData({ isOpen: false, amount: 0 });
    } catch (err) {
      console.error('Error marking expense as paid:', err);
    }
  };

  const handleUnmarkExpensePaid = async (expenseId: string) => {
    try {
      await unmarkFortnightExpensePaid({
        expenseId,
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
      });
    } catch (err) {
      console.error('Error unmarking expense paid:', err);
    }
  };

  // Skip Handlers
  const handleRequestSkipExpense = (expense: FixedExpense) => {
    setSkipModalData({
      isOpen: true,
      expense,
      amount: expense.amount,
      isDebt: false,
    });
  };

  const handleConfirmSkipExpense = async () => {
    if (!skipModalData.expense) return;
    try {
      await setFortnightExpenseSkipped({
        expenseId: skipModalData.expense.id,
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
      });
      setSkipModalData({ isOpen: false });
    } catch (err) {
      console.error('Error skipping expense:', err);
    }
  };

  const handleUnskipExpense = async (expenseId: string) => {
    try {
      await unmarkFortnightExpenseSkipped({
        expenseId,
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
      });
    } catch (err) {
      console.error('Error unskipping expense:', err);
    }
  };

  // Actions for Debts
  const handleRequestSkipDebt = (debtId: string, creditor: string, cuota: number) => {
    setSkipModalData({
      isOpen: true,
      debtId,
      debtName: creditor,
      amount: cuota,
      isDebt: true,
    });
  };

  const handleConfirmSkipDebt = async () => {
    if (!skipModalData.debtId) return;
    try {
      await setFortnightDebtSkipped({
        debtId: skipModalData.debtId,
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
      });
      setSkipModalData({ isOpen: false });
    } catch (err) {
      console.error('Error skipping debt installment:', err);
    }
  };

  const handleUnskipDebt = async (debtId: string) => {
    try {
      await unmarkFortnightDebtSkipped({
        debtId,
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
      });
    } catch (err) {
      console.error('Error unskipping debt installment:', err);
    }
  };

  const handleOpenDebtPayment = (debtId: string, cuotaAmount: number) => {
    setPaymentModalData({
      isOpen: true,
      debtId,
      amount: cuotaAmount,
    });
  };

  // Surplus modal open actions
  const handleOpenSavingsSurplus = () => {
    const goal = savingsGoals.find((g) => g.status === 'active') || savingsGoals[0];
    if (goal) setSelectedSurplusGoalId(goal.id);
    setSurplusSavingsAmount(Number(Math.max(0, netRemaining).toFixed(2)));
    setIsSavingsSurplusModalOpen(true);
  };

  const handleOpenBalanceSurplus = () => {
    if (accounts.length > 0) setSelectedSurplusAccountId(accounts[0].id);
    setSurplusBalanceAmount(Number(Math.max(0, netRemaining).toFixed(2)));
    setIsBalanceSurplusModalOpen(true);
  };

  const handleConfirmBalanceSurplus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurplusAccountId || surplusBalanceAmount <= 0) return;
    setIsProcessingAction(true);
    try {
      const defaultIncomeCat = categories.find((c) => c.type === 'income')?.id || 'cat_salary';
      await addTransaction({
        amount: surplusBalanceAmount,
        type: 'income',
        description: `Traspaso Superávit (${fortnightLabel})`,
        category_id: defaultIncomeCat,
        account_id: selectedSurplusAccountId,
        transaction_date: activePeriodKey,
      });
      setIsBalanceSurplusModalOpen(false);
    } catch (err) {
      console.error('Error adding surplus transaction to balance:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Smart Cover Deficit from Account Balance
  const handleOpenCoverDeficitModal = () => {
    if (accounts.length > 0) setCoverDeficitAccountId(accounts[0].id);
    setCoverDeficitAmount(Number(Math.abs(netRemaining).toFixed(2)));
    setIsCoverDeficitModalOpen(true);
  };

  const handleConfirmCoverDeficit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverDeficitAccountId || coverDeficitAmount <= 0) return;
    setIsProcessingAction(true);
    try {
      const acc = accounts.find((a) => a.id === coverDeficitAccountId);
      await saveVariableIncome({
        amount: coverDeficitAmount,
        description: `Fondos de cuenta: ${acc?.name || 'Balance'} (${selectedFortnight === 'q1' ? 'Q15' : 'Q30'})`,
        category_id: 'cat_salary',
        account_id: coverDeficitAccountId,
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
        notes: `Transferido desde cuenta para cubrir déficit de ${fortnightLabel}`,
      });
      setIsCoverDeficitModalOpen(false);
    } catch (err) {
      console.error('Error covering deficit from account:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Smart Advance Salary from Other Fortnight (e.g. from Q30 to Q15)
  const handleOpenAdvanceSalaryModal = () => {
    setAdvanceSalaryAmount(Number(Math.abs(netRemaining).toFixed(2)));
    setIsAdvanceSalaryModalOpen(true);
  };

  const handleConfirmAdvanceSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (advanceSalaryAmount <= 0) return;
    setIsProcessingAction(true);
    try {
      const sourceLabel = otherFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30';
      const targetLabel = selectedFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30';

      // 1. Ingreso asignado en la quincena actual con déficit (ej. Q15)
      await saveVariableIncome({
        amount: advanceSalaryAmount,
        description: `Asignación de Sueldo (Tomado de ${sourceLabel})`,
        category_id: 'cat_salary',
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
        notes: `Fondos tomados del cobro de ${sourceLabel} para cubrir gastos de ${targetLabel}`,
      });

      // 2. Reserva/deducción registrada en la otra quincena (ej. Q30)
      await saveVariableIncome({
        amount: -advanceSalaryAmount,
        description: `Reserva asignada a ${targetLabel}`,
        category_id: 'cat_salary',
        year: selectedYear,
        month: selectedMonth,
        fortnight: otherFortnight,
        notes: `Fondos adelantados para cubrir compromisos de ${targetLabel}`,
      });

      setIsAdvanceSalaryModalOpen(false);
    } catch (err) {
      console.error('Error advancing salary from other fortnight:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Batch Postpone all active pending expenses to next fortnight
  const handleBatchPostponeToNextFortnight = async () => {
    if (!window.confirm(`¿Deseas posponer todos los gastos pendientes de esta ${selectedFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'} para el siguiente corte?`)) {
      return;
    }
    try {
      for (const fe of activeFortnightFixedExpenses) {
        if (!fe.isPaid && !fe.isSkipped && !fe.isAssumed) {
          await setFortnightExpenseSkipped({
            expenseId: fe.id,
            year: selectedYear,
            month: selectedMonth,
            fortnight: selectedFortnight,
          });
        }
      }
    } catch (err) {
      console.error('Error batch postponing expenses:', err);
    }
  };

  // Deficit Resolution Handler (Loan)
  const handleDeficitLoanSaved = async (newDebt: Debt) => {
    try {
      await saveVariableIncome({
        amount: newDebt.total_amount,
        description: `Préstamo recibido: ${newDebt.creditor}`,
        category_id: 'cat_salary',
        account_id: accounts[0]?.id || '',
        year: selectedYear,
        month: selectedMonth,
        fortnight: selectedFortnight,
        notes: `Fondos obtenidos para equilibrar déficit de ${fortnightLabel}`,
      });
      setIsDeficitLoanModalOpen(false);
    } catch (err) {
      console.error('Error recording deficit loan income:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Month & Period Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-3xl bg-surface border border-app shadow-md">
        <MonthPicker
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChange={onChangePeriod}
          className="w-full sm:w-auto justify-between sm:justify-start"
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Quincena 15 vs 30 Selector */}
          <div className="w-full sm:w-auto grid grid-cols-2 gap-1 p-1 bg-card rounded-2xl border border-app">
            <button
              onClick={() => setSelectedFortnight('q1')}
              className={`py-2 px-3 sm:py-1.5 sm:px-4 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                selectedFortnight === 'q1'
                  ? 'bg-primary-custom text-white shadow-md'
                  : 'text-muted hover:text-app'
              }`}
            >
              Quincena 15
            </button>
            <button
              onClick={() => setSelectedFortnight('q2')}
              className={`py-2 px-3 sm:py-1.5 sm:px-4 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                selectedFortnight === 'q2'
                  ? 'bg-primary-custom text-white shadow-md'
                  : 'text-muted hover:text-app'
              }`}
            >
              Quincena 30
            </button>
          </div>
        </div>
      </div>

      {/* Fortnight Key Metrics Summary (Hero Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Available Card */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="text-[11px] sm:text-xs font-semibold">Total Ingresos</span>
            <div className="w-6 h-6 rounded-lg bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-2xl font-black text-[#00C2C7] tracking-tight">
            {currency}{totalAvailable.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted block truncate">
            {activeFortnightFixedIncomes.length} fijos + {activeFortnightVariables.length} extras
          </span>
        </div>

        {/* Total Committed Card (Expenses + Debts) */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="text-[11px] sm:text-xs font-semibold">Gastos & Cuotas</span>
            <div className="w-6 h-6 rounded-lg bg-[#FF914D]/20 text-[#FF914D] flex items-center justify-center font-bold">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-2xl font-black text-[#FF914D] tracking-tight">
            {currency}{totalCommitted.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted block truncate">
            Fijos ({currency}{totalFixedCost.toFixed(2)}) + Deudas ({currency}{effectiveDebtCost.toFixed(2)})
          </span>
        </div>

        {/* Planned Savings Card */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="text-[11px] sm:text-xs font-semibold">Ahorro Planificado</span>
            <div className="w-6 h-6 rounded-lg bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-base sm:text-2xl font-black text-[#00C2C7] tracking-tight">
            {currency}{plannedSavingsTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted block truncate">
            En {fortnightSavingsGoals.length} metas de ahorro
          </span>
        </div>

        {/* Dinero Libre Real Card (with Interactive Actions) */}
        <div
          className={`p-3 sm:p-4 rounded-2xl border shadow-sm space-y-1.5 transition-all ${
            netRemaining >= 0
              ? 'bg-gradient-to-br from-surface via-surface to-[#00C2C7]/15 border-[#00C2C7]/40'
              : 'bg-gradient-to-br from-surface via-surface to-[#ef4444]/20 border-[#ef4444]/40'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] sm:text-xs text-app font-bold">Dinero Libre</span>
            {netRemaining >= 0 ? (
              <CheckCircle2 className="w-4 h-4 text-[#00C2C7]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
            )}
          </div>
          <p
            className={`text-base sm:text-2xl font-black tracking-tight ${
              netRemaining >= 0 ? 'text-app' : 'text-[#ef4444]'
            }`}
          >
            {currency}{netRemaining.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          
          <div className="pt-0.5">
            {netRemaining > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleOpenSavingsSurplus}
                  className="px-2 py-1 rounded-lg bg-[#00C2C7]/20 hover:bg-[#00C2C7]/30 text-[#00C2C7] border border-[#00C2C7]/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <PiggyBank className="w-3 h-3" /> Ahorrar
                </button>
                <button
                  type="button"
                  onClick={handleOpenBalanceSurplus}
                  className="px-2 py-1 rounded-lg bg-primary-custom/20 hover:bg-primary-custom/30 text-primary-custom border border-primary-custom/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Wallet className="w-3 h-3" /> A Balance
                </button>
              </div>
            ) : netRemaining < 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleOpenCoverDeficitModal}
                  className="px-2 py-1 rounded-lg bg-primary-custom/20 hover:bg-primary-custom/30 text-primary-custom border border-primary-custom/40 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Wallet className="w-3 h-3" /> De Balance
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeficitLoanModalOpen(true)}
                  className="px-2 py-1 rounded-lg bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <CreditCard className="w-3 h-3" /> Préstamo
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-muted block">Presupuesto balanceado a 0</span>
            )}
          </div>
        </div>
      </div>

      {/* Smart Suggestions & Assistance Banner (Cobro Único / Déficit) */}
      {netRemaining < 0 && (
        <div className="p-4 rounded-3xl bg-surface border border-amber-500/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-app flex items-center gap-1.5">
                <span>Sugerencia Inteligente de Planificación</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                  Déficit: ${Math.abs(netRemaining).toFixed(2)}
                </span>
              </h4>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                {selectedFortnight === 'q1' && otherFortnightIncomeTotal > 0 ? (
                  <>
                    Cobras en <strong>{otherFortnightLabel} (${otherFortnightIncomeTotal.toFixed(2)} USD)</strong>. Puedes tomar dinero de tu cobro del 30 para cubrir esta quincena o posponer los gastos para el día 30.
                  </>
                ) : otherFortnightIncomeTotal > 0 ? (
                  <>
                    Tienes ingresos en <strong>{otherFortnightLabel} (${otherFortnightIncomeTotal.toFixed(2)} USD)</strong>. Puedes tomar dinero de ese corte para equilibrar esta quincena o posponer compromisos.
                  </>
                ) : (
                  <>
                    Los compromisos de este corte exceden tus ingresos. Puedes tomar fondos de tus cuentas/balance, posponer gastos para el próximo corte o registrar un préstamo.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
            {otherFortnightIncomeTotal > 0 ? (
              <>
                <button
                  type="button"
                  onClick={handleOpenAdvanceSalaryModal}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Tomar dinero de la {otherFortnight === 'q1' ? 'Q15' : 'Q30'}</span>
                </button>

                {activeFortnightFixedExpenses.some(f => !f.isPaid && !f.isSkipped && !f.isAssumed) && (
                  <button
                    type="button"
                    onClick={handleBatchPostponeToNextFortnight}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CornerDownRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Posponer a {otherFortnight === 'q1' ? 'Q15' : 'Q30'}</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleOpenCoverDeficitModal}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Cubrir con Cuenta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeficitLoanModalOpen(true)}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pedir Préstamo</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Income Breakdown for this Fortnight */}
      <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary-custom" />
            <h3 className="text-sm font-bold text-app">
              Ingresos de la {fortnightLabel} ({allFortnightIncomes.length})
            </h3>
          </div>
          {onNavigateToIncomes && (
            <button
              onClick={onNavigateToIncomes}
              className="text-xs font-bold text-primary-custom hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Gestionar Ingresos
            </button>
          )}
        </div>

        {allFortnightIncomes.length === 0 ? (
          <p className="text-xs text-muted py-3 text-center">Sin ingresos activos asignados para este corte.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {allFortnightIncomes.map((inc) => (
              <div
                key={inc.id}
                className="p-3 rounded-2xl bg-card border border-app flex items-center justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-app">{inc.name}</h4>
                    {inc.isFixed ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary-custom/15 text-primary-custom font-semibold">
                        Fijo
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#FF914D]/15 text-[#FF914D] font-semibold flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> Extra
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted">{inc.notes}</span>
                </div>
                <span className="text-sm font-black text-[#00C2C7]">+{currency}{inc.finalAmount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ahorro Quincenal Programado Hero Section */}
      <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-[#00C2C7]" />
            <h3 className="text-sm font-bold text-app">
              Ahorro Quincenal Programado ({fortnightSavingsGoals.length} metas)
            </h3>
          </div>
          {onNavigateToSavings && (
            <button
              onClick={onNavigateToSavings}
              className="text-xs font-bold text-[#00C2C7] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver Planes de Ahorro <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {fortnightSavingsGoals.length === 0 ? (
          <p className="text-xs text-muted py-2 text-center">No hay metas de ahorro programadas para esta quincena.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {fortnightSavingsGoals.map((g) => {
              const contrib = actualContributions.find((ac) => ac.goal_id === g.id);

              return (
                <div
                  key={g.id}
                  className="p-3 rounded-2xl bg-card border border-app flex items-center justify-between shadow-sm"
                >
                  <div>
                    <h4 className="text-xs font-bold text-app">{g.name}</h4>
                    <span className="text-[10px] text-muted">
                      Acumulado: ${Number(g.current_amount).toFixed(2)} / ${Number(g.target_amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-[#00C2C7] block">
                      ${Number(g.amount_per_period).toFixed(2)}
                    </span>
                    {contrib?.is_skipped ? (
                      <span className="text-[9px] font-bold text-[#FF914D]">OMITIDO</span>
                    ) : contrib ? (
                      <span className="text-[9px] font-bold text-emerald-400">APORTADO</span>
                    ) : (
                      <span className="text-[9px] text-muted">Pendiente</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fortnight Commitments: Fixed Expenses + Debts Due with Interactive Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fixed Expenses for this Fortnight */}
        <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-app pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-app uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-primary-custom" />
                Gastos Fijos Asignados ({activeFortnightFixedExpenses.length})
              </h4>
              <span className="text-[10px] text-muted">
                {activeFortnightFixedExpenses.filter(f => f.isPaid).length} cubiertos • {activeFortnightFixedExpenses.filter(f => f.isSkipped).length} omitidos
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-[#FF914D] block">
                {currency}{totalFixedCost.toFixed(2)}
              </span>
              {onNavigateToFixedExpenses && (
                <button
                  onClick={onNavigateToFixedExpenses}
                  className="text-[10px] text-primary-custom hover:underline font-semibold"
                >
                  Gestionar
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {activeFortnightFixedExpenses.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">No hay gastos fijos en este corte</p>
            ) : (
              activeFortnightFixedExpenses.map((fe) => {
                const bcv = rates?.bcvDollar && rates.bcvDollar > 0 ? rates.bcvDollar : 1;
                const isVes = fe.currency === 'VES';

                return (
                  <div
                    key={fe.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      fe.isPaid
                        ? 'bg-card/60 border-emerald-500/30 opacity-85'
                        : fe.isSkipped
                        ? 'bg-card/60 border-amber-500/30 opacity-80'
                        : 'bg-card border-app hover:border-app-hover shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-bold truncate ${fe.isPaid ? 'line-through text-muted' : 'text-app'}`}>
                            {fe.name}
                          </span>
                          {fe.isPostponedFromPrev && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold flex items-center gap-0.5">
                              <CornerDownRight className="w-2.5 h-2.5" /> Pospuesto ({fe.prevLabel})
                            </span>
                          )}
                          {fe.isAssumed && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                              Cubierto 3ro
                            </span>
                          )}
                        </div>
                        {isVes && fe.original_amount ? (
                          <span className="text-[10px] text-muted block">
                            Bs. {Number(fe.original_amount).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted block">
                            ≈ Bs. {(fe.finalAmount * bcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs font-black block ${fe.isSkipped ? 'line-through text-muted' : 'text-app'}`}>
                          ${fe.finalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Action Row */}
                    {!fe.isAssumed && (
                      <div className="flex items-center justify-between pt-1.5 border-t border-app/50 text-[11px]">
                        {fe.isPaid ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Cubierto
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnmarkExpensePaid(fe.id)}
                              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer flex items-center gap-0.5"
                            >
                              <RotateCcw className="w-2.5 h-2.5" /> Deshacer
                            </button>
                          </div>
                        ) : fe.isSkipped ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                              <CornerDownRight className="w-3 h-3" /> Omitido (Pasa al próximo corte)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnskipExpense(fe.id)}
                              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer flex items-center gap-0.5"
                            >
                              <RotateCcw className="w-2.5 h-2.5" /> Restaurar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => handleRequestSkipExpense(fe)}
                              className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="Omitir en este corte"
                            >
                              <CornerDownRight className="w-3 h-3" /> Omitir
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestMarkExpensePaid(fe, fe.finalAmount)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Marcar como pagado"
                            >
                              <Check className="w-3 h-3" /> Pagado
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Debts Due in this Fortnight with Interactive Flow */}
        <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-app pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-app uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#FF914D]" />
                Cuotas de Deudas ({debtsDueThisFortnight.length})
              </h4>
              <span className="text-[10px] text-muted">
                {debtsDueThisFortnight.filter(d => d.isPaid).length} abonadas • {debtsDueThisFortnight.filter(d => d.isSkipped).length} omitidas
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-[#FF914D] block">
                {currency}{effectiveDebtCost.toFixed(2)}
              </span>
              {onNavigateToDebts && (
                <button
                  onClick={onNavigateToDebts}
                  className="text-[10px] text-primary-custom hover:underline font-semibold"
                >
                  Ver Deudas
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {debtsDueThisFortnight.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted">No hay cuotas de deudas venciendo en este corte</p>
              </div>
            ) : (
              debtsDueThisFortnight.map((d) => {
                return (
                  <div
                    key={d.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      d.isPaid
                        ? 'bg-card/60 border-emerald-500/30 opacity-85'
                        : d.isSkipped
                        ? 'bg-card/60 border-amber-500/30 opacity-80'
                        : 'bg-card border-app hover:border-app-hover shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-bold block truncate ${d.isPaid ? 'line-through text-muted' : 'text-app'}`}>
                          {d.creditor}
                        </span>
                        <span className="text-[10px] text-muted block">
                          Saldo: ${Number(d.current_balance).toFixed(2)} {d.debt_mode === 'open' ? '(Pago Abierto)' : d.pending_installments ? `(${d.pending_installments} cuotas rest.)` : ''}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs font-black block ${d.isSkipped ? 'line-through text-muted' : 'text-[#FF914D]'}`}>
                          -{currency}{d.calculatedCuota.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Action Row for Debts */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-app/50 text-[11px]">
                      {d.isPaid ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Cuota Abonada
                          </span>
                        </div>
                      ) : d.isSkipped ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3" /> Cuota Omitida
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnskipDebt(d.id)}
                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer flex items-center gap-0.5"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> Restaurar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => handleRequestSkipDebt(d.id, d.creditor, d.calculatedCuota)}
                            className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="Omitir pago de cuota en esta quincena"
                          >
                            <CornerDownRight className="w-3 h-3" /> Omitir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDebtPayment(d.id, d.calculatedCuota)}
                            className="px-2.5 py-1 rounded-xl bg-primary-custom text-white text-[10px] font-bold hover:opacity-90 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Abonar a esta deuda"
                          >
                            <DollarSign className="w-3 h-3" /> Abonar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal 1: Ahorrar Superávit */}
      {isSavingsSurplusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsSavingsSurplusModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Destinar Superávit a Meta de Ahorro</h3>
                  <p className="text-[10px] text-muted">Aprovecha el dinero libre para acelerar tus metas</p>
                </div>
              </div>
              <button
                onClick={() => setIsSavingsSurplusModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBalanceSurplus} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Seleccionar Meta</label>
                <select
                  value={selectedSurplusGoalId}
                  onChange={(e) => setSelectedSurplusGoalId(e.target.value)}
                  className="w-full bg-card border border-app rounded-2xl px-3.5 py-2.5 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-[#00C2C7]"
                >
                  {savingsGoals.map((g) => (
                    <option key={g.id} value={g.id} className="bg-card text-app">
                      {g.name} (Actual: ${Number(g.current_amount).toFixed(2)} / Meta: ${Number(g.target_amount).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Monto a Aportar ($)</label>
                <MoneyInput
                  value={surplusSavingsAmount}
                  onChange={setSurplusSavingsAmount}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSavingsSurplusModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction || surplusSavingsAmount <= 0 || !selectedSurplusGoalId}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#00C2C7] to-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAction ? 'Guardando...' : 'Confirmar Aporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Pasar Superávit a Balance General */}
      {isBalanceSurplusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsBalanceSurplusModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Pasar Superávit a Cuenta / Balance</h3>
                  <p className="text-[10px] text-muted">Acredita el excedente quincenal en una de tus cuentas</p>
                </div>
              </div>
              <button
                onClick={() => setIsBalanceSurplusModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBalanceSurplus} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Cuenta Receptora</label>
                <select
                  value={selectedSurplusAccountId}
                  onChange={(e) => setSelectedSurplusAccountId(e.target.value)}
                  className="w-full bg-card border border-app rounded-2xl px-3.5 py-2.5 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-card text-app">
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Monto a Transferir ($)</label>
                <MoneyInput
                  value={surplusBalanceAmount}
                  onChange={setSurplusBalanceAmount}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBalanceSurplusModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction || surplusBalanceAmount <= 0 || !selectedSurplusAccountId}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-primary-custom to-[#00C2C7] text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAction ? 'Procesando...' : 'Acreditar Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Cubrir Déficit con Fondos de Cuenta / Balance */}
      {isCoverDeficitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsCoverDeficitModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Cubrir Déficit desde Cuenta</h3>
                  <p className="text-[10px] text-muted">Abona dinero disponible en cuenta para equilibrar el corte</p>
                </div>
              </div>
              <button
                onClick={() => setIsCoverDeficitModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCoverDeficit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Cuenta de Origen</label>
                {accounts.length === 0 ? (
                  <div className="p-3 rounded-2xl bg-card border border-amber-500/30 text-center space-y-1">
                    <p className="text-xs font-bold text-amber-400">No hay cuentas registradas</p>
                    <p className="text-[10px] text-muted">Registra una cuenta bancaria o fondo en Capital & Cuentas para usar esta opción.</p>
                  </div>
                ) : (
                  <select
                    value={coverDeficitAccountId}
                    onChange={(e) => setCoverDeficitAccountId(e.target.value)}
                    className="w-full bg-card border border-app rounded-2xl px-3.5 py-2.5 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} className="bg-card text-app">
                        {a.name} ({a.currency} • Saldo: ${Number(a.initial_balance).toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Monto a Asignar ($)</label>
                <MoneyInput
                  value={coverDeficitAmount}
                  onChange={setCoverDeficitAmount}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCoverDeficitModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction || coverDeficitAmount <= 0 || !coverDeficitAccountId || accounts.length === 0}
                  className="flex-1 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAction ? 'Asignando...' : 'Cubrir Déficit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Tomar Dinero de la Otra Quincena (Sueldo del 30 o Sueldo del 15) */}
      {isAdvanceSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsAdvanceSalaryModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Tomar dinero de la {otherFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'}</h3>
                  <p className="text-[10px] text-muted">Asigna fondos de tu cobro para cubrir los compromisos actuales</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdvanceSalaryModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdvanceSalary} className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-card border border-app space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-muted">
                  <span>Cobro disponible en {otherFortnightLabel}:</span>
                  <span className="font-bold text-app">${otherFortnightIncomeTotal.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>Déficit en esta quincena:</span>
                  <span className="font-bold text-[#ef4444]">-${Math.abs(netRemaining).toFixed(2)} USD</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Monto a Tomar ($ USD)</label>
                <MoneyInput
                  value={advanceSalaryAmount}
                  onChange={setAdvanceSalaryAmount}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              {/* Live allocation projection */}
              {advanceSalaryAmount > 0 && (
                <div className="p-3 rounded-2xl bg-primary-custom/10 border border-primary-custom/20 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-primary-custom font-semibold">
                    <span className="flex items-center gap-1"><ArrowRight className="w-3.5 h-3.5" /> Esta quincena recibirá:</span>
                    <span className="font-bold">+${advanceSalaryAmount.toFixed(2)} USD</span>
                  </div>
                  <div className="flex items-center justify-between text-muted text-[11px]">
                    <span className="flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> Quedará en {otherFortnightLabel}:</span>
                    <span className="font-bold text-app">${Math.max(0, otherFortnightIncomeTotal - advanceSalaryAmount).toFixed(2)} USD</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceSalaryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction || advanceSalaryAmount <= 0}
                  className="flex-1 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAction ? 'Asignando...' : 'Confirmar Asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Diálogo de Omitir Gasto / Cuota */}
      {skipModalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setSkipModalData({ isOpen: false })} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-app">
              <h4 className="text-sm font-bold text-app flex items-center gap-2">
                <CornerDownRight className="w-4 h-4 text-amber-400" />
                Omitir {skipModalData.isDebt ? 'Cuota' : 'Gasto'}
              </h4>
              <button
                onClick={() => setSkipModalData({ isOpen: false })}
                className="p-1 rounded-lg text-muted hover:text-app"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-bold text-app text-sm">
                {skipModalData.isDebt ? skipModalData.debtName : skipModalData.expense?.name}
              </p>
              <p className="text-muted">
                Monto: <strong>${skipModalData.amount?.toFixed(2)} USD</strong>
              </p>
              <p className="text-[11px] text-muted pt-1">
                ¿Cómo deseas proceder con este compromiso en este corte?
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={skipModalData.isDebt ? handleConfirmSkipDebt : handleConfirmSkipExpense}
                className="w-full py-2.5 px-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Dejar para la próxima quincena</span>
              </button>

              <button
                type="button"
                onClick={skipModalData.isDebt ? handleConfirmSkipDebt : handleConfirmSkipExpense}
                className="w-full py-2.5 px-3 rounded-2xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-primary-custom" />
                <span>Resuelto de otra manera / Omitir</span>
              </button>

              <button
                type="button"
                onClick={() => setSkipModalData({ isOpen: false })}
                className="w-full py-2 text-center text-xs text-muted hover:text-app cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Advertencia al intentar pagar con Saldo Negativo / Insuficiente */}
      {deficitWarningData.isOpen && deficitWarningData.expense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setDeficitWarningData({ isOpen: false, amount: 0 })} />
          <div className="relative z-10 w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 pb-2 border-b border-app">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-app">Saldo Insuficiente en este Corte</h4>
                <p className="text-[10px] text-muted">Dinero libre disponible: ${netRemaining.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-app">
                El gasto <strong>"{deficitWarningData.expense.name}" (${deficitWarningData.amount.toFixed(2)})</strong> excede los ingresos de esta quincena.
              </p>
              <p className="text-muted text-[11px]">
                {selectedFortnight === 'q1' && otherFortnightIncomeTotal > 0
                  ? `💡 Recuerda que cobras en ${otherFortnightLabel} ($${otherFortnightIncomeTotal.toFixed(2)}). Puedes posponerlo para esa fecha o pagarlo usando fondos de tu cuenta.`
                  : `¿Deseas pagar usando saldo de una cuenta, posponerlo para el próximo corte o registrarlo de todas formas?`}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {accounts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    handleExecuteMarkPaid(deficitWarningData.expense!, deficitWarningData.amount, accounts[0]?.id || '');
                  }}
                  className="w-full py-2.5 px-3 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Pagar con fondos de mi cuenta ({accounts[0]?.name || 'Principal'})</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={async () => {
                  if (deficitWarningData.expense) {
                    await setFortnightExpenseSkipped({
                      expenseId: deficitWarningData.expense.id,
                      year: selectedYear,
                      month: selectedMonth,
                      fortnight: selectedFortnight,
                    });
                  }
                  setDeficitWarningData({ isOpen: false, amount: 0 });
                }}
                className="w-full py-2.5 px-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CornerDownRight className="w-4 h-4" />
                <span>Posponer para la próxima quincena</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExecuteMarkPaid(deficitWarningData.expense!, deficitWarningData.amount);
                }}
                className="w-full py-2 text-center text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Marcar pagado de todas formas
              </button>

              <button
                type="button"
                onClick={() => setDeficitWarningData({ isOpen: false, amount: 0 })}
                className="w-full py-1 text-center text-xs text-muted hover:text-app cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Add Debt Modal for Deficit Loan Resolution */}
      <AddDebtModal
        isOpen={isDeficitLoanModalOpen}
        onClose={() => setIsDeficitLoanModalOpen(false)}
        categories={categories}
        initialAmount={Number(Math.abs(netRemaining).toFixed(2))}
        initialCreditor="Préstamo para Cubrir Déficit"
        initialDebtMode="installments"
        initialPlatform="particular"
        initialStartYear={selectedYear}
        initialStartMonth={selectedMonth}
        initialStartFortnight={selectedFortnight === 'q1' ? 'q2' : 'q1'}
        initialNotes={`Préstamo solicitado para equilibrar el déficit del corte de ${fortnightLabel}`}
        onSaved={handleDeficitLoanSaved}
      />

      {/* Modal 8: Direct Add Payment Modal for Debts in Fortnight */}
      {rates && (
        <AddPaymentModal
          isOpen={paymentModalData.isOpen}
          onClose={() => setPaymentModalData({ isOpen: false })}
          debts={debts}
          rates={rates}
          preselectedDebtId={paymentModalData.debtId}
          initialAmount={paymentModalData.amount}
          initialYear={selectedYear}
          initialMonth={selectedMonth}
          initialFortnight={selectedFortnight}
        />
      )}
    </div>
  );
};
