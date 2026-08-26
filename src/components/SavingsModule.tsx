import React, { useState, useMemo } from 'react';
import {
  PiggyBank,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Target,
  DollarSign,
  AlertCircle,
  Layers,
  X,
  Sparkles,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import type { SavingsGoal, SavingContribution, FortnightType, Account } from '../types/index.ts';
import { saveSavingsGoal, deleteSavingsGoal, addSavingContribution } from '../lib/db.ts';
import { useFinanceStore } from '../stores/useFinanceStore.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface SavingsModuleProps {
  savingsGoals: SavingsGoal[];
  savingContributions: SavingContribution[];
  accounts?: Account[];
  currency?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const SavingsModule: React.FC<SavingsModuleProps> = ({
  savingsGoals,
  savingContributions,
  accounts = [],
  currency = '$',
}) => {
  const { accounts: storeAccounts } = useFinanceStore();
  const availableAccounts = accounts && accounts.length > 0 ? accounts : storeAccounts;

  // Modal states
  const [isGoalModalOpen, setIsGoalModalOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Contribution modal
  const [isContributionModalOpen, setIsContributionModalOpen] = useState<boolean>(false);
  const [selectedGoalForContrib, setSelectedGoalForContrib] = useState<SavingsGoal | null>(null);
  const [contribAmount, setContribAmount] = useState<number>(0);
  const [contribNotes, setContribNotes] = useState<string>('');
  const [sourceType, setSourceType] = useState<'account' | 'variable_income'>('account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [variableIncomeDescription, setVariableIncomeDescription] = useState<string>('');

  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // Form states for Goal
  const [name, setName] = useState<string>('');
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [frequency, setFrequency] = useState<'fortnightly' | 'monthly'>('fortnightly');
  const [targetFortnight, setTargetFortnight] = useState<15 | 30 | null>(null);
  const [amountPerPeriod, setAmountPerPeriod] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Helper para cálculo inteligente de quincena y mes según Fecha de Inicio
  const getFortnightInfoFromDate = (dateStr: string) => {
    if (!dateStr) {
      const d = new Date();
      const is15 = d.getDate() <= 15;
      return {
        fortnightNumber: is15 ? (15 as const) : (30 as const),
        label: is15 ? `Quincena 15 de ${MONTH_NAMES[d.getMonth()]}` : `Quincena 30 de ${MONTH_NAMES[d.getMonth()]}`,
        day: d.getDate(),
        monthName: MONTH_NAMES[d.getMonth()],
        year: d.getFullYear(),
      };
    }
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const monthName = !isNaN(month) && MONTH_NAMES[month] ? MONTH_NAMES[month] : '';
    const is15 = day <= 15;
    const fortnightNumber: 15 | 30 = is15 ? 15 : 30;
    const label = is15 ? `Quincena 15 de ${monthName}` : `Quincena 30 de ${monthName}`;
    return { fortnightNumber, label, day, monthName, year };
  };

  const todayStr = new Date().toLocaleDateString('en-CA');

  // Cambio de frecuencia con reseteo de quincena objetivo
  const handleFrequencyChange = (newFreq: 'fortnightly' | 'monthly') => {
    setFrequency(newFreq);
    if (newFreq === 'fortnightly') {
      setTargetFortnight(null);
    } else {
      const info = getFortnightInfoFromDate(startDate || todayStr);
      setTargetFortnight(targetFortnight === null ? info.fortnightNumber : targetFortnight);
    }
  };

  // Cambio de fecha de inicio con validación y recalculo automático
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (targetDate && val && targetDate < val) {
      setTargetDate('');
    }
    const info = getFortnightInfoFromDate(val || todayStr);
    if (frequency === 'fortnightly') {
      setTargetFortnight(null);
    } else {
      setTargetFortnight(info.fortnightNumber);
    }
  };

  // Cálculo inteligente de cuotas proyectadas entre Fecha de Inicio y Fecha Límite
  const installmentInfo = useMemo(() => {
    if (!startDate || !targetDate) return null;
    const start = new Date(startDate);
    const end = new Date(targetDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

    let periods = 0;
    if (frequency === 'monthly') {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      periods = Math.max(1, months + (end.getDate() >= start.getDate() ? 1 : 0));
    } else {
      let count = 0;
      let currYear = start.getFullYear();
      let currMonth = start.getMonth();
      let currQ: FortnightType = start.getDate() <= 15 ? 'q1' : 'q2';

      const endYear = end.getFullYear();
      const endMonth = end.getMonth();
      const endQ: FortnightType = end.getDate() <= 15 ? 'q1' : 'q2';

      while (
        currYear < endYear ||
        (currYear === endYear && currMonth < endMonth) ||
        (currYear === endYear && currMonth === endMonth && (currQ === 'q1' || endQ === 'q2'))
      ) {
        count++;
        if (currYear === endYear && currMonth === endMonth && currQ === endQ) {
          break;
        }
        if (currQ === 'q1') {
          currQ = 'q2';
        } else {
          currQ = 'q1';
          currMonth++;
          if (currMonth > 11) {
            currMonth = 0;
            currYear++;
          }
        }
        if (count > 240) break;
      }
      periods = Math.max(1, count);
    }

    const suggestedAmount = targetAmount > 0 && periods > 0 ? +(targetAmount / periods).toFixed(2) : 0;
    const periodUnit = frequency === 'fortnightly' ? (periods === 1 ? 'quincena' : 'quincenas') : (periods === 1 ? 'mes' : 'meses');

    return {
      periods,
      suggestedAmount,
      periodUnit,
    };
  }, [startDate, targetDate, frequency, targetAmount]);

  // Opciones de quincenas para inicio y fecha límite
  const startPeriodOptions = useMemo(() => {
    const opts: { key: string; dateStr: string; label: string }[] = [];
    const baseDate = new Date();
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();

    for (let i = 0; i < 24; i++) {
      const m = (baseMonth + i) % 12;
      const y = baseYear + Math.floor((baseMonth + i) / 12);

      opts.push({
        key: `${y}_${m}_q1`,
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-01`,
        label: `Quincena 15 de ${MONTH_NAMES[m]} ${y}`,
      });
      opts.push({
        key: `${y}_${m}_q2`,
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-16`,
        label: `Quincena 30 de ${MONTH_NAMES[m]} ${y}`,
      });
    }
    return opts;
  }, []);

  // Financial Stats
  const totalTargetAll = savingsGoals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalAccumulated = savingsGoals.reduce((sum, g) => sum + g.current_amount, 0);
  const globalProgress = totalTargetAll > 0 ? Math.round((totalAccumulated / totalTargetAll) * 100) : 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentFortnight: FortnightType = now.getDate() <= 15 ? 'q1' : 'q2';

  // Planned savings commitment for current fortnight
  const currentFortnightNum: 15 | 30 = now.getDate() <= 15 ? 15 : 30;
  const fortnightSavingsCommitment = savingsGoals
    .filter((g) => g.status === 'active')
    .filter((g) => {
      if (g.frequency === 'fortnightly' || g.target_fortnight === null || (g.target_fortnight as any) === 'both') return true;
      return g.target_fortnight === currentFortnightNum || (currentFortnightNum === 15 ? (g.target_fortnight as any) === 'q1' : (g.target_fortnight as any) === 'q2');
    })
    .reduce((sum, g) => sum + g.amount_per_period, 0);

  const handleOpenAddGoal = () => {
    setEditingGoal(null);
    setName('');
    setTargetAmount(0);
    setFrequency('fortnightly');
    setTargetFortnight(null);
    setStartDate(todayStr);
    setAmountPerPeriod(0);
    setTargetDate('');
    setNotes('');
    setIsGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(goal.target_amount || 0);
    setFrequency(goal.frequency);
    const initDate = goal.start_date || goal.created_at?.split('T')[0] || todayStr;
    setStartDate(initDate);

    let initialFortnight: 15 | 30 | null = null;
    if (goal.frequency === 'monthly') {
      const tf = goal.target_fortnight as any;
      if (tf === 'both' || tf === 'q1' || tf === 15 || tf === '15') {
        initialFortnight = 15;
      } else if (tf === 'q2' || tf === 30 || tf === '30') {
        initialFortnight = 30;
      } else {
        initialFortnight = getFortnightInfoFromDate(initDate).fortnightNumber;
      }
    }
    setTargetFortnight(initialFortnight);
    setAmountPerPeriod(goal.amount_per_period || 0);
    setTargetDate(goal.target_date || '');
    setNotes(goal.notes || '');
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTarget = targetAmount;
    const numPerPeriod = amountPerPeriod;
    if (!name.trim() || isNaN(numTarget) || numTarget <= 0 || isNaN(numPerPeriod) || numPerPeriod <= 0) return;

    const finalStartDate = startDate && startDate >= todayStr ? startDate : todayStr;
    const finalFortnight: 15 | 30 | null = frequency === 'fortnightly' ? null : (targetFortnight === 30 ? 30 : 15);

    await saveSavingsGoal({
      id: editingGoal?.id,
      name: name.trim(),
      target_amount: numTarget,
      current_amount: editingGoal ? editingGoal.current_amount : 0,
      frequency,
      target_fortnight: finalFortnight,
      amount_per_period: numPerPeriod,
      start_date: finalStartDate,
      target_date: targetDate || undefined,
      total_installments: installmentInfo?.periods || undefined,
      suggested_amount: installmentInfo?.suggestedAmount || undefined,
      status: 'active',
      notes,
    });

    setIsGoalModalOpen(false);
  };

  const handleDeleteGoal = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este plan de ahorro y sus registros de aporte?')) {
      await deleteSavingsGoal(id);
    }
  };

  const handleOpenContribModal = (goal: SavingsGoal) => {
    setSelectedGoalForContrib(goal);
    setContribAmount(goal.amount_per_period || 0);
    setContribNotes(`Aporte Quincena ${currentFortnight === 'q1' ? '15' : '30'} de ${MONTH_NAMES[currentMonth]}`);
    setSourceType('account');
    setSelectedAccountId(availableAccounts[0]?.id || '');
    setVariableIncomeDescription(`Ingreso extra para meta: ${goal.name}`);
    setIsContributionModalOpen(true);
  };

  const handleSaveContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = contribAmount;
    if (!selectedGoalForContrib || isNaN(num) || num <= 0) return;

    if (sourceType === 'account' && availableAccounts.length > 0 && !selectedAccountId) {
      alert('Por favor selecciona una cuenta de origen');
      return;
    }

    await addSavingContribution({
      goal_id: selectedGoalForContrib.id,
      amount: num,
      year: currentYear,
      month: currentMonth,
      fortnight: currentFortnight,
      notes: contribNotes,
      source_type: sourceType,
      account_id: sourceType === 'account' ? selectedAccountId : undefined,
      income_description: sourceType === 'variable_income' ? (variableIncomeDescription || `Ingreso extra para meta: ${selectedGoalForContrib.name}`) : undefined,
    });

    setIsContributionModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
              <PiggyBank className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-app">Planes de Ahorro & Metas Financieras</h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Aparta sistemáticamente en cada quincena o mes para tus proyectos y fondos de emergencia
          </p>
        </div>

        <button
          onClick={handleOpenAddGoal}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Meta de Ahorro
        </button>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Total Ahorrado Acumulado</span>
          <p className="text-xl sm:text-2xl font-black text-[#00C2C7] tracking-tight">
            {currency}{totalAccumulated.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">En {savingsGoals.length} metas activas</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Aporte en Quincena Actual</span>
          <p className="text-xl sm:text-2xl font-black text-primary-custom tracking-tight">
            {currency}{fortnightSavingsCommitment.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">Quincena {currentFortnight === 'q1' ? '15' : '30'} de {MONTH_NAMES[currentMonth]}</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Monto Objetivo Global</span>
          <p className="text-xl sm:text-2xl font-black text-app tracking-tight">
            {currency}{totalTargetAll.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">Faltan ${Math.max(0, totalTargetAll - totalAccumulated).toFixed(2)}</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Progreso Global</span>
          <p className="text-xl sm:text-2xl font-black text-[#00C2C7] tracking-tight">
            {globalProgress}%
          </p>
          <div className="w-full bg-card h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-[#00C2C7] h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, globalProgress)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Savings Goals Grid or Empty State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savingsGoals.length === 0 ? (
          <div className="col-span-full p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#00C2C7]/15 text-[#00C2C7] flex items-center justify-center shadow-xl shadow-[#00C2C7]/10 border border-[#00C2C7]/20">
              <PiggyBank className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-app">Comienza a estructurar tus finanzas</h3>
              <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                Agrega tu primer registro para calcular tus balances y proyecciones de quincena automáticamente.
              </p>
            </div>
            <button
              onClick={handleOpenAddGoal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-lg shadow-primary-custom/25 hover:opacity-95 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Crear mi primera meta de ahorro</span>
            </button>
          </div>
        ) : (
          savingsGoals.map((goal) => {
            const isCompleted = goal.current_amount >= goal.target_amount;
            const pct = goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 100;
            const contributions = savingContributions.filter((sc) => sc.goal_id === goal.id);
            const isExpanded = expandedGoalId === goal.id;

            return (
              <div
                key={goal.id}
                className="p-5 rounded-3xl bg-surface border border-app shadow-md hover:border-[#00C2C7]/60 transition-all space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold shadow-sm">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-app">{goal.name}</h4>
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ¡LOGRADA!
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-1">
                        <span className="px-2 py-0.5 rounded-lg bg-card text-[10px] font-semibold text-app border border-app">
                          {goal.frequency === 'fortnightly' ? `Apartar Quincenal ($${goal.amount_per_period})` : `Apartar Mensual ($${goal.amount_per_period})`}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-[#00C2C7]/15 text-[#00C2C7] text-[10px] font-bold">
                          {goal.frequency === 'fortnightly' || goal.target_fortnight === null || (goal.target_fortnight as any) === 'both'
                            ? 'Ambas quincenas'
                            : goal.target_fortnight === 30 || (goal.target_fortnight as any) === 'q2'
                            ? 'Quincena 30'
                            : 'Quincena 15'}
                        </span>
                        {goal.total_installments && (
                          <span className="px-2 py-0.5 rounded-lg bg-card text-[10px] font-semibold text-app border border-app">
                            {goal.total_installments} {goal.frequency === 'fortnightly' ? 'quincenas' : 'meses'}
                          </span>
                        )}
                        {goal.start_date && (
                          <span className="flex items-center gap-1 text-[10px] text-muted">
                            <Clock className="w-3 h-3 text-[#00C2C7]" /> Inicio: {goal.start_date}
                          </span>
                        )}
                        {goal.target_date && (
                          <span className="flex items-center gap-1 text-[10px] text-muted">
                            <Clock className="w-3 h-3 text-amber-400" /> Meta: {goal.target_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditGoal(goal)}
                      className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-card transition-colors cursor-pointer"
                      title="Editar meta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-[#ef4444] hover:bg-card transition-colors cursor-pointer"
                      title="Eliminar meta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Balances */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#00C2C7]">
                      {currency}{goal.current_amount.toFixed(2)} acumulados
                    </span>
                    <span className="text-muted">
                      Meta: {currency}{goal.target_amount.toFixed(2)} ({pct}%)
                    </span>
                  </div>

                  <div className="w-full bg-card h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00C2C7] to-primary-custom transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Action: Aportar Ahora */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-app text-xs">
                  <button
                    onClick={() => handleOpenContribModal(goal)}
                    className="px-3.5 py-2 rounded-xl bg-[#00C2C7] text-slate-900 font-extrabold shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Aportar Ahora</span>
                  </button>

                  <button
                    onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                    className="text-[11px] font-bold text-muted hover:text-app flex items-center gap-1 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {contributions.length} {contributions.length === 1 ? 'aporte' : 'aportes'}
                  </button>
                </div>

                {/* Expanded Contribution History */}
                {isExpanded && (
                  <div className="p-3 bg-card/60 rounded-2xl border border-app space-y-2 animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-app block">Historial de Aportes & Periodos</span>
                    {contributions.length === 0 ? (
                      <p className="text-xs text-muted py-1">Sin aportes registrados aún.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {contributions.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-surface border border-app text-xs"
                          >
                            <div className="flex items-center gap-2">
                              {c.is_skipped ? (
                                <AlertCircle className="w-3.5 h-3.5 text-[#FF914D]" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00C2C7]" />
                              )}
                              <div>
                                <span className="font-semibold text-app">{c.contribution_date}</span>
                                <span className="text-[10px] text-muted ml-1.5">
                                  ({c.fortnight === 'q1' ? 'Quincena 15' : 'Quincena 30'})
                                </span>
                              </div>
                            </div>

                            <div>
                              {c.is_skipped ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FF914D]/20 text-[#FF914D]">
                                  OMITIDO
                                </span>
                              ) : (
                                <span className="font-black text-[#00C2C7]">+{currency}{c.amount.toFixed(2)}</span>
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

      {/* Modal Nueva / Editar Meta de Ahorro */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg sm:max-w-xl bg-surface border border-app rounded-3xl p-5 sm:p-6 shadow-2xl text-app max-h-[92vh] overflow-y-auto animate-in zoom-in-95 no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app">
                    {editingGoal ? 'Editar Meta de Ahorro' : 'Crear Nueva Meta de Ahorro'}
                  </h3>
                  <p className="text-[11px] text-muted">Planifica y aparta fondos quincenalmente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre de la Meta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Fondo de emergencia, Viaje..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-sm text-app font-bold focus:outline-none focus:ring-2 focus:ring-[#00C2C7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Monto Objetivo ($ USD)
                  </label>
                  <MoneyInput
                    value={targetAmount}
                    onChange={setTargetAmount}
                    currencySymbol="$"
                    placeholder="0,00"
                    required
                    className="!py-2.5 !text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Monto a Apartar ($)
                  </label>
                  <MoneyInput
                    value={amountPerPeriod}
                    onChange={setAmountPerPeriod}
                    currencySymbol="$"
                    placeholder="0,00"
                    required
                    className="!py-2.5 !text-sm"
                  />
                </div>
              </div>

              {/* Fechas con Selectores Quincenales estilizados */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Fecha / Quincena de Inicio <span className="text-[#00C2C7] font-bold">*</span>
                    </label>
                    <select
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-[#00C2C7] cursor-pointer"
                    >
                      {startPeriodOptions.map((opt) => (
                        <option key={opt.key} value={opt.dateStr} className="bg-surface text-app">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Fecha Límite Estimada <span className="text-[10px] text-muted">(Opcional)</span>
                    </label>
                    <select
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-[#00C2C7] cursor-pointer"
                    >
                      <option value="" className="bg-surface text-muted">Sin fecha límite (Indefinido)</option>
                      {startPeriodOptions
                        .filter((opt) => !startDate || opt.dateStr > startDate)
                        .map((opt) => (
                          <option key={opt.key} value={opt.dateStr} className="bg-surface text-app">
                            {opt.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Cálculo Inteligente de Cuotas */}
              {installmentInfo && (
                <div className="p-3 rounded-2xl bg-[#00C2C7]/10 border border-[#00C2C7]/25 flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-app">
                        {installmentInfo.periods} {installmentInfo.periodUnit} estimadas
                      </div>
                      {installmentInfo.suggestedAmount > 0 && (
                        <div className="text-[11px] text-muted">
                          Sugerido: <strong className="text-[#00C2C7]">${installmentInfo.suggestedAmount}</strong> / {frequency === 'fortnightly' ? 'quincena' : 'mes'}
                        </div>
                      )}
                    </div>
                  </div>
                  {installmentInfo.suggestedAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmountPerPeriod(installmentInfo.suggestedAmount)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#00C2C7] text-slate-950 text-xs font-black hover:opacity-90 transition-all cursor-pointer shrink-0 shadow-sm"
                    >
                      Usar sugerido
                    </button>
                  )}
                </div>
              )}

              {/* Frecuencia de Ahorro y Quincena Específica con Chip Badge */}
              <div className={`grid ${frequency === 'monthly' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-muted">
                      Frecuencia de Ahorro
                    </label>
                    <span
                      title={
                        frequency === 'fortnightly'
                          ? 'Se apartará en ambas quincenas (15 y 30) de cada mes'
                          : targetFortnight === 30
                          ? 'Se apartará en Quincena 30 de cada mes'
                          : 'Se apartará en Quincena 15 de cada mes'
                      }
                      className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-extrabold border border-cyan-500/30 cursor-help"
                    >
                      {frequency === 'fortnightly' ? 'Q15+Q30' : targetFortnight === 30 ? 'Q30' : 'Q15'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-card rounded-xl border border-app">
                    {[
                      { id: 'fortnightly' as const, label: 'Quincenal' },
                      { id: 'monthly' as const, label: 'Mensual' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleFrequencyChange(opt.id)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                          frequency === opt.id
                            ? 'bg-[#00C2C7] text-slate-950 shadow-sm'
                            : 'text-muted hover:text-app'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {frequency === 'monthly' && (
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Quincena Específica
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-card rounded-xl border border-app">
                      {[
                        { id: 15 as const, label: 'Quincena 15' },
                        { id: 30 as const, label: 'Quincena 30' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTargetFortnight(opt.id)}
                          className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                            targetFortnight === opt.id
                              ? 'bg-[#00C2C7] text-slate-950 shadow-sm'
                              : 'text-muted hover:text-app'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas / Propósito
                </label>
                <input
                  type="text"
                  placeholder="Detalles sobre esta meta..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-[#00C2C7]"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Guardar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Aportar Ahora a Meta */}
      {isContributionModalOpen && selectedGoalForContrib && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app">Registrar Aporte de Ahorro</h3>
                  <p className="text-[11px] text-muted">Meta: {selectedGoalForContrib.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsContributionModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContribution} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Monto a Aportar ($ USD) <span className="text-[#00C2C7] font-bold">*</span>
                </label>
                <MoneyInput
                  value={contribAmount}
                  onChange={setContribAmount}
                  currencySymbol="$"
                  placeholder="0,00"
                  required
                />
              </div>

              {/* Selector de Origen de Fondos */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Origen de los Fondos
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-card rounded-xl border border-app">
                  <button
                    type="button"
                    onClick={() => setSourceType('account')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      sourceType === 'account'
                        ? 'bg-[#00C2C7] text-slate-950 shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Desde Cuenta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType('variable_income')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      sourceType === 'variable_income'
                        ? 'bg-[#00C2C7] text-slate-950 shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Ingreso Variable</span>
                  </button>
                </div>
              </div>

              {/* Campos condicionales según el origen */}
              {sourceType === 'account' ? (
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Cuenta / Fondo de Origen
                  </label>
                  {availableAccounts.length === 0 ? (
                    <p className="text-xs text-amber-400 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      No tienes cuentas registradas. El aporte se registrará sin cuenta asociada.
                    </p>
                  ) : (
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-[#00C2C7]"
                    >
                      {availableAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency}) - Saldo: ${acc.initial_balance ?? 0}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Descripción del Ingreso Variable <span className="text-[#00C2C7] font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Bono de producción, Venta garage, Trabajo extra..."
                    value={variableIncomeDescription}
                    onChange={(e) => setVariableIncomeDescription(e.target.value)}
                    className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-[#00C2C7]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nota / Referencia <span className="text-[10px] text-muted">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={contribNotes}
                  onChange={(e) => setContribNotes(e.target.value)}
                  placeholder="Detalles sobre este aporte..."
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-[#00C2C7]"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsContributionModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#00C2C7] text-slate-900 font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
