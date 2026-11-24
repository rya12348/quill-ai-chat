# What is live

Production is <https://www.inkbrowser.dpdns.org> — Cloudflare Pages project
`ink-jo3`, branch `main`.

## The site states its own commit

```sh
curl -s https://www.inkbrowser.dpdns.org/api/version
# {"ok":true,"site":"ink","commit":"d2f5e5c…","builtAt":"2026-11-23T…Z"}
```

Compare that `commit` with `git rev-parse origin/main`. Equal means the site is
the repository. This is the one check to run before believing anything about what
is deployed — especially from an editor or agent that can only see GitHub.

## Last snapshot

`node scripts/record-deploy.mjs` copies the site's own answer into the block
below, and nothing commits it automatically. Treat it as a dated snapshot, not a
promise: **`/api/version` is the truth**, and a docs-only commit may sit on top of
what is live.

<!-- deploy:begin -->
- live commit: `4ba57c9fc5e5d15df12be903d39d9806599fac1c-dirty`
- built: 2026-11-24T00:42:01.629Z
- checked: 2026-11-24T00:42:51.071Z
- site: https://www.inkbrowser.dpdns.org
<!-- deploy:end -->
