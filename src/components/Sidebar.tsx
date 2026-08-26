import {
  LayoutDashboard,
  Calendar,
  Receipt,
  CreditCard,
  History,
  TrendingUp,
  Settings,
  RefreshCw,
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
  onSync: () => void;
  onOpenConverter: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onChangeView,
  isOnline,
  isSyncing,
  pendingCount: _pendingCount,
  movementsCount = 0,
  rates,
  isAdmin = true,
  onSync,
  onOpenConverter,
  onSignOut,
}) => {
  const baseMenuItems = [
    { id: 'dashboard' as const, label: 'Dashboard General', icon: LayoutDashboard },
    { id: 'fortnight' as const, label: 'Plan Quincenal', icon: Calendar },
    { id: 'incomes' as const, label: 'Gestión de Ingresos', icon: Briefcase },
    { id: 'fixed_expenses' as const, label: 'Gastos Fijos', icon: Receipt },
    { id: 'debts' as const, label: 'Control de Deudas', icon: CreditCard },
    { id: 'savings' as const, label: 'Planes de Ahorro', icon: PiggyBank },
    { id: 'accounts' as const, label: 'Capital & Cuentas', icon: Wallet },
    { id: 'transactions' as const, label: 'Historial de Movimientos', icon: History },
    { id: 'rates' as const, label: 'Tasas BCV & Divisas', icon: TrendingUp },
  ];

  const adminMenuItems = [
    { id: 'settings' as const, label: 'Configuración & Backup', icon: Settings },
  ];

  const menuItems = isAdmin ? [...baseMenuItems, ...adminMenuItems] : baseMenuItems;

  return (
    <aside className="w-64 bg-surface border-r border-app h-screen sticky top-0 flex flex-col justify-between p-4 shrink-0 overflow-y-auto no-scrollbar">
      {/* Brand Header con Logotipo Oficial */}
      <div className="space-y-5">
        {/* App Logo & Header */}
        <div className="flex items-center gap-3 px-2 py-4">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/icon.png" alt="Lanitapp Icon" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white tracking-wider">LANITAPP</span>
              {isAdmin && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 text-orange-400">
                  ADMIN
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-medium">Control de Gastos</span>
          </div>
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary-custom text-white shadow-md'
                    : 'text-muted hover:text-app hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-muted'}`} />
                  <span>{item.label}</span>
                </div>

                {item.id === 'transactions' && movementsCount > 0 && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#FF914D]/20 text-[#FF914D]'
                  }`}>
                    {movementsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Live Rates, System & Logout Widget */}
      <div className="space-y-3 pt-4 border-t border-app">
        {/* Quick Exchange Widget */}
        <div className="p-3 rounded-2xl bg-card border border-app space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Tasas en Vivo</span>
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

        {/* Sync & Logout Toolbar */}
        <div className="flex items-center justify-between px-2 text-xs">
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[#FF914D]" />
            )}
            <span className="text-[11px] text-muted font-medium">
              {isOnline ? (isSyncing ? 'Sincronizando...' : 'Conectado') : 'Modo Offline'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onSync}
              disabled={isSyncing || !isOnline}
              className="p-1.5 rounded-xl hover:bg-card text-muted hover:text-app transition-all disabled:opacity-40 cursor-pointer"
              title="Forzar sincronización"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#00C2C7]' : ''}`} />
            </button>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-1.5 rounded-xl hover:bg-[#ef4444]/20 text-muted hover:text-[#ef4444] transition-all cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
