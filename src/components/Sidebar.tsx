import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  CreditCard,
  History,
  TrendingUp,
  Settings,
  Briefcase,
  PiggyBank,
  Wallet,
  LogOut,
} from 'lucide-react';
import type { ExchangeRatesData, UserProfile } from '../types/index.ts';

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
  activeProfile?: UserProfile;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onChangeView,
  isOnline: _isOnline,
  isSyncing: _isSyncing,
  pendingCount: _pendingCount,
  movementsCount = 0,
  rates: _rates,
  isAdmin = false,
  isCollapsed = false,
  onToggleCollapse: _onToggleCollapse,
  onSync: _onSync,
  onOpenConverter: _onOpenConverter,
  onSignOut,
  activeProfile,
  onOpenProfile,
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

      {/* Bottom User Profile & Logout Section */}
      <div className={`pt-3 border-t border-app ${isCollapsed ? 'px-0' : ''}`}>
        {!isCollapsed ? (
          <div className="flex items-center justify-between p-1.5 rounded-2xl bg-card border border-app hover:border-slate-600 transition-all">
            {/* Clickable user profile button */}
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left p-1 rounded-xl hover:bg-surface transition-colors cursor-pointer group"
              title="Ver / Editar Mi Perfil"
            >
              <div className="w-8 h-8 rounded-xl bg-surface border border-app flex items-center justify-center text-base shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                {activeProfile?.avatar_url || activeProfile?.avatar || '👨‍💻'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-app block truncate group-hover:text-primary-custom transition-colors">
                  {activeProfile?.name || 'Usuario'}
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full inline-block ${
                    isAdmin
                      ? 'bg-[#FF914D]/20 text-[#FF914D] border border-[#FF914D]/40'
                      : 'bg-[#00C2C7]/20 text-[#00C2C7] border border-[#00C2C7]/40'
                  }`}
                >
                  {isAdmin ? 'ADMIN' : 'USUARIO'}
                </span>
              </div>
            </button>

            {/* Direct Logout Icon */}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-2 rounded-xl text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0 ml-1"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onOpenProfile}
              className="w-9 h-9 rounded-xl bg-card hover:bg-surface border border-app flex items-center justify-center text-base transition-transform hover:scale-105 cursor-pointer"
              title={`${activeProfile?.name || 'Usuario'} (${isAdmin ? 'ADMIN' : 'USUARIO'})`}
            >
              {activeProfile?.avatar_url || activeProfile?.avatar || '👨‍💻'}
            </button>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-2 rounded-xl text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
