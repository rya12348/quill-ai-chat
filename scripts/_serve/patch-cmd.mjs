// Patch pass 3: remote command channel (server queue -> bot in the live page).
import fs from 'node:fs';

const edits = {
  'scripts/puffer-kb/serve.mjs': [
    ['cmd-state',
`const watchState = { at: 0, ver: '', name: '', cat: '', box: '', up: 0, sent: 0, bad: 0, page: '', events: [] };`,
`const watchState = { at: 0, ver: '', name: '', cat: '', box: '', up: 0, sent: 0, bad: 0, page: '', events: [] };
// Remote control: a command is queued here and handed to the bot in the reply to
// its next heartbeat, so the script playing in the room can be driven from
// outside it. Results come back in the heartbeat after that.
const cmds = [];
const cmdDone = [];`],
    ['cmd-route',
`  if (url.pathname === '/live') {`,
`  if (url.pathname === '/cmd') {
    const verb = String(url.searchParams.get('do') || '').slice(0, 12);
    const word = String(url.searchParams.get('w') || '').slice(0, 60);
    if (verb && verb !== 'status') cmds.push({ do: verb, w: word, at: Date.now() });
    if (cmds.length > 20) cmds.splice(0, cmds.length - 20);
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      ok: !!verb, queued: cmds.length, results: cmdDone.slice(-12),
      watch: { at: watchState.at, ver: watchState.ver, cat: watchState.cat, box: watchState.box, up: watchState.up }
    }));
  }
  if (url.pathname === '/live') {`],
    ['cmd-deliver',
`        const evs = Array.isArray(j.events) ? j.events.slice(-40) : [];`,
`        if (Array.isArray(j.results)) {
          for (const r of j.results.slice(0, 10)) cmdDone.push({ do: String(r.do || ''), w: String(r.w || ''), said: String(r.said || ''), at: Date.now() });
          if (cmdDone.length > 50) cmdDone.splice(0, cmdDone.length - 50);
        }
        const evs = Array.isArray(j.events) ? j.events.slice(-40) : [];`],
    ['cmd-reply',
`      } catch (e) { /* a bad heartbeat must never take the server down */ }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end('{"ok":true}');`,
`      } catch (e) { /* a bad heartbeat must never take the server down */ }
      // Commands are handed out exactly once, in the heartbeat reply: the watch
      // page polls /live with GET and must never consume them.
      const out = cmds.splice(0, 10);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, cmds: out }));`]
  ],
  'scripts/puffer-kb/bot.js': [
    ['pause-force',
`  function forceReadySend(el, btn) {
    if (!el) return;`,
`  function forceReadySend(el, btn) {
    if (!el) return;
    // Remote control: a paused bot watches and reports, but never submits.
    if (window.__krPaused) return;`],
    ['pause-sent',
`  function ensureSent(el, btn) {
    if (!el) return;`,
`  function ensureSent(el, btn) {
    if (!el) return;
    if (window.__krPaused) return;`],
    ['pause-main',
`        BOT.pressed = BOT.pressed || {};
        if (BOT.pressed[KR.norm(submit)]) {`,
`        if (window.__krPaused) return;
        BOT.pressed = BOT.pressed || {};
        if (BOT.pressed[KR.norm(submit)]) {`],
    ['cmd-apply',
`  window.__krLiveNow = function () { BOT.liveAt = 0; postLive(); };`,
`  window.__krLiveNow = function () { BOT.liveAt = 0; postLive(); };

  // Remote control, executed in the room itself. 'say' presses the word now,
  // 'pause'/'resume' stop and restart submissions, 'hold' clears the hand.
  // Whatever happens is reported back on the next heartbeat, so a command from
  // outside can be confirmed instead of assumed.
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
        if (!el) { r.said = 'no box'; return r; }
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
  }`],
    ['cmd-wire',
`      fetch(LIVE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({`,
`      var done = BOT.cmdDone || [];
      BOT.cmdDone = [];
      fetch(LIVE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          results: done,`],
    ['cmd-handle',
`      }).catch(function () {});
    } catch (e) { /* watching must never break play */ }`,
`      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.cmds || !j.cmds.length) return;
          BOT.cmdDone = (BOT.cmdDone || []).concat(j.cmds.map(applyCmd));
        })
        .catch(function () {});
    } catch (e) { /* watching must never break play */ }`]
  ]
};

for (const [file, list] of Object.entries(edits)) {
  let src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [name, find, replace] of list) {
    const n = src.split(find).length - 1;
    if (n !== 1) { console.error('ANCHOR FAIL', file, name, 'matches=' + n); process.exit(1); }
    src = src.replace(find, () => replace);
  }
  fs.writeFileSync(file, src.replace(/\n/g, '\r\n'));
  console.log('patched', file, list.length, 'blocks');
}
