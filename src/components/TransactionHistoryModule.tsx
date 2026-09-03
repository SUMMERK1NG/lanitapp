import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import type {
  Transaction,
  Category,
  Account,
  FixedIncome,
  VariableIncome,
  FixedExpense,
  VariableExpense,
  Debt,
  DebtPayment,
  SavingsGoal,
  SavingContribution,
  ExchangeRatesData,
} from '../types/index.ts';
import { formatCurrencyVE } from '../utils/numberFormat.ts';
import { CategoryIcon } from './CategoryIcon.tsx';
import { MonthPicker } from './MonthPicker.tsx';

interface TransactionHistoryModuleProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  fixedIncomes: FixedIncome[];
  variableIncomes: VariableIncome[];
  fixedExpenses: FixedExpense[];
  variableExpenses?: VariableExpense[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  savingsGoals: SavingsGoal[];
  savingContributions: SavingContribution[];
  rates: ExchangeRatesData;
  selectedYear: number;
  selectedMonth: number;
  onChangePeriod: (year: number, month: number) => void;
  userCreatedAt?: string;
}

interface ConsolidatedMovement {
  id: string;
  date: string;
  year: number;
  month: number;
  fortnight: 'q1' | 'q2' | 'both' | 'all';
  type: 'income' | 'expense';
  subtype: 'fixed_income' | 'var_income' | 'fixed_expense' | 'var_expense' | 'debt_payment' | 'saving_contrib' | 'direct_tx';
  description: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  accountName: string;
  amountUSD: number;
  notes?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function isCreatedInPeriod(createdAt: string | undefined, year: number, month: number, defaultUserCreated?: string): boolean {
  const dateStr = createdAt || defaultUserCreated;
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  if (year < d.getFullYear()) return false;
  if (year === d.getFullYear() && month < d.getMonth()) return false;
  return true;
}

export const TransactionHistoryModule: React.FC<TransactionHistoryModuleProps> = ({
  transactions,
  categories,
  accounts,
  fixedIncomes,
  variableIncomes,
  fixedExpenses,
  variableExpenses = [],
  debts,
  debtPayments,
  savingsGoals,
  savingContributions,
  rates,
  selectedYear,
  selectedMonth,
  onChangePeriod,
  userCreatedAt,
}) => {
  const [fortnightFilter, setFortnightFilter] = useState<'all' | 'q1' | 'q2'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const bcvUsd = rates.bcvDollar > 0 ? rates.bcvDollar : 1;

  // Filtered categories according to current typeFilter
  const filteredCategoryOptions = useMemo(() => {
    if (typeFilter === 'income') {
      return categories.filter((c) => c.type === 'income');
    }
    if (typeFilter === 'expense') {
      return categories.filter((c) => c.type === 'expense');
    }
    return categories;
  }, [categories, typeFilter]);

  const handleTypeFilterChange = (newType: 'all' | 'expense' | 'income') => {
    setTypeFilter(newType);
    if (categoryFilter !== 'all') {
      const allowed = newType === 'income'
        ? categories.filter((c) => c.type === 'income')
        : newType === 'expense'
        ? categories.filter((c) => c.type === 'expense')
        : categories;
      if (!allowed.some((c) => c.name === categoryFilter)) {
        setCategoryFilter('all');
      }
    }
  };

  const handleGoToCurrentMonth = () => {
    const now = new Date();
    onChangePeriod(now.getFullYear(), now.getMonth());
  };

  // Helper map for categories & accounts
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const debtMap = useMemo(() => new Map(debts.map((d) => [d.id, d])), [debts]);
  const goalMap = useMemo(() => new Map(savingsGoals.map((g) => [g.id, g])), [savingsGoals]);

  // 1. Build Consolidated List of All Movements
  const allConsolidatedMovements = useMemo<ConsolidatedMovement[]>(() => {
    const list: ConsolidatedMovement[] = [];

    // A. Direct Transactions
    transactions.forEach((t) => {
      const d = t.transaction_date ? new Date(t.transaction_date + 'T00:00:00') : new Date();
      const cat = catMap.get(t.category_id);
      const acc = t.account_id ? accMap.get(t.account_id) : undefined;
      const day = d.getDate();
      const fn = day <= 15 ? 'q1' : 'q2';

      list.push({
        id: `tx_${t.id}`,
        date: t.transaction_date || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        fortnight: fn,
        type: t.type === 'income' ? 'income' : 'expense',
        subtype: 'direct_tx',
        description: t.description || (t.type === 'income' ? 'Ingreso Registrado' : 'Gasto Registrado'),
        categoryName: cat?.name || 'General',
        categoryIcon: cat?.icon || (t.type === 'income' ? 'TrendingUp' : 'Receipt'),
        categoryColor: cat?.color || (t.type === 'income' ? '#00C2C7' : '#FF914D'),
        accountName: acc?.name || 'Caja / Billetera',
        amountUSD: Number(t.amount || 0),
        notes: (t as any).notes || '',
      });
    });

    // B. Fixed Incomes (only if active/created in or before this period)
    fixedIncomes.forEach((fi) => {
      if (fi.is_active === false) return;
      if (!isCreatedInPeriod(fi.created_at, selectedYear, selectedMonth, userCreatedAt)) return;
      const cat = catMap.get(fi.category_id);

      if (fi.default_fortnight === 'both' || fi.default_fortnight === 'split') {
        list.push({
          id: `fi_q1_${fi.id}`,
          date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-15`,
          year: selectedYear,
          month: selectedMonth,
          fortnight: 'q1',
          type: 'income',
          subtype: 'fixed_income',
          description: `${fi.name} (Quincena 15)`,
          categoryName: cat?.name || 'Sueldo / Base',
          categoryIcon: cat?.icon || 'Briefcase',
          categoryColor: cat?.color || '#147DF0',
          accountName: 'Nómina / Principal',
          amountUSD: fi.default_fortnight === 'split' ? Number((fi.amount * 0.5).toFixed(2)) : Number(fi.amount),
          notes: fi.notes,
        });
        list.push({
          id: `fi_q2_${fi.id}`,
          date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-30`,
          year: selectedYear,
          month: selectedMonth,
          fortnight: 'q2',
          type: 'income',
          subtype: 'fixed_income',
          description: `${fi.name} (Quincena 30)`,
          categoryName: cat?.name || 'Sueldo / Base',
          categoryIcon: cat?.icon || 'Briefcase',
          categoryColor: cat?.color || '#147DF0',
          accountName: 'Nómina / Principal',
          amountUSD: fi.default_fortnight === 'split' ? Number((fi.amount * 0.5).toFixed(2)) : Number(fi.amount),
          notes: fi.notes,
        });
      } else {
        const fn = fi.default_fortnight === 'q2' ? 'q2' : 'q1';
        list.push({
          id: `fi_${fi.id}`,
          date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${fn === 'q1' ? '15' : '30'}`,
          year: selectedYear,
          month: selectedMonth,
          fortnight: fn,
          type: 'income',
          subtype: 'fixed_income',
          description: fi.name,
          categoryName: cat?.name || 'Sueldo / Base',
          categoryIcon: cat?.icon || 'Briefcase',
          categoryColor: cat?.color || '#147DF0',
          accountName: 'Nómina / Principal',
          amountUSD: Number(fi.amount),
          notes: fi.notes,
        });
      }
    });

    // C. Variable Incomes
    variableIncomes.forEach((vi) => {
      const cat = catMap.get(vi.category_id || '');
      const acc = vi.account_id ? accMap.get(vi.account_id) : undefined;
      list.push({
        id: `vi_${vi.id}`,
        date: `${vi.year}-${String(vi.month + 1).padStart(2, '0')}-${vi.fortnight === 'q1' ? '15' : '30'}`,
        year: vi.year,
        month: vi.month,
        fortnight: vi.fortnight,
        type: 'income',
        subtype: 'var_income',
        description: vi.description,
        categoryName: cat?.name || 'Ingreso Variable',
        categoryIcon: cat?.icon || 'TrendingUp',
        categoryColor: cat?.color || '#00C2C7',
        accountName: acc?.name || 'Billetera Digital',
        amountUSD: Number(vi.amount),
        notes: vi.notes,
      });
    });

    // D. Fixed Expenses (only if active/created in or before this period)
    fixedExpenses.forEach((fe) => {
      if (fe.is_active === false) return;
      if (!isCreatedInPeriod(fe.created_at, selectedYear, selectedMonth, userCreatedAt)) return;
      const cat = catMap.get(fe.category_id);

      if (fe.default_fortnight === 'both') {
        list.push({
          id: `fe_q1_${fe.id}`,
          date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-15`,
          year: selectedYear,
          month: selectedMonth,
          fortnight: 'q1',
          type: 'expense',
          subtype: 'fixed_expense',
          description: `${fe.name} (Q15)`,
          categoryName: cat?.name || 'Gasto Fijo',
          categoryIcon: cat?.icon || 'Receipt',
          categoryColor: cat?.color || '#FF914D',
          accountName: 'Débito Automático',
          amountUSD: Number(fe.amount),
          notes: fe.notes,
        });
        list.push({
          id: `fe_q2_${fe.id}`,
          date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-30`,
          year: selectedYear,
          month: selectedMonth,
          fortnight: 'q2',
          type: 'expense',
          subtype: 'fixed_expense',
          description: `${fe.name} (Q30)`,
          categoryName: cat?.name || 'Gasto Fijo',
          categoryIcon: cat?.icon || 'Receipt',
          categoryColor: cat?.color || '#FF914D',
          accountName: 'Débito Automático',
          amountUSD: Number(fe.amount),
          notes: fe.notes,
        });
      } else {
        const fn = fe.default_fortnight === 'q2' ? 'q2' : 'q1';
        list.push({
          id: `fe_${fe.id}`,
          date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${fn === 'q1' ? '15' : '30'}`,
          year: selectedYear,
          month: selectedMonth,
          fortnight: fn,
          type: 'expense',
          subtype: 'fixed_expense',
          description: fe.name,
          categoryName: cat?.name || 'Gasto Fijo',
          categoryIcon: cat?.icon || 'Receipt',
          categoryColor: cat?.color || '#FF914D',
          accountName: 'Débito Automático',
          amountUSD: Number(fe.amount),
          notes: fe.notes,
        });
      }
    });

    // E. Variable Expenses
    variableExpenses.forEach((ve) => {
      const cat = catMap.get(ve.category_id || '');
      const acc = ve.account_id ? accMap.get(ve.account_id) : undefined;
      list.push({
        id: `ve_${ve.id}`,
        date: `${ve.year}-${String(ve.month + 1).padStart(2, '0')}-${ve.fortnight === 'q1' ? '15' : '30'}`,
        year: ve.year,
        month: ve.month,
        fortnight: ve.fortnight,
        type: 'expense',
        subtype: 'var_expense',
        description: ve.description,
        categoryName: cat?.name || 'Gasto Variable',
        categoryIcon: cat?.icon || 'ShoppingCart',
        categoryColor: cat?.color || '#FF914D',
        accountName: acc?.name || 'Efectivo / Caja',
        amountUSD: Number(ve.amount),
        notes: ve.notes,
      });
    });

    // F. Debt Payments
    debtPayments.forEach((dp) => {
      const debt = debtMap.get(dp.debt_id);
      list.push({
        id: `dp_${dp.id}`,
        date: dp.payment_date || `${dp.year}-${String(dp.month + 1).padStart(2, '0')}-${dp.fortnight === 'q1' ? '15' : '30'}`,
        year: dp.year,
        month: dp.month,
        fortnight: dp.fortnight,
        type: 'expense',
        subtype: 'debt_payment',
        description: `Pago Cuota: ${debt?.creditor || 'Deuda'}`,
        categoryName: 'Pago de Deudas',
        categoryIcon: 'CreditCard',
        categoryColor: '#8B5CF6',
        accountName: 'Abono Registrado',
        amountUSD: Number(dp.amount || 0),
        notes: dp.notes,
      });
    });

    // G. Savings Contributions
    savingContributions.forEach((sc) => {
      if (sc.is_skipped) return;
      const goal = goalMap.get(sc.goal_id);
      list.push({
        id: `sc_${sc.id}`,
        date: `${sc.year}-${String(sc.month + 1).padStart(2, '0')}-${sc.fortnight === 'q1' ? '15' : '30'}`,
        year: sc.year,
        month: sc.month,
        fortnight: sc.fortnight,
        type: 'expense',
        subtype: 'saving_contrib',
        description: `Aporte Ahorro: ${goal?.name || 'Meta'}`,
        categoryName: 'Ahorro & Metas',
        categoryIcon: 'PiggyBank',
        categoryColor: '#10B981',
        accountName: 'Fondo de Ahorro',
        amountUSD: Number(sc.amount || 0),
        notes: sc.notes,
      });
    });

    // Sort by date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions,
    fixedIncomes,
    variableIncomes,
    fixedExpenses,
    variableExpenses,
    debtPayments,
    savingContributions,
    catMap,
    accMap,
    debtMap,
    goalMap,
    selectedYear,
    selectedMonth,
    userCreatedAt,
  ]);

  // 2. Filtered Dataset
  const filteredMovements = useMemo(() => {
    return allConsolidatedMovements.filter((m) => {
      // Period filter: matching month and year
      if (m.year !== selectedYear || m.month !== selectedMonth) return false;

      // Fortnight filter
      if (fortnightFilter !== 'all' && m.fortnight !== 'all' && m.fortnight !== 'both') {
        if (m.fortnight !== fortnightFilter) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && m.categoryName !== categoryFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = m.description.toLowerCase().includes(q);
        const matchCat = m.categoryName.toLowerCase().includes(q);
        const matchAmt = m.amountUSD.toString().includes(q);
        if (!matchDesc && !matchCat && !matchAmt) return false;
      }

      return true;
    });
  }, [
    allConsolidatedMovements,
    selectedYear,
    selectedMonth,
    fortnightFilter,
    typeFilter,
    categoryFilter,
    searchQuery,
  ]);

  // Summary KPI Calculations on Filtered Movements
  const totalFilteredIncome = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'income')
      .reduce((sum, m) => sum + m.amountUSD, 0);
  }, [filteredMovements]);

  const totalFilteredExpense = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'expense')
      .reduce((sum, m) => sum + m.amountUSD, 0);
  }, [filteredMovements]);

  const netFilteredBalance = totalFilteredIncome - totalFilteredExpense;

  // 3. Export to Excel (.csv) with UTF-8 BOM
  const handleExportCSV = () => {
    const headers = [
      'Fecha',
      'Quincena',
      'Tipo',
      'Concepto / Descripcion',
      'Categoria',
      'Cuenta / Origen',
      'Monto (USD)',
      'Tasa BCV (Bs.)',
      'Monto Aprox (Bs.)',
      'Notas',
    ];

    const rows = filteredMovements.map((m) => [
      `"${m.date}"`,
      `"${m.fortnight === 'q1' ? 'Q1 (15)' : m.fortnight === 'q2' ? 'Q2 (30)' : 'Ambas'}"`,
      `"${m.type === 'income' ? 'Ingreso' : 'Gasto'}"`,
      `"${m.description.replace(/"/g, '""')}"`,
      `"${m.categoryName}"`,
      `"${m.accountName}"`,
      m.amountUSD.toFixed(2),
      bcvUsd.toFixed(2),
      (m.amountUSD * bcvUsd).toFixed(2),
      `"${(m.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `Historial_Movimientos_LanitApp_${MONTH_NAMES[selectedMonth]}_${selectedYear}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Print / PDF Export
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar with Filters & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-app shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-app tracking-tight">
              Historial de Movimientos
            </h2>
            <p className="text-xs text-muted">
              Auditoría y trazabilidad integral de ingresos, gastos y cuotas
            </p>
          </div>
        </div>

        {/* Period Stepper & Export Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {/* Month Picker with interactive Dropdown Grid */}
          <MonthPicker
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={onChangePeriod}
          />

          <button
            onClick={handleGoToCurrentMonth}
            className="px-3 py-2 rounded-2xl bg-card hover:bg-surface border border-app text-xs font-bold text-muted hover:text-app cursor-pointer shadow-sm"
          >
            Hoy
          </button>

          {/* Export to CSV (Excel) */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all cursor-pointer"
            title="Descargar archivo Excel (.csv)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          {/* Export to PDF */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-black shadow-md hover:opacity-95 transition-all cursor-pointer"
            title="Exportar a PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-muted text-xs font-semibold">
            <ArrowDownLeft className="w-4 h-4 text-[#00C2C7]" />
            <span>Ingresos Filtrados</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#00C2C7]">
            +${formatCurrencyVE(totalFilteredIncome)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <div className="flex items-center gap-1.5 text-muted text-xs font-semibold">
            <ArrowUpRight className="w-4 h-4 text-[#FF914D]" />
            <span>Egresos Filtrados</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#FF914D]">
            -${formatCurrencyVE(totalFilteredExpense)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] text-muted font-bold block uppercase tracking-wider">
            Balance Neto
          </span>
          <p className={`text-xl sm:text-2xl font-black ${netFilteredBalance >= 0 ? 'text-app' : 'text-rose-400'}`}>
            ${formatCurrencyVE(netFilteredBalance)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
          <span className="text-[11px] text-muted font-bold block uppercase tracking-wider">
            Registros
          </span>
          <p className="text-xl sm:text-2xl font-black text-app">
            {filteredMovements.length}
          </p>
        </div>
      </div>

      {/* 3. Comprehensive Search & Multi-Filter Control Bar */}
      <div className="p-4 rounded-3xl bg-surface border border-app shadow-md space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por concepto, categoría, cuenta o monto..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-app rounded-2xl text-xs sm:text-sm text-app placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary-custom"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 flex-wrap">
          {/* Fortnight Filter */}
          <div className="flex items-center p-1 bg-card rounded-xl border border-app text-xs font-bold">
            <span className="px-2 text-[10px] uppercase text-muted font-black">Quincena:</span>
            {[
              { id: 'all' as const, label: 'Todas' },
              { id: 'q1' as const, label: 'Q1 (15)' },
              { id: 'q2' as const, label: 'Q2 (30)' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFortnightFilter(item.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  fortnightFilter === item.id ? 'bg-primary-custom text-white shadow-sm' : 'text-muted hover:text-app'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex items-center p-1 bg-card rounded-xl border border-app text-xs font-bold">
            <span className="px-2 text-[10px] uppercase text-muted font-black">Tipo:</span>
            {[
              { id: 'all' as const, label: 'Todos' },
              { id: 'expense' as const, label: 'Gastos' },
              { id: 'income' as const, label: 'Ingresos' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleTypeFilterChange(item.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  typeFilter === item.id ? 'bg-primary-custom text-white shadow-sm' : 'text-muted hover:text-app'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Category Filter Dropdown (Filtered dynamically by Type) */}
          <div className="flex items-center p-1 bg-card rounded-xl border border-app text-xs font-bold max-w-xs">
            <span className="px-2 text-[10px] uppercase text-muted font-black shrink-0">Categoría:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-card text-xs font-bold text-app px-2 py-1 outline-none cursor-pointer truncate max-w-[150px] sm:max-w-[190px]"
            >
              <option value="all" className="bg-surface text-app">
                {typeFilter === 'income' ? 'Todas (Ingresos)' : typeFilter === 'expense' ? 'Todas (Gastos)' : 'Todas las categorías'}
              </option>
              {filteredCategoryOptions.map((c) => (
                <option key={c.id} value={c.name} className="bg-surface text-app">
                  {c.name} {typeFilter === 'all' ? (c.type === 'income' ? '(Ingreso)' : '(Gasto)') : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Movements Table / Cards Feed */}
      <div className="space-y-2">
        {filteredMovements.length === 0 ? (
          <div className="p-12 rounded-3xl bg-surface border border-app text-center space-y-3">
            <History className="w-12 h-12 text-muted mx-auto opacity-40" />
            <h4 className="text-base font-bold text-app">No se encontraron movimientos</h4>
            <p className="text-xs text-muted max-w-sm mx-auto">
              No hay registros que coincidan con los filtros aplicados en {MONTH_NAMES[selectedMonth]} {selectedYear}.
            </p>
          </div>
        ) : (
          <div className="p-2 sm:p-4 rounded-3xl bg-surface border border-app shadow-md space-y-2">
            {filteredMovements.map((m) => {
              const isIncome = m.type === 'income';

              return (
                <div
                  key={m.id}
                  className="p-3 sm:p-4 rounded-2xl bg-card hover:bg-surface border border-app hover:border-primary-custom/40 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner"
                      style={{ backgroundColor: m.categoryColor }}
                    >
                      <CategoryIcon iconName={m.categoryIcon} className="w-5 h-5" />
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-app truncate">{m.description}</h4>
                        <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase border ${
                          m.fortnight === 'q1'
                            ? 'bg-[#00C2C7]/15 text-[#00C2C7] border-[#00C2C7]/30'
                            : 'bg-[#FF914D]/15 text-[#FF914D] border-[#FF914D]/30'
                        }`}>
                          {m.fortnight === 'q1' ? 'Q15' : m.fortnight === 'q2' ? 'Q30' : 'Q1/Q2'}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted truncate block mt-0.5">
                        {m.date} • {m.categoryName} • <strong className="text-app font-medium">{m.accountName}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-sm sm:text-base font-black ${isIncome ? 'text-[#00C2C7]' : 'text-[#FF914D]'}`}>
                      {isIncome ? `+$${formatCurrencyVE(m.amountUSD)}` : `-$${formatCurrencyVE(m.amountUSD)}`}
                    </span>
                    <span className="text-[10px] text-muted block">
                      ≈ Bs. {formatCurrencyVE(m.amountUSD * bcvUsd)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* MODAL EXPORTACIÓN PDF / IMPRIMIR */}
      {/* ================================================================ */}
      {isPrintModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in cursor-pointer"
          onClick={() => setIsPrintModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-surface border border-app rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-app shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary-custom" />
                <h3 className="text-base font-black text-app">
                  Reporte de Auditoría de Movimientos ({MONTH_NAMES[selectedMonth]} {selectedYear})
                </h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scrollbar Interno */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">

            {/* Printable Report Sheet */}
            <div className="p-5 rounded-2xl bg-card border border-app text-app space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-app pb-3">
                <div>
                  <h1 className="text-lg font-black text-primary-custom">LANITAPP AUDITORÍA</h1>
                  <p className="text-[11px] text-muted">Historial de Movimientos e Ingresos/Egresos</p>
                </div>
                <div className="text-right">
                  <span className="font-bold block">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
                  <span className="text-[10px] text-muted">Total registros: {filteredMovements.length}</span>
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-surface border border-app">
                  <span className="text-[10px] text-muted font-bold block">Total Ingresos</span>
                  <span className="text-sm font-black text-[#00C2C7]">+${formatCurrencyVE(totalFilteredIncome)}</span>
                </div>
                <div className="p-2 rounded-xl bg-surface border border-app">
                  <span className="text-[10px] text-muted font-bold block">Total Egresos</span>
                  <span className="text-sm font-black text-[#FF914D]">-${formatCurrencyVE(totalFilteredExpense)}</span>
                </div>
                <div className="p-2 rounded-xl bg-surface border border-app">
                  <span className="text-[10px] text-muted font-bold block">Balance Neto</span>
                  <span className="text-sm font-black text-app">${formatCurrencyVE(netFilteredBalance)}</span>
                </div>
              </div>

              {/* Table List */}
              <div className="max-h-64 overflow-y-auto divide-y divide-app border border-app rounded-xl">
                {filteredMovements.map((m) => (
                  <div key={m.id} className="p-2 flex justify-between items-center text-[11px]">
                    <div>
                      <span className="font-bold text-app block">{m.description}</span>
                      <span className="text-[10px] text-muted">{m.date} • {m.categoryName}</span>
                    </div>
                    <span className={`font-black ${m.type === 'income' ? 'text-[#00C2C7]' : 'text-[#FF914D]'}`}>
                      {m.type === 'income' ? `+$${formatCurrencyVE(m.amountUSD)}` : `-$${formatCurrencyVE(m.amountUSD)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-app">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-card hover:bg-surface border border-app text-xs font-bold text-muted hover:text-app cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-custom text-white text-xs font-black shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Guardar en PDF</span>
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
