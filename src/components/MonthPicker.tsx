import React, { useState } from 'react';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

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
    <div className={`relative inline-flex items-center gap-1 bg-card border border-app rounded-2xl p-1 shadow-sm ${className}`}>
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

      {/* Botón Central Mes y Año (abre dropdown) */}
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-app hover:bg-surface transition-colors cursor-pointer font-bold text-xs select-none"
        title="Haz clic para seleccionar mes y año"
      >
        <Calendar className="w-3.5 h-3.5 text-primary-custom" />
        <span>
          {MONTH_NAMES[selectedMonth]} {selectedYear}
        </span>
      </button>

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

      {/* Dropdown flotante con Grid de 12 Meses y Selector de Año */}
      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150">
            {/* Selector de Año */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(Math.max(2020, selectedYear - 1), selectedMonth);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Año anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-white">{selectedYear}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(selectedYear + 1, selectedMonth);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Año siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Grid de 12 Meses */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_NAMES.map((month, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedYear, idx);
                    setIsDropdownOpen(false);
                  }}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    selectedMonth === idx
                      ? 'bg-primary-custom text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {month.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
