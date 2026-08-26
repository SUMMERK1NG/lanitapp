import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowUpDown,
  Check,
  Copy,
  Share2,
  RefreshCw,
  History,
  Calculator as CalcIcon,
  ArrowRightLeft,
  Delete,
} from 'lucide-react';
import type { ExchangeRatesData } from '../types/index.ts';
import { formatCurrencyVE } from '../utils/numberFormat.ts';

interface CurrencyConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: ExchangeRatesData;
  initialTab?: 'converter' | 'calculator';
}

type CurrencyType = 'USD_BCV' | 'USD_PAR' | 'EUR_BCV' | 'VES';

const CURRENCY_CONFIG: Record<
  CurrencyType,
  { label: string; symbol: string; code: string; watermark: string; color: string }
> = {
  USD_BCV: { label: 'Dólares Oficial BCV', symbol: '$', code: 'USD BCV', watermark: '$', color: '#147DF0' },
  USD_PAR: { label: 'Dólares Promedio', symbol: '$', code: 'USD Promedio', watermark: '$', color: '#FF914D' },
  EUR_BCV: { label: 'Euros Oficial BCV', symbol: '€', code: 'EUR BCV', watermark: '€', color: '#00C2C7' },
  VES: { label: 'Bolívares (Bs.)', symbol: 'Bs.', code: 'VES', watermark: 'Bs', color: '#10B981' },
};

export const CurrencyConverterModal: React.FC<CurrencyConverterModalProps> = ({
  isOpen,
  onClose,
  rates,
  initialTab = 'converter',
}) => {
  const [activeTab, setActiveTab] = useState<'converter' | 'calculator'>(initialTab);

  // --- TAB 1: CONVERSOR STATE ---
  const [fromCurrency, setFromCurrency] = useState<CurrencyType>('USD_BCV');
  const [toCurrency, setToCurrency] = useState<CurrencyType>('VES');
  const [converterAmount, setConverterAmount] = useState<string>('1');
  const [copiedField, setCopiedField] = useState<'from' | 'to' | 'all' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // --- TAB 2: CALCULADORA STATE ---
  const [calcFromCurrency, setCalcFromCurrency] = useState<CurrencyType>('USD_BCV');
  const [calcToCurrency, setCalcToCurrency] = useState<CurrencyType>('VES');
  const [calcExpression, setCalcExpression] = useState<string>('0');
  const [calcHistory, setCalcHistory] = useState<{ expr: string; result: number; converted: number; from: CurrencyType; to: CurrencyType }[]>([]);
  const [isCalcHistoryOpen, setIsCalcHistoryOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  if (!isOpen) return null;

  // Rate helpers
  const bcvUsd = rates.bcvDollar > 0 ? rates.bcvDollar : 1;
  const parUsd = rates.parallelDollar > 0 ? rates.parallelDollar : bcvUsd;
  const bcvEur = rates.bcvEuro > 0 ? rates.bcvEuro : 1;

  // Get conversion rate to VES
  const getRateInVES = (curr: CurrencyType): number => {
    switch (curr) {
      case 'USD_BCV':
        return bcvUsd;
      case 'USD_PAR':
        return parUsd;
      case 'EUR_BCV':
        return bcvEur;
      case 'VES':
        return 1;
    }
  };

  // Convert amount between any two currencies
  const convertAmount = (val: number, from: CurrencyType, to: CurrencyType): number => {
    if (isNaN(val) || val === 0) return 0;
    if (from === to) return val;
    const fromInVes = getRateInVES(from);
    const toInVes = getRateInVES(to);
    // val in VES = val * fromInVes
    // result in to = (val * fromInVes) / toInVes
    return (val * fromInVes) / toInVes;
  };

  // Parse and calculate math expression safely
  const evaluateMath = (expr: string): number => {
    try {
      // Clean expression: only digits, ., +, -, *, /
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
      if (!/^[\d\.\+\-\*\/\s\(\)]+$/.test(sanitized)) return 0;

      // Tokenize and calculate basic operations
      // Function constructor is safer than eval with regex validation
      const result = new Function(`return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result;
      }
      return 0;
    } catch {
      return 0;
    }
  };

  // Current values for Converter tab
  const parsedConverterAmount = parseFloat(converterAmount.replace(/,/g, '.')) || 0;
  const convertedResult = convertAmount(parsedConverterAmount, fromCurrency, toCurrency);

  // Current values for Calculator tab
  const calcBaseResult = evaluateMath(calcExpression);
  const calcConvertedResult = convertAmount(calcBaseResult, calcFromCurrency, calcToCurrency);

  // Handler: Swap converter currencies
  const handleSwapConverter = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  // Handler: Swap calculator currencies
  const handleSwapCalculator = () => {
    setCalcFromCurrency(calcToCurrency);
    setCalcToCurrency(calcFromCurrency);
  };

  // Copy to clipboard
  const handleCopy = (text: string, field: 'from' | 'to' | 'all') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    showToast('Copiado al portapapeles');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Share Daily Rates
  const handleShareDailyRates = async () => {
    const text = `📊 *Tasas de Cambio Oficiales - LanitApp*\n\n` +
      `🏛️ *Dólar BCV:* Bs. ${formatCurrencyVE(bcvUsd)}\n` +
      `⚡ *Dólar Promedio:* Bs. ${formatCurrencyVE(parUsd)}\n` +
      `🇪🇺 *Euro BCV:* Bs. ${formatCurrencyVE(bcvEur)}\n` +
      `📈 *Brecha Cambiaria:* +${rates.spreadPercentage}%\n\n` +
      `🕒 *Actualizado:* ${rates.lastUpdated}\n` +
      `✨ _Control financiero inteligente con LanitApp_`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tasas de Cambio LanitApp', text });
      } catch {
        handleCopy(text, 'all');
      }
    } else {
      handleCopy(text, 'all');
    }
  };

  // Calculator button presses
  const handleCalcInput = (char: string) => {
    if (char === 'C') {
      setCalcExpression('0');
    } else if (char === 'DEL') {
      if (calcExpression.length <= 1) {
        setCalcExpression('0');
      } else {
        setCalcExpression(calcExpression.slice(0, -1));
      }
    } else if (char === '=') {
      const res = evaluateMath(calcExpression);
      if (res !== 0) {
        const conv = convertAmount(res, calcFromCurrency, calcToCurrency);
        setCalcHistory((prev) => [
          { expr: calcExpression, result: res, converted: conv, from: calcFromCurrency, to: calcToCurrency },
          ...prev.slice(0, 19),
        ]);
        setCalcExpression(String(res));
      }
    } else {
      // Operators or numbers
      if (calcExpression === '0' && !['+', '-', '×', '÷', '.'].includes(char)) {
        setCalcExpression(char);
      } else {
        // Prevent duplicate operator
        const lastChar = calcExpression[calcExpression.length - 1];
        if (['+', '-', '×', '÷'].includes(lastChar) && ['+', '-', '×', '÷'].includes(char)) {
          setCalcExpression(calcExpression.slice(0, -1) + char);
        } else {
          setCalcExpression(calcExpression + char);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app max-h-[94vh] flex flex-col justify-between overflow-hidden animate-in zoom-in-95"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-app">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold text-lg">
              🧮
            </div>
            <div>
              <h2 className="text-base font-black text-app tracking-tight">
                Centro de Divisas & Tasas
              </h2>
              <p className="text-[11px] text-muted">Conversor instantáneo, calculadora y análisis histórico</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-card text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Tabs Navigator */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-card rounded-2xl border border-app my-3">
          <button
            onClick={() => setActiveTab('converter')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'converter'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Conversor</span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-primary-custom text-white shadow-md'
                : 'text-muted hover:text-app'
            }`}
          >
            <CalcIcon className="w-4 h-4" />
            <span>Calculadora</span>
          </button>
        </div>

        {/* Content Body with scrolling */}
        <div className="flex-1 overflow-y-auto pr-0.5 space-y-3">
          {/* ======================================================== */}
          {/* TAB 1: CONVERSOR SIMULTÁNEO (MODELO SCREENSHOT 2) */}
          {/* ======================================================== */}
          {activeTab === 'converter' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Quick Rate Switcher Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <span className="text-[10px] uppercase font-bold text-muted shrink-0 mr-1">Tasa Rápida:</span>
                {[
                  { id: 'USD_BCV', label: 'USD Oficial', rate: bcvUsd, color: '#147DF0' },
                  { id: 'USD_PAR', label: 'USD Promedio', rate: parUsd, color: '#FF914D' },
                  { id: 'EUR_BCV', label: 'EUR Oficial', rate: bcvEur, color: '#00C2C7' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFromCurrency(item.id as CurrencyType);
                      setToCurrency('VES');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                      fromCurrency === item.id && toCurrency === 'VES'
                        ? 'border-primary-custom bg-card text-app ring-2 ring-primary-custom shadow-sm'
                        : 'border-app bg-card/60 text-muted hover:text-app'
                    }`}
                  >
                    <span style={{ color: item.color }}>{item.label}</span>
                    <span className="text-[10px] text-muted ml-1.5 font-normal">({item.rate.toFixed(2)})</span>
                  </button>
                ))}
              </div>

              {/* Card 1: From Currency */}
              <div className="relative p-4 rounded-3xl bg-card border border-app space-y-2 overflow-hidden">
                {/* Watermark symbol in background */}
                <div className="absolute right-4 bottom-2 text-7xl font-black text-muted/10 pointer-events-none select-none">
                  {CURRENCY_CONFIG[fromCurrency].watermark}
                </div>

                <div className="flex items-center justify-between relative z-10">
                  {/* Currency Selector */}
                  <div className="flex items-center gap-2">
                    <select
                      value={fromCurrency}
                      onChange={(e) => setFromCurrency(e.target.value as CurrencyType)}
                      className="bg-surface border border-app text-xs font-bold text-app rounded-xl px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                    >
                      <option value="USD_BCV">DÓLARES (USD BCV)</option>
                      <option value="USD_PAR">DÓLARES (PROMEDIO)</option>
                      <option value="EUR_BCV">EUROS (EUR BCV)</option>
                      <option value="VES">BOLÍVARES (BS)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(converterAmount, 'from')}
                      className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-app transition-colors cursor-pointer"
                      title="Copiar monto"
                    >
                      {copiedField === 'from' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="relative z-10">
                  <input
                    type="number"
                    step="any"
                    value={converterAmount}
                    onChange={(e) => setConverterAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-3xl sm:text-4xl font-black text-app focus:outline-none tracking-tight"
                  />
                  <span className="text-xs text-muted block mt-1">
                    1 {CURRENCY_CONFIG[fromCurrency].code} ≈ Bs. {getRateInVES(fromCurrency).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Floating Swap Button */}
              <div className="flex justify-center -my-3 relative z-20">
                <button
                  type="button"
                  onClick={handleSwapConverter}
                  className="w-11 h-11 rounded-full bg-primary-custom text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-surface"
                  title="Intercambiar divisas"
                >
                  <ArrowUpDown className="w-5 h-5" />
                </button>
              </div>

              {/* Card 2: To Currency (Result) */}
              <div className="relative p-4 rounded-3xl bg-card border border-app space-y-2 overflow-hidden">
                {/* Watermark symbol in background */}
                <div className="absolute right-4 bottom-2 text-7xl font-black text-muted/10 pointer-events-none select-none">
                  {CURRENCY_CONFIG[toCurrency].watermark}
                </div>

                <div className="flex items-center justify-between relative z-10">
                  {/* Currency Selector */}
                  <div className="flex items-center gap-2">
                    <select
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value as CurrencyType)}
                      className="bg-surface border border-app text-xs font-bold text-app rounded-xl px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-custom"
                    >
                      <option value="VES">BOLÍVARES (BS)</option>
                      <option value="USD_BCV">DÓLARES (USD BCV)</option>
                      <option value="USD_PAR">DÓLARES (PROMEDIO)</option>
                      <option value="EUR_BCV">EUROS (EUR BCV)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(formatCurrencyVE(convertedResult), 'to')}
                      className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-app transition-colors cursor-pointer"
                      title="Copiar resultado"
                    >
                      {copiedField === 'to' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Amount Output */}
                <div className="relative z-10">
                  <div className="text-3xl sm:text-4xl font-black text-[#00C2C7] tracking-tight">
                    {formatCurrencyVE(convertedResult)}
                  </div>
                  <span className="text-xs text-muted block mt-1">
                    Tasa de cambio aplicada: 1 {CURRENCY_CONFIG[fromCurrency].code} = {formatCurrencyVE(convertAmount(1, fromCurrency, toCurrency))} {CURRENCY_CONFIG[toCurrency].code}
                  </span>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 justify-between">
                <button
                  type="button"
                  onClick={handleShareDailyRates}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-card border border-app hover:border-app-hover text-xs font-bold text-app transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-primary-custom" />
                  <span>Compartir las tasas del día</span>
                </button>

                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <RefreshCw className="w-3.5 h-3.5 text-primary-custom" />
                  <span>Actualizado: {rates.lastUpdated}</span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CALCULADORA TÁCTIL SIMULTÁNEA (MODELO SCREENSHOT 3) */}
          {/* ======================================================== */}
          {activeTab === 'calculator' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Currency conversion bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-between p-2 rounded-2xl bg-card border border-app">
                  <span className="text-[10px] uppercase font-bold text-muted">Desde</span>
                  <select
                    value={calcFromCurrency}
                    onChange={(e) => setCalcFromCurrency(e.target.value as CurrencyType)}
                    className="bg-surface text-xs font-bold text-app rounded-lg px-2 py-0.5 border border-app cursor-pointer"
                  >
                    <option value="USD_BCV">USD BCV</option>
                    <option value="USD_PAR">USD Promedio</option>
                    <option value="EUR_BCV">EUR BCV</option>
                    <option value="VES">VES (Bs.)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSwapCalculator}
                  className="w-8 h-8 rounded-xl bg-card hover:bg-surface border border-app text-primary-custom flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
                  title="Intercambiar divisas"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1 flex items-center justify-between p-2 rounded-2xl bg-card border border-app">
                  <span className="text-[10px] uppercase font-bold text-muted">A</span>
                  <select
                    value={calcToCurrency}
                    onChange={(e) => setCalcToCurrency(e.target.value as CurrencyType)}
                    className="bg-surface text-xs font-bold text-app rounded-lg px-2 py-0.5 border border-app cursor-pointer"
                  >
                    <option value="VES">VES (Bs.)</option>
                    <option value="USD_BCV">USD BCV</option>
                    <option value="USD_PAR">USD Promedio</option>
                    <option value="EUR_BCV">EUR BCV</option>
                  </select>
                </div>
              </div>

              {/* Display 1: Math Expression & Input */}
              <div className="relative p-3.5 rounded-2xl bg-card border border-app overflow-hidden">
                <div className="absolute right-3 top-1 text-5xl font-black text-muted/10 pointer-events-none select-none">
                  {CURRENCY_CONFIG[calcFromCurrency].watermark}
                </div>
                <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                  Operación en {CURRENCY_CONFIG[calcFromCurrency].label}
                </span>
                <div className="text-2xl sm:text-3xl font-black text-app tracking-tight font-mono overflow-x-auto no-scrollbar">
                  {calcExpression}
                </div>
              </div>

              {/* Display 2: Live Converted Output Screen */}
              <div className="relative p-3.5 rounded-2xl bg-card border-2 border-[#00C2C7]/60 shadow-lg overflow-hidden">
                <div className="absolute right-3 top-1 text-5xl font-black text-[#00C2C7]/10 pointer-events-none select-none">
                  {CURRENCY_CONFIG[calcToCurrency].watermark}
                </div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] uppercase font-black text-[#00C2C7] tracking-wider">
                    Convertir a {CURRENCY_CONFIG[calcToCurrency].code}
                  </span>
                  <span className="text-[10px] font-bold text-muted">
                    = {CURRENCY_CONFIG[calcToCurrency].symbol}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#00C2C7] tracking-tight font-mono">
                  {formatCurrencyVE(calcConvertedResult)}
                </div>
              </div>

              {/* Calculator Keypad */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={() => handleCalcInput('C')}
                  className="py-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-black text-base transition-all cursor-pointer"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('DEL')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-muted hover:text-app flex items-center justify-center font-bold transition-all cursor-pointer"
                >
                  <Delete className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('÷')}
                  className="py-3 rounded-2xl bg-primary-custom/20 hover:bg-primary-custom/30 text-primary-custom font-black text-xl transition-all cursor-pointer"
                >
                  ÷
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('×')}
                  className="py-3 rounded-2xl bg-primary-custom/20 hover:bg-primary-custom/30 text-primary-custom font-black text-xl transition-all cursor-pointer"
                >
                  ×
                </button>

                {/* Row 2 */}
                <button
                  type="button"
                  onClick={() => handleCalcInput('7')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('8')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('9')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('-')}
                  className="py-3 rounded-2xl bg-primary-custom/20 hover:bg-primary-custom/30 text-primary-custom font-black text-xl transition-all cursor-pointer"
                >
                  -
                </button>

                {/* Row 3 */}
                <button
                  type="button"
                  onClick={() => handleCalcInput('4')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('5')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('6')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('+')}
                  className="py-3 rounded-2xl bg-primary-custom/20 hover:bg-primary-custom/30 text-primary-custom font-black text-xl transition-all cursor-pointer"
                >
                  +
                </button>

                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => handleCalcInput('1')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('2')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('3')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('=')}
                  className="row-span-2 py-3 rounded-2xl bg-primary-custom hover:opacity-95 text-white font-black text-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center"
                >
                  =
                </button>

                {/* Row 5 */}
                <button
                  type="button"
                  onClick={() => handleCalcInput('0')}
                  className="col-span-2 py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleCalcInput('.')}
                  className="py-3 rounded-2xl bg-card hover:bg-surface border border-app text-app font-bold text-lg transition-all cursor-pointer"
                >
                  .
                </button>
              </div>

              {/* History Button & Drawer Toggle */}
              {calcHistory.length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCalcHistoryOpen(!isCalcHistoryOpen)}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-card border border-app text-xs font-bold text-muted hover:text-app cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-primary-custom" />
                      <span>Cálculos Recientes ({calcHistory.length})</span>
                    </div>
                    <span>{isCalcHistoryOpen ? 'Ocultar' : 'Ver'}</span>
                  </button>

                  {isCalcHistoryOpen && (
                    <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto p-1 animate-in fade-in">
                      {calcHistory.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setCalcExpression(String(item.result))}
                          className="p-2 rounded-xl bg-card hover:bg-card/80 border border-app flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span className="font-mono text-muted">{item.expr} = <strong className="text-app">{item.result}</strong></span>
                          <span className="font-bold text-[#00C2C7]">≈ {formatCurrencyVE(item.converted)} {CURRENCY_CONFIG[item.to].symbol}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-emerald-500 text-white text-xs font-black shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
};
