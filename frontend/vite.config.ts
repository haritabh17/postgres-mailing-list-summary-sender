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
