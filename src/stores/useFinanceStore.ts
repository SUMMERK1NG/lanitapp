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
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  toSupabaseAccountPayload,
  getFortnightPeriodKey,
} from '../lib/db.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';

export type RealtimeSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

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

export const useFinanceStore = create<FinanceStoreState>((set, get) => ({
  profiles: [],
  categories: DEFAULT_CATEGORIES,
  accounts: DEFAULT_ACCOUNTS,
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
        accounts: filteredAccounts.length > 0 ? filteredAccounts : DEFAULT_ACCOUNTS,
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
   * Carga inicial completa de las 14 tablas desde Supabase
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

      // 2. Fetch en paralelo de las 14 tablas
      const [
        resProfiles,
        resCategories,
        resAccounts,
        resFixedIncomes,
        resMonthlyIncomeOverrides,
        resVariableIncomes,
        resFixedExpenses,
        resMonthlyFixedOverrides,
        resDebts,
        resDebtPayments,
        resSavingsGoals,
        resSavingContributions,
        resFortnightStates,
        resTransactions,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId),
        supabase.from('categories').select('*'),
        supabase.from('accounts').select('*').eq('user_id', userId),
        supabase.from('fixed_incomes').select('*').eq('user_id', userId),
        supabase.from('monthly_fixed_income_overrides').select('*'),
        supabase.from('variable_incomes').select('*').eq('user_id', userId),
        supabase.from('fixed_expenses').select('*').eq('user_id', userId),
        supabase.from('monthly_fixed_overrides').select('*'),
        supabase.from('debts').select('*').eq('user_id', userId),
        supabase.from('debt_payments').select('*').eq('user_id', userId),
        supabase.from('savings_goals').select('*').eq('user_id', userId),
        supabase.from('saving_contributions').select('*').eq('user_id', userId),
        supabase.from('fortnight_item_states').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId),
      ]);

      const profiles: UserProfile[] = resProfiles.data || [];
      const categories: Category[] = resCategories.data && resCategories.data.length > 0 ? resCategories.data : DEFAULT_CATEGORIES;

      const rawAccounts = resAccounts.data || [];
      const accounts: Account[] = rawAccounts.map((a: any) => ({
        id: a.id,
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

      const fixedIncomes: FixedIncome[] = (resFixedIncomes.data || []).map((i: any) => ({ ...i, sync_status: 'synced' }));
      const monthlyIncomeOverrides: MonthlyFixedIncomeOverride[] = (resMonthlyIncomeOverrides.data || []).map((o: any) => ({ ...o, sync_status: 'synced' }));
      const variableIncomes: VariableIncome[] = (resVariableIncomes.data || []).map((v: any) => ({ ...v, sync_status: 'synced' }));
      const fixedExpenses: FixedExpense[] = (resFixedExpenses.data || []).map((e: any) => ({ ...e, sync_status: 'synced' }));
      const monthlyFixedOverrides: MonthlyFixedOverride[] = (resMonthlyFixedOverrides.data || []).map((o: any) => ({ ...o, sync_status: 'synced' }));
      const debts: Debt[] = (resDebts.data || []).map((d: any) => ({ ...d, sync_status: 'synced' }));
      const debtPayments: DebtPayment[] = (resDebtPayments.data || []).map((p: any) => ({ ...p, sync_status: 'synced' }));
      const savingsGoals: SavingsGoal[] = (resSavingsGoals.data || []).map((s: any) => ({ ...s, sync_status: 'synced' }));
      const savingContributions: SavingContribution[] = (resSavingContributions.data || []).map((c: any) => ({ ...c, sync_status: 'synced' }));
      const fortnightItemStates: FortnightItemState[] = (resFortnightStates.data || []).map((st: any) => ({ ...st, sync_status: 'synced' }));
      const transactions: Transaction[] = (resTransactions.data || []).map((t: any) => ({ ...t, sync_status: 'synced' }));

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
        accounts: accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS,
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
      id: row.id,
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
          const item: FixedIncome = { ...newRow, sync_status: 'synced' };
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
          const item: VariableIncome = { ...newRow, sync_status: 'synced' };
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
          const item: FixedExpense = { ...newRow, sync_status: 'synced' };
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
          const item: Debt = { ...newRow, sync_status: 'synced' };
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
          const item: DebtPayment = { ...newRow, sync_status: 'synced' };
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
          const item: SavingsGoal = { ...newRow, sync_status: 'synced' };
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
          const item: SavingContribution = { ...newRow, sync_status: 'synced' };
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
          const item: FortnightItemState = { ...newRow, sync_status: 'synced' };
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
          const item: Transaction = { ...newRow, sync_status: 'synced' };
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
          const { error } = await supabase.from(item.table).upsert(item.payload);
          if (error) {
            console.error(`[Queue Flush Error on ${item.table}]:`, error);
            remaining.push(item);
          }
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id);
          if (error) {
            console.error(`[Queue Delete Error on ${item.table}]:`, error);
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
  // OPTIMISTIC MUTATIONS (Immediate UI -> Dexie -> Supabase / Queue)
  // -----------------------------------------------------------------

  saveAccount: async (account, userId) => {
    const id = account.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'acc_' + Math.random().toString(36).substring(2, 9));
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
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('accounts').upsert(payload);
        if (!error) {
          record.sync_status = 'synced';
          await db.accounts.update(id, { sync_status: 'synced' });
        } else {
          set((s) => ({
            syncQueue: [...s.syncQueue, { id, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
          }));
        }
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    } else {
      set((s) => ({
        syncQueue: [...s.syncQueue, { id, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
      }));
    }

    return record;
  },

  deleteAccount: async (id, userId) => {
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
    await db.accounts.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('accounts').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'accounts', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    } else {
      set((s) => ({
        syncQueue: [...s.syncQueue, { id, table: 'accounts', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
      }));
    }
  },

  adjustAccountBalance: async (accountId, newInitialBalance, userId) => {
    const existing = get().accounts.find((a) => a.id === accountId);
    if (!existing) return;

    const updated: Account = {
      ...existing,
      initial_balance: Number(newInitialBalance),
      updated_at: new Date().toISOString(),
    };

    set((s) => ({ accounts: s.accounts.map((a) => (a.id === accountId ? updated : a)) }));
    await db.accounts.put(updated);

    const payload = toSupabaseAccountPayload(updated, userId);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('accounts').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id: accountId, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    } else {
      set((s) => ({
        syncQueue: [...s.syncQueue, { id: accountId, table: 'accounts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
      }));
    }
  },

  saveFixedIncome: async (income, userId) => {
    const id = income.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'fi_' + Math.random().toString(36).substring(2, 9));
    const record: FixedIncome = {
      id,
      user_id: userId,
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

    const { sync_status, ...payload } = record;
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('fixed_incomes').upsert(payload);
        if (!error) await db.fixed_incomes.update(id, { sync_status: 'synced' });
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'fixed_incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteFixedIncome: async (id, userId) => {
    set((s) => ({ fixedIncomes: s.fixedIncomes.filter((i) => i.id !== id) }));
    await db.fixed_incomes.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fixed_incomes').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'fixed_incomes', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  saveVariableIncome: async (income, userId) => {
    const id = income.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'vi_' + Math.random().toString(36).substring(2, 9));
    const record: VariableIncome = {
      id,
      user_id: userId,
      description: income.description,
      amount: Number(income.amount),
      year: income.year,
      month: income.month,
      fortnight: income.fortnight,
      category_id: income.category_id || 'cat_extras',
      account_id: income.account_id || 'acc_bank_usd',
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
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('variable_incomes').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'variable_incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteVariableIncome: async (id, userId) => {
    set((s) => ({ variableIncomes: s.variableIncomes.filter((v) => v.id !== id) }));
    await db.variable_incomes.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('variable_incomes').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'variable_incomes', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  saveFixedExpense: async (expense, userId) => {
    const id = expense.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'fe_' + Math.random().toString(36).substring(2, 9));
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

    const { sync_status, ...payload } = record;
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fixed_expenses').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'fixed_expenses', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteFixedExpense: async (id, userId) => {
    set((s) => ({ fixedExpenses: s.fixedExpenses.filter((e) => e.id !== id) }));
    await db.fixed_expenses.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fixed_expenses').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'fixed_expenses', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  saveDebt: async (debt, userId) => {
    const id = debt.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'debt_' + Math.random().toString(36).substring(2, 9));
    const current_balance = debt.current_balance !== undefined ? Number(debt.current_balance) : Number(debt.total_amount);
    const status = current_balance <= 0 ? 'paid' : (debt.status || 'active');

    const now = new Date();
    const start_year = debt.start_year !== undefined ? debt.start_year : now.getFullYear();
    const start_month = debt.start_month !== undefined ? debt.start_month : now.getMonth();
    const start_fortnight = debt.start_fortnight || (now.getDate() <= 15 ? 'q1' : 'q2');

    const record: Debt = {
      id,
      user_id: userId,
      creditor: debt.creditor,
      platform: debt.platform || 'particular',
      debt_mode: debt.debt_mode || 'installments',
      total_amount: Number(debt.total_amount),
      current_balance,
      total_installments: debt.total_installments,
      pending_installments: debt.pending_installments,
      installment_amount: debt.installment_amount !== undefined ? Number(debt.installment_amount) : undefined,
      fortnight_due: debt.fortnight_due || 'q1',
      start_year,
      start_month,
      start_fortnight,
      currency: debt.currency || 'USD',
      payment_type: debt.payment_type,
      has_interest: debt.has_interest,
      interest_rate: debt.interest_rate || 0,
      interest_amount: debt.interest_amount || 0,
      interest_frequency: debt.interest_frequency,
      interest_fortnight: debt.interest_fortnight,
      due_date: debt.due_date,
      status,
      priority: debt.priority || 'medium',
      notes: debt.notes || '',
      sync_status: 'pending',
      created_at: debt.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((s) => ({
      debts: s.debts.some((d) => d.id === id)
        ? s.debts.map((d) => (d.id === id ? record : d))
        : [...s.debts, record],
    }));
    await db.debts.put(record);

    const { sync_status, ...payload } = record;
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('debts').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'debts', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteDebt: async (id, userId) => {
    set((s) => ({ debts: s.debts.filter((d) => d.id !== id) }));
    await db.debts.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('debts').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'debts', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  addDebtPayment: async (data, userId) => {
    const debt = get().debts.find((d) => d.id === data.debt_id);
    if (!debt) throw new Error('Deuda no encontrada');

    const now = new Date();
    const paymentDate = data.payment_date || now.toISOString().split('T')[0];
    const dateObj = new Date(paymentDate);
    const year = data.year !== undefined ? data.year : dateObj.getFullYear();
    const month = data.month !== undefined ? data.month : dateObj.getMonth();
    const day = dateObj.getDate();
    const fortnight: FortnightType = data.fortnight || (day <= 15 ? 'q1' : 'q2');

    const paymentRecord: DebtPayment = {
      id: 'pay_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
      user_id: userId,
      debt_id: data.debt_id,
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
    const { sync_status: s2, ...debtPayload } = updatedDebt;

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from('debt_payments').upsert(payPayload),
          supabase.from('debts').upsert(debtPayload),
        ]);
      } catch {
        set((s) => ({
          syncQueue: [
            ...s.syncQueue,
            { id: paymentRecord.id, table: 'debt_payments', action: 'upsert', payload: payPayload, timestamp: new Date().toISOString() },
            { id: debt.id, table: 'debts', action: 'upsert', payload: debtPayload, timestamp: new Date().toISOString() },
          ],
        }));
      }
    }

    return paymentRecord;
  },

  saveSavingsGoal: async (goal, userId) => {
    const id = goal.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'save_' + Math.random().toString(36).substring(2, 9));
    const record: SavingsGoal = {
      id,
      user_id: userId,
      name: goal.name,
      target_amount: Number(goal.target_amount),
      current_amount: goal.current_amount !== undefined ? Number(goal.current_amount) : 0,
      frequency: goal.frequency,
      target_fortnight: goal.target_fortnight || 'q1',
      amount_per_period: Number(goal.amount_per_period),
      target_date: goal.target_date,
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

    const { sync_status, ...payload } = record;
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('savings_goals').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'savings_goals', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteSavingsGoal: async (id, userId) => {
    set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== id) }));
    await db.savings_goals.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('savings_goals').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'savings_goals', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  addSavingContribution: async (data, userId) => {
    const goal = get().savingsGoals.find((g) => g.id === data.goal_id);
    if (!goal) throw new Error('Meta no encontrada');

    const record: SavingContribution = {
      id: 'sc_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
      user_id: userId,
      goal_id: data.goal_id,
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

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from('saving_contributions').upsert(scPayload),
          supabase.from('savings_goals').upsert(goalPayload),
        ]);
      } catch {
        set((s) => ({
          syncQueue: [
            ...s.syncQueue,
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
    const stateId = `fis_expense_${params.expense.id}_${periodKey}`;
    const txId = `tx_fe_${params.expense.id}_${periodKey}`;

    const txRecord: Transaction = {
      id: txId,
      user_id: userId,
      amount: Number(params.amount),
      type: 'expense',
      description: `Pago Gasto Fijo: ${params.expense.name} (${params.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
      category_id: params.expense.category_id || 'cat_services',
      account_id: params.accountId || 'acc_cash',
      transaction_date: periodKey,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };

    const stateRecord: FortnightItemState = {
      id: stateId,
      user_id: userId,
      item_id: params.expense.id,
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
      transactions: [...s.transactions.filter((t) => t.id !== txId), txRecord],
      fortnightItemStates: [...s.fortnightItemStates.filter((st) => st.id !== stateId), stateRecord],
    }));

    await db.transactions.put(txRecord);
    await db.fortnight_item_states.put(stateRecord);

    const { sync_status: s1, ...txPayload } = txRecord;
    const { sync_status: s2, ...statePayload } = stateRecord;

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from('transactions').upsert(txPayload),
          supabase.from('fortnight_item_states').upsert(statePayload),
        ]);
      } catch {
        set((s) => ({
          syncQueue: [
            ...s.syncQueue,
            { id: txId, table: 'transactions', action: 'upsert', payload: txPayload, timestamp: new Date().toISOString() },
            { id: stateId, table: 'fortnight_item_states', action: 'upsert', payload: statePayload, timestamp: new Date().toISOString() },
          ],
        }));
      }
    }
  },

  unmarkFortnightExpensePaid: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const stateId = `fis_expense_${params.expenseId}_${periodKey}`;
    const txId = `tx_fe_${params.expenseId}_${periodKey}`;

    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== txId),
      fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== stateId),
    }));

    await db.transactions.delete(txId);
    await db.fortnight_item_states.delete(stateId);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from('transactions').delete().eq('id', txId),
          supabase.from('fortnight_item_states').delete().eq('id', stateId),
        ]);
      } catch {
        set((s) => ({
          syncQueue: [
            ...s.syncQueue,
            { id: txId, table: 'transactions', action: 'delete', payload: { id: txId, user_id: userId }, timestamp: new Date().toISOString() },
            { id: stateId, table: 'fortnight_item_states', action: 'delete', payload: { id: stateId, user_id: userId }, timestamp: new Date().toISOString() },
          ],
        }));
      }
    }
  },

  setFortnightExpenseSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const stateId = `fis_expense_${params.expenseId}_${periodKey}`;
    const txId = `tx_fe_${params.expenseId}_${periodKey}`;

    const stateRecord: FortnightItemState = {
      id: stateId,
      user_id: userId,
      item_id: params.expenseId,
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
      transactions: s.transactions.filter((t) => t.id !== txId),
      fortnightItemStates: [...s.fortnightItemStates.filter((st) => st.id !== stateId), stateRecord],
    }));

    await db.transactions.delete(txId);
    await db.fortnight_item_states.put(stateRecord);

    const { sync_status, ...payload } = stateRecord;
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from('transactions').delete().eq('id', txId),
          supabase.from('fortnight_item_states').upsert(payload),
        ]);
      } catch {
        set((s) => ({
          syncQueue: [
            ...s.syncQueue,
            { id: txId, table: 'transactions', action: 'delete', payload: { id: txId, user_id: userId }, timestamp: new Date().toISOString() },
            { id: stateId, table: 'fortnight_item_states', action: 'upsert', payload, timestamp: new Date().toISOString() },
          ],
        }));
      }
    }

    return;
  },

  unmarkFortnightExpenseSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const stateId = `fis_expense_${params.expenseId}_${periodKey}`;

    set((s) => ({ fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== stateId) }));
    await db.fortnight_item_states.delete(stateId);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fortnight_item_states').delete().eq('id', stateId);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id: stateId, table: 'fortnight_item_states', action: 'delete', payload: { id: stateId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  setFortnightDebtSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const stateId = `fis_debt_${params.debtId}_${periodKey}`;

    const stateRecord: FortnightItemState = {
      id: stateId,
      user_id: userId,
      item_id: params.debtId,
      item_type: 'debt',
      period_key: periodKey,
      year: params.year,
      month: params.month,
      fortnight: params.fortnight,
      status: 'skipped',
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    set((s) => ({ fortnightItemStates: [...s.fortnightItemStates.filter((st) => st.id !== stateId), stateRecord] }));
    await db.fortnight_item_states.put(stateRecord);

    const { sync_status, ...payload } = stateRecord;
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fortnight_item_states').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id: stateId, table: 'fortnight_item_states', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  unmarkFortnightDebtSkipped: async (params, userId) => {
    const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
    const stateId = `fis_debt_${params.debtId}_${periodKey}`;

    set((s) => ({ fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== stateId) }));
    await db.fortnight_item_states.delete(stateId);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('fortnight_item_states').delete().eq('id', stateId);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id: stateId, table: 'fortnight_item_states', action: 'delete', payload: { id: stateId, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },

  addTransaction: async (txData, userId) => {
    const id = 'tx_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
    const record: Transaction = {
      ...txData,
      id,
      user_id: userId,
      amount: Number(txData.amount),
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };

    set((s) => ({ transactions: [record, ...s.transactions] }));
    await db.transactions.put(record);

    const { sync_status, ...payload } = record;
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'transactions', action: 'upsert', payload, timestamp: new Date().toISOString() }],
        }));
      }
    }

    return record;
  },

  deleteTransaction: async (id, userId) => {
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
    await db.transactions.delete(id);

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'transactions', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
        }));
      }
    }
  },
}));
