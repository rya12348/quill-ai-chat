// Accuracy check with ground truth: for every prompt the game has answered
// before, its own Deep cut / Krillion lists say what a winning answer looks
// like. Resolving that prompt must return those words, not neighbours of them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));

const rows = fs.readFileSync(path.join(HERE, '../../.k/prompts.csv'), 'utf8').split(/\r?\n/).slice(1);
const qi = 4;
const liveLabels = [...new Set(rows.map((r) => (r.split(',')[qi] || '').trim()).filter((s) => s.length > 8))];

// MODE=win measures the volume-first order (what a rated round is actually won
// by); the default still measures the rare-only order.
const MODE = process.env.MODE === 'win' ? 'win' : 'deep';
const OPTS = MODE === 'win' ? { win: true, fallback: false } : { deep: true, fallback: false };

let n = 0, hit1 = 0, inList = 0, returned = 0, emptyLabels = 0;
const misses = [];
for (const [label, entry] of Object.entries(kb.px)) {
  const truth = new Set(String(entry.d || '').split('|').filter(Boolean).map((w) => KR.norm(w)));
  if (!truth.size) continue;
  n++;
  const r = KR.resolve(label, kb, OPTS);
  if (!r.length) { emptyLabels++; misses.push([label, '(none)']); continue; }
  if (truth.has(KR.norm(r[0]))) hit1++;
  for (const a of r) { returned++; if (truth.has(KR.norm(a))) inList++; }
  if (!truth.has(KR.norm(r[0]))) misses.push([label, r.slice(0, 3).join(', ')]);
}
const pct = (x, d) => (d ? ((100 * x) / d).toFixed(1) + '%' : 'n/a');
console.log(`mode ${MODE}`);
console.log(`stored prompts with ground truth ${n}`);
console.log(`  first answer correct ${pct(hit1, n)} | answers inside the list ${pct(inList, returned)} | empty ${pct(emptyLabels, n)}`);
console.log(`live labels ${liveLabels.length}`);
for (const [l, got] of misses.slice(0, 10)) console.log(`  MISS ${l.slice(0, 44).padEnd(46)} -> ${String(got).slice(0, 44)}`);
