# Shipping Ink

The exact procedure this repository ships with. `AGENTS.md` holds the rules; this
file holds the commands, the order, and the checks that catch a fake success.

## What "production" is

Two Cloudflare Pages projects run the same code:

| Project | Serves | Deployed by |
|---|---|---|
| `ink-jo3` | `ink-jo3.pages.dev`, `ink.7394.jo3.org` | `node scripts/deploy-pages.mjs` |
| `ink-harbor-2f9` | **`https://www.inkbrowser.dpdns.org`** | hand deploy, see below |

`www.inkbrowser.dpdns.org` is the address people are given, and it belongs to
`ink-harbor-2f9` — not to `ink-jo3`. Deploying only `ink-jo3` leaves the real site
on the old build. Ship both, every time.

## Before shipping

```sh
npx tsc --noEmit          # must exit 0
npm run build             # must exit 0 — check the exit code, not the tail
```

`npm test` currently has four known failures that predate this work (a file move,
a plan round, an unrequested delete, Unity assets). They are real work, not a
formality to bypass: do not delete them, skip them, or loosen the assertions to
get a green run.

Build notes:

- The build is memory-hungry (a ~11 MB generated card bank). It runs Vite with
  `--max-old-space-size=8192`; do not reduce it.
- A build that exits non-zero leaves the previous `dist/` in place. Deploying then
  ships old code and looks successful. Always read the exit status.

## Ship

1. **Primary project**

   ```sh
   node scripts/deploy-pages.mjs
   ```

   It backs up D1 on `main`, uploads, then smoke-tests: `/api/health`,
   `/api/ready`, guest sign-in, one real chat turn, and `/api/version` equal to the
   commit it just uploaded. It exits non-zero on any failure — believe it.

2. **The project behind `www`**

   ```sh
   node scripts/stamp-worker.mjs
   rm -f .wrangler/deploy/config.json
   ( cd pages-alt && node ../node_modules/wrangler/bin/wrangler.js pages deploy \
       --project-name ink-harbor-2f9 --branch main --commit-dirty=true )
   rm -f dist/client/_worker.js
   ```

   `stamp-worker.mjs` writes `dist/client/_worker.js` with the commit baked in.
   `rm -f .wrangler/deploy/config.json` first: a stale generated redirect makes
   `wrangler pages deploy` exit 1. The last `rm` matters — a leftover
   `_worker.js` races the primary deploy's own copy of that file.

3. **Prove it is live**

   ```sh
   EXPECT=$(git rev-parse HEAD)
   for i in $(seq 1 20); do
     V=$(curl -s https://www.inkbrowser.dpdns.org/api/version)
     case "$V" in *"$EXPECT"*) echo "live: $V"; break;; esac
     sleep 5
   done
   ```

   The alias lags the upload by up to a minute. Until this prints the commit you
   just pushed, the site is not on it — say "deployed, not yet confirmed" rather
   than "done".

4. **Record and push**

   ```sh
   node scripts/record-deploy.mjs   # dated snapshot in DEPLOYED.md
   git add -A && git commit && git push origin main
   ```

## Knowing what is live

`/api/version` is the answer — public, uncached, no auth:

```sh
curl -s https://www.inkbrowser.dpdns.org/api/version
# {"ok":true,"site":"ink","commit":"…","builtAt":"…"}
```

Compare `commit` with `git rev-parse origin/main`. Equal means the site is the
repository. A `commit` of `"dev"` means the uploaded worker was never stamped:
the upload skipped `scripts/deploy-pages.mjs` or `scripts/stamp-worker.mjs`.

Do not infer state from a green deploy log, a saved URL, or an old screenshot.
Ask the site.

## Traps that produced false "done"s

- **Old `dist/` shipped after a failed build.** Read the build exit code.
- **Unstamped worker.** `/api/version` says `dev`; hand-copying
  `dist/ai_chat/index.js` to `dist/client/_worker.js` skips the stamp.
- **Two deploys racing.** `deploy-pages.mjs` takes a lock and re-checks
  `_worker.js` right before upload. Do not run two deploys at once by hand.
- **Stale alias.** The upload URL answers before `www` does. Poll `/api/version`.
- **A new preview origin needs guest sign-in again.** "Continue as guest" is per
  origin; a 401 on a fresh `*.pages.dev` is not a code failure.
- **`position: relative` on the game gate.** The shipped stylesheet uses
  `position: absolute; inset: 0`; overriding it clips the lower panels and kills
  scrolling. Layout overrides in `src/styles.css` should add, not replace, the
  gate's own positioning.

## Never

- Deploy without `tsc` and `build` passing on the exact tree you ship.
- Push to production from a dirty tree and call the result a commit.
- Weaken a test, skip a check, or edit a smoke test to make a deploy pass.
- Report a URL as live without `/api/version` agreeing.
