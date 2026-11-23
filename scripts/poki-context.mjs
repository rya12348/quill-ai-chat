import { readFileSync } from 'node:fs'
const file = process.argv[2]
let h = readFileSync(file, 'utf8')
h = h.split('\\u002F').join('/').split('\\u002f').join('/').split('\\/').join('/')
const needle = process.argv[3] ?? 'gdn.poki.com'
let at = h.indexOf(needle)
let shown = 0
while (at >= 0 && shown < 4) {
  console.log('...' + h.slice(Math.max(0, at - 220), at + 160).replace(/\s+/g, ' '))
  console.log('---')
  at = h.indexOf(needle, at + 1)
  shown += 1
}
