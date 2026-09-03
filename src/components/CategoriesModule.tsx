import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import type { Category, TransactionType } from '../types/index.ts';
import { saveCategory, deleteCategory } from '../lib/db.ts';
import { CategoryIcon } from './CategoryIcon.tsx';

interface CategoriesModuleProps {
  categories: Category[];
}

const AVAILABLE_ICONS = [
  'Home',
  'ShoppingCart',
  'UtensilsCrossed',
  'Car',
  'CreditCard',
  'HeartPulse',
  'Film',
  'Briefcase',
  'TrendingUp',
  'Laptop',
  'Gift',
  'GraduationCap',
  'ShoppingBag',
  'Wallet',
  'PiggyBank',
  'BadgeDollarSign',
  'MoreHorizontal',
];

const PRESET_COLORS = [
  '#147DF0',
  '#00C2C7',
  '#FF914D',
  '#EC4899',
  '#8B5CF6',
  '#10B981',
  '#EF4444',
  '#F59E0B',
  '#6366F1',
  '#9BA3AF',
];

export const CategoriesModule: React.FC<CategoriesModuleProps> = ({ categories }) => {
  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<TransactionType>('expense');
  const [icon, setIcon] = useState<string>('Home');
  const [color, setColor] = useState<string>('#147DF0');

  const filteredCategories = categories.filter((c) => c.type === activeTab);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setType(activeTab);
    setIcon(activeTab === 'expense' ? 'ShoppingCart' : 'Briefcase');
    setColor(PRESET_COLORS[0]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon);
    setColor(cat.color);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await saveCategory({
      id: editingCategory?.id,
      name: name.trim(),
      type,
      icon,
      color,
    });

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar esta categoría?')) {
      await deleteCategory(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-surface border border-app shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-app">Gestor de Categorías</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs switch */}
          <div className="flex p-1 bg-card rounded-xl border border-app">
            <button
              onClick={() => setActiveTab('expense')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'expense'
                  ? 'bg-primary-custom text-white shadow-sm'
                  : 'text-muted hover:text-app'
              }`}
            >
              Gastos ({categories.filter((c) => c.type === 'expense').length})
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'income'
                  ? 'bg-[#00C2C7] text-[#0b132b] shadow-sm'
                  : 'text-muted hover:text-app'
              }`}
            >
              Ingresos ({categories.filter((c) => c.type === 'income').length})
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className="p-3.5 rounded-2xl bg-surface border border-app flex items-center justify-between shadow-sm hover:border-primary-custom transition-all"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: cat.color }}
              >
                <CategoryIcon iconName={cat.icon} size={20} className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-app">{cat.name}</h4>
                <span className="text-[10px] text-muted uppercase font-semibold">
                  {cat.type === 'expense' ? 'Gasto' : 'Ingreso'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleOpenEdit(cat)}
                className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-card transition-colors cursor-pointer"
                title="Editar categoría"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-1.5 rounded-lg text-muted hover:text-[#ef4444] hover:bg-card transition-colors cursor-pointer"
                title="Eliminar categoría"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <h3 className="text-base font-bold text-app">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Nombre de la Categoría
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Supermercado, Gimnasio, Mascotas..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2.5 text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Tipo
                </label>
                <div className="grid grid-cols-2 p-1 bg-card rounded-xl border border-app">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      type === 'expense'
                        ? 'bg-primary-custom text-white shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      type === 'income'
                        ? 'bg-[#00C2C7] text-[#0b132b] shadow-sm'
                        : 'text-muted hover:text-app'
                    }`}
                  >
                    Ingreso
                  </button>
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Selecciona un Icono
                </label>
                <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-1 bg-card rounded-2xl border border-app">
                  {AVAILABLE_ICONS.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setIcon(iconName)}
                      className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        icon === iconName
                          ? 'bg-primary-custom text-white ring-2 ring-primary-custom shadow-sm'
                          : 'text-muted hover:text-app hover:bg-surface'
                      }`}
                    >
                      <CategoryIcon iconName={iconName} size={18} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Color de la Categoría
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-sm"
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
