import React, { useState, useEffect } from 'react';
import { X, Receipt, ChevronDown } from 'lucide-react';
import type { FixedExpense, Category, ExchangeRatesData, FixedExpensePaymentMode } from '../types/index.ts';
import { saveFixedExpense } from '../lib/db.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface AddFixedExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingExpense?: FixedExpense | null;
  categories: Category[];
  rates?: ExchangeRatesData;
  onSaved?: (expense: FixedExpense) => void;
}

const PAYMENT_MODES_LIST: { id: FixedExpensePaymentMode; label: string; sub: string }[] = [
  { id: 'ves_bcv', label: 'Tasa BCV Oficial', sub: 'Monto fijado en USD, pagado en Bs al BCV' },
  { id: 'ves_fixed', label: 'Bolívares Fijos', sub: 'Monto fijo en Bs (devaluación/inflación)' },
  { id: 'usd_cash', label: 'Efectivo Divisas ($)', sub: 'Billetes USD en físico' },
  { id: 'eur_cash', label: 'Euros (€)', sub: 'Monto fijado en EUR' },
  { id: 'ves_euro', label: 'Euros a Tasa BCV', sub: 'Calculado con tasa oficial EUR/BCV' },
];

export const AddFixedExpenseModal: React.FC<AddFixedExpenseModalProps> = ({
  isOpen,
  onClose,
  editingExpense,
  categories,
  rates,
  onSaved,
}) => {
  const [fixedName, setFixedName] = useState<string>('');
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [fixedPaymentMode, setFixedPaymentMode] = useState<FixedExpensePaymentMode>('ves_bcv');
  const [fixedFortnight, setFixedFortnight] = useState<'q1' | 'q2' | 'both'>('q1');
  const [fixedDueDay, setFixedDueDay] = useState<string>('');
  const [fixedDueDay2, setFixedDueDay2] = useState<string>('');
  const [fixedCategoryId, setFixedCategoryId] = useState<string>('cat_services');
  const [fixedNotes, setFixedNotes] = useState<string>('');
  const [isFixedCategoryDropdownOpen, setIsFixedCategoryDropdownOpen] = useState<boolean>(false);
  const [isFixedPaymentDropdownOpen, setIsFixedPaymentDropdownOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const bcvUsd = rates?.bcvDollar || 1;
  const bcvEur = rates?.bcvEuro || 1;
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  useEffect(() => {
    if (editingExpense) {
      setFixedName(editingExpense.name);
      setFixedAmount(
        editingExpense.original_amount !== undefined ? editingExpense.original_amount : editingExpense.amount
      );
      setFixedPaymentMode(editingExpense.payment_mode || 'ves_bcv');
      setFixedFortnight(editingExpense.default_fortnight || 'q1');
      setFixedDueDay(editingExpense.due_day ? editingExpense.due_day.toString() : '');
      setFixedDueDay2(editingExpense.due_day_2 ? editingExpense.due_day_2.toString() : '');
      setFixedCategoryId(editingExpense.category_id || 'cat_services');
      setFixedNotes(editingExpense.notes || '');
    } else {
      setFixedName('');
      setFixedAmount(0);
      setFixedPaymentMode('ves_bcv');
      setFixedFortnight('q1');
      setFixedDueDay('');
      setFixedDueDay2('');
      setFixedCategoryId('cat_services');
      setFixedNotes('');
    }
    setIsFixedCategoryDropdownOpen(false);
    setIsFixedPaymentDropdownOpen(false);
  }, [editingExpense, isOpen]);

  if (!isOpen) return null;

  const handleSaveFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedName.trim() || fixedAmount <= 0) return;

    setIsSubmitting(true);
    try {
      let derivedCurrency = 'USD';
      if (fixedPaymentMode === 'ves_fixed') derivedCurrency = 'VES';
      else if (fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro') derivedCurrency = 'EUR';

      let usdEquivalent = fixedAmount;
      if (fixedPaymentMode === 'ves_fixed') {
        usdEquivalent = Number((fixedAmount / bcvUsd).toFixed(2));
      } else if (derivedCurrency === 'EUR' || fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro') {
        usdEquivalent = Number(((fixedAmount * bcvEur) / bcvUsd).toFixed(2));
      }

      const saved = await saveFixedExpense({
        id: editingExpense ? editingExpense.id : undefined,
        name: fixedName.trim(),
        amount: usdEquivalent,
        original_amount: fixedAmount,
        currency: derivedCurrency,
        payment_mode: fixedPaymentMode,
        default_fortnight: fixedFortnight,
        due_day: fixedDueDay ? parseInt(fixedDueDay, 10) : undefined,
        due_day_2: fixedDueDay2 ? parseInt(fixedDueDay2, 10) : undefined,
        category_id: fixedCategoryId,
        is_active: editingExpense ? editingExpense.is_active : true,
        notes: fixedNotes.trim(),
      });

      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      console.error('Error saving fixed expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-app">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-custom" />
            <h3 className="text-base font-black text-app">
              {editingExpense ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo Recurrente'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              currencySymbol={
                fixedPaymentMode === 'ves_fixed'
                  ? 'Bs.'
                  : fixedPaymentMode === 'eur_cash' || fixedPaymentMode === 'ves_euro'
                  ? '€'
                  : '$'
              }
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
                <span>
                  {expenseCategories.find((c) => c.id === fixedCategoryId)?.name || 'Selecciona Categoría'}
                </span>
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
              onChange={(e) => setFixedNotes(e.target.value)}
              placeholder="Detalles, número de contrato o recordatorios..."
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
              {isSubmitting ? 'Guardando...' : editingExpense ? 'Actualizar Gasto Fijo' : 'Guardar Gasto Fijo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
