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
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);

  const moreViews: ActiveViewType[] = ['fixed_expenses', 'savings', 'debts', 'incomes', 'rates', 'settings', 'transactions'];
  const isMoreActive = moreViews.includes(activeView);

  const handleSelectMoreOption = (action: () => void) => {
    setIsMoreOpen(false);
    action();
  };

  const moreMenuItems = [
    {
      id: 'incomes',
      title: 'Gestión de Ingresos',
      description: 'Sueldos fijos y extras por quincena',
      icon: Briefcase,
      color: '#147DF0',
      action: () => onChangeView('incomes'),
      active: activeView === 'incomes',
    },
    {
      id: 'fixed_expenses',
      title: 'Gastos Fijos',
      description: 'Alquiler, servicios, suscripciones y compromisos',
      icon: Receipt,
      color: '#FF914D',
      action: () => onChangeView('fixed_expenses'),
      active: activeView === 'fixed_expenses',
    },
    {
      id: 'debts',
      title: 'Deudas y Cuotas',
      description: 'Cashea, préstamos y seguimiento de pagos',
      icon: CreditCard,
      color: '#F59E0B',
      action: () => onChangeView('debts'),
      active: activeView === 'debts',
    },
    {
      id: 'savings',
      title: 'Ahorros y Metas',
      description: 'Metas quincenales y aportes acumulados',
      icon: PiggyBank,
      color: '#10B981',
      action: () => onChangeView('savings'),
      active: activeView === 'savings',
    },
    {
      id: 'rates',
      title: 'Tasas BCV y Divisas',
      description: 'Histórico de cotizaciones, brecha y calculadora',
      icon: TrendingUp,
      color: '#8B5CF6',
      action: () => onChangeView('rates'),
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
      action: () => onChangeView('settings'),
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

            <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto no-scrollbar py-1">
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
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-app block">{item.title}</span>
                        <span className="text-[11px] text-muted block leading-tight">{item.description}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
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
            onClick={() => onChangeView('dashboard')}
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
            onClick={() => onChangeView('fortnight')}
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
            onClick={() => onChangeView('accounts')}
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
            {pendingCount > 0 && (
              <span className="absolute top-0.5 right-3 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>
        </div>
      </div>
    </>
  );
};
