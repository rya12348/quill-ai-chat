import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // Another local project binds 127.0.0.1:5173. Use a dedicated IPv4 loopback
  // port so `localhost` can never mix this app's HTML with that app's assets.
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    // Benchmark runs update these artifacts; they must not reload the app mid-turn.
    watch: { ignored: ['**/bench/**'] },
  },
})
