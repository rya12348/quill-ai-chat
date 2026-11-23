// Patch pass 4: stop the refused-word repeat seen live in room DGLM.
//   forceSend never recorded turnSent/gameSent, so after the room refused that
//   word, laneRetry handed the very same word back and it was sent again.
import fs from 'node:fs';

const FILE = 'scripts/puffer-kb/bot.js';
let src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const edits = [];
const edit = (name, find, replace) => edits.push({ name, find, replace });

// A force-send is a submission for this turn AND for this game.
edit('force-mark',
`    BOT.pressed[fKey] = Date.now();
      // A first press is a real submission and spends the turn's one-word budget.
      BOT.sentThisTurn = (BOT.sentThisTurn || 0) + 1;`,
`    BOT.pressed[fKey] = Date.now();
      // A first press is a real submission and spends the turn's one-word budget.
      BOT.sentThisTurn = (BOT.sentThisTurn || 0) + 1;
      // Record it as a submission for this turn and this game too. Without this
      // the force path left the word out of turnSent/gameSent, so after the room
      // refused it the lane offered that same word again and it went back in.
      BOT.turnSent[fKey] = 1;
      (BOT.gameSent = BOT.gameSent || {})[fKey] = 1;
      markTried(BOT.cat, v);`);

// laneRetry must never re-offer anything this room already saw or refused.
edit('lane-skip',
`          for (var lpass = 0; lpass < 2 && !lp; lpass++) {
            for (var lpi = 0; lpi < BOT.picks.length; lpi++) {
              var lpw = BOT.picks[lpi];
              if (!lpw || BOT.turnSent[KR.norm(lpw)] || isSpent(lpw)) continue;
              var lsrc = String((BOT.src || {})[KR.norm(lpw)] || '');`,
`          for (var lpass = 0; lpass < 2 && !lp; lpass++) {
            for (var lpi = 0; lpi < BOT.picks.length; lpi++) {
              var lpw = BOT.picks[lpi];
              if (!lpw || BOT.turnSent[KR.norm(lpw)] || isSpent(lpw)) continue;
              // 'gymkhana' was refused for an Aladdin clue and then offered again
              // by this very loop, because a force-sent word was never marked as
              // tried. Anything this room has already seen is out.
              if ((BOT.gameSent || {})[KR.norm(lpw)]) continue;
              if ((BOT.badAll || {})[KR.norm(lpw)]) continue;
              if (wasTried(BOT.cat || '', lpw)) continue;
              if (feedHas(lpw)) continue;
              var lsrc = String((BOT.src || {})[KR.norm(lpw)] || '');`);

// A 'say' issued while it is not our turn has no answer box to press. Queue it
// and fire the moment the box appears, instead of reporting 'no box'.
edit('say-queue',
`        if (!el) { r.said = 'no box'; return r; }`,
`        if (!el) { BOT.cmdPending = r.w; r.said = 'queued until turn'; return r; }`);

edit('say-flush',
`  function applyCmd(c) {`,
`  function flushCmd() {
    if (!BOT.cmdPending) return;
    var el = input();
    if (!el) return;
    var w = BOT.cmdPending;
    BOT.cmdPending = '';
    var r = applyCmd({ do: 'say', w: w });
    log({ cmdQueued: w, said: r && r.said });
  }

  function applyCmd(c) {`);

edit('say-flush-call',
`      try { postLive(); } catch (e) { /* never break the tick */ }`,
`      try { postLive(); } catch (e) { /* never break the tick */ }
      try { flushCmd(); } catch (e) { /* never break the tick */ }`);

for (const e of edits) {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error('ANCHOR FAIL', e.name, 'matches=' + n); process.exit(1); }
  src = src.replace(e.find, () => e.replace);
}
fs.writeFileSync(FILE, src.replace(/\n/g, '\r\n'));
console.log('patched', edits.length, 'blocks');
