import React, { useState, useEffect } from 'react';
import { X, Check, Calendar, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { Category, Account, TransactionType } from '../types/index.ts';
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setType(initialType);
  }, [initialType, isOpen]);

  // Filter categories by selected transaction type
  const availableCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (availableCategories.length > 0 && (!categoryId || !availableCategories.some(c => c.id === categoryId))) {
      setCategoryId(availableCategories[0].id);
    }
  }, [type, categories]);

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-lg bg-[#203657] border border-[#2a4365] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl text-white max-h-[92vh] overflow-y-auto animate-in zoom-in-95"
        role="dialog"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#2a4365] mb-4">
          <h3 className="text-base font-bold text-white">Nuevo Movimiento</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#29446c] text-[#9ba3af] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#1c2e4a] rounded-2xl border border-[#2a4365]">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                type === 'expense'
                  ? 'bg-[#ff914d] text-white shadow-md'
                  : 'text-[#9ba3af] hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                type === 'income'
                  ? 'bg-[#00c2c7] text-[#0b132b] shadow-md'
                  : 'text-[#9ba3af] hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Ingreso
            </button>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-[#9ba3af] mb-1">
              Monto
            </label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              currencySymbol="$"
              placeholder="0,00"
              autoFocus
              required
              className="!py-3 !text-2xl !font-black !bg-[#1c2e4a] !border-[#2a4365]"
            />
          </div>

          {/* Category Selector with chips/icons */}
          <div>
            <label className="block text-xs font-semibold text-[#9ba3af] mb-1">
              Categoría
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
              {availableCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#147df0] bg-[#147df0]/20 text-white ring-1 ring-[#147df0]'
                        : 'border-[#2a4365] bg-[#1c2e4a] text-[#9ba3af] hover:bg-[#203657] hover:text-white'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center mb-1 text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      <CategoryIcon iconName={cat.icon} size={14} className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-semibold truncate w-full">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#9ba3af] mb-1">
              Cuenta de fondos
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1 no-scrollbar">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setAccountId(acc.id)}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    accountId === acc.id
                      ? 'border-[#147df0] bg-[#203657] ring-2 ring-[#147df0] text-white shadow-sm'
                      : 'border-[#2a4365] bg-[#1c2e4a] text-[#9ba3af] hover:text-white hover:bg-[#203657]'
                  }`}
                >
                  <span className="truncate">{acc.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#132238] text-slate-400 uppercase">
                    {acc.currency}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#9ba3af] mb-1">
              Descripción / Concepto
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9ba3af]">
                <FileText className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Ej. Supermercado, Almuerzo, Uber..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#1c2e4a] border border-[#2a4365] rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#147df0]"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-[#9ba3af] mb-1">
              Fecha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9ba3af]">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#1c2e4a] border border-[#2a4365] rounded-xl pl-10 pr-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#147df0]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-[#1c2e4a] hover:bg-[#29446c] text-[#9ba3af] hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#147df0] to-[#00c2c7] hover:opacity-95 text-white text-xs font-extrabold shadow-lg shadow-[#147df0]/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
