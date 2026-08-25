import { create } from 'zustand';
import type {
  Account,
  Category,
  Debt,
  DebtPayment,
  FixedExpense,
  FixedIncome,
  VariableIncome,
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
  toSupabaseAccountPayload,
  getFortnightPeriodKey,
  getActiveUserId,
} from '../lib/db.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { ensureValidUuid, generateUuid } from '../utils/uuid.ts';
import {
  sanitizeDebtPayload,
  normalizeDebtRow,
  subscribeToDebtsChanges as subscribeToDebtsChangesService,
  fetchDebts as fetchDebtsService,
} from '../services/debtsService.ts';

export type RealtimeSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export const fortnightToQuincena = (f: any): number | null => {
  if (f === 'q1' || f === 15 || f === '15') return 15;
  if (f === 'q2' || f === 30 || f === '30') return 30;
  return null; // 'both'
};

export const quincenaToFortnight = (q: any): 'q1' | 'q2' | 'both' => {
  if (q === 15 || q === '15' || q === 'q1') return 'q1';
  if (q === 30 || q === '30' || q === 'q2') return 'q2';
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
  debts: Debt[];
  debtPayments: DebtPayment[];
  savingsGoals: SavingsGoal[];
  savingContributions: SavingContribution[];
  fortnightItemStates: FortnightItemState[];
  transactions: Transaction[];

  // Sync state
  syncStatus: RealtimeSyncStatus;
  lastSyncTime: string | null;
  isLoading: boolean;
  error: string | null;
  syncQueue: SyncQueueItem[];

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
      console.warn(`[Supabase Table Notice '${tableName}'] :`, res.error.message || res.error.details || res.error);
      return [];
    }
    return (res.data as T[]) || [];
  } catch (err: any) {
    console.warn(`[Supabase Table Query Exception '${tableName}'] :`, err?.message || err);
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
  debts: [],
  debtPayments: [],
  savingsGoals: [],
  savingContributions: [],
  fortnightItemStates: [],
  transactions: [],

  syncStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'syncing' : 'offline',
  lastSyncTime: null,
  isLoading: true,
  error: null,
  syncQueue: [],

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
        db.debts.toArray(),
        db.debt_payments.toArray(),
        db.savings_goals.toArray(),
        db.saving_contributions.toArray(),
        db.fortnight_item_states.toArray(),
        db.transactions.toArray(),
      ]);

      const filteredAccounts = userId ? accounts.filter((a) => !a.user_id || a.user_id === userId) : accounts;
      const filteredFixedIncomes = userId ? fixedIncomes.filter((f) => f.user_id === userId) : fixedIncomes;
      const filteredVarIncomes = userId ? variableIncomes.filter((v) => v.user_id === userId) : variableIncomes;
      const filteredExpenses = userId ? fixedExpenses.filter((e) => e.user_id === userId) : fixedExpenses;
      const filteredDebts = userId ? debts.filter((d) => d.user_id === userId) : debts;
      const filteredDebtPayments = userId ? debtPayments.filter((d) => d.user_id === userId) : debtPayments;
      const filteredSavings = userId ? savingsGoals.filter((s) => s.user_id === userId) : savingsGoals;
      const filteredContribs = userId ? savingContributions.filter((c) => c.user_id === userId) : savingContributions;
      const filteredStates = userId ? fortnightItemStates.filter((s) => s.user_id === userId) : fortnightItemStates;
      const filteredTxs = userId ? transactions.filter((t) => t.user_id === userId) : transactions;

      set({
        accounts: filteredAccounts,
        categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
        fixedIncomes: filteredFixedIncomes,
        monthlyIncomeOverrides,
        variableIncomes: filteredVarIncomes,
        fixedExpenses: filteredExpenses,
        monthlyFixedOverrides,
        debts: filteredDebts,
        debtPayments: filteredDebtPayments,
        savingsGoals: filteredSavings,
        savingContributions: filteredContribs,
        fortnightItemStates: filteredStates,
        transactions: filteredTxs,
        isLoading: false,
      });
    } catch (err) {
      console.warn('Error loading from local cache:', err);
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

      console.log(`[Supabase Fetch Initial]: Consultando tablas oficiales para usuario ${userId}...`);

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
        safeQuery('categories', () => client.from('categories').select('*')),
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
      const categories: Category[] = rawCategories.length > 0 ? rawCategories : DEFAULT_CATEGORIES;

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
        default_fortnight: quincenaToFortnight(i.default_fortnight),
        sync_status: 'synced',
      }));
      const monthlyIncomeOverrides: MonthlyFixedIncomeOverride[] = rawIncomeOverrides.map((o: any) => ({ ...o, sync_status: 'synced' }));
      const variableIncomes: VariableIncome[] = rawVariableIncomes.map((v: any) => ({ ...v, id: ensureValidUuid(v.id), sync_status: 'synced' }));
      const fixedExpenses: FixedExpense[] = rawExpenses.map((e: any) => ({
        ...e,
        id: ensureValidUuid(e.id),
        default_fortnight: quincenaToFortnight(e.default_fortnight || e.default_quincena),
        sync_status: 'synced',
      }));
      const monthlyFixedOverrides: MonthlyFixedOverride[] = rawExpenseOverrides.map((o: any) => ({ ...o, sync_status: 'synced' }));
      const debts: Debt[] = rawDebts.map((d: any) => normalizeDebtRow(d));
      const debtPayments: DebtPayment[] = rawDebtPayments.map((p: any) => ({ ...p, id: ensureValidUuid(p.id), sync_status: 'synced' }));
      const savingsGoals: SavingsGoal[] = rawSavings.map((s: any) => ({ ...s, id: ensureValidUuid(s.id), sync_status: 'synced' }));
      const savingContributions: SavingContribution[] = rawContribs.map((c: any) => ({ ...c, id: ensureValidUuid(c.id), sync_status: 'synced' }));
      const fortnightItemStates: FortnightItemState[] = rawStates.map((st: any) => ({ ...st, id: ensureValidUuid(st.id), sync_status: 'synced' }));
      const transactions: Transaction[] = rawTxs.map((t: any) => ({ ...t, id: ensureValidUuid(t.id), sync_status: 'synced' }));

      // Sincronizar Dexie en segundo plano
      await Promise.all([
        db.accounts.where('user_id').equals(userId).delete().then(() => {
          if (accounts.length > 0) db.accounts.bulkPut(accounts);
        }),
        db.categories.bulkPut(categories),
        db.fixed_incomes.where('user_id').equals(userId).delete().then(() => {
          if (fixedIncomes.length > 0) db.fixed_incomes.bulkPut(fixedIncomes);
        }),
        db.monthly_fixed_income_overrides.bulkPut(monthlyIncomeOverrides),
        db.variable_incomes.where('user_id').equals(userId).delete().then(() => {
          if (variableIncomes.length > 0) db.variable_incomes.bulkPut(variableIncomes);
        }),
        db.fixed_expenses.where('user_id').equals(userId).delete().then(() => {
          if (fixedExpenses.length > 0) db.fixed_expenses.bulkPut(fixedExpenses);
        }),
        db.monthly_fixed_overrides.bulkPut(monthlyFixedOverrides),
        db.debts.where('user_id').equals(userId).delete().then(() => {
          if (debts.length > 0) db.debts.bulkPut(debts);
        }),
        db.debt_payments.where('user_id').equals(userId).delete().then(() => {
          if (debtPayments.length > 0) db.debt_payments.bulkPut(debtPayments);
        }),
        db.savings_goals.where('user_id').equals(userId).delete().then(() => {
          if (savingsGoals.length > 0) db.savings_goals.bulkPut(savingsGoals);
        }),
        db.saving_contributions.where('user_id').equals(userId).delete().then(() => {
          if (savingContributions.length > 0) db.saving_contributions.bulkPut(savingContributions);
        }),
        db.fortnight_item_states.where('user_id').equals(userId).delete().then(() => {
          if (fortnightItemStates.length > 0) db.fortnight_item_states.bulkPut(fortnightItemStates);
        }),
        db.transactions.where('user_id').equals(userId).delete().then(() => {
          if (transactions.length > 0) db.transactions.bulkPut(transactions);
        }),
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
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('[FinanceStore Fetch Initial Error]:', err);
      await get().loadFromLocalCache(userId);
      set({ syncStatus: 'error', error: err.message, isLoading: false });
    }
  },

  /**
   * Manejador de eventos Realtime de Supabase (Smart Merge por ID)
   */
  handleRealtimePayload: async (table: string, payload: any, userId: string) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    console.log(`[Realtime Merge on ${table} - ${eventType}]:`, newRow || oldRow);

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
      case 'accounts': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ accounts: s.accounts.filter((a) => a.id !== oldRow.id) }));
          await db.accounts.delete(oldRow.id);
        } else if (newRow?.id) {
          const acc = normalizeAcc(newRow);
          set((s) => ({
            accounts: s.accounts.some((a) => a.id === acc.id)
              ? s.accounts.map((a) => (a.id === acc.id ? acc : a))
              : [...s.accounts, acc],
          }));
          await db.accounts.put(acc);
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
          const item: VariableIncome = { ...newRow, id: ensureValidUuid(newRow.id), sync_status: 'synced' };
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
          const item: MonthlyFixedOverride = { ...newRow, sync_status: 'synced' };
          set((s) => ({
            monthlyFixedOverrides: s.monthlyFixedOverrides.some((o) => o.id === item.id)
              ? s.monthlyFixedOverrides.map((o) => (o.id === item.id ? item : o))
              : [...s.monthlyFixedOverrides, item],
          }));
          await db.monthly_fixed_overrides.put(item);
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
          const item: DebtPayment = { ...newRow, id: ensureValidUuid(newRow.id), sync_status: 'synced' };
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

    set({ lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), syncStatus: 'connected' });
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
          console.log(`[Supabase Queue Flush]: Upserting on '${item.table}' ->`, item.payload);
          const { error } = await supabase.from(item.table).upsert(item.payload);
          if (error) {
            console.error(`[Queue Flush Error on ${item.table}]:`, error.message, error.details);
            remaining.push(item);
          }
        } else if (item.action === 'delete') {
          console.log(`[Supabase Queue Flush]: Deleting from '${item.table}' id ${item.payload.id}`);
          const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id);
          if (error) {
            console.error(`[Queue Delete Error on ${item.table}]:`, error.message, error.details);
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
    console.log('[Supabase Accounts Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('accounts').upsert(payload);
        if (!error) {
          record.sync_status = 'synced';
          await db.accounts.update(id, { sync_status: 'synced' });
        } else {
          console.error('[Supabase Accounts Error]:', error.message, error.details);
          set((state) => ({
            syncQueue: [...state.syncQueue, { id, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
          }));
        }
      } catch (e) {
        console.warn('Account upsert network catch:', e);
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

    console.log(`[Supabase Accounts Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('accounts').delete().eq('id', cleanId);
        if (error) console.error('[Supabase Accounts Delete Error]:', error.message);
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
    console.log('[Supabase Accounts Adjust Payload]:', payload);

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
        console.warn('Could not get Supabase auth user:', e);
      }
    }

    const record: FixedIncome = {
      id,
      user_id: supabaseUserId,
      name: income.name,
      amount: Number(income.amount),
      currency: income.currency || 'USD',
      default_fortnight: income.default_fortnight,
      category_id: income.category_id || 'cat_salary',
      is_active: income.is_active !== undefined ? income.is_active : true,
      notes: income.notes || '',
      sync_status: 'pending',
    };

    set((s) => ({
      fixedIncomes: s.fixedIncomes.some((i) => i.id === id)
        ? s.fixedIncomes.map((i) => (i.id === id ? record : i))
        : [...s.fixedIncomes, record],
    }));
    await db.fixed_incomes.put(record);

    const { sync_status, category_id, is_active, ...payload } = record as any;
    payload.default_fortnight = fortnightToQuincena(income.default_fortnight);
    console.log('[Supabase Fixed Incomes Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_incomes').upsert(payload);
        if (!error) {
          await db.fixed_incomes.update(id, { sync_status: 'synced' });
        } else {
          console.error('[Supabase Fixed Incomes Error]:', error.message, error.details);
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

    console.log(`[Supabase Fixed Incomes Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_incomes').delete().eq('id', cleanId);
        if (error) console.error('[Supabase Fixed Incomes Delete Error]:', error.message);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'fixed_incomes', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  saveVariableIncome: async (income, userId) => {
    const id = ensureValidUuid(income.id);
    const resolvedAccountId = ensureValidUuid(income.account_id || get().accounts[0]?.id);

    const record: VariableIncome = {
      id,
      user_id: userId,
      description: income.description,
      amount: Number(income.amount),
      year: income.year,
      month: income.month,
      fortnight: income.fortnight,
      category_id: income.category_id || 'cat_extras',
      account_id: resolvedAccountId,
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

    const { sync_status, ...payload } = record;
    console.log('[Supabase Variable Incomes Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('variable_incomes').upsert(payload);
        if (!error) {
          await db.variable_incomes.update(id, { sync_status: 'synced' });
        } else {
          console.error('[Supabase Variable Incomes Error]:', error.message, error.details);
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
    set((s) => ({ variableIncomes: s.variableIncomes.filter((v) => v.id !== id && v.id !== cleanId) }));
    await db.variable_incomes.delete(id);

    console.log(`[Supabase Variable Incomes Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('variable_incomes').delete().eq('id', cleanId);
        if (error) console.error('[Supabase Variable Incomes Delete Error]:', error.message);
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
    console.log('[Supabase Fixed Expenses Payload]:', payload);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_expenses').upsert(payload);
        if (!error) {
          await db.fixed_expenses.update(id, { sync_status: 'synced' });
        } else {
          console.error('[Supabase Fixed Expenses Error]:', error.message, error.details);
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

    console.log(`[Supabase Fixed Expenses Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_expenses').delete().eq('id', cleanId);
        if (error) console.error('[Supabase Fixed Expenses Delete Error]:', error.message);
      } catch {
        set((state) => ({
          syncQueue: [...state.syncQueue, { id: cleanId, table: 'fixed_expenses', action: 'delete', payload: { id: cleanId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
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

    console.log('[Supabase Debts Payload]:', sanitizedPayload);

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
          console.error('[Supabase Debts Error]:', error.message, error.details);
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

    console.log(`[Supabase Debts Delete]: id ${cleanId}`);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('debts').delete().eq('id', cleanId);
        if (error) console.error('[Supabase Debts Delete Error]:', error.message);
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
    const newStatus = newBalance <= 0.01 ? 'paid' : 'active';
    const updatedDebt: Debt = {
      ...debt,
      current_balance: newBalance,
      status: newStatus,
      pending_installments: debt.pending_installments ? Math.max(0, debt.pending_installments - 1) : undefined,
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

    console.log('[Supabase Debt Payments Payload]:', payPayload);
    console.log('[Supabase Debts Update Payload]:', debtPayload);

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
    console.log('[Supabase Savings Goals Payload]:', payload);

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

    console.log(`[Supabase Savings Goals Delete]: id ${cleanId}`);
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

    console.log('[Supabase Saving Contributions Payload]:', scPayload);
    console.log('[Supabase Savings Goals Update Payload]:', goalPayload);

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

    console.log('[Supabase Transactions Paid Payload]:', txPayload);
    console.log('[Supabase Fortnight Item States Paid Payload]:', statePayload);

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

      console.log(`[Supabase Fortnight States Delete]: id ${existingState.id}, txId ${txId}`);
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
    console.log('[Supabase Fortnight Expense Skipped Payload]:', payload);

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

      console.log(`[Supabase Fortnight Expense Unmark Skipped]: id ${existingState.id}`);
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
    console.log('[Supabase Fortnight Debt Skipped Payload]:', payload);

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

      console.log(`[Supabase Fortnight Debt Unmark Skipped]: id ${existingState.id}`);
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
    console.log('[Supabase Transactions Payload]:', payload);

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

    console.log(`[Supabase Transactions Delete]: id ${cleanId}`);
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
