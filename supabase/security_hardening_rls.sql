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

-- ==============================================================================
-- 8. TABLA CATEGORIES: BLINDAJE RLS (SISTEMA + PERSONALIZADAS POR USUARIO)
-- ==============================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

CREATE POLICY "categories_select_policy" ON public.categories
FOR SELECT TO authenticated
USING (user_id IS NULL OR auth.uid() = user_id OR public.is_admin());

CREATE POLICY "categories_insert_policy" ON public.categories
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "categories_update_policy" ON public.categories
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "categories_delete_policy" ON public.categories
FOR DELETE TO authenticated
USING ((auth.uid() = user_id AND user_id IS NOT NULL) OR public.is_admin());

-- ==============================================================================
-- 9. TABLA TRANSACTIONS: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;

CREATE POLICY "transactions_select_policy" ON public.transactions
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "transactions_insert_policy" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_policy" ON public.transactions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "transactions_delete_policy" ON public.transactions
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 10. TABLA FIXED_INCOMES: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.fixed_incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fixed_incomes_select_policy" ON public.fixed_incomes;
DROP POLICY IF EXISTS "fixed_incomes_insert_policy" ON public.fixed_incomes;
DROP POLICY IF EXISTS "fixed_incomes_update_policy" ON public.fixed_incomes;
DROP POLICY IF EXISTS "fixed_incomes_delete_policy" ON public.fixed_incomes;

CREATE POLICY "fixed_incomes_select_policy" ON public.fixed_incomes
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "fixed_incomes_insert_policy" ON public.fixed_incomes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fixed_incomes_update_policy" ON public.fixed_incomes
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "fixed_incomes_delete_policy" ON public.fixed_incomes
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 11. TABLA MONTHLY_FIXED_INCOME_OVERRIDES: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.monthly_fixed_income_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_fixed_income_overrides_select_policy" ON public.monthly_fixed_income_overrides;
DROP POLICY IF EXISTS "monthly_fixed_income_overrides_insert_policy" ON public.monthly_fixed_income_overrides;
DROP POLICY IF EXISTS "monthly_fixed_income_overrides_update_policy" ON public.monthly_fixed_income_overrides;
DROP POLICY IF EXISTS "monthly_fixed_income_overrides_delete_policy" ON public.monthly_fixed_income_overrides;

CREATE POLICY "monthly_fixed_income_overrides_select_policy" ON public.monthly_fixed_income_overrides
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "monthly_fixed_income_overrides_insert_policy" ON public.monthly_fixed_income_overrides
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monthly_fixed_income_overrides_update_policy" ON public.monthly_fixed_income_overrides
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "monthly_fixed_income_overrides_delete_policy" ON public.monthly_fixed_income_overrides
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 12. TABLA VARIABLE_INCOMES: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.variable_incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variable_incomes_select_policy" ON public.variable_incomes;
DROP POLICY IF EXISTS "variable_incomes_insert_policy" ON public.variable_incomes;
DROP POLICY IF EXISTS "variable_incomes_update_policy" ON public.variable_incomes;
DROP POLICY IF EXISTS "variable_incomes_delete_policy" ON public.variable_incomes;

CREATE POLICY "variable_incomes_select_policy" ON public.variable_incomes
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "variable_incomes_insert_policy" ON public.variable_incomes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "variable_incomes_update_policy" ON public.variable_incomes
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "variable_incomes_delete_policy" ON public.variable_incomes
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 13. TABLA FIXED_EXPENSES: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fixed_expenses_select_policy" ON public.fixed_expenses;
DROP POLICY IF EXISTS "fixed_expenses_insert_policy" ON public.fixed_expenses;
DROP POLICY IF EXISTS "fixed_expenses_update_policy" ON public.fixed_expenses;
DROP POLICY IF EXISTS "fixed_expenses_delete_policy" ON public.fixed_expenses;

CREATE POLICY "fixed_expenses_select_policy" ON public.fixed_expenses
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "fixed_expenses_insert_policy" ON public.fixed_expenses
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fixed_expenses_update_policy" ON public.fixed_expenses
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "fixed_expenses_delete_policy" ON public.fixed_expenses
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 14. TABLA MONTHLY_FIXED_OVERRIDES: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.monthly_fixed_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_fixed_overrides_select_policy" ON public.monthly_fixed_overrides;
DROP POLICY IF EXISTS "monthly_fixed_overrides_insert_policy" ON public.monthly_fixed_overrides;
DROP POLICY IF EXISTS "monthly_fixed_overrides_update_policy" ON public.monthly_fixed_overrides;
DROP POLICY IF EXISTS "monthly_fixed_overrides_delete_policy" ON public.monthly_fixed_overrides;

CREATE POLICY "monthly_fixed_overrides_select_policy" ON public.monthly_fixed_overrides
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "monthly_fixed_overrides_insert_policy" ON public.monthly_fixed_overrides
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monthly_fixed_overrides_update_policy" ON public.monthly_fixed_overrides
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "monthly_fixed_overrides_delete_policy" ON public.monthly_fixed_overrides
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 15. TABLA VARIABLE_EXPENSES: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.variable_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variable_expenses_select_policy" ON public.variable_expenses;
DROP POLICY IF EXISTS "variable_expenses_insert_policy" ON public.variable_expenses;
DROP POLICY IF EXISTS "variable_expenses_update_policy" ON public.variable_expenses;
DROP POLICY IF EXISTS "variable_expenses_delete_policy" ON public.variable_expenses;

CREATE POLICY "variable_expenses_select_policy" ON public.variable_expenses
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "variable_expenses_insert_policy" ON public.variable_expenses
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "variable_expenses_update_policy" ON public.variable_expenses
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "variable_expenses_delete_policy" ON public.variable_expenses
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 16. TABLA DEBTS: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debts_select_policy" ON public.debts;
DROP POLICY IF EXISTS "debts_insert_policy" ON public.debts;
DROP POLICY IF EXISTS "debts_update_policy" ON public.debts;
DROP POLICY IF EXISTS "debts_delete_policy" ON public.debts;

CREATE POLICY "debts_select_policy" ON public.debts
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "debts_insert_policy" ON public.debts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debts_update_policy" ON public.debts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "debts_delete_policy" ON public.debts
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 17. TABLA DEBT_PAYMENTS: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debt_payments_select_policy" ON public.debt_payments;
DROP POLICY IF EXISTS "debt_payments_insert_policy" ON public.debt_payments;
DROP POLICY IF EXISTS "debt_payments_update_policy" ON public.debt_payments;
DROP POLICY IF EXISTS "debt_payments_delete_policy" ON public.debt_payments;

CREATE POLICY "debt_payments_select_policy" ON public.debt_payments
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "debt_payments_insert_policy" ON public.debt_payments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debt_payments_update_policy" ON public.debt_payments
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "debt_payments_delete_policy" ON public.debt_payments
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 18. TABLA SAVINGS_GOALS: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "savings_goals_select_policy" ON public.savings_goals;
DROP POLICY IF EXISTS "savings_goals_insert_policy" ON public.savings_goals;
DROP POLICY IF EXISTS "savings_goals_update_policy" ON public.savings_goals;
DROP POLICY IF EXISTS "savings_goals_delete_policy" ON public.savings_goals;

CREATE POLICY "savings_goals_select_policy" ON public.savings_goals
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "savings_goals_insert_policy" ON public.savings_goals
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "savings_goals_update_policy" ON public.savings_goals
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "savings_goals_delete_policy" ON public.savings_goals
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 19. TABLA SAVING_CONTRIBUTIONS: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.saving_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saving_contributions_select_policy" ON public.saving_contributions;
DROP POLICY IF EXISTS "saving_contributions_insert_policy" ON public.saving_contributions;
DROP POLICY IF EXISTS "saving_contributions_update_policy" ON public.saving_contributions;
DROP POLICY IF EXISTS "saving_contributions_delete_policy" ON public.saving_contributions;

CREATE POLICY "saving_contributions_select_policy" ON public.saving_contributions
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "saving_contributions_insert_policy" ON public.saving_contributions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saving_contributions_update_policy" ON public.saving_contributions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "saving_contributions_delete_policy" ON public.saving_contributions
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 20. TABLA PLANNING_NOTES: BLINDAJE RLS POR USUARIO
-- ==============================================================================

ALTER TABLE public.planning_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planning_notes_select_policy" ON public.planning_notes;
DROP POLICY IF EXISTS "planning_notes_insert_policy" ON public.planning_notes;
DROP POLICY IF EXISTS "planning_notes_update_policy" ON public.planning_notes;
DROP POLICY IF EXISTS "planning_notes_delete_policy" ON public.planning_notes;

CREATE POLICY "planning_notes_select_policy" ON public.planning_notes
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "planning_notes_insert_policy" ON public.planning_notes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "planning_notes_update_policy" ON public.planning_notes
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "planning_notes_delete_policy" ON public.planning_notes
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());
