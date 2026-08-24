import React, { useState, useMemo, useEffect } from 'react';
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
  Mail,
  Send,
  RefreshCw,
  X,
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
} from '../types/index.ts';
import { MonthPicker } from './MonthPicker.tsx';
import { sendBiweeklyReportEmail } from '../services/emailService.ts';

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
  rates?: ExchangeRatesData;
  currency?: string;
  userEmail?: string;
  userName?: string;
  onOpenQuickPayment?: (debtId?: string) => void;
  onNavigateToIncomes?: () => void;
  onNavigateToSavings?: () => void;
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
  rates,
  currency = '$',
  userEmail = '',
  userName = 'Usuario',
  onOpenQuickPayment,
  onNavigateToIncomes,
  onNavigateToSavings,
}) => {
  const [selectedFortnight, setSelectedFortnight] = useState<FortnightType>('q1');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailRecipient, setEmailRecipient] = useState<string>(userEmail);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (userEmail) {
      setEmailRecipient(userEmail);
    }
  }, [userEmail]);

  const monthName = MONTH_NAMES[selectedMonth];
  const fortnightLabel = selectedFortnight === 'q1'
    ? `Quincena 15 de ${monthName} ${selectedYear}`
    : `Quincena 30 de ${monthName} ${selectedYear}`;

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

        if (fi.default_fortnight === 'both') return true;
        return fi.default_fortnight === selectedFortnight;
      })
      .map((fi) => {
        const override = overrideMap.get(fi.id);
        const amount = override?.custom_amount !== undefined ? override.custom_amount : fi.amount;
        return {
          id: fi.id,
          name: fi.name,
          finalAmount: amount,
          notes: fi.notes || 'Ingreso fijo',
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

  // Active fixed expenses for this fortnight
  const activeFortnightFixedExpenses = useMemo(() => {
    const overrideMap = new Map(
      monthlyOverrides
        .filter((o) => o.year === selectedYear && o.month === selectedMonth)
        .map((o) => [o.fixed_expense_id, o])
    );

    return fixedExpenses
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
        return {
          ...fe,
          finalAmount: amount,
          isAssumed: override?.assumed_by_third_party || fe.assumed_by_third_party,
        };
      });
  }, [fixedExpenses, monthlyOverrides, selectedYear, selectedMonth, selectedFortnight]);

  const totalFixedCost = activeFortnightFixedExpenses.reduce(
    (sum, fe) => sum + (fe.isAssumed ? 0 : fe.finalAmount),
    0
  );

  // Active debts that have an installment due in this fortnight
  const debtsDueThisFortnight = useMemo(() => {
    return debts.filter((d) => {
      if (d.status === 'paid' || d.current_balance <= 0) return false;

      // Filter by start period if set
      if (d.start_year !== undefined && d.start_month !== undefined) {
        if (selectedYear < d.start_year) return false;
        if (selectedYear === d.start_year && selectedMonth < d.start_month) return false;
        if (selectedYear === d.start_year && selectedMonth === d.start_month && d.start_fortnight === 'q2' && selectedFortnight === 'q1') {
          return false;
        }
      }

      if (!d.fortnight_due || d.fortnight_due === 'both') return true;
      return d.fortnight_due === selectedFortnight;
    });
  }, [debts, selectedYear, selectedMonth, selectedFortnight]);

  // Planned installment commitments for active debts
  const totalDebtInstallmentCommitment = debtsDueThisFortnight.reduce((sum, d) => {
    const installment = d.installment_amount || (d.pending_installments ? d.current_balance / d.pending_installments : d.current_balance);
    return sum + Math.min(d.current_balance, installment);
  }, 0);

  // Actual debt payments recorded in this fortnight and month
  const actualDebtPayments = useMemo(() => {
    return debtPayments.filter(
      (dp) =>
        dp.year === selectedYear &&
        dp.month === selectedMonth &&
        dp.fortnight === selectedFortnight
    );
  }, [debtPayments, selectedYear, selectedMonth, selectedFortnight]);

  const actualDebtPaidTotal = actualDebtPayments.reduce((sum, dp) => sum + dp.amount, 0);

  // Effective debt commitment
  const effectiveDebtCost = Math.max(totalDebtInstallmentCommitment, actualDebtPaidTotal);

  // 3. Planned Savings Goals for this Fortnight
  const fortnightSavingsGoals = useMemo(() => {
    return savingsGoals
      .filter((g) => g.status === 'active')
      .filter((g) => {
        if (g.frequency === 'fortnightly') return true;
        return g.target_fortnight === 'both' || g.target_fortnight === selectedFortnight;
      });
  }, [savingsGoals, selectedFortnight]);

  const plannedSavingsTotal = fortnightSavingsGoals.reduce((sum, g) => sum + g.amount_per_period, 0);

  // Check actual contributions or skipped contributions in this fortnight
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

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecipient.trim()) return;

    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const bcvRate = rates?.bcvDollar || 1;
      await sendBiweeklyReportEmail({
        to: emailRecipient.trim(),
        userName: userName || 'Usuario',
        quincena: selectedFortnight === 'q1' ? '15' : '30',
        mes: `${monthName} ${selectedYear}`,
        ingresosTotal: totalAvailable,
        gastosFijos: totalFixedCost,
        deudasTotal: effectiveDebtCost,
        dineroLibre: netRemaining,
        dineroLibreVES: netRemaining * bcvRate,
        bcvRate: bcvRate,
      });
      setEmailStatus({ type: 'success', message: `¡Reporte enviado exitosamente a ${emailRecipient}!` });
      setTimeout(() => {
        setIsEmailModalOpen(false);
        setEmailStatus(null);
      }, 2500);
    } catch (err: any) {
      setEmailStatus({ type: 'error', message: err.message || 'Error al enviar el reporte por correo' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Month & Period Selector Bar con Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-3xl bg-surface border border-app shadow-md">
        <MonthPicker
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChange={onChangePeriod}
          className="w-full sm:w-auto justify-between sm:justify-start"
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Quincena 15 vs 30 Selector con nombres concisos y diseño responsivo */}
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

          {/* Enviar Resumen por Correo */}
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            title="Enviar Resumen Quincenal por Correo (Resend)"
          >
            <Mail className="w-3.5 h-3.5 text-primary-custom" />
            <span className="text-xs">Enviar Reporte</span>
          </button>
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
            Fijos ({currency}{totalFixedCost.toFixed(0)}) + Deudas ({currency}{effectiveDebtCost.toFixed(0)})
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

        {/* Dinero Libre Real Card */}
        <div
          className={`p-3 sm:p-4 rounded-2xl border shadow-sm space-y-1 ${
            netRemaining >= 0
              ? 'bg-gradient-to-br from-surface to-primary-custom/20 border-[#00C2C7]/40'
              : 'bg-gradient-to-br from-surface to-[#ef4444]/20 border-[#ef4444]/40'
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
          <span className="text-[10px] sm:text-[11px] text-muted block truncate">
            {netRemaining >= 0 ? 'Disponible para libre uso' : '¡Déficit en este corte!'}
          </span>
        </div>
      </div>

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
                      Acumulado: ${g.current_amount} / ${g.target_amount}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-[#00C2C7] block">
                      ${g.amount_per_period.toFixed(2)}
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

      {/* Fortnight Commitments: Fixed Expenses + Debts Due */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fixed Expenses for this Fortnight */}
        <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-app pb-2.5">
            <h4 className="text-xs font-bold text-app uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary-custom" />
              Gastos Fijos Asignados ({activeFortnightFixedExpenses.length})
            </h4>
            <span className="text-xs font-black text-[#FF914D]">
              {currency}{totalFixedCost.toFixed(2)}
            </span>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {activeFortnightFixedExpenses.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">No hay gastos fijos en este corte</p>
            ) : (
              activeFortnightFixedExpenses.map((fe) => {
                const bcv = rates?.bcvDollar && rates.bcvDollar > 0 ? rates.bcvDollar : 1;
                const isVes = fe.currency === 'VES';
                return (
                  <div
                    key={fe.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-app text-xs"
                  >
                    <div>
                      <span className="text-app font-medium block">{fe.name}</span>
                      {isVes && fe.original_amount ? (
                        <span className="text-[10px] text-muted">
                          Bs. {fe.original_amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">
                          ≈ Bs. {(fe.finalAmount * bcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {fe.isAssumed ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                          Cubierto 3ro
                        </span>
                      ) : (
                        <span className="font-bold text-app">${fe.finalAmount.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Debts Due in this Fortnight */}
        <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-app pb-2.5">
            <h4 className="text-xs font-bold text-app uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#FF914D]" />
              Cuotas de Deudas ({debtsDueThisFortnight.length})
            </h4>
            <span className="text-xs font-black text-[#FF914D]">
              {currency}{effectiveDebtCost.toFixed(2)}
            </span>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {debtsDueThisFortnight.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted">No hay cuotas de deudas venciendo en este corte</p>
              </div>
            ) : (
              debtsDueThisFortnight.map((d) => {
                const cuota = d.installment_amount || (d.pending_installments ? d.current_balance / d.pending_installments : d.current_balance);
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-app text-xs"
                  >
                    <div>
                      <span className="text-app font-bold block">{d.creditor}</span>
                      <span className="text-[10px] text-muted">
                        Saldo: ${d.current_balance} {d.debt_mode === 'open' ? '(Pago Abierto)' : d.pending_installments ? `(${d.pending_installments} cuotas rest.)` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#FF914D]">-{currency}{cuota.toFixed(2)}</span>
                      {onOpenQuickPayment && (
                        <button
                          onClick={() => onOpenQuickPayment(d.id)}
                          className="px-2 py-0.5 rounded-lg bg-primary-custom text-white text-[10px] font-bold hover:opacity-90 cursor-pointer"
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
        </div>
      </div>

      {/* Email Report Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsEmailModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#162032] border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">Enviar Reporte Quincenal</h3>
                  <p className="text-[10px] text-slate-400">Vía correo electrónico con Resend</p>
                </div>
              </div>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  emailStatus.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30'
                }`}
              >
                {emailStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{emailStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleSendReport} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Correo Electrónico Destino
                </label>
                <input
                  type="email"
                  required
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-primary-custom transition-all"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1 text-slate-300">
                <p className="font-bold text-white">Periodo a Enviar:</p>
                <p className="text-[11px] text-slate-400">
                  {selectedFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'} - {monthName} {selectedYear}
                </p>
                <p className="text-[11px] text-slate-400">
                  Dinero Libre Estimado: <strong className="text-[#38bdf8]">${netRemaining.toFixed(2)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar Reporte</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
