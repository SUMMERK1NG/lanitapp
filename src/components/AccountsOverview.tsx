import React from 'react';
import { Wallet, CreditCard, PiggyBank, Landmark, Smartphone, ArrowRight, Plus } from 'lucide-react';
import type { Account, Transaction } from '../types/index.ts';

interface AccountsOverviewProps {
  accounts: Account[];
  transactions: Transaction[];
  currency?: string;
  onNavigateToAccounts?: () => void;
}

export const AccountsOverview: React.FC<AccountsOverviewProps> = ({
  accounts,
  transactions,
  currency = '$',
  onNavigateToAccounts,
}) => {
  const getAccountBalance = (account: Account) => {
    const accTxs = transactions.filter((t) => t.account_id === account.id);
    const income = accTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = accTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return account.initial_balance + income - expense;
  };

  const getAccountIcon = (type: Account['type']) => {
    switch (type) {
      case 'cash':
        return <Wallet className="w-5 h-5 text-[#00c2c7]" />;
      case 'bank':
        return <Landmark className="w-5 h-5 text-[#147df0]" />;
      case 'digital':
        return <Smartphone className="w-5 h-5 text-purple-400" />;
      case 'savings':
        return <PiggyBank className="w-5 h-5 text-emerald-400" />;
      case 'credit':
        return <CreditCard className="w-5 h-5 text-[#ff914d]" />;
      default:
        return <Wallet className="w-5 h-5 text-[#9ba3af]" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Mis Cuentas & Fondos</h3>
          <p className="text-xs text-[#9ba3af]">Balances calculados en tiempo real</p>
        </div>
        {onNavigateToAccounts && (
          <button
            onClick={onNavigateToAccounts}
            className="text-xs text-[#00c2c7] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Gestionar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="p-6 rounded-3xl bg-[#203657]/50 border border-dashed border-[#2a4365] text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/15 text-primary-custom flex items-center justify-center mx-auto">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-xs text-[#9ba3af] max-w-xs mx-auto">
            No tienes cuentas o fondos registrados aún.
          </p>
          {onNavigateToAccounts && (
            <button
              onClick={onNavigateToAccounts}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-95 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Cuenta / Fondo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {accounts.map((account) => {
            const currentBalance = getAccountBalance(account);
            return (
              <div
                key={account.id}
                onClick={onNavigateToAccounts}
                className="p-3.5 rounded-2xl bg-[#203657] border border-[#2a4365] flex items-center justify-between shadow-sm hover:border-[#147df0]/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1c2e4a] border border-[#2a4365] flex items-center justify-center group-hover:scale-105 transition-transform">
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-[#00c2c7] transition-colors">
                      {account.name}
                    </h4>
                    <p className="text-[10px] text-[#9ba3af] uppercase tracking-wider">
                      {account.type} • {account.currency}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`text-sm font-black ${
                      currentBalance >= 0 ? 'text-[#00c2c7]' : 'text-[#ff914d]'
                    }`}
                  >
                    {account.currency === 'VES' ? 'Bs. ' : account.currency === 'EUR' ? '€' : currency}
                    {currentBalance.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <span className="text-[10px] text-[#9ba3af]">Saldo disponible</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
