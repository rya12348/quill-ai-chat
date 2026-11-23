/*
 * Serves the knowledge pack to the browser, for loading it into a live page
 * without pasting 800KB through the console, and answers a live category over
 * HTTP so the in-page bot can cover phrasings the frozen pack has never seen.
 *
 * Chrome treats http://127.0.0.1 as potentially trustworthy, so a secure page
 * may fetch it; the headers below satisfy both the CORS and the private-network
 * preflight that an https origin needs.
 *
 * Usage: node scripts/puffer-kb/serve.mjs [port=5201]
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PORT = Number(process.argv[2] || 5201);
const FILES = {
  '/kb': [path.join(HERE, 'dist/kb.txt'), 'text/plain'],
  // The engine the Ink page's "Puffer bot" button loads. It used to point at a
  // frozen v25 file, so that button ran a build that had none of the refusal,
  // repeat or pacing fixes - it repeated answers the room had just refused while
  // the userscript had long moved past it. Serve the build that is actually current.
  '/bot.js': [path.join(ROOT, 'scripts/puffer-bot.user.js'), 'text/javascript'],
  '/tierlog.js': [path.join(HERE, 'tierlog.js'), 'text/javascript']
};

const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
// One JSON line per finished category: the record used to see what the bot did.
const GAMELOGFILE = path.join(HERE, '..', '..', '.k3', 'gamelog.jsonl');
// Live watch: the bot posts a small heartbeat while it plays and /watch renders
// it. This is how a session is followed turn by turn, in the room's own words,
// without a screen or a second browser.
const WATCHFILE = path.join(HERE, '..', '_serve', 'watch.html');
const PARTYFILE = path.join(HERE, '..', '_serve', 'party.html');
const watchState = { at: 0, ver: '', name: '', cat: '', box: '', up: 0, sent: 0, bad: 0, page: '', events: [] };
// Remote control: a command is queued here and handed to the bot in the reply to
// its next heartbeat, so the script playing in the room can be driven from
// outside it. Results come back in the heartbeat after that.
const cmds = [];
const cmdDone = [];
let KB = null;
let BOTP = null;
function kb() {
  if (!KB) KB = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));
  return KB;
}

// Live answers are cached on disk: a category repeats across rounds, and a hit
// must be instant because the room's fuse is not waiting for the network.
const LCACHE = path.join(ROOT, '.k3/live-cache.json');
let live = {};
try { live = JSON.parse(fs.readFileSync(LCACHE, 'utf8')) || {}; } catch (e) { live = {}; }
function saveLive() {
  try { fs.writeFileSync(LCACHE, JSON.stringify(live)); } catch (e) { /* read-only fs */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ml(query, max = 16, rel = 'ml') {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://api.datamuse.com/words?${rel}=${encodeURIComponent(query).replace(/%2A/g, '*')}&max=${max}`,
        { signal: AbortSignal.timeout(4000) });
      if (res.status === 429) { await sleep(500); continue; }
      if (!res.ok) return [];
      const json = JSON.parse(await res.text());
      return (Array.isArray(json) ? json : []).map((x) => String(x.word || '').trim()).filter(Boolean);
    } catch (e) {
      await sleep(300);
    }
  }
  return [];
}

// One category, answered as well as this machine can. The frozen pack answers
// instantly; for a phrasing it does not know, Datamuse is asked about the whole
// label and about the label's own words, and its words are kept only when they
// look like answers the room would take (right shape, right letter rules, and
// ideally already in the room's accepted vocabulary).
async function answer(q) {
  const base = kb();
  const key = 'v7:' + KR.norm(q);
  const found = KR.resolve(q, base).slice(0, 14);
  const c = KR.constraints(q);
  const head = KR.baseKey(q);
  // The last content word of the whole question is its real head: the resolver's
  // key stops at the first qualifier, so "nintendo home, handheld, hybrid, or
  // dedicated ... console" ends up keyed on "hybrid".
  const allWords = KR.norm(String(q).replace(/\([^)]*\)/g, ' ')).split(' ').filter((w) => w.length > 2);
  const headWord = allWords.length ? allWords[allWords.length - 1] : '';
  // Ask about the phrasing the room would use on its own, not the room's lead-in
  // ("name a ..."), and about the compound keys the resolver derives: ml("cured
  // meat") knows ham and salami, ml("name a deli or cured meat") knows nothing.
  // A named subject is probed with its head noun - ml("nintendo console") knows
  // wii and switch, ml of the room's whole 60-word question knows nothing.
  const bare = KR.norm(q).replace(/^(?:name|list|give|say|tell\s+me)\s+(?:me\s+)?(?:a|an|the|some|any)?\s*/, '');
  const compounds = KR.keysFor(q).filter((k) => k.indexOf(' ') > 0).slice(0, 3);
  const named = (String(q).match(/\b[A-Z][a-zA-Z0-9'\u2019.-]{2,}\b/g) || [])
    .filter((w) => !/^(?:Name|List|Give|Say|Tell|The|What|Which|A|An)$/.test(w));
  // A multi-word proper noun ("Atlantic Ocean", "Frank Ocean") is usually the
  // category's own domain, not a separate subject: probing "frank song" is what
  // put Frank Sinatra songs in a Frank Ocean round. Only a single-word name is
  // combined with the head noun ("nintendo" + "console").
  const multiword = (String(q).match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || []).length > 0;
  const subject = named.length && !multiword ? KR.norm(named[0]) + ' ' + headWord : '';
  // "a word that means small" is a synonym question, and Datamuse answers those
  // exactly (rel_syn) instead of by loose association.
  const synRaw = (KR.norm(q).match(/(?:means|synonyms?\s+(?:for|of)|another\s+word\s+for)\s+([a-z ']{3,40})/) || [])[1];
  // "means big or large" is two targets, not one phrase: asking Datamuse for the
  // synonym of "big or large" returns nonsense like claymore and metropolis.
  const synTargets = synRaw
    ? synRaw.split(/\s+(?:or|and)\s+|,\s*/).map((s) => s.trim()).filter((s) => s.length > 2).slice(0, 3)
    : [];
  const synTarget = synTargets[0] || '';
  const probes = [...new Set([subject, bare, head, ...compounds].filter((p) => p && p.length > 2))];

  // "a word that rhymes with cat" is a Datamuse rhyme query, and no frozen pack
  // can carry one: the room answered it with "head" and "anagram" until the
  // probe asked the right relation.
  const rhymeOf = (KR.norm(q).match(/rhymes?\s+with\s+([a-z'\-]{2,24})/) || [])[1] || '';

  // A letter rule ("a word containing trans", "ending in tion") cannot be
  // answered from the frozen pack: its vocabulary is the room's own answer list,
  // not an English dictionary, and it holds no such word. Datamuse answers
  // spelling patterns exactly, so the pattern is asked for directly and the
  // words are kept only when they pass the same rule check the pack uses.
  const patt = !rhymeOf
    ? (c.has ? '*' + c.has + '*' : c.end ? '*' + c.end : '')
    : '';

  // A qualifier is a condition Datamuse cannot check. ml("a food made from corn")
  // answers with beer and vodka, ml("a medieval weapon") with a fish, and
  // ml("emotion from Inside Out") with "within" and "turn": association is not
  // satisfaction. For a qualified question the frozen pack's qualifier-scoped
  // lists - and the model - are the only sources allowed to speak.
  // Only the head noun is excluded from the qualifier set. "headWord" is the last
  // word of the whole question, which for "a city in Florida" IS the qualifier -
  // excluding it read the question as unqualified and let Datamuse answer with
  // Alabama and Disneyland.
  const headStems = new Set([stem(head), stem(plural(head)), stem(String(KR.norm(head)).split(' ').pop())].filter(Boolean));
  const SHAPE = /^(?:name|list|give|say|tell|some|any|thing|things|something|stuff|type|types|kind|kinds|sort|sorts|form|forms|variety|brand|brands|example|examples|that|which|whose|who|with|without|from|in|on|into|made|used|found|for|and|or|the|your|you|can|has|have|is|are|of|a|an|to|at|by|like|only|one|not|more|than|other|any)\b$/;
  const qualWords = KR.norm(q)
    .replace(/^(?:name|list|give|say|tell\s+me)\s+(?:me\s+)?(?:a|an|the|some|any)?\s*/, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !headStems.has(stem(w)) && !SHAPE.test(w));
  const narrow = qualWords.length > 0;

  let rhymeWords = [];
  let extra = live[key];
  // A cached association list is stale for a qualified question: it was built
  // before the qualifier rule. Drop it so the narrowed pass below rebuilds it.
  if (extra && narrow) extra = null;
  if (!extra) {
    // Rhymes, synonyms and spelling patterns are conditions Datamuse answers
    // exactly; plain association is what cannot check a qualifier.
    const lists = await Promise.all(probes.slice(0, 4).map((p) => ml(p, 16)));
    if (rhymeOf) {
      const rhymes = await ml(rhymeOf, 24, 'rel_rhy');
      // Real rhymes lead: the pack's own guesses (head, anagram) are not answers
      // to a rhyme question even when they are rare words.
      rhymeWords = rhymes.filter((w) => KR.pass(w, c)).slice(0, 10);
      lists.unshift(rhymes);
    }
    if (synTargets.length) {
      const synSets = await Promise.all(synTargets.map((t) => ml(t, 16, 'rel_syn')));
      lists.unshift([...new Set(synSets.flat())]);
    }
    if (patt) {
      const spelled = await ml(patt, 80, 'sp');
      // The pattern query returns inflections and plurals of one word; the room
      // takes them, so they are kept, but they must still pass the rule.
      lists.unshift(spelled);
    }
    const seen = new Set(found.map((w) => KR.norm(w)));
    // Datamuse answers a phrase with morphological relatives of the phrase
    // itself ("atlantic ocean" -> atlantic, atlantick, atlantica). Those are the
    // question restated, never an answer, so anything sharing a stem with a
    // probe word is dropped.
    const synWords = synTarget ? synTarget.trim().split(' ').filter((w) => w.length > 3) : [];
    const probeWords = probes.join(' ').split(' ').filter((w) => w.length > 3 && synWords.indexOf(w) < 0);
    const restated = (k) => probeWords.some((p) => k.indexOf(p) === 0 || p.indexOf(k) === 0);
    const scored = [];
    lists.forEach((list, li) => {
      list.forEach((w, wi) => {
        const k = KR.norm(w);
        if (!k || k.length < 3 || k.length > 26 || seen.has(k)) return;
        if (k === KR.norm(head) || k === KR.norm(headWord)) return;
        if (restated(k)) return;
        if (!KR.pass(w, c)) return;
        seen.add(k);
        // Words the room has demonstrably accepted come first; the rest are
        // ranked by how early Datamuse offered them for the closest probe.
        // Datamuse's own order for the closest probe decides; being a word the
        // room has already accepted only breaks ties, because a strong
        // competitor ("playstation" for a Nintendo question) is also familiar.
        const fam = !!base.__seen && base.__seen[k] ? 4 : 0;
        scored.push([fam + (32 - wi) - li * 10, w, li]);
      });
    });
    // `scored` entries carry their list index so the narrow branch below can
    // tell a qualifier-bearing probe from the bare head noun.
    if (narrow) {
      // Association cannot check a qualifier, so for a qualified question these
      // words are only a reserve behind the verified answers - and only the
      // probes that name the qualifier may supply them. ml("weapon") answers a
      // different question; ml("medieval weapon") at least stays in the domain.
      const okLists = new Set();
      probes.slice(0, 4).forEach((p, i) => {
        const toks = KR.norm(p).split(/\s+/);
        if (qualWords.every((w) => toks.includes(w))) okLists.add(i);
      });
      // The words also have to be the right kind of thing. ml("part of the human
      // ear") offers face and head; the head noun's own members are the check.
      // A bucket of twenty or more is a real family; anything smaller is a
      // sample, and enforcing a sample is what once reduced mace and club to
      // nothing.
      const famHead = KR.norm(head).split(' ').pop() || head;
      const fam2 = new Set();
      const addFam = (s) => String(s || '').split('|').forEach((w) => { const k = KR.norm(w); if (k) fam2.add(k); });
      addFam(base.hn && base.hn[famHead]);
      addFam(base.pk && base.pk[famHead]);
      if (base.pkq) for (const kk of Object.keys(base.pkq)) if (kk.indexOf(famHead + '|') === 0) addFam(base.pkq[kk]);
      extra = scored.sort((a, b) => b[0] - a[0])
        .filter((x) => okLists.size === 0 || okLists.has(x[2]))
        .filter((x) => {
          if (fam2.size < 20) return true;
          return fam2.has(KR.norm(x[1]));
        })
        .slice(0, 6)
        .map((x) => x[1]);
    } else {
      extra = scored.sort((a, b) => b[0] - a[0]).slice(0, 12).map((x) => x[1]);
    }
    live[key] = extra;
    saveLive();
  }
  const lead = rhymeWords.filter((w) => !found.some((f) => KR.norm(f) === KR.norm(w)));
  return { q, base: head, probes, syn: synTarget || '', raw: (live[key] || []).slice(0, 6), answers: [...lead, ...found, ...extra].slice(0, 20), found: found.length, live: extra.length };
}

// ---- list articles ----------------------------------------------------------
// The general answer to "a category the pack has never seen": Wikipedia writes
// list articles for exactly this shape of question ("List of countries bordering
// on two or more oceans"), and their items are the answers. The page is only
// trusted when its title is about *this* property - a page about countries by
// area must never answer a question about borders - and every item is checked
// against the head noun's family, so a place name from the prose cannot leak in.
const ASKFILE = path.join(ROOT, '.k3/ask-cache.json');
let askCache = {};
try { askCache = JSON.parse(fs.readFileSync(ASKFILE, 'utf8')) || {}; } catch (e) { askCache = {}; }
function saveAsk() {
  try { fs.mkdirSync(path.dirname(ASKFILE), { recursive: true }); fs.writeFileSync(ASKFILE, JSON.stringify(askCache)); } catch (e) { /* read-only fs */ }
}
const STOPW = new Set(('a an the with without at least one two three more than on in of from whose that which has have having is are was were and or their its his her by as to for into under over near both all any no not').split(' '));
const plural = (h) => (h.endsWith('y') ? h.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(h) ? h + 'es' : h + 's');
const stem = (w) => String(w || '').toLowerCase().replace(/ies$/, 'y').replace(/(?:es|s)$/, '');

function catParts(q) {
  const bare = KR.norm(String(q).replace(/\([^)]*\)/g, ' '));
  const m = bare.match(/^(.+?)\s+(?:whose|that|which|with|in|on|from|starting|ending|containing|including|starring|featuring|who|where|is|are|has|have)\b\s*(.*)$/);
  const phrase = (m ? m[1] : bare).replace(/^(?:name|list|give|say|tell me)\s+(?:a|an|the|some|any)?\s*/, '').trim();
  // What an answer has to be: the pack's own head-noun key, which knows that
  // "a chemical element named after a place" is an element question and not a
  // "place" one. Falls back to the last noun of the phrase.
  const words0 = phrase.split(/\s+/).filter((w) => w && !/^(?:of|the|a|an)$/.test(w));
  const bk = KR.baseKey(q);
  const head = (bk && bk.length > 2 ? bk : (words0.length ? words0[words0.length - 1] : phrase));
  const qual = (m ? m[2] : '').trim();
  let words = qual.split(/\s+/).map((w) => w.replace(/[^a-z0-9-]/g, '')).filter((w) => w.length > 2 && !STOPW.has(w));
  // "an archery term", "an item of formal wear": nothing qualifies the head, so
  // the phrase's other nouns are what the page has to be about.
  if (!words.length) {
    words = phrase.split(/\s+/).map((w) => w.replace(/[^a-z0-9-]/g, ''))
      .filter((w) => w.length > 2 && w !== head && !STOPW.has(w) && !/^(?:of|the)$/.test(w));
  }
  return { head, phrase, qual, words };
}

// The family a head noun belongs to: what the pack itself knows as its members.
function family(head) {
  const base = kb();
  const set = new Set();
  const add = (s) => String(s || '').split('|').forEach((w) => { const k = KR.norm(w); if (k) set.add(k); });
  // A country answer is a country: the full list, and nothing else.
  if (/^countr(?:y|ies)$/.test(head) && base.cty) { add(base.cty); return set; }
  if (base.hn && base.hn[head]) add(base.hn[head]);
  if (base.hnw && base.hnw[head]) add(base.hnw[head]);
  if (base.pk && base.pk[head]) add(base.pk[head]);
  if (base.pkq) for (const k of Object.keys(base.pkq)) if (k.indexOf(head + '|') === 0) add(base.pkq[k]);
  return set;
}

let wikiLast = 0;
async function wiki(url) {
  // Wikipedia answers a burst with a plain-text "too many requests" body, which
  // then broke JSON.parse and lost the whole lookup. One paced retry keeps the
  // source alive instead of failing the category.
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = wikiLast + (attempt ? 900 : 320) - Date.now();
    if (wait > 0) await sleep(wait);
    wikiLast = Date.now();
    const r = await fetch(url, {
      headers: { 'user-agent': 'puffer-kb/1.0 (local bot; contact: davehall1248@gmail.com)' },
      signal: AbortSignal.timeout(7000)
    });
    if (r.status === 429) continue;
    if (!r.ok) throw new Error('wiki ' + r.status);
    const txt = await r.text();
    if (/too many requests/i.test(txt)) continue;
    try { return JSON.parse(txt); } catch (e) { throw new Error('wiki body'); }
  }
  throw new Error('wiki 429');
}

// Structural answer source for a category the pack does not know: the *article's
// own categories* are the instance list ("Category:Shoes" holds shoes), which is
// far more reliable than reading every link off an arbitrary page (that is where
// "Web colors" and "X11 color names" came from).
const plural2 = (h) => (h.endsWith('y') ? h.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(h) ? h + 'es' : h + 's');
async function categoryAnswers(q, head) {
  const phrase = KR.norm(String(q).replace(/\([^)]*\)/g, ' '))
    .replace(/^(?:name|list|give|say|tell\s+me)\s+(?:a|an|the|some|any)?\s*/, '').trim();
  if (!head || head.length < 3) return [];
  let titles = [];
  for (const probe of ['list of ' + plural2(head), plural2(head), head]) {
    try {
      const s = await wiki('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(probe) + '&srlimit=3&format=json');
      titles = titles.concat(((s.query && s.query.search) || []).map((x) => x.title));
    } catch (e) { /* network */ }
    if (titles.length >= 2) break;
  }
  titles = [...new Set(titles)];
  const cats = [];
  for (const t of titles.slice(0, 2)) {
    try {
      const c = await wiki('https://en.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(t) + '&prop=categories&cllimit=30&clshow=!hidden&format=json');
      for (const p of Object.values((c.query && c.query.pages) || {})) for (const cat of (p.categories || [])) cats.push(cat.title);
    } catch (e) { /* network */ }
  }
  // The category has to END in the head noun: "Category:Shoes" is shoes, while
  // "Category:Cleveland Browns players" merely contains the word (that is how a
  // question about browns got eleven American football players).
  const hk0 = KR.norm(head), pk0 = KR.norm(plural2(head));
  const hit = cats.filter((t) => {
    const words = KR.norm(t).split(/\s+/);
    if (words.indexOf(hk0) < 0 && words.indexOf(pk0) < 0) return false;
    // A proper-noun category is a different subject: "Category:Cleveland Browns"
    // is a football team, and its members answered a question about browns with
    // eleven players.
    return !t.replace(/^Category:/, '').split(/\s+/).slice(1).some((w) => /^[A-Z]/.test(w));
  });
  const out = [];
  for (const c of hit.slice(0, 2)) {
    try {
      const m = await wiki('https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=' + encodeURIComponent(c) + '&cmlimit=25&cmtype=page&format=json');
      for (const x of (m.query && m.query.categorymembers) || []) out.push(String(x.title).replace(/\s*\(.*\)$/, ''));
    } catch (e) { /* network */ }
  }
  const hk = KR.norm(head), pk = KR.norm(plural2(head));
  return [...new Set(out)].filter((w) => {
    const k = KR.norm(w);
    if (!k || k.length < 3 || k.length > 26) return false;
    if (k === hk || k === pk) return false;
    // "Shoe" and "Shoemaking" are the subject, not an instance of it.
    if (k.indexOf(hk) === 0) return false;
    if (/\b(?:list|outline|glossary|index)\b/.test(k)) return false;
    return KR.shapeOk(q, w);
  });
}

// How much a returned page title is about this exact property. A list page must
// share the head noun and at least one qualifier word; "by area" is only a
// match when the question actually asked about area.
function titleScore(title, head, words, hasFam) {
  const t = KR.norm(title);
  if (!/^(?:list|glossary|outline) of/.test(t)) return 0;
  const toks = t.split(/\s+/).map(stem).filter((tk) => tk.length > 2);
  // The head noun is what an answer is, not what the page is about: matching
  // "countries" alone is what let a page about independence from the UK answer a
  // question about land borders.
  const headStems = new Set([stem(head), stem(plural(head))]);
  const props = words.map(stem).filter((w) => w.length > 2 && !headStems.has(w));
  if (!props.length) return 0;
  let hit = 0;
  for (const w of props) if (toks.some((tk) => tk === w || tk.indexOf(w) === 0)) hit++;
  // Every qualifier word has to appear. A page about coastlines is not a page
  // about oceans, and one shared word is how a wrong list got through.
  if (hit < Math.min(props.length, 2) || hit !== props.length) return 0;
  // The family has to be named in the title only when there is no family list to
  // check the items against; "List of current monarchies" is a country page.
  if (!hasFam && t.indexOf(stem(plural(head))) < 0 && t.indexOf(head) < 0) return 0;
  for (const p of ['area', 'population', 'gdp', 'density', 'elevation', 'etymolog']) {
    if (t.indexOf(p) >= 0 && !props.some((w) => w.indexOf(p) === 0)) return 0;
  }
  return 3 + hit;
}

function itemsFrom(wt, fam) {
  const out = new Map();
  let at = 0;
  const bump = (k, shown) => {
    if (!out.has(k)) out.set(k, { a: shown || k, n: 0, at: at++ });
    out.get(k).n++;
  };
  for (const line of wt.split('\n')) {
    if (!/^\s*[*#|!]/.test(line)) continue;
    const re = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
    let m;
    while ((m = re.exec(line))) {
      const shown = m[1].replace(/_/g, ' ').trim();
      const k = KR.norm(shown);
      if (!k || k.length < 3 || k.length > 40) continue;
      if (fam.size && !fam.has(k)) continue;
      bump(k, shown);
    }
    // Tables often carry no link at all: {{flag|Australia}} or a bare "Australia"
    // in a cell. With a family list in hand, the members named in the line are
    // exactly the answers, so read the text as well as the links.
    if (fam.size && fam.size <= 500) {
      const txt = line
        .replace(/\{\{[^|}]*(?:\||\|\s*)([^}|]*)[^}]*\}\}/gi, ' $1 ')
        .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, ' $1 ')
        .replace(/[\[\]{}|=*#!]/g, ' ')
        .replace(/\s+/g, ' ').trim().toLowerCase();
      if (txt) {
        const parts = txt.split(' ');
        for (let n = Math.min(4, parts.length); n >= 1; n--) {
          for (let i = 0; i + n <= parts.length; i++) {
            const s = parts.slice(i, i + n).join(' ').trim();
            if (s && fam.has(s)) bump(s, s);
          }
        }
      }
    }
  }
  return [...out.values()].sort((a, b) => b.n - a.n || a.at - b.at).map((x) => x.a);
}

// Proper-noun questions are answered with names, and a list article's other
// columns are lowercase: "List of model car brands" gave bus, stock car and
// limousine for a car-brand question. Applied to cached and fresh results alike.
const PROPERQ = /\b(brands?|characters?|movies?|films?|songs?|shows?|series|bands?|teams?|compan(?:y|ies)|airlines?|superhero(?:es)?|villains?|actors?|actress(?:es)?|mascot|games?)\b/;
function gateCaps(q, res) {
  if (!res || !res.answers || !res.answers.length) return res;
  if (!PROPERQ.test(KR.norm(q))) return res;
  const caps = res.answers.filter((a) => /^[A-Z0-9]/.test(String(a).trim()));
  if (caps.length >= 3) { res.answers = caps; return res; }
  // Nothing capitalised at all means the rows came from the wrong column of the
  // article (bus, stock car, limousine for brands). An empty list hands the
  // question to the model, which is better than four certain rejections.
  if (caps.length === 0 && res.answers.length >= 4) res.answers = [];
  return res;
}

// Rows of a list article for a head the pack has no family for: a wikilink that
// opens a bullet line, capitalised (these questions name things), not a section,
// a file or another "List of" page. Membership cannot be checked, so the
// two-sided evidence gate below still has to agree that the answer is about it.
function itemsLoose(wt) {
  const out = [];
  const seen = new Set();
  for (const line of String(wt || '').split(/\r?\n/)) {
    const m = line.match(/^\s*\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/);
    if (!m) continue;
    const s = m[1].trim();
    if (!s || s.length > 34) continue;
    if (/^(?:lists? of|category:|file:|image:|template:|wikipedia:|portal:|help:)/i.test(s)) continue;
    if (!/^[A-Z0-9]/.test(s)) continue;
    const k = KR.norm(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 40) break;
  }
  return out;
}

async function listAnswers(q) {
  const key = 'L2:' + KR.norm(q);
  if (askCache[key]) return gateCaps(q, askCache[key]);
  const { head, phrase, words } = catParts(q);
  if (!head || !words.length) return null;
  const fam = family(head);
  // The head for a Wikipedia lookup is the last content word of the phrase
  // ("a shade of brown" -> brown), which is what its category tree is keyed by.
  const wikiHead = (KR.norm(phrase).split(/\s+/).filter((w) => w.length > 2 && !STOPW.has(w)).pop()) || head;
  // No pack family: the list-article path cannot check membership, so the last
  // resort used to be an arbitrary page's links ("Web colors"). The article's
  // own categories are a real instance list instead.
  // A head the pack has no family for ("cartoon", "color") cannot be membership
  // checked, and returning here meant those categories never even searched the
  // list articles - which is why "a 90s cartoon" had no answers at all. They now
  // search anyway and accept capitalised list rows, since these questions name
  // things.
  let loose = false;
  if (!fam.size) {
    const cm = await categoryAnswers(q, wikiHead);
    if (cm.length >= 3) {
      const res = { q, head: wikiHead, words, answers: cm.slice(0, 12), src: 'wiki-cat', conf: 'medium' };
      askCache[key] = res; saveAsk();
      return res;
    }
    loose = true;
  }
  // Decades are how this game words half its questions ("a 90s cartoon"), and a
  // Wikipedia search for "cartoons 90s" matches nothing: the article is "List of
  // 1990s cartoons". Expand the decade into the search terms.
  const dec = String(q).match(/\b(\d)0s\b/i);
  if (dec) {
    const from = '19' + dec[1] + '0s';
    if (words.indexOf(from) < 0 && words.indexOf(from + '') < 0) words.push(from);
  }
  const queryList = [
    'list of ' + plural(head) + ' ' + words.join(' '),
    'list of ' + plural(head) + ' by ' + words.join(' '),
    'glossary of ' + head + ' ' + words.join(' '),
    plural(head) + ' ' + words.join(' ')
  ];
  // A subject's own filmography page answers "a movie starring X" exactly.
  const subject = (String(q).match(/\b[A-Z][a-zA-Z'\u2019-]{2,}\b/g) || []).find((w) => !/^(?:Name|List|Give|Say|Tell|The|What|A|An)$/.test(w));
  if (subject && /\b(?:movie|film|show|series|album|song)s?\b/.test(KR.norm(q))) queriesInline(subject);
  function queriesInline(who) {
    queryList.push(who + ' filmography');
    queryList.push('list of ' + who + ' films');
  }
  const seenTitles = [];
  for (const qq of queryList) {
    try {
      const j = await wiki('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(qq) + '&format=json&srlimit=8');
      for (const s of (j.query && j.query.search) || []) if (seenTitles.indexOf(s.title) < 0) seenTitles.push(s.title);
    } catch (e) { /* network */ }
  }
  // A biography's filmography page is a list of exactly what the question asks
  // for, and it never says "list of films" in its title.
  const bio = subject ? seenTitles.filter((t) => /filmography$/i.test(t) && KR.norm(t).indexOf(KR.norm(subject)) === 0) : [];
  const ranked = seenTitles.map((t) => ({ t, s: titleScore(t, head, words, fam.size > 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
  for (const b of bio.slice(0, 1)) if (!ranked.some((r) => r.t === b)) ranked.unshift({ t: b, s: 9 });
  // "List of volcanoes in Indonesia" states that Indonesia has volcanoes: the
  // country in the title is itself an answer, and that holds for every property.
  const viaIn = [];
  for (const t of seenTitles) {
    const m = KR.norm(t).match(/^list of .+? in (.+)$/);
    if (!m) continue;
    const k = KR.norm(m[1]);
    if (fam.has(k)) viaIn.push(m[1]);
  }
  let items = [];
  let used = '';
  for (const r of ranked) {
    try {
      const j = await wiki('https://en.wikipedia.org/w/api.php?action=parse&page=' + encodeURIComponent(r.t) + '&prop=wikitext&format=json&redirects=1');
      const wt = (j.parse && j.parse.wikitext && j.parse.wikitext['*']) || '';
      const got = loose ? itemsLoose(wt) : itemsFrom(wt, fam);
      if (got.length > items.length) { items = got; used = r.t; }
    } catch (e) { /* network */ }
  }
  // The topic page itself ("Formal wear") is not a "List of" page, but it is the
  // page that enumerates its own items. Used only when nothing else answered.
  if (!items.length && phrase) {
    const topic = seenTitles.find((t) => KR.norm(t) === KR.norm(phrase));
    if (topic) {
      try {
        const j = await wiki('https://en.wikipedia.org/w/api.php?action=parse&page=' + encodeURIComponent(topic) + '&prop=wikitext&format=json&redirects=1');
        const wt = (j.parse && j.parse.wikitext && j.parse.wikitext['*']) || '';
        const got = itemsFrom(wt, fam);
        if (got.length >= 4) { items = got; used = topic; }
      } catch (e) { /* network */ }
    }
  }
  // A thin list article: the category members fill it out from the same subject.
  let cmItems = [];
  if (items.length < 4) cmItems = await categoryAnswers(q, wikiHead);
  let answers = gateCaps(q, { answers: [...new Set([...viaIn, ...items, ...cmItems])].slice(0, 12) }).answers;
  const dbg = { titles: seenTitles.slice(0, 12), ranked: ranked.map((r) => r.t + '(' + r.s + ')') };
  if (!answers.length) return Object.assign({ q, head, words, answers: [] }, dbg);
  // Last gate: the answers have to BE the head noun. For a family the pack knows,
  // membership already said so. Otherwise every answer's own Wikipedia sentence
  // is read in one batched request ("Challengers is a 2024 sports drama film"),
  // and anything that is not one is dropped. A wrong word costs a life; silence
  // does not.
  const BYPASS = /^(?:term|terms|word|words|name|names|item|items|thing|things|example|kind|type)$/;
  const SYN2 = {
    movie: ['film', 'movie'], film: ['film', 'movie'], show: ['series', 'show', 'programme', 'program'],
    animal: ['animal', 'species', 'bird', 'mammal', 'fish', 'reptile', 'insect', 'amphibian', 'invertebrate'],
    person: ['actor', 'actress', 'singer', 'politician', 'player', 'writer', 'artist', 'person', 'born'],
    singer: ['singer', 'musician', 'vocalist', 'rapper'], band: ['band', 'group', 'duo', 'trio'],
    city: ['city', 'town', 'municipality'], state: ['state'], song: ['song', 'single', 'track'],
    album: ['album', 'record', 'ep'], book: ['novel', 'book', 'novella'], game: ['game', 'video game'],
    food: ['food', 'dish', 'dessert', 'snack'], drink: ['drink', 'beverage', 'cocktail'],
    clothing: ['clothing', 'garment', 'dress', 'shoe', 'wear'], instrument: ['instrument'],
    sport: ['sport', 'game'], company: ['company', 'corporation', 'brand', 'business'],
    brand: ['brand', 'company', 'product'], element: ['element']
  };
  const syn2 = SYN2[head];
  if (syn2 && !BYPASS.test(head) && !(fam.size > 0 && /^countr/.test(head))) {
    const intro = {};
    for (let i = 0; i < answers.length; i += 20) {
      const chunk = answers.slice(i, i + 20);
      try {
        const j = await wiki('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exlimit=max&format=json&redirects=1&titles=' + encodeURIComponent(chunk.join('|')));
        for (const p of Object.values((j.query && j.query.pages) || {})) intro[KR.norm(p.title)] = String(p.extract || '').toLowerCase();
      } catch (e) { /* network */ }
    }
    answers = answers.filter((a) => {
      const t = intro[KR.norm(a)] || '';
      if (!t) return false;
      return syn2.some((s) => new RegExp('\\b' + s + '\\b').test(t));
    });
    if (!answers.length) return Object.assign({ q, head, words, answers: [] }, dbg);
  }
  // Two-sided evidence. Being on a page about the property is one side; the
  // answer's own article has to talk about it too (the Philippines article talks
  // about volcanoes, the Golf article never mentions board games). Both sides
  // must agree, or the word is not sent at all.
  const props2 = words.map(stem).filter((w) => w.length > 3);
  if (props2.length && answers.length) {
    // One title per request: the API returns an extract only for the first title
    // when several are asked for, which silently looked like "no evidence".
    const keep = [];
    for (const a of answers.slice(0, 6)) {
      try {
        const j = await wiki('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&format=json&redirects=1&titles=' + encodeURIComponent(a));
        const p = Object.values((j.query && j.query.pages) || {})[0];
        const t = String((p && p.extract) || '').toLowerCase();
          // Word-boundary, not substring: "board" must not be found inside
        // "scoreboard", and "place" not inside "replacement".
        if (t && props2.some((w) => new RegExp('\\b' + w + '\\w{0,3}\\b').test(t))) keep.push(a);
      } catch (e) { /* network: no evidence, so no answer */ }
    }
    answers = keep;
    if (!answers.length) return Object.assign({ q, head, words, answers: [] }, dbg);
  }
  const res = { q, head, words, answers, src: used || 'list-title', conf: viaIn.length && !items.length ? 'medium' : 'high', ranked: ranked.map((r) => r.t + '(' + r.s + ')') };
  askCache[key] = res;
  saveAsk();
  return res;
}

// ---- model bridge -----------------------------------------------------------
// The honest general answer for a category no source has indexed yet: ask a
// model, once, and cache the answer forever. It is gated on a key the owner puts
// in .env or the environment - with no key this returns instantly and the bot
// falls back to what it knows instead of guessing.
const LLMFILE = path.join(ROOT, '.k3/llm-cache.json');
let llmCache = {};
try { llmCache = JSON.parse(fs.readFileSync(LLMFILE, 'utf8')) || {}; } catch (e) { llmCache = {}; }
function saveLlm() {
  try { fs.mkdirSync(path.dirname(LLMFILE), { recursive: true }); fs.writeFileSync(LLMFILE, JSON.stringify(llmCache)); } catch (e) { /* read-only fs */ }
}

// ---- learned categories ------------------------------------------------------
// The part that makes the bot better every game. Every category a live lane
// resolves is stored, and the room's own verdicts are folded on top: an answer
// the room accepted is promoted, one it rejected is dropped. A category seen
// once is answered from this file next time, instantly, with the answers that
// actually passed.
const LEARNFILE = path.join(ROOT, '.k3/learned.json');
let learned = {};
try { learned = JSON.parse(fs.readFileSync(LEARNFILE, 'utf8')) || {}; } catch (e) { learned = {}; }
function saveLearned() {
  try { fs.mkdirSync(path.dirname(LEARNFILE), { recursive: true }); fs.writeFileSync(LEARNFILE, JSON.stringify(learned)); } catch (e) { /* read-only fs */ }
}
// A category has to be a category. The room's chat panel leaks into the page text,
// and whole chat logs ("... religion CHAT Players ▾ sunixxxx joined smiley
// joined ...") became learned keys that could never match a real prompt.
function cleanCat(q) {
  let t = String(q || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*(?:CHAT|Players\s*▾|▸)[\s\S]*$/i, '').trim();
  // The room prints a verdict word above the next clue, and "cleared Name a type
  // of cheese" became a learned key that no real prompt could ever match.
  t = t.replace(/^(?:cleared|correct|nice|good)\s+/i, '').trim();
  return t.length >= 4 && t.length <= 120 ? t : '';
}
function learnKeyOf(q) {
  const t = cleanCat(q);
  if (!t) return '';
  try { return KR.norm(t); } catch (e) { return t.toLowerCase(); }
}
function learnEntry(q, create) {
  const key = learnKeyOf(q);
  if (!key) return null;
  let e = learned[key];
  if (!e) {
    if (!create) return null;
    e = learned[key] = { q: cleanCat(q), ok: {}, bad: {}, ai: {}, wiki: {}, src: '', seen: 0, updated: 0 };
  }
  return e;
}
// A live lane answered: keep it. These are suggestions, not fact - only the room
// can promote one to accepted, which is what /feedback does.
// ---------------------------------------------------------------------------
// Self-audit: every finished question is read back from the game log and judged
// here, so failures get repaired without anyone reporting them.
// ---------------------------------------------------------------------------
const REPAIRFILE = path.join(ROOT, '.k3/repairs.json');
// Rounds already judged, so a re-post cannot spend another model generation.
const auditedRids = new Map();
let repairs = {};
try { repairs = JSON.parse(fs.readFileSync(REPAIRFILE, 'utf8')) || {}; } catch (e) { repairs = {}; }
function saveRepairs() {
  try { fs.mkdirSync(path.dirname(REPAIRFILE), { recursive: true }); fs.writeFileSync(REPAIRFILE, JSON.stringify(repairs)); } catch (e) {}
}
function repairEntry(cat) {
  const k = KR.norm(cat);
  const e = repairs[k] || (repairs[k] = { cat, silent: 0, refused: 0, junk: 0, cycles: 0, fixes: 0, updated: 0 });
  e.cat = cat;
  return e;
}
// Judges one posted round and repairs what it can. Runs after every question.
async function auditRecord(rec) {
  const cat = String(rec.cat || '');
  if (!cat) return null;
  const ev = Array.isArray(rec.events) ? rec.events : [];
  const e = repairEntry(cat);
  // The same round can be posted more than once (a re-render, a category change,
  // a manual dump), and each post used to spend a full model generation. One
  // repair per wording per minute is plenty.
  const cool = !!(e.auditedAt && Date.now() - e.auditedAt < 60000);
  e.auditedAt = Date.now();
  let sent = 0, ok = 0, bad = 0, junk = 0, rearms = 0;
  for (const x of ev) {
    if (!x || typeof x !== 'object') continue;
    if (x.bad) { bad++; learnFeedback(cat, x.bad, false); }
    if (x.ok) { ok++; learnFeedback(cat, x.ok, true); }
    // A ladder press is a submission too; counting only `sent` made rounds that
    // used the retry path look silent, and every one of those triggered a fresh
    // model call in the repair step.
    if (x.sent || x.forceSend || x.resendClick || x.resendEnter) sent++;
    if (x.blockedType || x.blockedJunk || x.blockedSubject || x.blockedSend) junk++;
    if (x.rearm) rearms++;
  }
  const sum = ev.find((x) => x && x.summary && x.summary.sent !== undefined);
  const sentTotal = sum ? Number(sum.summary.sent) || 0 : sent;
  if (bad) e.refused += bad;
  if (junk) e.junk += junk;
  if (rearms > 12) e.cycles++;
  const silent = sentTotal === 0;
  let repaired = 0;
  // A question that ended with an empty box has no recovery in the room, so it is
  // repaired immediately: ask the model fresh and store its answers for this
  // wording, so the next game starts with candidates instead of silence.
  if (silent) {
    e.silent++;
    if (cool) { e.updated = Date.now(); saveRepairs(); return { cat, silent, repaired: 0, refused: bad, junk, sent: sentTotal, ok, cooled: true }; }
    try {
      const got = await llmAnswers(cat, true);
      const answers = (got && got.answers) || [];
      if (answers.length) {
        learnSuggest(cat, answers, 'ai:' + ((got && got.src) || 'selfrepair'));
        repaired = answers.length;
        e.fixes++;
      }
    } catch (err) {}
  }
  if (bad >= 2 && !cool) {
    try {
      const got = await llmAnswers(cat, true);
      const answers = ((got && got.answers) || []).filter((a) => {
        const k = KR.norm(a);
        return !ev.some((x) => x && x.bad && KR.norm(x.bad) === k);
      });
      if (answers.length) { learnSuggest(cat, answers, 'ai:selfrepair'); repaired += answers.length; e.fixes++; }
    } catch (err) {}
  }
  e.updated = Date.now();
  saveRepairs();
  return { cat, silent, repaired, refused: bad, junk, sent: sentTotal, ok };
}

function learnSuggest(q, answers, src) {
  const e = learnEntry(q, true);
  if (!e || !answers || !answers.length) return;
  e.seen = (e.seen || 0) + 1;
  e.updated = Date.now();
  const s = String(src || '');
  // Provenance, not a soup. Only a lane that knows more than the pack is stored:
  // the model lanes ('ai:...') and the wiki list lane. The offline resolver and
  // /know are not stored at all any more - their guesses (garage -> nack, lift,
  // level) are exactly what made this store untrustworthy.
  if (!/^(?:ai:|model|list|wiki|live)/i.test(s)) return;
  if (s) e.src = s.slice(0, 40);
  const lane = /^ai:/i.test(s) || /^model/i.test(s) ? 'ai' : 'wiki';
  const bucket = (e[lane] = e[lane] || {});
  for (const a of answers) {
    const w = String(a || '').trim();
    if (!w || w.length > 60) continue;
    bucket[w] = (bucket[w] || 0) + 1;
  }
  saveLearned();
}
function learnFeedback(q, answer, accepted) {
  const e = learnEntry(q, true);
  const w = String(answer || '').trim();
  if (!e || !w) return false;
  const bucket = accepted ? (e.ok = e.ok || {}) : (e.bad = e.bad || {});
  bucket[w] = (bucket[w] || 0) + 1;
  if (accepted && e.sug && e.sug[w]) delete e.sug[w];
  e.updated = Date.now();
  saveLearned();
  return true;
}
// Accepted answers first, best first, then live suggestions. Anything the room
// rejected at least as often as it accepted is dropped.
function learnAnswers(q) {
  const e = learnEntry(q, false);
  if (!e) return [];
  // A learned word answers the wording it was learned under, nothing else. The
  // key is the identity check: an entry whose stored wording normalizes to a
  // different key (page text leaked in, a legacy entry mis-filed) is not this
  // category's list and is never served for it.
  if (learnKeyOf(e.q) !== learnKeyOf(q)) return [];
  const sorted = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((x) => x[0]);
  // Only ever three sources: what the room accepted, what the model lane said,
  // and what the wiki list lane said. Anything else in the file is ignored, so a
  // legacy entry cannot leak old pack guesses back into a game.
  const ok = sorted(e.ok);
  const ai = sorted(e.ai);
  const wiki = sorted(e.wiki);
  const bad = e.bad || {};
  // "Cannons" rejected once came straight back as "cannon" from the model, so a
  // rejection now covers the word's stem: cannon/Cannons/cannons are one answer.
  const badStem = new Set(Object.keys(bad).map((b) => stem(b)).filter(Boolean));
  const seen = new Set();
  const out = [];
  for (const a of ok.concat(ai, wiki)) {
    const k = a.toLowerCase();
    if (seen.has(k)) continue;
    const rejected = bad[a] || 0;
    // An accepted answer survives a rejection or two (a judge can be wrong once).
    if (rejected > 0 && rejected >= (ok[a] || 0)) continue;
    // A guess does not: once the room has refused it, it never leads again.
    if (rejected > 0) continue;
    if (!ok[a] && badStem.has(stem(a))) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= 24) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Self-study: the part that keeps working when nobody is playing.
//
// A category is "studied" when the model has been asked about it outside a game.
// Priorities, in order: what the room just rejected (repair), categories the
// store holds nothing verified for, then the prompts the game itself uses that
// this store has never seen. Everything goes through the same provenance rules
// as a live answer, so studying cannot pollute the store with a new kind of
// guess - it only adds model answers that a later game can promote or delete.
// ---------------------------------------------------------------------------
const STUDYFILE = path.join(ROOT, '.k3/study.json');
let study = { queue: [], tried: {}, rounds: 0, learned: 0, rejected: 0, lastQ: '', lastAt: 0, startedAt: Date.now() };
try {
  const j = JSON.parse(fs.readFileSync(STUDYFILE, 'utf8'));
  if (j && typeof j === 'object') study = Object.assign(study, j);
} catch (e) { /* first run */ }
function saveStudy() {
  try { fs.mkdirSync(path.dirname(STUDYFILE), { recursive: true }); fs.writeFileSync(STUDYFILE, JSON.stringify(study)); } catch (e) { /* read-only fs */ }
}
// A live game always wins the model: study pauses while a request is in flight or
// has just been served, so the bot never waits behind background thinking.
let lastLiveAt = 0;
let studying = false;
const STUDY_GAP = 8000;          // one category per 8s: ~450/hour, a game every few minutes
const STUDY_RETRY = 6 * 3600e3;  // do not re-study the same category inside 6h

function studyFresh(q, key) {
  const k = key || learnKeyOf(q);
  if (!k) return false;
  const t = study.tried[k];
  return !t || Date.now() - t > STUDY_RETRY;
}
function studyNeedsWork(e) {
  if (!e || !e.q) return false;
  const ok = Object.keys(e.ok || {}).length;
  const ai = Object.keys(e.ai || {}).length;
  const bad = Object.keys(e.bad || {}).length;
  return ok === 0 && (ai < 4 || bad > 0);
}
function nextStudyTarget() {
  while (study.queue.length) {
    const q = study.queue.shift();
    if (q && studyFresh(q)) return q;
  }
  for (const k of Object.keys(learned)) {
    const e = learned[k];
    if (studyNeedsWork(e) && studyFresh(e.q, k)) return e.q;
  }
  // The game's own prompt list: the categories that actually come up.
  for (const q of (kb().qp || [])) {
    const k = learnKeyOf(q);
    if (k && !learned[k] && studyFresh(q, k)) return q;
  }
  return '';
}

async function studyTick() {
  if (studying) return;
  if (Date.now() - lastLiveAt < 4000) return;
  if (coolLeft('ollama') > 0) return;
  const q = nextStudyTarget();
  if (!q) return;
  const key = learnKeyOf(q);
  studying = true;
  try {
    const e = learned[key] || {};
    const rejected = Object.keys(e.bad || {});
    const got = await askModel(q, rejected);
    if (got.answers.length) {
      learnSuggest(q, got.answers, rejected.length ? 'ai:repair' : 'ai:study');
      study.learned += got.answers.length;
    }
    study.rounds++;
    study.lastQ = q;
    study.lastAt = Date.now();
    study.tried[key] = Date.now();
  } catch (err) {
    // Lane down: nothing was learned, so the target stays eligible for next time.
    study.tried[key] = Date.now() - (STUDY_RETRY - 60000);
  }
  studying = false;
  saveStudy();
}

// (One warmer only - the warm-up at the bottom of this file. A second one using
// different options would make Ollama reload the model: it keeps one instance per
// option set, so a 4096-context probe and a 512-context question ping-pong and
// every load costs seconds inside a turn.)

try {
  const t = setInterval(() => { studyTick().catch(() => {}); }, STUDY_GAP);
  if (t.unref) t.unref();
  setTimeout(() => { studyTick().catch(() => {}); }, 5000);
} catch (e) { /* timers unavailable */ }
function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  try {
    const t = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const m = t.match(/^\s*OPENAI_API_KEY\s*=\s*(\S+)\s*$/m);
    return m ? m[1] : '';
  } catch (e) { return ''; }
}
// Keyless OpenAI-compatible lanes, fastest measured first. These are the same
// public lanes Ink's free tier uses; none needs a key, and a lane that is slow or
// rate-limited falls through to the next one. OVH's Llama answers a category in
// about two seconds, which is inside the fuse.
// Ordered by what actually answered when measured: LLM7's anonymous gpt-oss:20b
// in ~2.3s, then pollinations' keyless GET in ~5s (one reply per 45s per
// address), then the OVH endpoint that 429s most of the time. Every answer is
// cached per category forever, so a repeat never asks again.
// A local Ollama is the best lane this project can have: no key, no quota, no
// rate limit, and it answers the exact wording instead of a head-noun bucket.
// It is tried first; the keyless remote lanes stay as a fallback for when Ollama
// is not running. Both installed models are listed - the bigger one first, and a
// missing/errored model falls through to the next instead of losing the turn.
const OLLAMA_BASE = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_MODELS = String(process.env.OLLAMA_MODEL || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
// Smallest useful model first: on this CPU the 3B emits a line in about half the
// time of the 7B, and the first line is what decides the turn. Anything not
// installed is skipped, so a plain 'qwen2.5:7b' setup still works.
const FAST_FIRST = ['qwen2.5:3b', 'llama3.2:3b', 'qwen2.5:1.5b', 'qwen2.5:7b'];
// Measured on this machine: the 3B at 8 threads streams 5.6 tok/s, at 16 threads
// 11.2 - the generation is memory-bandwidth bound and the logical cores are real
// work here. A line then lands every ~200ms instead of ~450ms.
const CPU_THREADS = Math.max(4, os.cpus().length);
let OPEN_MODEL = OLLAMA_MODELS[0] || FAST_FIRST[0];
async function pickOllamaModel() {
  const want = OLLAMA_MODELS.length ? OLLAMA_MODELS : FAST_FIRST;
  try {
    const r = await fetch(OLLAMA_BASE + '/api/tags', { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    const have = new Set((j.models || []).map((m) => m.name));
    for (const n of want) if (have.has(n)) { OPEN_MODEL = n; break; }
  } catch (e) {}
  console.log('ollama model: ' + OPEN_MODEL);
  return OPEN_MODEL;
}
const AI_LANES = [
  { name: 'ollama', url: OLLAMA_BASE + '/v1/chat/completions', models: OLLAMA_MODELS.length ? OLLAMA_MODELS : FAST_FIRST, key: 'ollama', timeout: 30000, local: true },
  { name: 'llm7', url: 'https://api.llm7.io/v1/chat/completions', model: 'gpt-oss:20b', key: 'unused' },
  { name: 'pollinations', url: 'https://text.pollinations.ai/', get: true },
  { name: 'ovh', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'Meta-Llama-3_3-70B-Instruct' }
];

// Each keyless lane has its own quota, so they are tried in order with a
// per-lane cooldown instead of all at once: OVH answers in ~2s while it is
// allowed, and Pollinations' keyless GET allows one reply every 45 seconds per
// address. Both are cached forever per category, so a repeat never asks again.
const laneCool = {};
function coolLeft(name) { return Math.max(0, (laneCool[name] || 0) - Date.now()); }
function cool(name, ms) { laneCool[name] = Date.now() + ms; }

async function raceModel(q, extra) {
  const sys = 'You answer categories in a fast party game. Reply with the answer list only - one answer per line, '
    + 'no numbering, no quotes, no commentary. Every line must be a real, specific, well-known instance of exactly '
    + 'the category as worded. Answer the exact wording, never a related set: for "an NBA player" name players, not '
    + 'teams; for "a country that borders Brazil" only countries sharing a land border with Brazil; for "a song by X" '
    + 'only songs by X; for "a movie starring Y" only films Y appeared in. Never answer with the category label '
    + 'itself or the broader group an answer belongs to. If the category cannot be satisfied, reply with the single word NONE.'
    + (extra ? ' ' + extra : '');
  // The GET lane takes the prompt in the URL and 404s on a long one, so it gets
  // the same rules in a compact form. The POST lanes get the full text.
  const sysShort = 'Party game: reply with 12 true members of the category, one per line, '
    + 'no numbering or commentary. Answer the exact wording, not a related group: '
    + 'an NBA player is a player, not a team; a country bordering Brazil must share a land border with it. '
    + 'Never answer with the category label itself. Reply NONE if impossible.';
  const ask = 'Category: ' + q + '\n\nGive 12 answers.';
  const fails = [];
  // Every lane has its own quota, so they are asked AT THE SAME TIME: whichever
  // one still has allowance answers in its own latency instead of waiting behind
  // a cooling lane. One reply per 45s on pollinations and a small LLM7 token
  // allowance overlap into roughly their sum, which is the difference between
  // covering one category a game and covering most of them.
  // The local model is asked first, on its own, before the remote lanes race: it
  // has no quota, it is the user's own machine, and a remote lane that happens to
  // be a second faster must not take the answer away from it.
  const localLane = AI_LANES.find((l) => l.local && coolLeft(l.name) <= 0);
  if (localLane) {
    try {
      const got = await (async () => {
        const models = localLane.models && localLane.models.length ? localLane.models : [localLane.model];
        let lastErr = '';
        for (const mdl of models) {
          // Native /api/chat, not the OpenAI shim: only the native endpoint accepts
          // num_ctx and num_thread, and a request that omits them makes Ollama load
          // a SECOND runner for the same model (default 4096 context, default
          // threads). The two configurations then reload against each other, and
          // every load lands inside somebody's turn.
          const r = await fetch(OLLAMA_BASE + '/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            // keep_alive keeps the model resident between games: loading it costs
            // ~15s, and a cold load inside a turn is a lost turn and a fall-through
            // to a remote lane.
            // 160 tokens, not 300: twelve short answers fit easily, and the fuse is
            // ~7.7s - a model that needs 6s to finish loses the race it was asked
            // to win, which is how a correct song list was beaten by junk.
            body: JSON.stringify({ model: mdl, stream: false, keep_alive: '60m',
              options: { temperature: 0.2, num_predict: 96, num_ctx: 512, num_thread: CPU_THREADS },
              messages: [{ role: 'system', content: sys }, { role: 'user', content: ask }] }),
            signal: AbortSignal.timeout(localLane.timeout || 30000)
          });
          if (!r.ok) { lastErr = localLane.name + ' ' + mdl + ' ' + r.status; continue; }
          const j = await r.json();
          const txt = String((j.message && j.message.content) ||
            (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
          if (!txt.trim()) { lastErr = localLane.name + ' ' + mdl + ' empty'; continue; }
          return { lane: localLane.name, txt, model: mdl };
        }
        throw new Error(lastErr || localLane.name + ' failed');
      })();
      return got;
    } catch (e) {
      // Local model down or missing: fall through to the remote lanes.
    }
  }
  const live = AI_LANES.filter((l) => !l.local && coolLeft(l.name) <= 0);
  if (!live.length) throw new Error('all lanes cooling');
  const attempts = live.map((lane) => (async () => {
    {
      if (lane.get) {
        const r = await fetch(lane.url + encodeURIComponent(sysShort + '\n\n' + 'Category: ' + q + '\n12 answers:'), { signal: AbortSignal.timeout(12000) });
        if (r.status === 402 || r.status === 429) { cool(lane.name, 45000); throw new Error(lane.name + ' ' + r.status); }
        if (!r.ok) throw new Error(lane.name + ' ' + r.status);
        const txt = await r.text();
        if (!txt.trim()) throw new Error(lane.name + ' empty');
        return { lane: lane.name, txt };
      }
      // A lane may offer several models (a local Ollama install often has more
      // than one). The first that answers wins; a missing model is not a lane
      // failure, so the next model in the same lane is tried instead.
      const models = lane.models && lane.models.length ? lane.models : [lane.model];
      let lastErr = '';
      for (const mdl of models) {
        const r = await fetch(lane.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (lane.key || 'unused') },
          body: JSON.stringify({ model: mdl, temperature: 0.2, max_tokens: 96, stream: false, ...(lane.local ? { keep_alive: '60m' } : {}), messages: [{ role: 'system', content: sys }, { role: 'user', content: ask }] }),
          signal: AbortSignal.timeout(lane.timeout || 9000)
        });
        if (r.status === 429 || r.status === 402) { cool(lane.name, 60000); throw new Error(lane.name + ' ' + r.status); }
        if (!r.ok) { lastErr = lane.name + ' ' + mdl + ' ' + r.status; continue; }
        const j = await r.json();
        const txt = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
        if (!txt.trim()) { lastErr = lane.name + ' ' + mdl + ' empty'; continue; }
        return { lane: lane.name, txt, model: mdl };
      }
      throw new Error(lastErr || lane.name + ' failed');
    }
  })().catch((e) => { fails.push(String((e && e.message) || e)); throw e; }));
  try {
    // First valid reply wins; the others are left to finish and be discarded.
    return await Promise.any(attempts);
  } catch (e) {
    throw new Error(fails.join('; ') || 'no lane');
  }
}

// One place turns a model's raw reply into answers: de-bulleted, de-quoted,
// shorter than 60 chars, not the category label, and passing the category's own
// constraints and shape. Every caller (live lane, self-study, repair) uses this
// so a stored answer can never be one this filter would have refused.
function cleanModelAnswers(q, txt) {
  const c2 = KR.constraints(q);
  // A local model sometimes answers with the category itself ("Submarine" for
  // what is in a submarine). That word can never be an answer, and once cached
  // it would be served for every game of that category.
  const label = KR.norm(q).replace(/^(?:name|list|give|say|tell me)\s+(?:a|an|the|some|any)?\s*/, '').trim();
  const headKey = KR.norm(KR.baseKey(q));
  const isLabel = (s) => {
    const k = KR.norm(s);
    return !!(k && (k === label || k === headKey || (headKey && k === headKey + 's')));
  };
  const list = String(txt || '').split(/\r?\n/)
    .map((s) => s.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s && s.length < 60 && !/^none$/i.test(s) && !isLabel(s) && KR.pass(s, c2) && KR.shapeOk(q, s));
  return [...new Set(list)].slice(0, 12);
}

// Ask the model directly. `avoid` is what the room has already rejected for this
// category: the model is told not to repeat it, which is how a rejection turns
// into a better list instead of just a deleted one.
async function askModel(q, avoid) {
  const extra = avoid && avoid.length
    ? 'The room has already rejected these answers, so never repeat them: ' + avoid.slice(0, 12).join(', ') + '.'
    : '';
  const best = await raceModel(q, extra);
  return { answers: cleanModelAnswers(q, best.txt), lane: best.lane };
}

async function llmAnswers(q, fresh) {
  const key = 'Q2:' + KR.norm(q);
  // fresh=1 is a refused turn asking again: the cached list already failed in the
  // room, so it must not be handed straight back.
  if (!fresh && llmCache[key]) return llmCache[key];
  const k = apiKey();
  if (!k) {
    // No owner key: use the locally available lanes rather than refusing.
    try {
      const best = await askModel(q);
      const uniq = best.answers;
      const res = { q, answers: uniq, src: 'ai:' + best.lane, conf: uniq.length ? 'high' : 'none' };
      if (uniq.length) { llmCache[key] = res; saveLlm(); }
      return res;
    } catch (e) {
      return { q, answers: [], error: String(e && e.message || e) };
    }
  }
  const base = (process.env.OPENAI_BASE_URL || 'https://freebuff.com/api/v1/paid').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const sys = 'You play a party game: a category is shown and you type as many correct answers as you can. '
    + 'Reply with exactly 12 answers, one per line, no numbering, no commentary. '
    + 'Every line must be a real, specific, well-known member of the category as worded. '
    + 'Answer the exact wording, never a related set: for "an NBA player" name players, not teams; for "a country '
    + 'that borders Brazil" only countries sharing a land border with Brazil; for "a song by X" only songs by X. '
    + 'Never answer with the category label itself or the broader group an answer belongs to. '
    + 'If the category cannot be satisfied, reply with the single word NONE.';
  const r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + k },
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: 260, messages: [{ role: 'system', content: sys }, { role: 'user', content: q }] }),
    signal: AbortSignal.timeout(9000)
  });
  if (!r.ok) return { q, answers: [], error: 'model ' + r.status };
  const j = await r.json();
  const txt = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
  const c = KR.constraints(q);
  const answers = txt.split(/\r?\n/)
    .map((s) => s.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim())
    .filter((s) => s && s.length < 60 && !/^none$/i.test(s) && KR.pass(s, c) && KR.shapeOk(q, s))
    .slice(0, 12);
  const res = { q, answers, src: 'model', conf: answers.length ? 'high' : 'none' };
  if (answers.length) { llmCache[key] = res; saveLlm(); }
  return res;
}

// ---- unknown-category mode ---------------------------------------------------
// A category that nothing stored can answer still has to be answered, so the bot
// asks for it once and this races every live source at the same time: the wiki
// list articles, the article's own category members, Datamuse associations and
// the model lanes. The first useful list wins; the rest are left to finish. A
// failed lane is never cached, so the next turn asks again instead of recording
// the category as permanently unknown.
// The room accepts a word or a couple of words. The general model prompt gets a
// desert island answered with "A pack of high-protein energy bars", which is
// useless here, so the unknown-category lane asks for short answers explicitly.
function tidyAnswer(s) {
  return String(s || '').trim()
    .replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '')
    .replace(/^["'“‘]|["'”’]$/g, '')
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
async function knowModel(q) {
  try {
    const best = await raceModel(q, 'Keep every answer to 1-3 words, with no article (a, an, the) and no explanation.');
    const list = best.txt.split(/\r?\n/)
      .map(tidyAnswer)
      .filter((s) => {
        if (!s || s.length > 30 || /^none$/i.test(s)) return false;
        return s.split(/\s+/).length <= 3;
      });
    return { src: 'ai:' + best.lane, answers: [...new Set(list)].slice(0, 12) };
  } catch (e) {
    return { src: 'ai', answers: [] };
  }
}

async function knowAnswers(q) {
  const key = 'K1:' + KR.norm(q);
  if (askCache[key]) return askCache[key];
  const c = KR.constraints(q);
  const ok = (a) => {
    const s = String(a || '').trim();
    if (!s || s.length >= 42 || !/^[a-z0-9]/i.test(s)) return false;
    // Article titles are not answers: "Lists of islands" and "Outline of ..."
    // arrived as answers to "something you would take to a desert island".
    if (/^(?:lists?|index|outline|timeline|glossary|category|categories|bibliography)\b/i.test(s)) return false;
    return KR.shapeOk(q, s) && KR.pass(s, c);
  };
  const packs = KR.resolve(q, kb()).slice(0, 14).filter(ok);
  // "Something you would take", "a thing you might find": the answer is a choice
  // or an association, not an instance of a list article. A wiki list answers
  // those with the list's own subject (islands for a desert island), so those
  // shapes go to the association and model lanes instead.
  const associative = /\b(?:something|anything|things?)\b|\bwould (?:you )?(?:take|bring|find|see|hear|say)\b|\bmight (?:find|see|hear)\b/i.test(q);
  // Datamuse answers with words that *mean* the subject, which is right for
  // "something you would take to a desert island" and wrong for "name a color":
  // it returned dye, paint, mordant, tincture - the material, not a colour. So the
  // association lane is used only for association-shaped questions; instance
  // questions get the list articles and the model, which name instances.
  const lanes = [
    (!associative ? (async () => ({ src: 'wiki-list', answers: ((await listAnswers(q)) || {}).answers || [] }))() : Promise.resolve({ src: 'wiki-list', answers: [] })),
    (associative ? (async () => ({ src: 'live', answers: ((await answer(q)) || {}).answers || [] }))() : Promise.resolve({ src: 'live', answers: [] })),
    knowModel(q)
  ];
  let best = { src: packs.length ? 'pack' : 'none', answers: packs };
  // Not just "most answers win": Datamuse associations return a dozen words of
  // any kind ("mak, core, crib" for a made-up holiday) and would outnumber a
  // correct four-answer list. The model and the curated article win on weight.
  const weight = (src, n) => n * (/^ai/.test(src) ? 1.6 : src === 'wiki-list' || src === 'wiki-cat' ? 1.3 : 1);
  const bestW = () => weight(best.src === 'pack' || best.src === 'none' ? 'live' : best.src, best.answers.length);
  await Promise.race([
    new Promise((done) => {
      let left = lanes.length;
      for (const p of lanes) {
        p.then((r) => {
          const a = (r && r.answers || []).filter(ok);
          if (a.length >= 2 && weight(r.src, a.length) > bestW()) best = { src: r.src, answers: a };
          if (--left === 0) done();
        }).catch(() => { if (--left === 0) done(); });
      }
    }),
    sleep(5500)
  ]);
  // The room takes a word or a few, not a phrase: the model answers a desert
  // island with "A pack of high-protein energy bars", which the bot's own gate
  // rejects. Short answers lead, long ones stay as a reserve.
  const rank = (a) => {
    const w = String(a).trim().split(/\s+/).length;
    return (w <= 3 ? 0 : w <= 4 ? 1 : 2) * 1000 + String(a).length;
  };
  // Group order matters more than a global sort: a fetched answer belongs ahead
  // of the pack's guesses, or "Red" is interleaved with dye, paint and stain
  // merely because they are shorter. Short-first applies inside each group.
  const uses = (a) => String(a).trim().replace(/[^a-z0-9]/gi, '').length > 1;
  const primary = [...new Set(best.answers.map(tidyAnswer))].filter(uses).sort((x, y) => rank(x) - rank(y));
  const pset = new Set(primary.map((a) => a.toLowerCase()));
  const secondary = [...new Set(packs.map(tidyAnswer))].filter(uses)
    .filter((a) => !pset.has(String(a).toLowerCase()))
    .sort((x, y) => rank(x) - rank(y));
  const answers = [...primary, ...secondary].slice(0, 14);
  const res = { q, answers, src: best.src, known: best.src !== 'pack' && best.src !== 'none' };
  if (answers.length) { askCache[key] = res; saveAsk(); }
  return res;
}

const server = http.createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Private-Network': 'true'
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (url.pathname === '/learn') {
    const q = url.searchParams.get('q') || '';
    let answers = [];
    try { answers = q ? learnAnswers(q) : []; } catch (e) { answers = []; }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ q, answers, src: 'learned' }));
  }
  if (url.pathname === '/feedback') {
    const q = url.searchParams.get('q') || '';
    const a = url.searchParams.get('a') || '';
    const ok = url.searchParams.get('ok') === '1';
    let stored = false;
    try { stored = learnFeedback(q, a, ok); } catch (e) { stored = false; }
    // A rejection is a lesson, not just a deletion: queue the category so the
    // model is asked again, told not to repeat what the room refused.
    if (!ok) {
      const c = cleanCat(q);
      if (c && study.queue.indexOf(c) < 0) {
        study.queue.unshift(c);
        study.rejected++;
        delete study.tried[learnKeyOf(c)];
        saveStudy();
      }
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ q, a, ok, stored }));
  }
  if (url.pathname === '/cmd') {
    const verb = String(url.searchParams.get('do') || '').slice(0, 12);
    const word = String(url.searchParams.get('w') || '').slice(0, 60);
    if (verb && verb !== 'status') cmds.push({ do: verb, w: word, at: Date.now() });
    if (cmds.length > 20) cmds.splice(0, cmds.length - 20);
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      ok: !!verb, queued: cmds.length, results: cmdDone.slice(-12),
      watch: { at: watchState.at, ver: watchState.ver, cat: watchState.cat, box: watchState.box, up: watchState.up }
    }));
  }
  if (url.pathname === '/live') {
    if (req.method === 'GET') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ now: Date.now(), ...watchState }));
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 200000) { try { req.destroy(); } catch (e) {} } });
    req.on('end', () => {
      try {
        const j = JSON.parse(raw || '{}');
        watchState.at = Date.now();
        // A new clue starts a new round on the watch page: keeping the previous
        // round's events mixed in made it impossible to tell which press belonged
        // to which question.
        const ncat = String(j.cat || '').slice(0, 140);
        if (watchState.cat && ncat && ncat !== watchState.cat) watchState.events = [];
        watchState.ver = String(j.ver || '').slice(0, 12);
        watchState.name = String(j.name || '').slice(0, 24);
        watchState.cat = String(j.cat || '').slice(0, 140);
        watchState.box = String(j.box || '').slice(0, 60);
        watchState.up = j.up ? 1 : 0;
        watchState.sent = Number(j.sent) || 0;
        watchState.bad = Number(j.bad) || 0;
        watchState.page = String(j.page || '').slice(0, 400);
        if (Array.isArray(j.results)) {
          for (const r of j.results.slice(0, 10)) cmdDone.push({ do: String(r.do || ''), w: String(r.w || ''), said: String(r.said || ''), at: Date.now() });
          if (cmdDone.length > 50) cmdDone.splice(0, cmdDone.length - 50);
        }
        const evs = Array.isArray(j.events) ? j.events.slice(-40) : [];
        for (const e of evs) {
          const k = JSON.stringify(e);
          if (!watchState.events.some((x) => x.k === k)) watchState.events.push({ k, e });
        }
        if (watchState.events.length > 300) watchState.events = watchState.events.slice(-300);
      } catch (e) { /* a bad heartbeat must never take the server down */ }
      // Commands are handed out exactly once, in the heartbeat reply: the watch
      // page polls /live with GET and must never consume them.
      const out = cmds.splice(0, 10);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, cmds: out }));
    });
    return;
  }
  // The standalone console: the party runs in its own game tab, and this page is
  // the separate thing that reports and steers the bot. Deliberately not a proxy
  // and not embedded - a verification gate is bound to the game's own address.
  if (url.pathname === '/party' || url.pathname === '/party.html') {
    try {
      const buf = fs.readFileSync(PARTYFILE);
      res.writeHead(200, { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(buf);
    } catch (e) {
      res.writeHead(500, { ...cors, 'Content-Type': 'text/plain' });
      return res.end('missing party.html: ' + e.message);
    }
  }
  if (url.pathname === '/watch' || url.pathname === '/watch.html') {
    try {
      const buf = fs.readFileSync(WATCHFILE);
      res.writeHead(200, { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(buf);
    } catch (e) {
      res.writeHead(500, { ...cors, 'Content-Type': 'text/plain' });
      return res.end('missing watch.html: ' + e.message);
    }
  }
  // Game log: the bot posts what happened in a round (a category, the words it
  // sent, what was refused, which lane answered, why it stayed silent). Written
  // as JSON lines so a whole session can be read back and turned into fixes
  // instead of guesswork.
  if (url.pathname === '/gamelog') {
    if (req.method === 'GET') {
      let lines = [];
      try { lines = fs.readFileSync(GAMELOGFILE, 'utf8').trim().split('\n').filter(Boolean).slice(-40); } catch (e) { lines = []; }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end('[' + lines.join(',') + ']');
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 400000) { try { req.destroy(); } catch (e) {} } });
    req.on('end', () => {
      try {
        const j = JSON.parse(raw || '{}');
        const rec = {
          at: new Date().toISOString(),
          cat: String(j.cat || '').slice(0, 120),
          ver: String(j.ver || '').slice(0, 12),
          name: String(j.name || '').slice(0, 24),
          events: Array.isArray(j.events) ? j.events.slice(-200) : []
        };
        fs.appendFileSync(GAMELOGFILE, JSON.stringify(rec) + '\n');
        // Read the round back and fix what it shows, without being asked - once.
        // Every re-post of the same round used to run the repair step again, and
        // /selfcheck showed 1000+ repairs for a single wording.
        const rid = String(j.rid || '').slice(0, 160) ||
          (rec.cat + '#' + rec.events.length + '#' + (((rec.events[0] || {}).t) || 0));
        if (!auditedRids.has(rid)) {
          auditedRids.set(rid, Date.now());
          if (auditedRids.size > 600) {
            const cut = Date.now() - 30 * 60 * 1000;
            for (const [k, t] of auditedRids) if (t < cut) auditedRids.delete(k);
          }
          auditRecord(rec).catch(() => {});
        }
        try {
          const st = fs.statSync(GAMELOGFILE);
          if (st.size > 8 * 1024 * 1024) {
            const keep = fs.readFileSync(GAMELOGFILE, 'utf8').split('\n').filter(Boolean).slice(-2000).join('\n') + '\n';
            fs.writeFileSync(GAMELOGFILE, keep);
          }
        } catch (e) {}
      } catch (e) {}
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  }
  if (url.pathname === '/selfcheck') {
    const list = Object.values(repairs).sort((a, b) => (b.silent + b.refused) - (a.silent + a.refused));
    const totals = list.reduce((t, e) => {
      t.silent += e.silent; t.refused += e.refused; t.junk += e.junk; t.cycles += e.cycles; t.fixes += e.fixes;
      return t;
    }, { silent: 0, refused: 0, junk: 0, cycles: 0, fixes: 0 });
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      totals,
      worst: list.slice(0, 15).map((e) => ({ cat: e.cat, silent: e.silent, refused: e.refused, junk: e.junk, cycles: e.cycles, fixes: e.fixes, updated: e.updated })),
      learnedCategories: Object.keys(learned).length
    }));
  }
  if (url.pathname === '/stats') {
    const entries = Object.values(learned);
    const sum = (o) => Object.keys(o || {}).length;
    let ok = 0, ai = 0, wiki = 0, bad = 0, mastered = 0;
    for (const e of entries) {
      ok += sum(e.ok); ai += sum(e.ai); wiki += sum(e.wiki); bad += sum(e.bad);
      if (sum(e.ok) > 0) mastered++;
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      categories: entries.length,
      mastered,
      answers: { accepted: ok, model: ai, wiki, rejected: bad },
      study: {
        queue: study.queue.length,
        rounds: study.rounds,
        answersLearned: study.learned,
        repairsQueuedByRejections: study.rejected,
        studying,
        lastCategory: study.lastQ || null,
        lastAt: study.lastAt || null,
        since: study.startedAt
      }
    }));
  }
  // Streaming lane: the local model needs ~15s for a full list on this machine,
  // and the turn fuses at ~7.7s, so waiting for the finished list means the model
  // never contributes. This hands over each answer as its line completes, so the
  // first is usable in a second or two.
  if (url.pathname === '/llm' && url.searchParams.get('stream') === '1') {
    const q = url.searchParams.get('q') || '';
    res.writeHead(200, { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    if (!q) return res.end();
    try {
      const avoidS = String(url.searchParams.get('avoid') || '').split('|').filter(Boolean).slice(0, 25);
      const sysS = 'You answer categories in a fast party game. Reply with the answer list only - one answer per line, '
        + 'no numbering, no quotes, no commentary. Every line must be a real, specific, well-known instance of exactly '
        + 'the category as worded. Answer the exact wording, never a related set: for "a song by X" only songs by X; '
        + 'for "a movie starring Y" only films Y appeared in; for "an actor in Bollywood" only Bollywood actors. '
        + 'Never answer with the category label itself or the broader group an answer belongs to. '
        + (avoidS.length ? 'Never repeat these, already used: ' + avoidS.join(', ') + '. ' : '')
        + 'Give 8 answers.';
      const r = await fetch(OLLAMA_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: OPEN_MODEL, stream: true, keep_alive: '60m',
          // Tuned for latency on this CPU: a 512-token context is plenty for a
          // one-line category, 64 tokens covers 8 short answers, and 8 threads is
          // this machine's physical core count. temperature 0 makes the stream
          // deterministic, so a repeat wording returns the same list.
          options: { temperature: 0, num_predict: 64, num_ctx: 512, num_thread: CPU_THREADS },
          messages: [{ role: 'system', content: sysS }, { role: 'user', content: 'Category: ' + q + '\n\nGive 8 answers, one per line.' }]
        })
      });
      console.log('llm ask: ' + q);
      const askedAt = Date.now();
      let firstLogged = false;
      if (!r.ok) {
        console.log('llm fail: ' + r.status + ' ' + q);
        return res.end();
      }
      // A stream that finishes after the browser gave up keeps the single model
      // busy for the whole generation; the request closing is a reason to stop.
      let gone = false;
      try { req.on('close', () => { gone = true; }); } catch (e) {}
      const cons = KR.constraints(q);
      // Whole-phrase match on a normalised copy: avoid 'red' must not drop
      // 'bored', avoid 'us' must not drop 'usa'. No regex, so nothing to escape.
      const flat = (t) => ' ' + String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
      const avoidList = avoidS.map(flat).filter((w) => w.trim());
      const avoided = (t) => { const x = flat(t); return avoidList.some((w) => x.indexOf(w) >= 0); };
      const keep = (t) => {
        if (!t || t.length >= 60 || /^none$/i.test(t)) return false;
        if (!KR.pass(t, cons) || !KR.shapeOk(q, t)) return false;
        if (avoided(t)) return false;
        return true;
      };
      const got = [];
      const hand = (t) => {
        const w = String(t || '').trim();
        if (!keep(w) || got.length >= 12) return;
        if (got.some((x) => KR.norm(x) === KR.norm(w))) return;
        got.push(w);
        if (!firstLogged) {
          firstLogged = true;
          console.log('llm first: ' + w + ' @' + (Date.now() - askedAt) + 'ms');
        }
        res.write(w + '\n');
      };
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '', acc = '', finished = false;
      while (!finished && !gone) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buf += dec.decode(chunk.value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          let j = null;
          try { j = JSON.parse(line); } catch (e) { continue; }
          acc += String((j.message && j.message.content) || '');
          let nl;
          while ((nl = acc.indexOf('\n')) >= 0) {
            const ans = acc.slice(0, nl).replace(/^[\s\-*\d.)]+/, '').trim();
            acc = acc.slice(nl + 1);
            if (!gone) hand(ans);
          }
          if (j.done) { finished = true; break; }
        }
      }
      const tail = acc.replace(/^[\s\-*\d.)]+/, '').trim();
      if (!gone) hand(tail);
      // The streamed list is the same answer a blocking /llm call would have
      // returned, so it is cached and fed back as learned: without this every
      // repeat of a wording asked the model again from scratch.
      if (got.length) {
        llmCache['Q2:' + KR.norm(q)] = { q, answers: got.slice(), src: 'ai:ollama', conf: 'high' };
        saveLlm();
        try { learnSuggest(q, got.slice(), 'ai:ollama'); } catch (e) {}
      }
    } catch (e) {}
    return res.end();
  }
  if (url.pathname === '/llm') {
    lastLiveAt = Date.now();
    const q = url.searchParams.get('q') || '';
    const fresh = url.searchParams.get('fresh') === '1';
    // Words the room has already used ride along so the answer list starts past
    // them: a model list that opens with the word just refused wastes the turn.
    const avoidRaw = url.searchParams.get('avoid') || '';
    const avoid = avoidRaw
      ? new Set(avoidRaw.split('|').map((s) => String(s).toLowerCase().trim()).filter(Boolean))
      : null;
    let body = { q, answers: [] };
    try {
      body = q ? await llmAnswers(q, fresh) : { q, answers: [] };
    } catch (e) {
      body = { q, answers: [], error: String((e && e.message) || e) };
    }
    if (avoid && body && body.answers) {
      const av = [...avoid];
      // Whole-phrase match: the old substring test let avoid 'red' drop 'bored'
      // and avoid 'us' drop 'usa', thinning good lists for no reason.
      const flat2 = (t) => ' ' + String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
      const avl = [...av].map(flat2).filter((w) => w.trim());
      const used = (a) => { const x = flat2(a); return avl.some((v) => x.indexOf(v) >= 0); };
      const kept = body.answers.filter((a) => !used(a));
      // Never hand back an empty list just because every candidate was used:
      // a repeat still beats silence, and the client ranks it last anyway.
      if (kept.length) body = Object.assign({}, body, { answers: kept });
    }
    if (body && body.answers && body.answers.length) learnSuggest(q, body.answers, body.src);
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(body));
  }
  if (url.pathname === '/ask') {
    lastLiveAt = Date.now();
    const q = url.searchParams.get('q') || '';
    let body = { q, answers: [] };
    try {
      body = (q && (await listAnswers(q))) || { q, answers: [] };
    } catch (e) {
      body = { q, answers: [], error: String((e && e.message) || e) };
    }
    if (body && body.answers && body.answers.length) learnSuggest(q, body.answers, body.src);
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(body));
  }
  if (url.pathname === '/know') {
    lastLiveAt = Date.now();
    const q = url.searchParams.get('q') || '';
    let body;
    try {
      body = q ? await knowAnswers(q) : { q, answers: [] };
    } catch (e) {
      body = { q, answers: [], error: String(e && e.message || e) };
    }
    // /know's sources are list articles and association pages, which answered
    // "something you find in a kitchen" with try/like/trade. It still helps as a
    // live backup, but it is not stored as learned knowledge.
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(body));
  }
  if (url.pathname === '/resolve') {
    const q = url.searchParams.get('q') || '';
    let body;
    try {
      body = q ? await answer(q) : { q, answers: [], base: '' };
    } catch (e) {
      body = { q, answers: [], error: String(e && e.message || e) };
    }
    // /resolve is the pack's own offline resolver: its answers are already in the
    // pack, and storing its WordNet guesses (garage -> back, bak) as learned
    // knowledge polluted the store. Only live sources that know more than the
    // pack do are worth keeping.
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(body));
  }
  // A fake room for deterministic bot tests: the same DOM contract the real room
  // uses (input.ds-input, button.ds-dive-btn, "your puffer"), where SEND enables
  // as soon as the box has text and a click records the answer. It answers the
  // only question that matters - does the bot *always* put something in the box
  // and submit it - without spending a rated game to find out.
  if (url.pathname === '/fakegame.html') {
    const q = url.searchParams.get('cat') || 'Name a fruit';
    const page = `<!doctype html><meta charset=utf-8><title>fake room</title>
<style>body{font:16px system-ui;padding:20px}button{font:inherit;padding:6px 14px}</style>
<p id=hud>RATED 1V1 TEST CATEGORY 1 FLOATING 2/2</p>
<div class=prompt id=cat></div>
<p>▸ Buffy is up</p>
<input class=ds-input id=box autocomplete=off>
<button class=ds-dive-btn id=send disabled>SEND</button>
<pre id=log></pre>
<script>
window.__sent=[];window.__at=[];
const box=document.getElementById('box'),send=document.getElementById('send'),log=document.getElementById('log');
window.__setCat=function(c){document.getElementById('cat').textContent=c;box.value='';send.disabled=true;window.__catAt=Date.now();};
window.__setCat(${JSON.stringify(q)});
box.addEventListener('input',()=>{send.disabled=!box.value.trim()});
send.addEventListener('click',()=>{
  const v=box.value.trim();
  if(!v)return;
  window.__sent.push(v);window.__at.push(Date.now()-(window.__catAt||Date.now()));
  log.textContent+=(Date.now()-(window.__catAt||Date.now()))+'ms  '+v+'\\n';
  box.value='';send.disabled=true;
  box.dispatchEvent(new Event('input',{bubbles:true}));
});
box.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();send.click();}});
</script>`;
    res.writeHead(200, { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(page);
  }
  // The bot with its pack inlined. The room page is https and the pack lives on
  // http://127.0.0.1, so a cold cache means a blocked or slow fetch, and a bot
  // with no KB answers *nothing*: that is the silence that lost games. Serving
  // the pack inside the script removes the fetch, the IndexedDB cache and the
  // mixed-content rule from the path entirely.
  if (url.pathname === '/botp.js') {
    if (!BOTP) {
      const js = fs.readFileSync(FILES['/bot.js'][0], 'utf8');
      const b64 = fs.readFileSync(FILES['/kb'][0], 'utf8').replace(/\s+/g, '');
      BOTP = js + '\n;(function(){try{window.__KRP=[' + JSON.stringify(b64) +
        '];window.__krLoad().then(function(){console.log("kr: inline pack loaded")},' +
        'function(e){console.log("kr: inline pack failed",e)});}catch(e){console.log("kr: inline pack threw",e)}})();\n';
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    return res.end(BOTP);
  }
  const hit = FILES[url.pathname];
  if (!hit) {
    res.writeHead(404, cors);
    return res.end('not found');
  }
  const body = fs.readFileSync(hit[0]);
  res.writeHead(200, { ...cors, 'Content-Type': hit[1], 'Cache-Control': 'no-store' });
  res.end(body);
});

// Warm the local model at boot. After a restart the first /llm request pays the
// disk load (5-10s here), which used to land past the game's turn and hand the
// round to a pack guess. This costs nothing during play because it runs once.
(async () => {
  try {
    await pickOllamaModel();
    const t0 = Date.now();
    await fetch(OLLAMA_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Same options as the stream lane, so the resident instance is the one the
      // game will actually use (a differing num_ctx or num_thread forces a reload).
      body: JSON.stringify({ model: OPEN_MODEL, stream: false, keep_alive: '60m',
        options: { temperature: 0, num_predict: 1, num_ctx: 512, num_thread: CPU_THREADS },
        messages: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(60000)
    });
    console.log('model warm in ' + (Date.now() - t0) + 'ms');
  } catch (e) { console.log('model warm failed: ' + ((e && e.message) || e)); }
})();

server.listen(PORT, '127.0.0.1', () => {
  const size = fs.statSync(FILES['/kb'][0]).size;
  console.log(`kb server on http://127.0.0.1:${PORT} (/kb ${(size / 1024).toFixed(0)}KB, /bot.js, /tierlog.js, /resolve?q=)`);
});
