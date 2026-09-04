import React, { useState, useEffect } from 'react';
import { X, Sparkles, ChevronDown, Wallet } from 'lucide-react';
import type {
  VariableIncome,
  Category,
  Account,
  ExchangeRatesData,
  FixedExpensePaymentMode,
  FortnightType,
} from '../types/index.ts';
import { saveVariableIncome } from '../lib/db.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';
import { CategoryIcon } from './CategoryIcon.tsx';
import { logger } from '../utils/logger.ts';

interface AddVariableIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingIncome?: VariableIncome | null;
  categories: Category[];
  accounts: Account[];
  rates?: ExchangeRatesData;
  selectedYear: number;
  selectedMonth: number;
  onSaved?: (income: VariableIncome) => void;
}

const PAYMENT_MODES_LIST: { id: FixedExpensePaymentMode; label: string; icon: string }[] = [
  { id: 'usd_cash', label: 'CASH USD', icon: '💵' },
  { id: 'ves_bcv', label: 'DOLAR TASA BCV (BS)', icon: '🏛️' },
  { id: 'ves_fixed', label: 'BOLIVARES MONTO FIJO', icon: '🇻🇪' },
  { id: 'eur_cash', label: 'CASH EURO', icon: '💶' },
  { id: 'ves_euro', label: 'EURO TASA BCV (BS)', icon: '🇪🇺' },
  { id: 'ves_parallel', label: 'DOLAR PROMEDIO (BS)', icon: '⚡' },
  { id: 'other', label: 'OTROS', icon: '🌐' },
];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const AddVariableIncomeModal: React.FC<AddVariableIncomeModalProps> = ({
  isOpen,
  onClose,
  editingIncome,
  categories,
  accounts,
  rates,
  selectedYear,
  selectedMonth,
  onSaved,
}) => {
  const [varDescription, setVarDescription] = useState<string>('');
  const [varAmount, setVarAmount] = useState<number>(0);
  const [varPaymentMode, setVarPaymentMode] = useState<FixedExpensePaymentMode>('usd_cash');
  const [varFortnight, setVarFortnight] = useState<FortnightType>('q1');
  const [varCategoryId, setVarCategoryId] = useState<string>('');
  const [varAccountId, setVarAccountId] = useState<string>('');
  const [varNotes, setVarNotes] = useState<string>('');
  const [isVarCategoryDropdownOpen, setIsVarCategoryDropdownOpen] = useState<boolean>(false);
  const [isVarPaymentDropdownOpen, setIsVarPaymentDropdownOpen] = useState<boolean>(false);
  const [isVarAccountDropdownOpen, setIsVarAccountDropdownOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const bcvUsd = rates?.bcvDollar || 1;
  const bcvEur = rates?.bcvEuro || 1;
  const parallelUsd = rates?.parallelDollar || rates?.bcvDollar || 1;
  const incomeCategories = categories.filter((c) => c.type === 'income');

  useEffect(() => {
    if (editingIncome) {
      setVarDescription(editingIncome.description);
      setVarAmount(
        editingIncome.original_amount !== undefined ? editingIncome.original_amount : editingIncome.amount
      );
      setVarPaymentMode(editingIncome.payment_mode || 'usd_cash');
      setVarFortnight(editingIncome.fortnight || 'q1');
      setVarCategoryId(editingIncome.category_id || (incomeCategories[0]?.id ?? ''));
      setVarAccountId(editingIncome.account_id || '');
      setVarNotes(editingIncome.notes || '');
    } else {
      setVarDescription('');
      setVarAmount(0);
      setVarPaymentMode('usd_cash');
      setVarFortnight(new Date().getDate() <= 15 ? 'q1' : 'q2');
      setVarCategoryId(incomeCategories[0]?.id ?? '');
      setVarAccountId('');
      setVarNotes('');
    }
    setIsVarCategoryDropdownOpen(false);
    setIsVarPaymentDropdownOpen(false);
    setIsVarAccountDropdownOpen(false);
  }, [editingIncome, isOpen, categories]);

  if (!isOpen) return null;

  const handleSaveVar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varDescription.trim() || varAmount <= 0) return;

    setIsSubmitting(true);
    try {
      let finalCurrency: 'USD' | 'VES' | 'EUR' = 'USD';
      let finalAmountUSD = varAmount;

      if (varPaymentMode === 'ves_fixed') {
        finalCurrency = 'VES';
        finalAmountUSD = Number((varAmount / bcvUsd).toFixed(2));
      } else if (varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro') {
        finalCurrency = 'EUR';
        finalAmountUSD = Number(((varAmount * bcvEur) / bcvUsd).toFixed(2));
      } else {
        finalCurrency = 'USD';
        finalAmountUSD = Number(varAmount.toFixed(2));
      }

      const saved = await saveVariableIncome({
        id: editingIncome ? editingIncome.id : undefined,
        description: varDescription.trim(),
        amount: finalAmountUSD,
        original_amount: varAmount,
        payment_mode: varPaymentMode,
        year: selectedYear,
        month: selectedMonth,
        fortnight: varFortnight,
        category_id: varCategoryId || incomeCategories[0]?.id || 'cat_extras',
        account_id: varAccountId || '',
        currency: finalCurrency,
        notes: varNotes.trim(),
      });

      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      logger.error('Error saving variable income:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCat = categories.find((c) => c.id === varCategoryId);
  const selectedAcc = accounts.find((a) => a.id === varAccountId);
  const monthNameShort = (MONTH_NAMES[selectedMonth] || 'Mes').substring(0, 3);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface border border-app rounded-t-3xl sm:rounded-3xl shadow-2xl text-app max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fijo arriba */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-app shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold relative shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">
                {editingIncome ? 'Editar Ingreso Extra' : 'Registrar Ingreso Variable / Extra'}
              </h3>
              <p className="text-[11px] text-muted">Ingreso complementario del mes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content con Scrollbar interno */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-3.5">
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
                className="w-full bg-card border border-app rounded-xl px-3.5 py-2.5 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
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
                  {selectedCat ? (
                    <>
                      <span className="text-[#00C2C7] flex items-center">
                        <CategoryIcon iconName={selectedCat.icon} size={16} />
                      </span>
                      <span className="truncate">{selectedCat.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[#00C2C7] flex items-center">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <span className="truncate">Seleccionar categoría</span>
                    </>
                  )}
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
                            <CategoryIcon iconName={cat.icon} size={16} />
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
                  {(() => {
                    const mode = PAYMENT_MODES_LIST.find((m) => m.id === varPaymentMode) || PAYMENT_MODES_LIST[0];
                    return (
                      <>
                        <span className="text-base">{mode.icon}</span>
                        <span>{mode.label}</span>
                      </>
                    );
                  })()}
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
                  <span>
                    ≈ Bs. {((varAmount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: {bcvUsd.toFixed(2)})
                  </span>
                ) : varPaymentMode === 'eur_cash' ? (
                  <span>
                    ≈ ${(((varAmount || 0) * bcvEur) / bcvUsd).toFixed(2)} USD (Tasa EUR: {bcvEur.toFixed(2)})
                  </span>
                ) : varPaymentMode === 'ves_euro' ? (
                  <span>
                    ≈ Bs. {((varAmount || 0) * bcvEur).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa EUR BCV: {bcvEur.toFixed(2)})
                  </span>
                ) : varPaymentMode === 'ves_parallel' && rates?.parallelDollar ? (
                  <span>
                    ≈ Bs. {((varAmount || 0) * parallelUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa Promedio: {parallelUsd.toFixed(2)})
                  </span>
                ) : varPaymentMode === 'ves_fixed' ? (
                  <span>
                    ≈ ${((varAmount || 0) / bcvUsd).toFixed(2)} USD (Referencia BCV: {bcvUsd.toFixed(2)})
                  </span>
                ) : varPaymentMode === 'other' && rates?.bcvDollar ? (
                  <span>
                    ≈ Bs. {((varAmount || 0) * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: {bcvUsd.toFixed(2)})
                  </span>
                ) : null}
              </div>
            </div>

            {/* 5. Quincena Asignada (Obligatorio) */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Quincena Asignada <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-card rounded-2xl border border-app">
                <button
                  type="button"
                  onClick={() => setVarFortnight('q1')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
                    varFortnight === 'q1'
                      ? 'bg-primary-custom text-white shadow-sm'
                      : 'text-muted hover:text-app hover:bg-surface-hover'
                  }`}
                >
                  Quincena 15 ({monthNameShort})
                </button>
                <button
                  type="button"
                  onClick={() => setVarFortnight('q2')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
                    varFortnight === 'q2'
                      ? 'bg-primary-custom text-white shadow-sm'
                      : 'text-muted hover:text-app hover:bg-surface-hover'
                  }`}
                >
                  Quincena 30 ({monthNameShort})
                </button>
              </div>
            </div>

            {/* 6. Cuenta Destino (Opcional) */}
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
                  {selectedAcc ? (
                    <>
                      <span className="text-primary-custom flex items-center">
                        <Wallet className="w-4 h-4" />
                      </span>
                      <span className="truncate">{selectedAcc.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-muted uppercase">
                        {selectedAcc.currency}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted flex items-center text-sm">🚫</span>
                      <span className="truncate text-muted">Ninguna</span>
                    </>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-muted shrink-0" />
              </button>

              {isVarAccountDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsVarAccountDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-60 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
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
                              <Wallet className="w-4 h-4" />
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
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !varDescription.trim() || varAmount <= 0}
                className="flex-1 py-2.5 rounded-xl bg-primary-custom hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Ingreso Extra'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
