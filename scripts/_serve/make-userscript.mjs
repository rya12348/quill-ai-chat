/*
 * Assembles the installable Tampermonkey userscript:
 *   userscript header + resolver + bot + status HUD + inlined pack
 *
 * The pack is read from scripts/puffer-kb/dist/kb.txt (already built), so this
 * is a second-fast assembly step, not a rebuild of the knowledge pack.
 *
 * Usage: node scripts/_serve/make-userscript.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const KB = path.join(ROOT, 'scripts/puffer-kb');
const VERSION = 296;
const OUT = path.join(ROOT, 'scripts/puffer-bot.user.js');

const b64 = fs.readFileSync(path.join(KB, 'dist/kb.txt'), 'utf8').replace(/\s+/g, '');
if (b64.length < 100000) throw new Error('pack looks too small: ' + b64.length);

const resolverSrc = fs.readFileSync(path.join(KB, 'resolver.js'), 'utf8')
  .replace(/\nif \(typeof module[\s\S]*$/, '\n');
const botSrc = fs.readFileSync(path.join(KB, 'bot.js'), 'utf8')
  // keep the shipped version number in step with the header
  .replace(/version: \d+,/, 'version: ' + VERSION + ',');

// ------------------------------------------------ status badge (diagnostics)
// Reads only public state the bot already exposes. If the script never runs,
// no badge appears at all - which is itself the answer to "why is it silent".
const HUD = `
;(function () {
  'use strict';
  function el() { return document.getElementById('kr-hud'); }
  function paint() {
    var host = el();
    if (!host) {
      if (!document.body) return;
      host = document.createElement('div');
      host.id = 'kr-hud';
      host.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;' +
        'font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;padding:5px 8px;border-radius:6px;' +
        'background:rgba(4,16,26,.86);color:#bfe9ff;border:1px solid rgba(120,200,255,.35);' +
        'pointer-events:auto;cursor:pointer;max-width:46vw;white-space:pre-wrap';
      host.title = 'click to hide';
      host.addEventListener('click', function () { host.style.display = 'none'; });
      document.body.appendChild(host);
    }
    var b = window.pufferBot, log = window.__kr || [], last = log[log.length - 1] || {};
    var line, colour;
    if (!b) {
      line = 'bot: script ran but object missing';
      colour = '#ffb4a8';
    } else if (!b.loaded) {
      line = 'bot v' + b.version + ': PACK NOT LOADED (still decoding, or it failed)';
      colour = '#ffb4a8';
    } else {
      line = 'bot v' + b.version + ' ARMED  cat: ' + (b.cat || '-') +
        '  left: ' + b.left + '  sent: ' + b.sent + '  learned: ' + b.learned;
      colour = '#9dffc4';
    }
    if (last && (last.fetchErr || last.restoreErr || last.noWorker)) {
      line += '\\npack: ' + JSON.stringify(last.fetchErr || last.restoreErr || last.noWorker);
      colour = '#ffd48a';
    }
    host.textContent = line;
    host.style.color = colour;
    host.title = JSON.stringify(log.slice(-6), null, 1);
  }
  setInterval(paint, 500);
  paint();
  console.log('kr: hud ready');
})();
`;

const header = [
  '// ==UserScript==',
  '// @name         Puffer Party Bot',
  '// @namespace    https://krillion.io/',
  '// @version      ' + VERSION,
  '// @description  Answers Puffer Party (krillion.io/party) categories from an offline pack, with live lookups when the local pack server is running.',
  '// @author       you',
  '// @match        https://krillion.io/*',
  '// @match        https://*.krillion.io/*',
  '// @run-at       document-idle',
  '// @grant        none',
  '// ==/UserScript==',
  ''
].join('\n');

const body = [
  '(function () {',
  resolverSrc,
  botSrc,
  HUD,
  '})();',
  ''
].join('\n');

// The pack is injected last and boots the bot itself.
const pack = ';window.__KRP=[' + JSON.stringify(b64) +
  '];window.__krLoad().then(function(){console.log("kr: inline pack loaded")},function(e){console.log("kr: inline pack failed",e)});\n';

fs.writeFileSync(OUT, header + body + pack);
console.log('wrote ' + OUT + ' (' + fs.statSync(OUT).size + ' bytes, v' + VERSION + ')');
