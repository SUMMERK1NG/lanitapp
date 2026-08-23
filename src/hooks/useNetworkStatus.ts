import { useState, useEffect, useCallback } from 'react';
import { syncWithSupabase } from '../lib/db.ts';
import type { SyncResult } from '../types/index.ts';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem('lanitapp_last_sync') || 'No sincronizado aún';
  });

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncWithSupabase();
      setLastSyncResult(result);
      if (result.lastSyncTime) {
        setLastSyncTime(result.lastSyncTime);
      }
    } catch (err) {
      console.error('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto sync when coming back online
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync on mount if online
    if (navigator.onLine) {
      syncNow();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    lastSyncResult,
    syncNow,
  };
}
