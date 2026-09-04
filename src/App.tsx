import { useState, useMemo, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  addTransaction,
  DEFAULT_CATEGORIES,
  seedUserDefaultCategories,
  migrateLocalDataToCloud,
  subscribeToRealtimeChanges,
} from './lib/db.ts';
import { useNetworkStatus } from './hooks/useNetworkStatus.ts';
import { useRealtimeSync } from './hooks/useRealtimeSync.ts';
import { useExchangeRates } from './hooks/useExchangeRates.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useAuth } from './hooks/useAuth.ts';
import { useFinanceStore } from './stores/useFinanceStore.ts';
import { supabase, isSupabaseConfigured } from './lib/supabase.ts';
import type {
  Category,
  Account,
  Transaction,
  TransactionType,
  FixedIncome,
  VariableIncome,
  FixedExpense,
  VariableExpense,
  Debt,
  DebtPayment,
  SavingsGoal,
  SavingContribution,
  ThemeMode,
  AccentColor,
} from './types/index.ts';

// Components
import { Header } from './components/Header.tsx';
import { Sidebar, type ActiveViewType } from './components/Sidebar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { CurrencyConverterModal } from './components/CurrencyConverterModal.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { ResetPasswordModal } from './components/ResetPasswordModal.tsx';
import { SignOutConfirmModal } from './components/SignOutConfirmModal.tsx';
import { TransactionModal } from './components/TransactionModal.tsx';
import { QuickActionModal } from './components/QuickActionModal.tsx';
import { AddVariableIncomeModal } from './components/AddVariableIncomeModal.tsx';
import { AddFixedExpenseModal } from './components/AddFixedExpenseModal.tsx';
import { AddVariableExpenseModal } from './components/AddVariableExpenseModal.tsx';
import { AddPaymentModal } from './components/AddPaymentModal.tsx';
import { NotificationCenterModal } from './components/NotificationCenterModal.tsx';
import { DashboardModule } from './components/DashboardModule.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx';
import { PullToRefresh } from './components/PullToRefresh.tsx';
import { Skeleton } from './components/ui/Skeleton.tsx';
import { TrendingUp, AlertTriangle, Clock, LogOut, CheckCircle2, WifiOff } from 'lucide-react';

import { PlanningModule } from './components/planning/PlanningModule.tsx';
import { IncomesManagementModule } from './components/IncomesManagementModule.tsx';
import { FixedExpensesModule } from './components/FixedExpensesModule.tsx';
import { DebtManagementModule } from './components/DebtManagementModule.tsx';
import { SavingsModule } from './components/SavingsModule.tsx';
import { AccountsManagementModule } from './components/AccountsManagementModule.tsx';
import { TransactionHistoryModule } from './components/TransactionHistoryModule.tsx';
import { RatesHistoryModule } from './components/RatesHistoryModule.tsx';
import { SettingsView } from './components/SettingsView.tsx';
const AuditPanel = lazy(() =>
  import('./components/AuditPanel.tsx').then((m) => ({ default: m.AuditPanel }))
);
import { useSessionTimeout } from './hooks/useSessionTimeout.ts';
import { getUserPreferences } from './lib/profilePreferences.ts';
import { checkAndNotifyDeficit } from './services/deficitAlertService.ts';
import { logger } from './utils/logger.ts';

const AVAILABLE_VIEWS: ActiveViewType[] = [
  'dashboard',
  'fortnight',
  'incomes',
  'fixed_expenses',
  'debts',
  'savings',
  'accounts',
  'transactions',
  'rates',
  'settings',
];

const ViewLoadingFallback: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton variant="text" className="w-40 h-5" />
          <Skeleton variant="text" className="w-56 h-3" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="w-28 h-9 rounded-2xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Skeleton variant="rectangular" className="h-64 rounded-3xl" />
      <Skeleton variant="rectangular" className="h-64 rounded-3xl" />
    </div>
    <Skeleton variant="card" className="h-44 rounded-3xl" />
  </div>
);

export function App() {
  const [activeView, setActiveView] = useState<ActiveViewType>(() => {
    try {
      const saved = localStorage.getItem('lanitapp_last_active_view') as ActiveViewType;
      if (saved && AVAILABLE_VIEWS.includes(saved)) return saved;
    } catch {}
    return 'dashboard';
  });

  const mainScrollRef = useRef<HTMLElement>(null);
  const isSidebarCollapsed = useFinanceStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useFinanceStore((state) => state.toggleSidebar);
  const isStoreLoading = useFinanceStore((state) => state.isLoading);

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
    changePassword,
    signOut,
    updateProfile,
    checkCedulaExists,
    checkEmailExists,
  } = useAuth();

  const handleViewChange = useCallback((newView: ActiveViewType) => {
    setActiveView(newView);
    try {
      localStorage.setItem('lanitapp_last_active_view', newView);
    } catch {}
    if (currentUser?.id) {
      updateProfile({ last_active_view: newView }).catch(() => {});
    }
  }, [currentUser?.id, updateProfile]);

  // Selected period state (Month: 0-11, Year)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());

  // Themes hook
  const { themeMode, accentColor, setThemeMode, setAccentColor } = useTheme();

  // Cloud Sync for Theme & Accent Color
  const handleThemeUpdate = async (newTheme: ThemeMode, newColor: AccentColor) => {
    try {
      // 1. Inmediata aplicación en UI local y DOM
      setThemeMode(newTheme);
      setAccentColor(newColor);
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
        root.classList.add(`theme-${newTheme}`);
        root.style.setProperty('--primary-custom', newColor);
        root.style.setProperty('--primary', newColor);
      }

      // 2. Persistir en Supabase y localmente a través de updateProfile
      if (currentUser?.id) {
        await updateProfile({ theme_mode: newTheme, accent_color: newColor });
      }
    } catch (err) {
      logger.error('Error inesperado al guardar tema:', err);
    }
  };

  const handleChangeThemeMode = async (mode: ThemeMode) => {
    await handleThemeUpdate(mode, accentColor);
  };

  const handleChangeAccentColor = async (color: AccentColor) => {
    await handleThemeUpdate(themeMode, color);
  };

  // Synchronize theme & accent color if currentUser profile is loaded or synced from another device
  useEffect(() => {
    if (currentUser?.theme_mode && currentUser.theme_mode !== themeMode) {
      setThemeMode(currentUser.theme_mode);
    }
    if (currentUser?.accent_color && currentUser.accent_color !== accentColor) {
      setAccentColor(currentUser.accent_color);
    }
  }, [currentUser?.theme_mode, currentUser?.accent_color]);

  // Synchronize all user preferences from Supabase profiles on login or session restore
  useEffect(() => {
    if (currentUser?.id) {
      try {
        const localSaved = localStorage.getItem('lanitapp_last_active_view');
        if (!localSaved && currentUser.last_active_view && AVAILABLE_VIEWS.includes(currentUser.last_active_view as ActiveViewType)) {
          setActiveView(currentUser.last_active_view as ActiveViewType);
        }
      } catch {}
      if (currentUser.keep_session !== undefined) {
        setKeepConnected(currentUser.keep_session);
      }

      // Inicializar categorías individuales para el usuario si no han sido sembradas aún
      const catFlag = 'lanitapp_cat_seeded_' + currentUser.id;
      if (!localStorage.getItem(catFlag)) {
        seedUserDefaultCategories(currentUser.id).then((seeded) => {
          try {
            localStorage.setItem(catFlag, 'true');
            if (seeded && seeded.length > 0) {
              useFinanceStore.getState().loadFromLocalCache(currentUser.id);
            }
          } catch {}
        });
      }

      // Fetch fresh preferences from profiles in Supabase
      getUserPreferences(currentUser.id).then((prefs) => {
        if (prefs) {
          try {
            const localSaved = localStorage.getItem('lanitapp_last_active_view');
            if (!localSaved && prefs.last_active_view && AVAILABLE_VIEWS.includes(prefs.last_active_view as ActiveViewType)) {
              setActiveView(prefs.last_active_view as ActiveViewType);
            }
          } catch {}
          if (prefs.keep_session !== undefined) {
            setKeepConnected(prefs.keep_session);
          }
          if (prefs.theme_mode && prefs.theme_mode !== themeMode) {
            setThemeMode(prefs.theme_mode as ThemeMode);
          }
          if (prefs.accent_color && prefs.accent_color !== accentColor) {
            setAccentColor(prefs.accent_color as AccentColor);
          }
        }
      });
    }
  }, [currentUser?.id]);

  // Realtime subscription for preferences synchronization across multiple devices
  useEffect(() => {
    if (!currentUser?.id || !isSupabaseConfigured() || !supabase) return;

    const profileChannel = supabase
      .channel(`profile-preferences-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated) return;

          if (updated.theme_mode && updated.theme_mode !== themeMode) {
            setThemeMode(updated.theme_mode as ThemeMode);
          }
          if (updated.accent_color && updated.accent_color !== accentColor) {
            setAccentColor(updated.accent_color as AccentColor);
          }
          if (updated.keep_session !== undefined) {
            setKeepConnected(updated.keep_session);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(profileChannel);
      }
    };
  }, [currentUser?.id, themeMode, accentColor]);

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isGlobalSignOutConfirmOpen, setIsGlobalSignOutConfirmOpen] = useState<boolean>(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState<boolean>(false);
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState<boolean>(false);
  const [isAddVariableIncomeModalOpen, setIsAddVariableIncomeModalOpen] = useState<boolean>(false);
  const [isAddFixedExpenseModalOpen, setIsAddFixedExpenseModalOpen] = useState<boolean>(false);
  const [isAddVariableExpenseModalOpen, setIsAddVariableExpenseModalOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [transactionModalType] = useState<TransactionType>('expense');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [preselectedDebtForPayment, setPreselectedDebtForPayment] = useState<string | undefined>(undefined);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'themes' | 'categories' | 'users' | 'backup'>('themes');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inactivity session timeout management (5 minutes inactivity -> auto logout unless keep_session)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(120);
  const [keepConnected, setKeepConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lanitapp_keep_connected') === 'true';
    } catch {
      return false;
    }
  });

  // Sincronizar estado local cuando cargue el perfil de Supabase
  useEffect(() => {
    if (currentUser?.keep_session !== undefined) {
      setKeepConnected(currentUser.keep_session);
    }
  }, [currentUser?.keep_session]);

  // Fuente de verdad: profiles.keep_session (fallback a keepConnected / false)
  const isSessionKept = currentUser?.keep_session ?? keepConnected;

  const handleSessionTimeout = useCallback(async () => {
    setShowTimeoutWarning(false);
    setRemainingSeconds(0);
    await signOut();
  }, [signOut]);

  const handleTimeoutWarning = useCallback((seconds: number) => {
    setShowTimeoutWarning(true);
    setRemainingSeconds(seconds);
  }, []);

  const handleClearWarning = useCallback(() => {
    setShowTimeoutWarning(false);
    setRemainingSeconds(0);
  }, []);

  const { resetTimers } = useSessionTimeout({
    isEnabled: Boolean(currentUser && !isSessionKept),
    onTimeout: handleSessionTimeout,
    onWarning: handleTimeoutWarning,
    onClearWarning: handleClearWarning,
  });

  const extendSession = useCallback(() => {
    setShowTimeoutWarning(false);
    setRemainingSeconds(0);
    resetTimers();
  }, [resetTimers]);

  const handleNavigateToSettings = (tab: 'themes' | 'categories' | 'users' | 'backup' = 'themes') => {
    setSettingsInitialTab(tab);
    handleViewChange('settings');
  };

  // Detect Password Recovery URL / Events
  useEffect(() => {
    const path = window.location.pathname;
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    // Si la URL contiene un error (ej. otp_expired, access_denied), cancelar recuperación y limpiar URL
    if (
      hash.includes('error=') ||
      hash.includes('error_code=') ||
      search.includes('error=') ||
      search.includes('error_code=')
    ) {
      setIsResetPasswordModalOpen(false);
      const msg = 'El enlace de recuperación ha expirado o ya fue utilizado. Por favor solicita uno nuevo.';
      try {
        sessionStorage.setItem('lanitapp_auth_flash_error', msg);
      } catch {}
      try {
        window.history.replaceState(null, '', window.location.origin + window.location.pathname);
      } catch {}
      signOut().catch(() => {});
      return;
    }

    const checkRecovery = () => {
      if (path.includes('reset-password') || hash.includes('type=recovery')) {
        setIsResetPasswordModalOpen(true);
        try {
          window.history.replaceState(null, '', window.location.origin + window.location.pathname);
        } catch {}
      }
    };
    checkRecovery();

    if (isSupabaseConfigured() && supabase) {
      const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsResetPasswordModalOpen(true);
          try {
            window.history.replaceState(null, '', window.location.origin + window.location.pathname);
          } catch {}
        }
      });
      return () => {
        authSub.subscription.unsubscribe();
      };
    }
  }, [signOut]);

  // Current active user ID
  const activeUserId = currentUser?.id || '';

  // Realtime Sync & Exchange Rate hooks
  const { isOnline, isSyncing, syncStatus, lastSyncTime, syncNow } = useRealtimeSync(activeUserId);
  const { lastSyncResult } = useNetworkStatus();
  const { rates, loading: ratesLoading, isRefreshing: ratesRefreshing, refreshRates } = useExchangeRates();
  // Cloud-First Initial Consolidation & Realtime Subscriptions
  useEffect(() => {
    if (!activeUserId) return;

    // 1. Migrar datos locales previos (si existen) y consolidar desde Supabase Cloud en segundo plano
    migrateLocalDataToCloud(activeUserId).catch((e) =>
      logger.error('Cloud migration error:', e)
    );

    // 2. Realtime listener para sincronización cruzada instantánea
    const unsubscribe = subscribeToRealtimeChanges(activeUserId);

    return () => {
      unsubscribe();
    };
  }, [activeUserId]);

  const liveTransactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const liveCategories = useLiveQuery(
    () => {
      if (!activeUserId) return db.categories.toArray();
      return db.categories
        .filter((c) => !c.user_id || c.user_id === activeUserId)
        .toArray();
    },
    [activeUserId]
  ) || [];
  const liveAccounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
  const liveFixedIncomes = useLiveQuery(() => db.fixed_incomes.toArray(), []) || [];
  const liveMonthlyIncomeOverrides = useLiveQuery(() => db.monthly_fixed_income_overrides.toArray(), []) || [];
  const liveVariableIncomes = useLiveQuery(() => db.variable_incomes.toArray(), []) || [];
  const liveFixedExpenses = useLiveQuery(() => db.fixed_expenses.toArray(), []) || [];
  const liveMonthlyOverrides = useLiveQuery(() => db.monthly_fixed_overrides.toArray(), []) || [];
  const liveVariableExpenses = useLiveQuery(() => db.variable_expenses.toArray(), []) || [];
  const liveDebts = useLiveQuery(() => db.debts.toArray(), []) || [];
  const liveDebtPayments = useLiveQuery(() => db.debt_payments.toArray(), []) || [];
  const liveSavingsGoals = useLiveQuery(() => db.savings_goals.toArray(), []) || [];
  const liveSavingContributions = useLiveQuery(() => db.saving_contributions.toArray(), []) || [];

  // Categorías individuales por usuario
  const userCategories = liveCategories.filter((c) => c.user_id === activeUserId);
  const fallbackCategories = liveCategories.filter((c) => !c.user_id);
  const hasUserCustom = activeUserId ? Boolean(localStorage.getItem('lanitapp_cat_seeded_' + activeUserId)) : false;
  const categories: Category[] =
    userCategories.length > 0 || hasUserCustom
      ? userCategories
      : fallbackCategories.length > 0
      ? fallbackCategories
      : DEFAULT_CATEGORIES;
  // SEGURIDAD: Validación estricta. Ambos IDs deben existir y coincidir exactamente para evitar filtración de datos entre usuarios.
  const isUserMatch = (item: { user_id?: string | null }) =>
    Boolean(activeUserId && item.user_id && item.user_id === activeUserId);

  const accounts: Account[] = liveAccounts.filter(isUserMatch);
  const transactions: Transaction[] = liveTransactions.filter(isUserMatch);
  const fixedIncomes: FixedIncome[] = liveFixedIncomes.filter(isUserMatch);
  const variableIncomes: VariableIncome[] = liveVariableIncomes.filter(isUserMatch);
  const monthlyIncomeOverrides = liveMonthlyIncomeOverrides;
  const fixedExpenses: FixedExpense[] = liveFixedExpenses.filter(isUserMatch);
  const variableExpenses: VariableExpense[] = liveVariableExpenses.filter(isUserMatch);
  const debts: Debt[] = liveDebts.filter(isUserMatch);
  const monthlyOverrides = liveMonthlyOverrides;
  const debtPayments: DebtPayment[] = liveDebtPayments.filter(isUserMatch);
  const savingsGoals: SavingsGoal[] = liveSavingsGoals.filter(isUserMatch);
  const savingContributions: SavingContribution[] = liveSavingContributions.filter(isUserMatch);

  // Verificación proactiva de déficit quincenal y notificación por email
  useEffect(() => {
    if (currentUser?.id && !isStoreLoading) {
      const timer = setTimeout(() => {
        checkAndNotifyDeficit();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.id, isStoreLoading]);

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

  const handleOpenPaymentModal = (debtId?: string) => {
    setPreselectedDebtForPayment(debtId);
    setIsPaymentModalOpen(true);
  };

  const viewTitles: Record<ActiveViewType, string> = {
    dashboard: 'Lanita Global',
    fortnight: 'Planificación',
    incomes: 'Gestión de Ingresos',
    fixed_expenses: 'Gastos Fijos',
    debts: 'Control de Deudas',
    savings: 'Planes de Ahorro',
    accounts: 'Capital',
    transactions: 'Historial de Movimientos',
    rates: 'Tasas BCV y Divisas',
    settings: 'Configuración',
  };

  // Auth Initial Loading Screen
  if (authLoading) {
    return (
      <LoadingScreen
        initialMessage="Iniciando LANITAPP..."
        initialSubtext="Bienvenido de vuelta 👋"
      />
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
          checkCedulaExists={checkCedulaExists}
          checkEmailExists={checkEmailExists}
          externalError={authError}
        />
        <ResetPasswordModal
          isOpen={isResetPasswordModalOpen}
          onClose={() => setIsResetPasswordModalOpen(false)}
          onSuccessToast={showToast}
          onSignOut={signOut}
        />
      </>
    );
  }

  return (
    <div
      className="h-screen bg-app text-app flex font-sans selection:bg-primary-custom selection:text-white transition-colors duration-200 overflow-hidden"
      style={{ '--primary-custom': accentColor, '--primary': accentColor } as React.CSSProperties}
    >
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          activeView={activeView}
          onChangeView={handleViewChange}
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
          movementsCount={transactions.length}
          rates={rates}
          isAdmin={isAdmin}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onSync={syncNow}
          onOpenConverter={() => setIsConverterOpen(true)}
          onSignOut={() => setIsGlobalSignOutConfirmOpen(true)}
          activeProfile={currentUser}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
      </div>

      {/* Main Container */}
      <main ref={mainScrollRef} className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto pb-safe lg:pb-8">
        {/* Pull to Refresh Gesture Indicator for Mobile PWA */}
        <PullToRefresh scrollRef={mainScrollRef} />

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
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          onSync={syncNow}
          onOpenConverter={() => setIsConverterOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenAudit={() => setIsAuditModalOpen(true)}
        />

        {/* Offline Mode Banner */}
        {!isOnline && (
          <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-amber-400 text-center">
              Modo Offline: Mostrando últimos datos en caché. La sincronización se reanudará al recuperar la conexión.
            </span>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-primary-custom text-white text-xs font-bold rounded-full shadow-xl backdrop-blur-md border border-white/20 animate-in fade-in zoom-in-95 duration-200">
            {toastMessage}
          </div>
        )}

        {/* Main Workspace Body */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 space-y-6">
          <Suspense fallback={<ViewLoadingFallback />}>
            {/* VIEW 1: DASHBOARD GENERAL (INTERACTIVO Y MODULAR) */}
            {activeView === 'dashboard' && (
              <DashboardModule
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                fixedIncomes={fixedIncomes}
                variableIncomes={variableIncomes}
                fixedExpenses={fixedExpenses}
                variableExpenses={variableExpenses}
                debts={debts}
                debtPayments={debtPayments}
                savingsGoals={savingsGoals}
                savingContributions={savingContributions}
                rates={rates}
                onNavigate={handleViewChange}
                userCreatedAt={currentUser?.created_at}
                currentUserId={currentUser?.id}
                initialWidgets={currentUser?.dashboard_widgets}
                isLoading={authLoading || isStoreLoading}
              />
            )}

          {/* VIEW 2: PLANIFICACIÓN INTEGRAL (GESTIÓN QUINCENAL & CALENDARIO) */}
          {activeView === 'fortnight' && (
            <div className="w-full">
              <PlanningModule
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
                variableExpenses={variableExpenses}
                debts={debts}
                debtPayments={debtPayments}
                savingsGoals={savingsGoals}
                savingContributions={savingContributions}
                accounts={accounts}
                categories={categories}
                rates={rates}
                userEmail={currentUser?.email}
                userName={currentUser?.name}
                userId={activeUserId}
                onOpenQuickPayment={handleOpenPaymentModal}
                onNavigateToIncomes={() => handleViewChange('incomes')}
                onNavigateToSavings={() => handleViewChange('savings')}
                onNavigateToDebts={() => handleViewChange('debts')}
                onNavigateToFixedExpenses={() => handleViewChange('fixed_expenses')}
              />
            </div>
          )}

          {/* VIEW 3: GESTIÓN INTEGRAL DE INGRESOS */}
          {activeView === 'incomes' && (
            <div className="w-full">
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

          {/* VIEW 4: GESTIÓN DE GASTOS (FIJOS & VARIABLES) */}
          {activeView === 'fixed_expenses' && (
            <div className="w-full">
              <FixedExpensesModule
                fixedExpenses={fixedExpenses}
                variableExpenses={variableExpenses}
                monthlyOverrides={monthlyOverrides}
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

          {/* VIEW 5: CONTROL DE DEUDAS */}
          {activeView === 'debts' && (
            <div className="w-full">
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
            <div className="w-full">
              <SavingsModule
                savingsGoals={savingsGoals}
                savingContributions={savingContributions}
                accounts={accounts}
              />
            </div>
          )}

          {/* VIEW: CAPITAL & CUENTAS (CAJA CHICA / FONDOS) */}
          {activeView === 'accounts' && (
            <div className="w-full">
              <AccountsManagementModule
                accounts={accounts}
                transactions={transactions}
                categories={categories}
                rates={rates}
              />
            </div>
          )}

          {/* VIEW 7: HISTORIAL INTEGRAL DE MOVIMIENTOS & AUDITORÍA */}
          {activeView === 'transactions' && (
            <div className="w-full">
              <TransactionHistoryModule
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                fixedIncomes={fixedIncomes}
                variableIncomes={variableIncomes}
                fixedExpenses={fixedExpenses}
                variableExpenses={variableExpenses}
                debts={debts}
                debtPayments={debtPayments}
                savingsGoals={savingsGoals}
                savingContributions={savingContributions}
                rates={rates}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                onChangePeriod={(y, m) => {
                  setSelectedYear(y);
                  setSelectedMonth(m);
                }}
                userCreatedAt={currentUser?.created_at}
              />
            </div>
          )}

          {/* VIEW 8: TASAS BCV & CALCULADORA */}
          {activeView === 'rates' && (
            <div className="space-y-4">
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

          {/* VIEW 9: CONFIGURACIÓN */}
          {activeView === 'settings' && (
            <div className="w-full">
              <SettingsView
                isAdmin={isAdmin}
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
                onChangeThemeMode={handleChangeThemeMode}
                onChangeAccentColor={handleChangeAccentColor}
                onSync={syncNow}
                onOpenAudit={() => setIsAuditModalOpen(true)}
              />
            </div>
          )}
          </Suspense>
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
        onChangeThemeMode={handleChangeThemeMode}
        onChangeAccentColor={handleChangeAccentColor}
        onUpdateProfile={updateProfile}
        onChangePassword={changePassword}
        onShowToast={showToast}
        onNavigateToSettings={handleNavigateToSettings}
        onSignOut={signOut}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        onSuccessToast={showToast}
        onSignOut={signOut}
      />

      {/* Global Sign Out Confirmation Modal */}
      <SignOutConfirmModal
        isOpen={isGlobalSignOutConfirmOpen}
        onClose={() => setIsGlobalSignOutConfirmOpen(false)}
        onConfirm={() => {
          setIsGlobalSignOutConfirmOpen(false);
          signOut();
        }}
      />

      {/* Unified Quick Action Floating Modal (+) */}
      <QuickActionModal
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        onSelectVariableIncome={() => setIsAddVariableIncomeModalOpen(true)}
        onSelectVariableExpense={() => setIsAddVariableExpenseModalOpen(true)}
        onSelectDebtPayment={() => handleOpenPaymentModal()}
      />

      {/* Add Variable Income Modal (Available globally & in mobile +) */}
      <AddVariableIncomeModal
        isOpen={isAddVariableIncomeModalOpen}
        onClose={() => setIsAddVariableIncomeModalOpen(false)}
        categories={categories}
        accounts={accounts}
        rates={rates}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onSaved={() => showToast('Ingreso variable guardado con éxito')}
      />

      {/* Add Fixed Expense Modal (Available globally & in mobile +) */}
      <AddFixedExpenseModal
        isOpen={isAddFixedExpenseModalOpen}
        onClose={() => setIsAddFixedExpenseModalOpen(false)}
        categories={categories}
        rates={rates}
        onSaved={() => showToast('Gasto fijo guardado con éxito')}
      />

      {/* Add Variable Expense Modal (Available globally & in mobile +) */}
      <AddVariableExpenseModal
        isOpen={isAddVariableExpenseModalOpen}
        onClose={() => setIsAddVariableExpenseModalOpen(false)}
        categories={categories}
        accounts={accounts}
        rates={rates}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onSaved={() => showToast('Gasto variable guardado con éxito')}
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

      {/* Notifications & System Alerts Modal (Centered Viewport Modal) */}
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        debts={debts}
        fixedExpenses={fixedExpenses}
        fixedIncomes={fixedIncomes}
        variableIncomes={variableIncomes}
        variableExpenses={variableExpenses}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onNavigate={handleViewChange}
        onOpenAddDebt={() => handleViewChange('debts')}
      />

      {/* Supabase Audit & Diagnostics Panel (Admin Only) */}
      <Suspense fallback={null}>
        <AuditPanel
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          currentUser={currentUser}
        />
      </Suspense>

      {/* Modal de Advertencia de Timeout (5 min de inactividad, 2 min de advertencia) */}
      {showTimeoutWarning && currentUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-amber-500/50 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-300">
            {/* Header con ícono */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-app">
                  Sesión a punto de expirar
                </h3>
                <p className="text-xs text-muted mt-1">
                  Por seguridad, tu sesión se cerrará automáticamente por inactividad.
                </p>
              </div>
            </div>

            {/* Timer grande */}
            <div className="p-4 rounded-2xl bg-card border border-app text-center">
              <div className="flex items-center justify-center gap-2 text-muted mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Tiempo restante</span>
              </div>
              <p className="text-4xl font-black text-amber-400 tabular-nums">
                {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-[10px] text-muted mt-1">
                {remainingSeconds > 60 ? 'minutos' : 'segundos'}
              </p>
            </div>

            {/* Opciones */}
            <div className="space-y-2">
              <button
                onClick={extendSession}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary-custom to-cyan-400 text-white text-xs font-bold shadow-lg shadow-primary-custom/25 hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mantener sesión activa</span>
              </button>

              <button
                onClick={handleSessionTimeout}
                className="w-full py-3 rounded-2xl bg-card hover:bg-surface-hover border border-app text-app text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar sesión ahora</span>
              </button>
            </div>

            {/* Nota informativa */}
            <p className="text-[10px] text-muted text-center leading-relaxed">
              💡 Tip: Marca &quot;Mantenerme conectado&quot; en el login para evitar este mensaje en futuras sesiones.
            </p>
          </div>
        </div>
      )}

      {/* Mobile-First Fixed Bottom Navigation Bar */}
      <BottomNav
        activeView={activeView}
        onChangeView={handleViewChange}
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
