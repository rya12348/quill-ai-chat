// Patch pass 7: one rule for the whole class of wrong answers.
// The pack's generated tiers (corpus-last, assoc, hn/wordnet) resolve in
// microseconds, so a guess was already in the room before the model's list
// arrived: 'Acontia' for a body-part clue, 'Acicula' before it, 'gymkhana' for
// Aladdin. When the pack has no strong source for a wording, nothing weak is
// sent while a lane is answering - up to the fuse, then a guess still goes out.
import fs from 'node:fs';

const FILE = 'scripts/puffer-kb/bot.js';
let src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const edits = [];
const edit = (name, find, replace) => edits.push({ name, find, replace });

// 1. Record, once per clue, whether the pack actually knows this wording.
edit('strong-pack',
`    for (var ti = 0; ti < tr.length; ti++) BOT.src[KR.norm(tr[ti].a)] = tr[ti].src;`,
`    for (var ti = 0; ti < tr.length; ti++) BOT.src[KR.norm(tr[ti].a)] = tr[ti].src;
    // Does the pack actually know this wording, or is it about to guess? A prompt,
    // entity, corpus-near or learned source is knowledge; corpus-last, assoc and
    // WordNet families are guesses, and a guess must not beat the model.
    BOT.strongPack = false;
    for (var si = 0; si < BOT.picks.length && si < 60; si++) {
      var ss = String(BOT.src[KR.norm(BOT.picks[si])] || '');
      if (/^(prompt|entity|learned|live|corpus-near)/.test(ss)) { BOT.strongPack = true; break; }
    }`);

// 2. The rule itself, next to the send paths.
edit('hold-weak-fn',
`  function forceReadySend(el, btn) {`,
`  // A weak guess does not go out while a lane that read the wording is answering,
  // and never past the fuse: after 5.6s the best guess still goes out, because a
  // weak guess beats a lost life.
  function holdWeak(srcW) {
    if (BOT.strongPack) return false;
    if (!(BOT.llmPending || BOT.llmGot || BOT.askPending)) return false;
    if (Date.now() - (BOT.catAt || 0) > 5600) return false;
    return !/^(llm|live|learned|ai|ask|prompt|entity)/.test(String(srcW || ''));
  }

  function forceReadySend(el, btn) {`);

// 3. Force path.
edit('hold-weak-force',
`    var fsrc = String((BOT.src || {})[KR.norm(v)] || '');`,
`    if (holdWeak((BOT.src || {})[KR.norm(v)])) {
      if (!BOT.holdWeakAt || Date.now() - BOT.holdWeakAt > 1200) {
        BOT.holdWeakAt = Date.now();
        log({ holdWeak: v, src: (BOT.src || {})[KR.norm(v)] || '' });
      }
      return;
    }
    var fsrc = String((BOT.src || {})[KR.norm(v)] || '');`);

// 4. Ladder path: the hole that let 'Acontia' through.
edit('hold-weak-ladder',
`    var kp = KR.norm(v);
    var firstPress = !BOT.pressed[kp];`,
`    var kp = KR.norm(v);
    if (holdWeak((BOT.src || {})[kp])) return;
    var firstPress = !BOT.pressed[kp];`);

// 5. Main send path.
edit('hold-weak-main',
`        BOT.pressed = BOT.pressed || {};
        if (BOT.pressed[KR.norm(submit)]) {`,
`        if (holdWeak((BOT.src || {})[KR.norm(submit)])) {
          if (!BOT.holdWeakAt || Date.now() - BOT.holdWeakAt > 1200) {
            BOT.holdWeakAt = Date.now();
            log({ holdWeak: submit, src: (BOT.src || {})[KR.norm(submit)] || '' });
          }
          return;
        }
        BOT.pressed = BOT.pressed || {};
        if (BOT.pressed[KR.norm(submit)]) {`);

for (const e of edits) {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error('ANCHOR FAIL', e.name, 'matches=' + n); process.exit(1); }
  src = src.replace(e.find, () => e.replace);
}
fs.writeFileSync(FILE, src.replace(/\n/g, '\r\n'));
console.log('patched', edits.length, 'blocks');
