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
  VariableIncome,
  Transaction,
  FortnightType,
} from '../types/index.ts';
import { isValidUuid, ensureValidUuid } from '../utils/uuid.ts';

// ---------------------------------------------------------------
// Category ID Mapping: string IDs (Dexie) → UUID (Supabase)
// ---------------------------------------------------------------

/** Cache of Supabase category UUIDs keyed by local string IDs */
let categoryMap: Map<string, string> = new Map();

/** Populate category mapping from Supabase data */
export function setCategoryMap(supabaseCategories: Array<{ id: string; name: string; type: string }>) {
  categoryMap.clear();

  // Build a name-based lookup for approximate matching
  const nameIndex = new Map<string, string>();
  for (const cat of supabaseCategories) {
    nameIndex.set(cat.name.toLowerCase(), cat.id);
  }

  // Map each hardcoded local category ID to the best matching Supabase UUID
  const localToName: Record<string, string[]> = {
    cat_housing: ['vivienda', 'alquiler', 'servicios / hogar'],
    cat_food: ['comida', 'supermercado', 'alimentación'],
    cat_services: ['servicios', 'fibra', 'servicios / hogar'],
    cat_transport: ['transporte', 'gasolina', 'combustible'],
    cat_debt: ['deuda', 'cuotas', 'pago de deudas'],
    cat_health: ['salud', 'farmacia', 'medicina'],
    cat_entertainment: ['ocio', 'salidas', 'entretenimiento'],
    cat_savings: ['ahorro', 'metas'],
    cat_other_exp: ['otros', 'gastos'],
    cat_salary: ['sueldo', 'salario', 'ingresos'],
    cat_bonus: ['plus', 'bonos', 'bono'],
    cat_guard: ['guardia', 'turnos'],
    cat_tickets: ['tickets', 'alimentación', 'cesta ticket'],
    cat_extras: ['extras', 'freelance', 'ingreso'],
  };

  for (const [localId, keywords] of Object.entries(localToName)) {
    for (const kw of keywords) {
      for (const [name, uuid] of nameIndex) {
        if (name.includes(kw)) {
          categoryMap.set(localId, uuid);
          break;
        }
      }
      if (categoryMap.has(localId)) break;
    }
  }
}

/** Resolve a category_id: if it's already a UUID, return as-is; if local string, map to UUID */
export function resolveCategoryId(localId?: string): string | undefined {
  if (!localId) return undefined;
  // Already a valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localId)) {
    return localId;
  }
  // Try mapping
  return categoryMap.get(localId) || undefined;
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
 * - Removes `year`, `month`, `fortnight` (derived from period_key)
 * - Keeps `amount`, `transaction_id`, `notes` (added to DB via migration)
 */
export function toSupabaseFortnightStatePayload(
  record: Omit<FortnightItemState, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const {
    year,
    month,
    fortnight,
    ...rest
  } = record;

  return rest;
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
  const resolved = resolveCategoryId(record.category_id);
  const validCategory = resolved || (isValidUuid(record.category_id) ? record.category_id : null);
  const validAccountId = record.account_id && isValidUuid(record.account_id) ? record.account_id : null;
  const cleanId = ensureValidUuid(record.id);

  return {
    id: cleanId,
    user_id: record.user_id,
    amount: Number(record.amount),
    type: record.type || 'expense',
    description: record.description || 'Transacción',
    category_id: validCategory,
    account_id: validAccountId,
    transaction_date: record.transaction_date || new Date().toISOString().split('T')[0],
    created_at: record.created_at || new Date().toISOString(),
    updated_at: record.updated_at || new Date().toISOString(),
  };
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
