import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  FixedExpense,
  MonthlyFixedOverride,
  VariableExpense,
  Category,
  Account,
  AccountType,
  FortnightType,
  ExchangeRatesData,
  FixedExpensePaymentMode,
} from '../types/index.ts';
import {
  saveFixedExpense,
  deleteFixedExpense,
  toggleMonthlyFixedOverride,
  saveVariableExpense,
  deleteVariableExpense,
  saveAccount,
} from '../lib/db.ts';
import { CategoryIcon } from './CategoryIcon.tsx';
import { MonthPicker } from './MonthPicker.tsx';
import { formatCurrencyVE } from '../utils/numberFormat.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';
import { logger } from '../utils/logger.ts';

export const PAYMENT_MODES_LIST: {
  id: FixedExpensePaymentMode;
  label: string;
  sub: string;
  badge: string;
  badgeColor: string;
  borderColor: string;
}[] = [
  {
    id: 'usd_cash',
    label: 'Efectivo / Divisas ($)',
    sub: 'Monto fijo exacto en USD',
    badge: 'CASH USD',
    badgeColor: 'text-[#147DF0] bg-[#147DF0]/10 border-[#147DF0]/30',
    borderColor: 'border-[#147DF0]',
  },
  {
    id: 'ves_bcv',
    label: 'Tasa BCV Oficial',
    sub: 'Indexado a tasa oficial del día',
    badge: 'BCV USD',
    badgeColor: 'text-[#147DF0] bg-[#147DF0]/10 border-[#147DF0]/30',
    borderColor: 'border-[#147DF0]',
  },
  {
    id: 'ves_parallel',
    label: 'Tasa Promedio',
    sub: 'Indexado a cotización promedio',
    badge: 'PROMEDIO USD',
    badgeColor: 'text-[#FF914D] bg-[#FF914D]/10 border-[#FF914D]/30',
    borderColor: 'border-[#FF914D]',
  },
  {
    id: 'ves_euro',
    label: 'Tasa Euro BCV',
    sub: 'Indexado a Euro BCV',
    badge: 'BCV EUR',
    badgeColor: 'text-[#00C2C7] bg-[#00C2C7]/10 border-[#00C2C7]/30',
    borderColor: 'border-[#00C2C7]',
  },
  {
    id: 'eur_cash',
    label: 'Efectivo (€)',
    sub: 'Monto en Euros',
    badge: 'CASH EUR',
    badgeColor: 'text-[#00C2C7] bg-[#00C2C7]/10 border-[#00C2C7]/30',
    borderColor: 'border-[#00C2C7]',
  },
  {
    id: 'ves_fixed',
    label: 'Bolívares Fijos (Bs.)',
    sub: 'Monto fijo en moneda local',
    badge: 'BS FIJO',
    badgeColor: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30',
    borderColor: 'border-[#10B981]',
  },
];

interface FixedExpensesModuleProps {
  fixedExpenses: FixedExpense[];
  variableExpenses?: VariableExpense[];
  monthlyOverrides: MonthlyFixedOverride[];
  categories: Category[];
  accounts?: Account[];
  selectedYear: number;
  selectedMonth: number;
  onChangePeriod: (year: number, month: number) => void;
  rates?: ExchangeRatesData;
  currency?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const FixedExpensesModule: React.FC<FixedExpensesModuleProps> = ({
  fixedExpenses,
  variableExpenses = [],
  monthlyOverrides,
  categories,
  accounts = [],
  selectedYear,
  selectedMonth,
  onChangePeriod,
  rates,
}) => {
  const [activeTab, setActiveTab] = useState<'fixed' | 'variable'>('fixed');

  const bcvUsd = rates?.bcvDollar && rates.bcvDollar > 0 ? rates.bcvDollar : 1;
  const bcvEur = rates?.bcvEuro && rates.bcvEuro > 0 ? rates.bcvEuro : 1;

  // Fixed Expense Modal states
  const [isFixedModalOpen, setIsFixedModalOpen] = useState<boolean>(false);
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);
  const [fixedName, setFixedName] = useState<string>('');
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [fixedPaymentMode, setFixedPaymentMode] = useState<FixedExpensePaymentMode>('ves_bcv');
  const [fixedFortnight, setFixedFortnight] = useState<'q1' | 'q2' | 'both'>('q1');
  const [fixedDueDay, setFixedDueDay] = useState<string>('');
  const [fixedDueDay2, setFixedDueDay2] = useState<string>('');
  const [fixedCategoryId, setFixedCategoryId] = useState<string>('cat_services');
  const [fixedNotes, setNotes] = useState<string>('');
  const [isFixedCategoryDropdownOpen, setIsFixedCategoryDropdownOpen] = useState<boolean>(false);
  const [isFixedPaymentDropdownOpen, setIsFixedPaymentDropdownOpen] = useState<boolean>(false);

  // Variable Expense Modal states
  const [isVarModalOpen, setIsVarModalOpen] = useState<boolean>(false);
  const [editingVar, setEditingVar] = useState<VariableExpense | null>(null);
  const [varDescription, setVarDescription] = useState<string>('');
  const [varAmount, setVarAmount] = useState<number>(0);
  const [varPaymentMode, setVarPaymentMode] = useState<FixedExpensePaymentMode>('usd_cash');
  const [varFortnight, setVarFortnight] = useState<FortnightType>('q1');
  const [varCategoryId, setVarCategoryId] = useState<string>('cat_food');
  const [varAccountId, setVarAccountId] = useState<string>('');
  const [varNotes, setVarNotes] = useState<string>('');
  const [isVarCategoryDropdownOpen, setIsVarCategoryDropdownOpen] = useState<boolean>(false);
  const [isVarPaymentDropdownOpen, setIsVarPaymentDropdownOpen] = useState<boolean>(false);

  // Quick Account Creation
  const [isQuickAccountModalOpen, setIsQuickAccountModalOpen] = useState<boolean>(false);
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newAccountType] = useState<AccountType>('cash');
  const [newAccountCurrency, setNewAccountCurrency] = useState<'USD' | 'VES' | 'EUR'>('USD');
  const [newAccountBalance, setNewAccountBalance] = useState<number>(0);
  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  // Estado optimista para actualización visual instantánea (0ms) sin depender de red o recarga
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, boolean>>({});

  // Limpiar estados optimistas cuando cambia el periodo seleccionado
  useEffect(() => {
    setOptimisticStatus({});
  }, [selectedYear, selectedMonth]);

  // --- FIXED EXPENSES CALCULATIONS ---
  const overrideMap = useMemo(() => {
    return new Map(
      monthlyOverrides
        .filter((o) => {
          let yr = o.year;
          let mo = o.month;
          if ((yr === undefined || mo === undefined) && (o as any).month_year) {
            const [y, m] = String((o as any).month_year).split('-').map(Number);
            if (!isNaN(y)) yr = y;
            if (!isNaN(m)) mo = m - 1;
          }
          return yr === selectedYear && mo === selectedMonth;
        })
        .map((o) => [o.fixed_expense_id || (o as any).expense_id, o])
    );
  }, [monthlyOverrides, selectedYear, selectedMonth]);

  const processedFixedExpenses = useMemo(() => {
    return fixedExpenses.map((fe) => {
      const override = overrideMap.get(fe.id);
      const isOverrideActive = override?.is_active !== undefined ? override.is_active : fe.is_active;
      // El estado optimista local tiene prioridad inmediata antes de la propagación de red
      const isActive = optimisticStatus[fe.id] !== undefined ? optimisticStatus[fe.id] : isOverrideActive;

      let mode: FixedExpensePaymentMode = fe.payment_mode || 'ves_bcv';
      if (mode === 'cash') mode = 'usd_cash';
      else if (mode === 'bcv_usd') mode = 'ves_bcv';
      else if (mode === 'fixed_ves') mode = 'ves_fixed';
      else if (mode === 'bcv_eur') mode = 'ves_euro';
      else if (mode === 'parallel_ves') mode = 'ves_parallel';

      const rawCurrency = fe.currency || (mode === 'ves_fixed' ? 'VES' : mode === 'eur_cash' || mode === 'ves_euro' ? 'EUR' : 'USD');
      const origAmt = fe.original_amount !== undefined ? fe.original_amount : fe.amount;

      let usdEquivalent = 0;
      if (mode === 'ves_fixed') {
        usdEquivalent = Number((origAmt / bcvUsd).toFixed(2));
      } else if (rawCurrency === 'EUR' || mode === 'eur_cash' || mode === 'ves_euro') {
        usdEquivalent = Number(((origAmt * bcvEur) / bcvUsd).toFixed(2));
      } else {
        usdEquivalent = Number(origAmt.toFixed(2));
      }

      const finalAmountUSD = override?.custom_amount !== undefined ? override.custom_amount : usdEquivalent;

      return {
        ...fe,
        computedIsActive: isActive,
        computedMode: mode,
        computedOriginalAmount: origAmt,
        computedUsdEquivalent: finalAmountUSD,
        appliedCurrency: rawCurrency,
      };
    });
  }, [fixedExpenses, overrideMap, optimisticStatus, bcvUsd, bcvEur]);

  const activeFixedExpenses = processedFixedExpenses.filter((e) => e.computedIsActive);

  const totalFixedMonth = activeFixedExpenses.reduce(
    (acc, cur) => acc + (cur.default_fortnight === 'both' ? cur.computedUsdEquivalent * 2 : cur.computedUsdEquivalent),
    0
  );

  const q1Fixed = activeFixedExpenses
    .filter((e) => e.default_fortnight === 'q1' || e.default_fortnight === 'both')
    .reduce((acc, cur) => acc + cur.computedUsdEquivalent, 0);

  const q2Fixed = activeFixedExpenses
    .filter((e) => e.default_fortnight === 'q2' || e.default_fortnight === 'both')
    .reduce((acc, cur) => acc + cur.computedUsdEquivalent, 0);

  // --- VARIABLE EXPENSES CALCULATIONS ---
  const currentMonthVarExpenses = useMemo(() => {
    return variableExpenses.filter((v) => v.year === selectedYear && v.month === selectedMonth);
  }, [variableExpenses, selectedYear, selectedMonth]);

  const processedVarExpenses = useMemo(() => {
    return currentMonthVarExpenses.map((ve) => {
      let mode: FixedExpensePaymentMode = ve.payment_mode || 'usd_cash';
      const origAmt = ve.original_amount !== undefined ? ve.original_amount : ve.amount;
      let usdEquivalent = 0;

      if (mode === 'ves_fixed') {
        usdEquivalent = Number((origAmt / bcvUsd).toFixed(2));
      } else if (ve.currency === 'EUR' || mode === 'eur_cash' || mode === 'ves_euro') {
        usdEquivalent = Number(((origAmt * bcvEur) / bcvUsd).toFixed(2));
      } else {
        usdEquivalent = Number(origAmt.toFixed(2));
      }

      return {
        ...ve,
        computedMode: mode,
        computedOriginalAmount: origAmt,
        computedUsdEquivalent: usdEquivalent,
      };
    });
  }, [currentMonthVarExpenses, bcvUsd, bcvEur]);

  const totalVarMonth = processedVarExpenses.reduce((acc, cur) => acc + cur.computedUsdEquivalent, 0);
  const q1Var = processedVarExpenses.filter((v) => v.fortnight === 'q1').reduce((acc, cur) => acc + cur.computedUsdEquivalent, 0);
  const q2Var = processedVarExpenses.filter((v) => v.fortnight === 'q2').reduce((acc, cur) => acc + cur.computedUsdEquivalent, 0);

  // Open Fixed Expense Modal
  const handleOpenFixedModal = (fe?: FixedExpense) => {
    if (fe) {
      setEditingFixed(fe);
      setFixedName(fe.name);
      setFixedAmount(fe.original_amount !== undefined ? fe.original_amount : fe.amount);
      setFixedPaymentMode(fe.payment_mode || 'ves_bcv');
      setFixedFortnight(fe.default_fortnight || 'q1');
      setFixedDueDay(fe.due_day ? fe.due_day.toString() : '');
      setFixedDueDay2(fe.due_day_2 ? fe.due_day_2.toString() : '');
      setFixedCategoryId(fe.category_id || 'cat_services');
      setNotes(fe.notes || '');
    } else {
      setEditingFixed(null);
      setFixedName('');
      setFixedAmount(0);
      setFixedPaymentMode('ves_bcv');
      setFixedFortnight('q1');
      setFixedDueDay('');
      setFixedDueDay2('');
      setFixedCategoryId('cat_services');
      setNotes('');
    }
    setIsFixedCategoryDropdownOpen(false);
    setIsFixedPaymentDropdownOpen(false);
    setIsFixedModalOpen(true);
  };

  const handleSaveFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedName.trim() || fixedAmount <= 0) return;

    let derivedCurrency = 'USD';
    if (fixedPaymentMode === 'ves_fixed') derivedCurrency = 'VES';
    else if (fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro') derivedCurrency = 'EUR';

    let usdEquivalent = fixedAmount;
    if (fixedPaymentMode === 'ves_fixed') {
      usdEquivalent = Number((fixedAmount / bcvUsd).toFixed(2));
    } else if (derivedCurrency === 'EUR' || fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro') {
      usdEquivalent = Number(((fixedAmount * bcvEur) / bcvUsd).toFixed(2));
    }

    await saveFixedExpense({
      id: editingFixed ? editingFixed.id : undefined,
      name: fixedName.trim(),
      amount: usdEquivalent,
      original_amount: fixedAmount,
      currency: derivedCurrency,
      payment_mode: fixedPaymentMode,
      default_fortnight: fixedFortnight,
      due_day: fixedDueDay ? parseInt(fixedDueDay, 10) : undefined,
      due_day_2: fixedDueDay2 ? parseInt(fixedDueDay2, 10) : undefined,
      category_id: fixedCategoryId,
      is_active: editingFixed ? editingFixed.is_active : true,
      notes: fixedNotes.trim(),
    });

    setIsFixedModalOpen(false);
  };

  const handleDeleteFixed = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este gasto fijo recurrente?')) {
      await deleteFixedExpense(id);
    }
  };

  const handleToggleFixedActive = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    // Actualización visual inmediata e instantánea (0ms)
    setOptimisticStatus((prev) => ({ ...prev, [id]: newStatus }));

    try {
      await toggleMonthlyFixedOverride(id, selectedYear, selectedMonth, newStatus);
      logger.dev(`[FIXED EXPENSE] Pausa toggled para gasto ${id}: ${newStatus}`);
    } catch (error) {
      // Revertir estado si ocurre error
      setOptimisticStatus((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      logger.error('[FIXED EXPENSE PAUSE ERROR]:', error);
      alert('Error al pausar/activar el gasto fijo. Por favor intenta de nuevo.');
    }
  };

  // Open Variable Expense Modal
  const handleOpenVarModal = (varExp?: VariableExpense) => {
    if (varExp) {
      setEditingVar(varExp);
      setVarDescription(varExp.description);
      setVarAmount(varExp.original_amount !== undefined ? varExp.original_amount : varExp.amount);
      setVarPaymentMode(varExp.payment_mode || 'usd_cash');
      setVarFortnight(varExp.fortnight || 'q1');
      setVarCategoryId(varExp.category_id || 'cat_food');
      setVarAccountId(varExp.account_id || '');
      setVarNotes(varExp.notes || '');
    } else {
      setEditingVar(null);
      setVarDescription('');
      setVarAmount(0);
      setVarPaymentMode('usd_cash');
      setVarFortnight('q1');
      setVarCategoryId('cat_food');
      setVarAccountId(accounts.length > 0 ? accounts[0].id : '');
      setVarNotes('');
    }
    setIsVarCategoryDropdownOpen(false);
    setIsVarPaymentDropdownOpen(false);
    setIsVarModalOpen(true);
  };

  const handleSaveVar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varDescription.trim() || varAmount <= 0) return;

    let derivedCurrency = 'USD';
    if (varPaymentMode === 'ves_fixed') derivedCurrency = 'VES';
    else if (varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro') derivedCurrency = 'EUR';

    let usdEquivalent = varAmount;
    if (varPaymentMode === 'ves_fixed') {
      usdEquivalent = Number((varAmount / bcvUsd).toFixed(2));
    } else if (derivedCurrency === 'EUR' || varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro') {
      usdEquivalent = Number(((varAmount * bcvEur) / bcvUsd).toFixed(2));
    }

    await saveVariableExpense({
      id: editingVar ? editingVar.id : undefined,
      description: varDescription.trim(),
      amount: usdEquivalent,
      original_amount: varAmount,
      currency: derivedCurrency,
      payment_mode: varPaymentMode,
      year: selectedYear,
      month: selectedMonth,
      fortnight: varFortnight,
      category_id: varCategoryId,
      account_id: varAccountId || undefined,
      notes: varNotes.trim(),
    });

    setIsVarModalOpen(false);
  };

  const handleDeleteVar = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este gasto variable?')) {
      await deleteVariableExpense(id);
    }
  };

  // Quick Account Creator Handler
  const handleQuickCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    setIsCreatingAccount(true);
    try {
      const created = await saveAccount({
        name: newAccountName.trim(),
        type: newAccountType,
        currency: newAccountCurrency,
        initial_balance: newAccountBalance,
      });
      setVarAccountId(created.id);
      setIsQuickAccountModalOpen(false);
      setNewAccountName('');
      setNewAccountBalance(0);
    } catch (err: any) {
      alert(`Error al crear cuenta: ${err.message}`);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar with Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-app shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-app tracking-tight">
              Gestión de Gastos
            </h2>
            <p className="text-xs text-muted">
              Período: {MONTH_NAMES[selectedMonth]} {selectedYear} • Fijos y variables por quincena
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <MonthPicker
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={onChangePeriod}
          />

          <button
            onClick={() => {
              if (activeTab === 'fixed') handleOpenFixedModal();
              else handleOpenVarModal();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-lg hover:opacity-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'fixed' ? 'Nuevo Gasto Fijo' : 'Nuevo Gasto Variable'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Segmented Tab Switcher */}
      <div className="flex items-center justify-center">
        <div className="grid grid-cols-2 gap-1 p-1 bg-card rounded-2xl border border-app w-full max-w-md shadow-inner">
          <button
            onClick={() => setActiveTab('fixed')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'fixed'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Gastos Fijos ({fixedExpenses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('variable')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'variable'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gastos Variables ({currentMonthVarExpenses.length})</span>
          </button>
        </div>
      </div>

      {/* 3. Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Month Card */}
        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            {activeTab === 'fixed' ? 'Compromiso Total Fijo' : 'Total Gastos Variables'}
          </span>
          <p className="text-2xl sm:text-3xl font-black text-app">
            ${formatCurrencyVE(activeTab === 'fixed' ? totalFixedMonth : totalVarMonth)}
          </p>
          <p className="text-[11px] text-muted truncate">
            ≈ Bs. {formatCurrencyVE((activeTab === 'fixed' ? totalFixedMonth : totalVarMonth) * bcvUsd)} (Tasa BCV)
          </p>
        </div>

        {/* Quincena 15 Card */}
        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Quincena 15 (Q1)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-[#00C2C7]">
            ${formatCurrencyVE(activeTab === 'fixed' ? q1Fixed : q1Var)}
          </p>
          <p className="text-[11px] text-muted truncate">
            ≈ Bs. {formatCurrencyVE((activeTab === 'fixed' ? q1Fixed : q1Var) * bcvUsd)}
          </p>
        </div>

        {/* Quincena 30 Card */}
        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Quincena 30 (Q2)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-[#FF914D]">
            ${formatCurrencyVE(activeTab === 'fixed' ? q2Fixed : q2Var)}
          </p>
          <p className="text-[11px] text-muted truncate">
            ≈ Bs. {formatCurrencyVE((activeTab === 'fixed' ? q2Fixed : q2Var) * bcvUsd)}
          </p>
        </div>
      </div>

      {/* ================================================================ */}
      {/* TAB 1: GASTOS FIJOS (RECURRENTES) */}
      {/* ================================================================ */}
      {activeTab === 'fixed' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-app flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-custom" />
              <span>Gastos Fijos Asignados ({processedFixedExpenses.length})</span>
            </h3>
          </div>

          {processedFixedExpenses.length === 0 ? (
            <div className="p-10 rounded-3xl bg-surface border border-app text-center space-y-3">
              <Receipt className="w-10 h-10 text-muted mx-auto opacity-40" />
              <h4 className="text-sm font-bold text-app">No tienes gastos fijos registrados</h4>
              <p className="text-xs text-muted max-w-md mx-auto">
                Registra alquileres, servicios, membresías o compromisos fijos que se debitan automáticamente de tus quincenas.
              </p>
              <button
                onClick={() => handleOpenFixedModal()}
                className="px-4 py-2 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-md cursor-pointer"
              >
                + Crear Primer Gasto Fijo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {processedFixedExpenses.map((expense) => {
                const cat = categories.find((c) => c.id === expense.category_id);
                const modeObj = PAYMENT_MODES_LIST.find((m) => m.id === expense.computedMode) || PAYMENT_MODES_LIST[1];
                const isBoth = expense.default_fortnight === 'both';
                const fortnightLabel = isBoth
                  ? 'Ambas Quincenas (15 y 30)'
                  : expense.default_fortnight === 'q1'
                  ? 'Quincena 15'
                  : 'Quincena 30';

                return (
                  <div
                    key={expense.id}
                    className={`p-4 rounded-3xl border transition-all duration-200 shadow-sm ${
                      expense.computedIsActive
                        ? 'bg-surface border-app hover:border-primary-custom/40'
                        : 'bg-card/40 border-app/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner"
                          style={{ backgroundColor: cat?.color || '#00C2C7' }}
                        >
                          <CategoryIcon iconName={cat?.icon || 'Receipt'} className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-app truncate">{expense.name}</h4>
                          <span className="text-[10px] text-muted truncate block">
                            {cat?.name || 'General'} • {fortnightLabel}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-app block">
                          ${formatCurrencyVE(expense.computedUsdEquivalent)}
                        </span>
                        <span className="text-[10px] text-muted block">
                          ≈ Bs. {formatCurrencyVE(expense.computedUsdEquivalent * bcvUsd)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-app text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${modeObj.badgeColor}`}>
                        {modeObj.badge}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleFixedActive(expense.id, expense.computedIsActive)}
                          className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            expense.computedIsActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                          title={expense.computedIsActive ? 'Pausar este mes' : 'Activar este mes'}
                        >
                          {expense.computedIsActive ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenFixedModal(expense)}
                          className="p-1.5 rounded-xl bg-card hover:bg-surface-hover text-app border border-app transition-all cursor-pointer"
                          title="Editar gasto fijo"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-primary-custom" />
                        </button>

                        <button
                          onClick={() => handleDeleteFixed(expense.id)}
                          className="p-1.5 rounded-xl bg-card hover:bg-surface-hover text-rose-400 border border-app transition-all cursor-pointer"
                          title="Eliminar gasto fijo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: GASTOS VARIABLES (POR QUINCENA) */}
      {/* ================================================================ */}
      {activeTab === 'variable' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-app flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF914D]" />
              <span>Gastos Variables de {MONTH_NAMES[selectedMonth]} ({processedVarExpenses.length})</span>
            </h3>
          </div>

          {processedVarExpenses.length === 0 ? (
            <div className="p-10 rounded-3xl bg-surface border border-app text-center space-y-3">
              <Sparkles className="w-10 h-10 text-muted mx-auto opacity-40" />
              <h4 className="text-sm font-bold text-app">No hay gastos variables en este mes</h4>
              <p className="text-xs text-muted max-w-md mx-auto">
                Registra salidas a comer, compras del día o gastos extraordinarios asignados a la Quincena 15 o Quincena 30.
              </p>
              <button
                onClick={() => handleOpenVarModal()}
                className="px-4 py-2 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-md cursor-pointer"
              >
                + Registrar Gasto Variable
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {processedVarExpenses.map((vExp) => {
                const cat = categories.find((c) => c.id === vExp.category_id);
                const acc = accounts.find((a) => a.id === vExp.account_id);
                const modeObj = PAYMENT_MODES_LIST.find((m) => m.id === vExp.computedMode) || PAYMENT_MODES_LIST[0];
                const isQ1 = vExp.fortnight === 'q1';

                return (
                  <div
                    key={vExp.id}
                    className="p-4 rounded-3xl bg-surface border border-app hover:border-[#FF914D]/40 transition-all shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner"
                          style={{ backgroundColor: cat?.color || '#FF914D' }}
                        >
                          <CategoryIcon iconName={cat?.icon || 'ShoppingCart'} className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-app truncate">{vExp.description}</h4>
                          <span className="text-[10px] text-muted truncate block">
                            {cat?.name || 'Comida / Ocio'} • {acc ? acc.name : 'Sin cuenta vinculada'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-[#FF914D] block">
                          -${formatCurrencyVE(vExp.computedUsdEquivalent)}
                        </span>
                        <span className="text-[10px] text-muted block">
                          ≈ Bs. {formatCurrencyVE(vExp.computedUsdEquivalent * bcvUsd)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-app text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                          isQ1
                            ? 'bg-[#00C2C7]/15 text-[#00C2C7] border-[#00C2C7]/30'
                            : 'bg-[#FF914D]/15 text-[#FF914D] border-[#FF914D]/30'
                        }`}>
                          {isQ1 ? 'QUINCENA 15' : 'QUINCENA 30'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${modeObj.badgeColor}`}>
                          {modeObj.badge}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenVarModal(vExp)}
                          className="p-1.5 rounded-xl bg-card hover:bg-surface-hover text-app border border-app transition-all cursor-pointer"
                          title="Editar gasto variable"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-primary-custom" />
                        </button>

                        <button
                          onClick={() => handleDeleteVar(vExp.id)}
                          className="p-1.5 rounded-xl bg-card hover:bg-surface-hover text-rose-400 border border-app transition-all cursor-pointer"
                          title="Eliminar gasto variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 1: NUEVO / EDITAR GASTO FIJO */}
      {/* ================================================================ */}
      {isFixedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
          onClick={() => setIsFixedModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-app rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-app shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary-custom" />
                <h3 className="text-base font-black text-app">
                  {editingFixed ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo Recurrente'}
                </h3>
              </div>
              <button
                onClick={() => setIsFixedModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scrollbar Interno */}
            <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
              <form onSubmit={handleSaveFixed} className="space-y-4">
              {/* Concepto / Nombre */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Nombre del Gasto Fijo *
                </label>
                <input
                  type="text"
                  required
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  placeholder="Ej. Alquiler de Apartamento, Fibra Óptica, Condominio..."
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Monto & Moneda */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Monto del Compromiso *
                </label>
                <MoneyInput
                  value={fixedAmount}
                  onChange={setFixedAmount}
                  placeholder="0,00"
                  currencySymbol={fixedPaymentMode === 'ves_fixed' ? 'Bs.' : fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro' ? '€' : '$'}
                />
              </div>

              {/* Modalidad de Pago */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Modalidad de Pago
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsFixedPaymentDropdownOpen(!isFixedPaymentDropdownOpen)}
                    className="w-full p-2.5 rounded-xl bg-card border border-app text-left flex items-center justify-between text-xs font-bold text-app cursor-pointer"
                  >
                    <span>{PAYMENT_MODES_LIST.find((m) => m.id === fixedPaymentMode)?.label}</span>
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>

                  {isFixedPaymentDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 p-1 rounded-2xl bg-surface border border-app shadow-2xl z-20 space-y-1">
                      {PAYMENT_MODES_LIST.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setFixedPaymentMode(mode.id);
                            setIsFixedPaymentDropdownOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                            fixedPaymentMode === mode.id
                              ? 'bg-primary-custom text-white'
                              : 'text-app hover:bg-card'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{mode.label}</span>
                            <span className="text-[10px] opacity-80">{mode.sub}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quincena de Pago */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Quincena de Pago
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'q1' as const, label: 'Q15' },
                    { id: 'q2' as const, label: 'Q30' },
                    { id: 'both' as const, label: 'Ambas' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFixedFortnight(item.id)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                        fixedFortnight === item.id
                          ? 'bg-primary-custom text-white border-primary-custom shadow-md'
                          : 'bg-card text-muted border-app hover:text-app'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Días de Pago en el Mes */}
              {fixedFortnight === 'both' ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-card/60 rounded-2xl border border-app/70">
                  <div>
                    <label className="block text-[11px] font-bold text-app mb-1">
                      📅 Día 1er Pago (Q1)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={fixedDueDay}
                      onChange={(e) => setFixedDueDay(e.target.value)}
                      placeholder="Ej. 5, 10, 15..."
                      className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs font-black text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                    />
                    <p className="text-[9px] text-muted mt-0.5">
                      {fixedDueDay ? `1er pago: Día ${fixedDueDay}` : 'Por defecto: Día 15'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-app mb-1">
                      📅 Día 2do Pago (Q2)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={fixedDueDay2}
                      onChange={(e) => setFixedDueDay2(e.target.value)}
                      placeholder="Ej. 20, 25, 30..."
                      className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs font-black text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                    />
                    <p className="text-[9px] text-muted mt-0.5">
                      {fixedDueDay2 ? `2do pago: Día ${fixedDueDay2}` : 'Por defecto: Día 30'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-card/60 rounded-2xl border border-app/70">
                  <label className="block text-[11px] font-bold text-app mb-1">
                    📅 Día del Mes de Pago (1-31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={fixedDueDay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFixedDueDay(val);
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num >= 1 && num <= 31) {
                        setFixedFortnight(num <= 15 ? 'q1' : 'q2');
                      }
                    }}
                    placeholder={fixedFortnight === 'q1' ? 'Ej. 5, 10, 15...' : 'Ej. 20, 25, 30...'}
                    className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs font-black text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  />
                  <p className="text-[9px] text-muted mt-0.5">
                    {fixedDueDay ? `Fecha programada: Día ${fixedDueDay}` : `Por defecto: Día ${fixedFortnight === 'q1' ? 15 : 30}`}
                  </p>
                </div>
              )}

              {/* Categoría */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Categoría
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsFixedCategoryDropdownOpen(!isFixedCategoryDropdownOpen)}
                    className="w-full p-2.5 rounded-xl bg-card border border-app text-left flex items-center justify-between text-xs font-bold text-app cursor-pointer"
                  >
                    <span>{expenseCategories.find((c) => c.id === fixedCategoryId)?.name || 'Selecciona Categoría'}</span>
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>

                  {isFixedCategoryDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 p-1 rounded-2xl bg-surface border border-app shadow-2xl z-20 max-h-48 overflow-y-auto space-y-1">
                      {expenseCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setFixedCategoryId(cat.id);
                            setIsFixedCategoryDropdownOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            fixedCategoryId === cat.id
                              ? 'bg-primary-custom text-white'
                              : 'text-app hover:bg-card'
                          }`}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Notas Adicionales
                </label>
                <input
                  type="text"
                  value={fixedNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles, número de contrato o recordatorios..."
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-app">
                <button
                  type="button"
                  onClick={() => setIsFixedModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-card hover:bg-surface border border-app text-xs font-bold text-muted hover:text-app cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary-custom text-white text-xs font-black shadow-lg hover:opacity-95 cursor-pointer"
                >
                  {editingFixed ? 'Actualizar Gasto Fijo' : 'Guardar Gasto Fijo'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 2: NUEVO / EDITAR GASTO VARIABLE */}
      {/* ================================================================ */}
      {isVarModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
          onClick={() => setIsVarModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-app rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-app shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FF914D]" />
                <h3 className="text-base font-black text-app">
                  {editingVar ? 'Editar Gasto Variable' : 'Nuevo Gasto Variable'}
                </h3>
              </div>
              <button
                onClick={() => setIsVarModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scrollbar Interno */}
            <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
              <form onSubmit={handleSaveVar} className="space-y-4">
              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Descripción del Gasto *
                </label>
                <input
                  type="text"
                  required
                  value={varDescription}
                  onChange={(e) => setVarDescription(e.target.value)}
                  placeholder="Ej. Salida a comer, Taxi, Compra de farmacia..."
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Monto & Moneda */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Monto *
                </label>
                <MoneyInput
                  value={varAmount}
                  onChange={setVarAmount}
                  placeholder="0,00"
                  currencySymbol={varPaymentMode === 'ves_fixed' ? 'Bs.' : varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro' ? '€' : '$'}
                />
              </div>

              {/* Quincena Asignada */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Descontar de Quincena
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVarFortnight('q1')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      varFortnight === 'q1'
                        ? 'bg-[#00C2C7] text-white border-[#00C2C7] shadow-md'
                        : 'bg-card text-muted border-app hover:text-app'
                    }`}
                  >
                    Quincena 15 (Q1)
                  </button>

                  <button
                    type="button"
                    onClick={() => setVarFortnight('q2')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      varFortnight === 'q2'
                        ? 'bg-[#FF914D] text-white border-[#FF914D] shadow-md'
                        : 'bg-card text-muted border-app hover:text-app'
                    }`}
                  >
                    Quincena 30 (Q2)
                  </button>
                </div>
              </div>

              {/* Modalidad de Pago */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Modalidad de Pago
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsVarPaymentDropdownOpen(!isVarPaymentDropdownOpen)}
                    className="w-full p-2.5 rounded-xl bg-card border border-app text-left flex items-center justify-between text-xs font-bold text-app cursor-pointer"
                  >
                    <span>{PAYMENT_MODES_LIST.find((m) => m.id === varPaymentMode)?.label}</span>
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>

                  {isVarPaymentDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 p-1 rounded-2xl bg-surface border border-app shadow-2xl z-20 space-y-1">
                      {PAYMENT_MODES_LIST.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setVarPaymentMode(mode.id);
                            setIsVarPaymentDropdownOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                            varPaymentMode === mode.id
                              ? 'bg-primary-custom text-white'
                              : 'text-app hover:bg-card'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{mode.label}</span>
                            <span className="text-[10px] opacity-80">{mode.sub}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Categoría
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsVarCategoryDropdownOpen(!isVarCategoryDropdownOpen)}
                    className="w-full p-2.5 rounded-xl bg-card border border-app text-left flex items-center justify-between text-xs font-bold text-app cursor-pointer"
                  >
                    <span>{expenseCategories.find((c) => c.id === varCategoryId)?.name || 'Selecciona Categoría'}</span>
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>

                  {isVarCategoryDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 p-1 rounded-2xl bg-surface border border-app shadow-2xl z-20 max-h-48 overflow-y-auto space-y-1">
                      {expenseCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setVarCategoryId(cat.id);
                            setIsVarCategoryDropdownOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            varCategoryId === cat.id
                              ? 'bg-primary-custom text-white'
                              : 'text-app hover:bg-card'
                          }`}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cuenta de Origen (Opcional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-muted">
                    Cuenta / Fondo a debitar (Opcional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAccountModalOpen(true)}
                    className="text-[10px] font-bold text-primary-custom hover:underline"
                  >
                    + Nueva Cuenta
                  </button>
                </div>

                <select
                  value={varAccountId}
                  onChange={(e) => setVarAccountId(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs font-bold text-app focus:outline-none focus:ring-2 focus:ring-primary-custom cursor-pointer"
                >
                  <option value="">(Ninguna cuenta vinculada)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  value={varNotes}
                  onChange={(e) => setVarNotes(e.target.value)}
                  placeholder="Detalles opcionales..."
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-app">
                <button
                  type="button"
                  onClick={() => setIsVarModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-card hover:bg-surface border border-app text-xs font-bold text-muted hover:text-app cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary-custom text-white text-xs font-black shadow-lg hover:opacity-95 cursor-pointer"
                >
                  {editingVar ? 'Actualizar Gasto Variable' : 'Guardar Gasto Variable'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Account Sub-Modal */}
      {isQuickAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-in fade-in"
          onClick={() => setIsQuickAccountModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-app rounded-3xl p-5 shadow-2xl space-y-4 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-app">
              <h4 className="text-sm font-black text-app">Crear Nueva Cuenta</h4>
              <button onClick={() => setIsQuickAccountModalOpen(false)} className="p-1 rounded-full text-muted hover:text-app">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickCreateAccount} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">Nombre de Cuenta</label>
                <input
                  type="text"
                  required
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Ej. Efectivo Cartera, Banesco..."
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Moneda</label>
                  <select
                    value={newAccountCurrency}
                    onChange={(e) => setNewAccountCurrency(e.target.value as any)}
                    className="w-full bg-card border border-app rounded-xl px-2 py-2 text-xs text-app"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs.)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Saldo Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAccountBalance}
                    onChange={(e) => setNewAccountBalance(parseFloat(e.target.value) || 0)}
                    className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAccountModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-card text-xs font-bold text-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAccount}
                  className="px-4 py-1.5 rounded-xl bg-primary-custom text-white text-xs font-black"
                >
                  {isCreatingAccount ? 'Creando...' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
