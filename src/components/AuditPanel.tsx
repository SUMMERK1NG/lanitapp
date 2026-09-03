import React, { useState } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Copy,
  Check,
  Search,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { useAudit, type AuditResult } from '../lib/auditSystem.ts';
import type { UserProfile } from '../types/index.ts';

interface AuditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
}

export const AuditPanel: React.FC<AuditPanelProps> = ({ isOpen, onClose, currentUser }) => {
  const { report, isRunning, runAudit } = useAudit();
  const [copied, setCopied] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'fail' | 'warning' | 'ok'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 🔒 Restricción estricta de seguridad: Solo visible para usuarios administradores
  const isAdmin = currentUser?.role === 'admin';
  if (!isOpen || !isAdmin) {
    return null;
  }

  const handleCopyReport = () => {
    if (!report) return;
    const jsonStr = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredResults = (report?.results || []).filter((item: AuditResult) => {
    if (filterStatus === 'ok' && item.status !== '✅ OK') return false;
    if (filterStatus === 'fail' && item.status !== '❌ FAIL') return false;
    if (filterStatus === 'warning' && item.status !== '⚠️ WARNING') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.table.toLowerCase().includes(q) ||
        item.operation.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-app rounded-3xl shadow-2xl text-app flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 cursor-default"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-app flex items-center justify-between bg-card/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-custom/15 text-primary-custom border border-primary-custom/30 flex items-center justify-center font-bold shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-app leading-tight">
                  Auditoría & Diagnóstico Supabase
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Solo Admin
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                Validador en tiempo real de tablas, RLS, lectura y escritura
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => runAudit()}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-custom text-white hover:opacity-95 disabled:opacity-50 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              title="Ejecutar diagnóstico completo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRunning ? 'Analizando...' : 'Ejecutar'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-card hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer border border-app"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 no-scrollbar">
          {!report && !isRunning ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-card/30 border border-dashed border-app">
              <Server className="w-12 h-12 mx-auto mb-3 text-muted/60" />
              <h4 className="text-sm font-bold text-app">Listo para iniciar el diagnóstico</h4>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
                Haz clic en el botón para evaluar las 15 tablas de Supabase, permisos RLS y tiempos de respuesta.
              </p>
              <button
                onClick={() => runAudit()}
                className="px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-90 shadow-md cursor-pointer transition-all"
              >
                Iniciar Auditoría Ahora
              </button>
            </div>
          ) : isRunning ? (
            <div className="text-center py-16">
              <RefreshCw className="w-10 h-10 mx-auto text-primary-custom animate-spin mb-3" />
              <p className="text-sm font-black text-app">Evaluando conexiones con Supabase...</p>
              <p className="text-xs text-muted mt-1">
                Consultando esquemas, claves foráneas y políticas de seguridad RLS
              </p>
            </div>
          ) : report ? (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-card border border-app text-center">
                  <div className="flex items-center justify-center gap-1 text-muted mb-1">
                    <Server className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Total Pruebas</span>
                  </div>
                  <p className="text-xl font-black text-app">{report.summary.total}</p>
                  <p className="text-[9px] text-muted mt-0.5">{report.summary.durationTotalMs}ms latencia</p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Exitosos</span>
                  </div>
                  <p className="text-xl font-black text-emerald-400">{report.summary.passed}</p>
                  <p className="text-[9px] text-emerald-400/80 mt-0.5">100% operativos</p>
                </div>

                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center">
                  <div className="flex items-center justify-center gap-1 text-rose-400 mb-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Fallidos</span>
                  </div>
                  <p className="text-xl font-black text-rose-400">{report.summary.failed}</p>
                  <p className="text-[9px] text-rose-400/80 mt-0.5">Requieren atención</p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Alertas</span>
                  </div>
                  <p className="text-xl font-black text-amber-400">{report.summary.warnings}</p>
                  <p className="text-[9px] text-amber-400/80 mt-0.5">Restricciones/Esquema</p>
                </div>
              </div>

              {/* Filters and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por tabla, operación o mensaje..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-card border border-app text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  />
                </div>

                <div className="flex items-center gap-1 self-stretch sm:self-auto bg-card p-1 rounded-xl border border-app shrink-0">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      filterStatus === 'all'
                        ? 'bg-primary-custom text-white'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    Todos ({report.results.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('fail')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      filterStatus === 'fail'
                        ? 'bg-rose-500 text-white'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    Fallidos ({report.summary.failed})
                  </button>
                  <button
                    onClick={() => setFilterStatus('warning')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      filterStatus === 'warning'
                        ? 'bg-amber-500 text-white'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    Alertas ({report.summary.warnings})
                  </button>
                  <button
                    onClick={() => setFilterStatus('ok')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      filterStatus === 'ok'
                        ? 'bg-emerald-500 text-white'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    OK ({report.summary.passed})
                  </button>
                </div>
              </div>

              {/* Detailed Results List */}
              <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1 no-scrollbar">
                {filteredResults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted bg-card/20 rounded-xl">
                    No se encontraron resultados para el filtro seleccionado.
                  </div>
                ) : (
                  filteredResults.map((res: AuditResult, idx: number) => {
                    const isOk = res.status === '✅ OK';
                    const isFail = res.status === '❌ FAIL';

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border text-xs transition-all ${
                          isOk
                            ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                            : isFail
                            ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40'
                            : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm">
                              {isOk ? '✅' : isFail ? '❌' : '⚠️'}
                            </span>
                            <span className="font-black text-app text-xs">{res.table}</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-card border border-app text-muted">
                              {res.operation}
                            </span>
                          </div>

                          {res.durationMs !== undefined && (
                            <span className="text-[10px] font-mono text-muted flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-400" />
                              {res.durationMs}ms
                            </span>
                          )}
                        </div>

                        <p className="text-muted mt-1 text-[11px] leading-relaxed">
                          {res.message}
                        </p>

                        {res.suggestion && (
                          <div className="mt-2 p-2 rounded-xl bg-card/60 border border-app text-[10px] text-primary-custom flex items-start gap-1.5">
                            <span>💡</span>
                            <span>{res.suggestion}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Recommendations Section */}
              {report.recommendations.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-card border border-app">
                  <h4 className="text-xs font-black text-app mb-2 flex items-center gap-1.5">
                    <span>📋 Recomendaciones & Correcciones Sugeridas</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {report.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-[11px] text-muted flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-app bg-card/30 flex items-center justify-between text-xs">
          <button
            onClick={handleCopyReport}
            disabled={!report}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-surface-hover border border-app text-app transition-colors disabled:opacity-50 cursor-pointer text-xs font-bold"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted" />}
            <span>{copied ? 'Copiado al portapapeles' : 'Copiar Reporte JSON'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-95 transition-all cursor-pointer shadow-xs"
          >
            Cerrar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};
