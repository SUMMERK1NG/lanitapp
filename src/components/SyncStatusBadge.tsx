import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  X,
  Database,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useFinanceStore } from '../stores/useFinanceStore.ts';

export interface SyncStatusBadgeProps {
  userId?: string;
  isOnline: boolean;
  isSyncing: boolean;
  onSyncNow?: () => Promise<void> | void;
  lastSyncTime?: string | null;
  className?: string;
  compact?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  isOnline,
  isSyncing,
  onSyncNow,
  lastSyncTime,
  className = '',
  compact = false,
}) => {
  const [isTrayOpen, setIsTrayOpen] = useState<boolean>(false);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const syncQueue = useFinanceStore((s) => s.syncQueue);

  const summary = useMemo(() => {
    let transactions = 0;
    let fixedExpenses = 0;
    let debts = 0;
    let incomes = 0;
    let others = 0;

    for (const item of syncQueue) {
      if (item.table === 'transactions') transactions++;
      else if (item.table === 'fixed_expenses' || item.table === 'monthly_fixed_overrides' || item.table === 'variable_expenses') fixedExpenses++;
      else if (item.table === 'debts' || item.table === 'debt_payments') debts++;
      else if (item.table === 'fixed_incomes' || item.table === 'monthly_fixed_income_overrides' || item.table === 'variable_incomes') incomes++;
      else others++;
    }

    return {
      total: syncQueue.length,
      transactions,
      fixedExpenses,
      debts,
      incomes,
      others,
    };
  }, [syncQueue]);

  const handleSyncClick = async () => {
    if (!onSyncNow || !isOnline || isSyncing || isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await onSyncNow();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const pendingCount = summary.total;
  const syncing = isSyncing || isManualSyncing;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsTrayOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 select-none ${
          syncing
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
            : !isOnline
            ? 'bg-slate-800/90 border-slate-700 text-slate-300'
            : pendingCount > 0
            ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
            : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
        } ${className}`}
        title="Clic para ver estado de conexión en tiempo real con Supabase"
      >
        {syncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            {!compact && <span className="text-[11px] hidden sm:inline">Guardando en la nube...</span>}
          </>
        ) : !isOnline ? (
          <>
            <CloudOff className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">
              {pendingCount > 0 ? `${pendingCount} por reintentar` : 'Sin conexión'}
            </span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <Cloud className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-[11px]">
              {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </>
        ) : (
          <>
            <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
            {!compact && <span className="text-[11px] hidden sm:inline">En línea con Supabase</span>}
          </>
        )}
      </button>

      {isTrayOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0 cursor-pointer" onClick={() => setIsTrayOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold shadow-inner ${
                    pendingCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Conexión Cloud Directa</h3>
                  <p className="text-[11px] text-muted">Supabase + Realtime en vivo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTrayOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-card border border-app space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted leading-relaxed">
                  {pendingCount === 0 ? (
                    <>
                      Todos tus movimientos, quincenas y deudas están{' '}
                      <strong className="text-emerald-400 font-bold">100% sincronizados en línea</strong> directamente con Supabase PostgreSQL.
                    </>
                  ) : (
                    <>
                      Hay <strong className="text-amber-400 font-bold">{pendingCount} operación(es)</strong> en cola de reintento esperando respuesta de red.
                    </>
                  )}
                </p>
              </div>

              {lastSyncTime && (
                <div className="pt-2 border-t border-app/60 flex items-center justify-between text-[11px] text-muted">
                  <span>Última sincronización en la nube:</span>
                  <strong className="text-app">{lastSyncTime}</strong>
                </div>
              )}
            </div>

            {pendingCount > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  Operaciones en cola de reintento:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {summary.transactions > 0 && (
                    <div className="p-2 rounded-xl bg-card border border-app flex items-center justify-between">
                      <span className="text-muted">Gastos/Ingresos:</span>
                      <span className="font-bold text-app">{summary.transactions}</span>
                    </div>
                  )}
                  {summary.fixedExpenses > 0 && (
                    <div className="p-2 rounded-xl bg-card border border-app flex items-center justify-between">
                      <span className="text-muted">Gastos Fijos:</span>
                      <span className="font-bold text-app">{summary.fixedExpenses}</span>
                    </div>
                  )}
                  {summary.debts > 0 && (
                    <div className="p-2 rounded-xl bg-card border border-app flex items-center justify-between">
                      <span className="text-muted">Deudas / Pagos:</span>
                      <span className="font-bold text-app">{summary.debts}</span>
                    </div>
                  )}
                  {summary.incomes > 0 && (
                    <div className="p-2 rounded-xl bg-card border border-app flex items-center justify-between">
                      <span className="text-muted">Ingresos:</span>
                      <span className="font-bold text-app">{summary.incomes}</span>
                    </div>
                  )}
                  {summary.others > 0 && (
                    <div className="p-2 rounded-xl bg-card border border-app flex items-center justify-between">
                      <span className="text-muted">Otros registros:</span>
                      <span className="font-bold text-app">{summary.others}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Estado de red:
                </span>
                <span className={`font-bold flex items-center gap-1 ${isOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  {isOnline ? 'Conectado a Internet' : 'Sin conexión'}
                </span>
              </div>

              <button
                type="button"
                disabled={!isOnline || syncing}
                onClick={handleSyncClick}
                className="w-full py-2.5 px-4 rounded-2xl bg-primary-custom text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Sincronizando con Supabase...' : 'Sincronizar ahora'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
