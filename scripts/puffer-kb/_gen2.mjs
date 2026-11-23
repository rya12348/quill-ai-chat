import fs from 'node:fs';
const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'user-agent': 'puffer-kb/1.0 (local bot; contact: davehall1248@gmail.com)' };
let last = 0;
const pause = async (ms) => { const d = last + ms - Date.now(); if (d > 0) await new Promise(r => setTimeout(r, d)); last = Date.now(); };
const j = async (u) => { await pause(400); const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const kb = JSON.parse(fs.readFileSync('kb.json', 'utf8'));
const CTY = new Set(kb.cty.split('|').map(w => w.toLowerCase().trim()).filter(Boolean));
async function search(q, n = 5) {
  const x = await j(`${API}?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=${n}`);
  return (x.query && x.query.search || []).map(s => s.title);
}
async function extract(titles) {
  const x = await j(`${API}?action=query&prop=extracts&explaintext=1&exlimit=max&format=json&redirects=1&titles=${encodeURIComponent(titles.join('|'))}`);
  return Object.values(x.query && x.query.pages || {}).map(p => ({ title: p.title, text: p.extract || '' }));
}
function headOf(cat) {
  const m = cat.replace(/^name\s+(a|an|the)\s+/i, '').match(/^([a-z ]+?)(?:\s+(?:whose|that|which|with|in|on|from|starting|ending|containing|starring|featuring|who|where|is|are|has|have)\b|$)/i);
  if (!m) return '';
  return m[1].trim().toLowerCase().split(/\s+/).pop();
}
function countriesIn(text) {
  const seen = new Map();
  const words = text.split(/[^A-Za-z' ]+/);
  for (const w of words) {
    const t = w.trim().toLowerCase();
    if (!t) continue;
    // multiword country names
    const parts = t.split(/\s+/);
    for (let n = Math.min(4, parts.length); n >= 1; n--) {
      for (let i = 0; i + n <= parts.length; i++) {
        const s = parts.slice(i, i + n).join(' ');
        if (CTY.has(s)) seen.set(s, (seen.get(s) || 0) + 1);
      }
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]);
}
const cats = [
  'Name a country with at least one active volcano',
  'Name a country whose national capital is on a river',
  'Name a country with coastlines on at least two oceans',
  'Name a country that borders exactly one other country',
  'Name a country that has a desert',
  'Name a country with a monarchy',
];
for (const cat of cats) {
  const t0 = Date.now();
  const bare = cat.replace(/^name\s+(a|an|the)\s+/i, '');
  const hits = await search(bare, 5);
  const good = hits.filter(t => !/^List of|^Lists of/i.test(t)).slice(0, 3);
  const ps = await extract(good);
  const hits2 = await search('list of ' + bare, 3);
  const ps2 = hits2.length ? await extract(hits2.slice(0, 2)) : [];
  const all = new Map();
  for (const p of ps.concat(ps2)) for (const [c, n] of countriesIn(p.text)) all.set(c, (all.get(c) || 0) + n);
  const top = [...all.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(cat.slice(0, 50).padEnd(52) + (Date.now() - t0) + 'ms');
  console.log('   pages: ' + good.concat(hits2.slice(0, 2)).join(' | ').slice(0, 120));
  console.log('   ans  : ' + top.map(x => x[0] + '(' + x[1] + ')').join(', '));
}
