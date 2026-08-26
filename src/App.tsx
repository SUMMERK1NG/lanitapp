import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  addTransaction,
  deleteTransaction,
  DEFAULT_CATEGORIES,
  migrateLocalDataToCloud,
  subscribeToRealtimeChanges,
} from './lib/db.ts';
import { useNetworkStatus } from './hooks/useNetworkStatus.ts';
import { useRealtimeSync } from './hooks/useRealtimeSync.ts';
import { useExchangeRates } from './hooks/useExchangeRates.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useAuth } from './hooks/useAuth.ts';
import { supabase, isSupabaseConfigured } from './lib/supabase.ts';
import type {
  Category,
  Account,
  Transaction,
  TransactionType,
  FixedIncome,
  VariableIncome,
  FixedExpense,
  Debt,
  DebtPayment,
  SavingsGoal,
  SavingContribution,
} from './types/index.ts';

// Components
import { Header } from './components/Header.tsx';
import { Sidebar, type ActiveViewType } from './components/Sidebar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { CurrencyConverterModal } from './components/CurrencyConverterModal.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { ResetPasswordModal } from './components/ResetPasswordModal.tsx';
import { MetricsCards } from './components/MetricsCards.tsx';
import { ExpenseChart } from './components/ExpenseChart.tsx';
import { AccountsOverview } from './components/AccountsOverview.tsx';
import { TransactionList } from './components/TransactionList.tsx';
import { TransactionModal } from './components/TransactionModal.tsx';
import { IncomesManagementModule } from './components/IncomesManagementModule.tsx';
import { FortnightPlanner } from './components/FortnightPlanner.tsx';
import { FixedExpensesModule } from './components/FixedExpensesModule.tsx';
import { DebtManagementModule } from './components/DebtManagementModule.tsx';
import { SavingsModule } from './components/SavingsModule.tsx';
import { AccountsManagementModule } from './components/AccountsManagementModule.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { QuickActionModal } from './components/QuickActionModal.tsx';
import { AddPaymentModal } from './components/AddPaymentModal.tsx';
import { RatesHistoryModule } from './components/RatesHistoryModule.tsx';
import { Plus, ArrowRight, Calendar, TrendingUp, RefreshCw } from 'lucide-react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function App() {
  const [activeView, setActiveView] = useState<ActiveViewType>('dashboard');

  // Authentication hook
  const {
    currentUser,
    isAuthenticated,
    isAdmin,
    loading: authLoading,
    error: authError,
    signInWithCedula,
    signUp,
    resetPassword,
    signOut,
    updateProfile,
  } = useAuth();

  // Selected period state (Month: 0-11, Year)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());

  // Themes hook
  const { themeMode, accentColor, setThemeMode, setAccentColor } = useTheme();

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState<boolean>(false);
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [transactionModalType, setTransactionModalType] = useState<TransactionType>('expense');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [preselectedDebtForPayment, setPreselectedDebtForPayment] = useState<string | undefined>(undefined);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'themes' | 'categories' | 'users' | 'backup'>('themes');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleNavigateToSettings = (tab: 'themes' | 'categories' | 'users' | 'backup' = 'themes') => {
    setSettingsInitialTab(tab);
    setActiveView('settings');
  };

  // Detect Password Recovery URL / Events
  useEffect(() => {
    const checkRecovery = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes('reset-password') || hash.includes('type=recovery')) {
        setIsResetPasswordModalOpen(true);
      }
    };
    checkRecovery();

    if (isSupabaseConfigured() && supabase) {
      const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsResetPasswordModalOpen(true);
        }
      });
      return () => {
        authSub.subscription.unsubscribe();
      };
    }
  }, []);

  // Current active user ID
  const activeUserId = currentUser?.id || '';

  // Realtime Sync & Exchange Rate hooks
  const { isOnline, isSyncing, syncStatus, lastSyncTime, syncNow } = useRealtimeSync(activeUserId);
  const { lastSyncResult } = useNetworkStatus();
  const { rates, loading: ratesLoading, isRefreshing: ratesRefreshing, refreshRates } = useExchangeRates();
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(true);

  // Cloud-First Initial Consolidation & Realtime Subscriptions
  useEffect(() => {
    if (!activeUserId) {
      setIsCloudLoading(false);
      return;
    }

    let isMounted = true;
    setIsCloudLoading(true);

    // 1. Migrar datos locales previos (si existen) y consolidar desde Supabase Cloud
    migrateLocalDataToCloud(activeUserId)
      .catch((e) => console.error('Cloud migration error:', e))
      .finally(() => {
        if (isMounted) setIsCloudLoading(false);
      });

    // 2. Realtime listener para sincronización cruzada instantánea
    const unsubscribe = subscribeToRealtimeChanges(activeUserId);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeUserId]);

  // Reactive IndexedDB queries using Dexie
  const liveTransactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const liveCategories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const liveAccounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
  const liveFixedIncomes = useLiveQuery(() => db.fixed_incomes.toArray(), []) || [];
  const liveMonthlyIncomeOverrides = useLiveQuery(() => db.monthly_fixed_income_overrides.toArray(), []) || [];
  const liveVariableIncomes = useLiveQuery(() => db.variable_incomes.toArray(), []) || [];
  const liveFixedExpenses = useLiveQuery(() => db.fixed_expenses.toArray(), []) || [];
  const liveMonthlyOverrides = useLiveQuery(() => db.monthly_fixed_overrides.toArray(), []) || [];
  const liveDebts = useLiveQuery(() => db.debts.toArray(), []) || [];
  const liveDebtPayments = useLiveQuery(() => db.debt_payments.toArray(), []) || [];
  const liveSavingsGoals = useLiveQuery(() => db.savings_goals.toArray(), []) || [];
  const liveSavingContributions = useLiveQuery(() => db.saving_contributions.toArray(), []) || [];

  // System Categories & Accounts
  const categories: Category[] = liveCategories.length > 0 ? liveCategories : DEFAULT_CATEGORIES;
  const isUserMatch = (item: { user_id?: string }) => !activeUserId || !item.user_id || item.user_id === activeUserId;

  const accounts: Account[] = liveAccounts.filter(isUserMatch);
  const transactions: Transaction[] = liveTransactions.filter(isUserMatch);
  const fixedIncomes: FixedIncome[] = liveFixedIncomes.filter(isUserMatch);
  const variableIncomes: VariableIncome[] = liveVariableIncomes.filter(isUserMatch);
  const monthlyIncomeOverrides = liveMonthlyIncomeOverrides;
  const fixedExpenses: FixedExpense[] = liveFixedExpenses.filter(isUserMatch);
  const debts: Debt[] = liveDebts.filter(isUserMatch);
  const monthlyOverrides = liveMonthlyOverrides;
  const debtPayments: DebtPayment[] = liveDebtPayments.filter(isUserMatch);
  const savingsGoals: SavingsGoal[] = liveSavingsGoals.filter(isUserMatch);
  const savingContributions: SavingContribution[] = liveSavingContributions.filter(isUserMatch);

  // If standard user lands on settings view, automatically redirect to dashboard
  if (!isAdmin && activeView === 'settings') {
    setActiveView('dashboard');
  }

  // Pending sync count
  const pendingCount = useMemo(() => {
    return (
      transactions.filter((t) => t.sync_status === 'pending').length +
      debts.filter((d) => d.sync_status === 'pending').length +
      fixedIncomes.filter((i) => i.sync_status === 'pending').length +
      variableIncomes.filter((v) => v.sync_status === 'pending').length +
      fixedExpenses.filter((f) => f.sync_status === 'pending').length +
      savingsGoals.filter((s) => s.sync_status === 'pending').length
    );
  }, [transactions, debts, fixedIncomes, variableIncomes, fixedExpenses, savingsGoals]);

  // Financial Stats Calculation (Current Selected Month)
  const stats = useMemo(() => {
    const currentMonthTxs = transactions.filter((t) => {
      const txDate = new Date(t.transaction_date);
      return (
        txDate.getFullYear() === selectedYear &&
        txDate.getMonth() === selectedMonth
      );
    });

    const totalIncome = currentMonthTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = currentMonthTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const bcvUsd = rates.bcvDollar > 0 ? rates.bcvDollar : 1;
    const bcvEur = rates.bcvEuro > 0 ? rates.bcvEuro : 1;

    let balance = 0;
    accounts.forEach((acc) => {
      const accTxs = transactions.filter((t) => t.account_id === acc.id);
      const accIncome = accTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const accExpense = accTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const accBalance = acc.initial_balance + accIncome - accExpense;

      if (acc.currency === 'VES') {
        balance += accBalance / bcvUsd;
      } else if (acc.currency === 'EUR') {
        balance += (accBalance * bcvEur) / bcvUsd;
      } else {
        balance += accBalance;
      }
    });

    // Expenses grouped by category
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const expenseByCat: { [key: string]: number } = {};

    currentMonthTxs
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        expenseByCat[t.category_id] = (expenseByCat[t.category_id] || 0) + t.amount;
      });

    const categoryExpenses = Object.entries(expenseByCat)
      .map(([catId, amount]) => {
        const cat = catMap.get(catId);
        const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
        return {
          category_id: catId,
          category_name: cat?.name || 'Varios',
          amount,
          color: cat?.color || '#9BA3AF',
          icon: cat?.icon || 'MoreHorizontal',
          percentage,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      balance,
      totalIncome,
      totalExpense,
      categoryExpenses,
      monthName: `${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
    };
  }, [transactions, categories, accounts, rates, selectedYear, selectedMonth]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddTransaction = async (data: {
    amount: number;
    type: TransactionType;
    description: string;
    category_id: string;
    account_id: string;
    transaction_date: string;
  }) => {
    await addTransaction({
      ...data,
      user_id: activeUserId,
    });
    showToast(
      isOnline
        ? 'Movimiento registrado y sincronizado'
        : 'Movimiento guardado localmente (Offline)'
    );
  };

  const handleDeleteTransaction = async (id: string) => {
    await deleteTransaction(id);
    showToast('Movimiento eliminado');
  };

  const handleOpenTransactionForType = (type: TransactionType) => {
    setTransactionModalType(type);
    setIsTransactionModalOpen(true);
  };

  const handleOpenPaymentModal = (debtId?: string) => {
    setPreselectedDebtForPayment(debtId);
    setIsPaymentModalOpen(true);
  };

  const viewTitles: Record<ActiveViewType, string> = {
    dashboard: 'Dashboard General',
    fortnight: 'Plan Quincenal',
    incomes: 'Gestión de Ingresos',
    fixed_expenses: 'Gastos Fijos',
    debts: 'Control de Deudas',
    savings: 'Planes de Ahorro',
    accounts: 'Capital & Cuentas',
    transactions: 'Historial de Movimientos',
    rates: 'Tasas BCV & Divisas',
    settings: 'Configuración & Backup',
  };

  // Auth & Cloud Data Initial Loading Screen
  if (authLoading || (isAuthenticated && currentUser && isCloudLoading)) {
    return (
      <div className="min-h-screen w-full bg-[#0B132B] flex flex-col items-center justify-center p-4 text-white">
        <div className="h-16 w-16 flex items-center justify-center mb-4 drop-shadow-md animate-pulse">
          <img src="/icon.png" alt="LANITAPP" className="h-full w-full object-contain" />
        </div>
        <p className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#147DF0]" />
          {authLoading ? 'Iniciando LANITAPP...' : 'Sincronizando con Supabase Cloud...'}
        </p>
      </div>
    );
  }

  // Not Authenticated: Render Interactive Auth Screen
  if (!isAuthenticated || !currentUser) {
    return (
      <>
        <AuthScreen
          onSignIn={signInWithCedula}
          onSignUp={signUp}
          onResetPassword={resetPassword}
          externalError={authError}
        />
        <ResetPasswordModal
          isOpen={isResetPasswordModalOpen}
          onClose={() => setIsResetPasswordModalOpen(false)}
          onSuccessToast={showToast}
        />
      </>
    );
  }

  return (
    <div className="h-screen bg-app text-app flex font-sans selection:bg-primary-custom selection:text-white transition-colors duration-200 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          activeView={activeView}
          onChangeView={setActiveView}
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
          movementsCount={transactions.length}
          rates={rates}
          isAdmin={isAdmin}
          onSync={syncNow}
          onOpenConverter={() => setIsConverterOpen(true)}
          onSignOut={signOut}
        />
      </div>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto pb-safe lg:pb-8">
        {/* Streamlined Top Header with Notification Bell & Sync Status */}
        <Header
          activeViewTitle={viewTitles[activeView]}
          rates={rates}
          ratesLoading={ratesLoading}
          ratesRefreshing={ratesRefreshing}
          onRefreshRates={refreshRates}
          isOnline={isOnline}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          lastSyncTime={lastSyncTime}
          lastSyncResult={lastSyncResult}
          pendingCount={pendingCount}
          activeProfile={currentUser}
          debts={debts}
          fixedExpenses={fixedExpenses}
          onSync={syncNow}
          onOpenConverter={() => setIsConverterOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-primary-custom text-white text-xs font-bold rounded-full shadow-xl backdrop-blur-md border border-white/20 animate-in fade-in zoom-in-95 duration-200">
            {toastMessage}
          </div>
        )}

        {/* Main Workspace Body */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 space-y-6">
          {/* VIEW 1: DASHBOARD GENERAL */}
          {activeView === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Financial Metrics Summary */}
              <MetricsCards
                balance={stats.balance}
                totalIncome={stats.totalIncome}
                totalExpense={stats.totalExpense}
                monthName={stats.monthName}
                bcvRate={rates.bcvDollar}
              />

              {/* Quick Quincena Glimpse Hero */}
              <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-app">Planificación de Quincenas</h3>
                      <p className="text-xs text-muted">Ingresos, gastos fijos y remanente</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveView('fortnight')}
                    className="text-xs font-bold text-primary-custom hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Ver detalle completo <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-card border border-app">
                    <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">
                      Quincena 15 de {MONTH_NAMES[selectedMonth]}
                    </span>
                    <span className="text-xs text-muted mt-0.5 block">Gastos asignados:</span>
                    <span className="text-sm font-black text-[#FF914D]">
                      ${fixedExpenses.filter(f => f.default_fortnight === 'q1' || f.default_fortnight === 'both').reduce((s, f) => s + f.amount, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-card border border-app">
                    <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">
                      Quincena 30 de {MONTH_NAMES[selectedMonth]}
                    </span>
                    <span className="text-xs text-muted mt-0.5 block">Gastos asignados:</span>
                    <span className="text-sm font-black text-[#FF914D]">
                      ${fixedExpenses.filter(f => f.default_fortnight === 'q2' || f.default_fortnight === 'both').reduce((s, f) => s + f.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop Grid: Charts & Accounts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ExpenseChart data={stats.categoryExpenses} />
                <AccountsOverview
                  accounts={accounts}
                  transactions={transactions}
                  onNavigateToAccounts={() => setActiveView('accounts')}
                />
              </div>

              {/* Recent Transactions Snippet */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-app">Últimos Movimientos</h3>
                    <p className="text-xs text-muted">Actividad reciente en tus cuentas</p>
                  </div>
                  <button
                    onClick={() => setActiveView('transactions')}
                    className="text-xs text-primary-custom font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    Ver todos ({transactions.length})
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <TransactionList
                  transactions={transactions.slice(0, 5)}
                  categories={categories}
                  accounts={accounts}
                  onDelete={handleDeleteTransaction}
                  showFilters={false}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: PLANIFICACIÓN POR QUINCENAS (15 / 30) */}
          {activeView === 'fortnight' && (
            <div className="animate-in fade-in duration-200">
              <FortnightPlanner
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onChangePeriod={(y, m) => {
                  setSelectedYear(y);
                  setSelectedMonth(m);
                }}
                fixedIncomes={fixedIncomes}
                monthlyIncomeOverrides={monthlyIncomeOverrides}
                variableIncomes={variableIncomes}
                fixedExpenses={fixedExpenses}
                monthlyOverrides={monthlyOverrides}
                debts={debts}
                debtPayments={debtPayments}
                savingsGoals={savingsGoals}
                savingContributions={savingContributions}
                accounts={accounts}
                categories={categories}
                rates={rates}
                userEmail={currentUser?.email}
                userName={currentUser?.name}
                onOpenQuickPayment={handleOpenPaymentModal}
                onNavigateToIncomes={() => setActiveView('incomes')}
                onNavigateToSavings={() => setActiveView('savings')}
                onNavigateToDebts={() => setActiveView('debts')}
                onNavigateToFixedExpenses={() => setActiveView('fixed_expenses')}
              />
            </div>
          )}

          {/* VIEW 3: GESTIÓN INTEGRAL DE INGRESOS */}
          {activeView === 'incomes' && (
            <div className="animate-in fade-in duration-200">
              <IncomesManagementModule
                fixedIncomes={fixedIncomes}
                monthlyIncomeOverrides={monthlyIncomeOverrides}
                variableIncomes={variableIncomes}
                categories={categories}
                accounts={accounts}
                rates={rates}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onChangePeriod={(y, m) => {
                  setSelectedYear(y);
                  setSelectedMonth(m);
                }}
              />
            </div>
          )}

          {/* VIEW 4: PLANTILLA DE GASTOS FIJOS */}
          {activeView === 'fixed_expenses' && (
            <div className="animate-in fade-in duration-200">
              <FixedExpensesModule
                fixedExpenses={fixedExpenses}
                monthlyOverrides={monthlyOverrides}
                categories={categories}
                rates={rates}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onChangePeriod={(y, m) => {
                  setSelectedYear(y);
                  setSelectedMonth(m);
                }}
              />
            </div>
          )}

          {/* VIEW 5: CONTROL DE DEUDAS */}
          {activeView === 'debts' && (
            <div className="animate-in fade-in duration-200">
              <DebtManagementModule
                debts={debts}
                debtPayments={debtPayments}
                rates={rates}
                categories={categories}
                userId={activeUserId}
              />
            </div>
          )}

          {/* VIEW 6: PLANES DE AHORRO */}
          {activeView === 'savings' && (
            <div className="animate-in fade-in duration-200">
              <SavingsModule
                savingsGoals={savingsGoals}
                savingContributions={savingContributions}
                accounts={accounts}
              />
            </div>
          )}

          {/* VIEW: CAPITAL & CUENTAS (CAJA CHICA / FONDOS) */}
          {activeView === 'accounts' && (
            <div className="animate-in fade-in duration-200">
              <AccountsManagementModule
                accounts={accounts}
                transactions={transactions}
                categories={categories}
                rates={rates}
              />
            </div>
          )}

          {/* VIEW 7: HISTORIAL COMPLETO DE TRANSACCIONES */}
          {activeView === 'transactions' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-app">Historial de Movimientos</h2>
                  <p className="text-xs text-muted">
                    {transactions.length} registros en total
                  </p>
                </div>
                <button
                  onClick={() => handleOpenTransactionForType('expense')}
                  className="px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo Movimiento
                </button>
              </div>

              <TransactionList
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                onDelete={handleDeleteTransaction}
                onOpenAdd={() => handleOpenTransactionForType('expense')}
                showFilters={true}
              />
            </div>
          )}

          {/* VIEW 8: TASAS BCV & CALCULADORA */}
          {activeView === 'rates' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-5 rounded-3xl bg-surface border border-app space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-app">Cotizaciones y Tasas en Vivo</h2>
                      <p className="text-xs text-muted">Fuente oficial DolarAPI Venezuela</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsConverterOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-extrabold shadow-md hover:opacity-95 cursor-pointer"
                  >
                    Abrir Calculadora
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-card border border-app">
                    <span className="text-xs text-muted font-semibold block">Dólar BCV Oficial</span>
                    <p className="text-2xl font-black text-app mt-1">
                      Bs. {rates.bcvDollar.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-emerald-400">Banco Central de Venezuela</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-app">
                    <span className="text-xs text-muted font-semibold block">Dólar Promedio / Cash</span>
                    <p className="text-2xl font-black text-[#FF914D] mt-1">
                      Bs. {rates.parallelDollar.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-[#FF914D]">Promedio de Mercado</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-app">
                    <span className="text-xs text-muted font-semibold block">Euro BCV Oficial</span>
                    <p className="text-2xl font-black text-[#00C2C7] mt-1">
                      Bs. {rates.bcvEuro.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="text-[10px] text-[#00C2C7]">Tasa Oficial Europea</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-app flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-app block">Brecha Cambiaria (Diferencial)</span>
                    <span className="text-[11px] text-muted">Diferencia porcentual entre tasa oficial BCV y mercado promedio</span>
                  </div>
                  <span className="text-xl font-black text-[#FF914D]">+{rates.spreadPercentage}%</span>
                </div>
              </div>

              {/* Historical Exchange Rates Chart & Logs */}
              <RatesHistoryModule />
            </div>
          )}

          {/* VIEW 9: CONFIGURACIÓN & BACKUP (ADMIN ONLY) */}
          {activeView === 'settings' && isAdmin && (
            <div className="animate-in fade-in duration-200">
              <SettingsView
                categories={categories}
                accounts={accounts}
                transactions={transactions}
                debts={debts}
                fixedExpenses={fixedExpenses}
                fixedIncomes={fixedIncomes}
                debtPayments={debtPayments}
                savingsGoals={savingsGoals}
                rates={rates}
                isOnline={isOnline}
                isSyncing={isSyncing}
                lastSyncTime={lastSyncTime}
                currentThemeMode={themeMode}
                currentAccentColor={accentColor}
                currentUserId={currentUser?.id}
                initialTab={settingsInitialTab}
                onChangeThemeMode={setThemeMode}
                onChangeAccentColor={setAccentColor}
                onSync={syncNow}
              />
            </div>
          )}
        </div>
      </main>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={currentUser}
        isAdmin={isAdmin}
        currentThemeMode={themeMode}
        currentAccentColor={accentColor}
        onChangeThemeMode={setThemeMode}
        onChangeAccentColor={setAccentColor}
        onUpdateProfile={updateProfile}
        onShowToast={showToast}
        onNavigateToSettings={handleNavigateToSettings}
        onSignOut={signOut}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        onSuccessToast={showToast}
      />

      {/* Unified Quick Action Floating Modal (+) */}
      <QuickActionModal
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        onSelectTransaction={(type) => handleOpenTransactionForType(type)}
        onSelectDebtPayment={() => handleOpenPaymentModal()}
      />

      {/* Transaction Modal (Gasto / Ingreso) */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        categories={categories}
        accounts={accounts}
        initialType={transactionModalType}
        onSubmit={handleAddTransaction}
      />

      {/* Add Debt Payment Modal */}
      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPreselectedDebtForPayment(undefined);
        }}
        debts={debts}
        rates={rates}
        preselectedDebtId={preselectedDebtForPayment}
      />

      {/* Currency Converter Modal */}
      <CurrencyConverterModal
        isOpen={isConverterOpen}
        onClose={() => setIsConverterOpen(false)}
        rates={rates}
      />

      {/* Mobile-First Fixed Bottom Navigation Bar */}
      <BottomNav
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenQuickAction={() => setIsQuickActionOpen(true)}
        onOpenConverter={() => setIsConverterOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onNavigateToSettings={handleNavigateToSettings}
        isAdmin={isAdmin}
        pendingCount={pendingCount}
      />
    </div>
  );
}

export default App;
