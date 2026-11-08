// Build mode asks a free lane for one self-contained HTML page. The page is
// rendered only inside a sandboxed iframe; the Worker never opens it.

import type { PublicLane } from './public-ai'
import { activeLanes, laneKey, laneStrength, laneText, type LaneResult } from './public-ai'
import type { BuildInfo } from '../shared/types'
import { AiError } from './ai'
import { MAX_BUILD_HTML_CHARS } from '../shared/config'
import { repairDocument } from '../shared/html'
import { escapeHtml, fetchSitePage, SiteError } from './site-proxy'

export type BuildIntent = {
  lanes: PublicLane[]
  question: string
  signal?: AbortSignal
  onStatus?: (text: string) => Promise<void> | void
  onLaneResult?: (result: LaneResult) => void
  /** Persisted provider health by lane key, so healthy lanes are tried first. */
  health?: Map<string, string>
}

export type BuildOutcome = {
  text: string
  build: BuildInfo
}

// Free lanes sometimes echo the instructions before writing the page, so the
// prompt's own "<!doctype html> … </html>" mentions can look like a document.
// Only complete markup with a body counts, and the last full document wins.
const PROMPT_ECHO =
  /You are a senior product designer|Do not use Markdown fences|Keep it under 70 KB|No external scripts|No claims of testing|Key requirements/i

const visibleText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const elementCount = (html: string) =>
  html.match(/<(?:head|body|title|style|div|main|section|h1|p|header|nav|form|canvas|svg|img|button|footer|ul|li|table|input|a)[\s>]/gi)?.length ?? 0

export function extractHtml(raw: string): string | undefined {
  const fenced = /```(?:html|htm)?[ \t]*\r?\n([\s\S]*?)```/i.exec(raw)?.[1]
  const valid = (html: string): boolean => {
    if (html.length > MAX_BUILD_HTML_CHARS) return false
    // Echoed instructions inside an HTML comment do not make the page prose.
    const visible = html.replace(/<!--[\s\S]*?-->/g, '')
    if (PROMPT_ECHO.test(visible)) return false
    // Prose that merely mentions the tags has almost no real elements.
    if (elementCount(visible) < 2) return false
    // A page with no copy is a blank preview. The model sometimes returns a
    // CSS-only shell, so treat it as a failed attempt and let a lane retry.
    const text = visibleText(visible)
    if (text.length < 40) return false
    // A shell of headings and "..." placeholders is not a page: require enough
    // actual letters and reject a body made mostly of ellipses.
    if ((text.match(/[a-z]/gi) ?? []).length < 50) return false
    if ((text.match(/\.{3,}/g) ?? []).length > 4) return false
    if (!/<(?:h1|h2|h3|p|div|header|main|section|article|nav|footer|button|form|ul|li|table|img|a)[\s>]/i.test(visible)) return false
    return /^\s*(?:<!doctype html|<html[\s>])/i.test(html)
  }
  for (const source of fenced ? [fenced, raw] : [raw]) {
    const starts = [...source.matchAll(/<!doctype html\s*>|<html(?:\s[^>]*)?>/gi)]
    const ends = [...source.matchAll(/<\/html\s*>/gi)]
    const lastEnd = ends[ends.length - 1]?.index ?? -1
    // Later starts win: the page a model writes last is the answer, while an
    // echoed instruction comes earlier. Taking the longest slice instead would
    // glue the echoed prompt onto the front of the real page.
    for (let i = starts.length - 1; i >= 0; i -= 1) {
      const start = starts[i].index ?? -1
      if (start < 0) continue
      // Keep a doctype that sits immediately before the chosen <html> tag.
      const doctype = /<!doctype html\s*>\s*$/i.exec(source.slice(Math.max(0, start - 40), start))
      const begin = doctype ? start - doctype[0].length : start
      if (lastEnd > start) {
        const html = source.slice(begin, lastEnd + 7).trim()
        if (valid(html)) return html
        continue
      }
      // A reply cut off by the token limit has no closing </html>. Browsers
      // tolerate missing closing tags, so close the page instead of dropping it.
      const rest = source.slice(begin).trim()
      if (!/<(?:head|body)[\s>]/i.test(rest)) continue
      const closed = /<\/body\s*>\s*$/i.test(rest) ? `${rest}\n</html>` : `${rest}\n</body>\n</html>`
      if (valid(closed)) return closed
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
  // Prefer lanes the health table says are working, then the strongest model.
  // A lane that returns junk is recorded as a failure below, so it moves down
  // on the next attempt instead of being trusted again.
  const healthRank = (lane: PublicLane) => {
    const status = input.health?.get(laneKey(lane))
    return status === 'healthy' ? 0 : status === 'down' ? 2 : 1
  }
  const ranked = [...activeLanes(input.lanes)].sort(
    (a, b) => healthRank(a) - healthRank(b) || laneStrength(b.model, b.url) - laneStrength(a.model, a.url),
  )
  const system = `You are a senior product designer and front-end engineer. Build one complete, polished, self-contained HTML website.

Start your reply with <!doctype html> and end it with </html>. Output nothing before or after the document: no Markdown fences, no plan, no explanation, and never repeat these instructions.

The request may be a landing page, portfolio, blog, dashboard, storefront, booking page, calculator, game or small interactive tool. Choose a visual direction and layout that fits the subject.

Rules:
- Use inline CSS and JavaScript, semantic HTML, and responsive layouts for phone and desktop.
- Write specific, useful copy. Never use lorem ipsum or placeholder headings.
- Make the controls actually work in the browser. A form may show a success message; there is no backend.
- Use inline SVG, CSS gradients or HTTPS images for artwork. Do not use external scripts, stylesheets, fonts, fetch, XHR, WebSocket, storage or API calls.
- Fill the body with the real page: headings, copy and controls. Never return an empty shell or a CSS-only document.
- Keep it compact: one page of roughly 8–15 KB with at most three sections, and include a descriptive <title>.
- Do not claim to have tested it, and do not invent testimonials, statistics or customers.`

  // A page takes tens of seconds on a free lane. Cap the whole attempt so a
  // busy model cannot leave the reply spinning for minutes, and report the
  // wait while a lane writes, since there is no partial HTML to show yet.
  const deadline = Date.now() + 110_000
  for (const lane of ranked.slice(0, 5)) {
    const remaining = deadline - Date.now()
    if (remaining < 12_000) break
    const startedAt = Date.now()
    const timeout = AbortSignal.timeout(Math.min(40_000, remaining))
    let heartbeat: ReturnType<typeof setInterval> | undefined
    try {
      await input.onStatus?.(`Building a self-contained page with ${lane.label}…`)
      heartbeat = setInterval(() => {
        const seconds = Math.round((Date.now() - startedAt) / 1_000)
        void input.onStatus?.(`Still writing the page… ${seconds}s`)
      }, 15_000)
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout
      const raw = await laneText(lane, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: input.question.replace(/\s+/g, ' ').trim().slice(0, 2_000) },
        ],
        signal,
        temperature: 0.2,
        maxTokens: 4_000,
        // laneText reports its own failures; a success only counts once the
        // page passes validation, so junk output cannot mark a lane healthy.
        onLaneResult: (result) => {
          if (!result.ok) input.onLaneResult?.(result)
        },
      })
      const html = extractHtml(raw)
      if (!html) {
        console.log('build.rejected', {
          lane: lane.label,
          chars: raw.length,
          echo: PROMPT_ECHO.test(raw),
          head: raw.slice(0, 90).replace(/\s+/g, ' '),
          tail: raw.slice(-70).replace(/\s+/g, ' '),
        })
        // The model answered but not with a page: count it as a lane failure
        // so the health table stops putting it first on the next build.
        input.onLaneResult?.({
          lane,
          ok: false,
          code: 'empty',
          message: 'The model did not return a usable page.',
          latencyMs: Date.now() - startedAt,
        })
        continue
      }
      input.onLaneResult?.({ lane, ok: true, latencyMs: Date.now() - startedAt })
      const safe = secure(repairDocument(html))
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
    } catch (error) {
      if (input.signal?.aborted) break
      console.log('build.lane_failed', {
        lane: lane.label,
        error: timeout.aborted
          ? 'timeout: the lane was too slow.'
          : error instanceof AiError
            ? `${error.code}: ${error.message}`
            : String(error).slice(0, 200),
      })
      // Try another free lane within the remaining budget.
    } finally {
      if (heartbeat) clearInterval(heartbeat)
    }
  }
  throw new AiError('unavailable', 'Build could not finish a page from a free model. Free models may be busy right now — try again, or ask for something smaller.', 503)
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
