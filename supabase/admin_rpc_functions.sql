-- ==============================================================================
-- LANITAPP - FUNCIONES RPC ADMINISTRATIVAS EN SUPABASE
-- Copia y ejecuta este script en el SQL Editor de tu proyecto Supabase:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. Habilitar extensión pgcrypto (requerida para hash seguro de contraseñas)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Función RPC para asignar directamente una contraseña a un usuario por parte de un Administrador
CREATE OR REPLACE FUNCTION public.set_user_password_by_admin(
    target_user_id uuid,
    new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    caller_role text;
BEGIN
    -- Validar que el usuario que ejecuta la función sea administrador en la tabla profiles
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requieren permisos de administrador.';
    END IF;

    -- Validar longitud mínima de la nueva contraseña
    IF length(trim(new_password)) < 8 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres.';
    END IF;

    -- Actualizar la contraseña en la tabla auth.users usando bcrypt
    UPDATE auth.users
    SET 
        encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada con éxito');
END;
$$;

-- Otorgar permiso de ejecución a usuarios autenticados (la función internamente restringe a role = 'admin')
GRANT EXECUTE ON FUNCTION public.set_user_password_by_admin(uuid, text) TO authenticated;

-- 3. Función RPC para eliminar usuarios desde el panel de administración
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(
    user_id_to_delete uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_role text;
BEGIN
    -- Validar rol de administrador
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requieren permisos de administrador.';
    END IF;

    -- Impedir que un administrador se autoelimine
    IF auth.uid() = user_id_to_delete THEN
        RAISE EXCEPTION 'No puedes eliminar tu propia cuenta administradora activa.';
    END IF;

    -- Eliminar registro de auth.users y profiles
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    DELETE FROM public.profiles WHERE id = user_id_to_delete;

    RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado con éxito');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;
