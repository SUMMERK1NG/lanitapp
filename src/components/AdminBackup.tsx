import React, { useState } from 'react';
import {
  Cloud,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  FileCode,
  Lock,
  Activity,
} from 'lucide-react';
import type { Category, Account, ExchangeRatesData } from '../types/index.ts';
import { forceCloudSyncAndPurgeResiduals } from '../lib/db.ts';
import { isSupabaseConfigured, SUPABASE_URL } from '../lib/supabase.ts';

interface AdminBackupProps {
  categories: Category[];
  accounts: Account[];
  rates?: ExchangeRatesData;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  currentUserId?: string;
  onSyncComplete?: (message: string) => void;
  onOpenAudit?: () => void;
}

export const AdminBackup: React.FC<AdminBackupProps> = ({
  categories,
  accounts,
  rates,
  isOnline,
  isSyncing: propIsSyncing,
  lastSyncTime,
  currentUserId,
  onSyncComplete,
  onOpenAudit,
}) => {
  const [isForcingSync, setIsForcingSync] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // 1. Exportar Esquema y Configuración Global del Sistema (Exclusivo Admin)
  const handleExportSystemSchema = () => {
    const globalAccounts = accounts.filter((a) => !a.user_id);
    const systemConfigBackup = {
      app_name: 'LANITAPP',
      version: import.meta.env.VITE_APP_VERSION || '3.5.0',
      exported_at: new Date().toISOString(),
      export_scope: 'SYSTEM_CONFIG_AND_SCHEMA_ONLY',
      note: 'Este archivo contiene exclusivamente la arquitectura de catálogo, esquema de tablas y configuraciones globales del sistema (no incluye movimientos privados de usuarios).',
      environment: {
        supabase_connected: isSupabaseConfigured(),
        supabase_host: SUPABASE_URL ? new URL(SUPABASE_URL).hostname : 'Not Configured',
        session_inactivity_timeout_ms: Number.isFinite(Number(import.meta.env.VITE_INACTIVITY_TIMEOUT))
          ? Number(import.meta.env.VITE_INACTIVITY_TIMEOUT)
          : 300000,
      },
      system_database_schema: {
        database_engine: 'PostgreSQL 15 (Supabase Cloud) + Dexie IndexedDB Cache',
        tables: [
          'profiles',
          'categories',
          'accounts',
          'fixed_incomes',
          'monthly_fixed_income_overrides',
          'variable_incomes',
          'fixed_expenses',
          'monthly_fixed_overrides',
          'debts',
          'debt_payments',
          'savings_goals',
          'saving_contributions',
          'fortnight_item_states',
          'transactions',
        ],
      },
      master_exchange_rates: rates || {
        bcvDollar: 0,
        parallelDollar: 0,
        bcvEuro: 0,
        spreadPercentage: 0,
        lastUpdated: new Date().toISOString(),
      },
      system_categories_catalog: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
      })),
      global_accounts_template: globalAccounts.length > 0 ? globalAccounts : accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
      })),
      global_settings: {
        supported_currencies: ['USD', 'VES', 'EUR'],
        default_theme_mode: 'navy',
        default_accent_color: '#147DF0',
        realtime_sync_enabled: true,
      },
    };

    const blob = new Blob([JSON.stringify(systemConfigBackup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lanitapp_sistema_esquema_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportMessage('Esquema y configuración del sistema exportados exitosamente.');
    setTimeout(() => setExportMessage(null), 3500);
  };

  // 2. Sincronización Forzada Cloud
  const handleForceCloudSync = async () => {
    if (!isOnline) {
      setSyncStatusMsg({
        type: 'error',
        message: 'No hay conexión a Internet para sincronizar con Supabase.',
      });
      return;
    }

    setIsForcingSync(true);
    setSyncStatusMsg(null);

    try {
      const result = await forceCloudSyncAndPurgeResiduals(currentUserId);
      if (result.success) {
        setSyncStatusMsg({
          type: 'success',
          message: result.message,
        });
        if (onSyncComplete) onSyncComplete(result.message);
      } else {
        setSyncStatusMsg({
          type: 'error',
          message: result.message,
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        message: err.message || 'Error durante la sincronización forzada.',
      });
    } finally {
      setIsForcingSync(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  const isSyncing = propIsSyncing || isForcingSync;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cloud Architecture Status */}
      <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-app">Persistencia Cloud en Tiempo Real</h3>
              <p className="text-xs text-muted">Sincronización bidireccional continua con Supabase</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold bg-card border border-app">
            {!isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-400">Modo Offline</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-[#00C2C7]" />
                <span className="text-[#00C2C7]">Sincronizando...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-emerald-400">Conectado & Synced</span>
              </>
            )}
          </div>
        </div>

        {syncStatusMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              syncStatusMsg.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                : 'bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]'
            }`}
          >
            {syncStatusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{syncStatusMsg.message}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-card border border-app text-xs space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-muted flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-primary-custom" />
              Servidor Cloud:
            </span>
            <span className="font-semibold text-app">
              {isSupabaseConfigured() ? 'Supabase Postgres 15 (Producción)' : 'Sin credenciales'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted">Última Actualización:</span>
            <span className="font-semibold text-app">{lastSyncTime || 'Activa en tiempo real'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted">Protocolo de Datos:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Cloud-First + Subscripción Realtime
            </span>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleForceCloudSync}
            disabled={isSyncing || !isOnline}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#147DF0] to-[#00C2C7] text-white text-xs font-black shadow-lg shadow-primary-custom/25 hover:opacity-95 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Ejecutando Sincronización Forzada...' : 'Sincronización Forzada Cloud & Limpiar Residuos'}</span>
          </button>

          {onOpenAudit && (
            <button
              type="button"
              onClick={onOpenAudit}
              className="w-full mt-2.5 py-3 rounded-2xl bg-card hover:bg-surface-hover border border-primary-custom/40 text-primary-custom text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" />
              <span>Diagnóstico & Auditoría Completa de Tablas Supabase</span>
            </button>
          )}
        </div>
      </div>

      {/* Export System Configuration & Schema */}
      <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-app">Exportar Configuración y Esquema del Sistema</h3>
            <p className="text-xs text-muted">
              Descarga la estructura arquitectónica, catálogos maestros y variables globales (JSON)
            </p>
          </div>
        </div>

        {exportMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{exportMessage}</span>
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-card border border-app text-xs space-y-1.5 text-muted">
          <p className="font-bold text-app flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#00C2C7]" />
            Protección de Privacidad Garantizada:
          </p>
          <p className="text-[11px] leading-relaxed">
            Este respaldo contiene únicamente metadatos del sistema, catálogo de categorías ({categories.length}), tasas de cambio actuales ({rates?.bcvDollar ? `BCV $${rates.bcvDollar}` : 'N/A'}) y esquemas de base de datos.
            <strong className="text-app block mt-1">Los movimientos, deudas y montos privados de otros usuarios no son incluidos.</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportSystemSchema}
          className="w-full py-3.5 rounded-2xl bg-card hover:bg-surface-hover text-app border border-app text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4 text-primary-custom" />
          <span>Descargar Esquema y Configuración Global (.json)</span>
        </button>
      </div>
    </div>
  );
};
