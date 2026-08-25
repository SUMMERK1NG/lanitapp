import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { useFinanceStore, type RealtimeSyncStatus } from '../stores/useFinanceStore.ts';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const SYNCED_TABLES = [
  'profiles',
  'categories',
  'accounts',
  'fixed_incomes',
  'monthly_fixed_income_overrides',
  'variable_incomes',
  'incomes',
  'fixed_expenses',
  'monthly_fixed_overrides',
  'debts',
  'debt_payments',
  'savings_goals',
  'saving_contributions',
  'fortnight_item_states',
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
    loadFromLocalCache,
  } = useFinanceStore();

  const isSyncing = syncStatus === 'syncing';

  // Manual Trigger
  const syncNow = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    await fetchInitialData(userId);
  }, [userId, fetchInitialData]);

  // Online / Offline Detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (userId) {
        setSyncStatus('syncing');
        fetchInitialData(userId);
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
  }, [userId, setSyncStatus, fetchInitialData]);

  // Initial Load & Realtime Subscriptions
  useEffect(() => {
    if (!userId) {
      setSyncStatus('offline');
      return;
    }

    let isMounted = true;

    // 1. Carga inmediata desde Dexie (IndexedDB) para no bloquear UI
    loadFromLocalCache(userId);

    if (!isOnline || !isSupabaseConfigured() || !supabase) {
      setSyncStatus('offline');
      return;
    }

    // 2. Fetch inicial completo desde Supabase
    fetchInitialData(userId).catch((err) => {
      console.warn('[RealtimeSync Initial Fetch Notice]:', err);
      if (isMounted) setSyncStatus('error');
    });

    // 3. Crear Canal Realtime Unificado para las 14 tablas oficiales
    const channelName = `realtime-sync-${userId}-${Math.random().toString(36).substring(2, 7)}`;
    let channel = supabase.channel(channelName);

    SYNCED_TABLES.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          if (!isMounted) return;
          console.log(`[useRealtimeSync ${table} Event]:`, payload);
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

    // Cleanup: Desuscribir canal al desmontar para evitar memory leaks
    return () => {
      isMounted = false;
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, isOnline, fetchInitialData, handleRealtimePayload, loadFromLocalCache, setSyncStatus]);

  const syncStatusInfo = {
    connected: { label: 'Sincronizado', color: 'green', icon: '🟢' },
    syncing: { label: 'Sincronizando...', color: 'blue', icon: '🔄' },
    offline: { label: 'Modo Offline', color: 'yellow', icon: '🟡' },
    error: { label: 'Error de Sincronización', color: 'red', icon: '🔴' },
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
