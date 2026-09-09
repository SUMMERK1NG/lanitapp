/**
 * Módulo centralizado de conversión de payloads Frontend → Supabase
 *
 * Este módulo resuelve las discrepancias de nombres de columnas, tipos de datos
 * y formatos entre los modelos internos de Dexie y el esquema real de PostgreSQL.
 */

import type {
  DebtPayment,
  FortnightItemState,
  SavingContribution,
  MonthlyFixedOverride,
  MonthlyFixedIncomeOverride,
  FixedIncome,
  FixedExpense,
  VariableIncome,
  Transaction,
  FortnightType,
} from '../types/index.ts';
import { isValidUuid, ensureValidUuid } from '../utils/uuid.ts';

// ---------------------------------------------------------------
// Category ID Mapping: string IDs (Dexie) → UUID (Supabase)
// ---------------------------------------------------------------

export const KNOWN_SUPABASE_CATEGORIES = Object.freeze({
  cat_salary: '7b49253e-71c2-4964-913a-6251c13368f3',
  cat_transport: '82d3d710-c994-49ed-946e-218f8843286f',
  cat_services: 'ac794f8c-dafa-447b-9760-f51e59feaff1',
  cat_health: 'c2da59c8-57f3-4df5-9db5-1d6cf0530d1c',
  cat_extras: 'c62ff42c-437d-4589-bb39-1ec558197a7b',
  cat_food: 'e512d7b8-f1b6-47d5-b5d3-a1eb6342bd94',
});

// Set inmutable con los únicos 6 UUIDs válidos existentes en PostgreSQL public.categories
const STRICT_SUPABASE_CATEGORY_UUIDS = new Set<string>(Object.values(KNOWN_SUPABASE_CATEGORIES));

export function isKnownSupabaseCategory(uuid?: string | null): boolean {
  if (!uuid) return false;
  return STRICT_SUPABASE_CATEGORY_UUIDS.has(uuid);
}

/** Cache of category mappings: local ID / code / name -> real Supabase UUID */
const categoryMap: Map<string, string> = new Map();

function initCategoryMap() {
  categoryMap.clear();
  categoryMap.set('cat_salary', KNOWN_SUPABASE_CATEGORIES.cat_salary);
  categoryMap.set('cat_bonus', KNOWN_SUPABASE_CATEGORIES.cat_salary);
  categoryMap.set('cat_guard', KNOWN_SUPABASE_CATEGORIES.cat_salary);
  categoryMap.set('cat_extras', KNOWN_SUPABASE_CATEGORIES.cat_extras);
  categoryMap.set('cat_savings', KNOWN_SUPABASE_CATEGORIES.cat_extras);
  categoryMap.set('cat_entertainment', KNOWN_SUPABASE_CATEGORIES.cat_extras);
  categoryMap.set('cat_transport', KNOWN_SUPABASE_CATEGORIES.cat_transport);
  categoryMap.set('cat_services', KNOWN_SUPABASE_CATEGORIES.cat_services);
  categoryMap.set('cat_housing', KNOWN_SUPABASE_CATEGORIES.cat_services);
  categoryMap.set('cat_debt', KNOWN_SUPABASE_CATEGORIES.cat_services);
  categoryMap.set('cat_other_exp', KNOWN_SUPABASE_CATEGORIES.cat_services);
  categoryMap.set('cat_health', KNOWN_SUPABASE_CATEGORIES.cat_health);
  categoryMap.set('cat_food', KNOWN_SUPABASE_CATEGORIES.cat_food);
  categoryMap.set('cat_tickets', KNOWN_SUPABASE_CATEGORIES.cat_food);

  for (const uuid of STRICT_SUPABASE_CATEGORY_UUIDS) {
    categoryMap.set(uuid, uuid);
  }
}
initCategoryMap();

/**
 * Deduce el UUID real de Supabase a partir de código, nombre o tipo
 */
export function matchToRealSupabaseUuid(code?: string, name?: string, type?: string): string {
  if (code) {
    const fromCode = categoryMap.get(code);
    if (fromCode && STRICT_SUPABASE_CATEGORY_UUIDS.has(fromCode)) return fromCode;
  }
  const n = (name || '').toLowerCase();
  if (n.includes('gasolin') || n.includes('trans') || n.includes('combust') || n.includes('moto') || n.includes('carro')) {
    return KNOWN_SUPABASE_CATEGORIES.cat_transport;
  }
  if (n.includes('comid') || n.includes('mercado') || n.includes('alimen') || n.includes('super')) {
    return KNOWN_SUPABASE_CATEGORIES.cat_food;
  }
  if (n.includes('salud') || n.includes('medic') || n.includes('farma') || n.includes('clinic')) {
    return KNOWN_SUPABASE_CATEGORIES.cat_health;
  }
  if (n.includes('condominio') || n.includes('alquiler') || n.includes('servicio') || n.includes('vivienda') || n.includes('luz') || n.includes('agua') || n.includes('internet') || n.includes('fibra')) {
    return KNOWN_SUPABASE_CATEGORIES.cat_services;
  }
  if (type === 'income' || n.includes('sueldo') || n.includes('salario') || n.includes('nomina')) {
    if (type === 'income' || (!n.includes('gasto') && !n.includes('pago'))) {
      return KNOWN_SUPABASE_CATEGORIES.cat_salary;
    }
  }
  if (n.includes('extra') || n.includes('ahorro') || n.includes('freelance') || n.includes('ocio')) {
    return KNOWN_SUPABASE_CATEGORIES.cat_extras;
  }
  return type === 'income' ? KNOWN_SUPABASE_CATEGORIES.cat_salary : KNOWN_SUPABASE_CATEGORIES.cat_services;
}

/**
 * Registra categorías en el mapa garantizando que SIEMPRE apunten a uno de los 6 UUIDs reales de Supabase.
 * JAMÁS agrega UUIDs locales a la lista de UUIDs válidos de Supabase.
 */
export function setCategoryMap(categories: Array<{ id: string; name: string; type?: string; code?: string }>) {
  for (const cat of categories) {
    if (STRICT_SUPABASE_CATEGORY_UUIDS.has(cat.id)) {
      categoryMap.set(cat.id, cat.id);
      if (cat.code) categoryMap.set(cat.code, cat.id);
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    } else {
      // Categoría local de Dexie: mapear su ID al UUID real de Supabase
      const realUuid = matchToRealSupabaseUuid(cat.code, cat.name, cat.type);
      categoryMap.set(cat.id, realUuid);
      if (cat.code) categoryMap.set(cat.code, realUuid);
      categoryMap.set(cat.name.toLowerCase(), realUuid);
    }
  }
}

/** Resolve a category_id: returns ONLY a known valid Supabase UUID or undefined */
export function resolveCategoryId(localId?: string): string | undefined {
  if (!localId) return undefined;
  if (STRICT_SUPABASE_CATEGORY_UUIDS.has(localId)) {
    return localId;
  }
  if (categoryMap.has(localId)) {
    const res = categoryMap.get(localId);
    if (res && STRICT_SUPABASE_CATEGORY_UUIDS.has(res)) return res;
  }
  const lower = localId.toLowerCase();
  for (const [key, uuid] of categoryMap.entries()) {
    if (key.toLowerCase() === lower && STRICT_SUPABASE_CATEGORY_UUIDS.has(uuid)) {
      return uuid;
    }
  }
  return undefined;
}

/**
 * Garantiza un UUID de categoría 100% válido y existente en la tabla categories de Supabase.
 * Previene el error PostgreSQL 23503 (violación de clave foránea transactions_category_id_fkey / 409 Conflict).
 */
export function getSafeSupabaseCategoryId(
  categoryId?: string | null,
  fallbackType: 'income' | 'expense' = 'expense',
  description?: string
): string {
  if (categoryId) {
    if (STRICT_SUPABASE_CATEGORY_UUIDS.has(categoryId)) {
      return categoryId;
    }
    const resolved = resolveCategoryId(categoryId);
    if (resolved && STRICT_SUPABASE_CATEGORY_UUIDS.has(resolved)) {
      return resolved;
    }
  }
  if (description) {
    const fromDesc = matchToRealSupabaseUuid(undefined, description, fallbackType);
    if (fromDesc && STRICT_SUPABASE_CATEGORY_UUIDS.has(fromDesc)) {
      return fromDesc;
    }
  }
  return fallbackType === 'income'
    ? KNOWN_SUPABASE_CATEGORIES.cat_salary
    : KNOWN_SUPABASE_CATEGORIES.cat_services;
}

/** Check if the category map has been populated */
export function isCategoryMapReady(): boolean {
  return categoryMap.size > 0;
}

// ---------------------------------------------------------------
// Debt Payments
// ---------------------------------------------------------------

/**
 * Convert DebtPayment from frontend format to Supabase format.
 * - Renames `amount` → `amount_paid`
 * - Removes `year`, `month`, `fortnight` (not in DB schema)
 */
export function toSupabaseDebtPaymentPayload(
  record: Omit<DebtPayment, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const {
    amount,
    year,
    month,
    fortnight,
    amount_in_bs: _aib,
    loss_differential: _ld,
    ...rest
  } = record;

  const payload: Record<string, any> = {
    ...rest,
    amount_paid: Number(amount),
  };

  // Include optional numeric fields only if they have values
  if (record.rate_applied !== undefined && record.rate_applied !== null) {
    payload.rate_applied = Number(record.rate_applied);
  }
  if (record.parallel_rate !== undefined && record.parallel_rate !== null) {
    payload.parallel_rate = Number(record.parallel_rate);
  }
  if (_aib !== undefined && _aib !== null) {
    payload.amount_in_bs = Number(_aib);
  }
  if (_ld !== undefined && _ld !== null) {
    payload.loss_differential = Number(_ld);
  }

  return payload;
}

// ---------------------------------------------------------------
// Fortnight Item States
// ---------------------------------------------------------------

/**
 * Convert FortnightItemState to Supabase format.
 * - Ensures id, item_id, transaction_id are strictly valid deterministic UUIDs
 * - Removes local-only columns: year, month, fortnight, sync_status (avoids PGRST204)
 */
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

// ---------------------------------------------------------------
// Saving Contributions
// ---------------------------------------------------------------

/**
 * Convert SavingContribution to Supabase format.
 * - Renames `contribution_date` → `period_date`
 * - Converts `is_skipped` → `status` ('skipped' | 'completed')
 * - Removes `year`, `month`, `fortnight`
 */
export function toSupabaseSavingContributionPayload(
  record: Omit<SavingContribution, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const {
    contribution_date,
    is_skipped,
    year,
    month,
    fortnight,
    ...rest
  } = record;

  return {
    ...rest,
    period_date: contribution_date || new Date().toISOString().split('T')[0],
    status: is_skipped ? 'skipped' : 'completed',
  };
}

// ---------------------------------------------------------------
// Monthly Fixed Overrides (expenses)
// ---------------------------------------------------------------

/**
 * Convert MonthlyFixedOverride to Supabase format.
 * - Ensures valid UUID for `id`
 * - Renames `fixed_expense_id` → `expense_id` (valid UUID)
 * - Sets `user_id` (valid UUID)
 * - Converts `year` and `month` → `month_year` ('YYYY-MM')
 * - Ensures `is_active` is boolean
 * - Ensures `custom_amount` / `amount` are numbers if present
 * - Strips local-only fields
 */
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

  if (targetUserId) {
    payload.user_id = targetUserId;
  }

  const numAmount = custom_amount !== undefined && custom_amount !== null
    ? Number(custom_amount)
    : amount !== undefined && amount !== null
    ? Number(amount)
    : undefined;

  if (numAmount !== undefined && !isNaN(numAmount)) {
    payload.custom_amount = numAmount;
    payload.amount = numAmount;
  }

  if (assumed_by_third_party !== undefined) {
    payload.assumed_by_third_party = Boolean(assumed_by_third_party);
  }

  if (notes !== undefined && notes !== null) {
    payload.notes = String(notes);
  }

  return payload;
}

/**
 * Normaliza un registro remoto de Supabase `monthly_fixed_overrides` a la interfaz local `MonthlyFixedOverride`.
 */
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

  const numAmount = row.custom_amount !== undefined && row.custom_amount !== null
    ? Number(row.custom_amount)
    : row.amount !== undefined && row.amount !== null
    ? Number(row.amount)
    : undefined;

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    fixed_expense_id: fixedExpenseId,
    year: finalYear,
    month: finalMonth,
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : true,
    custom_amount: numAmount !== undefined && !isNaN(numAmount) ? numAmount : undefined,
    assumed_by_third_party: Boolean(row.assumed_by_third_party),
    notes: row.notes || '',
    sync_status: (row.sync_status as any) || 'synced',
  };
}

// ---------------------------------------------------------------
// Monthly Fixed Income Overrides
// ---------------------------------------------------------------

/**
 * Convert MonthlyFixedIncomeOverride to Supabase format.
 * - Ensures valid UUID for `id`
 * - Renames `fixed_income_id` → `income_id` (valid UUID)
 * - Sets `user_id` (valid UUID)
 * - Converts `year` and `month` → `month_year` ('YYYY-MM')
 * - Ensures `is_active` is boolean
 * - Ensures `custom_amount` / `amount` are numbers if present
 * - Strips local-only fields
 */
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

  if (targetUserId) {
    payload.user_id = targetUserId;
  }

  const numAmount = custom_amount !== undefined && custom_amount !== null
    ? Number(custom_amount)
    : amount !== undefined && amount !== null
    ? Number(amount)
    : undefined;

  if (numAmount !== undefined && !isNaN(numAmount)) {
    payload.custom_amount = numAmount;
    payload.amount = numAmount;
  }

  if (notes !== undefined && notes !== null) {
    payload.notes = String(notes);
  }

  return payload;
}

/**
 * Normaliza un registro remoto de Supabase `monthly_fixed_income_overrides` a la interfaz local `MonthlyFixedIncomeOverride`.
 */
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

  const numAmount = row.custom_amount !== undefined && row.custom_amount !== null
    ? Number(row.custom_amount)
    : row.amount !== undefined && row.amount !== null
    ? Number(row.amount)
    : undefined;

  return {
    id: ensureValidUuid(row.id),
    user_id: row.user_id,
    fixed_income_id: fixedIncomeId,
    year: finalYear,
    month: finalMonth,
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : true,
    custom_amount: numAmount !== undefined && !isNaN(numAmount) ? numAmount : undefined,
    notes: row.notes || '',
    sync_status: (row.sync_status as any) || 'synced',
  };
}

// ---------------------------------------------------------------
// Variable Income
// ---------------------------------------------------------------

/**
 * Convert VariableIncome to Supabase format.
 * - Renames `description` → `name`
 * - Converts `fortnight` → `quincena` (integer 15 or 30)
 * - Combines `year` + `month` → `month_year` (string "YYYY-MM")
 * - Removes `category_id`, `account_id`, `notes`, `original_amount`,
 *   `payment_mode`, `transaction_id` (not in DB schema)
 */
export function toSupabaseVariableIncomePayload(
  record: VariableIncome & Record<string, any>,
  userId?: string
): Record<string, any> {
  return {
    id: record.id,
    user_id: userId || record.user_id,
    name: record.description || (record as any).name || 'Ingreso Variable',
    amount: Number(record.amount),
    currency: record.currency || 'USD',
    quincena: record.fortnight === 'q1' || (record.fortnight as any) === 15 ? 15 : 30,
    month_year: `${record.year}-${String(record.month + 1).padStart(2, '0')}`,
    created_at: record.created_at || new Date().toISOString(),
    updated_at: record.updated_at || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------

/**
 * Convert Transaction to Supabase format.
 * - Asegura que `id` sea un UUID válido estricto (evita prefijos locales como 'tx_')
 * - Resuelve `category_id` a UUID válido o null (evita enviar strings como 'cat_debt' que causan error 400 22P02)
 * - Asegura que `account_id` sea UUID válido o null
 * - Filtra únicamente columnas existentes en la tabla PostgreSQL transactions
 */
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
    transaction_date: record.transaction_date || new Date().toISOString().split('T')[0],
    created_at: record.created_at || new Date().toISOString(),
    updated_at: record.updated_at || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// Fixed Incomes
// ---------------------------------------------------------------

/**
 * Convert FixedIncome from frontend/Dexie format to Supabase format.
 * - Resolves category_id to UUID (or null if not found)
 * - Converts default_fortnight ('q1' -> 15, 'q2' -> 30, 'split' -> 50, 'both' -> null)
 * - Removes local-only columns: due_day, due_day_2, sync_status (avoids PGRST204)
 * - Retains strictly existing PostgreSQL columns: id, user_id, name, amount, currency,
 *   default_fortnight, category_id, is_active, notes, payment_mode, original_amount, created_at, updated_at
 */
export function toSupabaseFixedIncomePayload(
  record: Omit<FixedIncome, 'sync_status'> & Record<string, any>,
  userId?: string
): Record<string, any> {
  const targetUserId = userId || record.user_id;
  const cleanId = ensureValidUuid(record.id);

  let defaultFortnight: number | null = null;
  if (record.default_fortnight === 'q1' || (record.default_fortnight as any) === 15 || (record.default_fortnight as any) === '15') {
    defaultFortnight = 15;
  } else if (record.default_fortnight === 'q2' || (record.default_fortnight as any) === 30 || (record.default_fortnight as any) === '30') {
    defaultFortnight = 30;
  } else if (record.default_fortnight === 'split' || (record.default_fortnight as any) === 50 || (record.default_fortnight as any) === '50') {
    defaultFortnight = 50;
  }

  const rawNotes = record.notes || '';
  const cleanNotes = rawNotes.replace(/\s*\[split\]/g, '').trim();
  const isSplit = record.default_fortnight === 'split' || defaultFortnight === 50;
  const notesWithTag = isSplit ? (cleanNotes ? `${cleanNotes} [split]` : '[split]') : cleanNotes;

  const safeCategory = getSafeSupabaseCategoryId(record.category_id, 'income');

  const payload: Record<string, any> = {
    id: cleanId,
    name: (record.name || '').trim(),
    amount: Number(record.amount) || 0,
    currency: record.currency || 'USD',
    default_fortnight: defaultFortnight,
    category_id: safeCategory,
    is_active: record.is_active !== undefined ? Boolean(record.is_active) : true,
    notes: notesWithTag,
    payment_mode: record.payment_mode || 'usd_cash',
    original_amount: record.original_amount !== undefined ? Number(record.original_amount) : Number(record.amount) || 0,
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (targetUserId) {
    payload.user_id = targetUserId;
  }

  return payload;
}

// ---------------------------------------------------------------
// Fixed Expenses
// ---------------------------------------------------------------

/**
 * Convert FixedExpense from frontend/Dexie format to Supabase format.
 * - Resolves category_id to UUID (or null if not found)
 * - Converts default_fortnight ('q1' -> 15, 'q2' -> 30, 'both' -> null)
 * - Explicitly strips local-only columns: quincena, due_day, due_day_2, default_quincena, sync_status (avoids PGRST204)
 * - Retains strictly existing PostgreSQL columns: id, user_id, name, amount, currency,
 *   default_fortnight, category_id, is_active, notes, payment_mode, original_amount,
 *   amount_usd, amount_in_ves, assumed_by_third_party, created_at, updated_at
 */
export function toSupabaseFixedExpensePayload(
  record: Omit<FixedExpense, 'sync_status'> & Record<string, any>,
  userId?: string
): Record<string, any> {
  const targetUserId = userId || record.user_id;
  const cleanId = ensureValidUuid(record.id);

  let defaultFortnight: number | null = null;
  if (record.default_fortnight === 'q1' || (record.default_fortnight as any) === 15 || (record.default_fortnight as any) === '15') {
    defaultFortnight = 15;
  } else if (record.default_fortnight === 'q2' || (record.default_fortnight as any) === 30 || (record.default_fortnight as any) === '30') {
    defaultFortnight = 30;
  }

  const safeCategory = getSafeSupabaseCategoryId(record.category_id, 'expense');

  const payload: Record<string, any> = {
    id: cleanId,
    name: (record.name || '').trim(),
    amount: Number(record.amount) || 0,
    currency: record.currency || 'USD',
    default_fortnight: defaultFortnight,
    category_id: safeCategory,
    is_active: record.is_active !== undefined ? Boolean(record.is_active) : true,
    notes: record.notes || '',
    payment_mode: record.payment_mode || 'ves_bcv',
    original_amount: record.original_amount !== undefined ? Number(record.original_amount) : Number(record.amount) || 0,
    amount_usd: record.amount_usd !== undefined ? Number(record.amount_usd) : Number(record.amount) || 0,
    amount_in_ves: record.amount_in_ves !== undefined ? Number(record.amount_in_ves) : undefined,
    assumed_by_third_party: Boolean(record.assumed_by_third_party),
    created_at: record.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (targetUserId) {
    payload.user_id = targetUserId;
  }

  return payload;
}

// ---------------------------------------------------------------
// Fortnight Helpers
// ---------------------------------------------------------------

/** Convert frontend fortnight ('q1'/'q2') to Supabase integer (15/30) */
export function fortnightToInt(fortnight: FortnightType | string | number | null | undefined): number | null {
  if (fortnight === 'q1' || fortnight === 15 || fortnight === '15') return 15;
  if (fortnight === 'q2' || fortnight === 30 || fortnight === '30') return 30;
  if (fortnight === 'split' || fortnight === 50 || fortnight === '50') return 50;
  return null;
}

