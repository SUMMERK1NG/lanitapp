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
  DollarSign,
  TrendingUp,
  X,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import type { Account, AccountType, Transaction, Category, ExchangeRatesData } from '../types/index.ts';
import { saveAccount, deleteAccount, adjustAccountBalance, addTransaction } from '../lib/db.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface AccountsManagementModuleProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  rates: ExchangeRatesData;
}

export const AccountsManagementModule: React.FC<AccountsManagementModuleProps> = ({
  accounts,
  transactions,
  categories,
  rates,
}) => {
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

  // Quick adjustment modal
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [adjustMode, setAdjustMode] = useState<'income' | 'expense' | 'set_balance'>('income');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustDescription, setAdjustDescription] = useState<string>('');
  const [adjustCategoryId, setAdjustCategoryId] = useState<string>('');
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

  // Open modal for new account
  const handleOpenNewAccount = () => {
    setEditingAccount(null);
    setName('');
    setType('cash');
    setCurrency('USD');
    setInitialBalance(0);
    setNotes('');
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
      console.error('Error saving account:', err);
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
      console.error('Error deleting account:', err);
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
        // Direct balance adjustment: calculate what initial_balance must be
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
        // Add transaction (income or expense)
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
      console.error('Error adjusting account:', err);
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

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Account CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-app tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <span>Capital & Cuentas</span>
          </h2>
          <p className="text-xs text-muted mt-1">
            Control en tiempo real de efectivo, bancos, pago móvil y fondos en divisas
          </p>
        </div>

        <button
          onClick={handleOpenNewAccount}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary-custom to-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-custom/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Cuenta / Fondo</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Total Capital Converted */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#147df0] via-[#106ad0] to-[#203657] text-white p-5 shadow-xl shadow-[#147df0]/15 border border-[#147df0]/30">
          <div className="relative z-10">
            <span className="text-[11px] font-bold text-blue-100 uppercase tracking-wider block mb-1">
              Capital Total Disponible
            </span>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              ${totalCapitalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs md:text-sm font-medium text-slate-300 mt-1">
              ≈ Bs. {(totalCapitalUSD * (bcvUsd || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Tasa BCV: Bs. {(bcvUsd || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </p>
          </div>
        </div>

        {/* Total USD / Cash & Digital */}
        <div className="p-4 rounded-3xl bg-surface border border-app shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-muted font-bold">
            <span>Efectivo & Divisas ($)</span>
            <DollarSign className="w-4 h-4 text-[#00c2c7]" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#00c2c7]">
            ${totalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-muted">
            {totalEUR > 0 ? `+ €${totalEUR.toFixed(2)} EUR en cuentas` : 'En billeteras y efectivo físico'}
          </span>
        </div>

        {/* Total VES / Bank */}
        <div className="p-4 rounded-3xl bg-surface border border-app shadow-md space-y-1">
          <div className="flex items-center justify-between text-xs text-muted font-bold">
            <span>Bancos & Pago Móvil (Bs.)</span>
            <TrendingUp className="w-4 h-4 text-[#FF914D]" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#FF914D]">
            Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-muted">
            ≈ ${(totalVES / bcvUsd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD @ Bs. {bcvUsd.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Account Cards Grid or Empty State */}
      {accounts.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-primary-custom/15 text-primary-custom flex items-center justify-center shadow-xl shadow-primary-custom/10 border border-primary-custom/20">
            <Wallet className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-app">
              Comienza registrando tus fondos
            </h3>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              Agrega tus cuentas de efectivo, bancos o billeteras digitales para calcular tu balance disponible automáticamente.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenNewAccount}
              className="px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-95 transition-all shadow-md cursor-pointer"
            >
              + Registrar Primera Cuenta
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {accounts.map((acc) => {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app max-h-[90vh] overflow-y-auto animate-in zoom-in-95 no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <div className="flex items-center gap-2">
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

            <form onSubmit={handleSaveAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre de la Cuenta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Efectivo Billetes, Banesco Pago Móvil, Zelle..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Account Type Selector (Pill Grid) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Tipo de Cuenta / Fondo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'cash' as const, label: '💵 Efectivo', type: 'cash' },
                    { id: 'bank' as const, label: '🏦 Banco / Pago M.', type: 'bank' },
                    { id: 'digital' as const, label: '📱 Digital (Zelle)', type: 'digital' },
                    { id: 'savings' as const, label: '🐷 Ahorro', type: 'savings' },
                    { id: 'credit' as const, label: '💳 Tarjeta', type: 'credit' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setType(opt.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
                        type === opt.id
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'bg-card border border-app text-muted hover:text-app'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Selector (Pills) */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Moneda Principal
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-card rounded-xl border border-app">
                  {[
                    { id: 'USD' as const, label: '🇺🇸 USD ($)' },
                    { id: 'VES' as const, label: '🇻🇪 VES (Bs)' },
                    { id: 'EUR' as const, label: '🇪🇺 EUR (€)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCurrency(opt.id)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                        currency === opt.id
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'text-muted hover:text-app'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Balance */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Saldo Inicial ({currency})
                </label>
                <MoneyInput
                  value={initialBalance}
                  onChange={setInitialBalance}
                  currencySymbol={currency === 'VES' ? 'Bs' : currency === 'EUR' ? '€' : '$'}
                  placeholder="0,00"
                  required
                  className="!py-2 !text-sm"
                />
                <span className="text-[10px] text-muted mt-1 block">
                  El balance final se ajustará automáticamente sumando ingresos y restando egresos de esta cuenta.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Ej. Billetes en sobre, cuenta custodia..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
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
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-95 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingAccount ? 'Actualizar Cuenta' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ajuste Rápido de Cuenta */}
      {adjustingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app max-h-[90vh] overflow-y-auto animate-in zoom-in-95 no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app">
                    Ajustar Fondos: {adjustingAccount.name}
                  </h3>
                  <p className="text-[11px] text-muted">
                    Saldo actual: <strong>{adjustingAccount.currency === 'VES' ? 'Bs. ' : '$'}{getAccountBalance(adjustingAccount).toFixed(2)}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingAccount(null)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjust} className="space-y-4">
              {/* Operation Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Tipo de Operación
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-card rounded-xl border border-app">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('income');
                      const firstInc = categories.find(c => c.type === 'income')?.id || '';
                      setAdjustCategoryId(firstInc);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      adjustMode === 'income'
                        ? 'bg-[#00C2C7] text-slate-950 shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Ingreso (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode('expense');
                      const firstExp = categories.find(c => c.type === 'expense')?.id || '';
                      setAdjustCategoryId(firstExp);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      adjustMode === 'expense'
                        ? 'bg-[#FF914D] text-slate-950 shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Gasto (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustMode('set_balance')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      adjustMode === 'set_balance'
                        ? 'bg-primary-custom text-white shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fijar Saldo</span>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  {adjustMode === 'set_balance' ? 'Nuevo Saldo Total' : 'Monto de la Operación'} ({adjustingAccount.currency})
                </label>
                <MoneyInput
                  value={adjustAmount}
                  onChange={setAdjustAmount}
                  currencySymbol={adjustingAccount.currency === 'VES' ? 'Bs' : '$'}
                  placeholder="0,00"
                  autoFocus
                  required
                  className="!py-2.5 !text-base"
                />
              </div>

              {/* Description & Category if transaction */}
              {adjustMode !== 'set_balance' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Concepto / Descripción
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Recarga de saldo, cambio de divisas, retiro..."
                      value={adjustDescription}
                      onChange={(e) => setAdjustDescription(e.target.value)}
                      className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Categoría
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                      {categories
                        .filter((c) => (adjustMode === 'income' ? c.type === 'income' : c.type === 'expense'))
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setAdjustCategoryId(c.id)}
                            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              adjustCategoryId === c.id
                                ? 'border-primary-custom bg-card ring-2 ring-primary-custom text-app'
                                : 'border-app bg-card/60 text-muted hover:text-app'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || '#147df0' }} />
                            <span className="truncate">{c.name}</span>
                          </button>
                        ))}
                    </div>
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
                  disabled={isAdjustSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-95 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isAdjustSubmitting ? 'Aplicando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-app">¿Eliminar esta cuenta?</h3>
              <p className="text-xs text-muted">
                Los movimientos históricos seguirán registrados pero la cuenta ya no estará disponible para nuevos registros.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteAccount(deletingId)}
                className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-all cursor-pointer shadow-md"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
