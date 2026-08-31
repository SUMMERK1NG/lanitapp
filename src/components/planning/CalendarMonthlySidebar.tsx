import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  Filter,
  TrendingUp,
} from 'lucide-react';
import type {
  PlanningNote,
  ExchangeRatesData,
} from '../../types/index.ts';
import {
  addPlanningTask,
  togglePlanningTask,
  deletePlanningTask,
  updatePlanningNotesText,
} from '../../lib/db.ts';
import { formatCurrencyVE } from '../../utils/numberFormat.ts';

export type CalendarFilterType = 'all' | 'fixed_expenses' | 'debts' | 'pending' | 'paid';

interface CalendarMonthlySidebarProps {
  year: number;
  month: number;
  monthName: string;
  totalCommittedMonth: number;
  totalPaidMonth: number;
  totalPendingMonth: number;
  totalQ1: number;
  totalQ2: number;
  rates?: ExchangeRatesData;
  activeFilter: CalendarFilterType;
  onChangeFilter: (filter: CalendarFilterType) => void;
  planningNote?: PlanningNote;
  userId?: string;
}

export const CalendarMonthlySidebar: React.FC<CalendarMonthlySidebarProps> = ({
  year,
  month,
  monthName,
  totalCommittedMonth,
  totalPaidMonth,
  totalPendingMonth,
  totalQ1,
  totalQ2,
  rates,
  activeFilter,
  onChangeFilter,
  planningNote,
  userId,
}) => {
  const [newTaskText, setNewTaskText] = useState<string>('');
  const [newTaskDay, setNewTaskDay] = useState<string>('');
  const [notesText, setNotesText] = useState<string>('');
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);

  // Sync local notes textarea when planningNote from DB updates
  useEffect(() => {
    if (planningNote?.notes !== undefined) {
      setNotesText(planningNote.notes);
    } else {
      setNotesText('');
    }
  }, [planningNote?.notes, year, month]);

  // Debounced auto-save for notes
  useEffect(() => {
    if (notesText === (planningNote?.notes || '')) return;

    const timer = setTimeout(async () => {
      await updatePlanningNotesText({
        year,
        month,
        notes: notesText,
        user_id: userId,
      });
      setIsSavedNotice(true);
      setTimeout(() => setIsSavedNotice(false), 2000);
    }, 800);

    return () => clearTimeout(timer);
  }, [notesText, year, month, userId]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const dayNum = newTaskDay ? parseInt(newTaskDay, 10) : undefined;
    await addPlanningTask({
      year,
      month,
      text: newTaskText,
      due_day: dayNum && !isNaN(dayNum) && dayNum >= 1 && dayNum <= 31 ? dayNum : undefined,
      user_id: userId,
    });

    setNewTaskText('');
    setNewTaskDay('');
  };

  const handleToggleTask = async (taskId: string) => {
    await togglePlanningTask({
      year,
      month,
      taskId,
      user_id: userId,
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    await deletePlanningTask({
      year,
      month,
      taskId,
      user_id: userId,
    });
  };

  const bcvRate = rates?.bcvDollar || 0;
  const tasks = planningNote?.tasks || [];
  const completedTasks = tasks.filter((t) => t.completed).length;

  const progressPercent = totalCommittedMonth > 0
    ? Math.min(100, Math.round((totalPaidMonth / totalCommittedMonth) * 100))
    : 0;

  return (
    <aside className="w-full flex flex-col space-y-4">
      {/* 1. Global Monthly Summary Card */}
      <div className="p-4 rounded-3xl bg-card border border-app shadow-md space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-app uppercase tracking-wider">
                Resumen de {monthName}
              </h4>
              <span className="text-[10px] text-muted font-medium">Compromisos del mes</span>
            </div>
          </div>

          <span className="text-sm font-black text-primary-custom">
            ${totalCommittedMonth.toFixed(2)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Cubierto: ${totalPaidMonth.toFixed(2)}
            </span>
            <span className="text-slate-400">
              Pendiente: ${totalPendingMonth.toFixed(2)}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60 flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>{progressPercent}% completado</span>
            {bcvRate > 0 && (
              <span>Bs. {formatCurrencyVE(totalCommittedMonth * bcvRate)}</span>
            )}
          </div>
        </div>

        {/* Quincena 15 vs Quincena 30 Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-app">
          <div className="p-2.5 rounded-2xl bg-surface/80 border border-app">
            <span className="text-[10px] font-bold text-muted block uppercase">Quincena 15</span>
            <span className="text-xs font-black text-app block">${totalQ1.toFixed(2)}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-surface/80 border border-app">
            <span className="text-[10px] font-bold text-muted block uppercase">Quincena 30</span>
            <span className="text-xs font-black text-app block">${totalQ2.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Calendar Filter */}
      <div className="p-3.5 rounded-3xl bg-card border border-app space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-primary-custom" /> Filtrar Calendario
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
          <button
            onClick={() => onChangeFilter('all')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-primary-custom text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => onChangeFilter('fixed_expenses')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'fixed_expenses'
                ? 'bg-[#147DF0] text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Gastos
          </button>
          <button
            onClick={() => onChangeFilter('debts')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'debts'
                ? 'bg-[#FF914D] text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Deudas
          </button>
          <button
            onClick={() => onChangeFilter('pending')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => onChangeFilter('paid')}
            className={`px-2 py-1.5 rounded-xl transition-all cursor-pointer col-span-2 ${
              activeFilter === 'paid'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-surface hover:bg-surface-hover text-muted hover:text-app'
            }`}
          >
            Cubiertos / Pagados
          </button>
        </div>
      </div>

      {/* 3. Recordatorios & Tareas del Mes (Inspirado en la plantilla mensual) */}
      <div className="p-4 rounded-3xl bg-card border border-app shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-app uppercase tracking-wider">
                Tareas & Recordatorios
              </h4>
              <span className="text-[10px] text-muted font-medium">
                {completedTasks}/{tasks.length} completadas
              </span>
            </div>
          </div>
        </div>

        {/* Add Task Form */}
        <form onSubmit={handleAddTask} className="flex items-center gap-1.5">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Nuevo recordatorio o tarea..."
            className="flex-1 px-3 py-1.5 rounded-xl bg-surface border border-app text-xs text-app placeholder:text-muted focus:outline-none focus:border-primary-custom"
          />
          <input
            type="number"
            min={1}
            max={31}
            value={newTaskDay}
            onChange={(e) => setNewTaskDay(e.target.value)}
            placeholder="Día"
            title="Día del mes (opcional)"
            className="w-12 px-1.5 py-1.5 rounded-xl bg-surface border border-app text-xs text-center text-app placeholder:text-muted focus:outline-none focus:border-primary-custom"
          />
          <button
            type="submit"
            disabled={!newTaskText.trim()}
            className="p-1.5 rounded-xl bg-primary-custom text-white hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer"
            title="Agregar tarea"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {/* Tasks List */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pr-1">
          {tasks.length === 0 ? (
            <div className="py-4 text-center text-muted text-xs">
              <span>Sin tareas pendientes para este mes.</span>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                  task.completed
                    ? 'bg-surface/40 border-app/50 text-muted line-through opacity-70'
                    : 'bg-surface border-app text-app hover:border-slate-600'
                }`}
              >
                <div
                  onClick={() => handleToggleTask(task.id)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
                >
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-muted shrink-0" />
                  )}
                  <span className="truncate">{task.text}</span>
                  {task.due_day && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary-custom/20 text-primary-custom shrink-0">
                      Día {task.due_day}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 ml-1"
                  title="Eliminar tarea"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Notas del Mes (Inspirado en la plantilla física) */}
      <div className="p-4 rounded-3xl bg-card border border-app shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-app uppercase tracking-wider">
                Notas del Mes
              </h4>
              <span className="text-[10px] text-muted font-medium">Apuntes estratégicos</span>
            </div>
          </div>

          {isSavedNotice && (
            <span className="text-[10px] font-bold text-emerald-400 animate-in fade-in duration-200">
              ✓ Guardado
            </span>
          )}
        </div>

        <textarea
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder={`Escribe aquí notas, metas o recordatorios especiales para ${monthName}...`}
          rows={4}
          className="w-full p-3 rounded-2xl bg-surface border border-app text-xs text-app placeholder:text-muted focus:outline-none focus:border-primary-custom resize-none no-scrollbar"
        />
      </div>
    </aside>
  );
};
