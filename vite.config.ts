import { spawn } from 'node:child_process'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Keep the local Buffy bridge alive with the dev server. It is deliberately
 * serve-only: production Workers never spawn a Node process.
 */
function buffyBridge(): Plugin {
  let child: ReturnType<typeof spawn> | null = null
  return {
    name: 'buffy-bridge',
    apply: 'serve',
    configureServer(server) {
      child = spawn(process.execPath, ['scripts/buffy-bridge.mjs'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      })
      child.on('exit', () => {
        child = null
      })
      server.httpServer?.once('close', () => {
        child?.kill()
        child = null
      })
    },
  }
}

/**
 * Keep the opt-in local Chrome bridge alive with the dev server. It is
 * serve-only: production Workers never spawn a Node process. Starting it once
 * with the dev server means “Use local Chrome” works without a second terminal
 * command. If the bridge is already running, leave that process alone.
 */
function localChromeBridge(): Plugin {
  let child: ReturnType<typeof spawn> | null = null
  let closed = false
  return {
    name: 'local-chrome-bridge',
    apply: 'serve',
    configureServer(server) {
      const start = async () => {
        try {
          const response = await fetch('http://127.0.0.1:8765/health', { signal: AbortSignal.timeout(700) })
          if (response.ok) return
        } catch {
          /* Not running yet; start it below. */
        }
        if (closed) return
        child = spawn(process.execPath, ['scripts/local-bridge.mjs'], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        })
        child.on('exit', () => {
          child = null
        })
      }
      void start()
      server.httpServer?.once('close', () => {
        closed = true
        child?.kill()
        child = null
      })
    },
  }
}

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
    plugins: [react(), tailwindcss(), cloudflare(), buffyBridge(), localChromeBridge()],
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
      // Benchmark runs update these artifacts; they must not reload the app
      // mid-turn. The local Chrome profile writes cookies and session files
      // continuously, so watching it restarts this server in a loop. Build
      // output and Wrangler's temp bundle belong to other processes too.
      watch: {
        ignored: [
          '**/bench/**',
          '**/.ink-chrome-profile/**',
          '**/.ink-test-profile/**',
          '**/.ink-live/**',
          '**/.agents/**',
          '**/dist/**',
          '**/.wrangler/**',
          '**/*.png',
        ],
      },
    },
    preview: {
      // `vite preview` needs the same forwarded-host treatment as the dev
      // server when someone opens the built app in a Codespace.
      host: codespaces ? '0.0.0.0' : '127.0.0.1',
      port: 4173,
      strictPort: true,
      allowedHosts: ['.app.github.dev', '.githubpreview.dev'],
    },
  }
})
