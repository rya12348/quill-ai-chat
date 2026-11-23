// Ranks the categories the room actually showed by how little the pack gave
// for them. Input is the bot's own per-category record (window.__krCats()),
// so this reports the live game, not the offline eval set.
//
//   node catreport.mjs cats.json
import fs from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('usage: node catreport.mjs cats.json'); process.exit(2); }
const cats = JSON.parse(fs.readFileSync(path, 'utf8'));
const kb = JSON.parse(fs.readFileSync(new URL('./kb.json', import.meta.url), 'utf8'));
const KR = new Function(fs.readFileSync(new URL('./resolver.js', import.meta.url), 'utf8') + '\nreturn KR;')();

const rows = Object.keys(cats).map(k => {
  const r = cats[k];
  return { key: k, q: r.q || k, seen: r.n || 0, picks: r.p || 0, sent: r.s || 0, ok: r.ok || 0, bad: r.bad || 0, weak: r.w || 0, bw: r.bw || [] };
});

const hn = kb.hn || {};
const keys = Object.keys(hn);
const headNoun = q => {
  const w = KR.norm(q).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(x => x && !/^(name|a|an|the|of|that|is|are|in|on|with|english|word|words|term|terms)$/.test(x));
  return w[w.length - 1] || '';
};
// A prompt the pack has never seen can still be one word away from a prompt it
// knows; those near-misses are the cheapest coverage wins.
const nearMiss = q => {
  const k = KR.norm(q), hnq = headNoun(q);
  const hit = keys.find(x => x !== k && hnq && x.indexOf(hnq) >= 0);
  return hit || '';
};

const total = rows.length, seenTotal = rows.reduce((a, r) => a + r.seen, 0);
const thin = rows.filter(r => r.picks < 6);
const empty = rows.filter(r => r.picks === 0);
const silent = rows.filter(r => r.sent === 0);
const pct = n => (seenTotal ? (100 * n / seenTotal).toFixed(1) : '0.0') + '%';

console.log(`categories seen ${total} (${seenTotal} showings)`);
console.log(`  picks >= 6 (pack knows it) ${total - thin.length} | picks < 6 ${thin.length} | picks 0 ${empty.length}`);
console.log(`  showings with picks >= 6 ${pct(seenTotal - thin.reduce((a, r) => a + r.seen, 0))}`);
console.log(`  categories that sent nothing ${silent.length} (${silent.reduce((a, r) => a + r.seen, 0)} showings)`);
const rejected = rows.reduce((a, r) => a + r.bad, 0);
console.log(`  answers rejected by the room ${rejected}\n`);

const show = r => `${String(r.seen).padStart(3)}x  picks ${String(r.picks).padStart(3)}  sent ${String(r.sent).padStart(3)}  ok ${String(r.ok).padStart(3)}  bad ${String(r.bad).padStart(2)}  ${r.q}`;

console.log('WORST BY SHOWINGS (thin supply first)');
rows.filter(r => r.picks < 6).sort((a, b) => (b.seen - a.seen) || (a.picks - b.picks)).slice(0, 25).forEach(r => console.log('  ' + show(r)));

console.log('\nNEAREST PACK PROMPT FOR THE WORST ONES');
rows.filter(r => r.picks < 3).sort((a, b) => b.seen - a.seen).slice(0, 15).forEach(r => {
  const nm = nearMiss(r.q);
  console.log(`  ${r.q}\n      -> ${nm || '(no pack prompt shares its head noun)'}`);
});
