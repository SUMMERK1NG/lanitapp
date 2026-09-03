import React from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  PlusCircle,
  Receipt,
  Sparkles,
} from 'lucide-react';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFixedExpense?: () => void;
  onSelectVariableExpense?: () => void;
  onSelectTransaction: (type: 'expense' | 'income') => void;
  onSelectDebtPayment: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onSelectFixedExpense,
  onSelectVariableExpense,
  onSelectTransaction,
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
          {/* 1. Gasto Fijo Recurrente */}
          {onSelectFixedExpense && (
            <button
              onClick={() => {
                onClose();
                onSelectFixedExpense();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-primary-custom/60 transition-all text-left group cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-primary-custom transition-colors">
                      Gasto Fijo Recurrente
                    </h4>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-primary-custom/20 text-primary-custom">
                      Planificado
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Alquiler, suscripciones, internet, condominio con día de corte y quincena...
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* 2. Gasto Variable de Quincena */}
          {onSelectVariableExpense && (
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
          )}

          {/* 3. Gasto Puntual / Diario */}
          <button
            onClick={() => {
              onClose();
              onSelectTransaction('expense');
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-rose-500/60 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-rose-400 transition-colors">
                  Registrar Gasto Diario / Consumo
                </h4>
                <p className="text-[11px] text-muted">
                  Comida, café, taxi, débito o pago directo de cuenta...
                </p>
              </div>
            </div>
          </button>

          {/* 4. Ingreso */}
          <button
            onClick={() => {
              onClose();
              onSelectTransaction('income');
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-[#00C2C7]/60 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold shrink-0">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-[#00C2C7] transition-colors">
                  Registrar Ingreso
                </h4>
                <p className="text-[11px] text-muted">
                  Sueldo puntual, bonos, extras, transferencias recibidas...
                </p>
              </div>
            </div>
          </button>

          {/* 5. Abono a Deuda */}
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
