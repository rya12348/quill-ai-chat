/*
 * Builds the Puffer Party knowledge pack.
 *
 * Sources, all frozen at build time so the page needs no network:
 *   1. WordNet 3.1 noun hypernym graph  -> hyponyms for "name a type of X"
 *   2. .k/dives.json                    -> the game's own accepted answers
 *   3. .k/prompts.csv                   -> 900+ real Krillion prompt phrasings
 *   4. api.datamuse.com (ml)            -> associations for prompts WordNet
 *                                          cannot answer ("something in a bag")
 *
 * Output:
 *   scripts/puffer-kb/kb.json                  readable pack (tests)
 *   scripts/puffer-kb/dist/kb.txt              gzip+base64 of that pack
 *   scripts/puffer-kb/dist/kb-part-*.txt       the same, chunked for pasting
 *   scripts/puffer-party-bot.js                resolver + bot, pasteable
 *
 * Usage: node scripts/puffer-kb/build-kb.mjs [--no-net] [--limit-hn=N]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ARGS = process.argv.slice(2);
const NO_NET = ARGS.includes('--no-net');
const LIMIT_HN = (ARGS.find((a) => a.startsWith('--limit-hn=')) || '').split('=')[1];

const WN_DATA = path.join(ROOT, '.k3/dict/data.noun');
const DIVES = path.join(ROOT, '.k/dives.json');
const PROMPTS = path.join(ROOT, '.k/prompts.csv');
const CACHE = path.join(ROOT, '.k3/datamuse-cache.json');
const OUT = path.join(HERE, 'kb.json');
const DIST = path.join(HERE, 'dist');

// ---------------------------------------------------------------- WordNet ---
function parseWordNet(file) {
  const txt = fs.readFileSync(file, 'latin1');
  const syn = new Map();       // offset -> [lemmas]
  const lemmaIdx = new Map();  // lemma -> [offset]
  const parents = new Map();   // offset -> [parent offset]
  for (const raw of txt.split('\n')) {
    if (!raw || raw.startsWith('  ')) continue;
    const bar = raw.indexOf('|');
    const head = (bar > 0 ? raw.slice(0, bar) : raw).trim();
    if (!/^\d{8}\s/.test(head)) continue;
    const p = head.split(/\s+/);
    const off = p[0];
    const wcnt = parseInt(p[3], 16);
    if (!Number.isFinite(wcnt)) continue;
    let i = 4;
    const lem = [];
    for (let w = 0; w < wcnt; w++, i += 2) {
      const word = p[i].replace(/\([^)]*\)/g, '').replace(/_/g, ' ').toLowerCase().trim();
      if (word) lem.push(word);
    }
    const pcnt = parseInt(p[i], 10);
    i++;
    const par = [];
    // Pointers come as four fields: symbol, synset offset, pos, source/target.
    // Older copies pack them into one token, so accept that shape too.
    for (let k = 0; k < pcnt && Number.isFinite(pcnt); k++) {
      const tk = p[i] || '';
      if (tk.length > 14) {
        const sym = tk.slice(0, tk.length - 13);
        const to = tk.slice(tk.length - 13, tk.length - 5);
        if (sym === '@' || sym === '@i') par.push(to);
        i += 1;
        continue;
      }
      if (tk === '@' || tk === '@i') par.push(p[i + 1]);
      i += 4;
    }
    syn.set(off, lem);
    parents.set(off, par);
    for (const l of lem) {
      let arr = lemmaIdx.get(l);
      if (!arr) lemmaIdx.set(l, (arr = []));
      arr.push(off);
    }
  }
  const children = new Map();
  for (const [off, par] of parents) {
    for (const pi of par) {
      let arr = children.get(pi);
      if (!arr) children.set(pi, (arr = []));
      arr.push(off);
    }
  }
  return { syn, lemmaIdx, children };
}

// ----------------------------------------------------------------- corpora --
function parseCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"') {
        if (txt[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Order matters: the tiers run most-common -> most-obscure, and for the party
// the safest answer is the one everybody knows.
const TIER_ORDER = ['Plankton', 'Schooler', 'Rare', 'Deep cut', 'One in a Krillion'];

// Which tier an answer belongs to. The party sorts its own answers from the one
// everybody says (Plankton) to the one nobody does (One in a Krillion), and that
// is the only honest rarity signal we have: a word the game itself files under
// "Deep cut" is a deep cut.
const TIER_RANK = { 'Plankton': 0, 'Schooler': 1, 'Rare': 2, 'Deep cut': 3, 'One in a Krillion': 4 };

function diveCorpus() {
  const dives = JSON.parse(fs.readFileSync(DIVES, 'utf8'));
  const prompts = new Map();   // normalised prompt -> { q, picks: [..] }
  const freq = new Map();
  const tierRank = new Map();  // lowercased answer -> most common tier it appears in
  const tierMax = new Map();   // lowercased answer -> deepest tier it ever reached
  for (const dive of dives) {
    for (const p of (dive.prompts || [])) {
      if (!p.q) continue;
      const key = String(p.q).trim();
      let entry = prompts.get(key);
      if (!entry) prompts.set(key, (entry = { q: key, picks: [] }));
      const tiers = [...(p.tiers || [])].sort(
        (a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name)
      );
      for (const t of tiers) {
        const r = TIER_RANK[t.name];
        for (const w of (t.picks || [])) {
          const s = String(w).trim();
          if (!s) continue;
          if (entry.picks.indexOf(s) < 0 && entry.picks.length < 400) entry.picks.push(s);
          freq.set(s, (freq.get(s) || 0) + 1);
          if (r != null) {
            const k = s.toLowerCase();
            const prev = tierRank.get(k);
            if (prev == null || r < prev) tierRank.set(k, r);
            // A word the game ever filed as a deep cut is an obscure word, even
            // if some other prompt lists it as common: tiers are per prompt.
            const best = tierMax.get(k);
            if (best == null || r > best) tierMax.set(k, r);
            if (r >= 2) {
              const b = r >= 4 ? 'kr' : r >= 3 ? 'deep' : 'rare';
              if (!entry[b]) entry[b] = [];
              if (entry[b].indexOf(s) < 0) entry[b].push(s);
            }
          }
        }
      }
    }
  }
  return { prompts, freq, tierRank, tierMax };
}

function promptCorpus() {
  const rows = parseCsv(PROMPTS);
  const header = rows.shift() || [];
  const qi = header.indexOf('prompt');
  const out = [];
  for (const r of rows) {
    const q = (r[qi] || '').trim();
    if (q && out.indexOf(q) < 0) out.push(q);
  }
  return out;
}

// ------------------------------------------------------------------ Datamuse --
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
// A throttled request used to be cached as "no results", which silently hollows
// out the pack. Drop those so a rebuild retries them.
for (const [k, v] of Object.entries(cache)) if (!Array.isArray(v) || !v.length) delete cache[k];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let throttle = Promise.resolve();

async function datamuse(query, rel = 'ml', max = 16) {
  const key = rel + ':' + query;
  if (key in cache) return cache[key];
  if (NO_NET) return [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = `https://api.datamuse.com/words?${rel}=${encodeURIComponent(query)}&max=${max}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status === 429 || res.status >= 500) { await sleep(800 * (attempt + 1)); continue; }
      if (!res.ok) return [];
      const text = await res.text();
      if (!text.trim().startsWith('[')) { await sleep(800 * (attempt + 1)); continue; }
      const json = JSON.parse(text);
      const words = (Array.isArray(json) ? json : []).map((x) => String(x.word || '').trim()).filter(Boolean);
      cache[key] = words;               // only real answers are cached
      return words;
    } catch {
      await sleep(800 * (attempt + 1));
    }
  }
  return [];                            // transient: retried on the next build
}

async function pool(items, worker, concurrency = 4) {
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

// --------------------------------------------------------------------- main --
const KBGEN = [
  'Pizza', 'Coffee', 'Towel', 'Battery', 'Sock', 'Charger', 'Receipt', 'Gum',
  'Sunscreen', 'Umbrella', 'Water bottle', 'Hair tie', 'Pen', 'Mug', 'Candle',
  'Blanket', 'Mirror', 'Spoon', 'Sponge', 'Pillow'
];

const { syn, lemmaIdx, children } = parseWordNet(WN_DATA);
const { prompts: divePrompts, freq, tierRank, tierMax } = diveCorpus();
// Only the rare half is stored: everything else is common by definition, and the
// resolver can estimate a word the corpus never tiered from its place in voc.
const rar = {};
for (const [w, r] of tierRank) if (r >= 2) rar[w] = r;
// The same answers again, by the deepest tier they ever reached. Deep-cut play
// needs this: an answer is a deep cut *for some prompt*, and that is the only
// signal that says so.
const rarAny = {};
for (const [w, r] of tierMax) if (r >= 3) rarAny[w] = r;

// "Name a word that means big or large" is a synonym question: the answers are
// rare synonyms of big, not words from a bucket called "word". WordNet synsets
// give those directly, and the rare half of each synset is exactly a deep cut.
const synr = {};
{
  const targets = new Set();
  const addToks = (s) => {
    for (const t of String(s).toLowerCase().replace(/[^a-z ]+/g, ' ').split(' ')) {
      if (t.length > 2) targets.add(t);
    }
  };
  for (const q of divePrompts.keys()) addToks(q);
  for (const q of promptCorpus()) addToks(q);
  addToks('big large small happy sad angry fast slow smart stupid rich poor beautiful ugly strong weak brave scared funny strange important dangerous easy hard old young hot cold wet dry hungry tired drunk crazy quiet loud kind cruel clever lazy greedy generous honest polite rude selfish gentle fierce calm proud humble');
  const isRare = (w) => (tierMax.get(w) || 0) >= 3 || (tierRank.get(w) == null && w.length > 5);
  let synDone = 0;
  for (const [off, lemmas] of syn) {
    const rare = lemmas.filter((w) => w.indexOf(' ') < 0 && isRare(w));
    if (!rare.length || rare.length === lemmas.length) continue;
    for (const t of lemmas) {
      if (!targets.has(t) || t.indexOf(' ') >= 0) continue;
      const others = rare.filter((w) => w !== t);
      if (!others.length) continue;
      const prev = synr[t] ? synr[t].split('|') : [];
      for (const w of others) if (prev.indexOf(w) < 0 && prev.length < 24) prev.push(w);
      synr[t] = prev.join('|');
      synDone++;
    }
  }
  console.log(`synonym targets=${Object.keys(synr).length} (${synDone} links)`);
}
console.log(`tiered answers=${tierRank.size} rare(>=Rare)=${Object.keys(rar).length} deep-anywhere=${Object.keys(rarAny).length}`);
const dailyPrompts = promptCorpus();

// In-page resolver. Loaded by evaluating the shipped file so the builder and the
// browser run byte-for-byte the same code (the file is a plain script, not ESM).
const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
// Reused by the association-key builder below; kept out of the resolver API.
const KR_LEAD = /^(?:(?:ok|okay|so|now|next|and|also)[, ]+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:name|give|list|say|tell\s+me|think\s+of|recall|remember)\s+(?:me\s+)?(?:\d+|a|an|the|one|two|three|four|five|some|any|another)?\s*/;
const KR_QUAL = /\b(?:that|which|who|whose|whom|with|without|from|in|into|on|onto|at|over|under|containing|contains|contain|starting|starts|ending|ends|beginning|begins|has|have|is|are|was|were|be|been|being|can|could|would|will|should|must|do|does|did|to|for|you|your|not|more|less|than|during|after|before|between|about|because|while|found|used|made|located|sold|served|grown|played|eaten|born|known|considered|rated|listed|released|designed|meant)\b/;

const diveVocab = new Set(freq.keys());
// The corpus stores answers capitalised ("Mars", "Bad Boys"); every taxonomy
// word is lowercase. Comparing them without folding case made every "has the game
// accepted this?" test false, which is why thin lists were never widened and
// senses were chosen on length alone.
const diveLower = new Set([...diveVocab].map((w) => w.toLowerCase()));
const seenWord = (w) => diveVocab.has(w) || diveLower.has(String(w).toLowerCase());
const allPrompts = [...new Set([...divePrompts.keys(), ...dailyPrompts])];

console.log(`wordnet synsets=${syn.size} lemmas=${lemmaIdx.size}`);
console.log(`dive prompts=${divePrompts.size} unique answers=${diveVocab.size}`);
console.log(`daily prompts=${dailyPrompts.length} total distinct prompts=${allPrompts.length}`);

// --- hn: hyponyms per head noun
// A word has several WordNet senses and their children must not be mixed:
// "state" as a government is not "state" as a condition, and merging them is
// how a US-state question ends up answered with Powell and Albright. Pick the
// single sense whose children the game's own answers recognise most.
function hyponymsFor(key) {
  const offs = lemmaIdx.get(key) || lemmaIdx.get(KR.singular(key));
  if (!offs) return [];
  let best = null;
  for (const off of offs) {
    const kids = [];
    const seen = new Set();
    for (const child of children.get(off) || []) {
      const w = (syn.get(child) || [])[0];
      if (!w || w === key || seen.has(w)) continue;
      if (w.length > 26 || w.split(' ').length > 3) continue;
      seen.add(w);
      kids.push(w);
    }
    if (!kids.length) continue;
    let score = Math.min(kids.length, 24) / 8;
    let hits = 0;
    for (const w of kids) {
      if (seenWord(w)) { score += 4; hits++; }
      if (w.split(' ').length === 1) score += 0.5;
    }
    if (!best || score > best.score) best = { score, kids, hits };
  }
  if (!best) return [];
  // Rank inside the chosen sense: how often the game's own answers use the word
  // first (dog, cat, cow), then whether it was ever accepted at all, then short
  // and simple. Ranking on acceptance alone put "criollo" and "stud" above
  // "dog" for a domesticated-animal prompt.
  return best.kids
    .map((w) => [
      Math.min(freq.get(w) || 0, 40) * 8 +
      (seenWord(w) ? 20 : 0) +
      (w.split(' ').length === 1 ? 4 : 0) +
      Math.max(0, 20 - w.length),
      w
    ])
    .sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]))
    .map((x) => x[1]);
}

// Broad categories only have a handful of direct children ("animal" -> domestic
// animal, pest, ...), which never contains the species a letter rule asks for
// ("an animal starting with S"). For the widest keys, walk two levels down and
// keep the descendants.
function collectDeep(key, depth = 2, cap = 70) {
  const offs = lemmaIdx.get(key) || lemmaIdx.get(KR.singular(key)) || [];
  const found = new Map();
  const walk = (off, d) => {
    for (const c of children.get(off) || []) {
      const w = (syn.get(c) || [])[0];
      if (w && w !== key && w.length <= 26 && w.split(' ').length <= 3) found.set(w, freq.get(w) || 0);
      if (d < depth) walk(c, d + 1);
    }
  };
  for (const o of offs) walk(o, 1);
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))
    .map(([w]) => w)
    .slice(0, cap);
}

const hn = {};
const hnKeys = [];
let skipped = 0;
for (const key of lemmaIdx.keys()) {
  if (key.length < 3 || key.length > 30) { skipped++; continue; }
  const list = hyponymsFor(key);
  if (list.length < 3) { skipped++; continue; }
  // Only keep lists that contain something the game has actually seen, or that
  // are rich enough to be worth the bytes.
  // Keep a key even when the game has never accepted any of its children as
  // long as the taxonomy is deep enough to be useful ("beer" -> ale, lager,
  // stout...). Dropping those is what left whole categories unanswered.
  if (list.length < 3) { skipped++; continue; }
  // Deep lists matter: a "starts with K" prompt is filtered after the fact, so
  // the pack has to hold enough candidates to survive the filter.
  hn[key] = list.slice(0, 24).join('|');
  hnKeys.push(key);
}
// Widen the broadest categories with their grandchildren.
// "Broad" means a big subtree in WordNet, not a long answer list: every list is
// capped at the same length, so ranking by list length picks keys at random and
// leaves "animal" out of the widening entirely.
const subtree = new Map();
const subtreeSize = (off) => {
  if (subtree.has(off)) return subtree.get(off);
  let n = 1;
  for (const c of children.get(off) || []) n += subtreeSize(c);
  subtree.set(off, n);
  return n;
};
for (const off of syn.keys()) subtreeSize(off);
const keyWeight = (k) => Math.max(0, ...(lemmaIdx.get(k) || lemmaIdx.get(KR.singular(k)) || []).map((o) => subtree.get(o) || 1));
const breadth = hnKeys
  .map((k) => [k, keyWeight(k)])
  .sort((a, b) => b[1] - a[1]);
for (const [k] of breadth.slice(0, 420)) {
  const deep = collectDeep(k, 2, 70);
  if (deep.length > hn[k].split('|').length) hn[k] = deep.join('|');
}
// The widest categories need a third level: a letter rule like "an animal
// starting with S" only reaches snake and salmon three steps below "animal".
for (const [k] of breadth.slice(0, 80)) {
  const deeper = collectDeep(k, 3, 140);
  if (deeper.length > hn[k].split('|').length) hn[k] = deeper.join('|');
}
// A letter rule filters after the fact, so the 24-word cap starves it: "a country
// starting with Z" never saw Zambia. The broad keys also get a wide copy, used
// only when a rule is active, so the common case pays nothing for it.
const hnw = {};
for (const [k] of breadth.slice(0, 420)) {
  const merged = [...new Set([...collectDeep(k, 3, 400), ...hn[k].split('|')])];
  if (merged.length > hn[k].split('|').length) hnw[k] = merged.slice(0, 400).join('|');
}
// A taxonomy one level deep is sometimes all framework: "planet" yields evening
// star and jovian planet, never Mercury, because the actual planets sit two and
// three levels down. Wherever the direct children contain nothing the game has
// ever accepted, widen that key too.
let widenedThin = 0;
for (const [k, list] of Object.entries(hn)) {
  if (hnw[k]) continue;
  const kids = list.split('|');
  const known = kids.filter((w) => seenWord(w)).length;
  // Only short, unfamiliar lists are the framework case this is for; widening
  // every long tail entry tripled the pack for no gain.
  if (known > 0) continue;
  const deep = collectDeep(k, 3, 120);
  // Widening is only worth it when the deeper levels actually reach answers the
  // game has accepted; otherwise it just drags in unrelated homographs ("country"
  // as in the Florida Keys).
  const deepFam = deep.filter((w) => seenWord(w)).length;
  if (deepFam >= 3 && deep.length > kids.length) { hnw[k] = deep.join('|'); widenedThin++; }
}
console.log(`hnw widened-thin=${widenedThin}`);
console.log(`hn keys=${hnKeys.length} skipped=${skipped} widened=${breadth.length} wide=${Object.keys(hnw).length}`);

// --- hx: compound head nouns, indexed by the word they end in. WordNet files
// "string instrument" as "stringed instrument" and "oral exam" as "oral"; a
// qualifier that prefixes one of these compounds picks the right synset, which
// is how "string instrument" stops answering with flutes.
const hx = {};
for (const k of Object.keys(hn)) {
  const words = k.split(' ');
  if (words.length < 2) continue;
  const h = words[words.length - 1];
  if (h.length < 4) continue;
  hx[h] = hx[h] ? hx[h] + '|' + k : k;
}

// --- qp: the game's own prompts, for nearest-prompt matching. WordNet cannot
// tell "writing instrument" from "musical instrument", but the corpus itself
// holds the prompt that shares a qualifier with the label plus the answers the
// room accepted for it. Stored as [head, words, picks] with a pipe-joined list.
const QSTOP = new Set(('a an the of and or in on at to for with from that which who whose ' +
  'name something thing things type kind sort any some your you is are was were be have has ' +
  'can could would will should what when where why how').split(' '));
const qp = [];
for (const [q, entry] of divePrompts) {
  const body = KR.norm(q).replace(KR_LEAD, ' ').trim();
  const words = body.split(' ').filter((w) => w.length > 2 && !QSTOP.has(w));
  if (!words.length) continue;
  const head = KR.baseKey(q);
  if (!head) continue;
  const picks = entry.picks.slice(0, 20).map((s) => String(s).trim()).filter(Boolean);
  if (!picks.length) continue;
  qp.push([head, words.join(' '), [...new Set(picks)].join('|')]);
}
console.log(`hx heads=${Object.keys(hx).length} qp prompts=${qp.length}`);

// --- pk: the game's own accepted answers, indexed by the head-noun key the
// resolver will derive from a category label. "Name a beer brand you can buy"
// and the label "BEER BRAND" both land on "beer".
// A head-noun bucket is only sound for a label that adds nothing to the head
// noun. "Name a Frank Sinatra song" and "Name a Frank Ocean song" are both
// "song", and filing the first under the bare key is exactly how the bot ended
// up answering a Frank Ocean question with Sinatra songs. Anything with a
// qualifier is filed under that qualifier instead.
const pk = {};
const pkq = {};
// The same buckets again, holding only answers the game tiers Rare or deeper.
// Rare-only play needs rare answers for *unseen* labels too, and the corpus is
// the only place that knows which answers are deep cuts for a given head noun.
// Whole-label index: the game shows the prompt verbatim, so a category it has
// asked before can be answered with that prompt's own Deep cut / Krillion lists
// instead of a head-noun approximation.
const px = {};
for (const [q, entry] of divePrompts) {
  const k = KR.norm(q);
  const d = [...new Set((entry.deep || []).concat(entry.kr || []))]
    .map((s) => String(s).trim()).filter(Boolean).slice(0, 40).join('|');
  const kk = [...new Set(entry.kr || [])].map((s) => String(s).trim()).filter(Boolean).slice(0, 12).join('|');
  if (d || kk) px[k] = { d: d, k: kk };
}
console.log(`exact-label deep lists=${Object.keys(px).length}`);
// Every word filed under a prompt's Deep cut / Krillion list has, by definition,
// been tiered at least that deep. Recording it as rarAny is what lets the gate
// tell "obscure" apart from "never seen in a room" for prompt-sourced answers.
let pxTagged = 0;
for (const entry of Object.values(px)) {
  for (const w of String(entry.d || '').split('|')) {
    const k = KR.norm(w);
    if (k && (rarAny[k] || 0) < 3) { rarAny[k] = 3; pxTagged++; }
  }
  for (const w of String(entry.k || '').split('|')) {
    const k = KR.norm(w);
    if (k && (rarAny[k] || 0) < 4) { rarAny[k] = 4; pxTagged++; }
  }
}
console.log(`prompt-list words tagged deep=${pxTagged}`);
const pkR = {};
const pkqR = {};
// And again for the two tiers that actually pay: Deep cut (85 pts) and
// One in a Krillion (100 pts). These are the game's own deep lists per prompt.
const pkD = {};
const pkqD = {};
const pkK = {};
const pkqK = {};
const claimed = new Set();
const claimedR = new Set();
const claimedD = new Set();
const claimedK = new Set();
const QFILL = new Set(('name thing things something someone somebody type kind sort with that which who from into they them their there this these those have been being would could should about other more most least only also than then when where what your yours very much many some any one two three four five every each both will must does done make made used using find found word words english').split(' '));
const qualOf = (q, key) => {
  const kw = key.split(' ');
  return KR.norm(q).replace(KR_LEAD, ' ').split(' ')
    .filter((w) => w.length > 2 && !QFILL.has(w) && kw.indexOf(w) < 0);
};
const degree = (q) => {
  const c = KR.constraints(q);
  return c.first || c.end || c.has || c.len ? 2 : 0;   // 2 = narrowed subset, last
};
// Two passes over the dive prompts, both filing under the head-noun key a short
// party label will derive:
//   1. unconstrained prompts claim their key first, because a broad category is
//      what a bare label means;
//   2. constrained prompts ("country starting with B", "superhero that can
//      fly") only fill keys nothing broader claimed, so their subsets never
//      masquerade as the whole category.
for (const pass of [0, 1]) {
  for (const [q, entry] of divePrompts) {
    const d = degree(q) > 0 ? 1 : 0;
    if (d !== pass) continue;
    const key = KR.baseKey(q);
    if (!key) continue;
    const parts = (entry.picks.slice(0, 20)).map((s) => String(s).trim()).filter(Boolean);
    const picks = [...new Set(parts)].slice(0, 20).join('|');
    if (!picks) continue;
    // The bare bucket is still worth keeping for labels that add no qualifier
    // ("POKÉMON", "PLANET"); it is only *preferred* for those labels, never for
    // a qualified one, which is what the qualifier-scoped keys are for.
    if (!claimed.has(key)) { claimed.add(key); pk[key] = picks; }
    const rarePicks = entry.picks
      .map((s) => String(s).trim())
      .filter((w) => w && (tierRank.get(w.toLowerCase()) || 0) >= 2);
    const uniqFrom = (min) => [...new Set(entry.picks
      .map((s) => String(s).trim())
      .filter((w) => w && (tierRank.get(w.toLowerCase()) || 0) >= min))];
    // Straight from this prompt's own Deep cut / One in a Krillion tiers: the
    // game already decided these answers are deep for this category, so no
    // global rarity filter belongs here.
    const localDeep = [...new Set([...(entry.rare || []), ...(entry.deep || []), ...(entry.kr || [])])]
      .map((s) => String(s).trim()).filter(Boolean);
    const picksR = localDeep.slice(0, 20).join('|');
    const picksD = [...new Set((entry.deep || []).concat(entry.kr || []))]
      .map((s) => String(s).trim()).filter(Boolean).slice(0, 24).join('|');
    const picksK = [...new Set(entry.kr || [])].map((s) => String(s).trim()).filter(Boolean).slice(0, 12).join('|');
    if (picksR && !claimedR.has(key)) { claimedR.add(key); pkR[key] = picksR; }
    if (picksD && !claimedD.has(key)) { claimedD.add(key); pkD[key] = picksD; }
    if (picksK && !claimedK.has(key)) { claimedK.add(key); pkK[key] = picksK; }
    const qs = qualOf(q, key);
    if (!qs.length) continue;
    const two = key + '|' + qs.slice(0, 2).join('+');
    if (!pkq[two]) pkq[two] = picks;
    if (picksR && !pkqR[two]) pkqR[two] = picksR;
    if (picksD && !pkqD[two]) pkqD[two] = picksD;
    if (picksK && !pkqK[two]) pkqK[two] = picksK;
    const one = key + '|' + qs[0];
    if (qs.length > 1 && !pkq[one]) pkq[one] = picks;
    if (qs.length > 1 && picksR && !pkqR[one]) pkqR[one] = picksR;
    if (qs.length > 1 && picksD && !pkqD[one]) pkqD[one] = picksD;
    if (qs.length > 1 && picksK && !pkqK[one]) pkqK[one] = picksK;
  }
}

// --- hl: the game's own answers for lettered prompts, keyed by category+rule.
// "Name an animal starting with S" is answered by the corpus, not by a taxonomy
// four levels deep, so the constraint is part of the key.
const hl = {};
for (const [q, entry] of divePrompts) {
  const c = KR.constraints(q);
  if (!c.first && !c.end && !c.has && !c.len) continue;
  const k = KR.baseKey(q);
  if (!k) continue;
  const tag = c.first ? 'f' + c.first : c.end ? 'e' + c.end : c.has ? 'c' + c.has : 'l' + c.len;
  const key = k + '|' + tag;
  const merged = [...new Set([...(hl[key] ? hl[key].split('|') : []), ...entry.picks.slice(0, 24)].map((s) => String(s).trim()).filter(Boolean))];
  hl[key] = merged.slice(0, 26).join('|');
}
console.log(`hl keys=${Object.keys(hl).length}`);

// --- ent: the named subject of a prompt
// "Name a movie starring Will Smith" is answered by Will Smith, not by the word
// movie - the general movie list is Disney cartoons, which is how the bot ended
// up answering "Cars" to a Stallone prompt. The corpus writes its subject in
// capitals, so that phrase becomes a key carrying the prompt's own answers, in
// tier order (Plankton first: the answer everybody knows).
const ENT_STOP = new Set(('name a an the i i\'m my your his her their our this that these those ' +
  'movie movies film films show shows series game games book books character characters ' +
  'brand brands color colors colour colours animal animals food foods song songs band bands ' +
  'team teams city cities country countries planet planets actor actress singer artist ' +
  'new old big small best worst first last').split(' '));
const ENT_RUN = /[A-Z][A-Za-z0-9'\u2019.:-]*(?:\s+(?:of|the|and|&|de|da|van|von|[A-Z][A-Za-z0-9'\u2019.:-]*))*/g;
const ent = {};
const entNames = new Set();
function entAdd(key, picks) {
  if (!key || key.length < 5) return;
  const cur = ent[key] ? ent[key].split('|') : [];
  for (const p of picks) if (p && cur.indexOf(p) < 0 && cur.length < 28) cur.push(p);
  if (cur.length) ent[key] = cur.join('|');
}
for (const [q, entry] of divePrompts) {
  const body = String(q).replace(KR_LEAD, ' ');
  const keys = [];
  for (const run of (body.match(ENT_RUN) || [])) {
    const k = KR.norm(run);
    if (!k || ENT_STOP.has(k)) continue;
    if (k.split(' ').length < 2 && k.length < 4) continue;
    if (keys.indexOf(k) < 0) keys.push(k);
  }
  // Only a prompt about one subject says anything about that subject: a prompt
  // naming several ("a fictional place from Star Wars, Lord of the Rings,
  // SpongeBob, Pixar") is a mixture, and filing it under each name is how
  // "Disney princess" came to answer Bikini Bottom and Mordor.
  if (keys.length !== 1) continue;
  const kind = KR.baseKey(q);
  const picks = entry.picks.slice(0, 20);
  entNames.add(keys[0]);
  // Keyed by answer kind too: a prompt about places in a franchise must not
  // answer a question about its characters.
  if (kind) {
    entAdd(keys[0] + '|' + kind, picks);
    entAdd(keys[0] + '|' + KR.singular(kind), picks);
  }
}
console.log(`ent keys=${Object.keys(ent).length} entities=${entNames.size}`);

// --- tr: associations, for prompts whose head noun has no hyponyms
// Association keys cover three shapes: the full prompt phrasing, the head noun
// of every prompt, and every content word the corpora use at all. The last one
// is what lets an unseen label ("MUSHROOM", "PLANET", "SUPERHERO") still get
// related answers instead of the generic list.
const assocSet = new Set();
for (const q of allPrompts) {
  const t = KR.norm(q);
  if (t) assocSet.add(t);
  for (const k of KR.keysFor(q).slice(0, 4)) assocSet.add(k);
  const q2 = t.replace(KR_LEAD, '').trim();
  const cut = q2.search(KR_QUAL);
  if (cut > 0) assocSet.add(q2.slice(0, cut).trim());
  for (const tok of q2.split(' ')) if (tok.length > 3 && !/^(?:name|thing|something|with|that|which|from|into|they|them|their|there|this|these|those|have|been|would|could|should|about|other|more|most|least|only|also|than|then|when|where|what|your|yours|very|much|many|some|any|one|two|three|four|five|every|each|both|will|must|does|done|make|made|used|using|find|found|type|kind|sort|word|words)$/.test(tok)) assocSet.add(tok);
}
for (const k of Object.keys(pk)) assocSet.add(k);
// "BEER BRAND", "GUITAR BRAND" are a recurring party shape; asking the
// association service for the whole shape is what puts brands in the pack.
const brandBases = Object.keys(pk).slice(0, 220);
for (const k of brandBases) assocSet.add(k + ' brand');
const assocTargets = [...assocSet].slice(0, 4200).map((t) => [t, t]);
console.log(`datamuse targets=${assocTargets.length}`);

const tr = {};
let dmDone = 0;
await pool(assocTargets, async ([t]) => {
  const words = await datamuse(t, 'ml', 14);
  if (words.length) tr[t] = words.slice(0, 10).join('|');
  if (++dmDone % 200 === 0) console.log(`  datamuse ${dmDone}/${assocTargets.length}`);
}, 8);
if (!NO_NET) fs.writeFileSync(CACHE, JSON.stringify(cache));
console.log(`tr keys=${Object.keys(tr).length}`);

// --- voc: broad answer vocabulary for "starts with K" on an unknown noun.
// Everything the pack knows, ranked by how many separate lists it appears in,
// so a letter filter lands on central words (Zambia, Kangaroo) before oddities.
// Only strings the game itself has accepted count towards "familiar": using
// every pack list made junk like "names", "eponym", "head" look common.
const vocCount = new Map();
for (const w of diveVocab) vocCount.set(w, (vocCount.get(w) || 0) + 1);
for (const list of Object.values(pk)) {
  for (const w of new Set(list.split('|'))) vocCount.set(w, (vocCount.get(w) || 0) + 2);
}
// The whole accepted-answer vocabulary, ranked. Constraint prompts ("starts
// with K", "containing anti") are answered by filtering this, so having every
// string the game has ever accepted beats a short top-N list.
const clean = (w) => w.length <= 18 && w.split(' ').length <= 2 && /^[A-Za-z][A-Za-z '-]*$/.test(w);
const voc = [...vocCount.keys()]
  .filter(clean)
  .sort((a, b) => (vocCount.get(b) || 0) - (vocCount.get(a) || 0) || a.length - b.length || a.localeCompare(b))
  .slice(0, 16000)
  .join('|');

// --- suf: words for the "ending in -ism / -tion / -way" family, which the bot
// kept losing because the generic list rarely held the shape asked for.
const suffixSet = new Set();
for (const q of allPrompts) {
  const m = String(q).match(/[-‑‐‑]([a-z]{2,6})["\u201d) ]/g) || [];
  for (const hit of m) {
    const s = hit.replace(/^[-‑‐‑]/, '').replace(/["\u201d) ]$/, '');
    if (s.length >= 2 && s.length <= 6) suffixSet.add(s);
  }
  const m2 = String(q).match(/ends?\s+(?:in|with)\s+["\u201c]?([a-z\-]{2,8})/i);
  if (m2) suffixSet.add(m2[1].replace(/^-/, ''));
}
const suf = {};
for (const s of suffixSet) {
  const hits = [...vocCount.keys()]
    .filter((w) => clean(w) && w.toLowerCase().endsWith(s))
    .sort((a, b) => (vocCount.get(b) || 0) - (vocCount.get(a) || 0) || a.length - b.length)
    .slice(0, 80);
  if (hits.length >= 3) suf[s] = hits.join('|');
}
console.log(`suffix keys: ${Object.keys(suf).join(' ')}`);

const kb = {
  v: 1,
  built: new Date().toISOString().slice(0, 10),
  sources: ['wordnet-3.1', 'krillion-dives', 'krillion-prompts', NO_NET ? null : 'datamuse-ml'].filter(Boolean),
  cty: (() => {
    try { return JSON.parse(fs.readFileSync(path.join(HERE, 'countries.json'), 'utf8')).join('|'); } catch (e) { return ''; }
  })(),
  cur: (() => {
    try { return JSON.parse(fs.readFileSync(path.join(HERE, 'curated.json'), 'utf8')); } catch (e) { return []; }
  })(),
  hn,
  hnw,
  pk,
  pkq,
  px,
  synr,
  pkR,
  pkqR,
  pkD,
  pkqD,
  pkK,
  pkqK,
  rarAny,
  rar,
  hl,
  hx,
  qp,
  ent,
  entn: [...entNames].join('|'),
  tr,
  voc,
  suf,
  gen: KBGEN.join('|')
};

fs.writeFileSync(OUT, JSON.stringify(kb));
const rawBytes = Buffer.byteLength(JSON.stringify(kb));
const gz = zlib.gzipSync(Buffer.from(JSON.stringify(kb)), { level: 9 });
const b64 = gz.toString('base64');

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'kb.txt'), b64);
const CHUNK = 80000;
let n = 0;
for (let off = 0; off < b64.length; off += CHUNK) {
  const name = `kb-part-${String(++n).padStart(2, '0')}.txt`;
  fs.writeFileSync(path.join(DIST, name), b64.slice(off, off + CHUNK));
}
// --- the pasteable bot: resolver + DOM glue in one script
const resolverSrc = fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8')
  .replace(/\nif \(typeof module[\s\S]*$/, '\n');
const botSrc = fs.readFileSync(path.join(HERE, 'bot.js'), 'utf8');
const bundle = [
  '/*',
  ' * Puffer Party autopilot v25 - answers from a frozen knowledge pack.',
  ' *',
  ' * Built by scripts/puffer-kb/build-kb.mjs from WordNet 3.1, the Krillion dive',
  ' * corpus and Datamuse associations. Unseen categories resolve through the',
  ' * head-noun index instead of needing a hand-written rule; letter and ending',
  ' * constraints are honoured; answers the room accepts are remembered.',
  ' *',
  ' * Paste this file, then load the pack:',
  ' *   window.__KRP = [];',
  ' *   window.__KRP.push("...")   // one call per dist/kb-part-NN.txt',
  ' *   __krLoad()',
  ' */',
  '(function () {',
  resolverSrc,
  botSrc,
  '})();',
  ''
].join('\n');
fs.writeFileSync(path.join(ROOT, 'scripts/puffer-party-bot.js'), bundle);

fs.writeFileSync(
  path.join(DIST, 'README.txt'),
  [
    'Paste in order, one call each:',
    '  window.__KRP=[]',
    ...Array.from({ length: n }, (_, i) => `  window.__KRP.push("...kb-part-${String(i + 1).padStart(2, '0')}.txt...")`),
    '  __krLoad()        // decodes, arms the bot',
    ''
  ].join('\n')
);

for (const [k, v] of Object.entries(kb)) {
  if (typeof v !== 'object') continue;
  console.log(`  ${k.padEnd(4)} ${(Buffer.byteLength(JSON.stringify(v)) / 1024).toFixed(0).padStart(5)}KB  ${Object.keys(v).length} keys`);
}
console.log(`kb.json=${(rawBytes / 1024).toFixed(0)}KB gzip=${(gz.length / 1024).toFixed(0)}KB base64=${(b64.length / 1024).toFixed(0)}KB chunks=${n}`);
console.log(`keys: hn=${hnKeys.length} pk=${Object.keys(pk).length} pkq=${Object.keys(pkq).length} tr=${Object.keys(tr).length} voc=${voc.split('|').length}`);
