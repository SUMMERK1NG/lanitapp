import React from 'react';
import { X, ArrowDownLeft, ArrowUpRight, CreditCard } from 'lucide-react';

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
      <div className="w-full sm:max-w-md bg-[#203657] border border-[#2a4365] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-3 border-b border-[#2a4365] mb-4">
          <h3 className="text-base font-extrabold text-white">¿Qué deseas registrar?</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#29446c] text-[#9ba3af] hover:text-white transition-colors cursor-pointer"
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
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1c2e4a] hover:bg-[#29446c] border border-[#2a4365] hover:border-[#ff914d]/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff914d]/20 text-[#ff914d] flex items-center justify-center font-bold">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#ff914d] transition-colors">
                  Registrar Gasto
                </h4>
                <p className="text-[11px] text-[#9ba3af]">Comida, compras, transporte, servicios...</p>
              </div>
            </div>
          </button>

          {/* Quick Income */}
          <button
            onClick={() => {
              onClose();
              onSelectTransaction('income');
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1c2e4a] hover:bg-[#29446c] border border-[#2a4365] hover:border-[#00c2c7]/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00c2c7]/20 text-[#00c2c7] flex items-center justify-center font-bold">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#00c2c7] transition-colors">
                  Registrar Ingreso
                </h4>
                <p className="text-[11px] text-[#9ba3af]">Sueldo, bonos, extras, transferencias...</p>
              </div>
            </div>
          </button>

          {/* Debt Payment */}
          <button
            onClick={() => {
              onClose();
              onSelectDebtPayment();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#1c2e4a] to-[#203657] hover:from-[#29446c] hover:to-[#203657] border border-[#147df0]/40 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#147df0]/20 text-[#147df0] flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#00c2c7] transition-colors">
                  Abonar a una Deuda
                </h4>
                <p className="text-[11px] text-[#9ba3af]">Descuenta saldo con cálculo de tasa BCV del día</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
