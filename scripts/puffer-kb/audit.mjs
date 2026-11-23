// Provenance audit over the real live labels. Answers are only as good as the
// lookup that produced them, so this counts where each one came from instead of
// just how many there were.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));

const csv = fs.readFileSync(path.join(HERE, '../../.k/prompts.csv'), 'utf8');
function fields(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
const rows = csv.split(/\r?\n/);
const head = fields(rows.shift());
const qi = head.indexOf('prompt');
const labels = [...new Set(rows.filter(Boolean).map((r) => (fields(r)[qi] || '').trim()).filter((s) => s.length > 8))];

const STRONG = /^(prompt|corpus)-(deep|krillion)/;
const srcCount = Object.create(null);
let strong = 0, weak = 0, empty = 0, badShape = 0, unknownSrc = 0, tierless = 0;
const worst = [];

for (const q of labels) {
  const tr = [];
  const picks = KR.resolve(q, kb, { deep: true, rare: true, trace: tr });
  const first = picks[0];
  const src = first ? (tr.find((t) => KR.norm(t.a) === KR.norm(first)) || {}).src || '' : '';
  srcCount[src || '(none)'] = (srcCount[src || '(none)'] || 0) + 1;
  if (!first) { empty++; worst.push([q, 'NO ANSWER']); continue; }
  if (STRONG.test(src)) strong++; else weak++;
  for (const a of picks) {
    const s = (tr.find((t) => KR.norm(t.a) === KR.norm(a)) || {}).src || '';
    if (!s || s === '?') unknownSrc++;
    if (!KR.shapeOk(q, a)) badShape++;
    if (!KR.hasTier(kb, KR.norm(a))) tierless++;
  }
}

const pct = (x) => ((100 * x) / labels.length).toFixed(1) + '%';
console.log(`labels ${labels.length}`);
console.log(`  first answer from a deep list ${pct(strong)} | from a weak/other source ${pct(weak)} | no answer ${empty}`);
console.log(`  answers with no provenance ${unknownSrc} | no tier data ${tierless} | shape violations ${badShape}`);
const top = Object.keys(srcCount).sort((a, b) => srcCount[b] - srcCount[a]).slice(0, 8);
console.log('  first-answer sources: ' + top.map((k) => `${k}=${srcCount[k]}`).join(', '));
for (const [q, why] of worst.slice(0, 12)) console.log(`  EMPTY ${String(q).slice(0, 58)} (${why})`);
