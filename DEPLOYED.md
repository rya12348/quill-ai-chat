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

## Last deploy recorded here

`scripts/deploy-pages.mjs` rewrites this block after a deployment passes its
smoke test, so the file never claims more than actually ran.

<!-- deploy:begin -->
- live commit: `f347772a1ba37ae276c3ee1d1a1499b2c9824655`
- built: 2026-11-23T20:49:33.355Z
- checked: 2026-11-23T20:50:34.042Z
- site: https://www.inkbrowser.dpdns.org
<!-- deploy:end -->
