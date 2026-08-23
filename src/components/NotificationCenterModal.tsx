import React, { useState } from 'react';
import {
  Bell,
  X,
  Calendar,
  CreditCard,
  Receipt,
  CheckCircle2,
  Volume2,
  Sparkles,
} from 'lucide-react';
import type { Debt, FixedExpense, FortnightType } from '../types/index.ts';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts?: Debt[];
  fixedExpenses?: FixedExpense[];
}

export interface SystemNotification {
  id: string;
  type: 'fortnight' | 'debt' | 'fixed_expense' | 'savings' | 'info';
  title: string;
  description: string;
  dateStr: string;
  priority: 'high' | 'normal';
}

export function computeSystemNotifications(
  debts: Debt[] = [],
  fixedExpenses: FixedExpense[] = []
): SystemNotification[] {
  const notifications: SystemNotification[] = [];
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 1. Aviso de Quincena (Ventana de <= 5 días)
  if (currentDay <= 15) {
    const daysLeft = 15 - currentDay;
    if (daysLeft <= 5) {
      notifications.push({
        id: `notif_q1_${currentYear}_${currentMonth}`,
        type: 'fortnight',
        title:
          daysLeft === 0
            ? '¡Hoy es Quincena del 15!'
            : daysLeft === 1
            ? 'Falta 1 día para la Quincena del 15'
            : `Faltan ${daysLeft} días para la Quincena del 15`,
        description: 'Revisa tus asignaciones de gastos fijos y presupuesto para este periodo.',
        dateStr: '15 de este mes',
        priority: daysLeft <= 2 ? 'high' : 'normal',
      });
    }
  } else {
    const daysLeft = lastDayOfMonth - currentDay;
    if (daysLeft <= 5) {
      notifications.push({
        id: `notif_q2_${currentYear}_${currentMonth}`,
        type: 'fortnight',
        title:
          daysLeft === 0
            ? '¡Hoy es Cierre de Mes / Quincena 30!'
            : daysLeft === 1
            ? 'Falta 1 día para la Quincena del 30'
            : `Faltan ${daysLeft} días para el Cierre de Mes / Quincena 30`,
        description: 'Momento de conciliar pagos del mes y preparar el nuevo ciclo.',
        dateStr: `${lastDayOfMonth} de este mes`,
        priority: daysLeft <= 2 ? 'high' : 'normal',
      });
    }
  }

  // 2. Deudas / Cuotas Próximas (<= 5 días o ciclo actual)
  const currentFortnight: FortnightType = currentDay <= 15 ? 'q1' : 'q2';
  const activeDebts = debts.filter((d) => d.status === 'active' && d.current_balance > 0);

  for (const debt of activeDebts) {
    const amountDue = debt.installment_amount || (debt.current_balance > 0 ? debt.current_balance : 0);

    if (debt.due_date) {
      const dueDate = new Date(debt.due_date + 'T00:00:00');
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffMs = dueDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 5) {
        notifications.push({
          id: `notif_debt_due_${debt.id}`,
          type: 'debt',
          title:
            diffDays === 0
              ? `¡Cuota de ${debt.creditor} ($${amountDue.toFixed(2)}) vence hoy!`
              : diffDays === 1
              ? `Cuota de ${debt.creditor} ($${amountDue.toFixed(2)}) vence mañana`
              : `Cuota de ${debt.creditor} ($${amountDue.toFixed(2)}) vence en ${diffDays} días`,
          description: `Plataforma: ${debt.platform || 'particular'}. Saldo pendiente total: $${debt.current_balance.toFixed(2)}.`,
          dateStr: debt.due_date,
          priority: diffDays <= 2 ? 'high' : 'normal',
        });
        continue;
      }
    }

    // Si coincide con la quincena actual
    if (debt.fortnight_due === currentFortnight || debt.fortnight_due === 'both') {
      notifications.push({
        id: `notif_debt_period_${debt.id}`,
        type: 'debt',
        title: `Cuota asignada: ${debt.creditor} ($${amountDue.toFixed(2)})`,
        description: `Planificada para ${currentFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'}.`,
        dateStr: currentFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30',
        priority: 'high',
      });
    }
  }

  // 3. Gastos Fijos del Ciclo
  const cycleExpenses = fixedExpenses.filter(
    (f) => f.is_active && (f.default_fortnight === currentFortnight || f.default_fortnight === 'both')
  );
  if (cycleExpenses.length > 0) {
    const totalCycle = cycleExpenses.reduce((sum, f) => sum + f.amount, 0);
    notifications.push({
      id: `notif_cycle_expenses_${currentMonth}_${currentFortnight}`,
      type: 'fixed_expense',
      title: `Gastos fijos del ciclo: $${totalCycle.toFixed(2)} (${cycleExpenses.length} conceptos)`,
      description: `Asignados para la ${currentFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'}. Asegúrate de reservar el monto.`,
      dateStr: currentFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30',
      priority: 'normal',
    });
  }

  return notifications;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  debts = [],
  fixedExpenses = [],
}) => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const notifications = computeSystemNotifications(debts, fixedExpenses);

  const handleRequestPush = async () => {
    if (typeof Notification !== 'undefined') {
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      if (result === 'granted') {
        new Notification('LANITAPP Alertas', {
          body: '¡Notificaciones habilitadas! Recibirás avisos oportunos de quincenas y cuotas.',
          icon: '/icon.png',
        });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop para cerrar al hacer clic afuera */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

      {/* Floating Notification Panel Dropdown */}
      <div className="absolute right-0 top-12 z-50 w-80 md:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-app max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold relative">
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF914D] text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {notifications.length}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Centro de Notificaciones</h3>
              <p className="text-[10px] text-slate-400">Avisos de quincenas, deudas y gastos del ciclo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser Push Banner */}
        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Volume2 className="w-4 h-4 text-[#00C2C7] shrink-0" />
            <div>
              <span className="font-bold text-white block text-[11px]">Notificaciones del Navegador</span>
              <span className="text-[10px] text-slate-400">
                {permissionStatus === 'granted'
                  ? 'Activas en este dispositivo'
                  : 'Recibe alertas automáticas'}
              </span>
            </div>
          </div>
          {permissionStatus !== 'granted' ? (
            <button
              onClick={handleRequestPush}
              className="px-2.5 py-1 rounded-lg bg-primary-custom text-white text-[11px] font-bold shadow-sm hover:opacity-95 cursor-pointer whitespace-nowrap"
            >
              Habilitar
            </button>
          ) : (
            <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Activo
            </span>
          )}
        </div>

        {/* Notification Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar max-h-[50vh]">
          {notifications.length === 0 ? (
            <div className="text-center py-8 space-y-2.5 text-slate-400">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Estás al día con tus pagos y quincenas 🎉</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                  No tienes deudas urgentes ni alertas de quincena en este momento.
                </p>
              </div>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border transition-all ${
                  notif.priority === 'high'
                    ? 'bg-[#FF914D]/10 border-[#FF914D]/30'
                    : 'bg-slate-800/60 border-slate-700/60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      notif.type === 'fortnight'
                        ? 'bg-primary-custom/20 text-primary-custom'
                        : notif.type === 'debt'
                        ? 'bg-[#FF914D]/20 text-[#FF914D]'
                        : 'bg-[#00C2C7]/20 text-[#00C2C7]'
                    }`}
                  >
                    {notif.type === 'fortnight' ? (
                      <Calendar className="w-3.5 h-3.5" />
                    ) : notif.type === 'debt' ? (
                      <CreditCard className="w-3.5 h-3.5" />
                    ) : (
                      <Receipt className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-bold text-white truncate">{notif.title}</h4>
                      <span className="text-[9px] text-slate-400 font-medium shrink-0">
                        {notif.dateStr}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{notif.description}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-slate-800 mt-2.5 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer text-center"
          >
            Cerrar Alertas
          </button>
        </div>
      </div>
    </>
  );
};
