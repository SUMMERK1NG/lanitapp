import { create } from 'zustand';
import type {
  Account,
  Category,
  Debt,
  DebtPayment,
  FixedExpense,
  FixedIncome,
  VariableIncome,
  VariableExpense,
  FortnightItemState,
  FortnightType,
  MonthlyFixedIncomeOverride,
  MonthlyFixedOverride,
  PlanningNote,
  PlanningTask,
  SavingContribution,
  SavingsGoal,
  SyncStatus,
  Transaction,
  UserProfile,
} from '../types/index.ts';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_COLOR_MAP,
  DEFAULT_CATEGORY_COLOR_BY_NAME,
  PALETTE_COLORS,
} from '../constants/finance.ts';
import {
  getActiveUserId,
  getLastSyncTimestamp,
  setLastSyncTimestampInMemory,
} from '../lib/supabaseSession.ts';
import { patchDashboardWidgets } from '../lib/profilePreferences.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { ensureValidUuid, generateUuid, isValidUuid } from '../utils/uuid.ts';
import {
  getLocalTodayString,
  parseLocalDate,
  getFortnightPeriodKey,
  getFortnightTransactionDate,
} from '../utils/date.ts';
import { logger } from '../utils/logger.ts';
import {
  setCategoryMap,
  getPreferredCategoryRef,
  toSupabaseAccountPayload,
  toSupabaseDebtPaymentPayload,
  toSupabaseFortnightStatePayload,
  normalizeFortnightItemStateRow,
  toSupabaseSavingContributionPayload,
  normalizeSavingContributionRow,
  toSupabaseMonthlyOverridePayload,
  normalizeMonthlyFixedOverrideRow,
  toSupabaseMonthlyIncomeOverridePayload,
  normalizeMonthlyFixedIncomeOverrideRow,
  toSupabaseVariableIncomePayload,
  normalizeVariableIncomeRow,
  toSupabaseVariableExpensePayload,
  normalizeVariableExpenseRow,
  toSupabaseTransactionPayload,
  toSupabaseFixedIncomePayload,
  toSupabaseFixedExpensePayload,
  getPlanningNoteUuid,
  toSupabasePlanningNotePayload,
  normalizePlanningNoteRow,
  sanitizeDebtPayload,
  normalizeDebtRow,
} from '../lib/supabasePayloads.ts';

export type RealtimeSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export const fortnightToQuincena = (f: any): number | null => {
  if (f === 'q1' || f === 15 || f === '15') return 15;
  if (f === 'q2' || f === 30 || f === '30') return 30;
  if (f === 'split' || f === 50 || f === '50') return 50;
  return null; // 'both'
};

export const quincenaToFortnight = (q: any, notes?: string): 'q1' | 'q2' | 'both' | 'split' => {
  if (notes && notes.includes('[split]')) return 'split';
  if (q === 15 || q === '15' || q === 'q1') return 'q1';
  if (q === 30 || q === '30' || q === 'q2') return 'q2';
  if (q === 50 || q === '50' || q === 'split') return 'split';
  return 'both';
};

export interface SyncQueueItem {
  id: string;
  table: string;
  action: 'upsert' | 'delete';
  payload: any;
  timestamp: string;
}

export interface DebtPaymentInput {
  debt_id: string;
  user_id?: string;
  amount: number;
  principal_amount?: number;
  interest_amount?: number;
  unpaid_interest_capitalized?: number;
  payment_type?: 'full' | 'interest_only' | 'principal_only' | 'mixed';
  payment_date?: string;
  fortnight?: FortnightType;
  year?: number;
  month?: number;
  rate_applied?: number;
  parallel_rate?: number;
  notes?: string;
  account_id?: string;
}

export interface SavingContributionInput {
  goal_id: string;
  user_id?: string;
  amount: number;
  year: number;
  month: number;
  fortnight: FortnightType;
  notes?: string;
  source_type?: 'account' | 'variable_income';
  account_id?: string;
  income_description?: string;
}

export interface FinanceStoreState {
  // Supabase Entities (16 tablas)
  profiles: UserProfile[];
  categories: Category[];
  accounts: Account[];
  fixedIncomes: FixedIncome[];
  monthlyIncomeOverrides: MonthlyFixedIncomeOverride[];
  variableIncomes: VariableIncome[];
  fixedExpenses: FixedExpense[];
  monthlyFixedOverrides: MonthlyFixedOverride[];
  variableExpenses: VariableExpense[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  savingsGoals: SavingsGoal[];
  savingContributions: SavingContribution[];
  fortnightItemStates: FortnightItemState[];
  planningNotes: PlanningNote[];
  transactions: Transaction[];

  // Sync state
  syncStatus: RealtimeSyncStatus;
  lastSyncTime: string | null;
  lastSyncTimestamp: string | null;
  setLastSyncTimestamp: (timestamp: string | null) => void;
  isLoading: boolean;
  error: string | null;
  syncQueue: SyncQueueItem[];

  // UI state (en memoria + preferencia en Supabase profiles.dashboard_widgets)
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Core Sync Actions
  setSyncStatus: (status: RealtimeSyncStatus) => void;
  setError: (error: string | null) => void;
  fetchInitialData: (userId: string) => Promise<void>;
  handleRealtimePayload: (table: string, payload: any, userId: string) => Promise<void>;
  flushSyncQueue: (userId: string) => Promise<void>;
  forceCloudSync: (userId?: string) => Promise<{ success: boolean; message: string }>;
  clearCurrentUserData: (userId?: string) => Promise<void>;

  // Categories
  saveCategory: (category: Partial<Category> & { name: string; type: Category['type'] }, userId?: string) => Promise<Category>;
  deleteCategory: (id: string, userId?: string) => Promise<void>;
  seedUserDefaultCategories: (userId: string, forceReset?: boolean) => Promise<Category[]>;

  // Accounts
  saveAccount: (
    account: Partial<Account> & { name: string; type: Account['type']; currency: string; initial_balance: number },
    userId?: string
  ) => Promise<Account>;
  deleteAccount: (id: string, userId?: string) => Promise<void>;
  adjustAccountBalance: (accountId: string, newInitialBalance: number, userId?: string) => Promise<void>;

  // Fixed & Variable Incomes
  saveFixedIncome: (
    income: Partial<FixedIncome> & { name: string; amount: number; default_fortnight: 'q1' | 'q2' | 'both' | 'split' },
    userId?: string
  ) => Promise<FixedIncome>;
  deleteFixedIncome: (id: string, userId?: string) => Promise<void>;
  toggleMonthlyFixedIncomeOverride: (
    incomeId: string,
    year: number,
    month: number,
    isActive: boolean,
    customAmount?: number,
    notes?: string,
    userId?: string
  ) => Promise<MonthlyFixedIncomeOverride>;

  saveVariableIncome: (
    income: Partial<VariableIncome> & {
      description: string;
      amount: number;
      year: number;
      month: number;
      fortnight: FortnightType;
    },
    userId?: string
  ) => Promise<VariableIncome>;
  deleteVariableIncome: (id: string, userId?: string) => Promise<void>;

  // Fixed & Variable Expenses
  saveFixedExpense: (
    expense: Partial<FixedExpense> & { name: string; amount: number; default_fortnight: 'q1' | 'q2' | 'both' },
    userId?: string
  ) => Promise<FixedExpense>;
  deleteFixedExpense: (id: string, userId?: string) => Promise<void>;
  toggleMonthlyFixedOverride: (
    expenseId: string,
    year: number,
    month: number,
    isActive: boolean,
    customAmount?: number,
    notes?: string,
    userId?: string
  ) => Promise<MonthlyFixedOverride>;

  saveVariableExpense: (
    expense: Partial<VariableExpense> & {
      description: string;
      amount: number;
      year: number;
      month: number;
      fortnight: FortnightType;
    },
    userId?: string
  ) => Promise<VariableExpense>;
  deleteVariableExpense: (id: string, userId?: string) => Promise<void>;

  // Debts
  saveDebt: (
    debt: Partial<Debt> & { creditor: string; total_amount: number; payment_type: Debt['payment_type'] },
    userId?: string
  ) => Promise<Debt>;
  deleteDebt: (id: string, userId?: string) => Promise<void>;
  fetchDebts: (userId?: string) => Promise<Debt[]>;
  subscribeToDebtsChanges: (userId: string, onUpdate?: () => void) => () => void;
  addDebtPayment: (data: DebtPaymentInput, userId?: string) => Promise<DebtPayment>;

  // Savings Goals & Contributions
  saveSavingsGoal: (
    goal: Partial<SavingsGoal> & {
      name: string;
      target_amount: number;
      amount_per_period: number;
      frequency: SavingsGoal['frequency'];
    },
    userId?: string
  ) => Promise<SavingsGoal>;
  deleteSavingsGoal: (id: string, userId?: string) => Promise<void>;
  addSavingContribution: (data: SavingContributionInput, userId?: string) => Promise<SavingContribution>;
  skipSavingContributionPeriod: (
    data: { goal_id: string; user_id?: string; year: number; month: number; fortnight: FortnightType; reason?: string },
    userId?: string
  ) => Promise<SavingContribution>;
  setSavingContributionSkipped: (
    data: { goal_id: string; year: number; month: number; fortnight: FortnightType; notes?: string },
    userId?: string
  ) => Promise<SavingContribution>;
  unmarkSavingContribution: (contributionId: string, userId?: string) => Promise<void>;

  // Fortnight States
  setFortnightExpensePaid: (
    params: {
      expense: FixedExpense;
      year: number;
      month: number;
      fortnight: FortnightType;
      amount: number;
      accountId?: string;
    },
    userId?: string
  ) => Promise<void>;
  unmarkFortnightExpensePaid: (
    params: { expenseId: string; year: number; month: number; fortnight: FortnightType },
    userId?: string
  ) => Promise<void>;

  setFortnightExpenseSkipped: (
    params: { expenseId: string; year: number; month: number; fortnight: FortnightType },
    userId?: string
  ) => Promise<void>;
  unmarkFortnightExpenseSkipped: (
    params: { expenseId: string; year: number; month: number; fortnight: FortnightType },
    userId?: string
  ) => Promise<void>;

  setFortnightDebtSkipped: (
    params: { debtId: string; year: number; month: number; fortnight: FortnightType },
    userId?: string
  ) => Promise<void>;
  unmarkFortnightDebtSkipped: (
    params: { debtId: string; year: number; month: number; fortnight: FortnightType },
    userId?: string
  ) => Promise<void>;

  // Planning Notes & Tasks
  savePlanningNote: (
    data: { user_id?: string; year: number; month: number; notes?: string; tasks?: PlanningTask[] },
    userId?: string
  ) => Promise<PlanningNote>;
  addPlanningTask: (
    data: { user_id?: string; year: number; month: number; text: string; due_day?: number; priority?: 'low' | 'medium' | 'high' },
    userId?: string
  ) => Promise<PlanningNote>;
  togglePlanningTask: (
    data: { user_id?: string; year: number; month: number; taskId: string },
    userId?: string
  ) => Promise<PlanningNote>;
  deletePlanningTask: (
    data: { user_id?: string; year: number; month: number; taskId: string },
    userId?: string
  ) => Promise<PlanningNote>;
  updatePlanningNotesText: (
    data: { user_id?: string; year: number; month: number; notes: string },
    userId?: string
  ) => Promise<PlanningNote>;

  // Transactions
  addTransaction: (
    txData: Omit<Transaction, 'id' | 'sync_status' | 'created_at'>,
    userId?: string
  ) => Promise<Transaction>;
  deleteTransaction: (id: string, userId?: string) => Promise<void>;
}

/** Upsert in-memory list item by UUID */
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const exists = list.some((el) => el.id === item.id);
  return exists ? list.map((el) => (el.id === item.id ? item : el)) : [...list, item];
}

/** Normaliza los colores y nombres de categorías */
function sanitizeCategoriesList(list: Category[]): Category[] {
  return list.map((c, index) => {
    let targetColor = c.color;
    if (!targetColor || targetColor === '#FF914D') {
      const normName = (c.name || '').toLowerCase().trim();
      targetColor =
        (c.code && DEFAULT_CATEGORY_COLOR_MAP[c.code]) ||
        DEFAULT_CATEGORY_COLOR_BY_NAME[normName] ||
        PALETTE_COLORS[index % PALETTE_COLORS.length];
    }
    return {
      ...c,
      id: ensureValidUuid(c.id),
      name: c.name ? c.name.replace(/\s*&\s*/g, ' y ') : c.name,
      color: targetColor,
      sync_status: c.sync_status || 'synced',
    };
  });
}

/** Resuelve el auth.uid() real con fallback al userId activo */
async function resolveAuthenticatedUserId(explicitUserId?: string): Promise<string> {
  if (explicitUserId && isValidUuid(explicitUserId)) return explicitUserId;
  const cached = getActiveUserId();
  if (cached && isValidUuid(cached)) return cached;
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) return data.user.id;
    } catch {
      // Fallback abajo
    }
  }
  return explicitUserId || cached || '';
}

/**
 * Consulta segura a Supabase que captura errores de esquema o red sin abortar todo el batch
 */
async function safeQuery<T = any>(
  tableName: string,
  queryFn: () => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  try {
    const res = await queryFn();
    if (res.error) {
      const isAuthErr =
        res.error.code === 'PGRST301' ||
        (res.error as any)?.status === 401 ||
        res.error.message?.toLowerCase().includes('jwt') ||
        res.error.message?.toLowerCase().includes('unauthorized');

      if (isAuthErr) {
        throw new Error(`AUTH_EXPIRED: ${res.error.message || 'JWT Expired'}`);
      }

      logger.warn(`[Supabase Table Notice '${tableName}']:`, res.error.message || res.error.details || res.error);
      return [];
    }
    return (res.data as T[]) || [];
  } catch (err: any) {
    if (err?.message?.startsWith('AUTH_EXPIRED')) {
      throw err;
    }
    logger.warn(`[Supabase Table Query Exception '${tableName}']:`, err?.message || err);
    return [];
  }
}

export const useFinanceStore = create<FinanceStoreState>((set, get) => {
  /** Encola un item único para reintento transitorio en memoria (deduplicado por tabla+acción+id) */
  const enqueueRetry = (item: Omit<SyncQueueItem, 'timestamp'>) => {
    const timestamp = new Date().toISOString();
    set((state) => {
      const filtered = state.syncQueue.filter(
        (q) => !(q.table === item.table && q.action === item.action && q.id === item.id)
      );
      return {
        syncQueue: [...filtered, { ...item, timestamp }],
      };
    });
  };

  /** Ejecuta un upsert en Supabase o encola si hubo fallo de red */
  const syncUpsert = async (table: string, id: string, payload: Record<string, any>): Promise<boolean> => {
    if (!navigator.onLine || !isSupabaseConfigured() || !supabase) {
      enqueueRetry({ id, table, action: 'upsert', payload });
      set({ syncStatus: navigator.onLine ? 'error' : 'offline' });
      return false;
    }

    try {
      const { error } = await supabase.from(table).upsert(payload);
      if (!error) {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTimestampInMemory(now);
        set({ syncStatus: 'connected', lastSyncTime: now, lastSyncTimestamp: now });
        return true;
      }
      logger.error(`[Supabase Upsert Error '${table}']:`, error.message, error.details);
      enqueueRetry({ id, table, action: 'upsert', payload });
      set({ syncStatus: 'error' });
      return false;
    } catch (e) {
      logger.warn(`[Supabase Upsert Network Notice '${table}']:`, e);
      enqueueRetry({ id, table, action: 'upsert', payload });
      set({ syncStatus: navigator.onLine ? 'error' : 'offline' });
      return false;
    }
  };

  /** Ejecuta un delete en Supabase o encola si hubo fallo de red */
  const syncDelete = async (table: string, id: string, userId?: string): Promise<boolean> => {
    const payload = { id, user_id: userId || getActiveUserId() };
    if (!navigator.onLine || !isSupabaseConfigured() || !supabase) {
      enqueueRetry({ id, table, action: 'delete', payload });
      return false;
    }

    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTimestampInMemory(now);
        set({ syncStatus: 'connected', lastSyncTime: now, lastSyncTimestamp: now });
        return true;
      }
      logger.error(`[Supabase Delete Error '${table}']:`, error.message, error.details);
      enqueueRetry({ id, table, action: 'delete', payload });
      return false;
    } catch (e) {
      logger.warn(`[Supabase Delete Network Notice '${table}']:`, e);
      enqueueRetry({ id, table, action: 'delete', payload });
      return false;
    }
  };

  return {
    profiles: [],
    categories: DEFAULT_CATEGORIES,
    accounts: [],
    fixedIncomes: [],
    monthlyIncomeOverrides: [],
    variableIncomes: [],
    fixedExpenses: [],
    monthlyFixedOverrides: [],
    variableExpenses: [],
    debts: [],
    debtPayments: [],
    savingsGoals: [],
    savingContributions: [],
    fortnightItemStates: [],
    planningNotes: [],
    transactions: [],

    syncStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'syncing' : 'offline',
    lastSyncTime: getLastSyncTimestamp(),
    lastSyncTimestamp: getLastSyncTimestamp(),
    setLastSyncTimestamp: (timestamp: string | null) => {
      setLastSyncTimestampInMemory(timestamp);
      set({ lastSyncTimestamp: timestamp, lastSyncTime: timestamp });
    },
    isLoading: true,
    error: null,
    syncQueue: [],

    isSidebarCollapsed: false,
    toggleSidebar: () => {
      const next = !get().isSidebarCollapsed;
      set({ isSidebarCollapsed: next });
      const uid = getActiveUserId();
      if (uid) {
        patchDashboardWidgets(uid, { sidebar_collapsed: next }).catch(() => {});
      }
    },
    setSidebarCollapsed: (collapsed: boolean) => {
      set({ isSidebarCollapsed: collapsed });
      const uid = getActiveUserId();
      if (uid) {
        patchDashboardWidgets(uid, { sidebar_collapsed: collapsed }).catch(() => {});
      }
    },

    setSyncStatus: (status) => set({ syncStatus: status }),
    setError: (error) => set({ error }),

    /**
     * Carga inicial completa directa desde Supabase (100% en línea, sin IndexedDB)
     */
    fetchInitialData: async (userId: string) => {
      if (!userId) return;

      if (!navigator.onLine || !isSupabaseConfigured() || !supabase) {
        set({ syncStatus: 'offline', isLoading: false });
        return;
      }

      set({ syncStatus: 'syncing' });

      try {
        await get().flushSyncQueue(userId);
        logger.dev(`[Supabase Fetch Initial]: Consultando 16 tablas para usuario ${userId}...`);

        const client = supabase;
        const [
          rawProfiles,
          rawCategories,
          rawAccounts,
          rawFixedIncomes,
          rawIncomeOverrides,
          rawVariableIncomes,
          rawExpenses,
          rawExpenseOverrides,
          rawVariableExpenses,
          rawDebts,
          rawDebtPayments,
          rawSavings,
          rawContribs,
          rawStates,
          rawPlanningNotes,
          rawTxs,
        ] = await Promise.all([
          safeQuery('profiles', () => client.from('profiles').select('*').eq('id', userId)),
          safeQuery('categories', () =>
            client.from('categories').select('*').or(`user_id.eq.${userId},user_id.is.null`)
          ),
          safeQuery('accounts', () => client.from('accounts').select('*').eq('user_id', userId)),
          safeQuery('fixed_incomes', () => client.from('fixed_incomes').select('*').eq('user_id', userId)),
          safeQuery('monthly_fixed_income_overrides', () =>
            client.from('monthly_fixed_income_overrides').select('*').eq('user_id', userId)
          ),
          safeQuery('variable_incomes', () => client.from('variable_incomes').select('*').eq('user_id', userId)),
          safeQuery('fixed_expenses', () => client.from('fixed_expenses').select('*').eq('user_id', userId)),
          safeQuery('monthly_fixed_overrides', () =>
            client.from('monthly_fixed_overrides').select('*').eq('user_id', userId)
          ),
          safeQuery('variable_expenses', () => client.from('variable_expenses').select('*').eq('user_id', userId)),
          safeQuery('debts', () => client.from('debts').select('*').eq('user_id', userId)),
          safeQuery('debt_payments', () => client.from('debt_payments').select('*').eq('user_id', userId)),
          safeQuery('savings_goals', () => client.from('savings_goals').select('*').eq('user_id', userId)),
          safeQuery('saving_contributions', () => client.from('saving_contributions').select('*').eq('user_id', userId)),
          safeQuery('fortnight_item_states', () => client.from('fortnight_item_states').select('*').eq('user_id', userId)),
          safeQuery('planning_notes', () => client.from('planning_notes').select('*').eq('user_id', userId)),
          safeQuery('transactions', () => client.from('transactions').select('*').eq('user_id', userId)),
        ]);

        const profiles: UserProfile[] = rawProfiles;
        const primaryProfile = profiles[0] as any;
        const widgetPrefs = primaryProfile?.dashboard_widgets || {};

        const userCats = rawCategories.filter((c: any) => c.user_id === userId);
        const systemCats = rawCategories.filter((c: any) => !c.user_id);

        let categories: Category[] = [];
        if (userCats.length > 0) {
          categories = sanitizeCategoriesList(userCats);
        } else if (!widgetPrefs?.categories_seeded) {
          categories = await get().seedUserDefaultCategories(userId, false);
          patchDashboardWidgets(userId, { categories_seeded: true }).catch(() => {});
        } else if (systemCats.length > 0) {
          categories = sanitizeCategoriesList(systemCats);
        } else {
          categories = DEFAULT_CATEGORIES;
        }

        // Incluir categorías del sistema en el mapa para resolver referencias legacy/default UUIDs
        setCategoryMap([...categories, ...sanitizeCategoriesList(systemCats)]);

        const accounts: Account[] = rawAccounts.map((a: any) => ({
          id: ensureValidUuid(a.id),
          user_id: a.user_id || userId,
          name: a.name,
          type: a.type || 'cash',
          currency: a.currency || 'USD',
          initial_balance:
            typeof a.initial_balance === 'number'
              ? a.initial_balance
              : typeof a.balance === 'number'
                ? a.balance
                : parseFloat(a.initial_balance || a.balance || 0) || 0,
          color: a.color,
          notes: a.notes || '',
          created_at: a.created_at,
          updated_at: a.updated_at,
          sync_status: 'synced' as SyncStatus,
        }));

        const fixedIncomes: FixedIncome[] = rawFixedIncomes.map((i: any) => ({
          ...i,
          id: ensureValidUuid(i.id),
          default_fortnight: quincenaToFortnight(i.default_fortnight, i.notes),
          sync_status: 'synced',
        }));

        const monthlyIncomeOverrides: MonthlyFixedIncomeOverride[] = rawIncomeOverrides.map(
          normalizeMonthlyFixedIncomeOverrideRow
        );
        const variableIncomes: VariableIncome[] = rawVariableIncomes.map(normalizeVariableIncomeRow);

        const fixedExpenses: FixedExpense[] = rawExpenses.map((e: any) => ({
          ...e,
          id: ensureValidUuid(e.id),
          default_fortnight: quincenaToFortnight(e.default_fortnight || e.default_quincena, e.notes),
          sync_status: 'synced',
        }));

        const monthlyFixedOverrides: MonthlyFixedOverride[] = rawExpenseOverrides.map(
          normalizeMonthlyFixedOverrideRow
        );
        const variableExpenses: VariableExpense[] = rawVariableExpenses.map(normalizeVariableExpenseRow);
        const debts: Debt[] = rawDebts.map(normalizeDebtRow);
        const debtPayments: DebtPayment[] = rawDebtPayments.map((p: any) => ({
          ...p,
          id: ensureValidUuid(p.id),
          amount: Number(p.amount ?? p.amount_paid ?? 0),
          sync_status: 'synced',
        }));
        const savingsGoals: SavingsGoal[] = rawSavings.map((s: any) => ({
          ...s,
          id: ensureValidUuid(s.id),
          sync_status: 'synced',
        }));
        const savingContributions: SavingContribution[] = rawContribs.map(normalizeSavingContributionRow);
        const fortnightItemStates: FortnightItemState[] = rawStates.map(normalizeFortnightItemStateRow);
        const planningNotes: PlanningNote[] = rawPlanningNotes.map(normalizePlanningNoteRow);
        const transactions: Transaction[] = rawTxs.map((t: any) => ({
          ...t,
          id: ensureValidUuid(t.id),
          sync_status: 'synced',
        }));

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTimestampInMemory(now);

        set({
          profiles,
          categories,
          accounts,
          fixedIncomes,
          monthlyIncomeOverrides,
          variableIncomes,
          fixedExpenses,
          monthlyFixedOverrides,
          variableExpenses,
          debts,
          debtPayments,
          savingsGoals,
          savingContributions,
          fortnightItemStates,
          planningNotes,
          transactions,
          isSidebarCollapsed:
            typeof widgetPrefs?.sidebar_collapsed === 'boolean'
              ? widgetPrefs.sidebar_collapsed
              : get().isSidebarCollapsed,
          syncStatus: 'connected',
          lastSyncTime: now,
          lastSyncTimestamp: now,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        logger.error('[FinanceStore Fetch Initial Error]:', err);
        set({ syncStatus: 'error', error: err.message, isLoading: false });
        if (err?.message?.includes('AUTH_EXPIRED') && isSupabaseConfigured() && supabase) {
          supabase.auth.refreshSession().catch(() => {});
        }
      }
    },

    /**
     * Manejador de eventos Realtime de Supabase (Smart Merge en memoria)
     */
    handleRealtimePayload: async (table: string, payload: any, userId: string) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      logger.dev(`[Realtime Merge on ${table} - ${eventType}]:`, newRow || oldRow);

      if (newRow?.user_id && newRow.user_id !== userId) return;

      switch (table) {
        case 'profiles': {
          if (newRow?.id && newRow.id === userId) {
            set((s) => ({ profiles: upsertById(s.profiles, newRow as UserProfile) }));
            if (typeof document !== 'undefined') {
              if (newRow.theme_mode) {
                const root = document.documentElement;
                root.classList.remove(
                  'theme-navy',
                  'theme-dark',
                  'theme-emerald',
                  'theme-purple',
                  'theme-moca',
                  'theme-light'
                );
                root.classList.add(`theme-${newRow.theme_mode}`);
              }
              if (newRow.accent_color) {
                document.documentElement.style.setProperty('--primary', newRow.accent_color);
                document.documentElement.style.setProperty('--primary-custom', newRow.accent_color);
              }
            }
          }
          break;
        }
        case 'accounts': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ accounts: s.accounts.filter((a) => a.id !== oldRow.id && a.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const accItem: Account = {
              id: ensureValidUuid(newRow.id),
              user_id: newRow.user_id || userId,
              name: newRow.name,
              type: newRow.type || 'cash',
              currency: newRow.currency || 'USD',
              initial_balance:
                typeof newRow.initial_balance === 'number'
                  ? newRow.initial_balance
                  : typeof newRow.balance === 'number'
                    ? newRow.balance
                    : parseFloat(newRow.initial_balance || newRow.balance || 0) || 0,
              color: newRow.color,
              notes: newRow.notes || '',
              created_at: newRow.created_at,
              updated_at: newRow.updated_at,
              sync_status: 'synced',
            };
            set((s) => ({ accounts: upsertById(s.accounts, accItem) }));
          }
          break;
        }
        case 'categories': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => {
              const next = s.categories.filter((c) => c.id !== oldRow.id && c.id !== oldUuid);
              setCategoryMap(next);
              return { categories: next };
            });
          } else if (newRow?.id) {
            if (!newRow.user_id || newRow.user_id === userId) {
              const catItem: Category = sanitizeCategoriesList([
                {
                  id: ensureValidUuid(newRow.id),
                  user_id: newRow.user_id || userId,
                  name: newRow.name,
                  type: newRow.type || 'expense',
                  icon: newRow.icon || 'tag',
                  color: newRow.color || '#147DF0',
                  code: newRow.code,
                  sync_status: 'synced',
                },
              ])[0];
              set((s) => {
                const next = upsertById(s.categories, catItem);
                setCategoryMap(next);
                return { categories: next };
              });
            }
          }
          break;
        }
        case 'fixed_incomes': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ fixedIncomes: s.fixedIncomes.filter((i) => i.id !== oldRow.id && i.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item: FixedIncome = {
              ...newRow,
              id: ensureValidUuid(newRow.id),
              default_fortnight: quincenaToFortnight(newRow.default_fortnight, newRow.notes),
              category_id: newRow.category_id || 'cat_salary',
              is_active: newRow.is_active !== undefined ? newRow.is_active : true,
              sync_status: 'synced',
            };
            set((s) => ({ fixedIncomes: upsertById(s.fixedIncomes, item) }));
          }
          break;
        }
        case 'monthly_fixed_income_overrides': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({
              monthlyIncomeOverrides: s.monthlyIncomeOverrides.filter((o) => o.id !== oldRow.id && o.id !== oldUuid),
            }));
          } else if (newRow?.id) {
            const item = normalizeMonthlyFixedIncomeOverrideRow(newRow);
            set((s) => ({ monthlyIncomeOverrides: upsertById(s.monthlyIncomeOverrides, item) }));
          }
          break;
        }
        case 'variable_incomes': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ variableIncomes: s.variableIncomes.filter((v) => v.id !== oldRow.id && v.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item = normalizeVariableIncomeRow(newRow);
            set((s) => ({ variableIncomes: upsertById(s.variableIncomes, item) }));
          }
          break;
        }
        case 'fixed_expenses': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ fixedExpenses: s.fixedExpenses.filter((e) => e.id !== oldRow.id && e.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item: FixedExpense = {
              ...newRow,
              id: ensureValidUuid(newRow.id),
              default_fortnight: quincenaToFortnight(newRow.default_fortnight || newRow.default_quincena, newRow.notes),
              sync_status: 'synced',
            };
            set((s) => ({ fixedExpenses: upsertById(s.fixedExpenses, item) }));
          }
          break;
        }
        case 'monthly_fixed_overrides': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({
              monthlyFixedOverrides: s.monthlyFixedOverrides.filter((o) => o.id !== oldRow.id && o.id !== oldUuid),
            }));
          } else if (newRow?.id) {
            const item = normalizeMonthlyFixedOverrideRow(newRow);
            set((s) => ({ monthlyFixedOverrides: upsertById(s.monthlyFixedOverrides, item) }));
          }
          break;
        }
        case 'variable_expenses': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({
              variableExpenses: s.variableExpenses.filter((v) => v.id !== oldRow.id && v.id !== oldUuid),
            }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item = normalizeVariableExpenseRow(newRow);
            set((s) => ({ variableExpenses: upsertById(s.variableExpenses, item) }));
          }
          break;
        }
        case 'debts': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ debts: s.debts.filter((d) => d.id !== oldRow.id && d.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item = normalizeDebtRow(newRow);
            set((s) => ({ debts: upsertById(s.debts, item) }));
          }
          break;
        }
        case 'debt_payments': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ debtPayments: s.debtPayments.filter((p) => p.id !== oldRow.id && p.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item: DebtPayment = {
              ...newRow,
              id: ensureValidUuid(newRow.id),
              amount: Number(newRow.amount ?? newRow.amount_paid ?? 0),
              sync_status: 'synced',
            };
            set((s) => ({ debtPayments: upsertById(s.debtPayments, item) }));
          }
          break;
        }
        case 'savings_goals': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== oldRow.id && g.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            let normalizedFortnight: 15 | 30 | null = null;
            if (newRow.target_fortnight === 15 || newRow.target_fortnight === '15' || newRow.target_fortnight === 'q1') {
              normalizedFortnight = 15;
            } else if (newRow.target_fortnight === 30 || newRow.target_fortnight === '30' || newRow.target_fortnight === 'q2') {
              normalizedFortnight = 30;
            }
            const item: SavingsGoal = {
              ...newRow,
              id: ensureValidUuid(newRow.id),
              target_fortnight: newRow.frequency === 'fortnightly' ? null : normalizedFortnight,
              sync_status: 'synced',
            };
            set((s) => ({ savingsGoals: upsertById(s.savingsGoals, item) }));
          }
          break;
        }
        case 'saving_contributions': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({
              savingContributions: s.savingContributions.filter((c) => c.id !== oldRow.id && c.id !== oldUuid),
            }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item = normalizeSavingContributionRow(newRow);
            set((s) => ({ savingContributions: upsertById(s.savingContributions, item) }));
          }
          break;
        }
        case 'fortnight_item_states': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({
              fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== oldRow.id && st.id !== oldUuid),
            }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item = normalizeFortnightItemStateRow(newRow);
            set((s) => ({ fortnightItemStates: upsertById(s.fortnightItemStates, item) }));
          }
          break;
        }
        case 'planning_notes': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ planningNotes: s.planningNotes.filter((n) => n.id !== oldRow.id && n.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item = normalizePlanningNoteRow(newRow);
            set((s) => ({ planningNotes: upsertById(s.planningNotes, item) }));
          }
          break;
        }
        case 'transactions': {
          if (eventType === 'DELETE' && oldRow?.id) {
            const oldUuid = ensureValidUuid(oldRow.id);
            set((s) => ({ transactions: s.transactions.filter((t) => t.id !== oldRow.id && t.id !== oldUuid) }));
          } else if (newRow?.id) {
            if (newRow.user_id && userId && newRow.user_id !== userId) break;
            const item: Transaction = { ...newRow, id: ensureValidUuid(newRow.id), sync_status: 'synced' };
            set((s) => ({ transactions: upsertById(s.transactions, item) }));
          }
          break;
        }
        default:
          break;
      }

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTimestampInMemory(now);
      set({ lastSyncTime: now, lastSyncTimestamp: now, syncStatus: 'connected' });
    },

    /**
     * Vacía la cola de reintentos en memoria hacia Supabase
     */
    flushSyncQueue: async (userId: string) => {
      if (!navigator.onLine || !isSupabaseConfigured() || !supabase || !userId) return;

      const queue = get().syncQueue;
      if (queue.length === 0) return;

      const remaining: SyncQueueItem[] = [];

      for (const item of queue) {
        try {
          if (item.action === 'upsert') {
            logger.dev(`[Supabase Queue Flush]: Upserting on '${item.table}' ->`, item.payload);
            const { error } = await supabase.from(item.table).upsert(item.payload);
            if (error) {
              logger.error(`[Queue Flush Error on ${item.table}]:`, error.message, error.details);
              remaining.push(item);
            }
          } else if (item.action === 'delete') {
            logger.dev(`[Supabase Queue Flush]: Deleting from '${item.table}' id ${item.payload.id}`);
            const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id);
            if (error) {
              logger.error(`[Queue Delete Error on ${item.table}]:`, error.message, error.details);
              remaining.push(item);
            }
          }
        } catch {
          remaining.push(item);
        }
      }

      set({ syncQueue: remaining });
    },

    forceCloudSync: async (userId?: string) => {
      const uid = await resolveAuthenticatedUserId(userId);
      if (!uid) {
        return { success: false, message: 'No hay usuario autenticado para sincronizar.' };
      }
      if (!navigator.onLine || !isSupabaseConfigured() || !supabase) {
        return { success: false, message: 'Sin conexión a Internet o Supabase no configurado.' };
      }

      await get().flushSyncQueue(uid);
      await get().fetchInitialData(uid);
      const remaining = get().syncQueue.length;
      return {
        success: remaining === 0,
        message:
          remaining === 0
            ? 'Sincronización completa verificada directamente contra Supabase.'
            : `Sincronización completada con ${remaining} operaciones pendientes de reintento.`,
      };
    },

    clearCurrentUserData: async (userId?: string) => {
      const uid = await resolveAuthenticatedUserId(userId);
      if (!uid) return;

      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        const tablesToWipe = [
          'transactions',
          'fortnight_item_states',
          'saving_contributions',
          'savings_goals',
          'debt_payments',
          'debts',
          'variable_expenses',
          'monthly_fixed_overrides',
          'fixed_expenses',
          'variable_incomes',
          'monthly_fixed_income_overrides',
          'fixed_incomes',
          'planning_notes',
          'accounts',
        ] as const;

        await Promise.all(
          tablesToWipe.map((t) => supabase!.from(t).delete().eq('user_id', uid))
        );
      }

      set({
        accounts: [],
        fixedIncomes: [],
        monthlyIncomeOverrides: [],
        variableIncomes: [],
        fixedExpenses: [],
        monthlyFixedOverrides: [],
        variableExpenses: [],
        debts: [],
        debtPayments: [],
        savingsGoals: [],
        savingContributions: [],
        fortnightItemStates: [],
        planningNotes: [],
        transactions: [],
        syncQueue: [],
      });
    },

    // -----------------------------------------------------------------
    // CATEGORIES
    // -----------------------------------------------------------------

    saveCategory: async (category, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || category.user_id);
      const id = ensureValidUuid(category.id);
      const record: Category = {
        id,
        user_id: uid,
        name: category.name.trim(),
        type: category.type,
        icon: category.icon || 'tag',
        color: category.color || '#147DF0',
        code: category.code,
        sync_status: 'pending',
      };

      set((s) => {
        const next = upsertById(s.categories, record);
        setCategoryMap(next);
        return { categories: next };
      });

      const payload: Record<string, any> = {
        id,
        user_id: uid,
        name: record.name,
        type: record.type,
        icon: record.icon,
        color: record.color,
      };
      if (record.code) payload.code = record.code;

      const ok = await syncUpsert('categories', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ categories: upsertById(s.categories, record) }));
      }
      return record;
    },

    deleteCategory: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      set((s) => {
        const next = s.categories.filter((c) => c.id !== id && c.id !== cleanId);
        setCategoryMap(next);
        return { categories: next };
      });
      await syncDelete('categories', cleanId, uid);
    },

    seedUserDefaultCategories: async (userId: string, forceReset = false) => {
      const uid = await resolveAuthenticatedUserId(userId);
      if (!uid) return DEFAULT_CATEGORIES;

      const existing = get().categories.filter((c) => c.user_id === uid);
      if (existing.length > 0 && !forceReset) {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const seeded: Category[] = DEFAULT_CATEGORIES.map((def) => {
        const code = def.code || def.id;
        return {
          ...def,
          id: ensureValidUuid(`cat_${uid}_${code}`),
          user_id: uid,
          code,
          sync_status: 'pending',
        };
      });

      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          const payload = seeded.map((c) => ({
            id: c.id,
            user_id: uid,
            name: c.name,
            type: c.type,
            icon: c.icon,
            color: c.color,
            code: c.code,
            created_at: nowIso,
            updated_at: nowIso,
          }));
          const { error } = await supabase.from('categories').upsert(payload);
          if (!error) {
            seeded.forEach((c) => {
              c.sync_status = 'synced';
            });
          }
          patchDashboardWidgets(uid, { categories_seeded: true }).catch(() => {});
        } catch (e) {
          logger.warn('seedUserDefaultCategories upsert notice:', e);
        }
      }

      const sanitized = sanitizeCategoriesList(seeded);
      setCategoryMap(sanitized);
      set({ categories: sanitized });
      return sanitized;
    },

    // -----------------------------------------------------------------
    // ACCOUNTS
    // -----------------------------------------------------------------

    saveAccount: async (account, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || account.user_id);
      const id = ensureValidUuid(account.id);
      const balanceNum =
        typeof account.initial_balance === 'number'
          ? account.initial_balance
          : parseFloat(String(account.initial_balance || 0)) || 0;

      const record: Account = {
        id,
        user_id: uid,
        name: account.name.trim(),
        type: account.type || 'cash',
        currency: account.currency || 'USD',
        initial_balance: balanceNum,
        color: account.color,
        notes: account.notes || '',
        sync_status: 'pending',
        created_at: account.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((s) => ({ accounts: upsertById(s.accounts, record) }));
      const payload = toSupabaseAccountPayload(record, uid);
      logger.dev('[Supabase Accounts Payload]:', payload);

      const ok = await syncUpsert('accounts', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ accounts: upsertById(s.accounts, record) }));
      }
      return record;
    },

    deleteAccount: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id && a.id !== cleanId) }));
      await syncDelete('accounts', cleanId, uid);
    },

    adjustAccountBalance: async (accountId, newInitialBalance, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(accountId);
      const existing = get().accounts.find((a) => a.id === accountId || a.id === cleanId);
      if (!existing) return;

      const updated: Account = {
        ...existing,
        id: cleanId,
        user_id: existing.user_id || uid,
        initial_balance: Number(newInitialBalance),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      };

      set((s) => ({ accounts: upsertById(s.accounts, updated) }));
      const payload = toSupabaseAccountPayload(updated, uid);
      const ok = await syncUpsert('accounts', cleanId, payload);
      if (ok) {
        updated.sync_status = 'synced';
        set((s) => ({ accounts: upsertById(s.accounts, updated) }));
      }
    },

    // -----------------------------------------------------------------
    // INCOMES
    // -----------------------------------------------------------------

    saveFixedIncome: async (income, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || income.user_id);
      const id = ensureValidUuid(income.id);
      const resolvedCatRef = getPreferredCategoryRef(income.category_id || 'cat_salary', 'income');

      const cleanNotes = (income.notes || '').replace(/\s*\[split\]/g, '').trim();
      const isSplit = (income.default_fortnight as string) === 'split';
      const notesWithTag = isSplit ? (cleanNotes ? `${cleanNotes} [split]` : '[split]') : cleanNotes;

      const record: FixedIncome = {
        id,
        user_id: uid,
        name: income.name,
        amount: Number(income.amount),
        original_amount: income.original_amount !== undefined ? Number(income.original_amount) : Number(income.amount),
        currency: income.currency || 'USD',
        payment_mode: income.payment_mode || 'usd_cash',
        default_fortnight: income.default_fortnight as FixedIncome['default_fortnight'],
        category_id: resolvedCatRef,
        due_day: income.due_day,
        is_active: income.is_active !== undefined ? income.is_active : true,
        notes: notesWithTag,
        sync_status: 'pending',
        created_at: income.created_at || new Date().toISOString(),
      };

      set((s) => ({ fixedIncomes: upsertById(s.fixedIncomes, record) }));
      const payload = toSupabaseFixedIncomePayload(record, uid);
      logger.dev('[Supabase Fixed Incomes Payload]:', payload);

      const ok = await syncUpsert('fixed_incomes', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ fixedIncomes: upsertById(s.fixedIncomes, record) }));
      }
      return record;
    },

    deleteFixedIncome: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      set((s) => ({ fixedIncomes: s.fixedIncomes.filter((i) => i.id !== id && i.id !== cleanId) }));
      await syncDelete('fixed_incomes', cleanId, uid);
    },

    toggleMonthlyFixedIncomeOverride: async (incomeId, year, month, isActive, customAmount, notes, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanIncId = ensureValidUuid(incomeId);
      const existing = get().monthlyIncomeOverrides.find(
        (o) => (o.fixed_income_id === incomeId || o.fixed_income_id === cleanIncId) && o.year === year && o.month === month
      );
      const id = existing?.id || ensureValidUuid(`inc_ov_${cleanIncId}_${year}_${month}`);

      const record: MonthlyFixedIncomeOverride = {
        id,
        user_id: uid,
        fixed_income_id: cleanIncId,
        year,
        month,
        is_active: isActive,
        custom_amount: customAmount !== undefined ? Number(customAmount) : existing?.custom_amount,
        notes: notes !== undefined ? notes : existing?.notes || '',
        sync_status: 'pending',
      };

      set((s) => ({ monthlyIncomeOverrides: upsertById(s.monthlyIncomeOverrides, record) }));
      const payload = toSupabaseMonthlyIncomeOverridePayload(record, uid);
      const ok = await syncUpsert('monthly_fixed_income_overrides', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ monthlyIncomeOverrides: upsertById(s.monthlyIncomeOverrides, record) }));
      }
      return record;
    },

    saveVariableIncome: async (income, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || income.user_id);
      const id = ensureValidUuid(income.id);
      const existing = get().variableIncomes.find((v) => v.id === id);
      const txId = ensureValidUuid(existing?.transaction_id || income.transaction_id || `tx_vi_${id}`);
      const resolvedCatRef = getPreferredCategoryRef(income.category_id || 'cat_extras', 'income');

      const record: VariableIncome = {
        id,
        user_id: uid,
        description: income.description,
        amount: Number(income.amount),
        original_amount:
          income.original_amount !== undefined ? Number(income.original_amount) : Number(income.amount),
        payment_mode: income.payment_mode || 'usd_cash',
        year: income.year,
        month: income.month,
        fortnight: income.fortnight,
        category_id: resolvedCatRef,
        account_id: income.account_id || '',
        transaction_id: income.account_id ? txId : undefined,
        currency: income.currency || 'USD',
        notes: income.notes || '',
        sync_status: 'pending',
        created_at: income.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((s) => ({ variableIncomes: upsertById(s.variableIncomes, record) }));

      // Transacción vinculada en Capital & Cuentas
      if (record.account_id) {
        const tx: Transaction = {
          id: txId,
          user_id: uid,
          amount: Number(record.amount),
          type: 'income',
          description: `Ingreso: ${record.description}`,
          category_id: resolvedCatRef,
          account_id: record.account_id,
          transaction_date: getFortnightTransactionDate(record.year, record.month, record.fortnight),
          sync_status: 'pending',
          created_at: record.created_at || new Date().toISOString(),
        };
        set((s) => ({ transactions: upsertById(s.transactions, tx) }));
        const txOk = await syncUpsert('transactions', txId, toSupabaseTransactionPayload(tx));
        if (txOk) {
          tx.sync_status = 'synced';
          set((s) => ({ transactions: upsertById(s.transactions, tx) }));
        }
      } else {
        const orphanTxId = existing?.transaction_id || ensureValidUuid(`tx_vi_${id}`);
        if (get().transactions.some((t) => t.id === orphanTxId)) {
          set((s) => ({ transactions: s.transactions.filter((t) => t.id !== orphanTxId) }));
          await syncDelete('transactions', orphanTxId, uid);
        }
      }

      const payload = toSupabaseVariableIncomePayload(record, uid);
      logger.dev('[Supabase Variable Incomes Payload]:', payload);
      const ok = await syncUpsert('variable_incomes', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ variableIncomes: upsertById(s.variableIncomes, record) }));
      }
      return record;
    },

    deleteVariableIncome: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      const existing = get().variableIncomes.find((v) => v.id === id || v.id === cleanId);
      const linkedTxId = existing?.transaction_id || ensureValidUuid(`tx_vi_${cleanId}`);

      if (get().transactions.some((t) => t.id === linkedTxId)) {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== linkedTxId) }));
        await syncDelete('transactions', linkedTxId, uid);
      }

      set((s) => ({ variableIncomes: s.variableIncomes.filter((v) => v.id !== id && v.id !== cleanId) }));
      await syncDelete('variable_incomes', cleanId, uid);
    },

    // -----------------------------------------------------------------
    // EXPENSES
    // -----------------------------------------------------------------

    saveFixedExpense: async (expense, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || expense.user_id);
      const id = ensureValidUuid(expense.id);
      const quincenaValue =
        expense.default_fortnight === 'q1' || (expense.default_fortnight as any) === 15
          ? 15
          : expense.default_fortnight === 'q2' || (expense.default_fortnight as any) === 30
            ? 30
            : null;
      const resolvedCatRef = getPreferredCategoryRef(expense.category_id || 'cat_services', 'expense');

      const record: FixedExpense = {
        id,
        user_id: uid,
        name: expense.name,
        amount: Number(expense.amount),
        amount_usd: expense.amount_usd !== undefined ? Number(expense.amount_usd) : Number(expense.amount),
        original_amount:
          expense.original_amount !== undefined
            ? Number(expense.original_amount)
            : Number(expense.amount_in_ves || expense.amount),
        amount_in_ves: expense.amount_in_ves !== undefined ? Number(expense.amount_in_ves) : undefined,
        currency: expense.currency || 'USD',
        payment_mode: expense.payment_mode || 'ves_bcv',
        default_fortnight: expense.default_fortnight,
        quincena: quincenaValue,
        category_id: resolvedCatRef,
        is_active: expense.is_active !== undefined ? expense.is_active : true,
        assumed_by_third_party: expense.assumed_by_third_party || false,
        notes: expense.notes || '',
        sync_status: 'pending',
        created_at: expense.created_at || new Date().toISOString(),
      };

      set((s) => ({ fixedExpenses: upsertById(s.fixedExpenses, record) }));
      const payload = toSupabaseFixedExpensePayload(record, uid);
      logger.dev('[Supabase Fixed Expenses Payload]:', payload);

      const ok = await syncUpsert('fixed_expenses', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ fixedExpenses: upsertById(s.fixedExpenses, record) }));
      }
      return record;
    },

    deleteFixedExpense: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      set((s) => ({ fixedExpenses: s.fixedExpenses.filter((e) => e.id !== id && e.id !== cleanId) }));
      await syncDelete('fixed_expenses', cleanId, uid);
    },

    toggleMonthlyFixedOverride: async (
      expenseId,
      year,
      month,
      isActive,
      customAmount,
      notes,
      userId
    ) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanExpId = ensureValidUuid(expenseId);
      const existing = get().monthlyFixedOverrides.find(
        (o) =>
          (o.fixed_expense_id === expenseId || o.fixed_expense_id === cleanExpId) &&
          o.year === year &&
          o.month === month
      );
      const id = existing?.id || ensureValidUuid(`exp_ov_${cleanExpId}_${year}_${month}`);
      const record: MonthlyFixedOverride = {
        id,
        user_id: uid,
        fixed_expense_id: cleanExpId,
        year,
        month,
        is_active: isActive,
        custom_amount: customAmount !== undefined ? Number(customAmount) : existing?.custom_amount,
        assumed_by_third_party: existing?.assumed_by_third_party ?? false,
        notes: notes !== undefined ? notes : existing?.notes || '',
        sync_status: 'pending',
      };

      set((s) => ({ monthlyFixedOverrides: upsertById(s.monthlyFixedOverrides, record) }));
      const payload = toSupabaseMonthlyOverridePayload(record, uid);
      const ok = await syncUpsert('monthly_fixed_overrides', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ monthlyFixedOverrides: upsertById(s.monthlyFixedOverrides, record) }));
      }
      return record;
    },

    saveVariableExpense: async (expense, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || expense.user_id);
      const id = ensureValidUuid(expense.id);
      const resolvedCatRef = getPreferredCategoryRef(expense.category_id || 'cat_other_exp', 'expense');
      const txId = ensureValidUuid(`tx_ve_${id}`);

      const record: VariableExpense = {
        id,
        user_id: uid,
        description: expense.description.trim(),
        amount: Number(expense.amount),
        original_amount:
          expense.original_amount !== undefined ? Number(expense.original_amount) : Number(expense.amount),
        payment_mode: expense.payment_mode || 'usd_cash',
        year: expense.year,
        month: expense.month,
        fortnight: expense.fortnight,
        category_id: resolvedCatRef,
        account_id: expense.account_id || undefined,
        currency: expense.currency || 'USD',
        notes: expense.notes || '',
        sync_status: 'pending',
        created_at: expense.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((s) => ({ variableExpenses: upsertById(s.variableExpenses, record) }));

      if (record.account_id) {
        const tx: Transaction = {
          id: txId,
          user_id: uid,
          amount: Number(record.amount),
          type: 'expense',
          description: `Gasto Variable: ${record.description}`,
          category_id: resolvedCatRef,
          account_id: record.account_id,
          transaction_date: getFortnightTransactionDate(record.year, record.month, record.fortnight),
          sync_status: 'pending',
          created_at: record.created_at || new Date().toISOString(),
        };
        set((s) => ({ transactions: upsertById(s.transactions, tx) }));
        const txOk = await syncUpsert('transactions', txId, toSupabaseTransactionPayload(tx));
        if (txOk) {
          tx.sync_status = 'synced';
          set((s) => ({ transactions: upsertById(s.transactions, tx) }));
        }
      } else if (get().transactions.some((t) => t.id === txId)) {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== txId) }));
        await syncDelete('transactions', txId, uid);
      }

      const payload = toSupabaseVariableExpensePayload(record, uid);
      logger.dev('[Supabase Variable Expenses Payload]:', payload);
      const ok = await syncUpsert('variable_expenses', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ variableExpenses: upsertById(s.variableExpenses, record) }));
      }
      return record;
    },

    deleteVariableExpense: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      const linkedTxId = ensureValidUuid(`tx_ve_${cleanId}`);

      if (get().transactions.some((t) => t.id === linkedTxId)) {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== linkedTxId) }));
        await syncDelete('transactions', linkedTxId, uid);
      }

      set((s) => ({ variableExpenses: s.variableExpenses.filter((v) => v.id !== id && v.id !== cleanId) }));
      await syncDelete('variable_expenses', cleanId, uid);
    },

    // -----------------------------------------------------------------
    // DEBTS
    // -----------------------------------------------------------------

    saveDebt: async (debt, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || debt.user_id);
      const sanitizedPayload = sanitizeDebtPayload(debt, uid);
      const record = normalizeDebtRow({ ...sanitizedPayload, currency: debt.currency || 'USD' });
      record.sync_status = 'pending';

      set((s) => ({ debts: upsertById(s.debts, record) }));
      logger.dev('[Supabase Debts Payload]:', sanitizedPayload);

      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          let { data, error } = await supabase.from('debts').upsert(sanitizedPayload).select().single();

          if (
            error &&
            (error.code === 'PGRST204' ||
              error.message?.toLowerCase().includes('due_day') ||
              error.code === '42703')
          ) {
            const { due_day: _d1, due_day_2: _d2, ...fallbackPayload } = sanitizedPayload;
            const retryRes = await supabase.from('debts').upsert(fallbackPayload).select().single();
            data = retryRes.data;
            error = retryRes.error;
          }

          if (!error && data) {
            const confirmed = normalizeDebtRow(data);
            confirmed.due_day = record.due_day;
            confirmed.due_day_2 = record.due_day_2;
            set((s) => ({ debts: upsertById(s.debts, confirmed) }));
            return confirmed;
          } else if (error) {
            logger.error('[Supabase Debts Error]:', error.message, error.details);
            enqueueRetry({ id: record.id, table: 'debts', action: 'upsert', payload: sanitizedPayload });
          }
        } catch (e) {
          logger.warn('saveDebt network catch:', e);
          enqueueRetry({ id: record.id, table: 'debts', action: 'upsert', payload: sanitizedPayload });
        }
      } else {
        enqueueRetry({ id: record.id, table: 'debts', action: 'upsert', payload: sanitizedPayload });
      }

      return record;
    },

    fetchDebts: async (userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      if (!uid || !navigator.onLine || !isSupabaseConfigured() || !supabase) {
        return get().debts;
      }

      try {
        const { data, error } = await supabase
          .from('debts')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const debts = data.map(normalizeDebtRow);
          set({ debts });
          return debts;
        }
      } catch (e) {
        logger.warn('[Store fetchDebts Notice]:', e);
      }

      return get().debts;
    },

    subscribeToDebtsChanges: (userId: string, onUpdate?: () => void) => {
      if (!isSupabaseConfigured() || !supabase || !userId) return () => {};

      const channelName = `store-debts-${userId}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'debts', filter: `user_id=eq.${userId}` },
          (payload) => {
            get()
              .handleRealtimePayload('debts', payload, userId)
              .then(() => {
                if (onUpdate) onUpdate();
              });
          }
        )
        .subscribe();

      return () => {
        if (supabase) supabase.removeChannel(channel);
      };
    },

    deleteDebt: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      set((s) => ({
        debts: s.debts.filter((d) => d.id !== id && d.id !== cleanId),
        debtPayments: s.debtPayments.filter((p) => p.debt_id !== id && p.debt_id !== cleanId),
      }));

      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('debt_payments').delete().eq('debt_id', cleanId);
        } catch (e) {
          logger.warn('Delete debt_payments notice:', e);
        }
      }
      await syncDelete('debts', cleanId, uid);
    },

    addDebtPayment: async (data, userId) => {
      const debtId = ensureValidUuid(data.debt_id);
      let debt = get().debts.find((d) => d.id === data.debt_id || d.id === debtId);

      if (!debt && navigator.onLine && isSupabaseConfigured() && supabase) {
        const { data: remoteDebt } = await supabase.from('debts').select('*').eq('id', debtId).maybeSingle();
        if (remoteDebt) {
          debt = normalizeDebtRow(remoteDebt);
        }
      }
      if (!debt) throw new Error('Deuda no encontrada');

      const uid = await resolveAuthenticatedUserId(userId || data.user_id || debt.user_id);
      const paymentDate = data.payment_date || getLocalTodayString();
      const dateObj = parseLocalDate(paymentDate);
      const year = data.year !== undefined ? data.year : dateObj.getFullYear();
      const month = data.month !== undefined ? data.month : dateObj.getMonth();
      const day = dateObj.getDate();
      const fortnight: FortnightType = data.fortnight || (day <= 15 ? 'q1' : 'q2');

      let amount_in_bs: number | undefined;
      let loss_differential: number | undefined;
      if (data.rate_applied && data.rate_applied > 0) {
        amount_in_bs = Number(data.amount) * data.rate_applied;
        if (data.parallel_rate && data.parallel_rate > 0) {
          const realCostInUSD = (Number(data.amount) * data.rate_applied) / data.parallel_rate;
          loss_differential = Number((Number(data.amount) - realCostInUSD).toFixed(2));
        }
      }

      const paymentRecord: DebtPayment = {
        id: generateUuid(),
        user_id: uid,
        debt_id: debt.id,
        amount: Number(data.amount),
        amount_in_bs,
        payment_date: paymentDate,
        year,
        month,
        fortnight,
        rate_applied: data.rate_applied,
        parallel_rate: data.parallel_rate,
        loss_differential,
        notes: data.notes || '',
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };

      let newBalance: number;
      if (data.principal_amount !== undefined) {
        const principalReduction = Number(data.principal_amount);
        const capitalizedInterest = Number(data.unpaid_interest_capitalized || 0);
        newBalance = Math.max(0, Number(debt.current_balance) - principalReduction + capitalizedInterest);
      } else {
        newBalance = Math.max(0, Number(debt.current_balance) - Number(data.amount));
      }

      const isFullPayment = newBalance <= 0.01;
      const newStatus = isFullPayment ? 'paid' : 'active';
      let newPendingInstallments: number | undefined;
      if (debt.pending_installments !== undefined) {
        if (isFullPayment) {
          newPendingInstallments = 0;
        } else {
          const quotaAmount =
            debt.installment_amount && debt.installment_amount > 0
              ? debt.installment_amount
              : debt.total_amount && debt.total_installments
                ? debt.total_amount / debt.total_installments
                : 0;
          const quotasCovered = quotaAmount > 0 ? Math.max(1, Math.floor(Number(data.amount) / quotaAmount)) : 1;
          newPendingInstallments = Math.max(0, debt.pending_installments - quotasCovered);
        }
      }

      const updatedDebt: Debt = {
        ...debt,
        current_balance: newBalance,
        remaining_amount: newBalance,
        status: newStatus,
        pending_installments: newPendingInstallments,
        updated_at: new Date().toISOString(),
      };

      const txId = generateUuid();
      const txRecord: Transaction = {
        id: txId,
        user_id: uid,
        amount: Number(data.amount),
        type: 'expense',
        description: `Abono: ${debt.creditor || (debt as any).creditor_name || 'Deuda'} (${fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
        category_id: getPreferredCategoryRef('cat_debt', 'expense'),
        account_id: data.account_id ? ensureValidUuid(data.account_id) : '',
        transaction_date: paymentDate,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };

      set((s) => ({
        debtPayments: [...s.debtPayments, paymentRecord],
        debts: s.debts.map((d) => (d.id === debt!.id ? updatedDebt : d)),
        transactions: [txRecord, ...s.transactions],
      }));

      const { sync_status: _s1, ...payRaw } = paymentRecord;
      const payPayload = toSupabaseDebtPaymentPayload(payRaw);
      const { sync_status: _s2, ...txRaw } = txRecord;
      const txPayload = toSupabaseTransactionPayload(txRaw);
      const debtUpdatePayload = {
        current_balance: newBalance,
        remaining_amount: newBalance,
        pending_installments: newPendingInstallments,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          const [resPay, resDebt, resTx] = await Promise.all([
            supabase.from('debt_payments').upsert(payPayload).select().single(),
            supabase.from('debts').update(debtUpdatePayload).eq('id', debt.id).select().single(),
            supabase.from('transactions').upsert(txPayload).select().single(),
          ]);

          if (!resPay.error && resPay.data) {
            paymentRecord.sync_status = 'synced';
            set((s) => ({ debtPayments: upsertById(s.debtPayments, paymentRecord) }));
          } else if (resPay.error) {
            logger.error('[Supabase Debt Payment Error]:', resPay.error.message);
            enqueueRetry({ id: paymentRecord.id, table: 'debt_payments', action: 'upsert', payload: payPayload });
          }

          if (!resDebt.error && resDebt.data) {
            const confirmedDebt = normalizeDebtRow(resDebt.data);
            set((s) => ({ debts: upsertById(s.debts, confirmedDebt) }));
          }

          if (!resTx.error && resTx.data) {
            txRecord.sync_status = 'synced';
            set((s) => ({ transactions: upsertById(s.transactions, txRecord) }));
          } else if (resTx.error) {
            logger.error('[Supabase Debt Payment Tx Error]:', resTx.error.message);
            enqueueRetry({ id: txRecord.id, table: 'transactions', action: 'upsert', payload: txPayload });
          }
        } catch (e) {
          logger.warn('addDebtPayment network catch:', e);
          enqueueRetry({ id: paymentRecord.id, table: 'debt_payments', action: 'upsert', payload: payPayload });
          enqueueRetry({ id: txRecord.id, table: 'transactions', action: 'upsert', payload: txPayload });
        }
      } else {
        enqueueRetry({ id: paymentRecord.id, table: 'debt_payments', action: 'upsert', payload: payPayload });
        enqueueRetry({ id: txRecord.id, table: 'transactions', action: 'upsert', payload: txPayload });
      }

      return paymentRecord;
    },

    // -----------------------------------------------------------------
    // SAVINGS GOALS & CONTRIBUTIONS
    // -----------------------------------------------------------------

    saveSavingsGoal: async (goal, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || goal.user_id);
      const id = ensureValidUuid(goal.id);

      let targetFortnight: 15 | 30 | null = null;
      if (goal.frequency === 'monthly') {
        if (goal.target_fortnight === 30 || (goal.target_fortnight as any) === 'q2') {
          targetFortnight = 30;
        } else if (goal.target_fortnight === 15 || (goal.target_fortnight as any) === 'q1') {
          targetFortnight = 15;
        } else {
          const startDay = parseLocalDate(goal.start_date || getLocalTodayString()).getDate();
          targetFortnight = startDay <= 15 ? 15 : 30;
        }
      }

      const record: SavingsGoal = {
        id,
        user_id: uid,
        name: goal.name,
        target_amount: Number(goal.target_amount),
        current_amount: goal.current_amount !== undefined ? Number(goal.current_amount) : 0,
        frequency: goal.frequency,
        target_fortnight: targetFortnight,
        amount_per_period: Number(goal.amount_per_period),
        start_date: goal.start_date || getLocalTodayString(),
        target_date: goal.target_date || undefined,
        total_installments: goal.total_installments,
        completed_installments: goal.completed_installments || 0,
        suggested_amount: goal.suggested_amount,
        icon: goal.icon || 'PiggyBank',
        color: goal.color || '#00C2C7',
        status: goal.status || 'active',
        notes: goal.notes || '',
        sync_status: 'pending',
        created_at: goal.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((s) => ({ savingsGoals: upsertById(s.savingsGoals, record) }));
      const { sync_status: _ss, ...payload } = record;
      logger.dev('[Supabase Savings Goals Payload]:', payload);

      const ok = await syncUpsert('savings_goals', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ savingsGoals: upsertById(s.savingsGoals, record) }));
      }
      return record;
    },

    deleteSavingsGoal: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      set((s) => ({
        savingsGoals: s.savingsGoals.filter((g) => g.id !== id && g.id !== cleanId),
        savingContributions: s.savingContributions.filter((c) => c.goal_id !== id && c.goal_id !== cleanId),
      }));
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('saving_contributions').delete().eq('goal_id', cleanId);
        } catch (e) {
          logger.warn('Delete saving_contributions notice:', e);
        }
      }
      await syncDelete('savings_goals', cleanId, uid);
    },

    addSavingContribution: async (data, userId) => {
      const goalId = ensureValidUuid(data.goal_id);
      const goal = get().savingsGoals.find((g) => g.id === data.goal_id || g.id === goalId);
      if (!goal) throw new Error('Meta no encontrada');

      const uid = await resolveAuthenticatedUserId(userId || data.user_id || goal.user_id);
      const contribId = generateUuid();
      const today = getLocalTodayString();

      const record: SavingContribution = {
        id: contribId,
        user_id: uid,
        goal_id: goal.id,
        amount: Number(data.amount),
        year: data.year,
        month: data.month,
        fortnight: data.fortnight,
        is_skipped: false,
        contribution_date: today,
        notes: data.notes || `Aporte a: ${goal.name}`,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };

      const newCurrent = Number(goal.current_amount) + Number(data.amount);
      const updatedGoal: SavingsGoal = {
        ...goal,
        current_amount: newCurrent,
        status: newCurrent >= Number(goal.target_amount) ? 'completed' : goal.status,
        updated_at: new Date().toISOString(),
      };

      const resolvedAccountId = data.account_id ? ensureValidUuid(data.account_id) : '';
      const savingsCatRef = getPreferredCategoryRef('cat_savings', 'expense');
      const extrasCatRef = getPreferredCategoryRef('cat_extras', 'income');

      const txExpenseRecord: Transaction = {
        id: ensureValidUuid(`tx_sc_exp_${contribId}`),
        user_id: uid,
        amount: Number(data.amount),
        type: 'expense',
        description: `Aporte Ahorro: ${goal.name}${data.source_type === 'variable_income' ? ' (desde ingreso variable)' : ''}`,
        category_id: savingsCatRef,
        account_id: resolvedAccountId,
        transaction_date: today,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };

      let varIncomeRecord: VariableIncome | null = null;
      let txIncomeRecord: Transaction | null = null;

      if (data.source_type === 'variable_income') {
        const varId = generateUuid();
        varIncomeRecord = {
          id: varId,
          user_id: uid,
          description: data.income_description || `Ingreso extra para ahorro: ${goal.name}`,
          amount: Number(data.amount),
          year: data.year,
          month: data.month,
          fortnight: data.fortnight,
          category_id: extrasCatRef,
          account_id: resolvedAccountId || '',
          currency: 'USD',
          notes: `Destinado a meta de ahorro: ${goal.name}`,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        txIncomeRecord = {
          id: ensureValidUuid(`tx_vi_${varId}`),
          user_id: uid,
          amount: Number(data.amount),
          type: 'income',
          description: `${varIncomeRecord.description} (${data.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
          category_id: extrasCatRef,
          account_id: resolvedAccountId,
          transaction_date: today,
          sync_status: 'pending',
          created_at: new Date().toISOString(),
        };
      }

      set((s) => ({
        savingContributions: [...s.savingContributions, record],
        savingsGoals: s.savingsGoals.map((g) => (g.id === goal.id ? updatedGoal : g)),
        transactions: [
          ...(txIncomeRecord ? [txIncomeRecord] : []),
          txExpenseRecord,
          ...s.transactions,
        ],
        variableIncomes: varIncomeRecord ? [...s.variableIncomes, varIncomeRecord] : s.variableIncomes,
      }));

      const { sync_status: _s1, ...scRaw } = record;
      const scPayload = toSupabaseSavingContributionPayload(scRaw);
      const { sync_status: _s2, ...goalPayload } = updatedGoal;
      const txExpPayload = toSupabaseTransactionPayload(txExpenseRecord);

      await Promise.all([
        syncUpsert('saving_contributions', contribId, scPayload),
        syncUpsert('savings_goals', goal.id, goalPayload),
        syncUpsert('transactions', txExpenseRecord.id, txExpPayload),
        ...(varIncomeRecord
          ? [syncUpsert('variable_incomes', varIncomeRecord.id, toSupabaseVariableIncomePayload(varIncomeRecord, uid))]
          : []),
        ...(txIncomeRecord
          ? [syncUpsert('transactions', txIncomeRecord.id, toSupabaseTransactionPayload(txIncomeRecord))]
          : []),
      ]);

      return record;
    },

    skipSavingContributionPeriod: async (data, userId) => {
      const goalId = ensureValidUuid(data.goal_id);
      const goal = get().savingsGoals.find((g) => g.id === data.goal_id || g.id === goalId);
      const uid = await resolveAuthenticatedUserId(userId || data.user_id || goal?.user_id);
      const contribId = generateUuid();

      const record: SavingContribution = {
        id: contribId,
        user_id: uid,
        goal_id: goal?.id || goalId,
        amount: 0,
        year: data.year,
        month: data.month,
        fortnight: data.fortnight,
        is_skipped: true,
        contribution_date: getLocalTodayString(),
        notes: data.reason || 'Periodo omitido por imprevistos',
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };

      set((s) => ({ savingContributions: [...s.savingContributions, record] }));
      const { sync_status: _ss, ...raw } = record;
      const ok = await syncUpsert('saving_contributions', contribId, toSupabaseSavingContributionPayload(raw));
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ savingContributions: upsertById(s.savingContributions, record) }));
      }
      return record;
    },

    setSavingContributionSkipped: async (data, userId) => {
      return get().skipSavingContributionPeriod(
        {
          goal_id: data.goal_id,
          year: data.year,
          month: data.month,
          fortnight: data.fortnight,
          reason: data.notes || 'Aporte omitido este corte',
        },
        userId
      );
    },

    unmarkSavingContribution: async (contributionId, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(contributionId);
      const contrib = get().savingContributions.find(
        (c) => c.id === contributionId || c.id === cleanId
      );
      if (!contrib) return;

      if (!contrib.is_skipped && contrib.amount > 0) {
        const goal = get().savingsGoals.find((g) => g.id === contrib.goal_id);
        if (goal) {
          const newCurrent = Math.max(0, Number(goal.current_amount || 0) - Number(contrib.amount));
          const updatedGoal: SavingsGoal = {
            ...goal,
            current_amount: newCurrent,
            status: newCurrent < Number(goal.target_amount) && goal.status === 'completed' ? 'active' : goal.status,
            updated_at: new Date().toISOString(),
          };
          set((s) => ({ savingsGoals: upsertById(s.savingsGoals, updatedGoal) }));
          const { sync_status: _ss, ...goalPayload } = updatedGoal;
          await syncUpsert('savings_goals', updatedGoal.id, goalPayload);
        }
      }

      const linkedTxId = ensureValidUuid(`tx_sc_exp_${contrib.id}`);
      if (get().transactions.some((t) => t.id === linkedTxId)) {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== linkedTxId) }));
        await syncDelete('transactions', linkedTxId, uid);
      }

      set((s) => ({
        savingContributions: s.savingContributions.filter((c) => c.id !== contributionId && c.id !== cleanId),
      }));
      await syncDelete('saving_contributions', contrib.id, uid);
    },

    // -----------------------------------------------------------------
    // FORTNIGHT STATES
    // -----------------------------------------------------------------

    setFortnightExpensePaid: async (params, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
      const expenseId = ensureValidUuid(params.expense.id);
      const existingState = get().fortnightItemStates.find(
        (st) => (st.item_id === params.expense.id || st.item_id === expenseId) && st.period_key === periodKey
      );
      const stateId = existingState?.id || ensureValidUuid(`fis_fe_${expenseId}_${periodKey}`);
      const txId = existingState?.transaction_id || ensureValidUuid(`tx_fis_${expenseId}_${periodKey}`);
      const resolvedAccountId = params.accountId
        ? ensureValidUuid(params.accountId)
        : get().accounts[0]?.id
          ? ensureValidUuid(get().accounts[0].id)
          : '';
      const resolvedCatRef = getPreferredCategoryRef(
        params.expense.category_id || 'cat_services',
        'expense'
      );

      const txRecord: Transaction = {
        id: txId,
        user_id: uid,
        amount: Number(params.amount),
        type: 'expense',
        description: `Pago Gasto Fijo: ${params.expense.name} (${params.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
        category_id: resolvedCatRef,
        account_id: resolvedAccountId,
        transaction_date: periodKey,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };

      const stateRecord: FortnightItemState = {
        id: stateId,
        user_id: uid,
        item_id: expenseId,
        item_type: 'fixed_expense',
        period_key: periodKey,
        year: params.year,
        month: params.month,
        fortnight: params.fortnight,
        status: 'paid',
        amount: Number(params.amount),
        transaction_id: txId,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      };

      set((s) => ({
        transactions: upsertById(s.transactions, txRecord),
        fortnightItemStates: [
          ...s.fortnightItemStates.filter(
            (st) => !((st.item_id === expenseId || st.item_id === params.expense.id) && st.period_key === periodKey)
          ),
          stateRecord,
        ],
      }));

      await Promise.all([
        syncUpsert('transactions', txId, toSupabaseTransactionPayload(txRecord)),
        syncUpsert('fortnight_item_states', stateId, toSupabaseFortnightStatePayload(stateRecord, uid)),
      ]);
    },

    unmarkFortnightExpensePaid: async (params, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
      const expenseId = ensureValidUuid(params.expenseId);

      const existingState = get().fortnightItemStates.find(
        (st) => (st.item_id === params.expenseId || st.item_id === expenseId) && st.period_key === periodKey
      );

      if (existingState) {
        const txId = existingState.transaction_id;
        set((s) => ({
          transactions: txId ? s.transactions.filter((t) => t.id !== txId) : s.transactions,
          fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== existingState.id),
        }));

        await Promise.all([
          syncDelete('fortnight_item_states', existingState.id, uid),
          ...(txId ? [syncDelete('transactions', ensureValidUuid(txId), uid)] : []),
        ]);
      }
    },

    setFortnightExpenseSkipped: async (params, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
      const expenseId = ensureValidUuid(params.expenseId);
      const stateId = ensureValidUuid(`fis_fe_${expenseId}_${periodKey}`);

      const stateRecord: FortnightItemState = {
        id: stateId,
        user_id: uid,
        item_id: expenseId,
        item_type: 'fixed_expense',
        period_key: periodKey,
        year: params.year,
        month: params.month,
        fortnight: params.fortnight,
        status: 'skipped',
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      };

      set((s) => ({
        fortnightItemStates: [
          ...s.fortnightItemStates.filter(
            (st) => !((st.item_id === expenseId || st.item_id === params.expenseId) && st.period_key === periodKey)
          ),
          stateRecord,
        ],
      }));

      await syncUpsert('fortnight_item_states', stateId, toSupabaseFortnightStatePayload(stateRecord, uid));
    },

    unmarkFortnightExpenseSkipped: async (params, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
      const expenseId = ensureValidUuid(params.expenseId);

      const existingState = get().fortnightItemStates.find(
        (st) => (st.item_id === params.expenseId || st.item_id === expenseId) && st.period_key === periodKey
      );

      if (existingState) {
        set((s) => ({
          fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== existingState.id),
        }));
        await syncDelete('fortnight_item_states', existingState.id, uid);
      }
    },

    setFortnightDebtSkipped: async (params, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
      const debtId = ensureValidUuid(params.debtId);
      const stateId = ensureValidUuid(`fis_debt_${debtId}_${periodKey}`);

      const stateRecord: FortnightItemState = {
        id: stateId,
        user_id: uid,
        item_id: debtId,
        item_type: 'debt',
        period_key: periodKey,
        year: params.year,
        month: params.month,
        fortnight: params.fortnight,
        status: 'skipped',
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      };

      set((s) => ({
        fortnightItemStates: [
          ...s.fortnightItemStates.filter(
            (st) => !((st.item_id === debtId || st.item_id === params.debtId) && st.period_key === periodKey)
          ),
          stateRecord,
        ],
      }));

      await syncUpsert('fortnight_item_states', stateId, toSupabaseFortnightStatePayload(stateRecord, uid));
    },

    unmarkFortnightDebtSkipped: async (params, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
      const debtId = ensureValidUuid(params.debtId);

      const existingState = get().fortnightItemStates.find(
        (st) => (st.item_id === params.debtId || st.item_id === debtId) && st.period_key === periodKey
      );

      if (existingState) {
        set((s) => ({
          fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== existingState.id),
        }));
        await syncDelete('fortnight_item_states', existingState.id, uid);
      }
    },

    // -----------------------------------------------------------------
    // PLANNING NOTES & TASKS
    // -----------------------------------------------------------------

    savePlanningNote: async (data, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || data.user_id);
      const id = getPlanningNoteUuid(uid, data.year, data.month);
      const existing = get().planningNotes.find(
        (n) => n.id === id || (n.user_id === uid && n.year === data.year && n.month === data.month)
      );
      const nowIso = new Date().toISOString();

      const record: PlanningNote = {
        id,
        user_id: uid,
        year: data.year,
        month: data.month,
        notes: data.notes !== undefined ? data.notes : existing?.notes || '',
        tasks: data.tasks !== undefined ? data.tasks : existing?.tasks || [],
        sync_status: 'pending',
        created_at: existing?.created_at || nowIso,
        updated_at: nowIso,
      };

      set((s) => ({ planningNotes: upsertById(s.planningNotes, record) }));
      const ok = await syncUpsert('planning_notes', id, toSupabasePlanningNotePayload(record));
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ planningNotes: upsertById(s.planningNotes, record) }));
      }
      return record;
    },

    addPlanningTask: async (data, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || data.user_id);
      const id = getPlanningNoteUuid(uid, data.year, data.month);
      const existing = get().planningNotes.find(
        (n) => n.id === id || (n.user_id === uid && n.year === data.year && n.month === data.month)
      );
      const newTask: PlanningTask = {
        id: generateUuid(),
        text: data.text.trim(),
        completed: false,
        due_day: data.due_day,
        priority: data.priority || 'medium',
        created_at: new Date().toISOString(),
      };
      return get().savePlanningNote(
        {
          user_id: uid,
          year: data.year,
          month: data.month,
          notes: existing?.notes || '',
          tasks: [...(existing?.tasks || []), newTask],
        },
        uid
      );
    },

    togglePlanningTask: async (data, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || data.user_id);
      const id = getPlanningNoteUuid(uid, data.year, data.month);
      const existing = get().planningNotes.find(
        (n) => n.id === id || (n.user_id === uid && n.year === data.year && n.month === data.month)
      );
      if (!existing) {
        return get().savePlanningNote({ user_id: uid, year: data.year, month: data.month }, uid);
      }
      const nextTasks = existing.tasks.map((t) =>
        t.id === data.taskId ? { ...t, completed: !t.completed } : t
      );
      return get().savePlanningNote(
        {
          user_id: uid,
          year: data.year,
          month: data.month,
          notes: existing.notes,
          tasks: nextTasks,
        },
        uid
      );
    },

    deletePlanningTask: async (data, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || data.user_id);
      const id = getPlanningNoteUuid(uid, data.year, data.month);
      const existing = get().planningNotes.find(
        (n) => n.id === id || (n.user_id === uid && n.year === data.year && n.month === data.month)
      );
      if (!existing) {
        return get().savePlanningNote({ user_id: uid, year: data.year, month: data.month }, uid);
      }
      const nextTasks = existing.tasks.filter((t) => t.id !== data.taskId);
      return get().savePlanningNote(
        {
          user_id: uid,
          year: data.year,
          month: data.month,
          notes: existing.notes,
          tasks: nextTasks,
        },
        uid
      );
    },

    updatePlanningNotesText: async (data, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || data.user_id);
      const id = getPlanningNoteUuid(uid, data.year, data.month);
      const existing = get().planningNotes.find(
        (n) => n.id === id || (n.user_id === uid && n.year === data.year && n.month === data.month)
      );
      return get().savePlanningNote(
        {
          user_id: uid,
          year: data.year,
          month: data.month,
          notes: data.notes,
          tasks: existing?.tasks || [],
        },
        uid
      );
    },

    // -----------------------------------------------------------------
    // TRANSACTIONS
    // -----------------------------------------------------------------

    addTransaction: async (txData, userId) => {
      const uid = await resolveAuthenticatedUserId(userId || txData.user_id);
      const id = generateUuid();
      const resolvedAccountId = txData.account_id
        ? ensureValidUuid(txData.account_id)
        : get().accounts[0]?.id
          ? ensureValidUuid(get().accounts[0].id)
          : '';

      const record: Transaction = {
        ...txData,
        id,
        user_id: uid,
        account_id: resolvedAccountId,
        category_id: getPreferredCategoryRef(
          txData.category_id,
          txData.type === 'income' ? 'income' : 'expense'
        ),
        amount: Number(txData.amount),
        sync_status: 'pending',
        created_at: new Date().toISOString(),
      };

      set((s) => ({ transactions: [record, ...s.transactions] }));
      const payload = toSupabaseTransactionPayload(record);
      logger.dev('[Supabase Transactions Payload]:', payload);

      const ok = await syncUpsert('transactions', id, payload);
      if (ok) {
        record.sync_status = 'synced';
        set((s) => ({ transactions: upsertById(s.transactions, record) }));
      }
      return record;
    },

    deleteTransaction: async (id, userId) => {
      const uid = await resolveAuthenticatedUserId(userId);
      const cleanId = ensureValidUuid(id);
      set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id && t.id !== cleanId) }));
      await syncDelete('transactions', cleanId, uid);
    },
  };
});
