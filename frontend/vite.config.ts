import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // In production /rss.xml and /sitemap.xml are Vercel rewrites to /api/*;
  // in dev, proxy them straight to the Supabase edge functions.
  const functionsBase = env.VITE_SUPABASE_URL ? `${env.VITE_SUPABASE_URL}/functions/v1` : null

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: functionsBase
        ? {
            '/rss.xml': {
              target: functionsBase,
              changeOrigin: true,
              rewrite: () => '/rss',
              // Supabase's gateway sanitizes HTML responses from edge functions
              // (content-type becomes text/plain + a sandbox CSP). The body is
              // intact, so restore the right headers based on who's asking —
              // mirrors what api/rss.ts does in production.
              configure: (proxy) => {
                proxy.on('proxyRes', (proxyRes, req) => {
                  delete proxyRes.headers['content-security-policy']
                  proxyRes.headers['cache-control'] = 'no-store'
                  const isBrowser =
                    req.headers['sec-fetch-dest'] === 'document' ||
                    (req.headers['accept'] || '').includes('text/html')
                  proxyRes.headers['content-type'] = isBrowser
                    ? 'text/html; charset=utf-8'
                    : 'application/rss+xml; charset=utf-8'
                })
              },
            },
            '/sitemap.xml': {
              target: functionsBase,
              changeOrigin: true,
              rewrite: () => '/sitemap',
            },
          }
        : undefined,
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  }
})
