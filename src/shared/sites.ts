/**
 * Shortcuts for the Ink Browser.
 *
 * Every tile opens inside Ink's own proxy. A tile never sends the tab to the
 * real domain, so a network filter (Securly and the like) never sees the site,
 * and it never uses the cloud browser, which belongs to the AI Agent alone
 * (see AGENTS.md).
 */
export type InkSite = {
  id: string
  name: string
  /** The website this tile opens, through Ink's own proxy. */
  url?: string
  /** An Ink page this tile opens instead of a website. */
  app?: string
  /** Tile colour, so a row is recognisable before the name is read. */
  color: string
  /** A bundled app icon; otherwise the site's favicon is used. */
  icon?: string
}

export const INK_SITES: InkSite[] = [
  { id: 'unblocker', name: 'Unblocker', app: '/proxy', color: '#4285F4' },
  { id: 'movies', name: 'Movies', url: 'https://tubitv.com/', color: '#FA541C', icon: '/apps/movies.png' },
  { id: 'poki', name: 'Poki', url: 'https://poki.com/', color: '#8B5CF6' },
  { id: 'freenova', name: 'FreeNova', url: 'https://freezenova.com/', color: '#22C55E' },
  { id: 'omegle', name: 'Omegle', url: 'https://omegle.onl/online/', color: '#3B5BFE', icon: '/apps/omegle.png' },
  { id: 'kiwi', name: 'kiwi', url: 'https://kiwi.college/', color: '#7CB342' },
  // kiwi's own game shell wraps this client page in an ad gate and a request
  // monitor that never settles behind a proxy, so the client is opened directly.
  { id: 'kiwi-omegle', name: 'kiwi omegle', url: 'https://kiwi.college/storage/omegle.html', color: '#22C55E' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', color: '#E1306C' },
  { id: 'steam', name: 'Steam', url: 'https://store.steampowered.com/', color: '#1B2838' },
  { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/', color: '#1DB954' },
  { id: 'discord', name: 'Discord', url: 'https://discord.com/app', color: '#5865F2' },
  { id: 'krillion', name: 'Krillion', url: 'https://krillion.to/en', color: '#0EA5E9' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', color: '#FF0000' },
  { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/', color: '#9146FF' },
  { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/', color: '#FF4500' },
  { id: 'roblox', name: 'Roblox', url: 'https://www.roblox.com/', color: '#E11D48' },
  { id: 'x', name: 'X', url: 'https://x.com/', color: '#0F172A' },
  { id: 'ometv', name: 'ome.tv', url: 'https://ome.tv/', color: '#0F766E' },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/', color: '#010101', icon: '/apps/tiktok.png' },
]

/**
 * An opaque handle for a site's address.
 *
 * A shortcut used to carry the address itself in Ink's URL, so the browser's
 * own address bar and history read `…/proxy?url=https%3A%2F%2Fpoki.com%2F` and a
 * network filter could read the site from it. A short hash of the address is
 * enough for Ink to look the site up, and tells an observer nothing.
 */
export function siteCode(url: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).padStart(7, '0')
}

const SITE_BY_CODE: Record<string, string> = {}
for (const site of INK_SITES) {
  if (site.url) SITE_BY_CODE[siteCode(site.url)] = site.url
}

/** The site a shortcut handle points at, if Ink knows it. */
export function siteUrlFromCode(code: string): string | undefined {
  return SITE_BY_CODE[code]
}

/**
 * Where the Apps page sends the Browser to open a proxied site.
 *
 * The handle travels in `?s=` rather than the address: a query survives a hard
 * reload (a path holding an encoded address gets a 404 from the host) and the
 * site's own domain never appears in Ink's URL or history.
 */
export function proxiedSitePath(url: string): string {
  return `/proxy?s=${siteCode(url)}`
}

/** Where a tile goes: an Ink page, or the site through Ink's own proxy. */
export function sitePath(site: InkSite): string {
  if (site.app) return site.app
  if (!site.url) return '/proxy'
  return proxiedSitePath(site.url)
}

/**
 * The site a "show poki.com" / "open poki.com" line asks for.
 *
 * The command is answered by Ink itself instead of being sent to a model: the
 * tab opens the site through the proxy. The address travels in router state, so
 * Ink's URL, document title and history entry never name the site.
 */
export function commandTarget(text: string): string | undefined {
  const match = /^(?:show|open)\s+(?:me\s+)?(.+)$/i.exec(text.trim())
  if (!match) return undefined
  const raw = match[1].trim().replace(/[.,!?]+$/, '')
  if (!raw || /\s/.test(raw)) return undefined
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    // A bare word ("show poki") is not an address; leave it to the model.
    if (!url.hostname.includes('.')) return undefined
    return url.href
  } catch {
    return undefined
  }
}

/**
 * The site's icon, fetched by Ink rather than by the page.
 *
 * A tile used to ask Google's favicon service for the site's own domain, which
 * put `spotify.com`, `discord.com` and the rest in requests made from the Apps
 * page itself. A network filter reads those as sites the visitor opened, so the
 * icon now comes from Ink's own origin and the browser never names the site.
 */
export function siteIconPath(url = ''): string {
  let host = url
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    // A tile with no website gets no icon; its monogram covers it.
    return ''
  }
  return host ? `/api/app-icon/${encodeURIComponent(host)}` : ''
}
