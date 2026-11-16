# Production Pages config

`pages/wrangler.jsonc` is the only production deployment source of truth. It
pins the `ink-jo3` project, the `ink-live` D1 database, the separate
`ink-live-preview` database for branch deployments, and the runtime flags.

`npm run deploy:pages` validates this file before building. The root
`wrangler.jsonc` is for local development, and `deploy.json` is the legacy
Freebuff Sites manifest; neither is used by the production Pages deploy.
