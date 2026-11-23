// Coverage on the labels players actually see (.k/prompts.csv), not just the
// prompts already stored in dives.json. Reports the pack on its own, then asks
// the live resolver about every label the pack could not answer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));

const csv = fs.readFileSync(path.join(HERE, '../../.k/prompts.csv'), 'utf8');
// The prompt column contains commas ("...nuclear weapons (countries only), ..."),
// so split on real field boundaries rather than every comma.
function fields(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const rows = csv.split(/\r?\n/);
const head = fields(rows.shift());
const qi = head.indexOf('prompt');
const labels = [...new Set(rows.filter(Boolean).map((r) => (fields(r)[qi] || '').trim()).filter((s) => s.length > 8))];

const stats = { n: labels.length, ge1: 0, ge2: 0, ge4: 0, none: 0, any: 0, fbOnly: 0 };
const weak = [];
for (const q of labels) {
  const tr = [];
  const all = KR.resolve(q, kb, { deep: true, trace: tr });
  const deep = all.filter((a) => KR.deepRank(kb, a) >= 3);
  if (deep.length) stats.ge1++;
  if (deep.length >= 2) stats.ge2++;
  if (deep.length >= 4) stats.ge4++;
  if (!deep.length) { stats.none++; weak.push(q); }
  if (all.length) stats.any++;
  if (!deep.length && all.length && tr.some((t) => /fallback/.test(t.src || ''))) stats.fbOnly++;
}
const pct = (x) => ((100 * x) / stats.n).toFixed(1) + '%';
console.log(`live labels ${stats.n}`);
console.log(`  >=1 deep answer ${pct(stats.ge1)} | >=2 ${pct(stats.ge2)} | >=4 ${pct(stats.ge4)} | none ${stats.none}`);
console.log(`  any answer at all ${pct(stats.any)} | emergency-fallback only ${pct(stats.fbOnly)}`);

// What the live resolver adds for the labels the pack cannot answer at all.
const LIMIT = Number(process.env.LIMIT || 40);
async function one(q) {
  try {
    const r = await fetch('http://127.0.0.1:5201/resolve?q=' + encodeURIComponent(q));
    const j = await r.json();
    const ok = (j.answers || []).map((a) => String(a).trim()).filter((a) =>
      a && KR.deepRank(kb, a) >= 3 && KR.shapeOk(q, a));
    return { q, ok };
  } catch (e) { return { q, ok: [], err: String(e.message || e) }; }
}
const sample = weak.slice(0, LIMIT);
const got = [];
for (let i = 0; i < sample.length; i += 6) {
  const batch = await Promise.all(sample.slice(i, i + 6).map(one));
  got.push(...batch);
}
const helped = got.filter((g) => g.ok.length);
console.log(`live probe on ${got.length} empty labels: ${helped.length} gained deep answers`);
for (const g of helped.slice(0, 8)) console.log(`  ${g.q.slice(0, 48)} -> ${g.ok.slice(0, 4).join(', ')}`);
for (const g of got.filter((x) => !x.ok.length).slice(0, 5)) console.log(`  still empty: ${g.q.slice(0, 48)}`);
