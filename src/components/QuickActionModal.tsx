import React from 'react';
import {
  X,
  CreditCard,
  PlusCircle,
  Sparkles,
  ArrowDownLeft,
} from 'lucide-react';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVariableIncome: () => void;
  onSelectVariableExpense: () => void;
  onSelectDebtPayment: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onSelectVariableIncome,
  onSelectVariableExpense,
  onSelectDebtPayment,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface border border-app rounded-t-3xl sm:rounded-3xl shadow-2xl text-app max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fijo arriba */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-app shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold relative shadow-inner">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-app leading-tight">
                ¿Qué deseas registrar?
              </h3>
              <p className="text-[11px] text-muted">Acciones rápidas del mes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content con scrollbar interno seguro */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-2.5">
          {/* 1. Ingreso Variable / Extra */}
          <button
            onClick={() => {
              onClose();
              onSelectVariableIncome();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-[#00C2C7]/60 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold shrink-0">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-[#00C2C7] transition-colors">
                    Ingreso Variable / Extra
                  </h4>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#00C2C7]/20 text-[#00C2C7]">
                    Q15 / Q30
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  Freelance, bonos, guardias o ingresos extras por quincena...
                </p>
              </div>
            </div>
          </button>

          {/* 2. Gasto Variable de Quincena */}
          <button
            onClick={() => {
              onClose();
              onSelectVariableExpense();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-[#FF914D]/60 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF914D]/20 text-[#FF914D] flex items-center justify-center font-bold shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-[#FF914D] transition-colors">
                    Gasto Variable de Quincena
                  </h4>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#FF914D]/20 text-[#FF914D]">
                    Q15 / Q30
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  Compras, salidas o imprevistos a descontar de Quincena 15 o Quincena 30...
                </p>
              </div>
            </div>
          </button>

          {/* 3. Abonar a una Deuda */}
          <button
            onClick={() => {
              onClose();
              onSelectDebtPayment();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-amber-500/60 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-amber-400 transition-colors">
                  Abonar a una Deuda
                </h4>
                <p className="text-[11px] text-muted">
                  Cashea, cuotas, préstamos con cálculo de tasa BCV...
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

