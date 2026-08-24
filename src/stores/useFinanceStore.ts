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
  // 12 Supabase Entities
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
  userProfiles: UserProfile[];

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
  userProfiles: [],

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
   * Carga inicial completa de las 12 tablas desde Supabase
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

      // 2. Fetch en paralelo de todas las tablas
      const [
        resProfiles,
        resCategories,
        resAccounts,
        resIncomes,
        resFixedExpenses,
        resDebts,
        resDebtPayments,
        resSavingsGoals,
        resSavingContributions,
        resFortnightStates,
        resTransactions,
        resUserProfiles,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId),
        supabase.from('categories').select('*'),
        supabase.from('accounts').select('*').eq('user_id', userId),
        supabase.from('incomes').select('*').eq('user_id', userId),
        supabase.from('fixed_expenses').select('*').eq('user_id', userId),
        supabase.from('debts').select('*').eq('user_id', userId),
        supabase.from('debt_payments').select('*').eq('user_id', userId),
        supabase.from('savings_goals').select('*').eq('user_id', userId),
        supabase.from('saving_contributions').select('*').eq('user_id', userId),
        supabase.from('fortnight_item_states').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId),
        supabase.from('user_profiles').select('*'),
      ]);

      // Mapear profiles
      const profiles: UserProfile[] = resProfiles.data || [];
      const userProfiles: UserProfile[] = resUserProfiles.data || [];

      // Mapear categorías globales
      const categories: Category[] = resCategories.data && resCategories.data.length > 0 ? resCategories.data : DEFAULT_CATEGORIES;

      // Mapear cuentas
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

      // Mapear tabla 'incomes' (fijo vs variable)
      const rawIncomes = resIncomes.data || [];
      const fixedIncomes: FixedIncome[] = [];
      const variableIncomes: VariableIncome[] = [];

      rawIncomes.forEach((inc: any) => {
        const isFijo = inc.income_type === 'fijo' || inc.type === 'fijo';
        const q: FortnightType = inc.quincena === 15 ? 'q1' : 'q2';

        if (isFijo) {
          fixedIncomes.push({
            id: inc.id,
            user_id: inc.user_id || userId,
            name: inc.description || inc.name || 'Ingreso Fijo',
            amount: Number(inc.amount || 0),
            currency: inc.currency || 'USD',
            default_fortnight: q,
            category_id: inc.category_id || 'cat_salary',
            is_active: inc.is_active !== undefined ? inc.is_active : true,
            notes: inc.notes || '',
            sync_status: 'synced',
          });
        } else {
          const [yr, mo] = (inc.month_year || '').split('-').map(Number);
          const now = new Date();
          variableIncomes.push({
            id: inc.id,
            user_id: inc.user_id || userId,
            description: inc.description || 'Ingreso Variable',
            amount: Number(inc.amount || 0),
            year: !isNaN(yr) ? yr : now.getFullYear(),
            month: !isNaN(mo) ? mo - 1 : now.getMonth(),
            fortnight: q,
            category_id: inc.category_id || 'cat_extras',
            account_id: inc.account_id || 'acc_bank_usd',
            currency: inc.currency || 'USD',
            notes: inc.notes || '',
            sync_status: 'synced',
            created_at: inc.created_at || new Date().toISOString(),
            updated_at: inc.updated_at || new Date().toISOString(),
          });
        }
      });

      // Mapear gastos fijos
      const rawExpenses = resFixedExpenses.data || [];
      const fixedExpenses: FixedExpense[] = rawExpenses.map((exp: any) => ({
        id: exp.id,
        user_id: exp.user_id || userId,
        name: exp.name,
        amount: Number(exp.amount || 0),
        amount_usd: exp.amount_usd !== undefined ? Number(exp.amount_usd) : Number(exp.amount || 0),
        original_amount: exp.original_amount !== undefined ? Number(exp.original_amount) : Number(exp.amount || 0),
        amount_in_ves: exp.amount_in_ves !== undefined ? Number(exp.amount_in_ves) : undefined,
        currency: exp.currency || 'USD',
        payment_mode: exp.payment_mode || 'ves_bcv',
        default_fortnight: exp.default_quincena === 30 ? 'q2' : exp.default_fortnight || 'q1',
        category_id: exp.category_id || 'cat_services',
        is_active: exp.is_active !== undefined ? exp.is_active : true,
        assumed_by_third_party: exp.assumed_by_third_party || false,
        notes: exp.notes || '',
        sync_status: 'synced',
      }));

      // Mapear deudas
      const rawDebts = resDebts.data || [];
      const debts: Debt[] = rawDebts.map((d: any) => ({
        id: d.id,
        user_id: d.user_id || userId,
        creditor: d.creditor_name || d.creditor || 'Particular',
        platform: d.platform || 'particular',
        debt_mode: d.debt_mode || 'installments',
        total_amount: Number(d.original_amount ?? d.total_amount ?? 0),
        current_balance: Number(d.remaining_amount ?? d.current_balance ?? d.original_amount ?? 0),
        total_installments: d.total_installments,
        pending_installments: d.current_installment ? Math.max(0, (d.total_installments || 1) - d.current_installment) : d.pending_installments,
        installment_amount: d.installment_amount !== undefined ? Number(d.installment_amount) : undefined,
        fortnight_due: d.fortnight_due || 'q1',
        start_year: d.start_year,
        start_month: d.start_month,
        start_fortnight: d.start_fortnight,
        currency: d.currency_type || d.currency || 'USD',
        payment_type: d.payment_type || 'cash',
        has_interest: d.has_interest || (d.interest_rate && d.interest_rate > 0),
        interest_rate: d.interest_rate || 0,
        interest_amount: d.interest_amount || 0,
        interest_frequency: d.interest_frequency,
        interest_fortnight: d.interest_fortnight,
        due_date: d.due_date,
        status: d.status || 'active',
        priority: d.priority || 'medium',
        notes: d.notes || '',
        sync_status: 'synced',
        created_at: d.created_at || new Date().toISOString(),
        updated_at: d.updated_at || new Date().toISOString(),
      }));

      // Mapear abonos deudas
      const rawDebtPayments = resDebtPayments.data || [];
      const debtPayments: DebtPayment[] = rawDebtPayments.map((p: any) => {
        const dateObj = p.payment_date ? new Date(p.payment_date) : new Date();
        return {
          id: p.id,
          user_id: p.user_id || userId,
          debt_id: p.debt_id,
          amount: Number(p.amount_paid ?? p.amount ?? 0),
          payment_date: p.payment_date || dateObj.toISOString().split('T')[0],
          year: p.year !== undefined ? p.year : dateObj.getFullYear(),
          month: p.month !== undefined ? p.month : dateObj.getMonth(),
          fortnight: p.quincena === 30 ? 'q2' : p.fortnight || (dateObj.getDate() <= 15 ? 'q1' : 'q2'),
          rate_applied: p.rate_applied,
          parallel_rate: p.parallel_rate,
          loss_differential: p.loss_differential,
          notes: p.notes || '',
          sync_status: 'synced',
          created_at: p.created_at || new Date().toISOString(),
        };
      });

      // Mapear metas de ahorro
      const rawSavings = resSavingsGoals.data || [];
      const savingsGoals: SavingsGoal[] = rawSavings.map((s: any) => ({
        id: s.id,
        user_id: s.user_id || userId,
        name: s.title || s.name || 'Meta de Ahorro',
        target_amount: Number(s.target_amount || 0),
        current_amount: Number(s.current_saved ?? s.current_amount ?? 0),
        frequency: s.frequency || 'quincenal',
        target_fortnight: s.target_quincena === 30 ? 'q2' : s.target_fortnight || 'q1',
        amount_per_period: Number(s.amount_per_period || 0),
        target_date: s.target_date,
        icon: s.icon || 'PiggyBank',
        color: s.color || '#00C2C7',
        status: s.is_active === false ? 'completed' : s.status || 'active',
        notes: s.notes || '',
        sync_status: 'synced',
        created_at: s.created_at || new Date().toISOString(),
        updated_at: s.updated_at || new Date().toISOString(),
      }));

      // Mapear aportes de ahorro
      const rawContribs = resSavingContributions.data || [];
      const savingContributions: SavingContribution[] = rawContribs.map((c: any) => {
        const dateObj = c.period_date ? new Date(c.period_date) : new Date();
        return {
          id: c.id,
          user_id: c.user_id || userId,
          goal_id: c.goal_id,
          amount: Number(c.amount || 0),
          year: c.year !== undefined ? c.year : dateObj.getFullYear(),
          month: c.month !== undefined ? c.month : dateObj.getMonth(),
          fortnight: c.fortnight || (dateObj.getDate() <= 15 ? 'q1' : 'q2'),
          is_skipped: c.status === 'skipped' || c.is_skipped,
          contribution_date: c.period_date || dateObj.toISOString().split('T')[0],
          notes: c.notes || '',
          sync_status: 'synced',
          created_at: c.created_at || new Date().toISOString(),
        };
      });

      // Mapear estados de quincenas
      const rawStates = resFortnightStates.data || [];
      const fortnightItemStates: FortnightItemState[] = rawStates.map((st: any) => {
        const parts = (st.period_key || '').split('-');
        const yr = parseInt(parts[0], 10) || new Date().getFullYear();
        const mo = (parseInt(parts[1], 10) || 1) - 1;
        const day = parseInt(parts[2], 10) || 15;
        return {
          id: st.id,
          user_id: st.user_id || userId,
          item_id: st.item_id,
          item_type: st.item_type || 'fixed_expense',
          period_key: st.period_key,
          year: yr,
          month: mo,
          fortnight: day <= 15 ? 'q1' : 'q2',
          status: st.status || 'pending',
          amount: st.amount ? Number(st.amount) : undefined,
          updated_at: st.updated_at || new Date().toISOString(),
          sync_status: 'synced',
        };
      });

      // Mapear transacciones
      const rawTxs = resTransactions.data || [];
      const transactions: Transaction[] = rawTxs.map((t: any) => ({
        id: t.id,
        user_id: t.user_id || userId,
        amount: Number(t.amount || 0),
        type: t.type || 'expense',
        description: t.description || 'Movimiento',
        category_id: t.category_id || 'cat_services',
        account_id: t.account_id || 'acc_cash',
        transaction_date: t.transaction_date || new Date().toISOString().split('T')[0],
        sync_status: 'synced',
        created_at: t.created_at || new Date().toISOString(),
      }));

      // Sincronizar Dexie en segundo plano
      await Promise.all([
        db.accounts.where('user_id').equals(userId).delete().then(() => {
          if (accounts.length > 0) db.accounts.bulkPut(accounts);
        }),
        db.categories.bulkPut(categories),
        db.fixed_incomes.where('user_id').equals(userId).delete().then(() => {
          if (fixedIncomes.length > 0) db.fixed_incomes.bulkPut(fixedIncomes);
        }),
        db.variable_incomes.where('user_id').equals(userId).delete().then(() => {
          if (variableIncomes.length > 0) db.variable_incomes.bulkPut(variableIncomes);
        }),
        db.fixed_expenses.where('user_id').equals(userId).delete().then(() => {
          if (fixedExpenses.length > 0) db.fixed_expenses.bulkPut(fixedExpenses);
        }),
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
        userProfiles,
        categories,
        accounts: accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS,
        fixedIncomes,
        variableIncomes,
        fixedExpenses,
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
   * Manejador de eventos Realtime de Supabase (Merge por ID)
   */
  handleRealtimePayload: async (table: string, payload: any, userId: string) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    console.log(`[Realtime Merge on ${table} - ${eventType}]:`, newRow || oldRow);

    if (newRow?.user_id && newRow.user_id !== userId) return;

    switch (table) {
      case 'accounts': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ accounts: s.accounts.filter((a) => a.id !== oldRow.id) }));
          await db.accounts.delete(oldRow.id);
        } else if (newRow?.id) {
          const acc: Account = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            name: newRow.name,
            type: newRow.type || 'cash',
            currency: newRow.currency || 'USD',
            initial_balance: typeof newRow.initial_balance === 'number' ? newRow.initial_balance : typeof newRow.balance === 'number' ? newRow.balance : parseFloat(newRow.initial_balance || newRow.balance || 0) || 0,
            color: newRow.color,
            notes: newRow.notes || '',
            created_at: newRow.created_at,
            updated_at: newRow.updated_at,
            sync_status: 'synced',
          };
          set((s) => ({
            accounts: s.accounts.some((a) => a.id === acc.id)
              ? s.accounts.map((a) => (a.id === acc.id ? acc : a))
              : [...s.accounts, acc],
          }));
          await db.accounts.put(acc);
        }
        break;
      }
      case 'incomes': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({
            fixedIncomes: s.fixedIncomes.filter((i) => i.id !== oldRow.id),
            variableIncomes: s.variableIncomes.filter((v) => v.id !== oldRow.id),
          }));
          await db.fixed_incomes.delete(oldRow.id);
          await db.variable_incomes.delete(oldRow.id);
        } else if (newRow?.id) {
          const isFijo = newRow.income_type === 'fijo';
          const q: FortnightType = newRow.quincena === 15 ? 'q1' : 'q2';

          if (isFijo) {
            const fi: FixedIncome = {
              id: newRow.id,
              user_id: newRow.user_id || userId,
              name: newRow.description || 'Ingreso Fijo',
              amount: Number(newRow.amount || 0),
              currency: newRow.currency || 'USD',
              default_fortnight: q,
              category_id: newRow.category_id || 'cat_salary',
              is_active: newRow.is_active !== undefined ? newRow.is_active : true,
              notes: newRow.notes || '',
              sync_status: 'synced',
            };
            set((s) => ({
              fixedIncomes: s.fixedIncomes.some((i) => i.id === fi.id)
                ? s.fixedIncomes.map((i) => (i.id === fi.id ? fi : i))
                : [...s.fixedIncomes, fi],
            }));
            await db.fixed_incomes.put(fi);
          } else {
            const [yr, mo] = (newRow.month_year || '').split('-').map(Number);
            const now = new Date();
            const vi: VariableIncome = {
              id: newRow.id,
              user_id: newRow.user_id || userId,
              description: newRow.description || 'Ingreso Variable',
              amount: Number(newRow.amount || 0),
              year: !isNaN(yr) ? yr : now.getFullYear(),
              month: !isNaN(mo) ? mo - 1 : now.getMonth(),
              fortnight: q,
              category_id: newRow.category_id || 'cat_extras',
              account_id: newRow.account_id || 'acc_bank_usd',
              currency: newRow.currency || 'USD',
              notes: newRow.notes || '',
              sync_status: 'synced',
              created_at: newRow.created_at || new Date().toISOString(),
              updated_at: newRow.updated_at || new Date().toISOString(),
            };
            set((s) => ({
              variableIncomes: s.variableIncomes.some((v) => v.id === vi.id)
                ? s.variableIncomes.map((v) => (v.id === vi.id ? vi : v))
                : [...s.variableIncomes, vi],
            }));
            await db.variable_incomes.put(vi);
          }
        }
        break;
      }
      case 'fixed_expenses': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ fixedExpenses: s.fixedExpenses.filter((e) => e.id !== oldRow.id) }));
          await db.fixed_expenses.delete(oldRow.id);
        } else if (newRow?.id) {
          const exp: FixedExpense = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            name: newRow.name,
            amount: Number(newRow.amount || 0),
            currency: newRow.currency || 'USD',
            default_fortnight: newRow.default_quincena === 30 ? 'q2' : 'q1',
            category_id: newRow.category_id || 'cat_services',
            is_active: newRow.is_active !== undefined ? newRow.is_active : true,
            sync_status: 'synced',
          };
          set((s) => ({
            fixedExpenses: s.fixedExpenses.some((e) => e.id === exp.id)
              ? s.fixedExpenses.map((e) => (e.id === exp.id ? exp : e))
              : [...s.fixedExpenses, exp],
          }));
          await db.fixed_expenses.put(exp);
        }
        break;
      }
      case 'debts': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ debts: s.debts.filter((d) => d.id !== oldRow.id) }));
          await db.debts.delete(oldRow.id);
        } else if (newRow?.id) {
          const d: Debt = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            creditor: newRow.creditor_name || newRow.creditor || 'Particular',
            platform: newRow.platform || 'particular',
            debt_mode: 'installments',
            total_amount: Number(newRow.original_amount ?? newRow.total_amount ?? 0),
            current_balance: Number(newRow.remaining_amount ?? newRow.current_balance ?? 0),
            total_installments: newRow.total_installments,
            pending_installments: newRow.current_installment ? Math.max(0, (newRow.total_installments || 1) - newRow.current_installment) : newRow.pending_installments,
            currency: newRow.currency_type || newRow.currency || 'USD',
            payment_type: 'cash',
            interest_rate: newRow.interest_rate || 0,
            priority: newRow.priority || 'medium',
            status: newRow.status || 'active',
            sync_status: 'synced',
            created_at: newRow.created_at || new Date().toISOString(),
            updated_at: newRow.updated_at || new Date().toISOString(),
          };
          set((s) => ({
            debts: s.debts.some((item) => item.id === d.id)
              ? s.debts.map((item) => (item.id === d.id ? d : item))
              : [...s.debts, d],
          }));
          await db.debts.put(d);
        }
        break;
      }
      case 'debt_payments': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ debtPayments: s.debtPayments.filter((p) => p.id !== oldRow.id) }));
          await db.debt_payments.delete(oldRow.id);
        } else if (newRow?.id) {
          const dateObj = newRow.payment_date ? new Date(newRow.payment_date) : new Date();
          const p: DebtPayment = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            debt_id: newRow.debt_id,
            amount: Number(newRow.amount_paid ?? newRow.amount ?? 0),
            payment_date: newRow.payment_date || dateObj.toISOString().split('T')[0],
            year: dateObj.getFullYear(),
            month: dateObj.getMonth(),
            fortnight: newRow.quincena === 30 ? 'q2' : 'q1',
            notes: newRow.notes || '',
            sync_status: 'synced',
            created_at: newRow.created_at || new Date().toISOString(),
          };
          set((s) => ({
            debtPayments: s.debtPayments.some((item) => item.id === p.id)
              ? s.debtPayments.map((item) => (item.id === p.id ? p : item))
              : [...s.debtPayments, p],
          }));
          await db.debt_payments.put(p);
        }
        break;
      }
      case 'savings_goals': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== oldRow.id) }));
          await db.savings_goals.delete(oldRow.id);
        } else if (newRow?.id) {
          const g: SavingsGoal = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            name: newRow.title || newRow.name || 'Meta de Ahorro',
            target_amount: Number(newRow.target_amount || 0),
            current_amount: Number(newRow.current_saved ?? newRow.current_amount ?? 0),
            frequency: newRow.frequency || 'quincenal',
            target_fortnight: newRow.target_quincena === 30 ? 'q2' : 'q1',
            amount_per_period: Number(newRow.amount_per_period || 0),
            target_date: newRow.target_date,
            status: newRow.is_active === false ? 'completed' : 'active',
            sync_status: 'synced',
            created_at: newRow.created_at || new Date().toISOString(),
            updated_at: newRow.updated_at || new Date().toISOString(),
          };
          set((s) => ({
            savingsGoals: s.savingsGoals.some((item) => item.id === g.id)
              ? s.savingsGoals.map((item) => (item.id === g.id ? g : item))
              : [...s.savingsGoals, g],
          }));
          await db.savings_goals.put(g);
        }
        break;
      }
      case 'saving_contributions': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ savingContributions: s.savingContributions.filter((c) => c.id !== oldRow.id) }));
          await db.saving_contributions.delete(oldRow.id);
        } else if (newRow?.id) {
          const dateObj = newRow.period_date ? new Date(newRow.period_date) : new Date();
          const c: SavingContribution = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            goal_id: newRow.goal_id,
            amount: Number(newRow.amount || 0),
            year: dateObj.getFullYear(),
            month: dateObj.getMonth(),
            fortnight: dateObj.getDate() <= 15 ? 'q1' : 'q2',
            is_skipped: newRow.status === 'skipped',
            contribution_date: newRow.period_date || dateObj.toISOString().split('T')[0],
            notes: newRow.notes || '',
            sync_status: 'synced',
            created_at: newRow.created_at || new Date().toISOString(),
          };
          set((s) => ({
            savingContributions: s.savingContributions.some((item) => item.id === c.id)
              ? s.savingContributions.map((item) => (item.id === c.id ? c : item))
              : [...s.savingContributions, c],
          }));
          await db.saving_contributions.put(c);
        }
        break;
      }
      case 'fortnight_item_states': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ fortnightItemStates: s.fortnightItemStates.filter((st) => st.id !== oldRow.id) }));
          await db.fortnight_item_states.delete(oldRow.id);
        } else if (newRow?.id) {
          const parts = (newRow.period_key || '').split('-');
          const yr = parseInt(parts[0], 10) || new Date().getFullYear();
          const mo = (parseInt(parts[1], 10) || 1) - 1;
          const day = parseInt(parts[2], 10) || 15;
          const st: FortnightItemState = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            item_id: newRow.item_id,
            item_type: newRow.item_type || 'fixed_expense',
            period_key: newRow.period_key,
            year: yr,
            month: mo,
            fortnight: day <= 15 ? 'q1' : 'q2',
            status: newRow.status || 'pending',
            updated_at: newRow.updated_at || new Date().toISOString(),
            sync_status: 'synced',
          };
          set((s) => ({
            fortnightItemStates: s.fortnightItemStates.some((item) => item.id === st.id)
              ? s.fortnightItemStates.map((item) => (item.id === st.id ? st : item))
              : [...s.fortnightItemStates, st],
          }));
          await db.fortnight_item_states.put(st);
        }
        break;
      }
      case 'transactions': {
        if (eventType === 'DELETE' && oldRow?.id) {
          set((s) => ({ transactions: s.transactions.filter((t) => t.id !== oldRow.id) }));
          await db.transactions.delete(oldRow.id);
        } else if (newRow?.id) {
          const t: Transaction = {
            id: newRow.id,
            user_id: newRow.user_id || userId,
            amount: Number(newRow.amount || 0),
            type: newRow.type || 'expense',
            description: newRow.description || 'Movimiento',
            category_id: newRow.category_id || 'cat_services',
            account_id: newRow.account_id || 'acc_cash',
            transaction_date: newRow.transaction_date || new Date().toISOString().split('T')[0],
            sync_status: 'synced',
            created_at: newRow.created_at || new Date().toISOString(),
          };
          set((s) => ({
            transactions: s.transactions.some((item) => item.id === t.id)
              ? s.transactions.map((item) => (item.id === t.id ? t : item))
              : [...s.transactions, t],
          }));
          await db.transactions.put(t);
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

    const payload = {
      id,
      user_id: userId,
      name: record.name,
      type: record.type,
      currency: record.currency,
      initial_balance: record.initial_balance,
      updated_at: record.updated_at,
    };

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

    const payload = {
      id: accountId,
      user_id: userId,
      name: updated.name,
      type: updated.type,
      currency: updated.currency,
      initial_balance: updated.initial_balance,
      updated_at: updated.updated_at,
    };

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

    const payload = {
      id,
      user_id: userId,
      description: record.name,
      amount: record.amount,
      income_type: 'fijo',
      quincena: record.default_fortnight === 'q2' ? 30 : 15,
      month_year: new Date().toISOString().slice(0, 7),
      updated_at: new Date().toISOString(),
    };

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('incomes').upsert(payload);
        if (!error) await db.fixed_incomes.update(id, { sync_status: 'synced' });
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
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
        await supabase.from('incomes').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'incomes', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
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

    const payload = {
      id,
      user_id: userId,
      description: record.description,
      amount: record.amount,
      income_type: 'variable',
      quincena: record.fortnight === 'q2' ? 30 : 15,
      month_year: `${record.year}-${String(record.month + 1).padStart(2, '0')}`,
      updated_at: record.updated_at,
    };

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('incomes').upsert(payload);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'incomes', action: 'upsert', payload, timestamp: new Date().toISOString() }],
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
        await supabase.from('incomes').delete().eq('id', id);
      } catch {
        set((s) => ({
          syncQueue: [...s.syncQueue, { id, table: 'incomes', action: 'delete', payload: { id, user_id: userId }, timestamp: new Date().toISOString() }],
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
      currency: expense.currency || 'USD',
      default_fortnight: expense.default_fortnight,
      category_id: expense.category_id || 'cat_services',
      is_active: expense.is_active !== undefined ? expense.is_active : true,
      notes: expense.notes || '',
      sync_status: 'pending',
    };

    set((s) => ({
      fixedExpenses: s.fixedExpenses.some((e) => e.id === id)
        ? s.fixedExpenses.map((e) => (e.id === id ? record : e))
        : [...s.fixedExpenses, record],
    }));
    await db.fixed_expenses.put(record);

    const payload = {
      id,
      user_id: userId,
      name: record.name,
      amount: record.amount,
      currency: record.currency,
      default_quincena: record.default_fortnight === 'q2' ? 30 : 15,
      is_active: record.is_active,
      updated_at: new Date().toISOString(),
    };

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

    const record: Debt = {
      id,
      user_id: userId,
      creditor: debt.creditor,
      platform: debt.platform || 'particular',
      debt_mode: 'installments',
      total_amount: Number(debt.total_amount),
      current_balance,
      total_installments: debt.total_installments || 1,
      pending_installments: debt.pending_installments,
      currency: debt.currency || 'USD',
      payment_type: debt.payment_type,
      interest_rate: debt.interest_rate || 0,
      priority: debt.priority || 'medium',
      status,
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

    const payload = {
      id,
      user_id: userId,
      creditor_name: record.creditor,
      original_amount: record.total_amount,
      remaining_amount: record.current_balance,
      currency_type: record.currency,
      interest_rate: record.interest_rate,
      priority: record.priority,
      status: record.status,
      platform: record.platform,
      total_installments: record.total_installments,
      current_installment: record.total_installments && record.pending_installments ? Math.max(1, record.total_installments - record.pending_installments) : 1,
      updated_at: record.updated_at,
    };

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

    const payPayload = {
      id: paymentRecord.id,
      debt_id: paymentRecord.debt_id,
      user_id: userId,
      amount_paid: paymentRecord.amount,
      payment_date: paymentRecord.payment_date,
      quincena: paymentRecord.fortnight === 'q2' ? 30 : 15,
      notes: paymentRecord.notes,
      updated_at: new Date().toISOString(),
    };

    const debtPayload = {
      id: debt.id,
      user_id: userId,
      creditor_name: updatedDebt.creditor,
      original_amount: updatedDebt.total_amount,
      remaining_amount: updatedDebt.current_balance,
      status: updatedDebt.status,
      updated_at: updatedDebt.updated_at,
    };

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

    const payload = {
      id,
      user_id: userId,
      title: record.name,
      target_amount: record.target_amount,
      current_saved: record.current_amount,
      target_date: record.target_date || null,
      frequency: record.frequency,
      target_quincena: record.target_fortnight === 'q2' ? 30 : 15,
      amount_per_period: record.amount_per_period,
      is_active: record.status !== 'completed',
      updated_at: record.updated_at,
    };

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

    const scPayload = {
      id: record.id,
      goal_id: record.goal_id,
      user_id: userId,
      amount: record.amount,
      period_date: record.contribution_date,
      status: 'completed',
      notes: record.notes,
      updated_at: new Date().toISOString(),
    };

    const goalPayload = {
      id: goal.id,
      user_id: userId,
      title: updatedGoal.name,
      target_amount: updatedGoal.target_amount,
      current_saved: updatedGoal.current_amount,
      is_active: updatedGoal.status !== 'completed',
      updated_at: updatedGoal.updated_at,
    };

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

    const txPayload = {
      id: txId,
      user_id: userId,
      account_id: txRecord.account_id,
      category_id: txRecord.category_id,
      amount: txRecord.amount,
      type: txRecord.type,
      description: txRecord.description,
      transaction_date: txRecord.transaction_date,
      updated_at: new Date().toISOString(),
    };

    const statePayload = {
      id: stateId,
      user_id: userId,
      period_key: stateRecord.period_key,
      item_id: stateRecord.item_id,
      item_type: stateRecord.item_type,
      status: stateRecord.status,
      updated_at: stateRecord.updated_at,
    };

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

    const payload = {
      id: stateId,
      user_id: userId,
      period_key: stateRecord.period_key,
      item_id: stateRecord.item_id,
      item_type: stateRecord.item_type,
      status: stateRecord.status,
      updated_at: stateRecord.updated_at,
    };

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

    const payload = {
      id: stateId,
      user_id: userId,
      period_key: stateRecord.period_key,
      item_id: stateRecord.item_id,
      item_type: stateRecord.item_type,
      status: stateRecord.status,
      updated_at: stateRecord.updated_at,
    };

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

    const payload = {
      id,
      user_id: userId,
      account_id: record.account_id,
      category_id: record.category_id,
      amount: record.amount,
      type: record.type,
      description: record.description,
      transaction_date: record.transaction_date,
      updated_at: new Date().toISOString(),
    };

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
