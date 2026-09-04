import React, { useState, useEffect } from 'react';
import { X, Sparkles, ChevronDown } from 'lucide-react';
import type {
  VariableExpense,
  Category,
  Account,
  ExchangeRatesData,
  FixedExpensePaymentMode,
  FortnightType,
} from '../types/index.ts';
import { saveVariableExpense } from '../lib/db.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';
import { logger } from '../utils/logger.ts';
import { CategoryIcon } from './CategoryIcon.tsx';

interface AddVariableExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingExpense?: VariableExpense | null;
  categories: Category[];
  accounts: Account[];
  rates?: ExchangeRatesData;
  selectedYear: number;
  selectedMonth: number;
  onSaved?: (expense: VariableExpense) => void;
}

const PAYMENT_MODES_LIST: { id: FixedExpensePaymentMode; label: string; sub: string }[] = [
  { id: 'usd_cash', label: 'Efectivo / Divisas ($)', sub: 'Billetes USD en físico' },
  { id: 'ves_bcv', label: 'Tasa BCV Oficial', sub: 'Monto fijado en USD, pagado en Bs al BCV' },
  { id: 'ves_fixed', label: 'Bolívares Fijos', sub: 'Monto fijo en Bs' },
  { id: 'eur_cash', label: 'Euros (€)', sub: 'Monto fijado en EUR' },
  { id: 'ves_euro', label: 'Euros a Tasa BCV', sub: 'Calculado con tasa oficial EUR/BCV' },
];

export const AddVariableExpenseModal: React.FC<AddVariableExpenseModalProps> = ({
  isOpen,
  onClose,
  editingExpense,
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
  const [varCategoryId, setVarCategoryId] = useState<string>('cat_food');
  const [varAccountId, setVarAccountId] = useState<string>('');
  const [varNotes, setVarNotes] = useState<string>('');
  const [isVarCategoryDropdownOpen, setIsVarCategoryDropdownOpen] = useState<boolean>(false);
  const [isVarPaymentDropdownOpen, setIsVarPaymentDropdownOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const bcvUsd = rates?.bcvDollar || 1;
  const bcvEur = rates?.bcvEuro || 1;
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  useEffect(() => {
    if (editingExpense) {
      setVarDescription(editingExpense.description);
      setVarAmount(
        editingExpense.original_amount !== undefined ? editingExpense.original_amount : editingExpense.amount
      );
      setVarPaymentMode(editingExpense.payment_mode || 'usd_cash');
      setVarFortnight(editingExpense.fortnight || 'q1');
      setVarCategoryId(editingExpense.category_id || 'cat_food');
      setVarAccountId(editingExpense.account_id || '');
      setVarNotes(editingExpense.notes || '');
    } else {
      setVarDescription('');
      setVarAmount(0);
      setVarPaymentMode('usd_cash');
      setVarFortnight(new Date().getDate() <= 15 ? 'q1' : 'q2');
      setVarCategoryId('cat_food');
      setVarAccountId(accounts.length > 0 ? accounts[0].id : '');
      setVarNotes('');
    }
    setIsVarCategoryDropdownOpen(false);
    setIsVarPaymentDropdownOpen(false);
  }, [editingExpense, isOpen, accounts]);

  if (!isOpen) return null;

  const handleSaveVar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varDescription.trim() || varAmount <= 0) return;

    setIsSubmitting(true);
    try {
      let derivedCurrency = 'USD';
      if (varPaymentMode === 'ves_fixed') derivedCurrency = 'VES';
      else if (varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro') derivedCurrency = 'EUR';

      let usdEquivalent = varAmount;
      if (varPaymentMode === 'ves_fixed') {
        usdEquivalent = Number((varAmount / bcvUsd).toFixed(2));
      } else if (derivedCurrency === 'EUR' || varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro') {
        usdEquivalent = Number(((varAmount * bcvEur) / bcvUsd).toFixed(2));
      }

      const saved = await saveVariableExpense({
        id: editingExpense ? editingExpense.id : undefined,
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

      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      logger.error('Error saving variable expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-app rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fijo arriba */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-app shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF914D]" />
            <h3 className="text-base font-black text-app">
              {editingExpense ? 'Editar Gasto Variable' : 'Nuevo Gasto Variable'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scrollbar interno seguro */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
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
              currencySymbol={
                varPaymentMode === 'ves_fixed'
                  ? 'Bs.'
                  : varPaymentMode === 'eur_cash' || varPaymentMode === 'ves_euro'
                  ? '€'
                  : '$'
              }
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
          <div className="relative">
            <label className="block text-xs font-bold text-muted mb-1">
              Categoría <span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={() => setIsVarCategoryDropdownOpen(!isVarCategoryDropdownOpen)}
              className="w-full bg-card hover:bg-surface-hover border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
            >
              <div className="flex items-center gap-2 truncate">
                {(() => {
                  const selectedCat = expenseCategories.find((c) => c.id === varCategoryId);
                  if (selectedCat) {
                    return (
                      <>
                        <span className="text-primary-custom flex items-center shrink-0">
                          <CategoryIcon iconName={selectedCat.icon} size={16} />
                        </span>
                        <span className="truncate">{selectedCat.name}</span>
                      </>
                    );
                  }
                  return (
                    <>
                      <span className="text-primary-custom flex items-center shrink-0">
                        <CategoryIcon iconName="ShoppingCart" size={16} />
                      </span>
                      <span className="truncate">Selecciona Categoría</span>
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
                  {expenseCategories && expenseCategories.length > 0 ? (
                    expenseCategories.map((cat) => (
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
                        <span className={`flex items-center shrink-0 ${varCategoryId === cat.id ? 'text-white' : 'text-primary-custom'}`}>
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

          {/* Cuenta / Fondo a debitar */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-muted mb-1">
                Cuenta / Fondo a debitar (Opcional)
              </label>
              <select
                value={varAccountId}
                onChange={(e) => setVarAccountId(e.target.value)}
                className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs font-bold text-app focus:outline-none focus:ring-2 focus:ring-primary-custom cursor-pointer"
              >
                <option value="">Sin debitar cuenta automáticamente</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-card hover:bg-surface border border-app text-xs font-bold text-muted hover:text-app cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-primary-custom text-white text-xs font-black shadow-lg hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Guardando...' : editingExpense ? 'Actualizar Gasto Variable' : 'Guardar Gasto Variable'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
