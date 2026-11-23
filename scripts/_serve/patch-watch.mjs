// One-shot patcher: live watch channel (serve.mjs /live + /watch, bot heartbeat).
import fs from 'node:fs';

const edits = {
  'scripts/puffer-kb/serve.mjs': [
    ['cors-post',
`    'Access-Control-Allow-Methods': 'GET, OPTIONS',`,
`    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',`],
    ['watch-state',
`const GAMELOGFILE = path.join(HERE, '..', '..', '.k3', 'gamelog.jsonl');`,
`const GAMELOGFILE = path.join(HERE, '..', '..', '.k3', 'gamelog.jsonl');
// Live watch: the bot posts a small heartbeat while it plays and /watch renders
// it. This is how a session is followed turn by turn, in the room's own words,
// without a screen or a second browser.
const WATCHFILE = path.join(HERE, '..', '_serve', 'watch.html');
const watchState = { at: 0, ver: '', name: '', cat: '', box: '', up: 0, sent: 0, bad: 0, page: '', events: [] };`],
    ['watch-routes',
`  // Game log: the bot posts what happened in a round (a category, the words it`,
`  if (url.pathname === '/live') {
    if (req.method === 'GET') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ now: Date.now(), ...watchState }));
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 200000) { try { req.destroy(); } catch (e) {} } });
    req.on('end', () => {
      try {
        const j = JSON.parse(raw || '{}');
        watchState.at = Date.now();
        watchState.ver = String(j.ver || '').slice(0, 12);
        watchState.name = String(j.name || '').slice(0, 24);
        watchState.cat = String(j.cat || '').slice(0, 140);
        watchState.box = String(j.box || '').slice(0, 60);
        watchState.up = j.up ? 1 : 0;
        watchState.sent = Number(j.sent) || 0;
        watchState.bad = Number(j.bad) || 0;
        watchState.page = String(j.page || '').slice(0, 400);
        const evs = Array.isArray(j.events) ? j.events.slice(-40) : [];
        for (const e of evs) {
          const k = JSON.stringify(e);
          if (!watchState.events.some((x) => x.k === k)) watchState.events.push({ k, e });
        }
        if (watchState.events.length > 300) watchState.events = watchState.events.slice(-300);
      } catch (e) { /* a bad heartbeat must never take the server down */ }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    return;
  }
  if (url.pathname === '/watch' || url.pathname === '/watch.html') {
    try {
      const buf = fs.readFileSync(WATCHFILE);
      res.writeHead(200, { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(buf);
    } catch (e) {
      res.writeHead(500, { ...cors, 'Content-Type': 'text/plain' });
      return res.end('missing watch.html: ' + e.message);
    }
  }
  // Game log: the bot posts what happened in a round (a category, the words it`]
  ],
  'scripts/puffer-kb/bot.js': [
    ['live-url',
`  var GAMELOG_URL = (window.__krPack || 'http://127.0.0.1:5201') + '/gamelog';`,
`  var GAMELOG_URL = (window.__krPack || 'http://127.0.0.1:5201') + '/gamelog';
  const LIVE_URL = (window.__krPack || 'http://127.0.0.1:5201') + '/live';`],
    ['live-post',
`  window.__krLogNow = function () { postGameLog(BOT.logCat || BOT.cat); };`,
`  window.__krLogNow = function () { postGameLog(BOT.logCat || BOT.cat); };

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
      fetch(LIVE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ver: (window.pufferBot || {}).version || '', name: BOT.name || '',
          cat: BOT.cat || '', box: el ? String(el.value || '') : '',
          up: BOT.canType === false ? 0 : 1,
          sent: BOT.sentThisTurn || 0, bad: BOT.catBad || 0,
          page: String((document.body.innerText || '')).slice(-300).replace(/\\s+/g, ' '),
          events: evs.map(function (e) {
            var o = {};
            for (var k in e) { if (k !== 'cat') o[k] = e[k]; }
            return o;
          })
        })
      }).catch(function () {});
    } catch (e) { /* watching must never break play */ }
  }
  window.__krLiveNow = function () { BOT.liveAt = 0; postLive(); };`],
    ['live-tick',
`      try { ensureSent(el, btn); } catch (e) { /* never break the tick */ }`,
`      try { ensureSent(el, btn); } catch (e) { /* never break the tick */ }
      // The live channel: this is what makes the game watchable while it runs.
      try { postLive(); } catch (e) { /* never break the tick */ }`]
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
