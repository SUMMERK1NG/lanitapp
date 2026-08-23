import React, { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  CloudCheck,
  Clock,
  AlertCircle,
  Inbox,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import type { Transaction, Category, Account } from '../types/index.ts';
import { CategoryIcon } from './CategoryIcon.tsx';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  currency?: string;
  onDelete: (id: string) => Promise<void>;
  onOpenAdd?: () => void;
  showFilters?: boolean;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  accounts,
  currency = '$',
  onDelete,
  onOpenAdd,
  showFilters = true,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (selectedType !== 'all' && tx.type !== selectedType) return false;
        if (selectedCategory !== 'all' && tx.category_id !== selectedCategory) return false;
        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          const descMatch = tx.description.toLowerCase().includes(term);
          const amountMatch = tx.amount.toString().includes(term);
          const catName = categoryMap.get(tx.category_id)?.name.toLowerCase() || '';
          return descMatch || amountMatch || catName.includes(term);
        }
        return true;
      })
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }, [transactions, selectedType, selectedCategory, searchTerm, categoryMap]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    filteredTransactions.forEach((tx) => {
      let label = tx.transaction_date;
      if (tx.transaction_date === todayStr) {
        label = 'Hoy';
      } else if (tx.transaction_date === yesterday) {
        label = 'Ayer';
      }
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(tx);
    });

    return groups;
  }, [filteredTransactions]);

  const handleDeleteClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Seguro que deseas eliminar este movimiento?')) {
      setDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Search and Filters */}
      {showFilters && (
        <div className="space-y-2 bg-[#203657] border border-[#2a4365] p-3 rounded-2xl">
          {/* Search bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9ba3af]">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Buscar por descripción, monto o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1c2e4a] border border-[#2a4365] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#147df0]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9ba3af] hover:text-white text-xs cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-[#147df0] text-white shadow-sm'
                  : 'bg-[#1c2e4a] text-[#9ba3af] hover:text-white'
              }`}
            >
              Todos ({transactions.length})
            </button>
            <button
              onClick={() => setSelectedType('expense')}
              className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedType === 'expense'
                  ? 'bg-[#ff914d] text-white shadow-sm'
                  : 'bg-[#1c2e4a] text-[#9ba3af] hover:text-white'
              }`}
            >
              Gastos
            </button>
            <button
              onClick={() => setSelectedType('income')}
              className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedType === 'income'
                  ? 'bg-[#00c2c7] text-[#0b132b] shadow-sm'
                  : 'bg-[#1c2e4a] text-[#9ba3af] hover:text-white'
              }`}
            >
              Ingresos
            </button>

            {/* Category Custom Dropdown Filter */}
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="bg-[#1c2e4a] hover:bg-[#253d61] text-slate-300 text-xs font-bold rounded-lg px-2.5 py-1 border border-[#2a4365] flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="truncate max-w-[120px]">
                  {selectedCategory === 'all'
                    ? 'Categoría'
                    : categories.find((c) => c.id === selectedCategory)?.name || 'Categoría'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isCategoryDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsCategoryDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 w-48 bg-slate-900 border border-slate-700 rounded-xl p-1.5 shadow-2xl max-h-48 overflow-y-auto no-scrollbar space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold text-left transition-all cursor-pointer ${
                        selectedCategory === 'all'
                          ? 'bg-primary-custom text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      Todas las categorías
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(c.id);
                          setIsCategoryDropdownOpen(false);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 transition-all cursor-pointer ${
                          selectedCategory === c.id
                            ? 'bg-primary-custom text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color || '#147df0' }} />
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredTransactions.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-app shadow-md text-center space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-primary-custom/15 text-primary-custom flex items-center justify-center shadow-xl shadow-primary-custom/10 border border-primary-custom/20">
            <Inbox className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-app">
              {searchTerm || selectedType !== 'all' || selectedCategory !== 'all'
                ? 'No se encontraron movimientos con los filtros actuales'
                : 'Comienza a estructurar tus finanzas'}
            </h3>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              {searchTerm || selectedType !== 'all' || selectedCategory !== 'all'
                ? 'Prueba cambiando los filtros de búsqueda o restablece los criterios seleccionados.'
                : 'Agrega tu primer registro para calcular tus balances y proyecciones de quincena automáticamente.'}
            </p>
            {onOpenAdd && !searchTerm && selectedType === 'all' && selectedCategory === 'all' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenAdd}
                  className="px-4 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold hover:opacity-95 transition-all shadow-md cursor-pointer"
                >
                  Registrar Primer Movimiento
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grouped Transaction List */
        <div className="space-y-4">
          {Object.entries(groupedTransactions).map(([dateLabel, groupTxs]) => (
            <div key={dateLabel} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-3.5 h-3.5 text-[#147df0]" />
                <span className="text-xs font-bold text-[#9ba3af] uppercase tracking-wider">
                  {dateLabel}
                </span>
                <span className="text-[10px] text-[#9ba3af] font-semibold ml-auto">
                  {groupTxs.length} {groupTxs.length === 1 ? 'movimiento' : 'movimientos'}
                </span>
              </div>

              <div className="space-y-1.5">
                {groupTxs.map((tx) => {
                  const category = categoryMap.get(tx.category_id);
                  const account = accountMap.get(tx.account_id);
                  const isExpense = tx.type === 'expense';
                  const isDeleting = deletingId === tx.id;

                  return (
                    <div
                      key={tx.id}
                      className="group flex items-center justify-between p-3 rounded-2xl bg-[#203657] border border-[#2a4365] hover:border-[#147df0]/40 transition-all"
                    >
                      {/* Left: Icon & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: category?.color || '#29446c' }}
                        >
                          <CategoryIcon
                            iconName={category?.icon || (isExpense ? 'ArrowUpRight' : 'ArrowDownLeft')}
                            size={18}
                            className="w-5 h-5"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[#9ba3af]">
                            <span className="truncate">{category?.name || 'General'}</span>
                            <span>•</span>
                            <span className="text-slate-400 truncate">{account?.name || 'Cuenta'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount, Sync Status & Actions */}
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <div className="text-right">
                          <p
                            className={`text-sm font-black ${
                              isExpense ? 'text-[#ff914d]' : 'text-[#00c2c7]'
                            }`}
                          >
                            {isExpense ? '-' : '+'}
                            {currency}
                            {tx.amount.toLocaleString('es-VE', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>

                          {/* Sync Status Badge */}
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {tx.sync_status === 'synced' ? (
                              <span
                                className="inline-flex items-center text-[10px] text-emerald-400 font-semibold"
                                title="Sincronizado con Supabase"
                              >
                                <CloudCheck className="w-3 h-3 mr-0.5" />
                                Sync
                              </span>
                            ) : tx.sync_status === 'pending' ? (
                              <span
                                className="inline-flex items-center text-[10px] text-[#ff914d] font-semibold"
                                title="Guardado local (Pendiente de subir a Supabase)"
                              >
                                <Clock className="w-3 h-3 mr-0.5 animate-pulse" />
                                Local
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center text-[10px] text-rose-400 font-semibold"
                                title="Error de sincronización"
                              >
                                <AlertCircle className="w-3 h-3 mr-0.5" />
                                Error
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeleteClick(tx.id, e)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-[#9ba3af] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors opacity-80 group-hover:opacity-100 disabled:opacity-30 cursor-pointer"
                          title="Eliminar movimiento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
