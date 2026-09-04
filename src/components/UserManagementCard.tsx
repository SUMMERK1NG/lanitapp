import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Mail,
  CreditCard,
  Calendar,
  Pencil,
  Trash2,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  Send,
  Clock,
  Globe,
} from 'lucide-react';
import type { UserProfile, UserRole } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { db } from '../lib/db.ts';
import { logger } from '../utils/logger.ts';

interface UserManagementCardProps {
  currentUserId?: string;
}

export const UserManagementCard: React.FC<UserManagementCardProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modals state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  // Edit User Form State
  const [editPrefix, setEditPrefix] = useState<string>('V');
  const [editCedulaNumber, setEditCedulaNumber] = useState<string>('');
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Password Management Form State
  const [passwordMode, setPasswordMode] = useState<'reset_email' | 'direct_password'>('reset_email');
  const [directPassword, setDirectPassword] = useState<string>('');
  const [showDirectPassword, setShowDirectPassword] = useState<boolean>(false);
  const [isProcessingPassword, setIsProcessingPassword] = useState<boolean>(false);

  // Delete state
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  /**
   * Carga directa desde la tabla profiles de Supabase
   */
  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (data) {
          setUsers(data as UserProfile[]);
        }
      } else {
        setUsers([]);
      }
    } catch (e: any) {
      logger.error('Fetch users error:', e.message);
      setUsers([]);
      showToast('error', `Error al cargar usuarios: ${e.message || 'Error de conexión'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4500);
  };

  // Open Edit User Modal
  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    const rawCedula = user.cedula || '';
    const match = rawCedula.match(/^([VEJGvejg])[- ]?(.*)$/);
    if (match) {
      setEditPrefix(match[1].toUpperCase());
      setEditCedulaNumber(match[2]);
    } else {
      setEditPrefix('V');
      setEditCedulaNumber(rawCedula);
    }

    setEditFirstName(user.first_name || user.name?.split(' ')[0] || '');
    setEditLastName(user.last_name || user.name?.split(' ').slice(1).join(' ') || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'user');
  };

  // Submit Edit User
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanNum = editCedulaNumber.trim();
    if (!cleanNum || !editFirstName.trim() || !editEmail.trim()) {
      showToast('error', 'Por favor completa los campos obligatorios.');
      return;
    }

    setIsSavingEdit(true);
    const fullCedula = `${editPrefix}-${cleanNum}`;
    const fullName = `${editFirstName.trim()} ${editLastName.trim()}`.trim();

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error('Usuario administrador no autenticado en Supabase');
        }
        const profileUpdatePayload = {
          email: editEmail.trim().toLowerCase(),
          cedula: fullCedula,
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          role: editRole,
          updated_at: new Date().toISOString(),
        };
        logger.dev('[UPDATE] Admin:', user.id, 'Editando usuario:', editingUser.id, 'Tabla: profiles');
        const { error } = await supabase
          .from('profiles')
          .update(profileUpdatePayload)
          .eq('id', editingUser.id);

        if (error) throw error;
      }

      await db.user_profiles.update(editingUser.id, {
        cedula: fullCedula,
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        name: fullName,
        email: editEmail.trim().toLowerCase(),
        role: editRole,
      });

      showToast('success', `Datos de ${fullName} actualizados con éxito.`);
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      showToast('error', `Error al actualizar usuario: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Quick Toggle Role
  const handleToggleRole = async (profile: UserProfile) => {
    const newRole: UserRole = profile.role === 'admin' ? 'user' : 'admin';
    const roleLabel = newRole === 'admin' ? 'Administrador' : 'Usuario Estándar';

    if (!window.confirm(`¿Deseas cambiar el rol de ${profile.name || profile.cedula} a "${roleLabel}"?`)) {
      return;
    }

    setUpdatingId(profile.id);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', profile.id);

        if (error) throw error;
      }

      await db.user_profiles.update(profile.id, { role: newRole });
      showToast('success', `Rol de ${profile.name || profile.cedula} actualizado a ${roleLabel}.`);
      await fetchUsers();
    } catch (err: any) {
      showToast('error', `Error al actualizar rol: ${err.message || 'Error desconocido'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Password Modal
  const handleOpenPasswordModal = (user: UserProfile) => {
    setPasswordTargetUser(user);
    setPasswordMode('reset_email');
    setDirectPassword('');
    setShowDirectPassword(false);
  };

  // Process Password Action
  const handleProcessPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;

    setIsProcessingPassword(true);

    try {
      if (passwordMode === 'reset_email') {
        if (!passwordTargetUser.email) {
          throw new Error('El usuario no tiene un correo electrónico registrado.');
        }

        if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(passwordTargetUser.email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (error) throw error;
        }

        showToast('success', `Enlace de restablecimiento enviado a ${passwordTargetUser.email}.`);
        setPasswordTargetUser(null);
      } else {
        // Direct password assignment
        if (directPassword.length < 6) {
          throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        }

        if (isSupabaseConfigured() && supabase) {
          const { error: rpcErr } = await supabase.rpc('set_user_password_by_admin', {
            target_user_id: passwordTargetUser.id,
            new_password: directPassword,
          });

          if (rpcErr) {
            logger.warn('RPC set_user_password_by_admin not found, falling back to reset email:', rpcErr.message);
            if (passwordTargetUser.email) {
              await supabase.auth.resetPasswordForEmail(passwordTargetUser.email, {
                redirectTo: `${window.location.origin}/reset-password`,
              });
              showToast('success', `Se ha enviado el enlace de restablecimiento a ${passwordTargetUser.email}.`);
            } else {
              throw rpcErr;
            }
          } else {
            showToast('success', `Contraseña actualizada con éxito para ${passwordTargetUser.name || passwordTargetUser.cedula}.`);
          }
        } else {
          showToast('success', 'Contraseña actualizada localmente.');
        }

        setPasswordTargetUser(null);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error al procesar la contraseña.');
    } finally {
      setIsProcessingPassword(false);
    }
  };

  // Delete User Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === currentUserId) {
      showToast('error', 'No puedes eliminar tu propia cuenta activa.');
      return;
    }

    setIsDeleting(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: rpcErr } = await supabase.rpc('delete_user_by_admin', {
          user_id_to_delete: deletingUser.id,
        });

        if (rpcErr) {
          logger.warn('RPC delete_user_by_admin not available, deleting from profiles table:', rpcErr.message);
          const { error: tableErr } = await supabase
            .from('profiles')
            .delete()
            .eq('id', deletingUser.id);
          if (tableErr) throw tableErr;
        }
      }

      await db.user_profiles.delete(deletingUser.id);
      showToast('success', `Usuario ${deletingUser.name || deletingUser.cedula} eliminado correctamente.`);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err: any) {
      showToast('error', `Error al eliminar usuario: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-app shadow-md space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-app">Gestión de Usuarios (Admin)</h3>
            <p className="text-xs text-muted mt-0.5">Administración de usuarios y accesos</p>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="p-2 rounded-xl bg-card hover:bg-surface-hover text-muted hover:text-app border border-app transition-colors cursor-pointer"
          title="Actualizar lista de usuarios"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-custom' : ''}`} />
        </button>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-in fade-in ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed">{actionMessage.text}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-2xl border border-app">
        <table className="w-full text-left text-xs">
          <thead className="bg-card text-muted uppercase text-[10px] tracking-wider font-bold border-b border-app">
            <tr>
              <th className="px-4 py-3">Documento / Cédula</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Último Acceso</th>
              <th className="px-4 py-3">Registro</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary-custom" />
                    <span>Cargando usuarios registrados...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No hay usuarios registrados aún en el sistema.
                </td>
              </tr>
            ) : (
              users.map((p) => {
                const isCurrent = p.id === currentUserId;
                const dateFormatted = p.created_at
                  ? new Date(p.created_at).toLocaleDateString('es-VE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'N/A';

                const hasLastAccess = Boolean(p.last_sign_in_at || p.last_login_at);
                const lastAccessFormatted = hasLastAccess
                  ? new Date(p.last_sign_in_at || p.last_login_at!).toLocaleString('es-VE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Sin accesos registrados';

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-card/50 transition-colors ${
                      isCurrent ? 'bg-primary-custom/5 font-medium' : ''
                    }`}
                  >
                    {/* Documento / Cédula */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-primary-custom" />
                        <span className="font-bold text-app">{p.cedula || '—'}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary-custom/20 text-primary-custom font-bold">
                            Tú
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Nombre */}
                    <td className="px-4 py-3 font-semibold text-app whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface border border-app flex items-center justify-center overflow-hidden shrink-0">
                          {(() => {
                            const av = p.avatar_url || p.avatar || '👤';
                            if (av.startsWith('/') || av.startsWith('http')) {
                              return <img src={av} alt="Avatar" className="w-full h-full object-contain p-0.5" />;
                            }
                            return <span className="text-sm select-none">{av}</span>;
                          })()}
                        </div>
                        <span>{p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'}</span>
                      </div>
                    </td>

                    {/* Correo */}
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#00C2C7]" />
                        <span>{p.email || '—'}</span>
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.role === 'admin' ? (
                        <button
                          onClick={() => handleToggleRole(p)}
                          disabled={updatingId === p.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-primary-custom/20 text-primary-custom border border-primary-custom/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          title="Clic para cambiar rol a Usuario"
                        >
                          <Shield className="w-3 h-3" />
                          ADMIN
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleRole(p)}
                          disabled={updatingId === p.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#00C2C7]/20 text-[#00C2C7] border border-[#00C2C7]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          title="Clic para promover a Administrador"
                        >
                          USUARIO
                        </button>
                      )}
                    </td>

                    {/* Último Acceso */}
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-3.5 h-3.5 ${hasLastAccess ? 'text-[#10B981]' : 'text-muted/60'}`} />
                          <span className={`text-xs font-medium ${hasLastAccess ? 'text-app' : 'text-muted italic'}`}>
                            {lastAccessFormatted}
                          </span>
                        </div>
                        {p.last_sign_in_ip && (
                          <div className="flex items-center gap-1 text-[10px] text-muted font-mono pl-5">
                            <Globe className="w-2.5 h-2.5 text-[#00C2C7]" />
                            <span>IP: {p.last_sign_in_ip}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Registro */}
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted" />
                        <span>{dateFormatted}</span>
                      </div>
                    </td>

                    {/* Acciones CRUD Estilizadas */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Botón Editar */}
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-xl bg-card hover:bg-surface-hover text-app border border-app transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          title="Editar datos del usuario"
                        >
                          <Pencil className="w-3.5 h-3.5 text-primary-custom" />
                        </button>

                        {/* Botón Llave / Contraseña */}
                        <button
                          onClick={() => handleOpenPasswordModal(p)}
                          className="p-1.5 rounded-xl bg-card hover:bg-surface-hover text-[#00C2C7] border border-app transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          title="Gestión de contraseña / Recuperación"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Botón Eliminar */}
                        <button
                          onClick={() => setDeletingUser(p)}
                          disabled={isCurrent}
                          className={`p-1.5 rounded-xl border transition-all ${
                            isCurrent
                              ? 'bg-card text-muted border-app opacity-30 cursor-not-allowed'
                              : 'bg-[#ef4444]/10 hover:bg-[#ef4444]/25 text-[#ef4444] border-[#ef4444]/30 hover:scale-105 active:scale-95 cursor-pointer'
                          }`}
                          title={isCurrent ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: EDITAR DATOS DE USUARIO */}
      {/* ------------------------------------------------------------- */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-app rounded-3xl p-6 shadow-2xl text-app space-y-5 animate-in zoom-in-95 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-primary-custom/20 text-primary-custom flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app">Editar Datos de Usuario</h3>
                  <p className="text-[11px] text-muted">Modifica información y permisos</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4">
              {/* Cédula con selector de prefijo */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-primary-custom" />
                  Documento de Identidad (Cédula)
                </label>
                <div className="flex gap-2">
                  <select
                    value={editPrefix}
                    onChange={(e) => setEditPrefix(e.target.value)}
                    className="bg-card border border-app rounded-xl px-3 py-2 text-xs font-bold text-app focus:outline-none focus:ring-2 focus:ring-primary-custom cursor-pointer shrink-0"
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="J">J</option>
                    <option value="G">G</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 12345678"
                    value={editCedulaNumber}
                    onChange={(e) => {
                      const numericVal = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setEditCedulaNumber(numericVal);
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={9}
                    className="flex-1 min-w-0 bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  />
                </div>
              </div>

              {/* Nombres y Apellidos */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Nombres</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Apellidos</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-[#00C2C7]" /> Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                />
              </div>

              {/* Rol de Usuario */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-primary-custom" /> Rol de Acceso
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full bg-card border border-app rounded-xl px-3 py-2 text-xs text-app font-bold focus:outline-none focus:ring-2 focus:ring-primary-custom cursor-pointer"
                >
                  <option value="user">Usuario Estándar (Acceso personal)</option>
                  <option value="admin">Administrador (Acceso total y Configuración)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-app">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: GESTIÓN DE CONTRASEÑA DE USUARIO */}
      {/* ------------------------------------------------------------- */}
      {passwordTargetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
          onClick={() => setPasswordTargetUser(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-app rounded-3xl p-6 shadow-2xl text-app space-y-5 animate-in zoom-in-95 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-[#00C2C7]/20 text-[#00C2C7] flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app">Gestión de Contraseña</h3>
                  <p className="text-[11px] text-muted">
                    Usuario: <strong className="text-app">{passwordTargetUser.name || passwordTargetUser.cedula}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasswordTargetUser(null)}
                className="p-2 rounded-full hover:bg-surface-hover text-muted hover:text-app transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex p-1 bg-card rounded-2xl border border-app">
              <button
                type="button"
                onClick={() => setPasswordMode('reset_email')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  passwordMode === 'reset_email'
                    ? 'bg-primary-custom text-white shadow-md'
                    : 'text-muted hover:text-app'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Enviar Enlace por Correo</span>
              </button>

              <button
                type="button"
                onClick={() => setPasswordMode('direct_password')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  passwordMode === 'direct_password'
                    ? 'bg-primary-custom text-white shadow-md'
                    : 'text-muted hover:text-app'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Asignar Directa</span>
              </button>
            </div>

            <form onSubmit={handleProcessPassword} className="space-y-4">
              {passwordMode === 'reset_email' ? (
                <div className="p-4 rounded-2xl bg-card border border-app space-y-2 text-xs">
                  <p className="text-muted leading-relaxed">
                    Se enviará un enlace seguro de restablecimiento de contraseña a la dirección:
                  </p>
                  <p className="font-bold text-app text-sm flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#00C2C7]" />
                    {passwordTargetUser.email || 'Sin correo registrado'}
                  </p>
                  <p className="text-[11px] text-muted">
                    El usuario recibirá las instrucciones para definir su nueva clave secreta.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#00C2C7]" />
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showDirectPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      className="w-full bg-card border border-app rounded-xl pl-3 pr-10 py-2.5 text-xs text-app focus:outline-none focus:ring-2 focus:ring-primary-custom"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDirectPassword(!showDirectPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-app cursor-pointer"
                    >
                      {showDirectPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-muted block mt-1">
                    La contraseña se actualizará de inmediato para este usuario.
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-app">
                <button
                  type="button"
                  onClick={() => setPasswordTargetUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-app text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPassword}
                  className="flex-1 py-2.5 rounded-xl bg-primary-custom text-white text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {passwordMode === 'reset_email' ? (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{isProcessingPassword ? 'Enviando...' : 'Enviar Enlace'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isProcessingPassword ? 'Actualizando...' : 'Actualizar Clave'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: CONFIRMACIÓN DE ELIMINACIÓN DE USUARIO */}
      {/* ------------------------------------------------------------- */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in cursor-pointer"
          onClick={() => setDeletingUser(null)}
        >
          <div
            className="w-full max-w-md bg-[#1C2A4A]/95 border border-[#ef4444]/30 rounded-3xl p-6 shadow-2xl text-white space-y-4 animate-in zoom-in-95 cursor-default"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#ef4444]/20 text-[#ef4444] flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Eliminar Usuario</h3>
                <p className="text-xs text-slate-300">¿Estás seguro de realizar esta acción?</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0B132B]/80 border border-white/10 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Usuario:</span>
                <span className="font-bold text-white">{deletingUser.name || 'Sin nombre'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cédula:</span>
                <span className="font-bold text-white">{deletingUser.cedula || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Correo:</span>
                <span className="font-bold text-white">{deletingUser.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rol actual:</span>
                <span className="font-bold text-[#FF914D] uppercase">{deletingUser.role}</span>
              </div>
            </div>

            <p className="text-xs text-[#ef4444] leading-relaxed">
              ⚠️ Esta acción eliminará permanentemente el perfil y los accesos del usuario.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-card hover:bg-surface-hover text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-[#ef4444] text-white text-xs font-bold shadow-lg shadow-[#ef4444]/30 hover:bg-[#dc2626] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Eliminando...' : 'Eliminar Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
