import { supabase, isSupabaseConfigured } from './supabase.ts';
import { logger } from '../utils/logger.ts';

/**
 * Envía correo de recuperación usando la Edge Function de Resend
 * (Solo si está configurada en Supabase, sino recurre al método nativo de Supabase)
 */
export const sendPasswordResetEmail = async (email: string): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    const resetLink = `${window.location.origin}/reset-password`;

    // Intentar usar la Edge Function de Resend
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        subject: '🔐 Recuperación de Contraseña - LANITAPP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b132b; color: #ffffff; padding: 25px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 32px;">🦙</span>
              <h2 style="color: #147DF0; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">LANITAPP</h2>
              <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Gestión Financiera Segura</p>
            </div>
            <div style="background-color: #162032; border: 1px solid #22304a; border-radius: 12px; padding: 20px; text-align: left;">
              <h3 style="color: #ffffff; margin-top: 0;">Recuperación de Contraseña</h3>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                Hemos recibido una solicitud para restablecer tu contraseña de acceso a <strong>LANITAPP</strong>.
              </p>
              <p style="color: #94a3b8; font-size: 13px;">
                Si tú solicitaste este cambio, haz clic en el siguiente enlace para continuar:
              </p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${resetLink}" 
                   style="background: linear-gradient(135deg, #147DF0, #00C0FA); color: #ffffff; padding: 14px 28px; 
                          text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
                  Restablecer Contraseña
                </a>
              </div>
              <p style="color: #64748b; font-size: 12px; border-top: 1px solid #22304a; padding-top: 12px; margin-top: 20px;">
                Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.
              </p>
            </div>
          </div>
        `,
      },
    });

    if (error) {
      logger.warn('[EMAIL SERVICE] Edge Function falló, usando método por defecto:', error);
      return false;
    }

    logger.dev('[EMAIL SERVICE] Correo enviado vía Resend con éxito:', email, data);
    return true;
  } catch (error) {
    logger.error('[EMAIL SERVICE ERROR]:', error);
    return false;
  }
};
