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
  SavingContribution,
  SavingsGoal,
  SyncStatus,
  Transaction,
  UserProfile,
} from '../types/index.ts';
import {
  db,
  DEFAULT_CATEGORIES,
  seedUserDefaultCategories,
  toSupabaseAccountPayload,
  getFortnightPeriodKey,
  getActiveUserId,
  getLastSyncTimestamp,
  setLastSyncTimestampInMemory,
} from '../lib/db.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { ensureValidUuid, generateUuid } from '../utils/uuid.ts';
import { logger } from '../utils/logger.ts';
import {
  sanitizeDebtPayload,
  normalizeDebtRow,
  subscribeToDebtsChanges as subscribeToDebtsChangesService,
  fetchDebts as fetchDebtsService,
} from '../services/debtsService.ts';
import {
  normalizeMonthlyFixedOverrideRow,
  normalizeMonthlyFixedIncomeOverrideRow,
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

export interface FinanceStoreState {
  // 14 Supabase Entities
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
  transactions: Transaction[];

  // Sync state
  syncStatus: RealtimeSyncStatus;
  lastSyncTime: string | null;
  lastSyncTimestamp: string | null;
  setLastSyncTimestamp: (timestamp: string | null) => void;
  isLoading: boolean;
  error: string | null;
  syncQueue: SyncQueueItem[];

  // UI state
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Actions
  setSyncStatus: (status: RealtimeSyncStatus) => void;
  setError: (error: string | null) => void;
  loadFromLocalCache: (userId?: string | null) => Promise<void>;
  fetchInitialData: (userId: string) => Promise<void>;
  handleRealtimePayload: (table: string, payload: any, userId: string) => Promise<void>;
  flushSyncQueue: (userId: string) => Promise<void>;

  // Optimistic Mutations
  saveAccount: (account: Partial<Account> & { name: string; type: Account['type']; currency: string; initial_balance: number }, userId: string) => Promise<Account>;
  deleteAccount: (id: string, userId: string) => Promise<void>;
  adjustAccountBalance: (accountId: string, newInitialBalance: number, userId: string) => Promise<void>;

  saveFixedIncome: (income: Partial<FixedIncome> & { name: string; amount: number; default_fortnight: 'q1' | 'q2' | 'both' }, userId: string) => Promise<FixedIncome>;
  deleteFixedIncome: (id: string, userId: string) => Promise<void>;

  saveVariableIncome: (income: Partial<VariableIncome> & { description: string; amount: number; year: number; month: number; fortnight: FortnightType }, userId: string) => Promise<VariableIncome>;
  deleteVariableIncome: (id: string, userId: string) => Promise<void>;

  saveFixedExpense: (expense: Partial<FixedExpense> & { name: string; amount: number; default_fortnight: 'q1' | 'q2' | 'both' }, userId: string) => Promise<FixedExpense>;
  deleteFixedExpense: (id: string, userId: string) => Promise<void>;

  saveVariableExpense: (expense: Partial<VariableExpense> & { description: string; amount: number; year: number; month: number; fortnight: FortnightType }, userId: string) => Promise<VariableExpense>;
  deleteVariableExpense: (id: string, userId: string) => Promise<void>;

  saveDebt: (debt: Partial<Debt> & { creditor: string; total_amount: number; payment_type: Debt['payment_type'] }, userId: string) => Promise<Debt>;
  deleteDebt: (id: string, userId: string) => Promise<void>;
  fetchDebts: (userId: string) => Promise<Debt[]>;
  subscribeToDebtsChanges: (userId: string, onUpdate?: () => void) => () => void;
  addDebtPayment: (data: {
    debt_id: string;
    amount: number;
    payment_date?: string;
    fortnight?: FortnightType;
    year?: number;
    month?: number;
    rate_applied?: number;
    parallel_rate?: number;
    notes?: string;
  }, userId: string) => Promise<DebtPayment>;

  saveSavingsGoal: (goal: Partial<SavingsGoal> & { name: string; target_amount: number; amount_per_period: number; frequency: SavingsGoal['frequency'] }, userId: string) => Promise<SavingsGoal>;
  deleteSavingsGoal: (id: string, userId: string) => Promise<void>;
  addSavingContribution: (data: {
    goal_id: string;
    amount: number;
    year: number;
    month: number;
    fortnight: FortnightType;
    notes?: string;
  }, userId: string) => Promise<SavingContribution>;

  setFortnightExpensePaid: (params: {
    expense: FixedExpense;
    year: number;
    month: number;
    fortnight: FortnightType;
    amount: number;
    accountId?: string;
  }, userId: string) => Promise<void>;
  unmarkFortnightExpensePaid: (params: {
    expenseId: string;
    year: number;
    month: number;
    fortnight: FortnightType;
  }, userId: string) => Promise<void>;

  setFortnightExpenseSkipped: (params: {
    expenseId: string;
    year: number;
    month: number;
    fortnight: FortnightType;
  }, userId: string) => Promise<void>;
  unmarkFortnightExpenseSkipped: (params: {
    expenseId: string;
    year: number;
    month: number;
    fortnight: FortnightType;
  }, userId: string) => Promise<void>;

  setFortnightDebtSkipped: (params: {
    debtId: string;
    year: number;
    month: number;
    fortnight: FortnightType;
  }, userId: string) => Promise<void>;
  unmarkFortnightDebtSkipped: (params: {
    debtId: string;
    year: number;
    month: number;
    fortnight: FortnightType;
  }, userId: string) => Promise<void>;

  addTransaction: (txData: Omit<Transaction, 'id' | 'sync_status' | 'created_at'>, userId: string) => Promise<Transaction>;
  deleteTransaction: (id: string, userId: string) => Promise<void>;
}

/**
 * Consulta segura a Supabase que captura errores 404 / schema cache sin romper la ejecución
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

      logger.warn(`[Supabase Table Notice '${tableName}'] :`, res.error.message || res.error.details || res.error);
      return [];
    }
    return (res.data as T[]) || [];
  } catch (err: any) {
    if (err?.message?.startsWith('AUTH_EXPIRED')) {
      throw err;
    }
    logger.warn(`[Supabase Table Query Exception '${tableName}'] :`, err?.message || err);
    return [];
  }
}

export const useFinanceStore = create<FinanceStoreState>((set, get) => ({
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

  // UI state
  isSidebarCollapsed: (() => {
    try {
      return localStorage.getItem('lanitapp_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  })(),
  toggleSidebar: () => {
    const next = !get().isSidebarCollapsed;
    try {
      localStorage.setItem('lanitapp_sidebar_collapsed', String(next));
    } catch {}
    set({ isSidebarCollapsed: next });
  },
  setSidebarCollapsed: (collapsed: boolean) => {
    try {
      localStorage.setItem('lanitapp_sidebar_collapsed', String(collapsed));
    } catch {}
    set({ isSidebarCollapsed: collapsed });
  },

  setSyncStatus: (status) => set({ syncStatus: status }),
  setError: (error) => set({ error }),

  /**
   * Carga instantánea desde Dexie (IndexedDB) para disponibilidad offline
   */
  loadFromLocalCache: async (userId?: string | null) => {
    try {
      const [
        accounts,
        categories,
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
        transactions,
      ] = await Promise.all([
        db.accounts.toArray(),
        db.categories.toArray(),
        db.fixed_incomes.toArray(),
        db.monthly_fixed_income_overrides.toArray(),
        db.variable_incomes.toArray(),
        db.fixed_expenses.toArray(),
        db.monthly_fixed_overrides.toArray(),
        db.variable_expenses.toArray(),
        db.debts.toArray(),
        db.debt_payments.toArray(),
        db.savings_goals.toArray(),
        db.saving_contributions.toArray(),
        db.fortnight_item_states.toArray(),
        db.transactions.toArray(),
      ]);

      // SEGURIDAD: Validación estricta. Ambos IDs deben existir y coincidir exactamente para evitar filtración de datos entre usuarios.
      const matchesUser = (item: { user_id?: string | null }) =>
        Boolean(userId && item.user_id && item.user_id === userId);

      const filteredAccounts = accounts.filter(matchesUser);
      const filteredFixedIncomes = fixedIncomes.filter(matchesUser);
      const filteredVarIncomes = variableIncomes.filter(matchesUser);
      const filteredExpenses = fixedExpenses.filter(matchesUser);
      const filteredVarExpenses = variableExpenses.filter(matchesUser);
      const filteredDebts = debts.filter(matchesUser);
      const filteredDebtPayments = debtPayments.filter(matchesUser).map((p: any) => ({
        ...p,
        amount: Number(p.amount ?? p.amount_paid ?? 0),
      }));
      const filteredSavings = savingsGoals.filter(matchesUser);
      const filteredContribs = savingContributions.filter(matchesUser);
      const filteredStates = fortnightItemStates.filter(matchesUser);
      const filteredTxs = transactions.filter(matchesUser);

      const userCategories = categories.filter((c) => c.user_id === userId);
      const isSeeded = typeof localStorage !== 'undefined' && userId && localStorage.getItem('lanitapp_cat_seeded_' + userId);
      const fallbackCategories = categories.filter((c) => !c.user_id);
      const resolvedCategories =
        userCategories.length > 0
          ? userCategories
          : isSeeded
          ? []
          : fallbackCategories.length > 0
          ? fallbackCategories
          : DEFAULT_CATEGORIES;

      set({
        accounts: filteredAccounts,
        categories: resolvedCategories,
        fixedIncomes: filteredFixedIncomes,
        monthlyIncomeOverrides,
        variableIncomes: filteredVarIncomes,
        fixedExpenses: filteredExpenses,
        monthlyFixedOverrides,
        variableExpenses: filteredVarExpenses,
        debts: filteredDebts,
        debtPayments: filteredDebtPayments,
        savingsGoals: filteredSavings,
        savingContributions: filteredContribs,
        fortnightItemStates: filteredStates,
        transactions: filteredTxs,
        isLoading: false,
      });
    } catch (err) {
      logger.warn('Error loading from local cache:', err);
      set({ isLoading: false });
    }
  },

  /**
   * Carga inicial completa de las 14 tablas desde Supabase con manejo seguro de errores
   */
  fetchInitialData: async (userId: string) => {
    if (!userId) return;

    if (!navigator.onLine || !isSupabaseConfigured() || !supabase) {
      await get().loadFromLocalCache(userId);
      set({ syncStatus: 'offline', isLoading: false });
      return;
    }

    set({ syncStatus: 'syncing' });

    try {
      // 1. Vaciar cola pendiente previa
      await get().flushSyncQueue(userId);

      logger.dev(`[Supabase Fetch Initial]: Consultando tablas oficiales para usuario ${userId}...`);

      // 2. Fetch en paralelo de las 14 tablas oficiales
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
        rawDebts,
        rawDebtPayments,
        rawSavings,
        rawContribs,
        rawStates,
        rawTxs,
      ] = await Promise.all([
        safeQuery('profiles', () => client.from('profiles').select('*').eq('id', userId)),
        safeQuery('categories', async () => {
          try {
            const res = await client
              .from('categories')
              .select('*')
              .or(`user_id.eq.${userId},user_id.is.null`);
            if (!res.error) return res;
          } catch {}
          return client.from('categories').select('*');
        }),
        safeQuery('accounts', () => client.from('accounts').select('*').eq('user_id', userId)),
        safeQuery('fixed_incomes', () => client.from('fixed_incomes').select('*').eq('user_id', userId)),
        safeQuery('monthly_fixed_income_overrides', () => client.from('monthly_fixed_income_overrides').select('*')),
        safeQuery('variable_incomes', () => client.from('variable_incomes').select('*').eq('user_id', userId)),
        safeQuery('fixed_expenses', () => client.from('fixed_expenses').select('*').eq('user_id', userId)),
        safeQuery('monthly_fixed_overrides', () => client.from('monthly_fixed_overrides').select('*')),
        safeQuery('debts', () => client.from('debts').select('*').eq('user_id', userId)),
        safeQuery('debt_payments', () => client.from('debt_payments').select('*').eq('user_id', userId)),
        safeQuery('savings_goals', () => client.from('savings_goals').select('*').eq('user_id', userId)),
        safeQuery('saving_contributions', () => client.from('saving_contributions').select('*').eq('user_id', userId)),
        safeQuery('fortnight_item_states', () => client.from('fortnight_item_states').select('*').eq('user_id', userId)),
        safeQuery('transactions', () => client.from('transactions').select('*').eq('user_id', userId)),
      ]);

      const profiles: UserProfile[] = rawProfiles;

      // Categorías individuales por usuario
      const userCats = rawCategories.filter((c: any) => c.user_id === userId);
      const localCats = await db.categories.where('user_id').equals(userId).toArray();

      let categories: Category[] = [];
      if (userCats.length > 0) {
        categories = userCats;
        await db.categories.bulkPut(userCats);
      } else if (localCats.length > 0) {
        categories = localCats;
      } else {
        categories = await seedUserDefaultCategories(userId);
      }

      const accounts: Account[] = rawAccounts.map((a: any) => ({
        id: ensureValidUuid(a.id),
        user_id: a.user_id || userId,
        name: a.name,
        type: a.type || 'cash',
        currency: a.currency || 'USD',
        initial_balance: typeof a.initial_balance === 'number' ? a.initial_balance : typeof a.balance === 'number' ? a.balance : parseFloat(a.initial_balance || a.balance || 0) || 0,
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
      const monthlyIncomeOverrides: MonthlyFixedIncomeOverride[] = rawIncomeOverrides.map((o: any) => normalizeMonthlyFixedIncomeOverrideRow(o));
      const variableIncomes: VariableIncome[] = rawVariableIncomes.map((v: any) => {
        const [yr, mo] = (v.month_year || '').split('-').map(Number);
        const now = new Date();
        const year = !isNaN(yr) && yr > 2000 ? yr : (v.year || now.getFullYear());
        const month = !isNaN(mo) && mo >= 1 && mo <= 12 ? mo - 1 : (v.month !== undefined ? v.month : now.getMonth());
        const fortnight: FortnightType = (v.quincena === 30 || v.fortnight === 'q2' || v.quincena === '30') ? 'q2' : 'q1';

        return {
          id: ensureValidUuid(v.id),
          user_id: v.user_id,
          description: v.name || v.description || 'Ingreso Variable',
          amount: Number(v.amount || 0),
          year,
          month,
          fortnight,
          category_id: v.category_id || 'cat_extras',
          account_id: v.account_id || '',
          currency: v.currency || 'USD',
          notes: v.notes || '',
          sync_status: 'synced',
          created_at: v.created_at || new Date().toISOString(),
          updated_at: v.updated_at || new Date().toISOString(),
        };
      });
      const fixedExpenses: FixedExpense[] = rawExpenses.map((e: any) => ({
        ...e,
        id: ensureValidUuid(e.id),
        default_fortnight: quincenaToFortnight(e.default_fortnight || e.default_quincena),
        sync_status: 'synced',
      }));
      const monthlyFixedOverrides: MonthlyFixedOverride[] = rawExpenseOverrides.map((o: any) => normalizeMonthlyFixedOverrideRow(o));
      const debts: Debt[] = rawDebts.map((d: any) => normalizeDebtRow(d));
      const debtPayments: DebtPayment[] = rawDebtPayments.map((p: any) => ({
        ...p,
        id: ensureValidUuid(p.id),
        amount: Number(p.amount ?? p.amount_paid ?? 0),
        sync_status: 'synced',
      }));
      const savingsGoals: SavingsGoal[] = rawSavings.map((s: any) => ({ ...s, id: ensureValidUuid(s.id), sync_status: 'synced' }));
      const savingContributions: SavingContribution[] = rawContribs.map((c: any) => ({ ...c, id: ensureValidUuid(c.id), sync_status: 'synced' }));
      const fortnightItemStates: FortnightItemState[] = rawStates.map((st: any) => ({ ...st, id: ensureValidUuid(st.id), sync_status: 'synced' }));
      const transactions: Transaction[] = rawTxs.map((t: any) => ({ ...t, id: ensureValidUuid(t.id), sync_status: 'synced' }));

      // Sincronizar Dexie en segundo plano de manera no destructiva (Upsert inteligente)
      await Promise.all([
        accounts.length > 0 ? db.accounts.bulkPut(accounts) : Promise.resolve(),
        categories.length > 0 ? db.categories.bulkPut(categories) : Promise.resolve(),
        fixedIncomes.length > 0 ? db.fixed_incomes.bulkPut(fixedIncomes) : Promise.resolve(),
        monthlyIncomeOverrides.length > 0 ? db.monthly_fixed_income_overrides.bulkPut(monthlyIncomeOverrides) : Promise.resolve(),
        variableIncomes.length > 0 ? db.variable_incomes.bulkPut(variableIncomes) : Promise.resolve(),
        fixedExpenses.length > 0 ? db.fixed_expenses.bulkPut(fixedExpenses) : Promise.resolve(),
        monthlyFixedOverrides.length > 0 ? db.monthly_fixed_overrides.bulkPut(monthlyFixedOverrides) : Promise.resolve(),
        debts.length > 0 ? db.debts.bulkPut(debts) : Promise.resolve(),
        debtPayments.length > 0 ? db.debt_payments.bulkPut(debtPayments) : Promise.resolve(),
        savingsGoals.length > 0 ? db.savings_goals.bulkPut(savingsGoals) : Promise.resolve(),
        savingContributions.length > 0 ? db.saving_contributions.bulkPut(savingContributions) : Promise.resolve(),
        fortnightItemStates.length > 0 ? db.fortnight_item_states.bulkPut(fortnightItemStates) : Promise.resolve(),
        transactions.length > 0 ? db.transactions.bulkPut(transactions) : Promise.resolve(),
      ]);

      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      set({
        profiles,
        categories,
        accounts,
        fixedIncomes,
        monthlyIncomeOverrides,
        variableIncomes,
        fixedExpenses,
        monthlyFixedOverrides,
        debts,
        debtPayments,
        savingsGoals,
        savingContributions,
        fortnightItemStates,
        transactions,
        syncStatus: 'connected',
        lastSyncTime: now,
        lastSyncTimestamp: now,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      logger.error('[FinanceStore Fetch Initial Error]:', err);
      await get().loadFromLocalCache(userId);
      set({ syncStatus: 'error', error: err.message, isLoading: false });
      if (err?.message?.includes('AUTH_EXPIRED') && isSupabaseConfigured() && supabase) {
        supabase.auth.refreshSession().catch(() => {});
      }
    }
  },

  /**
   * Manejador de eventos Realtime de Supabase (Smart Merge por ID)
   */
  handleRealtimePayload: async (table: string, payload: any, userId: string) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    logger.dev(`[Realtime Merge on ${table} - ${eventType}]:`, newRow || oldRow);

    if (newRow?.user_id && newRow.user_id !== userId) return;

    const normalizeAcc = (row: any): Account => ({
      id: ensureValidUuid(row.id),
      user_id: row.user_id || userId,
      name: row.name,
      type: row.type || 'cash',
      currency: row.currency || 'USD',
      initial_balance: typeof row.initial_balance === 'number' ? row.initial_balance : typeof row.balance === 'number' ? row.balance : parseFloat(row.initial_balance || row.balance || 0) || 0,
      color: row.color,
      notes: row.notes || '',
      created_at: row.created_at,
      updated_at: row.updated_at,
      sync_status: 'synced',
    });

    switch (table) {
      case 'profiles': {
        if (newRow?.id && newRow.id === userId) {
          if (newRow.theme_mode) {
            if (typeof document !== 'undefined') {
              const root = document.documentElement;
              root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
              root.classList.add(`theme-${newRow.theme_mode}`);
            }
          }
          if (newRow.accent_color) {
            if (typeof document !== 'undefined') {
              document.documentElement.style.setProperty('--primary', newRow.accent_color);
              document.documentElement.style.setProperty('--primary-custom', newRow.accent_color);
            }
          }
        }
        break;
      }
      case 'accounts': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ accounts: s.accounts.filter((a) => a.id !== oldRow.id) }));
          await db.accounts.delete(oldRow.id);
        } else if (newRow?.id) {
          const accItem = normalizeAcc(newRow);
          set((s) => {
            const exists = s.accounts.some((a) => a.id === accItem.id);
            return {
              accounts: exists ? s.accounts.map((a) => (a.id === accItem.id ? accItem : a)) : [...s.accounts, accItem],
            };
          });
          await db.accounts.put(accItem);
        }
        break;
      }
      case 'categories': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ categories: s.categories.filter((c) => c.id !== oldRow.id) }));
          await db.categories.delete(oldRow.id);
        } else if (newRow?.id) {
          if (!newRow.user_id || newRow.user_id === userId) {
            const catItem: Category = {
              id: ensureValidUuid(newRow.id),
              user_id: newRow.user_id || userId,
              name: newRow.name,
              type: newRow.type || 'expense',
              icon: newRow.icon || 'tag',
              color: newRow.color || '#147DF0',
              code: newRow.code,
              sync_status: 'synced',
            };
            set((s) => {
              const exists = s.categories.some((c) => c.id === catItem.id);
              return {
                categories: exists
                  ? s.categories.map((c) => (c.id === catItem.id ? catItem : c))
                  : [...s.categories, catItem],
              };
            });
            await db.categories.put(catItem);
          }
        }
        break;
      }
      case 'fixed_incomes': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ fixedIncomes: s.fixedIncomes.filter((i) => i.id !== oldRow.id) }));
          await db.fixed_incomes.delete(oldRow.id);
        } else if (newRow?.id) {
          if (newRow.user_id && userId && newRow.user_id !== userId) break;
          const item: FixedIncome = {
            ...newRow,
            id: ensureValidUuid(newRow.id),
            default_fortnight: quincenaToFortnight(newRow.default_fortnight),
            category_id: newRow.category_id || 'cat_salary',
            is_active: newRow.is_active !== undefined ? newRow.is_active : true,
            sync_status: 'synced',
          };
          set((s) => ({
            fixedIncomes: s.fixedIncomes.some((i) => i.id === item.id)
              ? s.fixedIncomes.map((i) => (i.id === item.id ? item : i))
              : [...s.fixedIncomes, item],
          }));
          await db.fixed_incomes.put(item);
        }
        break;
      }
      case 'monthly_fixed_income_overrides': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ monthlyIncomeOverrides: s.monthlyIncomeOverrides.filter((o) => o.id !== oldRow.id) }));
          await db.monthly_fixed_income_overrides.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: MonthlyFixedIncomeOverride = { ...newRow, sync_status: 'synced' };
          set((s) => ({
            monthlyIncomeOverrides: s.monthlyIncomeOverrides.some((o) => o.id === item.id)
              ? s.monthlyIncomeOverrides.map((o) => (o.id === item.id ? item : o))
              : [...s.monthlyIncomeOverrides, item],
          }));
          await db.monthly_fixed_income_overrides.put(item);
        }
        break;
      }
      case 'variable_incomes': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ variableIncomes: s.variableIncomes.filter((v) => v.id !== oldRow.id) }));
          await db.variable_incomes.delete(oldRow.id);
        } else if (newRow?.id) {
          const [yr, mo] = (newRow.month_year || '').split('-').map(Number);
          const now = new Date();
          const year = !isNaN(yr) && yr > 2000 ? yr : (newRow.year || now.getFullYear());
          const month = !isNaN(mo) && mo >= 1 && mo <= 12 ? mo - 1 : (newRow.month !== undefined ? newRow.month : now.getMonth());
          const fortnight: FortnightType = (newRow.quincena === 30 || newRow.fortnight === 'q2' || newRow.quincena === '30') ? 'q2' : 'q1';

          const item: VariableIncome = {
            id: ensureValidUuid(newRow.id),
            user_id: newRow.user_id,
            description: newRow.name || newRow.description || 'Ingreso Variable',
            amount: Number(newRow.amount || 0),
            year,
            month,
            fortnight,
            category_id: newRow.category_id || 'cat_extras',
            account_id: newRow.account_id || '',
            currency: newRow.currency || 'USD',
            notes: newRow.notes || '',
            sync_status: 'synced',
            created_at: newRow.created_at || new Date().toISOString(),
            updated_at: newRow.updated_at || new Date().toISOString(),
          };
          set((s) => ({
            variableIncomes: s.variableIncomes.some((v) => v.id === item.id)
              ? s.variableIncomes.map((v) => (v.id === item.id ? item : v))
              : [...s.variableIncomes, item],
          }));
          await db.variable_incomes.put(item);
        }
        break;
      }
      case 'fixed_expenses': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ fixedExpenses: s.fixedExpenses.filter((e) => e.id !== oldRow.id) }));
          await db.fixed_expenses.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: FixedExpense = {
            ...newRow,
            id: ensureValidUuid(newRow.id),
            default_fortnight: quincenaToFortnight(newRow.default_fortnight || newRow.default_quincena),
            sync_status: 'synced',
          };
          set((s) => ({
            fixedExpenses: s.fixedExpenses.some((e) => e.id === item.id)
              ? s.fixedExpenses.map((e) => (e.id === item.id ? item : e))
              : [...s.fixedExpenses, item],
          }));
          await db.fixed_expenses.put(item);
        }
        break;
      }
      case 'monthly_fixed_overrides': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ monthlyFixedOverrides: s.monthlyFixedOverrides.filter((o) => o.id !== oldRow.id) }));
          await db.monthly_fixed_overrides.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: MonthlyFixedOverride = normalizeMonthlyFixedOverrideRow(newRow);
          set((s) => ({
            monthlyFixedOverrides: s.monthlyFixedOverrides.some((o) => o.id === item.id)
              ? s.monthlyFixedOverrides.map((o) => (o.id === item.id ? item : o))
              : [...s.monthlyFixedOverrides, item],
          }));
          await db.monthly_fixed_overrides.put(item);
        }
        break;
      }
      case 'monthly_fixed_income_overrides': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ monthlyIncomeOverrides: s.monthlyIncomeOverrides.filter((o) => o.id !== oldRow.id) }));
          await db.monthly_fixed_income_overrides.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: MonthlyFixedIncomeOverride = normalizeMonthlyFixedIncomeOverrideRow(newRow);
          set((s) => ({
            monthlyIncomeOverrides: s.monthlyIncomeOverrides.some((o) => o.id === item.id)
              ? s.monthlyIncomeOverrides.map((o) => (o.id === item.id ? item : o))
              : [...s.monthlyIncomeOverrides, item],
          }));
          await db.monthly_fixed_income_overrides.put(item);
        }
        break;
      }
      case 'debts': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ debts: s.debts.filter((d) => d.id !== oldRow.id) }));
          await db.debts.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: Debt = {
            ...newRow,
            id: ensureValidUuid(newRow.id),
            creditor: newRow.creditor || newRow.creditor_name || 'Deuda',
            currency: newRow.currency || newRow.currency_type || 'USD',
            sync_status: 'synced',
          };
          set((s) => ({
            debts: s.debts.some((d) => d.id === item.id)
              ? s.debts.map((d) => (d.id === item.id ? item : d))
              : [...s.debts, item],
          }));
          await db.debts.put(item);
        }
        break;
      }
      case 'debt_payments': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ debtPayments: s.debtPayments.filter((p) => p.id !== oldRow.id) }));
          await db.debt_payments.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: DebtPayment = {
            ...newRow,
            id: ensureValidUuid(newRow.id),
            amount: Number(newRow.amount ?? newRow.amount_paid ?? 0),
            sync_status: 'synced',
          };
          set((s) => ({
            debtPayments: s.debtPayments.some((p) => p.id === item.id)
              ? s.debtPayments.map((p) => (p.id === item.id ? item : p))
              : [...s.debtPayments, item],
          }));
          await db.debt_payments.put(item);
        }
        break;
      }
      case 'savings_goals': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== oldRow.id) }));
          await db.savings_goals.delete(oldRow.id);
        } else if (newRow?.id) {
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
          set((s) => ({
            savingsGoals: s.savingsGoals.some((g) => g.id === item.id)
              ? s.savingsGoals.map((g) => (g.id === item.id ? item : g))
              : [...s.savingsGoals, item],
          }));
          await db.savings_goals.put(item);
        }
        break;
      }
      case 'saving_contributions': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ savingContributions: s.savingContributions.filter((c) => c.id !== oldRow.id) }));
          await db.saving_contributions.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: SavingContribution = { ...newRow, id: ensureValidUuid(newRow.id), sync_status: 'synced' };
          set((s) => ({
            savingContributions: s.savingContributions.some((c) => c.id === item.id)
              ? s.savingContributions.map((c) => (c.id === item.id ? item : c))
              : [...s.savingContributions, item],
          }));
          await db.saving_contributions.put(item);
        }
        break;
      }
      case 'fortnight_item_states': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== oldRow.id) }));
          await db.fortnight_item_states.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: FortnightItemState = { ...newRow, id: ensureValidUuid(newRow.id), sync_status: 'synced' };
          set((s) => ({
            fortnightItemStates: s.fortnightItemStates.some((st) => st.id === item.id)
              ? s.fortnightItemStates.map((st) => (st.id === item.id ? item : st))
              : [...s.fortnightItemStates, item],
          }));
          await db.fortnight_item_states.put(item);
        }
        break;
      }
      case 'transactions': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ transactions: s.transactions.filter((t) => t.id !== oldRow.id) }));
          await db.transactions.delete(oldRow.id);
        } else if (newRow?.id) {
          const item: Transaction = { ...newRow, id: ensureValidUuid(newRow.id), sync_status: 'synced' };
          set((s) => ({
            transactions: s.transactions.some((t) => t.id === item.id)
              ? s.transactions.map((t) => (t.id === item.id ? item : t))
              : [...s.transactions, item],
          }));
          await db.transactions.put(item);
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
   * Vacía la cola de reintentos offline hacia Supabase
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

  // -----------------------------------------------------------------
  // OPTIMISTIC MUTATIONS (Pure UUIDs -> UI -> Dexie -> Supabase / Queue)
  // -----------------------------------------------------------------

  saveAccount: async (account, userId) => {
    const id = ensureValidUuid(account.id);
    const balanceNum = typeof account.initial_balance === 'number'
      ? account.initial_balance
      : parseFloat(String(account.initial_balance || 0)) || 0;

    const record: Account = {
      id,
      user_id: userId,
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

    set((s) => ({
      accounts: s.accounts.some((a) => a.id === id)
        ? s.accounts.map((a) => (a.id === id ? record : a))
        : [...s.accounts, record],
    }));
    await db.accounts.put(record);

    const payload = toSupabaseAccountPayload(record, userId);
    logger.dev('[Supabase Accounts Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('accounts').upsert(payload);
        if (!error) {
          record.sync_status = 'synced';
          await db.accounts.update(id, { sync_status: 'synced' });
        } else {
          logger.error('[Supabase Accounts Error]:', error.message, error.details);
          set((state) => ({
            syncQueue: [...state.syncQueue, { id, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
          }));
        }
      } catch (e) {
        logger.warn('Account upsert network catch:', e);
        set((state) => ({
          syncQueue: [...state.syncQueue, { id, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    } else {
      set((state) => ({
        syncQueue: [...state.syncQueue, { id, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
      }));
    }

    return record;
  },

  deleteAccount: async (id, userId) => {
    const cleanId = ensureValidUuid(id);
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id && a.id !== cleanId) }));
    await db.accounts.delete(id);

    logger.dev(`[Supabase Accounts Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('accounts').delete().eq('id', cleanId);
        if (error) logger.error('[Supabase Accounts Delete Error]:', error.message);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'accounts', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    } else {
      set((state) => ({
        syncQueue: [...state.syncQueue, { id: cleanId, table: 'accounts', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
      }));
    }
  },

  adjustAccountBalance: async (accountId, newInitialBalance, userId) => {
    const cleanId = ensureValidUuid(accountId);
    const existing = get().accounts.find((a) => a.id === accountId || a.id === cleanId);
    if (!existing) return;

    const updated: Account = {
      ...existing,
      id: cleanId,
      initial_balance: Number(newInitialBalance),
      updated_at: new Date().toISOString(),
    };

    set((s) => ({ accounts: s.accounts.map((a) => (a.id === existing.id ? updated : a)) }));
    await db.accounts.put(updated);

    const payload = toSupabaseAccountPayload(updated, userId);
    logger.dev('[Supabase Accounts Adjust Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('accounts').upsert(payload);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    } else {
      set((state) => ({
        syncQueue: [...state.syncQueue, { id: cleanId, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
      }));
    }
  },

  saveFixedIncome: async (income, userId) => {
    const id = ensureValidUuid(income.id);

    // Obtener el auth.uid() real de Supabase
    let supabaseUserId = userId || getActiveUserId();
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          supabaseUserId = user.id;
        }
      } catch (e) {
        logger.warn('Could not get Supabase auth user:', e);
      }
    }

    const record: FixedIncome = {
      id,
      user_id: supabaseUserId,
      name: income.name,
      amount: Number(income.amount),
      original_amount: income.original_amount !== undefined ? Number(income.original_amount) : Number(income.amount),
      currency: income.currency || 'USD',
      payment_mode: income.payment_mode || 'usd_cash',
      default_fortnight: income.default_fortnight,
      category_id: income.category_id || 'cat_salary',
      due_day: income.due_day,
      is_active: income.is_active !== undefined ? income.is_active : true,
      notes: income.notes || '',
      sync_status: 'pending',
      created_at: income.created_at || new Date().toISOString(),
    };

    set((s) => ({
      fixedIncomes: s.fixedIncomes.some((i) => i.id === id)
        ? s.fixedIncomes.map((i) => (i.id === id ? record : i))
        : [...s.fixedIncomes, record],
    }));
    await db.fixed_incomes.put(record);

    const cleanNotes = (income.notes || '').replace(/\s*\[split\]/g, '').trim();
    const isSplit = record.default_fortnight === 'split';
    const notesWithTag = isSplit ? (cleanNotes ? `${cleanNotes} [split]` : '[split]') : cleanNotes;
    record.notes = notesWithTag;

    const { sync_status, category_id, is_active, payment_mode, original_amount, ...payload } = record as any;
    payload.default_fortnight = fortnightToQuincena(income.default_fortnight);
    payload.notes = notesWithTag;
    logger.dev('[Supabase Fixed Incomes Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_incomes').upsert(payload);
        if (!error) {
          await db.fixed_incomes.update(id, { sync_status: 'synced' });
        } else {
          // If check constraint fails on default_fortnight=50, fallback to null with notes tag
          if (isSplit && payload.default_fortnight === 50) {
            payload.default_fortnight = null;
            const { error: errRetry } = await supabase.from('fixed_incomes').upsert(payload);
            if (!errRetry) {
              await db.fixed_incomes.update(id, { sync_status: 'synced' });
              return record;
            }
          }
          logger.error('[Supabase Fixed Incomes Error]:', error.message, error.details);
          set((state) => ({
            syncQueue: [...state.syncQueue, { id, table: 'fixed_incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
          }));
        }
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id, table: 'fixed_incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteFixedIncome: async (id, userId) => {
    const cleanId = ensureValidUuid(id);
    set((s) => ({ fixedIncomes: s.fixedIncomes.filter((i) => i.id !== id && i.id !== cleanId) }));
    await db.fixed_incomes.delete(id);

    logger.dev(`[Supabase Fixed Incomes Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_incomes').delete().eq('id', cleanId);
        if (error) logger.error('[Supabase Fixed Incomes Delete Error]:', error.message);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'fixed_incomes', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  saveVariableIncome: async (income, userId) => {
    const id = ensureValidUuid(income.id);
    let supabaseUserId = userId || getActiveUserId();
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          supabaseUserId = user.id;
        }
      } catch (e) {
        logger.warn('Could not get Supabase auth user:', e);
      }
    }

    const existing = await db.variable_incomes.get(id);
    const txId = existing?.transaction_id || income.transaction_id || generateUuid();

    const record: VariableIncome = {
      id,
      user_id: supabaseUserId,
      description: income.description,
      amount: Number(income.amount),
      original_amount: income.original_amount !== undefined ? Number(income.original_amount) : Number(income.amount),
      payment_mode: income.payment_mode || 'usd_cash',
      year: income.year,
      month: income.month,
      fortnight: income.fortnight,
      category_id: income.category_id || 'cat_extras',
      account_id: income.account_id || '',
      transaction_id: income.account_id ? txId : undefined,
      currency: income.currency || 'USD',
      notes: income.notes || '',
      sync_status: 'pending',
      created_at: income.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((s) => ({
      variableIncomes: s.variableIncomes.some((v) => v.id === id)
        ? s.variableIncomes.map((v) => (v.id === id ? record : v))
        : [...s.variableIncomes, record],
    }));
    await db.variable_incomes.put(record);

    // Manage linked transaction in Capital & Cuentas
    if (record.account_id) {
      const tx: Transaction = {
        id: txId,
        user_id: supabaseUserId,
        amount: Number(record.amount),
        type: 'income',
        description: `Ingreso: ${record.description}`,
        category_id: record.category_id || 'cat_extras',
        account_id: record.account_id,
        transaction_date: `${record.year}-${String(record.month + 1).padStart(2, '0')}-${record.fortnight === 'q1' ? '15' : '28'}`,
        sync_status: 'pending',
        created_at: record.created_at || new Date().toISOString(),
      };
      await db.transactions.put(tx);
      set((s) => ({
        transactions: s.transactions.some((t) => t.id === tx.id)
          ? s.transactions.map((t) => (t.id === tx.id ? tx : t))
          : [...s.transactions, tx],
      }));
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          const { sync_status, ...txPayload } = tx;
          await supabase.from('transactions').upsert(txPayload);
        } catch (e) {
          logger.warn('Sync var income tx store err:', e);
        }
      }
    } else if (existing?.transaction_id) {
      await db.transactions.delete(existing.transaction_id);
      set((s) => ({
        transactions: s.transactions.filter((t) => t.id !== existing.transaction_id),
      }));
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('transactions').delete().eq('id', existing.transaction_id);
        } catch (e) {
          logger.warn('Delete var income tx store err:', e);
        }
      }
    }

    const payload = {
      id: record.id,
      user_id: supabaseUserId,
      name: record.description,
      amount: Number(record.amount),
      currency: record.currency || 'USD',
      quincena: record.fortnight === 'q1' || (record.fortnight as any) === 15 ? 15 : 30,
      month_year: `${record.year}-${String(record.month + 1).padStart(2, '0')}`,
      created_at: record.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    logger.dev('[Supabase Variable Incomes Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('variable_incomes').upsert(payload);
        if (!error) {
          await db.variable_incomes.update(id, { sync_status: 'synced' });
        } else {
          logger.error('[Supabase Variable Incomes Error]:', error.message, error.details);
          set((state) => ({
            syncQueue: [...state.syncQueue, { id, table: 'variable_incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
          }));
        }
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id, table: 'variable_incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteVariableIncome: async (id, userId) => {
    const cleanId = ensureValidUuid(id);
    const existing = await db.variable_incomes.get(id);
    if (existing?.transaction_id) {
      await db.transactions.delete(existing.transaction_id);
      set((s) => ({
        transactions: s.transactions.filter((t) => t.id !== existing.transaction_id),
      }));
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('transactions').delete().eq('id', existing.transaction_id);
        } catch (e) {
          logger.warn('Delete linked tx store err:', e);
        }
      }
    }

    set((s) => ({ variableIncomes: s.variableIncomes.filter((v) => v.id !== id && v.id !== cleanId) }));
    await db.variable_incomes.delete(id);

    logger.dev(`[Supabase Variable Incomes Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('variable_incomes').delete().eq('id', cleanId);
        if (error) logger.error('[Supabase Variable Incomes Delete Error]:', error.message);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'variable_incomes', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  saveFixedExpense: async (expense, userId) => {
    const id = ensureValidUuid(expense.id);
    const quincenaValue = expense.default_fortnight === 'q1' || (expense.default_fortnight as any) === 15 ? 15 : expense.default_fortnight === 'q2' || (expense.default_fortnight as any) === 30 ? 30 : null;

    const record: FixedExpense = {
      id,
      user_id: userId,
      name: expense.name,
      amount: Number(expense.amount),
      amount_usd: expense.amount_usd !== undefined ? Number(expense.amount_usd) : Number(expense.amount),
      original_amount: expense.original_amount !== undefined ? Number(expense.original_amount) : Number(expense.amount_in_ves || expense.amount),
      amount_in_ves: expense.amount_in_ves !== undefined ? Number(expense.amount_in_ves) : undefined,
      currency: expense.currency || 'USD',
      payment_mode: expense.payment_mode || 'ves_bcv',
      default_fortnight: expense.default_fortnight,
      quincena: quincenaValue,
      category_id: expense.category_id || 'cat_services',
      is_active: expense.is_active !== undefined ? expense.is_active : true,
      assumed_by_third_party: expense.assumed_by_third_party || false,
      notes: expense.notes || '',
      sync_status: 'pending',
      created_at: expense.created_at || new Date().toISOString(),
    };

    set((s) => ({
      fixedExpenses: s.fixedExpenses.some((e) => e.id === id)
        ? s.fixedExpenses.map((e) => (e.id === id ? record : e))
        : [...s.fixedExpenses, record],
    }));
    await db.fixed_expenses.put(record);

    const { sync_status, default_quincena, ...payload } = record as any;
    payload.default_fortnight = quincenaValue;
    payload.quincena = quincenaValue;
    logger.dev('[Supabase Fixed Expenses Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_expenses').upsert(payload);
        if (!error) {
          await db.fixed_expenses.update(id, { sync_status: 'synced' });
        } else {
          logger.error('[Supabase Fixed Expenses Error]:', error.message, error.details);
          set((state) => ({
            syncQueue: [...state.syncQueue, { id, table: 'fixed_expenses', action: 'upsert', payload, timestamp: new Date().toISOString() }],
          }));
        }
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id, table: 'fixed_expenses', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteFixedExpense: async (id, userId) => {
    const cleanId = ensureValidUuid(id);
    set((s) => ({ fixedExpenses: s.fixedExpenses.filter((e) => e.id !== id && e.id !== cleanId) }));
    await db.fixed_expenses.delete(id);

    logger.dev(`[Supabase Fixed Expenses Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_expenses').delete().eq('id', cleanId);
        if (error) logger.error('[Supabase Fixed Expenses Delete Error]:', error.message);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'fixed_expenses', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  saveVariableExpense: async (expense, userId) => {
    const id = ensureValidUuid(expense.id);
    const supabaseUserId = userId || expense.user_id || getActiveUserId();
    const existing = get().variableExpenses.find((v) => v.id === id);
    const txId = (existing as any)?.transaction_id || ensureValidUuid();

    const record: VariableExpense = {
      id,
      user_id: supabaseUserId,
      description: expense.description.trim(),
      amount: Number(expense.amount),
      original_amount: expense.original_amount !== undefined ? Number(expense.original_amount) : Number(expense.amount),
      payment_mode: expense.payment_mode || 'usd_cash',
      year: expense.year,
      month: expense.month,
      fortnight: expense.fortnight,
      category_id: expense.category_id || 'cat_other_exp',
      account_id: expense.account_id || undefined,
      currency: expense.currency || 'USD',
      notes: expense.notes || '',
      sync_status: 'pending',
      created_at: expense.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((s) => ({
      variableExpenses: s.variableExpenses.some((v) => v.id === id)
        ? s.variableExpenses.map((v) => (v.id === id ? record : v))
        : [...s.variableExpenses, record],
    }));
    await db.variable_expenses.put(record);

    if (record.account_id) {
      const tx: Transaction = {
        id: txId,
        user_id: supabaseUserId,
        amount: Number(record.amount),
        type: 'expense',
        description: `Gasto Variable: ${record.description}`,
        category_id: record.category_id || 'cat_other_exp',
        account_id: record.account_id,
        transaction_date: `${record.year}-${String(record.month + 1).padStart(2, '0')}-${record.fortnight === 'q1' ? '15' : '28'}`,
        sync_status: 'pending',
        created_at: record.created_at || new Date().toISOString(),
      };
      await db.transactions.put(tx);
      set((s) => ({
        transactions: s.transactions.some((t) => t.id === tx.id)
          ? s.transactions.map((t) => (t.id === tx.id ? tx : t))
          : [...s.transactions, tx],
      }));
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          const { sync_status, ...txPayload } = tx;
          await supabase.from('transactions').upsert(txPayload);
        } catch (e) {
          logger.warn('Sync var expense tx store err:', e);
        }
      }
    }

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { sync_status, ...payload } = record;
        const { error } = await supabase.from('variable_expenses').upsert(payload);
        if (!error) {
          await db.variable_expenses.update(id, { sync_status: 'synced' });
        }
      } catch (e) {
        logger.warn('Direct variable expense upsert notice in store:', e);
      }
    }

    return record;
  },

  deleteVariableExpense: async (id, _userId) => {
    const cleanId = ensureValidUuid(id);
    set((s) => ({ variableExpenses: s.variableExpenses.filter((v) => v.id !== id && v.id !== cleanId) }));
    await db.variable_expenses.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('variable_expenses').delete().eq('id', cleanId);
      } catch (e) {
        logger.warn('Delete var expense remote notice:', e);
      }
    }
  },

  saveDebt: async (debt, userId) => {
    const activeUid = userId || debt.user_id || getActiveUserId();
    const sanitizedPayload = sanitizeDebtPayload(debt, activeUid);
    const localRecord = normalizeDebtRow({ ...sanitizedPayload, currency: debt.currency || 'USD' });
    localRecord.sync_status = 'pending';

    set((s) => ({
      debts: s.debts.some((d) => d.id === localRecord.id)
        ? s.debts.map((d) => (d.id === localRecord.id ? localRecord : d))
        : [...s.debts, localRecord],
    }));
    await db.debts.put(localRecord);

    logger.dev('[Supabase Debts Payload]:', sanitizedPayload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('debts')
          .upsert(sanitizedPayload)
          .select()
          .single();

        if (!error && data) {
          const confirmedDebt = normalizeDebtRow(data);
          set((s) => ({
            debts: s.debts.map((d) => (d.id === confirmedDebt.id ? confirmedDebt : d)),
          }));
          await db.debts.put(confirmedDebt);
          return confirmedDebt;
        } else if (error) {
          logger.error('[Supabase Debts Error]:', error.message, error.details);
          set((state) => ({
            syncQueue: [...state.syncQueue, { id: localRecord.id, table: 'debts', action: 'upsert', payload: sanitizedPayload, timestamp: new Date().toISOString() }],
          }));
        }
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: localRecord.id, table: 'debts', action: 'upsert', payload: sanitizedPayload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return localRecord;
  },

  fetchDebts: async (userId: string) => {
    const debts = await fetchDebtsService(userId);
    set({ debts });
    return debts;
  },

  subscribeToDebtsChanges: (userId: string, onUpdate?: () => void) => {
    return subscribeToDebtsChangesService(userId, () => {
      fetchDebtsService(userId).then((debts) => {
        set({ debts });
        if (onUpdate) onUpdate();
      });
    });
  },

  deleteDebt: async (id, userId) => {
    const cleanId = ensureValidUuid(id);
    set((s) => ({ debts: s.debts.filter((d) => d.id !== id && d.id !== cleanId) }));
    await db.debts.delete(id);

    logger.dev(`[Supabase Debts Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('debts').delete().eq('id', cleanId);
        if (error) logger.error('[Supabase Debts Delete Error]:', error.message);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'debts', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  addDebtPayment: async (data, userId) => {
    const debtId = ensureValidUuid(data.debt_id);
    const debt = get().debts.find((d) => d.id === data.debt_id || d.id === debtId);
    if (!debt) throw new Error('Deuda no encontrada');

    const now = new Date();
    const paymentDate = data.payment_date || now.toISOString().split('T')[0];
    const dateObj = new Date(paymentDate);
    const year = data.year !== undefined ? data.year : dateObj.getFullYear();
    const month = data.month !== undefined ? data.month : dateObj.getMonth();
    const day = dateObj.getDate();
    const fortnight: FortnightType = data.fortnight || (day <= 15 ? 'q1' : 'q2');

    const paymentRecord: DebtPayment = {
      id: generateUuid(),
      user_id: userId,
      debt_id: debt.id,
      amount: Number(data.amount),
      payment_date: paymentDate,
      year,
      month,
      fortnight,
      rate_applied: data.rate_applied,
      parallel_rate: data.parallel_rate,
      notes: data.notes || '',
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };

    const newBalance = Math.max(0, Number(debt.current_balance) - Number(data.amount));
    const isFullPayment = newBalance <= 0.01;
    const newStatus = isFullPayment ? 'paid' : 'active';
    let newPendingInstallments: number | undefined;
    if (debt.pending_installments !== undefined) {
      if (isFullPayment) {
        newPendingInstallments = 0;
      } else {
        const quotaAmount = debt.installment_amount && debt.installment_amount > 0
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
      status: newStatus,
      pending_installments: newPendingInstallments,
      updated_at: new Date().toISOString(),
    };

    set((s) => ({
      debtPayments: [...s.debtPayments, paymentRecord],
      debts: s.debts.map((d) => (d.id === debt.id ? updatedDebt : d)),
    }));

    await db.debt_payments.add(paymentRecord);
    await db.debts.put(updatedDebt);

    const { sync_status: s1, ...payPayload } = paymentRecord;
    const debtPayload = sanitizeDebtPayload(updatedDebt, userId);

    logger.dev('[Supabase Debt Payments Payload]:', payPayload);
    logger.dev('[Supabase Debts Update Payload]:', debtPayload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const [resPay, resDebt] = await Promise.all([
          supabase.from('debt_payments').upsert(payPayload).select().single(),
          supabase.from('debts').upsert(debtPayload).select().single(),
        ]);

        if (!resPay.error && resPay.data) {
          await db.debt_payments.update(paymentRecord.id, { sync_status: 'synced' });
        }
        if (!resDebt.error && resDebt.data) {
          const confirmedDebt = normalizeDebtRow(resDebt.data);
          set((s) => ({
            debts: s.debts.map((d) => (d.id === confirmedDebt.id ? confirmedDebt : d)),
          }));
          await db.debts.put(confirmedDebt);
        }
      } catch {
        set((state) => ({
          syncQueue: [
            ...state.syncQueue,
            { id: paymentRecord.id, table: 'debt_payments', action: 'upsert', payload: payPayload, timestamp: new Date().toISOString() },
            { id: debt.id, table: 'debts', action: 'upsert', payload: debtPayload, timestamp: new Date().toISOString() },
          ],
        }));
      }
    }

    return paymentRecord;
  },

  saveSavingsGoal: async (goal, userId) => {
    const id = ensureValidUuid(goal.id);

    let targetFortnight: 15 | 30 | null = null;
    if (goal.frequency === 'monthly') {
      if (goal.target_fortnight === 30 || (goal.target_fortnight as any) === 'q2') {
        targetFortnight = 30;
      } else if (goal.target_fortnight === 15 || (goal.target_fortnight as any) === 'q1') {
        targetFortnight = 15;
      } else {
        const startDay = new Date(goal.start_date || new Date().toISOString().split('T')[0]).getDate();
        targetFortnight = startDay <= 15 ? 15 : 30;
      }
    } else {
      targetFortnight = null;
    }

    const record: SavingsGoal = {
      id,
      user_id: userId,
      name: goal.name,
      target_amount: Number(goal.target_amount),
      current_amount: goal.current_amount !== undefined ? Number(goal.current_amount) : 0,
      frequency: goal.frequency,
      target_fortnight: targetFortnight,
      amount_per_period: Number(goal.amount_per_period),
      start_date: goal.start_date || new Date().toISOString().split('T')[0],
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

    set((s) => ({
      savingsGoals: s.savingsGoals.some((g) => g.id === id)
        ? s.savingsGoals.map((g) => (g.id === id ? record : g))
        : [...s.savingsGoals, record],
    }));
    await db.savings_goals.put(record);

    // Filtrar 'sync_status' (solo local) para enviar a Supabase
    const { sync_status, ...payload } = record;
    logger.dev('[Supabase Savings Goals Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('savings_goals').upsert(payload);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id, table: 'savings_goals', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteSavingsGoal: async (id, userId) => {
    const cleanId = ensureValidUuid(id);
    set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== id && g.id !== cleanId) }));
    await db.savings_goals.delete(id);

    logger.dev(`[Supabase Savings Goals Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('savings_goals').delete().eq('id', cleanId);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'savings_goals', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  addSavingContribution: async (data, userId) => {
    const goalId = ensureValidUuid(data.goal_id);
    const goal = get().savingsGoals.find((g) => g.id === data.goal_id || g.id === goalId);
    if (!goal) throw new Error('Meta no encontrada');

    const record: SavingContribution = {
      id: generateUuid(),
      user_id: userId,
      goal_id: goal.id,
      amount: Number(data.amount),
      year: data.year,
      month: data.month,
      fortnight: data.fortnight,
      is_skipped: false,
      contribution_date: new Date().toISOString().split('T')[0],
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

    set((s) => ({
      savingContributions: [...s.savingContributions, record],
      savingsGoals: s.savingsGoals.map((g) => (g.id === goal.id ? updatedGoal : g)),
    }));

    await db.saving_contributions.add(record);
    await db.savings_goals.put(updatedGoal);

    const { sync_status: s1, ...scPayload } = record;
    const { sync_status: s2, ...goalPayload } = updatedGoal;

    logger.dev('[Supabase Saving Contributions Payload]:', scPayload);
    logger.dev('[Supabase Savings Goals Update Payload]:', goalPayload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from('saving_contributions').upsert(scPayload),
          supabase.from('savings_goals').upsert(goalPayload),
        ]);
      } catch {
        set((state) => ({
          syncQueue: [
            ...state.syncQueue,
            { id: record.id, table: 'saving_contributions', action: 'upsert', payload: scPayload, timestamp: new Date().toISOString() },
            { id: goal.id, table: 'savings_goals', action: 'upsert', payload: goalPayload, timestamp: new Date().toISOString() },
          ],
        }));
      }
    }

    return record;
  },

  setFortnightExpensePaid: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const expenseId = ensureValidUuid(params.expense.id);
    const stateId = generateUuid();
    const txId = generateUuid();
    const resolvedAccountId = ensureValidUuid(params.accountId || get().accounts[0]?.id);

    const txRecord: Transaction = {
      id: txId,
      user_id: userId,
      amount: Number(params.amount),
      type: 'expense',
      description: `Pago Gasto Fijo: ${params.expense.name} (${params.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
      category_id: params.expense.category_id || 'cat_services',
      account_id: resolvedAccountId,
      transaction_date: periodKey,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };

    const stateRecord: FortnightItemState = {
      id: stateId,
      user_id: userId,
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
      transactions: [...s.transactions, txRecord],
      fortnightItemStates: [
        ...s.fortnightItemStates.filter((st) => !(st.item_id === expenseId && st.period_key === periodKey)),
        stateRecord,
      ],
    }));

    await db.transactions.put(txRecord);
    await db.fortnight_item_states.put(stateRecord);

    const { sync_status: s1, ...txPayload } = txRecord;
    const { sync_status: s2, ...statePayload } = stateRecord;

    logger.dev('[Supabase Transactions Paid Payload]:', txPayload);
    logger.dev('[Supabase Fortnight Item States Paid Payload]:', statePayload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from('transactions').upsert(txPayload),
          supabase.from('fortnight_item_states').upsert(statePayload),
        ]);
      } catch {
        set((state) => ({
          syncQueue: [
            ...state.syncQueue,
            { id: txId, table: 'transactions', action: 'upsert', payload: txPayload, timestamp: new Date().toISOString() },
            { id: stateId, table: 'fortnight_item_states', action: 'upsert', payload: statePayload, timestamp: new Date().toISOString() },
          ],
        }));
      }
    }
  },

  unmarkFortnightExpensePaid: async (params, userId) => {
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

      if (txId) await db.transactions.delete(txId);
      await db.fortnight_item_states.delete(existingState.id);

      logger.dev(`[Supabase Fortnight States Delete]: id ${existingState.id}, txId ${txId}`);
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('fortnight_item_states').delete().eq('id', existingState.id);
          if (txId) await supabase.from('transactions').delete().eq('id', txId);
        } catch {
          set((state) => ({
            syncQueue: [
              ...state.syncQueue,
              { id: existingState.id, table: 'fortnight_item_states', action: 'delete', payload: { id: existingState.id, user_id: userId }, timestamp: new Date().toISOString() },
            ],
          }));
        }
      }
    }
  },

  setFortnightExpenseSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const expenseId = ensureValidUuid(params.expenseId);
    const stateId = generateUuid();

    const stateRecord: FortnightItemState = {
      id: stateId,
      user_id: userId,
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
        ...s.fortnightItemStates.filter((st) => !(st.item_id === expenseId && st.period_key === periodKey)),
        stateRecord,
      ],
    }));

    await db.fortnight_item_states.put(stateRecord);

    const { sync_status, ...payload } = stateRecord;
    logger.dev('[Supabase Fortnight Expense Skipped Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fortnight_item_states').upsert(payload);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: stateId, table: 'fortnight_item_states', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  unmarkFortnightExpenseSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const expenseId = ensureValidUuid(params.expenseId);

    const existingState = get().fortnightItemStates.find(
      (st) => (st.item_id === params.expenseId || st.item_id === expenseId) && st.period_key === periodKey
    );

    if (existingState) {
      set((s) => ({ fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== existingState.id) }));
      await db.fortnight_item_states.delete(existingState.id);

      logger.dev(`[Supabase Fortnight Expense Unmark Skipped]: id ${existingState.id}`);
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('fortnight_item_states').delete().eq('id', existingState.id);
        } catch {
          set((state) => ({
            syncQueue: [...state.syncQueue, { id: existingState.id, table: 'fortnight_item_states', action: 'delete', payload: { id: existingState.id, user_id: userId }, timestamp: new Date().toISOString() }],
          }));
        }
      }
    }
  },

  setFortnightDebtSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const debtId = ensureValidUuid(params.debtId);
    const stateId = generateUuid();

    const stateRecord: FortnightItemState = {
      id: stateId,
      user_id: userId,
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
        ...s.fortnightItemStates.filter((st) => !(st.item_id === debtId && st.period_key === periodKey)),
        stateRecord,
      ],
    }));

    await db.fortnight_item_states.put(stateRecord);

    const { sync_status, ...payload } = stateRecord;
    logger.dev('[Supabase Fortnight Debt Skipped Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fortnight_item_states').upsert(payload);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: stateId, table: 'fortnight_item_states', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  unmarkFortnightDebtSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const debtId = ensureValidUuid(params.debtId);

    const existingState = get().fortnightItemStates.find(
      (st) => (st.item_id === params.debtId || st.item_id === debtId) && st.period_key === periodKey
    );

    if (existingState) {
      set((s) => ({ fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== existingState.id) }));
      await db.fortnight_item_states.delete(existingState.id);

      logger.dev(`[Supabase Fortnight Debt Unmark Skipped]: id ${existingState.id}`);
      if (navigator.onLine && isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('fortnight_item_states').delete().eq('id', existingState.id);
        } catch {
          set((state) => ({
            syncQueue: [...state.syncQueue, { id: existingState.id, table: 'fortnight_item_states', action: 'delete', payload: { id: existingState.id, user_id: userId }, timestamp: new Date().toISOString() }],
          }));
        }
      }
    }
  },

  addTransaction: async (txData, userId) => {
    const id = generateUuid();
    const resolvedAccountId = ensureValidUuid(txData.account_id || get().accounts[0]?.id);

    const record: Transaction = {
      ...txData,
      id,
      user_id: userId,
      account_id: resolvedAccountId,
      amount: Number(txData.amount),
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };

    set((s) => ({ transactions: [record, ...s.transactions] }));
    await db.transactions.put(record);

    const { sync_status, ...payload } = record;
    logger.dev('[Supabase Transactions Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').upsert(payload);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id, table: 'transactions', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteTransaction: async (id, userId) => {
    const cleanId = ensureValidUuid(id);
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id && t.id !== cleanId) }));
    await db.transactions.delete(id);

    logger.dev(`[Supabase Transactions Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', cleanId);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'transactions', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },
}));
