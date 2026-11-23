/**
 * Tier capture for Krillion party games.
 *
 * The feed is a virtualized list: rows are mounted when they scroll into view
 * and unmounted again, so polling the page text misses most of a busy round
 * (19 of 35 answers in the last rated game). This records each row as it mounts
 * instead: every mutation is inspected, each row element is parsed once and kept
 * by element identity, so a row that re-renders updates its record rather than
 * being counted twice.
 *
 * Inject once before seating; it survives the client-side room navigation:
 *   <script src="http://127.0.0.1:5201/tierlog.js"></script>
 * Then read: window.__gt  (array of {answer, tier, rating, seq})
 *            window.__gtList()  printable copy
 *            window.__gtStop()  disconnect
 */
(function () {
  if (window.__gtObs) {
    try { window.__gtObs.disconnect(); } catch (e) { /* page teardown */ }
  }
  var TIERS = 'PLANKTON|TOO CLEVER|SCHOOLER|RARE|DEEP CUT|ONE IN A KRILLION';
  var RX = new RegExp('([\\s\\S]{1,80}?)\\s+Buffy\\s+(\\d{2,5})\\s*(?:[+\\-\\u2212]\\d+)?\\s*(?:=>\\s*)?(' + TIERS + ')', 'i');
  // Re-injecting (or the browser executing the tag twice) must not wipe what a
  // game already recorded, so the list and the dedupe set live on the window.
  var STORE = 'kr:tiers:v1';
  // Any number of instances (a re-inject, the bot's own load, an older copy)
  // write this key from their own snapshot. Make it append-only for the life of
  // the page so no write can erase rows another instance already recorded.
  if (!window.__gtShim) {
    window.__gtShim = true;
    (function () {
      var rawSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k !== STORE) return rawSet.call(this, k, v);
        var prev = [], next = [];
        try { prev = JSON.parse(rawSet.call(this, k) || '[]') || []; } catch (e) { prev = []; }
        try { next = JSON.parse(v) || []; } catch (e) { next = []; }
        var merged = prev.slice();
        for (var i = 0; i < next.length; i++) {
          var r = next[i];
          if (!r || !r.answer) continue;
          var dup = false;
          for (var j = 0; j < merged.length; j++) {
            if (merged[j].answer === r.answer && merged[j].tier === r.tier) { dup = true; break; }
          }
          if (!dup) merged.push(r);
        }
        return rawSet.call(this, k, JSON.stringify(merged));
      };
    })();
  }
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch (e) { stored = []; }
  var rows = (window.__gt && typeof window.__gt.length === 'number') ? window.__gt : [];
  var byEl = new WeakMap();      // element -> record, so a re-render is an update
  var seen = window.__gtSeen || (window.__gtSeen = Object.create(null));
  var seq = rows.length;
  // The room re-renders can drop the page array, so every row also goes to
  // localStorage: a finished game is still readable afterwards.
  stored.forEach(function (r) { seen[r.answer + '|' + r.tier + '|' + r.rating] = 1; });
  if (stored.length > rows.length) rows = stored.slice();

  function clean(s) {
    return String(s)
      .replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/\s+/g, ' ')
      // rank numbers, bullets and separators that sit in front of the answer
      .replace(/^[\s\d.)\u2022\u00b7\u2013\u2014\u2212\-\[\]|:>\u25b8\u25b9\u203a]+/, '')
      .replace(/[\s|:>\u25b8\u25b9\u203a,\u2013\u2014\-]+$/, '')
      .trim();
  }

  // Inline spans concatenate with no whitespace ("Test AnswerBuffy960DEEP CUT"),
  // so the row text has to be rebuilt with separators between elements.
  function flatText(el, depth) {
    if (depth > 6) return el.textContent || '';
    if (el.nodeType === 3) return el.nodeValue || '';
    if (el.nodeType !== 1) return '';
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var child = el.childNodes[i];
      var t = child.nodeType === 1 ? flatText(child, (depth || 0) + 1) : (child.nodeValue || '');
      if (t) out += (out ? ' ' : '') + t.trim();
    }
    return out;
  }

  // The answer is whatever sits in front of "Buffy <rating>", which is the span
  // order the row uses; falling back to the text keeps other layouts working.
  function parse(el) {
    var text = (flatText(el, 0) || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 240) return null;
    var m = text.match(RX);
    if (!m) return null;
    var answer = clean(m[1]);
    // A row with several spans puts the answer first; prefer that over the
    // joined text when the joined text clearly swallowed neighbours.
    if (el.children && el.children.length > 1) {
      for (var i = 0; i < el.children.length; i++) {
        var ct = (el.children[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (!ct) continue;
        if (/Buffy/i.test(ct)) break;
        if (ct.length <= 60 && new RegExp('^' + TIERS + '$', 'i').test(ct) === false) {
          var cand = clean(ct);
          if (cand && (answer === '' || answer.indexOf(cand) >= 0)) answer = cand;
          break;
        }
      }
    }
    if (!answer) return null;
    return { answer: answer, tier: m[3].toUpperCase(), rating: Number(m[2]) };
  }

  // The chat feed never holds an answer's tier: it only carries system lines
  // ("Buffy won") and drops answer rows entirely. Every answer is shown on the
  // player's seat instead - div.pf-seat.me / .joining - and its tier is a
  // short-lived floater inside it:
  //   div.pf-rise "DEEP CUT" < div.pf-seat-in < div.pf-seat.me < div.pf-ring
  // whose host text reads "dandelion tea Buffy 1076 DEEP CUT". Reading only the
  // feed is why 3 of 110 answers were recorded.
  var TIER_ONLY = new RegExp('^(' + TIERS + ')$', 'i');

  function parseSeat(host, rise) {
    if (!host || !host.textContent) return null;
    var tierEl = rise || (host.querySelector && host.querySelector('.pf-rise'));
    if (!tierEl) return null;
    var tier = (tierEl.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!TIER_ONLY.test(tier)) return null;
    var nameEl = host.querySelector && host.querySelector('.pf-name');
    var text = flatText(host, 0).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    var player = nameEl ? (nameEl.textContent || '').trim() : '';
    var at = player ? text.indexOf(player) : -1;
    if (at < 0) {
      // No name span: fall back to "answer <name> <rating> <tier>".
      var m = text.match(new RegExp('^([\\s\\S]{1,80}?)\\s+\\S[\\s\\S]{0,24}?\\s+(\\d{2,5})\\s+' + TIERS + '$', 'i'));
      if (!m) return null;
      return { answer: clean(m[1]), tier: tier, rating: Number(m[2]), player: '' };
    }
    var answer = clean(text.slice(0, at));
    var rest = text.slice(at + player.length).trim();
    var rm = rest.match(/^(\d{2,5})/);
    if (!answer) return null;
    return { answer: answer, tier: tier, rating: rm ? Number(rm[1]) : 0, player: player };
  }

  function scanSeats(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var rises = scope.querySelectorAll ? scope.querySelectorAll('.pf-rise') : [];
    for (var i = 0; i < rises.length; i++) {
      var rise = rises[i];
      var host = (rise.closest && rise.closest('.pf-seat')) || rise.parentElement || null;
      var rec = parseSeat(host, rise);
      if (rec) save(rise, rec);
    }
  }

  function save(el, rec) {
    var prev = byEl.get(el);
    if (prev) {
      prev.answer = rec.answer; prev.tier = rec.tier; prev.rating = rec.rating;
      return;
    }
    var key = rec.answer + '|' + rec.tier + '|' + rec.rating + '|' + (rec.player || '');
    if (seen[key]) return;
    seen[key] = 1;
    rec.seq = ++seq;
    byEl.set(el, rec);
    rows.push(rec);
    // Merge against what is on disk rather than this instance's snapshot: two
    // instances (a re-inject, or bot and a manual tag) would otherwise each
    // write back their own view and erase the other's rows.
    try {
      var cur = [];
      try { cur = JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch (e2) { cur = []; }
      var dup = false;
      for (var ci = 0; ci < cur.length; ci++) {
        if (cur[ci].answer === rec.answer && cur[ci].tier === rec.tier && cur[ci].rating === rec.rating && (cur[ci].player || '') === (rec.player || '')) { dup = true; break; }
      }
      if (!dup) {
        cur.push({ answer: rec.answer, tier: rec.tier, rating: rec.rating, player: rec.player || '', seq: cur.length + 1 });
        localStorage.setItem(STORE, JSON.stringify(cur));
      }
      stored = cur;
    } catch (e) { /* private mode */ }
  }

  function visit(node) {
    if (!node) return;
    if (node.nodeType === 3) node = node.parentElement;
    if (!node || node.nodeType !== 1) return;
    // Seats carry the answer and its tier; the feed does not.
    if ((node.classList && node.classList.contains('pf-rise')) ||
        (node.querySelector && node.querySelector('.pf-rise'))) scanSeats(node);
    var rec = parse(node);
    if (rec) { save(node, rec); return; }
    // A container can mount a whole page of rows at once.
    var kids = node.querySelectorAll ? node.querySelectorAll('*') : [];
    for (var i = 0; i < kids.length; i++) {
      var r = parse(kids[i]);
      if (r) save(kids[i], r);
    }
    // A row can mount empty and be filled a tick later: the mutation only names
    // the spans that were inserted, so look at the containers they landed in.
    var up = node.parentElement, depth = 0;
    while (up && depth < 3) {
      var parentRec = parse(up);
      if (parentRec) { save(up, parentRec); return; }
      up = up.parentElement;
      depth++;
    }
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var mu = muts[i];
      if (mu.type === 'characterData') { visit(mu.target); continue; }
      if (mu.type === 'attributes') { visit(mu.target); continue; }
      for (var j = 0; j < mu.addedNodes.length; j++) visit(mu.addedNodes[j]);
    }
    // Answers land on one seat per player, so a new answer overwrites the last
    // one's text instead of adding a node. Rescanning the seats on every
    // mutation (text updates included) is what makes each of them countable.
    scanSeats(document);
  });
  obs.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-tier'],
  });

  // The floater can mount and unmount inside a single animation frame, and a
  // seat can re-render without a mutation the observer sees named. A short
  // sweep makes the capture independent of mutation timing.
  var sweep = setInterval(function () { try { scanSeats(document); } catch (e) { /* teardown */ } }, 150);
  window.__gtSweep = sweep;
  window.__gtObs = obs;
  window.__gt = rows;
  window.__gtList = function () { return rows.map(function (r) { return r.answer + ' => ' + r.tier; }); };
  window.__gtStop = function () { try { obs.disconnect(); } catch (e) { /* already gone */ } };
  window.__gtClear = function () {
    rows.length = 0; byEl = new WeakMap(); seen = window.__gtSeen = Object.create(null);
    stored.length = 0; seq = 0;
    try { localStorage.setItem(STORE, '[]'); } catch (e) { /* private mode */ }
  };
  return 'tierlog ' + rows.length;
})();
