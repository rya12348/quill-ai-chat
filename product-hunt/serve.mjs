import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(import.meta.dirname)
const port = Number(process.env.PORT) || 5192
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
}

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  const path = resolve(join(root, normalize(pathname === '/' ? '/gallery-01.html' : pathname)))
  if (!path.startsWith(root)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    if (!(await stat(path)).isFile()) throw new Error('not a file')
    const body = await readFile(path)
    response.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    response.end(body)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Product Hunt assets: http://127.0.0.1:${port}/`)
})
