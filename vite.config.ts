import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'resend-api-proxy',
        configureServer(server) {
          server.middlewares.use('/api/send-email', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: 'Method not allowed' }));
              return;
            }
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const apiKey = env.VITE_RESEND_API_KEY || parsed.apiKey;
                if (!apiKey) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ message: 'Clave VITE_RESEND_API_KEY no configurada' }));
                  return;
                }

                const resendResponse = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    from: parsed.from || 'LANITAPP <onboarding@resend.dev>',
                    to: parsed.to,
                    subject: parsed.subject,
                    html: parsed.html,
                  }),
                });

                const data = await resendResponse.json();
                res.statusCode = resendResponse.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: err?.message || 'Error en el servidor de correo' }));
              }
            });
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.png', 'logo.png', 'favicon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'LANITAPP',
          short_name: 'LANITAPP',
          start_url: '/',
          display: 'standalone',
          background_color: '#0b132b',
          theme_color: '#0b132b',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});