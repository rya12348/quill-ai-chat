// Copies the in-app browser's runtime out of node_modules into public/, so it
// is served as a static file pinned to the installed version instead of being
// hand-maintained. Runs before `dev` and `build`; the files it writes are
// generated and must not be edited by hand.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const copies = [
  // Ultraviolet: the client and service-worker bundles, plus the stock worker
  // entry we import them from.
  ['@titaniumnetwork-dev/ultraviolet/dist/uv.bundle.js', 'public/service/__uv/uv.bundle.js'],
  ['@titaniumnetwork-dev/ultraviolet/dist/uv.client.js', 'public/service/__uv/uv.client.js'],
  ['@titaniumnetwork-dev/ultraviolet/dist/uv.handler.js', 'public/service/__uv/uv.handler.js'],
  ['@titaniumnetwork-dev/ultraviolet/dist/uv.sw.js', 'public/service/__uv/uv.sw.js'],
  // bare-mux owns the SharedWorker that holds the transport. The UMD build is
  // used because the proxy pages are plain HTML, not bundled modules.
  ['@mercuryworkshop/bare-mux/dist/index.js', 'public/baremux/index.js'],
  ['@mercuryworkshop/bare-mux/dist/worker.js', 'public/baremux/worker.js'],
]

let copied = 0
for (const [source, destination] of copies) {
  const from = join(root, 'node_modules', source)
  const to = join(root, destination)
  if (!existsSync(from)) {
    console.error(`uv-assets: missing ${source}. Run npm install first.`)
    process.exit(1)
  }
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  copied += 1
}

console.log(`uv-assets: copied ${copied} runtime files into public/`)
