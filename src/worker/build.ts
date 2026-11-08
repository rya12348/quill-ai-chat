// Build mode asks a free lane for one self-contained HTML page. The page is
// rendered only inside a sandboxed iframe; the Worker never opens it.

import type { PublicLane } from './public-ai'
import { activeLanes, laneStrength, laneText, type LaneResult } from './public-ai'
import type { BuildInfo } from '../shared/types'
import { AiError } from './ai'
import { MAX_BUILD_HTML_CHARS } from '../shared/config'
import { escapeHtml, fetchSitePage, SiteError } from './site-proxy'

export type BuildIntent = {
  lanes: PublicLane[]
  question: string
  signal?: AbortSignal
  onStatus?: (text: string) => Promise<void> | void
  onLaneResult?: (result: LaneResult) => void
}

export type BuildOutcome = {
  text: string
  build: BuildInfo
}

// Free lanes sometimes echo the instructions before writing the page, so the
// prompt's own "<!doctype html> … </html>" mentions can look like a document.
// Only complete markup with a body counts, and the last full document wins.
const PROMPT_ECHO = /You are a senior product designer|Do not use Markdown fences|Keep it under 70 KB/i

export function extractHtml(raw: string): string | undefined {
  const fenced = /```(?:html|htm)?[ \t]*\r?\n([\s\S]*?)```/i.exec(raw)?.[1]
  for (const source of fenced ? [fenced, raw] : [raw]) {
    const starts = [...source.matchAll(/<!doctype html\s*>|<html(?:\s[^>]*)?>/gi)]
    const ends = [...source.matchAll(/<\/html\s*>/gi)]
    if (!starts.length || !ends.length) continue
    const docEnd = ends[ends.length - 1].index ?? -1
    // Walk backwards: a model that planned first and wrote the page last puts
    // the real document at the end, while the echoed instructions are earlier.
    for (let i = starts.length - 1; i >= 0; i -= 1) {
      const start = starts[i].index ?? -1
      if (start < 0 || docEnd <= start) continue
      // Keep a doctype that sits immediately before the chosen <html> tag.
      const doctype = /<!doctype html\s*>\s*$/i.exec(source.slice(Math.max(0, start - 40), start))
      const begin = doctype ? start - doctype[0].length : start
      const html = source.slice(begin, docEnd + 7).trim()
      if (html.length > MAX_BUILD_HTML_CHARS) continue
      // Prose that merely mentions the tags has no head, body or real elements.
      if (!/<(?:head|body)[\s>]/i.test(html)) continue
      if (!/<(?:title|style|div|main|section|h1|p|header|nav|form|canvas|svg)[\s>]/i.test(html)) continue
      if (PROMPT_ECHO.test(html)) continue
      return html
    }
  }
  return undefined
}

function secure(html: string): string {
  const csp =
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; media-src https: data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">`
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (tag) => `${tag}${csp}`)
  return html.replace(/<html(?:\s[^>]*)?>/i, (tag) => `${tag}<head>${csp}</head>`)
}

function titleOf(html: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  return (title ?? 'Built page').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Built page'
}

export async function buildComplete(input: BuildIntent): Promise<BuildOutcome> {
  const ranked = [...activeLanes(input.lanes)].sort(
    (a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url),
  )
  const system = `You are a senior product designer and front-end engineer. Build one complete, polished, self-contained HTML website.

Start your reply with <!doctype html> and end it with </html>. Output nothing before or after the document: no Markdown fences, no plan, no explanation, and never repeat these instructions.

The request may be a landing page, portfolio, blog, dashboard, storefront, booking page, calculator, game or small interactive tool. Choose a visual direction and layout that fits the subject.

Rules:
- Use inline CSS and JavaScript, semantic HTML, and responsive layouts for phone and desktop.
- Write specific, useful copy. Never use lorem ipsum or placeholder headings.
- Make the controls actually work in the browser. A form may show a success message; there is no backend.
- Use inline SVG, CSS gradients or HTTPS images for artwork. Do not use external scripts, stylesheets, fonts, fetch, XHR, WebSocket, storage or API calls.
- Keep it under 70 KB and include a descriptive <title>.
- Do not claim to have tested it, and do not invent testimonials, statistics or customers.`

  for (const lane of ranked.slice(0, 3)) {
    try {
      await input.onStatus?.('Building a self-contained page…')
      const signal = AbortSignal.any([input.signal ?? new AbortController().signal, AbortSignal.timeout(60_000)])
      const raw = await laneText(lane, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000) },
        ],
        signal,
        temperature: 0.2,
        maxTokens: 4_000,
        onLaneResult: input.onLaneResult,
      })
      const html = extractHtml(raw)
      if (!html) {
        console.log('build.rejected', { lane: lane.label, chars: raw.length })
        continue
      }
      const safe = secure(html)
      return {
        text: 'Here is your page. Preview it below, then download it when it looks right.',
        build: {
          status: 'ready',
          kind: 'page',
          title: titleOf(safe),
          html: safe,
          models: [lane.label ?? lane.model],
          asOf: Date.now(),
        },
      }
    } catch {
      if (input.signal?.aborted) break
      // Try another free lane.
    }
  }
  throw new AiError('unavailable', 'Build could not get a valid HTML page from a free model. Try a smaller, more specific request.', 503)
}

export type EmbedIntent = {
  target: string
  proxyPath: string
  signal?: AbortSignal
  onStatus?: (text: string) => Promise<void> | void
}

/**
 * A live site is not generated by a model. Fetch it once now to prove it can
 * be opened and to learn its title, then the token-scoped proxy serves the
 * actual page on every preview. Nothing is screenshotted or replayed.
 */
export async function buildEmbed(input: EmbedIntent): Promise<BuildOutcome> {
  await input.onStatus?.('Opening the live site…')
  let page
  try {
    page = await fetchSitePage(input.target, input.signal)
  } catch (error) {
    if (error instanceof SiteError) {
      throw new AiError(error.status >= 500 ? 'unavailable' : 'invalid', error.message, error.status)
    }
    throw error
  }
  if (input.signal?.aborted) throw new AiError('stopped', 'The build was stopped.', 499)
  const host = new URL(page.finalUrl).hostname.replace(/^www\./, '')
  const title = page.title || host
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#f6f4ef;color:#24221d}main{max-width:680px;margin:12vh auto;padding:0 28px}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#817b70}h1{font-size:clamp(2rem,7vw,4rem);line-height:1;letter-spacing:-.04em;margin:.2em 0 .5em}a{color:#157a55}</style></head><body><main><p class="eyebrow">Live site · ${escapeHtml(host)}</p><h1>${escapeHtml(title)}</h1><p>This is a live preview of <strong>${escapeHtml(host)}</strong> inside Quill, fetched through the preview proxy. It is not a screenshot.</p><p><a href="${escapeHtml(page.finalUrl)}" target="_blank" rel="noreferrer">Open the original site</a> for sign-in, checkout and features that need their own origin.</p></main></body></html>`
  return {
    text: `Here is ${host}, loaded live through Quill's proxy. Interact with it below. Some sites block sign-in, payments or cross-origin features; open the original for those.`,
    build: {
      status: 'ready',
      kind: 'embed',
      title,
      html,
      sourceUrl: page.finalUrl,
      proxyUrl: input.proxyPath,
      models: [],
      asOf: Date.now(),
    },
  }
}
