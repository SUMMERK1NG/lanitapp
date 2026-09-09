import React, { useState, useEffect, useRef } from 'react';
import { ArrowRightLeft, X, Sparkles } from 'lucide-react';
import { useExchangeRates } from '../../hooks/useExchangeRates.ts';
import type { ExchangeRatesData } from '../../types/index.ts';

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
  showConverter?: boolean;
  rates?: ExchangeRatesData;
}

/**
 * Evalúa expresiones aritméticas sencillas de forma segura (ej: 12.5 * 2, 50 + 15)
 */
function safeEvaluateMath(expr: string): number | null {
  // Convertir comas a puntos para cálculo decimal
  const clean = expr.replace(/,/g, '.').replace(/\s+/g, '');
  if (!clean || !/[+\-*/]/.test(clean)) return null;

  // Validar estrictamente caracteres numéricos y operadores matemáticos básicos
  if (!/^[\d+\-*/.()]+$/.test(clean)) return null;

  try {
    const fn = new Function(`"use strict"; return (${clean})`);
    const res = fn();
    if (typeof res === 'number' && Number.isFinite(res) && res >= 0) {
      return Number(res.toFixed(2));
    }
  } catch {
    return null;
  }
  return null;
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
  showConverter = true,
  rates: externalRates,
}) => {
  const { rates: hookRates } = useExchangeRates();
  const activeRates = externalRates || hookRates;

  const formatFromNumber = (num: number) => {
    if (!num && num !== 0) return '';
    if (num === 0) return '';
    return num.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const [display, setDisplay] = useState<string>(formatFromNumber(value));
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);
  const [bsInput, setBsInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar si el valor numérico cambia externamente
  useEffect(() => {
    if (value === 0 && display === '') return;
    const currentNum = parseFloat(display.replace(/\./g, '').replace(',', '.')) || 0;
    if (currentNum !== value && !/[+\-*/]/.test(display)) {
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

    // Permitir escribir operaciones matemáticas libremente (+, -, *, /)
    if (/[+\-*/]/.test(raw)) {
      setDisplay(raw);
      const computed = safeEvaluateMath(raw);
      if (computed !== null) {
        onChange(computed);
      }
      return;
    }

    // Convertir punto recién escrito a coma si no hay comas previas para admitir teclado con punto
    let clean = raw;
    if (raw.endsWith('.') && !raw.includes(',')) {
      clean = raw.slice(0, -1) + ',';
    }

    // Eliminar caracteres no permitidos en modo número estándar
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

  const handleBlur = () => {
    // Si quedó una expresión matemática pendiente por evaluar
    if (/[+\-*/]/.test(display)) {
      const computed = safeEvaluateMath(display);
      if (computed !== null) {
        onChange(computed);
        setDisplay(formatFromNumber(computed));
      } else {
        setDisplay(formatFromNumber(value));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (/[+\-*/]/.test(display)) {
        const computed = safeEvaluateMath(display);
        if (computed !== null) {
          onChange(computed);
          setDisplay(formatFromNumber(computed));
        }
      }
    }
  };

  // Conversión rápida desde Bolívares
  const handleConvertBs = (rate: number) => {
    if (!rate || rate <= 0) return;
    const cleanBs = parseFloat(bsInput.replace(/\./g, '').replace(',', '.')) || 0;
    if (cleanBs <= 0) return;

    const usdVal = Number((cleanBs / rate).toFixed(2));
    onChange(usdVal);
    setDisplay(formatFromNumber(usdVal));
    setIsConverterOpen(false);
    setBsInput('');
  };

  const handleBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setBsInput('');
      return;
    }

    let clean = raw;
    if (raw.endsWith('.') && !raw.includes(',')) {
      clean = raw.slice(0, -1) + ',';
    }

    clean = clean.replace(/\./g, '').replace(/[^0-9,]/g, '');
    const parts = clean.split(',');
    if (parts.length > 2) clean = parts[0] + ',' + parts.slice(1).join('');

    const integerDigits = parts[0];
    const formattedInt = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const finalDisplay = parts.length > 1 ? `${formattedInt},${parts[1].slice(0, 2)}` : formattedInt;
    setBsInput(finalDisplay);
  };

  const bcvRate = activeRates?.bcvDollar || 0;
  const parRate = activeRates?.parallelDollar || 0;
  const isUsd = currencySymbol === '$' || currencySymbol.toLowerCase() === 'usd';

  const eqBsBcv = isUsd && bcvRate > 0 && value > 0 ? value * bcvRate : 0;
  const eqBsPar = isUsd && parRate > 0 && value > 0 ? value * parRate : 0;

  return (
    <div className="w-full space-y-1.5">
      <div className="relative w-full group">
        {currencySymbol && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-extrabold text-lg pointer-events-none select-none transition-colors group-focus-within:text-emerald-300 z-10">
            {currencySymbol}
          </span>
        )}

        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          placeholder={placeholder}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-full bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-500/70 rounded-xl py-3 text-lg font-bold text-white placeholder:text-muted/50 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all ${
            currencySymbol ? 'pl-10' : 'pl-4'
          } ${showConverter && isUsd ? 'pr-14' : 'pr-4'} ${className}`}
        />

        {/* Botón flotante para conversor rápido de Bs */}
        {showConverter && isUsd && !disabled && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
            <button
              type="button"
              onClick={() => setIsConverterOpen(!isConverterOpen)}
              title="Convertir desde Bolívares (BCV / Paralelo) o calculadora rápida"
              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isConverterOpen
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-surface/80 hover:bg-surface text-muted hover:text-emerald-400 border border-app'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">Bs</span>
            </button>
          </div>
        )}
      </div>

      {/* Mini-Panel Desplegable de Conversión desde Bolívares */}
      {isConverterOpen && isUsd && (
        <div className="p-3 rounded-2xl bg-card border border-emerald-500/30 shadow-xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Convertir de Bolívares (Bs.) a Dólares ($)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsConverterOpen(false)}
              className="p-1 rounded-lg hover:bg-surface text-muted hover:text-app transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                Bs.
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ingresa el monto en Bolívares (ej. 850,00)"
                value={bsInput}
                onChange={handleBsChange}
                className="w-full bg-surface border border-app rounded-xl pl-10 pr-3 py-2 text-sm font-bold text-app placeholder:text-muted/40 focus:outline-none focus:border-emerald-400"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!bsInput || bcvRate <= 0}
                onClick={() => handleConvertBs(bcvRate)}
                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex flex-col items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
              >
                <span className="text-[10px] text-muted">Tasa Oficial BCV</span>
                <span className="font-extrabold text-white">{bcvRate.toLocaleString('es-VE')} Bs/$</span>
              </button>

              <button
                type="button"
                disabled={!bsInput || parRate <= 0}
                onClick={() => handleConvertBs(parRate)}
                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex flex-col items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
              >
                <span className="text-[10px] text-muted">Tasa Paralela</span>
                <span className="font-extrabold text-white">{parRate.toLocaleString('es-VE')} Bs/$</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equivalencia sutil en Bolívares en tiempo real */}
      {showConverter && isUsd && value > 0 && bcvRate > 0 && !isConverterOpen && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted font-medium">
          <span className="flex items-center gap-1">
            <span className="text-muted/70">≈ BCV:</span>
            <span className="text-emerald-400 font-bold">
              Bs. {eqBsBcv.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
          {parRate > 0 && (
            <>
              <span className="text-muted/40">·</span>
              <span className="flex items-center gap-1">
                <span className="text-muted/70">Paralelo:</span>
                <span className="text-amber-400 font-bold">
                  Bs. {eqBsPar.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
