import React, { useState, useEffect } from 'react';

export interface MoneyInputProps {
  value: number;
  onChange: (val: number) => void;
  currencySymbol?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  id?: string;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  currencySymbol = '$',
  placeholder = '0,00',
  className = '',
  disabled = false,
  autoFocus = false,
  required = false,
  id,
}) => {
  const formatFromNumber = (num: number) => {
    if (!num && num !== 0) return '';
    if (num === 0) return '';
    return num.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const [display, setDisplay] = useState<string>(formatFromNumber(value));

  useEffect(() => {
    if (value === 0 && display === '') return;
    // Sincronizar si cambia externamente
    const currentNum = parseFloat(display.replace(/\./g, '').replace(',', '.')) || 0;
    if (currentNum !== value) {
      setDisplay(formatFromNumber(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setDisplay('');
      onChange(0);
      return;
    }

    // Convertir punto recién escrito a coma si no hay comas previas para permitir ambos teclados
    let clean = raw;
    if (raw.endsWith('.') && !raw.includes(',')) {
      clean = raw.slice(0, -1) + ',';
    }

    // Eliminar caracteres no permitidos
    clean = clean.replace(/\./g, '').replace(/[^0-9,]/g, '');
    const parts = clean.split(',');
    if (parts.length > 2) clean = parts[0] + ',' + parts.slice(1).join('');

    const integerDigits = parts[0];
    const formattedInt = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const finalDisplay = parts.length > 1 ? `${formattedInt},${parts[1].slice(0, 2)}` : formattedInt;
    setDisplay(finalDisplay);

    const numStr = parts.length > 1 ? `${integerDigits}.${parts[1].slice(0, 2)}` : integerDigits;
    const parsed = parseFloat(numStr) || 0;
    onChange(parsed);
  };

  return (
    <div className="relative w-full">
      {currencySymbol && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 font-bold text-lg pointer-events-none">
          {currencySymbol}
        </span>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        autoFocus={autoFocus}
        required={required}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        className={`w-full bg-slate-900 border border-slate-700 rounded-xl py-3 text-lg font-semibold text-white focus:outline-none focus:border-orange-500 transition-all ${
          currencySymbol ? 'pl-10 pr-4' : 'px-4'
        } ${className}`}
      />
    </div>
  );
};
