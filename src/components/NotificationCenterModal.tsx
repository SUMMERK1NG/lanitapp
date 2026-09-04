import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  X,
  Calendar,
  CreditCard,
  Receipt,
  Sparkles,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { Debt, FixedExpense, FixedIncome, VariableIncome, VariableExpense } from '../types/index.ts';

export interface SystemNotification {
  id: string;
  type: 'deficit' | 'fortnight' | 'debt' | 'fixed_expense' | 'savings' | 'info';
  title: string;
  description: string;
  dateStr: string;
  priority: 'high' | 'normal';
  amount?: number;
  month?: number;
  year?: number;
}

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts?: Debt[];
  fixedExpenses?: FixedExpense[];
  fixedIncomes?: FixedIncome[];
  variableIncomes?: VariableIncome[];
  variableExpenses?: VariableExpense[];
  selectedYear?: number;
  selectedMonth?: number;
  onNavigate?: (view: any) => void;
  onOpenAddDebt?: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Genera un ID determinista y estable para cada notificación
 */
export const generateAlertId = (type: string, key: string, period?: string): string => {
  return `notif_${type}_${key}${period ? `_${period}` : ''}`;
};

/**
 * Carga el conjunto de IDs descartados desde localStorage
 */
export const getDismissedAlertIds = (): Set<string> => {
  try {
    const saved = localStorage.getItem('lanitapp_dismissed_notifs');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
};

/**
 * Guarda los IDs descartados en localStorage y notifica globalmente
 */
export const saveDismissedAlertIds = (ids: Set<string>): void => {
  try {
    localStorage.setItem('lanitapp_dismissed_notifs', JSON.stringify(Array.from(ids)));
    window.dispatchEvent(new Event('lanitapp_alerts_dismissed'));
  } catch {
    // ignore
  }
};

export function computeSystemNotifications(
  debts: Debt[] = [],
  fixedExpenses: FixedExpense[] = [],
  targetYear?: number,
  targetMonth?: number,
  fixedIncomes: FixedIncome[] = [],
  variableIncomes: VariableIncome[] = [],
  variableExpenses: VariableExpense[] = []
): SystemNotification[] {
  const notifications: SystemNotification[] = [];
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = targetMonth !== undefined ? targetMonth : now.getMonth();
  const currentYear = targetYear !== undefined ? targetYear : now.getFullYear();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentFortnight = currentDay <= 15 ? 'q1' : 'q2';

  // 1. Alerta Inteligente de Déficit Quincenal
  if (fixedIncomes.length > 0 || fixedExpenses.length > 0) {
    const fnIncomes =
      fixedIncomes
        .filter((f) => f.is_active !== false && (f.default_fortnight === 'both' || f.default_fortnight === currentFortnight))
        .reduce((sum, f) => sum + (f.default_fortnight === 'both' ? f.amount : f.amount), 0) +
      variableIncomes
        .filter((v) => v.year === currentYear && v.month === currentMonth && (v.fortnight === currentFortnight || (v as any).quincena === (currentFortnight === 'q1' ? 15 : 30)))
        .reduce((sum, v) => sum + v.amount, 0);

    const fnExpenses =
      fixedExpenses
        .filter((e) => e.is_active !== false && (e.default_fortnight === 'both' || e.default_fortnight === currentFortnight))
        .reduce((sum, e) => sum + e.amount, 0) +
      variableExpenses
        .filter((v) => v.year === currentYear && v.month === currentMonth && (v.fortnight === currentFortnight || (v as any).quincena === (currentFortnight === 'q1' ? 15 : 30)))
        .reduce((sum, v) => sum + v.amount, 0) +
      debts
        .filter((d) => d.status !== 'paid' && (d.fortnight_due === currentFortnight || d.fortnight_due === 'both' || !d.fortnight_due))
        .reduce((sum, d) => {
          const rem = d.current_balance !== undefined ? d.current_balance : d.total_amount || 0;
          if (rem <= 0) return sum;
          const inst = d.installment_amount || (d.pending_installments ? rem / d.pending_installments : rem);
          return sum + Number(inst || 0);
        }, 0);

    const deficit = fnExpenses - fnIncomes;
    if (deficit > 0) {
      notifications.push({
        id: generateAlertId('deficit', `${currentYear}_${currentMonth}_${currentFortnight}`),
        type: 'deficit',
        title: `Déficit en ${currentFortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'} (-$${deficit.toFixed(2)})`,
        description: `Tus compromisos ($${fnExpenses.toFixed(2)}) superan los ingresos proyectados ($${fnIncomes.toFixed(2)}) por $${deficit.toFixed(2)}.`,
        dateStr: currentFortnight === 'q1' ? `15 ${MONTH_NAMES[currentMonth]}` : `${lastDayOfMonth} ${MONTH_NAMES[currentMonth]}`,
        priority: 'high',
        amount: deficit,
        year: currentYear,
        month: currentMonth,
      });
    }
  }

  // 2. Aviso de Quincena Activa
  if (currentDay <= 15) {
    const daysLeft = 15 - currentDay;
    notifications.push({
      id: generateAlertId('fortnight', 'q1', `${currentYear}_${currentMonth}`),
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
      id: generateAlertId('fortnight', 'q2', `${currentYear}_${currentMonth}`),
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

  // 3. Alertas de Cuotas de Deudas Reales
  debts.forEach((debt) => {
    if (debt.status === 'paid') return;
    const remaining = debt.current_balance !== undefined ? debt.current_balance : debt.total_amount || 0;
    if (remaining <= 0) return;

    const installment = debt.installment_amount || (debt.pending_installments ? remaining / debt.pending_installments : remaining);
    const fnDue = debt.fortnight_due || 'q1';
    const fnLabel = fnDue === 'q1' ? 'Quincena 15' : 'Quincena 30';

    notifications.push({
      id: generateAlertId('debt', String(debt.id), `${currentYear}_${currentMonth}`),
      type: 'debt',
      title: `Cuota pendiente: ${debt.creditor || debt.creditor_name || 'Deuda'} ($${Number(installment).toFixed(2)})`,
      description: `Asignada en ${fnLabel} de ${MONTH_NAMES[currentMonth]}. Saldo total por pagar: $${Number(remaining).toFixed(2)}.`,
      dateStr: `${fnLabel}`,
      priority: 'high',
      amount: Number(installment),
      year: currentYear,
      month: currentMonth,
    });
  });

  // 4. Alertas de Gastos Fijos Activos de la Quincena
  fixedExpenses.forEach((exp) => {
    if (exp.is_active === false) return;
    const fn = exp.default_fortnight;
    const matchesFortnight = fn === 'both' || fn === currentFortnight;

    if (matchesFortnight && exp.amount > 0) {
      const fnLabel = fn === 'both'
        ? 'Ambas Quincenas'
        : fn === 'q2'
        ? 'Quincena 30'
        : 'Quincena 15';

      notifications.push({
        id: generateAlertId('fixed_expense', String(exp.id), `${currentYear}_${currentMonth}_${currentFortnight}`),
        type: 'fixed_expense',
        title: `Gasto fijo: ${exp.name} ($${Number(exp.amount).toFixed(2)})`,
        description: `Planificado para ${fnLabel} de ${MONTH_NAMES[currentMonth]}.`,
        dateStr: fnLabel,
        priority: 'normal',
        amount: Number(exp.amount),
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
  fixedIncomes = [],
  variableIncomes = [],
  variableExpenses = [],
  selectedYear,
  selectedMonth,
  onNavigate,
  onOpenAddDebt,
}) => {
  const today = new Date();
  const activeYear = selectedYear ?? today.getFullYear();
  const activeMonth = selectedMonth ?? today.getMonth();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissedAlertIds());
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'deficit' | 'debt' | 'fortnight' | 'fixed_expense'>('all');

  // Sincronizar descartadas cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setDismissedIds(getDismissedAlertIds());
    }
  }, [isOpen]);

  const rawNotifications = useMemo(() => {
    return computeSystemNotifications(
      debts,
      fixedExpenses,
      activeYear,
      activeMonth,
      fixedIncomes,
      variableIncomes,
      variableExpenses
    );
  }, [debts, fixedExpenses, activeYear, activeMonth, fixedIncomes, variableIncomes, variableExpenses]);

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
    saveDismissedAlertIds(newSet);
  };

  const handleDismissSingle = (id: string) => {
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    saveDismissedAlertIds(next);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="fixed inset-0 cursor-pointer" onClick={onClose} />

      {/* Main Responsive Modal Window */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
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
            { id: 'deficit' as const, label: '⚠️ Déficits' },
            { id: 'debt' as const, label: 'Deudas' },
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
                  Tus compromisos de {MONTH_NAMES[activeMonth]} {activeYear} están al día.
                </p>
              </div>
            </div>
          ) : (
            visibleNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-2xl border transition-all shadow-sm ${
                  notif.type === 'deficit'
                    ? 'bg-red-500/10 border-red-500/30'
                    : notif.priority === 'high'
                    ? 'bg-[#FF914D]/10 border-[#FF914D]/30'
                    : 'bg-card border-app'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      notif.type === 'deficit'
                        ? 'bg-red-500/20 text-red-400'
                        : notif.type === 'fortnight'
                        ? 'bg-primary-custom/20 text-primary-custom'
                        : notif.type === 'debt'
                        ? 'bg-[#FF914D]/20 text-[#FF914D]'
                        : 'bg-[#00C2C7]/20 text-[#00C2C7]'
                    }`}
                  >
                    {notif.type === 'deficit' && <AlertTriangle className="w-4 h-4" />}
                    {notif.type === 'fortnight' && <Calendar className="w-4 h-4" />}
                    {notif.type === 'debt' && <CreditCard className="w-4 h-4" />}
                    {notif.type === 'fixed_expense' && <Receipt className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-app truncate">{notif.title}</h4>
                      <span className="text-[10px] text-muted font-semibold shrink-0">
                        {notif.dateStr}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 leading-snug">{notif.description}</p>

                    {/* Acciones Rápidas para Alertas de Déficit */}
                    {notif.type === 'deficit' && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-red-500/20">
                        <button
                          onClick={() => {
                            onClose();
                            onNavigate?.('fortnight');
                          }}
                          className="flex-1 min-w-[90px] px-2.5 py-1.5 rounded-lg bg-primary-custom/20 text-primary-custom hover:bg-primary-custom/30 text-[11px] font-bold transition-all cursor-pointer text-center"
                        >
                          Usar Balance
                        </button>
                        <button
                          onClick={() => {
                            onClose();
                            onNavigate?.('fortnight');
                          }}
                          className="flex-1 min-w-[90px] px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-[11px] font-bold transition-all cursor-pointer text-center"
                        >
                          Posponer Gastos
                        </button>
                        <button
                          onClick={() => {
                            onClose();
                            if (onOpenAddDebt) {
                              onOpenAddDebt();
                            } else {
                              onNavigate?.('debts');
                            }
                          }}
                          className="flex-1 min-w-[90px] px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[11px] font-bold transition-all cursor-pointer text-center"
                        >
                          Pedir Préstamo
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDismissSingle(notif.id)}
                    className="p-1 rounded-lg text-muted hover:text-rose-400 hover:bg-card transition-colors shrink-0 cursor-pointer"
                    title="Descartar aviso"
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
