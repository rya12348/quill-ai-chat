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
- live commit: `3db0ba27cfa00f02ea835c28419922764a58ef36`
- built: 2026-11-23T22:07:31.688Z
- checked: 2026-11-23T22:08:01.760Z
- site: https://www.inkbrowser.dpdns.org
<!-- deploy:end -->
