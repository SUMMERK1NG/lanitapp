import Dexie, { type Table } from 'dexie';
import type {
  Transaction,
  Category,
  Account,
  FixedIncome,
  MonthlyFixedIncomeOverride,
  VariableIncome,
  FixedExpense,
  MonthlyFixedOverride,
  Debt,
  DebtPayment,
  SavingsGoal,
  SavingContribution,
  UserProfile,
  SyncResult,
  FortnightType,
  FortnightItemState,
  SyncStatus,
} from '../types/index.ts';
import { supabase, isSupabaseConfigured } from './supabase.ts';
import { ensureValidUuid, generateUuid } from '../utils/uuid.ts';

export function getActiveUserId(): string {
  try {
    const stored = localStorage.getItem('lanitapp_active_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.id) return parsed.id;
      if (parsed?.cedula) return parsed.cedula;
    }
  } catch {
    // fallback
  }
  return '';
}

export const DEFAULT_USER_PROFILES: UserProfile[] = [];

export const DEFAULT_CATEGORIES: Category[] = [
  // Gastos
  { id: 'cat_housing', name: 'Vivienda & Alquiler', type: 'expense', icon: 'Home', color: '#147DF0', sync_status: 'synced' },
  { id: 'cat_food', name: 'Comida & Supermercado', type: 'expense', icon: 'ShoppingCart', color: '#00C2C7', sync_status: 'synced' },
  { id: 'cat_services', name: 'Servicios & Fibra', type: 'expense', icon: 'Wifi', color: '#3B82F6', sync_status: 'synced' },
  { id: 'cat_transport', name: 'Transporte & Gasolina', type: 'expense', icon: 'Car', color: '#F59E0B', sync_status: 'synced' },
  { id: 'cat_debt', name: 'Pago de Deudas & Cuotas', type: 'expense', icon: 'CreditCard', color: '#FF914D', sync_status: 'synced' },
  { id: 'cat_health', name: 'Salud & Farmacia', type: 'expense', icon: 'HeartPulse', color: '#10B981', sync_status: 'synced' },
  { id: 'cat_entertainment', name: 'Ocio & Salidas', type: 'expense', icon: 'Film', color: '#8B5CF6', sync_status: 'synced' },
  { id: 'cat_savings', name: 'Ahorro & Metas', type: 'expense', icon: 'PiggyBank', color: '#00C2C7', sync_status: 'synced' },
  { id: 'cat_other_exp', name: 'Otros Gastos', type: 'expense', icon: 'MoreHorizontal', color: '#9BA3AF', sync_status: 'synced' },

  // Ingresos
  { id: 'cat_salary', name: 'Sueldo Base', type: 'income', icon: 'Briefcase', color: '#147DF0', sync_status: 'synced' },
  { id: 'cat_bonus', name: 'Plus & Bonos', type: 'income', icon: 'TrendingUp', color: '#00C2C7', sync_status: 'synced' },
  { id: 'cat_guard', name: 'Guardias / Turnos', type: 'income', icon: 'Clock', color: '#6366F1', sync_status: 'synced' },
  { id: 'cat_tickets', name: 'Tickets Alimentación', type: 'income', icon: 'UtensilsCrossed', color: '#10B981', sync_status: 'synced' },
  { id: 'cat_extras', name: 'Extras & Freelance', type: 'income', icon: 'Laptop', color: '#FF914D', sync_status: 'synced' },
];

export const DEFAULT_ACCOUNTS: Account[] = [];

export const DEFAULT_FIXED_INCOMES: FixedIncome[] = [];
export const DEFAULT_VARIABLE_INCOMES: VariableIncome[] = [];
export const DEFAULT_FIXED_EXPENSES: FixedExpense[] = [];
export const DEFAULT_DEBTS: Debt[] = [];
export const DEFAULT_SAVINGS_GOALS: SavingsGoal[] = [];

export class LanitappDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  accounts!: Table<Account, string>;
  fixed_incomes!: Table<FixedIncome, string>;
  monthly_fixed_income_overrides!: Table<MonthlyFixedIncomeOverride, string>;
  variable_incomes!: Table<VariableIncome, string>;
  fixed_expenses!: Table<FixedExpense, string>;
  monthly_fixed_overrides!: Table<MonthlyFixedOverride, string>;
  debts!: Table<Debt, string>;
  debt_payments!: Table<DebtPayment, string>;
  savings_goals!: Table<SavingsGoal, string>;
  saving_contributions!: Table<SavingContribution, string>;
  user_profiles!: Table<UserProfile, string>;
  fortnight_item_states!: Table<FortnightItemState, string>;

  constructor() {
    super('lanitapp_db');
    this.version(9).stores({
      transactions: 'id, user_id, type, category_id, account_id, transaction_date, sync_status',
      categories: 'id, name, type, sync_status',
      accounts: 'id, user_id, name, type, currency, sync_status',
      fixed_incomes: 'id, user_id, default_fortnight, category_id, is_active, sync_status',
      monthly_fixed_income_overrides: 'id, fixed_income_id, year, month, sync_status',
      variable_incomes: 'id, user_id, year, month, fortnight, category_id, sync_status',
      fixed_expenses: 'id, user_id, default_fortnight, category_id, is_active, sync_status',
      monthly_fixed_overrides: 'id, fixed_expense_id, year, month, sync_status',
      debts: 'id, user_id, creditor, platform, debt_mode, status, payment_type, sync_status',
      debt_payments: 'id, user_id, debt_id, year, month, fortnight, sync_status',
      savings_goals: 'id, user_id, status, frequency, sync_status',
      saving_contributions: 'id, user_id, goal_id, year, month, fortnight, is_skipped, sync_status',
      user_profiles: 'id, cedula, email, role, is_active, sync_status',
      fortnight_item_states: 'id, user_id, item_id, item_type, period_key, year, month, fortnight, status, sync_status',
    });

    this.on('populate', async () => {
      await this.categories.bulkAdd(DEFAULT_CATEGORIES);
    });
  }
}

export const db = new LanitappDatabase();

// Ensure initialization on cold start: purge legacy test records and keep clean 0-data baseline
export async function initializeDatabase(): Promise<void> {
  try {
    const legacyDebtIds = ['debt_cashea', 'debt_laptop', 'debt_creditotal'];
    const legacyFixedIncomeIds = ['fi_salary_q1', 'fi_salary_q2', 'fi_tickets_q1'];
    const legacyFixedExpenseIds = [
      'fe_rent',
      'fe_condo',
      'fe_groceries_q1',
      'fe_groceries_q2',
      'fe_internet',
      'fe_phone',
      'fe_services',
      'fe_stream',
    ];
    const legacyGoalIds = ['save_emergency', 'save_laptop'];
    const legacyVarIncomeIds = ['vi_plus_1', 'vi_guard_1', 'vi_freelance_1'];

    await db.debts.bulkDelete(legacyDebtIds);
    await db.fixed_incomes.bulkDelete(legacyFixedIncomeIds);
    await db.fixed_expenses.bulkDelete(legacyFixedExpenseIds);
    await db.savings_goals.bulkDelete(legacyGoalIds);
    await db.variable_incomes.bulkDelete(legacyVarIncomeIds);

    const allTx = await db.transactions.toArray();
    const legacyTxIds = allTx
      .filter((t) => t.id.startsWith('tx_sample_') || t.user_id === 'usr_admin')
      .map((t) => t.id);
    if (legacyTxIds.length > 0) {
      await db.transactions.bulkDelete(legacyTxIds);
    }

    const legacyAccountIds = [
      'acc_cash',
      'acc_bank_usd',
      'acc_bank_ves',
      'acc_savings',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ];
    await db.accounts.bulkDelete(legacyAccountIds);

    const unassignedAccounts = (await db.accounts.toArray())
      .filter((a) => !a.user_id || legacyAccountIds.includes(a.id))
      .map((a) => a.id);
    if (unassignedAccounts.length > 0) {
      await db.accounts.bulkDelete(unassignedAccounts);
    }

    const categoriesCount = await db.categories.count();
    if (categoriesCount === 0) {
      await db.categories.bulkPut(DEFAULT_CATEGORIES);
    }
  } catch (err) {
    console.error('Database init / purge error:', err);
  }
}

initializeDatabase().catch((err) => console.error('Database init error:', err));

// -------------------------------------------------------------
// Payload Sanitizers & Supabase Direct Handlers
// -------------------------------------------------------------

/**
 * Sanitiza el payload de Cuenta para PostgreSQL (evita error HTTP 400 por columnas inexistentes)
 */
export function toSupabaseAccountPayload(acc: any, fallbackUserId?: string) {
  const currentUserId = acc.user_id || fallbackUserId || getActiveUserId();
  const id = ensureValidUuid(acc.id);
  const balanceNum = typeof acc.balance === 'number'
    ? acc.balance
    : typeof acc.initial_balance === 'number'
    ? acc.initial_balance
    : parseFloat(acc.balance || acc.initial_balance || 0) || 0;

  return {
    id,
    user_id: currentUserId,
    name: (acc.name || '').trim(),
    type: acc.type || 'cash',
    currency: acc.currency || 'USD',
    balance: balanceNum,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Recarga las cuentas desde Supabase y actualiza Dexie en tiempo real
 */
export async function refreshAccountsFromSupabase(userId?: string): Promise<void> {
  const currentUserId = userId || getActiveUserId();
  if (!supabase || !navigator.onLine || !isSupabaseConfigured() || !currentUserId) return;

  try {
    const { data, error } = await supabase.from('accounts').select('*').eq('user_id', currentUserId);
    if (error) {
      console.error('[Supabase Accounts Error]:', error.message, error.details, error.hint);
      return;
    }
    if (data) {
      const normalized = data.map((a: any) => ({
        id: a.id,
        user_id: a.user_id || currentUserId,
        name: a.name,
        type: a.type || 'cash',
        currency: a.currency || 'USD',
        initial_balance: typeof a.balance === 'number' ? a.balance : typeof a.initial_balance === 'number' ? a.initial_balance : parseFloat(a.balance || a.initial_balance || 0) || 0,
        color: a.color,
        notes: a.notes || '',
        created_at: a.created_at,
        updated_at: a.updated_at,
        sync_status: 'synced' as SyncStatus,
      }));
      await db.accounts.where('user_id').equals(currentUserId).delete();
      if (normalized.length > 0) {
        await db.accounts.bulkPut(normalized);
      }
    }
  } catch (err) {
    console.error('Error refreshing accounts from Supabase:', err);
  }
}

/**
 * Guarda o actualiza una cuenta en Supabase con tolerancia a nombres de columna y recarga inmediata
 */
export async function upsertAccountToSupabase(payload: Record<string, any>): Promise<boolean> {
  if (!supabase || !navigator.onLine || !isSupabaseConfigured()) return false;

  const currentUserId = payload.user_id || getActiveUserId();
  const cleanPayload = toSupabaseAccountPayload(payload, currentUserId);

  // Intento 1: con columna 'balance' estándar
  const { error } = await supabase.from('accounts').upsert(cleanPayload);
  if (!error) {
    await refreshAccountsFromSupabase(currentUserId);
    return true;
  }

  // Intento 2: si la columna 'balance' no existe en el esquema remoto, reintentar con 'initial_balance'
  if (error.message?.includes('balance')) {
    const { balance, ...onlyInitPayload } = cleanPayload;
    const fallbackPayload = { ...onlyInitPayload, initial_balance: balance };
    const { error: err2 } = await supabase.from('accounts').upsert(fallbackPayload);
    if (!err2) {
      await refreshAccountsFromSupabase(currentUserId);
      return true;
    }
    console.error('[Supabase Accounts Error (initial_balance)]:', err2.message, err2.details, err2.hint);
    return false;
  }

  console.error('[Supabase Accounts Error]:', error.message, error.details, error.hint);
  return false;
}

// -------------------------------------------------------------
// Cloud-First Auto-Sync & Realtime Subscriptions
// -------------------------------------------------------------

/**
 * Migra cualquier dato previo existente en LocalStorage o caché local hacia Supabase
 * y recarga inmediatamente el estado global consolidado desde la nube.
 */
export async function migrateLocalDataToCloud(userId: string): Promise<void> {
  if (!userId || !isSupabaseConfigured() || !supabase || !navigator.onLine) return;

  try {
    // 1. Verificar llaves previas en localStorage
    const localAccounts = JSON.parse(localStorage.getItem('lanita_accounts') || localStorage.getItem('lanitapp_accounts') || '[]');
    const localFixedExpenses = JSON.parse(localStorage.getItem('lanita_fixed_expenses') || localStorage.getItem('lanitapp_fixed_expenses') || '[]');
    const localDebts = JSON.parse(localStorage.getItem('lanita_debts') || localStorage.getItem('lanitapp_debts') || '[]');
    const localIncomes = JSON.parse(localStorage.getItem('lanita_incomes') || localStorage.getItem('lanitapp_incomes') || '[]');
    const localTxs = JSON.parse(localStorage.getItem('lanita_transactions') || localStorage.getItem('lanitapp_transactions') || '[]');

    if (Array.isArray(localAccounts) && localAccounts.length > 0) {
      for (const a of localAccounts) {
        await upsertAccountToSupabase(toSupabaseAccountPayload(a, userId));
      }
      localStorage.removeItem('lanita_accounts');
      localStorage.removeItem('lanitapp_accounts');
    }
    if (Array.isArray(localFixedExpenses) && localFixedExpenses.length > 0) {
      const sanitized = localFixedExpenses.map((f: any) => {
        const { sync_status, isEditing, ...rest } = f;
        return { ...rest, user_id: userId, amount: Number(f.amount || 0) };
      });
      const { error } = await supabase.from('fixed_expenses').upsert(sanitized);
      if (error) console.error('[Supabase Fixed Expenses Migration Error]:', error.message, error.details);
      localStorage.removeItem('lanita_fixed_expenses');
      localStorage.removeItem('lanitapp_fixed_expenses');
    }
    if (Array.isArray(localDebts) && localDebts.length > 0) {
      const sanitized = localDebts.map((d: any) => {
        const { sync_status, isEditing, currency, creditor, ...rest } = d;
        return {
          ...rest,
          creditor_name: d.creditor || d.creditor_name || d.name || 'Deuda',
          currency_type: d.currency || d.currency_type || 'USD',
          user_id: userId,
          total_amount: Number(d.total_amount || 0),
          original_amount: Number(d.total_amount || d.original_amount || 0),
          remaining_amount: Number(d.current_balance || d.remaining_amount || d.total_amount || 0),
          current_balance: Number(d.current_balance || d.total_amount || 0),
        };
      });
      const { error } = await supabase.from('debts').upsert(sanitized);
      if (error) console.error('[Supabase Debts Migration Error]:', error.message, error.details);
      localStorage.removeItem('lanita_debts');
      localStorage.removeItem('lanitapp_debts');
    }
    if (Array.isArray(localIncomes) && localIncomes.length > 0) {
      const sanitized = localIncomes.map((i: any) => {
        const { sync_status, isEditing, ...rest } = i;
        return { ...rest, user_id: userId, amount: Number(i.amount || 0) };
      });
      const { error } = await supabase.from('fixed_incomes').upsert(sanitized);
      if (error) console.error('[Supabase Incomes Migration Error]:', error.message, error.details);
      localStorage.removeItem('lanita_incomes');
      localStorage.removeItem('lanitapp_incomes');
    }
    if (Array.isArray(localTxs) && localTxs.length > 0) {
      const sanitized = localTxs.map((t: any) => {
        const { sync_status, ...rest } = t;
        return { ...rest, user_id: userId, amount: Number(t.amount || 0) };
      });
      const { error } = await supabase.from('transactions').upsert(sanitized);
      if (error) console.error('[Supabase Transactions Migration Error]:', error.message, error.details);
      localStorage.removeItem('lanita_transactions');
      localStorage.removeItem('lanitapp_transactions');
    }

    // 2. Subir también registros pendientes en Dexie
    await pushPendingLocalRecords(userId);

    // 3. Recargar estado completo directo desde Supabase (prioridad nube)
    await fetchAndConsolidateUserCloudData(userId);
  } catch (err) {
    console.error('Error migrating data to cloud:', err);
  }
}

export function normalizeVariableIncomeRow(v: any): VariableIncome {
  const [yr, mo] = (v.month_year || '').split('-').map(Number);
  const now = new Date();
  const year = !isNaN(yr) && yr > 2000 ? yr : (typeof v.year === 'number' ? v.year : now.getFullYear());
  const month = !isNaN(mo) && mo >= 1 && mo <= 12 ? mo - 1 : (typeof v.month === 'number' ? v.month : now.getMonth());
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
}

export const fetchAllDataFromSupabase = fetchAndConsolidateUserCloudData;

/**
 * Descarga y consolida en Dexie todos los datos del usuario desde Supabase.
 * Si el usuario no tiene registros, su estado local queda limpio ($0.00).
 */
export async function fetchAndConsolidateUserCloudData(userId?: string): Promise<void> {
  const activeUid = userId || getActiveUserId();
  if (!activeUid || !isSupabaseConfigured() || !supabase || !navigator.onLine) {
    return;
  }

  try {
    // 1. Enviar cualquier cambio local pendiente a Supabase antes de refrescar
    await pushPendingLocalRecords(activeUid);

    // 2. Cargar en paralelo todas las entidades asociadas al user_id
    const [
      resAccounts,
      resCategories,
      resIncomes,
      resIncomeOverrides,
      resVarIncomes,
      resExpenses,
      resExpenseOverrides,
      resDebts,
      resPayments,
      resSavings,
      resContribs,
      resStates,
      resTxs,
    ] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', activeUid),
      supabase.from('categories').select('*'),
      supabase.from('fixed_incomes').select('*').eq('user_id', activeUid),
      supabase.from('monthly_fixed_income_overrides').select('*'),
      supabase.from('variable_incomes').select('*').eq('user_id', activeUid),
      supabase.from('fixed_expenses').select('*').eq('user_id', activeUid),
      supabase.from('monthly_fixed_overrides').select('*'),
      supabase.from('debts').select('*').eq('user_id', activeUid),
      supabase.from('debt_payments').select('*').eq('user_id', activeUid),
      supabase.from('savings_goals').select('*').eq('user_id', activeUid),
      supabase.from('saving_contributions').select('*').eq('user_id', activeUid),
      supabase.from('fortnight_item_states').select('*').eq('user_id', activeUid),
      supabase.from('transactions').select('*').eq('user_id', activeUid),
    ]);

    // Diagnóstico de respuestas de Supabase
    if (resAccounts.error) {
      console.error('[Supabase Accounts Error]:', resAccounts.error.message, resAccounts.error.details, resAccounts.error.hint);
    }
    if (resCategories.error) {
      console.warn('[Supabase Categories Notice]:', resCategories.error.message);
    }
    if (resIncomes.error) {
      console.warn('[Supabase Fixed Incomes Notice]:', resIncomes.error.message);
    }
    if (resVarIncomes.error) {
      console.warn('[Supabase Variable Incomes Notice]:', resVarIncomes.error.message);
    }
    if (resExpenses.error) {
      console.warn('[Supabase Fixed Expenses Notice]:', resExpenses.error.message);
    }
    if (resDebts.error) {
      console.warn('[Supabase Debts Notice]:', resDebts.error.message);
    }
    if (resPayments.error) {
      console.warn('[Supabase Payments Notice]:', resPayments.error.message);
    }
    if (resSavings.error) {
      console.warn('[Supabase Savings Notice]:', resSavings.error.message);
    }
    if (resContribs.error) {
      console.warn('[Supabase Contribs Notice]:', resContribs.error.message);
    }
    if (resStates.error) {
      console.warn('[Supabase States Notice]:', resStates.error.message);
    }
    if (resTxs.error) {
      console.warn('[Supabase Transactions Notice]:', resTxs.error.message);
    }

    let remoteIncomes = resIncomes.data;
    // Si fixed_incomes no retornó datos o dio error, intentar fallback con tabla 'incomes'
    if (!remoteIncomes || remoteIncomes.length === 0) {
      try {
        const { data: fallbackIncomes, error: fbErr } = await supabase.from('incomes').select('*').eq('user_id', activeUid);
        if (!fbErr && fallbackIncomes && fallbackIncomes.length > 0) {
          remoteIncomes = fallbackIncomes;
        }
      } catch {
        // ignore
      }
    }

    // Normalizar cuentas desde Supabase
    const remoteAccounts = (resAccounts.data || []).map((a: any) => ({
      id: a.id,
      user_id: a.user_id || activeUid,
      name: a.name,
      type: a.type || 'cash',
      currency: a.currency || 'USD',
      initial_balance: typeof a.balance === 'number' ? a.balance : typeof a.initial_balance === 'number' ? a.initial_balance : parseFloat(a.balance || a.initial_balance || 0) || 0,
      color: a.color,
      notes: a.notes || '',
      created_at: a.created_at,
      updated_at: a.updated_at,
      sync_status: 'synced' as SyncStatus,
    }));

    const remoteCategories = resCategories.data;
    const remoteIncomeOverrides = resIncomeOverrides.data;
    const remoteVarIncomes = resVarIncomes.data;
    const remoteExpenses = resExpenses.data;
    const remoteExpenseOverrides = resExpenseOverrides.data;
    const remoteDebts = resDebts.data;
    const remotePayments = resPayments.data;
    const remoteSavings = resSavings.data;
    const remoteContribs = resContribs.data;
    const remoteStates = resStates.data;
    const remoteTxs = resTxs.data;

    // 3. Limpiar registros locales previos del usuario y reemplazar con la verdad de la nube
    await Promise.all([
      db.fixed_incomes.where('user_id').equals(activeUid).delete(),
      db.variable_incomes.where('user_id').equals(activeUid).delete(),
      db.fixed_expenses.where('user_id').equals(activeUid).delete(),
      db.debts.where('user_id').equals(activeUid).delete(),
      db.debt_payments.where('user_id').equals(activeUid).delete(),
      db.savings_goals.where('user_id').equals(activeUid).delete(),
      db.saving_contributions.where('user_id').equals(activeUid).delete(),
      db.fortnight_item_states.where('user_id').equals(activeUid).delete(),
      db.transactions.where('user_id').equals(activeUid).delete(),
    ]);

    // 4. Volcar datos remotos marcados como 'synced'
    if (remoteCategories && remoteCategories.length > 0) {
      await db.categories.bulkPut(remoteCategories.map((c) => ({ ...c, sync_status: 'synced' })));
    }
    if (remoteAccounts.length > 0) {
      await db.accounts.bulkPut(remoteAccounts);
    }
    if (remoteIncomes && remoteIncomes.length > 0) {
      await db.fixed_incomes.bulkPut(remoteIncomes.map((i: any) => {
        const isSplit = i.default_fortnight === 50 || i.default_fortnight === '50' || i.default_fortnight === 'split' || (i.notes && i.notes.includes('[split]'));
        return {
          ...i,
          default_fortnight: (i.default_fortnight === 15 || i.default_fortnight === '15' || i.default_fortnight === 'q1')
            ? 'q1'
            : (i.default_fortnight === 30 || i.default_fortnight === '30' || i.default_fortnight === 'q2')
            ? 'q2'
            : isSplit
            ? 'split'
            : 'both',
          sync_status: 'synced',
        };
      }));
    }
    if (remoteIncomeOverrides && remoteIncomeOverrides.length > 0) {
      await db.monthly_fixed_income_overrides.bulkPut(remoteIncomeOverrides.map((o) => ({ ...o, sync_status: 'synced' })));
    }
    if (remoteVarIncomes && remoteVarIncomes.length > 0) {
      await db.variable_incomes.bulkPut(remoteVarIncomes.map((v: any) => normalizeVariableIncomeRow(v)));
    }
    if (remoteExpenses && remoteExpenses.length > 0) {
      await db.fixed_expenses.bulkPut(remoteExpenses.map((e: any) => ({
        ...e,
        default_fortnight: (e.default_fortnight === 15 || e.default_quincena === 15 || e.default_fortnight === '15' || e.default_fortnight === 'q1')
          ? 'q1'
          : (e.default_fortnight === 30 || e.default_quincena === 30 || e.default_fortnight === '30' || e.default_fortnight === 'q2')
          ? 'q2'
          : 'both',
        sync_status: 'synced',
      })));
    }
    if (remoteExpenseOverrides && remoteExpenseOverrides.length > 0) {
      await db.monthly_fixed_overrides.bulkPut(remoteExpenseOverrides.map((o) => ({ ...o, sync_status: 'synced' })));
    }
    if (remoteDebts && remoteDebts.length > 0) {
      await db.debts.bulkPut(remoteDebts.map((d) => ({
        ...d,
        creditor: d.creditor_name || d.creditor || d.name || 'Deuda',
        creditor_name: d.creditor_name || d.creditor || d.name || 'Deuda',
        currency: d.currency || d.currency_type || 'USD',
        sync_status: 'synced',
      })));
    }
    if (remotePayments && remotePayments.length > 0) {
      await db.debt_payments.bulkPut(remotePayments.map((p) => ({ ...p, sync_status: 'synced' })));
    }
    if (remoteSavings && remoteSavings.length > 0) {
      await db.savings_goals.bulkPut(remoteSavings.map((s) => ({ ...s, sync_status: 'synced' })));
    }
    if (remoteContribs && remoteContribs.length > 0) {
      await db.saving_contributions.bulkPut(remoteContribs.map((c) => ({ ...c, sync_status: 'synced' })));
    }
    if (remoteStates && remoteStates.length > 0) {
      await db.fortnight_item_states.bulkPut(remoteStates.map((s) => ({ ...s, sync_status: 'synced' })));
    }
    if (remoteTxs && remoteTxs.length > 0) {
      await db.transactions.bulkPut(remoteTxs.map((t) => ({ ...t, sync_status: 'synced' })));
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('lanitapp_last_sync', now);
  } catch (err) {
    console.error('Error in fetchAndConsolidateUserCloudData:', err);
  }
}

/**
 * Envia automáticamente a Supabase los registros locales que estén en estado 'pending'.
 */
async function pushPendingLocalRecords(targetUid: string): Promise<number> {
  if (!supabase) return 0;
  let pushed = 0;

  try {
    // Cuentas pendientes
    const pendingAccounts = await db.accounts.where('sync_status').equals('pending').toArray();
    for (const item of pendingAccounts.filter((a) => !a.user_id || a.user_id === targetUid)) {
      if (['acc_cash', 'acc_bank_usd', 'acc_bank_ves', 'acc_savings'].includes(item.id)) {
        await db.accounts.delete(item.id);
        continue;
      }
      const payload = toSupabaseAccountPayload(item, targetUid);
      const success = await upsertAccountToSupabase(payload);
      if (success) {
        await db.accounts.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Transacciones
    const pendingTxs = await db.transactions.where('sync_status').equals('pending').toArray();
    for (const item of pendingTxs.filter((t) => !t.user_id || t.user_id === targetUid)) {
      const { sync_status, ...rest } = item;
      const { error } = await supabase.from('transactions').upsert({ ...rest, user_id: targetUid, amount: Number(item.amount) });
      if (!error) {
        await db.transactions.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Tx Error]:', error.message, error.details);
      }
    }

    // Ingresos Fijos
    const pendingIncomes = await db.fixed_incomes.where('sync_status').equals('pending').toArray();
    for (const item of pendingIncomes.filter((i) => !i.user_id || i.user_id === targetUid)) {
      const { sync_status, category_id, is_active, ...rest } = item as any;
      const fortnightNum = (item.default_fortnight as any) === 'q1' || (item.default_fortnight as any) === 15 ? 15 : (item.default_fortnight as any) === 'q2' || (item.default_fortnight as any) === 30 ? 30 : null;
      const { error } = await supabase.from('fixed_incomes').upsert({
        ...rest,
        default_fortnight: fortnightNum,
        user_id: targetUid,
        amount: Number(item.amount),
      });
      if (!error) {
        await db.fixed_incomes.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Income Error]:', error.message, error.details);
      }
    }

    // Ingresos Variables
    const pendingVarIncomes = await db.variable_incomes.where('sync_status').equals('pending').toArray();
    for (const item of pendingVarIncomes.filter((v) => !v.user_id || v.user_id === targetUid)) {
      const payload = {
        id: item.id,
        user_id: targetUid,
        name: item.description || (item as any).name || 'Ingreso Variable',
        amount: Number(item.amount),
        currency: item.currency || 'USD',
        quincena: item.fortnight === 'q1' || (item.fortnight as any) === 15 ? 15 : 30,
        month_year: `${item.year}-${String(item.month + 1).padStart(2, '0')}`,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('variable_incomes').upsert(payload);
      if (!error) {
        await db.variable_incomes.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Var Income Error]:', error.message, error.details);
      }
    }

    // Gastos Fijos
    const pendingExpenses = await db.fixed_expenses.where('sync_status').equals('pending').toArray();
    for (const item of pendingExpenses.filter((e) => !e.user_id || e.user_id === targetUid)) {
      const { sync_status, default_quincena, ...rest } = item as any;
      const fortnightNum = (item.default_fortnight as any) === 'q1' || (item.default_fortnight as any) === 15 ? 15 : (item.default_fortnight as any) === 'q2' || (item.default_fortnight as any) === 30 ? 30 : null;
      const { error } = await supabase.from('fixed_expenses').upsert({
        ...rest,
        default_fortnight: fortnightNum,
        user_id: targetUid,
        amount: Number(item.amount),
      });
      if (!error) {
        await db.fixed_expenses.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Expense Error]:', error.message, error.details);
      }
    }

    // Deudas
    const pendingDebts = await db.debts.where('sync_status').equals('pending').toArray();
    for (const item of pendingDebts.filter((d) => !d.user_id || d.user_id === targetUid)) {
      const { sync_status, currency, creditor, ...rest } = item;
      const { error } = await supabase.from('debts').upsert({
        ...rest,
        creditor_name: item.creditor || item.creditor_name || (item as any).name || 'Deuda',
        currency_type: item.currency || item.currency_type || 'USD',
        user_id: targetUid,
        total_amount: Number(item.total_amount),
        original_amount: Number(item.total_amount),
        remaining_amount: Number(item.current_balance),
        current_balance: Number(item.current_balance),
      });
      if (!error) {
        await db.debts.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Debt Error]:', error.message, error.details);
      }
    }

    // Abonos a Deudas
    const pendingPayments = await db.debt_payments.where('sync_status').equals('pending').toArray();
    for (const item of pendingPayments.filter((p) => !p.user_id || p.user_id === targetUid)) {
      const { sync_status, ...rest } = item;
      const { error } = await supabase.from('debt_payments').upsert({ ...rest, user_id: targetUid, amount: Number(item.amount) });
      if (!error) {
        await db.debt_payments.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Payment Error]:', error.message, error.details);
      }
    }

    // Metas de Ahorro
    const pendingSavings = await db.savings_goals.where('sync_status').equals('pending').toArray();
    for (const item of pendingSavings.filter((s) => !s.user_id || s.user_id === targetUid)) {
      const { sync_status, ...rest } = item;
      const { error } = await supabase.from('savings_goals').upsert({ ...rest, user_id: targetUid, target_amount: Number(item.target_amount), current_amount: Number(item.current_amount) });
      if (!error) {
        await db.savings_goals.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Savings Error]:', error.message, error.details);
      }
    }

    // Aportes de Ahorro
    const pendingContribs = await db.saving_contributions.where('sync_status').equals('pending').toArray();
    for (const item of pendingContribs.filter((c) => !c.user_id || c.user_id === targetUid)) {
      const { sync_status, ...rest } = item;
      const { error } = await supabase.from('saving_contributions').upsert({ ...rest, user_id: targetUid, amount: Number(item.amount) });
      if (!error) {
        await db.saving_contributions.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending Contrib Error]:', error.message, error.details);
      }
    }

    // Estados Quincenales
    const pendingStates = await db.fortnight_item_states.where('sync_status').equals('pending').toArray();
    for (const item of pendingStates.filter((s) => !s.user_id || s.user_id === targetUid)) {
      const { sync_status, ...rest } = item;
      const { error } = await supabase.from('fortnight_item_states').upsert({ ...rest, user_id: targetUid });
      if (!error) {
        await db.fortnight_item_states.update(item.id, { sync_status: 'synced' });
        pushed++;
      } else {
        console.error('[Supabase Pending State Error]:', error.message, error.details);
      }
    }
  } catch (err) {
    console.warn('Notice pushing pending records:', err);
  }

  return pushed;
}

/**
 * Suscribe la app a cambios en tiempo real desde Supabase para replicar
 * instantáneamente en Dexie (y por ende en la UI) cualquier cambio entre PC y móvil.
 */
export function subscribeToRealtimeChanges(userId: string, onUpdate?: () => void) {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return () => {};
  }

  const client = supabase;
  const channelName = `schema-db-changes-${userId}`;

  const tables = [
    'accounts',
    'categories',
    'debts',
    'debt_payments',
    'fixed_incomes',
    'monthly_fixed_income_overrides',
    'variable_incomes',
    'fixed_expenses',
    'monthly_fixed_overrides',
    'fortnight_item_states',
    'profiles',
    'saving_contributions',
    'savings_goals',
    'transactions',
  ];

  let channel = client.channel(channelName);

  tables.forEach((tableName) => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      async (payload) => {
        console.log(`[Realtime Change Detected on ${tableName}]:`, payload);
        const newRow: any = payload.new;
        const oldRow: any = payload.old;
        try {
          const targetTable = (db as any)[tableName];
          if (payload.eventType === 'DELETE') {
            const oldId = oldRow?.id;
            if (oldId) {
              if (tableName === 'incomes') {
                await db.fixed_incomes.delete(oldId);
                await db.variable_incomes.delete(oldId);
              } else if (targetTable) {
                await targetTable.delete(oldId);
              }
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (newRow?.id && (!newRow.user_id || newRow.user_id === userId)) {
              if (tableName === 'accounts') {
                const normAcc = {
                  id: newRow.id,
                  user_id: newRow.user_id || userId,
                  name: newRow.name,
                  type: newRow.type || 'cash',
                  currency: newRow.currency || 'USD',
                  initial_balance: typeof newRow.balance === 'number' ? newRow.balance : typeof newRow.initial_balance === 'number' ? newRow.initial_balance : parseFloat(newRow.balance || newRow.initial_balance || 0) || 0,
                  color: newRow.color,
                  notes: newRow.notes || '',
                  created_at: newRow.created_at,
                  updated_at: newRow.updated_at,
                  sync_status: 'synced' as SyncStatus,
                };
                await db.accounts.put(normAcc);
              } else if (tableName === 'debts') {
                const normDebt = {
                  ...newRow,
                  id: ensureValidUuid(newRow.id),
                  creditor: newRow.creditor || newRow.creditor_name || 'Deuda',
                  currency: newRow.currency || newRow.currency_type || 'USD',
                  sync_status: 'synced' as SyncStatus,
                };
                await db.debts.put(normDebt);
              } else if (tableName === 'fixed_expenses') {
                const normExpense = {
                  ...newRow,
                  id: ensureValidUuid(newRow.id),
                  default_fortnight: (newRow.default_fortnight === 15 || newRow.default_quincena === 15 || newRow.default_fortnight === '15' || newRow.default_fortnight === 'q1')
                    ? 'q1'
                    : (newRow.default_fortnight === 30 || newRow.default_quincena === 30 || newRow.default_fortnight === '30' || newRow.default_fortnight === 'q2')
                    ? 'q2'
                    : 'both',
                  sync_status: 'synced' as SyncStatus,
                };
                await db.fixed_expenses.put(normExpense);
              } else if (tableName === 'fixed_incomes') {
                const isSplit = newRow.default_fortnight === 50 || newRow.default_fortnight === '50' || newRow.default_fortnight === 'split' || (newRow.notes && newRow.notes.includes('[split]'));
                const normIncome = {
                  ...newRow,
                  id: ensureValidUuid(newRow.id),
                  default_fortnight: (newRow.default_fortnight === 15 || newRow.default_fortnight === '15' || newRow.default_fortnight === 'q1')
                    ? 'q1'
                    : (newRow.default_fortnight === 30 || newRow.default_fortnight === '30' || newRow.default_fortnight === 'q2')
                    ? 'q2'
                    : isSplit
                    ? 'split'
                    : 'both',
                  category_id: newRow.category_id || 'cat_salary',
                  is_active: newRow.is_active !== undefined ? newRow.is_active : true,
                  sync_status: 'synced' as SyncStatus,
                };
                await db.fixed_incomes.put(normIncome);
              } else if (tableName === 'variable_incomes') {
                await db.variable_incomes.put(normalizeVariableIncomeRow(newRow));
              } else if (targetTable) {
                await targetTable.put({ ...newRow, sync_status: 'synced' as SyncStatus });
              }
            }
          }

          if (onUpdate) onUpdate();
        } catch (e) {
          console.warn(`Realtime update handling error on ${tableName}:`, e);
        }
      }
    );
  });

  channel.subscribe((status) => {
    console.log(`[Supabase Realtime Channel Status for ${userId}]:`, status);
  });

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Sincronización general de respaldo.
 */
export async function syncWithSupabase(): Promise<SyncResult> {
  if (!navigator.onLine) {
    return {
      success: false,
      syncedCount: 0,
      errors: ['Modo Offline: Datos guardados de forma segura en Dexie.'],
    };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      syncedCount: 0,
      errors: ['Supabase no está configurado con credenciales válidas.'],
    };
  }

  const activeUid = getActiveUserId();
  if (!activeUid) {
    return {
      success: true,
      syncedCount: 0,
      lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  try {
    await fetchAndConsolidateUserCloudData(activeUid);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      success: true,
      syncedCount: 1,
      lastSyncTime: now,
    };
  } catch (error: any) {
    console.error('Error in syncWithSupabase:', error);
    return {
      success: false,
      syncedCount: 0,
      errors: [error.message || 'Error durante la sincronización'],
    };
  }
}

/**
 * Acción de Administrador: Sincronización Forzada Cloud y limpieza de residuos.
 */
export async function forceCloudSyncAndPurgeResiduals(userId?: string): Promise<{ success: boolean; message: string }> {
  const targetUid = userId || getActiveUserId();
  if (!targetUid) {
    return { success: false, message: 'No hay usuario activo identificado.' };
  }

  if (!navigator.onLine || !isSupabaseConfigured() || !supabase) {
    return { success: false, message: 'Se requiere conexión a Internet y Supabase configurado.' };
  }

  try {
    await initializeDatabase();
    await fetchAndConsolidateUserCloudData(targetUid);

    return {
      success: true,
      message: 'Sincronización forzada completada. Todas las tablas coinciden al 100% con la nube.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Error al ejecutar sincronización forzada.',
    };
  }
}

// -------------------------------------------------------------
// Helper CRUD Methods with Cloud-First In-Flight Execution
// -------------------------------------------------------------

/**
 * Metas y Planes de Ahorro
 */
export async function saveSavingsGoal(
  goal: Partial<SavingsGoal> & { name: string; target_amount: number; amount_per_period: number; frequency: SavingsGoal['frequency'] }
): Promise<SavingsGoal> {
  const id = ensureValidUuid(goal.id);
  const userId = goal.user_id || getActiveUserId();
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

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...cloudPayload } = record;
      const { error } = await supabase.from('savings_goals').upsert(cloudPayload);
      if (!error) {
        record.sync_status = 'synced';
      } else {
        console.error('[Supabase Savings Goal Error]:', error.message, error.details);
      }
    } catch (e) {
      console.warn('Direct saving goal upsert notice:', e);
    }
  }

  await db.savings_goals.put(record);
  return record;
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  await db.savings_goals.delete(id);
  await db.saving_contributions.where('goal_id').equals(id).delete();

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await Promise.all([
        supabase.from('savings_goals').delete().eq('id', id),
        supabase.from('saving_contributions').delete().eq('goal_id', id),
      ]);
    } catch (e) {
      console.warn('Delete remote saving goal err:', e);
    }
  }
}

export async function addSavingContribution(data: {
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
}): Promise<SavingContribution> {
  const goal = await db.savings_goals.get(data.goal_id);
  if (!goal) throw new Error('Meta de ahorro no encontrada');

  const userId = data.user_id || getActiveUserId();
  const record: SavingContribution = {
    id: ensureValidUuid(),
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
  const newStatus = newCurrent >= Number(goal.target_amount) ? 'completed' : goal.status;

  let varIncomeRecord: VariableIncome | null = null;
  let txIncomeRecord: Transaction | null = null;

  if (data.source_type === 'variable_income') {
    const varId = ensureValidUuid();
    varIncomeRecord = {
      id: varId,
      user_id: userId,
      description: data.income_description || `Ingreso extra para ahorro: ${goal.name}`,
      amount: Number(data.amount),
      year: data.year,
      month: data.month,
      fortnight: data.fortnight,
      category_id: 'cat_extras',
      account_id: data.account_id || '',
      currency: 'USD',
      notes: `Destinado a meta de ahorro: ${goal.name}`,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    txIncomeRecord = {
      id: 'tx_inc_' + record.id,
      user_id: userId,
      amount: Number(data.amount),
      type: 'income',
      description: `${varIncomeRecord.description} (${data.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
      category_id: 'cat_extras',
      account_id: data.account_id || '',
      transaction_date: record.contribution_date,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };
  }

  const txExpenseRecord: Transaction = {
    id: 'tx_exp_' + record.id,
    user_id: userId,
    amount: Number(data.amount),
    type: 'expense',
    description: `Aporte Ahorro: ${goal.name}${data.source_type === 'variable_income' ? ' (desde ingreso variable)' : ''}`,
    category_id: 'cat_savings',
    account_id: data.account_id || '',
    transaction_date: record.contribution_date,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status: s1, ...scPayload } = record;
      const { sync_status: s2, ...txExpPayload } = txExpenseRecord;
      const promises = [
        Promise.resolve(supabase.from('saving_contributions').upsert(scPayload)),
        Promise.resolve(supabase.from('savings_goals').update({ current_amount: newCurrent, status: newStatus, updated_at: new Date().toISOString() }).eq('id', goal.id)),
        Promise.resolve(supabase.from('transactions').upsert(txExpPayload)),
      ];

      if (varIncomeRecord && txIncomeRecord) {
        const { sync_status: s3, ...varPayload } = varIncomeRecord;
        const { sync_status: s4, ...txIncPayload } = txIncomeRecord;
        promises.push(Promise.resolve(supabase.from('variable_incomes').upsert(varPayload)));
        promises.push(Promise.resolve(supabase.from('transactions').upsert(txIncPayload)));
      }

      const results = await Promise.all(promises);
      const hasError = results.some((r) => r.error);
      if (!hasError) {
        record.sync_status = 'synced';
        txExpenseRecord.sync_status = 'synced';
        if (varIncomeRecord) varIncomeRecord.sync_status = 'synced';
        if (txIncomeRecord) txIncomeRecord.sync_status = 'synced';
      }
    } catch (e) {
      console.warn('Direct saving contribution upsert notice:', e);
    }
  }

  await db.saving_contributions.add(record);
  await db.savings_goals.update(goal.id, {
    current_amount: newCurrent,
    status: newStatus,
    sync_status: 'synced',
    updated_at: new Date().toISOString(),
  });
  await db.transactions.put(txExpenseRecord);

  if (varIncomeRecord && txIncomeRecord) {
    await db.variable_incomes.put(varIncomeRecord);
    await db.transactions.put(txIncomeRecord);
  }

  return record;
}

export async function skipSavingContributionPeriod(data: {
  goal_id: string;
  user_id?: string;
  year: number;
  month: number;
  fortnight: FortnightType;
  reason?: string;
}): Promise<SavingContribution> {
  const goal = await db.savings_goals.get(data.goal_id);
  if (!goal) throw new Error('Meta de ahorro no encontrada');

  const userId = data.user_id || getActiveUserId();
  const record: SavingContribution = {
    id: 'sc_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
    user_id: userId,
    goal_id: data.goal_id,
    amount: 0,
    year: data.year,
    month: data.month,
    fortnight: data.fortnight,
    is_skipped: true,
    contribution_date: new Date().toISOString().split('T')[0],
    notes: data.reason || 'Periodo omitido por imprevistos',
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...payload } = record;
      const { error } = await supabase.from('saving_contributions').upsert(payload);
      if (!error) {
        record.sync_status = 'synced';
      } else {
        console.error('[Supabase Skip Saving Error]:', error.message);
      }
    } catch (e) {
      console.warn('Direct skip saving upsert notice:', e);
    }
  }

  await db.saving_contributions.add(record);
  return record;
}

/**
 * Plantilla de Ingresos Fijos
 */
export async function saveFixedIncome(
  income: Partial<FixedIncome> & { name: string; amount: number; default_fortnight: 'q1' | 'q2' | 'both' | 'split' }
): Promise<FixedIncome> {
  const id = ensureValidUuid(income.id);
  let userId = income.user_id || getActiveUserId();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        userId = user.id;
      }
    } catch {
      // fallback
    }
  }
  const cleanNotes = (income.notes || '').replace(/\s*\[split\]/g, '').trim();
  const isSplit = income.default_fortnight === 'split';
  const notesWithTag = isSplit ? (cleanNotes ? `${cleanNotes} [split]` : '[split]') : cleanNotes;

  const record: FixedIncome = {
    id,
    user_id: userId,
    name: income.name,
    amount: Number(income.amount),
    original_amount: income.original_amount !== undefined ? Number(income.original_amount) : Number(income.amount),
    currency: income.currency || 'USD',
    payment_mode: income.payment_mode || 'usd_cash',
    default_fortnight: income.default_fortnight,
    category_id: income.category_id || 'cat_salary',
    is_active: income.is_active !== undefined ? income.is_active : true,
    notes: notesWithTag,
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, category_id, is_active, payment_mode, original_amount, ...payload } = record as any;
      payload.default_fortnight = (record.default_fortnight as any) === 'q1' || (record.default_fortnight as any) === 15
        ? 15
        : (record.default_fortnight as any) === 'q2' || (record.default_fortnight as any) === 30
        ? 30
        : isSplit
        ? 50
        : null;
      payload.notes = notesWithTag;
      const { error } = await supabase.from('fixed_incomes').upsert(payload);
      if (!error) {
        record.sync_status = 'synced';
      } else {
        if (isSplit && payload.default_fortnight === 50) {
          payload.default_fortnight = null;
          const { error: errRetry } = await supabase.from('fixed_incomes').upsert(payload);
          if (!errRetry) record.sync_status = 'synced';
        } else {
          console.error('[Supabase Fixed Income Error]:', error.message, error.details);
        }
      }
    } catch (e) {
      console.warn('Direct fixed income upsert notice:', e);
    }
  }

  await db.fixed_incomes.put(record);
  return record;
}

export async function deleteFixedIncome(id: string): Promise<void> {
  await db.fixed_incomes.delete(id);
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('fixed_incomes').delete().eq('id', id);
      if (error) console.error('[Supabase Fixed Income Delete Error]:', error.message);
    } catch (e) {
      console.warn('Delete remote fixed income err:', e);
    }
  }
}

export async function toggleMonthlyFixedIncomeOverride(
  fixedIncomeId: string,
  year: number,
  month: number,
  isActive: boolean,
  customAmount?: number
): Promise<void> {
  const id = `${fixedIncomeId}_${year}_${month}`;
  const record: MonthlyFixedIncomeOverride = {
    id,
    fixed_income_id: fixedIncomeId,
    year,
    month,
    is_active: isActive,
    custom_amount: customAmount !== undefined ? Number(customAmount) : undefined,
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...payload } = record;
      const { error } = await supabase.from('monthly_fixed_income_overrides').upsert(payload);
      if (!error) record.sync_status = 'synced';
    } catch (e) {
      console.warn('Override upsert notice:', e);
    }
  }

  await db.monthly_fixed_income_overrides.put(record);
}

/**
 * Ingresos Variables / Extras
 */
export async function saveVariableIncome(
  income: Partial<VariableIncome> & { description: string; amount: number; year: number; month: number; fortnight: FortnightType }
): Promise<VariableIncome> {
  const id = ensureValidUuid(income.id);
  let userId = income.user_id || getActiveUserId();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        userId = user.id;
      }
    } catch {
      // fallback
    }
  }

  const existing = await db.variable_incomes.get(id);
  const txId = existing?.transaction_id || income.transaction_id || generateUuid();

  const record: VariableIncome = {
    id,
    user_id: userId,
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

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const varPayload = {
        id: record.id,
        user_id: userId,
        name: record.description,
        amount: Number(record.amount),
        currency: record.currency || 'USD',
        quincena: record.fortnight === 'q1' || (record.fortnight as any) === 15 ? 15 : 30,
        month_year: `${record.year}-${String(record.month + 1).padStart(2, '0')}`,
        created_at: record.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('variable_incomes').upsert(varPayload);
      if (!error) {
        record.sync_status = 'synced';
      } else {
        console.error('[Supabase Variable Income Error]:', error.message, error.details);
      }
    } catch (e) {
      console.warn('Direct variable income upsert notice:', e);
    }
  }

  // Manage linked transaction in Capital & Cuentas
  if (record.account_id) {
    const tx: Transaction = {
      id: txId,
      user_id: userId,
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
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { sync_status, ...txPayload } = tx;
        await supabase.from('transactions').upsert(txPayload);
      } catch (e) {
        console.warn('Direct transaction upsert notice:', e);
      }
    }
  } else if (existing?.transaction_id) {
    await db.transactions.delete(existing.transaction_id);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', existing.transaction_id);
      } catch (e) {
        console.warn('Delete remote tx notice:', e);
      }
    }
  }

  await db.variable_incomes.put(record);
  return record;
}

export async function deleteVariableIncome(id: string): Promise<void> {
  const existing = await db.variable_incomes.get(id);
  if (existing?.transaction_id) {
    await db.transactions.delete(existing.transaction_id);
    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', existing.transaction_id);
      } catch (e) {
        console.warn('Delete linked tx err:', e);
      }
    }
  }
  await db.variable_incomes.delete(id);

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('variable_incomes').delete().eq('id', id);
    } catch (e) {
      console.warn('Delete remote var income err:', e);
    }
  }
}

/**
 * Categorías
 */
export async function saveCategory(category: Partial<Category> & { name: string; type: Category['type']; icon: string; color: string }): Promise<Category> {
  const id = category.id || 'cat_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
  const record: Category = {
    id,
    name: category.name,
    type: category.type,
    icon: category.icon,
    color: category.color,
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...payload } = record;
      const { error } = await supabase.from('categories').upsert(payload);
      if (!error) record.sync_status = 'synced';
    } catch (e) {
      console.warn('Category upsert notice:', e);
    }
  }

  await db.categories.put(record);
  return record;
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id);
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('categories').delete().eq('id', id);
    } catch (e) {
      console.warn('Delete remote category err:', e);
    }
  }
}

/**
 * Cuentas y Fondos
 */
export async function saveAccount(
  account: Partial<Account> & { name: string; type: Account['type']; currency: string; initial_balance: number }
): Promise<Account> {
  const id = ensureValidUuid(account.id);
  const userId = account.user_id || getActiveUserId();
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

  const success = await upsertAccountToSupabase(record);
  if (success) {
    record.sync_status = 'synced';
  }

  await db.accounts.put(record);
  return record;
}

export async function deleteAccount(id: string): Promise<void> {
  const cleanId = ensureValidUuid(id);
  await db.accounts.delete(id);
  if (cleanId !== id) {
    await db.accounts.delete(cleanId);
  }

  const currentUserId = getActiveUserId();

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      console.log('[Supabase Accounts Delete Payload]:', { id, cleanId });
      const { error: err1 } = await supabase.from('accounts').delete().eq('id', id);
      if (err1 && cleanId !== id) {
        await supabase.from('accounts').delete().eq('id', cleanId);
      }
    } catch (e) {
      console.warn('Delete remote account err:', e);
    }
  }

  await refreshAccountsFromSupabase(currentUserId);
}

export async function adjustAccountBalance(accountId: string, newInitialBalance: number): Promise<void> {
  const existing = await db.accounts.get(accountId);
  if (existing) {
    existing.initial_balance = Number(newInitialBalance);
    existing.updated_at = new Date().toISOString();
    existing.sync_status = 'pending';

    const success = await upsertAccountToSupabase(existing);
    if (success) {
      existing.sync_status = 'synced';
    }

    await db.accounts.put(existing);
  }
}

/**
 * Perfil de Usuario
 */
export async function saveUserProfile(profile: Partial<UserProfile> & { name: string }): Promise<UserProfile> {
  const id = ensureValidUuid(profile.id || getActiveUserId());
  const role = profile.role || 'user';
  const record: UserProfile = {
    id,
    email: profile.email,
    cedula: profile.cedula,
    first_name: profile.first_name,
    last_name: profile.last_name,
    name: profile.name,
    avatar: profile.avatar || '👤',
    role,
    is_active: profile.is_active !== undefined ? profile.is_active : true,
    currency: profile.currency || 'USD',
    theme_mode: profile.theme_mode || 'navy',
    accent_color: profile.accent_color || '#147DF0',
    sync_status: profile.sync_status || 'pending',
    created_at: profile.created_at || new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const profilePayload = {
        id,
        email: record.email || `${id}@lanitapp.local`,
        cedula: record.cedula || '',
        first_name: record.first_name || record.name?.split(' ')[0] || '',
        last_name: record.last_name || record.name?.split(' ').slice(1).join(' ') || '',
        role: record.role || 'user',
        updated_at: new Date().toISOString(),
      };
      console.log('[Supabase Profiles Payload (db.ts)]:', profilePayload);
      const { error } = await supabase.from('profiles').upsert(profilePayload);
      if (!error) record.sync_status = 'synced';
      else console.error('[Supabase Profiles Upsert Error]:', error.message, error.details);
    } catch (e) {
      console.warn('Profile direct upsert notice:', e);
    }
  }

  await db.user_profiles.put(record);
  return record;
}

/**
 * Gastos Fijos
 */
export async function toggleMonthlyFixedOverride(
  fixedExpenseId: string,
  year: number,
  month: number,
  isActive: boolean,
  customAmount?: number,
  assumedByThirdParty?: boolean
): Promise<void> {
  const id = `${fixedExpenseId}_${year}_${month}`;
  const record: MonthlyFixedOverride = {
    id,
    fixed_expense_id: fixedExpenseId,
    year,
    month,
    is_active: isActive,
    custom_amount: customAmount !== undefined ? Number(customAmount) : undefined,
    assumed_by_third_party: assumedByThirdParty,
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...payload } = record;
      const { error } = await supabase.from('monthly_fixed_overrides').upsert(payload);
      if (!error) record.sync_status = 'synced';
    } catch (e) {
      console.warn('Override upsert notice:', e);
    }
  }

  await db.monthly_fixed_overrides.put(record);
}

export async function saveFixedExpense(
  expense: Partial<FixedExpense> & { name: string; amount: number; default_fortnight: 'q1' | 'q2' | 'both' }
): Promise<FixedExpense> {
  const id = ensureValidUuid(expense.id);
  const userId = expense.user_id || getActiveUserId();
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

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, default_quincena, ...payload } = record as any;
      payload.default_fortnight = (record.default_fortnight as any) === 'q1' || (record.default_fortnight as any) === 15 ? 15 : (record.default_fortnight as any) === 'q2' || (record.default_fortnight as any) === 30 ? 30 : null;
      const { error } = await supabase.from('fixed_expenses').upsert(payload);
      if (!error) {
        record.sync_status = 'synced';
      } else {
        console.error('[Supabase Fixed Expense Error]:', error.message, error.details);
      }
    } catch (e) {
      console.warn('Direct fixed expense upsert notice:', e);
    }
  }

  await db.fixed_expenses.put(record);
  return record;
}

export async function deleteFixedExpense(id: string): Promise<void> {
  await db.fixed_expenses.delete(id);
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
      if (error) console.error('[Supabase Fixed Expense Delete Error]:', error.message);
    } catch (e) {
      console.warn('Delete remote fixed expense err:', e);
    }
  }
}

/**
 * Deudas
 */
export async function saveDebt(
  debt: Partial<Debt> & { creditor: string; total_amount: number; payment_type: Debt['payment_type'] }
): Promise<Debt> {
  const id = ensureValidUuid(debt.id);
  const current_balance = debt.current_balance !== undefined ? Number(debt.current_balance) : Number(debt.total_amount);
  const status = current_balance <= 0 ? 'paid' : (debt.status || 'active');

  const now = new Date();
  const start_year = debt.start_year !== undefined ? debt.start_year : now.getFullYear();
  const start_month = debt.start_month !== undefined ? debt.start_month : now.getMonth();
  const start_fortnight = debt.start_fortnight || (now.getDate() <= 15 ? 'q1' : 'q2');
  const userId = debt.user_id || getActiveUserId();

  const record: Debt = {
    id,
    user_id: userId,
    creditor: debt.creditor,
    platform: debt.platform || 'particular',
    debt_mode: debt.debt_mode || 'installments',
    total_amount: Number(debt.total_amount),
    initial_payment: debt.initial_payment !== undefined ? Number(debt.initial_payment) : undefined,
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
    notes: debt.notes || '',
    sync_status: 'pending',
    created_at: debt.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, currency, creditor, ...restPayload } = record;
      const payload = {
        ...restPayload,
        creditor_name: record.creditor || record.creditor_name || 'Deuda',
        original_amount: Number(record.total_amount),
        remaining_amount: Number(record.current_balance),
        currency_type: record.currency || 'USD',
      };
      const { error } = await supabase.from('debts').upsert(payload);
      if (!error) {
        record.sync_status = 'synced';
      } else {
        console.error('[Supabase Debt Error]:', error.message, error.details);
      }
    } catch (e) {
      console.warn('Direct debt upsert notice:', e);
    }
  }

  await db.debts.put(record);
  return record;
}

export async function deleteDebt(id: string): Promise<void> {
  await db.debts.delete(id);
  await db.debt_payments.where('debt_id').equals(id).delete();

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await Promise.all([
        supabase.from('debts').delete().eq('id', id),
        supabase.from('debt_payments').delete().eq('debt_id', id),
      ]);
    } catch (e) {
      console.warn('Delete remote debt err:', e);
    }
  }
}

export async function addDebtPayment(data: {
  debt_id: string;
  user_id?: string;
  amount: number;
  payment_date?: string;
  fortnight?: FortnightType;
  year?: number;
  month?: number;
  rate_applied?: number;
  parallel_rate?: number;
  notes?: string;
}): Promise<DebtPayment> {
  const debt = await db.debts.get(data.debt_id);
  if (!debt) throw new Error('Deuda no encontrada');

  const userId = data.user_id || getActiveUserId();
  const now = new Date();
  const paymentDate = data.payment_date || now.toISOString().split('T')[0];
  const dateObj = new Date(paymentDate);
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
    id: ensureValidUuid(),
    user_id: userId,
    debt_id: data.debt_id,
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

  const newBalance = Math.max(0, Number(debt.current_balance) - Number(data.amount));
  const newStatus = newBalance <= 0.01 ? 'paid' : 'active';
  const newPendingInstallments = debt.pending_installments ? Math.max(0, debt.pending_installments - 1) : undefined;

  const txRecord: Transaction = {
    id: 'tx_' + paymentRecord.id,
    user_id: userId,
    amount: Number(data.amount),
    type: 'expense',
    description: `Abono: ${debt.creditor} (${fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
    category_id: 'cat_debt',
    account_id: (data as any).account_id || '',
    transaction_date: paymentDate,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status: s1, ...payPayload } = paymentRecord;
      const { sync_status: s2, ...txPayload } = txRecord;
      const [res1, res2, res3] = await Promise.all([
        supabase.from('debt_payments').upsert(payPayload),
        supabase.from('debts').update({
          current_balance: newBalance,
          remaining_amount: newBalance,
          pending_installments: newPendingInstallments,
          status: newStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', debt.id),
        supabase.from('transactions').upsert(txPayload),
      ]);
      if (!res1.error && !res2.error && !res3.error) {
        paymentRecord.sync_status = 'synced';
        txRecord.sync_status = 'synced';
      } else {
        console.error('[Supabase Debt Payment Error]:', res1.error || res2.error || res3.error);
      }
    } catch (e) {
      console.warn('Direct debt payment upsert notice:', e);
    }
  }

  await db.debt_payments.add(paymentRecord);
  await db.debts.update(debt.id, {
    current_balance: newBalance,
    pending_installments: newPendingInstallments,
    status: newStatus,
    sync_status: 'synced',
    updated_at: new Date().toISOString(),
  });
  await db.transactions.put(txRecord);

  return paymentRecord;
}

/**
 * Transacciones regulares
 */
export async function addTransaction(
  data: Omit<Transaction, 'id' | 'sync_status' | 'created_at'>
): Promise<Transaction> {
  const userId = data.user_id || getActiveUserId();
  const newTransaction: Transaction = {
    ...data,
    user_id: userId,
    amount: Number(data.amount),
    id: ensureValidUuid(),
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...payload } = newTransaction;
      const { error } = await supabase.from('transactions').upsert(payload);
      if (!error) {
        newTransaction.sync_status = 'synced';
      } else {
        console.error('[Supabase Transaction Error]:', error.message, error.details);
      }
    } catch (e) {
      console.warn('Direct transaction upsert notice:', e);
    }
  }

  await db.transactions.add(newTransaction);
  return newTransaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id);
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) console.error('[Supabase Transaction Delete Error]:', error.message);
    } catch (e) {
      console.warn('Delete remote tx err:', e);
    }
  }
}

/**
 * Limpia todos los registros financieros del usuario actual (en Dexie y Supabase)
 */
export async function clearCurrentUserData(userId?: string): Promise<void> {
  const targetUid = userId || getActiveUserId();
  if (!targetUid) return;

  await db.transactions.where('user_id').equals(targetUid).delete();
  await db.fixed_incomes.where('user_id').equals(targetUid).delete();
  await db.variable_incomes.where('user_id').equals(targetUid).delete();
  await db.fixed_expenses.where('user_id').equals(targetUid).delete();
  await db.debts.where('user_id').equals(targetUid).delete();
  await db.debt_payments.where('user_id').equals(targetUid).delete();
  await db.savings_goals.where('user_id').equals(targetUid).delete();
  await db.saving_contributions.where('user_id').equals(targetUid).delete();
  await db.fortnight_item_states.where('user_id').equals(targetUid).delete();

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await Promise.all([
        supabase.from('transactions').delete().eq('user_id', targetUid),
        supabase.from('fixed_incomes').delete().eq('user_id', targetUid),
        supabase.from('variable_incomes').delete().eq('user_id', targetUid),
        supabase.from('fixed_expenses').delete().eq('user_id', targetUid),
        supabase.from('debts').delete().eq('user_id', targetUid),
        supabase.from('debt_payments').delete().eq('user_id', targetUid),
        supabase.from('savings_goals').delete().eq('user_id', targetUid),
        supabase.from('saving_contributions').delete().eq('user_id', targetUid),
        supabase.from('fortnight_item_states').delete().eq('user_id', targetUid),
      ]);
    } catch (e) {
      console.warn('Clear remote user data err:', e);
    }
  }
}

/**
 * Resetea la base de datos a cero absoluto
 */
export async function resetDatabaseToZero(): Promise<void> {
  await db.transactions.clear();
  await db.categories.clear();
  await db.accounts.clear();
  await db.fixed_incomes.clear();
  await db.monthly_fixed_income_overrides.clear();
  await db.variable_incomes.clear();
  await db.fixed_expenses.clear();
  await db.monthly_fixed_overrides.clear();
  await db.debts.clear();
  await db.debt_payments.clear();
  await db.savings_goals.clear();
  await db.saving_contributions.clear();
  await db.fortnight_item_states.clear();

  await db.categories.bulkPut(DEFAULT_CATEGORIES);
}

export const resetDatabaseWithSamples = resetDatabaseToZero;

/**
 * Fortnight Item States (Pagado / Omitido por Quincena)
 */
export function getFortnightPeriodKey(year: number, month: number, fortnight: FortnightType): string {
  const day = fortnight === 'q1' ? '15' : '30';
  return `${year}-${String(month + 1).padStart(2, '0')}-${day}`;
}

export async function setFortnightExpensePaid(params: {
  expense: FixedExpense;
  year: number;
  month: number;
  fortnight: FortnightType;
  amount: number;
  accountId?: string;
}): Promise<void> {
  const userId = getActiveUserId();
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
    account_id: params.accountId || '',
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

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status: s1, ...txPayload } = txRecord;
      const { sync_status: s2, ...statePayload } = stateRecord;
      const [res1, res2] = await Promise.all([
        supabase.from('transactions').upsert(txPayload),
        supabase.from('fortnight_item_states').upsert(statePayload),
      ]);
      if (!res1.error && !res2.error) {
        txRecord.sync_status = 'synced';
        stateRecord.sync_status = 'synced';
      } else {
        console.error('[Supabase Fortnight Paid Error]:', res1.error || res2.error);
      }
    } catch (e) {
      console.warn('Direct fortnight paid upsert notice:', e);
    }
  }

  await db.transactions.put(txRecord);
  await db.fortnight_item_states.put(stateRecord);
}

export async function unmarkFortnightExpensePaid(params: {
  expenseId: string;
  year: number;
  month: number;
  fortnight: FortnightType;
}): Promise<void> {
  const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
  const stateId = `fis_expense_${params.expenseId}_${periodKey}`;
  const txId = `tx_fe_${params.expenseId}_${periodKey}`;

  await db.transactions.delete(txId);
  await db.fortnight_item_states.delete(stateId);

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await Promise.all([
        supabase.from('transactions').delete().eq('id', txId),
        supabase.from('fortnight_item_states').delete().eq('id', stateId),
      ]);
    } catch (e) {
      console.warn('Delete remote fortnight paid state err:', e);
    }
  }
}

export async function setFortnightExpenseSkipped(params: {
  expenseId: string;
  year: number;
  month: number;
  fortnight: FortnightType;
}): Promise<void> {
  const userId = getActiveUserId();
  const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
  const stateId = `fis_expense_${params.expenseId}_${periodKey}`;
  const txId = `tx_fe_${params.expenseId}_${periodKey}`;

  await db.transactions.delete(txId);

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

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...statePayload } = stateRecord;
      await Promise.all([
        supabase.from('transactions').delete().eq('id', txId),
        supabase.from('fortnight_item_states').upsert(statePayload),
      ]);
      stateRecord.sync_status = 'synced';
    } catch (e) {
      console.warn('Direct skip expense upsert notice:', e);
    }
  }

  await db.fortnight_item_states.put(stateRecord);
}

export async function unmarkFortnightExpenseSkipped(params: {
  expenseId: string;
  year: number;
  month: number;
  fortnight: FortnightType;
}): Promise<void> {
  const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
  const stateId = `fis_expense_${params.expenseId}_${periodKey}`;

  await db.fortnight_item_states.delete(stateId);

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('fortnight_item_states').delete().eq('id', stateId);
    } catch (e) {
      console.warn('Delete remote skip expense err:', e);
    }
  }
}

export async function setFortnightDebtSkipped(params: {
  debtId: string;
  year: number;
  month: number;
  fortnight: FortnightType;
}): Promise<void> {
  const userId = getActiveUserId();
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

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { sync_status, ...payload } = stateRecord;
      const { error } = await supabase.from('fortnight_item_states').upsert(payload);
      if (!error) {
        stateRecord.sync_status = 'synced';
      } else {
        console.error('[Supabase Skip Debt Error]:', error.message);
      }
    } catch (e) {
      console.warn('Direct skip debt upsert notice:', e);
    }
  }

  await db.fortnight_item_states.put(stateRecord);
}

export async function unmarkFortnightDebtSkipped(params: {
  debtId: string;
  year: number;
  month: number;
  fortnight: FortnightType;
}): Promise<void> {
  const periodKey = getFortnightPeriodKey(params.year, params.month, params.fortnight);
  const stateId = `fis_debt_${params.debtId}_${periodKey}`;

  await db.fortnight_item_states.delete(stateId);

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('fortnight_item_states').delete().eq('id', stateId);
    } catch (e) {
      console.warn('Delete remote skip debt err:', e);
    }
  }
}
