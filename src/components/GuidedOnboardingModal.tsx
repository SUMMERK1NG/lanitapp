import React, { useState } from 'react';
import {
  Sparkles,
  Wallet,
  Receipt,
  CreditCard,
  CheckCircle2,
  Building2,
  ChevronRight,
  ChevronLeft,
  PartyPopper,
} from 'lucide-react';
import { MoneyInput } from './ui/MoneyInput.tsx';
import type { ExchangeRatesData } from '../types/index.ts';
import { useFinanceStore } from '../stores/useFinanceStore.ts';
import { logger } from '../utils/logger.ts';

export interface GuidedOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  rates: ExchangeRatesData;
}

export const GuidedOnboardingModal: React.FC<GuidedOnboardingModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  rates,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Paso 1: Ingreso Principal
  const [incomeName, setIncomeName] = useState<string>('Sueldo Principal');
  const [incomeAmount, setIncomeAmount] = useState<number>(300);
  const [incomeFortnight, setIncomeFortnight] = useState<'both' | 'q1' | 'q2' | 'split'>('split');

  // Paso 2: Gastos Fijos Clave
  const [expense1Name, setExpense1Name] = useState<string>('Alquiler / Vivienda');
  const [expense1Amount, setExpense1Amount] = useState<number>(80);
  const [expense1Fortnight, setExpense1Fortnight] = useState<'q1' | 'q2' | 'both'>('q1');

  const [expense2Name, setExpense2Name] = useState<string>('Internet y Servicios');
  const [expense2Amount, setExpense2Amount] = useState<number>(30);
  const [expense2Fortnight, setExpense2Fortnight] = useState<'q1' | 'q2' | 'both'>('q2');

  const [expense3Name, setExpense3Name] = useState<string>('Mercado / Comida Quincenal');
  const [expense3Amount, setExpense3Amount] = useState<number>(50);
  const [expense3Fortnight, setExpense3Fortnight] = useState<'q1' | 'q2' | 'both'>('both');

  // Paso 3: Deudas Activas
  const [hasDebt, setHasDebt] = useState<boolean>(false);
  const [debtCreditor, setDebtCreditor] = useState<string>('Cashea');
  const [debtInstallment, setDebtInstallment] = useState<number>(25);
  const [debtTotal, setDebtTotal] = useState<number>(75);
  const [debtFortnight, setDebtFortnight] = useState<'both' | 'q1' | 'q2'>('both');

  // Paso 4: Cuenta o Billetera Inicial
  const [accountName, setAccountName] = useState<string>('Efectivo USD');
  const [accountBalance, setAccountBalance] = useState<number>(50);

  const { saveFixedIncome, saveFixedExpense, saveDebt, saveAccount, loadFromLocalCache } = useFinanceStore();

  if (!isOpen) return null;

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      // 1. Guardar Cuenta Inicial
      if (accountName.trim()) {
        await saveAccount({
          name: accountName.trim(),
          type: 'cash',
          currency: 'USD',
          initial_balance: Number(accountBalance) || 0,
        }, userId);
      }

      // 2. Guardar Ingreso Principal
      if (incomeAmount > 0) {
        await saveFixedIncome({
          name: incomeName.trim() || 'Sueldo Principal',
          amount: Number(incomeAmount),
          currency: 'USD',
          default_fortnight: incomeFortnight as any,
          category_id: '',
          is_active: true,
        }, userId);
      }

      // 3. Guardar Gastos Fijos
      if (expense1Amount > 0 && expense1Name.trim()) {
        await saveFixedExpense({
          name: expense1Name.trim(),
          amount: Number(expense1Amount),
          default_fortnight: expense1Fortnight,
          currency: 'USD',
          category_id: '',
          is_active: true,
        }, userId);
      }

      if (expense2Amount > 0 && expense2Name.trim()) {
        await saveFixedExpense({
          name: expense2Name.trim(),
          amount: Number(expense2Amount),
          default_fortnight: expense2Fortnight,
          currency: 'USD',
          category_id: '',
          is_active: true,
        }, userId);
      }

      if (expense3Amount > 0 && expense3Name.trim()) {
        await saveFixedExpense({
          name: expense3Name.trim(),
          amount: Number(expense3Amount),
          default_fortnight: expense3Fortnight,
          currency: 'USD',
          category_id: '',
          is_active: true,
        }, userId);
      }

      // 4. Guardar Deuda si aplica
      if (hasDebt && debtInstallment > 0) {
        await saveDebt({
          creditor: debtCreditor.trim() || 'Deuda Inicial',
          total_amount: Number(debtTotal) || Number(debtInstallment),
          installment_amount: Number(debtInstallment),
          current_balance: Number(debtTotal) || Number(debtInstallment),
          debt_mode: 'installments',
          payment_type: 'cash',
          platform: 'cashea',
          currency: 'USD',
          fortnight_due: debtFortnight,
          status: 'active',
        }, userId);
      }

      // Marcar onboarding como completado
      localStorage.setItem(`lanitapp_onboarding_completed_${userId}`, 'true');
      await loadFromLocalCache(userId);
      onClose();
    } catch (err) {
      logger.error('Error completando onboarding guiado:', err);
      try {
        sessionStorage.setItem(`lanitapp_onboarding_skipped_${userId}`, 'true');
      } catch {}
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    try {
      sessionStorage.setItem(`lanitapp_onboarding_skipped_${userId}`, 'true');
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-lg bg-surface border border-app rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 sm:space-y-6 relative my-auto max-h-[92vh] flex flex-col justify-between overflow-y-auto">
        {/* Cabecera del Wizard */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-app">
                ¡Bienvenido a LANITAPP{userName ? `, ${userName}` : ''}!
              </h2>
              <p className="text-xs text-muted">Configuración rápida en 2 minutos (Paso {step} de 4)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-bold text-muted hover:text-app p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            Omitir
          </button>
        </div>

        {/* Barra de Progreso del Wizard */}
        <div className="w-full h-1.5 bg-card rounded-full overflow-hidden flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-full flex-1 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-primary-custom' : 'bg-surface border border-app/60'
              }`}
            />
          ))}
        </div>

        {/* PASO 1: Ingreso Principal */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-app flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                1. ¿Cuánto cobras aproximadamente al mes o quincena?
              </h3>
              <p className="text-xs text-muted">
                Tu ingreso base servirá para calcular el dinero libre real de cada quincena.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre del Ingreso
                </label>
                <input
                  type="text"
                  value={incomeName}
                  onChange={(e) => setIncomeName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3.5 py-2.5 text-sm font-bold text-app focus:outline-none focus:border-primary-custom"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Monto Total en Dólares ($)
                </label>
                <MoneyInput
                  value={incomeAmount}
                  onChange={setIncomeAmount}
                  currencySymbol="$"
                  rates={rates}
                  showConverter={true}
                  className="!text-xl !font-black !bg-card"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  ¿Cómo lo cobras?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setIncomeFortnight('split')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                      incomeFortnight === 'split'
                        ? 'bg-primary-custom text-white border-primary-custom shadow-sm'
                        : 'bg-card border-app text-muted hover:text-app'
                    }`}
                  >
                    50% cada quincena (15 y 30)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomeFortnight('q1')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                      incomeFortnight === 'q1'
                        ? 'bg-primary-custom text-white border-primary-custom shadow-sm'
                        : 'bg-card border-app text-muted hover:text-app'
                    }`}
                  >
                    Solo Quincena 15
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomeFortnight('q2')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                      incomeFortnight === 'q2'
                        ? 'bg-primary-custom text-white border-primary-custom shadow-sm'
                        : 'bg-card border-app text-muted hover:text-app'
                    }`}
                  >
                    Solo Quincena 30
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: Gastos Fijos Clave */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-app flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-amber-400" />
                2. Tus 3 principales compromisos fijos
              </h3>
              <p className="text-xs text-muted">
                Aquellos pagos indispensables del mes que no puedes dejar de cubrir.
              </p>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {/* Gasto 1 */}
              <div className="p-3 rounded-2xl bg-card border border-app space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={expense1Name}
                    onChange={(e) => setExpense1Name(e.target.value)}
                    className="bg-transparent text-xs font-bold text-app focus:outline-none border-b border-transparent focus:border-app flex-1"
                  />
                  <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-app shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpense1Fortnight('q1')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense1Fortnight === 'q1' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Q1
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpense1Fortnight('q2')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense1Fortnight === 'q2' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Q2
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpense1Fortnight('both')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense1Fortnight === 'both' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Ambas
                    </button>
                  </div>
                </div>
                <MoneyInput
                  value={expense1Amount}
                  onChange={setExpense1Amount}
                  currencySymbol="$"
                  rates={rates}
                  showConverter={false}
                  className="!py-2 !text-base !bg-surface"
                />
              </div>

              {/* Gasto 2 */}
              <div className="p-3 rounded-2xl bg-card border border-app space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={expense2Name}
                    onChange={(e) => setExpense2Name(e.target.value)}
                    className="bg-transparent text-xs font-bold text-app focus:outline-none border-b border-transparent focus:border-app flex-1"
                  />
                  <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-app shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpense2Fortnight('q1')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense2Fortnight === 'q1' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Q1
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpense2Fortnight('q2')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense2Fortnight === 'q2' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Q2
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpense2Fortnight('both')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense2Fortnight === 'both' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Ambas
                    </button>
                  </div>
                </div>
                <MoneyInput
                  value={expense2Amount}
                  onChange={setExpense2Amount}
                  currencySymbol="$"
                  rates={rates}
                  showConverter={false}
                  className="!py-2 !text-base !bg-surface"
                />
              </div>

              {/* Gasto 3 */}
              <div className="p-3 rounded-2xl bg-card border border-app space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={expense3Name}
                    onChange={(e) => setExpense3Name(e.target.value)}
                    className="bg-transparent text-xs font-bold text-app focus:outline-none border-b border-transparent focus:border-app flex-1"
                  />
                  <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-app shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpense3Fortnight('q1')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense3Fortnight === 'q1' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Q1
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpense3Fortnight('q2')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense3Fortnight === 'q2' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Q2
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpense3Fortnight('both')}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                        expense3Fortnight === 'both' ? 'bg-primary-custom text-white' : 'text-muted hover:text-app'
                      }`}
                    >
                      Ambas
                    </button>
                  </div>
                </div>
                <MoneyInput
                  value={expense3Amount}
                  onChange={setExpense3Amount}
                  currencySymbol="$"
                  rates={rates}
                  showConverter={false}
                  className="!py-2 !text-base !bg-surface"
                />
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: Deudas o Cuotas Activas */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-app flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-purple-400" />
                3. ¿Tienes alguna cuota de deuda activa?
              </h3>
              <p className="text-xs text-muted">
                Ejemplo: Cashea, Krece, tarjeta de crédito o préstamos personales.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHasDebt(false)}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  !hasDebt
                    ? 'bg-primary-custom text-white border-primary-custom shadow-md'
                    : 'bg-card border-app text-muted hover:text-app'
                }`}
              >
                No tengo deudas activas
              </button>
              <button
                type="button"
                onClick={() => setHasDebt(true)}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  hasDebt
                    ? 'bg-primary-custom text-white border-primary-custom shadow-md'
                    : 'bg-card border-app text-muted hover:text-app'
                }`}
              >
                Sí, tengo al menos una cuota
              </button>
            </div>

            {hasDebt && (
              <div className="p-4 rounded-2xl bg-card border border-app space-y-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Acreedor o Plataforma
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Cashea, Banco, Préstamo familiar"
                    value={debtCreditor}
                    onChange={(e) => setDebtCreditor(e.target.value)}
                    className="w-full bg-surface border border-app rounded-xl px-3 py-2 text-xs font-bold text-app focus:outline-none focus:border-primary-custom"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      Cuota por Quincena ($)
                    </label>
                    <MoneyInput
                      value={debtInstallment}
                      onChange={setDebtInstallment}
                      currencySymbol="$"
                      rates={rates}
                      showConverter={false}
                      className="!py-2 !text-sm !bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">
                      Saldo Total Pendiente ($)
                    </label>
                    <MoneyInput
                      value={debtTotal}
                      onChange={setDebtTotal}
                      currencySymbol="$"
                      rates={rates}
                      showConverter={false}
                      className="!py-2 !text-sm !bg-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Vencimiento de Cuota
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDebtFortnight('both')}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        debtFortnight === 'both'
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'bg-surface text-muted hover:text-app border border-app'
                      }`}
                    >
                      Ambas (15 y 30)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtFortnight('q1')}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        debtFortnight === 'q1'
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'bg-surface text-muted hover:text-app border border-app'
                      }`}
                    >
                      Solo Q1 (Día 15)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtFortnight('q2')}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        debtFortnight === 'q2'
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'bg-surface text-muted hover:text-app border border-app'
                      }`}
                    >
                      Solo Q2 (Día 30)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 4: Cuenta Principal */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-app flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-teal-400" />
                4. ¿Con cuánto saldo arrancas en tu billetera o cuenta?
              </h3>
              <p className="text-xs text-muted">
                Tu caja o banco principal para registrar entradas y salidas reales.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre de la Cuenta o Caja
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3.5 py-2.5 text-sm font-bold text-app focus:outline-none focus:border-primary-custom"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Saldo Actual Disponible ($)
                </label>
                <MoneyInput
                  value={accountBalance}
                  onChange={setAccountBalance}
                  currencySymbol="$"
                  rates={rates}
                  showConverter={true}
                  className="!text-xl !font-black !bg-card"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
                <PartyPopper className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  ¡Todo listo! Al confirmar, tu Dashboard arrancará de inmediato con tus ingresos, compromisos y quincenas configuradas.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Navegación del Asistente */}
        <div className="flex items-center justify-between pt-2 border-t border-app">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-2xl bg-card hover:bg-surface-hover border border-app text-xs font-bold text-muted hover:text-app flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-2xl bg-primary-custom hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <span>Continuar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : '¡Comenzar con LANITAPP!'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
