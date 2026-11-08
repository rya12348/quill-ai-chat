import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  // Codespaces supplies these in process.env, not in a dotenv file.
  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  const codespaces = Boolean(
    env.CODESPACE_NAME ||
      env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ||
      runtimeEnv.CODESPACE_NAME ||
      runtimeEnv.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ||
      runtimeEnv.CODESPACES,
  )

  return {
    plugins: [react(), tailwindcss(), cloudflare()],
    server: {
      // Another local project binds 127.0.0.1:5173. Locally, keep this app on a
      // dedicated IPv4 loopback port so `localhost` can never mix its HTML with
      // that app's assets. Codespaces reaches the container over a forwarded
      // HTTPS origin, so listen on all interfaces there.
      host: codespaces ? '0.0.0.0' : '127.0.0.1',
      port: 5180,
      strictPort: true,
      allowedHosts: ['.app.github.dev', '.githubpreview.dev'],
      // Codespaces serves port 5180 on HTTPS 443; point the HMR client there.
      ...(codespaces ? { hmr: { protocol: 'wss', clientPort: 443 } } : {}),
      // Benchmark runs update these artifacts; they must not reload the app mid-turn.
      watch: { ignored: ['**/bench/**'] },
    },
  }
})
