import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  RotateCcw,
} from 'lucide-react';
import type { Category, TransactionType } from '../types/index.ts';
import { saveCategory, deleteCategory, seedUserDefaultCategories, getActiveUserId } from '../lib/db.ts';
import { useFinanceStore } from '../stores/useFinanceStore.ts';
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
  'Wifi',
  'Clock',
  'Receipt',
  'Sparkles',
  'Smartphone',
  'Zap',
  'Fuel',
  'Plane',
  'Coffee',
  'BookOpen',
  'Stethoscope',
  'Music',
  'Dumbbell',
];

const CATEGORY_PALETTE = [
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Verde', value: '#10B981' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Turquesa', value: '#00C2C7' },
  { name: 'Ámbar', value: '#F59E0B' },
  { name: 'Naranja', value: '#FF914D' },
  { name: 'Rojo', value: '#EF4444' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Violeta', value: '#8B5CF6' },
  { name: 'Índigo', value: '#6366F1' },
  { name: 'Lima', value: '#84CC16' },
  { name: 'Pizarra', value: '#64748B' },
];

export const CategoriesModule: React.FC<CategoriesModuleProps> = ({ categories }) => {
  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<TransactionType>('expense');
  const [icon, setIcon] = useState<string>('Home');
  const [color, setColor] = useState<string>('#3B82F6');

  const filteredCategories = categories.filter((c) => c.type === activeTab);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setType(activeTab);
    setIcon(activeTab === 'expense' ? 'ShoppingCart' : 'Briefcase');
    setColor(activeTab === 'expense' ? '#3B82F6' : '#10B981');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon);
    setColor(cat.color || (cat.type === 'expense' ? '#3B82F6' : '#10B981'));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const userId = getActiveUserId();
    await saveCategory({
      id: editingCategory?.id,
      user_id: editingCategory?.user_id || userId,
      name: name.trim(),
      type,
      icon,
      color,
    });

    if (userId) {
      await useFinanceStore.getState().loadFromLocalCache(userId);
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar esta categoría? Solo se eliminará de tu cuenta personal y no afectará a los demás usuarios.')) {
      await deleteCategory(id);
      const userId = getActiveUserId();
      if (userId) {
        await useFinanceStore.getState().loadFromLocalCache(userId);
      }
    }
  };

  const handleRestoreDefaults = async () => {
    const userId = getActiveUserId();
    if (!userId) return;
    if (window.confirm('¿Deseas restaurar las categorías sugeridas para tu cuenta?')) {
      await seedUserDefaultCategories(userId, true);
      await useFinanceStore.getState().loadFromLocalCache(userId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-surface border border-app shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-app">Gestor de Categorías</h3>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Clasificación de ingresos y gastos
          </p>
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
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-app text-muted hover:text-app text-xs font-bold transition-all cursor-pointer"
            title="Restaurar las categorías sugeridas del sistema para tu cuenta"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sugeridas</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva
          </button>
        </div>
      </div>

      {/* Categories Grid or Empty State */}
      {filteredCategories.length === 0 ? (
        <div className="p-8 text-center rounded-3xl bg-surface border border-dashed border-app">
          <Layers className="w-10 h-10 text-muted mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-bold text-app">No tienes categorías de {activeTab === 'expense' ? 'gastos' : 'ingresos'}</h4>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Puedes crear tus propias categorías personalizadas o restaurar el paquete sugerido del sistema.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear Categoría
            </button>
            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-app text-app text-xs font-bold shadow-sm cursor-pointer hover:bg-surface"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Sugeridas
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="p-3.5 rounded-2xl bg-surface border border-app flex items-center justify-between shadow-sm hover:border-primary-custom transition-all"
            >
              <div className="flex items-center gap-3 truncate">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-transform shadow-xs"
                  style={{
                    backgroundColor: `${cat.color || '#3B82F6'}20`,
                    color: cat.color || '#3B82F6',
                    borderColor: `${cat.color || '#3B82F6'}35`,
                  }}
                >
                  <CategoryIcon iconName={cat.icon} size={20} className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-app truncate">{cat.name}</h4>
                  <span className="text-[10px] text-muted uppercase font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#3B82F6' }} />
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
      )}

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in cursor-pointer"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-app rounded-3xl p-5 shadow-2xl text-app animate-in zoom-in-95 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted">
                    Color de la Categoría
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] font-mono text-muted uppercase">{color}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 p-2 bg-card rounded-2xl border border-app items-center">
                  {CATEGORY_PALETTE.map((pal) => {
                    const isSelected = color.toLowerCase() === pal.value.toLowerCase();
                    return (
                      <button
                        key={pal.value}
                        type="button"
                        onClick={() => setColor(pal.value)}
                        className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'ring-2 ring-white scale-110 shadow-md'
                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: pal.value }}
                        title={pal.name}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white shadow-xs" />
                        )}
                      </button>
                    );
                  })}
                  {/* Custom color input */}
                  <label
                    className="w-7 h-7 rounded-xl border border-dashed border-app flex items-center justify-center cursor-pointer hover:border-white/50 transition-all text-xs text-muted overflow-hidden relative shrink-0"
                    title="Color personalizado"
                  >
                    🎨
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>
              </div>

              {/* Live Preview */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-app">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-all shadow-xs"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color,
                    borderColor: `${color}40`,
                  }}
                >
                  <CategoryIcon iconName={icon} size={22} className="w-5.5 h-5.5" />
                </div>
                <div className="truncate">
                  <h5 className="text-xs font-bold text-app truncate">{name.trim() || 'Nombre de la Categoría'}</h5>
                  <span className="text-[10px] text-muted uppercase font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    {type === 'expense' ? 'Gasto' : 'Ingreso'} • Vista previa
                  </span>
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
