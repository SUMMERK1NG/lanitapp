import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Layers,
  Sparkles,
  ChevronDown,
  Wallet,
  X,
  RotateCcw,
  ArrowLeftRight,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type {
  FixedIncome,
  MonthlyFixedIncomeOverride,
  VariableIncome,
  Category,
  Account,
  AccountType,
  FortnightType,
  ExchangeRatesData,
  FixedExpensePaymentMode,
} from '../types/index.ts';
import {
  saveFixedIncome,
  deleteFixedIncome,
  toggleMonthlyFixedIncomeOverride,
  saveVariableIncome,
  deleteVariableIncome,
  saveAccount,
} from '../lib/db.ts';
import { CategoryIcon } from './CategoryIcon.tsx';
import { MonthPicker } from './MonthPicker.tsx';
import { MoneyInput } from './ui/MoneyInput.tsx';

const iconMap: Record<string, any> = {
  film: LucideIcons.Film,
  briefcase: LucideIcons.Briefcase,
  car: LucideIcons.Car,
  home: LucideIcons.Home,
  'heart-pulse': LucideIcons.HeartPulse,
  wallet: LucideIcons.Wallet,
  TrendingUp: LucideIcons.TrendingUp,
  CreditCard: LucideIcons.CreditCard,
  Laptop: LucideIcons.Laptop,
  ShoppingCart: LucideIcons.ShoppingCart,
  Clock: LucideIcons.Clock,
  HeartPulse: LucideIcons.HeartPulse,
  MoreHorizontal: LucideIcons.MoreHorizontal,
  PiggyBank: LucideIcons.PiggyBank,
  DollarSign: LucideIcons.DollarSign,
  Target: LucideIcons.Target,
  UtensilsCrossed: LucideIcons.UtensilsCrossed,
  Wifi: LucideIcons.Wifi,
  Film: LucideIcons.Film,
  Briefcase: LucideIcons.Briefcase,
  Car: LucideIcons.Car,
  Home: LucideIcons.Home,
  Wallet: LucideIcons.Wallet,
  Tag: LucideIcons.Tag,
  Sparkles: LucideIcons.Sparkles,
  Layers: LucideIcons.Layers,
};

const renderIcon = (iconName?: string) => {
  if (!iconName) return <LucideIcons.DollarSign className="w-4 h-4" />;
  const IconComponent =
    iconMap[iconName] ||
    iconMap[iconName.toLowerCase()] ||
    (LucideIcons as Record<string, any>)[iconName] ||
    LucideIcons.DollarSign;
  return <IconComponent className="w-4 h-4" />;
};

export const PAYMENT_MODES_LIST: {
  id: FixedExpensePaymentMode;
  icon: string;
  label: string;
}[] = [
  { id: 'usd_cash', icon: '💵', label: 'CASH USD' },
  { id: 'eur_cash', icon: '💶', label: 'CASH EURO' },
  { id: 'ves_bcv', icon: '🏛️', label: 'DOLAR TASA BCV (BS)' },
  { id: 'ves_euro', icon: '🇪🇺', label: 'EURO TASA BCV (BS)' },
  { id: 'ves_parallel', icon: '⚡', label: 'DOLAR PROMEDIO (BS)' },
  { id: 'ves_fixed', icon: '🇻🇪', label: 'BOLIVARES MONTO FIJO' },
  { id: 'other', icon: '🌐', label: 'OTROS' },
];

interface IncomesManagementModuleProps {
  fixedIncomes: FixedIncome[];
  monthlyIncomeOverrides: MonthlyFixedIncomeOverride[];
  variableIncomes: VariableIncome[];
  categories: Category[];
  accounts: Account[];
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

export const IncomesManagementModule: React.FC<IncomesManagementModuleProps> = ({
  fixedIncomes,
  monthlyIncomeOverrides,
  variableIncomes,
  categories,
  accounts,
  selectedYear,
  selectedMonth,
  onChangePeriod,
  rates,
  currency = '$',
}) => {
  const [activeTab, setActiveTab] = useState<'fixed' | 'variable'>('fixed');

  const bcvUsd = rates?.bcvDollar && rates.bcvDollar > 0 ? rates.bcvDollar : 1;
  const bcvEur = rates?.bcvEuro && rates.bcvEuro > 0 ? rates.bcvEuro : 1;
  const parallelUsd = rates?.parallelDollar && rates.parallelDollar > 0 ? rates.parallelDollar : bcvUsd;

  // Fixed Income Modal states
  const [isFixedModalOpen, setIsFixedModalOpen] = useState<boolean>(false);
  const [editingFixed, setEditingFixed] = useState<FixedIncome | null>(null);
  const [fixedName, setFixedName] = useState<string>('');
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [fixedPaymentMode, setFixedPaymentMode] = useState<FixedExpensePaymentMode>('usd_cash');
  const [fixedFortnight, setFixedFortnight] = useState<'q1' | 'q2' | 'both' | 'split'>('split');
  const [fixedCategoryId, setFixedCategoryId] = useState<string>('cat_salary');
  const [fixedNotes, setFixedNotes] = useState<string>('');
  const [isFixedCategoryDropdownOpen, setIsFixedCategoryDropdownOpen] = useState<boolean>(false);
  const [isFixedPaymentDropdownOpen, setIsFixedPaymentDropdownOpen] = useState<boolean>(false);

  // Variable Income Modal states
  const [isVarModalOpen, setIsVarModalOpen] = useState<boolean>(false);
  const [editingVar, setEditingVar] = useState<VariableIncome | null>(null);
  const [varDescription, setVarDescription] = useState<string>('');
  const [varAmount, setVarAmount] = useState<number>(0);
  const [varPaymentMode, setVarPaymentMode] = useState<FixedExpensePaymentMode>('usd_cash');
  const [varFortnight, setVarFortnight] = useState<FortnightType>('q1');
  const [varCategoryId, setVarCategoryId] = useState<string>('cat_extras');
  const [varAccountId, setVarAccountId] = useState<string>('');
  const [varNotes, setVarNotes] = useState<string>('');
  const [isVarCategoryDropdownOpen, setIsVarCategoryDropdownOpen] = useState<boolean>(false);
  const [isVarPaymentDropdownOpen, setIsVarPaymentDropdownOpen] = useState<boolean>(false);
  const [isVarAccountDropdownOpen, setIsVarAccountDropdownOpen] = useState<boolean>(false);

  // Quick Account Creation
  const [isQuickAccountModalOpen, setIsQuickAccountModalOpen] = useState<boolean>(false);
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('cash');
  const [newAccountCurrency, setNewAccountCurrency] = useState<'USD' | 'VES' | 'EUR'>('USD');
  const [newAccountBalance, setNewAccountBalance] = useState<number>(0);
  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false);

  const incomeCategories = categories.filter((c) => c.type === 'income');

  // 1. Process Fixed Incomes for current month with currency conversions
  const overrideMap = useMemo(() => {
    return new Map(
      monthlyIncomeOverrides
        .filter((o) => o.year === selectedYear && o.month === selectedMonth)
        .map((o) => [o.fixed_income_id, o])
    );
  }, [monthlyIncomeOverrides, selectedYear, selectedMonth]);

  const processedFixedIncomes = useMemo(() => {
    return fixedIncomes.map((fi) => {
      const override = overrideMap.get(fi.id);
      const isActive = override?.is_active !== undefined ? override.is_active : fi.is_active;

      let mode: FixedExpensePaymentMode = fi.payment_mode || 'usd_cash';
      if (mode === 'cash') mode = 'usd_cash';
      else if (mode === 'bcv_usd') mode = 'ves_bcv';
      else if (mode === 'fixed_ves') mode = 'ves_fixed';
      else if (mode === 'bcv_eur') mode = 'ves_euro';
      else if (mode === 'parallel_ves') mode = 'ves_parallel';

      const rawCurrency = fi.currency || (mode === 'ves_fixed' ? 'VES' : mode === 'eur_cash' || mode === 'ves_euro' ? 'EUR' : 'USD');
      const origAmt = fi.original_amount !== undefined && fi.original_amount !== null ? fi.original_amount : (fi.amount || 0);

      let usdEquivalent = 0;
      if (mode === 'ves_fixed') {
        usdEquivalent = Number(((origAmt || 0) / bcvUsd).toFixed(2)) || 0;
      } else if (rawCurrency === 'EUR' || mode === 'eur_cash' || mode === 'ves_euro') {
        usdEquivalent = Number((((origAmt || 0) * bcvEur) / bcvUsd).toFixed(2)) || 0;
      } else {
        // usd_cash, ves_bcv, ves_parallel, other are all entered in USD index!
        usdEquivalent = Number((origAmt || 0).toFixed(2)) || 0;
      }

      const finalAmountUSD = override?.custom_amount !== undefined && override?.custom_amount !== null
        ? (override.custom_amount || 0)
        : usdEquivalent;

      const isSplit = fi.default_fortnight === 'split' || (fi.default_fortnight as any) === 50 || (fi.notes && fi.notes.includes('[split]'));
      const resolvedFortnight = isSplit ? 'split' : fi.default_fortnight;

      return {
        ...fi,
        payment_mode: mode,
        currency: rawCurrency,
        original_amount: origAmt || 0,
        amount_usd: finalAmountUSD || 0,
        default_fortnight: resolvedFortnight,
        isActive,
        finalAmount: finalAmountUSD || 0,
      };
    });
  }, [fixedIncomes, overrideMap, bcvUsd, bcvEur, parallelUsd]);

  const totalMonthlyFixed = processedFixedIncomes
    .filter((i) => i.isActive)
    .reduce((sum, i) => {
      const amt = Number(i.finalAmount || 0);
      if (i.default_fortnight === 'both') return sum + (amt * 2);
      return sum + amt;
    }, 0);

  // 2. Filter Variable Incomes for current month
  const currentMonthVariables = useMemo(() => {
    return variableIncomes
      .filter((vi) => vi.year === selectedYear && vi.month === selectedMonth)
      .map((vi) => ({
        ...vi,
        amount: Number(vi.amount || 0),
      }));
  }, [variableIncomes, selectedYear, selectedMonth]);

  const totalMonthlyVariable = currentMonthVariables.reduce((sum, vi) => sum + Number(vi.amount || 0), 0);

  // Total Combined
  const totalCombinedIncome = (totalMonthlyFixed || 0) + (totalMonthlyVariable || 0);

  // Quincenas totals
  const q1Fixed = processedFixedIncomes
    .filter((i) => i.isActive && (i.default_fortnight === 'q1' || i.default_fortnight === 'both' || i.default_fortnight === 'split'))
    .reduce((sum, i) => {
      const amt = Number(i.finalAmount || 0);
      if (i.default_fortnight === 'split') return sum + (amt / 2);
      return sum + amt;
    }, 0);
  const q1Variable = currentMonthVariables
    .filter((i) => i.fortnight === 'q1')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const totalQ1 = (q1Fixed || 0) + (q1Variable || 0);

  const q2Fixed = processedFixedIncomes
    .filter((i) => i.isActive && (i.default_fortnight === 'q2' || i.default_fortnight === 'both' || i.default_fortnight === 'split'))
    .reduce((sum, i) => {
      const amt = Number(i.finalAmount || 0);
      if (i.default_fortnight === 'split') return sum + (amt / 2);
      return sum + amt;
    }, 0);
  const q2Variable = currentMonthVariables
    .filter((i) => i.fortnight === 'q2')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const totalQ2 = (q2Fixed || 0) + (q2Variable || 0);

  // Handlers for Fixed Incomes
  const handleOpenAddFixed = () => {
    setEditingFixed(null);
    setFixedName('');
    setFixedAmount(0);
    setFixedPaymentMode('usd_cash');
    setFixedFortnight('split');
    setFixedCategoryId(incomeCategories[0]?.id || 'cat_salary');
    setFixedNotes('');
    setIsFixedCategoryDropdownOpen(false);
    setIsFixedPaymentDropdownOpen(false);
    setIsFixedModalOpen(true);
  };

  const handleOpenEditFixed = (fi: typeof processedFixedIncomes[0]) => {
    setEditingFixed(fi);
    setFixedName(fi.name);
    setFixedPaymentMode(fi.payment_mode || 'usd_cash');
    const exactOriginal = fi.original_amount !== undefined ? fi.original_amount : fi.finalAmount;
    setFixedAmount(exactOriginal || 0);
    setFixedFortnight(fi.default_fortnight || 'split');
    setFixedCategoryId(fi.category_id);
    setFixedNotes((fi.notes || '').replace(/\s*\[split\]/g, '').trim());
    setIsFixedCategoryDropdownOpen(false);
    setIsFixedPaymentDropdownOpen(false);
    setIsFixedModalOpen(true);
  };

  const handleSaveFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedName.trim()) {
      alert('Por favor ingresa el nombre del ingreso fijo.');
      return;
    }
    if (!fixedCategoryId) {
      alert('Por favor selecciona una categoría.');
      return;
    }
    if (!fixedPaymentMode) {
      alert('Por favor selecciona una forma de cobro.');
      return;
    }
    const numInput = Number(fixedAmount);
    if (isNaN(numInput) || numInput <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0.');
      return;
    }
    if (!fixedFortnight) {
      alert('Por favor selecciona la distribución de sueldo.');
      return;
    }

    let finalAmountUSD = numInput;
    let finalCurrency: 'USD' | 'VES' | 'EUR' = 'USD';

    if (fixedPaymentMode === 'ves_fixed') {
      finalCurrency = 'VES';
      finalAmountUSD = Number((numInput / bcvUsd).toFixed(2));
    } else if (fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro') {
      finalCurrency = 'EUR';
      finalAmountUSD = Number(((numInput * bcvEur) / bcvUsd).toFixed(2));
    } else {
      // usd_cash, ves_bcv, ves_parallel, other are all entered in USD index!
      finalCurrency = 'USD';
      finalAmountUSD = Number(numInput.toFixed(2));
    }

    await saveFixedIncome({
      id: editingFixed?.id,
      name: fixedName.trim(),
      amount: finalAmountUSD,
      original_amount: numInput,
      currency: finalCurrency,
      payment_mode: fixedPaymentMode,
      default_fortnight: fixedFortnight,
      category_id: fixedCategoryId,
      notes: fixedNotes,
    });

    setIsFixedModalOpen(false);
  };

  const handleDeleteFixed = async (id: string) => {
    if (window.confirm('¿Deseas eliminar este concepto de ingreso fijo?')) {
      await deleteFixedIncome(id);
    }
  };

  const handleToggleFixedActive = async (income: typeof processedFixedIncomes[0]) => {
    await toggleMonthlyFixedIncomeOverride(
      income.id,
      selectedYear,
      selectedMonth,
      !income.isActive,
      income.finalAmount
    );
  };

  // Handlers for Variable Incomes
  const handleOpenAddVar = () => {
    setEditingVar(null);
    setVarDescription('');
    setVarAmount(0);
    setVarPaymentMode('usd_cash');
    setVarFortnight('q1');
    setVarCategoryId(incomeCategories.find(c => c.id === 'cat_extras')?.id || incomeCategories[0]?.id || 'cat_extras');
    setVarAccountId('');
    setVarNotes('');
    setIsVarCategoryDropdownOpen(false);
    setIsVarPaymentDropdownOpen(false);
    setIsVarAccountDropdownOpen(false);
    setIsVarModalOpen(true);
  };

  const handleOpenEditVar = (vi: VariableIncome) => {
    setEditingVar(vi);
    setVarDescription(vi.description);
    const exactOriginal = vi.original_amount !== undefined ? vi.original_amount : vi.amount;
    setVarAmount(exactOriginal || 0);
    setVarPaymentMode(vi.payment_mode || (vi.currency === 'VES' ? 'ves_fixed' : vi.currency === 'EUR' ? 'eur_cash' : 'usd_cash'));
    setVarFortnight(vi.fortnight);
    setVarCategoryId(vi.category_id || 'cat_extras');
    setVarAccountId(vi.account_id || '');
    setVarNotes(vi.notes || '');
    setIsVarCategoryDropdownOpen(false);
    setIsVarPaymentDropdownOpen(false);
    setIsVarAccountDropdownOpen(false);
    setIsVarModalOpen(true);
  };

  const handleSaveVar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varDescription.trim()) {
      alert('Por favor ingresa el nombre del ingreso extra.');
      return;
    }
    if (!varCategoryId) {
      alert('Por favor selecciona una categoría.');
      return;
    }
    if (!varPaymentMode) {
      alert('Por favor selecciona una forma de cobro.');
      return;
    }
    const numInput = Number(varAmount);
    if (isNaN(numInput) || numInput <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0.');
      return;
    }
    if (!varFortnight) {
      alert('Por favor selecciona la quincena asignada.');
      return;
    }

    let finalAmountUSD = numInput;
    let finalCurrency: 'USD' | 'VES' | 'EUR' = 'USD';

    if (varPaymentMode === 'ves_fixed') {
      finalCurrency = 'VES';
      finalAmountUSD = Number((numInput / bcvUsd).toFixed(2));
    } else if (varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro') {
      finalCurrency = 'EUR';
      finalAmountUSD = Number(((numInput * bcvEur) / bcvUsd).toFixed(2));
    } else {
      // usd_cash, ves_bcv, ves_parallel, other are all entered in USD index!
      finalCurrency = 'USD';
      finalAmountUSD = Number(numInput.toFixed(2));
    }

    await saveVariableIncome({
      id: editingVar?.id,
      description: varDescription.trim(),
      amount: finalAmountUSD,
      original_amount: numInput,
      payment_mode: varPaymentMode,
      year: selectedYear,
      month: selectedMonth,
      fortnight: varFortnight,
      category_id: varCategoryId,
      account_id: varAccountId,
      currency: finalCurrency,
      notes: varNotes,
    });

    setIsVarModalOpen(false);
  };

  const handleDeleteVar = async (id: string) => {
    if (window.confirm('¿Deseas eliminar este registro de ingreso variable?')) {
      await deleteVariableIncome(id);
    }
  };

  const handleReverseAllocation = async (vi: VariableIncome) => {
    if (
      !window.confirm(
        `¿Deseas reversar esta asignación de sueldo ($${Math.abs(vi.amount).toFixed(
          2
        )} USD) y restaurar los montos originales de ambas quincenas?`
      )
    ) {
      return;
    }
    try {
      await deleteVariableIncome(vi.id);

      // Find companion allocation in same year and month
      const companion = variableIncomes.find(
        (v) =>
          v.id !== vi.id &&
          v.year === vi.year &&
          v.month === vi.month &&
          Math.abs(Math.abs(v.amount) - Math.abs(vi.amount)) < 0.01 &&
          (v.description.includes('Asignación de Sueldo') ||
            v.description.includes('Reserva asignada') ||
            v.description.includes('Tomado de Sueldo'))
      );
      if (companion) {
        await deleteVariableIncome(companion.id);
      }
    } catch (err) {
      console.error('Error reversing salary allocation:', err);
    }
  };

  // Quick create account action
  const handleQuickCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    setIsCreatingAccount(true);
    try {
      const created = await saveAccount({
        name: newAccountName.trim(),
        type: newAccountType,
        currency: newAccountCurrency,
        initial_balance: Number(newAccountBalance) || 0,
        notes: 'Creada desde Gestión de Ingresos',
      });
      setVarAccountId(created.id);
      setIsQuickAccountModalOpen(false);
      setNewAccountName('');
      setNewAccountBalance(0);
      setIsVarAccountDropdownOpen(false);
    } catch (err) {
      console.error('Error creating account:', err);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Navigation Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                <Briefcase className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-app">Gestión de Ingresos</h3>
            </div>
            <p className="text-xs text-muted mt-1">
              Periodo: <strong>{MONTH_NAMES[selectedMonth]} {selectedYear}</strong> • Fijos y variables por quincena
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <MonthPicker
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onChange={onChangePeriod}
              className="w-full sm:w-auto justify-between sm:justify-start"
            />

            <button
              onClick={activeTab === 'fixed' ? handleOpenAddFixed : handleOpenAddVar}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === 'fixed' ? 'Nuevo Ingreso Fijo' : 'Nuevo Ingreso Extra'}</span>
            </button>
          </div>
        </div>

        {/* Tab Selector: Fijos vs Variables (Centrado) */}
        <div className="flex justify-center pt-1">
          <div className="flex items-center p-1 bg-card rounded-2xl border border-app w-full max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab('fixed')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'fixed'
                  ? 'bg-surface text-app shadow-sm border border-app'
                  : 'text-muted hover:text-app'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Ingresos Fijos ({processedFixedIncomes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('variable')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'variable'
                  ? 'bg-primary-custom text-white shadow-sm'
                  : 'text-muted hover:text-app'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ingresos Variables ({currentMonthVariables.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Total Mes</span>
          <p className="text-lg sm:text-xl font-black text-primary-custom mt-1">
            {currency}{(totalCombinedIncome || 0).toFixed(2)}
          </p>
          <span className="text-[10px] text-muted block mt-0.5">
            En {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Ingresos Fijos</span>
          <p className="text-lg sm:text-xl font-black text-[#00C2C7] mt-1">
            {currency}{(totalMonthlyFixed || 0).toFixed(2)}
          </p>
          <span className="text-[10px] text-muted block mt-0.5">
            Sueldo, tickets, etc.
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Ingresos Variables</span>
          <p className="text-lg sm:text-xl font-black text-[#FF914D] mt-1">
            {currency}{(totalMonthlyVariable || 0).toFixed(2)}
          </p>
          <span className="text-[10px] text-muted block mt-0.5">
            Bonos, freelance, extras
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Por Quincena</span>
          <div className="mt-1 space-y-0.5 text-xs font-bold text-app">
            <div className="flex justify-between text-muted">
              <span>Q15:</span>
              <span className="text-app">{currency}{(totalQ1 || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Q30:</span>
              <span className="text-app">{currency}{(totalQ2 || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: INGRESOS FIJOS */}
      {activeTab === 'fixed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-app flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-custom" />
              Ingresos Fijos Recurrentes ({processedFixedIncomes.length})
            </h4>
          </div>

          {processedFixedIncomes.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-primary-custom/15 text-primary-custom flex items-center justify-center shadow-xl shadow-primary-custom/10 border border-primary-custom/20">
                <Briefcase className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-app">Comienza a estructurar tus finanzas</h3>
                <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                  Agrega tu sueldo o ingresos fijos para calcular tus balances y proyecciones de quincena automáticamente.
                </p>
              </div>
              <button
                onClick={handleOpenAddFixed}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-lg shadow-primary-custom/25 hover:opacity-95 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Crear mi primer ingreso fijo</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {processedFixedIncomes.map((fi) => {
                const category = categories.find((c) => c.id === fi.category_id);
                const isVesFixed = fi.payment_mode === 'ves_fixed';
                const isEur = fi.currency === 'EUR' || fi.payment_mode === 'eur_cash' || fi.payment_mode === 'ves_euro';

                return (
                  <div
                    key={fi.id}
                    className={`p-4 rounded-3xl border transition-all ${
                      !fi.isActive
                        ? 'bg-surface/50 border-app opacity-60'
                        : 'bg-surface border-app shadow-md hover:border-primary-custom'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: category?.color || '#147DF0' }}
                        >
                          <CategoryIcon iconName={category?.icon || 'Briefcase'} size={20} className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-app">{fi.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span className="px-2 py-0.5 rounded bg-card text-[10px] font-semibold text-app">
                              {fi.default_fortnight === 'q1' && `Quincena 15`}
                              {fi.default_fortnight === 'q2' && `Quincena 30`}
                              {fi.default_fortnight === 'split' && `Dividido 50/50 (${currency}${((fi.finalAmount || 0) / 2).toFixed(2)} c/u)`}
                              {fi.default_fortnight === 'both' && `Ambas Quincenas (${currency}${(fi.finalAmount || 0).toFixed(2)} c/u)`}
                            </span>
                            {fi.payment_mode && (
                              <span className="text-[10px] text-muted font-medium">
                                {fi.payment_mode === 'usd_cash' && '💵 CASH USD'}
                                {fi.payment_mode === 'eur_cash' && '💶 CASH EURO'}
                                {fi.payment_mode === 'ves_bcv' && '🏛️ DOLAR BCV'}
                                {fi.payment_mode === 'ves_euro' && '🇪🇺 EURO BCV'}
                                {fi.payment_mode === 'ves_parallel' && '⚡ DOLAR PROMEDIO'}
                                {fi.payment_mode === 'ves_fixed' && '🇻🇪 Bolivar Fijo'}
                                {fi.payment_mode === 'other' && '🌐 OTROS'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {isVesFixed ? (
                          <>
                            <span className="text-base font-black text-[#00C2C7]">
                              +Bs. {(fi.original_amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-muted block">
                              ≈ {currency}{(fi.finalAmount || 0).toFixed(2)} USD
                            </span>
                          </>
                        ) : isEur ? (
                          <>
                            <span className="text-base font-black text-[#00C2C7]">
                              +€{(fi.original_amount || 0).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted block">
                              ≈ {currency}{(fi.finalAmount || 0).toFixed(2)} USD
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-base font-black text-[#00C2C7]">
                              +{currency}{(fi.finalAmount || 0).toFixed(2)}
                            </span>
                            {fi.payment_mode === 'ves_parallel' && rates?.parallelDollar ? (
                              <span className="text-[10px] text-muted block">
                                ≈ Bs. {((fi.finalAmount || 0) * parallelUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : rates?.bcvDollar ? (
                              <span className="text-[10px] text-muted block">
                                ≈ Bs. {((fi.finalAmount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-app text-xs">
                      <button
                        onClick={() => handleToggleFixedActive(fi)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                          fi.isActive
                            ? 'bg-[#00C2C7]/20 text-[#00C2C7]'
                            : 'bg-card text-muted hover:text-app'
                        }`}
                      >
                        {fi.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{fi.isActive ? 'Activo este mes' : 'Pausado este mes'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditFixed(fi)}
                          className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-card transition-colors cursor-pointer"
                          title="Editar ingreso fijo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFixed(fi.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-[#ef4444] hover:bg-card transition-colors cursor-pointer"
                          title="Eliminar ingreso fijo"
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

      {/* TAB 2: INGRESOS VARIABLES / EXTRAS */}
      {activeTab === 'variable' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-app flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF914D]" />
              Ingresos Variables del Mes ({currentMonthVariables.length})
            </h4>
          </div>

          {currentMonthVariables.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FF914D]/15 text-[#FF914D] flex items-center justify-center shadow-xl shadow-[#FF914D]/10 border border-[#FF914D]/20">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-app">Sin ingresos extras este mes</h3>
                <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                  Registra bonos puntuales, horas extras, comisiones o proyectos freelance para {MONTH_NAMES[selectedMonth]} {selectedYear}.
                </p>
              </div>
              <button
                onClick={handleOpenAddVar}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-lg shadow-primary-custom/25 hover:opacity-95 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Crear mi primer ingreso extra</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentMonthVariables.map((vi) => {
                const category = categories.find((c) => c.id === vi.category_id);
                const isVesFixed = vi.payment_mode === 'ves_fixed';
                const isEur = vi.currency === 'EUR' || vi.payment_mode === 'eur_cash' || vi.payment_mode === 'ves_euro';
                const origAmt = vi.original_amount !== undefined && vi.original_amount !== null ? vi.original_amount : (vi.amount || 0);

                const isAllocation =
                  vi.description.includes('Asignación de Sueldo') ||
                  vi.description.includes('Reserva asignada') ||
                  vi.description.includes('Tomado de Sueldo');
                const isNegative = (vi.amount || 0) < 0;

                return (
                  <div
                    key={vi.id}
                    className={`p-4 rounded-3xl bg-surface border shadow-md transition-all ${
                      isAllocation
                        ? 'border-primary-custom/40 bg-gradient-to-br from-surface via-surface to-primary-custom/5'
                        : 'border-app hover:border-[#FF914D]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: isAllocation ? '#00C2C7' : category?.color || '#FF914D' }}
                        >
                          {isAllocation ? (
                            <ArrowLeftRight className="w-5 h-5" />
                          ) : (
                            <CategoryIcon iconName={category?.icon || 'Sparkles'} size={20} className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-app">{vi.description}</h4>
                            {isAllocation && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary-custom/20 text-primary-custom font-bold">
                                Asignación Quincenal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-card text-[10px] font-semibold text-app">
                              {vi.fortnight === 'q1'
                                ? `Quincena 15 de ${MONTH_NAMES[selectedMonth]}`
                                : `Quincena 30 de ${MONTH_NAMES[selectedMonth]}`}
                            </span>
                            {vi.payment_mode && (
                              <span className="text-[10px] text-muted font-medium">
                                {vi.payment_mode === 'usd_cash' && '💵 CASH USD'}
                                {vi.payment_mode === 'eur_cash' && '💶 CASH EURO'}
                                {vi.payment_mode === 'ves_bcv' && '🏛️ DOLAR BCV'}
                                {vi.payment_mode === 'ves_euro' && '🇪🇺 EURO BCV'}
                                {vi.payment_mode === 'ves_parallel' && '⚡ DOLAR PROMEDIO'}
                                {vi.payment_mode === 'ves_fixed' && '🇻🇪 Bolivar Fijo'}
                                {vi.payment_mode === 'other' && '🌐 OTROS'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {isVesFixed ? (
                          <>
                            <span className={`text-base font-black ${isNegative ? 'text-[#ef4444]' : 'text-[#FF914D]'}`}>
                              {isNegative ? '-' : '+'}Bs. {Math.abs(origAmt || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-muted block">
                              ≈ {isNegative ? '-' : ''}{currency}{Math.abs(vi.amount || 0).toFixed(2)} USD
                            </span>
                          </>
                        ) : isEur ? (
                          <>
                            <span className={`text-base font-black ${isNegative ? 'text-[#ef4444]' : 'text-[#FF914D]'}`}>
                              {isNegative ? '-' : '+'}€{Math.abs(origAmt || 0).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted block">
                              ≈ {isNegative ? '-' : ''}{currency}{Math.abs(vi.amount || 0).toFixed(2)} USD
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`text-base font-black ${isNegative ? 'text-[#ef4444]' : isAllocation ? 'text-[#00C2C7]' : 'text-[#FF914D]'}`}>
                              {isNegative ? '-' : '+'}{currency}{Math.abs(vi.amount || 0).toFixed(2)}
                            </span>
                            {vi.payment_mode === 'ves_parallel' && rates?.parallelDollar ? (
                              <span className="text-[10px] text-muted block">
                                ≈ {isNegative ? '-' : ''}Bs. {(Math.abs(vi.amount || 0) * parallelUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : rates?.bcvDollar ? (
                              <span className="text-[10px] text-muted block">
                                ≈ {isNegative ? '-' : ''}Bs. {(Math.abs(vi.amount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-app text-xs">
                      <span className="text-muted text-[11px] truncate max-w-[200px]">
                        {vi.notes || 'Ingreso puntual registrado'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isAllocation ? (
                          <button
                            type="button"
                            onClick={() => handleReverseAllocation(vi)}
                            className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Reversar y restaurar sueldo original"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reversar Asignación</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEditVar(vi)}
                              className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-card transition-colors cursor-pointer"
                              title="Editar ingreso variable"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVar(vi.id)}
                              className="p-1.5 rounded-lg text-muted hover:text-[#ef4444] hover:bg-card transition-colors cursor-pointer"
                              title="Eliminar ingreso variable"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Fixed Income Modal */}
      {isFixedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95 max-h-[90vh] overflow-y-auto no-scrollbar">
            <h3 className="text-base font-bold mb-4">
              {editingFixed ? 'Editar Ingreso Fijo' : 'Nuevo Ingreso Fijo Recurrente'}
            </h3>

            <form onSubmit={handleSaveFixed} className="space-y-3.5">
              {/* 1. Nombre del Ingreso (Obligatorio) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre del Ingreso <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sueldo, Honorarios..."
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* 2. Categoría (Obligatorio) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Categoría <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsFixedCategoryDropdownOpen(!isFixedCategoryDropdownOpen);
                    setIsFixedPaymentDropdownOpen(false);
                  }}
                  className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  <div className="flex items-center gap-2 truncate">
                    {(() => {
                      const selectedCat = categories.find((c) => c.id === fixedCategoryId);
                      if (selectedCat) {
                        return (
                          <>
                            <span className="text-primary-custom flex items-center">{renderIcon(selectedCat.icon)}</span>
                            <span className="truncate">{selectedCat.name}</span>
                          </>
                        );
                      }
                      return (
                        <>
                          <span className="text-primary-custom flex items-center">{renderIcon('Briefcase')}</span>
                          <span className="truncate">Seleccionar categoría</span>
                        </>
                      );
                    })()}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>

                {isFixedCategoryDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsFixedCategoryDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-52 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {incomeCategories && incomeCategories.length > 0 ? (
                        incomeCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setFixedCategoryId(cat.id);
                              setIsFixedCategoryDropdownOpen(false);
                            }}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                              fixedCategoryId === cat.id
                                ? 'bg-primary-custom text-white shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span className={`flex items-center ${fixedCategoryId === cat.id ? 'text-white' : 'text-primary-custom'}`}>
                              {renderIcon(cat.icon)}
                            </span>
                            <span className="truncate">{cat.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-2 text-xs text-slate-400 text-center">No hay categorías disponibles</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 3. Forma de Cobro (Obligatorio) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Forma de Cobro <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsFixedPaymentDropdownOpen(!isFixedPaymentDropdownOpen);
                    setIsFixedCategoryDropdownOpen(false);
                  }}
                  className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  <div className="flex items-center gap-2 truncate">
                    {fixedPaymentMode === 'usd_cash' && <><span className="text-base">💵</span><span>CASH USD</span></>}
                    {fixedPaymentMode === 'eur_cash' && <><span className="text-base">💶</span><span>CASH EURO</span></>}
                    {fixedPaymentMode === 'ves_bcv' && <><span className="text-base">🏛️</span><span>DOLAR TASA BCV (BS)</span></>}
                    {fixedPaymentMode === 'ves_euro' && <><span className="text-base">🇪🇺</span><span>EURO TASA BCV (BS)</span></>}
                    {fixedPaymentMode === 'ves_parallel' && <><span className="text-base">⚡</span><span>DOLAR PROMEDIO (BS)</span></>}
                    {fixedPaymentMode === 'ves_fixed' && <><span className="text-base">🇻🇪</span><span>BOLIVARES MONTO FIJO</span></>}
                    {fixedPaymentMode === 'other' && <><span className="text-base">🌐</span><span>OTROS</span></>}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>

                {isFixedPaymentDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsFixedPaymentDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-56 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {PAYMENT_MODES_LIST.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setFixedPaymentMode(opt.id);
                            setIsFixedPaymentDropdownOpen(false);
                          }}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            fixedPaymentMode === opt.id
                              ? 'bg-primary-custom text-white shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="text-base">{opt.icon}</span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 4. Monto (Obligatorio) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  {fixedPaymentMode === 'usd_cash'
                    ? 'Monto en Dólares ($ USD)'
                    : fixedPaymentMode === 'eur_cash'
                    ? 'Monto en Euros (€ EUR)'
                    : fixedPaymentMode === 'ves_bcv'
                    ? 'Monto en Dólares ($ a Tasa BCV)'
                    : fixedPaymentMode === 'ves_euro'
                    ? 'Monto en Euros (€ a Tasa BCV)'
                    : fixedPaymentMode === 'ves_parallel'
                    ? 'Monto en Dólares ($ a Tasa Promedio)'
                    : fixedPaymentMode === 'ves_fixed'
                    ? 'Monto Fijo en Bolívares (Bs.)'
                    : 'Monto ($ USD u Otra Divisa)'} <span className="text-red-400">*</span>
                </label>
                <MoneyInput
                  value={fixedAmount}
                  onChange={setFixedAmount}
                  currencySymbol={
                    fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro'
                      ? '€'
                      : fixedPaymentMode === 'ves_fixed'
                      ? 'Bs'
                      : '$'
                  }
                  placeholder="0,00"
                  required
                  className="!py-2.5 !text-sm font-black"
                />

                {/* Sub-indicador de conversión en vivo */}
                <div className="mt-1 text-[11px] text-muted flex items-center justify-between px-1">
                  {(fixedPaymentMode === 'usd_cash' || fixedPaymentMode === 'ves_bcv') && rates?.bcvDollar ? (
                    <span>≈ Bs. {((fixedAmount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: {bcvUsd.toFixed(2)})</span>
                  ) : fixedPaymentMode === 'eur_cash' ? (
                    <span>≈ ${(((fixedAmount || 0) * bcvEur) / bcvUsd).toFixed(2)} USD (Tasa EUR: {bcvEur.toFixed(2)})</span>
                  ) : fixedPaymentMode === 'ves_euro' ? (
                    <span>≈ Bs. {((fixedAmount || 0) * bcvEur).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa EUR BCV: {bcvEur.toFixed(2)}) • ≈ ${(((fixedAmount || 0) * bcvEur) / bcvUsd).toFixed(2)} USD</span>
                  ) : fixedPaymentMode === 'ves_parallel' && rates?.parallelDollar ? (
                    <span>≈ Bs. {((fixedAmount || 0) * parallelUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa Promedio: {parallelUsd.toFixed(2)})</span>
                  ) : fixedPaymentMode === 'ves_fixed' ? (
                    <span>≈ ${((fixedAmount || 0) / bcvUsd).toFixed(2)} USD (Referencia BCV: {bcvUsd.toFixed(2)})</span>
                  ) : fixedPaymentMode === 'other' && rates?.bcvDollar ? (
                    <span>≈ Bs. {((fixedAmount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: {bcvUsd.toFixed(2)})</span>
                  ) : null}
                </div>
              </div>

              {/* 5. Distribución de Sueldo (Obligatorio) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Distribución de Sueldo <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-card rounded-xl border border-app">
                  {[
                    { id: 'split' as const, label: 'Dividir 50% / 50%', desc: '50% en Q15 y 50% en Q30' },
                    { id: 'q1' as const, label: 'Quincena 15', desc: '100% en Quincena 15' },
                    { id: 'q2' as const, label: 'Quincena 30', desc: '100% en Quincena 30' },
                    { id: 'both' as const, label: 'Ambas (Monto C/U)', desc: 'Monto completo en c/u' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFixedFortnight(opt.id)}
                      className={`py-1.5 px-2 rounded-lg text-left transition-all cursor-pointer ${
                        fixedFortnight === opt.id
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'text-muted hover:text-app hover:bg-surface-hover'
                      }`}
                    >
                      <p className="text-[11px] font-bold truncate leading-tight">{opt.label}</p>
                      <p className={`text-[8.5px] truncate mt-0.5 ${fixedFortnight === opt.id ? 'text-white/80' : 'text-muted'}`}>
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
                {fixedFortnight === 'split' && fixedAmount > 0 && (
                  <p className="text-[11px] text-primary-custom font-semibold mt-1 px-1">
                    {fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro' ? (
                      <>💡 Cobrarás €{(fixedAmount / 2).toFixed(2)} el día 15 y €{(fixedAmount / 2).toFixed(2)} el día 30 (Total mensual: €{fixedAmount.toFixed(2)}).</>
                    ) : fixedPaymentMode === 'ves_fixed' ? (
                      <>💡 Cobrarás Bs. {(fixedAmount / 2).toLocaleString('es-VE', { minimumFractionDigits: 2 })} el día 15 y Bs. {(fixedAmount / 2).toLocaleString('es-VE', { minimumFractionDigits: 2 })} el día 30 (Total mensual: Bs. {fixedAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}).</>
                    ) : (
                      <>💡 Cobrarás ${(fixedAmount / 2).toFixed(2)} el día 15 y ${(fixedAmount / 2).toFixed(2)} el día 30 (Total mensual: ${fixedAmount.toFixed(2)}).</>
                    )}
                  </p>
                )}
              </div>

              {/* 6. Notas (Opcional) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales (opcional)..."
                  value={fixedNotes}
                  onChange={(e) => setFixedNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFixedModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Guardar Ingreso Fijo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Variable Income Modal */}
      {isVarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95 max-h-[90vh] overflow-y-auto no-scrollbar">
            <h3 className="text-base font-bold mb-4">
              {editingVar ? 'Editar Ingreso Extra' : 'Registrar Ingreso Variable / Extra'}
            </h3>

            <form onSubmit={handleSaveVar} className="space-y-3.5">
              {/* 1. Nombre del Ingreso Extra (Obligatorio) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre del Ingreso Extra <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Freelance, Bono, Guardia..."
                  value={varDescription}
                  onChange={(e) => setVarDescription(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* 2. Categoría (Obligatorio) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Categoría <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsVarCategoryDropdownOpen(!isVarCategoryDropdownOpen);
                    setIsVarPaymentDropdownOpen(false);
                    setIsVarAccountDropdownOpen(false);
                  }}
                  className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  <div className="flex items-center gap-2 truncate">
                    {(() => {
                      const selectedCat = categories.find((c) => c.id === varCategoryId);
                      if (selectedCat) {
                        return (
                          <>
                            <span className="text-primary-custom flex items-center">{renderIcon(selectedCat.icon)}</span>
                            <span className="truncate">{selectedCat.name}</span>
                          </>
                        );
                      }
                      return (
                        <>
                          <span className="text-primary-custom flex items-center">{renderIcon('Sparkles')}</span>
                          <span className="truncate">Seleccionar categoría</span>
                        </>
                      );
                    })()}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>

                {isVarCategoryDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsVarCategoryDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-52 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {incomeCategories && incomeCategories.length > 0 ? (
                        incomeCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setVarCategoryId(cat.id);
                              setIsVarCategoryDropdownOpen(false);
                            }}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                              varCategoryId === cat.id
                                ? 'bg-primary-custom text-white shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span className={`flex items-center ${varCategoryId === cat.id ? 'text-white' : 'text-primary-custom'}`}>
                              {renderIcon(cat.icon)}
                            </span>
                            <span className="truncate">{cat.name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-2 text-xs text-slate-400 text-center">No hay categorías disponibles</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 3. Forma de Cobro (Obligatorio) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Forma de Cobro <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsVarPaymentDropdownOpen(!isVarPaymentDropdownOpen);
                    setIsVarCategoryDropdownOpen(false);
                    setIsVarAccountDropdownOpen(false);
                  }}
                  className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  <div className="flex items-center gap-2 truncate">
                    {varPaymentMode === 'usd_cash' && <><span className="text-base">💵</span><span>CASH USD</span></>}
                    {varPaymentMode === 'eur_cash' && <><span className="text-base">💶</span><span>CASH EURO</span></>}
                    {varPaymentMode === 'ves_bcv' && <><span className="text-base">🏛️</span><span>DOLAR TASA BCV (BS)</span></>}
                    {varPaymentMode === 'ves_euro' && <><span className="text-base">🇪🇺</span><span>EURO TASA BCV (BS)</span></>}
                    {varPaymentMode === 'ves_parallel' && <><span className="text-base">⚡</span><span>DOLAR PROMEDIO (BS)</span></>}
                    {varPaymentMode === 'ves_fixed' && <><span className="text-base">🇻🇪</span><span>BOLIVARES MONTO FIJO</span></>}
                    {varPaymentMode === 'other' && <><span className="text-base">🌐</span><span>OTROS</span></>}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>

                {isVarPaymentDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsVarPaymentDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-56 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {PAYMENT_MODES_LIST.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setVarPaymentMode(opt.id);
                            setIsVarPaymentDropdownOpen(false);
                          }}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            varPaymentMode === opt.id
                              ? 'bg-primary-custom text-white shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="text-base">{opt.icon}</span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 4. Monto (Obligatorio) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  {varPaymentMode === 'usd_cash'
                    ? 'Monto en Dólares ($ USD)'
                    : varPaymentMode === 'eur_cash'
                    ? 'Monto en Euros (€ EUR)'
                    : varPaymentMode === 'ves_bcv'
                    ? 'Monto en Dólares ($ a Tasa BCV)'
                    : varPaymentMode === 'ves_euro'
                    ? 'Monto en Euros (€ a Tasa BCV)'
                    : varPaymentMode === 'ves_parallel'
                    ? 'Monto en Dólares ($ a Tasa Promedio)'
                    : varPaymentMode === 'ves_fixed'
                    ? 'Monto Fijo en Bolívares (Bs.)'
                    : 'Monto ($ USD u Otra Divisa)'} <span className="text-red-400">*</span>
                </label>
                <MoneyInput
                  value={varAmount}
                  onChange={setVarAmount}
                  currencySymbol={
                    varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro'
                      ? '€'
                      : varPaymentMode === 'ves_fixed'
                      ? 'Bs'
                      : '$'
                  }
                  placeholder="0,00"
                  required
                  className="!py-2.5 !text-sm font-black"
                />

                {/* Sub-indicador de conversión en vivo */}
                <div className="mt-1 text-[11px] text-muted flex items-center justify-between px-1">
                  {(varPaymentMode === 'usd_cash' || varPaymentMode === 'ves_bcv') && rates?.bcvDollar ? (
                    <span>≈ Bs. {((varAmount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: {bcvUsd.toFixed(2)})</span>
                  ) : varPaymentMode === 'eur_cash' ? (
                    <span>≈ ${(((varAmount || 0) * bcvEur) / bcvUsd).toFixed(2)} USD (Tasa EUR: {bcvEur.toFixed(2)})</span>
                  ) : varPaymentMode === 'ves_euro' ? (
                    <span>≈ Bs. {((varAmount || 0) * bcvEur).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa EUR BCV: {bcvEur.toFixed(2)}) • ≈ ${(((varAmount || 0) * bcvEur) / bcvUsd).toFixed(2)} USD</span>
                  ) : varPaymentMode === 'ves_parallel' && rates?.parallelDollar ? (
                    <span>≈ Bs. {((varAmount || 0) * parallelUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa Promedio: {parallelUsd.toFixed(2)})</span>
                  ) : varPaymentMode === 'ves_fixed' ? (
                    <span>≈ ${((varAmount || 0) / bcvUsd).toFixed(2)} USD (Referencia BCV: {bcvUsd.toFixed(2)})</span>
                  ) : varPaymentMode === 'other' && rates?.bcvDollar ? (
                    <span>≈ Bs. {((varAmount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: {bcvUsd.toFixed(2)})</span>
                  ) : null}
                </div>
              </div>

              {/* 5. Quincena Asignada (Obligatorio) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Quincena Asignada <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-card rounded-2xl border border-app">
                  {[
                    { id: 'q1' as const, label: `Quincena 15 (${MONTH_NAMES[selectedMonth].substring(0, 3)})` },
                    { id: 'q2' as const, label: `Quincena 30 (${MONTH_NAMES[selectedMonth].substring(0, 3)})` },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVarFortnight(opt.id)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
                        varFortnight === opt.id
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'text-muted hover:text-app hover:bg-surface-hover'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Cuenta Destino: Custom Styled Dropdown (Opcional) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Cuenta Destino (Opcional)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsVarAccountDropdownOpen(!isVarAccountDropdownOpen);
                    setIsVarCategoryDropdownOpen(false);
                    setIsVarPaymentDropdownOpen(false);
                  }}
                  className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  <div className="flex items-center gap-2 truncate">
                    {(() => {
                      const selectedAcc = accounts.find((a) => a.id === varAccountId);
                      if (selectedAcc) {
                        return (
                          <>
                            <span className="text-primary-custom flex items-center">{renderIcon('Wallet')}</span>
                            <span className="truncate">{selectedAcc.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-muted uppercase">
                              {selectedAcc.currency}
                            </span>
                          </>
                        );
                      }
                      return (
                        <>
                          <span className="text-muted flex items-center text-sm">🚫</span>
                          <span className="truncate text-muted">Ninguna</span>
                        </>
                      );
                    })()}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>

                {isVarAccountDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsVarAccountDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-60 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {/* Botón rápido Crear Nueva Cuenta */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickAccountModalOpen(true);
                          setIsVarAccountDropdownOpen(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center gap-2 bg-primary-custom/15 text-primary-custom hover:bg-primary-custom hover:text-white transition-all cursor-pointer border border-primary-custom/30"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Nueva Cuenta / Fondo</span>
                      </button>

                      {/* Opción Ninguna */}
                      <button
                        type="button"
                        onClick={() => {
                          setVarAccountId('');
                          setIsVarAccountDropdownOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                          !varAccountId
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🚫</span>
                          <span>Ninguna</span>
                        </div>
                      </button>

                      {/* Lista de Cuentas */}
                      {accounts && accounts.length > 0 ? (
                        accounts.map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setVarAccountId(acc.id);
                              setIsVarAccountDropdownOpen(false);
                            }}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                              varAccountId === acc.id
                                ? 'bg-primary-custom text-white shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`flex items-center ${varAccountId === acc.id ? 'text-white' : 'text-primary-custom'}`}>
                                {renderIcon('Wallet')}
                              </span>
                              <span className="truncate">{acc.name}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface/50 text-slate-300 uppercase shrink-0">
                              {acc.currency}
                            </span>
                          </button>
                        ))
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              {/* 7. Notas (Opcional) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales (opcional)..."
                  value={varNotes}
                  onChange={(e) => setVarNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsVarModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Guardar Ingreso Extra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Account Sub-Modal */}
      {isQuickAccountModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <h4 className="text-sm font-bold text-app flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary-custom" />
                Nueva Cuenta / Fondo
              </h4>
              <button
                type="button"
                onClick={() => setIsQuickAccountModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-app"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre de la Cuenta <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej. Banesco, Zelle, Efectivo USD..."
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Tipo
                  </label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as AccountType)}
                    className="w-full bg-card border border-app rounded-xl px-2.5 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  >
                    <option value="cash">💵 Efectivo</option>
                    <option value="bank">🏛️ Banco</option>
                    <option value="wallet">📱 Billetera Digital</option>
                    <option value="savings">🐖 Ahorros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Moneda
                  </label>
                  <select
                    value={newAccountCurrency}
                    onChange={(e) => setNewAccountCurrency(e.target.value as 'USD' | 'VES' | 'EUR')}
                    className="w-full bg-card border border-app rounded-xl px-2.5 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Saldo Inicial
                </label>
                <MoneyInput
                  value={newAccountBalance}
                  onChange={setNewAccountBalance}
                  currencySymbol={newAccountCurrency === 'VES' ? 'Bs' : newAccountCurrency === 'EUR' ? '€' : '$'}
                  placeholder="0,00"
                  className="!py-2 !text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAccountModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAccount || !newAccountName.trim()}
                  className="flex-1 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCreatingAccount ? 'Creando...' : 'Crear y Seleccionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
