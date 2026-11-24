# Krillion — full client mirror

Pulled from `https://krillion.io` on 2026-11-23 and kept only under `tmp/`, which
this repo's `.gitignore` excludes. It is everything the game **ships to a
browser**: every page payload, every chunk those pages can load, the CSS, the
fonts and art the CSS/JS name, and the API documents the client fetches.

Open the code browser: `node tmp/krillion-viewer.mjs` → http://127.0.0.1:4178

## What is here

| path | contents |
|---|---|
| `pages/*.html` | 23 server-rendered routes: /, /party, /party/<code>, /archive, /archive/<day>, /packs, /unlimited, /unlimited/classic, /unlimited/movies, /geography, /lexicon, /movies, /sports, /account, /faq, /friends, /restore, /privacy, /terms, /answer-count and the fallbacks — each with its RSC flight payload |
| `_next/static/chunks/*.js` | 33 JS chunks + 8 stylesheets — every `/_next/static` URL referenced anywhere in the pages or the chunks resolves locally (checked: 0 missing, 0 orphans) |
| `_next/static/chunks/*.css` | the shipped stylesheets, the originals behind the `.ds-*` rules already copied into `src/dive.css` and `src/butter-party.css` |
| `api/*.txt` | status, content type and body for all 18 `/api/*` paths the client names |
| `assets/` | 92 images plus the 3 woff2 fonts the CSS references |
| `pretty/*.js` | the 33 JS chunks re-printed indented by esbuild, for reading |
| `viewer/` | highlight.js + theme used by the local browser |
| `MIRROR.json` | the fetch report: counts, statuses, failures |
| `INDEX.md` | generated table: each chunk, its size, module count, component names |

## What no client mirror can contain

The game is graded on the server. `/api/today` returns only the seven prompt
strings (saved verbatim in `api/api_today.txt`), `/api/submit` takes the answer
and returns the tier, and `/api/suggest` offers spellings. The answer bank, the
tier thresholds and the validator never reach the browser, so they are not in
this mirror. The only answer bank in this repo is Ink's own
`src/worker/butter-cards-full.ts`, harvested separately.

## Reading map — where the game lives

Verified by searching the pretty chunks:

- **Dive dock, input and the spell-check pill** — `0-9z1pcs0sh9-.js`
  (and its identical twin `3me4f2hpci-y4.js`): `ds-correction-*`, the
  `submit again to confirm · or edit` line, the answer field.
- **Dive view, rarity words, HUD** — `19gcuy9rluu7_.js`: `rarer answers sink
  deeper`, `ds-mute`, `GameHistoryModal`, the plankton→krillion ladder.
- **Intro / BEGIN DESCENT** — `3j028aa--jhrw.js`, with `1c60lcmp9l51i.js`.
- **Network client** — `1c60lcmp9l51i.js` and `3ipjrnh99b057.js` hold
  `api/submit`, `api/suggest`, `api/today`, `api/archive`.
- **Puffer Party rooms** — `0r2pf9ih29dld.js` (the WebSocket client) and
  `20tpvsvhve2am.js`.
- **Tier ladder and metre** — `0ebdng4vfm6wj.js`, `3itjc0tls3d-u.js`.
- **Stylesheets** — `0a27hasimsri3.css` (DailyIntro, DoneView, archive, account
  and the rest of the app CSS modules), `1nc1cayvsz2op.css` (base + `.sr-only`),
  `2v0l13n4i2-rx.css`, `05rzx4yxjp9lo.css`, `0einiv7k8899j.css`,
  `240trhd7lpzk0.css`, `3j9no1a_hemcb.css`.

Identifiers in the chunks are mangled and there are no source maps on the
deployment, so there is no original `.tsx`. Each chunk opens with its CSS-module
export map (`DailyIntro-module__…`, `DoneView-module__…`), which is what names
the component you are reading.

## Is it the whole game?

The client, yes, and it is checkable rather than assumed:

- The crawl follows the routes the code names, not just the menu: `/answer-count`,
  `/archive/<day>`, `/party/<code>` and `/unlimited/<pack>` each carry chunks no
  other page loads. They are why the first pass was short by five files.
- `node tmp/verify-mirror.mjs` prints the closure: 41 chunks, 23 pages, every
  `/_next/static` reference resolving, no chunk unreferenced.
- Repeating the crawl returns `added: []`, so another pass adds nothing.

The server does not ship: `/api/submit` grades answers against a bank that stays
on the server, so the answer list and the tier thresholds cannot be here. That
is a property of the game, not a gap in the crawl.

## Refreshing

```sh
node tmp/krillion-fetch.mjs      # chunks + pages reachable from the home page
node tmp/krillion-fetch2.mjs     # all routes, API payloads, assets, MIRROR.json
node tmp/crawl-deep.mjs          # unlinked routes and the chunks only they load
node tmp/verify-mirror.mjs       # closure check: 0 missing, 0 orphans
node tmp/krillion-prettify.mjs   # pretty/*.js and INDEX.md
node tmp/publish-source.mjs      # copy code into public/krillion-source
node tmp/krillion-viewer.mjs     # the local browser
```
