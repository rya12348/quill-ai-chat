/*
 * Where did that answer come from?
 *
 * Runs the shipped resolver over the categories that actually went wrong in a
 * live round and prints each candidate with its source, so a wrong answer names
 * the lookup that produced it instead of being a mystery.
 *
 * Usage: node scripts/puffer-kb/trace.mjs ["a category"]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KR = new Function(fs.readFileSync(path.join(HERE, 'resolver.js'), 'utf8') + '\nreturn KR;')();
const kb = JSON.parse(fs.readFileSync(path.join(HERE, 'kb.json'), 'utf8'));

const labels = process.argv.slice(2).length ? process.argv.slice(2) : [
  'Name a word that means small',
  'Name an NBA MVP winner',
  'Name an animal that lives in swamps or wetlands',
  'Name a Frank Ocean song',
  'Name an English word containing “dge”',
  'Name a compound word starting with “sun”',
  'Name a deli or cured meat',
  'Name a writing instrument',
  'Name a Nintendo console',
  "Name a McDonald's menu item"
];

for (const label of labels) {
  const tr = [];
  const out = KR.resolve(label, kb, { trace: tr });
  console.log('\n=== ' + label);
  console.log('  base: ' + KR.baseKey(label) + '   keys: ' + KR.keysFor(label).slice(0, 5).join(' / '));
  console.log('  constraints: ' + JSON.stringify(KR.constraints(label)));
  for (let i = 0; i < Math.min(out.length, 10); i++) {
    console.log('  ' + String(i + 1).padStart(2) + '. ' + out[i].padEnd(26) + ' <- ' + tr[i].src);
  }
  if (!out.length) console.log('  (nothing)');
}
