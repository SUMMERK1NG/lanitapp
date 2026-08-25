import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CreditCard,
  Layers,
  DollarSign,
  Calendar,
  Percent,
  ChevronDown,
} from 'lucide-react';
import type {
  Debt,
  PaymentMethodType,
  DebtPlatformType,
  DebtModeType,
  FortnightType,
  Category,
} from '../types/index.ts';
import { saveDebt } from '../lib/db.ts';
import { parseCleanNumber } from '../utils/numberFormat.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface AddDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDebt?: Debt | null;
  categories?: Category[];
  initialAmount?: number;
  initialCreditor?: string;
  initialDebtMode?: DebtModeType;
  initialPlatform?: DebtPlatformType;
  initialStartYear?: number;
  initialStartMonth?: number;
  initialStartFortnight?: FortnightType;
  initialNotes?: string;
  onSaved?: (debt: Debt) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface StartPeriodOption {
  key: string;
  year: number;
  month: number;
  fortnight: FortnightType;
  label: string;
}

export const AddDebtModal: React.FC<AddDebtModalProps> = ({
  isOpen,
  onClose,
  editingDebt,
  initialAmount,
  initialCreditor,
  initialDebtMode,
  initialPlatform,
  initialStartYear,
  initialStartMonth,
  initialStartFortnight,
  initialNotes,
  onSaved,
}) => {
  const [debtMode, setDebtMode] = useState<DebtModeType>(editingDebt?.debt_mode || initialDebtMode || 'installments');
  const [creditor, setCreditor] = useState<string>(editingDebt?.creditor || initialCreditor || '');
  const [platform, setPlatform] = useState<DebtPlatformType>(editingDebt?.platform || initialPlatform || 'particular');
  const [debtAmount, setDebtAmount] = useState<number>(editingDebt?.total_amount || initialAmount || 0);
  const [initialPayment, setInitialPayment] = useState<number>(editingDebt?.initial_payment || 0);
  const [totalInstallments, setTotalInstallments] = useState<string>(editingDebt?.total_installments?.toString() || '4');
  const [pendingInstallments, setPendingInstallments] = useState<string>(editingDebt?.pending_installments?.toString() || '4');
  const [installmentAmount, setInstallmentAmount] = useState<number>(editingDebt?.installment_amount || 0);
  const [fortnightDue, setFortnightDue] = useState<'q1' | 'q2' | 'both'>(editingDebt?.fortnight_due || 'q1');

  // Interest Module State (for 'open' mode)
  const [hasInterest, setHasInterest] = useState<boolean>(
    editingDebt?.has_interest || (editingDebt?.interest_rate ? editingDebt.interest_rate > 0 : false)
  );
  const [interestRate, setInterestRate] = useState<string>(editingDebt?.interest_rate?.toString() || '0');
  const [interestAmount, setInterestAmount] = useState<string>(editingDebt?.interest_amount?.toString() || '0');
  const [interestFrequency, setInterestFrequency] = useState<'monthly' | 'fortnightly'>(
    editingDebt?.interest_frequency || 'monthly'
  );
  const [interestFortnight, setInterestFortnight] = useState<FortnightType>(
    editingDebt?.interest_fortnight || 'q1'
  );

  // Starting period
  const now = new Date();
  const initialStartYearVal = editingDebt?.start_year !== undefined ? editingDebt.start_year : (initialStartYear !== undefined ? initialStartYear : now.getFullYear());
  const initialStartMonthVal = editingDebt?.start_month !== undefined ? editingDebt.start_month : (initialStartMonth !== undefined ? initialStartMonth : now.getMonth());
  const initialStartFortnightVal = editingDebt?.start_fortnight || initialStartFortnight || (now.getDate() <= 15 ? 'q1' : 'q2');
  const [startPeriodKey, setStartPeriodKey] = useState<string>(
    `${initialStartYearVal}_${initialStartMonthVal}_${initialStartFortnightVal}`
  );
  const [isStartPeriodDropdownOpen, setIsStartPeriodDropdownOpen] = useState<boolean>(false);

  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'VES'>(editingDebt?.currency || 'USD');
  const [paymentType, setPaymentType] = useState<PaymentMethodType>(editingDebt?.payment_type || 'bcv_usd');
  const [dueDate, setDueDate] = useState<string>(editingDebt?.due_date || '');
  const [notes, setNotes] = useState<string>(editingDebt?.notes || initialNotes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Generate starting period options (Next 12 fortnights)
  const startPeriodOptions: StartPeriodOption[] = useMemo(() => {
    const opts: StartPeriodOption[] = [];
    const baseYear = now.getFullYear();
    const baseMonth = now.getMonth();

    for (let i = 0; i < 12; i++) {
      const m = (baseMonth + i) % 12;
      const y = baseYear + Math.floor((baseMonth + i) / 12);

      opts.push({
        key: `${y}_${m}_q1`,
        year: y,
        month: m,
        fortnight: 'q1',
        label: `Quincena 15 de ${MONTH_NAMES[m]} ${y}`,
      });
      opts.push({
        key: `${y}_${m}_q2`,
        year: y,
        month: m,
        fortnight: 'q2',
        label: `Quincena 30 de ${MONTH_NAMES[m]} ${y}`,
      });
    }
    return opts;
  }, []);

  useEffect(() => {
    if (editingDebt) {
      setDebtMode(editingDebt.debt_mode || 'installments');
      setCreditor(editingDebt.creditor);
      setPlatform(editingDebt.platform || 'cashea');
      setDebtAmount(editingDebt.total_amount || 0);
      setInitialPayment(editingDebt.initial_payment || 0);
      setTotalInstallments(editingDebt.total_installments?.toString() || '4');
      setPendingInstallments(editingDebt.pending_installments?.toString() || '4');
      setInstallmentAmount(editingDebt.installment_amount || 0);
      setFortnightDue(editingDebt.fortnight_due || 'q1');

      const sy = editingDebt.start_year ?? now.getFullYear();
      const sm = editingDebt.start_month ?? now.getMonth();
      const sf = editingDebt.start_fortnight ?? 'q1';
      setStartPeriodKey(`${sy}_${sm}_${sf}`);

      setCurrency(editingDebt.currency);
      setPaymentType(editingDebt.payment_type);
      setHasInterest(editingDebt.has_interest || (editingDebt.interest_rate ? editingDebt.interest_rate > 0 : false));
      setInterestRate(editingDebt.interest_rate?.toString() || '0');
      setInterestAmount(editingDebt.interest_amount?.toString() || '0');
      setInterestFrequency(editingDebt.interest_frequency || 'monthly');
      setInterestFortnight(editingDebt.interest_fortnight || 'q1');
      setDueDate(editingDebt.due_date || '');
      setNotes(editingDebt.notes || '');
    } else if (isOpen) {
      const mode = initialDebtMode || 'installments';
      setDebtMode(mode);
      setCreditor(initialCreditor || (initialPlatform === 'particular' ? 'Préstamo Particular' : ''));
      setPlatform(initialPlatform || 'particular');
      const amt = initialAmount || 0;
      setDebtAmount(amt);
      setInitialPayment(0);
      setTotalInstallments('4');
      setPendingInstallments('4');
      if (amt > 0 && mode === 'installments') {
        setInstallmentAmount(Number((amt / 4).toFixed(2)));
      } else {
        setInstallmentAmount(0);
      }
      setFortnightDue('q1');

      const sy = initialStartYear !== undefined ? initialStartYear : now.getFullYear();
      const sm = initialStartMonth !== undefined ? initialStartMonth : now.getMonth();
      const sf = initialStartFortnight || (now.getDate() <= 15 ? 'q1' : 'q2');
      setStartPeriodKey(`${sy}_${sm}_${sf}`);

      setCurrency('USD');
      setPaymentType('bcv_usd');
      setHasInterest(false);
      setInterestRate('0');
      setInterestAmount('0');
      setInterestFrequency('monthly');
      setInterestFortnight('q1');
      setDueDate('');
      setNotes(initialNotes || '');
    }
  }, [editingDebt, isOpen, initialAmount, initialCreditor, initialDebtMode, initialPlatform, initialStartYear, initialStartMonth, initialStartFortnight, initialNotes]);

  // Platform selection handler
  const handleSelectPlatform = (platId: DebtPlatformType) => {
    setPlatform(platId);
    if (!editingDebt && !creditor.trim()) {
      if (platId === 'cashea') setCreditor('Cashea - ');
      else if (platId === 'creditotal') setCreditor('CrediTotal - ');
      else if (platId === 'multimax') setCreditor('Multimax - ');
      else if (platId === 'particular') setCreditor('Préstamo Familiar - ');
    }
  };

  const remainingAmount = useMemo(() => {
    return Math.max(0, debtAmount - initialPayment);
  }, [debtAmount, initialPayment]);

  // Auto calculate installment and interest amounts when total amount changes
  const handleDebtAmountChange = (val: number) => {
    setDebtAmount(val);

    const inst = parseInt(totalInstallments, 10);
    const rem = Math.max(0, val - initialPayment);
    if (inst > 0 && debtMode === 'installments') {
      const perInst = Number((rem / inst).toFixed(2));
      setInstallmentAmount(perInst);
    }
    if (debtMode === 'open' && hasInterest && val > 0) {
      const rate = parseCleanNumber(interestRate);
      if (!isNaN(rate) && rate > 0) {
        setInterestAmount(((val * rate) / 100).toFixed(2));
      }
    }
  };

  const handleInitialPaymentChange = (val: number) => {
    setInitialPayment(val);
    const inst = parseInt(totalInstallments, 10);
    const rem = Math.max(0, debtAmount - val);
    if (inst > 0 && debtMode === 'installments') {
      const perInst = Number((rem / inst).toFixed(2));
      setInstallmentAmount(perInst);
    }
  };

  const handleInstallmentsChange = (val: string) => {
    setTotalInstallments(val);
    setPendingInstallments(val); // New debts start with total installments pending
    const inst = parseInt(val, 10);
    const rem = Math.max(0, debtAmount - initialPayment);
    if (inst > 0 && debtMode === 'installments') {
      const perInst = Number((rem / inst).toFixed(2));
      setInstallmentAmount(perInst);
    }
  };

  // Dynamic Interest Rate input handler: auto-calculate dollar interest amount
  const handleInterestRateChange = (raw: string) => {
    const val = raw.replace(/[^0-9.,]/g, '');
    setInterestRate(val);
    const rate = parseCleanNumber(val);
    if (!isNaN(rate) && debtAmount > 0) {
      setInterestAmount(((debtAmount * rate) / 100).toFixed(2));
    }
  };

  // Dynamic Interest Amount input handler: auto-calculate interest rate %
  const handleInterestAmountChange = (raw: string) => {
    const val = raw.replace(/[^0-9.,]/g, '');
    setInterestAmount(val);
    const amountNum = parseCleanNumber(val);
    if (!isNaN(amountNum) && debtAmount > 0 && amountNum >= 0) {
      setInterestRate(((amountNum / debtAmount) * 100).toFixed(1));
    }
  };

  const handleToggleHasInterest = (active: boolean) => {
    setHasInterest(active);
    if (active) {
      if (parseCleanNumber(interestRate) === 0) {
        setInterestRate('10');
        if (debtAmount > 0) setInterestAmount(((debtAmount * 10) / 100).toFixed(2));
      }
    } else {
      setInterestRate('0');
      setInterestAmount('0');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTotal = debtAmount;
    if (!creditor.trim() || isNaN(numTotal) || numTotal <= 0) return;

    // Parse starting period
    const startOpt = startPeriodOptions.find((o) => o.key === startPeriodKey) || startPeriodOptions[0];
    const totalInstNum = debtMode === 'installments' ? parseInt(totalInstallments, 10) || undefined : undefined;
    const pendingInstNum = debtMode === 'installments' ? (editingDebt ? parseInt(pendingInstallments, 10) || totalInstNum : totalInstNum) : undefined;

    setIsSubmitting(true);
    try {
      const savedDebt = await saveDebt({
        id: editingDebt?.id,
        creditor: creditor.trim(),
        platform,
        debt_mode: debtMode,
        total_amount: numTotal,
        initial_payment: debtMode === 'installments' ? initialPayment : undefined,
        current_balance: editingDebt ? editingDebt.current_balance : (debtMode === 'installments' ? Math.max(0, numTotal - initialPayment) : numTotal),
        total_installments: totalInstNum,
        pending_installments: pendingInstNum,
        installment_amount: debtMode === 'installments' ? installmentAmount || (Math.max(0, numTotal - initialPayment) / (totalInstNum || 1)) : undefined,
        fortnight_due: fortnightDue,
        start_year: startOpt.year,
        start_month: startOpt.month,
        start_fortnight: startOpt.fortnight,
        currency,
        payment_type: paymentType,
        has_interest: debtMode === 'open' ? hasInterest : false,
        interest_rate: debtMode === 'open' && hasInterest ? parseCleanNumber(interestRate) || 0 : 0,
        interest_amount: debtMode === 'open' && hasInterest ? parseCleanNumber(interestAmount) || 0 : 0,
        interest_frequency: debtMode === 'open' && hasInterest ? interestFrequency : undefined,
        interest_fortnight: debtMode === 'open' && hasInterest ? interestFortnight : undefined,
        due_date: debtMode === 'open' ? dueDate || undefined : undefined,
        notes,
      });
      if (onSaved) onSaved(savedDebt);
      onClose();
    } catch (err) {
      console.error('Error saving debt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStartOpt = startPeriodOptions.find((o) => o.key === startPeriodKey) || startPeriodOptions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[90vh] overflow-y-auto animate-in zoom-in-95 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF914D]/20 text-[#FF914D] flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">
                {editingDebt ? 'Editar Deuda / Crédito' : 'Registrar Nueva Deuda / Crédito'}
              </h3>
              <p className="text-[11px] text-muted">Modalidad por cuotas o monto abierto con cálculo de intereses</p>
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
          {/* Modalidad Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Modalidad de la Deuda
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-card rounded-2xl border border-app">
              <button
                type="button"
                onClick={() => setDebtMode('installments')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  debtMode === 'installments'
                    ? 'bg-primary-custom text-white shadow-md'
                    : 'text-muted hover:text-app'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Por Cuotas / Crédito</span>
              </button>
              <button
                type="button"
                onClick={() => setDebtMode('open')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  debtMode === 'open'
                    ? 'bg-primary-custom text-white shadow-md'
                    : 'text-muted hover:text-app'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Monto Fijo / Abierto</span>
              </button>
            </div>
          </div>

          {/* 1. Nombre / Concepto de la Deuda */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              1. Nombre / Concepto de la Deuda
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Cashea - Teléfono, Préstamo Personal, Repuestos Moto..."
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom"
            />
          </div>

          {/* 2. Categoría / Plataforma (Tipo de Acreedor) - Styled Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              2. Categoría / Plataforma (Tipo de Acreedor)
            </label>
            <div className="relative">
              <select
                value={platform}
                onChange={(e) => handleSelectPlatform(e.target.value as DebtPlatformType)}
                className="w-full bg-card border border-app rounded-xl px-3.5 py-2.5 text-xs font-bold text-app appearance-none focus:outline-none focus:ring-2 focus:ring-primary-custom cursor-pointer"
              >
                <option value="cashea" className="bg-slate-900 text-white">🟡 Cashea</option>
                <option value="creditotal" className="bg-slate-900 text-white">🔵 CrediTotal</option>
                <option value="multimax" className="bg-slate-900 text-white">🏬 Multimax / Tiendas por Departamento</option>
                <option value="particular" className="bg-slate-900 text-white">🤝 Particular / Familiar / Amigo</option>
                <option value="banco" className="bg-slate-900 text-white">🏦 Tarjeta de Crédito / Banco</option>
                <option value="other" className="bg-slate-900 text-white">📌 Otro / General</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Monto de la Deuda */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Monto Total de la Deuda ($ USD)
            </label>
            <MoneyInput
              value={debtAmount}
              onChange={handleDebtAmountChange}
              currencySymbol="$"
              placeholder="0,00"
              required
            />
          </div>

          {/* Modalidad A: Por Cuotas (SIN intereses y con campo Monto Inicial) */}
          {debtMode === 'installments' && (
            <div className="p-3.5 rounded-2xl bg-card border border-app space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  Estructura de Cuotas
                </span>
                {initialPayment > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#00C2C7]/15 text-[#00C2C7] border border-[#00C2C7]/20">
                    Restante: ${remainingAmount.toFixed(2)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] text-muted font-medium mb-1">
                    Monto Inicial ($) <span className="text-[9px] text-muted font-normal">(Opcional)</span>
                  </label>
                  <MoneyInput
                    value={initialPayment}
                    onChange={handleInitialPaymentChange}
                    currencySymbol="$"
                    placeholder="0,00"
                    className="!py-1.5 !text-xs !font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-medium mb-1">Total de Cuotas</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={totalInstallments}
                    onChange={(e) => handleInstallmentsChange(e.target.value)}
                    className="w-full bg-surface border border-app rounded-xl px-2.5 py-1.5 text-xs font-bold text-app focus:outline-none focus:ring-1 focus:ring-primary-custom"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-muted font-medium mb-1">Monto por Cuota ($)</label>
                  <MoneyInput
                    value={installmentAmount}
                    onChange={setInstallmentAmount}
                    currencySymbol="$"
                    placeholder="0,00"
                    required
                    className="!py-1.5 !text-xs !font-bold !text-[#00C2C7]"
                  />
                </div>
              </div>

              {initialPayment > 0 && (
                <div className="text-[11px] text-muted bg-surface/80 px-2.5 py-1.5 rounded-xl border border-app">
                  Monto por Cuota: <strong className="text-[#00C2C7]">${installmentAmount.toFixed(2)}</strong> (después de inicial de <strong className="text-app">${initialPayment.toFixed(2)}</strong>)
                </div>
              )}

              {/* Selector Comenzar a pagar a partir de */}
              <div className="relative pt-1">
                <label className="block text-xs font-semibold text-muted mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary-custom" />
                  Fecha / Quincena de la primera cuota
                </label>
                <button
                  type="button"
                  onClick={() => setIsStartPeriodDropdownOpen(!isStartPeriodDropdownOpen)}
                  className="w-full bg-surface hover:bg-surface-hover border border-app rounded-xl px-3 py-2 text-xs text-app font-bold flex items-center justify-between transition-all cursor-pointer"
                >
                  <span>{selectedStartOpt.label}</span>
                  <ChevronDown className="w-4 h-4 text-muted" />
                </button>

                {isStartPeriodDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsStartPeriodDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl max-h-48 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      {startPeriodOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setStartPeriodKey(opt.key);
                            setIsStartPeriodDropdownOpen(false);
                          }}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                            startPeriodKey === opt.key
                              ? 'bg-primary-custom text-white shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modalidad B: Monto Abierto / Préstamo (ÚNICA con módulo de intereses) */}
          {debtMode === 'open' && (
            <div className="p-3.5 rounded-2xl bg-card border border-app space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-primary-custom" />
                  <span className="text-xs font-bold text-app">¿Genera Intereses?</span>
                </div>
                <div className="flex p-1 bg-surface rounded-xl border border-app">
                  <button
                    type="button"
                    onClick={() => handleToggleHasInterest(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      hasInterest
                        ? 'bg-primary-custom text-white shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleHasInterest(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !hasInterest
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {hasInterest && (
                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-300 font-semibold mb-1 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-primary-custom" /> Tasa de Interés (%)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej. 20%"
                        value={interestRate}
                        onChange={(e) => handleInterestRateChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:ring-1 focus:ring-primary-custom outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-300 font-semibold mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-[#FF914D]" /> Monto de Interés ($)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={interestAmount}
                        onChange={(e) => handleInterestAmountChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#FF914D] focus:ring-1 focus:ring-primary-custom outline-none"
                      />
                    </div>
                  </div>

                  {/* Frecuencia de Intereses */}
                  <div>
                    <label className="block text-[10px] text-slate-300 font-semibold mb-1">
                      Frecuencia de Cobro de Intereses
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setInterestFrequency('monthly')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          interestFrequency === 'monthly'
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Mensual
                      </button>
                      <button
                        type="button"
                        onClick={() => setInterestFrequency('fortnightly')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          interestFrequency === 'fortnightly'
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Quincenal
                      </button>
                    </div>
                  </div>

                  {/* Quincena de Pago de Intereses */}
                  <div>
                    <label className="block text-[10px] text-slate-300 font-semibold mb-1">
                      Fecha / Quincena de Pago de Intereses
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setInterestFortnight('q1')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          interestFortnight === 'q1'
                            ? 'bg-[#00C2C7] text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Quincena 15
                      </button>
                      <button
                        type="button"
                        onClick={() => setInterestFortnight('q2')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          interestFortnight === 'q2'
                            ? 'bg-[#00C2C7] text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Quincena 30
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Fecha Límite / Vencimiento (Opcional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs font-bold text-app focus:outline-none focus:ring-1 focus:ring-primary-custom"
                />
              </div>
            </div>
          )}

          {/* Quincena Habitual Asignada */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Quincena Habitual para Abonar
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-card rounded-xl border border-app">
              {[
                { id: 'q1' as const, label: 'Quincena 15' },
                { id: 'q2' as const, label: 'Quincena 30' },
                { id: 'both' as const, label: 'Ambas (15 y 30)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFortnightDue(opt.id)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    fortnightDue === opt.id
                      ? 'bg-primary-custom text-white shadow-sm'
                      : 'text-muted hover:text-app'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo / Modalidad de Pago */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Tipo / Modalidad de Pago
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-card rounded-xl border border-app">
              {[
                { id: 'bcv_usd' as const, label: 'Tasa BCV (USD/Bs)' },
                { id: 'cash' as const, label: 'Efectivo Cash ($)' },
                { id: 'bcv_eur' as const, label: 'Euro BCV (€/Bs)' },
                { id: 'other' as const, label: 'Binance / Otros' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentType(opt.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                    paymentType === opt.id
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
              Notas y Condiciones
            </label>
            <input
              type="text"
              placeholder="Ej. Datos de pago, plazo acordado o referencia..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
            />
          </div>

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
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#FF914D] to-[#e57d3b] text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : editingDebt ? 'Actualizar Deuda' : 'Guardar Deuda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
