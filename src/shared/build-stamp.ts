/**
 * Which commit a deployed worker is running.
 *
 * The literals below are placeholders. `scripts/stamp-worker.mjs` — and the same
 * step inside `scripts/deploy-pages.mjs` — replace them with the real commit and
 * time while copying the built worker to the upload directory, so a live site can
 * answer "what am I?" at `/api/version`.
 *
 * They stay placeholders in a local build, and the route answers `dev` then.
 * Nothing here reaches the browser, so no version string is shown to a reader.
 */
export const BUILD_COMMIT = '__INK_COMMIT__'
export const BUILD_TIME = '__INK_BUILD_TIME__'
