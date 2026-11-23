import type { Env } from './env'
import { searchPrompt, webSearch } from './search'
import { fetchSitePage } from './site-proxy'

/**
 * A page of documentation, as the coder can read it.
 *
 * A free model invents APIs: a canvas method that does not exist, a CSS
 * property with the wrong name, a library function from an older major version.
 * The fix is the same one a person uses — read the reference — so the edit turn
 * can ask for one URL and get back the readable text.
 *
 * fetchSitePage already enforces what matters here: public HTTP(S) only,
 * private hosts refused, redirects bounded, its own timeout. This module adds
 * the HTML-to-text step, the size cap and the error text the model sees.
 */

export const DOC_FETCH_CHARS = 8_000

export function readableText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/pre|\/section)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/**
 * A request that depends on something outside the files: a library, a CDN, a
 * version, a live API. Free models answer these from memory and invent the
 * details, so the turn looks them up before it writes anything.
 */
export const NEEDS_RESEARCH =
  /\b(?:react|vue|svelte|angular|next\.?js|tailwind|bootstrap|three\.?js|chart\.?js|d3|leaflet|mapbox|gsap|framer|anime\.?js|p5\.?js|stripe|supabase|firebase|auth0|openai|anthropic|api|sdk|cdn|library|framework|package|npm|jsdelivr|unpkg|version|latest|current|docs?|documentation|reference|changelog)\b/i

export function needsResearch(prompt: string): boolean {
  return prompt.trim().length >= 10 && NEEDS_RESEARCH.test(prompt)
}

/**
 * Reference notes fetched just now, or '' when the request needs none. Every
 * source is optional and none of them can fail the turn.
 */
export async function researchNotes(env: Env, prompt: string, signal?: AbortSignal): Promise<string> {
  if (!needsResearch(prompt)) return ''
  const results = await webSearch(env, prompt.trim().slice(0, 300), signal).catch(() => [])
  if (!results.length) return ''
  return `Reference notes fetched from the web just now, for this request only:\n\n${searchPrompt(results.slice(0, 4))}`
}

/** The text of one public page, trimmed to what a prompt can afford. */
export async function fetchReadablePage(url: string, signal?: AbortSignal): Promise<string> {
  const page = await fetchSitePage(url, signal)
  const text = readableText(page.html)
  if (!text) throw new Error('that page had no readable text')
  const body = text.length > DOC_FETCH_CHARS ? `${text.slice(0, DOC_FETCH_CHARS)}\n…(truncated)` : text
  return `<document url="${page.finalUrl}" title="${page.title.replace(/"/g, "'").slice(0, 120)}">\n${body}\n</document>`
}
