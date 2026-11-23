const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'user-agent': 'puffer-kb/1.0 (local bot; contact: davehall1248@gmail.com)' };
let last = 0;
const pause = async (ms) => { const d = last + ms - Date.now(); if (d > 0) await new Promise(r => setTimeout(r, d)); last = Date.now(); };
const j = async (u) => { await pause(350); const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const qs = [
  'list of countries with active volcanoes',
  'countries with active volcanoes',
  'list of countries by number of oceans',
  'countries bordering two oceans',
  'list of national capitals by river',
  'capitals on rivers',
  'list of countries that border only one country',
  'countries with only one land border',
  'list of countries with monarchies',
  'list of countries by desert area',
  'formal wear list of items',
];
for (const q of qs) {
  const x = await j(`${API}?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=5`);
  const t = (x.query && x.query.search || []).map(s => s.title);
  console.log(q.slice(0, 42).padEnd(44) + '-> ' + t.join(' | ').slice(0, 150));
}
