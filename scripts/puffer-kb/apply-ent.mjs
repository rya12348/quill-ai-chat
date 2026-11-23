// Merge scripts/puffer-kb/ent-extra.json into kb.json's entity index and rebuild
// the packed pack the browser loads (dist/kb.txt, gzip+base64, same encoding as
// build-kb.mjs). Data-only: no network, no WordNet, no model.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KBFILE = path.join(HERE, 'kb.json');
const EXTRA = path.join(HERE, 'ent-extra.json');
const DIST = path.join(HERE, 'dist');

const kb = JSON.parse(fs.readFileSync(KBFILE, 'utf8'));
const extra = JSON.parse(fs.readFileSync(EXTRA, 'utf8'));
kb.ent = kb.ent || {};

const names = new Set(String(kb.entn || '').split('|').filter(Boolean));
let added = 0, appendedWords = 0;

// The resolver keys an entity by `baseKey(clue)`, which usually repeats the
// entity ("Name a Disney movie" -> 'disney|disney movie'). build-kb's own keys do
// the same ('pixar|pixar character'), so every curated key is written in both
// shapes - otherwise 'disney|movie' exists and is never looked up.
const expanded = {};
for (const [key, list] of Object.entries(extra)) {
  expanded[key] = list;
  const bar0 = key.lastIndexOf('|');
  const ent0 = key.slice(0, bar0).trim();
  const kind0 = key.slice(bar0 + 1).trim();
  if (kind0 && kind0.indexOf(ent0 + ' ') !== 0) {
    expanded[ent0 + '|' + ent0 + ' ' + kind0] = list;
    const sing = kind0.replace(/ies$/, 'y').replace(/s$/, '');
    if (sing !== kind0) expanded[ent0 + '|' + ent0 + ' ' + sing] = list;
  }
}

for (const [key, list] of Object.entries(expanded)) {
  const bar = key.lastIndexOf('|');
  if (bar < 0) { console.error('bad key', key); process.exit(1); }
  const name = key.slice(0, bar).trim();
  const words = String(list).split('|').map((s) => s.trim()).filter(Boolean);
  const cur = String(kb.ent[key] || '').split('|').filter(Boolean);
  const have = new Set(cur.map((w) => w.toLowerCase()));
  const fresh = words.filter((w) => !have.has(w.toLowerCase()));
  if (fresh.length) {
    kb.ent[key] = cur.concat(fresh).join('|');
    appendedWords += fresh.length;
    added++;
  }
  // The resolver only finds an entity that is in entn (or matched in the text).
  if (!names.has(name)) { names.add(name); }
}

kb.entn = [...names].join('|');
const json = JSON.stringify(kb);
fs.writeFileSync(KBFILE, json);

const gz = zlib.gzipSync(Buffer.from(json), { level: 9 });
const b64 = gz.toString('base64');
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'kb.txt'), b64);
const CHUNK = 80000;
let n = 0;
for (let off = 0; off < b64.length; off += CHUNK) {
  fs.writeFileSync(path.join(DIST, `kb-part-${String(++n).padStart(2, '0')}.txt`), b64.slice(off, off + CHUNK));
}
console.log(`ent keys touched=${added} words appended=${appendedWords} entn names=${names.size}`);
console.log(`kb.json=${(Buffer.byteLength(json) / 1024).toFixed(0)}KB gzip=${(gz.length / 1024).toFixed(0)}KB base64=${(b64.length / 1024).toFixed(0)}KB parts=${n}`);
