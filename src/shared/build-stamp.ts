/**
 * Which commit a deployed worker is running.
 *
 * `BUILD_STAMP` is a placeholder string. `scripts/deploy-pages.mjs` — and
 * `scripts/stamp-worker.mjs` for the second host — replace it with
 * `{"commit":"…","builtAt":"…"}` while copying the built worker to the upload
 * directory, and `/api/version` parses it.
 *
 * It is one opaque JSON string rather than two string constants because a
 * bundler is free to constant-fold `'__X__'.startsWith('__')` and bake the
 * fallback in — which it did, and `/api/version` answered `builtAt: null` on a
 * correctly stamped build. A string that is only ever handed to `JSON.parse`
 * cannot be folded, and an unstamped local build fails the parse and says `dev`.
 */
export const BUILD_STAMP = '__INK_STAMP__'
