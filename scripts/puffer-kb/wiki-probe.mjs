/*
 * Probe: can a Wikipedia list page answer the categories the pack gets wrong or
 * silent? Prints extracted list items so the heuristics can be tuned before they
 * are baked into the server lane.
 *
 * Usage: node scripts/puffer-kb/wiki-probe.mjs
 */

const UA = 'puffer-bot/1.0 (local play helper)';
const clue = (q) => q;

async function jget(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const STOP = /^(main article|see also|references|external links|notes|further reading|bibliography|gallery|sources|contents)$/i;

function items(html) {
  const out = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html))) {
    let t = m[1]
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<sup[\s\S]*?<\/sup>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\[\d+\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t || t.length < 2 || t.length > 46) continue;
    if (STOP.test(t)) continue;
    // Drop the tail after a dash/parenthesis/colon: list pages decorate entries.
    t = t.split(/\s+[–—-]\s+|:\s|\(/)[0].trim();
    if (!t || t.length < 2 || t.length > 34) continue;
    if (/^\d{3,4}$/.test(t)) continue;
    if (/\b(is|was|are|were)\b/i.test(t) && t.split(' ').length > 5) continue;
    out.push(t);
  }
  // de-dupe, keep order
  const seen = new Set();
  return out.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function tryQuery(phrase) {
  const s = await jget('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(phrase) + '&srlimit=4&format=json&origin=*');
  const hits = (s.query && s.query.search) || [];
  const best = hits.find((h) => /^list of /i.test(h.title)) || hits[0];
  if (!best) throw new Error('no hits');
  const p = await jget('https://en.wikipedia.org/w/api.php?action=parse&page=' +
    encodeURIComponent(best.title) + '&prop=text&format=json&redirects=1&origin=*');
  const html = (p.parse && p.parse.text && p.parse.text['*']) || '';
  return { title: best.title, items: items(html).slice(0, 12) };
}

const cases = {
  'Name a guitar brand': ['list of guitar brands', 'guitar brands'],
  'Name something in a hospital': ['hospital equipment', 'list of medical equipment'],
  'Name a TV show from the 90s': ['list of 1990s television programs', '1990s television shows'],
  'Name a thing you would find in a pirate ship': ['pirate ship', 'pirate weapons'],
  'Name a colour of the rainbow': ['rainbow colours', 'spectral colours'],
  'Name a smell that you love': ['list of smells', 'pleasant smells'],
  'Name a thing you do in the shower': ['shower', 'personal hygiene'],
  'Name a classic first date activity': ['list of date ideas', 'first date'],
};

for (const [q, phrases] of Object.entries(cases)) {
  console.log('\n' + q);
  for (const ph of phrases) {
    try {
      const r = await tryQuery(ph);
      console.log(`  "${ph}" -> ${r.title}: ${r.items.join(' | ') || '(nothing)'}`);
    } catch (e) {
      console.log(`  "${ph}" -> FAIL ${e.message}`);
    }
  }
}
