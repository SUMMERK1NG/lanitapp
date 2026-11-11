-- ============================================================================
-- Lanitapp — Endurecimiento de Seguridad y Alineación de Esquema (Idempotente)
-- Ejecutar en Supabase -> SQL Editor -> New Query -> Run
-- Seguro para datos existentes: NO elimina tablas ni borra filas de usuarios.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEGURIDAD EN FUNCIONES RPC Y TRIGGERS (SECURITY DEFINER + search_path)
-- ----------------------------------------------------------------------------

-- CRÍTICO: Antes cualquier usuario autenticado (o anónimo si tenía permiso RPC)
-- podía invocar delete_user_by_admin(uuid) sin validación de rol admin.
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(user_id_to_delete uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: Se requieren permisos de administrador.';
  END IF;

  IF user_id_to_delete = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta desde esta acción.';
  END IF;

  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_user_by_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_by_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;

-- Endurecer permisos de ejecución en set_user_password_by_admin
REVOKE ALL ON FUNCTION public.set_user_password_by_admin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_password_by_admin(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_password_by_admin(uuid, text) TO authenticated;

-- Fijar search_path en handle_new_user() para evitar search_path hijacking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, cedula, first_name, last_name, email, role)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'cedula', 'V-0'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    case when coalesce(new.raw_user_meta_data->>'cedula', '') = 'V-28322083' then 'admin' else 'user' end
  )
  ON CONFLICT (id) DO UPDATE SET
    cedula = excluded.cedula,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email;
  RETURN new;
END;
$function$;

-- Fijar search_path en update_updated_at_column()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 2. POLÍTICA RLS DE CATEGORIES (evitar exposición pública al rol anon)
-- ----------------------------------------------------------------------------
-- Las políticas categories_select_policy y "Users can select own categories" ya
-- permiten leer categorías del sistema (user_id IS NULL) y propias a "authenticated".
DROP POLICY IF EXISTS "Users can view own categories or system defaults" ON public.categories;

-- ----------------------------------------------------------------------------
-- 3. INTEGRIDAD REFERENCIAL (ON DELETE CASCADE / ON DELETE SET NULL)
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.debt_payments
  DROP CONSTRAINT IF EXISTS debt_payments_user_id_fkey;
ALTER TABLE public.debt_payments
  ADD CONSTRAINT debt_payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.fortnight_item_states
  DROP CONSTRAINT IF EXISTS fortnight_item_states_user_id_fkey;
ALTER TABLE public.fortnight_item_states
  ADD CONSTRAINT fortnight_item_states_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.saving_contributions
  DROP CONSTRAINT IF EXISTS saving_contributions_user_id_fkey;
ALTER TABLE public.saving_contributions
  ADD CONSTRAINT saving_contributions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.saving_contributions
  DROP CONSTRAINT IF EXISTS saving_contributions_source_account_id_fkey;
ALTER TABLE public.saving_contributions
  ADD CONSTRAINT saving_contributions_source_account_id_fkey
  FOREIGN KEY (source_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.saving_contributions
  DROP CONSTRAINT IF EXISTS saving_contributions_source_income_id_fkey;
ALTER TABLE public.saving_contributions
  ADD CONSTRAINT saving_contributions_source_income_id_fkey
  FOREIGN KEY (source_income_id) REFERENCES public.variable_incomes(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. ALINEACIÓN DE COLUMNAS FRONTEND <-> SUPABASE
-- ----------------------------------------------------------------------------

-- 4.1 fixed_expenses.default_fortnight: pasar de int4 CHECK (15,30) a text ('q1','q2','both')
ALTER TABLE public.fixed_expenses
  DROP CONSTRAINT IF EXISTS fixed_expenses_default_quincena_check;
ALTER TABLE public.fixed_expenses
  DROP CONSTRAINT IF EXISTS fixed_expenses_default_fortnight_check;

ALTER TABLE public.fixed_expenses
  ALTER COLUMN default_fortnight TYPE text
  USING (
    CASE
      WHEN default_fortnight::text IN ('15', 'q1') THEN 'q1'
      WHEN default_fortnight::text IN ('30', 'q2') THEN 'q2'
      WHEN default_fortnight::text = 'both' THEN 'both'
      ELSE 'both'
    END
  );

ALTER TABLE public.fixed_expenses
  ALTER COLUMN default_fortnight SET DEFAULT 'q1';

ALTER TABLE public.fixed_expenses
  ADD CONSTRAINT fixed_expenses_default_fortnight_check
  CHECK (default_fortnight IS NULL OR default_fortnight IN ('q1', 'q2', 'both'));

-- 4.2 fixed_incomes.default_fortnight: pasar de int4 a text ('q1','q2','both')
ALTER TABLE public.fixed_incomes
  DROP CONSTRAINT IF EXISTS fixed_incomes_default_fortnight_check;

ALTER TABLE public.fixed_incomes
  ALTER COLUMN default_fortnight TYPE text
  USING (
    CASE
      WHEN default_fortnight::text IN ('15', 'q1') THEN 'q1'
      WHEN default_fortnight::text IN ('30', 'q2') THEN 'q2'
      WHEN default_fortnight::text = 'both' THEN 'both'
      WHEN quincena = 15 THEN 'q1'
      WHEN quincena = 30 THEN 'q2'
      ELSE 'q1'
    END
  );

ALTER TABLE public.fixed_incomes
  ALTER COLUMN default_fortnight SET DEFAULT 'q1';

ALTER TABLE public.fixed_incomes
  ADD CONSTRAINT fixed_incomes_default_fortnight_check
  CHECK (default_fortnight IS NULL OR default_fortnight IN ('q1', 'q2', 'both'));

-- 4.3 variable_incomes: añadir category_id, account_id y notes usadas por la UI
ALTER TABLE public.variable_incomes
  ADD COLUMN IF NOT EXISTS category_id text,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

-- 4.4 debt_payments: columnas year, month, fortnight para analítica/compatibilidad
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS year int4,
  ADD COLUMN IF NOT EXISTS month int4,
  ADD COLUMN IF NOT EXISTS fortnight text;

UPDATE public.debt_payments
SET
  year = COALESCE(year, EXTRACT(YEAR FROM payment_date)::int4),
  month = COALESCE(month, (EXTRACT(MONTH FROM payment_date)::int4 - 1)),
  fortnight = COALESCE(
    fortnight,
    CASE
      WHEN quincena = 30 THEN 'q2'
      WHEN quincena = 15 THEN 'q1'
      WHEN EXTRACT(DAY FROM payment_date) <= 15 THEN 'q1'
      ELSE 'q2'
    END
  )
WHERE year IS NULL OR month IS NULL OR fortnight IS NULL;

-- 4.5 saving_contributions: columnas year, month, fortnight, is_skipped, contribution_date
ALTER TABLE public.saving_contributions
  ADD COLUMN IF NOT EXISTS year int4,
  ADD COLUMN IF NOT EXISTS month int4,
  ADD COLUMN IF NOT EXISTS fortnight text,
  ADD COLUMN IF NOT EXISTS is_skipped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contribution_date text;

UPDATE public.saving_contributions
SET
  is_skipped = COALESCE(is_skipped, status = 'skipped'),
  contribution_date = COALESCE(contribution_date, to_char(created_at AT TIME ZONE 'America/Caracas', 'YYYY-MM-DD')),
  year = COALESCE(year, CASE WHEN period_date ~ '^\d{4}-\d{2}-\d{2}' THEN substring(period_date from 1 for 4)::int4 ELSE NULL END),
  month = COALESCE(month, CASE WHEN period_date ~ '^\d{4}-\d{2}-\d{2}' THEN (substring(period_date from 6 for 2)::int4 - 1) ELSE NULL END),
  fortnight = COALESCE(
    fortnight,
    CASE
      WHEN period_date ~ '^\d{4}-\d{2}-15' THEN 'q1'
      WHEN period_date ~ '^\d{4}-\d{2}-(28|29|30|31)' THEN 'q2'
      ELSE NULL
    END
  )
WHERE year IS NULL OR month IS NULL OR fortnight IS NULL OR contribution_date IS NULL;

-- 4.6 fortnight_item_states: índice rápido por usuario + período + ítem
CREATE INDEX IF NOT EXISTS idx_fortnight_item_states_user_period
  ON public.fortnight_item_states (user_id, period_key, item_id);

-- ----------------------------------------------------------------------------
-- 5. SEMILLA IDEMPOTENTE DE CATEGORÍAS DEL SISTEMA (user_id IS NULL)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_categories_system_code
  ON public.categories (code)
  WHERE user_id IS NULL AND code IS NOT NULL;

WITH system_defaults(code, name, type, icon, color) AS (
  VALUES
    ('cat_housing', 'Vivienda & Alquiler', 'expense', 'Home', '#147DF0'),
    ('cat_food', 'Comida & Supermercado', 'expense', 'ShoppingCart', '#00C2C7'),
    ('cat_services', 'Servicios & Fibra', 'expense', 'Wifi', '#3B82F6'),
    ('cat_transport', 'Transporte & Gasolina', 'expense', 'Car', '#F59E0B'),
    ('cat_debt', 'Pago de Deudas & Cuotas', 'expense', 'CreditCard', '#FF914D'),
    ('cat_health', 'Salud & Farmacia', 'expense', 'HeartPulse', '#10B981'),
    ('cat_entertainment', 'Ocio & Salidas', 'expense', 'Film', '#8B5CF6'),
    ('cat_savings', 'Ahorro & Metas', 'expense', 'PiggyBank', '#00C2C7'),
    ('cat_other_exp', 'Otros Gastos', 'expense', 'MoreHorizontal', '#9BA3AF'),
    ('cat_salary', 'Sueldo Base', 'income', 'Briefcase', '#147DF0'),
    ('cat_bonus', 'Plus & Bonos', 'income', 'TrendingUp', '#00C2C7'),
    ('cat_guard', 'Guardias / Turnos', 'income', 'Clock', '#6366F1'),
    ('cat_tickets', 'Tickets Alimentación', 'income', 'UtensilsCrossed', '#10B981'),
    ('cat_extras', 'Extras & Freelance', 'income', 'Laptop', '#FF914D')
)
-- Primero enlaza hasta una fila del sistema ya existente que coincida y aún no tenga code
UPDATE public.categories c
SET code = sd.code
FROM system_defaults sd
WHERE c.id = (
  SELECT c2.id
  FROM public.categories c2
  WHERE c2.user_id IS NULL
    AND c2.code IS NULL
    AND lower(trim(c2.name)) = lower(trim(sd.name))
    AND c2.type = sd.type
  ORDER BY c2.created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.categories existing_sys
  WHERE existing_sys.user_id IS NULL AND existing_sys.code = sd.code
);

WITH system_defaults(code, name, type, icon, color) AS (
  VALUES
    ('cat_housing', 'Vivienda & Alquiler', 'expense', 'Home', '#147DF0'),
    ('cat_food', 'Comida & Supermercado', 'expense', 'ShoppingCart', '#00C2C7'),
    ('cat_services', 'Servicios & Fibra', 'expense', 'Wifi', '#3B82F6'),
    ('cat_transport', 'Transporte & Gasolina', 'expense', 'Car', '#F59E0B'),
    ('cat_debt', 'Pago de Deudas & Cuotas', 'expense', 'CreditCard', '#FF914D'),
    ('cat_health', 'Salud & Farmacia', 'expense', 'HeartPulse', '#10B981'),
    ('cat_entertainment', 'Ocio & Salidas', 'expense', 'Film', '#8B5CF6'),
    ('cat_savings', 'Ahorro & Metas', 'expense', 'PiggyBank', '#00C2C7'),
    ('cat_other_exp', 'Otros Gastos', 'expense', 'MoreHorizontal', '#9BA3AF'),
    ('cat_salary', 'Sueldo Base', 'income', 'Briefcase', '#147DF0'),
    ('cat_bonus', 'Plus & Bonos', 'income', 'TrendingUp', '#00C2C7'),
    ('cat_guard', 'Guardias / Turnos', 'income', 'Clock', '#6366F1'),
    ('cat_tickets', 'Tickets Alimentación', 'income', 'UtensilsCrossed', '#10B981'),
    ('cat_extras', 'Extras & Freelance', 'income', 'Laptop', '#FF914D')
)
INSERT INTO public.categories (id, name, type, icon, color, code, user_id)
SELECT gen_random_uuid(), sd.name, sd.type, sd.icon, sd.color, sd.code, NULL
FROM system_defaults sd
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.user_id IS NULL AND c.code = sd.code
);
