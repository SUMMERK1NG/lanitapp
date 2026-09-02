import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  CreditCard,
  Calendar,
  Printer,
  Sliders,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  Check,
  X,
  History,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
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
import { Skeleton } from './ui/Skeleton.tsx';
import { updatePreference, getUserPreferences } from '../lib/profilePreferences.ts';
import { getActiveUserId } from '../lib/db.ts';

interface DashboardModuleProps {
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
  onNavigate: (view: any) => void;
  userCreatedAt?: string;
  currentUserId?: string;
  initialWidgets?: DashboardWidgetConfig | null;
  isLoading?: boolean;
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

interface DashboardWidgetConfig {
  kpis: boolean;
  quincenas: boolean;
  cashflowChart: boolean;
  categoriesDonut: boolean;
  savingsDebtGauge: boolean;
  accountsOverview: boolean;
  recentMovements: boolean;
}

const DEFAULT_WIDGETS: DashboardWidgetConfig = {
  kpis: true,
  quincenas: true,
  cashflowChart: true,
  categoriesDonut: true,
  savingsDebtGauge: true,
  accountsOverview: true,
  recentMovements: true,
};

export const DashboardModule: React.FC<DashboardModuleProps> = ({
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
  onNavigate,
  userCreatedAt,
  currentUserId,
  initialWidgets,
  isLoading,
}) => {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // Load custom widget preferences from Supabase profiles (with fallback to DEFAULT_WIDGETS)
  const [widgets, setWidgets] = useState<DashboardWidgetConfig>(() => {
    if (initialWidgets && typeof initialWidgets === 'object') {
      return { ...DEFAULT_WIDGETS, ...initialWidgets };
    }
    return DEFAULT_WIDGETS;
  });

  // Sincronizar widgets cuando cambien los datos del perfil en Supabase
  useEffect(() => {
    if (initialWidgets && typeof initialWidgets === 'object') {
      setWidgets((prev) => ({ ...prev, ...initialWidgets }));
    }
  }, [initialWidgets]);

  // Si no se pasaron initialWidgets pero hay un usuario activo, cargar sus preferencias
  useEffect(() => {
    const effectiveUserId = currentUserId || getActiveUserId();
    if (effectiveUserId) {
      getUserPreferences(effectiveUserId).then((prefs) => {
        if (prefs?.dashboard_widgets && typeof prefs.dashboard_widgets === 'object') {
          setWidgets((prev) => ({ ...prev, ...prefs.dashboard_widgets }));
        }
      });
    }
  }, [currentUserId]);

  const toggleWidget = async (key: keyof DashboardWidgetConfig) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated); // Actualización visual inmediata

    const effectiveUserId = currentUserId || getActiveUserId();
    if (effectiveUserId) {
      try {
        await updatePreference(effectiveUserId, 'dashboard_widgets', updated);
      } catch (err) {
        console.error('Error guardando configuración de widgets en Supabase:', err);
      }
    }
  };

  const resetWidgets = async () => {
    setWidgets(DEFAULT_WIDGETS); // Actualización visual inmediata

    const effectiveUserId = currentUserId || getActiveUserId();
    if (effectiveUserId) {
      try {
        await updatePreference(effectiveUserId, 'dashboard_widgets', DEFAULT_WIDGETS);
      } catch (err) {
        console.error('Error restableciendo configuración de widgets en Supabase:', err);
      }
    }
  };

  const handleGoToCurrentMonth = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  // --- Dynamic Calculations for Selected Month ---
  const bcvRate = rates.bcvDollar > 0 ? rates.bcvDollar : 1;
  const parRate = rates.parallelDollar > 0 ? rates.parallelDollar : bcvRate;

  // 1. Transactions in selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.transaction_date) return false;
      const d = new Date(t.transaction_date + 'T00:00:00');
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // 2. Incomes for selected month
  const totalFixedIncomes = useMemo(() => {
    return fixedIncomes
      .filter((f) => {
        if (f.is_active === false) return false;
        if (!isCreatedInPeriod(f.created_at, selectedYear, selectedMonth, userCreatedAt)) return false;
        return true;
      })
      .reduce((sum, f) => sum + (f.default_fortnight === 'both' ? f.amount * 2 : f.amount), 0);
  }, [fixedIncomes, selectedYear, selectedMonth, userCreatedAt]);

  const totalVariableIncomes = useMemo(() => {
    return variableIncomes
      .filter((v) => v.year === selectedYear && v.month === selectedMonth)
      .reduce((sum, v) => sum + v.amount, 0);
  }, [variableIncomes, selectedYear, selectedMonth]);

  const totalDirectIncomes = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const totalIncome = totalFixedIncomes + totalVariableIncomes + totalDirectIncomes;

  // 3. Expenses for selected month
  const totalFixedExpenses = useMemo(() => {
    return fixedExpenses
      .filter((f) => {
        if (f.is_active === false) return false;
        if (!isCreatedInPeriod(f.created_at, selectedYear, selectedMonth, userCreatedAt)) return false;
        return true;
      })
      .reduce((sum, f) => sum + (f.default_fortnight === 'both' ? f.amount * 2 : f.amount), 0);
  }, [fixedExpenses, selectedYear, selectedMonth, userCreatedAt]);

  const totalDebtPayments = useMemo(() => {
    return debtPayments
      .filter((dp) => dp.year === selectedYear && dp.month === selectedMonth)
      .reduce((sum, dp) => sum + (dp.amount || 0), 0);
  }, [debtPayments, selectedYear, selectedMonth]);

  const totalSavingsContributions = useMemo(() => {
    return savingContributions
      .filter((sc) => sc.year === selectedYear && sc.month === selectedMonth && !sc.is_skipped)
      .reduce((sum, sc) => sum + (sc.amount || 0), 0);
  }, [savingContributions, selectedYear, selectedMonth]);

  const totalDirectExpenses = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const totalVariableExpenses = useMemo(() => {
    return variableExpenses
      .filter((v) => v.year === selectedYear && v.month === selectedMonth)
      .reduce((sum, v) => sum + v.amount, 0);
  }, [variableExpenses, selectedYear, selectedMonth]);

  const totalExpense = totalFixedExpenses + totalVariableExpenses + totalDebtPayments + totalDirectExpenses;
  const netBalance = totalIncome - totalExpense;

  // 4. Financial Health Score & Savings Rate
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;

  const financialHealth = useMemo(() => {
    if (netBalance < 0) return { label: 'Déficit', color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', desc: 'Gastos superan ingresos este mes' };
    if (savingsRate >= 30) return { label: 'Excelente', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', desc: 'Excelente margen de ahorro (>30%)' };
    if (savingsRate >= 15) return { label: 'Saludable', color: 'text-[#00C2C7]', bg: 'bg-[#00C2C7]/15', border: 'border-[#00C2C7]/30', desc: 'Buen balance operativo' };
    return { label: 'Ajustado', color: 'text-[#FF914D]', bg: 'bg-[#FF914D]/15', border: 'border-[#FF914D]/30', desc: 'Margen libre reducido (<15%)' };
  }, [netBalance, savingsRate]);

  // 5. Total Capital available in Accounts
  const totalCapitalUSD = useMemo(() => {
    return accounts.reduce((acc, a) => {
      const txs = transactions.filter((t) => t.account_id === a.id);
      const inc = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const bal = (a.initial_balance || 0) + (inc - exp);
      if (a.currency === 'VES') return acc + bal / bcvRate;
      return acc + bal;
    }, 0);
  }, [accounts, transactions, bcvRate]);

  // 6. Quincenas Breakdown for Selected Month
  const q1Expenses = useMemo(() => {
    const fixedSum = fixedExpenses
      .filter((f) => {
        if (f.is_active === false) return false;
        if (!isCreatedInPeriod(f.created_at, selectedYear, selectedMonth, userCreatedAt)) return false;
        return f.default_fortnight === 'q1' || f.default_fortnight === 'both';
      })
      .reduce((sum, f) => sum + f.amount, 0);

    const varSum = variableExpenses
      .filter((v) => v.year === selectedYear && v.month === selectedMonth && v.fortnight === 'q1')
      .reduce((sum, v) => sum + v.amount, 0);

    return fixedSum + varSum;
  }, [fixedExpenses, variableExpenses, selectedYear, selectedMonth, userCreatedAt]);

  const q2Expenses = useMemo(() => {
    const fixedSum = fixedExpenses
      .filter((f) => {
        if (f.is_active === false) return false;
        if (!isCreatedInPeriod(f.created_at, selectedYear, selectedMonth, userCreatedAt)) return false;
        return f.default_fortnight === 'q2' || f.default_fortnight === 'both';
      })
      .reduce((sum, f) => sum + f.amount, 0);

    const varSum = variableExpenses
      .filter((v) => v.year === selectedYear && v.month === selectedMonth && v.fortnight === 'q2')
      .reduce((sum, v) => sum + v.amount, 0);

    return fixedSum + varSum;
  }, [fixedExpenses, variableExpenses, selectedYear, selectedMonth, userCreatedAt]);

  // 7. Cashflow Chart Data (4 weeks / periods of the month)
  const cashflowData = useMemo(() => {
    const period1Income = totalIncome * 0.5;
    const period2Income = totalIncome * 0.5;
    const period1Expense = q1Expenses + (totalDirectExpenses * 0.5) + (totalDebtPayments * 0.5);
    const period2Expense = q2Expenses + (totalDirectExpenses * 0.5) + (totalDebtPayments * 0.5);

    return [
      {
        name: `Q1 (1-15 ${MONTH_NAMES[selectedMonth].substring(0, 3)})`,
        Ingresos: Number(period1Income.toFixed(2)),
        Egresos: Number(period1Expense.toFixed(2)),
        Remanente: Number(Math.max(0, period1Income - period1Expense).toFixed(2)),
      },
      {
        name: `Q2 (16-30 ${MONTH_NAMES[selectedMonth].substring(0, 3)})`,
        Ingresos: Number(period2Income.toFixed(2)),
        Egresos: Number(period2Expense.toFixed(2)),
        Remanente: Number(Math.max(0, period2Income - period2Expense).toFixed(2)),
      },
    ];
  }, [selectedMonth, totalIncome, q1Expenses, q2Expenses, totalDirectExpenses, totalDebtPayments]);

  // 8. Category Expense Distribution Donut Data
  const categoryExpenseData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    // Fixed expenses by category
    fixedExpenses.forEach((f) => {
      if (f.is_active !== false && isCreatedInPeriod(f.created_at, selectedYear, selectedMonth, userCreatedAt)) {
        const catId = f.category_id || 'cat_other_exp';
        const amt = f.default_fortnight === 'both' ? f.amount * 2 : f.amount;
        categoryTotals[catId] = (categoryTotals[catId] || 0) + amt;
      }
    });

    // Variable expenses for this month
    variableExpenses
      .filter((v) => v.year === selectedYear && v.month === selectedMonth)
      .forEach((v) => {
        const catId = v.category_id || 'cat_other_exp';
        categoryTotals[catId] = (categoryTotals[catId] || 0) + v.amount;
      });

    // Direct transaction expenses by category
    monthTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const catId = t.category_id || 'cat_other_exp';
        categoryTotals[catId] = (categoryTotals[catId] || 0) + t.amount;
      });

    // Debt payments category
    if (totalDebtPayments > 0) {
      categoryTotals['cat_debt'] = (categoryTotals['cat_debt'] || 0) + totalDebtPayments;
    }

    const totalCalculated = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    return Object.entries(categoryTotals)
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          id: catId,
          name: cat?.name || 'Otros Gastos',
          amount: Number(amount.toFixed(2)),
          color: cat?.color || '#00C2C7',
          icon: cat?.icon || 'ShoppingCart',
          percentage: totalCalculated > 0 ? Number(((amount / totalCalculated) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [fixedExpenses, variableExpenses, monthTransactions, totalDebtPayments, categories, selectedYear, selectedMonth, userCreatedAt]);

  // 9. Savings and Debt Gauges
  const totalDebtBalance = useMemo(() => {
    return debts
      .filter((d) => {
        if (d.status === 'paid') return false;
        if (d.start_year !== undefined && d.start_month !== undefined) {
          if (selectedYear < d.start_year) return false;
          if (selectedYear === d.start_year && selectedMonth < d.start_month) return false;
        } else if (!isCreatedInPeriod(d.created_at, selectedYear, selectedMonth, userCreatedAt)) {
          return false;
        }
        return true;
      })
      .reduce((sum, d) => sum + (d.current_balance || d.total_amount || 0), 0);
  }, [debts, selectedYear, selectedMonth, userCreatedAt]);

  const totalSavingsTarget = useMemo(() => {
    return savingsGoals
      .filter((g) => {
        if (g.status !== 'active') return false;
        if (!isCreatedInPeriod(g.start_date || g.created_at, selectedYear, selectedMonth, userCreatedAt)) return false;
        return true;
      })
      .reduce((sum, g) => sum + g.target_amount, 0);
  }, [savingsGoals, selectedYear, selectedMonth, userCreatedAt]);

  const totalSavingsSaved = useMemo(() => {
    return savingsGoals
      .filter((g) => {
        if (g.status !== 'active') return false;
        if (!isCreatedInPeriod(g.start_date || g.created_at, selectedYear, selectedMonth, userCreatedAt)) return false;
        return true;
      })
      .reduce((sum, g) => sum + (g.current_amount || 0), 0);
  }, [savingsGoals, selectedYear, selectedMonth, userCreatedAt]);

  const savingsProgressPct = totalSavingsTarget > 0 ? Math.min(100, Math.round((totalSavingsSaved / totalSavingsTarget) * 100)) : 0;

  // Print Executive Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Toolbar Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md">
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" className="w-10 h-10 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton variant="text" className="w-40 h-5" />
              <Skeleton variant="text" className="w-64 h-3" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton variant="rectangular" className="w-32 h-9 rounded-2xl" />
            <Skeleton variant="rectangular" className="w-16 h-9 rounded-2xl" />
          </div>
        </div>

        {/* KPIs Cards Skeleton Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Skeleton variant="card" className="h-28 rounded-3xl" />
          <Skeleton variant="card" className="h-28 rounded-3xl" />
          <Skeleton variant="card" className="h-28 rounded-3xl" />
          <Skeleton variant="card" className="h-28 rounded-3xl" />
        </div>

        {/* Quincenas Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton variant="card" className="h-56 rounded-3xl" />
          <Skeleton variant="card" className="h-56 rounded-3xl" />
        </div>

        {/* Cashflow & Categories Chart Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton variant="rectangular" className="lg:col-span-2 h-72 rounded-3xl" />
          <Skeleton variant="rectangular" className="h-72 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar with Month Navigation & Customization */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-surface border border-app shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-app tracking-tight">
              Dashboard General
            </h2>
            <p className="text-xs text-muted">
              Visión integral de ingresos, egresos, flujo de caja y capital
            </p>
          </div>
        </div>

        {/* Period Selector & Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {/* Month Picker with interactive Dropdown Grid */}
          <MonthPicker
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChange={(y, m) => {
              setSelectedYear(y);
              setSelectedMonth(m);
            }}
          />

          <button
            onClick={handleGoToCurrentMonth}
            className="px-3 py-2 rounded-2xl bg-card hover:bg-surface border border-app text-xs font-bold text-muted hover:text-app transition-all cursor-pointer shadow-sm"
          >
            Hoy
          </button>

          {/* Customize Dashboard Button */}
          <button
            onClick={() => setIsCustomizeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-surface border border-app text-xs font-bold text-app transition-all cursor-pointer"
            title="Diseña y personaliza tus widgets"
          >
            <Sliders className="w-3.5 h-3.5 text-primary-custom" />
            <span className="hidden sm:inline">Personalizar</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-all cursor-pointer"
            title="Exportar reporte mensual"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Financial KPI Cards */}
      {widgets.kpis && (
        <div className="space-y-3">
          {/* Main Hero Card: Balance Neto Mensual */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-custom via-primary-custom/90 to-[#203657] text-white p-5 sm:p-6 shadow-xl border border-white/20">
            <div className="absolute -right-8 -top-8 w-44 h-44 bg-[#00C2C7]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-44 h-44 bg-[#FF914D]/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white/90">
                  <Wallet className="w-4 h-4 text-[#00C2C7]" />
                  Balance Neto Estimado ({MONTH_NAMES[selectedMonth]})
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/25">
                  Capital Total: ${formatCurrencyVE(totalCapitalUSD)}
                </span>
              </div>

              <div>
                <h3 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                  ${formatCurrencyVE(netBalance)}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-white/80 mt-1">
                  ≈ Bs. {formatCurrencyVE(netBalance * bcvRate)} (Tasa BCV: Bs. {formatCurrencyVE(bcvRate)}) • Promedio: Bs. {formatCurrencyVE(netBalance * parRate)}
                </p>
              </div>

              <div className="pt-3 flex items-center justify-between text-xs border-t border-white/20 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-[#00C2C7]" />
                  <span>
                    Tasa de Ahorro: <strong className="text-white font-bold">{savingsRate}%</strong>
                  </span>
                </div>

                <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${financialHealth.bg} ${financialHealth.color} border ${financialHealth.border}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Estado: {financialHealth.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Income vs Expenses Quick Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-muted text-xs font-semibold">
                <ArrowDownLeft className="w-4 h-4 text-[#00C2C7]" />
                <span>Ingresos Totales</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-[#00C2C7]">
                +${formatCurrencyVE(totalIncome)}
              </p>
              <span className="text-[11px] text-muted block truncate">
                Fijos: ${formatCurrencyVE(totalFixedIncomes)} • Var: ${formatCurrencyVE(totalVariableIncomes + totalDirectIncomes)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-muted text-xs font-semibold">
                <ArrowUpRight className="w-4 h-4 text-[#FF914D]" />
                <span>Egresos & Gastos</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-[#FF914D]">
                -${formatCurrencyVE(totalExpense)}
              </p>
              <span className="text-[11px] text-muted block truncate">
                Fijos: ${formatCurrencyVE(totalFixedExpenses)} • Deudas: ${formatCurrencyVE(totalDebtPayments)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-muted text-xs font-semibold">
                <CreditCard className="w-4 h-4 text-purple-400" />
                <span>Deuda Total Activa</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-app">
                ${formatCurrencyVE(totalDebtBalance)}
              </p>
              <span className="text-[11px] text-muted block truncate">
                Cuotas pagadas este mes: ${formatCurrencyVE(totalDebtPayments)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-app shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-muted text-xs font-semibold">
                <PiggyBank className="w-4 h-4 text-emerald-400" />
                <span>Fondo Ahorrado</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-400">
                ${formatCurrencyVE(totalSavingsSaved)}
              </p>
              <span className="text-[11px] text-muted block truncate">
                {savingsProgressPct}% de meta (${formatCurrencyVE(totalSavingsTarget)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Quincena Glimpse Hero */}
      {widgets.quincenas && (
        <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-app">Distribución Plan Quincenal</h3>
                <p className="text-xs text-muted">Compromisos programados para {MONTH_NAMES[selectedMonth]}</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('fortnight')}
              className="text-xs font-bold text-primary-custom hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver plan completo <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-card border border-app flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">
                  Quincena 15 de {MONTH_NAMES[selectedMonth]}
                </span>
                <span className="text-xs text-muted mt-0.5 block">Gastos asignados:</span>
                <span className="text-lg font-black text-[#FF914D]">
                  ${formatCurrencyVE(q1Expenses)}
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-primary-custom/10 text-primary-custom border border-primary-custom/25">
                Q1 (Día 1-15)
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-card border border-app flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">
                  Quincena 30 de {MONTH_NAMES[selectedMonth]}
                </span>
                <span className="text-xs text-muted mt-0.5 block">Gastos asignados:</span>
                <span className="text-lg font-black text-[#FF914D]">
                  ${formatCurrencyVE(q2Expenses)}
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-primary-custom/10 text-primary-custom border border-primary-custom/25">
                Q2 (Día 16-30)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Desktop Grid: Dynamic Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cashflow Chart */}
        {widgets.cashflowChart && (
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Flujo Mensual de Efectivo</h3>
                  <p className="text-xs text-muted">Ingresos vs Egresos por Quincena</p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 bg-card rounded-xl border border-app text-xs font-bold">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    chartType === 'area' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                  }`}
                >
                  Área
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    chartType === 'bar' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                  }`}
                >
                  Barras
                </button>
              </div>
            </div>

            <div className="h-64 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00C2C7" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#00C2C7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF914D" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#FF914D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" opacity={0.3} vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="p-3 rounded-2xl bg-surface border border-app shadow-2xl text-xs space-y-1.5">
                              <p className="font-bold text-app">{payload[0].payload.name}</p>
                              <div className="space-y-0.5">
                                <p className="text-[#00C2C7] font-bold">Ingresos: ${payload[0].value}</p>
                                <p className="text-[#FF914D] font-bold">Egresos: ${payload[1]?.value}</p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="Ingresos" stroke="#00C2C7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIngresos)" />
                    <Area type="monotone" dataKey="Egresos" stroke="#FF914D" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEgresos)" />
                  </AreaChart>
                ) : (
                  <BarChart data={cashflowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" opacity={0.3} vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="p-3 rounded-2xl bg-surface border border-app shadow-2xl text-xs space-y-1">
                              <p className="font-bold text-app">{payload[0].payload.name}</p>
                              <p className="text-[#00C2C7] font-bold">Ingresos: ${payload[0].value}</p>
                              <p className="text-[#FF914D] font-bold">Egresos: ${payload[1]?.value}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="Ingresos" fill="#00C2C7" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Egresos" fill="#FF914D" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Category Expense Donut */}
        {widgets.categoriesDonut && (
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <PieIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Distribución de Gastos</h3>
                  <p className="text-xs text-muted">Desglose por categorías en {MONTH_NAMES[selectedMonth]}</p>
                </div>
              </div>
            </div>

            {categoryExpenseData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-muted gap-2">
                <Layers className="w-8 h-8 text-muted/50" />
                <span>Sin gastos registrados para este mes</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-2">
                <div className="h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryExpenseData}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {categoryExpenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-2.5 rounded-xl bg-surface border border-app shadow-2xl text-xs space-y-0.5">
                                <span className="font-bold text-app block">{data.name}</span>
                                <span className="text-[#FF914D] font-black">${formatCurrencyVE(data.amount)}</span>
                                <span className="text-[10px] text-muted block">({data.percentage}%)</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Category Legend List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {categoryExpenseData.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs p-1.5 rounded-xl bg-card border border-app">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-app font-semibold truncate">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-app">${formatCurrencyVE(item.amount)}</span>
                        <span className="text-[10px] text-muted ml-1">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Savings and Debt Gauges */}
      {widgets.savingsDebtGauge && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Savings Progress Card */}
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Metas de Ahorro Activas</h3>
                  <p className="text-xs text-muted">{savingsGoals.filter((g) => g.status === 'active').length} planes en progreso</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('savings')}
                className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                Gestionar →
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Progreso Global:</span>
                <span className="font-bold text-emerald-400">{savingsProgressPct}% (${formatCurrencyVE(totalSavingsSaved)} / ${formatCurrencyVE(totalSavingsTarget)})</span>
              </div>
              <div className="w-full h-3 rounded-full bg-card border border-app overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#00C2C7] transition-all duration-500"
                  style={{ width: `${savingsProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Debt Progress Card */}
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FF914D]/20 text-[#FF914D] flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Control de Deudas & Cuotas</h3>
                  <p className="text-xs text-muted">{debts.filter((d) => d.status === 'active').length} deudas activas</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('debts')}
                className="text-xs font-bold text-[#FF914D] hover:underline cursor-pointer"
              >
                Ver deudas →
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Total pendiente por pagar:</span>
                <span className="font-black text-[#FF914D]">${formatCurrencyVE(totalDebtBalance)}</span>
              </div>
              <span className="text-[11px] text-muted block">
                Cuotas abonadas este mes: <strong className="text-app">${formatCurrencyVE(totalDebtPayments)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Accounts & Recent Movements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Accounts Overview Widget */}
        {widgets.accountsOverview && (
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Mis Cuentas & Fondos</h3>
                  <p className="text-xs text-muted">Balances actualizados en tiempo real</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('accounts')}
                className="text-xs font-bold text-primary-custom hover:underline cursor-pointer"
              >
                Gestionar →
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {accounts.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">Sin cuentas registradas</p>
              ) : (
                accounts.map((acc) => {
                  const txs = transactions.filter((t) => t.account_id === acc.id);
                  const inc = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                  const exp = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                  const bal = (acc.initial_balance || 0) + (inc - exp);
                  const isVES = acc.currency === 'VES';

                  return (
                    <div
                      key={acc.id}
                      className="p-2.5 rounded-2xl bg-card border border-app flex items-center justify-between hover:border-app-hover transition-all"
                    >
                      <div>
                        <span className="text-xs font-bold text-app block">{acc.name}</span>
                        <span className="text-[10px] text-muted capitalize">{acc.type} • {acc.currency}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-app">
                          {isVES ? `Bs. ${formatCurrencyVE(bal)}` : `$${formatCurrencyVE(bal)}`}
                        </span>
                        {isVES && (
                          <span className="text-[10px] text-muted block">
                            ≈ ${(bal / bcvRate).toFixed(2)} USD
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Recent Movements Widget */}
        {widgets.recentMovements && (
          <div className="p-5 rounded-3xl bg-surface border border-app shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app">Últimos Movimientos</h3>
                  <p className="text-xs text-muted">Historial del mes de {MONTH_NAMES[selectedMonth]}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('transactions')}
                className="text-xs font-bold text-primary-custom hover:underline cursor-pointer"
              >
                Ver todos →
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {monthTransactions.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">Sin movimientos este mes</p>
              ) : (
                monthTransactions.slice(0, 5).map((t) => {
                  const cat = categories.find((c) => c.id === t.category_id);
                  const isIncome = t.type === 'income';

                  return (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-2xl bg-card border border-app flex items-center justify-between hover:border-app-hover transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: cat?.color || '#00C2C7' }}
                        >
                          <CategoryIcon iconName={cat?.icon || 'DollarSign'} className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-app block">{t.description}</span>
                          <span className="text-[10px] text-muted">{t.transaction_date} • {cat?.name || 'General'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-black ${isIncome ? 'text-[#00C2C7]' : 'text-[#FF914D]'}`}>
                          {isIncome ? `+$${formatCurrencyVE(t.amount)}` : `-$${formatCurrencyVE(t.amount)}`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* MODAL 1: PERSONALIZAR DASHBOARD */}
      {/* ================================================================ */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary-custom" />
                <h3 className="text-base font-black text-app">Personalizar Dashboard</h3>
              </div>
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted">
              Elige los widgets que deseas ver en tu pantalla principal según tus prioridades:
            </p>

            <div className="space-y-2">
              {[
                { id: 'kpis' as const, label: 'Tarjetas de Balance & Métricas Clave', desc: 'Resumen financiero superior y total de ingresos/gastos' },
                { id: 'quincenas' as const, label: 'Resumen de Plan Quincenal (15 y 30)', desc: 'Compromisos de las quincenas del mes' },
                { id: 'cashflowChart' as const, label: 'Gráfico de Flujo de Caja Mensual', desc: 'Ingresos vs Egresos por quincena en área o barra' },
                { id: 'categoriesDonut' as const, label: 'Distribución de Gastos por Categoría', desc: 'Gráfica donut interactiva con porcentajes' },
                { id: 'savingsDebtGauge' as const, label: 'Termómetro de Ahorros & Deudas', desc: 'Barras de progreso en metas y saldo de deudas' },
                { id: 'accountsOverview' as const, label: 'Mis Cuentas & Fondos', desc: 'Balances en efectivo, bancos y billeteras' },
                { id: 'recentMovements' as const, label: 'Últimos Movimientos', desc: 'Lista rápida de transacciones del mes' },
              ].map((item) => {
                const isActive = widgets[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleWidget(item.id)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isActive ? 'bg-card border-primary-custom/60 ring-1 ring-primary-custom shadow-sm' : 'bg-card/40 border-app text-muted'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-app block">{item.label}</span>
                      <span className="text-[10px] text-muted">{item.desc}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2 ${
                      isActive ? 'bg-primary-custom text-white' : 'border border-app'
                    }`}>
                      {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-app">
              <button
                type="button"
                onClick={resetWidgets}
                className="px-3 py-2 rounded-xl bg-card hover:bg-surface border border-app text-xs font-bold text-muted hover:text-app cursor-pointer"
              >
                Restablecer Todo
              </button>
              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-primary-custom text-white text-xs font-black shadow-md cursor-pointer"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODAL 2: VISTA PREVIA Y EXPORTACIÓN EJECUTIVA PDF */}
      {/* ================================================================ */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface border border-app rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary-custom" />
                <h3 className="text-base font-black text-app">
                  Reporte Financiero Ejecutivo ({MONTH_NAMES[selectedMonth]} {selectedYear})
                </h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Report Sheet */}
            <div id="printable-report" className="p-6 rounded-2xl bg-card border border-app text-app space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-app pb-4">
                <div>
                  <h1 className="text-xl font-black text-primary-custom tracking-tight">LANITAPP</h1>
                  <p className="text-xs text-muted">Informe Mensual de Gestión Financiera</p>
                </div>
                <div className="text-right text-xs">
                  <span className="font-bold text-app block">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
                  <span className="text-[10px] text-muted">Emitido: {new Date().toLocaleDateString('es-VE')}</span>
                </div>
              </div>

              {/* KPI Summary Table */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-surface border border-app">
                  <span className="text-[10px] text-muted uppercase font-bold block">Total Ingresos</span>
                  <span className="text-base font-black text-[#00C2C7]">+${formatCurrencyVE(totalIncome)}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-app">
                  <span className="text-[10px] text-muted uppercase font-bold block">Total Egresos</span>
                  <span className="text-base font-black text-[#FF914D]">-${formatCurrencyVE(totalExpense)}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-app">
                  <span className="text-[10px] text-muted uppercase font-bold block">Balance Neto</span>
                  <span className="text-base font-black text-app">${formatCurrencyVE(netBalance)}</span>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-muted text-[11px]">Resumen de Distribución</h4>
                <div className="divide-y divide-app border border-app rounded-xl overflow-hidden">
                  <div className="flex justify-between p-2 bg-surface">
                    <span>Gastos Fijos Programados:</span>
                    <strong className="text-app">${formatCurrencyVE(totalFixedExpenses)}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface">
                    <span>Abonos a Deudas del Mes:</span>
                    <strong className="text-app">${formatCurrencyVE(totalDebtPayments)}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface">
                    <span>Aportes a Fondos de Ahorro:</span>
                    <strong className="text-app">${formatCurrencyVE(totalSavingsContributions)}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface">
                    <span>Tasa BCV Referencial:</span>
                    <strong className="text-app">Bs. {formatCurrencyVE(bcvRate)}</strong>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted text-center pt-2">
                Generado automáticamente por LanitApp • Sistema de Control Financiero Inteligente
              </p>
            </div>

            {/* Actions */}
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
                onClick={handlePrintReport}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-custom text-white text-xs font-black shadow-lg cursor-pointer hover:opacity-95"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Guardar en PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
