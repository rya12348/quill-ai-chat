/*
 * Measures how much of the pack's output is junk: answers that come from a
 * "guess" tier (WordNet last resort, a bare corpus bucket, the vocabulary sweep,
 * an association list) and that the room has never accepted as an answer to
 * anything (not in kb.voc).
 *
 * Usage: node scripts/puffer-kb/audit-junk.mjs [limit]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIMIT = Number(process.argv[2] || 25);
const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));

const voc = new Set(String(kb.voc || '').split('|').map((w) => KR.norm(w)).filter(Boolean));
const guessTier = (src) => /^(?:wordnet|corpus-last|corpus:[a-z]|vocab|assoc)/.test(src || '');
// v146 send gate: a WordNet/compound result is a *type* of the head word, legal
// only when the clue asks for a type.
const TYPEQ = /\b(?:type|types|kind|kinds|sort|sorts|breed|breeds|species|variety|varieties|class of|category of)\b/;
const taxonomy = (src) => /^(?:wordnet:|compound:)/.test(src || '');

// Real prompts from the corpus, plus the ones that came up in games.
const prompts = ['Name something you keep in a garage', 'Name a fruit', 'Name something you find in a kitchen',
  'Name an NBA player', 'Name a country that borders Brazil', 'Name a breakfast cereal',
  'Name a dog breed', 'Name a thing you would find in a pirate ship', 'Name a smell that you love',
  'Name a reason to be late', 'Name a thing you do in the shower', 'Name a candy bar',
  'Name a colour of the rainbow', 'Name a card game', 'Name a pizza topping', 'Name a board game',
  'Name a type of cheese', 'Name a TV show from the 90s', 'Name a superhero', 'Name a guitar brand',
  'Name something in a hospital', 'Name a word ending in -tion', 'Name a country starting with Z',
  'Name something used to sweeten coffee', 'Name a classic first date activity'];

let totalPicks = 0;
let junkPicks = 0;
const rows = [];
for (const q of prompts.slice(0, LIMIT)) {
  const trace = [];
  const picks = KR.resolve(q, kb, { trace, win: true }).slice(0, 8);
  const src = {};
  for (const t of trace) if (t && t.a) src[KR.norm(t.a)] = t.src;
  const junk = picks.filter((p) => guessTier(src[KR.norm(p)]) && !voc.has(KR.norm(p)));
  const gated = TYPEQ.test(q.toLowerCase()) ? [] : picks.filter((p) => taxonomy(src[KR.norm(p)]));
  const after = picks.filter((p) => gated.indexOf(p) < 0);
  totalPicks += picks.length;
  junkPicks += junk.length;
  rows.push({ q, picks: picks.slice(0, 5), junk, gated, after });
}

for (const r of rows) {
  console.log(`\n${r.q}`);
  console.log('  picks :', r.picks.join(', ') || '(none)');
  if (r.junk.length) console.log('  JUNK  :', r.junk.join(', '));
  if (r.gated.length) console.log(`  GATED : ${r.gated.join(', ')}  -> now ${r.after.length ? r.after.join(', ') : '(silent, asks the lane)'}`);
}
const emptied = rows.filter((r) => r.gated.length && !r.after.length).length;
console.log(`\npicks=${totalPicks} junk=${junkPicks} (${totalPicks ? ((junkPicks / totalPicks) * 100).toFixed(0) : 0}%) across ${rows.length} categories`);
console.log(`taxonomy picks refused by the v146 gate: ${rows.reduce((n, r) => n + r.gated.length, 0)}; categories left needing a lane: ${emptied}`);
