-- ==============================================================================
-- LANITAPP - SCRIPT DE BLINDAJE DE SEGURIDAD (RLS, ROLES Y RPCs DE ACCESO)
-- Corrección de recursión 42P17 mediante función auxiliar SECURITY DEFINER
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 2. FUNCIÓN AUXILIAR is_admin() CON SECURITY DEFINER (EVITA RECURSIÓN 42P17)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ==============================================================================
-- 3. TABLA PROFILES: BLINDAJE RLS ESTRICTO SIN RECURSIÓN
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas
DROP POLICY IF EXISTS "Allow all operations for anon on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Política SELECT: Los usuarios autenticados leen su propio perfil.
-- Los administradores (evaluados mediante is_admin()) pueden ver todos los perfiles sin causar recursión infinita.
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
    auth.uid() = id
    OR
    public.is_admin()
);

-- Política INSERT: Solo puede insertarse un perfil si el id coincide con el usuario autenticado
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = id
);

-- Política UPDATE: Un usuario actualiza su propio perfil (o un admin a otros)
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated
USING (
    auth.uid() = id
    OR
    public.is_admin()
)
WITH CHECK (
    auth.uid() = id
    OR
    public.is_admin()
);

-- Política DELETE: Exclusivo para administradores
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE TO authenticated
USING (
    public.is_admin()
);

-- ==============================================================================
-- 4. TRIGGER PARA PROTEGER LA COLUMNA 'role' (PREVENIR ESCALADA DE PRIVILEGIOS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- Si el rol está cambiando
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Si no es admin autenticado, revertir el rol al original
        IF NOT public.is_admin() THEN
            NEW.role := OLD.role;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

-- ==============================================================================
-- 5. FUNCIONES RPC SEGURAS PARA AUTENTICACIÓN (LOGIN Y REGISTRO POR CÉDULA)
-- ==============================================================================

-- Función segura para obtener el email a partir de la cédula durante el login
CREATE OR REPLACE FUNCTION public.get_login_identifier(p_cedula text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    clean_cedula text;
    found_email text;
    raw_num text;
BEGIN
    clean_cedula := trim(p_cedula);
    IF clean_cedula IS NULL OR clean_cedula = '' THEN
        RETURN jsonb_build_object('exists', false, 'email', null);
    END IF;

    -- 1. Búsqueda exacta por cédula (ignorando mayúsculas/minúsculas)
    SELECT email INTO found_email
    FROM public.profiles
    WHERE lower(trim(cedula)) = lower(clean_cedula)
    LIMIT 1;

    -- 2. Fallback con normalización de prefijo (V-, E-, J-, G- o números sueltos)
    IF found_email IS NULL THEN
        raw_num := regexp_replace(clean_cedula, '^[VEJGvejg][- ]?', '');
        IF raw_num <> '' THEN
            SELECT email INTO found_email
            FROM public.profiles
            WHERE regexp_replace(cedula, '^[VEJGvejg][- ]?', '') = raw_num
            LIMIT 1;
        END IF;
    END IF;

    IF found_email IS NOT NULL THEN
        RETURN jsonb_build_object('exists', true, 'email', found_email);
    ELSE
        RETURN jsonb_build_object('exists', false, 'email', null);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_identifier(text) TO anon, authenticated;

-- Función segura para verificar si una cédula ya existe al momento de registrarse
CREATE OR REPLACE FUNCTION public.check_cedula_exists(p_cedula text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    clean_cedula text;
    raw_num text;
    has_row boolean := false;
BEGIN
    clean_cedula := trim(p_cedula);
    IF clean_cedula IS NULL OR clean_cedula = '' THEN
        RETURN false;
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.profiles
        WHERE lower(trim(cedula)) = lower(clean_cedula)
    ) INTO has_row;

    IF NOT has_row THEN
        raw_num := regexp_replace(clean_cedula, '^[VEJGvejg][- ]?', '');
        IF raw_num <> '' THEN
            SELECT EXISTS(
                SELECT 1 FROM public.profiles
                WHERE regexp_replace(cedula, '^[VEJGvejg][- ]?', '') = raw_num
            ) INTO has_row;
        END IF;
    END IF;

    RETURN has_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_cedula_exists(text) TO anon, authenticated;

-- Función segura para verificar si un correo ya existe al momento de registrarse
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE lower(trim(email)) = lower(trim(p_email))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;

-- ==============================================================================
-- 6. TABLA ACCOUNTS: BLINDAJE RLS ESTRICTO POR USUARIO
-- ==============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for anon on accounts" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select_policy" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert_policy" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update_policy" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete_policy" ON public.accounts;

CREATE POLICY "accounts_select_policy" ON public.accounts
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_policy" ON public.accounts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_policy" ON public.accounts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_delete_policy" ON public.accounts
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. TABLA FORTNIGHT_ITEM_STATES: BLINDAJE RLS ESTRICTO POR USUARIO
-- ==============================================================================

ALTER TABLE public.fortnight_item_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for anon on fortnight_item_states" ON public.fortnight_item_states;
DROP POLICY IF EXISTS "fortnight_item_states_select_policy" ON public.fortnight_item_states;
DROP POLICY IF EXISTS "fortnight_item_states_insert_policy" ON public.fortnight_item_states;
DROP POLICY IF EXISTS "fortnight_item_states_update_policy" ON public.fortnight_item_states;
DROP POLICY IF EXISTS "fortnight_item_states_delete_policy" ON public.fortnight_item_states;

CREATE POLICY "fortnight_item_states_select_policy" ON public.fortnight_item_states
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "fortnight_item_states_insert_policy" ON public.fortnight_item_states
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fortnight_item_states_update_policy" ON public.fortnight_item_states
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fortnight_item_states_delete_policy" ON public.fortnight_item_states
FOR DELETE TO authenticated
USING (auth.uid() = user_id);
