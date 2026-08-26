import { useState, useEffect, useCallback } from 'react';
import type { UserProfile, UserRole } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { saveUserProfile } from '../lib/db.ts';

const ACTIVE_USER_STORAGE_KEY = 'lanitapp_active_user';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth session on load (F5 / start)
  const initAuth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr) {
          console.warn('Session check error:', sessionErr.message);
          localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        if (sessionData?.session?.user) {
          const authUser = sessionData.session.user;
          // Fetch real profile from public.profiles
          const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (profileData && !profileErr) {
              const role: UserRole = profileData.role === 'admin' ? 'admin' : 'user';
              const savedAvatar = (typeof localStorage !== 'undefined' ? localStorage.getItem('user_avatar') : null) || '👑';
              const avatarResolved = profileData.avatar_url || profileData.avatar || savedAvatar;
              const userProfile: UserProfile = {
                id: profileData.id,
                email: profileData.email || authUser.email,
                cedula: profileData.cedula || authUser.user_metadata?.cedula || '',
                first_name: profileData.first_name || authUser.user_metadata?.first_name || '',
                last_name: profileData.last_name || authUser.user_metadata?.last_name || '',
                name: profileData.name || (profileData.first_name ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() : authUser.email?.split('@')[0] || 'Usuario'),
                avatar: avatarResolved,
                avatar_url: avatarResolved,
                role,
                is_active: true,
                currency: profileData.currency || 'USD',
                theme_mode: profileData.theme_mode || 'navy',
                accent_color: profileData.accent_color || '#147DF0',
                sync_status: 'synced',
                created_at: profileData.created_at,
                last_sign_in_at: profileData.last_sign_in_at || profileData.last_login_at || authUser.last_sign_in_at || new Date().toISOString(),
                last_login_at: profileData.last_login_at || profileData.last_sign_in_at || authUser.last_sign_in_at || new Date().toISOString(),
              };

              await saveUserProfile(userProfile);
              localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(userProfile));
              localStorage.setItem('user_role', role);
              localStorage.setItem('user_avatar', avatarResolved);
              setCurrentUser(userProfile);
              setLoading(false);
              return;
            } else {
              // If profile record does not exist in profiles yet, create it
              const role: UserRole = (authUser.user_metadata?.role as UserRole) || 'user';
              const savedAvatar = (typeof localStorage !== 'undefined' ? localStorage.getItem('user_avatar') : null) || '👑';
              const newProfile: UserProfile = {
                id: authUser.id,
                email: authUser.email,
                cedula: authUser.user_metadata?.cedula || '',
                first_name: authUser.user_metadata?.first_name || '',
                last_name: authUser.user_metadata?.last_name || '',
                name: authUser.user_metadata?.first_name ? `${authUser.user_metadata.first_name || ''} ${authUser.user_metadata.last_name || ''}`.trim() : authUser.email?.split('@')[0] || 'Usuario',
                avatar: savedAvatar,
                avatar_url: savedAvatar,
                role,
                is_active: true,
                currency: 'USD',
                theme_mode: 'navy',
                accent_color: '#147DF0',
                sync_status: 'synced',
              created_at: new Date().toISOString(),
            };

            try {
              const profilePayload = {
                id: authUser.id,
                email: authUser.email || `${authUser.id}@lanitapp.local`,
                cedula: authUser.user_metadata?.cedula || '',
                first_name: authUser.user_metadata?.first_name || '',
                last_name: authUser.user_metadata?.last_name || '',
                role,
                updated_at: new Date().toISOString(),
              };
              console.log('[Supabase Profiles Init Payload]:', profilePayload);
              const { error: profInitErr } = await supabase.from('profiles').upsert(profilePayload);
              if (profInitErr) {
                console.error('[Supabase Profiles Init Error]:', profInitErr.message, profInitErr.details);
              }
            } catch (e) {
              console.warn('Profile upsert notice:', e);
            }

            await saveUserProfile(newProfile);
            localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(newProfile));
            localStorage.setItem('user_role', role);
            setCurrentUser(newProfile);
            setLoading(false);
            return;
          }
        }
      }

      // No active session in Supabase: Clear any residual tokens
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      localStorage.removeItem('user_role');
      sessionStorage.clear();
      setCurrentUser(null);
    } catch (err: any) {
      console.error('Auth initialization error:', err);
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      localStorage.removeItem('user_role');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();

    // Listen to Supabase auth state changes
    const client = supabase;
    if (isSupabaseConfigured() && client) {
      const { data: listener } = client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const authUser = session.user;
          const { data: profileData } = await client
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (profileData) {
            const role: UserRole = profileData.role === 'admin' ? 'admin' : 'user';
            const savedAvatar = (typeof localStorage !== 'undefined' ? localStorage.getItem('user_avatar') : null) || '👑';
            const avatarResolved = profileData.avatar_url || profileData.avatar || savedAvatar;
            const userProfile: UserProfile = {
              id: profileData.id,
              email: profileData.email || authUser.email,
              cedula: profileData.cedula || authUser.user_metadata?.cedula || '',
              first_name: profileData.first_name || authUser.user_metadata?.first_name || '',
              last_name: profileData.last_name || authUser.user_metadata?.last_name || '',
              name: profileData.name || (profileData.first_name ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() : 'Usuario'),
              avatar: avatarResolved,
              avatar_url: avatarResolved,
              role,
              is_active: true,
              currency: profileData.currency || 'USD',
              theme_mode: profileData.theme_mode || 'navy',
              accent_color: profileData.accent_color || '#147DF0',
              sync_status: 'synced',
              created_at: profileData.created_at,
            };
            await saveUserProfile(userProfile);
            localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(userProfile));
            localStorage.setItem('user_role', role);
            localStorage.setItem('user_avatar', avatarResolved);
            setCurrentUser(userProfile);
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
          localStorage.removeItem('user_role');
          sessionStorage.clear();
          setCurrentUser(null);
        }
      });

      return () => {
        listener.subscription.unsubscribe();
      };
    }
  }, [initAuth]);

  /**
   * Helper para buscar perfil por documento
   */
  const findProfileByDocument = async (fullCedula: string) => {
    if (!supabase) return null;
    const clean = fullCedula.trim();

    // 1. ILIKE exact search on cedula (e.g. 'V-28322083')
    const { data: direct } = await supabase
      .from('profiles')
      .select('*')
      .ilike('cedula', clean)
      .maybeSingle();
    if (direct) return direct;

    // 2. Secondary fallback with prefix variants
    const rawNumber = clean.replace(/^[VEJGvejg][- ]?/, '').trim();
    if (rawNumber) {
      const prefixes = ['V-', 'E-', 'J-', 'G-', ''];
      for (const p of prefixes) {
        const queryVal = `${p}${rawNumber}`;
        const { data: variant } = await supabase
          .from('profiles')
          .select('*')
          .ilike('cedula', queryVal)
          .maybeSingle();
        if (variant) return variant;
      }
    }

    return null;
  };

  /**
   * Inicio de Sesión Exclusivo por Cédula de Identidad
   */
  const signInWithCedula = async (
    fullCedula: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setLoading(true);

    const cleanCedula = fullCedula.trim();
    if (!cleanCedula || !password) {
      setLoading(false);
      const msg = 'Por favor ingresa tu cédula de identidad y contraseña.';
      setError(msg);
      return { success: false, error: msg };
    }

    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      const msg = 'Supabase no está configurado. Verifica las credenciales en .env.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      // 1. Consultar profiles por cedula
      const profile = await findProfileByDocument(cleanCedula);

      // 2. Si no existe profile, mostrar mensaje exacto
      if (!profile || !profile.email) {
        setLoading(false);
        const notFoundMsg = `No existe ningún usuario registrado con el documento ${cleanCedula}`;
        setError(notFoundMsg);
        return { success: false, error: notFoundMsg };
      }

      // 3. Ejecutar signInWithPassword
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: password,
      });

      // 4. Si la contraseña es incorrecta
      if (authError) {
        setLoading(false);
        const msg = authError.message.toLowerCase().includes('invalid login credentials') ||
          authError.message.toLowerCase().includes('invalid grant') ||
          authError.status === 400
            ? 'Contraseña incorrecta. Verifica tus datos.'
            : authError.message;
        setError(msg);
        return { success: false, error: msg };
      }

      if (authData.user) {
        const role: UserRole = profile.role === 'admin' ? 'admin' : 'user';
        const nowIso = new Date().toISOString();
        const userProfile: UserProfile = {
          id: authData.user.id,
          email: authData.user.email,
          cedula: profile.cedula || cleanCedula,
          first_name: profile.first_name || authData.user.user_metadata?.first_name || '',
          last_name: profile.last_name || authData.user.user_metadata?.last_name || '',
          name: profile.name || (profile.first_name ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Usuario'),
          avatar: profile.avatar || '👤',
          role,
          is_active: true,
          currency: profile.currency || 'USD',
          theme_mode: profile.theme_mode || 'navy',
          accent_color: profile.accent_color || '#147DF0',
          last_sign_in_at: nowIso,
          last_login_at: nowIso,
          sync_status: 'synced',
        };

        // Update profiles in Supabase
        if (supabase) {
          try {
            await supabase
              .from('profiles')
              .update({ last_sign_in_at: nowIso, last_login_at: nowIso, updated_at: nowIso })
              .eq('id', authData.user.id);
          } catch (e) {
            console.warn('Could not update last_sign_in_at:', e);
          }
        }

        await saveUserProfile(userProfile);
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(userProfile));
        setCurrentUser(userProfile);
        setLoading(false);
        return { success: true };
      }

      setLoading(false);
      return { success: false, error: 'No se pudo iniciar sesión. Intenta nuevamente.' };
    } catch (err: any) {
      setLoading(false);
      const msg = err.message || 'Error inesperado durante el inicio de sesión.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  /**
   * Registro de Nuevos Usuarios con Metadata de Cédula
   */
  const signUp = async (data: {
    firstName: string;
    lastName: string;
    cedula: string;
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    setLoading(true);

    const fullCedula = data.cedula.trim();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanFirstName = data.firstName.trim();
    const cleanLastName = data.lastName.trim();
    const fullName = `${cleanFirstName} ${cleanLastName}`.trim();

    if (!fullCedula || !cleanEmail || !data.password || !cleanFirstName) {
      setLoading(false);
      const msg = 'Por favor completa todos los campos requeridos.';
      setError(msg);
      return { success: false, error: msg };
    }

    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      const msg = 'Supabase no está configurado.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      // 1. Verificar si la cédula ya existe
      const existingProfile = await findProfileByDocument(fullCedula);
      if (existingProfile) {
        setLoading(false);
        const msg = `El documento de identidad ${fullCedula} ya se encuentra registrado en el sistema.`;
        setError(msg);
        return { success: false, error: msg };
      }

      // 2. Enviar metadata directamente a Supabase Auth
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            cedula: fullCedula,
            first_name: cleanFirstName,
            last_name: cleanLastName,
            role: 'user',
          },
        },
      });

      if (signUpErr) {
        setLoading(false);
        setError(signUpErr.message);
        return { success: false, error: signUpErr.message };
      }

      if (authData.user) {
        const userId = authData.user.id;
        const userProfile: UserProfile = {
          id: userId,
          email: cleanEmail,
          cedula: fullCedula,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          name: fullName,
          avatar: '👤',
          role: 'user',
          is_active: true,
          currency: 'USD',
          theme_mode: 'navy',
          accent_color: '#147DF0',
          sync_status: 'synced',
          created_at: new Date().toISOString(),
        };

        const profilePayload = {
          id: userId,
          email: cleanEmail || authData.user.email || '',
          cedula: fullCedula,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          role: 'user',
          updated_at: new Date().toISOString(),
        };

        console.log('[Supabase Profiles SignUp Payload]:', profilePayload);
        const { error: profErr } = await supabase.from('profiles').upsert(profilePayload);
        if (profErr) {
          console.error('[Supabase Profiles SignUp Error]:', profErr.message, profErr.details);
        }

        await saveUserProfile(userProfile);
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(userProfile));
        setCurrentUser(userProfile);
        setLoading(false);
        return { success: true };
      }

      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      const msg = err.message || 'Error registrando el usuario.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  /**
   * Recuperación de Contraseña por Cédula o Email
   */
  const resetPassword = async (
    identifier: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      return { success: false, error: 'Por favor ingresa tu cédula de identidad.' };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase no está configurado.' };
    }

    try {
      let targetEmail = cleanId;

      if (!cleanId.includes('@')) {
        const profile = await findProfileByDocument(cleanId);
        if (!profile || !profile.email) {
          return { success: false, error: `No se encontró ningún usuario registrado con el documento ${cleanId}` };
        }
        targetEmail = profile.email;
      }

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetErr) {
        return { success: false, error: resetErr.message };
      }

      return {
        success: true,
        message: `Se ha enviado el enlace de restablecimiento a tu correo electrónico asociado (${targetEmail}). Revisa tu bandeja de entrada o spam.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al procesar la recuperación de contraseña.' };
    }
  };

  /**
   * Cerrar Sesión Definitivo
   */
  const signOut = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut().catch((e) => console.warn('Supabase signout notice:', e));
      }
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      localStorage.removeItem('lanitapp_last_sync');
      sessionStorage.clear();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Actualizar Perfil de Usuario
   */
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    const avatarVal = updates.avatar_url || updates.avatar || currentUser.avatar_url || currentUser.avatar || localStorage.getItem('user_avatar') || '👑';
    const updated: UserProfile = {
      ...currentUser,
      ...updates,
      avatar: avatarVal,
      avatar_url: avatarVal,
      sync_status: 'synced',
    };

    localStorage.setItem('user_avatar', avatarVal);
    await saveUserProfile(updated);
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(updated));
    setCurrentUser(updated);

    if (isSupabaseConfigured() && supabase && navigator.onLine) {
      try {
        const updatePayload = {
          email: currentUser.email || `${currentUser.id}@lanitapp.local`,
          first_name: updated.first_name || updated.name?.split(' ')[0] || '',
          last_name: updated.last_name || updated.name?.split(' ').slice(1).join(' ') || '',
          updated_at: new Date().toISOString(),
        };
        console.log('[Supabase Profiles Update Payload]:', updatePayload);
        await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', currentUser.id);
      } catch (e) {
        console.warn('Sync profile err:', e);
      }
    }
  };

  return {
    currentUser,
    isAuthenticated: Boolean(currentUser && currentUser.id),
    isAdmin: currentUser?.role === 'admin',
    loading,
    error,
    signInWithCedula,
    signUp,
    resetPassword,
    signOut,
    updateProfile,
    refetchAuth: initAuth,
  };
}
