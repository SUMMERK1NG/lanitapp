import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, TrendingDown, Sparkles } from 'lucide-react';
import type { Debt, FortnightType, ExchangeRatesData } from '../types/index.ts';
import { addDebtPayment } from '../lib/db.ts';
import { parseCleanNumber } from '../utils/numberFormat.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
  rates: ExchangeRatesData;
  preselectedDebtId?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface FortnightOption {
  key: string;
  year: number;
  month: number;
  fortnight: FortnightType;
  label: string;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  debts,
  rates,
  preselectedDebtId,
}) => {
  const activeDebts = debts.filter((d) => d.status === 'active' || d.id === preselectedDebtId);
  const [debtId, setDebtId] = useState<string>(preselectedDebtId || (activeDebts[0]?.id || ''));
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedFortnightKey, setSelectedFortnightKey] = useState<string>('');
  const [customRate, setCustomRate] = useState<string>(rates.bcvDollar.toString());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [suggestedNotice, setSuggestedNotice] = useState<string>('');

  // Calculate smart fortnight from date
  const computeSmartFortnight = (dateStr: string): { year: number; month: number; fortnight: FortnightType; notice: string } => {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-11
    const day = parseInt(parts[2], 10);

    // Days 1-5: suggest Quincena 30 of previous month (post-cobro fin de mes)
    if (day >= 1 && day <= 5) {
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear = year - 1;
      }
      return {
        year: prevYear,
        month: prevMonth,
        fortnight: 'q2',
        notice: `Sugerida Quincena 30 de ${MONTH_NAMES[prevMonth]} por fecha de post-cobro`,
      };
    } else if (day >= 6 && day <= 15) {
      return {
        year,
        month,
        fortnight: 'q1',
        notice: `Asignado a Quincena 15 de ${MONTH_NAMES[month]}`,
      };
    } else {
      return {
        year,
        month,
        fortnight: 'q2',
        notice: `Asignado a Quincena 30 de ${MONTH_NAMES[month]}`,
      };
    }
  };

  // Generate options around current date
  const fortnightOptions: FortnightOption[] = useMemo(() => {
    const parts = paymentDate.split('-');
    const baseYear = parseInt(parts[0], 10) || new Date().getFullYear();
    const baseMonth = (parseInt(parts[1], 10) - 1) || new Date().getMonth();

    const options: FortnightOption[] = [];
    // Generate -2 to +2 months
    for (let offset = -2; offset <= 2; offset++) {
      let m = baseMonth + offset;
      let y = baseYear;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      while (m >= 12) {
        m -= 12;
        y += 1;
      }

      options.push({
        key: `${y}_${m}_q1`,
        year: y,
        month: m,
        fortnight: 'q1',
        label: `Quincena 15 de ${MONTH_NAMES[m]} ${y}`,
      });
      options.push({
        key: `${y}_${m}_q2`,
        year: y,
        month: m,
        fortnight: 'q2',
        label: `Quincena 30 de ${MONTH_NAMES[m]} ${y}`,
      });
    }
    return options;
  }, [paymentDate]);

  // Update suggested fortnight when date changes
  const handleDateChange = (newDate: string) => {
    setPaymentDate(newDate);
    const smart = computeSmartFortnight(newDate);
    setSelectedFortnightKey(`${smart.year}_${smart.month}_${smart.fortnight}`);
    setSuggestedNotice(smart.notice);
  };

  useEffect(() => {
    if (preselectedDebtId) {
      setDebtId(preselectedDebtId);
    } else if (activeDebts.length > 0 && !debtId) {
      setDebtId(activeDebts[0].id);
    }
  }, [preselectedDebtId, activeDebts]);

  useEffect(() => {
    setCustomRate(rates.bcvDollar.toString());
  }, [rates]);

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setPaymentDate(today);
      const smart = computeSmartFortnight(today);
      setSelectedFortnightKey(`${smart.year}_${smart.month}_${smart.fortnight}`);
      setSuggestedNotice(smart.notice);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedDebt = debts.find((d) => d.id === debtId);
  const numAmount = amount;
  const appliedRate = parseCleanNumber(customRate) || rates.bcvDollar;
  const amountInBs = numAmount * appliedRate;

  const realCostUSD = rates.parallelDollar > 0 ? (numAmount * appliedRate) / rates.parallelDollar : numAmount;
  const differentialSavingsUSD = Number((numAmount - realCostUSD).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtId || numAmount <= 0) return;

    // Parse selected fortnight
    const selectedOpt = fortnightOptions.find((o) => o.key === selectedFortnightKey) || fortnightOptions[0];

    setIsSubmitting(true);
    try {
      await addDebtPayment({
        debt_id: debtId,
        amount: numAmount,
        payment_date: paymentDate,
        year: selectedOpt.year,
        month: selectedOpt.month,
        fortnight: selectedOpt.fortnight,
        rate_applied: selectedDebt?.payment_type === 'bcv_usd' ? appliedRate : undefined,
        parallel_rate: selectedDebt?.payment_type === 'bcv_usd' ? rates.parallelDollar : undefined,
        notes: notes.trim() || `Abono de ${selectedOpt.label}`,
      });
      onClose();
    } catch (err) {
      console.error('Error recording payment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[90vh] overflow-y-auto animate-in zoom-in-95 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">Registrar Abono a Cuota / Deuda</h3>
              <p className="text-[11px] text-muted">Abono directo al saldo pendiente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Debt Selection */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Deuda / Acreedor a Pagar
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {activeDebts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDebtId(d.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all text-left cursor-pointer ${
                    debtId === d.id
                      ? 'bg-primary-custom/15 border-primary-custom text-app font-bold'
                      : 'bg-card border-app text-muted hover:text-app hover:bg-surface-hover'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-app font-bold block truncate">{d.creditor}</span>
                    <span className="text-[10px] text-muted">
                      {d.debt_mode === 'open' ? 'Monto Abierto' : `${d.pending_installments || 1} cuotas restantes`}
                    </span>
                  </div>
                  <span className="text-sm font-black text-[#FF914D] shrink-0 ml-2">
                    ${d.current_balance}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount to pay */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Monto a Abonar ($ USD)
            </label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              currencySymbol="$"
              placeholder="0,00"
              autoFocus
              required
            />
            {selectedDebt && (
              <span className="text-[11px] text-muted mt-1 block">
                Saldo pendiente actual: <strong className="text-[#FF914D]">${selectedDebt.current_balance}</strong>
              </span>
            )}
          </div>

          {/* Rate applied if BCV payment */}
          {selectedDebt?.payment_type === 'bcv_usd' && (
            <div className="p-3 rounded-2xl bg-card border border-app space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted font-semibold">Tasa Oficial BCV Aplicada:</span>
                <span className="text-app font-bold">Bs. {appliedRate.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Equivalente a Pagar en Bs:</span>
                <span className="text-[#00C2C7] font-extrabold text-sm">
                  Bs. {amountInBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {differentialSavingsUSD > 0 && (
                <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 pt-1 border-t border-app">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Ahorro por brecha cambiaria vs paralelo: +${differentialSavingsUSD} USD
                </div>
              )}
            </div>
          )}

          {/* Date & Smart Fortnight Assignment */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Fecha del Pago
                </label>
                <input
                  type="date"
                  value={paymentDate}
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
                    { id: 'q1', label: 'Quincena 15' },
                    { id: 'q2', label: 'Quincena 30' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const target = fortnightOptions.find(f => f.fortnight === opt.id) || fortnightOptions[0];
                        if (target) setSelectedFortnightKey(target.key);
                      }}
                      className={`py-1 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        selectedFortnightKey.endsWith(`_${opt.id}`)
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

            {suggestedNotice && (
              <div className="text-[11px] text-[#00C2C7] bg-[#00C2C7]/10 border border-[#00C2C7]/20 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{suggestedNotice}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Nota / Referencia de Pago
            </label>
            <input
              type="text"
              placeholder="Ej. Transferencia Banesco Ref #4928..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
            />
          </div>

          {/* Action Buttons */}
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
              disabled={isSubmitting || numAmount <= 0}
              className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar Abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
