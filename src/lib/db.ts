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
} from '../types/index.ts';
import { supabase, isSupabaseConfigured } from './supabase.ts';

export function getActiveUserId(): string {
  try {
    const stored = localStorage.getItem('lanitapp_active_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.id) return parsed.id;
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

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc_cash', name: 'Efectivo Cash (USD)', type: 'cash', currency: 'USD', initial_balance: 0 },
  { id: 'acc_bank_usd', name: 'Cuenta Custodia USD', type: 'bank', currency: 'USD', initial_balance: 0 },
  { id: 'acc_bank_ves', name: 'Banco Nacional (Bs)', type: 'bank', currency: 'VES', initial_balance: 0 },
  { id: 'acc_savings', name: 'Fondo de Ahorro', type: 'savings', currency: 'USD', initial_balance: 0 },
];

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
      await this.accounts.bulkAdd(DEFAULT_ACCOUNTS);
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

    const categoriesCount = await db.categories.count();
    if (categoriesCount === 0) {
      await db.categories.bulkPut(DEFAULT_CATEGORIES);
    }

    const accountsCount = await db.accounts.count();
    if (accountsCount === 0) {
      await db.accounts.bulkPut(DEFAULT_ACCOUNTS);
    }
  } catch (err) {
    console.error('Database init / purge error:', err);
  }
}

initializeDatabase().catch((err) => console.error('Database init error:', err));

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
      await supabase.from('accounts').upsert(localAccounts.map((a: any) => ({ ...a, user_id: userId })));
      localStorage.removeItem('lanita_accounts');
      localStorage.removeItem('lanitapp_accounts');
    }
    if (Array.isArray(localFixedExpenses) && localFixedExpenses.length > 0) {
      await supabase.from('fixed_expenses').upsert(localFixedExpenses.map((f: any) => ({ ...f, user_id: userId })));
      localStorage.removeItem('lanita_fixed_expenses');
      localStorage.removeItem('lanitapp_fixed_expenses');
    }
    if (Array.isArray(localDebts) && localDebts.length > 0) {
      await supabase.from('debts').upsert(localDebts.map((d: any) => ({ ...d, user_id: userId })));
      localStorage.removeItem('lanita_debts');
      localStorage.removeItem('lanitapp_debts');
    }
    if (Array.isArray(localIncomes) && localIncomes.length > 0) {
      await supabase.from('fixed_incomes').upsert(localIncomes.map((i: any) => ({ ...i, user_id: userId })));
      localStorage.removeItem('lanita_incomes');
      localStorage.removeItem('lanitapp_incomes');
    }
    if (Array.isArray(localTxs) && localTxs.length > 0) {
      await supabase.from('transactions').upsert(localTxs.map((t: any) => ({ ...t, user_id: userId })));
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
      { data: remoteAccounts },
      { data: remoteCategories },
      { data: remoteIncomes },
      { data: remoteIncomeOverrides },
      { data: remoteVarIncomes },
      { data: remoteExpenses },
      { data: remoteExpenseOverrides },
      { data: remoteDebts },
      { data: remotePayments },
      { data: remoteSavings },
      { data: remoteContribs },
      { data: remoteStates },
      { data: remoteTxs },
    ] = await Promise.all([
      supabase.from('accounts').select('*').or(`user_id.eq.${activeUid},user_id.is.null`),
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
    if (remoteAccounts && remoteAccounts.length > 0) {
      await db.accounts.bulkPut(remoteAccounts.map((a) => ({ ...a, sync_status: 'synced' })));
    }
    if (remoteIncomes && remoteIncomes.length > 0) {
      await db.fixed_incomes.bulkPut(remoteIncomes.map((i) => ({ ...i, sync_status: 'synced' })));
    }
    if (remoteIncomeOverrides && remoteIncomeOverrides.length > 0) {
      await db.monthly_fixed_income_overrides.bulkPut(remoteIncomeOverrides.map((o) => ({ ...o, sync_status: 'synced' })));
    }
    if (remoteVarIncomes && remoteVarIncomes.length > 0) {
      await db.variable_incomes.bulkPut(remoteVarIncomes.map((v) => ({ ...v, sync_status: 'synced' })));
    }
    if (remoteExpenses && remoteExpenses.length > 0) {
      await db.fixed_expenses.bulkPut(remoteExpenses.map((e) => ({ ...e, sync_status: 'synced' })));
    }
    if (remoteExpenseOverrides && remoteExpenseOverrides.length > 0) {
      await db.monthly_fixed_overrides.bulkPut(remoteExpenseOverrides.map((o) => ({ ...o, sync_status: 'synced' })));
    }
    if (remoteDebts && remoteDebts.length > 0) {
      await db.debts.bulkPut(remoteDebts.map((d) => ({ ...d, sync_status: 'synced' })));
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
    // Transacciones
    const pendingTxs = await db.transactions.where('sync_status').equals('pending').toArray();
    for (const item of pendingTxs.filter((t) => !t.user_id || t.user_id === targetUid)) {
      const { error } = await supabase.from('transactions').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.transactions.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Ingresos Fijos
    const pendingIncomes = await db.fixed_incomes.where('sync_status').equals('pending').toArray();
    for (const item of pendingIncomes.filter((i) => !i.user_id || i.user_id === targetUid)) {
      const { error } = await supabase.from('fixed_incomes').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.fixed_incomes.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Ingresos Variables
    const pendingVarIncomes = await db.variable_incomes.where('sync_status').equals('pending').toArray();
    for (const item of pendingVarIncomes.filter((v) => !v.user_id || v.user_id === targetUid)) {
      const { error } = await supabase.from('variable_incomes').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.variable_incomes.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Gastos Fijos
    const pendingExpenses = await db.fixed_expenses.where('sync_status').equals('pending').toArray();
    for (const item of pendingExpenses.filter((e) => !e.user_id || e.user_id === targetUid)) {
      const { error } = await supabase.from('fixed_expenses').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.fixed_expenses.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Deudas
    const pendingDebts = await db.debts.where('sync_status').equals('pending').toArray();
    for (const item of pendingDebts.filter((d) => !d.user_id || d.user_id === targetUid)) {
      const { error } = await supabase.from('debts').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.debts.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Abonos a Deudas
    const pendingPayments = await db.debt_payments.where('sync_status').equals('pending').toArray();
    for (const item of pendingPayments.filter((p) => !p.user_id || p.user_id === targetUid)) {
      const { error } = await supabase.from('debt_payments').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.debt_payments.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Metas de Ahorro
    const pendingSavings = await db.savings_goals.where('sync_status').equals('pending').toArray();
    for (const item of pendingSavings.filter((s) => !s.user_id || s.user_id === targetUid)) {
      const { error } = await supabase.from('savings_goals').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.savings_goals.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Aportes de Ahorro
    const pendingContribs = await db.saving_contributions.where('sync_status').equals('pending').toArray();
    for (const item of pendingContribs.filter((c) => !c.user_id || c.user_id === targetUid)) {
      const { error } = await supabase.from('saving_contributions').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.saving_contributions.update(item.id, { sync_status: 'synced' });
        pushed++;
      }
    }

    // Estados Quincenales
    const pendingStates = await db.fortnight_item_states.where('sync_status').equals('pending').toArray();
    for (const item of pendingStates.filter((s) => !s.user_id || s.user_id === targetUid)) {
      const { error } = await supabase.from('fortnight_item_states').upsert({ ...item, user_id: targetUid });
      if (!error) {
        await db.fortnight_item_states.update(item.id, { sync_status: 'synced' });
        pushed++;
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
  const channelName = `lanitapp_realtime_${userId}_${Math.random().toString(36).substring(2, 7)}`;

  const tables = [
    'transactions',
    'accounts',
    'categories',
    'fixed_incomes',
    'variable_incomes',
    'fixed_expenses',
    'debts',
    'debt_payments',
    'savings_goals',
    'saving_contributions',
    'fortnight_item_states',
  ];

  let channel = client.channel(channelName);

  tables.forEach((tableName) => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      async (payload) => {
        try {
          const targetTable = (db as any)[tableName];
          if (!targetTable) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (!row.user_id || row.user_id === userId) {
              await targetTable.put({ ...row, sync_status: 'synced' });
              if (onUpdate) onUpdate();
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              await targetTable.delete(oldId);
              if (onUpdate) onUpdate();
            }
          }
        } catch (e) {
          console.warn(`Realtime update handling error on ${tableName}:`, e);
        }
      }
    );
  });

  channel.subscribe();

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
    // 1. Purgar datos de prueba o sin propietario
    await initializeDatabase();

    // 2. Forzar refresco consolidado desde la nube
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
  const id = goal.id || 'save_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
  const userId = goal.user_id || getActiveUserId();
  const record: SavingsGoal = {
    id,
    user_id: userId,
    name: goal.name,
    target_amount: goal.target_amount,
    current_amount: goal.current_amount !== undefined ? goal.current_amount : 0,
    frequency: goal.frequency,
    target_fortnight: goal.target_fortnight || 'q1',
    amount_per_period: goal.amount_per_period,
    target_date: goal.target_date,
    icon: goal.icon || 'PiggyBank',
    color: goal.color || '#00C2C7',
    status: goal.status || 'active',
    notes: goal.notes || '',
    sync_status: 'pending',
    created_at: goal.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Immediate Cloud Write
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('savings_goals').upsert(record);
      if (!error) record.sync_status = 'synced';
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
}): Promise<SavingContribution> {
  const goal = await db.savings_goals.get(data.goal_id);
  if (!goal) throw new Error('Meta de ahorro no encontrada');

  const userId = data.user_id || getActiveUserId();
  const record: SavingContribution = {
    id: 'sc_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
    user_id: userId,
    goal_id: data.goal_id,
    amount: data.amount,
    year: data.year,
    month: data.month,
    fortnight: data.fortnight,
    is_skipped: false,
    contribution_date: new Date().toISOString().split('T')[0],
    notes: data.notes || `Aporte a: ${goal.name}`,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  const newCurrent = goal.current_amount + data.amount;
  const newStatus = newCurrent >= goal.target_amount ? 'completed' : goal.status;

  const txRecord: Transaction = {
    id: 'tx_' + record.id,
    user_id: userId,
    amount: data.amount,
    type: 'expense',
    description: `Aporte Ahorro: ${goal.name}`,
    category_id: 'cat_savings',
    account_id: 'acc_savings',
    transaction_date: record.contribution_date,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  // Immediate Cloud Write
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const [res1, res2, res3] = await Promise.all([
        supabase.from('saving_contributions').upsert(record),
        supabase.from('savings_goals').update({ current_amount: newCurrent, status: newStatus, updated_at: new Date().toISOString() }).eq('id', goal.id),
        supabase.from('transactions').upsert(txRecord),
      ]);
      if (!res1.error && !res2.error && !res3.error) {
        record.sync_status = 'synced';
        txRecord.sync_status = 'synced';
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
  await db.transactions.put(txRecord);

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
      const { error } = await supabase.from('saving_contributions').upsert(record);
      if (!error) record.sync_status = 'synced';
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
  income: Partial<FixedIncome> & { name: string; amount: number; default_fortnight: 'q1' | 'q2' | 'both' }
): Promise<FixedIncome> {
  const id = income.id || 'fi_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
  const userId = income.user_id || getActiveUserId();
  const record: FixedIncome = {
    id,
    user_id: userId,
    name: income.name,
    amount: income.amount,
    currency: income.currency || 'USD',
    default_fortnight: income.default_fortnight,
    category_id: income.category_id || 'cat_salary',
    is_active: income.is_active !== undefined ? income.is_active : true,
    notes: income.notes || '',
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('fixed_incomes').upsert(record);
      if (!error) record.sync_status = 'synced';
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
      await supabase.from('fixed_incomes').delete().eq('id', id);
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
    custom_amount: customAmount,
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('monthly_fixed_income_overrides').upsert(record);
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
  const id = income.id || 'vi_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
  const userId = income.user_id || getActiveUserId();
  const record: VariableIncome = {
    id,
    user_id: userId,
    description: income.description,
    amount: income.amount,
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

  const txRecord: Transaction = {
    id: 'tx_' + record.id,
    user_id: userId,
    amount: record.amount,
    type: 'income',
    description: `${record.description} (${record.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
    category_id: record.category_id || 'cat_extras',
    account_id: record.account_id || 'acc_bank_usd',
    transaction_date: new Date(record.year, record.month, record.fortnight === 'q1' ? 15 : 28).toISOString().split('T')[0],
    sync_status: 'pending',
    created_at: record.created_at,
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const [res1, res2] = await Promise.all([
        supabase.from('variable_incomes').upsert(record),
        supabase.from('transactions').upsert(txRecord),
      ]);
      if (!res1.error && !res2.error) {
        record.sync_status = 'synced';
        txRecord.sync_status = 'synced';
      }
    } catch (e) {
      console.warn('Direct variable income upsert notice:', e);
    }
  }

  await db.variable_incomes.put(record);
  await db.transactions.put(txRecord);

  return record;
}

export async function deleteVariableIncome(id: string): Promise<void> {
  await db.variable_incomes.delete(id);
  await db.transactions.delete('tx_' + id);

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await Promise.all([
        supabase.from('variable_incomes').delete().eq('id', id),
        supabase.from('transactions').delete().eq('id', 'tx_' + id),
      ]);
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
      const { error } = await supabase.from('categories').upsert(record);
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
  const id = account.id || 'acc_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
  const userId = account.user_id || getActiveUserId();
  const record: Account = {
    id,
    user_id: userId,
    name: account.name.trim(),
    type: account.type || 'cash',
    currency: account.currency || 'USD',
    initial_balance: account.initial_balance !== undefined ? account.initial_balance : 0,
    color: account.color,
    notes: account.notes || '',
    sync_status: 'pending',
    created_at: account.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('accounts').upsert(record);
      if (!error) record.sync_status = 'synced';
    } catch (e) {
      console.warn('Account upsert notice:', e);
    }
  }

  await db.accounts.put(record);
  return record;
}

export async function deleteAccount(id: string): Promise<void> {
  await db.accounts.delete(id);
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('accounts').delete().eq('id', id);
    } catch (e) {
      console.warn('Delete remote account err:', e);
    }
  }
}

export async function adjustAccountBalance(accountId: string, newInitialBalance: number): Promise<void> {
  const existing = await db.accounts.get(accountId);
  if (existing) {
    existing.initial_balance = newInitialBalance;
    existing.updated_at = new Date().toISOString();
    existing.sync_status = 'pending';

    if (navigator.onLine && isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('accounts').update({
          initial_balance: newInitialBalance,
          updated_at: existing.updated_at,
        }).eq('id', accountId);
        if (!error) existing.sync_status = 'synced';
      } catch (e) {
        console.warn('Account balance update notice:', e);
      }
    }

    await db.accounts.put(existing);
  }
}

/**
 * Perfil de Usuario
 */
export async function saveUserProfile(profile: Partial<UserProfile> & { name: string }): Promise<UserProfile> {
  const id = profile.id || getActiveUserId() || 'usr_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
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
      const { error } = await supabase.from('profiles').upsert(record);
      if (!error) record.sync_status = 'synced';
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
    custom_amount: customAmount,
    assumed_by_third_party: assumedByThirdParty,
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('monthly_fixed_overrides').upsert(record);
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
  const id = expense.id || 'fe_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
  const userId = expense.user_id || getActiveUserId();
  const record: FixedExpense = {
    id,
    user_id: userId,
    name: expense.name,
    amount: expense.amount,
    amount_usd: expense.amount_usd !== undefined ? expense.amount_usd : expense.amount,
    original_amount: expense.original_amount !== undefined ? expense.original_amount : (expense.amount_in_ves || expense.amount),
    amount_in_ves: expense.amount_in_ves,
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
      const { error } = await supabase.from('fixed_expenses').upsert(record);
      if (!error) record.sync_status = 'synced';
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
      await supabase.from('fixed_expenses').delete().eq('id', id);
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
  const id = debt.id || 'debt_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
  const current_balance = debt.current_balance !== undefined ? debt.current_balance : debt.total_amount;
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
    total_amount: debt.total_amount,
    current_balance,
    total_installments: debt.total_installments,
    pending_installments: debt.pending_installments,
    installment_amount: debt.installment_amount,
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
      const { error } = await supabase.from('debts').upsert(record);
      if (!error) record.sync_status = 'synced';
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
    amount_in_bs = data.amount * data.rate_applied;
    if (data.parallel_rate && data.parallel_rate > 0) {
      const realCostInUSD = (data.amount * data.rate_applied) / data.parallel_rate;
      loss_differential = Number((data.amount - realCostInUSD).toFixed(2));
    }
  }

  const paymentRecord: DebtPayment = {
    id: 'pay_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
    user_id: userId,
    debt_id: data.debt_id,
    amount: data.amount,
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

  const newBalance = Math.max(0, debt.current_balance - data.amount);
  const newStatus = newBalance <= 0.01 ? 'paid' : 'active';
  const newPendingInstallments = debt.pending_installments ? Math.max(0, debt.pending_installments - 1) : undefined;

  const txRecord: Transaction = {
    id: 'tx_' + paymentRecord.id,
    user_id: userId,
    amount: data.amount,
    type: 'expense',
    description: `Abono: ${debt.creditor} (${fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
    category_id: 'cat_debt',
    account_id: debt.payment_type === 'cash' ? 'acc_cash' : 'acc_bank_usd',
    transaction_date: paymentDate,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  // Immediate Cloud Write
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const [res1, res2, res3] = await Promise.all([
        supabase.from('debt_payments').upsert(paymentRecord),
        supabase.from('debts').update({
          current_balance: newBalance,
          pending_installments: newPendingInstallments,
          status: newStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', debt.id),
        supabase.from('transactions').upsert(txRecord),
      ]);
      if (!res1.error && !res2.error && !res3.error) {
        paymentRecord.sync_status = 'synced';
        txRecord.sync_status = 'synced';
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
    id: 'tx_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('transactions').upsert(newTransaction);
      if (!error) newTransaction.sync_status = 'synced';
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
      await supabase.from('transactions').delete().eq('id', id);
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
  await db.accounts.bulkPut(DEFAULT_ACCOUNTS);
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
    amount: params.amount,
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
    item_type: 'expense',
    period_key: periodKey,
    year: params.year,
    month: params.month,
    fortnight: params.fortnight,
    status: 'paid',
    amount: params.amount,
    transaction_id: txId,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const [res1, res2] = await Promise.all([
        supabase.from('transactions').upsert(txRecord),
        supabase.from('fortnight_item_states').upsert(stateRecord),
      ]);
      if (!res1.error && !res2.error) {
        txRecord.sync_status = 'synced';
        stateRecord.sync_status = 'synced';
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
    item_type: 'expense',
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
      await Promise.all([
        supabase.from('transactions').delete().eq('id', txId),
        supabase.from('fortnight_item_states').upsert(stateRecord),
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
      const { error } = await supabase.from('fortnight_item_states').upsert(stateRecord);
      if (!error) stateRecord.sync_status = 'synced';
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
