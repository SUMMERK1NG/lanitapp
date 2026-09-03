import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  CreditCard,
  History,
  TrendingUp,
  Settings,
  Calculator,
  Briefcase,
  PiggyBank,
  Wallet,
  LogOut,
} from 'lucide-react';
import type { ExchangeRatesData } from '../types/index.ts';

export type ActiveViewType =
  | 'dashboard'
  | 'fortnight'
  | 'incomes'
  | 'fixed_expenses'
  | 'debts'
  | 'savings'
  | 'accounts'
  | 'transactions'
  | 'rates'
  | 'settings';

interface SidebarProps {
  activeView: ActiveViewType;
  onChangeView: (view: ActiveViewType) => void;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  movementsCount?: number;
  rates: ExchangeRatesData;
  isAdmin?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSync: () => void;
  onOpenConverter: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onChangeView,
  isOnline: _isOnline,
  isSyncing: _isSyncing,
  pendingCount: _pendingCount,
  movementsCount = 0,
  rates,
  isAdmin = false,
  isCollapsed = false,
  onToggleCollapse: _onToggleCollapse,
  onSync: _onSync,
  onOpenConverter,
  onSignOut,
}) => {
  const baseMenuItems = [
    { id: 'dashboard' as const, label: 'Dashboard General', icon: LayoutDashboard },
    { id: 'fortnight' as const, label: 'Planificación', icon: Calendar },
    { id: 'incomes' as const, label: 'Gestión de Ingresos', icon: Briefcase },
    { id: 'fixed_expenses' as const, label: 'Gastos Fijos', icon: Receipt },
    { id: 'debts' as const, label: 'Control de Deudas', icon: CreditCard },
    { id: 'savings' as const, label: 'Planes de Ahorro', icon: PiggyBank },
    { id: 'accounts' as const, label: 'Capital', icon: Wallet },
    { id: 'transactions' as const, label: 'Historial de Movimientos', icon: History },
    { id: 'rates' as const, label: 'Tasas BCV & Divisas', icon: TrendingUp },
  ];

  const adminMenuItems = [
    { id: 'settings' as const, label: 'Configuración', icon: Settings },
  ];

  const menuItems = isAdmin ? [...baseMenuItems, ...adminMenuItems] : baseMenuItems;

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20 p-2.5' : 'w-64 p-4'
      } bg-surface border-r border-app h-screen sticky top-0 flex flex-col justify-between shrink-0 overflow-y-auto no-scrollbar transition-all duration-300 ease-in-out select-none`}
    >
      {/* Brand Header con Logotipo Oficial */}
      <div className="space-y-4">
        {/* App Logo & Header */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center py-2' : 'gap-3 px-2 py-3'
          }`}
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <img
              src="/icon.png"
              alt="Lanitapp Icon"
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white tracking-wider">
                  LANITAPP
                </span>
                {isAdmin && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 text-orange-400 shrink-0">
                    ADMIN
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed
                    ? 'justify-center px-0 py-3 relative'
                    : 'justify-between px-3.5 py-2.5'
                } rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-primary-custom text-white shadow-md'
                    : 'text-muted hover:text-app hover:bg-surface-hover'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 truncate'}`}>
                  <Icon
                    className={`shrink-0 transition-transform group-hover:scale-110 ${
                      isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
                    } ${isActive ? 'text-white' : 'text-muted'}`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {item.id === 'transactions' && movementsCount > 0 && (
                  isCollapsed ? (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF914D] animate-pulse" />
                  ) : (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#FF914D]/20 text-[#FF914D]'
                      }`}
                    >
                      {movementsCount}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Live Rates, System & Logout Widget */}
      <div className={`space-y-2.5 pt-3 border-t border-app ${isCollapsed ? 'px-0' : ''}`}>
        {/* Quick Exchange Widget (Expanded or Collapsed) */}
        {!isCollapsed ? (
          <div className="p-3 rounded-2xl bg-card border border-app space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider">
                Tasas en Vivo
              </span>
              <button
                onClick={onOpenConverter}
                className="text-[10px] text-[#00C2C7] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Calculator className="w-3 h-3" /> Convertir
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Dólar BCV:</span>
              <span className="font-bold text-app">Bs. {rates.bcvDollar.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Promedio:</span>
              <span className="font-bold text-[#FF914D]">Bs. {rates.parallelDollar.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onOpenConverter}
              className="p-2 rounded-xl bg-card hover:bg-surface-hover text-[#00C2C7] border border-app transition-all cursor-pointer"
              title="Calculadora / Conversor de Divisas"
            >
              <Calculator className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Logout Action */}
        {onSignOut && (
          <div className="pt-1">
            <button
              onClick={onSignOut}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } rounded-xl text-xs font-semibold text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer`}
              title="Cerrar sesión"
            >
              {!isCollapsed && <span>Cerrar sesión</span>}
              <LogOut className="w-4 h-4 text-muted hover:text-rose-400 shrink-0" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
