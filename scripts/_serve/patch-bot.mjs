// One-shot patcher for scripts/puffer-kb/bot.js (v261).
// Applies exact-anchor replacements; asserts every anchor matched exactly once.
import fs from 'node:fs';

const FILE = 'scripts/puffer-kb/bot.js';
let src = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const edits = [];

function edit(name, find, replace) { edits.push({ name, find, replace }); }

// ---- 1. feedHas helper -----------------------------------------------------
edit('feedHas',
`  function heardWord(w) {`,
`  // Is this word visibly in the room's feed (the answer log), not just in a text
  // field? Used to stop re-pressing an answer the room already took.
  function feedHas(w) {
    var s = String(w || '').trim(), k = KR.norm(s);
    if (!k || k.length < 3) return false;
    var q = k.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&');
    try { return new RegExp('(?:^|[^a-z0-9])' + q + '(?:[^a-z0-9]|$)', 'i').test(feedText()); }
    catch (e) { return false; }
  }

  function heardWord(w) {`);

// ---- 2. defaults -----------------------------------------------------------
edit('defaults',
`    turnSent: {}, sentThisTurn: 0, genUsed: false, cool: 0, turnStart: 0, logs: 0`,
`    turnSent: {}, sentThisTurn: 0, genUsed: false, cool: 0, turnStart: 0, logs: 0,
    pressed: {}, pressN: {}, pressNextAt: {}`);

// ---- 3. begin(): retry counters are per clue -------------------------------
edit('begin-reset',
`    if (!sameClue) BOT.pressed = {};`,
`    if (!sameClue) { BOT.pressed = {}; BOT.pressN = {}; BOT.pressNextAt = {}; }`);

// ---- 4. forceSend(): retry the same word instead of one press and silence --
edit('forceSend-ladder',
`    // The turn budget applies here too. Without this line the force path sent the
    // box again on every tick the typing branch refilled it, so one turn put five
    // guesses into a board that accepts one and spent the rest.
    if ((BOT.sentThisTurn || 0) > (BOT.catBad ? 1 : 0)) return;
    if (BOT.lastSubmitAnswer !== v && Date.now() - (BOT.lastSubmitAt || 0) < 2500) return;
    // One press per word per turn, full stop. Every other guard was a heuristic
    // about timing; this one cannot be raced, and it is what stops the same
    // answer entering the room twice.
    BOT.pressed = BOT.pressed || {};
    if (BOT.pressed[KR.norm(v)]) return;
    var wait = SEND_DELAYS[Math.min(BOT.readyTries, SEND_DELAYS.length - 1)];
    if (BOT.readyAt && Date.now() - BOT.readyAt < wait) return;
    if (BOT.readyTries >= SEND_DELAYS.length) {
      if (!BOT.readyGaveUp) { BOT.readyGaveUp = v; log({ forceSendFailed: v }); }
      return;
    }
    BOT.readyTries++;
    BOT.readyAt = Date.now();
    BOT.pressed[KR.norm(v)] = Date.now();
    BOT.readyGaveUp = '';
    BOT.lastSubmitAnswer = v;
    BOT.lastSubmitAt = Date.now();
    // A force-send is a real submission, so it spends the turn's budget. Without
    // this the budget was only counted on the other path, and this one fired a
    // fresh answer every tick.
    BOT.sentThisTurn = (BOT.sentThisTurn || 0) + 1;`,
`    // The turn budget is about *different* words: one guess, plus one more after
    // a refusal. It is no longer a limit on pressing the word already in the box -
    // that limit is exactly what left a ready answer unsent when the room
    // swallowed the first click ("it types it and never presses enter").
    var fKey = KR.norm(v);
    BOT.pressed = BOT.pressed || {};
    BOT.pressN = BOT.pressN || {};
    BOT.pressNextAt = BOT.pressNextAt || {};
    var fFirst = !BOT.pressed[fKey];
    if (fFirst) {
      if ((BOT.sentThisTurn || 0) > (BOT.catBad ? 1 : 0)) return;
      if (BOT.lastSubmitAnswer !== v && Date.now() - (BOT.lastSubmitAt || 0) < 2500) return;
      var wait = SEND_DELAYS[Math.min(BOT.readyTries, SEND_DELAYS.length - 1)];
      if (BOT.readyAt && Date.now() - BOT.readyAt < wait) return;
      if (BOT.readyTries >= SEND_DELAYS.length) {
        if (!BOT.readyGaveUp) { BOT.readyGaveUp = v; log({ forceSendFailed: v }); }
        return;
      }
      BOT.readyTries++;
      BOT.pressed[fKey] = Date.now();
      // A first press is a real submission and spends the turn's one-word budget.
      BOT.sentThisTurn = (BOT.sentThisTurn || 0) + 1;
    } else {
      // The same word is still in the box. Press it again, spaced out, until the
      // room clearly has it - a cleared box (deliveredFor) or the word in the
      // feed - and never longer than a few seconds into the turn.
      if (BOT.deliveredFor && KR.norm(BOT.deliveredFor) === fKey) return;
      if (feedHas(v)) return;
      if ((BOT.pressN[fKey] || 0) >= 5) return;
      if (Date.now() < (BOT.pressNextAt[fKey] || 0)) return;
      if (Date.now() - (BOT.pressed[fKey] || 0) > 6000) return;
    }
    BOT.pressN[fKey] = (BOT.pressN[fKey] || 0) + 1;
    BOT.pressNextAt[fKey] = Date.now() + 450 + 350 * BOT.pressN[fKey];
    BOT.readyAt = Date.now();
    BOT.readyGaveUp = '';
    BOT.lastSubmitAnswer = v;
    BOT.lastSubmitAt = Date.now();`);

// ---- 5. ensureSent(): the budget return killed delivery detection ----------
edit('ensureSent-head',
`    // Retries belong to the same single submission. Once this turn has put its one
    // guess in, pressing again only duplicates it - the room took the first.
    if ((BOT.sentThisTurn || 0) > (BOT.catBad ? 1 : 0)) return;
    var v = String(el.value || '').trim();`,
`    // No turn-budget return here on purpose. It used to sit above the delivery
    // branch, so after the first press this function returned before it could see
    // the room clear the box: delivery was never recorded, the word was treated as
    // unsent and re-typed into the room (the repeat the player saw). The budget is
    // applied at the press itself, where it belongs.
    var v = String(el.value || '').trim();`);

// ---- 6. ensureSent(): bounded presses of the same word ---------------------
edit('ensureSent-ladder',
`    if (Date.now() - p.at < 320) return;
    if (p.tries >= 6) {
      if (!p.gaveUp) {
        p.gaveUp = true;
        log({ sendFailed: v, btn: !!btn, dis: !!(btn && btn.disabled) });
        // The room will not take this word, so it must stop owning the box: this is
        // what re-typed 'Brunei' sixty times while USA, Bermuda and Senegal were
        // arriving from the model in the same turn.
        BOT.failedWord = v;
        if (KR.norm(BOT.answerInHand) === KR.norm(v)) { BOT.answerInHand = ''; BOT.retypes = 0; }
        try { setValue(el, ''); } catch (e) {}
      }
      return;
    }
    // A press from this ladder IS a submission and has to be recorded as one.
    // Without this bookkeeping the bot had no idea anything had been sent: it
    // refilled the box after the room had taken the word and pressed it again
    // (the duplicate answer), and neither the accepted nor the 'no echo' branch
    // ever ran for ladder-only turns - so it never learned and never moved on.
    BOT.pressed = BOT.pressed || {};
    if (BOT.pressed[KR.norm(v)]) return;
    BOT.pressed[KR.norm(v)] = Date.now();
    p.tries++;
    p.done = 1;
    BOT.sentThisTurn = (BOT.sentThisTurn || 0) + 1;
    BOT.sent = (BOT.sent || 0) + 1;
    BOT.sentAt = Date.now();
    BOT.current = v;
    BOT.lastSubmitAnswer = v;
    BOT.lastSubmitAt = Date.now();
    BOT.lastSubmitted = { a: v, at: Date.now(), len: pageText().length };
    BOT.turnSent[KR.norm(v)] = 1;
    (BOT.gameSent = BOT.gameSent || {})[KR.norm(v)] = 1;
    markSpent(v);
    markTried(BOT.cat, v);
    BOT.resendN = 0;
    var srcL = (BOT.src || {})[KR.norm(v)] || '';
    if (btn && !btn.disabled) {
      try { btn.click(); } catch (e) { /* detached */ }
      log({ sent: v, src: srcL, via: 'ladder' });
      return;
    }
    pressEnter(el);
    log({ sent: v, src: srcL, via: 'ladder-enter' });`,
`    if (Date.now() - p.at < 320) return;
    if (p.tries >= 6) {
      if (!p.gaveUp) {
        p.gaveUp = true;
        log({ sendFailed: v, btn: !!btn, dis: !!(btn && btn.disabled) });
        // The room will not take this word, so it must stop owning the box: this is
        // what re-typed 'Brunei' sixty times while USA, Bermuda and Senegal were
        // arriving from the model in the same turn.
        BOT.failedWord = v;
        if (KR.norm(BOT.answerInHand) === KR.norm(v)) { BOT.answerInHand = ''; BOT.retypes = 0; }
        try { setValue(el, ''); } catch (e) {}
      }
      return;
    }
    BOT.pressed = BOT.pressed || {};
    BOT.pressN = BOT.pressN || {};
    BOT.pressNextAt = BOT.pressNextAt || {};
    var kp = KR.norm(v);
    var firstPress = !BOT.pressed[kp];
    if (!firstPress) {
      // The room already has this word: a cleared box (deliveredFor) or the word
      // in its feed is the proof, and pressing again is the duplicate answer.
      if (BOT.deliveredFor && KR.norm(BOT.deliveredFor) === kp) return;
      if (feedHas(v)) return;
      if ((BOT.pressN[kp] || 0) >= 5) return;
      if (Date.now() < (BOT.pressNextAt[kp] || 0)) return;
      if (Date.now() - (BOT.pressed[kp] || 0) > 6000) return;
    } else {
      // A press from this ladder IS a submission and has to be recorded as one.
      // Without this bookkeeping the bot had no idea anything had been sent: it
      // refilled the box after the room had taken the word and pressed it again
      // (the duplicate answer), and neither the accepted nor the 'no echo' branch
      // ever ran for ladder-only turns - so it never learned and never moved on.
      if ((BOT.sentThisTurn || 0) > (BOT.catBad ? 1 : 0)) return;
      BOT.pressed[kp] = Date.now();
      BOT.sentThisTurn = (BOT.sentThisTurn || 0) + 1;
      BOT.sent = (BOT.sent || 0) + 1;
      BOT.turnSent[kp] = 1;
      (BOT.gameSent = BOT.gameSent || {})[kp] = 1;
      markSpent(v);
      markTried(BOT.cat, v);
    }
    BOT.pressN[kp] = (BOT.pressN[kp] || 0) + 1;
    BOT.pressNextAt[kp] = Date.now() + 450 + 350 * BOT.pressN[kp];
    p.tries++;
    p.at = Date.now();
    p.done = 1;
    BOT.sentAt = Date.now();
    BOT.current = v;
    BOT.lastSubmitAnswer = v;
    BOT.lastSubmitAt = Date.now();
    if (firstPress) BOT.lastSubmitted = { a: v, at: Date.now(), len: pageText().length };
    BOT.resendN = 0;
    var srcL = (BOT.src || {})[KR.norm(v)] || '';
    if (btn && !btn.disabled) {
      try { btn.click(); } catch (e) { /* detached */ }
      log({ sent: v, src: srcL, via: firstPress ? 'ladder' : 'ladder-retry' });
      return;
    }
    pressEnter(el);
    log({ sent: v, src: srcL, via: firstPress ? 'ladder-enter' : 'enter-retry' });`);

// ---- 7. refill: delivery before the drop rules -----------------------------
edit('taken-before-drop',
`        if (BOT.answerInHand &&
            (isSpent(BOT.answerInHand) || heardWord(BOT.answerInHand) ||
             (BOT.gameSent || {})[KR.norm(BOT.answerInHand)] ||
             (BOT.failedWord && KR.norm(BOT.answerInHand) === KR.norm(BOT.failedWord)) ||
             junkFinal(BOT.answerInHand) || !tiedToSubject(BOT.answerInHand))) {
          log({ handDropped: BOT.answerInHand });
          BOT.answerInHand = '';
          BOT.retypes = 0;
          BOT.needLane = true;
        }
        // Already submitted this turn and the box is empty again: the room took
        // the word. Do not refill it - that refill was the duplicate press.
        if (BOT.answerInHand && (BOT.sentThisTurn || 0) > 0 &&
            BOT.lastSubmitted && KR.norm(BOT.lastSubmitted.a) === KR.norm(BOT.answerInHand)) {
          log({ taken: BOT.answerInHand });
          BOT.answerInHand = '';
          BOT.retypes = 0;
          BOT.lastSubmitted = null;
          return;
        }`,
`        // Already submitted and the box is empty again: the room took the word.
        // This check has to run BEFORE the drop rules - 'already sent this game'
        // is true for the word that is in flight, so dropping it and then re-typing
        // it is exactly how 'wheelbarrow' went into the room twice.
        if (BOT.answerInHand && BOT.lastSubmitted &&
            KR.norm(BOT.lastSubmitted.a) === KR.norm(BOT.answerInHand) &&
            ((BOT.sentThisTurn || 0) > 0 || (BOT.pressed || {})[KR.norm(BOT.answerInHand)] ||
             KR.norm(BOT.deliveredFor || '') === KR.norm(BOT.answerInHand))) {
          log({ taken: BOT.answerInHand });
          BOT.answerInHand = '';
          BOT.retypes = 0;
          BOT.lastSubmitted = null;
          return;
        }
        if (BOT.answerInHand &&
            (isSpent(BOT.answerInHand) || heardWord(BOT.answerInHand) ||
             (BOT.gameSent || {})[KR.norm(BOT.answerInHand)] ||
             (BOT.failedWord && KR.norm(BOT.answerInHand) === KR.norm(BOT.failedWord)) ||
             junkFinal(BOT.answerInHand) || !tiedToSubject(BOT.answerInHand))) {
          log({ handDropped: BOT.answerInHand });
          BOT.answerInHand = '';
          BOT.retypes = 0;
          BOT.needLane = true;
        }`);

// ---- 8. retype: never re-enter a word the room already has -----------------
edit('retype-gate',
`        var ls = BOT.lastSubmitted;
        if (ls && ls.a && (BOT.resendN || 0) < 2 && Date.now() - ls.at < 4000 &&
            pageText().length <= (ls.len || 0) + 4) {`,
`        var ls = BOT.lastSubmitted;
        // Only while the word is still this turn's live attempt: a word the room
        // took (deliveredFor / in its feed) or one that is already spent must not
        // be typed back in. Re-entering it is the repeat the player hears.
        if (ls && ls.a && (BOT.resendN || 0) < 2 && Date.now() - ls.at < 4000 &&
            !isSpent(ls.a) && !feedHas(ls.a) &&
            KR.norm(BOT.deliveredFor || '') !== KR.norm(ls.a) &&
            pageText().length <= (ls.len || 0) + 4) {`);

// ---- 9. no blind Enter 420ms after every send ------------------------------
edit('no-blind-enter',
`        // Verify it afterwards instead of assuming it: if the room took a
        // shortened copy, the box still holds a fragment of what we typed, and
        // the word never appears in the feed.
        (function (w) {
          setTimeout(function () {
            var e2 = input();
            var v2 = e2 ? String(e2.value || '') : '';
            if (v2 && v2 !== w && (w.indexOf(v2) === 0 || v2.indexOf(w) === 0)) log({ truncated: w, box: v2 });
            else if (pageText().indexOf(w) < 0) {
              log({ unconfirmed: w });
              // The click did not take. Press Enter once for this answer rather
              // than leaving it typed: an unsent answer is a lost turn either way.
              BOT.enterRetry = BOT.enterRetry || {};
              if (!BOT.enterRetry[KR.norm(w)]) {
                BOT.enterRetry[KR.norm(w)] = 1;
                var e3 = input();
                if (e3 && String(e3.value || '').trim()) { pressEnter(e3); log({ enterRetry: w }); }
              }
            }
          }, 420);
        })(submit);`,
`        // Verify it afterwards instead of assuming it: if the room took a
        // shortened copy, the box still holds a fragment of what we typed.
        // No blind Enter here any more: pressing 420ms after every send duplicated
        // the answers whose echo the room had not rendered yet. ensureSent retries
        // the word only while the box still holds it, and stops as soon as the room
        // shows it.
        (function (w) {
          setTimeout(function () {
            var e2 = input();
            var v2 = e2 ? String(e2.value || '') : '';
            if (v2 && v2 !== w && (w.indexOf(v2) === 0 || v2.indexOf(w) === 0)) log({ truncated: w, box: v2 });
          }, 420);
        })(submit);`);

for (const e of edits) {
  const n = src.split(e.find).length - 1;
  if (n !== 1) { console.error('ANCHOR FAIL', e.name, 'matches=' + n); process.exit(1); }
  src = src.replace(e.find, () => e.replace);
}
fs.writeFileSync(FILE, src.replace(/\n/g, '\r\n'));
console.log('patched', edits.length, 'blocks');
