import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import type { Category, Account, TransactionType, FortnightType } from '../types/index.ts';
import { CategoryIcon } from './CategoryIcon.tsx';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  initialType?: TransactionType;
  onSubmit: (data: {
    amount: number;
    type: TransactionType;
    description: string;
    category_id: string;
    account_id: string;
    transaction_date: string;
  }) => Promise<void>;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  categories,
  accounts,
  initialType = 'expense',
  onSubmit,
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedFortnight, setSelectedFortnight] = useState<FortnightType>('q1');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setType(initialType);
  }, [initialType, isOpen]);

  // Compute smart fortnight from date
  const computeFortnightFromDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    const day = parseInt(parts[2], 10) || 1;
    return day <= 15 ? 'q1' : 'q2';
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSelectedFortnight(computeFortnightFromDate(newDate));
  };

  // Filter categories by selected transaction type
  const availableCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (availableCategories.length > 0 && (!categoryId || !availableCategories.some((c) => c.id === categoryId))) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, categories]);

  useEffect(() => {
    if (accounts.length > 0 && (!accountId || !accounts.some((a) => a.id === accountId))) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Por favor ingresa un monto válido mayor a 0');
      return;
    }

    if (!categoryId) {
      setError('Por favor selecciona una categoría');
      return;
    }

    if (!accountId) {
      setError('Por favor selecciona una cuenta');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        amount: parsedAmount,
        type,
        description: description.trim() || (type === 'expense' ? 'Gasto' : 'Ingreso'),
        category_id: categoryId,
        account_id: accountId,
        transaction_date: date || new Date().toISOString().split('T')[0],
      });

      setAmount(0);
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentMonthIdx = parseInt(date.split('-')[1], 10) - 1 || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-surface border border-app rounded-t-3xl sm:rounded-3xl shadow-2xl text-app max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fijo y limpio en bordes redondeados */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-app shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold relative shadow-inner ${
                type === 'expense'
                  ? 'bg-[#FF914D]/20 text-[#FF914D]'
                  : 'bg-[#00C2C7]/20 text-[#00C2C7]'
              }`}
            >
              {type === 'expense' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-app">
                {type === 'expense' ? 'Registrar Egreso / Gasto' : 'Registrar Ingreso'}
              </h3>
              <p className="text-[11px] text-muted">
                {type === 'expense' ? 'Afectará tu balance de cuentas' : 'Suma capital disponible a tus cuentas'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scrollbar contenido */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
          {error && (
            <div className="mb-4 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-2xl font-semibold">
              {error}
            </div>
          )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type Tabs */}
          <div className="grid grid-cols-2 p-1 bg-card rounded-2xl border border-app">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                type === 'expense'
                  ? 'bg-[#FF914D] text-white shadow-md'
                  : 'text-muted hover:text-app'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                type === 'income'
                  ? 'bg-[#00C2C7] text-slate-950 shadow-md'
                  : 'text-muted hover:text-app'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Ingreso
            </button>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Monto a Registrar
            </label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              currencySymbol="$"
              placeholder="0,00"
              autoFocus
              required
              className="!py-3 !text-2xl !font-black !bg-card !border-app !text-app"
            />
          </div>

          {/* Category Selector with chips/icons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-muted">
                Categoría ({availableCategories.length})
              </label>
              <span className="text-[10px] text-muted font-semibold">
                Selecciona el concepto
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1 no-scrollbar">
              {availableCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary-custom bg-primary-custom/15 text-app ring-2 ring-primary-custom shadow-md font-bold'
                        : 'border-app bg-card text-muted hover:bg-surface hover:text-app'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center mb-1 text-white shadow-sm"
                      style={{ backgroundColor: cat.color }}
                    >
                      <CategoryIcon iconName={cat.icon} size={14} className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted">
              Cuenta de fondos / Destino
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1 no-scrollbar">
              {accounts.map((acc) => {
                const isSelected = accountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccountId(acc.id)}
                    className={`p-2.5 rounded-2xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-primary-custom bg-primary-custom/15 text-app ring-2 ring-primary-custom shadow-sm font-bold'
                        : 'border-app bg-card text-muted hover:text-app hover:bg-surface'
                    }`}
                  >
                    <span className="truncate">{acc.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface border border-app text-muted uppercase font-black">
                      {acc.currency}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Smart Fortnight Assignment (Exact layout of AddPaymentModal) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Fecha del Movimiento
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Asignar a Quincena
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-card rounded-xl border border-app">
                  {[
                    { id: 'q1' as const, label: 'Quincena 15' },
                    { id: 'q2' as const, label: 'Quincena 30' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedFortnight(opt.id)}
                      className={`py-1 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        selectedFortnight === opt.id
                          ? type === 'expense'
                            ? 'bg-[#FF914D] text-white shadow-sm'
                            : 'bg-primary-custom text-white shadow-sm'
                          : 'text-muted hover:text-app'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#00C2C7] bg-[#00C2C7]/10 border border-[#00C2C7]/20 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                Asignado a {selectedFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'} de {MONTH_NAMES[currentMonthIdx]}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Descripción / Concepto (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Supermercado, Almuerzo, Uber..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary-custom"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface text-app text-xs font-bold transition-all cursor-pointer border border-app"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className={`flex-1 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 ${
                type === 'expense'
                  ? 'bg-[#FF914D]'
                  : 'bg-primary-custom'
              }`}
            >
              {isSubmitting ? 'Guardando...' : type === 'expense' ? 'Confirmar Gasto' : 'Confirmar Ingreso'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
