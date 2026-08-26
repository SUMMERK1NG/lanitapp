import React, { useState } from 'react';
import { X, ArrowRightLeft, Check, Copy, TrendingUp } from 'lucide-react';
import type { ExchangeRatesData } from '../types/index.ts';
import { formatCurrencyVE } from '../utils/numberFormat.ts';
import { MoneyInput } from './ui/MoneyInput.tsx';

interface CurrencyConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: ExchangeRatesData;
}

export const CurrencyConverterModal: React.FC<CurrencyConverterModalProps> = ({
  isOpen,
  onClose,
  rates,
}) => {
  const [amount, setAmount] = useState<number>(100);
  const [fromCurrency, setFromCurrency] = useState<'USD' | 'EUR' | 'VES'>('USD');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = amount;
  const bcvUsd = rates.bcvDollar > 0 ? rates.bcvDollar : 1;
  const parallelUsd = rates.parallelDollar > 0 ? rates.parallelDollar : bcvUsd;
  const bcvEur = rates.bcvEuro > 0 ? rates.bcvEuro : 1;

  // Simultaneous conversion calculations with exact formulas
  let results: {
    key: string;
    label: string;
    badge: string;
    badgeColor: string;
    amountFormatted: string;
    subtext: string;
  }[] = [];

  if (fromCurrency === 'USD') {
    const vesBcv = numAmount * bcvUsd;
    const vesPar = numAmount * parallelUsd;
    const eurBcv = (numAmount * bcvUsd) / bcvEur;

    results = [
      {
        key: 'ves_bcv',
        label: 'Bolívares Oficial BCV',
        badge: 'Oficial BCV',
        badgeColor: 'bg-[#147df0]/20 text-[#147df0] border-[#147df0]/40',
        amountFormatted: `Bs. ${formatCurrencyVE(vesBcv)}`,
        subtext: `Tasa Oficial BCV: Bs. ${formatCurrencyVE(bcvUsd)}`,
      },
      {
        key: 'ves_par',
        label: 'Bolívares Promedio',
        badge: 'Promedio / Cash',
        badgeColor: 'bg-[#FF914D]/20 text-[#FF914D] border-[#FF914D]/40',
        amountFormatted: `Bs. ${formatCurrencyVE(vesPar)}`,
        subtext: `Tasa Promedio: Bs. ${formatCurrencyVE(parallelUsd)}`,
      },
      {
        key: 'eur_bcv',
        label: 'Euros Equivalentes',
        badge: 'Euro BCV',
        badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
        amountFormatted: `€ ${formatCurrencyVE(eurBcv)}`,
        subtext: `Tasa Euro BCV: Bs. ${formatCurrencyVE(bcvEur)}`,
      },
    ];
  } else if (fromCurrency === 'VES') {
    const usdBcv = numAmount / bcvUsd;
    const usdPar = numAmount / parallelUsd;
    const eurBcv = numAmount / bcvEur;

    results = [
      {
        key: 'usd_bcv',
        label: 'Dólares Oficial BCV',
        badge: 'Oficial BCV',
        badgeColor: 'bg-[#147df0]/20 text-[#147df0] border-[#147df0]/40',
        amountFormatted: `$ ${formatCurrencyVE(usdBcv)}`,
        subtext: `Tasa Oficial BCV: Bs. ${formatCurrencyVE(bcvUsd)}`,
      },
      {
        key: 'usd_par',
        label: 'Dólares Promedio',
        badge: 'Promedio / Cash',
        badgeColor: 'bg-[#FF914D]/20 text-[#FF914D] border-[#FF914D]/40',
        amountFormatted: `$ ${formatCurrencyVE(usdPar)}`,
        subtext: `Tasa Promedio: Bs. ${formatCurrencyVE(parallelUsd)}`,
      },
      {
        key: 'eur_bcv',
        label: 'Euros Oficial BCV',
        badge: 'Euro BCV',
        badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
        amountFormatted: `€ ${formatCurrencyVE(eurBcv)}`,
        subtext: `Tasa Euro BCV: Bs. ${formatCurrencyVE(bcvEur)}`,
      },
    ];
  } else {
    // fromCurrency === 'EUR'
    const vesBcv = numAmount * bcvEur;
    const usdBcv = (numAmount * bcvEur) / bcvUsd;
    const vesPar = usdBcv * parallelUsd;

    results = [
      {
        key: 'ves_bcv',
        label: 'Bolívares Oficial BCV',
        badge: 'Oficial BCV',
        badgeColor: 'bg-[#147df0]/20 text-[#147df0] border-[#147df0]/40',
        amountFormatted: `Bs. ${formatCurrencyVE(vesBcv)}`,
        subtext: `Tasa Euro BCV: Bs. ${formatCurrencyVE(bcvEur)}`,
      },
      {
        key: 'ves_par',
        label: 'Bolívares Promedio',
        badge: 'Promedio / Cash',
        badgeColor: 'bg-[#FF914D]/20 text-[#FF914D] border-[#FF914D]/40',
        amountFormatted: `Bs. ${formatCurrencyVE(vesPar)}`,
        subtext: `Tasa Promedio: Bs. ${formatCurrencyVE(parallelUsd)} / USD`,
      },
      {
        key: 'usd_bcv',
        label: 'Dólares Equivalentes',
        badge: 'Dólar BCV',
        badgeColor: 'bg-[#00c2c7]/20 text-[#00c2c7] border-[#00c2c7]/40',
        amountFormatted: `$ ${formatCurrencyVE(usdBcv)}`,
        subtext: `Tasa Dólar BCV: Bs. ${formatCurrencyVE(bcvUsd)}`,
      },
    ];
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-custom to-[#00c2c7] flex items-center justify-center text-white font-bold">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app">Conversor Integral de Divisas</h3>
              <p className="text-[11px] text-muted">Comparativa simultánea BCV & Promedio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Rates Quick Reference Badges */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2 rounded-xl bg-card border border-app text-center">
            <span className="text-[10px] text-muted font-bold block leading-tight">Dólar BCV</span>
            <span className="text-xs font-black text-[#147df0]">Bs. {bcvUsd.toFixed(2)}</span>
          </div>
          <div className="p-2 rounded-xl bg-card border border-app text-center">
            <span className="text-[10px] text-muted font-bold block leading-tight">Promedio</span>
            <span className="text-xs font-black text-[#FF914D]">Bs. {parallelUsd.toFixed(2)}</span>
          </div>
          <div className="p-2 rounded-xl bg-card border border-app text-center">
            <span className="text-[10px] text-muted font-bold block leading-tight">Euro BCV</span>
            <span className="text-xs font-black text-purple-400">Bs. {bcvEur.toFixed(2)}</span>
          </div>
        </div>

        {/* Amount Input with Fluid Dynamic Formatting and Currency Selector */}
        <div className="mb-4 space-y-1.5">
          <label className="block text-xs font-semibold text-muted">
            Monto a Convertir
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <MoneyInput
                value={amount}
                onChange={setAmount}
                currencySymbol={fromCurrency === 'VES' ? 'Bs' : fromCurrency === 'EUR' ? '€' : '$'}
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="flex bg-card border border-app rounded-2xl p-1 shrink-0">
              {(['USD', 'VES', 'EUR'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setFromCurrency(curr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    fromCurrency === curr
                      ? 'bg-primary-custom text-white shadow-sm'
                      : 'text-muted hover:text-app'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Real-time Simultaneous Converted Results Cards */}
        <div className="space-y-2.5 mb-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">
              Resultados Simultáneos
            </label>
            <span className="text-[10px] text-muted">Haz clic para copiar</span>
          </div>

          {results.map((res) => {
            const isCopied = copiedKey === res.key;
            return (
              <div
                key={res.key}
                className="flex items-center justify-between p-3 rounded-2xl bg-card border border-app hover:border-primary-custom/50 transition-all shadow-sm group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-app">{res.label}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${res.badgeColor}`}>
                      {res.badge}
                    </span>
                  </div>
                  <p className="text-base sm:text-lg font-black text-app">
                    {res.amountFormatted}
                  </p>
                  <span className="text-[10px] text-muted block">
                    {res.subtext}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(res.amountFormatted, res.key)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-surface hover:bg-surface-hover text-muted hover:text-app border-app'
                  }`}
                  title="Copiar resultado"
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info & close button */}
        <div className="flex items-center justify-between text-xs pt-3 border-t border-app">
          <div className="flex items-center gap-1.5 text-muted">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF914D]" />
            <span>Brecha cambiaria: <strong className="text-[#FF914D] font-bold">+{rates.spreadPercentage}%</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary-custom hover:opacity-95 text-white font-bold transition-all cursor-pointer shadow-md"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
