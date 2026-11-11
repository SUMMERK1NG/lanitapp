/**
 * Módulo centralizado de conversión de payloads y normalizadores Frontend <-> Supabase
 *
 * 100% alineado con el esquema PostgreSQL de producción y sin dependencias locales.
 */

import type {
  Category,
  Debt,
  DebtPayment,
  FortnightItemState,
  SavingContribution,
  MonthlyFixedOverride,
  MonthlyFixedIncomeOverride,
  FixedIncome,
  FixedExpense,
  VariableIncome,
  VariableExpense,
  Transaction,
  FortnightType,
  PlanningNote,
  PlanningTask,
  Account,
} from '../types/index.ts';
import { isValidUuid, ensureValidUuid } from '../utils/uuid.ts';
import { getLocalTodayString, getFortnightTransactionDate } from '../utils/date.ts';
import { findCategory, resolveCategoryUuid } from '../constants/finance.ts';
import { getActiveUserId } from './supabaseSession.ts';

// ---------------------------------------------------------------
// Category Resolution: dinámica contra las categorías reales en BD
// ---------------------------------------------------------------

let dynamicCategories: Category[] = [];

/** Actualiza el catálogo activo de categorías desde Zustand / Supabase */
export function setCategoryMap(categories: Array<Partial<Category> & { id: string; name: string }>) {
  dynamicCategories = categories.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    type: (c.type as 'income' | 'expense') || 'expense',
    icon: c.icon || 'tag',
    color: c.color || '#147DF0',
    code: c.code,
    sync_status: 'synced',
  }));
}

export function isCategoryMapReady(): boolean {
  return dynamicCategories.length > 0;
}

function guessCategoryCodeFromText(text?: string, fallbackType: 'income' | 'expense' = 'expense'): string {
  const n = (text || '').toLowerCase();
  if (n.includes('gasolin') || n.includes('trans') || n.includes('combust') || n.includes('moto') || n.includes('carro')) {
    return 'cat_transport';
  }
  if (n.includes('comid') || n.includes('mercado') || n.includes('alimen') || n.includes('super')) {
    return 'cat_food';
  }
  if (n.includes('salud') || n.includes('medic') || n.includes('farma') || n.includes('clinic')) {
    return 'cat_health';
  }
  if (n.includes('deud') || n.includes('cuota') || n.includes('abono')) {
    return 'cat_debt';
  }
  if (n.includes('ahorr') || n.includes('meta')) {
    return 'cat_savings';
  }
  if (n.includes('condominio') || n.includes('alquiler') || n.includes('servicio') || n.includes('vivienda') || n.includes('luz') || n.includes('agua') || n.includes('internet') || n.includes('fibra')) {
    return 'cat_services';
  }
  if (n.includes('extra') || n.includes('freelance')) {
    return 'cat_extras';
  }
  return fallbackType === 'income' ? 'cat_salary' : 'cat_services';
}

/** Resolve a category_id (code, name, or UUID) -> valid DB category UUID or undefined */
export function resolveCategoryId(localId?: string | null): string | undefined {
  return resolveCategoryUuid(dynamicCategories, localId) || undefined;
}

/**
 * Resuelve un UUID de categoría válido existente en Supabase o `null` si aún no se cargan categorías.
 * Soporta tanto categorías del sistema (14 códigos) como categorías personalizadas del usuario.
 */
export function getSafeSupabaseCategoryId(
  categoryId?: string | null,
  fallbackType: 'income' | 'expense' = 'expense',
  description?: string
): string | null {
  const resolved = resolveCategoryUuid(dynamicCategories, categoryId);
  if (resolved) return resolved;

  if (description) {
    const guessedCode = guessCategoryCodeFromText(description, fallbackType);
    const guessedUuid = resolveCategoryUuid(dynamicCategories, guessedCode);
    if (guessedUuid) return guessedUuid;
  }

  const byType = dynamicCategories.find((c) => c.type === fallbackType && isValidUuid(c.id));
  if (byType) return byType.id;

  const anyValid = dynamicCategories.find((c) => isValidUuid(c.id));
  return anyValid ? anyValid.id : null;
}

/** Devuelve el identificador de categoría preferido para columnas `text` (UUID si existe, o el código/nombre original) */
export function getPreferredCategoryRef(
  categoryId?: string | null,
  fallbackType: 'income' | 'expense' = 'expense'
): string {
  const uuid = getSafeSupabaseCategoryId(categoryId, fallbackType);
  if (uuid) return uuid;
  const found = findCategory(dynamicCategories, categoryId);
  return found?.code || found?.id || categoryId || (fallbackType === 'income' ? 'cat_salary' : 'cat_services');
}

// ---------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------

export function toSupabaseAccountPayload(acc: Partial<Account> & Record<string, any>, fallbackUserId?: string) {
  const currentUserId = acc.user_id || fallbackUserId || getActiveUserId();
  const id = ensureValidUuid(acc.id);
  const balanceNum =
    typeof acc.balance === 'number'
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
    initial_balance: balanceNum,
    notes: acc.notes || '',
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// Debt Payments
// ---------------------------------------------------------------

export function toSupabaseDebtPaymentPayload(
  record: Omit<DebtPayment, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const amountPaid = Number(record.amount_paid ?? record.amount ?? 0);
  const paymentDate = record.payment_date || getLocalTodayString();
  const dayPart = Number(String(paymentDate).split('-')[2] || 15);
  const fortnight: FortnightType = record.fortnight || (dayPart <= 15 ? 'q1' : 'q2');
  const quincena = record.quincena ?? (fortnight === 'q2' ? 30 : 15);

  const payload: Record<string, any> = {
    id: ensureValidUuid(record.id),
    debt_id: ensureValidUuid(record.debt_id),
    user_id: record.user_id,
    amount_paid: amountPaid,
    payment_date: paymentDate,
    quincena,
    notes: record.notes || '',
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (record.year !== undefined) payload.year = Number(record.year);
  if (record.month !== undefined) payload.month = Number(record.month);
  if (fortnight) payload.fortnight = fortnight;

  if (record.rate_applied !== undefined && record.rate_applied !== null) {
    payload.rate_applied = Number(record.rate_applied);
  }
  if (record.parallel_rate !== undefined && record.parallel_rate !== null) {
    payload.parallel_rate = Number(record.parallel_rate);
  }
  if (record.amount_in_bs !== undefined && record.amount_in_bs !== null) {
    payload.amount_in_bs = Number(record.amount_in_bs);
  }
  if (record.loss_differential !== undefined && record.loss_differential !== null) {
    payload.loss_differential = Number(record.loss_differential);
  }

  return payload;
}

// ---------------------------------------------------------------
// Fortnight Item States
// ---------------------------------------------------------------

export function toSupabaseFortnightStatePayload(
  record: Omit<FortnightItemState, 'sync_status'> & Record<string, any>,
  userId?: string
): Record<string, any> {
  const targetUserId = userId || record.user_id;
  const cleanId = ensureValidUuid(record.id);
  const cleanItemId = ensureValidUuid(record.item_id);
  const cleanTxId = record.transaction_id ? ensureValidUuid(record.transaction_id) : null;

  const payload: Record<string, any> = {
    id: cleanId,
    item_id: cleanItemId,
    item_type: record.item_type || 'fixed_expense',
    period_key: String(record.period_key || ''),
    status: record.status || 'paid',
    notes: record.notes || '',
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (targetUserId) {
    payload.user_id = targetUserId;
  }
  if (record.amount !== undefined && record.amount !== null) {
    payload.amount = Number(record.amount);
  }
  if (cleanTxId) {
    payload.transaction_id = cleanTxId;
  }

  return payload;
}

export function normalizeFortnightItemStateRow(row: any): FortnightItemState {
  const periodKey = String(row.period_key || '');
  const parts = periodKey.split('-').map(Number);
  const now = new Date();
  const year = row.year !== undefined ? Number(row.year) : (!isNaN(parts[0]) && parts[0] > 2000 ? parts[0] : now.getFullYear());
  const month = row.month !== undefined ? Number(row.month) : (!isNaN(parts[1]) && parts[1] >= 1 && parts[1] <= 12 ? parts[1] - 1 : now.getMonth());
  const fortnight: FortnightType =
    row.fortnight === 'q1' || row.fortnight === 'q2'
      ? row.fortnight
      : parts[2] <= 15
      ? 'q1'
      : 'q2';

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    item_id: String(row.item_id || ''),
    item_type: row.item_type || 'fixed_expense',
    period_key: periodKey,
    year,
    month,
    fortnight,
    status: row.status || 'pending',
    amount: row.amount !== undefined && row.amount !== null ? Number(row.amount) : undefined,
    transaction_id: row.transaction_id || undefined,
    notes: row.notes || '',
    updated_at: row.updated_at,
    sync_status: 'synced',
  };
}

// ---------------------------------------------------------------
// Saving Contributions
// ---------------------------------------------------------------

export function toSupabaseSavingContributionPayload(
  record: Omit<SavingContribution, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const now = new Date();
  const year = record.year ?? now.getFullYear();
  const month = record.month ?? now.getMonth();
  const fortnight: FortnightType = record.fortnight || (now.getDate() <= 15 ? 'q1' : 'q2');
  const periodDate =
    record.period_date || getFortnightTransactionDate(year, month, fortnight);

  const payload: Record<string, any> = {
    id: ensureValidUuid(record.id),
    user_id: record.user_id,
    goal_id: ensureValidUuid(record.goal_id),
    amount: Number(record.amount || 0),
    period_date: periodDate,
    status: record.is_skipped ? 'skipped' : 'completed',
    is_skipped: Boolean(record.is_skipped),
    year: Number(year),
    month: Number(month),
    fortnight,
    contribution_date: record.contribution_date || getLocalTodayString(),
    notes: record.notes || '',
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (record.source_type) payload.source_type = record.source_type;
  if (record.source_income_id && isValidUuid(record.source_income_id)) {
    payload.source_income_id = record.source_income_id;
  }
  if (record.source_account_id && isValidUuid(record.source_account_id)) {
    payload.source_account_id = record.source_account_id;
  }

  return payload;
}

export function normalizeSavingContributionRow(row: any): SavingContribution {
  const now = new Date();
  let year = typeof row.year === 'number' ? row.year : undefined;
  let month = typeof row.month === 'number' ? row.month : undefined;
  let fortnight: FortnightType | undefined =
    row.fortnight === 'q1' || row.fortnight === 'q2' ? row.fortnight : undefined;

  if (row.period_date && (year === undefined || month === undefined || !fortnight)) {
    const [yr, mo, dy] = String(row.period_date).split('-').map(Number);
    if (year === undefined && !isNaN(yr) && yr > 2000) year = yr;
    if (month === undefined && !isNaN(mo) && mo >= 1 && mo <= 12) month = mo - 1;
    if (!fortnight && !isNaN(dy)) fortnight = dy <= 15 ? 'q1' : 'q2';
  }

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    goal_id: ensureValidUuid(row.goal_id),
    amount: Number(row.amount || 0),
    year: year ?? now.getFullYear(),
    month: month ?? now.getMonth(),
    fortnight: fortnight ?? 'q1',
    is_skipped: row.is_skipped !== undefined ? Boolean(row.is_skipped) : row.status === 'skipped',
    contribution_date: row.contribution_date || row.period_date || getLocalTodayString(),
    notes: row.notes || '',
    source_type: row.source_type,
    source_income_id: row.source_income_id,
    source_account_id: row.source_account_id,
    sync_status: 'synced',
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------
// Monthly Fixed Overrides (expenses & incomes)
// ---------------------------------------------------------------

export function toSupabaseMonthlyOverridePayload(
  record: Omit<MonthlyFixedOverride, 'sync_status'> & Record<string, any>,
  fallbackUserId?: string
): Record<string, any> {
  const {
    id,
    fixed_expense_id,
    expense_id,
    user_id,
    year,
    month,
    month_year,
    is_active,
    custom_amount,
    amount,
    assumed_by_third_party,
    notes,
  } = record;

  const validId = ensureValidUuid(id);
  const targetExpenseId = ensureValidUuid(fixed_expense_id || expense_id);
  const targetUserId = user_id || fallbackUserId;

  let finalMonthYear = month_year;
  if (!finalMonthYear && typeof year === 'number' && typeof month === 'number') {
    finalMonthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  const payload: Record<string, any> = {
    id: validId,
    expense_id: targetExpenseId,
    month_year: finalMonthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    is_active: is_active !== undefined ? Boolean(is_active) : true,
  };

  if (targetUserId) payload.user_id = targetUserId;

  const numAmount =
    custom_amount !== undefined && custom_amount !== null
      ? Number(custom_amount)
      : amount !== undefined && amount !== null
      ? Number(amount)
      : 0;

  payload.amount = !isNaN(numAmount) ? numAmount : 0;
  if (custom_amount !== undefined && custom_amount !== null && !isNaN(Number(custom_amount))) {
    payload.custom_amount = Number(custom_amount);
  }
  if (assumed_by_third_party !== undefined) {
    payload.assumed_by_third_party = Boolean(assumed_by_third_party);
  }
  if (notes !== undefined && notes !== null) {
    payload.notes = String(notes);
  }

  return payload;
}

export function normalizeMonthlyFixedOverrideRow(row: any): MonthlyFixedOverride {
  let year = typeof row.year === 'number' ? row.year : undefined;
  let month = typeof row.month === 'number' ? row.month : undefined;

  if (row.month_year && (year === undefined || month === undefined)) {
    const [yr, mo] = String(row.month_year).split('-').map(Number);
    if (!isNaN(yr) && yr > 2000) year = yr;
    if (!isNaN(mo) && mo >= 1 && mo <= 12) month = mo - 1;
  }

  const now = new Date();
  const finalYear = year !== undefined ? year : now.getFullYear();
  const finalMonth = month !== undefined ? month : now.getMonth();
  const fixedExpenseId = row.fixed_expense_id || row.expense_id || '';

  const numAmount =
    row.custom_amount !== undefined && row.custom_amount !== null
      ? Number(row.custom_amount)
      : row.amount !== undefined && row.amount !== null
      ? Number(row.amount)
      : 0;

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    fixed_expense_id: fixedExpenseId,
    expense_id: fixedExpenseId,
    year: finalYear,
    month: finalMonth,
    month_year: row.month_year || `${finalYear}-${String(finalMonth + 1).padStart(2, '0')}`,
    amount: !isNaN(numAmount) ? numAmount : 0,
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : true,
    custom_amount:
      row.custom_amount !== undefined && row.custom_amount !== null && !isNaN(Number(row.custom_amount))
        ? Number(row.custom_amount)
        : undefined,
    assumed_by_third_party: Boolean(row.assumed_by_third_party),
    notes: row.notes || '',
    sync_status: 'synced',
  };
}

export function toSupabaseMonthlyIncomeOverridePayload(
  record: Omit<MonthlyFixedIncomeOverride, 'sync_status'> & Record<string, any>,
  fallbackUserId?: string
): Record<string, any> {
  const {
    id,
    fixed_income_id,
    income_id,
    user_id,
    year,
    month,
    month_year,
    is_active,
    custom_amount,
    amount,
    notes,
  } = record;

  const validId = ensureValidUuid(id);
  const targetIncomeId = ensureValidUuid(fixed_income_id || income_id);
  const targetUserId = user_id || fallbackUserId;

  let finalMonthYear = month_year;
  if (!finalMonthYear && typeof year === 'number' && typeof month === 'number') {
    finalMonthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  const payload: Record<string, any> = {
    id: validId,
    income_id: targetIncomeId,
    month_year: finalMonthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    is_active: is_active !== undefined ? Boolean(is_active) : true,
  };

  if (targetUserId) payload.user_id = targetUserId;

  const numAmount =
    custom_amount !== undefined && custom_amount !== null
      ? Number(custom_amount)
      : amount !== undefined && amount !== null
      ? Number(amount)
      : 0;

  payload.amount = !isNaN(numAmount) ? numAmount : 0;
  if (custom_amount !== undefined && custom_amount !== null && !isNaN(Number(custom_amount))) {
    payload.custom_amount = Number(custom_amount);
  }
  if (notes !== undefined && notes !== null) {
    payload.notes = String(notes);
  }

  return payload;
}

export function normalizeMonthlyFixedIncomeOverrideRow(row: any): MonthlyFixedIncomeOverride {
  let year = typeof row.year === 'number' ? row.year : undefined;
  let month = typeof row.month === 'number' ? row.month : undefined;

  if (row.month_year && (year === undefined || month === undefined)) {
    const [yr, mo] = String(row.month_year).split('-').map(Number);
    if (!isNaN(yr) && yr > 2000) year = yr;
    if (!isNaN(mo) && mo >= 1 && mo <= 12) month = mo - 1;
  }

  const now = new Date();
  const finalYear = year !== undefined ? year : now.getFullYear();
  const finalMonth = month !== undefined ? month : now.getMonth();
  const fixedIncomeId = row.fixed_income_id || row.income_id || '';

  const numAmount =
    row.custom_amount !== undefined && row.custom_amount !== null
      ? Number(row.custom_amount)
      : row.amount !== undefined && row.amount !== null
      ? Number(row.amount)
      : 0;

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    fixed_income_id: fixedIncomeId,
    income_id: fixedIncomeId,
    year: finalYear,
    month: finalMonth,
    month_year: row.month_year || `${finalYear}-${String(finalMonth + 1).padStart(2, '0')}`,
    amount: !isNaN(numAmount) ? numAmount : 0,
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : true,
    custom_amount:
      row.custom_amount !== undefined && row.custom_amount !== null && !isNaN(Number(row.custom_amount))
        ? Number(row.custom_amount)
        : undefined,
    notes: row.notes || '',
    sync_status: 'synced',
  };
}

// ---------------------------------------------------------------
// Variable Income & Variable Expense
// ---------------------------------------------------------------

export function toSupabaseVariableIncomePayload(
  record: VariableIncome & Record<string, any>,
  userId?: string
): Record<string, any> {
  const validAccountId = record.account_id && isValidUuid(record.account_id) ? record.account_id : null;
  const fortnight: FortnightType =
    record.fortnight === 'q2' || (record.fortnight as any) === 30 ? 'q2' : 'q1';

  return {
    id: ensureValidUuid(record.id),
    user_id: userId || record.user_id,
    name: record.description || (record as any).name || 'Ingreso Variable',
    description: record.description || (record as any).name || 'Ingreso Variable',
    amount: Number(record.amount),
    currency: record.currency || 'USD',
    quincena: fortnight === 'q1' ? 15 : 30,
    fortnight,
    year: Number(record.year),
    month: Number(record.month),
    month_year: `${record.year}-${String(record.month + 1).padStart(2, '0')}`,
    category_id: getPreferredCategoryRef(record.category_id, 'income'),
    account_id: validAccountId,
    notes: record.notes || '',
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function normalizeVariableIncomeRow(row: any): VariableIncome {
  const [yr, mo] = String(row.month_year || '').split('-').map(Number);
  const now = new Date();
  const year = typeof row.year === 'number' ? row.year : !isNaN(yr) && yr > 2000 ? yr : now.getFullYear();
  const month =
    typeof row.month === 'number'
      ? row.month
      : !isNaN(mo) && mo >= 1 && mo <= 12
      ? mo - 1
      : now.getMonth();
  const fortnight: FortnightType =
    row.quincena === 30 || row.fortnight === 'q2' || row.quincena === '30' ? 'q2' : 'q1';

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    description: row.description || row.name || 'Ingreso Variable',
    amount: Number(row.amount || 0),
    year,
    month,
    fortnight,
    category_id: row.category_id || 'cat_extras',
    account_id: row.account_id || '',
    currency: row.currency || 'USD',
    notes: row.notes || '',
    sync_status: 'synced',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export function toSupabaseVariableExpensePayload(
  record: VariableExpense & Record<string, any>,
  userId?: string
): Record<string, any> {
  return {
    id: ensureValidUuid(record.id),
    user_id: userId || record.user_id,
    description: (record.description || '').trim() || 'Gasto Variable',
    amount: Number(record.amount || 0),
    original_amount:
      record.original_amount !== undefined ? Number(record.original_amount) : Number(record.amount || 0),
    payment_mode: record.payment_mode || 'usd_cash',
    year: Number(record.year),
    month: Number(record.month),
    fortnight: record.fortnight === 'q2' ? 'q2' : 'q1',
    category_id: getPreferredCategoryRef(record.category_id, 'expense'),
    account_id: record.account_id || null,
    currency: record.currency || 'USD',
    notes: record.notes || '',
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function normalizeVariableExpenseRow(row: any): VariableExpense {
  const now = new Date();
  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    description: row.description || 'Gasto Variable',
    amount: Number(row.amount || 0),
    original_amount: row.original_amount !== undefined ? Number(row.original_amount) : Number(row.amount || 0),
    payment_mode: row.payment_mode || 'usd_cash',
    year: typeof row.year === 'number' ? row.year : now.getFullYear(),
    month: typeof row.month === 'number' ? row.month : now.getMonth(),
    fortnight: row.fortnight === 'q2' ? 'q2' : 'q1',
    category_id: row.category_id || 'cat_other_exp',
    account_id: row.account_id || undefined,
    currency: row.currency || 'USD',
    notes: row.notes || '',
    sync_status: 'synced',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------

export function toSupabaseTransactionPayload(
  record: Omit<Transaction, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const safeCategory = getSafeSupabaseCategoryId(
    record.category_id,
    record.type === 'income' ? 'income' : 'expense',
    record.description
  );
  const validAccountId = record.account_id && isValidUuid(record.account_id) ? record.account_id : null;
  const cleanId = ensureValidUuid(record.id);

  return {
    id: cleanId,
    user_id: record.user_id,
    amount: Number(record.amount),
    type: record.type || 'expense',
    description: record.description || 'Transacción',
    category_id: safeCategory,
    account_id: validAccountId,
    transaction_date: record.transaction_date || getLocalTodayString(),
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// Fixed Incomes & Fixed Expenses (alineados a schema text 'q1'|'q2'|'both')
// ---------------------------------------------------------------

function normalizeDbDefaultFortnight(val: any, notes?: string): 'q1' | 'q2' | 'both' {
  if (val === 'q1' || val === 15 || val === '15') return 'q1';
  if (val === 'q2' || val === 30 || val === '30') return 'q2';
  if (notes && notes.includes('[split]')) return 'both';
  return 'both';
}

export function toSupabaseFixedIncomePayload(
  record: Omit<FixedIncome, 'sync_status'> & Record<string, any>,
  userId?: string
): Record<string, any> {
  const targetUserId = userId || record.user_id;
  const cleanId = ensureValidUuid(record.id);

  const rawNotes = record.notes || '';
  const cleanNotes = rawNotes.replace(/\s*\[split\]/g, '').trim();
  const isSplit = record.default_fortnight === 'split' || (record.default_fortnight as any) === 50;
  const notesWithTag = isSplit ? (cleanNotes ? `${cleanNotes} [split]` : '[split]') : cleanNotes;

  const dbDefaultFortnight = normalizeDbDefaultFortnight(record.default_fortnight, notesWithTag);
  const safeCategory = getPreferredCategoryRef(record.category_id, 'income');

  const payload: Record<string, any> = {
    id: cleanId,
    name: (record.name || '').trim(),
    amount: Number(record.amount) || 0,
    currency: record.currency || 'USD',
    default_fortnight: dbDefaultFortnight,
    quincena: dbDefaultFortnight === 'q1' ? 15 : dbDefaultFortnight === 'q2' ? 30 : null,
    category_id: safeCategory,
    is_active: record.is_active !== undefined ? Boolean(record.is_active) : true,
    notes: notesWithTag,
    payment_mode: record.payment_mode || 'usd_cash',
    original_amount:
      record.original_amount !== undefined ? Number(record.original_amount) : Number(record.amount) || 0,
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (targetUserId) payload.user_id = targetUserId;
  return payload;
}

export function toSupabaseFixedExpensePayload(
  record: Omit<FixedExpense, 'sync_status'> & Record<string, any>,
  userId?: string
): Record<string, any> {
  const targetUserId = userId || record.user_id;
  const cleanId = ensureValidUuid(record.id);
  const dbDefaultFortnight = normalizeDbDefaultFortnight(record.default_fortnight);
  const safeCategory = getPreferredCategoryRef(record.category_id, 'expense');

  const payload: Record<string, any> = {
    id: cleanId,
    name: (record.name || '').trim(),
    amount: Number(record.amount) || 0,
    currency: record.currency || 'USD',
    default_fortnight: dbDefaultFortnight,
    category_id: safeCategory,
    is_active: record.is_active !== undefined ? Boolean(record.is_active) : true,
    notes: record.notes || '',
    payment_mode: record.payment_mode || 'ves_bcv',
    original_amount:
      record.original_amount !== undefined ? Number(record.original_amount) : Number(record.amount) || 0,
    amount_usd: record.amount_usd !== undefined ? Number(record.amount_usd) : Number(record.amount) || 0,
    amount_in_ves: record.amount_in_ves !== undefined ? Number(record.amount_in_ves) : undefined,
    assumed_by_third_party: Boolean(record.assumed_by_third_party),
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (targetUserId) payload.user_id = targetUserId;
  return payload;
}

// ---------------------------------------------------------------
// Planning Notes (UUID id + serialized JSON in `content`)
// ---------------------------------------------------------------

export function getPlanningNoteUuid(userId: string, year: number, month: number): string {
  return ensureValidUuid(`pn_${userId}_${year}_${month}`);
}

export function toSupabasePlanningNotePayload(note: PlanningNote): Record<string, any> {
  const uid = note.user_id || getActiveUserId();
  return {
    id: ensureValidUuid(note.id || getPlanningNoteUuid(uid, note.year, note.month)),
    user_id: uid,
    title: `${note.year}-${String(note.month + 1).padStart(2, '0')}`,
    content: JSON.stringify({
      notes: note.notes || '',
      tasks: Array.isArray(note.tasks) ? note.tasks : [],
    }),
    year: Number(note.year),
    month: Number(note.month),
    created_at: note.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function normalizePlanningNoteRow(row: any): PlanningNote {
  const now = new Date();
  let parsedNotes = '';
  let parsedTasks: PlanningTask[] = [];

  if (typeof row.notes === 'string' || Array.isArray(row.tasks)) {
    parsedNotes = row.notes || '';
    parsedTasks = Array.isArray(row.tasks) ? row.tasks : [];
  } else if (typeof row.content === 'string' && row.content.trim().length > 0) {
    try {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === 'object' && ('notes' in parsed || 'tasks' in parsed)) {
        parsedNotes = typeof parsed.notes === 'string' ? parsed.notes : '';
        parsedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      } else {
        parsedNotes = row.content;
      }
    } catch {
      parsedNotes = row.content;
    }
  }

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    year: typeof row.year === 'number' ? row.year : now.getFullYear(),
    month: typeof row.month === 'number' ? row.month : now.getMonth(),
    notes: parsedNotes,
    tasks: parsedTasks,
    sync_status: 'synced',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------
// Fortnight Helpers
// ---------------------------------------------------------------

export function fortnightToInt(fortnight: FortnightType | string | number | null | undefined): number | null {
  if (fortnight === 'q1' || fortnight === 15 || fortnight === '15') return 15;
  if (fortnight === 'q2' || fortnight === 30 || fortnight === '30') return 30;
  if (fortnight === 'split' || fortnight === 50 || fortnight === '50') return 50;
  return null;
}

// ---------------------------------------------------------------
// Debts Payload & Row Normalizer
// ---------------------------------------------------------------

export function sanitizeDebtPayload(
  debt: Partial<Debt> & Record<string, any>,
  fallbackUserId?: string
): Record<string, any> {
  const uid = debt.user_id || fallbackUserId || getActiveUserId();
  const current_balance =
    debt.current_balance !== undefined ? Number(debt.current_balance) : Number(debt.total_amount || 0);
  const status = current_balance <= 0 ? 'paid' : debt.status === 'paid' ? 'paid' : 'active';
  const now = new Date();
  const start_year = debt.start_year !== undefined ? Number(debt.start_year) : now.getFullYear();
  const start_month = debt.start_month !== undefined ? Number(debt.start_month) : now.getMonth();
  const start_fortnight = debt.start_fortnight || (now.getDate() <= 15 ? 'q1' : 'q2');

  const creditorValue = debt.creditor || debt.creditor_name || debt.name || 'Deuda';
  const totalAmount = Number(debt.total_amount || 0);

  const payload: Record<string, any> = {
    id: ensureValidUuid(debt.id),
    user_id: uid,
    creditor_name: creditorValue,
    creditor: creditorValue,
    name: creditorValue,
    platform: debt.platform || 'particular',
    debt_mode: debt.debt_mode || 'installments',
    total_amount: totalAmount,
    original_amount: debt.original_amount !== undefined ? Number(debt.original_amount) : totalAmount,
    remaining_amount: current_balance,
    current_balance,
    status,
    currency_type: debt.currency_type || debt.currency || 'USD',
    payment_type: debt.payment_type || 'bcv_usd',
    payment_mode: debt.payment_mode || debt.payment_type || 'bcv_usd',
    start_year,
    start_month,
    start_fortnight,
    fortnight_due: debt.fortnight_due || 'q1',
    has_interest: Boolean(debt.has_interest),
    interest_rate: debt.interest_rate !== undefined ? Number(debt.interest_rate) : 0,
    interest_amount: debt.interest_amount !== undefined ? Number(debt.interest_amount) : 0,
    interest_frequency: debt.interest_frequency,
    interest_fortnight: debt.interest_fortnight,
    due_date: debt.due_date,
    due_day: debt.due_day !== undefined && !isNaN(Number(debt.due_day)) ? Number(debt.due_day) : undefined,
    due_day_2: debt.due_day_2 !== undefined && !isNaN(Number(debt.due_day_2)) ? Number(debt.due_day_2) : undefined,
    notes: debt.notes || '',
    created_at: debt.created_at || now.toISOString(),
    updated_at: now.toISOString(),
  };

  if (debt.initial_payment !== undefined && debt.initial_payment !== null) {
    payload.initial_payment = Number(debt.initial_payment);
  }
  if (debt.total_installments !== undefined && debt.total_installments !== null) {
    payload.total_installments = Number(debt.total_installments);
  }
  if (debt.pending_installments !== undefined && debt.pending_installments !== null) {
    payload.pending_installments = Number(debt.pending_installments);
  }
  if (debt.installment_amount !== undefined && debt.installment_amount !== null) {
    payload.installment_amount = Number(debt.installment_amount);
  }
  if (debt.priority) {
    payload.priority = debt.priority;
  }

  return payload;
}

export function normalizeDebtRow(row: any): Debt {
  const current_balance = Number(row.current_balance ?? row.remaining_amount ?? row.total_amount ?? 0);
  const status = row.status === 'paid' || current_balance <= 0 ? 'paid' : row.status || 'active';

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    creditor: row.creditor_name || row.creditor || row.name || 'Deuda',
    creditor_name: row.creditor_name || row.creditor || 'Deuda',
    name: row.name || row.creditor || row.creditor_name || 'Deuda',
    platform: row.platform || 'particular',
    debt_mode: row.debt_mode || 'installments',
    total_amount: Number(row.total_amount ?? row.original_amount ?? 0),
    original_amount: Number(row.original_amount ?? row.total_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? row.current_balance ?? 0),
    initial_payment: row.initial_payment !== undefined ? Number(row.initial_payment) : undefined,
    current_balance,
    total_installments: row.total_installments !== undefined ? Number(row.total_installments) : undefined,
    pending_installments: row.pending_installments !== undefined ? Number(row.pending_installments) : undefined,
    installment_amount: row.installment_amount !== undefined ? Number(row.installment_amount) : undefined,
    fortnight_due: row.fortnight_due || 'q1',
    start_year: row.start_year !== undefined ? Number(row.start_year) : undefined,
    start_month: row.start_month !== undefined ? Number(row.start_month) : undefined,
    start_fortnight: row.start_fortnight,
    currency: (row.currency || row.currency_type || 'USD') as 'USD' | 'EUR' | 'VES',
    currency_type: row.currency_type || row.currency || 'USD',
    payment_type: row.payment_type || 'bcv_usd',
    payment_mode: row.payment_mode || row.payment_type || 'bcv_usd',
    has_interest: Boolean(row.has_interest),
    interest_rate: row.interest_rate !== undefined ? Number(row.interest_rate) : undefined,
    interest_amount: row.interest_amount !== undefined ? Number(row.interest_amount) : undefined,
    interest_frequency: row.interest_frequency,
    interest_fortnight: row.interest_fortnight,
    due_date: row.due_date,
    due_day: row.due_day !== undefined && row.due_day !== null ? Number(row.due_day) : undefined,
    due_day_2: row.due_day_2 !== undefined && row.due_day_2 !== null ? Number(row.due_day_2) : undefined,
    status,
    priority: row.priority || 'medium',
    notes: row.notes || '',
    sync_status: 'synced',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
