/*
 * Offline check for the Puffer Party resolver.
 *
 * Runs the shipped resolver against the frozen knowledge pack and answers three
 * questions the bot actually depends on:
 *   1. coverage   - for every real Krillion prompt (941 of them), does an answer
 *                   appear at all, and are there enough to survive rejections?
 *   2. quality    - for short party labels, unseen in the corpus, are the top
 *                   picks plausible? (printed for eyeballing)
 *   3. latency    - how long resolution takes, since the turn window is ~1.5s.
 *
 * Usage: node scripts/puffer-kb/test-resolver.mjs [--verbose]
 * Exits non-zero when coverage or latency regress.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERBOSE = process.argv.includes('--verbose');

const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));

function parseCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"') { if (txt[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const root = path.resolve(HERE, '../..');
const rows = parseCsv(path.join(root, '.k/prompts.csv'));
const header = rows.shift();
const qi = header.indexOf('prompt');
const prompts = [...new Set(rows.map((r) => (r[qi] || '').trim()).filter(Boolean))];

// ---------------------------------------------------------------- coverage ---
// Coverage is measured in two groups since the qualifier gate. A plain label
// ("CHEESE", "PASTA SHAPE") must always resolve. A qualified one ("a food or
// drink made from corn") is allowed to go unanswered: the bot now stays silent
// rather than send a drink that has nothing to do with corn, and the live list
// lookup and the model bridge are what answer those.
const QUALIFIED = /\b(?:that|which|whose|who|with|without|from|in|into|on|containing|contains|made|used|found|earned|starring|featuring|has|have|can|starting|ending|named|after|before|during|per|by)\b/i;
const plainLabels = prompts.filter((p) => !QUALIFIED.test(p));
const qualLabels = prompts.filter((p) => QUALIFIED.test(p));
const answered = (arr) => arr.filter((p) => KR.resolve(p, kb).length >= 4).length;
let none = 0, thin = 0, good = 0;
const samples = [];
for (const p of prompts) {
  const n = KR.resolve(p, kb).length;
  if (n === 0) { none++; samples.push(p); }
  else if (n < 4) thin++;
  else good++;
}
const total = prompts.length;
const plainPct = (100 * answered(plainLabels)) / Math.max(1, plainLabels.length);
const qualPct = (100 * answered(qualLabels)) / Math.max(1, qualLabels.length);
console.log(`\ncoverage over ${total} real Krillion prompts`);
console.log(`  answered (>=4 candidates) ${good}  (${((good / total) * 100).toFixed(1)}%)`);
console.log(`    plain labels     ${plainPct.toFixed(1)}% of ${plainLabels.length}`);
console.log(`    qualified labels ${qualPct.toFixed(1)}% of ${qualLabels.length}`);
console.log(`  thin     (1-3 candidates)  ${thin}  (${((thin / total) * 100).toFixed(1)}%)`);
console.log(`  unanswered                 ${none}  (${((none / total) * 100).toFixed(1)}%)`);
if (VERBOSE && samples.length) console.log('  unanswered samples:', samples.slice(0, 12));

// ------------------------------------------------------ qualifier discipline --
// The exact words the room rejected. If any of these come back, the gate is
// leaking a guess about the qualifier again.
console.log('\nqualifier discipline (rejected words must not return)');
let leaked = 0;
for (const [q, bad] of [
  ['Name a medieval weapon', /^(?:gar|gong|crab|disposed|stave)$/i],
  ['Name an emotion from Inside Out', /^(?:within|turn|inward|aut|evert|reverse)$/i],
  ['Name a food or drink made from corn', /^(?:beer|vodka|ale|gin|eggnog)$/i],
  ['Name a city in Florida', /^(?:agra|alabama)$/i]
]) {
  const picks = KR.resolve(q, kb, { win: true });
  const hit = picks.filter((a) => bad.test(a));
  if (hit.length) { leaked++; console.log(`  LEAK ${q.padEnd(38)} -> ${hit.join(', ')}`); }
  else console.log(`  ok   ${q.padEnd(38)} -> ${picks.slice(0, 4).join(', ') || '(silent)'}`);
}

// ----------------------------------------------------------------- quality ---
// Short labels in the party's own style, most of which never appear verbatim in
// the corpus, plus constraint forms it definitely does not see.
const labels = [
  'CHEESE', 'BEER BRAND', 'LIVING BIRD', 'DOG BREED', 'PASTA SHAPE',
  'TYPE OF CHEESE', 'POKÉMON', 'NINTENDO GAME', 'US STATE', 'AFRICAN COUNTRY',
  'A WORD ENDING IN -TION', 'A CITY STARTING WITH K', 'NAME A COUNTRY IN ASIA',
  'GUITAR BRAND', 'CEREAL', 'SUPERHERO', 'SANDWICH', 'COCKTAIL', 'MUSHROOM',
  'SCIENCE FICTION FILM', 'TAROT CARD', 'DINOSAUR', 'BREAKFAST FOOD',
  'SOMETHING IN A GYM BAG', 'THING YOU LOSE', 'REASON TO BE LATE', 'SUPERPOWER',
  'NAME A WORD THAT RHYMES WITH CAT', 'PLANET', 'SPICE', 'BOARD GAME', 'DOG NAME'
];

let shown = 0;
console.log('\nquality on party-style labels (top 6)');
for (const label of labels) {
  const picks = KR.resolve(label, kb);
  const line = `${label.padEnd(38)} ${picks.slice(0, 6).join(', ') || '--- none ---'}`;
  console.log('  ' + line);
  if (picks.length === 0) shown++;
}

// Labels that must resolve to something recognisable, or the pack has rotted.
// These are the answer sets a human would give, checked against the top picks.
const EXPECT = [
  ['CHEESE', /cheddar|brie|mozzarella|gouda/i],
  ['POKÉMON', /pikachu|charmander|bulbasaur|eevee/i],
  ['PLANET', /mars|jupiter|venus|saturn/i],
  ['US STATE', /california|texas|florida|ohio/i],
  ['DOG BREED', /labrador|poodle|bulldog|beagle/i],
  ['PASTA SHAPE', /penne|fusilli|macaroni|spaghetti/i],
  ['AFRICAN COUNTRY', /nigeria|kenya|egypt|ghana|mali/i],
  ['DINOSAUR', /triceratops|stegosaurus|tyrannosaurus|velociraptor/i],
  ['COCKTAIL', /martini|mojito|margarita|negroni/i],
  ['BOARD GAME', /monopoly|chess|scrabble|risk/i],
  ['SUPERHERO', /superman|batman|thor|iron man|spider/i],
  ['MUSHROOM', /shiitake|cremini|portobello|button/i],
  // No open source of brand names, so "X brand" is expected to degrade to the
  // category's own vocabulary (ale, lager, stout) rather than to nothing.
  ['BEER BRAND', /ale|lager|stout|pilsner|beer|suds/i],
  ['SANDWICH', /blt|club|grilled cheese|ham|tuna/i],
  ['BREAKFAST FOOD', /bacon|eggs|pancake|cereal|toast/i],
  // A named subject in the prompt has to beat the general head noun: "movie"
  // alone answers with cartoons whatever the actor is.
  ['NAME A MOVIE STARRING WILL SMITH', /bad boys|men in black|hancock|hitch|aladdin|i am legend/i],
  ['NAME A CHARACTER FROM THE CARS MOVIES', /lightning|mater|sally|doc hudson|guido/i]
];
let wrong = 0;
console.log('\nexpected answers present in top 8');
for (const [label, re] of EXPECT) {
  const top = KR.resolve(label, kb).slice(0, 8);
  const hit = top.some((a) => re.test(a));
  if (!hit) { wrong++; console.log(`  MISS ${label.padEnd(20)} got: ${top.join(', ') || '---'} `); }
}
if (!wrong) console.log(`  all ${EXPECT.length} labels resolved to a recognisable answer`);

// ------------------------------------------------------------- constraints ---
console.log('\nconstraint handling');
let badConstraints = 0;
for (const [c, test] of [
  ['name an animal whose name starts with K', (a) => /^k/i.test(a)],
  ['name a country starting with Z', (a) => /^z/i.test(a)],
  ['name a word ending in -tion', (a) => /tion$/i.test(a)],
  ['name a cheese containing the letter B', (a) => /b/i.test(a)]
]) {
  const picks = KR.resolve(c, kb);
  const ok = picks.length >= 3 && picks.slice(0, 3).every(test);
  if (!ok) badConstraints++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${c.padEnd(58)} -> ${picks.slice(0, 5).join(', ') || '--- none ---'}`);
}

// ------------------------------------------------------------------ latency --
const probe = labels.concat(prompts.slice(0, 200));
const t0 = process.hrtime.bigint();
for (let round = 0; round < 20; round++) for (const p of probe) KR.resolve(p, kb);
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / (probe.length * 20);
console.log(`\nlatency: ${(ms * 1000).toFixed(0)} us/resolve over ${probe.length * 20} calls`);

// ------------------------------------------------------------------- gates ---
const problems = [];
// Plain labels are the regression guard; qualified ones may legitimately stay
// silent until the live or model lookup answers them.
if (plainPct < 94) problems.push(`plain-label coverage fell to ${plainPct.toFixed(1)}% (want >=94%)`);
if (qualPct < 80) problems.push(`qualified-label coverage fell to ${qualPct.toFixed(1)}% (want >=80%)`);
if (leaked) problems.push(`${leaked} categories still return a word the qualifier rules out`);
if (shown > 6) problems.push(`${shown} party-style labels produced no answer (want <=6)`);
if (wrong > 1) problems.push(`${wrong} party labels answered with the wrong kind of thing (want <=1)`);
if (badConstraints) problems.push(`${badConstraints} constrained prompts ignored their letter rule`);
if (ms > 8) problems.push(`resolve is ${ms.toFixed(1)}ms (want <=8ms)`);

if (problems.length) {
  console.error('\nFAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('\nOK');
