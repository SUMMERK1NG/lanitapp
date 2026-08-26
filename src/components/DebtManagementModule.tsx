import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import type { Debt, DebtPayment, ExchangeRatesData, Category } from '../types/index.ts';
import { subscribeToDebtsChanges, fetchDebts, deleteDebt } from '../services/debtsService.ts';
import { getActiveUserId } from '../lib/db.ts';
import { AddDebtModal } from './AddDebtModal.tsx';
import { AddPaymentModal } from './AddPaymentModal.tsx';

interface DebtManagementModuleProps {
  debts: Debt[];
  debtPayments: DebtPayment[];
  rates: ExchangeRatesData;
  categories?: Category[];
  currency?: string;
  userId?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DebtManagementModule: React.FC<DebtManagementModuleProps> = ({
  debts,
  debtPayments,
  rates,
  categories = [],
  currency = '$',
  userId,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'paid'>('active');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<string | undefined>(undefined);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);

  const activeUid = userId || getActiveUserId();

  // Sincronización Realtime Dedicada para Deudas
  useEffect(() => {
    if (!activeUid) return;

    // 1. Carga inicial desde Supabase
    fetchDebts(activeUid).catch((err) => {
      console.warn('[DebtManagementModule Initial Fetch Notice]:', err);
    });

    // 2. Suscripción persistente en tiempo real a la tabla 'debts'
    const unsubscribe = subscribeToDebtsChanges(activeUid, () => {
      fetchDebts(activeUid);
    });

    return () => {
      unsubscribe();
    };
  }, [activeUid]);

  // Financial Metrics
  const totalDebtOriginal = debts.reduce((sum, d) => sum + d.total_amount, 0);
  const totalCurrentBalance = debts.reduce((sum, d) => sum + d.current_balance, 0);
  const totalPaid = totalDebtOriginal - totalCurrentBalance;

  // Next fortnight commitments for active debts
  const now = new Date();
  const currentFortnight = now.getDate() <= 15 ? 'q1' : 'q2';
  const currentMonthCommitment = debts
    .filter((d) => d.status === 'active' && d.current_balance > 0)
    .filter((d) => !d.fortnight_due || d.fortnight_due === 'both' || d.fortnight_due === currentFortnight)
    .reduce((sum, d) => {
      let cuota = 0;
      if (d.debt_mode === 'open') {
        if (d.has_interest) {
          const monthlyInterest = Number(d.interest_amount || ((d.current_balance * (d.interest_rate || 0)) / 100));
          if (d.interest_frequency === 'fortnightly') {
            cuota = monthlyInterest;
          } else if (d.interest_fortnight) {
            cuota = d.interest_fortnight === currentFortnight ? monthlyInterest : 0;
          } else if (d.fortnight_due === 'both') {
            cuota = Number((monthlyInterest / 2).toFixed(2));
          } else {
            cuota = monthlyInterest;
          }
        } else {
          cuota = d.installment_amount || 0;
        }
      } else {
        cuota = d.installment_amount || (d.pending_installments ? d.current_balance / d.pending_installments : d.current_balance);
      }
      return sum + Math.min(d.current_balance, cuota);
    }, 0);

  // Filtered Debts
  const filteredDebts = debts.filter((d) => {
    const isPaid = d.status === 'paid' || d.current_balance <= 0;
    if (filterTab === 'active') return !isPaid;
    if (filterTab === 'paid') return isPaid;
    return true;
  });

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setIsAddModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este registro de deuda y su historial de abonos?')) {
      await deleteDebt(id);
    }
  };

  const handleOpenPayment = (debtId: string) => {
    setSelectedDebtForPayment(debtId);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FF914D]/20 text-[#FF914D] flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-app">Control de Deudas & Créditos</h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Gestiona compromisos Cashea, CrediTotal, préstamos personales y abonos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingDebt(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva Deuda
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Saldo Total Pendiente</span>
          <p className="text-xl sm:text-2xl font-black text-[#FF914D] tracking-tight">
            {currency}{totalCurrentBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">En {debts.filter(d => d.status === 'active').length} deudas activas</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Total a Pagar en Quincena Actual</span>
          <p className="text-xl sm:text-2xl font-black text-primary-custom tracking-tight">
            {currency}{currentMonthCommitment.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">Compromiso de este corte</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Total Amortizado</span>
          <p className="text-xl sm:text-2xl font-black text-[#00C2C7] tracking-tight">
            {currency}{totalPaid.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">Capital pagado</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Progreso de Pago</span>
          <p className="text-xl sm:text-2xl font-black text-app tracking-tight">
            {totalDebtOriginal > 0 ? Math.round((totalPaid / totalDebtOriginal) * 100) : 100}%
          </p>
          <div className="w-full bg-card h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-[#00C2C7] h-full rounded-full transition-all"
              style={{ width: `${totalDebtOriginal > 0 ? (totalPaid / totalDebtOriginal) * 100 : 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs: Todas, Pendientes / Activas, Pagadas */}
      <div className="flex p-1 bg-card rounded-2xl border border-app w-fit">
        <button
          onClick={() => setFilterTab('active')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTab === 'active'
              ? 'bg-primary-custom text-white shadow-md'
              : 'text-muted hover:text-app'
          }`}
        >
          Pendientes / Activas ({debts.filter((d) => d.status === 'active' && d.current_balance > 0).length})
        </button>
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-primary-custom text-white shadow-md'
              : 'text-muted hover:text-app'
          }`}
        >
          Todas ({debts.length})
        </button>
        <button
          onClick={() => setFilterTab('paid')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterTab === 'paid'
              ? 'bg-primary-custom text-white shadow-md'
              : 'text-muted hover:text-app'
          }`}
        >
          Pagadas / Amortizadas ({debts.filter((d) => d.status === 'paid' || d.current_balance <= 0).length})
        </button>
      </div>

      {/* Debts Cards List or Empty State */}
      <div className="space-y-3">
        {filteredDebts.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FF914D]/15 text-[#FF914D] flex items-center justify-center shadow-xl shadow-[#FF914D]/10 border border-[#FF914D]/20">
              <CreditCard className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-app">Comienza a estructurar tus finanzas</h3>
              <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                Agrega tu primer registro para calcular tus balances y proyecciones de quincena automáticamente.
              </p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-lg shadow-primary-custom/25 hover:opacity-95 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar mi primera deuda</span>
            </button>
          </div>
        ) : (
          filteredDebts.map((debt) => {
            const isPaid = debt.status === 'paid' || debt.current_balance <= 0;
            const payments = debtPayments.filter((p) => p.debt_id === debt.id);
            const isExpanded = expandedDebtId === debt.id;
            const paidForThisDebt = debt.total_amount - debt.current_balance;
            const pct = debt.total_amount > 0 ? Math.round((paidForThisDebt / debt.total_amount) * 100) : 100;
            const cuota = debt.installment_amount || (debt.pending_installments ? debt.current_balance / debt.pending_installments : debt.current_balance);

            return (
              <div
                key={debt.id}
                className={`rounded-3xl border transition-all ${
                  isPaid
                    ? 'bg-surface/60 border-app opacity-80'
                    : 'bg-surface border-app shadow-md hover:border-primary-custom'
                }`}
              >
                {/* Main Card Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-app">{debt.creditor}</h4>
                      {isPaid ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          PAGADA
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FF914D]/20 text-[#FF914D] border border-[#FF914D]/30">
                          PENDIENTE
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span>
                        Modalidad:{' '}
                        <strong className="text-app">
                          {debt.debt_mode === 'open' ? 'Monto Abierto' : 'Por Cuotas'} (
                          {debt.payment_mode === 'usd_cash' && '💵 Cash USD'}
                          {debt.payment_mode === 'eur_cash' && '💶 Cash Euro'}
                          {debt.payment_mode === 'ves_bcv' && '🏛️ Dólar Tasa BCV'}
                          {debt.payment_mode === 'ves_euro' && '🇪🇺 Euro Tasa BCV'}
                          {debt.payment_mode === 'ves_parallel' && '⚡ Dólar Promedio'}
                          {debt.payment_mode === 'ves_fixed' && '🇻🇪 Bs Fijo'}
                          {(!debt.payment_mode || debt.payment_mode === 'other') && (debt.payment_type === 'bcv_usd' ? '🏛️ Tasa BCV' : debt.payment_type === 'cash' ? '💵 Cash USD' : '🌐 Otros')}
                          )
                        </strong>
                      </span>

                      {debt.debt_mode === 'installments' && debt.pending_installments !== undefined && (
                        <span>
                          Cuotas:{' '}
                          <strong className="text-[#FF914D]">
                            {debt.pending_installments} de {debt.total_installments || debt.pending_installments} restantes (~{currency}{cuota.toFixed(2)} c/u)
                          </strong>
                        </span>
                      )}

                      {debt.start_month !== undefined && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-primary-custom" />
                          Inicio: Quincena {debt.start_fortnight === 'q1' ? '15' : '30'} de {MONTH_NAMES[debt.start_month]} {debt.start_year}
                        </span>
                      )}

                      {(debt.has_interest || (debt.interest_rate !== undefined && debt.interest_rate > 0)) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <span>Interés: {debt.interest_rate}%</span>
                          {debt.interest_amount ? <span>(${debt.interest_amount.toFixed(2)} {debt.interest_frequency === 'fortnightly' ? 'Q' : 'M'})</span> : null}
                        </span>
                      )}

                      {debt.has_late_fee && (debt.late_fee_amount || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF914D]/15 text-[#FF914D] border border-[#FF914D]/30 flex items-center gap-1">
                          <span>Mora: +${Number(debt.late_fee_amount || 0).toFixed(2)}</span>
                        </span>
                      )}

                      {debt.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Vence: {debt.due_date}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action & Balance */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-app">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-muted font-semibold block uppercase">
                        Saldo Restante
                      </span>
                      <span className="text-xl font-black text-[#FF914D]">
                        {currency}{debt.current_balance.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isPaid && (
                        <button
                          onClick={() => handleOpenPayment(debt.id)}
                          className="px-3 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                        >
                          Abonar
                        </button>
                      )}

                      <button
                        onClick={() => handleEdit(debt)}
                        className="p-2 rounded-xl bg-card hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
                        title="Editar deuda"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="p-2 rounded-xl bg-card hover:bg-surface-hover text-muted hover:text-[#ef4444] transition-colors cursor-pointer"
                        title="Eliminar deuda"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                        className="p-2 rounded-xl bg-card hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
                        title="Ver historial de abonos"
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-4 sm:px-5 pb-3">
                  <div className="flex justify-between text-[10px] text-muted mb-1">
                    <span>Amortizado: ${paidForThisDebt.toFixed(2)}</span>
                    <span>Total Original: ${debt.total_amount.toFixed(2)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-card h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isPaid ? 'bg-emerald-400' : 'bg-[#FF914D]'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Payment History */}
                {isExpanded && (
                  <div className="p-4 bg-card/60 border-t border-app rounded-b-3xl space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-app">Historial de Abonos Realizados ({payments.length})</span>
                      {!isPaid && (
                        <button
                          onClick={() => handleOpenPayment(debt.id)}
                          className="text-xs font-bold text-primary-custom hover:underline"
                        >
                          + Registrar Abono
                        </button>
                      )}
                    </div>

                    {payments.length === 0 ? (
                      <p className="text-xs text-muted py-2">No se han registrado abonos todavía.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-surface border border-app text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-app">{p.payment_date}</span>
                                  <span className="text-[10px] text-muted">
                                    ({p.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})
                                  </span>
                                </div>
                                {p.notes && (
                                  <span className="text-[10px] text-muted block truncate max-w-xs">{p.notes}</span>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-black text-[#00C2C7]">+{currency}{p.amount.toFixed(2)}</span>
                              {p.amount_in_bs && (
                                <span className="text-[10px] text-muted block">
                                  Bs. {p.amount_in_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Debt Modal */}
      <AddDebtModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingDebt(null);
        }}
        editingDebt={editingDebt}
        categories={categories}
      />

      {/* Add Payment Modal */}
      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedDebtForPayment(undefined);
        }}
        debts={debts}
        rates={rates}
        preselectedDebtId={selectedDebtForPayment}
      />
    </div>
  );
};
