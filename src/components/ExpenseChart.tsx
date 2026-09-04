import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { PieChart as PieIcon, BarChart2, Inbox } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon.tsx';

interface CategoryExpenseData {
  category_id: string;
  category_name: string;
  amount: number;
  color: string;
  icon: string;
  percentage: number;
}

interface ExpenseChartProps {
  data: CategoryExpenseData[];
  currency?: string;
}

export const ExpenseChart: React.FC<ExpenseChartProps> = ({
  data,
  currency = '$',
}) => {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#203657] border border-[#2a4365] rounded-3xl p-6 text-center text-[#9ba3af]">
        <div className="w-12 h-12 rounded-2xl bg-[#1c2e4a] flex items-center justify-center mx-auto mb-3 text-[#9ba3af]">
          <Inbox className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-white">Sin gastos registrados en este período</p>
        <p className="text-xs text-[#9ba3af] mt-1">Registra tu primer movimiento con el botón (+)</p>
      </div>
    );
  }

  const chartData = data.map(item => ({
    name: item.category_name,
    value: item.amount,
    color: item.color,
    icon: item.icon,
    percentage: item.percentage,
  }));

  return (
    <div className="bg-[#203657] border border-[#2a4365] rounded-3xl p-5 shadow-md">
      {/* Header with chart switcher */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Distribución de Gastos</h3>
          <p className="text-xs text-[#9ba3af]">Por categoría</p>
        </div>

        <div className="flex items-center p-1 bg-[#1c2e4a] rounded-xl border border-[#2a4365]">
          <button
            onClick={() => setChartType('donut')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              chartType === 'donut'
                ? 'bg-[#147df0] text-white shadow-sm'
                : 'text-[#9ba3af] hover:text-white'
            }`}
            title="Gráfica de dona"
          >
            <PieIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              chartType === 'bar'
                ? 'bg-[#147df0] text-white shadow-sm'
                : 'text-[#9ba3af] hover:text-white'
            }`}
            title="Gráfica de barras"
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart visualization */}
      <div className="h-56 w-full flex items-center justify-center my-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'donut' ? (
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#203657" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-[#1c2e4a] text-white border border-[#2a4365] px-3 py-2 rounded-xl text-xs shadow-xl">
                        <p className="font-bold">{item.name}</p>
                        <p className="text-[#00c2c7]">
                          {currency}{item.value.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ({item.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
              <XAxis
                dataKey="name"
                stroke="#9ba3af"
                fontSize={10}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis stroke="#9ba3af" fontSize={10} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-[#1c2e4a] text-white border border-[#2a4365] px-3 py-2 rounded-xl text-xs shadow-xl">
                        <p className="font-bold">{item.name}</p>
                        <p className="text-[#00c2c7]">
                          {currency}{item.value.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ({item.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Category breakdown progress list */}
      <div className="mt-4 space-y-2.5 pt-3 border-t border-[#2a4365]">
        {data.slice(0, 5).map((item) => (
          <div key={item.category_id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] bg-primary-custom/15 text-primary-custom border border-primary-custom/25">
                  <CategoryIcon iconName={item.icon} size={12} className="w-3 h-3" />
                </div>
                <span className="text-slate-200 font-semibold">{item.category_name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold">
                  {currency}{item.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[#9ba3af] text-[11px]">({item.percentage}%)</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-[#1c2e4a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
