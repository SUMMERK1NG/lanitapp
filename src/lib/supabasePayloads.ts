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
 * - Renames `fixed_expense_id` → `expense_id`
 * - Removes `year`, `month` (not in DB schema)
 */
export function toSupabaseMonthlyOverridePayload(
  record: Omit<MonthlyFixedOverride, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const {
    fixed_expense_id,
    year,
    month,
    ...rest
  } = record;

  return {
    ...rest,
    expense_id: fixed_expense_id,
  };
}

// ---------------------------------------------------------------
// Monthly Fixed Income Overrides
// ---------------------------------------------------------------

/**
 * Convert MonthlyFixedIncomeOverride to Supabase format.
 * - Renames `fixed_income_id` → `income_id`
 * - Removes `year`, `month` (not in DB schema)
 */
export function toSupabaseMonthlyIncomeOverridePayload(
  record: Omit<MonthlyFixedIncomeOverride, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const {
    fixed_income_id,
    year,
    month,
    ...rest
  } = record;

  return {
    ...rest,
    income_id: fixed_income_id,
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
 * - Resolves `category_id` from local string to UUID
 */
export function toSupabaseTransactionPayload(
  record: Omit<Transaction, 'sync_status'> & Record<string, any>
): Record<string, any> {
  const resolved = resolveCategoryId(record.category_id);
  const accountId = record.account_id && String(record.account_id).trim() !== '' ? record.account_id : null;
  return {
    ...record,
    account_id: accountId,
    category_id: resolved || record.category_id,
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
