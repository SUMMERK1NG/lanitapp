import { sendEmail } from './emailService.ts';
import { logger } from '../utils/logger.ts';

/**
 * Envía el correo de bienvenida unificado con diseño profesional oscuro (Navy)
 */
export const sendWelcomeEmail = async (
  email: string,
  firstName: string = 'Usuario'
): Promise<boolean> => {
  if (!email || !email.includes('@')) {
    return false;
  }

  const subject = '🚀 ¡Bienvenido a LANITAPP! Tu control financiero inteligente';
  const appUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://lanitapp.xyz';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido a LANITAPP</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b132b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b132b; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #162032; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.4); border: 1px solid #22304a;">
              
              <!-- Header con Gradiente Navy / Cyan -->
              <tr>
                <td style="background: linear-gradient(135deg, #147DF0 0%, #00C0FA 100%); padding: 40px 30px; text-align: center;">
                  <div style="display: inline-block; background-color: rgba(255,255,255,0.2); border-radius: 20px; padding: 8px 16px; margin-bottom: 12px;">
                    <span style="font-size: 36px; line-height: 1;">🦙</span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">¡Bienvenido a LANITAPP!</h1>
                  <p style="color: #e0f2fe; font-size: 15px; margin: 8px 0 0 0; font-weight: 500;">Tu aliado en el control financiero inteligente</p>
                </td>
              </tr>
              
              <!-- Cuerpo -->
              <tr>
                <td style="padding: 40px 32px;">
                  <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Hola <strong style="color: #38bdf8;">${firstName}</strong>,
                  </p>
                  <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 28px 0;">
                    Nos alegra mucho darte la bienvenida. A partir de ahora, tendrás el control total de tus ingresos, gastos, cuotas de deudas y metas de ahorro en un solo lugar, con sincronización en tiempo real y alertas inteligentes diseñadas para tu tranquilidad.
                  </p>
                  
                  <!-- Features / Beneficios -->
                  <div style="background-color: #0b132b; border: 1px solid #22304a; border-radius: 14px; padding: 22px 24px; margin-bottom: 28px;">
                    <h3 style="color: #f8fafc; font-size: 13px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">
                      ¿Qué puedes hacer desde hoy?
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                          📊 <strong>Planificación Quincenal:</strong> Proyecta tus días 15 y 30 con tasas oficiales BCV y Paralelo actualizadas.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                          🎯 <strong>Metas de Ahorro:</strong> Define tus objetivos y registra aportes quincenales para alcanzarlos.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                          ⚠️ <strong>Alertas Proactivas:</strong> Recibe avisos tempranos si tus compromisos superan tus ingresos.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                          📱 <strong>Offline-First PWA:</strong> Accede a tus finanzas y anota movimientos incluso sin internet.
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <!-- Botón CTA -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 15px;">
                    <tr>
                      <td align="center">
                        <a href="${appUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, #147DF0 0%, #00C0FA 100%); color: #ffffff; padding: 15px 38px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(20,125,240,0.35);">
                          Ir a mi Dashboard →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0e1726; padding: 24px 30px; text-align: center; border-top: 1px solid #22304a;">
                  <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
                    Este es un mensaje automático de <strong style="color: #94a3b8;">LANITAPP</strong> • Sistema de Control Financiero Inteligente<br>
                    ¿Necesitas ayuda o tienes dudas? Responde directamente a este correo.
                  </p>
                  <p style="color: #475569; font-size: 11px; margin: 10px 0 0 0;">
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

  try {
    const res = await sendEmail(email, subject, html);
    if (res.success) {
      logger.dev('[WELCOME EMAIL SENT] Enviado con éxito a:', email);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn('[WELCOME EMAIL ERROR]:', error);
    return false;
  }
};
