/*
 * In-page half of the Puffer Party bot.
 *
 * The resolver above decides *what* to answer from the frozen knowledge pack;
 * this part is only timing and DOM: watch for the puffer, pre-type the answer in
 * the same frame the category appears, send the instant the button enables, and
 * rotate through the candidate list when the room says "no echo".
 *
 * It also learns. Every accepted answer and every rejection is kept in
 * localStorage per category, so a category only ever needs to be worked out
 * once - no hand-written rule, no redeploy of the knowledge pack.
 *
 * Boot: push the base64 chunks into window.__KRP, then call __krLoad().
 */
(function () {
  'use strict';

  var LS = 'krill.party.v3';
  // Default is win mode. A round is won by landing the most accepted answers and
  // surviving the fuse; a rarer answer only ever buys an extra life, it is not
  // how the round is won. So the commonest answer the room is likely to take
  // goes first and the rare lists are just extra supply behind it.
  // Set window.__krRare = true (plus __krMinRank) for the rare-only game.
  var RARE = window.__krRare === true;
  // 3 = Deep cut and deeper only, 4 = One in a Krillion only, 2 = Rare and up,
  // 0 = win mode (no rarity floor at all).
  var MINRANK = typeof window.__krMinRank === 'number' ? window.__krMinRank : 0;
  var KB = null;
  // Re-injecting the bot leaves the previous copy's interval and observer alive,
  // and several copies clicking at once floods the room. Only the newest copy
  // may act; the rest go inert the moment a new one loads.
  var ID = Date.now() + '-' + Math.random().toString(36).slice(2);
  window.__krOwner = ID;
  (window.__krObs || []).forEach(function (o) { try { o.disconnect(); } catch (e) {} });
  (window.__krTimers || []).forEach(function (t) { clearInterval(t); });
  (window.__krWorkers || []).forEach(function (w) { try { w.terminate(); } catch (e) {} });
  window.__krObs = [];
  window.__krTimers = [];
  window.__krWorkers = [];
  var BOT = {
    on: false, cat: '', lastKey: '', picks: [], idx: 0, current: '',
    sentAt: 0, sent: 0, rejected: 0, out: false, clickedAt: 0,
    turnSent: {}, sentThisTurn: 0, genUsed: false, cool: 0, turnStart: 0, logs: 0,
    pressed: {}, pressN: {}, pressNextAt: {}
  };
  // Fake-room hook: the pick order and the answers already spent are exactly what
  // a "did it re-send a used answer" test has to look at, and neither is visible
  // from the DOM. Read-only.
  try {
    Object.defineProperty(window, '__krState', {
      value: function () {
        return {
          cat: BOT.cat, idx: BOT.idx, unk: !!BOT.unknown, n: BOT.picks.length,
          picks: BOT.picks.slice(0, 24), sent: Object.keys(BOT.gameSent || {})
        };
      }
    });
  } catch (e) {}

  // Paste-able diagnostics, for a live room the harness cannot reproduce:
  // `__krDump()` in the console prints the last events - what was typed, which
  // submit mechanism ran, and whether the box actually emptied.
  try {
    window.__krDump = function () {
      try { return JSON.stringify((window.__kr || []).slice(-60)); } catch (e) { return '[]'; }
    };
  } catch (e) {}

  // The room keeps the last "no echo" line on screen for a while, so the whole
  // page text is not evidence that *this* answer was refused. Only the message
  // naming the answer we just sent counts.
  function refused(text, answer) {
    if (!answer) return false;
    var q = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('["\u201c]' + q + '["\u201d]\\s*:\\s*no echo', 'i').test(text)) return true;
    // Rooms word the refusal differently ("nope", "try another", "not accepted"),
    // and an unrecognised refusal left BOT.current on the refused word, which was
    // then typed straight back into the room. The answer and any complaint in the
    // same tail is enough: it is still our turn, so the word did not land.
    var tail = text.slice(-400);
    if (!new RegExp('(?:^|[^a-z0-9])' + q + '(?:[^a-z0-9]|$)', 'i').test(tail)) return false;
    return /no echo|not a valid|not accepted|try again|try another|doesn't count|does not count|incorrect|nope/i.test(tail);
  }

  function log(entry) {
    var l = (window.__kr = window.__kr || []);
    entry.ms = Date.now();
    try { entry.cat = BOT.cat || ''; } catch (e) { entry.cat = ''; }
    l.push(entry);
    if (l.length > 300) l.shift();
  }

  // Every finished category is posted to the pack server, which appends one JSON
  // line to .k3/gamelog.jsonl. That file is the record of what actually happened
  // in a round: the words sent, what the room refused, which lane answered, where
  // the bot went quiet. Logging never blocks or breaks play.
  var GAMELOG_URL = (window.__krPack || 'http://127.0.0.1:5201') + '/gamelog';
  const LIVE_URL = (window.__krPack || 'http://127.0.0.1:5201') + '/live';
  function postGameLog(cat) {
    if (!window.fetch || window.__krLog === false || !cat) return;
    var ev = [];
    var t0 = 0;
    try {
      var all = (window.__kr || []).filter(function (e) { return e && e.cat === cat; });
      t0 = (all[0] && all[0].ms) || Date.now();
      ev = all.slice(-150)
        .map(function (e) {
          var o = {};
          for (var k in e) { if (k !== 'ms' && k !== 'cat') o[k] = e[k]; }
          o.t = Math.round(((e.ms || 0) - t0) / 100) / 10;
          return o;
        });
    } catch (e) { ev = []; }
    if (!ev.length) return;
    var sent = 0, refused = 0, accepted = 0;
    for (var i = 0; i < ev.length; i++) {
      if (ev[i].sent || ev[i].forceSend) sent++;
      if (ev[i].catBad || ev[i].bad) refused++;
      if (ev[i].ok) accepted++;
    }
    ev.push({ summary: { sent: sent, refused: refused, accepted: accepted } });
    try {
      fetch(GAMELOG_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cat: cat, ver: (window.pufferBot || {}).version || '',
          name: BOT.name || '', events: ev,
          // Same wording posted twice is the same round: the server audits it once
          // instead of spending a model generation per re-post.
          rid: ID + '#' + cat + '#' + ev.length + '#' + ((ev[0] && ev[0].t) || 0)
        })
      });
    } catch (e) { /* logging must never break a game */ }
  }
  window.__krLogNow = function () { postGameLog(BOT.logCat || BOT.cat); };

  // Live heartbeat: one small POST a second so the room can be watched turn by
  // turn (clue, box, presses, verdicts, why it held) on http://127.0.0.1:5201/watch.
  // Watching used to mean guessing from a log written after the round ended.
  function postLive() {
    if (!window.fetch || window.__krLive === false) return;
    var now = Date.now();
    if (now - (BOT.liveAt || 0) < 700) return;
    BOT.liveAt = now;
    var el = input();
    var evs = (window.__kr || []).slice(-22);
    try {
      var done = BOT.cmdDone || [];
      BOT.cmdDone = [];
      fetch(LIVE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          results: done,
          ver: (window.pufferBot || {}).version || '', name: BOT.name || '',
          cat: BOT.cat || '', box: el ? String(el.value || '') : '',
          up: BOT.canType === false ? 0 : 1,
          sent: BOT.sentThisTurn || 0, bad: BOT.catBad || 0,
          page: String((document.body.innerText || '')).slice(-300).replace(/\s+/g, ' '),
          events: evs.map(function (e) {
            var o = {};
            for (var k in e) { if (k !== 'cat') o[k] = e[k]; }
            return o;
          })
        })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.cmds || !j.cmds.length) return;
          BOT.cmdDone = (BOT.cmdDone || []).concat(j.cmds.map(applyCmd));
        })
        .catch(function () {});
    } catch (e) { /* watching must never break play */ }
  }
  window.__krLiveNow = function () { BOT.liveAt = 0; postLive(); };

  // Remote control, executed in the room itself. 'say' presses the word now,
  // 'pause'/'resume' stop and restart submissions, 'hold' clears the hand.
  // Whatever happens is reported back on the next heartbeat, so a command from
  // outside can be confirmed instead of assumed.
  function flushCmd() {
    if (!BOT.cmdPending) return;
    var el = input();
    if (!el) return;
    var w = BOT.cmdPending;
    BOT.cmdPending = '';
    var r = applyCmd({ do: 'say', w: w });
    log({ cmdQueued: w, said: r && r.said });
  }

  function applyCmd(c) {
    var r = { do: '', w: '', said: '' };
    try {
      r.do = String(c && c.do || '');
      r.w = String(c && c.w || '');
      if (r.do === 'pause') { window.__krPaused = true; r.said = 'paused'; return r; }
      if (r.do === 'resume') { window.__krPaused = false; r.said = 'resumed'; return r; }
      if (r.do === 'hold') {
        BOT.answerInHand = ''; BOT.current = ''; BOT.lastSubmitted = null;
        var eh = input(); if (eh) setValue(eh, '');
        r.said = 'held'; return r;
      }
      if (r.do === 'say' && r.w) {
        var el = input();
        if (!el) { BOT.cmdPending = r.w; r.said = 'queued until turn'; return r; }
        // A forced word bypasses the turn's own bookkeeping: the point of the
        // command is to submit exactly this, now.
        BOT.pressed = {}; BOT.pressN = {}; BOT.pressNextAt = {};
        BOT.sentThisTurn = 0; BOT.catBad = 0; BOT.lastSubmitted = null;
        BOT.answerInHand = r.w; BOT.current = r.w; BOT.armedAt = 0;
        setValue(el, r.w);
        var b = sendBtn();
        if (b && !b.disabled) { try { b.click(); } catch (e) {} r.said = 'clicked ' + r.w; return r; }
        pressEnter(el);
        r.said = 'entered ' + r.w;
        return r;
      }
      r.said = 'unknown ' + r.do;
    } catch (e) { r.said = 'err ' + String(e && e.message || e); }
    return r;
  }

  function loadLrn() {
    try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; }
  }
  function saveLrn(d) {
    try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }

  // Answers already sent for this game's category, persisted so a room reload
  // does not resurrect them. turnSent and gameSent live in memory, and the room
  // reloads on every join - which is exactly when a used answer came back and got
  // typed a second time. Rejections also land in the durable bad list, so an
  // answer the room refused is out for good; this map covers everything else that
  // was spent this game. Cleared when a new game starts.
  var TRIED = 'krill.tried.v1';
  var GID = 'krill.game.v1';
  function newGame() {
    try { localStorage.setItem(GID, String(Date.now())); localStorage.removeItem(TRIED); } catch (e) { /* private mode */ }
  }
  function triedMap() {
    try { return JSON.parse(localStorage.getItem(TRIED) || '{}'); } catch (e) { return {}; }
  }
  function markTried(cat, answer) {
    var k = learnKey(cat), n = KR.norm(answer);
    if (!k || !n) return;
    var m = triedMap(), e = m[k] || (m[k] = {});
    if (e[n]) return;
    e[n] = Date.now();
    try { localStorage.setItem(TRIED, JSON.stringify(m)); } catch (err) { /* private mode */ }
  }
  // Three hours, not forever: an answer spent in one game must not be locked out
  // of the next one, but it must survive the reloads inside this one.
  var TRIED_TTL = 3 * 60 * 60 * 1000;
  function wasTried(cat, answer) {
    var k = learnKey(cat), n = KR.norm(answer);
    if (!k || !n) return false;
    var t = (triedMap()[k] || {})[n];
    return !!t && Date.now() - t < TRIED_TTL;
  }
  // Learn by the category's head-noun key, not its literal wording: the room
  // appends a fuse count and rephrases the same category between rounds.
  function learnKey(cat) {
    // The whole wording, matching the server's own key. keysFor()[0] strips the
    // qualifier, so "Name a type of cheese" and "Name a type of cheese starting
    // with b" shared one local key: the bad list of one category silenced answers
    // in the other.
    return (KR.norm(cat) || '').trim();
  }

  function learn(kind, cat, answer) {
    if (!cat || !answer) return;
    // Only learn words that could actually be sent. The harness accepted anything,
    // and "1649th level" was stored as a verified Pixar answer.
    if (kind === 'ok' && (junkFinal(answer) || !answerable(answer, true))) return;
    var d = loadLrn();
    var key = learnKey(cat);
    var e = d[key] || (d[key] = { ok: [], bad: [] });
    var list = e[kind] || (e[kind] = []);
    if (list.indexOf(answer) < 0) list.push(answer);
    saveLrn(d);
    if (KB) KB.lrn = d;
    feedback(kind, cat, answer);
  }

  // Reading innerText forces a layout pass. Called for every candidate on every
  // 50ms tick it dominated the page's main thread and froze the room; one read
  // per 150ms is still far faster than a human turn and costs ~7 reads a second.
  var PT = { t: 0, v: '' };
  function pageText() {
    var now = Date.now();
    if (PT.t && now - PT.t < 150) return PT.v;
    var raw = '';
    try { raw = (document.body && document.body.innerText) || ''; } catch (e) { raw = ''; }
    if (raw.length > 20000) raw = raw.slice(0, 20000);
    PT.v = raw.replace(/\s+/g, ' ');
    PT.t = now;
    try { window.__krPT = (window.__krPT || 0) + 1; } catch (e) {}
    return PT.v;
  }
  // A new question invalidates the cached text immediately.
  function pageTextFresh() { PT.t = 0; return pageText(); }

  // Everything the room shows except the clue itself. The feed carries the words
  // that have already been played - the opponent's and ours - and repeating one is
  // a wasted turn whether the room says "used" or "wrong".
  function feedText() {
    var t = pageText();
    var p = null;
    var nowP = Date.now();
    if (BOT.pElAt && nowP - BOT.pElAt < 2000 && BOT.pEl && document.contains(BOT.pEl)) p = BOT.pEl;
    if (!p) {
      p = document.querySelector('.prompt, [class*="pf-prompt"], [class*="ds-prompt-text"], [class*="Prompt"]');
      BOT.pEl = p; BOT.pElAt = nowP;
    }
    var pt = p ? String(p.innerText || '').replace(/\s+/g, ' ').trim() : '';
    if (pt && pt.length > 3) t = t.split(pt).join(' ');
    // The room mirrors what is being typed. That text is ours, not something
    // the opponent said: counting it as 'heard' poisoned the whole hand -
    // 'Adenovirus' was typed, appeared on the page, was marked heard, was
    // skipped, and the turn ended with nothing sent.
    try {
      var elF = input();
      var vF = elF && elF.value ? String(elF.value).trim() : '';
      if (vF && vF.length > 2) t = t.split(vF).join(' ');
      var cF = String(BOT.current || '').trim();
      if (cF && cF.length > 2) t = t.split(cF).join(' ');
    } catch (e) { /* no input on this page */ }
    return t;
  }

  // Has this word already been said in the room? Only words the bot itself would
  // consider are ever asked about, so an incidental word in a chat message can
  // only ever cost one candidate, never the turn.
  // Is this word visibly in the room's feed (the answer log), not just in a text
  // field? Used to stop re-pressing an answer the room already took.
  function feedHas(w) {
    var s = String(w || '').trim(), k = KR.norm(s);
    if (!k || k.length < 3) return false;
    var q = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    try { return new RegExp('(?:^|[^a-z0-9])' + q + '(?:[^a-z0-9]|$)', 'i').test(feedText()); }
    catch (e) { return false; }
  }

  function heardWord(w) {
    var s = String(w || '').trim();
    var k = KR.norm(s);
    if (!k || k.length < 3) return false;
    // Our own pick and our own sent answers are never 'heard'.
    if (k === KR.norm(BOT.current || '') || (BOT.turnSent && BOT.turnSent[k])) return false;
    if (BOT.heard && BOT.heard[k]) return true;
    var q = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp('(?:^|[^a-z0-9])' + q + '(?:[^a-z0-9]|$)', 'i').test(feedText())) return false;
    // The page is the authority, and it is scanned fresh each time. Nothing is
    // cached from a scan: a single frame in which our own draft was mirrored
    // made a word permanently 'heard' and unusable, which emptied the whole
    // hand and left the turn unanswered.
    log({ heard: s });
    return true;
  }

  // The room renders two "CATEGORY n" blocks - a header carrying "FLOATING 10/10"
  // and the clue itself - so taking the last one blindly fed the header in as a
  // category, which re-resolved mid-turn and threw away the right picks. Each
  // block is now cut at the diamond before the clue, noise is stripped, and the
  // longest surviving clue wins.
  // Labels nest: the header block reads "CATEGORY 4 New category CATEGORY 4 NEW
  // <clue>", so leading noise is stripped repeatedly until nothing changes.
  var NOISE = /^(?:CATEGORY\s+\d+|CATEGORY|NEW|New category|category|FLOATING\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+)\s*/i;
  function stripNoise(s) {
    s = s.replace(/\s+/g, ' ').trim();
    var prev;
    do { prev = s; s = s.replace(NOISE, '').trim(); } while (s !== prev);
    return s
      .replace(/\bFLOATING\s+\d+\s*\/\s*\d+\b/gi, ' ')
      .replace(/\bSEND\b[\s\S]*$/, ' ')
      .replace(/\s+\d+\+?\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // The chat panel lives inside the same page text as the clue, and a whole chat
  // log ("<clue> CHAT Players ▾ sunixxxx joined ... left") was parsed as the
  // category - which then got learned as a key that could never match a real
  // prompt. A clue ends where the panel begins.
  function cleanClue(s) {
    return String(s || '').replace(/\s*(?:CHAT|Players\s*▾|▸)[\s\S]*$/i, '').trim();
  }

  function category(text) {
    // The clue is its own element. Reading it from the flattened page text works
    // on most layouts, but on some ("CATEGORY 34" beside the clue, counters in
    // between) the parse returned '' and the bot played a whole round with no
    // category at all - that is the silent turn that looked like "it just does
    // not answer". The element is authoritative when it is present.
    var el = document.querySelector('.prompt, [class*="pf-prompt"], [class*="ds-prompt-text"], [class*="Prompt"]');
    if (el) {
      var raw = String(el.innerText || '').replace(/\s+/g, ' ').trim();
      if (raw.length > 3 && raw.length < 160 && /[a-z]/i.test(raw) && !/\bCATEGORY\b/i.test(raw)) return cleanClue(raw);
    }
    var re = /CATEGORY\s+\d+/g, m, best = '';
    while ((m = re.exec(text))) {
      var rest = text.slice(m.index + m[0].length);
      var cut = rest.indexOf('\u25b8');
      if (cut < 0) continue;                       // not a clue block
      var s = stripNoise(rest.slice(0, cut));
      if (s.length > best.length && /[a-z]/i.test(s)) best = s;
    }
    return cleanClue(best).slice(0, 160);
  }

  // The lobby puts two more inputs on the page - the player-name box ("what the
  // ring calls you") and the room-code box ("KRLP") - and both carry the same
  // ds-input class as the answer box. Taking the first ds-input therefore landed
  // on the name box: the bot cleared the name the player had just typed, again on
  // every retry, which makes the game impossible to start. A field that is not
  // the answer box must never be written to or cleared.
  var NOT_ANSWER = /ring calls you|room ?code|your name|say something/i;
  // The room also has a chat box, with its own SEND, inside the chat panel. Typing
  // an answer there posts it to chat and burns the turn, so no element inside a
  // chat panel may be treated as the answer box or clicked as SEND.
  function inChat(el) {
    var n = el;
    for (var d = 0; n && d < 8; d++, n = n.parentElement) {
      // Stop before the page itself: body text contains the chat panel's own
      // labels ("Turn chat off"), which made every box on the page look like chat
      // and left the bot typing nothing at all.
      if (n === document.body || n === document.documentElement) break;
      var sig = (typeof n.className === 'string' ? n.className : '') + ' ' + (n.id || '');
      if (/chat/i.test(sig)) return true;
      var t = n.innerText || '';
      if (t.length < 200 && /turn chat off|^\s*CHAT\b/i.test(t)) return true;
    }
    return false;
  }
  function isAnswerBox(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (NOT_ANSWER.test(String(el.placeholder || ''))) return false;
    if (/^(?:name|code)$/i.test(el.getAttribute ? (el.getAttribute('name') || '') : '')) return false;
    return true;
  }
  // Scored, never "first match": the answer box is labelled "<you> is up...",
  // while the chat box is inside the chat panel and the lobby boxes are the name
  // and room code. If nothing scores, there is no answer box on screen and the
  // bot types nothing at all rather than writing an answer into the chat.
  function input() {
    var all = document.querySelectorAll('input.ds-input, input');
    var best = null, bestScore = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!el.getClientRects().length) continue;
      if (!isAnswerBox(el)) continue;
      var s = 0;
      if (/\bis up\b/i.test(String(el.placeholder || ''))) s += 6;
      if (/(?:^|\s)ds-input(?:\s|$)/.test(String(el.className || ''))) s += 2;
      if (inChat(el)) s -= 8;
      if (s > bestScore) { best = el; bestScore = s; }
    }
    return best;
  }

  function sendBtn() {
    var b = document.querySelector('button.ds-dive-btn');
    if (b && !inChat(b)) return b;
    // The room's send control is not always a <button> with the word SEND in it:
    // it can be a role="button" div, an icon button with an aria-label, or a
    // submit input. Missing it is how a ready answer ends up stranded, so every
    // shape is considered.
    var all = [].slice.call(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'));
    for (var i = 0; i < all.length; i++) {
      var x = all[i];
      if (inChat(x)) continue;
      var label = (x.innerText || x.value || x.getAttribute('aria-label') || x.title || '').replace(/\s+/g, ' ').trim();
      if (!label) continue;
      if (/^(?:send|submit|dive|answer|go|ok)$/i.test(label) || /\b(?:send|submit)\b/i.test(label)) return x;
    }
    return null;
  }

  // Submitting is not "I clicked once". The button can be disabled, a handler can
  // be swapped on re-render, or the page can ignore a synthetic Enter - and any of
  // those leaves a correct answer sitting in the box, which is the worst possible
  // outcome. So the answer counts as sent only when the box is empty: until then
  // every mechanism is tried in turn, a few times.
  // Escalating delays instead of a flat 260ms gate: the first attempt lands
  // while the room's own state is still catching up, the later ones survive a
  // handler that swallows the first press, and the last pair still fires well
  // inside the ~7.7s fuse.
  var SEND_DELAYS = [200, 350, 700, 1200, 2200];

  // The room can clear the box without taking the answer (a controlled input
  // whose state was empty, a handler that returns early). An empty box is then
  // not proof of anything, so the answer is put back and sent again - at most
  // twice - unless the feed shows it.
  // Every word actually entered, with the time it went in. A word may be retried
  // while it is still in flight (a click that did not take), but once it is older
  // than this it can never be typed again in this game - which is the difference
  // between "retry the send" and "re-enter the word the room already refused".
  var SPENT_GRACE = 4000;
  // Durable 'already said', keyed by the category's wording. BOT.spent and
  // BOT.gameSent live in the tab and die with a reload, but the room does not
  // forget: an answer it already took comes back refused, which is exactly what a
  // player sees as "it keeps saying the thing it just said". 25 minutes is longer
  // than any one category stays on screen and short enough that a game played
  // later in the evening starts clean.
  var SAID_KEY = 'krill.said.v1';
  var SAID_TTL = 25 * 60 * 1000;
  function saidCatKey(c) {
    // The room re-captions the same question with small differences, so the key
    // drops the 'Name a ...' wrapper: 'Name a type of dance' and 'Give me a type
    // of dance' are one category, and a repeat across them is still a repeat.
    return KR.norm(c || BOT.cat || '')
      .replace(/^(?:name|give|list|tell|say|think of)\s+(?:me\s+)?(?:a|an|the|some|any)?\s*/, '')
      .replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function loadSaidAll() {
    try { var j = JSON.parse(localStorage.getItem(SAID_KEY) || '{}'); return j && typeof j === 'object' ? j : {}; }
    catch (e) { return {}; }
  }
  function saidMap() {
    var c = saidCatKey();
    if (!c) return {};
    if (BOT.saidCache && BOT.saidCacheFor === c) return BOT.saidCache;
    var all = loadSaidAll(), cell = all[c] || {}, live = {}, now = Date.now(), n = 0;
    for (var k in cell) { if (cell[k] && now - cell[k] < SAID_TTL) { live[k] = cell[k]; n++; } }
    BOT.saidCache = live;
    BOT.saidCacheFor = c;
    return live;
  }
  // Every pick and every send asks this before using a word: a word this category
  // already gave the room is never offered again.
  function saidAlready(w) {
    var k = KR.norm(w);
    if (!k) return false;
    if ((BOT.gameSent || {})[k]) return true;
    return !!saidMap()[k];
  }
  function markSaid(w) {
    var k = KR.norm(w), c = saidCatKey();
    if (!k || !c) return;
    try {
      var all = loadSaidAll(), cell = all[c] || (all[c] = {});
      if (!cell[k]) {
        cell[k] = Date.now();
        var cats = Object.keys(all);
        if (cats.length > 200) delete all[cats[0]];
        localStorage.setItem(SAID_KEY, JSON.stringify(all));
      }
      if (BOT.saidCacheFor === c) BOT.saidCache[k] = cell[k] || Date.now();
    } catch (e) {}
  }
  // Words this clue has already thrown away: refused by the room, pressed into
  // silence, or typed back too often. They are skipped by every picker, so the
  // hand moves forward instead of handing the same word back.
  function dropAnswer(w, why) {
    var k = KR.norm(w);
    if (!k) return;
    (BOT.dropped = BOT.dropped || {})[k] = why || 1;
    if (KR.norm(BOT.answerInHand || '') === k) BOT.answerInHand = '';
    if (KR.norm(BOT.current || '') === k) BOT.current = '';
    BOT.retypes = 0;
    BOT.failedWord = w;
    for (var i = BOT.idx; i < BOT.picks.length; i++) {
      if (KR.norm(BOT.picks[i]) === k) { BOT.idx = i + 1; break; }
    }
  }
  function isDropped(w) { return !!(KR.norm(w) && (BOT.dropped || {})[KR.norm(w)]); }
  // A word this clue has already lost with: the room refused it, or the hand threw
  // it away. The complaint that started this was "it keeps saying the same answer
  // after it is wrong": the refused word was recorded, dropped from the queue -
  // and then the fallback tiers in next() handed it straight back, because they
  // checked neither list. No tier may offer a judged word again.
  function refusedWord(w) {
    var k = KR.norm(w);
    if (!k) return false;
    if ((BOT.badAll || {})[k]) return true;
    if (BOT.failedWord && KR.norm(BOT.failedWord) === k) return true;
    var cat = BOT.cat || '';
    if (BOT.badCatFor !== cat) {
      BOT.badCatFor = cat;
      BOT.badCat = {};
      var lr = loadLrn()[learnKey(cat)] || {};
      for (var i = 0; i < (lr.bad || []).length; i++) {
        var bk = KR.norm(lr.bad[i]);
        if (bk) { BOT.badCat[bk] = 1; BOT.badCat[bk.replace(/(?:es|s)$/, '')] = 1; }
      }
    }
    return !!(BOT.badCat || {})[k];
  }

  function markSpent(v) {
    var k = KR.norm(v);
    if (!k) return;
    markSaid(v);
    BOT.spent = BOT.spent || {};
    if (!BOT.spent[k]) BOT.spent[k] = Date.now();
  }
  function spentAgo(v) {
    var k = KR.norm(v);
    if (!k) return 0;
    var t = (BOT.spent || {})[k] || 0;
    return t ? Date.now() - t : 0;
  }
  function isSpent(v) { return spentAgo(v) > SPENT_GRACE; }
  // Picking, unlike retrying, may never hand back a word this game has entered -
  // not even one entered a moment ago. Without this the queue re-picked the word
  // it had just sent, which is the repeat the room saw.
  function pickedBefore(v) {
    var k = KR.norm(v);
    return !!(k && BOT.spent && BOT.spent[k]);
  }

  // Move the queue past anything already entered, so the next tick types a
  // different word instead of the one the room has already seen.
  function advancePastSpent() {
    if (!pickedBefore(BOT.current)) return BOT.current;
    for (var i = 0; i < 10; i++) {
      var w = next();
      if (!w) return '';
      BOT.current = w;
      if (!pickedBefore(w)) return w;
    }
    return BOT.current;
  }

  function recoverLost(el) {
    var x = BOT.expect;
    if (!x || !el) return;
    if (Date.now() - x.at < 800) return;
    // A refused or already-entered word is not a lost send: it is a finished one.
    if (isSpent(x.a) || (BOT.badAll || {})[KR.norm(x.a)]) { BOT.expect = null; return; }
    // The room reacted (its text grew) - it took the word or refused it. Retyping
    // now would re-enter an answer the room has already judged.
    if (pageText().length > (x.len || 0) + 8) { BOT.expect = null; return; }
    if (pageText().indexOf(x.a) >= 0) { BOT.expect = null; return; }
    if (x.n >= 2) {
      if (!x.done) { x.done = 1; log({ sendLost: x.a }); }
      BOT.expect = null;
      return;
    }
    x.n++;
    x.at = Date.now();
    log({ retype: x.a, try: x.n });
    setValue(el, x.a);
    BOT.readyAnswer = x.a;
    BOT.readyAt = Date.now();
    BOT.readyTries = 0;
  }

  // The guarantee, with no conditions attached: if the answer box holds text,
  // that text goes out. This does not consult the turn state, the holds, the lane
  // timers or BOT.current - every one of those has been the reason a correct
  // answer sat in the box while the fuse burned. It fires a click AND an Enter,
  // then repeats on an escalating schedule until something takes it.
  // A weak guess does not go out while a lane that read the wording is answering,
  // and never past the fuse: after 5.6s the best guess still goes out, because a
  // weak guess beats a lost life.
  // How long ago this exact word was put in the box. BOT.boxAt/boxValue are set
  // by setValue on every write, so this is the age of the text a press would send.
  function typedAgo(w) {
    if (!w || KR.norm(BOT.boxValue || '') !== KR.norm(w)) return 1e9;
    return Date.now() - (BOT.boxAt || 0);
  }

  function holdWeak(srcW) {
    // Per word, not per clue: one strong pick in the hand must not license a weak
    // guess to go out. 'Abomasum' was sent for a body-part clue while the pack
    // also held 'antennae', only because some other pick looked strong.
    if (!(BOT.llmPending || BOT.llmGot || BOT.askPending)) return false;
    // 1.5s: the local model streams its first line in ~0.3-0.8s, so anything past
    // this is not "waiting for a better answer", it is delaying the turn. This hold
    // measured 2.6s before and was the real reason a dead word took 3.4s to drop -
    // the press ladder cannot start until the hold ends.
    if (Date.now() - (BOT.catAt || 0) > 1500) return false;
    // Knowledge: a lane, an entity list, or a real corpus tier (corpus:cheese,
    // corpus-near herbs, corpus+fast food). Guesses that are held: prompt-rare
    // ('Acrorhagi', 'Abomasum' for a body-part clue) and corpus-last (alphabetical
    // filler, 'Mario' for an Aladdin character).
    var s = String(srcW || '');
    if (/^(llm|live|learned|ai|ask|entity)/.test(s)) return false;
    if (/^corpus/.test(s) && !/^corpus-last/.test(s)) return false;
    return true;
  }

  function forceReadySend(el, btn) {
    if (!el) return;
    // Remote control: a paused bot watches and reports, but never submits.
    if (window.__krPaused) return;
    var v = String(el.value || '').trim();
    if (!v) { recoverLost(el); BOT.readyAnswer = ''; BOT.readyAt = 0; BOT.readyTries = 0; return; }
    if (BOT.readyAnswer !== v) {
      BOT.readyAnswer = v;
      BOT.readyAt = Date.now();
      BOT.readyTries = 0;
      return;
    }
    // The room has said something since this word went in (an echo, or the "no
    // echo" refusal). Either way the word is closed: retrying it is exactly the
    // "it kept entering hydrogen" loop, and the next answer is what the turn needs.
    if (BOT.expect && BOT.expect.a === v && pageText().length > (BOT.expect.len || 0) + 8) {
      log({ responded: v, tries: BOT.readyTries });
      BOT.expect = null;
      BOT.readyAnswer = ''; BOT.readyAt = 0; BOT.readyTries = 0;
      try { setValue(el, ''); } catch (e) {}
      // The room spoke and this word is finished, taken or refused. Releasing it
      // here is what lets the next tick draft a *different* answer: next() refuses
      // to produce anything while answerInHand is set, so leaving it set was the
      // same word coming back every 350ms.
      if (KR.norm(BOT.answerInHand || '') === KR.norm(v)) { BOT.answerInHand = ''; BOT.retypes = 0; }
      BOT.failedWord = v;
      if (KR.norm(BOT.current) === KR.norm(v)) { BOT.current = ''; advancePastSpent(); }
      return;
    }
    // After a refusal or a failed submission the next word must come from a lane
    // that read the wording, not from a pack tier.
    BOT.needLane = true;
    // The word in the box has already been entered in this game. Never type it
    // again: clear it, pull the next answer, and let the turn continue.
    // 'saidAlready' and not a word already pressed this turn: a word from an
    // earlier turn in this category cannot go out again (the room refuses it), but
    // the retry ladder for the word just pressed must keep working.
    if (isSpent(v) || heardWord(v) || (saidAlready(v) && !(BOT.turnSent || {})[KR.norm(v)])) {
      BOT.readyAnswer = ''; BOT.readyAt = 0; BOT.readyTries = 0;
      BOT.expect = null;
      log({ skipSpent: v, ago: spentAgo(v), heard: !!(BOT.heard || {})[KR.norm(v)] });
      if (KR.norm(BOT.answerInHand) === KR.norm(v)) { BOT.answerInHand = ''; BOT.retypes = 0; }
      try { setValue(el, ''); } catch (e) {}
      if (KR.norm(BOT.current) === KR.norm(v)) advancePastSpent();
      return;
    }
    // Same provenance rule as the other send path: a pack filler word does not
    // go out in the first five seconds, which is when the lanes answer. This
    // path is what actually submitted 'cut' for a tennis question.
    // Hard guarantee: anything the bot has written is pressed. Both holds below
    // exist to wait for a better answer, and waiting with text already in the box
    // is exactly what "it typed it but never pressed Enter" looked like. A word
    // gets 700ms of grace and then it goes, whatever the source and whatever lane
    // is still coming.
    if (typedAgo(v) < 700 && holdWeak((BOT.src || {})[KR.norm(v)])) {
      if (!BOT.holdWeakAt || Date.now() - BOT.holdWeakAt > 1200) {
        BOT.holdWeakAt = Date.now();
        log({ holdWeak: v, src: (BOT.src || {})[KR.norm(v)] || '' });
      }
      return;
    }
    var fsrc = String((BOT.src || {})[KR.norm(v)] || '');
    // Entity lists and learned words are knowledge: they go out at once. Only a
    // bare guess waits, and only for 2.2s now that the lane's first line lands in
    // about a second. Two waits and it goes anyway - a guess beats a lost life.
    var fWeak = !fsrc || /^(gen|voc|shape|last-resort|wordnet|corpus|assoc|compound|synonym|syn|curated|prompt|know|wiki)/.test(fsrc);
    if (fWeak && Date.now() - (BOT.catAt || 0) < 2200 && (BOT.holdForceN || 0) < 2) {
      if (!BOT.holdForceAt || Date.now() - BOT.holdForceAt > 900) {
        BOT.holdForceAt = Date.now();
        BOT.holdForceN = (BOT.holdForceN || 0) + 1;
        log({ holdForceFiller: v, src: fsrc });
      }
      return;
    }
    // The same junk and subject gates apply to whatever the box holds, because
    // this path sends text that another tier wrote: it is how a wiki charity list
    // put "Charity record" into a Katy Perry round.
    if (KR.norm(BOT.current) === KR.norm(v) && (junkFinal(v) || !tiedToSubject(v))) {
      log({ blockedSend: v, src: (BOT.src || {})[KR.norm(v)] || '' });
      BOT.current = '';
      BOT.readyAnswer = ''; BOT.readyAt = 0; BOT.readyTries = 0;
      try { setValue(el, ''); } catch (e) {}
      advancePastSpent();
      return;
    }
    // The turn budget is about *different* words: one guess, plus one more after
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
      // Record it as a submission for this turn and this game too. Without this
      // the force path left the word out of turnSent/gameSent, so after the room
      // refused it the lane offered that same word again and it went back in.
      BOT.turnSent[fKey] = 1;
      (BOT.gameSent = BOT.gameSent || {})[fKey] = 1;
      markTried(BOT.cat, v);
    } else {
      // The same word is still in the box. Press it again, spaced out, until the
      // room clearly has it - a cleared box (deliveredFor) or the word in the
      // feed - and never longer than a few seconds into the turn.
      if (BOT.deliveredFor && KR.norm(BOT.deliveredFor) === fKey) return;
      if (feedHas(v)) return;
      // Measured, not guessed: the first press lands ~1.4s after the clue (typing
      // plus SEND_DELAYS), so a deadline measured from that press put the drop at
      // 4.4s. Both clocks are used now - 1.2s of silence after a press, or 2.5s
      // since the clue, whichever comes first.
      if ((BOT.pressN[fKey] || 0) >= 3 ||
          Date.now() - (BOT.pressed[fKey] || 0) > 1200 ||
          Date.now() - (BOT.catAt || Date.now()) >= 2000) {
        // Three presses (~2s) and the room has not taken the word: it is not going.
        // Drop it - which also keeps the picker from handing it back - so the next
        // tick drafts a different answer instead of pressing a dead word.
        log({ giveUpWord: v, n: BOT.pressN[fKey] || 0, clicked: !!(btn && !btn.disabled) });
        dropAnswer(v, 'nosend');
        // That word is out of the model's list and the room would not take it:
        // ask the model for a fresh list instead of recycling the pack's guesses.
        askMore(BOT.cat || '');
        BOT.readyAnswer = ''; BOT.readyAt = 0; BOT.readyTries = 0;
        BOT.expect = null;
        try { setValue(el, ''); } catch (e) {}
        advancePastSpent();
        return;
      }
      var waitLeft = (BOT.pressNextAt[fKey] || 0) - Date.now();
      if (waitLeft > 0) {
        // One line per word per wait: this is the pacer, logged so the timing can
        // be read instead of guessed at.
        if (BOT.waitLogFor !== fKey) { BOT.waitLogFor = fKey; log({ pressWait: v, left: waitLeft, n: BOT.pressN[fKey] || 0 }); }
        return;
      }
    }
    // A generic guess does not get to beat the model into the room. The floor tier
    // produces 'Pizza' for 'a type of welding' within 300ms; the model answers that
    // wording in under a second and it is the only real answer here. This watchdog
    // fired at 2.9s and sent the guess while the line was still coming.
    var gsrc = String((BOT.src || {})[fKey] || '');
    if (typedAgo(v) < 700 &&
        (!gsrc || /^(gen|voc|shape|last-resort|wordnet|generic|corpus|assoc|compound|synonym|syn|curated|prompt|know|wiki)/.test(gsrc)) &&
        BOT.llmPending && !BOT.llmGot && Date.now() - (BOT.catAt || 0) < 5200) {
      if (!BOT.holdModelAt || Date.now() - BOT.holdModelAt > 1200) {
        BOT.holdModelAt = Date.now();
        log({ holdForModel: v, src: gsrc });
      }
      return;
    }
    BOT.pressN[fKey] = (BOT.pressN[fKey] || 0) + 1;
    // Tighter than before (600 / 850 / 1100ms between attempts): three presses and
    // the word is dropped at ~2.5s, so a dead answer costs a fraction of the turn
    // instead of most of it.
    BOT.pressNextAt[fKey] = Date.now() + 300 + 250 * BOT.pressN[fKey];
    BOT.readyAt = Date.now();
    BOT.readyGaveUp = '';
    BOT.lastSubmitAnswer = v;
    BOT.lastSubmitAt = Date.now();
    // Tell the state machine this answer is in the room, exactly as the other send
    // path does. Without it the bot never learned the answer was accepted or
    // refused, never reset, and sat with a spent budget for the rest of the
    // question - one guess and then silence.
    BOT.sentAt = Date.now();
    BOT.current = v;
    markSpent(v);
    if (!BOT.expect || BOT.expect.a !== v) BOT.expect = { a: v, at: Date.now(), n: 0, len: pageText().length };
    // ONE method per attempt. Clicking, pressing Enter and requesting the form all
    // at once submitted the same answer two or three times: the room counted every
    // one of them, which is the duplicate the player saw.
    if (btn && !btn.disabled) {
      try { btn.click(); } catch (e) { /* detached */ }
    } else {
      pressEnter(el);
    }
    log({ forceSend: v, src: (BOT.src || {})[KR.norm(v)] || '', try: BOT.readyTries, n: BOT.pressN[fKey] || 0, gap: Date.now() - (BOT.pressed[fKey] || Date.now()), since: Date.now() - (BOT.catAt || Date.now()), clicked: !!(btn && !btn.disabled) });
    // Remember what went in and how much text the room held at that moment:
    // the next candidate may only be typed once the room has visibly moved on.
    BOT.lastSubmitted = { a: v, at: Date.now(), len: pageText().length };
    BOT.resendN = 0;
  }

  function ensureSent(el, btn) {
    if (!el) return;
    if (window.__krPaused) return;
    // No turn-budget return here on purpose. It used to sit above the delivery
    // branch, so after the first press this function returned before it could see
    // the room clear the box: delivery was never recorded, the word was treated as
    // unsent and re-typed into the room (the repeat the player saw). The budget is
    // applied at the press itself, where it belongs.
    var v = String(el.value || '').trim();
    // The room took the word: it cleared the box. That is delivery, even when the
    // room shows no "accepted" text this bot can parse - and it is why the same
    // answer was pressed into the room twice.
    // Only a word this turn actually pressed can have been 'taken'. A re-render
    // that empties the box before any press is not delivery, and treating it as
    // one abandoned the answer and left the turn silent.
    if (!v && BOT.current && ((BOT.sentThisTurn || 0) > 0 || (BOT.pressed || {})[KR.norm(BOT.current)])) {
      // Our own code emptied the box a moment ago: that is not the room taking
      // the word. Wait for the room's own clear (or for the retype).
      if (Date.now() - (BOT.boxClearAt || 0) < 250) return;
      BOT.pending = null;
      BOT.expect = null;
      BOT.readyAnswer = '';
      BOT.readyAt = 0;
      BOT.readyTries = 0;
      if (KR.norm(BOT.answerInHand) === KR.norm(BOT.current)) { BOT.answerInHand = ''; BOT.retypes = 0; }
      if (BOT.deliveredFor !== BOT.current) { BOT.deliveredFor = BOT.current; log({ delivered: BOT.current }); }
      // BOT.current is deliberately kept: it is the word the later 'ok' and 'no
      // echo' branches have to judge. Clearing it here lost every verdict.
      return;
    }
    if (!v || !BOT.current || v !== String(BOT.current).trim()) return;
    // One press per word per 700ms, whichever path is calling: the force path and
    // this ladder both fired in the same tick, which put the same answer in twice.
    if (BOT.lastSubmitAnswer && KR.norm(BOT.lastSubmitAnswer) === KR.norm(v) &&
        Date.now() - (BOT.lastSubmitAt || 0) < 700) return;
    var p = BOT.pending;
    if (!p || p.answer !== v) {
      BOT.pending = { answer: v, at: Date.now(), tries: 0 };
      return;
    }
    if (Date.now() - p.at < 320) return;
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
    // 700ms of grace, then the press happens whatever this word is: the holds are
    // for choosing a better answer, and a word already sitting in the box that is
    // never pressed is the silent turn. typedAgo is the age of this text.
    if (typedAgo(v) < 700 && holdWeak((BOT.src || {})[kp])) return;
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
    log({ sent: v, src: srcL, via: firstPress ? 'ladder-enter' : 'enter-retry' });
  }

  // Submitting without a button: the room's form also accepts Enter, and a
  // missing SEND button must never be the reason a ready answer stays unsent.
  // A better list arriving while a pack guess is already sitting in the box must
  // take the box over: "paint" was typed at t=10ms and sent at t=1.4s while the
  // fetched list (Red, Blue, Pink) was already at the front of the queue.
  function resetTyped() {
    BOT.current = '';
    BOT.idx = 0;
    // A lane list outranks whatever filler is in hand.
    BOT.answerInHand = '';
    BOT.retypes = 0;
    BOT.armedAt = 0;
    var e = input();
    if (e && e.value) setValue(e, '');
  }

  // KeyboardEvent ignores keyCode/which in its init dictionary - they are
  // read-only on the instance, so a synthetic "Enter" arrives with keyCode 0.
  // Handlers that test e.keyCode === 13 and never e.key (a very common shape)
  // then treat the key as a stray press and do nothing. That is the difference
  // between "it pressed enter" and "it typed the answer and sat there".
  function keyEvt(type) {
    var ev = null;
    try {
      ev = new KeyboardEvent(type, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, charCode: 13,
        bubbles: true, cancelable: true, composed: true, view: window
      });
    } catch (e) {
      try {
        ev = document.createEvent('KeyboardEvent');
        ev.initKeyboardEvent(type, true, true, window, 'Enter', 0, '', false, '');
      } catch (e2) { return null; }
    }
    ['keyCode', 'which', 'charCode'].forEach(function (k) {
      try { Object.defineProperty(ev, k, { get: function () { return 13; }, configurable: true }); } catch (e) {}
    });
    return ev;
  }

  function pressEnter(el) {
    if (!el) return false;
    var took = false;
    if (!userTyping()) { try { el.focus(); } catch (e) {} }
    // The handler can be on the input, on a parent, inside a shadow root, on the
    // form, on body, on document or on window (a global shortcut). Every one of
    // those levels gets the key, in that order.
    var root = el.getRootNode ? el.getRootNode() : null;
    // Only the answer box (and its own ancestors) when the player is typing: a key
    // event at document/window level can trip the chat's Enter handler and send a
    // half-written message, which is the other half of "I cannot chat in game".
    var wide = !userTyping();
    var targets = [], raw = [el, el.parentElement, root && root.host, el.form];
    if (wide) raw = raw.concat([document.body, document, window]);
    raw.forEach(function (n) { if (n && targets.indexOf(n) < 0) targets.push(n); });
    ['keydown', 'keypress', 'keyup'].forEach(function (t) {
      targets.forEach(function (node) {
        var ev = keyEvt(t);
        if (!ev) return;
        try { node.dispatchEvent(ev); } catch (e) { return; }
        if (ev.defaultPrevented) took = true;
      });
    });
    var form = el.form;
    if (form && form.requestSubmit) { try { form.requestSubmit(); took = true; } catch (e) {} }
    return took;
  }

  // Every keystroke the bot makes passes through here, which makes it the one
  // choke point no tier can bypass. A member of the head noun's WordNet family
  // (dirge, ballad, aria, lied, ditty for "song") is a kind of the head word, not
  // an instance of it, so it is swapped for the next usable pick before it can
  // reach the box. Type questions keep them: there they are the right answer.
  function familyWord(v) {
    var w = String(v || '').trim();
    if (!w) return false;
    if (!taxonomyBanned()) return false;
    var hd = headWord(BOT.cat || '');
    if (!hd || !KB.hn || !KB.hn[hd]) return false;
    BOT.famMap = BOT.famMap || {};
    var fam = BOT.famMap[hd];
    if (!fam) {
      fam = {};
      String(KB.hn[hd]).split('|').forEach(function (x) { var k = KR.norm(x); if (k) fam[k] = 1; });
      BOT.famMap[hd] = fam;
    }
    return !!fam[KR.norm(w)];
  }

  // Is the player typing somewhere that is not our answer box? Chat, the lobby
  // name field, anything. While that is true the bot must not move focus and must
  // not fire keys at the document, or the player cannot type a message while the
  // bot is playing.
  function userTyping() {
    try {
      var a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return false;
      var tag = String(a.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && !a.isContentEditable) return false;
      if (a === input()) return false;          // our own box: not the player's
      return true;
    } catch (e) { return false; }
  }

  function setValue(el, v) {
    // Never write an answer into the box outside our turn. Every keystroke costs a
    // queue position (next() advances BOT.idx), and a box filled on an opponent's
    // turn used to be sent as well - which is how the bot came to its own turn with
    // nothing left to say. Clearing the box (''), is always allowed.
    if (v && BOT.canType === false) {
      if (!BOT.skipTypeAt || Date.now() - BOT.skipTypeAt > 1500) {
        BOT.skipTypeAt = Date.now();
        log({ skipType: String(v).slice(0, 30) });
      }
      return;
    }
    if (v && familyWord(v)) {
      var swapped = '';
      try { swapped = next() || ''; } catch (e) { swapped = ''; }
      if (swapped && !familyWord(swapped)) { log({ famSwap: v, to: swapped }); v = swapped; }
    }
    // Who emptied the box matters: the room taking the answer clears it, but so
    // do several of our own code paths ('a better list arrived', 'stale answer in
    // the box'). Treating our own clear as delivery declared an answer sent that
    // had never been pressed, and the turn was lost.
    BOT.boxAt = Date.now();
    BOT.boxValue = v;
    if (!v) BOT.boxClearAt = Date.now();
    var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    // Focus only when the player is not typing elsewhere: stealing the caret out
    // of the chat box on every keystroke made chatting during a game impossible.
    if (!userTyping()) { try { el.focus(); } catch (e) {} }
  }

  // The frozen pack cannot know every phrasing the room will use. The local pack
  // server can reach Datamuse, so a category the pack has never seen gets looked
  // up there in parallel: the local answers go out at once, and the live ones
  // slot in ahead of whatever is left in the queue.
  var LIVE = 'http://127.0.0.1:5201/resolve?q=';
  function liveLookup(cat) {
    if (!window.fetch) return;
    BOT.livePending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 2500);
    fetch(LIVE + encodeURIComponent(cat), ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.livePending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {}, badStem = {};
        // A rejected answer comes back pluralised ("Cannons" refused, "cannon"
        // offered next), so the block covers the word's stem too.
        (lr.bad || []).forEach(function (b) {
          var bk = KR.norm(b);
          if (!bk) return;
          bad[bk] = 1;
          badStem[bk.replace(/(?:es|s)$/, '')] = 1;
        });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          // Spent this game (in memory or before a reload): a lane's cache must
          // not hand back an answer the room has already seen.
          if ((BOT.gameSent || {})[k] || wasTried(cat, a) || refusedWord(a)) continue;
          add.push(a);
        }
        // Live words are guesses; words the room has accepted before are not.
        // When there are enough of those, the unknowns stay behind them.
        var vs = KB.__vocs;
        if (!vs) {
          vs = {};
          (KB.voc || '').split('|').forEach(function (w) { var k = KR.norm(w); if (k) vs[k] = 1; });
          try { Object.defineProperty(KB, '__vocs', { value: vs }); } catch (e) { KB.__vocs = vs; }
        }
        var known = add.filter(function (a) { return vs[KR.norm(a)]; });
        if (known.length >= 2) add = known;
        // An association-shaped clue ("something you keep in a garage") is where
        // Datamuse returns phonetic neighbours instead of answers: bak, nack,
        // lift, level. For this shape only words the room has actually accepted
        // are answers - the rest are worse than silence, because the model lane
        // and the studied store both answer this wording properly.
        if (assocShape(cat)) add = known;
        // Live guesses are still answers: they must fit the question's shape
        // (a "word" is one word, "containing work" must contain work) and, in
        // rare-only play, clear the same rarity bar as everything else.
        add = add.filter(function (a) { return KR.shapeOk(cat, a); });
        // A thesaurus synonym ("gargantuan" for big) is on-target by
        // construction, and the obscure ones are exactly the deep cuts, so a
        // "means" question may use live words the pack has never tiered.
        var MEANS = /\b(?:words?|terms?|phrases?)\b[^.]*\b(?:means?|synonyms?|another word for)\b/.test(KR.norm(cat));
        // A rhyme is correct by construction: "flat" and "brat" rhyme with cat
        // however common they are, so the rarity bar must not throw them away.
        var RHYME = /rhymes?\s+with\b/.test(KR.norm(cat));
        if (RARE) add = add.filter(function (a) {
          if (RHYME) return true;
          if (MINRANK >= 3) return MEANS ? KR.deepRank(KB, a) >= 3 : KR.deepStrict(KB, a);
          return KR.deepRank(KB, a) >= MINRANK;
        });
        add = preferAccepted(add);
        if (!add.length) return;
        // A model answer is a lane answer: not filler, never held back.
        add.forEach(function (x) { var kx = KR.norm(x); if (kx && !BOT.src[kx]) BOT.src[kx] = 'llm'; });
        evictFillerHand();
        add.forEach(function (x) { var kx = KR.norm(x); if (kx && !BOT.src[kx]) BOT.src[kx] = 'llm'; });
        // Live answers only lead when the pack had nothing qualifier-aware for
        // this category. When the pack does know the answer ("copy, cut, paste"
        // for a keyboard shortcut), live guesses queue behind it instead of
        // pushing it down - that is how "bear, bit" got sent first.
        // A spelling-rule category is the exception: the pack's list for "a word
        // containing age" held "agew" and "ageo", which the room rejected on
        // sight, while Datamuse only returns real words. There the dictionary is
        // the better first answer, so live words lead.
        var at = (BOT.weak || BOT.wordy) ? Math.min(BOT.idx, BOT.picks.length) : BOT.picks.length;
        var spl = splitUsed(add.slice(0, 8));
        BOT.picks.splice.apply(BOT.picks, [at, 0].concat(spl.un));
        // Live words this game has already spent do not lead the hand either.
        if (spl.us.length) BOT.picks = BOT.picks.concat(spl.us);
        BOT.liveGot = true;
        BOT.weak = false;
        log({ live: add.slice(0, 4), at: at });
      })
      .catch(function (e) { clearTimeout(timer); BOT.livePending = false; log({ liveErr: String(e && e.message || e) }); });
  }

  // The general route for a category the frozen pack has never seen. "A <family>
  // that <property>" is a list article on Wikipedia - "List of countries
  // bordering on two or more oceans" - and the pack server only trusts a page
  // whose title is about this property and whose items belong to the family. So
  // these words are verified for this wording, not guessed from the head noun,
  // and they lead the queue. Nothing is cached here: the server caches, so a
  // repeat is instant.
  var ASK = 'http://127.0.0.1:5201/ask?q=';
  function askLookup(cat) {
    if (!window.fetch) return;
    BOT.askPending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 7000);
    fetch(ASK + encodeURIComponent(cat), ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.askPending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        // A fetched /know list beats this one for a category the pack cannot
        // answer: it was chosen by the racing endpoint, not by a list heuristic.
        if (BOT.unknown && (BOT.knowGot || BOT.knowPending)) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {}, badStem = {};
        // A rejected answer comes back pluralised ("Cannons" refused, "cannon"
        // offered next), so the block covers the word's stem too.
        (lr.bad || []).forEach(function (b) {
          var bk = KR.norm(b);
          if (!bk) return;
          bad[bk] = 1;
          badStem[bk.replace(/(?:es|s)$/, '')] = 1;
        });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          // Spent this game (in memory or before a reload): a lane's cache must
          // not hand back an answer the room has already seen.
          if ((BOT.gameSent || {})[k] || wasTried(cat, a) || refusedWord(a)) continue;
          if (banned(a) || !KR.shapeOk(cat, a)) continue;
          // A wiki category is a filing label, not an instance: "Lists of songs",
          // "Outline of music", "Glossary of terms" were all sent as answers to
          // "name a Katy Perry song" while the model already held the real titles.
          if (/^(?:lists?|outline|index|glossary|timeline|categor(?:y|ies)|bibliography|discography)\b/i.test(a)) continue;
          add.push(a);
        }
        add = preferAccepted(add);
        if (!add.length) return;
        // Same ordering as the pack tiers: unused verified answers lead, spent
        // ones queue at the back instead of being re-sent and rejected.
        var spa = splitUsed(add);
        // The hand already holds four answers this room has accepted: a wiki list
        // can only lower that quality (it is where "rainbow flag" came from), so
        // it is dropped rather than appended.
        if (handKnown() >= 4 && (BOT.okThisGame || 0) > 0) {
          BOT.askGot = true;
          BOT.askCount = add.length;
          log({ askDropped: add.slice(0, 3), why: 'hand already accepted' });
          return;
        }
        BOT.picks = spa.un.concat(BOT.picks, spa.us);
        resetTyped();
        // Start again from the verified answers: they are the ones that pass the
        // puffer, and turnSent keeps the ones already used from repeating.
        BOT.idx = 0;
        BOT.askGot = true;
        BOT.askCount = add.length;
        log({ ask: add.slice(0, 4), src: j.src, conf: j.conf });
      })
      .catch(function (e) { clearTimeout(timer); BOT.askPending = false; log({ askErr: String(e && e.message || e) }); });
  }

  // "Something you would take", "a thing you might find in": the answer is an
  // association or a choice, not an instance from a list article.
  function assocShape(c) {
    return /\b(?:something|anything|things?)\b|\bwould (?:you )?(?:take|bring|find|see|hear|say)\b|\bmight (?:find|see|hear)\b/i.test(String(c || ''));
  }

  // Unknown-category mode. When nothing in the pack has any evidence for the
  // wording, guessing is not an answer source - so the pack server is asked for
  // a real one. /know races every live source at once (wiki list articles, the
  // article's own categories, Datamuse associations, the model lanes) and the
  // first useful list comes back here and leads the hand.
  var KNOW = 'http://127.0.0.1:5201/know?q=';
  function knowLookup(cat) {
    if (!window.fetch || window.__krKnow === false) return;
    BOT.knowPending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 6500);
    fetch(KNOW + encodeURIComponent(cat), ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.knowPending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {}, badStem = {};
        // A rejected answer comes back pluralised ("Cannons" refused, "cannon"
        // offered next), so the block covers the word's stem too.
        (lr.bad || []).forEach(function (b) {
          var bk = KR.norm(b);
          if (!bk) return;
          bad[bk] = 1;
          badStem[bk.replace(/(?:es|s)$/, '')] = 1;
        });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          // Spent this game (in memory or before a reload): a lane's cache must
          // not hand back an answer the room has already seen.
          if ((BOT.gameSent || {})[k] || wasTried(cat, a) || refusedWord(a)) continue;
          if (banned(a) || !KR.shapeOk(cat, a)) continue;
          // A wiki category is a filing label, not an instance: "Lists of songs",
          // "Outline of music", "Glossary of terms" were all sent as answers to
          // "name a Katy Perry song" while the model already held the real titles.
          if (/^(?:lists?|outline|index|glossary|timeline|categor(?:y|ies)|bibliography|discography)\b/i.test(a)) continue;
          add.push(a);
        }
        // /know mixes list articles with Datamuse associations. Its words used to
        // carry no provenance at all, which dropped them into the untraced bucket
        // where the relation gate cannot see them - that is how "bak, nack, lift"
        // came back for a garage question the pack had already been fixed for.
        var ksrc = String(j.src || '');
        for (var ki = 0; ki < add.length; ki++) {
          var kn = KR.norm(add[ki]);
          if (!kn || BOT.src[kn]) continue;
          BOT.src[kn] = /^(?:ai:|model)/i.test(ksrc) ? 'ai:know'
            : (/list|wiki|article|categor/i.test(ksrc) ? 'wiki:know' : 'assoc:know');
        }
        add = preferAccepted(add);
        if (!add.length) return;
        // A repeat of the same clue must reach fresh answers, not the ones the
        // room already took: unused first, spent behind the whole hand.
        var spk = splitUsed(add);
        if (handKnown() >= 4 && (BOT.okThisGame || 0) > 0) {
          BOT.knowGot = true;
          log({ knowDropped: add.slice(0, 3), why: 'hand already accepted' });
          return;
        }
        // /know's own sources are list articles and association pages, which
        // answered "something you find in a kitchen" with try/like/trade. The
        // model lane answered the same category with refrigerator/oven/toaster.
        // So while the model is in flight or has already answered, this list is
        // a reserve behind the hand, never the thing that gets typed first.
        if (BOT.llmPending || BOT.llmGot) {
          BOT.picks = BOT.picks.concat(spk.un, spk.us);
          BOT.knowGot = true;
          evictFillerHand();
          log({ knowBackup: add.slice(0, 3), src: j.src });
          return;
        }
        BOT.picks = spk.un.concat(BOT.picks, spk.us);
        BOT.idx = 0;
        resetTyped();
        BOT.knowGot = true;
        log({ know: add.slice(0, 5), src: j.src });
      })
      .catch(function (e) { clearTimeout(timer); BOT.knowPending = false; });
  }

  // A category no source has indexed yet: the pack server can ask a model once
  // and cache the answer forever, if the owner has put a key in .env. Without a
  // key it answers instantly with nothing, and the pack's own answers stand.
  var LLM = 'http://127.0.0.1:5201/llm?q=';
  // The room's already-said words ride along to the model, so its list starts
  // beyond them instead of offering the answer the room just refused.
  function saidWords() {
    var out = [];
    try {
      var h = BOT.heard || {};
      for (var k in h) { if (h[k] && out.length < 25) out.push(h[k]); }
      for (var g in (BOT.gameSent || {})) { if (out.length < 40) out.push(g); }
      // Refused and thrown-away words ride along too. Without them the model was
      // asked the same question with nothing to avoid, so it streamed back the
      // answer that had just been refused and the bot typed it again.
      for (var b in (BOT.badAll || {})) { if (out.length < 45 && out.indexOf(b) < 0) out.push(b); }
      for (var d in (BOT.dropped || {})) { if (out.length < 50 && out.indexOf(d) < 0) out.push(d); }
    } catch (e) { out = []; }
    return out;
  }
  // A lane that answered this wording evicts a filler pick already in hand:
  // otherwise 'cut' kept the box for the whole turn while serve/forehand and
  // crosscourt waited in the queue.
  function evictFillerHand() {
    if (!BOT.answerInHand) return false;
    var hs = String((BOT.src || {})[KR.norm(BOT.answerInHand)] || '');
    if (hs && !/^(gen|voc|shape|last-resort|wordnet|corpus|assoc|compound|synonym|syn|curated|prompt|entity|know|wiki)/.test(hs)) return false;
    log({ laneOverFill: BOT.answerInHand, src: hs });
    resetTyped();
    return true;
  }

  // The local model needs ~7-8s for a whole list but yields its first answer in
  // about a second. Reading the stream is what lets the model contribute inside
  // the turn instead of losing the race to the pack every time.
  var STREAM = 'http://127.0.0.1:5201/llm?stream=1&q=';
  function takeStreamAnswer(a, cat) {
    if (BOT.cat !== cat) return;
    var k = KR.norm(a);
    // No subject gate here: this IS the lane that read the wording, and its source
    // is only recorded a few lines below - checking tiedToSubject() first rejected
    // every model answer as 'untraced' and left the pack's guesses to answer.
    if (!k || banned(a) || !KR.shapeOk(cat, a) || junkFinal(a)) return;
    // A clue that names a work, brand or person ("...from Disney's Aladdin",
    // "Name a Katy Perry song") can only be answered with a name or a title.
    // The model's stream answered Aladdin with 'lamp', 'khan' and 'gymkhana' -
    // lowercase common nouns, every one refused - while its one-shot list had
    // Genie, Jafar and Jasmine. A lowercase word is kept only when the pack
    // already knows it for this clue (so 'toy story' still counts for Pixar).
    if (subjectToken() && !/[A-Z]/.test(String(a)) && !(BOT.src || {})[k]) {
      if (!BOT.streamDropAt || Date.now() - BOT.streamDropAt > 1500) {
        BOT.streamDropAt = Date.now();
        log({ streamDrop: a, why: 'not a name' });
      }
      return;
    }
    if (BOT.turnSent[k] || (BOT.gameSent || {})[k] || pickedBefore(a) || saidAlready(a) || wasTried(cat, a) || refusedWord(a)) return;
    if (BOT.failedWord && KR.norm(BOT.failedWord) === k) return;
    for (var pi = 0; pi < BOT.picks.length; pi++) { if (KR.norm(BOT.picks[pi]) === k) return; }
    if (!BOT.src[k]) BOT.src[k] = 'llm';
    BOT.picks.splice(0, 0, a);
    BOT.idx = 0;
    BOT.llmGot = true;
    log({ llmLine: a, ms: BOT.catAt ? Date.now() - BOT.catAt : 0 });
    // A pack filler already in the box is replaced by the model's answer, as long
    // as nothing has been submitted this turn.
    // The lane read this exact wording, so it outranks everything already in the
    // box - a learned word included. Only a word already submitted this turn is
    // safe from the takeover.
    var hs = String((BOT.src || {})[KR.norm(BOT.answerInHand || '')] || '');
    var cs = String((BOT.src || {})[KR.norm(BOT.current || '')] || '');
    var beatable = function (s) {
      return !s || /^(gen|voc|shape|last-resort|wordnet|corpus|assoc|compound|synonym|syn|curated|prompt|entity|know|wiki|learned)/.test(s);
    };
    if ((BOT.sentThisTurn || 0) === 0 && ((BOT.answerInHand && beatable(hs)) || (BOT.current && beatable(cs)))) {
      resetTyped();
    }
  }
  // The hand is empty and the model's list for this wording has been used up or
  // dropped: ask it again, with the used words in 'avoid', instead of repeating.
  // Three asks per clue at most - a model that has nothing new after that is not
  // going to find something on the fourth try.
  function askMore(cat) {
    if (!cat || window.__krLlm === false || window.__krStream === false) return false;
    // A stream is already on the wire: queue the re-ask for its completion instead
    // of dropping it, which is what left a dead word unasked-for.
    if (BOT.llmPending) { BOT.askQueued = cat; return true; }
    BOT.askN = BOT.askN || 0;
    if (BOT.askN >= 5) return false;
    if (BOT.askMoreCat === cat && Date.now() - (BOT.askMoreAt || 0) < 1200) return false;
    BOT.askMoreCat = cat;
    BOT.askMoreAt = Date.now();
    BOT.askN++;
    // Allow the same wording through the one-stream-per-category guard.
    BOT.streamCat = '';
    BOT.streamAt = 0;
    log({ askMore: cat, n: BOT.askN });
    llmStream(cat);
    return true;
  }

  function llmStream(cat) {
    if (!window.fetch || window.__krLlm === false || window.__krStream === false || !cat) return;
    // Re-beginning the same wording (the room re-renders it) must not start a
    // second generation: one runner, one request.
    if (BOT.streamCat === cat && Date.now() - (BOT.streamAt || 0) < 8000) return;
    BOT.streamCat = cat;
    BOT.streamAt = Date.now();
    BOT.llmPending = true;
    // One generation at a time: a new clue aborts the previous stream. The server
    // runs a single model, so a stream left open from the last category puts this
    // one at the back of the queue and its first line arrives seconds late.
    if (BOT.streamCtrl) { try { BOT.streamCtrl.abort(); } catch (e) {} }
    var ctrl = window.AbortController ? new AbortController() : null;
    BOT.streamCtrl = ctrl;
    // 18s, not 9: after a server restart the local model has to load from disk
    // first, and the old window cut the stream off before its first answer. Late
    // lines still land in the queue and are usable next round.
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 18000);
    var url = STREAM + encodeURIComponent(cat) + '&avoid=' + encodeURIComponent(saidWords().join('|'));
    // Every ask is logged with how long the clue had been on screen, and every
    // first line with its arrival time: "did it actually ask the AI" is a question
    // the trace can answer, and a silent failure used to look identical to a
    // category the model had no answer for.
    log({ llmAsk: cat, at: BOT.catAt ? Date.now() - BOT.catAt : 0 });
    var gotLine = false;
    fetch(url, ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) {
        if (!r || !r.ok || !r.body || !r.body.getReader) {
          clearTimeout(timer);
          BOT.llmPending = false;
          log({ llmFail: (r && r.status) || 'no body', cat: cat });
          // The stream is the fast lane, not the only one: fall back to the
          // one-shot list so a clue is still asked instead of answered from the
          // pack's guess.
          llmLookup(cat, true);
          return null;
        }
        var reader = r.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        function pump() {
          return reader.read().then(function (res) {
            if (res.done) {
              clearTimeout(timer);
              BOT.llmPending = false;
              if (BOT.askQueued) { var qc = BOT.askQueued; BOT.askQueued = ''; askMore(qc); }
              return;
            }
            buf += dec.decode(res.value, { stream: true });
            var i;
            while ((i = buf.indexOf('\n')) >= 0) {
              var line = buf.slice(0, i).trim();
              buf = buf.slice(i + 1);
              if (line) { gotLine = true; takeStreamAnswer(line, cat); }
            }
            return pump();
          });
        }
        return pump();
      })
      .catch(function (e) {
        clearTimeout(timer);
        BOT.llmPending = false;
        log({ llmErr: String((e && e.message) || e), cat: cat });
        if (BOT.askQueued) { var qe = BOT.askQueued; BOT.askQueued = ''; askMore(qe); }
        // Same fallback as a dead stream: ask the one-shot endpoint, which is
        // cached per wording and still answers this category.
        if (!gotLine) llmLookup(cat, true);
      });
  }

  function llmLookup(cat, fresh) {
    if (!window.fetch || window.__krLlm === false) return;
    BOT.llmPending = true;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 9000);
    var avoid = saidWords();
    var url = LLM + encodeURIComponent(cat) +
      (avoid.length ? '&avoid=' + encodeURIComponent(avoid.join('|')) : '') +
      (fresh ? '&fresh=1' : '');
    fetch(url, ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        BOT.llmPending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {}, badStem = {};
        // A rejected answer comes back pluralised ("Cannons" refused, "cannon"
        // offered next), so the block covers the word's stem too.
        (lr.bad || []).forEach(function (b) {
          var bk = KR.norm(b);
          if (!bk) return;
          bad[bk] = 1;
          badStem[bk.replace(/(?:es|s)$/, '')] = 1;
        });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || BOT.turnSent[k] || BOT.picks.indexOf(a) >= 0) continue;
          // Spent this game (in memory or before a reload): a lane's cache must
          // not hand back an answer the room has already seen.
          if ((BOT.gameSent || {})[k] || wasTried(cat, a) || refusedWord(a)) continue;
          // A model answer to a shape question ("ending in -bound", "one word")
          // has to obey the shape too, or it is a rejection with extra steps.
          if (banned(a) || !KR.shapeOk(cat, a)) continue;
          add.push(a);
        }
        add = preferAccepted(add);
        if (!add.length) return;
        var spm = splitUsed(add);
        // A cached model answer is not a verified one: this category's cache holds
        // the rainbow *flag* list (Wiphala, Flag of Cusco) from an earlier call.
        // When the hand already holds four accepted answers, the model list waits
        // instead of elbowing them out.
        if (handKnown() >= 4 && (BOT.okThisGame || 0) > 0) {
          BOT.llmGot = true;
          log({ llmDropped: add.slice(0, 3), why: 'hand already accepted' });
          return;
        }
        var at = BOT.askGot ? BOT.askCount : 0;
        if (spm.un.length) {
          BOT.picks.splice.apply(BOT.picks, [at, 0].concat(spm.un));
          BOT.idx = 0;
          // A model answer outranks a typed guess: take the box back.
          if (at === 0) resetTyped();
        }
        // A model answer this game already used goes to the back, never on top.
        if (spm.us.length) BOT.picks = BOT.picks.concat(spm.us);
        BOT.llmGot = true;
        log({ llm: add.slice(0, 4) });
      })
      .catch(function (e) { clearTimeout(timer); BOT.llmPending = false; log({ llmErr: String(e && e.message || e) }); });
  }

  // Categories this server has already learned. The server keeps every category
  // a live lane has ever resolved, with the room's own verdicts folded in, so a
  // repeat is instant and starts from the answers that actually passed. This is
  // asked for every category, and its answers lead: they are room-verified.
  var LEARN = 'http://127.0.0.1:5201/learn?q=';
  function learnLookup(cat) {
    if (!window.fetch || window.__krLearn === false || !cat) return;
    BOT.learnPending = true;
    fetch(LEARN + encodeURIComponent(cat), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        BOT.learnPending = false;
        if (!j || !j.answers || !j.answers.length || BOT.cat !== cat) return;
        var lr = loadLrn()[learnKey(cat)] || {};
        var bad = {}, badStem = {};
        // A rejected answer comes back pluralised ("Cannons" refused, "cannon"
        // offered next), so the block covers the word's stem too.
        (lr.bad || []).forEach(function (b) {
          var bk = KR.norm(b);
          if (!bk) return;
          bad[bk] = 1;
          badStem[bk.replace(/(?:es|s)$/, '')] = 1;
        });
        var add = [];
        for (var i = 0; i < j.answers.length; i++) {
          var a = String(j.answers[i] || '').trim();
          var k = KR.norm(a);
          if (!a || !k || bad[k] || badStem[k.replace(/(?:es|s)$/, '')] || BOT.turnSent[k]) continue;
          // Spent this game, before or after a reload: never typed again.
          if ((BOT.gameSent || {})[k] || wasTried(cat, a) || refusedWord(a)) continue;
          if (banned(a) || !KR.shapeOk(cat, a)) continue;
          // Not already in the hand: a duplicate at the head shifted the cursor
          // and put the same answer in the box twice ("car key, car key").
          if (BOT.picks.some(function (p) { return KR.norm(p) === k; })) continue;
          if (add.indexOf(a) < 0) add.push(a);
        }
        add = preferAccepted(add);
        if (!add.length) return;
        var spl = splitUsed(add);
        // A queue that is already being walked is never rewound: a submit is
        // armed, one just left, or the cursor has moved past the head. Rewinding
        // there threw away the better list the turn had started from and re-walked
        // spent answers. The learned answers join at the cursor instead, so the
        // rest of this turn is unaffected and the next turn starts from them.
        var busy = BOT.idx > 0 || BOT.sentThisTurn > 0 || BOT.sentAt ||
          (BOT.armedAt > Date.now()) || !!(BOT.clickedAt && Date.now() - BOT.clickedAt < 800);
        if (busy) {
          var at = Math.max(BOT.idx, 0);
          BOT.picks = BOT.picks.slice(0, at).concat(spl.un, BOT.picks.slice(at), spl.us);
        } else {
          BOT.picks = spl.un.concat(BOT.picks);
          if (spl.us.length) BOT.picks = BOT.picks.concat(spl.us);
          BOT.idx = 0;
          resetTyped();
        }
        // Tag provenance: without this these words sit in BOT.picks with an empty
        // src, and the send path cannot tell them from a pack filler - it held
        // 'Bharatanatyam' (a real dance, from the store) for five seconds while the
        // model's answer waited behind it.
        BOT.learnCat = BOT.learnCat || {};
        for (var ai = 0; ai < add.length; ai++) {
          var ak = KR.norm(add[ai]);
          if (!BOT.src[ak]) BOT.src[ak] = 'learned';
          // Provenance, so this word can never answer a different wording.
          BOT.learnCat[ak] = KR.norm(cat);
        }
        BOT.learnGot = add.length;
        evictFillerHand();
        log({ learned: add.slice(0, 4), n: add.length, mid: busy ? 1 : 0, top: BOT.picks.slice(0, 3) });
      })
      .catch(function () { BOT.learnPending = false; });
  }

  // What the room did with an answer goes back to the server, so the next game
  // starts from this one: accepted words lead, rejected ones are dropped. This
  // is the only path by which the store learns anything as fact.
  function feedback(kind, cat, answer) {
    if (!window.fetch || window.__krLearn === false || !cat || !answer) return;
    var url = 'http://127.0.0.1:5201/feedback?q=' + encodeURIComponent(cat) +
      '&a=' + encodeURIComponent(answer) + '&ok=' + (kind === 'ok' ? '1' : '0');
    try { fetch(url, { cache: 'no-store' }).catch(function () {}); } catch (e) {}
  }

  // Per-category yield, persisted across games and room reloads: whether the
  // pack actually knows a prompt (many deep picks) or answers it from a thin
  // fallback is what decides the win rate, so every prompt the room renders is
  // recorded with the number of picks it produced and what the room rejected.
  var CKEY = 'kr:cats:v1';
  function catMap() { try { return JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { return {}; } }
  function catWrite(m) { try { localStorage.setItem(CKEY, JSON.stringify(m)); } catch (e) {} }
  function catSet(cat, picks, weak) {
    var k = KR.norm(cat || ''); if (!k) return;
    var m = catMap(), r = m[k] || { q: cat, n: 0, s: 0, ok: 0, bad: 0, w: 0, p: 0 };
    r.q = cat; r.n++; r.p = Math.max(r.p || 0, picks); if (weak) r.w++;
    m[k] = r; catWrite(m);
  }
  function catBump(cat, f) {
    var k = KR.norm(cat || ''); if (!k) return;
    var m = catMap(), r = m[k] || { q: cat, n: 0, s: 0, ok: 0, bad: 0, w: 0, p: 0 };
    r[f] = (r[f] || 0) + 1; m[k] = r; catWrite(m);
  }
  function catWord(cat, w) {
    var k = KR.norm(cat || ''); if (!k || !w) return;
    var m = catMap(), r = m[k] || { q: cat, n: 0, s: 0, ok: 0, bad: 0, w: 0, p: 0 };
    (r.bw = r.bw || []).push(w); m[k] = r; catWrite(m);
  }
  window.__krCats = catMap;

  // How famous an answer is, counted as the number of independent lists in the
  // pack that contain it. Tier order alone cannot separate T-Rex from
  // Amargasaurus, or Monopoly from Crokinole: both come from the same kind of
  // bucket. Recency of nothing is not evidence, but repetition across a curated
  // list, 40 prompt buckets and 30 WordNet families is.
  // Fame is scoped to the head noun. Counting an answer across the whole pack
  // promoted generic words instead of famous ones: "Seed" is in dozens of
  // buckets, so it outranked banana for a fruit - it is famous for nothing in
  // particular. An answer counts when the lists that hold it are about THIS
  // head, which is also how a "cereal brand" bucket beats a grain family.
  var POPH = {};
  function headFame(head) {
    if (POPH[head]) return POPH[head];
    var m = {};
    var add = function (s, w) {
      if (!s) return;
      String(s).split('|').forEach(function (x) {
        var k = KR.norm(x);
        if (k && k.length > 2) m[k] = (m[k] || 0) + w;
      });
    };
    var cur = KB.cur || [];
    for (var i = 0; i < cur.length; i++) {
      var rule = cur[i];
      if (!rule || !rule.list) continue;
      var lbl = String(rule.has || rule.label || rule.q || '');
      add(rule.list, head && lbl.indexOf(head) >= 0 ? 4 : 0);
    }
    var pk1 = KB.pk || {};
    for (var k1 in pk1) if (head && k1.indexOf(head) >= 0) add(pk1[k1], 2);
    if (head) add((KB.hn || {})[head], 2);
    POPH[head] = m;
    return m;
  }

  function fame(a, head) {
    var p = headFame(head)[KR.norm(a)] || 0;
    // A long multi-word answer is a deep cut almost by construction.
    if (/\s/.test(String(a).trim())) p -= 1;
    return p;
  }

  // An answer already given in this game is a rejection in most rounds, so
  // unused answers go first. This is module scope on purpose: the live lanes
  // (/know, /ask, the model) prepend their batches on top of the ordered pack
  // tiers, and a plain concat there put a spent answer back in front - which is
  // why a repeated identical clue re-sent the same three words to be rejected
  // again instead of moving on.
  function splitUsed(arr) {
    var un = [], us = [];
    for (var i = 0; i < arr.length; i++) {
      ((BOT.gameSent || {})[KR.norm(arr[i])] ? us : un).push(arr[i]);
    }
    return { un: un, us: us };
  }
  function usedLast(arr) { var sp = splitUsed(arr); return sp.un.concat(sp.us); }

  function begin(cat) {
    // Re-resolving the same clue (the room re-renders the counter above it) must
    // not hand back a fresh turn budget: that reset is what let one turn send a
    // whole queue of guesses at a board that takes one.
    var sameClue = !!BOT.cat && KR.norm(cat) === KR.norm(BOT.cat);
    if (BOT.logCat && BOT.logCat !== cat) postGameLog(BOT.logCat);
    BOT.logCat = cat;
    // A genuinely new question earns a fresh budget - but only if a moment has
    // passed since the last answer, so the caption re-rendering above the same
    // clue cannot mint one. Without this, the second question of a game was
    // born with the previous question's spent budget and never answered.
    if (!sameClue && Date.now() - (BOT.sentAt || 0) > 1500) BOT.sentThisTurn = 0;
    // A new game starts a new answer budget: after a game over the same answers
    // are legal again, so the repeat guard resets with the game, not with the tab.
    if (BOT.out) {
      // A game-over blip used to wipe both the game's sent set and the durable
      // 'already tried' list, so the next round re-sent the same word. A word
      // the room has seen in this wording stays used.
      BOT.out = false;
      BOT.okThisGame = 0;
      log({ resume: true, keptSent: Object.keys(BOT.gameSent || {}).length });
    }
    // A re-render of the same clue is not a new question: keep the words this
    // wording already had pressed into it.
    if (!sameClue) { BOT.pressed = {}; BOT.pressN = {}; BOT.pressNextAt = {}; }
    BOT.cat = cat;
    // Sticky for the clue. The room re-renders the caption above it several times
    // a second, and resetting this on every re-render meant every clock that counts
    // from the clue - the weak hold and the dead-word deadline - never expired.
    if (!sameClue || !BOT.catAt) BOT.catAt = Date.now();
    BOT.otherUpAt = 0;
    BOT.lastKey = KR.norm(cat);
    BOT.idx = 0;
    BOT.current = '';
    BOT.out = false;
    if (!sameClue) {
      BOT.turnSent = {};
      // A new question starts with nothing dropped and a fresh ask budget.
      BOT.dropped = {};
      BOT.askN = 0;
      BOT.askMoreCat = '';
      // A refusal belongs to the wording it happened in. It lives beside the ask
      // budget, not with the per-render resets: begin() runs several times a
      // second while the caption redraws, and clearing it there disabled the
      // 'answer something you can still stand behind' gate immediately.
      BOT.refusedAt = 0;
    }
    // The turn budget is NOT reset here. Re-parsing the clue (its text drifts as
    // the room re-renders the caption above it) was resetting it many times a
    // second, so one real turn could spend ten guesses. A new budget comes only
    // from a real turn edge, which requires the page to have shown someone else
    // for a moment.
    BOT.catBad = 0;
    BOT.lastSubmitted = null;
    BOT.failedWord = '';
    BOT.answerInHand = '';
    BOT.retypes = 0;
    BOT.resendN = 0;
    BOT.askGot = false;
    BOT.askPending = false;
    BOT.askCount = 0;
    BOT.llmGot = false;
    BOT.llmPending = false;
    BOT.genUsed = false;
    BOT.junkOk = false;
    BOT.junkIds = [];
    BOT.sfCat = '';
    BOT.genCat = '';
    BOT.badSrc = {};
    BOT.allSrcOk = false;
    BOT.holdLogged = false;
    BOT.vocIdx = 0;
    BOT.holdLogged = false;
    BOT.lastResort = false;
    BOT.cool = 0;
    // The lane is marked pending here, not inside the async call: the first tick
    // could otherwise send a pack guess a few hundred ms before the request even
    // started ('Acidopore' for a body-part clue, with 'antennae' waiting behind it).
    if (window.__krLlm !== false && window.__krStream !== false) BOT.llmPending = true;
    BOT.idleAt = 0;
    BOT.armedAt = 0;
    BOT.armTries = 0;
    BOT.turnStart = 0;
    var lr = loadLrn()[learnKey(cat)] || {};
    // Whatever the last turn left in the box is not an answer to this category.
    // Leaking it through made the bot resubmit an old answer on its next turn,
    // and the room counted the duplicate as a wrong echo.
    var stale = input();
    if (stale && stale.value) setValue(stale, '');
    // Resolve with provenance: every send records which lookup produced it, so a
    // wrong answer is traceable instead of mysterious.
    var tr = [];
    // A category that asks for a word ("containing age", "ending in tion") has
    // to answer with one English word: no hyphenated coinages, no "age-imo".
    BOT.wordy = /\bwords?\b/.test(KR.norm(cat));
    BOT.picks = KR.resolve(cat, KB, {
      bad: (lr.bad || []).concat(Object.keys(BOT.badAll || {})), trace: tr, rare: RARE,
      deep: RARE && MINRANK >= 3, win: !RARE && MINRANK <= 0,
      // The resolver's generic fallback is off by default now: it answered a
      // cowboy and a shade-of-gray question with "Apple, Australia, Cuba, Canada,
      // Austria", and in two measured losses it was ~15 of 38 rejections. The AI
      // lane, the shape list and the family tiers fill those slots.
      fallback: false, noGeneric: true,
      // Answers that satisfy the qualifier lead; answers that only satisfy the
      // head noun follow as a reserve. A wrong send costs one retry, an empty
      // turn costs the puffer, so the reserve is strictly better than silence.
      softQual: true
    });
    BOT.src = {};
    for (var ti = 0; ti < tr.length; ti++) BOT.src[KR.norm(tr[ti].a)] = tr[ti].src;
    // Does the pack actually know this wording, or is it about to guess? A prompt,
    // entity, corpus-near or learned source is knowledge; corpus-last, assoc and
    // WordNet families are guesses, and a guess must not beat the model.
    BOT.strongPack = false;
    for (var si = 0; si < BOT.picks.length && si < 60; si++) {
      var ss = String(BOT.src[KR.norm(BOT.picks[si])] || '');
      if (/^(prompt|entity|learned|live|corpus-near)/.test(ss)) { BOT.strongPack = true; break; }
    }
    // Every member of the head noun's WordNet family is a *kind* of the head word,
    // and it is tagged as taxonomy here, once, for the whole turn. KB.hn['song']
    // opens dirge, ballad, aria, lied, ditty - the words "Name a Katy Perry song"
    // kept getting. Tagging at the source means every tier's existing gate sees
    // them, including the desperation tiers that walk the family list directly.
    var hdTag = headWord(cat);
    if (hdTag && KB.hn && KB.hn[hdTag]) {
      String(KB.hn[hdTag]).split('|').forEach(function (w) {
        var k = KR.norm(w);
        if (k && !BOT.src[k]) BOT.src[k] = 'wordnet:' + hdTag;
      });
    }
    // A hand that is nothing but *types of the head word* is not knowledge: the
    // clue asked for instances (a brand, a thing in a place, a show from a decade).
    // Drop it here so the lanes that read the wording run exactly as they would
    // for a category the pack has never seen, instead of the pack's taxonomy
    // answering the question (uke/cittern for a guitar brand, lazaretto for a
    // hospital, "special/colorcast" for a TV show).
    if (taxonomyBanned() && BOT.picks.length &&
        BOT.picks.every(function (p) { return taxonomyGuess(p); })) {
      log({ taxonomyOnly: cat, dropped: BOT.picks.slice(0, 3) });
      BOT.picks = [];
    }
    // Mixed hands are worse than empty ones: one real answer keeps the taxonomy
    // words in the hand, and lastChance - which ignores relation gates by design -
    // sends them. That is how a mixed hand for "Name a Katy Perry song" answered
    // with prothalamion and torch song. Taxonomy words are dropped one by one here
    // so no tier can reach them.
    if (taxonomyBanned()) {
      var keepEv = BOT.picks.filter(function (p) { return !taxonomyGuess(p); });
      if (keepEv.length !== BOT.picks.length) {
        log({ taxonomyDropped: BOT.picks.filter(taxonomyGuess).slice(0, 3) });
        BOT.picks = keepEv;
      }
    }
    // Rejections by source, measured over 29 rated games: the generic fallbacks
    // and near-prompt guesses were the bulk (corpus-last 36, corpus-near 24,
    // wordnet-last 21 of 244). They are kept - an empty hand loses the life - but
    // they move behind everything the pack actually evidenced. A stable
    // partition, not a separate queue: v88's queue starved the hand.
    // `corpus:shoe` (bare head-noun bucket, no qualifier scope) is in the same
    // class: one measured loss was ten rejections from that single bucket.
    var JUNKSRC = /^(?:corpus-last|corpus-near|corpus-rule|corpus:[a-z]|wordnet-last|vocab-fallback|generic-fallback)/;
    var evPicks = [], latePicks = [];
    for (var pi = 0; pi < BOT.picks.length; pi++) {
      var pk = BOT.picks[pi];
      // No recorded source is not evidence: it is a guess from a tier that was
      // never traced ("bus" led a car-brand question, "Action-strategy game" led
      // a video-game one). Untraced picks queue behind everything evidenced.
      (JUNKSRC.test(BOT.src[KR.norm(pk)] || '') || !BOT.src[KR.norm(pk)] ? latePicks : evPicks).push(pk);
    }
    // A synonym of the subject is never an answer: "film" for a movie, "nation"
    // for a country, "beast" for an animal, "paint" for a color. Measured in the
    // harness as the second answer in most categories. Nor is the head noun
    // itself ("game" for a video game). They stay in the hand, last, so the turn
    // is still answered - they are just never the first thing sent.
    // "brand" is not the entity in "name a guitar brand": it is the *property*
    // being asked about, and WordNet happily reports that a brand is a sword -
    // which is how "excalibur, rapier, falchion" led an answer for guitar brands.
    // A trailing property noun is skipped when a real entity word precedes it.
    var headTok = headWord(cat);
    // The pack carries its own synonym table (KB.tr[head]): tr[movie] is
    // "motion picture|moving picture|picture show|film|picture", tr[country] is
    // "body politic|nation|res publica|commonwealth". A synonym of the subject can
    // never be an answer, and these were the second answer sent in most
    // categories - a guaranteed rejection every time.
    var syn = {};
    var cw = KR.norm(cat).split(/\s+/).filter(function (w) { return w.length > 2; });
    if (headTok) cw.push(headTok);
    for (var wi = 0; wi < cw.length; wi++) {
      var sl = String(((KB.tr || {})[cw[wi]]) || '').split('|');
      for (var si = 0; si < sl.length; si++) if (sl[si]) syn[KR.norm(sl[si])] = 1;
      syn[cw[wi]] = 1;
    }
    BOT.syn = syn;
    // Nothing evidenced at all: the bot must not pretend it knows this one. It
    // says so in the log and goes to fetch a real answer.
    // "Unknown" is not "empty": a hand full of WordNet buckets and associations
    // is a hand of guesses, and guesses are how "name a video game" got genres
    // (Advergame, Aim trainer) and "name a color" got paint. Only the room's own
    // accepted corpus (prompt/learned/curated/entity) counts as knowing a
    // category; without one, the bot says it does not know and fetches real
    // answers.
    // `compound:` is NOT here: it answers with hypernyms of the head word
    // ("special", "colorcast", "pilot program" for a TV show), and counting it as
    // knowledge is why those categories never asked a lane and sent the soup.
    var TRUSTED = /^(learned|prompt|curated|corpus\+[a-z]+|corpus-rule|corpus:[a-z]|entity:)/;
    // A borrowed prompt list (prompt-rare / prompt-deep) is the exact thing that
    // misfires - it is what answered a Pop-Tart question with an airline dump -
    // so it does not count as knowing the category. The category stays "unknown"
    // and the fetched list leads; the borrowed list stays as a reserve.
    BOT.unknown = !BOT.picks.some(function (a) {
      var s = (BOT.src || {})[KR.norm(a)] || '';
      return TRUSTED.test(s) && !/^prompt-(rare|deep)/.test(s);
    });
    BOT.knowGot = false;
    BOT.knowPending = false;
    if (BOT.unknown && cat) { log({ unknown: cat }); knowLookup(cat); }
    var dead = [];
    var live = evPicks.concat(latePicks).filter(function (a) {
      var s = (BOT.src || {})[KR.norm(a)] || '';
      if (/^(synonym|means|antonym|hypernym|hyponym):/.test(s)) { dead.push(a); return false; }
      var k = KR.norm(a);
      if (syn[k]) { dead.push(a); return false; }
      if (headTok && (k === headTok + 's' || k + 's' === headTok || k.indexOf(headTok + ' ') === 0 || k.indexOf(' ' + headTok) > 0)) { dead.push(a); return false; }
      return true;
    });
    // Fitness is about where an answer came from, in this order:
    //   1. this exact category's accepted answers (learned, curated, corpus+"video
    //      game", entity, compound);
    //   2. the room's general answers for the same head (prompt, corpus-rule);
    //   3. any other traced evidence (wordnet:, assoc:, bare corpus bucket);
    //   4. guesses with no provenance.
    // Without tiering, "prompt-rare" (a *similar* prompt's answers: 4X, Advergame,
    // Action RTS) outranked the real titles the pack holds for "video game".
    var EXACT = /^(learned|curated|corpus\+[a-z]+|entity:|compound:)/;
    // The head's own accepted answers are this category's answers. A prompt-*
    // list belongs to a *similar* prompt and can be a different kind of thing
    // entirely: "11th Street Kids, 22 Brides, A La Brava" are a comic-team list
    // that answered "name a superhero" ahead of Iron Man and Superman.
    var SAMEHEAD = /^(corpus:[a-z]|corpus-rule)/;
    var PROMPT = /^prompt/;
    // A corpus bucket can be polluted by the prompt it was harvested from: the
    // "fruit" bucket holds Core, Flesh, Pit and Seed, which came from a *part of
    // a fruit* prompt and are not fruits. WordNet's family for the head is the
    // check: if the pack knows the family and the bucket barely overlaps it, the
    // bucket answered a different question.
    var famSet = {};
    var famN = 0;
    String(((KB.hn || {})[headTok]) || '').split('|').forEach(function (w) {
      var fk = KR.norm(w);
      if (fk) { famSet[fk] = 1; famN++; }
    });
    var t1 = [], t2 = [], t2b = [], t3 = [], t4 = [];
    live.forEach(function (a) {
      var s = (BOT.src || {})[KR.norm(a)] || '';
      if (!s) t4.push(a);
      else if (EXACT.test(s)) t1.push(a);
      else if (SAMEHEAD.test(s)) {
        var kk = KR.norm(a);
        (famN >= 5 && !famSet[kk] ? t3 : t2).push(a);
      }
      else if (PROMPT.test(s)) t2b.push(a);
      else t3.push(a);
    });
    // Within a tier, the better-known answer goes first: the room's key holds
    // famous ones, and a correct-but-unknown deep cut loses the point just as
    // surely as a wrong answer. The exact tier (t1) keeps its own order because
    // that list is the room's own accepted answers for this wording.
    var hdF = (function (k) { var w = String(k || '').split(' ').filter(Boolean); return w[w.length - 1] || ''; })(KR.baseKey(cat));
    var byFame = function (arr) {
      return arr.map(function (a, i) { return { a: a, i: i, p: fame(a, hdF) }; })
        .sort(function (x, y) { return (y.p - x.p) || (x.i - y.i); })
        .map(function (o) { return o.a; });
    };
    // The exact tier is sorted too: its buckets were scraped alphabetically, so
    // "Name a dinosaur" led with Amargasaurus while T-Rex sat behind it. A
    // hand-curated list scores its members equally, so the stable sort leaves that
    // order exactly as written.
    //
    // Unused answers go first across all the *trusted* tiers - exact, same-head
    // and prompt lists. Partitioning inside each tier was not enough: a used
    // exact answer still led every unused same-head one, so a repeated clue spent
    // its turn re-sending "Cribbage, Carrom, Crokinole" while fresh board games
    // waited below, and the room rejected them one by one.
    // The guesses (t3 wordnet/association, t4 untraced, dead) never move up:
    // doing that is how a repeated "Name a color" fell from Red/Blue/Pink to
    // dye/stain/mordant and then to Apple, Australia, Cuba.
    // Which t3 answers are real answers and which are neighbours of the head
    // noun: a corpus bucket is a list about this category (the board-game bucket
    // holds Battleship, Chess, Clue), while a WordNet/association hit is a word
    // that *surrounds* the subject (dye, stain, mordant for "color"). Only the
    // corpus half joins the freshness pass; the rest stays behind used answers,
    // because a fresh guess is still a wrong answer.
    var t3c = [], t3g = [];
    t3.forEach(function (a) {
      var s3 = (BOT.src || {})[KR.norm(a)] || '';
      (/^(corpus|entity:|compound:)/.test(s3) ? t3c : t3g).push(a);
    });
    var traced = usedLast(byFame(t1)).concat(usedLast(byFame(t2)), usedLast(byFame(t2b)),
      usedLast(byFame(t3c)));
    var tb = splitUsed(traced);
    BOT.picks = tb.un.concat(tb.us, usedLast(byFame(t3g)), usedLast(byFame(t4)), dead);
    // Two lanes can carry the same answer in different case - "Leo" from the
    // model, "leo" from WordNet - and the room counts them as one word, so the
    // second is a guaranteed rejection. Keep the first, which is the better tier.
    (function () {
      var seenK = {}, uniq = [];
      for (var qi = 0; qi < BOT.picks.length; qi++) {
        var kq = KR.norm(BOT.picks[qi]);
        if (!kq || seenK[kq]) continue;
        seenK[kq] = 1;
        uniq.push(BOT.picks[qi]);
      }
      BOT.picks = uniq;
    })();
    // Sticky for the session: once a clue has been readable, the alphabetical
    // vocabulary is never a legitimate answer again, even inside a later
    // category that briefly renders empty.
    BOT.sawCat = BOT.sawCat || !!cat;
    BOT.turnStart = 0;
    BOT.retryAt = 0;
    // Every candidate from a domain-blind bucket ("character" answered with
    // Donkey Kong, "animal" answered with a colt) means this category is a
    // guaranteed loss unless a real source answers: nothing the pack has can
    // pass. Waiting longer for the model is then free, because the alternative
    // is spending the whole fuse on certain rejections.
    BOT.blindOnly = BOT.picks.length > 0 && BOT.picks.every(function (a) {
      return JUNKSRC.test(BOT.src[KR.norm(a)] || '');
    });
    if (BOT.wordy) BOT.picks = BOT.picks.filter(function (a) { return /^[a-z]+$/i.test(String(a).trim()); });
    // Win mode (MINRANK 0) needs no re-ordering here: the resolver already
    // returns exact answers first and commonest tier first, with guesses last.
    // Re-sorting by rarity here is exactly what turned a volume game into a
    // rare-word lottery, and it threw away the turn whenever the rare guess was
    // not in the room's answer key.
    if (MINRANK > 3) {
      var keep = [], fill = [];
      for (var pi = 0; pi < BOT.picks.length; pi++) {
        var pk = BOT.picks[pi];
        if (KR.deepRank(KB, pk) >= MINRANK) keep.push(pk); else fill.push(pk);
      }
      BOT.picks = keep.concat(fill.slice(0, MINRANK >= 5 ? 0 : 3));
    }
    // Does the pack actually know this category, or is the whole list the last
    // resort of a head-noun guess that ignores the qualifier? That distinction
    // decides whether the bot sends immediately or waits for the live lookup and
    // then sends only a couple of answers instead of a stream of guesses.
    // "Weak" is "the first answer is not from a list that knows this wording":
    // an association, a WordNet bucket or a vocabulary guess is exactly the case
    // the live list article is there to beat.
    // "Weak" now includes the bare head-noun bucket: `corpus:city` answers a
    // different question than "a city in the UK" and `corpus:position` than a
    // baseball position, so those categories get the model lane's verified list
    // instead of a guess. A qualifier-scoped bucket (`corpus+city`) is still
    // trusted and stays instant.
    BOT.weak = !tr.length ||
      !/^(learned|curated|prompt|corpus-near|corpus-rule|corpus-[a-z]+\+|entity|compound)/.test(tr[0].src || '') ||
      /rhymes?\s+with\b/.test(KR.norm(cat));
    BOT.liveGot = false;
    log({ cat: cat, n: BOT.picks.length, first: BOT.picks[0], src: tr[0] ? tr[0].src : '', weak: BOT.weak ? 1 : 0 });
    catSet(cat, BOT.picks.length, BOT.weak ? 1 : 0);
    // The association service answers with words that *mean* the subject: for
    // "name a color" it returned dye, paint, mordant, tincture (the material, not
    // a colour) and for "a 90s cartoon" it returned hot, cos, square. It is only
    // asked for association-shaped questions ("something you would find in X").
    if (assocShape(cat)) liveLookup(cat);
    // A weak category is exactly the one worth one extra request: the pack's own
    // bucket for its head noun is a guess, and the list article is not.
    // The list-article engine is opt-in (window.__krAsk = true): its precision
    // depends on Wikipedia's list coverage, and a wrong answer costs a life, so
    // it does not lead by default. The model bridge is always asked: it is the
    // one source that can answer a category nobody has indexed, and with no key
    // it answers instantly with nothing.
    // Both lookups start the moment the category is on screen, whoever's turn it
    // is. The opponent's turn is free time: by the time the puffer reaches us the
    // list article is usually already in hand, and its answers are verified for
    // this wording instead of guessed from the head noun.
    // Every category asks the model, not only the weak ones: the lanes are
    // quota-bound, so the only way to raise coverage is to have a request in
    // flight for every category and let caching make the repeats free. Measured
    // 23 categories / 4 AI answers when only weak categories asked.
    learnLookup(cat);
    // The stream lane and the blocking list both asked the same local model for
    // the same category: two generations on one runner, each slower than the
    // other, so both landed after the fuse. One lane per wording.
    // Abort whatever the previous clue was still generating before asking for
    // this one: two streams on one runner means the second one waits.
    if (BOT.streamCtrl) { try { BOT.streamCtrl.abort(); } catch (e) {} BOT.streamCtrl = null; BOT.llmPending = false; }
    llmStream(cat);
    if (window.__krStream === false) llmLookup(cat);
    // Unknown categories are owned by /know, which races every source itself: the
    // wiki-list lane has the wrong shape for "something you would take" questions
    // and served "Lists of islands" while /know already had tent and compass.
    if (BOT.weak && !BOT.unknown) askLookup(cat);
    // An empty hand is the one state that loses a life with no answer at all: the
    // puffer sits with us and the fuse runs. "A word ending in -bound" is not
    // "weak" by source, and it is exactly the category that needs the model.
    if (!BOT.picks.length) { BOT.askForced = true; askLookup(cat); if (window.__krStream === false) llmLookup(cat); }
  }

  // The room takes answers, not descriptions. A fallback list can produce
  // "Edgar Allen Poe's “The Magic Clock of Dr. March” witch" or "-ary", and every
  // one of those is a rejection that burns the fuse.
  // The gate that decides whether a word can be sent at all. `trusted` means the
  // word came from the room's own accepted answers, and those include titles the
  // strict rules were throwing away: "Call of Duty: Modern Warfare 4" (colon,
  // five words), "Mario Kart 8 Deluxe" (digits). Rejecting them left the bot with
  // only the association tier - which is why "name a video game" answered with
  // genres while the pack held the real titles.
  function answerable(a, trusted) {
    // The room and the model use typographic punctuation: "Harryhausen's" with a
    // curly apostrophe walked past the gate that rejects ' and ".
    var w = String(a || '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').trim();
    if (!w) return false;
    if (w.length > (trusted ? 42 : 26)) return false;
    if (/[()\[\]“”"';,!?]/.test(w)) return false;
    // "1044 Chapel" was sent for a PIXAR question: a house number is not an
    // answer, and a trusted source only made it trusted. Three or more digits in
    // front of a word is an address, not a title.
    if (/\b\d{3,}\s+[A-Za-z]/.test(w)) return false;
    if (/:/.test(w) && !trusted) return false;
    if (/^[^a-z0-9]/i.test(w)) return false;
    // Digits are scraper noise ("Sofa 421", "135 Airlines") unless the room
    // itself accepted the answer.
    // Digits are scraper noise unless the number is part of the title: "1649th
    // level" and "Sofa 421" are noise, "Toy Story 2" and "Mario Kart 8" are
    // answers. Two-digit runs are noise either way; a lone digit inside a title
    // is fine.
    if (/\d{2,}/.test(w)) return false;
    if (/\d/.test(w) && !trusted && !/(?:^|\s)\d(?:\s|$)/.test(w)) return false;
    if (w.split(/\s+/).length > (trusted ? 5 : 3)) return false;
    return true;
  }

  // A bare head-noun bucket (or a WordNet / association / vocabulary tier) is a
  // guess about the question's *subject*, not its wording. `corpus:nba` holds
  // teams and answered "name an NBA player" with them; the country list answered
  // "a country that borders Brazil" with France. While a live lane is answering,
  // these are held back so the model's wording-specific list lands first.
  function guessSrc(a) {
    var s = (BOT.src || {})[KR.norm(a)] || '';
    return /^(?:corpus:[a-z]+|corpus-last|wordnet|assoc|vocab)/.test(s);
  }

  // Is this answer one the room has actually taken for a category like this one?
  // After the room refuses an answer, the next one must be an answer the bot can
  // still stand behind - the model's own words, a learned word, an entity list -
  // not another junk guess that spends the next slot on a second refusal. The
  // window is short: a weak guess is better than an empty box if nothing arrives.
  function weakAfterRefusal(a) {
    if (!BOT.refusedAt) return false;
    // Yield to the send path. The gate exists to spend the next answer on
    // something better, never to keep the box empty: after 1.6s, or as soon as
    // nothing trusted is actually on the wire to arrive, it stops blocking and a
    // weaker word goes out. An empty box loses the heart outright, so silence is
    // always the worse outcome.
    if (Date.now() - BOT.refusedAt > 1600) return false;
    if (!(BOT.llmPending || BOT.askPending || BOT.learnPending)) return false;
    var s = String((BOT.src || {})[KR.norm(a)] || '');
    return !/^(llm|live|learned|ai|ask|entity|curated|corpus\+[a-z]+|synonym|compound)/.test(s);
  }

  // A learned word answers the wording it was learned under and nothing else.
  // 'Bergamot' came out for a cheese clue from a store entry whose only claim on it
  // was a model suggestion, and a word left in the hand from the previous category
  // was reachable the same way. Untraceable provenance (no recorded category) is
  // allowed, so a word picked up before this map existed cannot be over-blocked.
  function learnedElsewhere(w) {
    var k = KR.norm(w);
    if (!k) return false;
    if (!/^learned/.test(String((BOT.src || {})[k] || ''))) return false;
    var lc = (BOT.learnCat || {})[k];
    return !!(lc && lc !== KR.norm(BOT.cat || ''));
  }

  function trustedSrc(a) {
    return /^(learned|prompt|curated|corpus\+[a-z]+|corpus-rule|corpus:[a-z]|entity:)/.test((BOT.src || {})[KR.norm(a)] || '');
  }

  // A WordNet synset answers with the *types* of the head word - "bass guitar",
  // "uke", "cittern" for "guitar", "creche", "lazaretto", "sanatorium" for
  // "hospital" - and the compound tables answer with hypernym soup ("special",
  // "colorcast", "pilot program" for a TV show). Those are only ever right when
  // the clue asks for a type/kind/breed/variety. When it asks for instances (a
  // brand, a thing *in* a place, a show from a decade) they are wrong answers that
  // merely look related, so they are never sent.
  var TYPEQ = /\b(?:type|types|kind|kinds|sort|sorts|breed|breeds|species|variety|varieties|class of|category of)\b/;
  // A trailing property noun ("name a guitar brand", "name a car make") names the
  // relation being asked about, not the entity. WordNet says a brand is a sword,
  // so taking it as the head turned that question into a sword question.
  var PROP = /^(?:brand|brands|make|makes|maker|makers|model|models|company|companies|type|types|kind|kinds|sort|sorts|variety|varieties|version|versions|colour|colours|color|colors|flavour|flavours|flavor|flavors|style|styles|name|names|example|examples)$/;
  // When are kinds-of-the-head wrong? Only when the clue names a subject those
  // kinds do not belong to. "Name a Katy Perry song" (named artist) is not
  // answered by "dirge" or "torch song"; "Name a cake" *is* answered by
  // cheesecake and chocolate cake, and blocking those was silence.
  // A clue that names a subject ("an actor in Bollywood", "a Katy Perry song")
  // is only answered by something tied to that subject. The pack's generic
  // actor list answered the Bollywood clue with Matt Damon, which is worse than
  // an odd-but-real Bollywood name.
  // Words that are capitalised in a clue but name no subject: "Name an English
  // word starting with wh" made 'english' the subject, and every candidate was
  // then rejected as 'not tied to english' - fifteen blocked picks in one turn.
  var SUBJSTOP = { english: 1, french: 1, spanish: 1, german: 1, italian: 1, japanese: 1,
    chinese: 1, portuguese: 1, dutch: 1, russian: 1, korean: 1, arabic: 1, latin: 1,
    american: 1, british: 1, englishman: 1, australian: 1, canadian: 1, irish: 1,
    scottish: 1, welsh: 1, european: 1, african: 1, asian: 1, indian: 1, mexican: 1,
    greek: 1, roman: 1, norse: 1, christian: 1, biblical: 1, holy: 1, ancient: 1,
    name: 1, names: 1, word: 1, words: 1, thing: 1, things: 1, item: 1, items: 1,
    type: 1, kind: 1, sort: 1, brand: 1, movie: 1, movies: 1, film: 1, films: 1,
    song: 1, songs: 1, city: 1, cities: 1, country: 1, countries: 1, food: 1,
    animal: 1, animals: 1, number: 1, letter: 1, letters: 1, real: 1, fictional: 1,
    famous: 1, popular: 1, common: 1, well: 1, known: 1, single: 1, two: 1, three: 1 };
  function subjectToken() {
    var toks = String(BOT.cat || '').split(' ').filter(Boolean).slice(1);
    for (var i = 0; i < toks.length; i++) {
      if (!/^[A-Z][a-z]{2,}/.test(toks[i])) continue;
      if (SUBJSTOP[toks[i].toLowerCase()]) continue;
      // A capitalised word that is the clue's own head noun is not a subject.
      if (KR.norm(toks[i]) === KR.norm(headWord(BOT.cat || ''))) continue;
      return toks[i].toLowerCase();
    }
    return '';
  }
  function tiedToSubject(a) {
    var subj = subjectToken();
    if (!subj) return true;
    // A shape clue ("a word starting with wh", "ending in -bound") names no
    // subject at all: the shape is the whole question, so the subject rule must
    // not filter it out.
    try {
      var c = KR.constraints ? KR.constraints(BOT.cat || '') : null;
      if (c && (c.pre || c.end || c.first || c.has || c.len || c.vowels || c.apos || c.hyph ||
                (c.hasAll && c.hasAll.length))) return true;
    } catch (e) { /* no constraints */ }
    var src = String((BOT.src || {})[KR.norm(a)] || '').toLowerCase();
    // For a clue that names a subject, only a lane that read the wording may
    // answer: the pack's WordNet/corpus tiers produce kinds and near-misses
    // ('dirge' for Katy Perry, 'Matt Damon' for Bollywood), and the wiki backup
    // produced 'Charity record' from a charity-records list. Learned and model
    // answers pass; nothing generated from the head noun does.
    if (/^(wordnet|corpus|assoc|compound|synonym|syn|gen|voc|shape|wiki|know|last-resort|assoc)/.test(src)) return false;
    // No recorded source is not proof of contamination: the pack's real movie list
    // arrives untraced too, and blocking it left only the gate-ignoring fallback
    // ("Harryhausen's" answering a Pixar question). Untraced words rank last
    // instead of being banned.
    return true;
  }

  // Words that are never an answer, wherever they came from: the clue's own head
  // noun ("cake" for "name a cake"), filler, and anything too short to be a name.
  // This runs at the write site, so no tier, lane or fallback can slip past it.
  var FILLER = { thing: 1, things: 1, stuff: 1, something: 1, anything: 1, item: 1,
    items: 1, object: 1, objects: 1, none: 1, unknown: 1, n_a: 1, other: 1, others: 1 };
  function junkFinal(a) {
    // A possessive is a place or a business, not an answer to a category, and the
    // typographic apostrophe used to slip past the send-time punctuation gate.
    if (/[()\[\]"'\u2018\u2019\u201c\u201d]/.test(String(a || ''))) return true;
    var k = KR.norm(a || '');
    if (!k) return true;
    if (FILLER[k]) return true;
    // Two letters is enough: 'Up' and 'Rio' are real answers, and the old three-
    // letter floor threw them away. One-letter words and filler are still out.
    if (k.replace(/[^a-z]/g, '').length < 2) return true;
    var hd = headWord(BOT.cat || '');
    if (hd && k === KR.norm(hd)) return true;
    return false;
  }

  function taxonomyBanned() {
    var cat = String(BOT.cat || '');
    if (!cat) return false;
    if (TYPEQ.test(KR.norm(cat))) return false;
    // Drop the leading verb, then look for a capitalised word: a named subject
    // ('Katy Perry', 'Avengers') makes kinds-of-the-head wrong answers. Without
    // one, 'name a cake' is answered by cheesecake, which is a kind of cake.
    var toks = cat.split(' ').filter(Boolean).slice(1);
    for (var i = 0; i < toks.length; i++) {
      if (/^[A-Z][a-z]{2,}$/.test(toks[i])) return true;
    }
    return false;
  }

  function taxonomyGuess(a) {
    // `wordnet-last:<head>` is the same taxonomy bucket arriving under a suffix
    // variant, and it went straight past this gate: "Name a Katy Perry song" was
    // answered with prothalamion, torch song and drinking song - kinds of song,
    // which is a different question from hers. Matching the prefix loosely enough
    // to catch it is the whole fix.
    return /^(?:wordnet(?:-last)?:|compound:)/.test((BOT.src || {})[KR.norm(a)] || '');
  }

  // The room's own accepted answers, as a set.
  function vocSet() {
    var vs = KB.__vocs;
    if (!vs) {
      vs = {};
      (KB.voc || '').split('|').forEach(function (w) { var k = KR.norm(w); if (k) vs[k] = 1; });
      try { Object.defineProperty(KB, '__vocs', { value: vs }); } catch (e) { KB.__vocs = vs; }
    }
    return vs;
  }

  // A lane can return a real list of the wrong relation: "colour of the rainbow"
  // matched the rainbow *flag* and led with Wiphala, Peace flag, Flag of Cusco
  // before Red and Blue. Words this room has actually accepted before are the
  // safest thing to type, so when a lane supplies at least four of them, its
  // remaining words queue behind instead of leading.
  // How many answers the unspent hand already holds that this room has accepted
  // before. A wiki list is one fetch away from the wrong relation (rainbow
  // *flags* for a rainbow colour), so it must not elbow out a hand that is
  // already made of accepted answers.
  function handKnown() {
    var vs = vocSet(), n = 0;
    for (var i = BOT.idx; i < BOT.picks.length; i++) if (vs[KR.norm(BOT.picks[i])]) n++;
    return n;
  }

  function preferAccepted(add) {
    if (!add || add.length < 2) return add;
    var vs = vocSet();
    var known = [], rest = [];
    for (var i = 0; i < add.length; i++) (vs[KR.norm(add[i])] ? known : rest).push(add[i]);
    return known.length >= 4 ? known.concat(rest.slice(0, 2)) : add;
  }

  // "Something in a hospital" is not answered by the hospital's own family. Word
  // associations of the head produced "arrest, ill, foundation" for it, and
  // types of hospital produced "lazaretto, sanatorium". Both are the wrong
  // relation, so for an inside-a-place question none of those tiers may send.
  var INSIDE = /\b(?:something|things?|items?|stuff)\b[^.]{0,28}\b(?:in|at|inside|on|from|you find)\b/;
  function wrongRelation(a) {
    var cat = KR.norm(BOT.cat || '');
    if (TYPEQ.test(cat)) return false;
    var s = (BOT.src || {})[KR.norm(a)] || '';
    if (/^(?:wordnet:|compound:)/.test(s)) return true;
    if (INSIDE.test(cat) && /^(?:assoc:|synonym:|wordnet-last|corpus-last|corpus:[a-z])/.test(s)) return true;
    return false;
  }

  // The floor under everything else. A turn that ends with an empty box loses the
  // puffer by itself, so when the quality gates (wrong relation, refused stems,
  // vocabulary, already-spent answers) have emptied the hand, the bot still
  // answers. This is the one tier allowed to ignore the relation gate: a guess
  // that might score beats a guaranteed lost life. It still refuses the category
  // label, banned synonyms and words that break the question's shape.
  function lastChance() {
    var cat = BOT.cat || '';
    if (!cat) return '';
    var ok = function (w) {
      var k = KR.norm(w);
      if (!w || !k || BOT.turnSent[k]) return false;
      // A word this game already entered is spent: offering it again is the
      // "it typed hydrogen a second time" bug, whatever tier it came from.
      if (pickedBefore(w)) return false;
      // Same rule in the floor tier: a word this category already gave the room is
      // never offered again, not even when the hand is empty.
      if (saidAlready(w)) return false;
      if (isDropped(w)) return false;
      // The floor tier is still above repeating an answer the room refused.
      if (refusedWord(w)) return false;
      if (heardWord(w)) return false;
      // Even the guarantee tier does not send a taxonomy word to a question about
      // instances: "prothalamion", "torch song" and "work song" are kinds of song,
      // not Katy Perry songs, and this tier was the last place they were allowed
      // through.
      if (taxonomyBanned() && taxonomyGuess(w)) return false;
      // Nor a word that belongs to none of the question: "Banana", "Carrot" and
      // "Boxing" were going out for a song question from the generic list.
      if (wrongRelation(w)) return false;
      if (banned(w) || !KR.shapeOk(cat, w)) return false;
      return true;
    };
    // 1. Anything the picker still holds, including what the gates refused.
    for (var i = 0; i < BOT.picks.length; i++) if (ok(BOT.picks[i])) return BOT.picks[i];
    // 2. The head's own family, then its wider membership lists. KB.hn[head] is
    // WordNet's hyponyms of the head word: for "song" that is folk song, love
    // song, work song, torch song, drinking song, prothalamion. Those are kinds,
    // and a clue asking for instances ("a Katy Perry song") must never take them -
    // this list was the last place they got through.
    var head = headWord(cat);
    var wantType = TYPEQ.test(KR.norm(cat));
    var lists = [];
    if (head) {
      if (KB.hn && wantType) lists.push(KB.hn[head]);
      if (KB.hnw) lists.push(KB.hnw[head]);
      if (KB.pk) lists.push(KB.pk[head]);
    }
    for (var li = 0; li < lists.length; li++) {
      var ws = String(lists[li] || '').split('|');
      for (var wi = 0; wi < ws.length; wi++) if (ok(ws[wi])) return ws[wi];
    }
    // 3. Ordinary things, then the room's own vocabulary: vague, but a live guess.
    var gen = String(KB.gen || '').split('|');
    for (var gi = 0; gi < gen.length; gi++) if (ok(gen[gi])) return gen[gi];
    var voc = String(KB.voc || '').split('|');
    for (var vi = 0; vi < voc.length; vi++) if (ok(voc[vi])) return voc[vi];
    // 4. Everything unused is gone: a repeat still beats an empty box, but only
    // the one already longest ago - re-entering the word the room just refused is
    // worse than either staying quiet or trying an older one.
    var oldest = '', oldestAt = 0;
    for (var ri = 0; ri < BOT.picks.length; ri++) {
      var rw = BOT.picks[ri];
      var rk = KR.norm(rw);
      if (!rw || !rk || BOT.turnSent[rk] || banned(rw) || !KR.shapeOk(cat, rw)) continue;
      var ago = spentAgo(rw);
      if (ago > oldestAt) { oldestAt = ago; oldest = rw; }
    }
    return oldest;
  }

  // The one place the question's subject is decided. A trailing property noun
  // ("name a guitar brand", "name a car make") describes the relation, not the
  // entity: WordNet says a brand is a sword, and three separate tiers each read
  // "brand" as the head and answered a guitar question with excalibur, rapier and
  // falchion. Every tier now asks this function instead.
  function headWord(cat) {
    var toks = KR.norm(String(cat || '').replace(/\([^)]*\)/g, ' ')).split(/\s+/).filter(function (w) {
      return w.length > 2 && !/^(name|give|say|tell|list|one|something|thing|things|that|with|from|your|you)$/.test(w);
    });
    for (var i = toks.length - 1; i >= 0; i--) {
      if (PROP.test(toks[i]) && toks.slice(0, i).some(function (x) { return !PROP.test(x); })) continue;
      return toks[i];
    }
    return '';
  }

  // The turn must never go by unanswered. When nothing curated applies, the last
  // two seconds before the fuse pops are spent on any answerable word tied to the
  // question at all, instead of on silence, because SEND stays disabled while the
  // box is empty and an empty box is a guaranteed lost heart.
  function desperate() {
    var cat = BOT.cat || '';
    // The model read the wording, so its line is the best evidence available: it
    // goes out here even when our own relation test doubts it. A wrong attempt
    // costs one answer; an empty box loses the heart, and that is what "the bot
    // just did not say anything" was.
    for (var mi = 0; mi < BOT.picks.length; mi++) {
      var mw = BOT.picks[mi];
      var mk = KR.norm(mw);
      if (!mk || !/^(llm|ai|ask|live|learned|entity)/.test(String((BOT.src || {})[mk] || ''))) continue;
      if (BOT.turnSent[mk] || saidAlready(mw) || isDropped(mw) || heardWord(mw)) continue;
      if (learnedElsewhere(mw)) continue;
      if ((BOT.badAll || {})[mk]) continue;
      BOT.pickJunk = true;
      log({ rescue: mw, src: (BOT.src || {})[mk] || '' });
      return mw;
    }
    var ok = function (w) {
      var k = KR.norm(w);
      if (!w || !k || BOT.turnSent[k] || !answerable(w, trustedSrc(w))) return false;
      // Last resort does not resurrect the taxonomy junk the send gate refuses.
      return !wrongRelation(w);
    };
    if (BOT.sfCat !== cat) { BOT.sfCat = cat; BOT.sf = shapeWords(cat); }
    for (var i = 0; i < (BOT.sf || []).length; i++) if (ok(BOT.sf[i])) { BOT.pickJunk = true; return BOT.sf[i]; }
    var head = headWord(cat);
    var fam = (head && KB.hn && KB.hn[head]) ? String(KB.hn[head]).split('|') : [];
    // Tag the head's family so the relation gate can see what these words are:
    // they are the head's own kind, which is the wrong answer to "what is in X".
    for (var fj = 0; fj < fam.length; fj++) {
      var fk2 = KR.norm(fam[fj]);
      if (fk2 && !BOT.src[fk2]) BOT.src[fk2] = 'assoc:' + head;
    }
    for (var j = 0; j < fam.length; j++) if (ok(fam[j])) { BOT.pickJunk = true; return fam[j]; }
    // No raw vocabulary sweep here any more. voc is the room's accepted answers
    // ranked by frequency, so its head is Apple, Australia, Cuba, Canada: walking
    // it from 0 (reset on every category) made *every* round open with Apple and
    // then spend the turn on the words after it. A silent turn costs one heart;
    // that list cost the turn anyway and made the bot look broken.
    return '';
  }

  // A synonym of the subject is never an answer, wherever the answer came from.
  // The ban lives at send time because the model lane and the fallback tiers
  // prepend picks after begin() has already filtered the pack's own list.
  function banned(a) {
    var k = KR.norm(a);
    return !!(k && BOT.syn && BOT.syn[k]);
  }

  function next() {
    // Outside our turn nothing may be drawn from the queue. next() advances
    // BOT.idx as it looks, so typing during an opponent's turn walked the whole
    // hand and left the bot with nothing when its own turn came. Returning ''
    // keeps the index where it is, and every caller already handles an empty pick.
    if (BOT.canType === false) return '';
    // ONE answer per turn, structurally. While a word is in hand, no tier may
    // produce another: this is what stops the box cycling through candidates
    // when a submission is not registered by the room.
    if (BOT.answerInHand) return '';
    // `corpus-last:<head>` is alphabetical filler (boo, book, boom, boot for a
    // word question) and it was the single biggest rejection class: 13 of 18 in
    // one measured window. It is kept as a reserve only, behind the shape list
    // and the family tiers.
    // Two passes: an answer already given in this game is a rejection in most
    // rounds, so it is only used once nothing unused is left. Silence still
    // costs a heart, so repeats stay available as the very last resort.
    var laneUp = !!(BOT.llmPending || BOT.askPending || BOT.livePending);
    while (BOT.idx < BOT.picks.length) {
      var a = BOT.picks[BOT.idx++];
      if (!a || BOT.turnSent[KR.norm(a)] || pickedBefore(a) || saidAlready(a) || isDropped(a) || wasTried(BOT.cat || '', a) ||
          banned(a) || !answerable(a, trustedSrc(a)) || weakAfterRefusal(a) || learnedElsewhere(a)) continue;
      // A WordNet family member is a *kind of* the head noun ('acicula' for a
      // body-part question, 'dirge' for a song). While a lane that read the
      // wording is answering, that tier never wins: the model had tentacles,
      // claw, horn, feather, fang and tusks for exactly that clue.
      if (/^wordnet:/.test(String((BOT.src || {})[KR.norm(a)] || '')) &&
          (BOT.llmPending || BOT.llmGot || BOT.askPending)) {
        if (!BOT.famHoldAt || Date.now() - BOT.famHoldAt > 1500) {
          BOT.famHoldAt = Date.now();
          log({ holdFamily: a, src: (BOT.src || {})[KR.norm(a)] });
        }
        continue;
      }
      // Already said in the room - by the opponent or by us: skip it.
      if (heardWord(a)) continue;
      // Types of the head word are not instances of the answer the clue wants:
      // "dirge", "ballad", "aria" are kinds of song, not Katy Perry songs. The
      // taxonomy test is explicit here rather than relying on the relation gate.
      if (taxonomyBanned() && taxonomyGuess(a)) continue;
      if (junkFinal(a)) continue;
      if (!tiedToSubject(a)) continue;
      if (wrongRelation(a)) continue;
      // The pack's subject-level guess waits for the lane that read the wording.
      if (laneUp && guessSrc(a)) continue;
      BOT.pickJunk = false;
      return a;
    }
    // Out of knowledge: fall back to the pack's universal set once, rather than
    // freezing or looping the same answer into the room. Rare-only mode has no
    // universal set - a common answer would be the one thing it may not send.
    if (!BOT.genUsed) {
      BOT.genUsed = true;
      // Rare-only mode still needs a reserve: when the deep cuts run out, the
      // ordinary list is better than sitting silent and letting the fuse pop.
      // Even the reserve has to be deep in this mode: a Plankton sent out of
      // desperation is still a Plankton in the room.
      // The reserve must come from the same gated pool as everything else: the
      // plain resolver hands back guesses with no tier data ("here" for a soup
      // category), and an untiered word is a Plankton in the room.
      var trx = [];
      var extra = KR.resolve(BOT.cat || '', KB, { rare: RARE, deep: RARE && MINRANK >= 3, win: !RARE && MINRANK <= 0, fallback: false, softQual: true, trace: trx });
      // These arrive after begin() has run its filters, so they were the last
      // unfiltered door into the hand: WordNet's kinds-of-song (prothalamion,
      // torch song) came in here and lastChance sent them for "a Katy Perry song".
      for (var tx = 0; tx < trx.length; tx++) {
        var tn = KR.norm(trx[tx].a);
        if (tn && !BOT.src[tn]) BOT.src[tn] = trx[tx].src || '';
      }
      BOT.picks = BOT.picks.concat(extra.filter(function (a) {
        if (taxonomyBanned() && taxonomyGuess(a)) return false;
        if (MINRANK < 3) return KR.deepRank(KB, a) >= MINRANK;
        return KR.deepRank(KB, a) >= 3 && KR.hasTier(KB, KR.norm(a));
      }).slice(0, 8));
      if (BOT.picks.length > BOT.idx) return next();
    }
    // Last resort: a common answer still scores ten points and keeps the puffer
    // moving; saying nothing scores nothing at all. This is the guarantee that a
    // turn never goes by unanswered.
    if (!BOT.lastResort) {
      BOT.lastResort = true;
      // No generic reserve here: an untopical word (Pizza for a Broadway
      // musical) is a wrong answer on the board, not a turn saved.
      // The last resort has to be tied to the question too: a word that belongs
      // to no part of the category (Pizza for a gas station chain) is an
      // obviously wrong answer, and silence reads better than that.
      var tr2 = [];
      // A member of the head noun's WordNet family is a *kind* of the head
      // (folk song, torch song, prothalamion for "song"). Sending one to a clue
      // that names an artist is a wrong answer, and this tier was where the last
      // of them survived. The test is source-free so no untraced tier can hide.
      var hdJ = headWord(BOT.cat || '');
      var typeQ = TYPEQ.test(KR.norm(BOT.cat || ''));
      var famTxt = (hdJ && KB.hn && KB.hn[hdJ]) ? ('|' + KB.hn[hdJ] + '|') : '';
      var any = KR.resolve(BOT.cat || '', KB, { noGeneric: true, trace: tr2, softQual: true }).filter(function (a) {
        if (!KR.shapeOk(BOT.cat || '', a) || BOT.turnSent[KR.norm(a)] || saidAlready(a) || isDropped(a)) return false;
        if (!typeQ && famTxt && famTxt.indexOf('|' + a + '|') >= 0) return false;
        var src2 = '';
        for (var qi = 0; qi < tr2.length; qi++) { if (KR.norm(tr2[qi].a) === KR.norm(a)) { src2 = tr2[qi].src || ''; break; } }
        return /^(assoc|entity|compound|curated|prompt|corpus|synonym|learned)/.test(src2);
      });
      if (any.length) {
        BOT.picks = BOT.picks.concat(any.slice(0, 3));
        log({ lastResort: any[0], src: 'last-resort' });
        var lr1 = next();
        BOT.pickJunk = true;
        return lr1;
      }
    }
    // A shape category ("a word ending in -bound") has no family to draw on, so
    // the pack's vocabulary is filtered by the rule itself. This is the difference
    // between an empty hand and fifteen attempts while the fuse burns.
    if (BOT.sfCat !== BOT.cat) {
      BOT.sfCat = BOT.cat;
      BOT.sf = shapeWords(BOT.cat || '');
      if (BOT.sf.length) log({ shape: BOT.sf.slice(0, 3) });
    }
    while (BOT.sf && BOT.sf.length) {
      var sw = BOT.sf.shift();
      if (sw && !BOT.turnSent[KR.norm(sw)]) return sw;
    }
    // Nothing left that this turn has not used. Silence loses the heart outright,
    // so a repeat is allowed after a moment: the room accepts the same word in a
    // new round, and a repeat is a far better outcome than an empty box.
    if (Date.now() - (BOT.catAt || 0) > 2500) {
      for (var rp = 0; rp < BOT.picks.length; rp++) {
        var rpw = BOT.picks[rp];
        if (!rpw || BOT.turnSent[KR.norm(rpw)] || junkFinal(rpw)) continue;
        if (banned(rpw) || !answerable(rpw, trustedSrc(rpw)) || heardWord(rpw)) continue;
        // A repeat is only for words nobody has judged yet.
        if (isDropped(rpw) || refusedWord(rpw) || saidAlready(rpw) || pickedBefore(rpw) || wasTried(BOT.cat || '', rpw)) continue;
        if (wrongRelation(rpw)) continue;
        log({ repeat: rpw });
        // The press gate is per word per question; without this the repeat tier
        // returned a word that could never leave the box, which is silence.
        try { delete BOT.pressed[KR.norm(rpw)]; } catch (e) {}
        return rpw;
      }
      // And the shape list, which is generated rather than stored.
      if (BOT.sfCat !== BOT.cat) { BOT.sfCat = BOT.cat; BOT.sf = shapeWords(BOT.cat || ''); }
      for (var rs = 0; rs < (BOT.sf || []).length; rs++) {
        var rsw = BOT.sf[rs];
        if (rsw && !BOT.turnSent[KR.norm(rsw)] && !junkFinal(rsw) && !isDropped(rsw) && !refusedWord(rsw)) { log({ repeatShape: rsw }); return rsw; }
      }
    }

    // Final tier: the head noun's own members and the pack's generic set. A
    // topical wrong answer at least has a chance of being taken; an empty hand
    // loses the life by itself, because SEND stays disabled until text is typed.
    if (BOT.genCat !== BOT.cat) {
      BOT.genCat = BOT.cat;
      BOT.genList = genWords(BOT.cat || '');
      if (BOT.genList.length) log({ gen: BOT.genList.slice(0, 3) });
    }
    while (BOT.genList && BOT.genList.length) {
      var gw = BOT.genList.shift();
      // This tier hands words back directly, so it needs the same taxonomy check
      // as next(): it is the head noun's family, and for a property question that
      // family is the wrong relation ("bass guitar" for a guitar brand).
      if (gw && BOT.turnSent[KR.norm(gw)]) continue;
      if (gw && wrongRelation(gw)) continue;
      if (gw && (isDropped(gw) || refusedWord(gw))) continue;
      if (gw) return gw;
    }
    // Every tier is exhausted. Never leave the box empty: the room cannot accept
    // what was never sent, and an empty box loses the puffer outright.
    var lc = lastChance();
    if (lc) { BOT.pickJunk = true; log({ lastChance: lc }); return lc; }
    // Nothing left at all: record it, so "we lost the heart with an empty hand"
    // is a measurement instead of a guess.
    if (!BOT.ehAt || Date.now() - BOT.ehAt > 1200) {
      BOT.ehAt = Date.now();
      log({ emptyHand: BOT.cat, sentThisTurn: BOT.sentThisTurn, noCat: BOT.cat ? 0 : String(pageText()).slice(-50) });
    }
    BOT.missed = (BOT.missed || 0) + 1;
    return '';
  }

  // Words from the pack's own vocabulary that satisfy an explicit shape rule.
  // Only for questions that state one: the same scan on an ordinary category
  // would answer "a gas station chain" with the dictionary.
  function shapeWords(cat) {
    var out = [];
    var c = null;
    try { c = KR.constraints ? KR.constraints(cat) : null; } catch (e) { c = null; }
    if (!c) return out;
    var shaped = !!(c.pre || c.end || c.first || c.has || c.len || c.vowels || c.apos || c.hyph || (c.hasAll && c.hasAll.length));
    if (!shaped) return out;
    var src = String(KB.voc || '').split('|');
    for (var i = 0; i < src.length && out.length < 60; i++) {
      var w = src[i];
      if (!w || w.length < 3 || w.length > 24) continue;
      if (BOT.turnSent[KR.norm(w)]) continue;
      if (!KR.shapeOk(cat, w) || !answerable(w)) continue;
      out.push(w);
    }
    return out;
  }

  // The pack's generic answers plus the head noun's own family: the last resort
  // that is still about the question.
  function genWords(cat) {
    var out = [];
    var push = function (s) {
      String(s || '').split('|').forEach(function (w) {
        w = String(w || '').trim();
        if (w.length < 3 || w.length > 24) return;
        var k = KR.norm(w);
        if (!k || out.indexOf(w) >= 0 || BOT.turnSent[k] || isDropped(w) || refusedWord(w)) return;
        if (!KR.shapeOk(cat, w) || !answerable(w)) return;
        out.push(w);
      });
    };
    var head = headWord(cat);
    // These words come from the head's family, which for a property question is
    // the wrong relation entirely ("bass guitar" for a guitar *brand*). Tagging
    // them as the head's taxonomy lets the send gate refuse them unless the clue
    // really asked for a type.
    var before = out.length;
    if (head && KB.hn) push(KB.hn[head]);
    for (var gi = before; gi < out.length; gi++) {
      var gk = KR.norm(out[gi]);
      if (!BOT.src[gk]) BOT.src[gk] = 'wordnet:' + head;
    }
    if (head && KB.pk) push(KB.pk[head]);
    // NOT KB.gen (Umbrella, Water bottle, Spoon): that is a list of *things*, and
    // it answered a storybook-witch question with 32 rejections in one game.
    // The universal tier is instead the head of `voc`, the answers the room has
    // actually taken most often. A bare word has a chance of being accepted;
    // an empty hand has none, because SEND stays disabled until text is typed.
    // A lookup already on the wire is worth more than this tier: "Italy" for a
    // storybook-witch question is a rejection, and the verified list lands inside
    // the 2.5s hold. Return nothing here and let the hold run; the universal
    // words are used once the lane has actually failed.
    // Bounded: after 3s of holding, a guess beats a pop, so the universal tier
    // takes over even if the lane has not answered yet.
    if ((BOT.llmPending || BOT.askPending) && BOT.turnStart && Date.now() - BOT.turnStart < 3000) return out;
    // A drained list is a permanent silence: in a 33-category game the universal
    // tier was built once, emptied, and every later turn answered nothing. The
    // pointer walks the vocabulary instead, so the hand can always be refilled.
    // Only when the category itself could not be read. For a real question these
    // words are guaranteed rejections: "Apple, Cuba, Austria, American football"
    // answered "a green animal" in one measured game - ~20 of its 32 rejections.
    // Only when this game has never shown a readable category. `cat` alone is
    // not enough: it is empty for the moment before the clue renders, and that
    // window served the alphabetical vocabulary to a theatre-term question
    // (Apple, Australia, Cuba, Canada, Austria) in a measured loss.
    // The old "universal tier" filled the hand from the head of `voc` when the
    // clue had not rendered yet. That is the same Apple/Australia/Cuba list, it
    // led the first turn of every game, and the comment two lines up already said
    // these words are guaranteed rejections - so it is gone. What is left is the
    // head noun's own family, which is at least about the question.
    return out;
  }

  function tick() {
    try {
      // A hidden tab used to skip all work, which meant alt-tabbing stopped the bot
      // entirely. It still has to answer, so it runs slower instead.
      if (document.hidden) {
        if (Date.now() - (BOT.hiddenAt || 0) < 500) return;
        BOT.hiddenAt = Date.now();
      }
      tickBody();
    } catch (e) {
      // An exception used to abort the tick with state half-updated; now it is
      // logged and the next tick runs normally.
      try { if (!BOT.errAt || Date.now() - BOT.errAt > 2000) { BOT.errAt = Date.now(); log({ tickErr: String(e && e.message || e) }); } } catch (e2) {}
    }
  }
  function tickBody() {
    try {
      if (window.__krOwner !== ID) return;
      if (!BOT.on || !KB) return;
      var text = pageText();
      var el = input();
      var btn = sendBtn();
      // An enabled SEND button is the only state that means "answer now": the
      // caption above it changes between rounds ("your puffer", "NEW", ...) and
      // trusting it cost whole turns. The caption is still used to notice that
      // the puffer has left us.
      // A missing button is not "not our turn": the room swaps the SEND element
      // on re-render, and treating that frame as idle is how a ready answer was
      // never sent. Only an explicitly disabled button means we cannot send.
      var active = !!(el && (!btn || !btn.disabled));
      // "Your turn" has to be recognised by every shape the room uses, because
      // missing it is indistinguishable from being asleep: the caption is
      // "your puffer · type an answer" on some layouts and "▸ Buffy is up" on
      // others, and SEND is disabled until the box has text, so an enabled-button
      // test alone is false for the whole turn. The input and SEND are only
      // mounted while it is our turn, so their presence is the real signal.
      var ourName = 'Buffy';
      try { ourName = BOT.name || localStorage.getItem('kr_name') || 'Buffy'; } catch (e) { ourName = 'Buffy'; }
      // Whose turn it is has to be read by name. The old fallback treated any
      // "▸ <player> is up" as ours - including an opponent's - which made every
      // turn look like ours and drained the answer queue between them.
      var upName = '';
      var upM = text.match(/\u25b8\s*([^\n\u25b8]{1,24}?)\s+is up/i);
      if (!upM) upM = text.match(/([A-Za-z0-9_.-]{2,20})\s+is up/i);
      if (upM) upName = String(upM[1] || '').trim();
      var otherUp = !!upName && upName.toLowerCase() !== String(ourName).toLowerCase();
      var capMine = /your puffer/i.test(text) ||
        new RegExp('\\u25b8\\s*' + String(ourName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+is up', 'i').test(text) ||
        (/\bis up\b/i.test(text) && !otherUp);
      // "Elements exist" is not "it is our turn": the input and SEND stay mounted
      // between turns, so this used to be true forever. Everything downstream
      // depended on it - the accepted/refused branch never ran, the turn budget
      // never reset, and after one answer the bot had nothing left to say for the
      // rest of the question. Our turn means the caption says so, or the room has
      // not named anyone else and SEND is usable.
      var mine = capMine || (!otherUp && active);
      // "mine" is true almost always - the input and SEND stay mounted between
      // turns - so it cannot decide whether to spend an answer. Typing during
      // someone else's turn walks the queue (every next() advances BOT.idx) and the
      // unconditional send fired those words into the room, which is how the bot
      // arrived at its own turn with an empty hand. Only a positive caption means
      // it is really our turn.
      BOT.ourTurn = !!capMine;
      if (BOT.ourTurn) BOT.sawTurnAt = Date.now();
      // If the caption has never once said it was our turn, this layout's wording
      // is simply not recognised: fall back to the old behaviour rather than sit
      // silent for a whole game.
      BOT.turnBlind = !BOT.sawTurnAt && !otherUp && Date.now() - (BOT.catAt || Date.now()) > 2500;
      // An explicit "<other player> is up" is never overridden by the blind
      // fallback: that is the one case where we know for certain it is not us.
      // But if the room names us something other than the name this script guesses,
      // every turn would look like someone else's and the bot would go silent for a
      // whole game. A player's turn lasts a few seconds, so a single category that
      // stays "someone else is up" for nine seconds with nothing sent means the
      // guess is wrong: assume it is ours and log it.
      if (otherUp) { if (!BOT.otherUpAt) BOT.otherUpAt = Date.now(); } else { BOT.otherUpAt = 0; }
      // 20s, not 9: a real opponent's turn is a few seconds, and this fallback
      // must never be able to fire during one - it did at 9s in testing and spent
      // a whole hand on someone else's turn. Losing one round to a name mismatch
      // is the price of never doing that again; the name is learned from that
      // round onwards, so it happens once.
      if (otherUp && !BOT.sentThisTurn && BOT.otherUpAt && Date.now() - BOT.otherUpAt > 20000) {
        log({ assumeTurn: upName, ours: ourName, why: 'name mismatch, 9s with nothing sent' });
        BOT.otherUpAt = 0;
        otherUp = false;
        BOT.ourTurn = true;
        // Adopt the name the room used, so this costs one slow turn instead of
        // every turn: from here on the caption reads as ours and the bot keeps its
        // normal timing.
        if (upName && upName !== ourName) {
          BOT.name = upName;
          ourName = upName;
          try { localStorage.setItem('kr_name', upName); } catch (e) { /* private mode */ }
          log({ learnedName: upName });
        }
      }
      BOT.canType = BOT.ourTurn || (BOT.turnBlind && !otherUp);
      var gone = /you're out|watching/i.test(text);
      // The guarantee: a filled box is sent - but only once it is our turn to
      // send it. Sending on an opponent's turn got the words refused and spent.
      // A new turn starts a new budget: one answer, not the whole hand. The room
      // flickers its caption between renders, and every false->true flicker used to
      // hand back a fresh budget - which is a whole queue of guesses inside one
      // real turn. It only counts as a new turn if the page actually showed
      // somebody else for a moment and our last answer is not still in flight.
      // How long the page actually showed somebody else, measured as a span:
      // comparing "last not-mine tick" to "now" is always ~0 at the edge and made a
      // real new turn look like a flicker.
      if (!mine) {
        // Start of a new "someone else" stretch: clear the old measurement, or a
        // long gap from earlier gets reused on every later flicker and mints a
        // new budget each time.
        if (!BOT.notMineFrom) { BOT.notMineFrom = Date.now(); BOT.offGap = 0; }
      } else if (BOT.notMineFrom) {
        BOT.offGap = Date.now() - BOT.notMineFrom;
        BOT.notMineFrom = 0;
      }
      // A real opponent turn lasts seconds. Requiring the page to have shown
      // somebody else for 700ms, and 1.2s since our last answer, keeps a
      // re-rendering caption from minting new budgets the whole time.
      var realTurnEdge = mine && mine !== BOT.wasMine && (BOT.offGap || 0) > 700 &&
        Date.now() - (BOT.sentAt || 0) > 1200;
      if (realTurnEdge) {
        BOT.offGap = 0;
        BOT.answerInHand = '';
        BOT.retypes = 0;
        BOT.sentThisTurn = 0;
        // A new round is a new turn even when the room repeats the same wording
        // ("2/2" of the same category). Keeping every word from the previous
        // round marked 'sent this question' emptied the hand: the badge read
        // 'left: 0' and the bot sat silent with a full pack behind it.
        BOT.turnSent = {};
        BOT.lastSubmitted = null;
        BOT.failedWord = '';
        BOT.deliveredFor = '';
        BOT.catBad = 0;
        BOT.clickedAt = 0;
        BOT.readyAnswer = '';
        BOT.readyTries = 0;
        BOT.expect = null;
        BOT.pickJunk = false;
        log({ newTurn: BOT.cat });
      }
      BOT.wasMine = mine;
      try { if (BOT.canType) forceReadySend(el, btn); } catch (e) { /* never break the tick */ }
      // Whatever happened last tick, a correct answer left in the box is retried
      // here until it actually goes out.
      try { ensureSent(el, btn); } catch (e) { /* never break the tick */ }
      // The live channel: this is what makes the game watchable while it runs.
      try { postLive(); } catch (e) { /* never break the tick */ }
      try { flushCmd(); } catch (e) { /* never break the tick */ }
      if (mine) {
        if (!BOT.turnStart) BOT.turnStart = Date.now();
      } else {
        BOT.turnStart = 0;
      }
      // Sample every page change, not only our own turns: the turns that killed us
      // produced no log line at all, so the sample is the only record of what the
      // room showed while we were being eliminated.
      var seen = (window.__krSeen = window.__krSeen || []);
      var tail120 = text.slice(-120);
      var lastSeen = seen[seen.length - 1];
      if (!lastSeen || lastSeen.t !== tail120) {
        seen.push({ ms: Date.now(), a: active ? 1 : 0, m: mine ? 1 : 0,
                    el: el ? 1 : 0, btn: btn ? 1 : 0, dis: btn && btn.disabled ? 1 : 0,
                    t: tail120 });
        if (seen.length > 300) seen.shift();
      }

      // Resolve the moment the category text appears, whoever is up. By the time
      // SEND enables the candidates are already in memory, so the first live tick
      // answers in the same frame. lastCat keeps us from re-resolving the same
      // wording every tick after a turn clears BOT.cat.
      var catNow = category(text);
      if (catNow) {
        // Key on the normalized wording: the room appends a fuse count and
        // re-renders the same clue, and re-beginning mid-turn used to wipe the
        // candidate list and the sent-this-turn memory.
        var keyNow = KR.norm(catNow);
        var junk = /^(floating|new category|category|send|\d+|[\d\s\/]+)$/i.test(keyNow);
        if (!junk && keyNow !== BOT.lastKey) {
          BOT.lastKey = keyNow;
          begin(catNow);
        }
        // The room asks the same wording twice: a clue can repeat within a game,
        // and the next round can reuse it verbatim. Keying only on the words made
        // that a dead turn - the second "Name a color" got no answer at all,
        // because the text never changed. A turn that was answered, whose box is
        // empty again and which has been idle for a few seconds is a new turn even
        // when the words are identical. The send counter gates it, so it cannot
        // loop on a single turn.
        else if (!junk && BOT.sentThisTurn > 0 && BOT.sentAt &&
                 Date.now() - BOT.sentAt > 3000 &&
                 (!BOT.rebeginAt || Date.now() - BOT.rebeginAt > 4000)) {
          var eSame = input();
          if (eSame && !eSame.value) {
            BOT.rebeginAt = Date.now();
            begin(catNow);
          }
        }
      }

      // The room can render a short clue first and the full wording a moment
      // later. Until something is sent, a longer version of the same clue is a
      // different question and must be resolved again - otherwise the bot
      // answers a truncated label it never actually read.
      if (catNow && BOT.cat && !BOT.sentThisTurn && catNow.length > BOT.cat.length &&
          KR.norm(catNow).indexOf(KR.norm(BOT.cat)) === 0) {
        BOT.lastKey = KR.norm(catNow);
        begin(catNow);
      }

      if (BOT.sentAt && !mine) {
        // The puffer moved on and the room never complained: the answer landed.
        // The word is the one submitted, whether or not the room already cleared
        // the box (which it usually has by the time the turn moves on).
        // The verdict belongs to the word actually pressed. A different word may
        // already be sitting in the box by the time the turn moves on, and
        // learning *that* one taught the bot its next guess was accepted.
        var okWord = (BOT.current && (BOT.pressed || {})[KR.norm(BOT.current)])
          ? BOT.current
          : (BOT.lastSubmitAnswer || (BOT.lastSubmitted && BOT.lastSubmitted.a) || BOT.current || '');
        learn('ok', BOT.cat, okWord);
        BOT.okThisGame = (BOT.okThisGame || 0) + 1;
        catBump(BOT.cat, 'ok');
        log({ ok: okWord });
        BOT.answerInHand = '';
        BOT.retypes = 0;
        BOT.sentAt = 0;
        BOT.current = '';
        var keepAnswer = input();
        if (keepAnswer && keepAnswer.value) setValue(keepAnswer, '');
        // The same question usually stays on the board for the next round. Clearing
        // the category without re-resolving it left the following turn with an
        // empty hand - the bot sat there with nothing to say for the rest of the
        // question. Re-resolve it now instead.
        var keepCat = BOT.cat;
        BOT.cat = '';
        if (keepCat && /[a-z]/i.test(String(keepCat))) begin(keepCat);
        return;
      }
      if (gone) { BOT.out = true; if (BOT.logCat) postGameLog(BOT.logCat); return; }
      if (!mine) return;

      var curW = (BOT.current && (BOT.pressed || {})[KR.norm(BOT.current)])
        ? BOT.current
        : (BOT.lastSubmitAnswer || (BOT.lastSubmitted && BOT.lastSubmitted.a) || BOT.current || '');
      if (BOT.sentAt && (refused(text, curW) || /try again|not valid/i.test(text))) {
        learn('bad', BOT.cat, curW);
        // Rejections are remembered for the whole session, not just this
        // category: repeating "aden, agra, apia, baku" in the next city question
        // burned a second turn on the same four wrong answers.
        BOT.badAll = BOT.badAll || {};
        BOT.badAll[KR.norm(curW)] = 1;
        catBump(BOT.cat, 'bad');
        catWord(BOT.cat, curW);
        log({ bad: curW });
        BOT.resendN = 0;
        try { delete BOT.pressed[KR.norm(curW)]; } catch (e) {}
        // Refused by the room: never offer it again for this wording, and get a
        // second opinion from the model rather than the next pack guess.
        dropAnswer(curW, 'refused');
        askMore(BOT.cat || '');
        BOT.answerInHand = '';
        BOT.lastSubmitted = null;
        BOT.rejected++;
        // Two wrong answers in one category is enough: "a movie starring
        // Zendaya" took eleven of them, and every rejection is a turn the room
        // counted as a miss. The next category is worth more than the third
        // guess at this one.
        // A rejected word from a verified list is worth one more try at the same
        // category; a rejected *guess* is not. The association reserve produced
        // "bent" and "bird" for baseball positions, and each one cost a turn.
        var badSrc = (BOT.src || {})[KR.norm(BOT.current)] || '';
        var badTrusted = /^(learned|curated|prompt|corpus|entity|compound|synonym)/.test(badSrc);
        // A rejected guess does not end the category while a verified list is
        // still on the wire: the model's answers arrive a second or two later and
        // they are the ones that pass the puffer. Giving up here is how a good
        // answer was thrown away after the first wrong guess.
        var pendingList = BOT.llmPending || BOT.askPending;
        // One extra try while a verified list is on the wire, not an open bar:
        // two rejected guesses end the category even then, so a lane that never
        // answers cannot turn the turn into a stream of wrong answers.
        BOT.catBad = (BOT.catBad || 0) + (badTrusted ? 1 : (pendingList ? 1 : 3)); BOT.refusedAt = Date.now();
        BOT.sentAt = 0;
        BOT.current = '';
        // The room refused this *source*, not just this word: one refusal from
        // `corpus:shoe` was followed by nine more from the same bucket. Remember
        // the source so the rest of that bucket is deferred, not streamed.
        if (badSrc) {
          BOT.badSrc = BOT.badSrc || {};
          BOT.badSrc[badSrc] = (BOT.badSrc[badSrc] || 0) + 1;
        }
        BOT.cool = Date.now() + 60;      // let the room's message settle
        var el0 = input();
        if (el0) setValue(el0, '');
      }

      // No early return on an empty hand: next() can still answer a shape
      // question from the vocabulary, and returning here is what let the fuse
      // pop on "a word ending in -bound" without a single attempt.
      if (!el) return;
      // Send button optional: pressEnter() submits when the room has not rendered
      // one yet, so no turn is ever lost to a missing element.
      if (!btn) btn = sendBtn();

      // A value in the box that we did not type in full is a half-written word
      // ("poly", "olyester"): rewrite it rather than submit it. Clicking here is
      // what put fragments in the room's answer log.
      // Compare normalised: the room trims and re-capitalises what it receives,
      // and a strict compare against the typed string looped forever without ever
      // submitting - a ready answer that never left the box.
      if (el.value && KR.norm(el.value) !== KR.norm(BOT.current || '')) {
        setValue(el, BOT.current || '');
        BOT.armedAt = Date.now() + 45;
        BOT.armTries = (BOT.armTries || 0) + 1;
        // Three frames of disagreement is the room's doing, not ours: send what
        // is actually in the box rather than lose the turn to a cosmetic diff.
        if (BOT.armTries > 3) {
          BOT.armTries = 0;
          BOT.current = String(el.value || BOT.current || '');
        }
        return;
      }
      BOT.armTries = 0;

      // No category on screen means no answer exists: in the lobby this typed
      // "Apple" into the name field. The room only has a question when a clue is
      // rendered, and begin() is what records it.
      if (!el.value && BOT.cat) {
        // The turn's answer is already decided. If the box is empty again, this
        // word goes back in; the next candidate is only drafted once the room has
        // answered this one.
        // A word already sent, already heard in the room, or otherwise unusable is
        // not re-entered: that loop typed 'cut' 72 times and 'arena' 354 times in
        // one turn and never tried anything else.
        // Already submitted and the box is empty again: the room took the word.
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
        }
        if (BOT.answerInHand) {
          // A word typed back this many times without the room taking it is not
          // going to go. Drop it and let the next candidate through. Without this
          // the same word was re-armed every 350ms for the whole turn: the only
          // exits were 'delivered' and 'spent', so a word the room quietly refused
          // looped until the fuse - the "it won't move to a different answer" bug.
          if ((BOT.retypes || 0) >= 2) {
            var stuckW = BOT.answerInHand;
            log({ handStuck: stuckW, n: BOT.retypes });
            dropAnswer(stuckW, 'stuck');
            askMore(BOT.cat || '');
            BOT.needLane = true;
            advancePastSpent();
            return;
          }
          // The turn has its answer. It goes back in as many times as it takes:
          // a different word is only ever drafted after the room has refused this
          // one (a 'bad'), and a new question starts a new turn anyway. Cycling
          // through candidates is now impossible, not merely discouraged.
          BOT.retypes = (BOT.retypes || 0) + 1;
          // Refill at most three times a second: the answer is the same word, so a
          // faster loop is just the box flickering.
          if (Date.now() - (BOT.lastArmAt || 0) < 350) return;
          BOT.lastArmAt = Date.now();
          BOT.current = BOT.answerInHand;
          setValue(el, BOT.answerInHand);
          BOT.armedAt = Date.now() + 60;
          if (BOT.retypes <= 3 || BOT.retypes % 6 === 0) {
            log({ rearm: BOT.answerInHand, n: BOT.retypes });
          }
          return;
        }
        // One answer at a time. The room does not always register a synthetic
        // Enter, and the old behaviour was to type the next candidate anyway:
        // five different words cycled through the box in one turn with nothing
        // submitted. While the last word is unconfirmed, put that word back.
        var ls = BOT.lastSubmitted;
        // Only while the word is still this turn's live attempt: a word the room
        // took (deliveredFor / in its feed) or one that is already spent must not
        // be typed back in. Re-entering it is the repeat the player hears.
        // A word that was already PRESSED is never retyped: the press ladder below
        // keeps pressing it. Retyping it is how one answer went into the room
        // twice - the second copy came back as 'already said' and cost the turn.
        if (ls && ls.a && (BOT.resendN || 0) < 2 && Date.now() - ls.at < 4000 &&
            !(BOT.pressed || {})[KR.norm(ls.a)] &&
            !isSpent(ls.a) && !feedHas(ls.a) &&
            KR.norm(BOT.deliveredFor || '') !== KR.norm(ls.a) &&
            pageText().length <= (ls.len || 0) + 4) {
          BOT.resendN = (BOT.resendN || 0) + 1;
          BOT.current = ls.a;
          setValue(el, ls.a);
          BOT.armedAt = Date.now() + 60;
          log({ retype: ls.a, n: BOT.resendN });
          return;
        }
        var a = next();
        // A lane that answered this wording outranks the pack's filler tiers, and
        // after a refusal it is the only thing allowed to answer: 'cut' for a
        // tennis question, 'blake' for anything, are what the pack's near-miss
        // tiers produce while serve/forehand/backhand sit in the queue.
        if (a && (BOT.needLane || BOT.llmGot || BOT.liveGot || BOT.learnGot)) {
          var lp = null;
          // Learned (accepted in this room before) and live lookups first; the raw
          // model line is the last lane choice. qwen called 'Infinity' a Pixar
          // movie while 'Finding Nemo' sat in the learned list.
          for (var lpass = 0; lpass < 2 && !lp; lpass++) {
            for (var lpi = 0; lpi < BOT.picks.length; lpi++) {
              var lpw = BOT.picks[lpi];
              if (!lpw || BOT.turnSent[KR.norm(lpw)] || isSpent(lpw)) continue;
              // 'gymkhana' was refused for an Aladdin clue and then offered again
              // by this very loop, because a force-sent word was never marked as
              // tried. Anything this room has already seen is out.
              if ((BOT.gameSent || {})[KR.norm(lpw)]) continue;
              if ((BOT.badAll || {})[KR.norm(lpw)]) continue;
              // The lane choice is a pick like any other: a word this category
              // already gave the room never comes back through it. This loop was
              // the last door that could re-offer one.
              if (saidAlready(lpw)) continue;
              if (isDropped(lpw)) continue;
              if (wasTried(BOT.cat || '', lpw)) continue;
              if (learnedElsewhere(lpw)) continue;
              if (feedHas(lpw)) continue;
              var lsrc = String((BOT.src || {})[KR.norm(lpw)] || '');
              if (lpass === 0 ? /^(learned|live)/.test(lsrc) : /^(llm|ai|ask)/.test(lsrc)) { lp = lpw; break; }
            }
          }
          if (lp) { a = lp; log({ laneRetry: lp, src: (BOT.src || {})[KR.norm(lp)] || '' }); }
        }
        if (!a) {
          // Nothing left in the hand: re-ask the model rather than stand still.
          if (BOT.canType !== false && !BOT.answerInHand && !BOT.current && askMore(BOT.cat || '')) return;
          // The fuse is ~7.7s, so a missing answer does not have to be sent
          // instantly: hold the turn open and keep asking, which is the whole
          // difference between "unknown" and "silent".
          var nowW = Date.now();
          if (!BOT.turnStart) BOT.turnStart = nowW;
          var waited = nowW - BOT.turnStart;
          // Hold a little longer while the local model is still answering: it
          // needs ~5s, and giving up at 5.2s sent junk roughly a second before the
          // right answers arrived. Without a lane on the wire the old limit holds,
          // so an empty hand still never sits until the fuse pops.
          // Waiting for the model is worth a couple of seconds, never five: the
          // local model's first line lands in ~0.3-0.8s, so a hold that has
          // outlived the ask it is waiting on is just an empty box losing the
          // heart. Past that the bot types its best remaining answer instead.
          if (waited < ((BOT.llmPending || BOT.askPending) && Date.now() - (BOT.askMoreAt || 0) < 2600 ? 3200 : 2200)) {
            if (!BOT.retryAt || nowW > BOT.retryAt) {
              BOT.retryAt = nowW + 1400;
              if (!BOT.unknown) askLookup(BOT.cat || '');
              if (window.__krStream === false) llmLookup(BOT.cat || '', BOT.needLane);
              if (BOT.needLane) knowLookup(BOT.cat || '');
              // Unknown categories keep asking the racing endpoint: its lanes are
              // quota-limited and a failed one must be retried, not remembered.
              if (BOT.unknown && !BOT.knowGot) knowLookup(BOT.cat || '');
            }
            if (!BOT.ehAt || nowW - BOT.ehAt > 1200) {
              BOT.ehAt = nowW;
              log({ waiting: BOT.cat, ms: waited });
            }
            return;
          }
          // Fuse nearly out: an answerable word beats an empty box.
          var d = desperate();
          if (d) {
            BOT.current = d;
            setValue(el, d);
            BOT.armedAt = Date.now() + 60;
            log({ desperate: d, ms: waited });
            return;
          }
          if (!BOT.ehAt || nowW - BOT.ehAt > 1200) {
            BOT.ehAt = nowW;
            log({ emptyHand: BOT.cat, ms: waited, sentThisTurn: BOT.sentThisTurn });
          }
          return;
        }
        BOT.turnStart = 0;
        BOT.retryAt = 0;
        // Final gate before the text leaves the picker: a kind of the head word
        // ("dirge", "ballad", "aria" for song) is never an instance of it, and this
        // is the call site that was writing it into the box.
        if (taxonomyBanned() && (taxonomyGuess(a) || familyWord(a))) {
          log({ blockedType: a, src: (BOT.src || {})[KR.norm(a)] || '', fam: familyWord(a) });
          BOT.current = '';
          return;
        }
        // Last gate: filler, the clue's own noun, and anything too short to be a
        // name never reach the box, whatever tier produced them.
        if (junkFinal(a)) {
          log({ blockedJunk: a, src: (BOT.src || {})[KR.norm(a)] || '' });
          BOT.current = '';
          return;
        }
        if (!tiedToSubject(a)) {
          log({ blockedSubject: a, src: (BOT.src || {})[KR.norm(a)] || '', subj: subjectToken() });
          BOT.current = '';
          return;
        }
        BOT.answerInHand = a;
        BOT.retypes = 0;
        if (/^(llm|live|learned|ai|ask)/.test(String((BOT.src || {})[KR.norm(a)] || ''))) BOT.needLane = false;
        BOT.current = a;
        setValue(el, a);
        // Typing is not instant: React's controlled input can still hold the
        // previous, shorter value for a frame or two. Sending inside that window
        // is how "j", "d" and "polyester" reached the room.
        BOT.armedAt = Date.now() + 55;
      }

      var b2 = sendBtn();
      // A dozen tries in one turn is already far past useful: each rejection is
      // a wrong answer in the room's log, and a flood looks nothing like a
      // person playing.
      // If the live lookup for this category is still on the wire, give it a
      // moment before spending the turn on the pack's own guess - but never for
      // long enough to miss the turn.
      // With nothing qualifier-aware in the pack, the live lookup IS the answer
      // source: it is worth a couple of seconds of the puffer to avoid sending
      // guesses that have nothing to do with the question.
      // The model lane is the one source that can answer a category nobody has
      // indexed, and a fast lane needs a couple of seconds; a wrong guess needs
      // none. Waiting on it is worth more than the pack's bare head-noun guess.
      // NOTHING waits for the network. The puffer only advances on an accepted
      // answer and the fuse runs while we hold it, so time spent waiting for a
      // lookup is time spent closer to popping. A reply that arrives after the
      // turn is worth nothing; the answer already in memory is worth a pass now.
      // The lookups still run in the background and their answers are cached for
      // the next turn or the next game.
      // The only deliberate pause left: if the answer we are about to send is a
      // bare head-noun guess and a verified list is already on the wire, 450ms is
      // worth paying to send a real answer instead of a rejection (a rejection
      // costs more than that, and passes nothing). A verified answer never waits.
      var topSrc = (BOT.src || {})[KR.norm(BOT.picks[BOT.idx] || '')] || '';
      var unsure = !/^(learned|curated|prompt|corpus-near|corpus-rule|corpus-[a-z]+\+|entity:|compound:|synonym)/.test(topSrc);
      // The category is on screen while the opponent answers, so the model lane
      // usually starts before our turn. A model answer is verified for this
      // wording and passes the puffer; a guess does not. 1.2s is the most it is
      // worth holding for that trade.
      var llmSoon = BOT.weak && BOT.llmPending && !BOT.llmGot;
      // 1.2s, not 2.5s: the raced lane answers in ~0.9s, and every millisecond
      // spent holding is fuse that cannot be earned back. The hold is logged so
      // it can be counted against the life budget instead of guessed at.
      // A blind-only hand is a certain loss, so the hold can be much longer than
      // 1.2s without making the outcome worse: measured 12 certain rejections on
      // a "Wizard of Oz character" category that a 3.5s wait would have beaten.
      var blindHold = BOT.blindOnly && (BOT.llmPending || BOT.askPending) ? 3500 : 0;
      // Hard ceiling on any hold. The old 3.5s blind hold meant a ready answer
      // sat unsent for half the fuse, which is indistinguishable from being silent
      // and loses the turn anyway. 900ms is the most holding is ever worth.
      // Inside the fuse there is room to let the model answer instead of sending
      // the pack's guess: a wrong word costs a retry AND a turn, while 1.4s costs
      // only time the fuse already charges. A trusted answer never waits.
      // For a category the pack cannot answer at all, the fetched list is the
      // only real answer: waiting for it is worth 2.6s of the fuse, because the
      // alternative is a known-wrong guess. Sending resumes the moment it lands.
      // begin() clears turnStart on the same tick the first send is considered,
      // which made the hold below unreachable exactly when it mattered: the first
      // turn of an unknown category, before the fetched list has landed.
      if (!BOT.turnStart) BOT.turnStart = Date.now();
      var unknownHold = BOT.unknown && !BOT.knowGot && !BOT.llmGot ? 1600 : 0;
      // The learned list is a loopback file read, so it lands in a few
      // milliseconds - but not before the first tick. Without this hold the pack's
      // own guess gets typed and sent in that window, which is how "bike" beat the
      // room-verified "car key" on a category the server already knew.
      var learnHold = (BOT.learnPending || BOT.learnGot) && BOT.sentThisTurn === 0 && BOT.turnStart && Date.now() - BOT.turnStart < 250 ? 250 - (Date.now() - BOT.turnStart) : 0;
      // A weak category is one the pack has no evidence for, so waiting is worth
      // it: the model answers in 2-6s and its list is about the wording. Sending a
      // head-noun guess at 1.4s is how "an NBA player" got teams.
      var laneWait = (BOT.llmPending || BOT.askPending || BOT.livePending || BOT.learnPending) ? 2000 : 0;
      // While the model is actually generating an answer to this wording, give it
      // until 4.5s of the turn: a pack guess for a category the pack does not know
      // is a wrong answer, and 4.5s + the press ladder still fits inside the fuse.
      // Only a guess waits for the model. A word that came from the store, an entity
      // list or the lane itself is the answer already - holding it for 2.2s was
      // what pushed the first press to 2.0s and the dead-word drop to 2.6s.
      var curSrcW = String((BOT.src || {})[KR.norm(BOT.current || '')] || '');
      var curWWeak = !curSrcW || /^(gen|voc|shape|last-resort|wordnet|generic|corpus|assoc|compound|synonym|syn|curated|prompt|know|wiki)/.test(curSrcW);
      var modelWait = (curWWeak && BOT.llmPending && BOT.sentThisTurn === 0 && !BOT.llmGot &&
        (BOT.weak || BOT.unknown || !BOT.picks.length)) ? 2200 : 0;
      var waitFor = Math.max(unknownHold, learnHold, modelWait, unsure ? Math.min(3500, laneWait) : 0);
      var waiting = waitFor > 0;
      if (waiting && BOT.turnStart && Date.now() - BOT.turnStart < waitFor && BOT.sentThisTurn === 0) {
        if (!BOT.holdLogged) { BOT.holdLogged = true; log({ hold: waitFor, cat: BOT.cat }); }
        return;
      }
      // Three tries is enough to show the room a guess was wrong; a page of them
      // is what "typing random answers" looked like.
      // Volume is the win condition: the puffer moves one step per accepted
      // answer, so the more the room takes the less time it spends with us.
      // Each attempt costs ~0.4s and the fuse is about 7.7s: a dozen attempts is
      // all one turn can afford, and past that the rejections themselves pop us.
      // One guess per turn. The room takes a single answer per turn - the queue of
    // twelve was written for a fast re-try after a refusal, but on the real board
    // it fired four extra words into the same turn, and every one of them was
    // spent. A confirmed refusal buys exactly one more attempt in that turn.
    var cap = 1 + ((BOT.catBad || 0) > 0 ? 1 : 0);
      var giveUp = (BOT.catBad || 0) >= 2;
      // Giving up is not free: the puffer stays with us and the fuse keeps
      // running, so staying quiet loses the life outright. A guess can still be
      // accepted, so after two rejections the turn is bounded, not ended.
      // Every rejection still costs a turn, but staying quiet costs the life, so
      // the cap stays the cap: the room's own "no echo" is the feedback.
      var turnCap = cap;
      // A ready answer must always leave the box. The old guard skipped sending
      // entirely when a SEND button existed but was disabled - React lags its
      // enabled state one frame behind the input event, and a button caught mid-
      // animation stays disabled for longer - which is exactly "it typed the answer
      // and never pressed enter". A disabled button is now a reason to use Enter,
      // never a reason to sit on the answer.
      // Hard floor, independent of turn detection: never two submissions inside
      // 2.5s. A real turn lasts seconds, so this never limits a legitimate answer,
      // but it caps any runaway - a caption that keeps re-rendering, a stray
      // budget reset - at one guess per 2.5s instead of a queue.
      if (BOT.canType && Date.now() - (BOT.lastSubmitAt || 0) > 2500 &&
          BOT.sentThisTurn < turnCap && Date.now() - BOT.clickedAt > 60 && Date.now() > BOT.cool) {
        // Last check before spending the turn: the box must hold exactly the
        // answer we mean to send, and it must have held it long enough for the
        // room's own state to catch up.
        // A fresh turn must not retype the word this game already entered - the
        // room refused it, and re-entering it is both a wasted turn and the exact
        // "it typed hydrogen again" behaviour.
        if (pickedBefore(BOT.current)) advancePastSpent();
        if (el.value !== BOT.current) {
          setValue(el, BOT.current);
          BOT.armedAt = Date.now() + 55;
          return;
        }
        if (BOT.armedAt && Date.now() < BOT.armedAt) return;
        // Absolute veto, at the last point before the room sees the word. A member
        // of the head noun's WordNet family is a *kind* of the head word: for
        // "song" that list opens dirge, ballad, aria, lied, ditty - which is what
        // "Name a Katy Perry song" was answered with. Several desperation tiers
        // walk that list, so the one gate that cannot be bypassed lives here.
        if (taxonomyBanned() && (BOT.famVetoN || 0) < 8) {
          var hdV = headWord(BOT.cat || '');
          if (hdV && KB.hn && KB.hn[hdV]) {
            BOT.famVeto = BOT.famVeto || {};
            var famMap = BOT.famVeto[hdV] || (BOT.famVeto[hdV] = (function (s) {
              var m = {};
              String(s).split('|').forEach(function (w) { var k = KR.norm(w); if (k) m[k] = 1; });
              return m;
            })(KB.hn[hdV]));
            if (famMap[KR.norm(BOT.current)]) {
              BOT.famVetoN = (BOT.famVetoN || 0) + 1;
              log({ famVeto: BOT.current, head: hdV });
              BOT.current = next();
              return;
            }
          }
        }
        var submit = BOT.current;
        // A last-resort word is held while the model is still answering: the song
        // question got "dirge" into the room a second before Firework and Roar
        // arrived. The hold never outlasts the fuse - after ~5.4s the junk goes
        // out, because a weak guess beats a lost life.
        if (BOT.pickJunk) {
          if (!BOT.myTurnAt || Date.now() - BOT.myTurnAt > 6000) BOT.myTurnAt = Date.now();
          // Wait out the model while it is still answering (it needs ~5-6s); with no
          // lane on the wire the short hold is enough.
          var holdJunkUntil = (BOT.llmPending || BOT.askPending) ? 6800 : 5200;
          if (Date.now() - BOT.myTurnAt < holdJunkUntil) {
            if (!BOT.holdJunkAt || Date.now() - BOT.holdJunkAt > 900) {
              BOT.holdJunkAt = Date.now();
              log({ holdJunk: submit, ms: Date.now() - BOT.myTurnAt });
            }
            return;
          }
        } else {
          BOT.myTurnAt = 0;
        }
        // A pack word does not go out while a lane that read the wording is still
        // answering: 'cut' was sent for a tennis question while serve/forehand/
        // backhand were a second away. The hold never outlasts the fuse.
        var srcNow = String((BOT.src || {})[KR.norm(submit)] || '');
        // Nothing of low or unknown provenance goes out in the first three seconds:
        // that window is when the lanes answer, and it is exactly the window that
        // sent 'cut' for a tennis question and 'blake' for whatever came next.
        var fillerSrc = !srcNow || /^(gen|voc|shape|last-resort|wordnet|corpus|assoc|compound|synonym|syn|curated|prompt|entity|know|wiki)/.test(srcNow);
        if (fillerSrc && Date.now() - (BOT.catAt || 0) < 5000) {
          if (!BOT.holdFillerAt || Date.now() - BOT.holdFillerAt > 900) {
            BOT.holdFillerAt = Date.now();
            log({ holdFiller: submit, src: srcNow });
          }
          return;
        }
        if ((BOT.llmPending || BOT.askPending) &&
            !/^(llm|live|learned|ai|ask)/.test(srcNow)) {
          if (!BOT.myTurnAt) BOT.myTurnAt = Date.now();
          if (Date.now() - BOT.myTurnAt < 3600) {
            if (!BOT.holdLaneAt || Date.now() - BOT.holdLaneAt > 900) {
              BOT.holdLaneAt = Date.now();
              log({ holdForLane: submit, src: srcNow });
            }
            return;
          }
        }
        if (window.__krPaused) return;
        if (holdWeak((BOT.src || {})[KR.norm(submit)])) {
          if (!BOT.holdWeakAt || Date.now() - BOT.holdWeakAt > 1200) {
            BOT.holdWeakAt = Date.now();
            log({ holdWeak: submit, src: (BOT.src || {})[KR.norm(submit)] || '' });
          }
          return;
        }
        BOT.pressed = BOT.pressed || {};
        if (BOT.pressed[KR.norm(submit)]) {
          log({ alreadyPressed: submit });
          BOT.current = '';
          BOT.answerInHand = '';
          try { setValue(el, ''); } catch (e) {}
          return;
        }
        BOT.pressed[KR.norm(submit)] = Date.now();
        BOT.clickedAt = Date.now();
        BOT.pending = { answer: submit, at: Date.now(), tries: 0 };
        BOT.lastSubmitAnswer = submit;
        BOT.lastSubmitAt = Date.now();
        BOT.readyAnswer = submit;
        BOT.readyAt = Date.now();
        BOT.readyTries = 0;
        BOT.expect = { a: submit, at: Date.now(), n: 0, len: pageText().length };
        markSpent(submit);
        if (b2 && !b2.disabled) b2.click();
        else {
          // No usable button: the room's form still takes Enter.
          pressEnter(el);
          log({ enterFallback: submit, dis: !!(b2 && b2.disabled), btn: !!b2 });
        }
        BOT.sent++;
        BOT.sentThisTurn++;
        BOT.turnSent[KR.norm(submit)] = 1;
        (BOT.gameSent = BOT.gameSent || {})[KR.norm(submit)] = 1;
        markTried(BOT.cat, submit);
        BOT.sentAt = BOT.clickedAt;
        catBump(BOT.cat, 's');
        log({ sent: submit, idx: BOT.idx, n: BOT.picks.length, src: (BOT.src || {})[KR.norm(submit)] || '', tier: KR.deepRank(KB, submit) });
        BOT.lastSubmitted = { a: submit, at: Date.now(), len: pageText().length };
        BOT.resendN = 0;
        // Verify it afterwards instead of assuming it: if the room took a
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
        })(submit);
      }

      // On our turn and still nothing out after 2.5s: record exactly what the DOM
      // looked like, so the next silent death is a log line instead of a mystery.
      if (active && !BOT.sentThisTurn && BOT.turnStart && Date.now() - BOT.turnStart > 2500) {
        log({ stuck: { cat: BOT.cat, picks: BOT.picks.length, idx: BOT.idx,
                       val: el.value, hasBtn: !!b2, dis: !!(b2 && b2.disabled),
                       cool: Math.max(0, BOT.cool - Date.now()), tail: text.slice(-90) } });
      }

      // The other silent death: the room says it is our turn but no enabled SEND
      // button exists. Log what the page actually had, then try to submit without
      // the button rather than waiting for a fuse to kill us.
      if (mine && !active && !BOT.sentThisTurn) {
        if (!BOT.idleAt || Date.now() - BOT.idleAt > 1500) {
          BOT.idleAt = Date.now();
          log({ idle: {
            hasEl: !!el, hasBtn: !!btn, dis: !!(btn && btn.disabled),
            val: el ? String(el.value).slice(0, 40) : null,
            fields: [].map.call(document.querySelectorAll('input,textarea,[contenteditable="true"]'), function (n) {
              return (n.tagName + '.' + (n.className || '')).slice(0, 34) + ' [' + (n.getAttribute('placeholder') || '') + ']' + (n.disabled ? ' dis' : '');
            }).slice(0, 6),
            btns: [].map.call(document.querySelectorAll('button'), function (b) {
              return ((b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 16) || '-') + (b.disabled ? '|dis' : '|en');
            }).slice(0, 8),
            tail: text.slice(-90)
          } });
        }
        if (el && BOT.cat && BOT.picks.length && !el.value) { BOT.current = next(); setValue(el, BOT.current); }
        if (el && el.value && !btn) {
          ['keydown', 'keypress', 'keyup'].forEach(function (t) {
            el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          });
        }
      }
    } catch (e) {
      log({ err: String(e && e.message || e) });
    }
  }

  // Narrow observers, re-attached when the room swaps the input/button nodes
  // out between categories.
  function rewatch() {
    var el = input(), btn = sendBtn();
    if (!el && !btn) return;
    if (BOT.wn && BOT.wn[0] === el && BOT.wn[1] === btn) return;
    BOT.wobs.disconnect();
    [el, btn].forEach(function (n) {
      if (n) BOT.wobs.observe(n, { attributes: true, childList: true, characterData: true, subtree: true });
    });
    BOT.wn = [el, btn];
    if (BOT.logs++ < 4) log({ watch: { el: !!el, btn: !!btn, dis: !!(btn && btn.disabled) } });
  }

  // The pack takes a while to decode, and joining a table reloads the page, so
  // the decoded base64 is kept in IndexedDB: a re-injected bot is armed from the
  // cache in about a second, before the first category can be missed.
  var IDB_NAME = 'krpack', IDB_KEY = 'pack';
  function idb(mode, fn) {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open(IDB_NAME, 1);
        rq.onupgradeneeded = function () { try { rq.result.createObjectStore('s'); } catch (e) {} };
        rq.onerror = function () { res(null); };
        rq.onsuccess = function () {
          try {
            var q = fn(rq.result.transaction('s', mode).objectStore('s'));
            q.onsuccess = function () { res(q.result); };
            q.onerror = function () { res(null); };
          } catch (e) { res(null); }
        };
      } catch (e) { res(null); }
    });
  }
  function cacheGet() { return idb('readonly', function (st) { return st.get(IDB_KEY); }); }
  function cacheSet(v) { return idb('readwrite', function (st) { return st.put(v, IDB_KEY); }); }

  window.__krLoad = function (inline) {
    var parts = inline ? [inline] : (window.__KRP || []);
    if (!parts.length) return Promise.resolve('no chunks: push base64 into window.__KRP first');
    var b64 = parts.join('').replace(/\s+/g, '');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text().then(function (text) {
      KB = JSON.parse(text);
      KB.lrn = loadLrn();
      BOT.on = true;
      // Timers are throttled to about one a second while the tab is in the
      // background, which is exactly when the bot has to answer. DOM mutations
      // are not throttled, so every re-render of the room runs a tick too.
      if (window.MutationObserver && !BOT.obs) {
        BOT.obs = new MutationObserver(function () { tick(); });
        BOT.obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        (window.__krObs = window.__krObs || []).push(BOT.obs);
      }
      if (!BOT.timer) {
        BOT.timer = setInterval(tick, 70);
        (window.__krTimers = window.__krTimers || []).push(BOT.timer);
      }
      // Page timers in a hidden tab drop to about one a minute after five
      // minutes of intensive throttling - which is exactly the second half of a
      // round, and where turns were being missed. A worker timer is not part of
      // that budget, so it keeps the tick alive at 60ms with the tab hidden.
      if (!BOT.worker) {
        try {
          var wsrc = 'setInterval(function(){postMessage(1)},60)';
          var wurl = URL.createObjectURL(new Blob([wsrc], { type: 'text/javascript' }));
          BOT.worker = new Worker(wurl);
          BOT.worker.onmessage = tick;
          (window.__krWorkers = window.__krWorkers || []).push(BOT.worker);
        } catch (e) { log({ noWorker: String(e && e.message || e) }); }
      }
      // The SEND button's enabled state is published as a property, which fires
      // no mutation record, so observe the input and the button themselves too.
      if (!BOT.wobs) { BOT.wobs = new MutationObserver(tick); (window.__krObs = window.__krObs || []).push(BOT.wobs); }
      rewatch();
      if (!BOT.wtimer) BOT.wtimer = setInterval(rewatch, 150);
      log({ armed: true, hn: Object.keys(KB.hn || {}).length, pk: Object.keys(KB.pk || {}).length, tr: Object.keys(KB.tr || {}).length });
      return { armed: true, categories: Object.keys(KB.hn || {}).length, learned: Object.keys(KB.lrn || {}).length };
    });
  };

  // Preferred path: the pack is 800KB of gzip+base64, far too much to paste, so
  // it is fetched from the local pack server instead. Chrome treats 127.0.0.1 as
  // trustworthy, so an https page may fetch it.
  window.__krFetch = function (url) {
    var src = url || 'http://127.0.0.1:5201/kb';
    return fetch(src, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('kb ' + r.status); return r.text(); })
      .then(function (b64) { cacheSet(b64); return window.__krLoad(b64); })
      .catch(function (e) { log({ fetchErr: String(e && e.message || e), url: src }); return { error: String(e && e.message || e) }; });
  };

  // The tier capture is part of the harness, not the bot, but it has to outlive
  // the reloads a room does: every bot load makes sure it is running.
  try {
    if (!window.__gtObs) {
      var gtTag = document.createElement('script');
      gtTag.src = 'http://127.0.0.1:5201/tierlog.js?t=' + Date.now();
      document.documentElement.appendChild(gtTag);
    }
  } catch (e) { /* no document */ }

  // Warm the cache without arming: call this on the lobby page, then a join and
  // re-inject costs no turns.
  window.__krWarm = function (url) {
    var src = url || 'http://127.0.0.1:5201/kb';
    return fetch(src, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('kb ' + r.status); return r.text(); })
      .then(function (b64) { return cacheSet(b64).then(function () { return { warmed: b64.length }; }); })
      .catch(function (e) { return { error: String(e && e.message || e) }; });
  };

  window.__krTest = function (cat) {
    return KB ? KR.resolve(cat, KB, {}).slice(0, 8) : 'not loaded';
  };
  window.__krReset = function () {
    try { localStorage.removeItem(LS); } catch (e) {}
    if (KB) KB.lrn = {};
    return 'learning cleared';
  };

  // Restore the pack from the cache as soon as the script lands in a room page,
  // so the first category is answered instead of watched.
  if (/\/party\/[A-Za-z0-9]{3,}/.test(location.pathname)) {
    cacheGet().then(function (b64) {
      if (b64 && !KB) {
        try { window.__krLoad(b64); log({ restored: true }); } catch (e) { log({ restoreErr: String(e && e.message || e) }); }
      }
      // An empty or corrupt cache used to leave the bot loaded but blind, which
      // costs whole games. Fetch the pack instead.
      if (!KB) window.__krFetch();
    }).catch(function () {
      if (!KB) window.__krFetch();
    });
  }

  window.pufferBot = {
    version: 132,
    get rare() { return RARE; },
    get minRank() { return MINRANK; },
    get fallback() { return window.__krFallback !== false; },
    stop: function () { BOT.on = false; if (BOT.timer) clearInterval(BOT.timer); BOT.timer = 0; if (BOT.obs) BOT.obs.disconnect(); },
    start: function () { window.__krOwner = ID; BOT.on = true; if (!BOT.timer) BOT.timer = setInterval(tick, 70); },
    get cat() { return BOT.cat; },
    get picks() { return BOT.picks; },
    get left() { return Math.max(0, BOT.picks.length - BOT.idx); },
    get sent() { return BOT.sent; },
    get rejected() { return BOT.rejected; },
    get learned() { return Object.keys(loadLrn()).length; },
    get loaded() { return !!KB; }
  };
})();
