/**
 * The four pack worlds, rebuilt from the shipped renderer.
 *
 * Every pack page is one long strip laid out in points: a point of score is two
 * pixels of world, the camera keeps the strip's origin centred, and the theme
 * decides what the strip is made of — a boulevard at night, a stadium gauntlet, a
 * lap around the world, or a notebook being filled in. The shipped renderer
 * paints that strip on a canvas behind the DOM cards, which is what this does:
 * the theme tables below are the CLIENT_PACKS themes, and the layer order and
 * parallax factors are the ones the shipped painters use.
 */

export type CinemaTheme = {
  kind: 'cinema'
  skyTint: [string, string, string]
  hills: string
  moon: string
  sign: string
  far: string
  mid: { from: number; imgs: string[] }[]
  lamp: string
  gate: string
  premiere: string
  car: string
  carGold: string
}

export type GauntletTheme = {
  kind: 'gauntlet'
  skyTint: [string, string, string]
  farBowl: string
  divider: string
  venues: { from: number; to: number; surface: string; pane: string }[]
  tunnel: string
  podium: string
}

export type GlobeTheme = {
  kind: 'globe'
  skyTint: [string, string, string]
  continents: { from: number; to: number; zone: string; pane: string }[]
  baseCamp: string
  pole: string
}

export type NotebookTheme = {
  kind: 'notebook'
  deskPortrait: string
  deskLandscape: string
  notebook: string
  writer: string
  writerGold: string
  ink: string
  goldInk: string
}

export type PackWorldTheme = CinemaTheme | GauntletTheme | GlobeTheme | NotebookTheme

const HOLLYWOOD = '/krillion/gen/optimized/v1/hollywood'
const GAUNTLET = '/krillion/gen/optimized/v1/gauntlet'
const ATLAS = '/krillion/gen/optimized/v1/atlas'
const LEXICON = '/krillion/gen/optimized/v1/lexicon'

export const PACK_WORLDS = {
  movies: {
    kind: 'cinema',
    skyTint: ['#030d33', '#131c52', '#1d2a75'],
    hills: `${HOLLYWOOD}/hills.webp`,
    moon: '/krillion/gen/hollywood/moon.png',
    sign: '/krillion/gen/hollywood/sign.png',
    far: `${HOLLYWOOD}/bg-far.webp`,
    mid: [
      {
        from: 0,
        imgs: [`${HOLLYWOOD}/bg-mid.webp`, `${HOLLYWOOD}/bg-mid-b.webp`, `${HOLLYWOOD}/bg-mid-c.webp`],
      },
      { from: 950, imgs: [`${HOLLYWOOD}/bg-mid-neon.webp`, `${HOLLYWOOD}/bg-mid-neon-b.webp`] },
      { from: 2950, imgs: [`${HOLLYWOOD}/bg-mid-hills.webp`, `${HOLLYWOOD}/bg-mid-hills-b.webp`] },
      { from: 5450, imgs: [`${HOLLYWOOD}/bg-mid-neon-b.webp`, `${HOLLYWOOD}/bg-mid-neon.webp`] },
    ],
    lamp: '/krillion/gen/hollywood/lamp.png',
    gate: `${HOLLYWOOD}/gate.webp`,
    premiere: `${HOLLYWOOD}/premiere.webp`,
    car: '/krillion/gen/hollywood/buddy-car.png',
    carGold: '/krillion/gen/hollywood/buddy-car-gold.png',
  } satisfies CinemaTheme,
  sports: {
    kind: 'gauntlet',
    skyTint: ['#04060b', '#0a0f1a', '#131c2c'],
    farBowl: `${GAUNTLET}/bowl-far.webp`,
    divider: '/krillion/gen/gauntlet/divider.png',
    venues: [
      { from: -60, to: 700, surface: 'hardwood', pane: '/krillion/gen/gauntlet/floor-hardwood.png' },
      { from: 760, to: 1400, surface: 'clay', pane: `${GAUNTLET}/floor-clay.webp` },
      { from: 1460, to: 2260, surface: 'ice', pane: `${GAUNTLET}/floor-ice.webp` },
      { from: 2320, to: 3220, surface: 'pitch', pane: `${GAUNTLET}/floor-pitch.webp` },
      { from: 3280, to: 4230, surface: 'gridiron', pane: `${GAUNTLET}/floor-gridiron.webp` },
      { from: 4290, to: 5040, surface: 'pool', pane: `${GAUNTLET}/floor-pool.webp` },
      { from: 5100, to: 5600, surface: 'track', pane: `${GAUNTLET}/floor-track.webp` },
    ],
    tunnel: `${GAUNTLET}/tunnel.webp`,
    podium: `${GAUNTLET}/podium.webp`,
  } satisfies GauntletTheme,
  geography: {
    kind: 'globe',
    skyTint: ['#020308', '#070a14', '#0e1424'],
    continents: [
      { from: 16, to: 100, zone: 'savanna', pane: `${ATLAS}/scene-savanna.webp` },
      { from: 100, to: 186, zone: 'amazon', pane: `${ATLAS}/scene-amazon.webp` },
      { from: 186, to: 272, zone: 'alps', pane: `${ATLAS}/scene-alps.webp` },
      { from: 272, to: 356, zone: 'greatwall', pane: `${ATLAS}/scene-greatwall.webp` },
      { from: 356, to: 442, zone: 'outback', pane: `${ATLAS}/scene-outback.webp` },
      { from: 442, to: 526, zone: 'canyon', pane: `${ATLAS}/scene-canyon.webp` },
      { from: 526, to: 608, zone: 'antarctica', pane: `${ATLAS}/scene-antarctica.webp` },
    ],
    baseCamp: '/krillion/gen/atlas/basecamp.png',
    pole: '/krillion/gen/atlas/pole.png',
  } satisfies GlobeTheme,
  lexicon: {
    kind: 'notebook',
    deskPortrait: `${LEXICON}/desk-portrait.webp`,
    deskLandscape: `${LEXICON}/desk-landscape.webp`,
    notebook: `${LEXICON}/notebook.webp`,
    writer: '/krillion/gen/lexicon/krill-writer-clean.png',
    writerGold: '/krillion/gen/lexicon/krill-writer-clean-gold.png',
    ink: '#2a3466',
    goldInk: '#c29a2e',
  } satisfies NotebookTheme,
} as const

/** Every picture a theme paints, so the canvas can tell when it is ready. */
export function themeImages(theme: PackWorldTheme): string[] {
  if (theme.kind === 'cinema') {
    return [theme.hills, theme.moon, theme.sign, theme.far, ...theme.mid.flatMap((entry) => entry.imgs), theme.gate, theme.premiere]
  }
  if (theme.kind === 'gauntlet') {
    return [theme.farBowl, theme.divider, theme.tunnel, theme.podium, ...theme.venues.map((venue) => venue.pane)]
  }
  if (theme.kind === 'globe') {
    return [theme.baseCamp, theme.pole, ...theme.continents.map((continent) => continent.pane)]
  }
  return [theme.deskPortrait, theme.deskLandscape, theme.notebook]
}

/** One point of score is two pixels of world, as the shipped strip lays it out. */
export const PX_PER_POINT = 2

/** Load every image a theme needs, once, and tell the caller when one arrives. */
const cache = new Map<string, HTMLImageElement>()

export function image(src: string, onLoad?: () => void): HTMLImageElement {
  let img = cache.get(src)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.src = src
    cache.set(src, img)
  }
  // A picture that is already in the cache never fires `load` again, and a
  // second mount would otherwise never be told it can paint. Ask again either
  // way, so a remount (or a picture that landed before the first frame) still
  // ends in a repaint.
  if (onLoad) {
    if (img.complete && img.naturalWidth > 0) onLoad()
    else img.addEventListener('load', onLoad, { once: true })
  }
  return img
}

const ready = (img: HTMLImageElement | undefined): img is HTMLImageElement =>
  Boolean(img && img.complete && img.naturalWidth > 0)

function hash(n: number): number {
  const v = Math.sin(n * 127.1 + 3.7) * 43758.5453
  return v - Math.floor(v)
}

/** Tile an image across the strip at `y` with the shipped scroll factor. */
function band(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  height: number,
  alpha = 1,
) {
  if (!ready(img) || height <= 0) return
  const width = height * (img.naturalWidth / img.naturalHeight)
  ctx.save()
  ctx.globalAlpha = alpha
  const first = Math.floor(x / width) - 1
  const last = Math.ceil((x + ctx.canvas.width) / width) + 1
  for (let i = first; i <= last; i += 1) ctx.drawImage(img, i * width - x, y, width + 1, height)
  ctx.restore()
}

/** The three-stop night sky every pack shares, then its own ground. */
function sky(ctx: CanvasRenderingContext2D, w: number, h: number, tint: [string, string, string]) {
  const horizon = h * 0.58
  const grad = ctx.createLinearGradient(0, 0, 0, horizon)
  grad.addColorStop(0, tint[0])
  grad.addColorStop(0.55, tint[1])
  grad.addColorStop(1, tint[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, horizon + 6)
  ctx.fillStyle = tint[0]
  ctx.fillRect(0, horizon, w, h - horizon)
  // the shipped sky's stars
  for (let i = 0; i < 60; i += 1) {
    const fx = hash(i * 1.7)
    const fy = hash(i * 3.1) * 0.5
    const a = 0.2 + 0.38 * hash(i * 5.3)
    ctx.fillStyle = hash(i * 9.1) > 0.7 ? `rgba(255,228,188,${a})` : `rgba(180,220,255,${a})`
    const size = hash(i * 2.9) > 0.85 ? 3 : 2
    ctx.fillRect(fx * w, fy * horizon, size, size)
  }
}

/** The boulevard: moon, sign, hills, the far and mid city, and the road. */
function paintCinema(
  ctx: CanvasRenderingContext2D,
  theme: CinemaTheme,
  w: number,
  h: number,
  x: number,
  onLoad: () => void,
) {
  sky(ctx, w, h, theme.skyTint)
  const horizon = h * 0.58
  const moon = image(theme.moon, onLoad)
  if (ready(moon)) {
    const size = Math.min(0.22 * w, 150)
    ctx.drawImage(moon, 0.76 * w, 0.08 * horizon, size, size)
  }
  const hills = image(theme.hills, onLoad)
  if (ready(hills)) {
    const height = 0.3 * h
    const y = horizon - 0.1 * h
    band(ctx, hills, x * 0.1, y, height)
    ctx.fillStyle = '#02072c'
    ctx.fillRect(0, y + height - 1, w, horizon - (y + height) + 8)
    const sign = image(theme.sign, onLoad)
    if (ready(sign)) {
      const size = Math.min(0.28 * w, 320)
      const sh = size * (sign.naturalHeight / sign.naturalWidth)
      const spacing = w + 1.5 * size
      const offset = 2 * x * 0.1
      const base = 0.72 * w - 9
      const top = y + height - 0.28 * height - sh
      const first = Math.floor((offset - base + size) / spacing)
      for (let i = first; i * spacing + base - offset < w + size; i += 1) {
        ctx.drawImage(sign, i * spacing + base - offset, top, size, sh)
      }
    }
  }
  // headlights sweeping the road
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 2; i += 1) {
    const ox = [0.18 * w, 0.78 * w][i]
    const angle = -Math.PI / 2 + 0.42 * Math.sin(0.22 * x * 0.01 + 2.1 * i)
    const reach = 0.62 * h
    const ex = ox + Math.cos(angle) * reach
    const ey = horizon + Math.sin(angle) * reach
    const grad = ctx.createLinearGradient(ox, horizon, ex, ey)
    grad.addColorStop(0, 'rgba(255,240,214,0.1)')
    grad.addColorStop(1, 'rgba(255,240,214,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(ox, horizon)
    ctx.lineTo(ex + 26, ey)
    ctx.lineTo(ex - 26, ey)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  band(ctx, image(theme.far, onLoad), x * 0.35, horizon + 3, 0.4 * h, 0.55)
  // the mid-ground city: bands of buildings chosen by how far along the strip is
  const midY = horizon + 9
  const midH = 0.44 * h
  const midX = 2 * x * 0.75
  const bands = theme.mid
    .flatMap((entry) => entry.imgs.map((src) => ({ from: entry.from, img: image(src, onLoad) })))
    .filter((entry) => ready(entry.img))
  if (bands.length) {
    const widthOf = (img: HTMLImageElement) => midH * (img.naturalWidth / img.naturalHeight)
    const average = bands.reduce((sum, entry) => sum + widthOf(entry.img), 0) / bands.length
    for (const direction of [1, -1]) {
      let cursor = 0
      let current = -1
      let count = 0
      for (let guard = 0; guard < 400; guard += 1) {
        if (direction === 1 ? cursor > midX + w : cursor < midX) break
        const point = (cursor - w / 2) / 1.5
        let zone = 0
        for (let i = 0; i < bands.length; i += 1) if (point >= bands[i].from) zone = i
        if (zone !== current) {
          current = zone
          count = 0
        }
        const pool = bands.filter((entry) => entry.from === bands[zone].from)
        const pick = pool[(direction === 1 ? count : pool.length - 1 - count) % pool.length]
        count += 1
        const width = ready(pick.img) ? widthOf(pick.img) : average
        const left = direction === 1 ? cursor : cursor - width
        if (left + width > midX && left < midX + w) {
          ctx.drawImage(pick.img, left - midX, midY, width + 1, midH)
        }
        cursor += direction * width
      }
    }
  }
}

/** The gauntlet: tunnel, bowl, then each venue's floor and divider in turn. */
function paintGauntlet(
  ctx: CanvasRenderingContext2D,
  theme: GauntletTheme,
  w: number,
  h: number,
  x: number,
  onLoad: () => void,
) {
  sky(ctx, w, h, theme.skyTint)
  const horizon = h * 0.58
  band(ctx, image(theme.farBowl, onLoad), x * 0.35, horizon - 0.34 * h, 0.5 * h, 0.9)
  const floorY = h * 0.66
  const floorH = h - floorY
  const tunnel = image(theme.tunnel, onLoad)
  if (ready(tunnel)) {
    const width = floorH * (tunnel.naturalWidth / tunnel.naturalHeight)
    ctx.drawImage(tunnel, -x - width * 0.6, floorY - 0.06 * h, width, floorH + 0.06 * h)
  }
  for (const venue of theme.venues) {
    const pane = image(venue.pane, onLoad)
    if (!ready(pane)) continue
    const left = PX_PER_POINT * venue.from - x
    const right = PX_PER_POINT * venue.to - x
    if (right < -w || left > w * 2) continue
    const width = floorH * (pane.naturalWidth / pane.naturalHeight)
    for (let px = left; px < right; px += width) {
      const slice = Math.min(width, right - px)
      ctx.drawImage(pane, 0, 0, (slice / width) * pane.naturalWidth, pane.naturalHeight, px, floorY, slice, floorH)
    }
    const divider = image(theme.divider, onLoad)
    if (ready(divider)) {
      const dh = floorH * 1.1
      const dw = dh * (divider.naturalWidth / divider.naturalHeight)
      ctx.drawImage(divider, left - dw / 2, floorY - 0.1 * h, dw, dh)
    }
  }
  const podium = image(theme.podium, onLoad)
  if (ready(podium)) {
    const height = 0.5 * h
    const width = height * (podium.naturalWidth / podium.naturalHeight)
    ctx.drawImage(podium, PX_PER_POINT * 5600 - x - width / 2, floorY - height + 0.12 * h, width, height)
  }
}

/** The expedition: base camp, then one continent pane after another, then home. */
function paintGlobe(
  ctx: CanvasRenderingContext2D,
  theme: GlobeTheme,
  w: number,
  h: number,
  x: number,
  onLoad: () => void,
) {
  sky(ctx, w, h, theme.skyTint)
  const floorY = h * 0.62
  const floorH = h - floorY
  const camp = image(theme.baseCamp, onLoad)
  if (ready(camp)) {
    const height = 0.42 * h
    const width = height * (camp.naturalWidth / camp.naturalHeight)
    ctx.drawImage(camp, -x - width / 2, floorY - height + 0.1 * h, width, height)
  }
  for (const continent of theme.continents) {
    const pane = image(continent.pane, onLoad)
    if (!ready(pane)) continue
    const left = PX_PER_POINT * continent.from - x
    const right = PX_PER_POINT * continent.to - x
    if (right < -w || left > w) continue
    const width = floorH * (pane.naturalWidth / pane.naturalHeight)
    for (let px = left; px < right; px += width) {
      const slice = Math.min(width, right - px)
      ctx.drawImage(pane, 0, 0, (slice / width) * pane.naturalWidth, pane.naturalHeight, px, floorY, slice, floorH)
    }
  }
  const pole = image(theme.pole, onLoad)
  if (ready(pole)) {
    const height = 0.4 * h
    const width = height * (pole.naturalWidth / pole.naturalHeight)
    ctx.drawImage(pole, PX_PER_POINT * 690 - x - width / 2, floorY - height + 0.1 * h, width, height)
  }
}

/** The notebook: the desk, and the ruled page being filled in as you go. */
function paintNotebook(
  ctx: CanvasRenderingContext2D,
  theme: NotebookTheme,
  w: number,
  h: number,
  x: number,
  onLoad: () => void,
) {
  const desck = image(w > h ? theme.deskLandscape : theme.deskPortrait, onLoad)
  const under = ctx.createLinearGradient(0, 0, 0, h)
  under.addColorStop(0, '#171a2c')
  under.addColorStop(1, '#0b0d16')
  ctx.fillStyle = under
  ctx.fillRect(0, 0, w, h)
  if (ready(desck)) {
    const ratio = Math.max(w / desck.naturalWidth, h / desck.naturalHeight)
    const dw = desck.naturalWidth * ratio
    const dh = desck.naturalHeight * ratio
    ctx.drawImage(desck, (w - dw) / 2, (h - dh) / 2, dw, dh)
  }
  const page = image(theme.notebook, onLoad)
  if (ready(page)) {
    const height = 0.72 * h
    const width = height * (page.naturalWidth / page.naturalHeight)
    const drift = x * 0.06
    for (let px = Math.floor((drift - width) / width) * width; px < w + drift + width; px += width) {
      ctx.drawImage(page, px - drift, 0.16 * h, width + 1, height)
    }
  }
  ctx.fillStyle = `${theme.ink}22`
  ctx.fillRect(0, 0, w, h)
}

/** Paint one frame of a pack's strip. `x` is the world scroll in pixels. */
export function paintPackWorld(
  ctx: CanvasRenderingContext2D,
  theme: PackWorldTheme,
  width: number,
  height: number,
  x: number,
  onLoad: () => void,
) {
  ctx.clearRect(0, 0, width, height)
  if (theme.kind === 'cinema') paintCinema(ctx, theme, width, height, x, onLoad)
  else if (theme.kind === 'gauntlet') paintGauntlet(ctx, theme, width, height, x, onLoad)
  else if (theme.kind === 'globe') paintGlobe(ctx, theme, width, height, x, onLoad)
  else paintNotebook(ctx, theme, width, height, x, onLoad)
}
