import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_AUTH_MODE', 'ADMIN_PROXY_TARGET'])
  const authMode = env.VITE_AUTH_MODE || (command === 'build' ? 'api' : 'demo')
  if (!['api', 'demo'].includes(authMode)) throw new Error('VITE_AUTH_MODE 只能为 api 或 demo')
  const target = env.ADMIN_PROXY_TARGET?.trim()
  if (target) {
    try {
      const url = new URL(target)
      if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error()
    } catch { throw new Error('ADMIN_PROXY_TARGET 仅允许无认证信息、无路径的本机 HTTP/HTTPS 地址') }
  }
  return {
  plugins: [vue()],
  base: '/',
  define: { 'import.meta.env.VITE_AUTH_MODE': JSON.stringify(authMode) },
  build: { emptyOutDir: false },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    ...(authMode === 'api' && target ? { proxy: { '/api/v1/admin/auth': { target, changeOrigin: true }, '/api/v1/admin/users': { target, changeOrigin: true }, '/api/v1/admin/ledgers': { target, changeOrigin: true }, '/api/v1/admin/transactions': { target, changeOrigin: true }, '/api/v1/admin/budgets': { target, changeOrigin: true }, '/api/v1/admin/categories': { target, changeOrigin: true }, '/api/v1/admin/audit-logs': { target, changeOrigin: true }, '/api/v1/admin/system-status': { target, changeOrigin: true }, '/api/v1/admin/overview': { target, changeOrigin: true } } } : {}),
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  }
})
