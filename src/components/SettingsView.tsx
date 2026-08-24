import React, { useState } from 'react';
import {
  Settings,
  Database,
  Cloud,
  Download,
  RefreshCw,
  CheckCircle2,
  Palette,
  Sun,
  Moon,
  Check,
  Trash2,
  Layers,
  Users,
} from 'lucide-react';
import type {
  Category,
  Account,
  Transaction,
  Debt,
  FixedExpense,
  FixedIncome,
  DebtPayment,
  SavingsGoal,
  ThemeMode,
  AccentColor,
} from '../types/index.ts';
import { clearCurrentUserData } from '../lib/db.ts';
import { isSupabaseConfigured } from '../lib/supabase.ts';
import { ACCENT_COLOR_OPTIONS } from '../hooks/useTheme.ts';
import { CategoriesModule } from './CategoriesModule.tsx';
import { UserManagementCard } from './UserManagementCard.tsx';

interface SettingsViewProps {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  fixedExpenses: FixedExpense[];
  fixedIncomes: FixedIncome[];
  debtPayments: DebtPayment[];
  savingsGoals: SavingsGoal[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  currentThemeMode: ThemeMode;
  currentAccentColor: AccentColor;
  currentUserId?: string;
  initialTab?: 'themes' | 'categories' | 'users' | 'backup';
  onChangeThemeMode: (mode: ThemeMode) => void;
  onChangeAccentColor: (color: AccentColor) => void;
  onSync: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  categories,
  accounts,
  transactions,
  debts,
  fixedExpenses,
  fixedIncomes,
  debtPayments,
  savingsGoals,
  isOnline,
  isSyncing,
  lastSyncTime,
  currentThemeMode,
  currentAccentColor,
  currentUserId,
  initialTab = 'themes',
  onChangeThemeMode,
  onChangeAccentColor,
  onSync,
}) => {
  const [activeTab, setActiveTab] = useState<'themes' | 'categories' | 'users' | 'backup'>(initialTab);
  const [resetting, setResetting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleExportJSON = () => {
    const backupData = {
      version: '3.3.0',
      exportedAt: new Date().toISOString(),
      user_profile: JSON.parse(localStorage.getItem('lanitapp_active_user') || '{}'),
      categories,
      accounts,
      transactions,
      debts,
      debtPayments,
      fixedExpenses,
      fixedIncomes,
      savingsGoals,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lanitapp_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportMessage('Copia de seguridad descargada exitosamente');
    setTimeout(() => setExportMessage(null), 3000);
  };

  const handleResetData = async () => {
    if (
      window.confirm(
        '¿Deseas restablecer todos tus datos financieros a cero? Esta acción limpiará tus ingresos, gastos, deudas, metas y movimientos, manteniendo intacto tu perfil de usuario.'
      )
    ) {
      setResetting(true);
      try {
        await clearCurrentUserData(currentUserId);
        window.location.reload();
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Sub-Navigation Tabs */}
      <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-app">Configuración & Preferencias</h2>
            <p className="text-xs text-muted">Ajusta temas visuales, gestiona usuarios, categorías y respaldos</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-card rounded-2xl border border-app overflow-x-auto no-scrollbar gap-1">
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'themes'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Personalización & Temas</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Gestión de Usuarios</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Gestor de Categorías ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Sincronización & Backup</span>
          </button>
        </div>
      </div>

      {/* TAB 1: GESTIÓN DE USUARIOS (ADMIN) */}
      {activeTab === 'users' && (
        <div className="animate-in fade-in duration-200">
          <UserManagementCard currentUserId={currentUserId} />
        </div>
      )}

      {/* TAB 2: PERSONALIZACIÓN & TEMAS */}
      {activeTab === 'themes' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Theme Modes */}
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
            <div>
              <h3 className="text-sm font-bold text-app">Modos de Interfaz (Temas)</h3>
              <p className="text-xs text-muted">Selecciona el ambiente visual predeterminado</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Modo Azul Marino */}
              <button
                onClick={() => onChangeThemeMode('navy')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  currentThemeMode === 'navy'
                    ? 'border-primary-custom bg-[#203657] text-white ring-2 ring-primary-custom shadow-lg'
                    : 'border-app bg-[#203657]/70 text-slate-300 hover:bg-[#203657]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">🌊</span>
                  {currentThemeMode === 'navy' && <CheckCircle2 className="w-4 h-4 text-[#147DF0]" />}
                </div>
                <div className="font-bold text-sm">Azul Marino Profundo</div>
                <div className="text-[11px] text-slate-300 mt-0.5">Fondo Navy #0B132B</div>
              </button>

              {/* Modo Oscuro Negro */}
              <button
                onClick={() => onChangeThemeMode('dark')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  currentThemeMode === 'dark'
                    ? 'border-primary-custom bg-[#111726] text-white ring-2 ring-primary-custom shadow-lg'
                    : 'border-app bg-[#0e1320] text-slate-300 hover:bg-[#111726]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Moon className="w-5 h-5 text-[#00C2C7]" />
                  {currentThemeMode === 'dark' && <CheckCircle2 className="w-4 h-4 text-[#147DF0]" />}
                </div>
                <div className="font-bold text-sm">Oscuro Negro</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Fondo Negro #090D16</div>
              </button>

              {/* Modo Fondo Blanco */}
              <button
                onClick={() => onChangeThemeMode('light')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  currentThemeMode === 'light'
                    ? 'border-primary-custom bg-white text-slate-900 ring-2 ring-primary-custom shadow-lg'
                    : 'border-app bg-white/90 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Sun className="w-5 h-5 text-amber-500" />
                  {currentThemeMode === 'light' && <CheckCircle2 className="w-4 h-4 text-[#147DF0]" />}
                </div>
                <div className="font-bold text-sm">Fondo Blanco</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Alto contraste #FFFFFF</div>
              </button>
            </div>
          </div>

          {/* Accent Color Palette */}
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
            <div>
              <h3 className="text-sm font-bold text-app">Paleta de Color de Acento</h3>
              <p className="text-xs text-muted">Personaliza los botones de acción, destaques y gráficos</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {ACCENT_COLOR_OPTIONS.map((option) => {
                const isSelected = currentAccentColor === option.color;
                return (
                  <button
                    key={option.color}
                    onClick={() => onChangeAccentColor(option.color)}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-app bg-card ring-2 ring-primary-custom shadow-md'
                        : 'border-app bg-card/60 hover:bg-card'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: option.color }}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                    <span className="text-[11px] font-bold text-app text-center">
                      {option.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GESTOR DE CATEGORÍAS */}
      {activeTab === 'categories' && (
        <div className="animate-in fade-in duration-200">
          <CategoriesModule categories={categories} />
        </div>
      )}

      {/* TAB 4: SINCRONIZACIÓN & BACKUP */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Cloud Synchronization Status Indicator */}
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Sincronización en la Nube</h3>
                  <p className="text-xs text-muted">Estado de persistencia con Supabase</p>
                </div>
              </div>

              {/* Real-time Indicator Tag */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-card border border-app">
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
                    <span className="text-emerald-400">Sincronizado</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-app text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted">Estado del Servidor:</span>
                <span className="font-semibold text-app">
                  {isSupabaseConfigured() ? 'Conectado a Supabase' : 'Modo Offline Exclusivo'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Última Sincronización:</span>
                <span className="font-semibold text-app">{lastSyncTime || 'Al iniciar la app'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Modo de sincronización:</span>
                <span className="font-semibold text-emerald-400">Automático en segundo plano</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onSync}
                disabled={isSyncing || !isOnline}
                className="flex-1 py-3 rounded-2xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Forzar Sincronización Ahora'}</span>
              </button>
            </div>
          </div>

          {/* Export JSON Backup */}
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-app">Copia de Seguridad (Exportar JSON)</h3>
                <p className="text-xs text-muted">Descarga un respaldo completo en formato estándar</p>
              </div>
            </div>

            {exportMessage && (
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>{exportMessage}</span>
              </div>
            )}

            <button
              onClick={handleExportJSON}
              className="w-full py-3 rounded-2xl bg-card hover:bg-surface-hover text-app border border-app text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-primary-custom" />
              <span>Exportar Respaldo JSON Completo</span>
            </button>
          </div>

          {/* Dangerous Zone */}
          <div className="p-5 rounded-3xl bg-[#ef4444]/10 border border-[#ef4444]/20 shadow-md space-y-3">
            <div>
              <h3 className="text-sm font-bold text-[#ef4444]">Zona de Peligro</h3>
              <p className="text-xs text-slate-400">Restablece tus ingresos, gastos, deudas, ahorros y movimientos a cero</p>
            </div>

            <button
              onClick={handleResetData}
              disabled={resetting}
              className="w-full py-3 rounded-2xl bg-[#ef4444] text-white text-xs font-bold shadow-md hover:bg-[#dc2626] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{resetting ? 'Limpiando registros...' : 'Restablecer Mis Datos Financieros a Cero'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
