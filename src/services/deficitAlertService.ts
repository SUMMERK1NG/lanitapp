import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { sendEmail } from './emailService.ts';
import { useFinanceStore } from '../stores/useFinanceStore.ts';

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
  const quincenaLabel = alert.quincena === 'Q1' ? 'Quincena 15' : 'Quincena 30';
  const subject = `⚠️ Alerta de Déficit - ${quincenaLabel} de ${alert.mes} - LANITAPP`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b132b; margin: 0; padding: 20px; color: #ffffff; }
          .container { max-width: 580px; margin: 0 auto; background-color: #1c2541; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
          .badge { display: inline-block; background: rgba(0,0,0,0.25); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 8px; letter-spacing: 0.5px; }
          .content { padding: 24px; }
          .card { background: rgba(11, 19, 43, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 16px 0; }
          .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
          .stat-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; }
          .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
          .stat-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
          .deficit-val { color: #f87171; }
          .balance-val { color: #38bdf8; }
          .suggestions-title { font-size: 14px; font-weight: 700; color: #f59e0b; margin: 20px 0 10px 0; display: flex; align-items: center; gap: 6px; }
          .suggestions-list { padding-left: 20px; margin: 0; }
          .suggestions-list li { margin-bottom: 8px; font-size: 13px; color: #cbd5e1; line-height: 1.5; }
          .cta-btn { display: inline-block; background: #147df0; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; text-align: center; margin-top: 20px; width: calc(100% - 48px); }
          .footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Alerta de Déficit Proyectado</h1>
            <div class="badge">${quincenaLabel} • ${alert.mes} ${alert.year}</div>
          </div>
          <div class="content">
            <p style="margin-top: 0; font-size: 14px; line-height: 1.5; color: #e2e8f0;">
              Hola, hemos detectado que los compromisos planificados para tu próxima <strong>${quincenaLabel} (Día ${alert.fecha})</strong> exceden tus ingresos proyectados.
            </p>

            <div class="card">
              <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">Resumen del Periodo:</div>
              <div class="stat-grid">
                <div class="stat-item">
                  <div class="stat-label">Déficit Proyectado</div>
                  <div class="stat-val deficit-val">-$${alert.deficit.toFixed(2)}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Balance Disponible</div>
                  <div class="stat-val balance-val">$${alert.balance.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div class="suggestions-title">
              💡 Sugerencias inteligentes de LANITAPP:
            </div>
            <ul class="suggestions-list">
              ${alert.sugerencias.map((s) => `<li>${s}</li>`).join('')}
            </ul>

            <center>
              <a href="http://localhost:5173" class="cta-btn">
                Abrir Planificador Quincenal en LANITAPP
              </a>
            </center>
          </div>
          <div class="footer">
            LANITAPP • Notificación financiera preventiva automática.
          </div>
        </div>
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

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return false;
    }

    const user = userData.user;
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
      (sum, a) => sum + (Number(a.balance ?? a.initial_balance) || 0),
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
      console.warn('Notice: alert_logs table not configured or insert error:', dbErr);
    }

    return true;
  } catch (error) {
    console.error('Error al verificar y notificar déficit:', error);
    return false;
  }
};
