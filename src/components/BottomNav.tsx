import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  Plus,
  MoreHorizontal,
  Wallet,
  PiggyBank,
  CreditCard,
  Briefcase,
  TrendingUp,
  Settings,
  X,
  ChevronRight,
  Bell,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import type { ActiveViewType } from './Sidebar.tsx';

interface BottomNavProps {
  activeView: ActiveViewType;
  onChangeView: (view: ActiveViewType) => void;
  onOpenQuickAction: () => void;
  onOpenConverter?: () => void;
  onOpenProfile?: () => void;
  onNavigateToSettings?: (tab?: 'themes' | 'categories' | 'users' | 'backup') => void;
  isAdmin?: boolean;
  pendingCount?: number;
  onSync?: () => void;
  isSyncing?: boolean;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onChangeView,
  onOpenQuickAction,
  onOpenConverter: _onOpenConverter,
  onOpenProfile: _onOpenProfile,
  onNavigateToSettings: _onNavigateToSettings,
  isAdmin = false,
  pendingCount = 0,
  onSync: _onSync,
  isSyncing = false,
  unreadNotificationsCount = 0,
  onOpenNotifications,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);

  const moreViews: ActiveViewType[] = ['fixed_expenses', 'savings', 'debts', 'incomes', 'rates', 'settings', 'transactions'];
  const isMoreActive = moreViews.includes(activeView);

  const handleSelectView = (view: ActiveViewType) => {
    onChangeView(view);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement?.scrollTo({ top: 0, behavior: 'smooth' });
      document.body?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectMoreOption = (action: () => void) => {
    setIsMoreOpen(false);
    action();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement?.scrollTo({ top: 0, behavior: 'smooth' });
      document.body?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const moreMenuItems = [
    {
      id: 'notifications',
      title: 'Centro de Notificaciones',
      description: unreadNotificationsCount > 0
        ? `${unreadNotificationsCount} aviso(s) de vencimiento o alerta(s)`
        : 'Alertas de cuotas, deudas y avisos del sistema',
      icon: Bell,
      color: '#EF4444',
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      action: () => {
        if (onOpenNotifications) {
          onOpenNotifications();
        }
      },
      active: false,
    },
    {
      id: 'incomes',
      title: 'Gestión de Ingresos',
      description: 'Sueldos fijos y extras por quincena',
      icon: Briefcase,
      color: '#147DF0',
      action: () => handleSelectView('incomes'),
      active: activeView === 'incomes',
    },
    {
      id: 'fixed_expenses',
      title: 'Gastos Fijos',
      description: 'Alquiler, servicios, suscripciones y compromisos',
      icon: Receipt,
      color: '#FF914D',
      action: () => handleSelectView('fixed_expenses'),
      active: activeView === 'fixed_expenses',
    },
    {
      id: 'debts',
      title: 'Deudas y Cuotas',
      description: 'Cashea, préstamos y seguimiento de pagos',
      icon: CreditCard,
      color: '#F59E0B',
      action: () => handleSelectView('debts'),
      active: activeView === 'debts',
    },
    {
      id: 'savings',
      title: 'Ahorros y Metas',
      description: 'Metas quincenales y aportes acumulados',
      icon: PiggyBank,
      color: '#10B981',
      action: () => handleSelectView('savings'),
      active: activeView === 'savings',
    },
    {
      id: 'rates',
      title: 'Tasas BCV y Divisas',
      description: 'Histórico de cotizaciones, brecha y calculadora',
      icon: TrendingUp,
      color: '#8B5CF6',
      action: () => handleSelectView('rates'),
      active: activeView === 'rates',
    },
    {
      id: 'settings',
      title: 'Configuración',
      description: isAdmin
        ? 'Temas, usuarios, categorías y respaldo'
        : 'Personalización y categorías',
      icon: Settings,
      color: '#94A3B8',
      action: () => handleSelectView('settings'),
      active: activeView === 'settings',
    },
  ];

  return (
    <>
      {/* Drawer / Menú Más en Móvil */}
      {isMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="fixed inset-0 cursor-pointer"
            onClick={() => setIsMoreOpen(false)}
          />

          <div className="relative z-10 w-full bg-surface border-t border-app rounded-t-3xl p-5 shadow-2xl safe-area-bottom space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <MoreHorizontal className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-app">Módulos y Herramientas</h3>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Estado de Sincronización Automática */}
            <div className="px-3.5 py-2 rounded-2xl bg-surface border border-app flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted">
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-primary-custom animate-spin shrink-0" />
                    <span className="text-[11px] text-app font-medium">Sincronizando automáticamente con la nube...</span>
                  </>
                ) : pendingCount > 0 ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-muted">Guardando {pendingCount} cambio(s) en segundo plano...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-muted">Sincronización en la nube al día</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[55vh] overflow-y-auto no-scrollbar py-1">
              {/* Módulos estándar */}
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectMoreOption(item.action)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      item.active
                        ? 'bg-primary-custom/15 border-primary-custom text-app font-bold'
                        : 'bg-card border-app text-muted hover:text-app hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-app block">{item.title}</span>
                        <span className="text-[11px] text-muted block leading-tight truncate">{item.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-sm animate-pulse">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Barra Inferior Principal (5 Botones) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-app px-2 py-1.5 shadow-2xl safe-area-bottom">
        <div className="max-w-md mx-auto flex items-center justify-around relative">
          {/* 1. Inicio Tab */}
          <button
            onClick={() => handleSelectView('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
              activeView === 'dashboard'
                ? 'text-primary-custom font-bold'
                : 'text-muted hover:text-app font-normal'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-semibold">Inicio</span>
          </button>

          {/* 2. Planificación Tab */}
          <button
            onClick={() => handleSelectView('fortnight')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
              activeView === 'fortnight'
                ? 'text-primary-custom font-bold'
                : 'text-muted hover:text-app font-normal'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-semibold">Planificación</span>
          </button>

          {/* 3. Botón Central Prominente (+) */}
          <div className="flex-1 flex justify-center -mt-6">
            <button
              onClick={onOpenQuickAction}
              className="w-13 h-13 rounded-full bg-primary-custom text-white flex items-center justify-center shadow-lg shadow-primary-custom/40 hover:opacity-95 active:scale-95 transition-all border-4 border-app cursor-pointer"
              title="Registrar nuevo movimiento, abono o deuda"
              aria-label="Agregar"
            >
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </button>
          </div>

          {/* 4. Capital Tab */}
          <button
            onClick={() => handleSelectView('accounts')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer relative ${
              activeView === 'accounts'
                ? 'text-primary-custom font-bold'
                : 'text-muted hover:text-app font-normal'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-semibold">Capital</span>
          </button>

          {/* 5. Más Tab */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer relative ${
              isMoreActive
                ? 'text-primary-custom font-bold'
                : 'text-muted hover:text-app font-normal'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] mt-1 font-semibold">Más</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};
