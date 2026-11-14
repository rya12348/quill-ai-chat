// Build pages need real photographs, but asking the owner for a stock-photo API
// key is a signup they may not want. Wikimedia Commons answers without a key and
// returns the licence and photographer for each file, which the page must credit.
// The browser loads the image from Wikimedia directly; the Worker only searches.

export type BuildPhoto = {
  url: string
  /** A short description the page can start from and improve. */
  alt: string
  credit: string
  license: string
  width: number
  height: number
}

type CommonsInfo = {
  url?: string
  thumburl?: string
  width?: number
  height?: number
  mime?: string
  extmetadata?: Record<string, { value?: string } | undefined>
}

export type CommonsPage = { title?: string; imageinfo?: CommonsInfo[] }

type CommonsResponse = { query?: { pages?: CommonsPage[] } }

// Wikimedia asks API clients to identify themselves; a browser UA is refused.
const USER_AGENT = 'InkBuild/1.0 (generated-page image search; https://freebuff.com)'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

const strip = (value?: string) =>
  (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Words that describe the page rather than its subject. */
const NOISE = new Set([
  'a',
  'about',
  'add',
  'an',
  'and',
  'animation',
  'animations',
  'beautiful',
  'build',
  'called',
  'clean',
  'contained',
  'create',
  'design',
  'for',
  'from',
  'gentle',
  'home',
  'homepage',
  'image',
  'images',
  'in',
  'include',
  'including',
  'interactive',
  'landing',
  'local',
  'make',
  'modern',
  'motion',
  'multi',
  'my',
  'named',
  'new',
  'nice',
  'of',
  'on',
  'or',
  'our',
  'page',
  'pages',
  'photo',
  'photos',
  'picture',
  'pictures',
  'plus',
  'polished',
  'responsive',
  'self',
  'simple',
  'site',
  'small',
  'that',
  'the',
  'this',
  'three',
  'to',
  'two',
  'use',
  'using',
  'web',
  'website',
  'with',
])

/**
 * Real chains whose shopfronts Commons returns for generic coffee searches.
 * A page for a fictional roaster must not use another company's storefront as
 * its own, even when the file name mentions coffee.
 */
const COMMERCIAL_CHAIN =
  /\b(?:peet'?s|starbucks|dunkin|tim hortons|costa coffee|caribou coffee|blue bottle|lavazza|illy|nespresso|folgers|maxwell house)\b/i

/**
 * The subject of the request, not its web-page words: "a landing page for
 * Ember & Oak, a small specialty coffee roaster in Portland" searches for
 * "specialty coffee roaster", not the trailing "roast menu".
 */
export function photoQuery(question: string): string {
  const clean = question
    .toLowerCase()
    .replace(/[^a-z0-9\s&,'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return ''
  const keep = (word: string) => !NOISE.has(word) && !/^\d/.test(word) && word.length > 1
  const stop = /\s+(?:with|including|include|featuring|that|which|called|named|in|at|on|for)\b/i

  // "for [a] coffee shop with …" and "for [a] bakery called …".
  const forPhrase = /\b(?:for|about|of)\s+(?!a\b|an\b|the\b)([^,.;]+)/i.exec(clean)?.[1]
  const descriptive = /\b(?:for|about|of)\s+(?:a|an|the)\s+([^,.;]+)/i.exec(clean)?.[1]
  // "for Ember & Oak, a small specialty coffee roaster in Portland": the
  // appositive is the useful subject; the brand name alone is not.
  const appositive = /\b(?:for|about|of)\s+[^,.;]+,\s+(?:a|an)\s+([^,.;]+)/i.exec(clean)?.[1]

  const phrase = (appositive ?? descriptive ?? forPhrase ?? clean)
    .split(stop)[0]
    .replace(/\s+/g, ' ')
    .trim()
  const subject = phrase.split(' ').filter(keep)
  // Keep the head of the phrase. The old last-two-words rule turned a request
  // for a coffee roaster into a search for its roast menu.
  const words = subject.slice(0, 4).join(' ')
  // Commons has no useful generic "coffee roaster" photography: the results are
  // storefronts of Peet's and other real chains. Ingredients are a more honest,
  // reusable hero for a fictional roaster or café, and avoid implying that a
  // photographed shop belongs to the brand being built.
  if (/\bcoffee\b/i.test(words) && /\b(?:roaster|roastery|shop|cafe|espresso)\b/i.test(words)) return 'coffee beans'
  return words
}

/**
 * Keeps landscape photographs with enough resolution to fill a hero, and drops
 * maps, logos and screenshots that happen to match the search words.
 */
export function pickPhotos(pages: CommonsPage[], limit = 4, subject = ''): BuildPhoto[] {
  const photos: BuildPhoto[] = []
  const seen = new Set<string>()
  const subjectWords = subject
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3 && !NOISE.has(word))
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    const src = info.thumburl || info.url
    if (!src || !/^https:\/\/[a-z.]*wikimedia\.org\//i.test(src)) continue
    if (info.mime && !/^image\/(?:jpeg|png|webp)$/i.test(info.mime)) continue
    const width = Number(info.width ?? 0)
    const height = Number(info.height ?? 0)
    if (width < 900 || height < 500) continue
    // Portraits crop badly in a wide frame, so only landscape photos are used.
    if (width < height * 1.15) continue
    const title = strip(page.title).replace(/^File:\s*/i, '')
    if (/map|logo|diagram|chart|icon|flag|coat of arms|seal of|screenshot/i.test(title)) continue
    // Titles are the only reliable signal Commons gives us. A gallery interior
    // matching a generic word such as "roast" must not become a coffee hero.
    if (subjectWords.length && !subjectWords.some((word) => title.toLowerCase().includes(word))) continue
    // A photo of an unrelated business (or worse) must not reach a page just
    // because its file name matched the search words.
    if (/erotic|adult|nude|naked|brothel|lingerie|sex shop|strip club/i.test(title)) continue
    // Do not put a real chain's storefront on a fictional brand's page. If the
    // request is explicitly about that chain, its photos are allowed.
    if (COMMERCIAL_CHAIN.test(title) && !COMMERCIAL_CHAIN.test(subject)) continue
    if (seen.has(src)) continue
    seen.add(src)
    photos.push({
      url: src,
      // The file name often carries a city or a shop name, which a model would
      // copy into the page as fact. Keep the alt text to the subject instead.
      alt: `${subject.trim() || 'Photograph'} photograph`.slice(0, 120),
      credit: strip(info.extmetadata?.Artist?.value).slice(0, 80) || 'Wikimedia Commons',
      license: strip(info.extmetadata?.LicenseShortName?.value).slice(0, 40) || 'Wikimedia Commons',
      width,
      height,
    })
    if (photos.length >= limit) break
  }
  return photos
}

/** Best-effort: a build never fails because photo search was slow or empty. */
export async function findPhotos(query: string, signal?: AbortSignal, limit = 4): Promise<BuildPhoto[]> {
  if (!query) return []
  const url = new URL(COMMONS_API)
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '16',
    gsrsearch: `${query} filetype:bitmap`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600',
  }).toString()
  const timeout = AbortSignal.timeout(6_000)
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!response.ok) return []
    const body = (await response.json()) as CommonsResponse
    return pickPhotos(body.query?.pages ?? [], limit, query)
  } catch {
    return []
  }
}
