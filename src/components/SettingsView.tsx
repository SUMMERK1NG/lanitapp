import React, { useState } from 'react';
import {
  Settings,
  Database,
  CheckCircle2,
  Palette,
  Check,
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
  ExchangeRatesData,
} from '../types/index.ts';
import { THEME_MODE_OPTIONS, ACCENT_COLOR_OPTIONS } from '../hooks/useTheme.ts';
import { CategoriesModule } from './CategoriesModule.tsx';
import { UserManagementCard } from './UserManagementCard.tsx';
import { AdminBackup } from './AdminBackup.tsx';

interface SettingsViewProps {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  fixedExpenses: FixedExpense[];
  fixedIncomes: FixedIncome[];
  debtPayments: DebtPayment[];
  savingsGoals: SavingsGoal[];
  rates?: ExchangeRatesData;
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
  onOpenAudit?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  categories,
  accounts,
  rates,
  isOnline,
  isSyncing,
  lastSyncTime,
  currentThemeMode,
  currentAccentColor,
  currentUserId,
  initialTab = 'themes',
  onChangeThemeMode,
  onChangeAccentColor,
  onOpenAudit,
}) => {
  const [activeTab, setActiveTab] = useState<'themes' | 'categories' | 'users' | 'backup'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Sub-Navigation Tabs */}
      <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-app">Configuración</h2>
            <p className="text-xs text-muted mt-0.5">Ajustes visuales, usuarios y respaldo</p>
          </div>
        </div>

        {/* Navigation Tabs (Centrada y balanceada sin espacios vacíos) */}
        <div className="grid grid-cols-2 md:grid-cols-4 p-1.5 bg-card rounded-2xl border border-app gap-1.5">
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'themes'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app hover:bg-surface/50'
            }`}
          >
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Personalización</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app hover:bg-surface/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Gestión de Usuarios</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app hover:bg-surface/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Categorías</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app hover:bg-surface/50'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Respaldo</span>
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
              <h3 className="text-sm font-bold text-app">Tema de Interfaz</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {THEME_MODE_OPTIONS.map((theme) => {
                const isSelected = currentThemeMode === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => onChangeThemeMode(theme.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-primary-custom ring-2 ring-primary-custom shadow-lg bg-card'
                        : 'border-app bg-card/60 hover:bg-card text-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{theme.icon}</span>
                        <div
                          className="w-4 h-4 rounded-full border border-white/20 shadow-inner"
                          style={{ backgroundColor: theme.previewBg }}
                        />
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary-custom" />}
                    </div>
                    <div className="font-bold text-sm text-app">{theme.name}</div>
                    <div className="text-[11px] text-muted mt-0.5">{theme.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Palette */}
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
            <div>
              <h3 className="text-sm font-bold text-app">Paleta de Color de Acento</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2.5">
              {ACCENT_COLOR_OPTIONS.map((option) => {
                const isSelected = currentAccentColor === option.color;
                return (
                  <button
                    key={option.color}
                    onClick={() => onChangeAccentColor(option.color)}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary-custom bg-card ring-2 ring-primary-custom shadow-md'
                        : 'border-app bg-card/60 hover:bg-card'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: option.color }}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] font-bold text-app text-center truncate w-full">
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

      {/* TAB 4: SINCRONIZACIÓN & BACKUP (ADMIN) */}
      {activeTab === 'backup' && (
        <div className="animate-in fade-in duration-200">
          <AdminBackup
            categories={categories}
            accounts={accounts}
            rates={rates}
            isOnline={isOnline}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            currentUserId={currentUserId}
            onOpenAudit={onOpenAudit}
          />
        </div>
      )}
    </div>
  );
};
