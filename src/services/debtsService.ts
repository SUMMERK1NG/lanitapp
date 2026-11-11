import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { getActiveUserId } from '../lib/supabaseSession.ts';
import { useFinanceStore } from '../stores/useFinanceStore.ts';
import type { Debt, DebtPayment, FortnightType } from '../types/index.ts';
import { ensureValidUuid } from '../utils/uuid.ts';
import {
  sanitizeDebtPayload,
  normalizeDebtRow,
} from '../lib/supabasePayloads.ts';
import { logger } from '../utils/logger.ts';

export { sanitizeDebtPayload, normalizeDebtRow };

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
      (payload) => {
        logger.dev('[Supabase Realtime Debts Triggered]:', payload);
        const newRow: any = payload.new;
        const oldRow: any = payload.old;

        if (payload.eventType === 'DELETE' && oldRow?.id) {
          useFinanceStore.setState((s) => ({
            debts: s.debts.filter((d) => d.id !== oldRow.id && d.id !== ensureValidUuid(oldRow.id)),
          }));
        } else if (newRow?.id) {
          const normalized = normalizeDebtRow(newRow);
          useFinanceStore.setState((s) => ({
            debts: s.debts.some((d) => d.id === normalized.id)
              ? s.debts.map((d) => (d.id === normalized.id ? normalized : d))
              : [...s.debts, normalized],
          }));
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
 * Obtiene la lista actualizada de deudas directamente desde Supabase
 */
export const fetchDebts = async (userId: string): Promise<Debt[]> => {
  const uid = userId || getActiveUserId();
  if (!uid) return [];

  if (navigator.onLine && isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const debts: Debt[] = data.map(normalizeDebtRow);
        useFinanceStore.setState({ debts });
        return debts;
      } else if (error) {
        logger.error('[debtsService fetchDebts Error]:', error.message, error.details);
      }
    } catch (e) {
      logger.warn('[debtsService fetchDebts Network Notice]:', e);
    }
  }

  return useFinanceStore.getState().debts;
};

/**
 * Guarda o actualiza una deuda directamente en Supabase + Zustand
 */
export const saveDebt = async (
  debt: Partial<Debt> & { creditor: string; total_amount: number; payment_type: Debt['payment_type'] },
  userId?: string
): Promise<Debt> => {
  return useFinanceStore.getState().saveDebt(debt, userId);
};

/**
 * Elimina una deuda directamente en Supabase + Zustand
 */
export const deleteDebt = async (id: string, userId?: string): Promise<void> => {
  return useFinanceStore.getState().deleteDebt(id, userId);
};

/**
 * Registra un abono a una deuda directamente en Supabase + Zustand
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
  account_id?: string;
}): Promise<DebtPayment> => {
  return useFinanceStore.getState().addDebtPayment(data, data.user_id);
};
