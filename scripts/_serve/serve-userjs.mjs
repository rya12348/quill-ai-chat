// Serves the built userscript at http://127.0.0.1:8081/puffer-bot.user.js
// so Tampermonkey shows its one-click install prompt, and so the script can be
// injected into a page for testing. Query strings are ignored (cache-busters
// are common), OPTIONS preflights are answered, and CORS is open for loopback.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, 'puffer-bot.user.js');
const PORT = 8081;
// Verification page: a room-shaped DOM with both an answer box and a chat box.
const roomtest = path.join(here, 'roomtest.html');

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': '*',
  'cache-control': 'no-store',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (pathname === '/roomtest.html') {
    try {
      const buf = await readFile(roomtest);
      res.writeHead(200, {
        ...cors,
        'content-type': 'text/html; charset=utf-8',
        'content-length': buf.length,
      });
      res.end(buf);
    } catch (err) {
      res.writeHead(500, { ...cors, 'content-type': 'text/plain' });
      res.end('cannot read page: ' + err.message);
    }
    return;
  }
  if (pathname !== '/puffer-bot.user.js' && pathname !== '/') {
    res.writeHead(404, { ...cors, 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      ...cors,
      'content-type': 'text/javascript; charset=utf-8',
      'content-length': buf.length,
    });
    res.end(buf);
  } catch (err) {
    res.writeHead(500, { ...cors, 'content-type': 'text/plain' });
    res.end('cannot read userscript: ' + err.message);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('serving userscript on http://127.0.0.1:' + PORT + '/puffer-bot.user.js');
});
