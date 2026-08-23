import React, { useState } from 'react';
import {
  RefreshCw,
  Calculator,
  DollarSign,
  TrendingUp,
  Euro,
  Bell,
} from 'lucide-react';
import type { ExchangeRatesData, SyncResult, UserProfile, Debt, FixedExpense } from '../types/index.ts';
import { NotificationCenterModal, computeSystemNotifications } from './NotificationCenterModal.tsx';

interface HeaderProps {
  activeViewTitle?: string;
  rates: ExchangeRatesData;
  ratesLoading?: boolean;
  ratesRefreshing?: boolean;
  onRefreshRates?: () => void;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastSyncResult: SyncResult | null;
  pendingCount: number;
  activeProfile?: UserProfile | null;
  debts?: Debt[];
  fixedExpenses?: FixedExpense[];
  onSync: () => void;
  onOpenConverter: () => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeViewTitle = 'LANITAPP',
  rates,
  ratesRefreshing,
  onRefreshRates,
  isOnline,
  isSyncing,
  lastSyncTime,
  activeProfile,
  debts = [],
  fixedExpenses = [],
  onSync,
  onOpenConverter,
  onOpenProfile,
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);

  // Compute active notifications
  const notifications = computeSystemNotifications(debts, fixedExpenses);
  const unreadCount = notifications.length;

  // Resolve user avatar: profile.avatar_url > profile.avatar > localStorage('user_avatar') > '👑'
  const userAvatar =
    activeProfile?.avatar_url ||
    activeProfile?.avatar ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('user_avatar') : null) ||
    '👑';

  const isImageAvatar = Boolean(
    userAvatar && (userAvatar.startsWith('data:') || userAvatar.startsWith('http') || userAvatar.startsWith('/'))
  );

  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-app px-3 sm:px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Side: Active View Title (Mobile shows miniature logo + title, Desktop shows view title only) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="lg:hidden w-8 h-8 flex items-center justify-center shrink-0">
            <img
              src="/icon.png"
              alt="LANITAPP"
              className="h-full w-full object-contain drop-shadow-sm"
            />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-tight text-app leading-tight">
              {activeViewTitle}
            </h2>
          </div>
        </div>

        {/* Live BCV & Parallel Rates Widget in Header */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Dólar BCV */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-app shrink-0">
            <div className="w-4 h-4 rounded-md bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold text-[9px]">
              <DollarSign className="w-2.5 h-2.5" />
            </div>
            <div>
              <span className="text-[9px] text-muted block leading-none">Dólar BCV</span>
              <span className="text-xs font-bold text-app tracking-tight">
                Bs. {rates.bcvDollar.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Paralelo */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-app shrink-0">
            <div className="w-4 h-4 rounded-md bg-[#FF914D]/20 text-[#FF914D] flex items-center justify-center font-bold text-[9px]">
              <TrendingUp className="w-2.5 h-2.5" />
            </div>
            <div>
              <span className="text-[9px] text-muted block leading-none">Paralelo</span>
              <span className="text-xs font-bold text-[#FF914D] tracking-tight">
                Bs. {rates.parallelDollar.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Euro BCV */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-app shrink-0">
            <div className="w-4 h-4 rounded-md bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold text-[9px]">
              <Euro className="w-2.5 h-2.5" />
            </div>
            <div>
              <span className="text-[9px] text-muted block leading-none">Euro BCV</span>
              <span className="text-xs font-bold text-[#00C2C7] tracking-tight">
                Bs. {rates.bcvEuro.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Brecha */}
          <div className="hidden xl:flex items-center gap-1 text-[10px] font-bold text-[#FF914D] bg-[#FF914D]/10 border border-[#FF914D]/30 px-2 py-1 rounded-xl shrink-0">
            <span>Brecha:</span>
            <span>+{rates.spreadPercentage}%</span>
          </div>

          {/* Refrescar Tasas Button */}
          {onRefreshRates && (
            <button
              onClick={onRefreshRates}
              className="p-1.5 rounded-xl bg-card hover:bg-surface-hover text-muted hover:text-app border border-app transition-colors shrink-0 cursor-pointer"
              title={`Tasas actualizadas: ${rates.lastUpdated}. Clic para actualizar.`}
            >
              <RefreshCw className={`w-3 h-3 ${ratesRefreshing ? 'animate-spin text-[#00C2C7]' : ''}`} />
            </button>
          )}
        </div>

        {/* Action Controls, Notification Bell & User Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Botón Único de Calculadora */}
          <button
            onClick={onOpenConverter}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            title="Abrir Calculadora y Conversor de Divisas"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Calculadora</span>
          </button>

          {/* Centro de Notificaciones (Icono de Campana + Dropdown Flotante) */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2 rounded-xl bg-card hover:bg-surface-hover border border-app text-app shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Centro de Notificaciones y Alertas"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF914D] text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Flotante */}
            <NotificationCenterModal
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              debts={debts}
              fixedExpenses={fixedExpenses}
            />
          </div>

          {/* Indicador de Estado de Sincronización */}
          <button
            onClick={onSync}
            disabled={isSyncing || !isOnline}
            className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
              !isOnline
                ? 'bg-card text-amber-400 border-amber-400/30'
                : isSyncing
                ? 'bg-card text-[#00C2C7] border-[#00C2C7]/30'
                : 'bg-card text-emerald-400 border-emerald-500/30'
            }`}
            title={
              !isOnline
                ? 'Modo Offline: datos guardados localmente'
                : isSyncing
                ? 'Sincronizando con la nube...'
                : `Sincronizado: ${lastSyncTime || 'Al iniciar'}`
            }
          >
            {!isOnline ? (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            ) : isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00C2C7]" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
            <span className="hidden md:inline text-[11px] font-bold">
              {!isOnline ? 'Modo Offline' : isSyncing ? 'Sincronizando...' : 'Sincronizado'}
            </span>
          </button>

          {/* Botón Único de Perfil / Avatar en esquina superior derecha */}
          <button
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-xl bg-card hover:bg-surface-hover border-2 border-primary-custom flex items-center justify-center text-sm overflow-hidden shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Perfil de Usuario & Ajustes de Tema"
          >
            {isImageAvatar ? (
              <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-base select-none leading-none">{userAvatar}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
