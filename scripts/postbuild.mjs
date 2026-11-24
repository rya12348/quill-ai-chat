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
// whose hashed assets no longer exist. The hash covers the HTML, the service
// worker and every emitted asset name and size.
const client = join(dist, 'client')
// Always start from the source template. A previous postbuild may have left a
// substituted sw.js in dist, and Vite can skip copying an older public file
// over it on a later build.
const swSource = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8')
if (!swSource.includes('__STET_VERSION__') || !swSource.includes('__STET_PRECACHE__')) {
  throw new Error('service worker placeholders are missing from public/sw.js')
}
const digest = createHash('sha256')
digest.update(readFileSync(join(client, 'index.html')))
digest.update(swSource)
const assetDir = join(client, 'assets')
for (const name of readdirSync(assetDir).sort()) {
  digest.update(name)
  digest.update(String(statSync(join(assetDir, name)).size))
}
// Public files keep stable names, so hash their contents too; otherwise a
// changed illustration can stay behind the previous service-worker cache.
for (const file of listFiles(client).sort()) {
  if (file.startsWith('assets/')) continue
  // The party's answer cards are 37MB of static data fetched on demand; they
  // have no place in the shell's cache version.
  if (file.startsWith('puffer/')) continue
  digest.update(file)
  digest.update(readFileSync(join(client, file)))
}
const version = digest.digest('hex').slice(0, 12)

// index.html is served at /; sw.js must never be cached by its own worker.
const precache = listFiles(client)
  .filter((file) => file !== 'sw.js')
  // Never precache the party's card files: 939 of them, 37MB, and the game only
  // ever opens the one card it is playing.
  .filter((file) => !file.startsWith('puffer/'))
  .map((file) => (file === 'index.html' ? '/' : `/${file.replaceAll('\\', '/')}`))

const swPath = join(client, 'sw.js')
const sw = swSource
writeFileSync(swPath, sw.replaceAll('__STET_VERSION__', version).replace('__STET_PRECACHE__', JSON.stringify(precache)))
console.log(`service worker cache version ${version}`)
console.log(`precached ${precache.length} shell URLs`)
