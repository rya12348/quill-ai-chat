import type { BrowserAction, BrowserElement } from './types'

/** The exact sentence that tells the caller the page cannot answer yet. */
export const PAGE_ANSWER_UNAVAILABLE = 'That answer is not visible on this page.'

// A reasoning model sometimes answers first and then narrates its own checks.
// These are line starts, not arbitrary words, so a real answer that happens to
// mention "done" or "analysis" is still usable.
const PAGE_ANSWER_NOISE =
  /^(?:here'?s\s+(?:a|my)\s+thinking\s+process|thinking\s+process|analysis|reasoning|let\s+me\s+(?:think|check|verify)|self[- ]correction|check\s+constraints|output\s+generation|final\s+check|constraints?\s+met|proceeds?|ready\.?|done\.?|matches\.?|i\s+(?:will|need|should|am going to)\b|the\s+prompt\b|prompt\s*:|verification|result\s*:|the\s+user\s+(?:asks|wants|is\s+asking|said|requested)|looking\s+at\s+the\s+page|based\s+on\s+the\s+page|wait\b|actually\b|however\b|\[(?:output|final answer|done|final check)\])/i

// A trace can start with a plausible sentence and only become obvious later.
// Count meta language as well as line starts so a long reasoning answer is
// rejected instead of being sliced into a misleading fragment.
const PAGE_ANSWER_META =
  /\b(?:the\s+user\s+(?:asks|wants|is\s+asking|said|requested)|looking\s+at\s+the\s+page|based\s+on\s+the\s+page|i\s+(?:need|will|should|can(?:not|'t)|do\s+not|don't|see|think|am\s+going)|let\s+me|wait\b|actually\b|however\b|the\s+page\s+(?:doesn'?t|does\s+not|shows|lists|says)|without\s+knowing|re-?read)\b/gi

/**
 * Keep a page answer person-facing. Models occasionally emit a correct answer
 * followed by their verification steps (or a chain-of-thought before it). The
 * worker and the UI both run this so a trace can never be shown as an answer.
 */
export function cleanPageAnswer(raw: string): string {
  let text = raw
    .trim()
    .replace(/^```(?:json|markdown|text)?\s*/i, '')
    .replace(/```$/, '')
    .trim()
  if (!text) return ''

  // Accept the JSON shape some lanes prefer. Use the last answer field: a
  // reasoning model may echo the requested schema before its real answer.
  const fields = [...text.matchAll(/"answer"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
  const field = fields.at(-1)?.[1]
  if (field) {
    try {
      text = JSON.parse(`"${field}"`)
    } catch {
      text = field
    }
  }
  text = text
    .trim()
    .replace(/^(?:final\s+answer|answer)\s*:\s*/i, '')
    .trim()
  if (!text) return ''

  // This sentence means the current page has no answer. Returning the exact
  // sentinel lets the caller fall through to the browser agent, which can open
  // the relevant tab instead of stopping on the wrong page.
  if (/That answer is not visible on this page\.?/i.test(text)) return PAGE_ANSWER_UNAVAILABLE
  if (/\bthe\s+user\s+(?:asks|wants|is\s+asking)\b/i.test(text)) return ''
  if (text.length > 240 && (text.match(PAGE_ANSWER_META)?.length ?? 0) >= 3) return ''

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const noiseAt = lines.findIndex((line) => PAGE_ANSWER_NOISE.test(line))
  if (noiseAt === 0) {
    // A bare "Done." can be a real answer; anything else that starts with
    // reasoning is not. Never return a partial chain-of-thought.
    return lines.length === 1 && /^(?:done|ready)\.?$/i.test(lines[0]) ? lines[0] : ''
  }
  if (noiseAt > 0) {
    const before = lines.slice(0, noiseAt).join('\n').trim()
    return before || ''
  }
  return text
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Answer “what is due today?” from visible dated work. This is deliberately
 * deterministic: a due list is a date comparison, not a reasoning task, and a
 * model lane that starts guessing today’s date is both slow and wrong.
 */
export function answerVisibleSchedule(text: string, now = new Date()): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.some((line) => /\b(?:due|deadline)\b/i.test(line))) return null

  type Item = { title: string; when: string; day: number }
  const items: Item[] = []
  let inToday = false
  const today = startOfDay(now)

  for (const line of lines) {
    if (/^due today\b/i.test(line)) {
      inToday = true
      continue
    }
    if (/^(?:due soon|upcoming|assigned|missing|completed)\b/i.test(line)) {
      inToday = false
      continue
    }
    const match = /\b(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*,?\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,\s*(\d{1,2}:\d{2}\s*(?:AM|PM)))?/i.exec(line)
    if (match?.[1] && match[2]) {
      const month = MONTHS[match[1].toLowerCase()]
      if (month === undefined) continue
      const day = Number(match[2])
      const date = new Date(now.getFullYear(), month, day)
      const after = line.slice(match.index + match[0].length).replace(/^\s*[-–—•:]\s*/, '').trim()
      const before = line.slice(0, match.index).replace(/[-–—•:]\s*$/, '').trim()
      const title = (after || before).slice(0, 160)
      if (title && /[a-z]/i.test(title)) {
        items.push({ title, when: match[0].replace(/^[A-Za-z]{3},?\s+/, ''), day: startOfDay(date) })
      }
      continue
    }
    if (inToday && line.length >= 3 && line.length <= 160 && !/^(?:view|see all|add|open)\b/i.test(line)) {
      items.push({ title: line, when: 'today', day: today })
    }
  }

  if (!items.length) return null
  const dueToday = items.filter((item) => item.day === today)
  if (dueToday.length) {
    return `Due today:\n${dueToday.slice(0, 5).map((item) => `- ${item.title}${item.when === 'today' ? '' : ` (${item.when})`}`).join('\n')}`
  }
  const next = items.filter((item) => item.day > today).sort((a, b) => a.day - b.day)[0]
  if (!next) return 'Nothing is due today.'
  return `Nothing is due today. Next up:\n- ${next.title} — ${next.when}`
}

const DIRECT_SITES: Record<string, string> = {
  gmail: 'https://mail.google.com/',
  'google mail': 'https://mail.google.com/',
  sheets: 'https://sheets.google.com/',
  'google sheets': 'https://sheets.google.com/',
  slideshow: 'https://docs.google.com/presentation/',
  presentation: 'https://docs.google.com/presentation/',
  'slide deck': 'https://docs.google.com/presentation/',
  'new slideshow': 'https://docs.google.com/presentation/',
  docs: 'https://docs.google.com/',
  'google docs': 'https://docs.google.com/',
  spreadsheet: 'https://docs.google.com/spreadsheets/create',
  spreadsheets: 'https://docs.google.com/spreadsheets/create',
  'google spreadsheet': 'https://docs.google.com/spreadsheets/create',
  'google spreadsheets': 'https://docs.google.com/spreadsheets/create',
  'a spreadsheet': 'https://docs.google.com/spreadsheets/create',
  'new spreadsheet': 'https://docs.google.com/spreadsheets/create',
  'blank spreadsheet': 'https://docs.google.com/spreadsheets/create',
  doc: 'https://docs.new/',
  'a doc': 'https://docs.new/',
  'a document': 'https://docs.new/',
  'google doc': 'https://docs.new/',
  'a google doc': 'https://docs.new/',
  'google document': 'https://docs.new/',
  'a google document': 'https://docs.new/',
  'a new doc': 'https://docs.new/',
  'a new document': 'https://docs.new/',
  'new doc': 'https://docs.new/',
  'new document': 'https://docs.new/',
  'blank doc': 'https://docs.new/',
  'blank document': 'https://docs.new/',
  drive: 'https://drive.google.com/',
  'google drive': 'https://drive.google.com/',
  calendar: 'https://calendar.google.com/',
  'google calendar': 'https://calendar.google.com/',
  classroom: 'https://classroom.google.com/',
  'google classroom': 'https://classroom.google.com/',
  edpuzzle: 'https://edpuzzle.com/',
  google: 'https://www.google.com/',
  duckduckgo: 'https://html.duckduckgo.com/html/',
  ddg: 'https://html.duckduckgo.com/html/',
  bing: 'https://www.bing.com/',
  brave: 'https://search.brave.com/',
  ecosia: 'https://www.ecosia.org/',
  startpage: 'https://www.startpage.com/',
  youtube: 'https://www.youtube.com/',
  github: 'https://github.com/',
  wikipedia: 'https://www.wikipedia.org/',
  x: 'https://x.com/',
  twitter: 'https://x.com/',
  reddit: 'https://www.reddit.com/',
  'hacker news': 'https://news.ycombinator.com/',
  hackernews: 'https://news.ycombinator.com/',
  hn: 'https://news.ycombinator.com/',
  linkedin: 'https://www.linkedin.com/',
  maps: 'https://www.google.com/maps',
  'google maps': 'https://www.google.com/maps',
  chatgpt: 'https://chatgpt.com/',
  photos: 'https://photos.google.com/',
  'google photos': 'https://photos.google.com/',
  keep: 'https://keep.google.com/',
  'google keep': 'https://keep.google.com/',
  meet: 'https://meet.google.com/',
  'google meet': 'https://meet.google.com/',
  forms: 'https://docs.google.com/forms/',
  'google forms': 'https://docs.google.com/forms/',
  slides: 'https://docs.google.com/presentation/',
  'google slides': 'https://docs.google.com/presentation/',
  translate: 'https://translate.google.com/',
  'google translate': 'https://translate.google.com/',
  'google earth': 'https://earth.google.com/web/',
  canvas: 'https://canvas.instructure.com/',
  schoology: 'https://app.schoology.com/',
  zoom: 'https://zoom.us/',
  'khan academy': 'https://www.khanacademy.org/',
  khanacademy: 'https://www.khanacademy.org/',
  ixl: 'https://www.ixl.com/',
  quizlet: 'https://quizlet.com/',
  desmos: 'https://www.desmos.com/',
  kahoot: 'https://kahoot.com/',
  nearpod: 'https://nearpod.com/',
  padlet: 'https://padlet.com/',
  turnitin: 'https://www.turnitin.com/',
  powerschool: 'https://www.powerschool.com/',
  'infinite campus': 'https://www.infinitecampus.com/',
  skyward: 'https://www.skyward.com/',
  naviance: 'https://www.naviance.com/',
  commonapp: 'https://www.commonapp.org/',
  'common app': 'https://www.commonapp.org/',
  collegeboard: 'https://www.collegeboard.org/',
  'college board': 'https://www.collegeboard.org/',
  amazon: 'https://www.amazon.com/',
  netflix: 'https://www.netflix.com/',
  spotify: 'https://open.spotify.com/',
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/',
  discord: 'https://discord.com/app',
  slack: 'https://app.slack.com/',
  notion: 'https://www.notion.so/',
  outlook: 'https://outlook.office.com/mail/',
  'outlook mail': 'https://outlook.office.com/mail/',
  office: 'https://www.office.com/',
  'microsoft office': 'https://www.office.com/',
  onedrive: 'https://onedrive.live.com/',
  teams: 'https://teams.microsoft.com/',
  'microsoft teams': 'https://teams.microsoft.com/',
  canva: 'https://www.canva.com/',
  figma: 'https://www.figma.com/',
  trello: 'https://trello.com/',
  asana: 'https://app.asana.com/',
  jira: 'https://www.atlassian.com/software/jira',
  confluence: 'https://www.atlassian.com/software/confluence',
  'stack overflow': 'https://stackoverflow.com/',
  stackoverflow: 'https://stackoverflow.com/',
  medium: 'https://medium.com/',
  substack: 'https://substack.com/',
  wordpress: 'https://wordpress.com/',
  coursera: 'https://www.coursera.org/',
  edx: 'https://www.edx.org/',
  duolingo: 'https://www.duolingo.com/',
  pinterest: 'https://www.pinterest.com/',
  tumblr: 'https://www.tumblr.com/',
  twitch: 'https://www.twitch.tv/',
  ebay: 'https://www.ebay.com/',
  walmart: 'https://www.walmart.com/',
  target: 'https://www.target.com/',
  bestbuy: 'https://www.bestbuy.com/',
  yelp: 'https://www.yelp.com/',
  booking: 'https://www.booking.com/',
  airbnb: 'https://www.airbnb.com/',
  uber: 'https://www.uber.com/',
  doordash: 'https://www.doordash.com/',
  instacart: 'https://www.instacart.com/',
  paypal: 'https://www.paypal.com/',
  venmo: 'https://venmo.com/',
  robinhood: 'https://robinhood.com/',
  coinbase: 'https://www.coinbase.com/',
  espn: 'https://www.espn.com/',
  cnn: 'https://www.cnn.com/',
  bbc: 'https://www.bbc.com/',
  nytimes: 'https://www.nytimes.com/',
  'new york times': 'https://www.nytimes.com/',
  weather: 'https://weather.com/',
  wolframalpha: 'https://www.wolframalpha.com/',
  'wolfram alpha': 'https://www.wolframalpha.com/',
  mathway: 'https://www.mathway.com/',
  photomath: 'https://photomath.com/',
  brainly: 'https://brainly.com/',
  chegg: 'https://www.chegg.com/',
  coursehero: 'https://www.coursehero.com/',
}

function publicUrl(raw: string): string | null {
  // A browser URL cannot contain literal whitespace. Without this guard a
  // compound task such as “go to example.com and click X” is mistaken for a
  // single URL whose path is the rest of the sentence.
  if (/\s/.test(raw)) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password) return null
    return parsed.href
  } catch {
    return null
  }
}

export type DirectBrowserTask =
  | { kind: 'open'; target: string; url: string }
  | { kind: 'search'; target: string; url: string; query: string }

/** A destination at the start of a longer task, e.g. "go to X and do Y". */
export type DirectBrowserLead = { target: string; url: string; rest: string }

function webSearchUrl(query: string): string {
  // Google shows cloud browsers an “unusual traffic” check, which turns a
  // one-second search into a CAPTCHA. DuckDuckGo's HTML page is stable from
  // the same remote browser and returns ordinary links.
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
}

/** Normalize a query and refuse site-scoped or multi-step searches. */
function normalizeSearchQuery(raw: string): string | null {
  let query = raw.replace(/^["'“”]+|["'“”]+$/g, '').replace(/[.!?]+$/, '').trim()
  if (!query) return null
  const suffix = /\s+(?:on|in)\s+(?:the\s+)?([a-z0-9.-]+(?:\.[a-z]{2,})?)$/i.exec(query)
  if (suffix?.[1]) {
    const site = suffix[1].toLowerCase()
    if (site === 'google' || site === 'google.com' || site === 'web') {
      query = query.slice(0, suffix.index).trim()
    } else if (DIRECT_SITES[site] || site.includes('.')) {
      return null
    }
  }
  if (!query) return null
  // A search shortcut must never swallow the rest of a compound task. If the
  // query contains another action or an answer request, let the browser agent
  // handle the whole instruction instead.
  if (/\b(?:click|tap|open|press|scroll|type|select|choose|download|play|then|after|tell|show|report|summari[sz]e|read|answer)\b/i.test(query)) return null
  return query
}

/** Query from a plain “search for X”, “look up X” or “google X” task. */
function searchQuery(task: string): string | null {
  if (/\b(?:this|current)\s+(?:page|site|tab)\b|\b(?:the|this)\s+page\b/i.test(task)) return null
  const match =
    /^(?:search(?:\s+the\s+web)?(?:\s+(?:on|in)\s+google)?\s+for|look\s+up)\s+(.+)$/i.exec(task) ??
    /^(?:search|google)\s+(?:on\s+)?(?:google\s+)?(?:for\s+)?(.+)$/i.exec(task)
  return normalizeSearchQuery(match?.[1] ?? '')
}

/** A destination a task can open without asking a model. */
export function directBrowserTarget(task: string): { target: string; url: string } | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  const match = /^(?:open|go to|visit|launch)\s+(?:the\s+)?(.+)$/i.exec(cleaned)
  if (!match) return null
  const target = match[1].trim()
  const key = target.toLowerCase().replace(/\s+/g, ' ')
  const url =
    DIRECT_SITES[key] ??
    publicUrl(target) ??
    (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(target) ? publicUrl(`https://${target}`) : null)
  return url ? { target, url } : null
}

/**
 * The shortest safe path for a simple browsing instruction. A known site opens
 * directly; a plain web search goes straight to web results instead of
 * spending a planner call to find and fill a search box.
 */
export function directBrowserTask(task: string): DirectBrowserTask | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')

  const openSearch = /^(?:open|go\s+to|visit|launch)\s+(?:the\s+)?(.+?)\s*(?:,|and|then)\s*(?:search(?:\s+for)?|look\s+up|google)\s+(?:for\s+)?(.+)$/i.exec(cleaned)
  if (openSearch?.[1] && openSearch[2]) {
    const destination = openSearch[1].trim().replace(/^["'“”]+|["'“”]+$/g, '')
    const host = destination.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    const query = normalizeSearchQuery(openSearch[2])
    if (query && (host === 'google' || host === 'google.com')) {
      return { kind: 'search', target: `Web search: ${query}`, url: webSearchUrl(query), query }
    }
  }

  const direct = directBrowserTarget(cleaned)
  if (direct) return { kind: 'open', ...direct }

  const query = searchQuery(cleaned)
  if (query) return { kind: 'search', target: `Web search: ${query}`, url: webSearchUrl(query), query }
  return null
}

export type DirectSearchAnswer = { query: string; url: string; question: string }

/**
 * “Search Google for X and tell me Y” is one search and one page read. The
 * planner currently spends two calls rediscovering the search URL and the
 * answer, so resolve the query here and let the fast answer lane read the
 * results page directly.
 */
export function directSearchAnswer(task: string): DirectSearchAnswer | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  if (!/\b(?:google|the\s+web)\b/i.test(cleaned)) return null
  const match =
    /^(?:please\s+)?(?:search(?:\s+(?:google|the\s+web))?(?:\s+for)?|google|look\s+up)\s+(.+?)\s*,?\s*(?:and\s+)?(?:then\s+)?(?:tell|show|give|report|answer|let\s+me\s+know|say|what|which|who|when|where|why|how|summari[sz]e|explain|describe)\b([\s\S]*)$/i.exec(
      cleaned,
    )
  if (!match?.[1]) return null
  const query = cleanIntentValue(match[1])
  // An open/click clause is a different deterministic path; don't swallow it
  // into the search query just because the sentence also asks for a title.
  if (/\b(?:open|click|tap|visit|navigate)\b/i.test(query)) return null
  if (!query || normalizeSearchQuery(query) !== query) return null
  return {
    query,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    question: `${match[2] || ''}`.trim(),
  }
}

export type DirectSearchOpen = { query: string; url: string; answerTitle: boolean }

/**
 * A standalone factual question should not pay for a full browser-planning
 * round. Exclude page-specific prompts (“this page”, “current tab”) because
 * those need the page, not a web search.
 */
export function answerVisibleFact(task: string, text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ')
  if (/\b(?:born|birth|birthday|birthdate)\b/i.test(task)) {
    const match = /(?:born|birth)[^.]{0,180}?\b(1[5-9]\d{2}|20\d{2})\b/i.exec(cleaned)
    if (match?.[1]) return match[1]
  }
  if (/hacker\s*news/i.test(task) && /\b(?:top|first|latest)\s+(?:story|post|item)\b/i.test(task)) {
    // Hacker News' snapshot text keeps the ranked front-page title after a
    // numeric rank: “1. Some title (example.com)”. Strip the rank/domain.
    const line = text.split(/\n+/).map((part) => part.trim()).find((part) => /^\d+\.\s+\S/.test(part))
    if (line) {
      return line.trim().replace(/^\d+\.\s+/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
    }
  }
  return null
}

export function directQuestionAnswer(task: string): DirectSearchAnswer | null {
  const cleaned = task.trim()
  if (cleaned.length < 8 || cleaned.length > 180 || !/\?$/.test(cleaned)) return null
  if (!/^(?:what|who|when|where|which|why|how\b|is\b|are\b|does\b|do\b|can\b)/i.test(cleaned)) return null
  if (/\b(?:this|current|open|click|tab|page|screen|here|my|our)\b/i.test(cleaned)) return null
  const query = normalizeSearchQuery(cleaned.replace(/\?+$/, ''))
  if (!query) return null
  return { query, url: webSearchUrl(query), question: cleaned }
}

/**
 * “Search Google for X, open the first result, and tell me the title” is one
 * search, one result click and one read. Doing it natively avoids three model
 * calls and the autocomplete/reordering mistakes that come with them.
 */
export function directSearchOpen(task: string): DirectSearchOpen | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  const match =
    /^(?:please\s+)?(?:search(?:\s+(?:google|the\s+web))?(?:\s+for)?|google)\s+(.+?)\s*,?\s*(?:and\s+)?(?:then\s+)?open\s+(?:the\s+)?(?:first|top)\s+(?:result|link|hit)\b([\s\S]*)$/i.exec(
      cleaned,
    )
  if (!match?.[1]) return null
  const query = cleanIntentValue(match[1])
  // “Search YouTube for cats” is a site search, not a web search. Without an
  // explicit engine, a leftover “for” means the query was a site name.
  if (/\bfor\b/i.test(query) && !/\b(?:google|the\s+web)\b/i.test(cleaned)) return null
  if (!query || normalizeSearchQuery(query) !== query) return null
  const url = /\bgoogle\b/i.test(cleaned)
    ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
    : webSearchUrl(query)
  return { query, url, answerTitle: /\b(?:title|headline)\b/i.test(match[2] || '') }
}

/**
 * Split a compound instruction at its destination. This lets Ink navigate
 * straight to the named site before planning the rest, instead of spending a
 * planner call to rediscover where the task starts.
 */
export function directBrowserLead(task: string): DirectBrowserLead | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  const match = /^(?:open|go\s+to|visit|launch)\s+(?:the\s+)?(.+?)\s*(?:,|and|then)\s+(.+)$/i.exec(cleaned)
  if (!match?.[1] || !match[2]) return null
  const target = match[1].trim()
  const rest = match[2].trim()
  // The existing direct search path is better than opening the search engine
  // and making the planner fill its box.
  if (/^(?:search|look\s+up|google)\b/i.test(rest)) return null
  const key = target.toLowerCase().replace(/\s+/g, ' ')
  const url =
    DIRECT_SITES[key] ??
    publicUrl(target) ??
    (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(target) ? publicUrl(`https://${target}`) : null)
  return url ? { target, url, rest } : null
}

/** A single keyboard or scroll action that needs no page state or planner. */
export function directBrowserAction(task: string): BrowserAction | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  if (/^(?:(?:go|click|press|tap)\s+)?(?:the\s+)?(?:back|previous)(?:\s+button)?$/i.test(cleaned)) return { type: 'back' }
  if (/^(?:(?:go|click|press|tap)\s+)?(?:the\s+)?forward(?:\s+button)?$/i.test(cleaned)) return { type: 'forward' }
  if (/^(?:reload|refresh)(?:\s+(?:the\s+)?(?:page|tab))?$|^(?:click|press|tap)\s+(?:the\s+)?(?:reload|refresh)(?:\s+button)?$/i.test(cleaned)) return { type: 'reload' }
  const wait = /^wait\s+(?:(\d+(?:\.\d+)?)\s*(ms|milliseconds?|seconds?|s))$/i.exec(cleaned)
  if (wait?.[1] && wait[2]) {
    const value = Number(wait[1])
    const ms = /^m/i.test(wait[2]) ? value : value * 1000
    return { type: 'wait', ms: Math.min(30_000, Math.max(100, Math.round(ms))) }
  }
  const press = /^(?:press|hit)\s+(enter|escape|tab|backspace|delete|space|arrow\s*(?:up|down|left|right)|page\s*(?:up|down))$/i.exec(cleaned)
  if (press?.[1]) {
    const raw = press[1].toLowerCase().replace(/\s+/g, '')
    const key = raw.startsWith('arrow')
      ? `Arrow${raw.slice(5).replace(/^./, (letter) => letter.toUpperCase())}`
      : raw.startsWith('page')
        ? `Page${raw.slice(4).replace(/^./, (letter) => letter.toUpperCase())}`
        : raw.replace(/^./, (letter) => letter.toUpperCase())
    return { type: 'press', key }
  }
  const scroll = /^scroll\s+(up|down)(?:\s+(?:by\s+)?(\d+))?$/i.exec(cleaned)
  if (scroll?.[1]) {
    const amount = Math.min(2_000, Math.max(120, Number(scroll[2]) || 480))
    return { type: 'scroll', x: 0, y: scroll[1].toLowerCase() === 'up' ? -amount : amount }
  }
  if (/^scroll\s+to\s+(?:the\s+)?top$/i.test(cleaned)) return { type: 'scroll', x: 0, y: -2_000 }
  if (/^scroll\s+to\s+(?:the\s+)?bottom$/i.test(cleaned)) return { type: 'scroll', x: 0, y: 2_000 }
  return null
}

/**
 * A plain “search for X” should use the search box already on the current
 * site, not jump to a web search. This is the difference between searching
 * YouTube and leaving YouTube for DuckDuckGo.
 */
export function directPageSearch(task: string, elements: BrowserElement[]): BrowserAction | null {
  if (/\b(?:the\s+web|google)\b/i.test(task)) return null
  const query = searchQuery(task)
  if (!query || !elements.length) return null
  const fields = elements.filter(
    (element) =>
      !element.disabled &&
      (isTextField(element) || element.role === 'combobox') &&
      !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(element.inputType || 'text'),
  )
  const named = fields.filter((element) => {
    const name = `${element.label || ''} ${element.placeholder || ''}`.toLowerCase()
    return element.inputType === 'search' || /\b(?:search|query|find)\b/.test(name)
  })
  const exact = named.filter((element) => /^(?:search|search\s+the\s+site|query)$/i.test(cleanElementTarget(element.label || element.placeholder || '')))
  const field = exact.length === 1 ? exact[0] : named.length === 1 ? named[0] : null
  if (!field) return null
  return { type: 'type', selector: `[data-stet-id="${field.id}"]`, text: query, submit: true }
}

function cleanIntentValue(value: string): string {
  return value
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim()
}

function elementText(element: BrowserElement): string {
  return cleanIntentValue(element.label || element.placeholder || element.value || '').toLowerCase()
}

export type DirectSiteSearch = { site: string; url: string; query: string; searchUrl?: string; followUp?: string }

/** Result URLs for search engines, where typing into the box is unnecessary. */
function searchEngineUrl(site: string, query: string): string | null {
  const q = encodeURIComponent(query)
  if (site === 'duckduckgo' || site === 'ddg') return `https://html.duckduckgo.com/html/?q=${q}`
  if (site === 'bing') return `https://www.bing.com/search?q=${q}`
  if (site === 'brave') return `https://search.brave.com/search?q=${q}`
  if (site === 'ecosia') return `https://www.ecosia.org/search?q=${q}`
  if (site === 'startpage') return `https://www.startpage.com/sp/search?query=${q}`
  // YouTube's results URL is deterministic and avoids waiting for its custom
  // search box to hydrate on the homepage.
  if (site === 'youtube') return `https://www.youtube.com/results?search_query=${q}`
  return null
}

/**
 * “Search YouTube for cats” and “open Amazon and search for shoes” are one
 * navigation plus the site's own search box. Resolve the site and query here
 * so the caller can use the page field instead of the planner.
 */
export function directSiteSearch(task: string): DirectSiteSearch | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  const forms = [
    /^(?:search(?:\s+the\s+web)?(?:\s+for)?|look\s+up)\s+(.+?)\s+(?:on|in)\s+(?:the\s+)?(.+)$/i,
    /^(?:search|look\s+up)\s+(?:on\s+)?(.+?)\s+for\s+(.+)$/i,
    /^(?:open|go\s+to|visit|launch)\s+(.+?)\s*(?:,|and|then)\s*(?:search(?:\s+for)?|look\s+up|google)\s+(?:for\s+)?(.+)$/i,
  ]
  let query = ''
  let site = ''
  let followUp = ''
  for (const form of forms) {
    const match = form.exec(cleaned)
    if (!match?.[1] || !match[2]) continue
    // Only “search for X on Y” puts the query first. “Search Y for X” and
    // “open Y and search for X” put the site first.
    const firstIsSite = form !== forms[0]
    query = cleanIntentValue(firstIsSite ? match[2] : match[1])
    // “Search Wikipedia for Ada Lovelace, open the first result” is still one
    // site query. Keep the result clause as a follow-up so the caller opens
    // the destination instead of stopping on the search page.
    const openFirst = /[\s,]*\b(?:and\s+)?(?:then\s+)?(?:open|click)\s+(?:the\s+)?(?:first|top)\s+(?:result|link|hit)\b([\s\S]*)$/i.exec(query)
    if (openFirst) {
      query = query.slice(0, openFirst.index).trim()
      followUp = `open the first result${openFirst[1] || ''}`.replace(/[\s,]+$/, '').trim()
    }
    site = cleanIntentValue(firstIsSite ? match[1] : match[2]).toLowerCase()
    // “Search Wikipedia for Ada Lovelace, then tell me when she was born” is
    // still one site search plus a page read. Keep the answer clause so the
    // caller can read it after the results load; leaving it in the query used
    // to fail normalization and send the whole task through the planner.
    const split = /^(.+?)\s*,?\s*(?:and\s+)?(?:then\s+)?((?:tell|show|say|report|answer|explain|summari[sz]e|find|give|let\s+me\s+know|what|which|who|when|where|why|how)\b.+)$/i.exec(query)
    if (split?.[1] && split[2]) {
      query = cleanIntentValue(split[1])
      followUp = split[2].trim()
    } else {
      // Answer phrasing without a question word is still not query text.
      query = query
        .replace(/\s*,?\s*(?:and\s+)?(?:then\s+)?(?:tell|show|give|report|answer|let\s+me\s+know|find\s+out)\b[\s\S]*$/i, '')
        .trim()
    }
    if (query && site && !/\b(?:then|after\s+that)\b/i.test(query)) break
    query = ''
    site = ''
    followUp = ''
  }
  if (!query || !site || /\b(?:the\s+web|google)\b/i.test(site)) return null
  if (normalizeSearchQuery(query) !== query) return null
  const url =
    DIRECT_SITES[site] ??
    publicUrl(site) ??
    (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(site) ? publicUrl(`https://${site}`) : null)
  if (!url) return null
  const searchUrl = searchEngineUrl(site, query)
  return { site, url, query, ...(searchUrl ? { searchUrl } : {}), ...(followUp ? { followUp } : {}) }
}

export type DirectSiteLookup = { site: string; url: string; query: string }

/**
 * “Open my math assignment in Google Classroom” is a navigate-plus-link-scan,
 * not a planning problem. Keep this generic for every known site so Classroom,
 * Drive, Gmail and ordinary websites all take the same direct path.
 */
export function directSiteLookup(task: string): DirectSiteLookup | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  const match =
    /^(?:open|find|locate|show\s+me|go\s+to|visit)\s+(?:the\s+|my\s+)?(.+?)\s+(?:in|on|inside)\s+(?:the\s+)?(.+?)$/i.exec(
      cleaned,
    )
  if (!match?.[1] || !match[2]) return null
  let query = cleanIntentValue(match[1]).replace(/^(?:the|my)\s+/i, '').trim()
  const site = cleanIntentValue(match[2]).toLowerCase().replace(/\s+/g, ' ')
  if (!query || /\b(?:then|after\s+that)\b/i.test(query)) return null
  if (/\bclassroom\b/i.test(site)) {
    // Classroom calls the list “To-do”. A generic “open my assignment” should
    // land there instead of asking a planner to hunt for a link named
    // “assignment”, and “math assignment” should resolve to the Math class.
    if (/^(?:assignments?|homework|to-?do|work|tasks?)$/i.test(query)) query = 'To-do'
    else query = query.replace(/\s+(?:assignments?|homework|tasks?|work)$/i, '').trim() || query
  }
  const url =
    DIRECT_SITES[site] ??
    publicUrl(site) ??
    (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(site) ? publicUrl(`https://${site}`) : null)
  if (!url) return null
  return { site, url, query }
}

function cleanElementTarget(value: string): string {
  return cleanIntentValue(value)
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+(?:button|link|tab|menu item|option|field|input|box|textarea)$/i, '')
    .trim()
    .toLowerCase()
}

function isTextField(element: BrowserElement): boolean {
  if (element.tag === 'textarea' || element.role === 'textbox') return true
  if (element.tag !== 'input') return false
  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image'].includes(element.inputType || 'text')
}

function findElement(
  elements: BrowserElement[],
  target: string,
  accepts: (element: BrowserElement) => boolean,
  allowTokens = false,
): BrowserElement | null {
  const wanted = cleanElementTarget(target)
  if (!wanted) return null
  const candidates = elements.filter((element) => !element.disabled && accepts(element))
  const exact = candidates.filter((element) => elementText(element) === wanted)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null
  const partial = candidates.filter((element) => {
    const name = elementText(element)
    if (!name) return false
    if (name.includes(wanted)) return true
    // A short label such as “About” must not match merely because the whole
    // sentence contains that word. Reverse containment is only safe for a
    // short target whose label is a distinctive phrase (“Turing Award”), not a
    // generic navigation word or a multi-clause instruction.
    const generic = /^(?:about|home|menu|more|page|site|info|help|contact|privacy|terms|login|sign in|search|next|back|close|open|here|learn more|read more|view|details)$/i
    return (
      wanted.split(/\s+/).length <= 6 &&
      wanted.length <= name.length + 40 &&
      wanted.includes(name) &&
      !generic.test(name)
    )
  })
  if (partial.length === 1) return partial[0]
  if (!allowTokens) return null
  // Form controls often expose only the name attribute ("custname") while the
  // visible label says "Customer name". Match one distinctive word when it is
  // unambiguous, so that still becomes a native field action. Do not use this
  // for links/buttons: "comments link for the top story" must not become the
  // first unrelated "comments" link on the page.
  const tokens = wanted.split(/\s+/).filter((token) => token.length >= 3)
  if (tokens.length) {
    const tokenMatches = candidates.filter((element) => {
      const name = elementText(element)
      return Boolean(name) && tokens.some((token) => name.includes(token))
    })
    if (tokenMatches.length === 1) return tokenMatches[0]
  }
  return null
}

function exactElement(
  elements: BrowserElement[],
  target: string,
  accepts: (element: BrowserElement) => boolean,
): BrowserElement | null {
  const wanted = cleanElementTarget(target)
  if (!wanted) return null
  const matches = elements.filter((element) => !element.disabled && accepts(element) && elementText(element) === wanted)
  return matches.length === 1 ? matches[0] : null
}

/** "The first comments link" is positional, but still resolvable in DOM order. */
function firstLabelElement(
  elements: BrowserElement[],
  target: string,
  accepts: (element: BrowserElement) => boolean,
): BrowserElement | null {
  const wanted = cleanElementTarget(target)
  const noun =
    /^(?:the\s+)?(.+?)\s+(?:link|button|tab|option)\b/i.exec(wanted)?.[1] ??
    /^(?:the\s+)?(?:top|first)\s+(.+)$/i.exec(wanted)?.[1]
  const query = cleanElementTarget(noun ?? '')
  if (query.length < 3) return null
  const matches = elements.filter(
    (element) => !element.disabled && accepts(element) && elementText(element).includes(query),
  )
  const visible = matches.filter((element) => !element.offscreen)
  const pool = visible.length ? visible : matches
  return (
    pool.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)[0] ?? null
  )
}

function contentLinks(elements: BrowserElement[], minLength = 12): BrowserElement[] {
  return elements
    .filter(
      (element) =>
        !element.disabled &&
        !element.offscreen &&
        element.rect.width > 0 &&
        element.rect.height > 0 &&
        (element.tag === 'a' || element.role === 'link') &&
        (element.label || '').trim().length >= minLength,
    )
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
}

export function firstContentLink(elements: BrowserElement[]): BrowserElement | null {
  return contentLinks(elements, 18)[0] ?? null
}

const ORDINALS: Record<string, number> = {
  first: 0,
  second: 1,
  third: 2,
  fourth: 3,
  fifth: 4,
  sixth: 5,
  seventh: 6,
  eighth: 7,
  ninth: 8,
  tenth: 9,
  last: -1,
}

/** “the second result” is a position in the page's own document order. */
function ordinalElement(elements: BrowserElement[], body: string): BrowserElement | null {
  const match =
    /^(?:click|tap|open|press|find|locate|show\s+me|go\s+to)\s+(?:on\s+)?(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+(.+?)(?:\s+(button|link|tab|menu item|option|item))?$/i.exec(
      body,
    )
  if (!match?.[1] || !match[2]) return null
  const index = ORDINALS[match[1].toLowerCase()]
  if (index === undefined) return null
  const noun = cleanElementTarget(match[2])
  if (!noun) return null
  const hint = (match[3] || '').toLowerCase()
  const accepts = (element: BrowserElement) => {
    if (hint === 'button') return element.tag === 'button' || element.role === 'button'
    if (hint === 'link') return element.tag === 'a' || element.role === 'link'
    return (
      element.tag === 'a' ||
      element.role === 'link' ||
      element.tag === 'button' ||
      element.role === 'button'
    )
  }
  const pool = elements.filter((element) => !element.disabled && accepts(element))
  // Search results, stories, emails and rows often have labels that name the
  // content rather than the noun (“Alan Turing - Wikipedia”, not “result”).
  // For those, use the ordered content links instead of requiring the noun in
  // the label. Other targets still need a real label match.
  const isContent =
    /^(?:results?|stories|story|posts?|articles?|items?|emails?|messages?|rows?|files?|videos?|links?|entries?|threads?)$/i.test(
      noun,
    )
  const named = pool.filter((element) => {
    const name = elementText(element)
    return Boolean(name) && (name.includes(noun) || noun.includes(name))
  })
  const links = contentLinks(pool, /^(?:emails?|messages?|rows?|files?)$/i.test(noun) ? 8 : 12)
  const ordered = isContent && links.length ? links : named.length ? named : isContent ? links : []
  if (!ordered.length) return null
  return index === -1 ? ordered[ordered.length - 1] : ordered[index] ?? null
}

/**
 * Resolve a simple page instruction against the snapshot that is already on
 * screen. This is the browser-equivalent of a local shortcut: no planner call,
 * no extra state fetch, just one native action. Ambiguous targets deliberately
 * fall through to the planner.
 */
const SEMANTIC_STOP_WORDS = new Set(
  'the a an and or of to in on for with my our your this that these those page pages section sections part parts link links button buttons tab tabs menu option item thing things one ones control controls element elements about where i can see view access show me please lets let allows allow able change changes changing manage is are be do does it its'.split(
    /\s+/,
  ),
)

/**
 * Resolve a described target (“the page about the Turing Award”, “the button
 * that says Continue”, “the section about early life”) against page labels.
 * This is a general phrase matcher, not a list of site-specific commands.
 */
function semanticAction(task: string, elements: BrowserElement[]): BrowserAction | null {
  let body = cleanIntentValue(task)
  if (isCompoundInstruction(body)) return null
  if (/\b(?:then|after that)\b/i.test(body)) return null
  if (/\b(?:fill|type|enter|select|choose|check|scroll|press\s+(?:enter|escape|tab|backspace|delete|space|arrow))\b/i.test(body)) return null
  const match = /^(?:please\s+)?(?:open|click|tap|press|find|locate|show\s+me|go\s+to|navigate\s+to|visit|launch|take\s+me\s+to)\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+)$/i.exec(body)
  if (!match?.[1]) return null
  let target = cleanIntentValue(match[1])
  target = target.replace(/\s+(?:on|in)\s+(?:this|the\s+current)\s+(?:page|site|tab)$/i, '').trim()
  target = target.replace(
    /^(?:page|section|part|link|button|tab|menu(?:\s+item)?|option|item|thing|one)\s+(?:about|for|to|called|named|that\s+says|which\s+says|where)\s+/i,
    '',
  )
  target = target.replace(/\s+(?:page|link|button|tab|menu\s+item|option|item)$/i, '').trim()
  target = target.replace(/^(?:the|a|an|my)\s+/i, '').trim()
  if (!target || target.length < 2) return null
  // Positional language has its own exact resolver; do not guess here.
  if (/\b(?:top|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|next|previous|latest|newest|oldest)\b/i.test(target)) return null
  const tokens = (target.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((token) => !SEMANTIC_STOP_WORDS.has(token))
  if (!tokens.length) return null
  const pool = elements.filter(
    (element) =>
      !element.disabled &&
      (element.tag === 'a' ||
        element.role === 'link' ||
        element.tag === 'button' ||
        element.role === 'button'),
  )
  if (!pool.length) return null
  const scored = pool
    .map((element) => {
      const label = elementText(element)
      const haystack = `${label} ${element.placeholder || ''} ${element.href || ''}`.toLowerCase()
      const exact = label === target.toLowerCase()
      const contains = haystack.includes(target.toLowerCase())
      const matched = tokens.filter((token) => haystack.includes(token)).length
      const coverage = matched / tokens.length
      const score = exact ? 100 : contains ? 80 : coverage * 60
      return { element, score, label }
    })
    .filter((item) => item.score >= 40)
    .sort((a, b) => b.score - a.score || a.element.rect.y - b.element.rect.y || a.element.rect.x - b.element.rect.x)
  const best = scored[0]
  if (!best) return null
  const second = scored[1]
  // A weak token match is a guess. Only act when the best label is clearly
  // ahead, so an unrelated nav link cannot win by sharing one word.
  if (best.score < 60 && second && second.score >= best.score - 5) return null
  return { type: 'click', selector: `[data-stet-id="${best.element.id}"]` }
}

/**
 * Fill an entire form from one plain-language form instruction, e.g. “fill
 * the form with name Ada, email ada@example.com, and phone 555”. This is
 * intentionally label-driven: it works on any site whose fields expose their
 * visible labels, not on one hardcoded form.
 */
export function directFormFill(task: string, elements: BrowserElement[]): BrowserAction | null {
  if (!elements.length) return null
  const cleaned = cleanIntentValue(task)
  const match = /^(?:fill|complete|submit)\s+(?:out\s+|in\s+)?(?:the\s+|this\s+|a\s+|my\s+)?(?:form|fields?|details?)\b\s*(?:with|using|:)?\s*([\s\S]+)$/i.exec(cleaned)
  if (!match?.[1]) return null
  let body = match[1].trim()
  const submit = /\b(?:and\s+)?(?:submit|send|save|continue|place\s+(?:the\s+)?order|apply)\s*$/i.test(body)
  body = body.replace(/\s*(?:,\s*)?(?:and\s+)?(?:submit|send|save|continue|place\s+(?:the\s+)?order|apply)\s*$/i, '').trim()
  if (!body) return null
  const fields = elements.filter((element) => !element.disabled && isTextField(element))
  if (!fields.length) return null

  // Longest labels first: “first name” must win over “name”.
  const ordered = [...fields].sort((a, b) => elementText(b).length - elementText(a).length)
  const chosen: { selector: string; value: string }[] = []
  const clauses = body.split(/\s*(?:,|;|\band\b)\s*/i).filter(Boolean)
  for (const clause of clauses) {
    const text = clause.trim().replace(/^(?:the|my|a|an)\s+/i, '')
    if (!text) continue
    const labelled = ordered.find((element) => {
      const label = elementText(element)
      return label.length >= 2 && text.toLowerCase().startsWith(label + ' ')
    })
    const pair = /^(.+?)\s*(?::|=|\bis\b|\bto\b|\bas\b)\s*(.+)$/i.exec(text)
    const label = labelled ? elementText(labelled) : pair?.[1] || ''
    const value = labelled ? text.slice(label.length).trim() : pair?.[2] || ''
    const field = labelled ?? (label ? findElement(fields, label, isTextField, true) : null)
    if (!field || !value) continue
    if (chosen.some((entry) => entry.selector === `[data-stet-id="${field.id}"]`)) continue
    chosen.push({ selector: `[data-stet-id="${field.id}"]`, value: cleanIntentValue(value) })
  }
  if (!chosen.length) return null
  return { type: 'fill', fields: chosen, submit }
}

const WORK_ONLY_TASK = /^(?:make|create|build|write|draft|compose|research|design|develop|prepare|produce|propose|recommend|analy[sz]e|compare|summari[sz]e|explain|describe|tell|show|list|answer|solve|complete|finish)\b/i

/**
 * A whole sentence is not a single page target. “Go to slideshow and make a
 * slideshow about space” used to find a loose word match on the current page
 * and click it, then report the entire task complete. Only a true single
 * action may use the deterministic element resolver.
 */
function isCompoundInstruction(task: string): boolean {
  const cleaned = cleanIntentValue(task)
  return (
    /\b(?:and|then)\b[\s\S]*\b(?:make|create|build|write|draft|compose|add|fill|type|enter|click|tap|open|go|navigate|visit|search|select|choose|press|submit|send|download|upload|delete|remove|save|book|buy|order|apply|compare|extract|summari[sz]e|read|tell|show)\b/i.test(
      cleaned,
    ) || WORK_ONLY_TASK.test(cleaned)
  )
}

export function directElementAction(task: string, elements: BrowserElement[]): BrowserAction | null {
  if (!elements.length) return null
  let body = cleanIntentValue(task)
  if (isCompoundInstruction(body)) return null
  if (/\b(?:then|after that)\b/i.test(body)) return null
  let submit = false
  const submitSuffix = /\s+(?:and|then)\s+(?:press\s+)?(?:enter|submit)\s*$/i
  if (submitSuffix.test(body)) {
    submit = true
    body = body.replace(submitSuffix, '').trim()
  }
  // Relative targets ("the first result", "the top story's comments") need
  // the page's context, not a guess at the first matching word. Only an exact
  // label may resolve natively; otherwise the planner handles the position.
  const relative = /\b(?:top|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|next|previous|best|cheapest|most|least|latest|newest|oldest|highest|lowest|nearest|closest|main|primary|secondary)\b/i.test(
    body,
  )
  // A bare label such as "Search" may be genuinely ambiguous (a search field
  // and a search button). Only descriptive phrases may fall back to intent
  // matching; otherwise the planner should see the page.
  const described = /\b(?:page|section|part|link|button|tab|option|item|thing|one)\s+(?:about|for|where|called|named|that\s+says|which\s+says)\b/i.test(
    body,
  )
  const resolve = (target: string, accepts: (element: BrowserElement) => boolean, allowTokens = false) => {
    if (!relative) return findElement(elements, target, accepts, allowTokens)
    return exactElement(elements, target, accepts) ?? (/\b(?:top|first)\b/i.test(body) ? firstLabelElement(elements, target, accepts) : null)
  }

  // “Open the top story/result” is positional, but the page usually exposes
  // the answer as its first long link. This is still a single native click,
  // so a newspaper or search-results task never needs a planner call.
  const positional =
    /^(?:open|click|tap)\s+(?:the\s+)?(?:top|first|latest|newest)\s+(?:story|post|article|result|item|link)\b/i.test(body) &&
    !/\bcomments?\b/i.test(body)
  if (positional) {
    const link = firstContentLink(elements)
    if (link) return { type: 'click', selector: `[data-stet-id="${link.id}"]` }
  }

  const ordinal = ordinalElement(elements, body)
  if (ordinal) return { type: 'click', selector: `[data-stet-id="${ordinal.id}"]` }

  // A trailing “submit” is the last clause of a compound form task. Resolve
  // the page's own submit/send control instead of spending a planner round
  // trip on an action the snapshot already names.
  if (/^(?:submit|send)(?:\s+the\s+form)?$/i.test(body)) {
    const button = elements.find(
      (item) =>
        !item.disabled &&
        (item.inputType === 'submit' ||
          ((item.tag === 'button' || item.role === 'button') &&
            /\b(?:submit|send|order|continue|sign\s*in|log\s*in|save|apply)\b/i.test(elementText(item)))),
    )
    return button ? { type: 'click', selector: `[data-stet-id="${button.id}"]` } : null
  }

  const click = /^(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+(button|link|tab|menu item|option))?$/i.exec(body)
  if (click?.[1]) {
    const hint = (click[2] || '').toLowerCase()
    const element = resolve(click[1], (item) => {
      if (hint === 'button') return item.tag === 'button' || item.role === 'button' || item.inputType === 'button' || item.inputType === 'submit'
      if (hint === 'link') return item.tag === 'a' || item.role === 'link'
      return true
    })
    return element ? { type: 'click', selector: `[data-stet-id="${element.id}"]` } : described ? semanticAction(body, elements) : null
  }

  // “Open Assignments” on a page is an ordinary link click, not a site
  // navigation command. Resolve it against the active snapshot so every
  // visible link is one fast native click, whatever site it belongs to.
  const open = /^(?:open|visit|launch|go\s+to)\s+(?:the\s+)?(.+)$/i.exec(body)
  if (open?.[1]) {
    // “Open Settings” is often a button, not an anchor. Resolve links first,
    // then buttons, so ordinary app navigation is still one native click.
    const element =
      resolve(open[1], (item) => item.tag === 'a' || item.role === 'link') ??
      resolve(open[1], (item) => item.tag === 'button' || item.role === 'button')
    return element ? { type: 'click', selector: `[data-stet-id="${element.id}"]` } : described ? semanticAction(body, elements) : null
  }

  const fillWith = /^(?:fill|put)\s+(?:the\s+)?(.+?)\s+with\s+(.+)$/i.exec(body)
  if (fillWith?.[1] && fillWith[2]) {
    const element = resolve(fillWith[1], isTextField, true)
    const value = cleanIntentValue(fillWith[2])
    return element && value
      ? { type: 'type', selector: `[data-stet-id="${element.id}"]`, text: value, ...(submit ? { submit: true } : {}) }
      : null
  }

  const setValue = /^(?:set|change|update)\s+(?:the\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i.exec(body)
  if (setValue?.[1] && setValue[2]) {
    const element = resolve(setValue[1], isTextField, true)
    const value = cleanIntentValue(setValue[2])
    return element && value
      ? { type: 'type', selector: `[data-stet-id="${element.id}"]`, text: value, ...(submit ? { submit: true } : {}) }
      : null
  }

  const type = /^(?:type|enter)\s+(.+?)\s+(?:into|in|inside)\s+(?:the\s+)?(.+)$/i.exec(body)
  if (type?.[1] && type[2]) {
    const element = resolve(type[2], isTextField, true)
    const value = cleanIntentValue(type[1])
    return element && value
      ? { type: 'type', selector: `[data-stet-id="${element.id}"]`, text: value, ...(submit ? { submit: true } : {}) }
      : null
  }

  // In a list of form clauses people often drop the verb after the first one:
  // “fill the name with Ada, the telephone with …”. Treat the bare field
  // clause as a fill when the snapshot has a matching text field.
  const fieldWith = /^(?:the\s+)?([^,]+?)\s+with\s+(.+)$/i.exec(body)
  if (fieldWith?.[1] && fieldWith[2]) {
    const element = resolve(fieldWith[1], isTextField, true)
    const value = cleanIntentValue(fieldWith[2])
    return element && value
      ? { type: 'type', selector: `[data-stet-id="${element.id}"]`, text: value, ...(submit ? { submit: true } : {}) }
      : null
  }

  const hover = /^(?:hover|point\s+(?:at|to)|move\s+(?:the\s+)?(?:mouse|pointer)\s+(?:to|over))\s+(?:the\s+)?(.+)$/i.exec(body)
  if (hover?.[1]) {
    const element = resolve(
      hover[1],
      (item) => item.tag === 'a' || item.role === 'link' || item.tag === 'button' || item.role === 'button' || item.tag === 'input' || item.role === 'combobox',
    )
    return element ? { type: 'hover', selector: `[data-stet-id="${element.id}"]` } : null
  }

  const check = /^(check|tick|uncheck|untick)\s+(?:the\s+)?(.+)$/i.exec(body)
  if (check?.[1] && check[2]) {
    const accepts = (item: BrowserElement) => item.tag === 'input' && (item.inputType === 'checkbox' || item.inputType === 'radio')
    // “Cheese” must not become “Extra Cheese” when the exact box exists.
    const element = exactElement(elements, check[2], accepts) ?? resolve(check[2], accepts)
    return element
      ? { type: 'check', selector: `[data-stet-id="${element.id}"]`, checked: /^(?:check|tick)$/i.test(check[1]) }
      : null
  }

  const selectFrom = /^(?:select|choose|pick)\s+(.+?)\s+(?:from|in|inside)\s+(?:the\s+)?(.+)$/i.exec(body)
  if (selectFrom?.[1] && selectFrom[2]) {
    const element = resolve(selectFrom[2], (item) => item.tag === 'select' || item.role === 'combobox')
    const value = cleanIntentValue(selectFrom[1])
    return element && value ? { type: 'select', selector: `[data-stet-id="${element.id}"]`, value } : null
  }

  const choose = /^(?:choose|select|pick)\s+(?:the\s+)?(.+)$/i.exec(body)
  if (choose?.[1]) {
    const accepts = (item: BrowserElement) => item.tag === 'input' && (item.inputType === 'checkbox' || item.inputType === 'radio')
    const element = exactElement(elements, choose[1], accepts) ?? resolve(choose[1], accepts)
    return element ? { type: 'check', selector: `[data-stet-id="${element.id}"]`, checked: true } : null
  }

  return described ? semanticAction(body, elements) : null
}

export type DirectActionLead = { action: BrowserAction; rest: string }

/**
 * The first action of a compound instruction, when it resolves against the
 * current snapshot. This keeps ordinary multi-step work out of the planner:
 * “fill the name, choose medium, then submit” becomes native actions with no
 * model wait per field.
 */
export function directActionLead(task: string, elements: BrowserElement[]): DirectActionLead | null {
  if (!elements.length) return null
  const cleaned = cleanIntentValue(task)
  // The final submit of a compound form task has nothing left to parse.
  if (/^(?:submit|send)(?:\s+the\s+form)?$/i.test(cleaned)) {
    const action = directElementAction(cleaned, elements)
    return action ? { action, rest: '' } : null
  }
  const split = /^(.+?)(?:,\s*|;\s*|\s+then\s+|\s+and\s+(?=(?:click|tap|press|open|go\s+to|visit|select|choose|fill|type|enter|check|scroll|tell|show|report|read|summari[sz]e|answer|describe|explain)\b))(.+)$/i.exec(
    cleaned,
  )
  if (!split?.[1] || !split[2]) return null
  const first = directElementAction(split[1], elements) ?? directBrowserAction(split[1])
  const rest = split[2].trim().replace(/^(?:and|then)\s+/i, '')
  return first && rest ? { action: first, rest } : null
}

export type DirectLinkLookup = {
  action: Extract<BrowserAction, { type: 'findLink' }>
  query: string
  complete: boolean
}

/**
 * A named assignment or link can be opened without the planner. Explicit
 * “find/open … assignment” tasks finish after the click; “do …” tasks open
 * the assignment and then continue into the normal planner for the work.
 */
export function directFindLink(task: string): DirectLinkLookup | null {
  const cleaned = task.trim().replace(/[.!?]+$/, '')
  if (isCompoundInstruction(cleaned)) return null
  if (/\b(?:then|after that)\b/i.test(cleaned)) return null
  // Positional targets (“the second result”, “the last email”) belong to the
  // snapshot action resolver. A text link scan for the literal words would
  // fail first and add a wasted round trip to every ordinal command.
  if (/\b(?:top|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|next|previous)\b/i.test(cleaned)) return null
  // Explanatory targets (“the section about early life”, “the button that says
  // Continue”, “the page where I can see my grades”) are intent matches, not
  // literal link names. The snapshot resolver handles them by phrase.
  if (/\b(?:page|section|part|link|button|tab|option|item|thing|one)\s+(?:about|for|where|called|named|that\s+says|which\s+says)\b/i.test(cleaned)) return null
  if (/\b(?:search|type|fill|scroll|press|write|draft|compose)\b/i.test(cleaned)) return null

  // Known sites and direct URLs are handled by the navigation path, not by a
  // link scan on whatever page happens to be open.
  const navigation = /^(?:open|go\s+to|visit|launch)\s+(?:the\s+)?(.+)$/i.exec(cleaned)
  if (navigation?.[1]) {
    const destination = navigation[1].trim()
    const key = destination.toLowerCase().replace(/\s+/g, ' ')
    if (DIRECT_SITES[key] || publicUrl(destination) || /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(destination)) return null
  }

  const explicit = /^(?:find|locate|open|click|tap|go\s+to|show\s+me)\s+(?:the\s+|my\s+)?(.+?)\s+(?:assignment|link|page|item)(?:\s+(?:in|on|from)\s+.+)?$/i.exec(cleaned)
  const work = /^(?:do|complete|work\s+on|start|begin)\s+(?:the\s+|my\s+|an?\s+)?(.+)$/i.exec(cleaned)
  if (work?.[1] && !/\b(?:assignment|edpuzzle|homework|quiz|worksheet|lesson|form|activity|task|project)\b/i.test(work[1])) return null
  const locate = /^(?:find|locate|show\s+me|open)\s+(?:the\s+|my\s+)?(.+)$/i.exec(cleaned)
  const lookAround = /^(?:look\s+around|look)\s+(?:for|and\s+find)\s+(?:the\s+|my\s+)?(.+)$/i.exec(cleaned)
  const raw = explicit?.[1] ?? work?.[1] ?? locate?.[1] ?? lookAround?.[1]
  if (!raw) return null
  const query = cleanIntentValue(raw)
    .replace(/\s+(?:assignment|link|page|item)$/i, '')
    .trim()
    .toLowerCase()
  if (!query) return null
  return {
    action: { type: 'findLink', text: query },
    query,
    complete: Boolean(explicit || locate || lookAround),
  }
}

/** A document-writing task that can skip the step-by-step browser loop. */
export function isDocumentWritingTask(task: string, currentUrl?: string): boolean {
  // “Open a Google Doc and write an essay” is a document task even though the
  // writing verb is not the first word. Requiring the verb at the start sent
  // this common phrasing through the slow planner and made the Doc shortcut
  // feel broken.
  const wantsWriting = /^\s*(?:please\s+)?(?:write|draft|compose|create|make)\b/i.test(task) || /\b(?:write|draft|compose)\b/i.test(task)
  const document = /\b(?:essay|article|report|story|letter|paragraph|paper|document|docs?|summary|notes|blog post)\b/i.test(task)
  const otherSurface = /\b(?:email|gmail|sheet|spreadsheet|webpage|website|code|script|tweet|message)\b/i.test(task)
  const inField = /\b(?:in|into|inside)\s+(?:the\s+)?(?:search(?:\s*(?:box|bar|field))?|input|field|textbox|text\s*box|box|bar|textarea|form|comment|composer)\b/i.test(task)
  // The document shortcut writes into Google Docs. If the person names a
  // different editor or site, the general browser agent must go there instead.
  const otherEditor = /\b(?:notion|microsoft\s+word|word\s+online|onedrive|dropbox\s+paper|confluence|evernote|obsidian|apple\s+pages|smartsheet|airtable|excel|medium|substack|ghost|wordpress|slack|discord|teams|outlook|yahoo\s+mail|proton\s+mail)\b/i.test(task)
  const namedAddress = /\b(?:on|in|at|to)\s+(?:the\s+)?(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+\b/i.test(task)
  const namesDocs = /\b(?:google\s+docs?|docs\.google\.com|docs\.new)\b/i.test(task)
  const onDocs = Boolean(currentUrl && /^https:\/\/docs\.google\.com\/document\//i.test(currentUrl))
  if (otherEditor) return false
  if (namedAddress && !namesDocs) return false
  if (!namesDocs && !onDocs && !/^\s*(?:please\s+)?(?:write|draft|compose|create|make)\b[^.!?]*$/i.test(task)) return false
  return wantsWriting && document && !otherSurface && !inField
}

/**
 * A request to put a table or dataset into a spreadsheet. These tasks used to
 * spend one planner call per click and per cell; they now take one generation
 * call and one native grid-typing run.
 */
export function isSpreadsheetDataTask(task: string, currentUrl?: string): boolean {
  const cleaned = task.trim()
  if (!cleaned) return false
  const inSheet = Boolean(currentUrl && /^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(currentUrl))
  const mentionsSheet = /\b(?:spreadsheets?|google\s+sheets?|sheets?)\b/i.test(cleaned)
  if (!inSheet && !mentionsSheet) return false
  if (/\b(?:excel|apple\s+numbers|airtable|notion|smartsheet|onlyoffice)\b/i.test(cleaned)) return false
  const wantsData = /\b(?:put|add|insert|input|fill|enter|write|create|make|generate|populate|paste|load|set\s+up)\b/i.test(cleaned)
  const dataThing = /\b(?:data|table|rows?|records?|values?|numbers?|figures?|sales|expenses?|budget|inventory|list)\b/i.test(cleaned)
  if (!wantsData || !dataThing) return false
  // A document or email that merely mentions a sheet is not a grid fill.
  return !/\b(?:essay|article|report|document|docs?|email|message|letter)\b/i.test(cleaned)
}

/** A sheet task that asks for a chart, not just a filled table. */
export function isSpreadsheetChartTask(task: string): boolean {
  return /\b(?:chart|graph|plot|histogram|visuali[sz]e)\b/i.test(task)
}

/** Whether this destination is already the current page (or a child path). */
export function isSameBrowserSite(currentUrl: string | undefined, targetUrl: string): boolean {
  if (!currentUrl) return false
  try {
    const current = new URL(currentUrl)
    const target = new URL(targetUrl)
    const host = (value: URL) => value.host.replace(/^www\./i, '')
    if (host(current) !== host(target)) return false
    if (target.pathname === '/') return current.pathname === '/'
    const base = target.pathname.replace(/\/$/, '')
    return current.pathname === base || current.pathname.startsWith(`${base}/`)
  } catch {
    return false
  }
}
