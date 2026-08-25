import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { FixedExpense, MonthlyFixedOverride, Category, ExchangeRatesData, FixedExpensePaymentMode } from '../types/index.ts';
import { saveFixedExpense, deleteFixedExpense, toggleMonthlyFixedOverride } from '../lib/db.ts';
import { CategoryIcon } from './CategoryIcon.tsx';
import { MonthPicker } from './MonthPicker.tsx';
import { formatCurrencyVE } from '../utils/numberFormat.ts';
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

interface FixedExpensesModuleProps {
  fixedExpenses: FixedExpense[];
  monthlyOverrides: MonthlyFixedOverride[];
  categories: Category[];
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
  monthlyOverrides,
  categories,
  selectedYear,
  selectedMonth,
  onChangePeriod,
  rates,
  currency = '$',
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<FixedExpensePaymentMode>('ves_bcv');
  const [defaultFortnight, setDefaultFortnight] = useState<'q1' | 'q2' | 'both'>('q1');
  const [categoryId, setCategoryId] = useState<string>('cat_services');
  const [notes, setNotes] = useState<string>('');

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const bcvUsd = rates?.bcvDollar && rates.bcvDollar > 0 ? rates.bcvDollar : 1;
  const bcvEur = rates?.bcvEuro && rates.bcvEuro > 0 ? rates.bcvEuro : 1;
  const parallelUsd = rates?.parallelDollar && rates.parallelDollar > 0 ? rates.parallelDollar : bcvUsd;

  // Map monthly overrides
  const overrideMap = new Map(
    monthlyOverrides
      .filter((o) => o.year === selectedYear && o.month === selectedMonth)
      .map((o) => [o.fixed_expense_id, o])
  );

  // Compute active costs for this month
  const processedExpenses = fixedExpenses.map((fe) => {
    const override = overrideMap.get(fe.id);
    const isActive = override?.is_active !== undefined ? override.is_active : fe.is_active;
    const isAssumed = override?.assumed_by_third_party !== undefined ? override.assumed_by_third_party : (fe.assumed_by_third_party || false);

    // Normalize payment mode
    let mode: FixedExpensePaymentMode = fe.payment_mode || 'ves_bcv';
    if (mode === 'bcv_usd') mode = 'ves_bcv';
    else if (mode === 'fixed_ves') mode = 'ves_fixed';
    else if (mode === 'cash') mode = 'usd_cash';
    else if (mode === 'bcv_eur') mode = 'ves_euro';
    else if (mode === 'parallel_ves') mode = 'ves_parallel';

    const rawCurrency = fe.currency || (mode === 'ves_fixed' || mode === 'ves_bcv' || mode === 'ves_parallel' || mode === 'ves_euro' ? 'VES' : mode === 'eur_cash' ? 'EUR' : 'USD');
    const origAmt = fe.original_amount !== undefined ? fe.original_amount : (fe.amount_in_ves !== undefined ? fe.amount_in_ves : fe.amount);

    // Compute USD amount (for calculation & balance)
    let usdEquivalent = 0;
    if (mode === 'ves_parallel') {
      usdEquivalent = Number((origAmt / parallelUsd).toFixed(2));
    } else if (rawCurrency === 'VES' || mode === 'ves_fixed' || mode === 'ves_bcv' || mode === 'ves_euro') {
      usdEquivalent = Number((origAmt / bcvUsd).toFixed(2));
    } else if (rawCurrency === 'EUR' || mode === 'eur_cash') {
      usdEquivalent = Number(((origAmt * bcvEur) / bcvUsd).toFixed(2));
    } else {
      usdEquivalent = Number(origAmt.toFixed(2));
    }

    const finalAmountUSD = override?.custom_amount !== undefined ? override.custom_amount : usdEquivalent;

    return {
      ...fe,
      payment_mode: mode,
      currency: rawCurrency,
      original_amount: origAmt,
      amount_usd: finalAmountUSD,
      isActive,
      finalAmount: finalAmountUSD,
      isAssumed,
    };
  });

  const totalMonthlyCommitment = processedExpenses
    .filter((e) => e.isActive && !e.isAssumed)
    .reduce((sum, e) => sum + e.finalAmount, 0);

  const q1Commitment = processedExpenses
    .filter((e) => e.isActive && !e.isAssumed && (e.default_fortnight === 'q1' || e.default_fortnight === 'both'))
    .reduce((sum, e) => sum + e.finalAmount, 0);

  const q2Commitment = processedExpenses
    .filter((e) => e.isActive && !e.isAssumed && (e.default_fortnight === 'q2' || e.default_fortnight === 'both'))
    .reduce((sum, e) => sum + e.finalAmount, 0);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setName('');
    setAmount(0);
    setPaymentMode('usd_cash');
    setDefaultFortnight('q1');
    setCategoryId(expenseCategories[0]?.id || 'cat_services');
    setNotes('');
    setIsCategoryDropdownOpen(false);
    setIsPaymentDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (expense: typeof processedExpenses[0]) => {
    setEditingExpense(expense);
    setName(expense.name);
    setPaymentMode(expense.payment_mode || 'usd_cash');
    // Load exact original native amount (e.g. 70000 Bs, NOT 89.74 USD)
    const exactOriginal = expense.original_amount !== undefined ? expense.original_amount : expense.finalAmount;
    setAmount(exactOriginal || 0);
    setDefaultFortnight(expense.default_fortnight);
    setCategoryId(expense.category_id);
    setNotes(expense.notes || '');
    setIsCategoryDropdownOpen(false);
    setIsPaymentDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numInput = amount;
    if (!name.trim() || isNaN(numInput) || numInput <= 0) return;

    let finalAmountUSD = numInput;
    let finalCurrency: 'USD' | 'VES' | 'EUR' = 'USD';

    if (paymentMode === 'ves_parallel') {
      finalCurrency = 'VES';
      finalAmountUSD = Number((numInput / parallelUsd).toFixed(2));
    } else if (paymentMode === 'ves_fixed' || paymentMode === 'ves_bcv' || paymentMode === 'ves_euro') {
      finalCurrency = 'VES';
      finalAmountUSD = Number((numInput / bcvUsd).toFixed(2));
    } else if (paymentMode === 'eur_cash') {
      finalCurrency = 'EUR';
      finalAmountUSD = Number(((numInput * bcvEur) / bcvUsd).toFixed(2));
    } else {
      finalCurrency = 'USD';
      finalAmountUSD = Number(numInput.toFixed(2));
    }

    await saveFixedExpense({
      id: editingExpense?.id,
      name: name.trim(),
      amount: finalAmountUSD,
      amount_usd: finalAmountUSD,
      original_amount: numInput,
      amount_in_ves: paymentMode === 'ves_fixed' ? numInput : undefined,
      currency: finalCurrency,
      payment_mode: paymentMode,
      default_fortnight: defaultFortnight,
      category_id: categoryId,
      notes,
    });

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este gasto fijo?')) {
      await deleteFixedExpense(id);
    }
  };

  const handleToggleActive = async (expense: typeof processedExpenses[0]) => {
    await toggleMonthlyFixedOverride(
      expense.id,
      selectedYear,
      selectedMonth,
      !expense.isActive,
      expense.finalAmount,
      false
    );
  };

  const numEntered = amount;

  return (
    <div className="space-y-4">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-3xl bg-surface border border-app shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-app">Gastos Fijos</h3>
          </div>
          <p className="text-xs text-muted mt-1">
            Periodo: <strong>{MONTH_NAMES[selectedMonth]} {selectedYear}</strong> • Activa o pausa gastos para este período
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
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nuevo Gasto Fijo
          </button>
        </div>
      </div>

      {/* KPI Cards: Resumen de Compromisos del Mes con Conversión Dual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* Total General */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-muted">Compromiso Total del Mes</span>
          <p className="text-lg sm:text-2xl font-black text-app">
            {currency}{totalMonthlyCommitment.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted font-medium block">
            ≈ Bs. {(totalMonthlyCommitment * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV)
          </span>
        </div>

        {/* Quincena 15 */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-[#00C2C7]">Quincena 15</span>
          <p className="text-lg sm:text-2xl font-black text-[#00C2C7]">
            {currency}{q1Commitment.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted font-medium block">
            ≈ Bs. {(q1Commitment * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Quincena 30 */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] sm:text-xs font-semibold text-[#FF914D]">Quincena 30</span>
          <p className="text-lg sm:text-2xl font-black text-[#FF914D]">
            {currency}{q2Commitment.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted font-medium block">
            ≈ Bs. {(q2Commitment * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* List of Fixed Expenses */}
      {processedExpenses.length === 0 ? (
        <div className="p-8 rounded-3xl bg-surface border border-app text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary-custom/15 text-primary-custom flex items-center justify-center mx-auto">
            <Receipt className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-app">No hay gastos fijos registrados</h4>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Crea tu plantilla recurrente de servicios, alquiler, suscripciones o compras mensuales.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 cursor-pointer"
          >
            + Agregar Primer Gasto Fijo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {processedExpenses.map((expense) => {
            const cat = categories.find((c) => c.id === expense.category_id);
            const isVes = expense.currency === 'VES' || expense.payment_mode === 'ves_fixed' || expense.payment_mode === 'ves_bcv' || expense.payment_mode === 'ves_parallel' || expense.payment_mode === 'ves_euro';
            const isEur = expense.currency === 'EUR' || expense.payment_mode === 'eur_cash';

            return (
              <div
                key={expense.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-3 ${
                  !expense.isActive
                    ? 'bg-surface/50 border-app opacity-60'
                    : expense.isAssumed
                    ? 'bg-surface border-emerald-500/40 shadow-sm'
                    : 'bg-surface border-app shadow-sm hover:border-primary-custom/50'
                }`}
              >
                {/* Card Top: Icon, Name & Fortnight Tag + Currency-aware Dual Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: cat?.color || '#147df0' }}
                    >
                      <CategoryIcon iconName={cat?.icon || 'Receipt'} className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-app line-clamp-1">{expense.name}</h4>
                      <span className="text-[10px] text-muted font-medium block">
                        {cat?.name || 'Varios'} •{' '}
                        <strong className="text-app">
                          {expense.default_fortnight === 'q1'
                            ? 'Quincena 15'
                            : expense.default_fortnight === 'q2'
                            ? 'Quincena 30'
                            : 'Ambas Quincenas'}
                        </strong>
                        {expense.payment_mode && (
                          <span className="text-muted ml-1">
                            • {expense.payment_mode === 'usd_cash' && '💵 CASH USD'}
                            {expense.payment_mode === 'eur_cash' && '💶 CASH EURO'}
                            {expense.payment_mode === 'ves_bcv' && '🏛️ DOLAR BCV'}
                            {expense.payment_mode === 'ves_euro' && '🇪🇺 EURO BCV'}
                            {expense.payment_mode === 'ves_parallel' && '⚡ DOLAR PROMEDIO'}
                            {expense.payment_mode === 'ves_fixed' && '🇻🇪 Bolivar Fijo'}
                            {expense.payment_mode === 'other' && '🌐 OTROS'}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Dual Amount with Proper Hierarchy according to native currency */}
                  <div className="text-right shrink-0">
                    {isVes ? (
                      <>
                        <p className={`text-base font-black ${expense.isActive ? 'text-[#FF914D]' : 'text-muted'}`}>
                          Bs. {expense.original_amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="text-[11px] text-muted font-semibold block text-right">
                          ≈ ${expense.amount_usd.toFixed(2)} USD
                        </span>
                      </>
                    ) : isEur ? (
                      <>
                        <p className={`text-base font-black ${expense.isActive ? 'text-purple-400' : 'text-muted'}`}>
                          € {expense.original_amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="text-[11px] text-muted font-semibold block text-right">
                          ≈ Bs. {(expense.original_amount * bcvEur).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    ) : (
                      <>
                        <p className={`text-base font-black ${expense.isActive ? 'text-app' : 'text-muted'}`}>
                          ${expense.amount_usd.toFixed(2)}
                        </p>
                        <span className="text-[11px] text-muted font-semibold block text-right">
                          ≈ Bs. {(expense.amount_usd * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Switches & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-app text-xs">
                  {/* Switch Activar/Pausar este mes */}
                  <button
                    onClick={() => handleToggleActive(expense)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                      expense.isActive
                        ? 'bg-primary-custom/15 text-primary-custom hover:bg-primary-custom/25'
                        : 'bg-card text-muted hover:text-app'
                    }`}
                    title={expense.isActive ? 'Gasto activo este mes. Clic para pausar' : 'Gasto pausado este mes. Clic para activar'}
                  >
                    {expense.isActive ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary-custom" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-muted" />
                    )}
                    <span>{expense.isActive ? 'Activo' : 'Pausado'}</span>
                  </button>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(expense)}
                      className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-card transition-colors cursor-pointer"
                      title="Editar regla base"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-[#ef4444] hover:bg-card transition-colors cursor-pointer"
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

      {/* Add / Edit Fixed Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[92vh] overflow-y-auto animate-in zoom-in-95 no-scrollbar">
            <h3 className="text-base font-bold mb-4">
              {editingExpense ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo Recurrente'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nombre del Gasto */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre del Gasto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Alquiler, Moto, Netflix..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Categoría: Custom Styled Dropdown */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Categoría de Gasto
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  <div className="flex items-center gap-2 truncate">
                    {(() => {
                      const selectedCat = expenseCategories.find((c) => c.id === categoryId);
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
                          <span className="text-primary-custom flex items-center">{renderIcon('Tag')}</span>
                          <span className="truncate">Seleccionar categoría</span>
                        </>
                      );
                    })()}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>

                {isCategoryDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsCategoryDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-52 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {expenseCategories && expenseCategories.length > 0 ? (
                        expenseCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategoryId(cat.id);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                              categoryId === cat.id
                                ? 'bg-primary-custom text-white shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span className={`flex items-center ${categoryId === cat.id ? 'text-white' : 'text-primary-custom'}`}>
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

              {/* Forma de Pago: Custom Styled Dropdown */}
              {/* Forma de Pago: Custom Styled Dropdown */}
              <div className="relative">
                <label className="block text-xs font-semibold text-muted mb-1">
                  Forma de Pago
                </label>
                <button
                  type="button"
                  onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                  className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                >
                  <div className="flex items-center gap-2 truncate">
                    {paymentMode === 'usd_cash' && <><span className="text-base">💵</span><span>CASH USD</span></>}
                    {paymentMode === 'eur_cash' && <><span className="text-base">💶</span><span>CASH EURO</span></>}
                    {paymentMode === 'ves_bcv' && <><span className="text-base">🏛️</span><span>DOLAR TASA BCV (BS)</span></>}
                    {paymentMode === 'ves_euro' && <><span className="text-base">🇪🇺</span><span>EURO TASA BCV (BS)</span></>}
                    {paymentMode === 'ves_parallel' && <><span className="text-base">⚡</span><span>DOLAR PROMEDIO (BS)</span></>}
                    {paymentMode === 'ves_fixed' && <><span className="text-base">🇻🇪</span><span>Bolivar (Monto Fijo)</span></>}
                    {paymentMode === 'other' && <><span className="text-base">🌐</span><span>OTROS</span></>}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                </button>
                {isPaymentDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsPaymentDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-56 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {[
                        { id: 'usd_cash' as const, icon: '💵', label: 'CASH USD' },
                        { id: 'eur_cash' as const, icon: '💶', label: 'CASH EURO' },
                        { id: 'ves_bcv' as const, icon: '🏛️', label: 'DOLAR TASA BCV (BS)' },
                        { id: 'ves_euro' as const, icon: '🇪🇺', label: 'EURO TASA BCV (BS)' },
                        { id: 'ves_parallel' as const, icon: '⚡', label: 'DOLAR PROMEDIO (BS)' },
                        { id: 'ves_fixed' as const, icon: '🇻🇪', label: 'Bolivar (Monto Fijo)' },
                        { id: 'other' as const, icon: '🌐', label: 'OTROS' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setPaymentMode(opt.id);
                            setIsPaymentDropdownOpen(false);
                          }}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            paymentMode === opt.id
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

              {/* Monto con cálculo dinámico e inverso */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  {paymentMode === 'usd_cash'
                    ? 'Monto en Dólares ($ USD)'
                    : paymentMode === 'eur_cash'
                    ? 'Monto en Euros (€ EUR)'
                    : paymentMode === 'ves_bcv'
                    ? 'Monto en Bolívares (DOLAR TASA BCV)'
                    : paymentMode === 'ves_euro'
                    ? 'Monto en Bolívares (EURO TASA BCV)'
                    : paymentMode === 'ves_parallel'
                    ? 'Monto en Bolívares (DOLAR PROMEDIO)'
                    : paymentMode === 'ves_fixed'
                    ? 'Monto Fijo en Bolívares (Bs.)'
                    : 'Monto ($ USD u Otra Divisa)'}
                </label>
                <MoneyInput
                  value={amount}
                  onChange={setAmount}
                  currencySymbol={
                    paymentMode === 'eur_cash'
                      ? '€'
                      : paymentMode === 'ves_bcv' || paymentMode === 'ves_euro' || paymentMode === 'ves_parallel' || paymentMode === 'ves_fixed'
                      ? 'Bs'
                      : '$'
                  }
                  placeholder="0,00"
                  required
                />

                {/* Mensaje de conversión reactiva */}
                {numEntered > 0 && (
                  <div className="mt-1 text-[11px] text-muted font-medium">
                    {paymentMode === 'usd_cash' && rates?.bcvDollar ? (
                      <span className="text-emerald-400">
                        ≈ Bs. {formatCurrencyVE(numEntered * bcvUsd)} (Tasa BCV: Bs. {formatCurrencyVE(bcvUsd)})
                      </span>
                    ) : paymentMode === 'eur_cash' ? (
                      <span className="text-purple-400">
                        ≈ ${((numEntered * bcvEur) / bcvUsd).toFixed(2)} USD (Tasa EUR: {bcvEur.toFixed(2)})
                      </span>
                    ) : paymentMode === 'ves_bcv' ? (
                      <span className="text-[#00C2C7]">
                        ≈ ${formatCurrencyVE(numEntered / bcvUsd)} USD (Tasa BCV: Bs. {formatCurrencyVE(bcvUsd)})
                      </span>
                    ) : paymentMode === 'ves_euro' ? (
                      <span className="text-purple-400">
                        ≈ ${formatCurrencyVE(numEntered / bcvUsd)} USD (Tasa BCV: Bs. {formatCurrencyVE(bcvUsd)}) • ≈ €{formatCurrencyVE(numEntered / bcvEur)} EUR
                      </span>
                    ) : paymentMode === 'ves_parallel' ? (
                      <span className="text-[#FF914D]">
                        ≈ ${formatCurrencyVE(numEntered / parallelUsd)} USD (Tasa Promedio: Bs. {formatCurrencyVE(parallelUsd)})
                      </span>
                    ) : paymentMode === 'ves_fixed' ? (
                      <span className="text-[#00C2C7]">
                        ≈ ${formatCurrencyVE(numEntered / bcvUsd)} USD (Ref. BCV: Bs. {formatCurrencyVE(bcvUsd)})
                      </span>
                    ) : (
                      <span className="text-primary-custom">
                        ≈ Bs. {formatCurrencyVE(numEntered * bcvUsd)} (Tasa BCV: Bs. {formatCurrencyVE(bcvUsd)})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Nomenclatura de Quincenas: Quincena 15, Quincena 30, Ambas Quincenas */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Quincena Asignada
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-card rounded-xl border border-app">
                  {[
                    { id: 'q1' as const, label: 'Quincena 15' },
                    { id: 'q2' as const, label: 'Quincena 30' },
                    { id: 'both' as const, label: 'Ambas Quincenas' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDefaultFortnight(opt.id)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                        defaultFortnight === opt.id
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'text-muted hover:text-app'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas / Detalles
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  {editingExpense ? 'Actualizar Gasto Fijo' : 'Guardar Gasto Fijo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
