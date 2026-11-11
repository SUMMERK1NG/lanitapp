-- ==============================================================================
-- LANITAPP - MIGRACIÓN: INDICADOR DE BIENVENIDA EN PROFILES
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. Agregar columna para saber si ya se envió el correo de bienvenida
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false;

-- 2. Marcar a todos los usuarios existentes como ya notificados para que no reciban bienvenida al iniciar sesión
UPDATE public.profiles
SET welcome_email_sent = true
WHERE COALESCE(welcome_email_sent, false) = false;
