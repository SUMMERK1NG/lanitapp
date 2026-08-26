import React, { useState, useMemo } from 'react';
import {
  Bell,
  X,
  Calendar,
  CreditCard,
  Receipt,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Debt, FixedExpense } from '../types/index.ts';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts?: Debt[];
  fixedExpenses?: FixedExpense[];
  selectedYear?: number;
  selectedMonth?: number;
}

export interface SystemNotification {
  id: string;
  type: 'fortnight' | 'debt' | 'fixed_expense' | 'savings' | 'info';
  title: string;
  description: string;
  dateStr: string;
  priority: 'high' | 'normal';
  month?: number;
  year?: number;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function computeSystemNotifications(
  debts: Debt[] = [],
  fixedExpenses: FixedExpense[] = [],
  targetYear?: number,
  targetMonth?: number
): SystemNotification[] {
  const notifications: SystemNotification[] = [];
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = targetMonth !== undefined ? targetMonth : now.getMonth();
  const currentYear = targetYear !== undefined ? targetYear : now.getFullYear();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 1. Aviso de Quincena
  if (currentDay <= 15) {
    const daysLeft = 15 - currentDay;
    notifications.push({
      id: `notif_q1_${currentYear}_${currentMonth}`,
      type: 'fortnight',
      title:
        daysLeft === 0
          ? '¡Hoy es Quincena del 15!'
          : daysLeft === 1
          ? 'Falta 1 día para la Quincena 15'
          : `Faltan ${daysLeft} días para la Quincena 15`,
      description: `Revisa tus asignaciones de gastos y compromisos para el 15 de ${MONTH_NAMES[currentMonth]}.`,
      dateStr: `15 ${MONTH_NAMES[currentMonth]}`,
      priority: daysLeft <= 2 ? 'high' : 'normal',
      year: currentYear,
      month: currentMonth,
    });
  } else {
    const daysLeft = lastDayOfMonth - currentDay;
    notifications.push({
      id: `notif_q2_${currentYear}_${currentMonth}`,
      type: 'fortnight',
      title:
        daysLeft === 0
          ? '¡Hoy es Cierre de Mes / Quincena 30!'
          : daysLeft === 1
          ? 'Falta 1 día para la Quincena 30'
          : `Faltan ${daysLeft} días para el Cierre de Mes`,
      description: `Concilia los pagos de ${MONTH_NAMES[currentMonth]} y prepara el nuevo ciclo quincenal.`,
      dateStr: `${lastDayOfMonth} ${MONTH_NAMES[currentMonth]}`,
      priority: daysLeft <= 3 ? 'high' : 'normal',
      year: currentYear,
      month: currentMonth,
    });
  }

  // 2. Alertas de Cuotas de Deuda
  debts.forEach((debt) => {
    if (debt.status === 'paid') return;
    const remaining = debt.current_balance || debt.total_amount || 0;
    if (remaining <= 0) return;

    const installment = debt.installment_amount || remaining;
    const fnLabel = debt.fortnight_due === 'q1' ? 'Quincena 15' : 'Quincena 30';

    notifications.push({
      id: `notif_debt_${debt.id}`,
      type: 'debt',
      title: `Cuota asignada: ${debt.creditor || 'Deuda'} ($${installment.toFixed(2)})`,
      description: `Planificada para ${fnLabel} de ${MONTH_NAMES[currentMonth]}. Saldo restante: $${remaining.toFixed(2)}.`,
      dateStr: `${fnLabel}`,
      priority: 'high',
      year: currentYear,
      month: currentMonth,
    });
  });

  // 3. Alertas de Gastos Fijos de alto impacto (> $50)
  fixedExpenses.forEach((exp) => {
    if (exp.is_active === false) return;
    if (exp.amount >= 50) {
      const fnLabel = exp.default_fortnight === 'both'
        ? 'Ambas Quincenas (15 y 30)'
        : exp.default_fortnight === 'q2'
        ? 'Quincena 30'
        : 'Quincena 15';

      notifications.push({
        id: `notif_exp_${exp.id}`,
        type: 'fixed_expense',
        title: `Compromiso fijo: ${exp.name} ($${exp.amount.toFixed(2)})`,
        description: `Asignado en ${fnLabel}. Asegura disponibilidad de saldo.`,
        dateStr: fnLabel.includes('Ambas') ? '15 y 30' : fnLabel.includes('30') ? '30' : '15',
        priority: 'normal',
        year: currentYear,
        month: currentMonth,
      });
    }
  });

  return notifications;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  debts = [],
  fixedExpenses = [],
  selectedYear,
  selectedMonth,
}) => {
  const today = new Date();
  const activeYear = selectedYear ?? today.getFullYear();
  const activeMonth = selectedMonth ?? today.getMonth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'debt' | 'fortnight' | 'fixed_expense'>('all');

  const rawNotifications = useMemo(() => {
    return computeSystemNotifications(debts, fixedExpenses, activeYear, activeMonth);
  }, [debts, fixedExpenses, activeYear, activeMonth]);

  const visibleNotifications = useMemo(() => {
    return rawNotifications.filter((n) => {
      if (dismissedIds.has(n.id)) return false;
      if (activeFilterTab !== 'all' && n.type !== activeFilterTab) return false;
      return true;
    });
  }, [rawNotifications, dismissedIds, activeFilterTab]);

  const handleDismissAll = () => {
    const newSet = new Set(dismissedIds);
    rawNotifications.forEach((n) => newSet.add(n.id));
    setDismissedIds(newSet);
  };

  const handleDismissSingle = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Centered Modal Window */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header without redundant date filter */}
        <div className="flex items-center justify-between pb-3 border-b border-app mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold relative shadow-inner">
              <Bell className="w-5 h-5" />
              {visibleNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF914D] text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {visibleNotifications.length}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-app leading-tight">Centro de Alertas</h3>
              <p className="text-[11px] text-muted">Avisos y compromisos pendientes</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2 shrink-0">
          {[
            { id: 'all' as const, label: 'Todas' },
            { id: 'debt' as const, label: 'Deudas & Cuotas' },
            { id: 'fortnight' as const, label: 'Quincenas' },
            { id: 'fixed_expense' as const, label: 'Gastos Fijos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFilterTab === tab.id
                  ? 'bg-primary-custom text-white shadow-sm'
                  : 'bg-card text-muted border border-app hover:text-app'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification Items List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar max-h-[50vh]">
          {visibleNotifications.length === 0 ? (
            <div className="text-center py-10 space-y-3 text-muted">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-app">Sin alertas pendientes para este mes 🎉</p>
                <p className="text-[11px] text-muted mt-0.5 max-w-xs mx-auto">
                  Tus pagos y compromisos de {MONTH_NAMES[activeMonth]} {activeYear} están al día.
                </p>
              </div>
            </div>
          ) : (
            visibleNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-2xl border transition-all shadow-sm ${
                  notif.priority === 'high'
                    ? 'bg-[#FF914D]/10 border-[#FF914D]/30'
                    : 'bg-card border-app'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      notif.type === 'fortnight'
                        ? 'bg-primary-custom/20 text-primary-custom'
                        : notif.type === 'debt'
                        ? 'bg-[#FF914D]/20 text-[#FF914D]'
                        : 'bg-[#00C2C7]/20 text-[#00C2C7]'
                    }`}
                  >
                    {notif.type === 'fortnight' ? (
                      <Calendar className="w-4 h-4" />
                    ) : notif.type === 'debt' ? (
                      <CreditCard className="w-4 h-4" />
                    ) : (
                      <Receipt className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className="text-xs font-bold text-app">{notif.title}</h4>
                      <span className="text-[9px] text-muted font-black px-2 py-0.5 rounded-full bg-surface border border-app shrink-0">
                        {notif.dateStr}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">{notif.description}</p>
                  </div>
                  <button
                    onClick={() => handleDismissSingle(notif.id)}
                    className="p-1 rounded-lg text-muted hover:text-app hover:bg-surface transition-all cursor-pointer shrink-0"
                    title="Descartar alerta"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-app mt-3 shrink-0 flex items-center justify-between gap-2">
          {visibleNotifications.length > 0 ? (
            <button
              onClick={handleDismissAll}
              className="text-xs font-bold text-muted hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Descartar todas</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-card hover:bg-surface border border-app text-app text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar Alertas
          </button>
        </div>
      </div>
    </div>
  );
};
