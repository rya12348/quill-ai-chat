import fs from 'node:fs';
const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'user-agent': 'puffer-kb/1.0 (local bot; contact: davehall1248@gmail.com)' };
let last = 0;
const pause = async (ms) => { const d = last + ms - Date.now(); if (d > 0) await new Promise(r => setTimeout(r, d)); last = Date.now(); };
const j = async (u) => { await pause(350); const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const kb = JSON.parse(fs.readFileSync('kb.json', 'utf8'));
const CTY = new Set(kb.cty.split('|').map(w => w.toLowerCase().trim()).filter(Boolean));
const STOP = new Set('a an the with without at least one two three more than on in of from whose that which has have having is are was were and or their its his her by as to for into under over near both all any'.split(' '));
const plural = (h) => h.endsWith('y') ? h.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(h) ? h + 'es' : h + 's';
function parseCat(cat) {
  const bare = cat.replace(/^name\s+(a|an|the)\s+/i, '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  const m = bare.match(/^(.+?)\s+(?:whose|that|which|with|in|on|from|starting|ending|containing|including|starring|featuring|who|where|is|are|has|have)\b\s*(.*)$/i);
  const head = (m ? m[1] : bare).toLowerCase().trim();
  const qual = (m ? m[2] : '').toLowerCase().replace(/[^a-z ]/g, ' ').trim();
  const words = qual.split(/\s+/).filter(w => w && !STOP.has(w) && w.length > 2);
  return { head, qual, words };
}
async function search(q, n = 6) {
  const x = await j(`${API}?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=${n}`);
  return (x.query && x.query.search || []).map(s => s.title);
}
async function wikitext(title) {
  const x = await j(`${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&redirects=1`);
  return (x.parse && x.parse.wikitext && x.parse.wikitext['*']) || '';
}
function membersFrom(wt, lexicon) {
  const counts = new Map();
  const lin = wt.replace(/\n==+[^=]+==+/g, '\n');
  for (const line of lin.split('\n')) {
    if (!/^\s*[*#|!]/.test(line)) continue;
    const re = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
    let m;
    while ((m = re.exec(line))) {
      const t = m[1].replace(/_/g, ' ').trim().toLowerCase();
      if (lexicon.size && !lexicon.has(t)) continue;
      if (!lexicon.size && (t.length < 3 || t.length > 40)) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
const cats = [
  'Name a country with at least one active volcano',
  'Name a country with coastlines on at least two oceans',
  'Name a country that borders exactly one other country',
  'Name a country with a monarchy',
  'Name a country that has a desert',
  'Name a country whose national capital is on a river',
  'Name a chemical element named after a place',
];
for (const cat of cats) {
  const t0 = Date.now();
  const { head, words } = parseCat(cat);
  const q = 'list of ' + plural(head) + ' ' + words.join(' ');
  const hits = await search(q, 6);
  const listy = hits.filter(t => /^list of/i.test(t));
  let ans = [], used = '';
  for (const t of listy.slice(0, 2)) {
    const lex = /countr/.test(head) ? CTY : new Set();
    const mem = membersFrom(await wikitext(t), lex);
    if (mem.length > ans.length) { ans = mem; used = t; }
  }
  console.log(cat.slice(0, 50).padEnd(52) + (Date.now() - t0) + 'ms  q="' + q + '"');
  console.log('   lists: ' + listy.slice(0, 3).join(' | ').slice(0, 140));
  console.log('   ans  : ' + (ans.slice(0, 10).map(x => x[0]).join(', ') || '(none)') + (used ? '   [' + used + ']' : ''));
}
