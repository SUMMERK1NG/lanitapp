import { useState, useEffect, useCallback } from 'react';
import type { UserProfile, UserRole } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { db, saveUserProfile, setActiveUserId, setLastSyncTimestampInMemory } from '../lib/db.ts';
import { logger } from '../utils/logger.ts';
import { sendPasswordResetEmail } from '../lib/emailConfig.ts';

/**
 * Obtiene la IP pública del cliente con rotación de múltiples servicios y timeout seguro
 */
export const getPublicClientIp = async (): Promise<string | null> => {
  const providers = [
    { url: 'https://api.ipify.org?format=json', parse: (d: any) => d?.ip },
    { url: 'https://api64.ipify.org?format=json', parse: (d: any) => d?.ip },
    { url: 'https://ipapi.co/json/', parse: (d: any) => d?.ip },
    { url: 'https://api.db-ip.com/v2/free/myip', parse: (d: any) => d?.ipAddress },
    { url: 'https://icanhazip.com/', parse: (d: any) => (typeof d === 'string' ? d.trim() : null) },
  ];

  for (const provider of providers) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(provider.url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const text = await res.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        const ip = provider.parse(parsed);
        if (ip && typeof ip === 'string' && ip.trim().length > 0) {
          return ip.trim();
        }
      }
    } catch {
      // Continuar con el siguiente proveedor
    }
  }
  return null;
};

/**
 * Actualiza en Supabase la fecha de último acceso e IP pública del usuario
 */
export const recordUserAccess = async (userId: string, explicitIp?: string) => {
  if (!userId || !supabase || !isSupabaseConfigured()) return;

  const nowIso = new Date().toISOString();
  let clientIp = explicitIp;
  if (!clientIp) {
    clientIp = (await getPublicClientIp()) || undefined;
  }

  const payload: Record<string, any> = {
    updated_at: nowIso,
    last_sign_in_at: nowIso,
    last_login_at: nowIso,
  };
  if (clientIp) {
    payload.last_sign_in_ip = clientIp;
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      logger.warn('[RECORD ACCESS ERROR]:', error.message);
    } else {
      logger.dev('[RECORD ACCESS SUCCESS] Acceso e IP guardados:', { userId, clientIp, nowIso });
    }
  } catch (err) {
    logger.warn('[RECORD ACCESS EXCEPTION]:', err);
  }
};

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(() => {
    try {
      const flash = sessionStorage.getItem('lanitapp_auth_flash_error');
      if (flash) return flash;
    } catch {}
    return null;
  });

  // Initialize auth session on load (F5 / start)
  const initAuth = useCallback(async () => {
    setLoading(true);

    // 0. Revisar si hay un mensaje de error flash por enlace de recuperación expirado o inválido
    let flashError: string | null = null;
    try {
      flashError = sessionStorage.getItem('lanitapp_auth_flash_error');
    } catch {}
    if (flashError) {
      logger.warn('[Auth] Enlace expirado detectado vía flash error:', flashError);
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      setActiveUserId('');
      setCurrentUser(null);
      setError(flashError);
      setLoading(false);
      return;
    }

    setError(null);

    // 0.1 Detectar si el usuario aterrizó con un enlace de recuperación inválido o expirado
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (
      hash.includes('error=') ||
      hash.includes('error_code=') ||
      search.includes('error=') ||
      search.includes('error_code=')
    ) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, '?'));
      const searchParams = new URLSearchParams(search);
      const errCode = hashParams.get('error_code') || searchParams.get('error_code') || '';
      const errDesc = hashParams.get('error_description') || searchParams.get('error_description') || '';
      const errName = hashParams.get('error') || searchParams.get('error') || '';

      let friendlyMsg = 'El enlace de recuperación ha expirado o ya fue utilizado. Por favor solicita uno nuevo.';
      if (errCode === 'otp_expired' || errDesc.toLowerCase().includes('expired')) {
        friendlyMsg = 'El enlace de recuperación ha expirado o ya fue utilizado. Por favor solicita uno nuevo.';
      } else if (errName === 'access_denied') {
        friendlyMsg = 'Acceso denegado. El enlace no es válido o ha caducado.';
      }

      logger.warn('[Auth] Enlace de recuperación inválido o expirado detectado en URL:', { errCode, errDesc, errName });

      // Limpiar inmediatamente el hash/parámetros de la URL para que no quede residuo
      try {
        window.history.replaceState(null, '', window.location.origin + window.location.pathname);
      } catch {}

      // FORZAR CIERRE DE CUALQUIER SESIÓN PREVIA: No debe abrir el menú ni el dashboard
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      setActiveUserId('');
      try {
        sessionStorage.clear();
        sessionStorage.setItem('lanitapp_auth_flash_error', friendlyMsg);
      } catch {}
      setCurrentUser(null);
      setError(friendlyMsg);
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        // 1. Obtener la sesión almacenada en el cliente
        let { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr) {
          logger.warn('Session check error:', sessionErr.message);
          await supabase.auth.signOut().catch(() => {});
          setActiveUserId('');
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        let session = sessionData?.session;

        // 2. Si hay sesión, verificar si el token JWT expiró o está próximo a expirar (< 60s)
        if (session) {
          const expiresAt = session.expires_at || 0;
          const nowSec = Math.floor(Date.now() / 1000);
          if (expiresAt && expiresAt - nowSec < 60) {
            logger.info('[Auth] Token JWT expirado o próximo a expirar. Renovando sesión activamente...');
            const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
            if (refreshErr || !refreshData?.session) {
              logger.warn('[Auth] No se pudo renovar la sesión expirada:', refreshErr?.message);
              // La sesión caducó definitivamente. Limpiar para no inundar de errores 401
              await supabase.auth.signOut().catch(() => {});
              setActiveUserId('');
              setCurrentUser(null);
              setLoading(false);
              return;
            }
            session = refreshData.session;
          }
        }

        if (session?.user) {
          const authUser = session.user;
          // 3. Consultar perfil en profiles
          let { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          // Si hay error de autenticación (401 / PGRST301 / JWT expired)
          if (profileErr) {
            const isAuthError =
              profileErr.code === 'PGRST301' ||
              profileErr.message?.toLowerCase().includes('jwt') ||
              profileErr.message?.toLowerCase().includes('token') ||
              profileErr.message?.toLowerCase().includes('unauthorized');

            if (isAuthError) {
              logger.warn('[Auth] Error de autorización al consultar perfil. Intentando refresco de emergencia...');
              const { data: emergencyRefresh, error: emergencyErr } = await supabase.auth.refreshSession();
              if (!emergencyErr && emergencyRefresh?.session) {
                const retry = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', authUser.id)
                  .maybeSingle();
                profileData = retry.data;
                profileErr = retry.error;
              } else {
                logger.warn('[Auth] Refresco de emergencia falló. Cerrando sesión limpia.');
                await supabase.auth.signOut().catch(() => {});
                setActiveUserId('');
                setCurrentUser(null);
                setLoading(false);
                return;
              }
            }
          }

          // Si tras el reintento persiste un error de autenticación fatal
          if (profileErr) {
            const isFatalAuth =
              profileErr.code === 'PGRST301' ||
              profileErr.message?.toLowerCase().includes('jwt') ||
              profileErr.message?.toLowerCase().includes('unauthorized');

            if (isFatalAuth) {
              logger.error('[Auth] Token caducado o inválido:', profileErr.message);
              await supabase.auth.signOut().catch(() => {});
              setActiveUserId('');
              setCurrentUser(null);
              setLoading(false);
              return;
            }
          }

          if (profileData) {
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
              last_sign_in_ip: profileData.last_sign_in_ip || undefined,
            };

            await saveUserProfile(userProfile);
            setActiveUserId(userProfile.id);
            if (typeof document !== 'undefined') {
              const root = document.documentElement;
              root.classList.remove('theme-navy', 'theme-dark', 'theme-emerald', 'theme-purple', 'theme-moca', 'theme-light');
              root.classList.add(`theme-${userProfile.theme_mode || 'navy'}`);
              root.style.setProperty('--primary', userProfile.accent_color || '#147DF0');
              root.style.setProperty('--primary-custom', userProfile.accent_color || '#147DF0');
            }
            setCurrentUser(userProfile);
            setLoading(false);

            // Registrar acceso e IP del usuario en segundo plano al restaurar sesión
            recordUserAccess(userProfile.id).catch(() => {});
            return;
          } else if (!profileErr) {
            // Solo si NO hubo error de red/auth pero la fila no existe aún, se inicializa el perfil
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
        // Si hay un error de enlace expirado o inválido activo, bloquear cualquier inicio de sesión automático
        let hasFlash = false;
        try {
          hasFlash = Boolean(sessionStorage.getItem('lanitapp_auth_flash_error'));
        } catch {}
        if (hasFlash) {
          logger.warn('[Auth] Bloqueando evento onAuthStateChange debido a flash error de enlace expirado.');
          return;
        }

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const authUser = session.user;
          const { data: profileData, error: profileErr } = await client
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
    const clean = fullCedula.trim();
    if (!clean) return null;

    // 1. Verificación local en Dexie (inmediata)
    try {
      const local = await db.user_profiles
        .where('cedula')
        .equalsIgnoreCase(clean)
        .first();
      if (local) return local;
    } catch {}

    if (!supabase) return null;

    // 2. ILIKE exact search on cedula (e.g. 'V-28322083')
    try {
      const { data: direct } = await supabase
        .from('profiles')
        .select('*')
        .ilike('cedula', clean)
        .maybeSingle();
      if (direct) return direct;

      // 3. Secondary fallback with prefix variants
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
    } catch (err) {
      logger.warn('[Auth] Error consultando perfil por documento:', err);
    }

    return null;
  };

  /**
   * Helper para buscar perfil por correo electrónico
   */
  const findProfileByEmail = async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return null;

    // 1. Verificación local en Dexie (inmediata)
    try {
      const local = await db.user_profiles
        .where('email')
        .equalsIgnoreCase(clean)
        .first();
      if (local) return local;
    } catch {}

    if (!supabase) return null;

    // 2. Búsqueda en Supabase profiles
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', clean)
        .maybeSingle();
      if (data) return data;
    } catch (err) {
      logger.warn('[Auth] Error consultando perfil por correo:', err);
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
    sessionStorage.removeItem('lanitapp_auth_flash_error');
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

        // Obtener IP pública de acceso con rotación confiable de múltiples proveedores
        const clientIp = (await getPublicClientIp()) || undefined;
        if (clientIp) {
          userProfile.last_sign_in_ip = clientIp;
        }

        // Actualizar profiles en Supabase directamente con authData.user.id
        if (supabase && authData.user?.id) {
          try {
            const loginUpdatePayload: Record<string, any> = {
              keep_session: keepSessionVal,
              updated_at: nowIso,
              last_sign_in_at: nowIso,
              last_login_at: nowIso,
            };
            if (clientIp) {
              loginUpdatePayload.last_sign_in_ip = clientIp;
            }

            logger.dev('[LOGIN UPDATE] Actualizando sesión e IP en profiles para:', authData.user.id);
            const { error: updateError } = await supabase
              .from('profiles')
              .update(loginUpdatePayload)
              .eq('id', authData.user.id);

            if (updateError) {
              logger.warn('[PROFILE UPDATE WARNING]:', updateError.message);
            } else {
              logger.dev('[PROFILE UPDATE SUCCESS] Sesión e IP actualizadas correctamente');
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

    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setLoading(false);
      const msg = 'Por favor ingresa un correo electrónico válido.';
      setError(msg);
      return { success: false, error: msg };
    }

    const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,35}$/;
    if (!NAME_REGEX.test(cleanFirstName)) {
      setLoading(false);
      const msg = 'El nombre solo debe contener letras (sin números ni símbolos).';
      setError(msg);
      return { success: false, error: msg };
    }

    if (cleanLastName && !NAME_REGEX.test(cleanLastName)) {
      setLoading(false);
      const msg = 'Los apellidos solo deben contener letras (sin números ni símbolos).';
      setError(msg);
      return { success: false, error: msg };
    }

    const hasMinLength = data.password.length >= 8;
    const hasUpper = /[A-Z]/.test(data.password);
    const hasLower = /[a-z]/.test(data.password);
    const hasNumber = /[0-9]/.test(data.password);
    const hasSpecial = /[^A-Za-z0-9\s]/.test(data.password);

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setLoading(false);
      const msg = 'La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y un carácter especial (@, #, $, *, etc.).';
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
      // 1. Verificar si la cédula ya existe en la base de datos o localmente
      const existingProfile = await findProfileByDocument(fullCedula);
      if (existingProfile) {
        setLoading(false);
        const msg = 'La cédula ya se encuentra registrada. Por favor inicia sesión con tu cédula o recupera tu contraseña.';
        setError(msg);
        return { success: false, error: msg };
      }

      // 2. Verificar si el correo ya existe en profiles o localmente
      const existingEmailProfile = await findProfileByEmail(cleanEmail);
      if (existingEmailProfile) {
        setLoading(false);
        const msg = 'El correo ya se encuentra registrado. Por favor inicia sesión o utiliza otro correo.';
        setError(msg);
        return { success: false, error: msg };
      }

      // 3. Enviar metadata directamente a Supabase Auth
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
        let errorMsg = signUpErr.message;
        const lowerErr = errorMsg.toLowerCase();
        if (
          lowerErr.includes('already registered') ||
          lowerErr.includes('already in use') ||
          lowerErr.includes('unique constraint') ||
          lowerErr.includes('already exists')
        ) {
          errorMsg = 'El correo ya se encuentra registrado en el sistema. Por favor inicia sesión con tu cédula o recupera tu contraseña.';
        }
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // 4. Detección de usuario ya existente en Supabase Auth cuando anti-user-enumeration está activo
      if (
        authData.user &&
        Array.isArray(authData.user.identities) &&
        authData.user.identities.length === 0
      ) {
        setLoading(false);
        const msg = 'El correo ya se encuentra registrado en el sistema. Por favor inicia sesión con tu cédula o recupera tu contraseña.';
        setError(msg);
        return { success: false, error: msg };
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
   * Helper con timeout para evitar congelamientos de la app (Promise hanging)
   */
  const withTimeout = <T>(promise: Promise<T>, timeoutMs = 8000, errorMsg = 'TIMEOUT'): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs)),
    ]);
  };

  /**
   * Recuperación de Contraseña por Cédula o Email (Segura, con protección de timeout y soporte Resend)
   */
  const resetPassword = async (
    document: string,
    documentType?: 'cedula' | 'email'
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const cleanDoc = document.trim();
      if (!cleanDoc) {
        return {
          success: false,
          message: 'Por favor ingresa tu cédula o correo electrónico.',
          error: 'EMPTY_INPUT',
        };
      }

      if (!isSupabaseConfigured() || !supabase) {
        return {
          success: false,
          message: 'El servicio de autenticación no está disponible en este momento.',
          error: 'AUTH_UNAVAILABLE',
        };
      }

      logger.dev('[RESET PASSWORD] Iniciando recuperación para:', cleanDoc);

      const isEmail = documentType === 'email' || cleanDoc.includes('@');
      let userEmail: string | null = null;

      if (isEmail) {
        userEmail = cleanDoc.toLowerCase();
      } else {
        // Buscar por cédula en perfiles con timeout de 6 segundos
        const profile = await withTimeout(
          findProfileByDocument(cleanDoc),
          6000,
          'DB_TIMEOUT'
        ).catch(() => null);

        if (!profile || !profile.email) {
          logger.warn('[RESET PASSWORD] No se encontró perfil con cédula:', cleanDoc);
          return {
            success: false,
            message: 'No se encontró una cuenta asociada a esta cédula.',
            error: 'PROFILE_NOT_FOUND',
          };
        }

        userEmail = profile.email;
      }

      if (!userEmail) {
        return {
          success: false,
          message: 'No se pudo determinar el correo del usuario.',
          error: 'NO_EMAIL',
        };
      }

      logger.dev('[RESET PASSWORD] Enviando enlace a:', userEmail);

      // 1. Enviar solicitud de recuperación a Supabase Auth con timeout de 8 segundos
      const resetPromise = supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      const { error: authError } = await withTimeout(resetPromise, 8000, 'AUTH_TIMEOUT').catch(
        (timeoutErr) => ({
          error: {
            message: timeoutErr.message === 'AUTH_TIMEOUT' ? 'TIMEOUT' : timeoutErr.message,
            status: 408,
          },
        })
      );

      if (authError) {
        const errMsg = authError.message?.toLowerCase() || '';

        // Manejar Rate Limit 429
        if (
          authError.status === 429 ||
          errMsg.includes('429') ||
          errMsg.includes('rate limit') ||
          errMsg.includes('security purposes') ||
          errMsg.includes('seconds') ||
          errMsg.includes('too many')
        ) {
          logger.warn('[RESET PASSWORD] Rate limit excedido para:', userEmail);
          return {
            success: false,
            message: 'Por motivos de seguridad, debes esperar 60 segundos antes de solicitar otro enlace.',
            error: 'RATE_LIMIT',
          };
        }

        if (errMsg === 'timeout' || authError.status === 408) {
          logger.warn('[RESET PASSWORD] Timeout de respuesta:', userEmail);
          return {
            success: false,
            message: 'El servidor tardó demasiado en responder. Por favor verifica tu conexión e intenta de nuevo.',
            error: 'TIMEOUT',
          };
        }

        logger.error('[RESET PASSWORD ERROR]:', authError);
        return {
          success: false,
          message: 'Error al procesar la solicitud. Por favor intenta de nuevo.',
          error: authError.message,
        };
      }

      // 2. Intentar además el envío directo vía Resend Edge Function
      sendPasswordResetEmail(userEmail).catch((resendErr) => {
        logger.dev('[RESET PASSWORD] Resend Edge Function notice:', resendErr);
      });

      logger.dev('[RESET PASSWORD SUCCESS] Enlace enviado a:', userEmail);

      return {
        success: true,
        message: 'Si existe una cuenta asociada, recibirás un enlace de recuperación en tu correo.',
      };
    } catch (error: any) {
      logger.error('[RESET PASSWORD UNEXPECTED ERROR]:', error);
      return {
        success: false,
        message: 'Ocurrió un error inesperado. Por favor intenta de nuevo.',
        error: error instanceof Error ? error.message : 'Unknown error',
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
      let flash: string | null = null;
      try {
        flash = sessionStorage.getItem('lanitapp_auth_flash_error');
        sessionStorage.clear();
        if (flash) {
          sessionStorage.setItem('lanitapp_auth_flash_error', flash);
        }
      } catch {}
      setCurrentUser(null);
      if (flash) {
        setError(flash);
      }
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

  /**
   * Cambio de contraseña para el usuario actualmente autenticado (con validación de contraseña actual)
   */
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const curPwd = currentPassword.trim();
    const newPwd = newPassword.trim();

    if (!curPwd) {
      return { success: false, error: 'Por favor ingresa tu contraseña actual.' };
    }

    if (!newPwd) {
      return { success: false, error: 'Por favor ingresa tu nueva contraseña.' };
    }

    if (curPwd === newPwd) {
      return { success: false, error: 'La nueva contraseña debe ser diferente a la contraseña actual.' };
    }

    const hasMinLength = newPwd.length >= 8;
    const hasUpper = /[A-Z]/.test(newPwd);
    const hasLower = /[a-z]/.test(newPwd);
    const hasNumber = /[0-9]/.test(newPwd);
    const hasSpecial = /[^A-Za-z0-9\s]/.test(newPwd);

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return {
        success: false,
        error: 'La nueva contraseña debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y un carácter especial (@, #, $, *, -, etc.).',
      };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase no está configurado.' };
    }

    try {
      // 1. Obtener email de la sesión activa del usuario
      const userEmail = currentUser?.email || (await supabase.auth.getUser()).data?.user?.email;

      if (!userEmail) {
        return { success: false, error: 'No se pudo verificar la sesión actual del usuario.' };
      }

      // 2. Validar que la contraseña actual ingresada sea 100% correcta
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: curPwd,
      });

      if (verifyErr) {
        logger.warn('[Auth] Validación fallida de contraseña actual:', verifyErr.message);
        return { success: false, error: 'La contraseña actual ingresada no es correcta. Por favor verifica.' };
      }

      // 3. Proceder a actualizar la contraseña
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPwd,
      });

      if (updateErr) {
        let msg = updateErr.message;
        const lower = msg.toLowerCase();
        if (lower.includes('should be different')) {
          msg = 'La nueva contraseña debe ser diferente a la contraseña anterior.';
        } else if (lower.includes('at least')) {
          msg = 'La contraseña debe tener al menos 8 caracteres.';
        }
        return { success: false, error: msg };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al actualizar la contraseña.' };
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
    changePassword,
    signOut,
    updateProfile,
    refetchAuth: initAuth,
    checkCedulaExists: async (cedula: string) => Boolean(await findProfileByDocument(cedula)),
    checkEmailExists: async (email: string) => Boolean(await findProfileByEmail(email)),
  };
}
