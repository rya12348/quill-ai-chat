// Second patch pass for scripts/puffer-kb/bot.js (v262).
import fs from 'node:fs';

const FILE = 'scripts/puffer-kb/bot.js';
let src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const edits = [];
const edit = (name, find, replace) => edits.push({ name, find, replace });

// ---- setValue: remember who emptied the box -------------------------------
edit('box-write-tracking',
`    var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));`,
`    // Who emptied the box matters: the room taking the answer clears it, but so
    // do several of our own code paths ('a better list arrived', 'stale answer in
    // the box'). Treating our own clear as delivery declared an answer sent that
    // had never been pressed, and the turn was lost.
    BOT.boxAt = Date.now();
    BOT.boxValue = v;
    if (!v) BOT.boxClearAt = Date.now();
    var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));`);

// ---- ensureSent: delivery must not be our own clear -----------------------
edit('delivery-not-ours',
`    if (!v && BOT.current && ((BOT.sentThisTurn || 0) > 0 || (BOT.pressed || {})[KR.norm(BOT.current)])) {
      BOT.pending = null;`,
`    if (!v && BOT.current && ((BOT.sentThisTurn || 0) > 0 || (BOT.pressed || {})[KR.norm(BOT.current)])) {
      // Our own code emptied the box a moment ago: that is not the room taking
      // the word. Wait for the room's own clear (or for the retype).
      if (Date.now() - (BOT.boxClearAt || 0) < 250) return;
      BOT.pending = null;`);

// ---- lane retry: a word the room already accepted beats a raw model line ---
edit('lane-prefers-learned',
`          var lp = null;
          for (var lpi = 0; lpi < BOT.picks.length; lpi++) {
            var lpw = BOT.picks[lpi];
            if (!lpw || BOT.turnSent[KR.norm(lpw)] || isSpent(lpw)) continue;
            if (/^(llm|live|learned|ai|ask)/.test(String((BOT.src || {})[KR.norm(lpw)] || ''))) { lp = lpw; break; }
          }`,
`          var lp = null;
          // Learned (accepted in this room before) and live lookups first; the raw
          // model line is the last lane choice. qwen called 'Infinity' a Pixar
          // movie while 'Finding Nemo' sat in the learned list.
          for (var lpass = 0; lpass < 2 && !lp; lpass++) {
            for (var lpi = 0; lpi < BOT.picks.length; lpi++) {
              var lpw = BOT.picks[lpi];
              if (!lpw || BOT.turnSent[KR.norm(lpw)] || isSpent(lpw)) continue;
              var lsrc = String((BOT.src || {})[KR.norm(lpw)] || '');
              if (lpass === 0 ? /^(learned|live)/.test(lsrc) : /^(llm|ai|ask)/.test(lsrc)) { lp = lpw; break; }
            }
          }`);

for (const e of edits) {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error('ANCHOR FAIL', e.name, 'matches=' + n); process.exit(1); }
  src = src.replace(e.find, () => e.replace);
}
fs.writeFileSync(FILE, src.replace(/\n/g, '\r\n'));
console.log('patched', edits.length, 'blocks');
