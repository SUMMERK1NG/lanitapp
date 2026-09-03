import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Landmark,
  PiggyBank,
  CreditCard,
  Smartphone,
  Plus,
  Edit2,
  Trash2,
  Sliders,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { Account, AccountType, Transaction, Category, ExchangeRatesData } from '../types/index.ts';
import { saveAccount, deleteAccount, adjustAccountBalance, addTransaction } from '../lib/db.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';
import { logger } from '../utils/logger.ts';

interface AccountsManagementModuleProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  rates: ExchangeRatesData;
}

const ACCOUNT_TYPE_OPTIONS: { id: AccountType; label: string; icon: string; desc: string }[] = [
  { id: 'cash', label: 'Efectivo Cash', icon: '💵', desc: 'Billetes físicos USD / EUR / Divisas' },
  { id: 'bank', label: 'Banco / Pago Móvil', icon: '🏦', desc: 'Banesco, Mercantil, BDV, Pago Móvil' },
  { id: 'digital', label: 'Billetera Digital', icon: '📱', desc: 'Binance USDT, Zinli, Wally, Paypal' },
  { id: 'savings', label: 'Fondo de Ahorro', icon: '🐷', desc: 'Reserva especial o cuenta de metas' },
  { id: 'credit', label: 'Tarjeta de Crédito', icon: '💳', desc: 'Líneas de crédito bancario' },
];

const CURRENCY_OPTIONS: { id: 'USD' | 'VES' | 'EUR'; label: string; icon: string; symbol: string }[] = [
  { id: 'USD', label: 'Dólares ($ USD)', icon: '💵', symbol: '$' },
  { id: 'VES', label: 'Bolívares (Bs. VES)', icon: '🇻🇪', symbol: 'Bs.' },
  { id: 'EUR', label: 'Euros (€ EUR)', icon: '💶', symbol: '€' },
];

export const AccountsManagementModule: React.FC<AccountsManagementModuleProps> = ({
  accounts,
  transactions,
  categories,
  rates,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'cash' | 'bank' | 'digital'>('all');

  // Modal states
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form states for Create/Edit Account
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<AccountType>('cash');
  const [currency, setCurrency] = useState<'USD' | 'VES' | 'EUR'>('USD');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Dropdown open states
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState<boolean>(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState<boolean>(false);

  // Quick adjustment modal
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [adjustMode, setAdjustMode] = useState<'income' | 'expense' | 'set_balance'>('income');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustDescription, setAdjustDescription] = useState<string>('');
  const [adjustCategoryId, setAdjustCategoryId] = useState<string>('');
  const [isAdjustCategoryDropdownOpen, setIsAdjustCategoryDropdownOpen] = useState<boolean>(false);
  const [isAdjustSubmitting, setIsAdjustSubmitting] = useState<boolean>(false);

  // Deleting confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Helper to get real calculated current balance for any account
  const getAccountBalance = (account: Account) => {
    const accTxs = transactions.filter((t) => t.account_id === account.id);
    const income = accTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = accTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return account.initial_balance + income - expense;
  };

  // Rates
  const bcvUsd = rates.bcvDollar > 0 ? rates.bcvDollar : 1;
  const bcvEur = rates.bcvEuro > 0 ? rates.bcvEuro : 1;

  // Aggregate totals
  const { totalCapitalUSD, totalUSD, totalVES, totalEUR } = useMemo(() => {
    let capUSD = 0;
    let uUSD = 0;
    let uVES = 0;
    let uEUR = 0;

    accounts.forEach((acc) => {
      const bal = getAccountBalance(acc);
      if (acc.currency === 'VES') {
        uVES += bal;
        capUSD += bal / bcvUsd;
      } else if (acc.currency === 'EUR') {
        uEUR += bal;
        capUSD += (bal * bcvEur) / bcvUsd;
      } else {
        uUSD += bal;
        capUSD += bal;
      }
    });

    return {
      totalCapitalUSD: capUSD,
      totalUSD: uUSD,
      totalVES: uVES,
      totalEUR: uEUR,
    };
  }, [accounts, transactions, bcvUsd, bcvEur]);

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    if (filterType === 'cash') return accounts.filter((a) => a.type === 'cash' || a.currency === 'USD' || a.currency === 'EUR');
    if (filterType === 'bank') return accounts.filter((a) => a.type === 'bank' || a.currency === 'VES');
    if (filterType === 'digital') return accounts.filter((a) => a.type === 'digital' || a.type === 'savings' || a.type === 'credit');
    return accounts;
  }, [accounts, filterType]);

  // Open modal for new account
  const handleOpenNewAccount = () => {
    setEditingAccount(null);
    setName('');
    setType('cash');
    setCurrency('USD');
    setInitialBalance(0);
    setNotes('');
    setIsTypeDropdownOpen(false);
    setIsCurrencyDropdownOpen(false);
    setIsAccountModalOpen(true);
  };

  // Open modal to edit account
  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setCurrency((acc.currency as any) || 'USD');
    setInitialBalance(acc.initial_balance || 0);
    setNotes(acc.notes || '');
    setIsTypeDropdownOpen(false);
    setIsCurrencyDropdownOpen(false);
    setIsAccountModalOpen(true);
  };

  // Save Account Handler
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await saveAccount({
        id: editingAccount?.id,
        name: name.trim(),
        type,
        currency,
        initial_balance: initialBalance,
        notes: notes.trim(),
      });
      setIsAccountModalOpen(false);
    } catch (err) {
      logger.error('Error saving account:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Account Handler
  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteAccount(id);
      setDeletingId(null);
    } catch (err) {
      logger.error('Error deleting account:', err);
    }
  };

  // Open Quick Adjustment Modal
  const handleOpenAdjust = (acc: Account) => {
    setAdjustingAccount(acc);
    setAdjustMode('income');
    setAdjustAmount(0);
    setAdjustDescription('');
    const defaultCat = categories.find((c) => c.type === 'income')?.id || categories[0]?.id || '';
    setAdjustCategoryId(defaultCat);
    setIsAdjustCategoryDropdownOpen(false);
  };

  // Execute Quick Adjustment
  const handleExecuteAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccount) return;
    const num = adjustAmount;
    if (isNaN(num) || num < 0) return;

    setIsAdjustSubmitting(true);
    try {
      if (adjustMode === 'set_balance') {
        const accTxs = transactions.filter((t) => t.account_id === adjustingAccount.id);
        const income = accTxs
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const expense = accTxs
          .filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        const newInitial = num - (income - expense);
        await adjustAccountBalance(adjustingAccount.id, newInitial);
      } else {
        await addTransaction({
          account_id: adjustingAccount.id,
          amount: num,
          type: adjustMode,
          description: adjustDescription.trim() || (adjustMode === 'income' ? 'Ingreso a cuenta' : 'Retiro de cuenta'),
          category_id: adjustCategoryId || (adjustMode === 'income' ? 'cat_salary' : 'cat_other_exp'),
          transaction_date: new Date().toISOString().split('T')[0],
        });
      }
      setAdjustingAccount(null);
    } catch (err) {
      logger.error('Error adjusting account:', err);
    } finally {
      setIsAdjustSubmitting(false);
    }
  };

  const getAccountIcon = (accType: AccountType) => {
    switch (accType) {
      case 'cash':
        return <Wallet className="w-5 h-5 text-[#00c2c7]" />;
      case 'bank':
        return <Landmark className="w-5 h-5 text-[#147df0]" />;
      case 'digital':
        return <Smartphone className="w-5 h-5 text-purple-400" />;
      case 'savings':
        return <PiggyBank className="w-5 h-5 text-emerald-400" />;
      case 'credit':
        return <CreditCard className="w-5 h-5 text-[#ff914d]" />;
      default:
        return <Wallet className="w-5 h-5 text-muted" />;
    }
  };

  const getAccountTypeLabel = (accType: AccountType) => {
    switch (accType) {
      case 'cash':
        return 'Efectivo Cash';
      case 'bank':
        return 'Banco / Pago Móvil';
      case 'digital':
        return 'Billetera Digital';
      case 'savings':
        return 'Fondo de Ahorro';
      case 'credit':
        return 'Tarjeta de Crédito';
      default:
        return 'Fondo General';
    }
  };

  const selectedTypeObj = ACCOUNT_TYPE_OPTIONS.find((o) => o.id === type) || ACCOUNT_TYPE_OPTIONS[0];
  const selectedCurrencyObj = CURRENCY_OPTIONS.find((c) => c.id === currency) || CURRENCY_OPTIONS[0];
  const selectedAdjustCat = categories.find((c) => c.id === adjustCategoryId) || categories[0];

  return (
    <div className="space-y-4">
      {/* 1. Header with Consistent App Layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-app">Capital</h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Saldos y fondos en efectivo, bancos y divisas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewAccount}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cuenta</span>
          </button>
        </div>
      </div>

      {/* 2. Unified 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total Capital */}
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Capital Total Disponible</span>
          <p className="text-xl sm:text-2xl font-black text-primary-custom tracking-tight">
            ${totalCapitalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block truncate">
            ≈ Bs. {(totalCapitalUSD * bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Card 2: Divisas / USD & EUR */}
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Divisas ($ / €)</span>
          <p className="text-xl sm:text-2xl font-black text-[#00C2C7] tracking-tight">
            ${totalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block truncate">
            {totalEUR > 0 ? `+ €${totalEUR.toFixed(2)} EUR en cuentas` : 'Billeteras digitales y efectivo'}
          </span>
        </div>

        {/* Card 3: Bank / VES */}
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Bancos & Pago Móvil (Bs.)</span>
          <p className="text-xl sm:text-2xl font-black text-[#FF914D] tracking-tight truncate">
            Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block truncate">
            ≈ ${(totalVES / bcvUsd).toFixed(2)} USD
          </span>
        </div>

        {/* Card 4: Total Accounts */}
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Cuentas Activas</span>
          <p className="text-xl sm:text-2xl font-black text-app tracking-tight">
            {accounts.length}
          </p>
          <span className="text-[11px] text-muted block">Fondos sincronizados</span>
        </div>
      </div>

      {/* 3. Segmented Filter Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-card rounded-2xl border border-app w-fit">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'all' ? 'bg-primary-custom text-white shadow-sm' : 'text-muted hover:text-app'
          }`}
        >
          Todas ({accounts.length})
        </button>
        <button
          onClick={() => setFilterType('cash')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'cash' ? 'bg-primary-custom text-white shadow-sm' : 'text-muted hover:text-app'
          }`}
        >
          Divisas ({accounts.filter((a) => a.currency !== 'VES').length})
        </button>
        <button
          onClick={() => setFilterType('bank')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'bank' ? 'bg-primary-custom text-white shadow-sm' : 'text-muted hover:text-app'
          }`}
        >
          Bancos & Bs ({accounts.filter((a) => a.currency === 'VES').length})
        </button>
      </div>

      {/* 4. Account Cards Grid or Empty State */}
      {filteredAccounts.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-primary-custom/15 text-primary-custom flex items-center justify-center shadow-xl shadow-primary-custom/10 border border-primary-custom/20">
            <Wallet className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-app">
              Sin cuentas registradas
            </h3>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              Agrega tus cuentas de efectivo, bancos o billeteras digitales para calcular tu balance disponible automáticamente.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenNewAccount}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-95 transition-all shadow-md cursor-pointer mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cuenta / Fondo</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredAccounts.map((acc) => {
            const currentBal = getAccountBalance(acc);
            const isNegative = currentBal < 0;
            const accTxsCount = transactions.filter((t) => t.account_id === acc.id).length;

            return (
              <div
                key={acc.id}
                className="rounded-3xl bg-surface border border-app p-4 shadow-sm hover:border-primary-custom/50 transition-all flex flex-col justify-between space-y-3.5"
              >
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-card border border-app flex items-center justify-center shrink-0">
                      {getAccountIcon(acc.type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-app">{acc.name}</h4>
                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                        {getAccountTypeLabel(acc.type)} • {acc.currency}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditAccount(acc)}
                      className="p-1.5 rounded-lg hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
                      title="Editar cuenta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(acc.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-muted hover:text-rose-400 transition-colors cursor-pointer"
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Balance Section */}
                <div className="p-3 rounded-2xl bg-card border border-app space-y-1">
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                    Saldo Actual
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-xl font-black ${
                        isNegative ? 'text-rose-400' : acc.currency === 'VES' ? 'text-[#FF914D]' : 'text-[#00c2c7]'
                      }`}
                    >
                      {acc.currency === 'VES' ? 'Bs. ' : acc.currency === 'EUR' ? '€' : '$'}
                      {currentBal.toLocaleString('es-VE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    {acc.currency === 'VES' && (
                      <span className="text-xs font-bold text-muted">
                        ≈ ${(currentBal / bcvUsd).toFixed(2)} USD
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-app text-xs">
                  <span className="text-[10px] text-muted font-medium">
                    {accTxsCount} {accTxsCount === 1 ? 'movimiento' : 'movimientos'}
                  </span>

                  <button
                    onClick={() => handleOpenAdjust(acc)}
                    className="px-2.5 py-1 rounded-xl bg-primary-custom/15 text-primary-custom hover:bg-primary-custom hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Ajustar / Fondear</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Nueva / Editar Cuenta */}
      {isAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 cursor-pointer"
          onClick={() => setIsAccountModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-surface border border-app rounded-3xl shadow-2xl text-app max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-app shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app">
                    {editingAccount ? 'Editar Cuenta / Fondo' : 'Nueva Cuenta / Fondo'}
                  </h3>
                  <p className="text-[11px] text-muted">Configura tus fondos de efectivo, bancos o billeteras</p>
                </div>
              </div>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scrollbar Interno */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
              <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre de la Cuenta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Banesco, Efectivo Cartera, Binance USDT, Zinli..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-sm text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Custom Dropdown: Tipo de Cuenta */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Tipo de Cuenta
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTypeDropdownOpen(!isTypeDropdownOpen);
                      setIsCurrencyDropdownOpen(false);
                    }}
                    className="w-full bg-card border border-app hover:border-app-hover rounded-xl px-3 py-2.5 text-xs text-app font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{selectedTypeObj.icon}</span>
                      <span className="truncate">{selectedTypeObj.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform shrink-0 ${isTypeDropdownOpen ? 'rotate-180 text-primary-custom' : ''}`} />
                  </button>

                  {isTypeDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface border border-app rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in-50 zoom-in-95">
                      {ACCOUNT_TYPE_OPTIONS.map((opt) => {
                        const isSelected = opt.id === type;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setType(opt.id);
                              setIsTypeDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                              isSelected ? 'bg-primary-custom/15 text-primary-custom font-bold' : 'hover:bg-card text-app'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">{opt.icon}</span>
                              <div>
                                <span className="text-xs font-bold block leading-tight">{opt.label}</span>
                                <span className="text-[10px] text-muted block">{opt.desc}</span>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-primary-custom shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Dropdown: Moneda Principal */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Moneda Principal
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen);
                      setIsTypeDropdownOpen(false);
                    }}
                    className="w-full bg-card border border-app hover:border-app-hover rounded-xl px-3 py-2.5 text-xs text-app font-bold flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{selectedCurrencyObj.icon}</span>
                      <span className="truncate">{selectedCurrencyObj.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform shrink-0 ${isCurrencyDropdownOpen ? 'rotate-180 text-primary-custom' : ''}`} />
                  </button>

                  {isCurrencyDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface border border-app rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in-50 zoom-in-95">
                      {CURRENCY_OPTIONS.map((cur) => {
                        const isSelected = cur.id === currency;
                        return (
                          <button
                            key={cur.id}
                            type="button"
                            onClick={() => {
                              setCurrency(cur.id);
                              setIsCurrencyDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                              isSelected ? 'bg-primary-custom/15 text-primary-custom font-bold' : 'hover:bg-card text-app'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{cur.icon}</span>
                              <span className="text-xs font-bold">{cur.label}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-primary-custom shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Saldo Inicial
                </label>
                <MoneyInput
                  value={initialBalance}
                  onChange={setInitialBalance}
                  currencySymbol={currency === 'VES' ? 'Bs.' : currency === 'EUR' ? '€' : '$'}
                  placeholder="0,00"
                  className="!py-2.5 !text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Datos de cuenta, uso asignado..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingAccount ? 'Actualizar Cuenta' : 'Guardar Cuenta'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ajustar / Fondear Balance */}
      {adjustingAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 cursor-pointer"
          onClick={() => setAdjustingAccount(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-app rounded-3xl shadow-2xl text-app max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-app shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app">
                    Ajustar / Fondear Cuenta
                  </h3>
                  <p className="text-[11px] text-muted">{adjustingAccount.name} ({adjustingAccount.currency})</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingAccount(null)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scrollbar Interno */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
              <form onSubmit={handleExecuteAdjust} className="space-y-4">
              {/* Adjustment Mode Selector */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-card rounded-2xl border border-app text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAdjustMode('income')}
                  className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    adjustMode === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted hover:text-app'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Ingreso</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('expense')}
                  className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    adjustMode === 'expense' ? 'bg-[#FF914D] text-white shadow-sm' : 'text-muted hover:text-app'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Retiro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('set_balance')}
                  className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    adjustMode === 'set_balance' ? 'bg-primary-custom text-white shadow-sm' : 'text-muted hover:text-app'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Fijar Saldo</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  {adjustMode === 'set_balance' ? 'Nuevo Saldo Exacto' : 'Monto del Ajuste'}
                </label>
                <MoneyInput
                  value={adjustAmount}
                  onChange={setAdjustAmount}
                  currencySymbol={adjustingAccount.currency === 'VES' ? 'Bs.' : adjustingAccount.currency === 'EUR' ? '€' : '$'}
                  placeholder="0,00"
                  autoFocus
                  required
                />
              </div>

              {adjustMode !== 'set_balance' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Descripción del Movimiento
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Fondeo en efectivo, Pago móvil recibido, Retiro cajero..."
                      value={adjustDescription}
                      onChange={(e) => setAdjustDescription(e.target.value)}
                      className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                    />
                  </div>

                  {/* Custom Dropdown: Categoría */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Categoría
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAdjustCategoryDropdownOpen(!isAdjustCategoryDropdownOpen)}
                      className="w-full bg-card border border-app hover:border-app-hover rounded-xl px-3 py-2.5 text-xs text-app font-bold flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="truncate">{selectedAdjustCat?.name || 'Seleccionar categoría'}</span>
                      <ChevronDown className={`w-4 h-4 text-muted transition-transform shrink-0 ${isAdjustCategoryDropdownOpen ? 'rotate-180 text-primary-custom' : ''}`} />
                    </button>

                    {isAdjustCategoryDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface border border-app rounded-2xl shadow-2xl p-1.5 max-h-48 overflow-y-auto space-y-1 animate-in fade-in-50 zoom-in-95">
                        {categories
                          .filter((c) => (adjustMode === 'income' ? c.type === 'income' : c.type === 'expense'))
                          .map((c) => {
                            const isSelected = c.id === adjustCategoryId;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setAdjustCategoryId(c.id);
                                  setIsAdjustCategoryDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                                  isSelected ? 'bg-primary-custom/15 text-primary-custom font-bold' : 'hover:bg-card text-app'
                                }`}
                              >
                                <span className="text-xs font-medium truncate">{c.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary-custom shrink-0" />}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAdjustingAccount(null)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAdjustSubmitting || adjustAmount <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAdjustSubmitting ? 'Aplicando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 cursor-pointer"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app text-center space-y-3 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-app">¿Eliminar esta cuenta?</h4>
            <p className="text-xs text-muted">
              Esta acción eliminará el registro de la cuenta. Las transacciones asociadas conservarán su histórico.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAccount(deletingId)}
                className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-all cursor-pointer shadow-md"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
