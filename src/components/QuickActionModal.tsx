import React from 'react';
import { X, ArrowDownLeft, ArrowUpRight, CreditCard, PlusCircle } from 'lucide-react';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTransaction: (type: 'expense' | 'income') => void;
  onSelectDebtPayment: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onSelectTransaction,
  onSelectDebtPayment,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md bg-surface border border-app rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold relative shadow-inner">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-app leading-tight">
                ¿Qué deseas registrar?
              </h3>
              <p className="text-[11px] text-muted">
                Acciones rápidas para tu planificación quincenal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Quick Expense */}
          <button
            onClick={() => {
              onClose();
              onSelectTransaction('expense');
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-[#FF914D]/60 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF914D]/20 text-[#FF914D] flex items-center justify-center font-bold shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-[#FF914D] transition-colors">
                  Registrar Gasto
                </h4>
                <p className="text-[11px] text-muted">Comida, compras, salidas, servicios...</p>
              </div>
            </div>
          </button>

          {/* Quick Income */}
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
                <p className="text-[11px] text-muted">Sueldo puntual, bonos, extras, transferencias...</p>
              </div>
            </div>
          </button>

          {/* Debt Payment */}
          <button
            onClick={() => {
              onClose();
              onSelectDebtPayment();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card hover:bg-surface border border-app hover:border-primary-custom/60 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-app group-hover:text-primary-custom transition-colors">
                  Abonar a una Deuda
                </h4>
                <p className="text-[11px] text-muted">Descuenta capital/intereses con cálculo de tasa BCV</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
