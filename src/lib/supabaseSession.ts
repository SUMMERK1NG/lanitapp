import { supabase, isSupabaseConfigured } from './supabase.ts';
import { logger } from '../utils/logger.ts';

let _activeUserIdInMemory = '';
let _lastSyncTimestamp: string | null = null;

export function setActiveUserId(id: string): void {
  _activeUserIdInMemory = id ? id.trim() : '';
}

export function getActiveUserId(): string {
  return _activeUserIdInMemory;
}

export function getLastSyncTimestamp(): string | null {
  return _lastSyncTimestamp;
}

export function setLastSyncTimestampInMemory(timestamp: string | null): void {
  _lastSyncTimestamp = timestamp;
}

export async function fetchActiveUserId(): Promise<string | null> {
  if (_activeUserIdInMemory) return _activeUserIdInMemory;
  try {
    if (isSupabaseConfigured() && supabase) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (!error && user?.id) {
        _activeUserIdInMemory = user.id;
        return user.id;
      }
    }
  } catch (err) {
    logger.warn('Error al obtener usuario activo desde Supabase:', err);
  }
  return null;
}
