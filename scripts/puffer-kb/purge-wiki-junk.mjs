/*
 * Drops wiki-list answers the room has never accepted from the learned store.
 *
 * The wiki lane is a real source, but it follows the *phrase*: "name a colour of
 * the rainbow" matched the rainbow flag and produced Wiphala, Peace flag, Flag of
 * Cusco. Those passed into learned.json. The room's own accepted vocabulary
 * (kb.json voc) is the available check: a wiki answer nobody has ever been
 * credited for is a guess, while Red, Blue and Green are in it.
 *
 * `ai` and `ok` answers are left alone: model answers and accepted answers are
 * what the store is for.
 *
 * Run with serve.mjs STOPPED, or the live copy overwrites the file.
 *
 * Usage: node scripts/puffer-kb/purge-wiki-junk.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const STORE = path.join(ROOT, '.k3/learned.json');
const DRY = process.argv.includes('--dry');
const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));
const voc = new Set(String(kb.voc || '').split('|').map((w) => KR.norm(w)).filter(Boolean));

const store = JSON.parse(fs.readFileSync(STORE, 'utf8'));
const cats = store.cats || store;
let catsTouched = 0;
let dropped = 0;
const examples = [];
for (const key of Object.keys(cats)) {
  const e = cats[key];
  if (!e || !e.wiki) continue;
  const keep = {};
  let lost = 0;
  for (const a of Object.keys(e.wiki)) {
    if (voc.has(KR.norm(a))) { keep[a] = e.wiki[a]; continue; }
    lost++;
    if (examples.length < 12) examples.push(`${a} (${key})`);
  }
  if (lost) {
    catsTouched++;
    dropped += lost;
    e.wiki = keep;
  }
}
console.log(`wiki answers dropped: ${dropped} across ${catsTouched} categories`);
console.log('examples:', examples.join(' | ') || '(none)');
if (DRY) {
  console.log('dry run: nothing written');
} else {
  fs.writeFileSync(STORE, JSON.stringify(store));
  console.log('written:', STORE);
}
