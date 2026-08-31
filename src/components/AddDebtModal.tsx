import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CreditCard,
  Layers,
  DollarSign,
  Calendar,
  Percent,
  ChevronDown,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type {
  Debt,
  PaymentMethodType,
  FixedExpensePaymentMode,
  DebtPlatformType,
  DebtModeType,
  FortnightType,
  Category,
} from '../types/index.ts';
import { saveDebt } from '../services/debtsService.ts';
import { DEFAULT_CATEGORIES } from '../lib/db.ts';
import { parseCleanNumber } from '../utils/numberFormat.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';

// Lista estándar de modalidades de pago unificadas
export const PAYMENT_MODES_LIST: {
  id: FixedExpensePaymentMode;
  icon: string;
  label: string;
  currency: 'USD' | 'EUR' | 'VES';
  paymentType: PaymentMethodType;
}[] = [
  { id: 'usd_cash', icon: '💵', label: 'CASH USD', currency: 'USD', paymentType: 'cash' },
  { id: 'eur_cash', icon: '💶', label: 'CASH EURO', currency: 'EUR', paymentType: 'cash' },
  { id: 'ves_bcv', icon: '🏛️', label: 'DOLAR TASA BCV (BS)', currency: 'VES', paymentType: 'bcv_usd' },
  { id: 'ves_euro', icon: '🇪🇺', label: 'EURO TASA BCV (BS)', currency: 'VES', paymentType: 'bcv_eur' },
  { id: 'ves_parallel', icon: '⚡', label: 'DOLAR PROMEDIO (BS)', currency: 'VES', paymentType: 'bcv_usd' },
  { id: 'ves_fixed', icon: '🇻🇪', label: 'BOLIVARES MONTO FIJO', currency: 'VES', paymentType: 'bcv_usd' },
  { id: 'other', icon: '🌐', label: 'OTROS', currency: 'USD', paymentType: 'other' },
];

// Mapeo de nombres de iconos a componentes
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
  categories = [],
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
  const allCategories = useMemo(() => {
    return categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  }, [categories]);

  const expenseCategories = useMemo(() => {
    return allCategories.filter((cat) => cat.type === 'expense');
  }, [allCategories]);

  // Modalidad
  const [debtMode, setDebtMode] = useState<DebtModeType>(editingDebt?.debt_mode || initialDebtMode || 'installments');

  // 1. Nombre de la Deuda
  const [creditor, setCreditor] = useState<string>(editingDebt?.creditor || initialCreditor || '');

  // 2. Categoría
  const [platform, setPlatform] = useState<DebtPlatformType>(
    editingDebt?.platform || initialPlatform || (expenseCategories.length > 0 ? (expenseCategories[0].id as DebtPlatformType) : 'particular')
  );
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);

  // 3. Modalidad de Pago
  const [paymentMode, setPaymentMode] = useState<FixedExpensePaymentMode>(
    editingDebt?.payment_mode || (editingDebt?.payment_type === 'cash' ? 'usd_cash' : editingDebt?.payment_type === 'bcv_eur' ? 'ves_euro' : 'ves_bcv')
  );
  const [isPaymentModeDropdownOpen, setIsPaymentModeDropdownOpen] = useState<boolean>(false);

  // 4. Monto Total de Deuda
  const [debtAmount, setDebtAmount] = useState<number>(editingDebt?.total_amount || initialAmount || 0);

  // 5. Estructura de Cuotas (installments)
  const [initialPayment, setInitialPayment] = useState<number>(editingDebt?.initial_payment || 0);
  const [totalInstallments, setTotalInstallments] = useState<string>(editingDebt?.total_installments?.toString() || '4');
  const [pendingInstallments, setPendingInstallments] = useState<string>(editingDebt?.pending_installments?.toString() || '4');
  const [installmentAmount, setInstallmentAmount] = useState<number>(editingDebt?.installment_amount || 0);

  // Starting period
  const now = new Date();
  const initialStartYearVal = editingDebt?.start_year !== undefined ? editingDebt.start_year : (initialStartYear !== undefined ? initialStartYear : now.getFullYear());
  const initialStartMonthVal = editingDebt?.start_month !== undefined ? editingDebt.start_month : (initialStartMonth !== undefined ? initialStartMonth : now.getMonth());
  const initialStartFortnightVal = editingDebt?.start_fortnight || initialStartFortnight || (now.getDate() <= 15 ? 'q1' : 'q2');
  const [startPeriodKey, setStartPeriodKey] = useState<string>(
    `${initialStartYearVal}_${initialStartMonthVal}_${initialStartFortnightVal}`
  );
  const [isStartPeriodDropdownOpen, setIsStartPeriodDropdownOpen] = useState<boolean>(false);

  // 6. Penalización por Mora
  const [hasLateFee, setHasLateFee] = useState<boolean>(
    editingDebt?.has_late_fee || (editingDebt?.late_fee_amount ? editingDebt.late_fee_amount > 0 : false)
  );
  const [lateFeeAmount, setLateFeeAmount] = useState<number>(editingDebt?.late_fee_amount || 4);

  // Intereses (para 'open')
  const [hasInterest, setHasInterest] = useState<boolean>(
    editingDebt?.has_interest || (editingDebt?.interest_rate ? editingDebt.interest_rate > 0 : false)
  );
  const [interestRate, setInterestRate] = useState<string>(editingDebt?.interest_rate?.toString() || '10');
  const [interestAmount, setInterestAmount] = useState<string>(editingDebt?.interest_amount?.toString() || '0');
  const [interestFrequency, setInterestFrequency] = useState<'monthly' | 'fortnightly'>(
    editingDebt?.interest_frequency || 'monthly'
  );
  const [interestFortnight, setInterestFortnight] = useState<FortnightType>(
    editingDebt?.interest_fortnight || 'q2'
  );

  // 7. Quincena Habitual para Abonar
  const [fortnightDue, setFortnightDue] = useState<'q1' | 'q2' | 'both'>(editingDebt?.fortnight_due || 'q1');
  const [dueDay, setDueDay] = useState<string>(editingDebt?.due_day ? editingDebt.due_day.toString() : '');

  // 8. Notas
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
    const defaultPlatform = (expenseCategories.length > 0 ? (expenseCategories[0].id as DebtPlatformType) : 'particular');
    if (editingDebt) {
      setDebtMode(editingDebt.debt_mode || 'installments');
      setCreditor(editingDebt.creditor);
      setPlatform(editingDebt.platform || defaultPlatform);
      setPaymentMode(editingDebt.payment_mode || (editingDebt.payment_type === 'cash' ? 'usd_cash' : editingDebt.payment_type === 'bcv_eur' ? 'ves_euro' : 'ves_bcv'));
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

      setHasLateFee(Boolean(editingDebt.has_late_fee || (editingDebt.late_fee_amount && editingDebt.late_fee_amount > 0)));
      setLateFeeAmount(editingDebt.late_fee_amount || 4);

      setHasInterest(Boolean(editingDebt.has_interest || (editingDebt.interest_rate && editingDebt.interest_rate > 0)));
      setInterestRate(editingDebt.interest_rate?.toString() || '10');
      setInterestAmount(editingDebt.interest_amount?.toString() || '0');
      setInterestFrequency(editingDebt.interest_frequency || 'monthly');
      setInterestFortnight(editingDebt.interest_fortnight || 'q2');
      setDueDay(editingDebt.due_day ? editingDebt.due_day.toString() : '');
      setNotes(editingDebt.notes || '');
    } else if (isOpen) {
      const mode = initialDebtMode || 'installments';
      setDebtMode(mode);
      setCreditor(initialCreditor || (initialPlatform === 'particular' ? 'Préstamo Particular' : ''));
      setPlatform(initialPlatform || defaultPlatform);
      setPaymentMode('ves_bcv');
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

      setHasLateFee(mode === 'installments'); // Cashea / CrediTotal default on
      setLateFeeAmount(4);

      setHasInterest(mode === 'open');
      setInterestRate('10');
      setInterestAmount('0');
      setInterestFrequency('monthly');
      setInterestFortnight('q2');
      setDueDay('');
      setNotes(initialNotes || '');
    }
  }, [editingDebt, isOpen, initialAmount, initialCreditor, initialDebtMode, initialPlatform, initialStartYear, initialStartMonth, initialStartFortnight, initialNotes, categories]);

  // Recalculate cuota when total or installments change
  const handleDebtAmountChange = (val: number) => {
    setDebtAmount(val);
    const inst = parseInt(totalInstallments, 10);
    const rem = Math.max(0, val - initialPayment);
    if (inst > 0 && debtMode === 'installments') {
      setInstallmentAmount(Number((rem / inst).toFixed(2)));
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
      setInstallmentAmount(Number((rem / inst).toFixed(2)));
    }
  };

  const handleInstallmentsChange = (val: string) => {
    setTotalInstallments(val);
    setPendingInstallments(val);
    const inst = parseInt(val, 10);
    const rem = Math.max(0, debtAmount - initialPayment);
    if (inst > 0 && debtMode === 'installments') {
      setInstallmentAmount(Number((rem / inst).toFixed(2)));
    }
  };

  // Interest rate input handler
  const handleInterestRateChange = (raw: string) => {
    const val = raw.replace(/[^0-9.,]/g, '');
    setInterestRate(val);
    const rate = parseCleanNumber(val);
    if (!isNaN(rate) && debtAmount > 0) {
      setInterestAmount(((debtAmount * rate) / 100).toFixed(2));
    }
  };

  const handleInterestAmountChange = (raw: string) => {
    const val = raw.replace(/[^0-9.,]/g, '');
    setInterestAmount(val);
    const amountNum = parseCleanNumber(val);
    if (!isNaN(amountNum) && debtAmount > 0 && amountNum >= 0) {
      setInterestRate(((amountNum / debtAmount) * 100).toFixed(1));
    }
  };

  if (!isOpen) return null;

  const currentSelectedCategory = expenseCategories.find((c) => c.id === platform) || expenseCategories[0];
  const currentSelectedPaymentMode = PAYMENT_MODES_LIST.find((p) => p.id === paymentMode) || PAYMENT_MODES_LIST[0];
  const selectedStartOpt = startPeriodOptions.find((o) => o.key === startPeriodKey) || startPeriodOptions[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTotal = debtAmount;
    if (!creditor.trim() || isNaN(numTotal) || numTotal <= 0) return;

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
        due_day: dueDay ? parseInt(dueDay, 10) : undefined,
        start_year: selectedStartOpt.year,
        start_month: selectedStartOpt.month,
        start_fortnight: selectedStartOpt.fortnight,
        currency: currentSelectedPaymentMode.currency,
        payment_type: currentSelectedPaymentMode.paymentType,
        payment_mode: paymentMode,
        has_interest: debtMode === 'open' ? hasInterest : false,
        interest_rate: debtMode === 'open' && hasInterest ? parseCleanNumber(interestRate) || 0 : 0,
        interest_amount: debtMode === 'open' && hasInterest ? parseCleanNumber(interestAmount) || 0 : 0,
        interest_frequency: debtMode === 'open' && hasInterest ? interestFrequency : undefined,
        interest_fortnight: debtMode === 'open' && hasInterest ? interestFortnight : undefined,
        has_late_fee: hasLateFee,
        late_fee_amount: hasLateFee ? lateFeeAmount : 0,
        notes: notes.trim(),
      });
      if (onSaved) onSaved(savedDebt);
      onClose();
    } catch (err) {
      console.error('Error saving debt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[90vh] overflow-y-auto overflow-x-hidden animate-in zoom-in-95 no-scrollbar">
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
              <p className="text-[11px] text-muted">Modalidad por cuotas o monto abierto con cálculo de intereses y mora</p>
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

          {/* 1. Nombre de la Deuda */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Nombre de la Deuda
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Teléfono, Moto, Préstamo..."
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom"
            />
          </div>

          {/* 2. Categoría */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Categoría
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                  setIsPaymentModeDropdownOpen(false);
                  setIsStartPeriodDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-app bg-card text-app text-xs font-bold transition-all hover:bg-surface-hover cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: currentSelectedCategory?.color || '#3b82f6' }}
                  >
                    {renderIcon(currentSelectedCategory?.icon)}
                  </div>
                  <span>{currentSelectedCategory?.name || 'Seleccionar Categoría'}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCategoryDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-app rounded-2xl shadow-2xl z-30 max-h-48 overflow-y-auto p-1.5 space-y-1">
                  {expenseCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setPlatform(cat.id as DebtPlatformType);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                        platform === cat.id ? 'bg-primary-custom text-white' : 'text-app hover:bg-surface-hover'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs shrink-0"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      >
                        {renderIcon(cat.icon)}
                      </div>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. Forma / Modalidad de Pago (Unified Selector) */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Forma de Pago
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsPaymentModeDropdownOpen(!isPaymentModeDropdownOpen);
                  setIsCategoryDropdownOpen(false);
                  setIsStartPeriodDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-app bg-card text-app text-xs font-bold transition-all hover:bg-surface-hover cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{currentSelectedPaymentMode.icon}</span>
                  <span>{currentSelectedPaymentMode.label}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isPaymentModeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPaymentModeDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-app rounded-2xl shadow-2xl z-30 max-h-56 overflow-y-auto p-1.5 space-y-1">
                  {PAYMENT_MODES_LIST.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setPaymentMode(mode.id);
                        setIsPaymentModeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        paymentMode === mode.id
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'text-app hover:bg-surface-hover'
                      }`}
                    >
                      <span className="text-base">{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Monto Total de la Deuda */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              {debtMode === 'installments' ? 'Monto Total de la Deuda ($ USD)' : 'Monto Total / Saldo Inicial ($ USD)'}
            </label>
            <MoneyInput
              value={debtAmount}
              onChange={handleDebtAmountChange}
              currencySymbol="$"
              placeholder="0,00"
              required
            />
          </div>

          {/* 5. Estructura de Cuotas (Solo en modo installments) */}
          {debtMode === 'installments' && (
            <div className="p-3.5 rounded-2xl bg-card border border-app space-y-3">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                Estructura de Cuotas
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-1 truncate">
                    Inicial ($) (Opcional)
                  </label>
                  <MoneyInput
                    value={initialPayment}
                    onChange={handleInitialPaymentChange}
                    currencySymbol="$"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-1 truncate">
                    Total Cuotas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={totalInstallments}
                    onChange={(e) => handleInstallmentsChange(e.target.value)}
                    className="w-full bg-surface border border-app rounded-xl px-2.5 py-2 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-muted mb-1 truncate">
                    Monto por Cuota ($)
                  </label>
                  <MoneyInput
                    value={installmentAmount}
                    onChange={setInstallmentAmount}
                    currencySymbol="$"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Fecha / Quincena de inicio */}
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary-custom" />
                  Fecha / Quincena de la primera cuota
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsStartPeriodDropdownOpen(!isStartPeriodDropdownOpen);
                      setIsCategoryDropdownOpen(false);
                      setIsPaymentModeDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-app bg-surface text-app text-xs font-bold transition-all hover:bg-surface-hover cursor-pointer"
                  >
                    <span>{selectedStartOpt.label}</span>
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isStartPeriodDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isStartPeriodDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-app rounded-2xl shadow-2xl z-30 max-h-48 overflow-y-auto p-1.5 space-y-1">
                      {startPeriodOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setStartPeriodKey(opt.key);
                            setIsStartPeriodDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                            startPeriodKey === opt.key ? 'bg-primary-custom text-white' : 'text-app hover:bg-surface-hover'
                          }`}
                        >
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Configuración de Intereses (Solo en modo open) */}
          {debtMode === 'open' && (
            <div className="p-3.5 rounded-2xl bg-card border border-app space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-app flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-400" /> ¿Genera Intereses?
                </span>
                <button
                  type="button"
                  onClick={() => setHasInterest(!hasInterest)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    hasInterest ? 'bg-amber-500' : 'bg-surface border border-app'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      hasInterest ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {hasInterest && (
                <div className="space-y-2.5 pt-2 border-t border-app">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Tasa de Interés (%)</label>
                      <input
                        type="text"
                        value={interestRate}
                        onChange={(e) => handleInterestRateChange(e.target.value)}
                        placeholder="10"
                        className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Monto Interés ($ USD)</label>
                      <input
                        type="text"
                        value={interestAmount}
                        onChange={(e) => handleInterestAmountChange(e.target.value)}
                        placeholder="50.00"
                        className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted mb-1">Frecuencia</label>
                      <select
                        value={interestFrequency}
                        onChange={(e) => setInterestFrequency(e.target.value as 'monthly' | 'fortnightly')}
                        className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="monthly">Mensual</option>
                        <option value="fortnightly">Quincenal</option>
                      </select>
                    </div>
                    {interestFrequency === 'monthly' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-muted mb-1">Cobro el día</label>
                        <select
                          value={interestFortnight}
                          onChange={(e) => setInterestFortnight(e.target.value as FortnightType)}
                          className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="q1">Quincena 15</option>
                          <option value="q2">Quincena 30</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Penalización por Mora (Late Fee) */}
          <div className="p-3.5 rounded-2xl bg-card border border-app space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-app flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[#FF914D]" /> Penalización por Mora / Retraso
              </span>
              <button
                type="button"
                onClick={() => setHasLateFee(!hasLateFee)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  hasLateFee ? 'bg-[#FF914D]' : 'bg-surface border border-app'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    hasLateFee ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {hasLateFee && (
              <div className="space-y-2 pt-1 border-t border-app">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      Monto de Penalización ($ USD)
                    </label>
                    <MoneyInput
                      value={lateFeeAmount}
                      onChange={setLateFeeAmount}
                      currencySymbol="$"
                      placeholder="4.00"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FF914D] shrink-0 mt-0.5" />
                  <span>
                    Ej. <strong>Cashea ($4.00)</strong> o cargo por mora bancaria. Si una cuota no se abona o se marca como omitida/morosa, este recargo se sumará automáticamente al saldo de la deuda.
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* 7. Día del Mes y Quincena Habitual para Abonar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Día de Corte / Pago (1-31)
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => {
                  const val = e.target.value;
                  setDueDay(val);
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num >= 1 && num <= 31) {
                    setFortnightDue(num <= 15 ? 'q1' : 'q2');
                  }
                }}
                placeholder="Ej. 12, 18, 25..."
                className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs font-bold text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Quincena Habitual
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-card rounded-xl border border-app">
                {[
                  { id: 'q1', label: 'Q15' },
                  { id: 'q2', label: 'Q30' },
                  { id: 'both', label: 'Ambas' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFortnightDue(opt.id as any)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
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
          </div>

          {/* 8. Notas */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Notas
            </label>
            <input
              type="text"
              placeholder="Ej. Datos de pago, plazo acordado o referencia..."
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
              disabled={isSubmitting || !creditor.trim() || debtAmount <= 0}
              className="flex-1 py-2.5 rounded-xl bg-[#FF914D] hover:bg-[#ff8033] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : editingDebt ? 'Actualizar Deuda' : 'Guardar Deuda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
