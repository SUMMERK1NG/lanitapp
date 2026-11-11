import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { useFinanceStore, type RealtimeSyncStatus } from '../stores/useFinanceStore.ts';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../utils/logger.ts';

export const SYNCED_TABLES = [
  'profiles',
  'categories',
  'accounts',
  'fixed_incomes',
  'monthly_fixed_income_overrides',
  'variable_incomes',
  'fixed_expenses',
  'monthly_fixed_overrides',
  'variable_expenses',
  'debts',
  'debt_payments',
  'savings_goals',
  'saving_contributions',
  'fortnight_item_states',
  'planning_notes',
  'transactions',
] as const;

export function useRealtimeSync(userId: string | null) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const channelRef = useRef<RealtimeChannel | null>(null);

  const {
    syncStatus,
    lastSyncTime,
    setSyncStatus,
    fetchInitialData,
    handleRealtimePayload,
    flushSyncQueue,
  } = useFinanceStore();

  const isSyncing = syncStatus === 'syncing';

  // Manual Trigger
  const syncNow = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    await fetchInitialData(userId);
    await flushSyncQueue(userId);
  }, [userId, fetchInitialData, flushSyncQueue]);

  // Online / Offline Detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (userId) {
        setSyncStatus('syncing');
        fetchInitialData(userId)
          .then(() => flushSyncQueue(userId))
          .catch(() => {});
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId, setSyncStatus, fetchInitialData, flushSyncQueue]);

  // Initial Load & Realtime Subscriptions
  useEffect(() => {
    if (!userId) {
      setSyncStatus('offline');
      return;
    }

    let isMounted = true;

    if (!isOnline || !isSupabaseConfigured() || !supabase) {
      setSyncStatus('offline');
      return;
    }

    // 1. Fetch inicial completo desde Supabase y empuje de cola en memoria si existe
    fetchInitialData(userId)
      .then(() => {
        if (isMounted) {
          flushSyncQueue(userId).catch(() => {});
        }
      })
      .catch((err) => {
        logger.warn('[RealtimeSync Initial Fetch Notice]:', err);
        if (isMounted) setSyncStatus('error');
      });

    // 2. Crear Canal Realtime Unificado para las 16 tablas oficiales
    const channelName = `realtime-sync-${userId}-${Math.random().toString(36).substring(2, 7)}`;
    let channel = supabase.channel(channelName);

    SYNCED_TABLES.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          if (!isMounted) return;
          logger.dev(`[useRealtimeSync ${table} Event]:`, payload);
          handleRealtimePayload(table, payload, userId);
        }
      );
    });

    channel.subscribe((status) => {
      if (!isMounted) return;
      if (status === 'SUBSCRIBED') {
        setSyncStatus('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setSyncStatus('error');
      }
    });

    channelRef.current = channel;

    // 3. Reintento periódico en memoria si quedó algo pendiente en cola
    const autoSyncInterval = setInterval(() => {
      if (navigator.onLine && userId) {
        flushSyncQueue(userId).catch(() => {});
      }
    }, 45000);

    // Cleanup: Desuscribir canal al desmontar para evitar memory leaks
    return () => {
      isMounted = false;
      clearInterval(autoSyncInterval);
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, isOnline, fetchInitialData, handleRealtimePayload, flushSyncQueue, setSyncStatus]);

  const syncStatusInfo = {
    connected: { label: 'Al día', color: 'green', icon: '🟢' },
    syncing: { label: 'Guardando...', color: 'amber', icon: '🔄' },
    offline: { label: 'Sin conexión', color: 'slate', icon: '🟡' },
    error: { label: 'Reintentando...', color: 'red', icon: '🔴' },
  }[syncStatus as RealtimeSyncStatus];

  return {
    syncStatus: syncStatus as RealtimeSyncStatus,
    syncStatusInfo,
    isOnline,
    isSyncing,
    lastSyncTime,
    syncNow,
  };
}
