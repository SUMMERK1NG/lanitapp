import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';
import { logger } from '../utils/logger.ts';

export interface BiweeklyEmailPayload {
  to: string;
  userName: string;
  quincena: '15' | '30';
  mes: string;
  ingresosTotal: number;
  gastosFijos: number;
  deudasTotal: number;
  dineroLibre: number;
  dineroLibreVES: number;
  bcvRate: number;
}

// Remitente configurado con fallback al dominio personalizado oficial
const EMAIL_FROM = import.meta.env.VITE_EMAIL_FROM || 'LANITAPP <notificaciones@lanitapp.xyz>';

/**
 * Envío seguro de correos electrónicos a través de Supabase Edge Function 'send-email'.
 * La clave de Resend se mantiene 100% segura en el servidor/Edge sin exponerse al cliente.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string,
  from?: string
): Promise<{ success: boolean; data?: any }> => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase no está configurado para el envío de correos.');
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        from: from || EMAIL_FROM,
        subject,
        html,
        text,
      },
    });

    if (error) {
      logger.error('Error al invocar Edge Function send-email:', error);
      throw new Error(error.message || 'Error al enviar el correo a través de Supabase.');
    }

    logger.dev('✅ Correo enviado exitosamente:', data);
    return { success: true, data };
  } catch (err: any) {
    logger.error('❌ Error al enviar correo:', err);
    throw err;
  }
};

/**
 * Genera el reporte quincenal en HTML y lo envía de forma segura usando la Edge Function.
 */
export const sendBiweeklyReportEmail = async (payload: BiweeklyEmailPayload) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; background-color:#0b132b; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b132b; padding:35px 15px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:500px; background-color:#162032; border:1px solid #22304a; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
              <tr>
                <td style="padding:30px 24px 15px 24px; text-align:center;">
                  <div style="display:inline-block; background-color:#1e293b; border:1px solid #334155; border-radius:16px; padding:10px 16px; margin-bottom:8px;">
                    <span style="font-size:30px; line-height:1;">🦙</span>
                  </div>
                  <div style="color:#ffffff; font-size:22px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase;">LANITAPP</div>
                  <div style="color:#f97316; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Planificación Quincenal</div>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 30px 20px 30px; text-align:center;">
                  <h2 style="color:#ffffff; font-size:19px; font-weight:700; margin:0 0 10px 0;">Resumen Quincena ${payload.quincena} - ${payload.mes}</h2>
                  <p style="color:#94a3b8; font-size:14px; line-height:1.5; margin:0;">
                    Hola <strong>${payload.userName}</strong>, aquí tienes el balance proyectado de tus compromisos:
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 30px 20px 30px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a; border:1px solid #1e293b; border-radius:14px; padding:16px; margin-bottom:15px;">
                    <tr>
                      <td style="padding:8px 0; border-bottom:1px solid #1e293b; color:#94a3b8; font-size:13px;">Ingresos Estimados</td>
                      <td style="padding:8px 0; border-bottom:1px solid #1e293b; color:#10b981; font-weight:700; text-align:right; font-size:14px;">$ ${payload.ingresosTotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0; border-bottom:1px solid #1e293b; color:#94a3b8; font-size:13px;">Gastos Fijos</td>
                      <td style="padding:8px 0; border-bottom:1px solid #1e293b; color:#ef4444; font-weight:700; text-align:right; font-size:14px;">$ ${payload.gastosFijos.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0; border-bottom:1px solid #1e293b; color:#94a3b8; font-size:13px;">Cuotas de Deuda</td>
                      <td style="padding:8px 0; border-bottom:1px solid #1e293b; color:#f59e0b; font-weight:700; text-align:right; font-size:14px;">$ ${payload.deudasTotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0 2px 0; color:#ffffff; font-size:14px; font-weight:700;">Dinero Libre</td>
                      <td style="padding:10px 0 2px 0; color:#38bdf8; font-weight:800; text-align:right; font-size:16px;">$ ${payload.dineroLibre.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </table>
                  <div style="background-color:rgba(249,115,22,0.1); border:1px solid rgba(249,115,22,0.3); border-radius:10px; padding:10px 14px; text-align:center;">
                    <span style="color:#fb923c; font-size:12px; font-weight:600;">
                      ≈ Bs. ${payload.dineroLibreVES.toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa BCV: Bs. ${payload.bcvRate})
                    </span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color:#0e1726; border-top:1px solid #1e293b; padding:16px 20px; text-align:center; font-size:11px; color:#64748b;">
                  LANITAPP • Tu Gestor Financiero Personal
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendEmail(
    payload.to,
    `📊 Resumen Quincena ${payload.quincena} - LANITAPP`,
    htmlContent
  );
};
