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
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type {
  FixedIncome,
  MonthlyFixedIncomeOverride,
  VariableIncome,
  Category,
  Account,
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
  const [varFortnight, setVarFortnight] = useState<FortnightType>('q1');
  const [varCategoryId, setVarCategoryId] = useState<string>('cat_extras');
  const [varAccountId, setVarAccountId] = useState<string>(accounts[0]?.id || '');
  const [varNotes, setVarNotes] = useState<string>('');
  const [isVarCategoryDropdownOpen, setIsVarCategoryDropdownOpen] = useState<boolean>(false);

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

      const rawCurrency = fi.currency || (mode === 'ves_fixed' ? 'VES' : mode === 'ves_euro' ? 'EUR' : 'USD');
      const origAmt = fi.original_amount !== undefined ? fi.original_amount : fi.amount;

      let usdEquivalent = 0;
      if (rawCurrency === 'VES' || mode === 'ves_fixed') {
        usdEquivalent = Number((origAmt / bcvUsd).toFixed(2));
      } else if (rawCurrency === 'EUR' || mode === 'ves_euro') {
        usdEquivalent = Number(((origAmt * bcvEur) / bcvUsd).toFixed(2));
      } else {
        usdEquivalent = Number(origAmt.toFixed(2));
      }

      const finalAmountUSD = override?.custom_amount !== undefined ? override.custom_amount : usdEquivalent;

      return {
        ...fi,
        payment_mode: mode,
        currency: rawCurrency,
        original_amount: origAmt,
        amount_usd: finalAmountUSD,
        isActive,
        finalAmount: finalAmountUSD,
      };
    });
  }, [fixedIncomes, overrideMap, bcvUsd, bcvEur]);

  const totalMonthlyFixed = processedFixedIncomes
    .filter((i) => i.isActive)
    .reduce((sum, i) => {
      if (i.default_fortnight === 'both') return sum + (i.finalAmount * 2);
      return sum + i.finalAmount;
    }, 0);

  // 2. Filter Variable Incomes for current month
  const currentMonthVariables = useMemo(() => {
    return variableIncomes.filter(
      (vi) => vi.year === selectedYear && vi.month === selectedMonth
    );
  }, [variableIncomes, selectedYear, selectedMonth]);

  const totalMonthlyVariable = currentMonthVariables.reduce((sum, vi) => sum + vi.amount, 0);

  // Total Combined
  const totalCombinedIncome = totalMonthlyFixed + totalMonthlyVariable;

  // Quincenas totals
  const q1Fixed = processedFixedIncomes
    .filter((i) => i.isActive && (i.default_fortnight === 'q1' || i.default_fortnight === 'both' || i.default_fortnight === 'split'))
    .reduce((sum, i) => {
      if (i.default_fortnight === 'split') return sum + (i.finalAmount / 2);
      return sum + i.finalAmount;
    }, 0);
  const q1Variable = currentMonthVariables
    .filter((i) => i.fortnight === 'q1')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalQ1 = q1Fixed + q1Variable;

  const q2Fixed = processedFixedIncomes
    .filter((i) => i.isActive && (i.default_fortnight === 'q2' || i.default_fortnight === 'both' || i.default_fortnight === 'split'))
    .reduce((sum, i) => {
      if (i.default_fortnight === 'split') return sum + (i.finalAmount / 2);
      return sum + i.finalAmount;
    }, 0);
  const q2Variable = currentMonthVariables
    .filter((i) => i.fortnight === 'q2')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalQ2 = q2Fixed + q2Variable;

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
    setFixedNotes(fi.notes || '');
    setIsFixedCategoryDropdownOpen(false);
    setIsFixedPaymentDropdownOpen(false);
    setIsFixedModalOpen(true);
  };

  const handleSaveFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    const numInput = fixedAmount;
    if (!fixedName.trim() || isNaN(numInput) || numInput <= 0) return;

    let finalAmountUSD = numInput;
    let finalCurrency: 'USD' | 'VES' | 'EUR' = 'USD';

    if (fixedPaymentMode === 'ves_fixed') {
      finalCurrency = 'VES';
      finalAmountUSD = Number((numInput / bcvUsd).toFixed(2));
    } else if (fixedPaymentMode === 'ves_euro') {
      finalCurrency = 'EUR';
      finalAmountUSD = Number(((numInput * bcvEur) / bcvUsd).toFixed(2));
    } else {
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
    setVarFortnight('q1');
    setVarCategoryId(incomeCategories.find(c => c.id === 'cat_extras')?.id || incomeCategories[0]?.id || 'cat_extras');
    setVarAccountId(accounts[0]?.id || '');
    setVarNotes('');
    setIsVarCategoryDropdownOpen(false);
    setIsVarModalOpen(true);
  };

  const handleOpenEditVar = (vi: VariableIncome) => {
    setEditingVar(vi);
    setVarDescription(vi.description);
    setVarAmount(vi.amount || 0);
    setVarFortnight(vi.fortnight);
    setVarCategoryId(vi.category_id || 'cat_extras');
    setVarAccountId(vi.account_id || accounts[0]?.id || '');
    setVarNotes(vi.notes || '');
    setIsVarCategoryDropdownOpen(false);
    setIsVarModalOpen(true);
  };

  const handleSaveVar = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = varAmount;
    if (!varDescription.trim() || isNaN(num) || num <= 0) return;

    await saveVariableIncome({
      id: editingVar?.id,
      description: varDescription.trim(),
      amount: num,
      year: selectedYear,
      month: selectedMonth,
      fortnight: varFortnight,
      category_id: varCategoryId,
      account_id: varAccountId,
      currency: 'USD',
      notes: varNotes,
    });

    setIsVarModalOpen(false);
  };

  const handleDeleteVar = async (id: string) => {
    if (window.confirm('¿Deseas eliminar este registro de ingreso variable?')) {
      await deleteVariableIncome(id);
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

          <MonthPicker
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={onChangePeriod}
          />
        </div>

        {/* Tab Selector: Fijos vs Variables */}
        <div className="flex items-center p-1 bg-card rounded-2xl border border-app max-w-md mx-auto sm:mx-0">
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Total Mes</span>
          <p className="text-lg sm:text-xl font-black text-primary-custom mt-1">
            {currency}{totalCombinedIncome.toFixed(2)}
          </p>
          <span className="text-[10px] text-muted block mt-0.5">
            En {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Ingresos Fijos</span>
          <p className="text-lg sm:text-xl font-black text-[#00C2C7] mt-1">
            {currency}{totalMonthlyFixed.toFixed(2)}
          </p>
          <span className="text-[10px] text-muted block mt-0.5">
            Sueldo, tickets, etc.
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-surface border border-app shadow-sm">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Ingresos Variables</span>
          <p className="text-lg sm:text-xl font-black text-[#FF914D] mt-1">
            {currency}{totalMonthlyVariable.toFixed(2)}
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
              <span className="text-app">{currency}{totalQ1.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Q30:</span>
              <span className="text-app">{currency}{totalQ2.toFixed(2)}</span>
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
            <button
              onClick={handleOpenAddFixed}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Ingreso Fijo
            </button>
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
                const isVes = fi.currency === 'VES' || fi.payment_mode === 'ves_fixed';
                const isEur = fi.currency === 'EUR' || fi.payment_mode === 'ves_euro';

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
                              {fi.default_fortnight === 'split' && `Dividido 50/50 (${currency}${(fi.finalAmount / 2).toFixed(2)} c/u)`}
                              {fi.default_fortnight === 'both' && `Ambas Quincenas (${currency}${fi.finalAmount.toFixed(2)} c/u)`}
                            </span>
                            {fi.payment_mode && (
                              <span className="text-[10px] text-muted">
                                {fi.payment_mode === 'ves_bcv' && '🏛️ BCV'}
                                {fi.payment_mode === 'ves_fixed' && '🇻🇪 Bs'}
                                {fi.payment_mode === 'ves_euro' && '💶 Euro'}
                                {fi.payment_mode === 'usd_cash' && '💵 Cash'}
                                {fi.payment_mode === 'ves_parallel' && '⚡ Paralelo'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {isVes ? (
                          <>
                            <span className="text-base font-black text-[#00C2C7]">
                              +Bs. {(fi.original_amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-muted block">
                              ≈ {currency}{fi.finalAmount.toFixed(2)} USD
                            </span>
                          </>
                        ) : isEur ? (
                          <>
                            <span className="text-base font-black text-[#00C2C7]">
                              +€{(fi.original_amount || 0).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted block">
                              ≈ {currency}{fi.finalAmount.toFixed(2)} USD
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-base font-black text-[#00C2C7]">
                              +{currency}{fi.finalAmount.toFixed(2)}
                            </span>
                            {rates?.bcvDollar ? (
                              <span className="text-[10px] text-muted block">
                                ≈ Bs. {(fi.finalAmount * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <button
              onClick={handleOpenAddVar}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Ingreso Extra
            </button>
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
                return (
                  <div
                    key={vi.id}
                    className="p-4 rounded-3xl bg-surface border border-app shadow-md hover:border-[#FF914D] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: category?.color || '#FF914D' }}
                        >
                          <CategoryIcon iconName={category?.icon || 'Sparkles'} size={20} className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-app">{vi.description}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span className="px-2 py-0.5 rounded bg-card text-[10px] font-semibold text-app">
                              {vi.fortnight === 'q1'
                                ? `Quincena 15 de ${MONTH_NAMES[selectedMonth]}`
                                : `Quincena 30 de ${MONTH_NAMES[selectedMonth]}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-[#FF914D]">
                          +{currency}{vi.amount.toFixed(2)}
                        </span>
                        {rates?.bcvDollar ? (
                          <span className="text-[10px] text-muted block">
                            ≈ Bs. {(vi.amount * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-app text-xs">
                      <span className="text-muted text-[11px] truncate max-w-[200px]">
                        {vi.notes || 'Ingreso puntual registrado'}
                      </span>

                      <div className="flex items-center gap-1">
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
              {/* Nombre del Ingreso */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre del Ingreso
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sueldo, Bono..."
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Forma de Cobro: Custom Styled Dropdown */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Forma de Cobro
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
                    {fixedPaymentMode === 'usd_cash' && <><span className="text-base">💵</span><span>Dólar Cash (USD)</span></>}
                    {fixedPaymentMode === 'ves_bcv' && <><span className="text-base">🏛️</span><span>Bolívar (Tasa BCV)</span></>}
                    {fixedPaymentMode === 'ves_euro' && <><span className="text-base">💶</span><span>Euro BCV (€/Bs)</span></>}
                    {fixedPaymentMode === 'ves_fixed' && <><span className="text-base">🇻🇪</span><span>Bolívar (Monto Fijo Bs)</span></>}
                    {fixedPaymentMode === 'ves_parallel' && <><span className="text-base">⚡</span><span>Bolívar (Paralelo)</span></>}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>

                {isFixedPaymentDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsFixedPaymentDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-52 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {[
                        { id: 'usd_cash' as const, icon: '💵', label: 'Dólar Cash (USD)' },
                        { id: 'ves_bcv' as const, icon: '🏛️', label: 'Bolívar (Tasa BCV)' },
                        { id: 'ves_euro' as const, icon: '💶', label: 'Euro BCV (€/Bs)' },
                        { id: 'ves_fixed' as const, icon: '🇻🇪', label: 'Bolívar (Monto Fijo Bs)' },
                        { id: 'ves_parallel' as const, icon: '⚡', label: 'Bolívar (Paralelo)' },
                      ].map((opt) => (
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

              {/* Monto con conversiones dinámicas */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  {fixedPaymentMode === 'ves_fixed' ? 'Monto Total en Bolívares (Bs.)' : fixedPaymentMode === 'ves_euro' ? 'Monto Total en Euros (€)' : 'Monto Total en Dólares ($ USD)'}
                </label>
                <MoneyInput
                  value={fixedAmount}
                  onChange={setFixedAmount}
                  currencySymbol={fixedPaymentMode === 'ves_fixed' ? 'Bs' : fixedPaymentMode === 'ves_euro' ? '€' : '$'}
                  placeholder="0,00"
                  required
                  className="!py-2.5 !text-sm font-black"
                />

                {/* Sub-indicador de conversión en vivo */}
                <div className="mt-1 text-[11px] text-muted flex items-center justify-between px-1">
                  {fixedPaymentMode === 'ves_fixed' && (
                    <span>≈ ${(fixedAmount / bcvUsd).toFixed(2)} USD (Tasa BCV: {bcvUsd.toFixed(2)})</span>
                  )}
                  {fixedPaymentMode === 'ves_euro' && (
                    <span>≈ ${((fixedAmount * bcvEur) / bcvUsd).toFixed(2)} USD (Tasa EUR: {bcvEur.toFixed(2)})</span>
                  )}
                  {(fixedPaymentMode === 'usd_cash' || fixedPaymentMode === 'ves_bcv') && rates?.bcvDollar ? (
                    <span>≈ Bs. {(fixedAmount * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: {bcvUsd.toFixed(2)})</span>
                  ) : null}
                  {fixedPaymentMode === 'ves_parallel' && rates?.parallelDollar ? (
                    <span>≈ Bs. {(fixedAmount * parallelUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Paralelo: {parallelUsd.toFixed(2)})</span>
                  ) : null}
                </div>
              </div>

              {/* Distribución de Sueldo con botones compactos */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Distribución de Sueldo
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
                    💡 Cobrarás ${(fixedAmount / 2).toFixed(2)} el día 15 y ${(fixedAmount / 2).toFixed(2)} el día 30 (Total mensual: ${fixedAmount.toFixed(2)}).
                  </p>
                )}
              </div>

              {/* Categoría: Custom Styled Dropdown con Iconos Lucide */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Categoría
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

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
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
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre del Ingreso Extra
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Freelance, Bono, Guardia..."
                  value={varDescription}
                  onChange={(e) => setVarDescription(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Monto ($ USD)
                  </label>
                  <MoneyInput
                    value={varAmount}
                    onChange={setVarAmount}
                    currencySymbol="$"
                    placeholder="0,00"
                    required
                    className="!py-2 !text-sm"
                  />
                  {rates?.bcvDollar && varAmount > 0 ? (
                    <span className="text-[10px] text-muted block mt-1">
                      ≈ Bs. {(varAmount * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : null}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Quincena Asignada
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-card rounded-xl border border-app">
                    {[
                      { id: 'q1' as const, label: `Q15 (${MONTH_NAMES[selectedMonth].substring(0, 3)})` },
                      { id: 'q2' as const, label: `Q30 (${MONTH_NAMES[selectedMonth].substring(0, 3)})` },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setVarFortnight(opt.id)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                          varFortnight === opt.id
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-muted hover:text-app'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categoría: Custom Styled Dropdown con Iconos Lucide */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Categoría
                </label>
                <button
                  type="button"
                  onClick={() => setIsVarCategoryDropdownOpen(!isVarCategoryDropdownOpen)}
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

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Cuenta Destino
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1 no-scrollbar">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setVarAccountId(acc.id)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        varAccountId === acc.id
                          ? 'border-primary-custom bg-card ring-2 ring-primary-custom text-app'
                          : 'border-app bg-card/60 text-muted hover:text-app'
                      }`}
                    >
                      <span className="truncate">{acc.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-muted uppercase">
                        {acc.currency}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={varNotes}
                  onChange={(e) => setVarNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

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
    </div>
  );
};
