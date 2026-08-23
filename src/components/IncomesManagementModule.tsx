import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import type {
  FixedIncome,
  MonthlyFixedIncomeOverride,
  VariableIncome,
  Category,
  Account,
  FortnightType,
} from '../types/index.ts';
import {
  saveFixedIncome,
  deleteFixedIncome,
  toggleMonthlyFixedIncomeOverride,
  saveVariableIncome,
  deleteVariableIncome,
} from '../lib/db.ts';
import { CategoryIcon } from './CategoryIcon.tsx';
import { MonthPicker } from './MonthPicker.tsx';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface IncomesManagementModuleProps {
  fixedIncomes: FixedIncome[];
  monthlyIncomeOverrides: MonthlyFixedIncomeOverride[];
  variableIncomes: VariableIncome[];
  categories: Category[];
  accounts: Account[];
  selectedYear: number;
  selectedMonth: number;
  onChangePeriod: (year: number, month: number) => void;
  currency?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const IncomesManagementModule: React.FC<IncomesManagementModuleProps> = ({
  fixedIncomes,
  monthlyIncomeOverrides,
  variableIncomes,
  categories,
  accounts,
  selectedYear,
  selectedMonth,
  onChangePeriod,
  currency = '$',
}) => {
  const [activeTab, setActiveTab] = useState<'fixed' | 'variable'>('fixed');

  // Fixed Income Modal states
  const [isFixedModalOpen, setIsFixedModalOpen] = useState<boolean>(false);
  const [editingFixed, setEditingFixed] = useState<FixedIncome | null>(null);
  const [fixedName, setFixedName] = useState<string>('');
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [fixedFortnight, setFixedFortnight] = useState<'q1' | 'q2' | 'both'>('q1');
  const [fixedCategoryId, setFixedCategoryId] = useState<string>('cat_salary');
  const [fixedNotes, setFixedNotes] = useState<string>('');

  // Variable Income Modal states
  const [isVarModalOpen, setIsVarModalOpen] = useState<boolean>(false);
  const [editingVar, setEditingVar] = useState<VariableIncome | null>(null);
  const [varDescription, setVarDescription] = useState<string>('');
  const [varAmount, setVarAmount] = useState<number>(0);
  const [varFortnight, setVarFortnight] = useState<FortnightType>('q1');
  const [varCategoryId, setVarCategoryId] = useState<string>('cat_extras');
  const [varAccountId, setVarAccountId] = useState<string>(accounts[0]?.id || 'acc_bank_usd');
  const [varNotes, setVarNotes] = useState<string>('');

  const incomeCategories = categories.filter((c) => c.type === 'income');

  // 1. Process Fixed Incomes for current month
  const overrideMap = useMemo(() => {
    return new Map(
      monthlyIncomeOverrides
        .filter((o) => o.year === selectedYear && o.month === selectedMonth)
        .map((o) => [o.fixed_income_id, o])
    );
  }, [monthlyIncomeOverrides, selectedYear, selectedMonth]);

  const processedFixedIncomes = useMemo(() => {
    return fixedIncomes.map((fi) => {
      const override = overrideMap.get(fi.id);
      const isActive = override?.is_active !== undefined ? override.is_active : fi.is_active;
      const finalAmount = override?.custom_amount !== undefined ? override.custom_amount : fi.amount;
      return {
        ...fi,
        isActive,
        finalAmount,
      };
    });
  }, [fixedIncomes, overrideMap]);

  const totalMonthlyFixed = processedFixedIncomes
    .filter((i) => i.isActive)
    .reduce((sum, i) => sum + i.finalAmount, 0);

  // 2. Filter Variable Incomes for current month
  const currentMonthVariables = useMemo(() => {
    return variableIncomes.filter(
      (vi) => vi.year === selectedYear && vi.month === selectedMonth
    );
  }, [variableIncomes, selectedYear, selectedMonth]);

  const totalMonthlyVariable = currentMonthVariables.reduce((sum, vi) => sum + vi.amount, 0);

  // Total Combined
  const totalCombinedIncome = totalMonthlyFixed + totalMonthlyVariable;

  // Quincenas totals
  const q1Fixed = processedFixedIncomes
    .filter((i) => i.isActive && (i.default_fortnight === 'q1' || i.default_fortnight === 'both'))
    .reduce((sum, i) => sum + i.finalAmount, 0);
  const q1Variable = currentMonthVariables
    .filter((i) => i.fortnight === 'q1')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalQ1 = q1Fixed + q1Variable;

  const q2Fixed = processedFixedIncomes
    .filter((i) => i.isActive && (i.default_fortnight === 'q2' || i.default_fortnight === 'both'))
    .reduce((sum, i) => sum + i.finalAmount, 0);
  const q2Variable = currentMonthVariables
    .filter((i) => i.fortnight === 'q2')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalQ2 = q2Fixed + q2Variable;

  // Handlers for Fixed Incomes
  const handleOpenAddFixed = () => {
    setEditingFixed(null);
    setFixedName('');
    setFixedAmount(0);
    setFixedFortnight('q1');
    setFixedCategoryId(incomeCategories[0]?.id || 'cat_salary');
    setFixedNotes('');
    setIsFixedModalOpen(true);
  };

  const handleOpenEditFixed = (fi: FixedIncome) => {
    setEditingFixed(fi);
    setFixedName(fi.name);
    setFixedAmount(fi.amount || 0);
    setFixedFortnight(fi.default_fortnight);
    setFixedCategoryId(fi.category_id);
    setFixedNotes(fi.notes || '');
    setIsFixedModalOpen(true);
  };

  const handleSaveFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = fixedAmount;
    if (!fixedName.trim() || isNaN(num) || num <= 0) return;

    await saveFixedIncome({
      id: editingFixed?.id,
      name: fixedName.trim(),
      amount: num,
      currency: 'USD',
      default_fortnight: fixedFortnight,
      category_id: fixedCategoryId,
      notes: fixedNotes,
    });

    setIsFixedModalOpen(false);
  };

  const handleDeleteFixed = async (id: string) => {
    if (window.confirm('¿Deseas eliminar este concepto de ingreso fijo?')) {
      await deleteFixedIncome(id);
    }
  };

  const handleToggleFixedActive = async (income: typeof processedFixedIncomes[0]) => {
    await toggleMonthlyFixedIncomeOverride(
      income.id,
      selectedYear,
      selectedMonth,
      !income.isActive,
      income.finalAmount
    );
  };

  // Handlers for Variable Incomes
  const handleOpenAddVar = () => {
    setEditingVar(null);
    setVarDescription('');
    setVarAmount(0);
    setVarFortnight('q1');
    setVarCategoryId(incomeCategories.find(c => c.id === 'cat_extras')?.id || incomeCategories[0]?.id || 'cat_extras');
    setVarAccountId(accounts[0]?.id || 'acc_bank_usd');
    setVarNotes('');
    setIsVarModalOpen(true);
  };

  const handleOpenEditVar = (vi: VariableIncome) => {
    setEditingVar(vi);
    setVarDescription(vi.description);
    setVarAmount(vi.amount || 0);
    setVarFortnight(vi.fortnight);
    setVarCategoryId(vi.category_id || 'cat_extras');
    setVarAccountId(vi.account_id || accounts[0]?.id || 'acc_bank_usd');
    setVarNotes(vi.notes || '');
    setIsVarModalOpen(true);
  };

  const handleSaveVar = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = varAmount;
    if (!varDescription.trim() || isNaN(num) || num <= 0) return;

    await saveVariableIncome({
      id: editingVar?.id,
      description: varDescription.trim(),
      amount: num,
      year: selectedYear,
      month: selectedMonth,
      fortnight: varFortnight,
      category_id: varCategoryId,
      account_id: varAccountId,
      currency: 'USD',
      notes: varNotes,
    });

    setIsVarModalOpen(false);
  };

  const handleDeleteVar = async (id: string) => {
    if (window.confirm('¿Deseas eliminar este registro de ingreso variable?')) {
      await deleteVariableIncome(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Navigation Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                <Briefcase className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-app">Gestión Integral de Ingresos</h3>
            </div>
            <p className="text-xs text-muted mt-1">
              Periodo: <strong>{MONTH_NAMES[selectedMonth]} {selectedYear}</strong> • Fijos y variables por quincena
            </p>
          </div>

          <MonthPicker
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={onChangePeriod}
          />
        </div>

        {/* Sub-Navigation Tabs (Only the 2 operational tabs) */}
        <div className="flex p-1 bg-card rounded-2xl border border-app">
          <button
            onClick={() => setActiveTab('fixed')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'fixed'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ingresos Fijos (Plantilla Mensual)</span>
          </button>

          <button
            onClick={() => setActiveTab('variable')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'variable'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ingresos Variables / Extras ({currentMonthVariables.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Total Ingresos del Mes</span>
          <p className="text-xl sm:text-2xl font-black text-primary-custom tracking-tight">
            {currency}{totalCombinedIncome.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">En {MONTH_NAMES[selectedMonth]} {selectedYear}</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Ingresos Fijos Base</span>
          <p className="text-xl sm:text-2xl font-black text-[#00C2C7] tracking-tight">
            {currency}{totalMonthlyFixed.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">Sueldo, tickets, etc.</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Ingresos Extras / Variables</span>
          <p className="text-xl sm:text-2xl font-black text-[#FF914D] tracking-tight">
            {currency}{totalMonthlyVariable.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-muted block">Bonos, freelance, extras</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Por Quincena</span>
          <div className="text-xs space-y-0.5 pt-0.5">
            <div className="flex justify-between">
              <span className="text-muted">Quincena 15:</span>
              <strong className="text-app font-bold">{currency}{totalQ1.toFixed(0)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Quincena 30:</span>
              <strong className="text-app font-bold">{currency}{totalQ2.toFixed(0)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: INGRESOS FIJOS (PLANTILLA) */}
      {activeTab === 'fixed' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-app flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-custom" />
              Plantilla Mensual Recurrente ({processedFixedIncomes.length})
            </h4>
            <button
              onClick={handleOpenAddFixed}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Ingreso Fijo
            </button>
          </div>

          {processedFixedIncomes.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-primary-custom/15 text-primary-custom flex items-center justify-center shadow-xl shadow-primary-custom/10 border border-primary-custom/20">
                <Briefcase className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-app">Comienza a estructurar tus finanzas</h3>
                <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                  Agrega tu primer registro para calcular tus balances y proyecciones de quincena automáticamente.
                </p>
              </div>
              <button
                onClick={handleOpenAddFixed}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-lg shadow-primary-custom/25 hover:opacity-95 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Crear mi primer ingreso fijo</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {processedFixedIncomes.map((fi) => {
                const category = categories.find((c) => c.id === fi.category_id);
                return (
                  <div
                    key={fi.id}
                    className={`p-4 rounded-3xl border transition-all ${
                      !fi.isActive
                        ? 'bg-surface/50 border-app opacity-60'
                        : 'bg-surface border-app shadow-md hover:border-primary-custom'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: category?.color || '#147DF0' }}
                        >
                          <CategoryIcon iconName={category?.icon || 'Briefcase'} size={20} className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-app">{fi.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span className="px-2 py-0.5 rounded bg-card text-[10px] font-semibold text-app">
                              {fi.default_fortnight === 'q1' && `Quincena 15 de ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                              {fi.default_fortnight === 'q2' && `Quincena 30 de ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                              {fi.default_fortnight === 'both' && 'Ambas Quincenas'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-[#00C2C7]">
                          +{currency}{fi.finalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-app text-xs">
                      <button
                        onClick={() => handleToggleFixedActive(fi)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                          fi.isActive
                            ? 'bg-[#00C2C7]/20 text-[#00C2C7]'
                            : 'bg-card text-muted hover:text-app'
                        }`}
                      >
                        {fi.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{fi.isActive ? 'Activo este mes' : 'Pausado este mes'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditFixed(fi)}
                          className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-card transition-colors cursor-pointer"
                          title="Editar regla base"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFixed(fi.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-[#ef4444] hover:bg-card transition-colors cursor-pointer"
                          title="Eliminar ingreso fijo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INGRESOS VARIABLES / EXTRAS */}
      {activeTab === 'variable' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-app flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF914D]" />
                Ingresos Variables del Mes ({currentMonthVariables.length})
              </h4>
              <p className="text-xs text-muted">Registros puntuales para {MONTH_NAMES[selectedMonth]} {selectedYear}</p>
            </div>
            <button
              onClick={handleOpenAddVar}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Ingreso Extra
            </button>
          </div>

          {currentMonthVariables.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FF914D]/15 text-[#FF914D] flex items-center justify-center shadow-xl shadow-[#FF914D]/10 border border-[#FF914D]/20">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-app">Comienza a estructurar tus finanzas</h3>
                <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                  Agrega tu primer registro para calcular tus balances y proyecciones de quincena automáticamente.
                </p>
              </div>
              <button
                onClick={handleOpenAddVar}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary-custom text-white text-xs font-black shadow-lg shadow-primary-custom/25 hover:opacity-95 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Crear mi primer ingreso extra</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentMonthVariables.map((vi) => {
                const category = categories.find((c) => c.id === vi.category_id);
                const account = accounts.find((a) => a.id === vi.account_id);

                return (
                  <div
                    key={vi.id}
                    className="p-4 rounded-3xl bg-surface border border-app shadow-md hover:border-primary-custom transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: category?.color || '#FF914D' }}
                        >
                          <CategoryIcon iconName={category?.icon || 'Sparkles'} size={20} className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-app">{vi.description}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span className="px-2 py-0.5 rounded bg-card text-[10px] font-semibold text-app">
                              {vi.fortnight === 'q1' ? `Quincena 15 de ${MONTH_NAMES[selectedMonth]}` : `Quincena 30 de ${MONTH_NAMES[selectedMonth]}`}
                            </span>
                            {account && <span className="text-[10px] text-muted">• {account.name}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-[#FF914D]">
                          +{currency}{vi.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-app text-xs">
                      <span className="text-[11px] text-muted truncate max-w-[200px]">
                        {vi.notes || 'Ingreso puntual registrado'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditVar(vi)}
                          className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-card transition-colors cursor-pointer"
                          title="Editar ingreso extra"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVar(vi.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-[#ef4444] hover:bg-card transition-colors cursor-pointer"
                          title="Eliminar ingreso extra"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Fixed Income Modal */}
      {isFixedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95">
            <h3 className="text-base font-bold mb-4">
              {editingFixed ? 'Editar Ingreso Fijo' : 'Nuevo Ingreso Fijo Recurrente'}
            </h3>

            <form onSubmit={handleSaveFixed} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Concepto / Nombre del Ingreso
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sueldo Base, Tickets de Alimentación..."
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Monto ($ USD)
                  </label>
                  <MoneyInput
                    value={fixedAmount}
                    onChange={setFixedAmount}
                    currencySymbol="$"
                    placeholder="0,00"
                    required
                    className="!py-2 !text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Quincena Asignada
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-card rounded-xl border border-app">
                    {[
                      { id: 'q1' as const, label: 'Quincena 15' },
                      { id: 'q2' as const, label: 'Quincena 30' },
                      { id: 'both' as const, label: 'Ambas Quincenas' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFixedFortnight(opt.id)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                          fixedFortnight === opt.id
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-muted hover:text-app'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Categoría
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                  {incomeCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFixedCategoryId(c.id)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        fixedCategoryId === c.id
                          ? 'border-primary-custom bg-card ring-2 ring-primary-custom text-app'
                          : 'border-app bg-card/60 text-muted hover:text-app'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || '#00C2C7' }} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={fixedNotes}
                  onChange={(e) => setFixedNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFixedModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Guardar Ingreso Fijo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Variable Income Modal */}
      {isVarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95">
            <h3 className="text-base font-bold mb-4">
              {editingVar ? 'Editar Ingreso Extra' : 'Registrar Ingreso Variable / Extra'}
            </h3>

            <form onSubmit={handleSaveVar} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Concepto / Descripción
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Proyecto Web Freelance, Guardia Extra, Bono Asistencia..."
                  value={varDescription}
                  onChange={(e) => setVarDescription(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Monto ($ USD)
                  </label>
                  <MoneyInput
                    value={varAmount}
                    onChange={setVarAmount}
                    currencySymbol="$"
                    placeholder="0,00"
                    required
                    className="!py-2 !text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Quincena Asignada
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-card rounded-xl border border-app">
                    {[
                      { id: 'q1' as const, label: `Quincena 15 (${MONTH_NAMES[selectedMonth].substring(0, 3)})` },
                      { id: 'q2' as const, label: `Quincena 30 (${MONTH_NAMES[selectedMonth].substring(0, 3)})` },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setVarFortnight(opt.id)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                          varFortnight === opt.id
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-muted hover:text-app'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Categoría
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                  {incomeCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setVarCategoryId(c.id)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        varCategoryId === c.id
                          ? 'border-primary-custom bg-card ring-2 ring-primary-custom text-app'
                          : 'border-app bg-card/60 text-muted hover:text-app'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || '#FF914D' }} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Cuenta Destino
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1 no-scrollbar">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setVarAccountId(acc.id)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        varAccountId === acc.id
                          ? 'border-primary-custom bg-card ring-2 ring-primary-custom text-app'
                          : 'border-app bg-card/60 text-muted hover:text-app'
                      }`}
                    >
                      <span className="truncate">{acc.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-muted uppercase">
                        {acc.currency}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={varNotes}
                  onChange={(e) => setVarNotes(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsVarModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Guardar Ingreso Extra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
