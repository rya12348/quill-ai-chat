const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'user-agent': 'puffer-kb/1.0' };
const get = async (u) => (await fetch(u, { headers: UA })).json();

const SYN = {
  country: ['country', 'state', 'nation'],
  city: ['city', 'town', 'municipality'],
  movie: ['film', 'movie'], film: ['film', 'movie'],
  animal: ['animal', 'species', 'bird', 'mammal', 'fish', 'reptile', 'insect', 'amphibian', 'invertebrate'],
  actor: ['actor', 'actress', 'performer'],
  singer: ['singer', 'musician', 'vocalist'],
  band: ['band', 'group', 'duo', 'trio'],
  song: ['song', 'single', 'track'],
  book: ['novel', 'book', 'novella'],
  food: ['food', 'dish'],
  sport: ['sport', 'game'],
  company: ['company', 'corporation', 'business', 'brand'],
  brand: ['brand', 'company', 'product'],
  clothing: ['clothing', 'garment', 'item of clothing'],
  instrument: ['instrument'],
  element: ['element', 'chemical element'],
  state: ['state'],
};
const HEAD = /\b(?:name|a|an|the)\s+(.+?)\s+(?:whose|that|which|with|in|on|from|starting|ending|containing|including|starring|featuring|who|where)\b/i;

async function search(q, n = 5) {
  const j = await get(`${API}?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=${n}`);
  return (j.query && j.query.search || []).map(s => s.title);
}
async function pages(titles) {
  const j = await get(`${API}?action=query&prop=extracts&explaintext=1&exlimit=max&format=json&redirects=1&titles=${encodeURIComponent(titles.join('|'))}`);
  return Object.values(j.query && j.query.pages || {}).map(p => ({ title: p.title, text: (p.extract || '').slice(0, 30000) }));
}
async function intros(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 20) {
    const chunk = titles.slice(i, i + 20);
    const j = await get(`${API}?action=query&prop=extracts&exintro=1&explaintext=1&exlimit=max&format=json&redirects=1&titles=${encodeURIComponent(chunk.join('|'))}`);
    for (const p of Object.values(j.query && j.query.pages || {})) out[p.title] = (p.extract || '').slice(0, 400);
  }
  return out;
}
function headOf(cat) {
  const m = cat.match(/^name\s+(?:a|an|the)\s+([a-z ]+?)(?:\s+(?:whose|that|which|with|in|on|from|starting|ending|containing|starring|featuring|who|where|is|are|has|have)\b|$)/i);
  if (!m) return '';
  const words = m[1].trim().toLowerCase().split(/\s+/);
  return words[words.length - 1] || '';
}
const STOP = new Set(['the','a','an','name','list','this','that','these','those','it','its','in','of','and','for','on','by','with','from','as','at','is','are','was','were','also','one','two','first','second','new','world','united']);
function candidates(texts, propertyWords) {
  const count = new Map();
  for (const t of texts) {
    const re = /\b([A-Z][a-z]{2,}(?:\s+(?:of\s+|the\s+)?[A-Z][a-z]{2,}){0,3})\b/g;
    let m;
    while ((m = re.exec(t))) {
      const s = m[1].trim();
      if (STOP.has(s.toLowerCase())) continue;
      if (propertyWords.some(w => w.length > 3 && s.toLowerCase().includes(w))) continue;
      count.set(s, (count.get(s) || 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
}

const cats = [
  'Name a country with at least one active volcano',
  'Name a country whose national capital is on a river',
  'Name a country with coastlines on at least two oceans',
  'Name an item of formal wear (clothing and shoes, not jewelry)',
  'Name a movie starring Zendaya',
  'Name a country that borders exactly one other country',
  'Name a chemical element named after a place',
];
for (const cat of cats) {
  const t0 = Date.now();
  const head = headOf(cat);
  const prop = cat.replace(/^name\s+(?:a|an|the)\s+/i, '').toLowerCase().split(/\s+/);
  const hits = await search(`list of ${cat.replace(/^name\s+(?:a|an|the)\s+/i, '')}`, 3);
  const ps = await pages(hits.slice(0, 2));
  const cands = candidates(ps.map(p => p.text), prop).slice(0, 18);
  const syn = SYN[head] || [head];
  const ins = await intros(cands.map(c => c[0]));
  const ok = cands.filter(([c]) => {
    const intro = (ins[c] || '').toLowerCase();
    return syn.some(s => new RegExp('\b' + s + '\b').test(intro));
  }).slice(0, 8).map(x => x[0]);
  console.log(cat.slice(0, 52).padEnd(54) + (Date.now() - t0) + 'ms head=' + head);
  console.log('   pages: ' + hits.slice(0, 2).join(' | '));
  console.log('   ans  : ' + (ok.join(', ') || '(none)'));
}
