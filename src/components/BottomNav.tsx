import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Briefcase,
  Receipt,
  Plus,
} from 'lucide-react';
import type { ActiveViewType } from './Sidebar.tsx';

interface BottomNavProps {
  activeView: ActiveViewType;
  onChangeView: (view: ActiveViewType) => void;
  onOpenQuickAction: () => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onChangeView,
  onOpenQuickAction,
  pendingCount = 0,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-app px-2 py-1.5 shadow-2xl safe-area-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* Dashboard Tab */}
        <button
          onClick={() => onChangeView('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeView === 'dashboard'
              ? 'text-primary-custom font-bold'
              : 'text-muted hover:text-app font-normal'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] mt-1">Inicio</span>
        </button>

        {/* Quincenas Tab */}
        <button
          onClick={() => onChangeView('fortnight')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeView === 'fortnight'
              ? 'text-primary-custom font-bold'
              : 'text-muted hover:text-app font-normal'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[9px] mt-1">Quincenas</span>
        </button>

        {/* Central Prominent Action Button (+) */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={onOpenQuickAction}
            className="w-13 h-13 rounded-full bg-primary-custom text-white flex items-center justify-center shadow-lg shadow-primary-custom/40 hover:opacity-95 active:scale-95 transition-all border-4 border-app cursor-pointer"
            title="Registrar movimiento o abono rápido"
            aria-label="Agregar"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* Gestión de Ingresos Tab */}
        <button
          onClick={() => onChangeView('incomes')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeView === 'incomes'
              ? 'text-[#00C2C7] font-bold'
              : 'text-muted hover:text-app font-normal'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[9px] mt-1">Ingresos</span>
        </button>

        {/* Gastos Fijos Tab */}
        <button
          onClick={() => onChangeView('fixed_expenses')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeView === 'fixed_expenses'
              ? 'text-[#FF914D] font-bold'
              : 'text-muted hover:text-app font-normal'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[9px] mt-1">Gastos</span>
          {pendingCount > 0 && (
            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-[#FF914D] animate-ping" />
          )}
        </button>
      </div>
    </div>
  );
};
