// Strips files the Sites uploader refuses (hidden files and source maps)
// from the build output, so `deploy.json` can point straight at dist/, then
// versions the service worker and gives it the complete shell precache list.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

function clean(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name.startsWith('.') || name.endsWith('.map')) {
      rmSync(path, { recursive: true, force: true })
      continue
    }
    if (statSync(path).isDirectory()) clean(path)
  }
}

function listFiles(dir, prefix = '') {
  const files = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) files.push(...listFiles(path, `${prefix}${name}/`))
    else files.push(`${prefix}${name}`)
  }
  return files
}

const dist = fileURLToPath(new URL('../dist', import.meta.url))
clean(dist)

// A redeploy changes the cache names, so users cannot be pinned to a shell
// whose hashed assets no longer exist. The hash covers the HTML and every
// emitted asset name and size.
const client = join(dist, 'client')
const digest = createHash('sha256')
digest.update(readFileSync(join(client, 'index.html')))
const assetDir = join(client, 'assets')
for (const name of readdirSync(assetDir).sort()) {
  digest.update(name)
  digest.update(String(statSync(join(assetDir, name)).size))
}
const version = digest.digest('hex').slice(0, 12)

// index.html is served at /; sw.js must never be cached by its own worker.
const precache = listFiles(client)
  .filter((file) => file !== 'sw.js')
  .map((file) => (file === 'index.html' ? '/' : `/${file.replaceAll('\\', '/')}`))

const swPath = join(client, 'sw.js')
const sw = readFileSync(swPath, 'utf8')
if (!sw.includes('__QUILL_VERSION__') || !sw.includes('__QUILL_PRECACHE__')) {
  throw new Error('service worker placeholders are missing from dist/client/sw.js')
}
writeFileSync(swPath, sw.replaceAll('__QUILL_VERSION__', version).replace('__QUILL_PRECACHE__', JSON.stringify(precache)))
console.log(`service worker cache version ${version}`)
console.log(`precached ${precache.length} shell URLs`)
