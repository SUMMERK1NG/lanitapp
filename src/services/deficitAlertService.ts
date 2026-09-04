import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { sendEmail } from './emailService.ts';
import { useFinanceStore } from '../stores/useFinanceStore.ts';
import { logger } from '../utils/logger.ts';

export interface DeficitAlert {
  quincena: 'Q1' | 'Q2';
  fecha: string;
  mes: string;
  year: number;
  deficit: number;
  balance: number;
  totalIngresos: number;
  totalGastos: number;
  sugerencias: string[];
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Genera sugerencias inteligentes basadas en el déficit y el balance disponible en cuentas
 */
export const generateSuggestions = (deficit: number, balance: number): string[] => {
  const suggestions: string[] = [];

  if (balance >= deficit) {
    suggestions.push(
      `Dispones de $${balance.toFixed(2)} en tus cuentas. Puedes cubrir el déficit completo y te quedarán $${(balance - deficit).toFixed(2)} de colchón.`
    );
  } else if (balance > 0) {
    suggestions.push(
      `Puedes usar los $${balance.toFixed(2)} disponibles en tus cuentas para amortiguar parte del déficit (restante por cubrir: $${(deficit - balance).toFixed(2)}).`
    );
  } else {
    suggestions.push('Tus cuentas no disponen de balance positivo. Considera posponer compras prescindibles.');
  }

  suggestions.push('Posponer gastos variables o compras no críticas para el siguiente ciclo quincenal.');
  suggestions.push('Verificar abonos a deudas y negociar plazos si la cuota compromete tu liquidez inmediata.');
  suggestions.push('Pausar temporalmente aportes a metas de ahorro durante este ciclo para priorizar compromisos fijos.');

  return suggestions;
};

/**
 * Envía email con diseño corporativo alertando sobre el déficit detectado
 */
export const sendDeficitAlertEmail = async (email: string, alert: DeficitAlert): Promise<void> => {
  const quincenaNum = alert.quincena === 'Q1' ? '15' : '30';
  const subject = `⚠️ Alerta de Déficit - Quincena ${quincenaNum} de ${alert.mes || 'Septiembre'}`;
  const appUrl = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://lanitapp.xyz';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alerta de Déficit - LANITAPP</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid #334155;">
              
              <!-- Header con Alerta -->
              <tr>
                <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 36px 30px; text-align: center;">
                  <div style="font-size: 42px; margin-bottom: 8px;">⚠️</div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Alerta de Déficit Proyectado</h1>
                  <div style="background: rgba(0,0,0,0.25); display: inline-block; padding: 6px 16px; border-radius: 20px; margin-top: 14px;">
                    <span style="color: #ffffff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                      QUINCENA ${quincenaNum} • ${(alert.mes || 'SEPTIEMBRE').toUpperCase()} ${alert.year || new Date().getFullYear()}
                    </span>
                  </div>
                </td>
              </tr>
              
              <!-- Cuerpo -->
              <tr>
                <td style="padding: 36px 30px;">
                  <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0 0 26px 0;">
                    Hola, hemos detectado que los compromisos planificados para tu próxima 
                    <strong style="color: #ffffff;">Quincena ${quincenaNum} (Día ${alert.fecha})</strong> 
                    exceden tus ingresos proyectados.
                  </p>
                  
                  <!-- Resumen del Período -->
                  <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 22px; margin-bottom: 26px;">
                    <div style="color: #94a3b8; font-size: 12px; font-weight: 700; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                      Resumen del Período:
                    </div>
                    
                    <!-- Déficit -->
                    <div style="background-color: #1e293b; border-radius: 10px; padding: 16px 20px; margin-bottom: 12px; border-left: 4px solid #dc2626;">
                      <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; font-weight: 700;">Déficit Proyectado</div>
                      <div style="color: #ef4444; font-size: 26px; font-weight: 800;">-$${Math.abs(alert.deficit).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                    </div>
                    
                    <!-- Balance Disponible -->
                    <div style="background-color: #1e293b; border-radius: 10px; padding: 16px 20px; border-left: 4px solid #06b6d4;">
                      <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; font-weight: 700;">Balance Disponible en Cuentas</div>
                      <div style="color: #06b6d4; font-size: 26px; font-weight: 800;">$${alert.balance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                  
                  <!-- Sugerencias -->
                  <div style="margin-bottom: 28px;">
                    <div style="color: #f59e0b; font-size: 15px; margin: 0 0 14px 0; font-weight: 700;">
                      💡 Sugerencias inteligentes para solventarlo:
                    </div>
                    <ul style="color: #cbd5e1; font-size: 13px; line-height: 1.7; margin: 0; padding-left: 20px;">
                      ${alert.sugerencias.map((s) => `<li style="margin-bottom: 8px;">${s}</li>`).join('')}
                    </ul>
                  </div>
                  
                  <!-- Botón de Acción -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 25px;">
                    <tr>
                      <td align="center">
                        <a href="${appUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, #147DF0 0%, #00C0FA 100%); color: #ffffff; padding: 14px 34px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 15px rgba(20,125,240,0.35);">
                          Ver en LANITAPP →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0f172a; padding: 24px 30px; text-align: center; border-top: 1px solid #334155;">
                  <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                    Este es un mensaje automático de <strong style="color: #94a3b8;">LANITAPP</strong> • Sistema de Control Financiero Inteligente<br>
                    Por favor no respondas a este correo.
                  </p>
                  <p style="color: #475569; font-size: 11px; margin: 12px 0 0 0;">
                    © ${new Date().getFullYear()} LANITAPP. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail(email, subject, html);
};

/**
 * Detecta si hay déficit en la próxima quincena y envía alerta por email
 */
export const checkAndNotifyDeficit = async (): Promise<boolean> => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return false;
    }

    // 1. Validar sesión localmente sin emitir llamadas de red fallidas (403 Forbidden)
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) {
      return false;
    }

    // Si el token JWT ya caducó, no invocar la API hasta que se renueve
    const expiresAt = session.expires_at || 0;
    if (expiresAt && expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const user = session.user;
    const userEmail = user.email;
    if (!userEmail) return false;

    // Obtener datos del store de finanzas
    const store = useFinanceStore.getState();
    const { accounts, fixedIncomes, variableIncomes, fixedExpenses, variableExpenses, debts } = store;

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Determinar próxima quincena
    const nextQuincena: 'Q1' | 'Q2' = currentDay <= 15 ? 'Q1' : 'Q2';
    const nextFortnightType = nextQuincena === 'Q1' ? 'q1' : 'q2';
    const nextQuincenaDay = nextQuincena === 'Q1' ? '15' : '30';

    // 1. Ingresos proyectados para esta quincena
    const ingresosFijos = fixedIncomes
      .filter((f) => {
        if (f.is_active === false) return false;
        return f.default_fortnight === 'both' || f.default_fortnight === nextFortnightType;
      })
      .reduce((sum, f) => sum + (f.default_fortnight === 'both' ? f.amount : f.amount), 0);

    const ingresosVariables = variableIncomes
      .filter((v) => {
        const matchesMonth = v.year === currentYear && v.month === currentMonth;
        const matchesFn = v.fortnight === nextFortnightType || (v as any).quincena === (nextQuincena === 'Q1' ? 15 : 30);
        return matchesMonth && matchesFn;
      })
      .reduce((sum, v) => sum + v.amount, 0);

    const totalIngresos = ingresosFijos + ingresosVariables;

    // 2. Gastos fijos para esta quincena
    const gastosFijos = fixedExpenses
      .filter((e) => {
        if (e.is_active === false) return false;
        return e.default_fortnight === 'both' || e.default_fortnight === nextFortnightType;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    // 3. Gastos variables para esta quincena
    const gastosVariables = (variableExpenses || [])
      .filter((v) => {
        const matchesMonth = v.year === currentYear && v.month === currentMonth;
        const matchesFn = v.fortnight === nextFortnightType || (v as any).quincena === (nextQuincena === 'Q1' ? 15 : 30);
        return matchesMonth && matchesFn;
      })
      .reduce((sum, v) => sum + v.amount, 0);

    // 4. Cuotas de deuda vencidas o asignadas para esta quincena
    const cuotasDeudas = debts
      .filter((d) => {
        if (d.status === 'paid') return false;
        const remaining = d.current_balance !== undefined ? d.current_balance : d.total_amount || 0;
        if (remaining <= 0) return false;
        return d.fortnight_due === nextFortnightType || d.fortnight_due === 'both' || !d.fortnight_due;
      })
      .reduce((sum, d) => {
        const remaining = d.current_balance !== undefined ? d.current_balance : d.total_amount || 0;
        const installment = d.installment_amount || (d.pending_installments ? remaining / d.pending_installments : remaining);
        return sum + Number(installment || 0);
      }, 0);

    const totalGastos = gastosFijos + gastosVariables + cuotasDeudas;
    const netDifference = totalIngresos - totalGastos;

    // Solo si hay déficit (< 0)
    if (netDifference >= 0) {
      return false;
    }

    const deficit = Math.abs(netDifference);

    // Total balance en cuentas bancarias/efectivo
    const totalBalance = accounts.reduce(
      (sum, a) => sum + (Number((a as any).balance ?? a.initial_balance) || 0),
      0
    );

    // Llave única para dedup de alertas (evita spamear correos repetidos)
    const alertCycleKey = `lanitapp_deficit_alert_${currentYear}_${currentMonth}_${nextQuincena}`;
    const lastSentLocal = localStorage.getItem(alertCycleKey);
    if (lastSentLocal) {
      const hours = (Date.now() - Number(lastSentLocal)) / (1000 * 60 * 60);
      if (hours < 48) {
        return false;
      }
    }

    // Comprobar en Supabase si existe la tabla alert_logs
    try {
      const { data: recentLogs } = await supabase
        .from('alert_logs')
        .select('id, sent_at')
        .eq('user_id', user.id)
        .eq('type', 'deficit_alert')
        .eq('quincena', nextQuincena)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (recentLogs && recentLogs.length > 0) {
        const lastSent = new Date(recentLogs[0].sent_at).getTime();
        const hours = (Date.now() - lastSent) / (1000 * 60 * 60);
        if (hours < 48) {
          return false;
        }
      }
    } catch {
      // Si la tabla no existe en Supabase aún, se continúa con la verificación local
    }

    const alertData: DeficitAlert = {
      quincena: nextQuincena,
      fecha: nextQuincenaDay,
      mes: MONTH_NAMES[currentMonth],
      year: currentYear,
      deficit,
      balance: totalBalance,
      totalIngresos,
      totalGastos,
      sugerencias: generateSuggestions(deficit, totalBalance),
    };

    // Enviar correo
    await sendDeficitAlertEmail(userEmail, alertData);

    // Registrar en local
    try {
      localStorage.setItem(alertCycleKey, String(Date.now()));
    } catch {}

    // Registrar en Supabase alert_logs (silencioso si la tabla no existe aún)
    try {
      await supabase.from('alert_logs').insert({
        user_id: user.id,
        type: 'deficit_alert',
        quincena: nextQuincena,
        amount: deficit,
        sent_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      logger.warn('Notice: alert_logs table not configured or insert error:', dbErr);
    }

    return true;
  } catch (error) {
    logger.error('Error al verificar y notificar déficit:', error);
    return false;
  }
};
