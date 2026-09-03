import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { db, getActiveUserId } from '../lib/db.ts';
import type { Debt, DebtPayment, FortnightType, Transaction } from '../types/index.ts';
import { ensureValidUuid } from '../utils/uuid.ts';
import { toSupabaseDebtPaymentPayload, toSupabaseTransactionPayload } from '../lib/supabasePayloads.ts';
import { logger } from '../utils/logger.ts';

/**
 * Sanitiza y mapea el objeto Debt para coincidir exactamente con el esquema de PostgreSQL en Supabase
 * Remueve propiedades auxiliares de frontend/Dexie (como sync_status, isEditing, currency)
 * y asegura que los tipos coincidan con las columnas de PostgreSQL.
 */
export const sanitizeDebtPayload = (debt: Partial<Debt> & Record<string, any>, userId: string): Record<string, any> => {
  const current_balance = debt.current_balance !== undefined ? Number(debt.current_balance) : Number(debt.total_amount || 0);
  const status = current_balance <= 0 ? 'paid' : (debt.status === 'paid' ? 'paid' : 'active');
  const now = new Date();
  const start_year = debt.start_year !== undefined ? Number(debt.start_year) : now.getFullYear();
  const start_month = debt.start_month !== undefined ? Number(debt.start_month) : now.getMonth();
  const start_fortnight = debt.start_fortnight || (now.getDate() <= 15 ? 'q1' : 'q2');

  const creditorValue = debt.creditor || debt.creditor_name || debt.name || 'Deuda';
  const totalAmount = Number(debt.total_amount || 0);

  const payload: Record<string, any> = {
    id: ensureValidUuid(debt.id),
    user_id: userId,
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

  // Campos opcionales
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
};

/**
 * Normaliza un registro recibido de Supabase PostgreSQL a la interfaz Debt de la aplicación
 */
export const normalizeDebtRow = (row: any): Debt => {
  const current_balance = Number(row.current_balance ?? row.remaining_amount ?? row.total_amount ?? 0);
  const status = (row.status === 'paid' || current_balance <= 0) ? 'paid' : (row.status || 'active');

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
};

/**
 * Suscripción en tiempo real dedicada para cambios en la tabla 'debts' de Supabase
 */
export const subscribeToDebtsChanges = (userId: string, onUpdate: () => void) => {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    return () => {};
  }

  const channelName = `debts-changes-${userId}-${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'debts',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        logger.dev('[Supabase Realtime Debts Triggered]:', payload);
        const newRow: any = payload.new;
        const oldRow: any = payload.old;

        try {
          if (payload.eventType === 'DELETE' && oldRow?.id) {
            await db.debts.delete(oldRow.id);
          } else if (newRow?.id) {
            const normalized = normalizeDebtRow(newRow);
            await db.debts.put(normalized);
          }
        } catch (e) {
          logger.warn('[debtsService Realtime Cache Error]:', e);
        }

        onUpdate();
      }
    )
    .subscribe();

  return () => {
    if (supabase) {
      supabase.removeChannel(channel);
    }
  };
};

/**
 * Obtiene la lista actualizada de deudas desde Supabase y actualiza Dexie
 */
export const fetchDebts = async (userId: string): Promise<Debt[]> => {
  if (!userId) return [];

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const debts: Debt[] = data.map(normalizeDebtRow);
        await db.debts.where('user_id').equals(userId).delete();
        if (debts.length > 0) {
          await db.debts.bulkPut(debts);
        }
        return debts;
      } else if (error) {
        logger.error('[debtsService fetchDebts Error]:', error.message, error.details);
      }
    } catch (e) {
      logger.warn('[debtsService fetchDebts Network Notice]:', e);
    }
  }

  return db.debts.where('user_id').equals(userId).toArray();
};

/**
 * Guarda o actualiza una deuda con confirmación asíncrona de Supabase
 */
export const saveDebt = async (
  debt: Partial<Debt> & { creditor: string; total_amount: number; payment_type: Debt['payment_type'] },
  userId?: string
): Promise<Debt> => {
  const activeUid = userId || debt.user_id || getActiveUserId();
  const sanitizedPayload = sanitizeDebtPayload(debt, activeUid);
  const localRecord = normalizeDebtRow({ ...sanitizedPayload, currency: debt.currency || 'USD' });
  localRecord.sync_status = 'pending';

  // 1. Guardar localmente en Dexie de inmediato
  await db.debts.put(localRecord);

  // 2. Confirmación asíncrona con Supabase
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (user && !authErr) {
        sanitizedPayload.user_id = user.id;
        localRecord.user_id = user.id;
      }

      let { data, error } = await supabase
        .from('debts')
        .upsert(sanitizedPayload)
        .select()
        .single();

      // Si la tabla no tiene las columnas due_day / due_day_2 en Supabase, reintentar sin ellas de forma segura
      if (error && (error.code === 'PGRST204' || error.message?.toLowerCase().includes('due_day') || error.code === '42703')) {
        logger.warn('[debtsService saveDebt]: Columnas due_day/due_day_2 no detectadas en Supabase. Reintentando sin ellas...');
        const { due_day, due_day_2, ...fallbackPayload } = sanitizedPayload;
        const retryRes = await supabase
          .from('debts')
          .upsert(fallbackPayload)
          .select()
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (!error && data) {
        const confirmedDebt = normalizeDebtRow(data);
        confirmedDebt.due_day = localRecord.due_day;
        confirmedDebt.due_day_2 = localRecord.due_day_2;
        await db.debts.put(confirmedDebt);
        return confirmedDebt;
      } else if (error) {
        logger.error('[debtsService saveDebt Remote Error]:', error.message, error.details);
      }
    } catch (e) {
      logger.warn('[debtsService saveDebt Network Notice]:', e);
    }
  }

  return localRecord;
};

/**
 * Elimina una deuda con confirmación remota
 */
export const deleteDebt = async (id: string): Promise<void> => {
  const cleanId = ensureValidUuid(id);
  await db.debts.delete(id);
  await db.debts.delete(cleanId);
  await db.debt_payments.where('debt_id').equals(id).delete();
  await db.debt_payments.where('debt_id').equals(cleanId).delete();

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      await Promise.all([
        supabase.from('debts').delete().eq('id', cleanId),
        supabase.from('debt_payments').delete().eq('debt_id', cleanId),
      ]);
    } catch (e) {
      logger.warn('[debtsService deleteDebt Remote Notice]:', e);
    }
  }
};

/**
 * Registra un abono a una deuda con confirmación asíncrona en Supabase
 */
export const addDebtPayment = async (data: {
  debt_id: string;
  user_id?: string;
  amount: number;
  principal_amount?: number;
  interest_amount?: number;
  unpaid_interest_capitalized?: number;
  payment_type?: 'full' | 'interest_only' | 'principal_only' | 'mixed';
  payment_date?: string;
  fortnight?: FortnightType;
  year?: number;
  month?: number;
  rate_applied?: number;
  parallel_rate?: number;
  notes?: string;
}): Promise<DebtPayment> => {
  const debt = await db.debts.get(data.debt_id);
  if (!debt) throw new Error('Deuda no encontrada');

  const userId = data.user_id || debt.user_id || getActiveUserId();
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

  // Calcular nuevo saldo considerando abono a capital e intereses impagos capitalizados
  let newBalance: number;
  if (data.principal_amount !== undefined) {
    const principalReduction = Number(data.principal_amount);
    const capitalizedInterest = Number(data.unpaid_interest_capitalized || 0);
    newBalance = Math.max(0, Number(debt.current_balance) - principalReduction + capitalizedInterest);
  } else {
    newBalance = Math.max(0, Number(debt.current_balance) - Number(data.amount));
  }

  const newStatus = newBalance <= 0.01 ? 'paid' : 'active';
  const newPendingInstallments = debt.pending_installments ? Math.max(0, debt.pending_installments - 1) : undefined;

  const txId = ensureValidUuid();
  const txRecord: Transaction = {
    id: txId,
    user_id: userId,
    amount: Number(data.amount),
    type: 'expense',
    description: `Abono: ${debt.creditor || (debt as any).creditor_name || 'Deuda'} (${fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})`,
    category_id: 'cat_debt',
    account_id: (data as any).account_id || null,
    transaction_date: paymentDate,
    sync_status: 'pending',
    created_at: new Date().toISOString(),
  };

  // Guardar localmente
  await db.debt_payments.add(paymentRecord);
  await db.debts.update(debt.id, {
    current_balance: newBalance,
    pending_installments: newPendingInstallments,
    status: newStatus,
    updated_at: new Date().toISOString(),
  });
  await db.transactions.put(txRecord);

  // Confirmación asíncrona con Supabase
  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        logger.error('[debtsService addDebtPayment Error]: Usuario no autenticado en Supabase');
        return paymentRecord;
      }

      // Asegurar que el user_id corresponda al usuario autenticado
      paymentRecord.user_id = user.id;
      txRecord.user_id = user.id;

      const { sync_status: s1, ...payRaw } = paymentRecord;
      const payPayload = toSupabaseDebtPaymentPayload(payRaw);
      const { sync_status: s2, ...txRaw } = txRecord;
      const txPayload = toSupabaseTransactionPayload(txRaw);

      logger.dev('[DEBT PAYMENT] Enviando a Supabase:', {
        payPayload,
        txPayload,
      });

      const [res1, res2, res3] = await Promise.all([
        supabase.from('debt_payments').upsert(payPayload).select(),
        supabase.from('debts').update({
          current_balance: newBalance,
          remaining_amount: newBalance,
          pending_installments: newPendingInstallments,
          status: newStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', debt.id).select(),
        supabase.from('transactions').upsert(txPayload).select(),
      ]);

      if (!res1.error && !res2.error && !res3.error) {
        paymentRecord.sync_status = 'synced';
        txRecord.sync_status = 'synced';
        await db.debt_payments.update(paymentRecord.id, { sync_status: 'synced' });
        await db.transactions.update(txRecord.id, { sync_status: 'synced' });
        logger.dev('[DEBT PAYMENT SUCCESS]: Abono y transacción sincronizados con Supabase');
      } else {
        const primaryError = res3.error || res1.error || res2.error;
        logger.error('[debtsService addDebtPayment Error]:', {
          message: primaryError?.message,
          code: primaryError?.code,
          details: primaryError?.details,
          hint: primaryError?.hint,
          payError: res1.error?.message,
          debtUpdateError: res2.error?.message,
          txError: res3.error?.message,
        });
      }
    } catch (e) {
      logger.warn('[debtsService addDebtPayment Remote Notice]:', e);
    }
  }

  return paymentRecord;
};
