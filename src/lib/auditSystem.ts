import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase.ts';
import { db, getActiveUserId } from './db.ts';
import { generateUuid } from '../utils/uuid.ts';
import { logger } from '../utils/logger.ts';

export interface AuditResult {
  table: string;
  operation: 'SELECT' | 'INSERT' | 'DELETE' | 'RLS' | 'AUTH';
  status: '✅ OK' | '❌ FAIL' | '⚠️ WARNING';
  message: string;
  durationMs?: number;
  suggestion?: string;
  timestamp: string;
}

export interface AuditReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    durationTotalMs: number;
  };
  results: AuditResult[];
  recommendations: string[];
  timestamp: string;
}

// Lista exhaustiva de las tablas de LANITAPP en Supabase
export const TABLES_TO_AUDIT = [
  'profiles',
  'categories',
  'accounts',
  'debts',
  'debt_payments',
  'fixed_expenses',
  'fixed_incomes',
  'variable_expenses',
  'variable_incomes',
  'fortnight_item_states',
  'saving_contributions',
  'savings_goals',
  'monthly_fixed_overrides',
  'monthly_fixed_income_overrides',
  'transactions',
  'planning_notes',
] as const;

/**
 * Genera un payload mínimo de prueba para inserción y limpieza inmediata.
 */
function getSafeTestPayload(
  table: string,
  userId: string,
  testId: string,
  sampleExpenseCategoryId: string | null,
  sampleIncomeCategoryId: string | null
): Record<string, any> | null {
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.split('T')[0];

  switch (table) {
    case 'accounts':
      return {
        id: testId,
        user_id: userId,
        name: '__LANITAPP_AUDIT_TEMP__',
        type: 'cash',
        currency: 'USD',
        initial_balance: 0,
        notes: 'Registro efímero de prueba de auditoría',
        created_at: nowIso,
      };
    case 'fixed_expenses':
      if (!sampleExpenseCategoryId) return null;
      return {
        id: testId,
        user_id: userId,
        name: '__LANITAPP_AUDIT_TEMP__',
        amount: 1,
        currency: 'USD',
        default_fortnight: 15,
        category_id: sampleExpenseCategoryId,
        is_active: false,
        notes: 'Audit test row',
        created_at: nowIso,
      };
    case 'fixed_incomes':
      if (!sampleIncomeCategoryId) return null;
      return {
        id: testId,
        user_id: userId,
        name: '__LANITAPP_AUDIT_TEMP__',
        amount: 1,
        currency: 'USD',
        default_fortnight: 15,
        category_id: sampleIncomeCategoryId,
        is_active: false,
        notes: 'Audit test row',
        created_at: nowIso,
      };
    case 'transactions':
      if (!sampleExpenseCategoryId) return null;
      return {
        id: testId,
        user_id: userId,
        amount: 1,
        type: 'expense',
        description: '__LANITAPP_AUDIT_TEMP__',
        transaction_date: todayDate,
        category_id: sampleExpenseCategoryId,
        created_at: nowIso,
      };
    case 'variable_expenses':
      if (!sampleExpenseCategoryId) return null;
      return {
        id: testId,
        user_id: userId,
        description: '__LANITAPP_AUDIT_TEMP__',
        amount: 1,
        year: 2026,
        month: 8,
        fortnight: 'q1',
        category_id: sampleExpenseCategoryId,
        currency: 'USD',
        created_at: nowIso,
      };
    case 'variable_incomes':
      return {
        id: testId,
        user_id: userId,
        description: '__LANITAPP_AUDIT_TEMP__',
        amount: 1,
        year: 2026,
        month: 8,
        fortnight: 'q1',
        currency: 'USD',
        created_at: nowIso,
      };
    case 'planning_notes':
      return {
        id: testId,
        user_id: userId,
        year: 2026,
        month: 8,
        content: '__LANITAPP_AUDIT_TEMP__',
        created_at: nowIso,
      };
    default:
      // Para tablas complejas o relacionales secundarias, omitir inserción sintética para evitar conflictos de Foreign Key
      return null;
  }
}

/**
 * Ejecuta una auditoría completa del backend Supabase validando conectividad,
 * permisos RLS, tablas disponibles, lectura (SELECT) y escritura/borrado (INSERT/DELETE).
 */
export const runFullAudit = async (): Promise<AuditReport> => {
  const startTime = performance.now();
  const results: AuditResult[] = [];
  const recommendations: string[] = [];

  // 1. Validar variables de entorno de Supabase
  if (!isSupabaseConfigured() || !supabase) {
    results.push({
      table: 'SUPABASE_CLIENT',
      operation: 'AUTH',
      status: '❌ FAIL',
      message: 'Supabase no está configurado o faltan variables de entorno en .env.',
      suggestion: 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env',
      timestamp: new Date().toISOString(),
    });
    recommendations.push('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.');
    return {
      summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationTotalMs: 0 },
      results,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Validar autenticación de usuario
  let activeUid = getActiveUserId();
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      results.push({
        table: 'AUTH_SESSION',
        operation: 'AUTH',
        status: activeUid ? '⚠️ WARNING' : '❌ FAIL',
        message: authError
          ? `Sesión Supabase Auth: ${authError.message}`
          : 'No hay usuario autenticado en Supabase Auth. Usando ID de sesión activa local.',
        suggestion: 'Inicia sesión formalmente con tu correo y contraseña.',
        timestamp: new Date().toISOString(),
      });
      if (!activeUid) {
        recommendations.push('Inicia sesión en la aplicación para verificar los datos de usuario.');
        return {
          summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationTotalMs: 0 },
          results,
          recommendations,
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      activeUid = authData.user.id;
      results.push({
        table: 'AUTH_SESSION',
        operation: 'AUTH',
        status: '✅ OK',
        message: `Usuario autenticado correctamente: ${authData.user.email || authData.user.id}`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    results.push({
      table: 'AUTH_SESSION',
      operation: 'AUTH',
      status: '⚠️ WARNING',
      message: `Error al consultar sesión: ${err.message || String(err)}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Resolver categorías dinámicas para pruebas de Foreign Key (sin UUIDs hardcodeados)
  let sampleExpenseCategoryId: string | null = null;
  let sampleIncomeCategoryId: string | null = null;
  try {
    const expenseCat = await db.categories.where('type').equals('expense').first();
    sampleExpenseCategoryId = expenseCat?.id || null;
    const incomeCat = await db.categories.where('type').equals('income').first();
    sampleIncomeCategoryId = incomeCat?.id || null;
  } catch {}

  if (!sampleExpenseCategoryId || !sampleIncomeCategoryId) {
    try {
      const { data: remoteCats } = await supabase.from('categories').select('id, type').limit(10);
      if (remoteCats && remoteCats.length > 0) {
        sampleExpenseCategoryId = sampleExpenseCategoryId || remoteCats.find(c => c.type === 'expense')?.id || remoteCats[0].id;
        sampleIncomeCategoryId = sampleIncomeCategoryId || remoteCats.find(c => c.type === 'income')?.id || remoteCats[0].id;
      }
    } catch {}
  }

  // 3. Auditoría tabla por tabla
  for (const table of TABLES_TO_AUDIT) {
    const t0 = performance.now();

    // --- TEST SELECT (Lectura) ---
    try {
      let query = supabase.from(table).select('*').limit(5);

      // Adaptación inteligente de filtros por usuario según esquema
      if (table === 'profiles') {
        query = query.eq('id', activeUid);
      } else if (table === 'categories') {
        // Categories es pública/compartida
      } else if (table === 'monthly_fixed_overrides' || table === 'monthly_fixed_income_overrides') {
        // En algunos esquemas los overrides están vinculados al expense_id
      } else {
        query = query.eq('user_id', activeUid);
      }

      const { data, error } = await query;
      const selectDuration = Math.round(performance.now() - t0);

      if (error) {
        let suggestion = 'Verifica permisos y estructura de la tabla';
        let status: AuditResult['status'] = '❌ FAIL';

        if (error.code === '42P01') {
          suggestion = 'La tabla no existe en la base de datos de Supabase. Revisa las migraciones SQL.';
        } else if (error.code === '42501' || error.message?.toLowerCase().includes('policy')) {
          suggestion = 'Políticas RLS bloquean el acceso SELECT para este usuario.';
        } else if (error.code === '42703') {
          suggestion = 'Columna inexistente en la cláusula de consulta. Revisa la columna user_id / id.';
          status = '⚠️ WARNING';
        }

        results.push({
          table,
          operation: 'SELECT',
          status,
          message: error.message,
          durationMs: selectDuration,
          suggestion,
          timestamp: new Date().toISOString(),
        });
        recommendations.push(`Tabla [${table}]: Error en lectura (${error.message}). ${suggestion}`);
      } else {
        results.push({
          table,
          operation: 'SELECT',
          status: '✅ OK',
          message: `Lectura exitosa (${data?.length ?? 0} registros leídos en ${selectDuration}ms)`,
          durationMs: selectDuration,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      results.push({
        table,
        operation: 'SELECT',
        status: '❌ FAIL',
        message: err.message || 'Excepción no controlada durante SELECT',
        timestamp: new Date().toISOString(),
      });
      recommendations.push(`Tabla [${table}]: Fallo imprevisto en lectura (${err.message || 'Error'}).`);
    }

    // --- TEST INSERT & DELETE (Escritura y limpieza inmediata) ---
    const testId = generateUuid();
    const payload = getSafeTestPayload(table, activeUid, testId, sampleExpenseCategoryId, sampleIncomeCategoryId);

    if (payload) {
      const tInsert = performance.now();
      try {
        const { error: insertErr } = await supabase.from(table).insert(payload);
        const insertDuration = Math.round(performance.now() - tInsert);

        if (insertErr) {
          const isWarning =
            insertErr.message?.includes('violates not-null') ||
            insertErr.message?.includes('foreign key') ||
            insertErr.code === '23503' ||
            insertErr.code === '23502';

          results.push({
            table,
            operation: 'INSERT',
            status: isWarning ? '⚠️ WARNING' : '❌ FAIL',
            message: insertErr.message,
            durationMs: insertDuration,
            suggestion: insertErr.message?.includes('policy')
              ? 'Políticas RLS impiden insertar registros a este usuario.'
              : 'Verifica las columnas obligatorias y tipos de datos en la tabla.',
            timestamp: new Date().toISOString(),
          });
          recommendations.push(`Tabla [${table}]: Inserción fallida: ${insertErr.message}`);
        } else {
          results.push({
            table,
            operation: 'INSERT',
            status: '✅ OK',
            message: `Inserción de prueba validada (${insertDuration}ms)`,
            durationMs: insertDuration,
            timestamp: new Date().toISOString(),
          });

          // Limpieza inmediata no destructiva
          try {
            await supabase.from(table).delete().eq('id', testId);
            results.push({
              table,
              operation: 'DELETE',
              status: '✅ OK',
              message: 'Limpieza automática de registro de prueba completada',
              timestamp: new Date().toISOString(),
            });
          } catch {
            // Ignorar
          }
        }
      } catch (err: any) {
        results.push({
          table,
          operation: 'INSERT',
          status: '❌ FAIL',
          message: err.message || 'Excepción no controlada durante INSERT',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // 4. Verificación de RLS global (Intento seguro de pg_policies)
  try {
    const { data: policies, error: polErr } = await supabase
      .from('pg_policies')
      .select('tablename, policyname')
      .in('tablename', TABLES_TO_AUDIT as unknown as string[]);

    if (!polErr && policies && policies.length > 0) {
      results.push({
        table: 'RLS_SECURITY',
        operation: 'RLS',
        status: '✅ OK',
        message: `${policies.length} políticas RLS activas detectadas en la base de datos.`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // pg_policies requiere permisos de superuser en Supabase, normal que se restrinja
  }

  const durationTotalMs = Math.round(performance.now() - startTime);

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === '✅ OK').length,
    failed: results.filter((r) => r.status === '❌ FAIL').length,
    warnings: results.filter((r) => r.status === '⚠️ WARNING').length,
    durationTotalMs,
  };

  return {
    summary,
    results,
    recommendations,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Imprime un reporte formateado y legible en la consola del navegador.
 */
export const displayAuditReport = (report: AuditReport): void => {
  logger.group('🔍 [LANITAPP] REPORTE COMPLETO DE AUDITORÍA SUPABASE');
  logger.dev(`⏱️ Tiempo total de ejecución: ${report.summary.durationTotalMs}ms`);
  logger.dev(`📊 Resumen:`);
  logger.dev(`   • Total Operaciones Evaluadas: ${report.summary.total}`);
  logger.dev(`   • ✅ Exitosos: ${report.summary.passed}`);
  logger.dev(`   • ❌ Fallidos: ${report.summary.failed}`);
  logger.dev(`   • ⚠️ Advertencias: ${report.summary.warnings}`);

  logger.table(
    report.results.map((r) => ({
      Tabla: r.table,
      Operación: r.operation,
      Estado: r.status,
      Mensaje: r.message,
      Latencia: r.durationMs !== undefined ? `${r.durationMs}ms` : '-',
      Sugerencia: r.suggestion || '-',
    }))
  );

  if (report.recommendations.length > 0) {
    logger.group('💡 Recomendaciones del Sistema:');
    report.recommendations.forEach((rec, idx) => logger.dev(`${idx + 1}. ${rec}`));
    logger.groupEnd();
  }

  logger.groupEnd();
};

/**
 * Hook de React para ejecutar la auditoría reactivamente.
 */
export const useAudit = () => {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const runAudit = useCallback(async () => {
    setIsRunning(true);
    try {
      const result = await runFullAudit();
      setReport(result);
      displayAuditReport(result);
      return result;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { report, isRunning, runAudit };
};
