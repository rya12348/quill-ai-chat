# Ink — project rules

Rules that the code does not state on its own. Follow them without asking.

## The cloud browser belongs to the AI Agent alone

Ink has one remote-Chrome path: the Steel / Browserbase / Hyperbrowser session
behind `/api/browser/*`, shown at `/browser` and `/browser/live`. It is slow,
it is billed per hour, and the whole app shares three concurrent sessions.

- **Only the AI Agent may use it.** No other feature starts, attaches to, or
  routes a click into that session: not the Apps page, not the Browser /
  Unblocker proxy, not a game, not anything added later.
- Apps and shortcuts open through Ink's own proxy only: `/proxy?s=<handle>`.
- If a site cannot run in the rewriting proxy (video, DRM, WebGL, a sign-in
  wall), it stays broken in Ink. Do not "fix" it by sending it to the cloud
  browser, and do not re-add a per-site `cloud`/provider flag, an "open in cloud
  browser" button, or a tile that points at `/browser/live`.
- Only `src/app/pages/Browser.tsx` (the agent) and `BrowserView.tsx` (the
  standalone viewer the agent opens) may call `/api/browser/*`.

## Ink's URL never names a site

A shortcut carries an opaque handle: `/proxy?s=<hash>`, produced by `siteCode()`
in `src/shared/sites.ts`. A site's address, hostname or name must never appear
in an Ink URL, query string, path segment, document title or history entry — a
classroom filter reads exactly that. `?url=` and `/proxy/<encoded>` are still
accepted so old links work, but nothing new may produce them.

## App icons are fetched by the worker

The Apps page requests `/api/app-icon/<host>` on Ink's own origin. Never call a
third-party favicon service (`google.com/s2/favicons`, gstatic) from the page:
one request per tile names every app to the filter.

## Verify before shipping

`npx tsc --noEmit` and `npm run build` must pass. Production is the Cloudflare
Pages project `ink-jo3`, branch `main`; a `*.ink-jo3.pages.dev` deployment URL is
the same code as the custom domain.

## Production domain

Ship to, verify against, and quote **`https://www.inkbrowser.dpdns.org`**. That is
the live site the user gives out. `https://ink.7394.jo3.org` is the old address:
it still reaches the same Pages project, but it is not the production URL to
report or link, and it is unreliable from some networks, so verify on
`*.ink-jo3.pages.dev` and then confirm the alias on the `www.inkbrowser.dpdns.org`
host.

When the domain shows up in config, keep these in sync with it: `APP_ORIGIN` in
`pages/wrangler.jsonc` and `wrangler.ink-live.jsonc`, the origin lists in
`src/worker/auth.ts`, `MOVED_ORIGIN` in `src/worker/index.ts`, and the defaults in
`scripts/check-pages-config.mjs`, `scripts/check-production.mjs` and
`scripts/load-test.mjs`.

## Butter fixes ship everywhere

A change to Butter (`/butter`, `/butter/party`) is not finished until it is both
live and on GitHub: `npx tsc --noEmit` and `npm run build` must pass, then
`node scripts/deploy-pages.mjs` (and the `ink-harbor-2f9` host), then commit and
push to `origin main`. Leaving a butter fix only deployed leaves the repo behind
what the site is running.
