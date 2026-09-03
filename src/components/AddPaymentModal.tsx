import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, TrendingDown, Sparkles, AlertCircle, Percent } from 'lucide-react';
import type { Debt, FortnightType, ExchangeRatesData } from '../types/index.ts';
import { addDebtPayment } from '../services/debtsService.ts';
import { parseCleanNumber } from '../utils/numberFormat.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';
import { logger } from '../utils/logger.ts';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
  rates: ExchangeRatesData;
  preselectedDebtId?: string;
  initialAmount?: number;
  initialYear?: number;
  initialMonth?: number;
  initialFortnight?: FortnightType;
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
  initialAmount,
  initialYear,
  initialMonth,
  initialFortnight,
}) => {
  const activeDebts = debts.filter((d) => d.status === 'active' || d.id === preselectedDebtId);
  const [debtId, setDebtId] = useState<string>(preselectedDebtId || (activeDebts[0]?.id || ''));

  // Payment Breakdown States
  const [paymentMode, setPaymentMode] = useState<'interest_only' | 'mixed' | 'principal_only' | 'custom'>('mixed');
  const [principalAmount, setPrincipalAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<number>(initialAmount || 0);

  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedFortnightKey, setSelectedFortnightKey] = useState<string>('');
  const [customRate, setCustomRate] = useState<string>(rates.bcvDollar.toString());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [suggestedNotice, setSuggestedNotice] = useState<string>('');

  const selectedDebt = debts.find((d) => d.id === debtId);
  const isDebtVES = selectedDebt?.currency === 'VES' || selectedDebt?.payment_mode === 'ves_fixed';
  const isDebtEUR = selectedDebt?.currency === 'EUR' || selectedDebt?.payment_mode === 'eur_cash' || selectedDebt?.payment_mode === 'ves_euro';
  const debtCurrency = isDebtVES ? 'Bs.' : isDebtEUR ? '€' : '$';

  // Interest calculation for currently selected debt
  const scheduledInterest = useMemo(() => {
    if (!selectedDebt || !selectedDebt.has_interest) return 0;
    if (selectedDebt.interest_amount && selectedDebt.interest_amount > 0) {
      return Number(selectedDebt.interest_amount);
    }
    if (selectedDebt.interest_rate && selectedDebt.interest_rate > 0) {
      return Number(((Number(selectedDebt.current_balance) * Number(selectedDebt.interest_rate)) / 100).toFixed(2));
    }
    return 0;
  }, [selectedDebt]);

  // Sync breakdown ONLY when modal opens or selected debtId changes
  useEffect(() => {
    if (!isOpen || !selectedDebt) return;
    if (selectedDebt.has_interest && scheduledInterest > 0) {
      setInterestAmount(scheduledInterest);
      // If debt is open mode with interest, default suggested principal is 0 or cuota
      if (selectedDebt.debt_mode === 'open') {
        setPaymentMode('interest_only');
        setPrincipalAmount(0);
        setCustomAmount(scheduledInterest);
      } else {
        setPaymentMode('mixed');
        const suggestedPrincipal = Math.max(0, (selectedDebt.installment_amount || 0) - scheduledInterest);
        const cuotaVal = suggestedPrincipal > 0 ? suggestedPrincipal : Number((selectedDebt.current_balance / (selectedDebt.pending_installments || 1)).toFixed(2));
        setPrincipalAmount(cuotaVal);
        setCustomAmount(scheduledInterest + cuotaVal);
      }
    } else {
      setPaymentMode('custom');
      const defaultCuota = selectedDebt.installment_amount || (selectedDebt.pending_installments ? selectedDebt.current_balance / selectedDebt.pending_installments : selectedDebt.current_balance);
      const initAmt = initialAmount !== undefined ? initialAmount : Number(defaultCuota.toFixed(2));
      setCustomAmount(initAmt);
      setPrincipalAmount(initAmt);
      setInterestAmount(0);
    }
  }, [isOpen, debtId]);

  // Compute smart fortnight from date
  const computeSmartFortnight = (dateStr: string): { year: number; month: number; fortnight: FortnightType; notice: string } => {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-11
    const day = parseInt(parts[2], 10);

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

  // Generate fortnight options
  const fortnightOptions: FortnightOption[] = useMemo(() => {
    const parts = paymentDate.split('-');
    const baseYear = parseInt(parts[0], 10) || new Date().getFullYear();
    const baseMonth = (parseInt(parts[1], 10) - 1) || new Date().getMonth();

    const options: FortnightOption[] = [];
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
      if (initialYear !== undefined && initialMonth !== undefined && initialFortnight) {
        setSelectedFortnightKey(`${initialYear}_${initialMonth}_${initialFortnight}`);
        setSuggestedNotice(`Período seleccionado: Quincena ${initialFortnight === 'q1' ? '15' : '30'} de ${MONTH_NAMES[initialMonth]} ${initialYear}`);
      } else {
        const today = new Date().toISOString().split('T')[0];
        setPaymentDate(today);
        const smart = computeSmartFortnight(today);
        setSelectedFortnightKey(`${smart.year}_${smart.month}_${smart.fortnight}`);
        setSuggestedNotice(smart.notice);
      }
    }
  }, [isOpen, initialYear, initialMonth, initialFortnight]);

  if (!isOpen) return null;

  // Compute final effective amounts based on payment mode
  let effectivePrincipal = 0;
  let effectiveInterest = 0;
  let unpaidInterestCapitalized = 0;
  let totalToPay = 0;

  if (selectedDebt?.has_interest) {
    if (paymentMode === 'interest_only') {
      effectivePrincipal = 0;
      effectiveInterest = scheduledInterest;
      unpaidInterestCapitalized = 0;
      totalToPay = scheduledInterest;
    } else if (paymentMode === 'mixed') {
      effectivePrincipal = principalAmount;
      effectiveInterest = interestAmount;
      unpaidInterestCapitalized = Math.max(0, scheduledInterest - interestAmount);
      totalToPay = effectivePrincipal + effectiveInterest;
    } else if (paymentMode === 'principal_only') {
      effectivePrincipal = principalAmount;
      effectiveInterest = 0;
      unpaidInterestCapitalized = scheduledInterest; // El interés no pagado se acumula/capitaliza al saldo
      totalToPay = effectivePrincipal;
    } else {
      totalToPay = customAmount;
      if (customAmount >= scheduledInterest) {
        effectiveInterest = scheduledInterest;
        effectivePrincipal = customAmount - scheduledInterest;
        unpaidInterestCapitalized = 0;
      } else {
        effectiveInterest = customAmount;
        effectivePrincipal = 0;
        unpaidInterestCapitalized = Math.max(0, scheduledInterest - customAmount);
      }
    }
  } else {
    totalToPay = customAmount;
    effectivePrincipal = customAmount;
    effectiveInterest = 0;
    unpaidInterestCapitalized = 0;
  }

  // Projected new balance
  const currentBalance = selectedDebt ? Number(selectedDebt.current_balance) : 0;
  const projectedBalance = Number(Math.max(0, currentBalance - effectivePrincipal + unpaidInterestCapitalized).toFixed(2));

  const isBCVEuro = selectedDebt?.payment_type === 'bcv_eur' || selectedDebt?.payment_mode === 'ves_euro';
  const appliedRate = isBCVEuro ? (rates.bcvEuro || 0) : (parseCleanNumber(customRate) || rates.bcvDollar);
  const amountInBs = isDebtVES ? totalToPay : totalToPay * appliedRate;
  const realCostUSD = isDebtVES ? (rates.parallelDollar > 0 ? totalToPay / rates.parallelDollar : totalToPay) : (rates.parallelDollar > 0 ? (totalToPay * appliedRate) / rates.parallelDollar : totalToPay);
  const differentialSavingsUSD = isDebtVES || isBCVEuro ? 0 : Number((totalToPay - realCostUSD).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtId || totalToPay <= 0) return;

    const selectedOpt = fortnightOptions.find((o) => o.key === selectedFortnightKey) || fortnightOptions[0];

    // Generate descriptive note
    let autoNote = notes.trim();
    if (!autoNote) {
      if (selectedDebt?.has_interest) {
        if (paymentMode === 'interest_only') {
          autoNote = `Pago exclusivo de intereses ($${effectiveInterest.toFixed(2)} USD)`;
        } else if (paymentMode === 'principal_only') {
          autoNote = `Abono a capital ($${effectivePrincipal.toFixed(2)} USD). Interés no pagado ($${unpaidInterestCapitalized.toFixed(2)} USD) acumulado al saldo`;
        } else if (paymentMode === 'mixed') {
          autoNote = `Abono de capital ($${effectivePrincipal.toFixed(2)} USD) + Intereses ($${effectiveInterest.toFixed(2)} USD)`;
        } else {
          autoNote = `Abono personalizado a deuda`;
        }
      } else {
        autoNote = `Abono de ${selectedOpt.label}`;
      }
    }

    if (!debtId || !totalToPay || totalToPay <= 0) {
      logger.error('[PAYMENT VALIDATION ERROR]: Monto o deuda inválida');
      alert('Por favor introduce un monto válido superior a 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDebtPayment({
        debt_id: debtId,
        amount: Number(totalToPay),
        principal_amount: effectivePrincipal,
        interest_amount: effectiveInterest,
        unpaid_interest_capitalized: unpaidInterestCapitalized,
        payment_type: paymentMode === 'custom' ? (effectiveInterest > 0 && effectivePrincipal > 0 ? 'mixed' : effectiveInterest > 0 ? 'interest_only' : 'principal_only') : paymentMode,
        payment_date: paymentDate,
        year: selectedOpt.year,
        month: selectedOpt.month,
        fortnight: selectedOpt.fortnight,
        rate_applied: isDebtVES ? undefined : appliedRate,
        parallel_rate: isDebtVES ? undefined : rates.parallelDollar,
        notes: autoNote,
      });
      logger.dev('[PAYMENT SUCCESS] Abono procesado con éxito');
      onClose();
    } catch (err: any) {
      logger.error('[PAYMENT FAILED]:', err);
      alert('Error al procesar el abono: ' + (err?.message || 'Intente de nuevo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[90vh] overflow-y-auto animate-in zoom-in-95 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">Registrar Abono a Deuda</h3>
              <p className="text-[11px] text-muted">Abono directo al capital e intereses</p>
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
                      {d.has_interest && ` • Interés: ${d.interest_rate ? `${d.interest_rate}%` : `$${d.interest_amount}`}`}
                    </span>
                  </div>
                  <span className="text-sm font-black text-[#FF914D] shrink-0 ml-2">
                    {d.currency === 'VES' || d.payment_mode === 'ves_fixed' ? 'Bs.' : d.currency === 'EUR' || d.payment_mode === 'eur_cash' ? '€' : '$'}{d.current_balance}
                  </span>
                </button>
              ))}
            </div>

            {selectedDebt && (
              <div className="grid grid-cols-3 gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const fullBal = Number(Number(selectedDebt.current_balance || 0).toFixed(2));
                    if (selectedDebt.has_interest) {
                      setPaymentMode('principal_only');
                      setPrincipalAmount(fullBal);
                      setInterestAmount(0);
                    }
                    setCustomAmount(fullBal);
                    setNotes(`Liquidación total de deuda (${debtCurrency}${fullBal.toFixed(2)})`);
                  }}
                  className="py-2 px-1.5 rounded-xl bg-primary-custom/15 border border-primary-custom/40 hover:bg-primary-custom/25 text-[10px] font-black text-primary-custom transition-all text-center cursor-pointer shadow-xs"
                >
                  🎯 Liquidar Total ({debtCurrency}{Number(selectedDebt.current_balance || 0).toFixed(2)})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cuotaVal = selectedDebt.installment_amount || (selectedDebt.pending_installments ? Number(selectedDebt.current_balance) / selectedDebt.pending_installments : Number(selectedDebt.current_balance));
                    const cuotaFixed = Number(cuotaVal.toFixed(2));
                    if (selectedDebt.has_interest) {
                      setPaymentMode('mixed');
                      setPrincipalAmount(Math.max(0, Number((cuotaFixed - scheduledInterest).toFixed(2))));
                      setInterestAmount(scheduledInterest);
                    }
                    setCustomAmount(cuotaFixed);
                    setNotes(`Abono de cuota (${debtCurrency}${cuotaFixed.toFixed(2)})`);
                  }}
                  className="py-2 px-1.5 rounded-xl bg-surface border border-app hover:border-primary-custom text-[10px] font-bold text-app transition-all text-center cursor-pointer shadow-xs"
                >
                  ⚡ Pagar 1 Cuota
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNotes('');
                    const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement | null;
                    if (inputEl) inputEl.focus();
                  }}
                  className="py-2 px-1.5 rounded-xl bg-surface border border-dashed border-app hover:border-app text-[10px] font-bold text-muted hover:text-app transition-all text-center cursor-pointer shadow-xs"
                >
                  ✏️ Monto Personalizado
                </button>
              </div>
            )}
          </div>

          {/* Special Breakdown Options for Debts with Interest */}
          {selectedDebt?.has_interest ? (
            <div className="space-y-3 p-3.5 rounded-2xl bg-card border border-app">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-app flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-400" /> Modalidad de Abono
                </span>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/15 px-2 py-0.5 rounded-full">
                  Interés del corte: ${scheduledInterest.toFixed(2)}
                </span>
              </div>

              {/* Payment Mode Selector Pills */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('interest_only');
                  }}
                  className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all text-center cursor-pointer ${
                    paymentMode === 'interest_only'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-xs'
                      : 'bg-surface border-app text-muted hover:text-app'
                  }`}
                >
                  💸 Solo Intereses (${scheduledInterest.toFixed(2)})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('mixed');
                    if (principalAmount <= 0) setPrincipalAmount(100);
                  }}
                  className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all text-center cursor-pointer ${
                    paymentMode === 'mixed'
                      ? 'bg-primary-custom/20 border-primary-custom text-primary-custom shadow-xs'
                      : 'bg-surface border-app text-muted hover:text-app'
                  }`}
                >
                  💎 Capital + Intereses
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('principal_only');
                    if (principalAmount <= 0) setPrincipalAmount(100);
                  }}
                  className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all text-center cursor-pointer ${
                    paymentMode === 'principal_only'
                      ? 'bg-[#00C2C7]/20 border-[#00C2C7] text-[#00C2C7] shadow-xs'
                      : 'bg-surface border-app text-muted hover:text-app'
                  }`}
                >
                  ⚖️ Solo Capital (Omitir Interés)
                </button>
              </div>

              {/* Inputs based on selected mode */}
              {paymentMode === 'mixed' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Abono a Capital ($)</label>
                    <MoneyInput
                      value={principalAmount}
                      onChange={setPrincipalAmount}
                      placeholder="0.00"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Pago de Interés ($)</label>
                    <MoneyInput
                      value={interestAmount}
                      onChange={setInterestAmount}
                      placeholder="0.00"
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {paymentMode === 'principal_only' && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Abono directo a Capital ($)</label>
                    <MoneyInput
                      value={principalAmount}
                      onChange={setPrincipalAmount}
                      placeholder="0.00"
                      className="w-full"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2 text-[11px] text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Al omitir el pago de intereses de este mes (+${scheduledInterest.toFixed(2)} USD), se acumularán al saldo pendiente para el próximo período.
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Flat Amount to pay for non-interest debts */
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Monto a Abonar ({debtCurrency})
              </label>
              <MoneyInput
                value={customAmount}
                onChange={setCustomAmount}
                currencySymbol={debtCurrency}
                placeholder="0,00"
                autoFocus
                required
              />
              {selectedDebt && (
                <span className="text-[11px] text-muted mt-1 block">
                  Saldo pendiente actual: <strong className="text-[#FF914D]">{debtCurrency}{Number(selectedDebt.current_balance || 0).toFixed(2)}</strong>
                </span>
              )}
            </div>
          )}

          {/* Live Projection Box */}
          {selectedDebt && totalToPay > 0 && (
            <div className="p-3 rounded-2xl bg-surface border border-primary-custom/30 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-muted">
                <span>Total a Pagar hoy:</span>
                <span className="font-extrabold text-app text-sm">{debtCurrency}{totalToPay.toFixed(2)}</span>
              </div>
              {selectedDebt.has_interest && (
                <div className="flex justify-between items-center text-[11px] text-muted border-t border-app/60 pt-1">
                  <span>Reducción de Capital:</span>
                  <span className="font-bold text-emerald-400">-{debtCurrency}{effectivePrincipal.toFixed(2)}</span>
                </div>
              )}
              {selectedDebt.has_interest && effectiveInterest > 0 && (
                <div className="flex justify-between items-center text-[11px] text-muted">
                  <span>Intereses Cubiertos:</span>
                  <span className="font-bold text-amber-400">{debtCurrency}{effectiveInterest.toFixed(2)}</span>
                </div>
              )}
              {selectedDebt.has_interest && unpaidInterestCapitalized > 0 && (
                <div className="flex justify-between items-center text-[11px] text-amber-400 font-medium">
                  <span>Interés no pagado acumulado:</span>
                  <span className="font-bold">+{debtCurrency}{unpaidInterestCapitalized.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-app/60">
                <span>Nuevo Saldo Adeudado:</span>
                <span className="text-[#FF914D] font-black">{debtCurrency}{projectedBalance.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Rate applied if BCV payment */}
          {(selectedDebt?.payment_type === 'bcv_usd' || selectedDebt?.payment_type === 'bcv_eur' || isBCVEuro || selectedDebt?.payment_mode === 'ves_bcv') && !isDebtVES && (
            <div className="p-3 rounded-2xl bg-card border border-app space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted font-semibold">
                  {isBCVEuro ? 'Tasa Oficial BCV Euro Aplicada:' : 'Tasa Oficial BCV Dólar Aplicada:'}
                </span>
                <span className="text-app font-bold">Bs. {appliedRate.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Equivalente a Pagar en Bs:</span>
                <span className="text-[#00C2C7] font-extrabold text-sm">
                  Bs. {amountInBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {differentialSavingsUSD > 0 && !isBCVEuro && (
                <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 pt-1 border-t border-app">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Ahorro por brecha cambiaria vs promedio: +${differentialSavingsUSD} USD
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
              Nota / Referencia de Pago (Opcional)
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
              disabled={isSubmitting || totalToPay <= 0}
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
