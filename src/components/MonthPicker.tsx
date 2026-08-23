import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface MonthPickerProps {
  selectedYear: number;
  selectedMonth: number; // 0-11
  onChange: (year: number, month: number) => void;
  className?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MonthPicker: React.FC<MonthPickerProps> = ({
  selectedYear,
  selectedMonth,
  onChange,
  className = '',
}) => {
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedMonth === 0) {
      onChange(selectedYear - 1, 11);
    } else {
      onChange(selectedYear, selectedMonth - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedMonth === 11) {
      onChange(selectedYear + 1, 0);
    } else {
      onChange(selectedYear, selectedMonth + 1);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 bg-card border border-app rounded-2xl p-1 shadow-sm ${className}`}>
      {/* Botón Flecha Anterior */}
      <button
        type="button"
        onClick={handlePrev}
        className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-app transition-colors cursor-pointer"
        title="Mes anterior"
        aria-label="Mes anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Indicador Central Mes y Año */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-app font-bold text-xs select-none"
        title={`Periodo actual: ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
      >
        <Calendar className="w-3.5 h-3.5 text-primary-custom" />
        <span>
          {MONTH_NAMES[selectedMonth]} {selectedYear}
        </span>
      </div>

      {/* Botón Flecha Siguiente */}
      <button
        type="button"
        onClick={handleNext}
        className="p-1.5 rounded-xl hover:bg-surface text-muted hover:text-app transition-colors cursor-pointer"
        title="Mes siguiente"
        aria-label="Mes siguiente"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
