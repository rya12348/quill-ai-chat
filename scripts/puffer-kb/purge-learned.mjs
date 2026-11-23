/*
 * Rebuilds .k3/learned.json from sources that actually know something.
 *
 * The store used to take whatever any lane returned, so the offline pack's
 * guesses got in (garage -> nack, lift, level) mixed with real answers, and chat
 * logs captured as "categories" became keys that could never match. This keeps
 * only:
 *
 *   ok    answers the room actually accepted (kept as they are)
 *   bad   answers the room rejected      (kept as they are)
 *   ai    answers the model lanes produced  (from .k3/llm-cache.json)
 *   wiki  answers the wiki list lane produced (from .k3/ask-cache.json, L2 only)
 *
 * Everything else is dropped. Safe to run repeatedly.
 *
 * Run it with serve.mjs STOPPED: a live server holds the store in memory and
 * writes it back on the next feedback, which would undo this migration.
 *
 * Usage: node scripts/puffer-kb/purge-learned.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const K3 = path.join(ROOT, '.k3');
const LEARN = path.join(K3, 'learned.json');
const LLM = path.join(K3, 'llm-cache.json');
const ASK = path.join(K3, 'ask-cache.json');
const DRY = process.argv.includes('--dry');

const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch (e) { return {}; }
};

// The same sanitiser serve.mjs applies: a clue ends where the chat panel begins.
function cleanCat(q) {
  let t = String(q || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*(?:CHAT|Players\s*▾|▸)[\s\S]*$/i, '').trim();
  return t.length >= 4 && t.length <= 120 ? t : '';
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const learned = readJson(LEARN);
const llm = readJson(LLM);
const ask = readJson(ASK);

// Cache entries by their normalised category, whichever prefix they carry.
const byNorm = (obj, prefixes) => {
  const m = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const p = prefixes.find((x) => k.startsWith(x));
    if (!p) continue;
    const key = k.slice(p.length);
    if (!key) continue;
    const answers = Array.isArray(v && v.answers) ? v.answers : [];
    if (!answers.length) continue;
    const prev = m.get(key) || [];
    m.set(key, prev.concat(answers));
  }
  return m;
};
const llmByCat = byNorm(llm, ['Q2:']);
const askByCat = byNorm(ask, ['L2:']);
const llmQ = new Map(Object.entries(llm).filter(([k]) => k.startsWith('Q2:')).map(([k, v]) => [k.slice(3), v && v.q]));
const askQ = new Map(Object.entries(ask).filter(([k]) => k.startsWith('L2:')).map(([k, v]) => [k.slice(3), v && v.q]));

const out = {};
const stats = { droppedCategories: [], keptCategories: 0, droppedAnswers: 0, ai: 0, wiki: 0, ok: 0 };

// 1. Start from what the room verdicts say - those are facts.
for (const [key, e] of Object.entries(learned)) {
  const clean = cleanCat(e && e.q) || cleanCat(key);
  if (!clean) { stats.droppedCategories.push(String((e && e.q) || key).slice(0, 60)); continue; }
  const nk = norm(clean);
  const cur = out[nk] || (out[nk] = { q: clean, ok: {}, bad: {}, ai: {}, wiki: {}, src: '', seen: 0, updated: 0 });
  for (const [w, n] of Object.entries((e && e.ok) || {})) { cur.ok[w] = (cur.ok[w] || 0) + n; stats.ok++; }
  for (const [w, n] of Object.entries((e && e.bad) || {})) { cur.bad[w] = (cur.bad[w] || 0) + n; }
  cur.seen = Math.max(cur.seen || 0, (e && e.seen) || 0);
  cur.updated = Math.max(cur.updated || 0, (e && e.updated) || 0);
  // Legacy `sug` is deliberately not carried over: it mixed pack guesses in.
  const legacy = Object.keys((e && e.sug) || {}).length;
  stats.droppedAnswers += legacy;
}

// 2. Re-add the model lane's answers, straight from its own cache.
for (const [key, answers] of llmByCat) {
  const clean = cleanCat(llmQ.get(key)) || cleanCat(key);
  if (!clean) continue;
  const nk = norm(clean);
  const cur = out[nk] || (out[nk] = { q: clean, ok: {}, bad: {}, ai: {}, wiki: {}, src: 'ai:cache', seen: 0, updated: 0 });
  for (const a of answers) {
    const w = String(a || '').trim();
    if (!w || w.length > 60) continue;
    cur.ai[w] = (cur.ai[w] || 0) + 1;
    stats.ai++;
  }
}

// 3. And the wiki list lane's.
for (const [key, answers] of askByCat) {
  const clean = cleanCat(askQ.get(key)) || cleanCat(key);
  if (!clean) continue;
  const nk = norm(clean);
  const cur = out[nk] || (out[nk] = { q: clean, ok: {}, bad: {}, ai: {}, wiki: {}, src: 'wiki:cache', seen: 0, updated: 0 });
  for (const a of answers) {
    const w = String(a || '').trim();
    if (!w || w.length > 60) continue;
    if (cur.wiki[w]) continue;
    cur.wiki[w] = (cur.wiki[w] || 0) + 1;
    stats.wiki++;
  }
}

// 4. Drop any entry that ended up with nothing to say.
for (const [k, e] of Object.entries(out)) {
  const total = Object.keys(e.ok).length + Object.keys(e.ai).length + Object.keys(e.wiki).length;
  if (!total) { delete out[k]; stats.droppedCategories.push(e.q); continue; }
  stats.keptCategories++;
}

const garage = Object.values(out).find((e) => /garage/i.test(e.q));
console.log(`dry=${DRY ? 'yes' : 'no'}`);
console.log(`categories: ${Object.keys(learned).length} -> ${stats.keptCategories}`);
console.log(`dropped keys: ${stats.droppedCategories.length}`, stats.droppedCategories.slice(0, 6));
console.log(`answers: ok=${stats.ok} ai=${stats.ai} wiki=${stats.wiki}, legacy sug dropped=${stats.droppedAnswers}`);
if (garage) {
  console.log('garage entry now:');
  console.log('  ok  :', JSON.stringify(garage.ok));
  console.log('  ai  :', Object.keys(garage.ai).slice(0, 16).join(', '));
  const junk = Object.keys(garage.ai).filter((w) => /^(nack|lift|level|back|bak)$/i.test(w));
  console.log('  junk still present:', junk.length ? junk.join(', ') : 'none');
}

if (!DRY) {
  fs.mkdirSync(K3, { recursive: true });
  fs.writeFileSync(LEARN, JSON.stringify(out));
  console.log('wrote', LEARN);
}
