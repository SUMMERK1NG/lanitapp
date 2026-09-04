/**
 * Servicio centralizado para la gestión de Gastos Fijos y Overrides mensuales.
 */

import {
  toggleMonthlyFixedOverride,
  saveFixedExpense,
  deleteFixedExpense,
} from '../lib/db.ts';
import { logger } from '../utils/logger.ts';
import type { MonthlyFixedOverride } from '../types/index.ts';

/**
 * Pausar o activar un gasto fijo para un mes y año determinados.
 * @param expenseId ID del gasto fijo (UUID)
 * @param isPaused true para pausar (is_active = false), false para reactivar (is_active = true)
 * @param year Año objetivo (por defecto año actual)
 * @param month Mes objetivo 0-11 (por defecto mes actual)
 */
export async function toggleFixedExpensePause(
  expenseId: string,
  isPaused: boolean,
  year?: number,
  month?: number
): Promise<MonthlyFixedOverride> {
  const targetYear = year !== undefined ? year : new Date().getFullYear();
  const targetMonth = month !== undefined ? month : new Date().getMonth();
  const isActive = !isPaused;

  logger.dev(`[FIXED EXPENSE SERVICE] ${isPaused ? 'Pausando' : 'Activando'} gasto fijo ${expenseId} para ${targetYear}-${targetMonth + 1}`);

  try {
    return await toggleMonthlyFixedOverride(expenseId, targetYear, targetMonth, isActive);
  } catch (error: any) {
    logger.error('[FIXED EXPENSE PAUSE ERROR]:', {
      message: error?.message || 'Error desconocido al actualizar override',
      details: error?.details,
      code: error?.code,
      expenseId,
      targetYear,
      targetMonth,
      isPaused,
    });
    throw error;
  }
}

export {
  toggleMonthlyFixedOverride,
  saveFixedExpense,
  deleteFixedExpense,
};
