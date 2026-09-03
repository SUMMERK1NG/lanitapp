import { useState, useEffect, useCallback } from 'react';
import type { UserProfile, UserRole } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { saveUserProfile, setActiveUserId, setLastSyncTimestampInMemory } from '../lib/db.ts';
import { logger } from '../utils/logger.ts';

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
          logger.warn('Session check error:', sessionErr.message);
          setActiveUserId('');
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
              const avatarResolved = profileData.avatar_url || profileData.avatar || '👑';
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
                last_active_view: profileData.last_active_view || 'dashboard',
                keep_session: profileData.keep_session ?? false,
                sync_status: 'synced',
                created_at: profileData.created_at,
                last_sign_in_at: profileData.last_sign_in_at || profileData.last_login_at || authUser.last_sign_in_at || new Date().toISOString(),
                last_login_at: profileData.last_login_at || profileData.last_sign_in_at || authUser.last_sign_in_at || new Date().toISOString(),
              };

              await saveUserProfile(userProfile);
              setActiveUserId(userProfile.id);
              // El rol debe venir ÚNICAMENTE de Supabase Auth/Profiles. No se permite almacenamiento local del rol por seguridad.
              // Tema y color de acento se manejan de forma centralizada y sincronizada en Supabase profiles
              if (typeof document !== 'undefined') {
                const root = document.documentElement;
                root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
                root.classList.add(`theme-${userProfile.theme_mode || 'navy'}`);
                root.style.setProperty('--primary', userProfile.accent_color || '#147DF0');
                root.style.setProperty('--primary-custom', userProfile.accent_color || '#147DF0');
              }
              setCurrentUser(userProfile);
              setLoading(false);
              return;
            } else {
              // If profile record does not exist in profiles yet, create it
              const role: UserRole = (authUser.user_metadata?.role as UserRole) || 'user';
              const defaultAvatar = '👑';
              const newProfile: UserProfile = {
                id: authUser.id,
                email: authUser.email,
                cedula: authUser.user_metadata?.cedula || '',
                first_name: authUser.user_metadata?.first_name || '',
                last_name: authUser.user_metadata?.last_name || '',
                name: authUser.user_metadata?.first_name ? `${authUser.user_metadata.first_name || ''} ${authUser.user_metadata.last_name || ''}`.trim() : authUser.email?.split('@')[0] || 'Usuario',
                avatar: defaultAvatar,
                avatar_url: defaultAvatar,
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
              logger.dev('[Supabase Profiles Init Payload]:', profilePayload);
              const { error: profInitErr } = await supabase.from('profiles').upsert(profilePayload);
              if (profInitErr) {
                logger.error('[Supabase Profiles Init Error]:', profInitErr.message);
              }
            } catch (e) {
              logger.warn('Profile upsert notice:', e);
            }

            await saveUserProfile(newProfile);
            setActiveUserId(newProfile.id);
            // El rol debe venir ÚNICAMENTE de Supabase Auth/Profiles. No se permite almacenamiento local del rol por seguridad.
            setCurrentUser(newProfile);
            setLoading(false);
            return;
          }
        }
      }

      // No active session in Supabase: Clear any residual tokens
      setActiveUserId('');
      sessionStorage.clear();
      setCurrentUser(null);
    } catch (err: any) {
      logger.error('Auth initialization error:', err);
      setActiveUserId('');
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
            const avatarResolved = profileData.avatar_url || profileData.avatar || '👑';
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
              last_sign_in_at: profileData.last_sign_in_at || authUser.last_sign_in_at,
              last_sign_in_ip: profileData.last_sign_in_ip,
            };
            await saveUserProfile(userProfile);
            setActiveUserId(userProfile.id);
            // El rol debe venir ÚNICAMENTE de Supabase Auth/Profiles. No se permite almacenamiento local del rol por seguridad.
            setCurrentUser(userProfile);
          }
        } else if (event === 'SIGNED_OUT') {
          setActiveUserId('');
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
    password: string,
    keepConnectedOption?: boolean
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
        const keepSessionVal = keepConnectedOption !== undefined ? keepConnectedOption : (profile.keep_session ?? false);
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
          last_active_view: profile.last_active_view || 'dashboard',
          keep_session: keepSessionVal,
          last_sign_in_at: nowIso,
          last_login_at: nowIso,
          sync_status: 'synced',
        };

        // Tema y color de acento se manejan de forma centralizada y sincronizada en Supabase profiles
        if (typeof document !== 'undefined') {
          const root = document.documentElement;
          root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
          root.classList.add(`theme-${userProfile.theme_mode || 'navy'}`);
          root.style.setProperty('--primary', userProfile.accent_color || '#147DF0');
          root.style.setProperty('--primary-custom', userProfile.accent_color || '#147DF0');
        }

        // Obtener IP pública de acceso de forma ligera con timeout de 2 segundos
        let clientIp: string | undefined = undefined;
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 2000);
          const ipRes = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
          clearTimeout(timer);
          if (ipRes.ok) {
            const json = await ipRes.json();
            if (json?.ip) clientIp = String(json.ip).trim();
          }
        } catch {
          // Ignorar silenciosamente si no hay red externa o falla el servicio de IP
        }

        if (clientIp) {
          userProfile.last_sign_in_ip = clientIp;
        }

        // Update profiles in Supabase
        if (supabase) {
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (session?.user) {
              const loginUpdatePayload: Record<string, any> = {
                keep_session: keepSessionVal,
                updated_at: nowIso,
                last_sign_in_at: nowIso,
              };
              if (clientIp) {
                loginUpdatePayload.last_sign_in_ip = clientIp;
              }

              logger.dev('[LOGIN UPDATE] Actualizando sesión e IP en profiles para:', session.user.id);
              const { error: updateError } = await supabase
                .from('profiles')
                .update(loginUpdatePayload)
                .eq('id', session.user.id)
                .select();

              if (updateError) {
                // Fallback resiliente si las columnas aún no han sido migradas en la base de datos de Supabase
                if (updateError.message?.includes('column') || updateError.code === 'PGRST204') {
                  logger.warn('[PROFILE UPDATE]: Columnas last_sign_in_at/last_sign_in_ip pendientes en Supabase. Guardando solo keep_session.');
                  await supabase
                    .from('profiles')
                    .update({ keep_session: keepSessionVal, updated_at: nowIso })
                    .eq('id', session.user.id);
                } else {
                  logger.warn('[PROFILE UPDATE WARNING]:', updateError.message);
                }
              }
            } else if (sessionError) {
              logger.warn('No se obtuvo sesión activa al intentar actualizar profiles:', sessionError.message);
            }
          } catch (e) {
            logger.warn('Could not update profile on login:', e);
          }
        }

        await saveUserProfile(userProfile);
        setActiveUserId(userProfile.id);
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

        logger.dev('[Supabase Profiles SignUp Payload]:', profilePayload);
        const { error: profErr } = await supabase.from('profiles').upsert(profilePayload);
        if (profErr) {
          logger.error('[Supabase Profiles SignUp Error]:', profErr.message);
        }

        await saveUserProfile(userProfile);
        setActiveUserId(userProfile.id);
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
   * Recuperación de Contraseña por Cédula o Email (Segura contra enumeración de usuarios)
   */
  const resetPassword = async (
    identifier: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      return { success: false, error: 'Por favor ingresa tu documento o correo electrónico.' };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'El servicio de autenticación no está disponible en este momento.' };
    }

    const safeGenericMessage =
      'Si existe una cuenta asociada a ese correo o cédula, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y spam.';

    try {
      let targetEmail = cleanId;

      if (!cleanId.includes('@')) {
        const profile = await findProfileByDocument(cleanId);
        if (profile && profile.email) {
          targetEmail = profile.email;
        } else {
          // Protección contra enumeración: Retornar mensaje genérico con éxito
          return {
            success: true,
            message: safeGenericMessage,
          };
        }
      }

      await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      return {
        success: true,
        message: safeGenericMessage,
      };
    } catch {
      // Protección contra enumeración: Nunca filtrar errores que revelen existencia de usuarios
      return {
        success: true,
        message: safeGenericMessage,
      };
    }
  };

  /**
   * Cerrar Sesión Definitivo
   */
  const signOut = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut().catch((e) => logger.warn('Supabase signout notice:', e));
      }
      setActiveUserId('');
      setLastSyncTimestampInMemory(null);
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
    const avatarVal = updates.avatar_url || updates.avatar || currentUser.avatar_url || currentUser.avatar || '👑';
    const updated: UserProfile = {
      ...currentUser,
      ...updates,
      avatar: avatarVal,
      avatar_url: avatarVal,
      sync_status: 'synced',
    };

    await saveUserProfile(updated);
    setActiveUserId(updated.id);
    setCurrentUser(updated);

    // Tema y color de acento se manejan de forma centralizada y sincronizada en Supabase profiles

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (updates.theme_mode) {
        root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
        root.classList.add(`theme-${updates.theme_mode}`);
      }
      if (updates.accent_color) {
        root.style.setProperty('--primary', updates.accent_color);
        root.style.setProperty('--primary-custom', updates.accent_color);
      }
    }

    if (isSupabaseConfigured() && supabase && navigator.onLine) {
      try {
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.theme_mode !== undefined) updatePayload.theme_mode = updates.theme_mode;
        if (updates.accent_color !== undefined) updatePayload.accent_color = updates.accent_color;
        if (updates.first_name !== undefined) updatePayload.first_name = updates.first_name;
        if (updates.last_name !== undefined) updatePayload.last_name = updates.last_name;
        if (updates.name !== undefined) {
          updatePayload.first_name = updates.first_name || updates.name.split(' ')[0] || '';
          updatePayload.last_name = updates.last_name || updates.name.split(' ').slice(1).join(' ') || '';
        }
        if (updates.avatar !== undefined) updatePayload.avatar = updates.avatar;
        if (updates.avatar_url !== undefined) updatePayload.avatar_url = updates.avatar_url;
        if (updates.currency !== undefined) updatePayload.currency = updates.currency;
        if (updates.last_active_view !== undefined) updatePayload.last_active_view = updates.last_active_view;
        if (updates.keep_session !== undefined) updatePayload.keep_session = updates.keep_session;

        delete (updatePayload as any).id;
        delete (updatePayload as any).created_at;

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr || !authData?.user) {
          logger.error('[UPDATE ERROR] No hay sesión activa al actualizar profiles');
          return;
        }

        const targetId = authData.user.id || currentUser.id;
        logger.dev('[UPDATE] Usuario:', targetId, 'Tabla: profiles', 'Datos:', updatePayload);

        const { error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', targetId)
          .select();

        if (error) {
          logger.warn('[Supabase Profiles Update Notice]:', error.message);
          if (error.code === '42703' || error.message?.toLowerCase().includes('column')) {
            const { theme_mode, accent_color, ...safeFallback } = updatePayload;
            if (Object.keys(safeFallback).length > 1) {
              await supabase.from('profiles').update(safeFallback).eq('id', currentUser.id);
            }
          }
        }
      } catch (e) {
        logger.warn('Sync profile err:', e);
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
