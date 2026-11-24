import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ButterMenu } from '../components/ButterMenu'

/**
 * Butter Party — Ink's table, dressed as the real Puffer Party.
 *
 * The markup below is the shipped game's own: same class names, same nesting,
 * same copy rhythm. `src/butter-party.css` is Puffer Party's stylesheet (the
 * `.pf-*` and `.ds-*` rules, unmodified), so the ring, the plates, the chips,
 * the puffer frames and the dock are the real geometry rather than a lookalike.
 * Only the words and the sprite art are Ink's.
 *
 * Everything the table needs (fuse, hearts, meter, seats) comes from
 * /api/butter; this file is the table, not the rules.
 */

type TierId = 'plankton' | 'tooclever' | 'schooler' | 'rare' | 'deepcut' | 'krillion'
type MeterSeg = { tier: TierId | null; amt: number }
type Player = {
  pid: string
  name: string
  hearts: number
  seat: number
  you: boolean
  meter?: number
  segs?: MeterSeg[]
  score?: number
  bot?: boolean
  /** Set on a rated table, where every plate carries its owner's number. */
  rating?: number | null
  /** What this seat said last, worn over its head until it says another. */
  lastAnswer?: { text: string; tier?: string } | null
}
type FeedLine = { id: number; text: string; tone: string; at?: number }
type Last = { kind?: string; name?: string; answer?: string; tier?: TierId; points?: number; at?: number } | null

type Snapshot = {
  code: string
  status: 'lobby' | 'playing' | 'done'
  round: number
  turn: string | null
  you: string
  host: string
  prompt: string
  left: number
  fuseEnd: number
  fuseMs: number
  turnAt?: number
  meterTarget?: number
  maxLives?: number
  size?: string
  cap?: number
  serverNow: number
  players: Player[]
  feed: FeedLine[]
  chat?: { id: number; pid: string; name: string; text: string; at: number }[]
  rated?: boolean
  rating?: number | null
  last: Last
  winner: { name: string; you: boolean } | null
}
type RoomRow = { id: string; status: string; size?: string; players: number; cap?: number; hostName?: string; rated?: boolean; rating?: number }

const NAME_KEY = 'butter.name'
const BUDDY_KEY = 'butter.buddy'
const ROOM_KEY = 'butter.current'
const CLIENT_KEY = 'butter.client'
const RATING_KEY = 'butter.rating'

/** A stable per-browser id, so a rating follows the person, not the tab. */
function clientId(): string {
  let id = localStorage.getItem(CLIENT_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLIENT_KEY, id)
  }
  return id
}

const TIER_LABEL: Record<string, string> = {
  plankton: 'MARGARINE',
  tooclever: 'WHIPPED',
  schooler: 'SALTED',
  rare: 'CULTURED',
  deepcut: 'BROWN BUTTER',
  krillion: 'ONE IN A BUTTER CHURN',
}
const TIER_COLOR: Record<string, string> = {
  plankton: '#8fa3c4',
  tooclever: '#ff9f43',
  schooler: '#4de3ff',
  rare: '#ff5252',
  deepcut: '#9d7bff',
  krillion: '#ffd166',
}

/** The real table's nine mascots, in its unlock order, with the shipped names
 *  and sprite paths taken from the live door. Krillion gates them behind a
 *  daily streak; Ink has no streak, so every one of them is pickable. */
/** The gate's buddies, with the dive streak each one opens at — the same
 *  ladder the shipped door draws under its keys. */
const MASCOTS = [
  { id: 'krill', name: 'Krill', sprite: '/tiers/krillion.png', color: '#ffd166', day: 0 },
  { id: 'schooler', name: 'Schooler', sprite: '/tiers/schooler.png', color: '#4de3ff', day: 5 },
  { id: 'squid', name: 'Squid', sprite: '/tiers/rare.png', color: '#ff5252', day: 14 },
  { id: 'angler', name: 'Angler', sprite: '/tiers/deepcut.png', color: '#9d7bff', day: 30 },
  { id: 'evil', name: 'Evil', sprite: '/tiers/evil-krill-white-v2.png', color: '#c8dcff', day: 45 },
  { id: 'hackmanite', name: 'Hackmanite', sprite: '/tiers/hackmanite-v2.png', color: '#7ad7ff', day: 60 },
  { id: 'fossil', name: 'Fossil', sprite: '/tiers/fossil-krill.png', color: '#cbb59a', day: 75 },
  { id: 'mantis', name: 'Mantis', sprite: '/tiers/tiger-mantis.png', color: '#7dffb0', day: 100 },
  { id: 'leviathan', name: 'Leviathan', sprite: '/tiers/leviathan.png', color: '#ff9f43', day: 150 },
]

/** How many dives in a row this browser has finished, counted the way the dive
 *  page counts it. The gate's locked keys are that number, not a decoration. */
function diveStreak(): number {
  let streak = 0
  const cursor = new Date()
  for (;;) {
    const date = cursor.toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(`butter.dive.done.${date}`) === null) break
    } catch {
      break
    }
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    if (streak > 400) break
  }
  return streak
}

// The door's own wording for each size, verbatim from the shipped table.
const TABLE_SIZES = [
  { id: 'duel', label: '1V1', min: 2, max: 2, hint: 'one on one' },
  { id: 'trio', label: '3S', min: 3, max: 3, hint: 'three at a table' },
  { id: 'party', label: '4–6', min: 4, max: 6, hint: '4 to 6 players' },
  { id: 'crowd', label: '8–10', min: 8, max: 10, hint: '8 to 10 players' },
]

const CAP_FOR: Record<string, number> = { duel: 2, trio: 3, party: 6, crowd: 10 }

/* The reef. Widths, anchors and ring radii are the shipped ones, which is what
   puts the water line, the sand and the ring of rocks in the same place. */
const REEF = {
  m: { file: 'reef-m-clean.png', iw: 1024, ih: 1536, ax: 512, ay: 945, rx: 430, ry: 440, waterBottom: 390, zoom: 1.08 },
  d: { file: 'reef-d-clean.png', iw: 1536, ih: 1024, ax: 768, ay: 650, rx: 620, ry: 270, waterBottom: 270, zoom: 1.05 },
}

/** Perch art per seat: which rock, how high its top sits, and how it scales. */
const PERCH = [1, 6, 4, 8, 2, 5, 3, 7]
const PERCH_ANCHOR = [0, 0.24, 0.16, 0.2, 0.14, 0.16, 0.44, 0.2, 0.24]
// The perch is drawn at the ring's own perch size: the shipped table renders a
// 96px perch on a wide screen and the plate, the meter and the name all hang off
// that number, so scaling each perch art down by its own aspect left every seat
// half the size of the one it is meant to match.
const PERCH_SCALE = [0, 1, 1, 1, 1, 1, 1, 1, 1]
/** Each perch art's height as a share of its width. */
const PERCH_ASPECT = [0, 166 / 305, 0.625, 180 / 278, 213 / 244, 213 / 285, 245 / 293, 178 / 270, 167 / 287]

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

type Geometry = {
  cx: number
  cy: number
  rx: number
  ry: number
  spr: number
  perch: number
  fs: number
  /** Ring fit, 0.72–1. Under 0.88 the shipped stylesheet tightens the plates. */
  scale: number
  pane: { k: 'm' | 'd'; s: number; ox: number; oy: number; w: number; h: number }
}

/** Where each buddy's feet sit inside its sprite, so the perch tucks under it. */
const MASCOT_FOOT: Record<string, number> = {
  krill: 0.21,
  schooler: 0.3,
  squid: 0.1,
  angler: 0.28,
  evil: 0.21,
  hackmanite: 0.156,
  fossil: 0.191,
  mantis: 0.152,
  leviathan: 0.195,
}

/** The world renderer's own layout pass: pick the reef size, then fit the ring
 *  inside it so a table of eight never walks off the sand. */
/** Where the prompt card ends and the dock starts, measured in the stage's own
 *  pixels. The shipped engine asks its DOM for the same two numbers, which is
 *  how the ring gets every pixel the chrome leaves behind. */
type Chrome = { cardBottom: number; dockTop: number }

function geometry(w: number, h: number, mode: 'door' | 'round', seats: number, reserve?: number, chrome?: Chrome): Geometry {
  const mobile = w < 1100
  if (mode === 'door') {
    const d = mobile ? clamp(h / 844, 0.75, 1) : clamp(h / 800, 0.8, 1.1)
    // The door centres the pane on the stage and lets the art's own cover fit
    // do the rest, exactly as the shipped renderer does: `cx = w / 2`,
    // `cy = h / 2`, `s = max(w / iw, h / ih) * zoom`. Nothing here is a share of
    // the window — the reef is framed the same way at every size.
    const cx = w / 2
    const cy = mobile ? Math.round(214 * d + 14) : Math.round(h / 2)
    return {
      cx,
      cy,
      rx: mobile ? 120 : 220,
      ry: mobile ? 70 : 120,
      spr: Math.round(70 * d),
      perch: Math.round(72 * d),
      fs: Math.round((mobile ? 104 : 150) * d),
      scale: 1,
      pane: paneFor(w, h, cx, cy),
    }
  }
  const crowded = seats > 8
  // The ring lives between the prompt card and the floor, then the art's stone
  // circle is asked to follow it — the shipped layout in one sentence. Every
  // number here is the shipped one: the card's bottom plus 78, the page height
  // less the band the lobby's start panel (170) or the round's dock (144) sits
  // in, a ring capped at 320 by 230, and a centre on the art's 9/16 axis so the
  // stone circle is centred where the shipped page draws it.
  const cardBottom = chrome?.cardBottom || 208
  const top = Math.max(cardBottom, mobile ? 148 : 190) + (mobile ? 62 : 78)
  const perchBase = mobile ? clamp(0.155 * w, 72, 108) : 96
  const reserveFloor = h - (reserve ?? (mobile ? 150 : 144))
  const floor = Math.max(top + 120, reserveFloor)
  const scale = clamp((floor - top) / (mobile ? 330 : 350), 0.72, 1)
  const fit = Math.max(0.78, Math.min(1, Math.sqrt(8 / Math.max(1, seats))))
  const spr = Math.round((mobile ? clamp(0.15 * w, 70, 104) : 92) * scale * fit)
  const perch = Math.round(perchBase * scale * fit)
  const gutter = w < 700 ? 48 : 64
  const cx = w / 2
  const cy = Math.round((top + floor) / 2)
  const wantX = crowded ? (mobile ? 400 : 560) : 320
  const wantY = crowded ? 380 : 230
  const rx = Math.max(60, Math.min(wantX, w / 2 - gutter - perch / 2 - 6))
  const ry = Math.max(50, Math.min(wantY, (floor - top) / 2))
  // The art follows the ring rather than the other way round: the pane is
  // placed on the ring's centre, and when the clamp parks it too high the art
  // is slid down so the stone circle still lands under the seats.
  const paneBase = paneFor(w, h, cx, cy)
  const reef = REEF[paneBase.k]
  const paneCy = paneBase.oy + reef.ay * paneBase.s
  const pane = { ...paneBase, oy: paneBase.oy - (paneCy - cy) }
  const fs = Math.round(
    Math.min((mobile ? clamp(0.3 * w, 124, 170) : 150) * scale, Math.max(96, ry * 1.2)),
  )
  return { cx, cy, rx, ry, spr, perch, fs, scale, pane }
}

/** Where the reef art lands: the pane is sized to cover the page, then offset so
 *  its anchor (the middle of the stone circle) sits where we asked. */
function paneFor(w: number, h: number, cx: number, cy: number, zoomMul = 1) {
  const key: 'm' | 'd' = w < 1100 ? 'm' : 'd'
  const reef = REEF[key]
  const s = Math.max(w / reef.iw, h / reef.ih) * reef.zoom * zoomMul
  const ox = clamp(cx - reef.ax * s, w - reef.iw * s, 0)
  const oy = clamp(cy - reef.ay * s, Math.min(0, h - 90 - reef.ih * s), 0)
  return { k: key, s, ox, oy, w: reef.iw * s, h: reef.ih * s }
}

/** Seats sit at even arc length around the ellipse, starting at the bottom —
 *  the same walk the engine does, so eight players space out the same way. */
function seatPoint(index: number, count: number, geo: Geometry) {
  // A lone player perches at the top of the ring, never at the centre where the
  // puffer floats; otherwise the plate draws straight through the fish.
  if (count <= 1) return { x: geo.cx, y: geo.cy - geo.ry, a: -Math.PI / 2 }
  // A duel sits across the ring: stacked top and bottom, both plates share the
  // centre line and the puffer is wedged in the gap between them.
  if (count === 2) {
    const a = index === 0 ? Math.PI : 0
    return { x: geo.cx + Math.cos(a) * geo.rx, y: geo.cy + Math.sin(a) * geo.ry, a }
  }
  // Up to eight seats the shipped table spaces them by equal angle, not by equal
  // arc: six seats sit at 90, 150, 210, 270, 330 and 30 degrees, which is what
  // puts the outermost plates on the ring's own left and right edges. Only a
  // crowded table (>8) switches to even arc length.
  if (count <= 8) {
    const angle = Math.PI / 2 + (index / count) * Math.PI * 2
    return { x: geo.cx + Math.cos(angle) * geo.rx, y: geo.cy + Math.sin(angle) * geo.ry, a: angle }
  }
  const marks: number[] = [0]
  const steps = 128
  for (let step = 1; step <= steps; step += 1) {
    const angle = Math.PI / 2 + ((step - 0.5) / steps) * Math.PI * 2
    marks.push(marks[step - 1] + Math.hypot(geo.rx * Math.sin(angle), geo.ry * Math.cos(angle)))
  }
  const target = (marks[steps] * index) / count
  let at = Math.max(1, marks.findIndex((mark) => mark >= target))
  const span = marks[at] - marks[at - 1] || 1
  const angle = Math.PI / 2 + ((at - 1 + (target - marks[at - 1]) / span) / steps) * Math.PI * 2
  return { x: geo.cx + Math.cos(angle) * geo.rx, y: geo.cy + Math.sin(angle) * geo.ry, a: angle }
}

/* ------------------------------------------------------------------- pieces */

function Heart({ filled, pop, gain }: { filled: boolean; pop?: boolean; gain?: boolean }) {
  return (
    <i className={`pf-heart${filled ? '' : ' empty'}${pop ? ' pop' : ''}${gain ? ' gain' : ''}`}>
      <svg viewBox="0 0 7 6" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
        <rect x="1" y="0" width="2" height="1" />
        <rect x="4" y="0" width="2" height="1" />
        <rect x="0" y="1" width="7" height="2" />
        <rect x="1" y="3" width="5" height="1" />
        <rect x="2" y="4" width="3" height="1" />
        <rect x="3" y="5" width="1" height="1" />
      </svg>
    </i>
  )
}

function Hearts({
  hearts,
  max,
  pop,
  gain,
}: {
  hearts: number
  max: number
  /** Index of the heart that was just lost, which pops like the shipped one. */
  pop?: number
  /** Index of the heart that was just earned, which springs in. */
  gain?: number
}) {
  const slots = Math.min(5, Math.max(max, hearts, 2))
  return (
    <span className="pf-hearts" style={{ ['--hearts' as string]: slots }} aria-label={`${hearts} lives`}>
      {Array.from({ length: slots }).map((_, index) => (
        <Heart key={index} filled={index < hearts} pop={pop === index} gain={gain === index} />
      ))}
    </span>
  )
}

/* --------------------------------------------------------------- puffer */

/** The shipped sprite sheet is 399x392, and the engine draws the body at the
 *  stage scale wide and 392/399 of that tall. */
const PUFFER_ASPECT = 392 / 399
/** Level → [sprite, scale], straight from the shipped engine. The fish only
 *  changes silhouette at levels 2, 4 and 5; levels 1 and 3 are the same frame
 *  a little fuller, and that swell is what reads as breathing. */
const PUFFER_LEVELS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.9],
  [0, 1.04],
  [1, 0.95],
  [1, 1.04],
  [2, 1],
  [3, 1.03],
]
/** Intrinsic widths of the four frames, used for the shadow ellipse. */
const PUFFER_FRAME_WIDTH = [253, 304, 387, 370]
/** Seconds the puffer holds each level. Every turn is jittered by ±0.25s, so
 *  two turns never charge in the same rhythm. */
const PUFFER_STEPS = [1.2, 2.5, 3.9, 5.4, 7.1]

type Mote = {
  k: 'bub' | 'suck' | 'spine' | 'burst' | 'trail'
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  ph: number
  drag: number
  a: number
  tx?: number
  ty?: number
  rot?: number
  vr?: number
  len?: number
  hang?: boolean
  reach?: number
  angle?: number
  width?: number
  col?: string
  sx?: number
  sy?: number
}

/** The engine's own seeded RNG, so a turn's inflation rhythm is stable across
 *  rerenders instead of reshuffling on every poll. */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), 1 | value)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount
const between = (low: number, high: number) => low + Math.random() * (high - low)

/**
 * The shipped puffer engine, ported frame for frame.
 *
 * Puffer Party does not animate the fish with CSS: it keeps a float level and
 * eases it every frame, springs a pop impulse on every inflation step, turns
 * the body toward whoever is holding it, and jitters at the last two levels.
 * The four frames only carry the silhouette; the scale, rotation, bob and
 * spin do the moving. This component runs the same loop against refs, so the
 * sixty-hertz motion is never quantised to React's poll rate.
 */
function Puffer({
  geo,
  playing,
  asleep,
  turnAt,
  holder,
  burstId,
  rejectId,
  youHold,
  skew,
  w,
  h,
  seaRef,
  foreRef,
}: {
  geo: Geometry
  playing: boolean
  asleep: boolean
  turnAt?: number
  holder: { x: number; y: number; headY: number } | null
  burstId?: number
  rejectId?: number
  youHold: boolean
  /** serverNow - Date.now(); the holder's clock is the server's, not this tab's. */
  skew: number
  w: number
  h: number
  seaRef: { current: HTMLCanvasElement | null }
  foreRef: { current: HTMLCanvasElement | null }
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const zzRef = useRef<HTMLSpanElement | null>(null)
  const frameRefs = useRef<Array<HTMLImageElement | null>>([])
  // Props the loop reads without restarting when the table polls again.
  const live = useRef({ geo, playing, asleep, turnAt, holder, burstId, rejectId, youHold, skew, w, h })
  live.current = { geo, playing, asleep, turnAt, holder, burstId, rejectId, youHold, skew, w, h }
  const firstBurst = useRef(burstId)
  const firstReject = useRef(rejectId)

  useEffect(() => {
    const root = rootRef.current
    const body = bodyRef.current
    const zz = zzRef.current
    if (!root || !body || !zz) return
    const imgs = frameRefs.current.filter(Boolean) as HTMLImageElement[]
    const stage = root.closest('.ds-stage')
    const edge = stage?.querySelector<HTMLElement>('.ds-edge') ?? null
    const flash = stage?.querySelector<HTMLElement>('.ds-flash') ?? null
    const crt = stage?.querySelector<HTMLElement>('.ds-crt') ?? null
    const sea = seaRef.current
    const fore = foreRef.current
    const seaCtx = sea?.getContext('2d') ?? null
    const foreCtx = fore?.getContext('2d') ?? null

    const st = {
      x: geo.cx,
      y: geo.cy + 6,
      level: 0,
      pop: 0,
      popV: 0,
      face: 1,
      rot: 0,
      trot: 0,
      spin: 0,
      shown: -1,
      visible: true,
      turnAt: null as number | null,
      seedFor: -1,
      thresholds: PUFFER_STEPS.slice(),
      lastBurst: firstBurst.current,
      lastReject: firstReject.current,
      freeze: 0,
      motes: [] as Mote[],
      flecks: [] as { x: number; y: number; v: number; a: number; s: number; ph: number }[],
      bubbleIn: 0,
      trailIn: 0,
    }

    let raf = 0
    let respawn = 0
    let disposed = false
    let canvasW = 0
    let canvasH = 0
    let dpr = 1
    let last = performance.now() / 1000
    const start = last

    /** Mouth of the fish in stage pixels, where bubbles and trails are born. */
    const mouth = () => {
      const [frame, scale] = PUFFER_LEVELS[st.level]
      const wide = geo.fs * (PUFFER_FRAME_WIDTH[frame] / 399) * 0.5 * scale
      const gap = 0.03 * geo.fs
      const cos = Math.cos(st.rot)
      const sin = Math.sin(st.rot)
      const offset = -(0.97 * wide) * st.face
      return { x: st.x + offset * cos - gap * sin, y: st.y + offset * sin + gap * cos, r: wide }
    }

    const bubble = (
      x: number,
      y: number,
      options: { vx?: number; vy?: number; r?: number; max?: number; drag?: number; a?: number } = {},
    ) => {
      st.motes.push({
        k: 'bub',
        x,
        y,
        vx: options.vx ?? between(-8, 8),
        vy: options.vy ?? between(-50, -26),
        r: options.r ?? between(1.6, 4),
        life: 0,
        max: options.max ?? between(1.6, 3.2),
        ph: 9 * Math.random(),
        drag: options.drag ?? 1.4,
        a: options.a ?? 0.7,
      })
    }

    const explode = () => {
      const x = st.x
      const y = st.y
      const mobile = live.current.w < 1100
      if (stage) {
        stage.classList.remove('ds-shake')
        void (stage as HTMLElement).offsetWidth
        stage.classList.add('ds-shake')
      }
      if (crt) {
        crt.classList.remove('zap')
        void crt.offsetWidth
        crt.classList.add('zap')
      }
      if (flash) {
        flash.style.transition = 'none'
        flash.style.background = 'rgba(255,244,214,.55)'
        flash.style.opacity = '.5'
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            flash.style.transition = 'opacity 380ms ease-out'
            flash.style.opacity = '0'
          }),
        )
      }
      // Golden spines: the fish bursts into pixel needles.
      const spines = mobile ? 26 : 34
      for (let index = 0; index < spines; index += 1) {
        const angle = (index / spines) * Math.PI * 2 + between(-0.12, 0.12)
        const speed = between(160, 330) * (mobile ? 0.85 : 1.15)
        st.motes.push({
          k: 'spine',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 0,
          rot: angle,
          vr: between(-3, 3),
          len: between(10, 16) * (mobile ? 1 : 1.4),
          life: 0,
          max: between(2.4, 3.4),
          ph: 0,
          drag: 0,
          a: 1,
        })
      }
      // The bubbles the body was holding.
      const bubbles = mobile ? 26 : 36
      for (let index = 0; index < bubbles; index += 1) {
        const angle = between(0, Math.PI * 2)
        const speed = between(40, 200)
        bubble(x + 10 * Math.cos(angle), y + 10 * Math.sin(angle), {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          r: between(1.5, 5.5),
          max: between(1.6, 3.4),
          drag: 2,
        })
      }
      // Short white-gold streaks on top of the spines.
      const unit = geo.fs / 124
      for (let index = 0; index < 11; index += 1) {
        st.motes.push({
          k: 'burst',
          x: x + between(-5, 5) * unit,
          y: y + between(-5, 5) * unit,
          vx: 0,
          vy: 0,
          r: 0,
          angle: (index / 11) * Math.PI * 2 + between(-0.22, 0.22),
          reach: between(38, 90) * unit,
          len: between(28, 48) * unit,
          width: between(7, 12) * unit,
          life: 0,
          max: between(0.18, 0.3),
          ph: 0,
          drag: 0,
          a: 1,
          col: index % 3 === 0 ? '#f1d58c' : '#fff6d6',
        })
      }
      st.visible = false
      st.level = 0
      st.pop = 0
      st.popV = 0
      st.freeze = Date.now() + live.current.skew + 1500
      if (respawn) window.clearTimeout(respawn)
      respawn = window.setTimeout(() => {
        respawn = 0
        if (disposed) return
        st.x = geo.cx + between(-40, 40)
        st.y = -60
        st.level = 0
        st.pop = 0
        st.popV = 0
        st.visible = true
      }, 900)
    }

    const sizeCanvas = () => {
      const width = live.current.w
      const height = live.current.h
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      if (width === canvasW && height === canvasH && ratio === dpr) return
      canvasW = width
      canvasH = height
      dpr = ratio
      for (const canvas of [sea, fore]) {
        if (!canvas) continue
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }
      // The drifting krill specks: density is the shipped one (one per 7,000
      // square pixels on a wide stage, 4,200 on a phone).
      const count = Math.round((width * height) / (width < 1100 ? 4200 : 7000))
      st.flecks = Array.from({ length: Math.min(900, count) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        v: between(4, 12),
        a: between(0.12, 0.42),
        s: Math.random() < 0.2 ? 3 : 2,
        ph: 9 * Math.random(),
      }))
    }

    const tick = (nowMs: number) => {
      if (disposed) return
      const cfg = live.current
      const now = nowMs / 1000
      const dt = Math.min(0.05, now - last)
      last = now
      const t = now - start
      const mobile = cfg.w < 1100
      sizeCanvas()

      /* ----------------------------------------------------------- events */
      if (cfg.turnAt !== st.turnAt) {
        // A correct answer passes the fish: it shrinks back, spins once and
        // blows a ring of bubbles out of its mouth.
        if (st.turnAt !== null && cfg.playing && cfg.turnAt) {
          const at = mouth()
          const side = st.face === 1 ? -1 : 1
          const cos = Math.cos(st.rot)
          const sin = Math.sin(st.rot)
          for (let index = 0; index < 16; index += 1) {
            const reach = side * between(40, 140)
            const lift = between(-60, 10)
            bubble(at.x, at.y + between(-4, 4), {
              vx: reach * cos - lift * sin,
              vy: reach * sin + lift * cos,
              r: between(1.5, 4.5),
              max: between(1, 2.2),
              drag: 2.4,
            })
          }
          st.spin = 1
          st.popV -= 2
          st.level = 0
          st.pop = 0
        }
        st.turnAt = cfg.turnAt ?? null
        st.seedFor = -1
      }
      if (cfg.turnAt && st.seedFor !== cfg.turnAt) {
        st.seedFor = cfg.turnAt
        const random = seeded((0x9e3779b9 ^ Math.floor(cfg.turnAt)) >>> 0)
        st.thresholds = PUFFER_STEPS.map((step) => step + (0.55 * random() - 0.25))
      }
      if (cfg.burstId !== undefined && cfg.burstId !== st.lastBurst) {
        st.lastBurst = cfg.burstId
        if (cfg.playing) explode()
      }
      if (cfg.rejectId !== undefined && cfg.rejectId !== st.lastReject) {
        st.lastReject = cfg.rejectId
        st.popV += 1.6
      }

      /* ------------------------------------------------------------ level */
      let target = 0
      // The holder's clock is wall time, exactly as the shipped engine reads it
      // (`Date.now()` against `holderSince`), never the animation timestamp.
      const wall = Date.now() + cfg.skew
      if (cfg.playing && st.visible && wall >= st.freeze && cfg.turnAt) {
        const held = (wall - cfg.turnAt) / 1000
        if (held >= 0) for (const step of st.thresholds) if (held >= step) target += 1
      }
      target = Math.max(0, Math.min(5, target))
      if (target !== st.level) {
        const grew = target > st.level
        st.level = target
        st.popV += grew ? 3.4 : -1.2
        if (grew) {
          const at = mouth()
          for (let index = 0; index < 6; index += 1) {
            const angle = between(-0.9, 0.9) + (st.face === 1 ? Math.PI : 0) + st.rot
            const distance = between(20, 44)
            st.motes.push({
              k: 'suck',
              x: st.x + Math.cos(angle) * distance,
              y: st.y + Math.sin(angle) * distance,
              vx: 0,
              vy: 0,
              r: between(1.4, 2.6),
              life: 0,
              max: between(0.35, 0.55),
              ph: 0,
              drag: 0,
              a: 1,
              tx: at.x,
              ty: at.y,
            })
          }
        }
      }

      /* --------------------------------------------------------- movement */
      let wantX = cfg.geo.cx
      let wantY = cfg.geo.cy + 6
      if (cfg.playing && cfg.holder) {
        const dx = cfg.holder.x - wantX
        const dy = cfg.holder.y - wantY
        const distance = Math.hypot(dx, dy) || 1
        wantX += (dx / distance) * (mobile ? 12 : 18) * cfg.geo.scale
        wantY += (dy / distance) * 4
      }
      const breathe = cfg.asleep ? Math.sin(1.45 * t) : 0
      const bob = cfg.asleep
        ? 2 * Math.sin(0.72 * t) + 0.8 * breathe
        : 4 * Math.sin(1.7 * t) + 2 * Math.sin(0.63 * t)
      st.x = lerp(st.x, wantX, 1 - Math.pow(0.02, dt))
      st.y = lerp(st.y, wantY + bob, 1 - Math.pow(0.02, dt))

      if (cfg.playing && cfg.holder) {
        const dx = cfg.holder.x - st.x
        const dy = cfg.holder.y - 0.5 * cfg.holder.headY - st.y
        const face = Math.abs(dx) > 30 ? (dx > 0 ? -1 : 1) : st.face
        const rotation = wrapAngle(st.rot + (face !== st.face ? Math.PI : 0))
        const aim =
          Math.hypot(dx, dy) < 0.001 ? rotation : Math.atan2(-face * dy, -face * dx)
        st.face = face
        st.rot = rotation
        st.trot = aim
      } else {
        st.trot = cfg.asleep ? -0.1 + 0.025 * Math.sin(0.72 * t) : 0.06 * Math.sin(0.4 * t)
      }
      st.rot = wrapAngle(st.rot + wrapAngle(st.trot - st.rot) * (1 - Math.pow(0.05, dt)))
      // The pop impulse is a spring: an inflation step kicks it out, the level
      // change settles it back, and every frame integrates the same constants.
      st.popV += (-(120 * st.pop) - 11 * st.popV) * dt
      st.pop += st.popV * dt
      st.spin = Math.max(0, st.spin - 2.4 * dt)

      /* ----------------------------------------------------------- render */
      const [frame, scale] = PUFFER_LEVELS[st.level]
      const shown = cfg.asleep ? 4 : frame
      if (shown !== st.shown) {
        imgs.forEach((img, index) => img.classList.toggle('on', index === shown))
        st.shown = shown
      }
      root.classList.toggle('furious', st.level >= 5)
      let jitterX = 0
      let jitterY = 0
      if (st.level >= 4 && st.visible) {
        const jitter = st.level >= 5 ? 2.2 : 0.8
        jitterX = (Math.random() - 0.5) * jitter * 2
        jitterY = (Math.random() - 0.5) * jitter * 2
      }
      const swell = scale * (1 + 0.08 * st.pop) * (st.visible ? 1 : 0.001)
      const spin = st.spin > 0 ? -((1 - st.spin) * Math.PI * 2 * st.face) : 0
      root.style.transform = `translate(${(st.x + jitterX).toFixed(1)}px, ${(st.y + jitterY).toFixed(1)}px)`
      root.style.zIndex = String(100 + Math.round(st.y + 18))
      body.style.transform = `rotate(${(st.rot + spin).toFixed(3)}rad) scale(${(
        st.face *
        swell *
        (1 + 0.012 * breathe)
      ).toFixed(3)}, ${(swell * (1 + 0.025 * breathe)).toFixed(3)})`
      body.style.opacity = '1'
      const sleeping = cfg.asleep && st.visible
      zz.style.display = sleeping ? 'block' : 'none'
      if (sleeping) {
        const phase = (0.45 * t) % 1
        const text = phase < 0.33 ? 'z' : phase < 0.66 ? 'z z' : 'z z z'
        if (zz.textContent !== text) zz.textContent = text
        zz.style.transform = `translate(${(0.18 * cfg.geo.fs).toFixed(0)}px, ${(
          -0.32 * cfg.geo.fs -
          14 * phase
        ).toFixed(0)}px)`
        zz.style.opacity = String(0.4 + 0.5 * Math.sin(phase * Math.PI))
      }
      if (edge) edge.classList.toggle('danger', st.level >= 5 && cfg.playing && cfg.youHold)

      /* ------------------------------------------------------- sea canvas */
      if (seaCtx && sea && foreCtx && fore) {
        seaCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        foreCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        seaCtx.clearRect(0, 0, cfg.w, cfg.h)
        // The puffer's shadow, sized from the frame it is wearing.
        if (st.visible) {
          const [shadowFrame, shadowScale] = PUFFER_LEVELS[st.level]
          const wide = cfg.geo.fs * (PUFFER_FRAME_WIDTH[shadowFrame] / 399) * shadowScale * 0.42
          const floorY = Math.max(cfg.geo.cy + 0.42 * cfg.geo.ry, st.y + 0.5 * cfg.geo.fs)
          const depth = clamp((floorY - st.y) / (0.7 * cfg.geo.fs), 0.6, 1.4)
          seaCtx.fillStyle = `rgba(3,8,18,${(0.32 / depth).toFixed(3)})`
          seaCtx.beginPath()
          seaCtx.ellipse(
            Math.round(st.x),
            Math.round(floorY),
            wide * (1.1 - 0.15 * depth),
            0.26 * wide,
            0,
            0,
            Math.PI * 2,
          )
          seaCtx.fill()
        }
        // The drifting krill specks.
        seaCtx.fillStyle = 'rgba(200,220,255,0.5)'
        for (const fleck of st.flecks) {
          fleck.y += fleck.v * dt
          fleck.x += 3 * Math.sin(0.5 * t + fleck.ph) * dt
          if (fleck.y > cfg.h + 4) {
            fleck.y = -4
            fleck.x = Math.random() * cfg.w
          }
          seaCtx.fillStyle = `rgba(200,220,255,${fleck.a})`
          seaCtx.fillRect(
            2 * Math.round(fleck.x / 2),
            2 * Math.round(fleck.y / 2),
            fleck.s,
            fleck.s,
          )
        }

        /* ------------------------------------------------------ particles */
        // Ambient bubbles rise from the ring's edge every 0.35–0.9s.
        st.bubbleIn -= dt
        if (st.bubbleIn <= 0) {
          st.bubbleIn = between(0.35, 0.9)
          const angle = between(0, Math.PI * 2)
          bubble(
            cfg.geo.cx + Math.cos(angle) * cfg.geo.rx * between(0.9, 1.3),
            cfg.geo.cy + Math.sin(angle) * cfg.geo.ry * between(0.9, 1.2) + 10,
            { r: between(1.4, 3), a: 0.45, max: between(2.5, 4) },
          )
        }
        // While somebody holds the fish, a pink bead runs from its mouth to
        // their seat every 0.42s.
        const held = st.level >= 0 && cfg.playing && st.visible && cfg.holder
        st.trailIn -= dt
        if (held && st.trailIn <= 0) {
          st.trailIn = 0.42
          const at = mouth()
          st.motes.push({
            k: 'trail',
            x: at.x,
            y: at.y,
            sx: at.x,
            sy: at.y,
            tx: cfg.holder!.x,
            ty: cfg.holder!.y - 0.5 * cfg.geo.spr,
            vx: 0,
            vy: 0,
            r: 0,
            life: 0,
            max: 1.1,
            ph: 0,
            drag: 0,
            a: 1,
          })
        }
        for (let index = st.motes.length - 1; index >= 0; index -= 1) {
          const mote = st.motes[index]
          mote.life += dt
          if (mote.life > mote.max) {
            st.motes.splice(index, 1)
            continue
          }
          if (mote.k === 'bub') {
            mote.vx *= Math.exp(-mote.drag * dt)
            mote.vy = lerp(mote.vy, -38, 1 - Math.exp(-1.2 * dt))
            mote.x += (mote.vx + 6 * Math.sin(4 * mote.life + mote.ph)) * dt
            mote.y += mote.vy * dt
          } else if (mote.k === 'suck') {
            const approach = (mote.life / mote.max) ** 2
            mote.x = lerp(mote.x, mote.tx ?? mote.x, approach)
            mote.y = lerp(mote.y, mote.ty ?? mote.y, approach)
          } else if (mote.k === 'spine') {
            const drag = Math.exp(-2.6 * dt)
            mote.vx *= drag
            mote.vy = mote.vy * drag + 10 * dt
            mote.x += mote.vx * dt
            mote.y += mote.vy * dt
            mote.rot = (mote.rot ?? 0) + (mote.vr ?? 0) * dt * (Math.hypot(mote.vx, mote.vy) / 200 + 0.08)
          } else if (mote.k === 'trail') {
            const phase = mote.life / mote.max
            mote.x = lerp(mote.sx ?? mote.x, mote.tx ?? mote.x, phase)
            mote.y = lerp(mote.sy ?? mote.y, mote.ty ?? mote.y, phase) - 10 * Math.sin(phase * Math.PI)
          }
        }

        foreCtx.clearRect(0, 0, cfg.w, cfg.h)
        for (const mote of st.motes) {
          const phase = mote.life / mote.max
          if (mote.k === 'bub') {
            const alpha = mote.a * (phase > 0.75 ? (1 - phase) / 0.25 : 1)
            foreCtx.strokeStyle = `rgba(200,235,255,${alpha.toFixed(3)})`
            foreCtx.lineWidth = 1.5
            foreCtx.beginPath()
            foreCtx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2)
            foreCtx.stroke()
            if (mote.r > 3) {
              foreCtx.fillStyle = `rgba(232,246,255,${(0.7 * alpha).toFixed(3)})`
              foreCtx.fillRect(
                Math.round(mote.x - 0.4 * mote.r),
                Math.round(mote.y - 0.5 * mote.r),
                1.5,
                1.5,
              )
            }
          } else if (mote.k === 'suck') {
            foreCtx.strokeStyle = `rgba(200,235,255,${(0.75 * (1 - phase)).toFixed(3)})`
            foreCtx.lineWidth = 1.2
            foreCtx.beginPath()
            foreCtx.arc(mote.x, mote.y, mote.r * (1 - 0.5 * phase), 0, Math.PI * 2)
            foreCtx.stroke()
          } else if (mote.k === 'spine') {
            const alpha = mote.hang ? 1 : phase > 0.7 ? (1 - phase) / 0.3 : 1
            const cos = Math.cos(mote.rot ?? 0)
            const sin = Math.sin(mote.rot ?? 0)
            foreCtx.globalAlpha = alpha
            const unit = mobile ? 3 : 4
            const length = Math.max(3, Math.round((mote.len ?? 0) / unit))
            for (let step = 0; step < length; step += 1) {
              const x = Math.round((mote.x + cos * step * unit) / unit) * unit
              const y = Math.round((mote.y + sin * step * unit) / unit) * unit
              foreCtx.fillStyle = step === length - 1 ? '#fff6d6' : step < 1 ? '#a87a2c' : '#f1d58c'
              foreCtx.fillRect(x, y, unit, unit)
            }
            foreCtx.globalAlpha = 1
          } else if (mote.k === 'burst') {
            const unit = mobile ? 3 : 4
            const reach = (mote.reach ?? 0) * (1 - (1 - phase) ** 3)
            const length = (mote.len ?? 0) * (1 - phase)
            const segments = Math.max(1, Math.ceil(length / unit))
            const cos = Math.cos(mote.angle ?? 0)
            const sin = Math.sin(mote.angle ?? 0)
            foreCtx.globalAlpha = (1 - phase) ** 0.7
            foreCtx.fillStyle = mote.col ?? '#fff6d6'
            for (let step = 0; step <= segments; step += 1) {
              const travel = reach - length + (step / segments) * length
              const width = Math.max(
                unit,
                Math.round(((mote.width ?? 0) * (1 - step / (segments + 1))) / unit) * unit,
              )
              foreCtx.fillRect(
                Math.round((mote.x + cos * travel - width / 2) / unit) * unit,
                Math.round((mote.y + sin * travel - width / 2) / unit) * unit,
                width,
                width,
              )
            }
            foreCtx.globalAlpha = 1
          } else if (mote.k === 'trail') {
            foreCtx.strokeStyle = `rgba(255,170,200,${(0.65 * Math.sin(phase * Math.PI)).toFixed(3)})`
            foreCtx.lineWidth = 1.4
            foreCtx.beginPath()
            foreCtx.arc(mote.x, mote.y, 2.2, 0, Math.PI * 2)
            foreCtx.stroke()
          }
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      if (respawn) window.clearTimeout(respawn)
    }
  }, [seaRef, foreRef])

  return (
    <div className="pf-puffer" ref={rootRef}>
      <div
        className="pf-pbody"
        ref={bodyRef}
        style={{
          width: geo.fs,
          height: geo.fs * PUFFER_ASPECT,
          left: -geo.fs / 2,
          top: -(geo.fs * PUFFER_ASPECT) / 2,
        }}
      >
        {[0, 1, 2, 3].map((index) => (
          <img
            key={index}
            ref={(element) => {
              frameRefs.current[index] = element
            }}
            className="pf-smooth"
            src={`/gen/party/puffer-${index}.png`}
            alt=""
            aria-hidden
          />
        ))}
        <img
          ref={(element) => {
            frameRefs.current[4] = element
          }}
          className="pf-smooth"
          src="/gen/party/puffer-sleep.png"
          alt=""
          aria-hidden
        />
      </div>
      <span className="pf-zz" ref={zzRef} aria-hidden />
    </div>
  )
}

/* --------------------------------------------------------------------- api */

async function call(path: string, body?: unknown) {
  const response = await fetch(`/api/butter${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new Error(String(payload.error ?? 'That did not work.'))
  return payload
}

/* --------------------------------------------------------------------- page */

export function Butter() {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  // The gate's buddies are dive-streak rewards, exactly as the shipped one
  // hands them out: each opens after that many finished dives in a row.
  const [streak] = useState(() => diveStreak())
  // A buddy saved by an older build may name a mascot that is no longer in the
  // picker, or one this browser has not unlocked yet; the door then shows
  // nothing pressed. Fall back to Krill, which the gate hands everyone.
  const [buddy, setBuddy] = useState(() => {
    const saved = localStorage.getItem(BUDDY_KEY)
    const found = MASCOTS.find((mascot) => mascot.id === saved)
    return found && found.day <= streak ? found.id : MASCOTS[0].id
  })
  // The door opens on 4–6, the way the shipped one does.
  const [size, setSize] = useState('party')
  const [myRating, setMyRating] = useState(() => {
    const saved = Number(localStorage.getItem(RATING_KEY))
    return Number.isFinite(saved) && saved > 0 ? Math.round(saved) : 1000
  })
  const [joinCode, setJoinCode] = useState('')
  const [code, setCode] = useState('')
  const [pid, setPid] = useState('')
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  // What the card makes of the word being typed: the shipped dock shows
  // `chedder → cheddar` above the input before an answer is ever sent.
  const [correction, setCorrection] = useState<{ typed: string; value: string; repeat: boolean } | null>(null)
  const [chatText, setChatText] = useState('')
  // My answer, echoed locally until the snapshot comes back with it.
  const [mySaid, setMySaid] = useState<{ text: string; round: number } | null>(null)
  const chatList = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const list = chatList.current
    if (list) list.scrollTop = list.scrollHeight
  }, [snap?.chat?.length])
  // The shipped table keeps its chat open down the right-hand side for the
  // whole game; there is no button that reveals it.
  const [chatOpen] = useState(true)
  const [chatError, setChatError] = useState('')
  const pollMisses = useRef(0)
  const [busy, setBusy] = useState(false)
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public')
  // The host's lives setting, the way the shipped lobby's settings screen has
  // one: every seat opens on this count and a full meter is the only way to add
  // another heart. Five is what the room's hearts row can draw.
  const [lives, setLives] = useState(2)
  const livesPicked = useRef(false)
  const [howTo, setHowTo] = useState(false)
  const [, frame] = useState(0)
  // A fresh card slides in over CATEGORY_SWAP_MS (1300ms) on the shipped table.
  const [newCat, setNewCat] = useState(false)
  const lastPrompt = useRef('')
  const [viewport, setViewport] = useState({ w: 390, h: 720 })
  const stage = useRef<HTMLDivElement | null>(null)
  // The puffer's engine paints its shadow and specks on the sea canvas and its
  // bubbles and bursts on the fore canvas, exactly as the shipped one does.
  const seaRef = useRef<HTMLCanvasElement | null>(null)
  const foreRef = useRef<HTMLCanvasElement | null>(null)
  const skew = useRef(0)

  const measure = useCallback(() => {
    const box = stage.current?.getBoundingClientRect()
    if (box) setViewport({ w: Math.round(box.width), h: Math.round(box.height) })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    // The stage also changes width when the shell's sidebar opens or closes, with
    // no window resize to hear, and a stale width puts the ring off the screen.
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (watcher && stage.current) watcher.observe(stage.current)
    return () => {
      window.removeEventListener('resize', measure)
      watcher?.disconnect()
    }
  }, [measure])

  // The tab reads like the game, not like a nameless app page: the real one
  // leads with "Puffer Party · Multiplayer Category Game · Krillion".
  useEffect(() => {
    const previous = document.title
    document.title = 'Butter Party · Ink'
    return () => {
      document.title = previous
    }
  }, [])

  const refreshRooms = useCallback(async () => {
    try {
      const payload = (await call('/rooms')) as { rooms?: RoomRow[] }
      setRooms(payload.rooms ?? [])
    } catch {
      /* the list is optional */
    }
  }, [])

  useEffect(() => {
    if (code) return
    void refreshRooms()
    const timer = window.setInterval(() => void refreshRooms(), 5000)
    return () => window.clearInterval(timer)
  }, [code, refreshRooms])

  // Poll the table. The fuse is a wall-clock deadline, so the tab only has to
  // agree with the server's clock once per round trip.
  useEffect(() => {
    if (!code || !pid) return
    let alive = true
    const pull = async () => {
      try {
        const payload = (await call(`/state?code=${code}&pid=${pid}`)) as unknown as Snapshot
        if (!alive) return
        skew.current = payload.serverNow - Date.now()
        if (typeof payload.rating === 'number') {
          localStorage.setItem(RATING_KEY, String(payload.rating))
          setMyRating(Math.round(payload.rating))
        }
        pollMisses.current = 0
        setSnap(payload)
        // Until the host touches the picker it mirrors the table's own setting,
        // so a rematch shows the lives the room is actually playing for.
        if (!livesPicked.current && payload.maxLives) {
          setLives(Math.max(1, Math.min(5, Number(payload.maxLives) || 2)))
        }
        setError('')
      } catch (failure) {
        // A dropped poll is normal on a busy table: try again quickly, and only
        // tell the player something is wrong once it keeps failing.
        pollMisses.current += 1
        if (!alive) return
        if (pollMisses.current >= 3) setError(failure instanceof Error ? failure.message : 'Lost the table — retrying…')
        window.setTimeout(() => {
          if (alive) void pull()
        }, 300)
      }
    }
    void pull()
    const poll = window.setInterval(pull, 1000)
    const beat = window.setInterval(() => frame((n) => n + 1), 80)
    return () => {
      alive = false
      window.clearInterval(poll)
      window.clearInterval(beat)
    }
  }, [code, pid])

  useEffect(() => {
    if (!snap || snap.status !== 'playing') {
      lastPrompt.current = ''
      return
    }
    if (lastPrompt.current && lastPrompt.current !== snap.prompt) {
      setNewCat(true)
      const timer = window.setTimeout(() => setNewCat(false), 1300)
      lastPrompt.current = snap.prompt
      return () => window.clearTimeout(timer)
    }
    lastPrompt.current = snap.prompt
  }, [snap?.prompt, snap?.status])

  const remember = useCallback((nextCode: string, nextPid: string) => {
    setCode(nextCode)
    setPid(nextPid)
    localStorage.setItem(ROOM_KEY, JSON.stringify({ code: nextCode, pid: nextPid }))
  }, [])

  // A reload mid-round should put you back on your perch, not at the door.
  useEffect(() => {
    const raw = localStorage.getItem(ROOM_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as { code?: string; pid?: string }
      if (!saved.code || !saved.pid) throw new Error('empty')
      void call(`/state?code=${saved.code}&pid=${saved.pid}`)
        .then((payload) => {
          const next = payload as unknown as Snapshot
          skew.current = next.serverNow - Date.now()
          setCode(saved.code as string)
          setPid(saved.pid as string)
          setSnap(next)
        })
        .catch(() => localStorage.removeItem(ROOM_KEY))
    } catch {
      localStorage.removeItem(ROOM_KEY)
    }
  }, [])

  const cleanName = () => name.trim() || 'Player'

  const host = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      localStorage.setItem(NAME_KEY, cleanName())
      const payload = (await call('/create', { name: cleanName(), private: privacy === 'private', size, client: clientId() })) as {
        code: string
        pid: string
      }
      remember(payload.code, payload.pid)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open a table.')
    } finally {
      setBusy(false)
    }
  }, [name, privacy, remember, size])

  const join = useCallback(
    async (target: string) => {
      const wanted = target.toUpperCase().replace(/[^A-Z]/g, '')
      if (wanted.length !== 4) {
        setError('A table code is four letters.')
        return
      }
      setBusy(true)
      setError('')
      try {
        localStorage.setItem(NAME_KEY, cleanName())
        const payload = (await call('/join', { code: wanted, name: cleanName(), buddy, client: clientId() })) as { code: string; pid: string }
        remember(payload.code, payload.pid)
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not join that table.')
      } finally {
        setBusy(false)
      }
    },
    [buddy, name, remember],
  )

  /** Quick play is one click from the door to a dealt table: it opens its own
   *  room, fills the empty chairs with bots and starts. Sitting down in someone
   *  else's lobby waits on a host who may never press start, which is how a play
   *  button turns into a dead screen — joining a friend is what the code field
   *  and the public list are for. */
  const quickPlay = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      localStorage.setItem(NAME_KEY, cleanName())
      const seats = Math.max(1, (CAP_FOR[size] ?? 6) - 1)
      const created = (await call('/create', { name: cleanName(), size, bots: seats, client: clientId() })) as { code: string; pid: string }
      remember(created.code, created.pid)
      await call('/start', { code: created.code, pid: created.pid, lives })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not find a table.')
    } finally {
      setBusy(false)
    }
  }, [name, remember, size])

  /** Rated play sits down at the open rated table nearest your rating, or opens
   *  one and deals at once. Bots fill empty chairs but carry no client id, so the
   *  rating is only ever moved by the humans at the table. */
  const ratedPlay = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      localStorage.setItem(NAME_KEY, cleanName())
      const mine = Number(localStorage.getItem(RATING_KEY) ?? 1000)
      const payload = (await call('/rooms')) as { rooms?: RoomRow[] }
      const open = (payload.rooms ?? [])
        .filter((room) => room.rated && room.status === 'lobby' && room.players >= 2 && room.players < (CAP_FOR[room.size ?? 'party'] ?? 6))
        .sort((a, b) => Math.abs((a.rating ?? 1000) - mine) - Math.abs((b.rating ?? 1000) - mine))[0]
      if (open) {
        const joined = (await call('/join', { code: open.id, name: cleanName(), buddy, client: clientId() })) as { code: string; pid: string }
        remember(joined.code, joined.pid)
        return
      }
      // No rated table is waiting, so open one and deal immediately. Bots never
      // carry a client id, so they are left out of the rating arithmetic.
      const seats = Math.max(1, (CAP_FOR[size] ?? 6) - 1)
      const created = (await call('/create', { name: cleanName(), size, rated: true, bots: seats, client: clientId() })) as { code: string; pid: string }
      remember(created.code, created.pid)
      await call('/start', { code: created.code, pid: created.pid, lives })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not find a rated table.')
    } finally {
      setBusy(false)
    }
  }, [buddy, name, remember, size])

  const addBot = useCallback(async () => {
    if (!code || !pid) return
    setBusy(true)
    setError('')
    try {
      const payload = (await call('/bots', { code, pid, count: 1 })) as unknown as Snapshot
      setSnap(payload)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not add a bot.')
    } finally {
      setBusy(false)
    }
  }, [code, pid])

  const start = useCallback(async () => {
    if (!code || !pid) return
    setBusy(true)
    try {
      // Take the dealt table straight from the response: waiting for the next
      // poll leaves the host staring at the lobby after the round has begun.
      const payload = (await call('/start', { code, pid, lives })) as unknown as Snapshot
      setSnap(payload)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not start.')
    } finally {
      setBusy(false)
    }
  }, [code, pid, lives])

  const pass = useCallback(async () => {
    if (!code || !pid || !typed.trim()) return
    const answer = typed.trim()
    setTyped('')
    // Show it over my head on the same frame I press enter: the round trip is a
    // third of a second on a good connection and a few on a bad one, and the
    // table should not see the card answered while my chip is still empty.
    setMySaid({ text: answer.toLowerCase(), round: snap?.round ?? 0 })
    try {
      const payload = (await call('/say', { code, pid, answer })) as unknown as Snapshot
      skew.current = payload.serverNow - Date.now()
      setSnap(payload)
      // The snapshot now carries the seat's own last answer (or nothing, when it
      // was a miss), so the local echo has nothing left to stand in for.
      setMySaid(null)
    } catch (failure) {
      setMySaid(null)
      setTyped(answer)
      setError(failure instanceof Error ? failure.message : 'That did not go through.')
    }
  }, [code, pid, typed, snap?.round])

  const sendChat = useCallback(async () => {
    const text = chatText.trim()
    if (!code || !pid || !text) return
    setChatText('')
    setChatError('')
    try {
      const payload = (await call('/chat', { code, pid, text })) as unknown as Snapshot
      skew.current = payload.serverNow - Date.now()
      setSnap(payload)
    } catch (failure) {
      setChatText(text)
      setChatError(failure instanceof Error ? failure.message : 'That did not send.')
    }
  }, [chatText, code, pid])

  const leave = () => {
    localStorage.removeItem(ROOM_KEY)
    setCode('')
    setPid('')
    setSnap(null)
    setTyped('')
  }

  /* ---------------------------------------------------------------- derived */

  const seats = snap?.players ?? []
  const mode: 'door' | 'round' = snap ? 'round' : 'door'
  // The ring is laid out against the real chrome: the prompt card's bottom edge
  // and the dock's top edge, measured in the stage's own pixels. The shipped
  // engine reads the same two edges off its DOM instead of guessing them.
  const cardRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const [chrome, setChrome] = useState<Chrome>({ cardBottom: 0, dockTop: 0 })
  useLayoutEffect(() => {
    const stageEl = stage.current
    if (!stageEl) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const base = stageEl.getBoundingClientRect().top
        const card = cardRef.current?.getBoundingClientRect()
        const dock = dockRef.current?.getBoundingClientRect()
        const next: Chrome = {
          cardBottom: card ? Math.round(card.bottom - base) : 0,
          dockTop: dock ? Math.round(dock.top - base) : 0,
        }
        setChrome((now) => (now.cardBottom === next.cardBottom && now.dockTop === next.dockTop ? now : next))
      })
    }
    measure()
    // The dock and the card mount one paint after the status flips, so measure
    // again once they exist: a zero here is what put the ring inside the dock.
    const settle = setTimeout(measure, 160)
    const observer = new ResizeObserver(measure)
    observer.observe(stageEl)
    if (cardRef.current) observer.observe(cardRef.current)
    if (dockRef.current) observer.observe(dockRef.current)
    return () => {
      clearTimeout(settle)
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [snap?.status, viewport.w, viewport.h, seats.length])
  const geo = useMemo(
    () =>
      geometry(
        viewport.w,
        viewport.h,
        mode,
        seats.length,
        // The start panel with ADD A BOT and its two hints is ~235px tall on a
        // phone, and the bottom seat's plate hangs below its perch, so the ring
        // has to clear both or a player hides behind the start button.
        snap && snap.status !== 'playing' ? (viewport.w < 1100 ? 262 : 170) : undefined,
        chrome,
      ),
    [viewport.w, viewport.h, mode, seats.length, snap?.status, chrome],
  )
  const secondsLeft = snap && snap.status === 'playing' ? Math.max(0, (snap.fuseEnd - (Date.now() + skew.current)) / 1000) : 0
  const fuseTotal = snap ? Math.max(1, snap.fuseMs / 1000) : 1
  const fusePct = snap && snap.status === 'playing' ? clamp(secondsLeft / fuseTotal, 0, 1) : 0
  const yourTurn = Boolean(snap && snap.status === 'playing' && snap.turn === snap.you)
  // The puffer turns to face whoever is holding it. The aim point is the head
  // of that seat, measured from the same geometry the ring just drew with.
  const holderIndex = snap?.status === 'playing' ? seats.findIndex((player) => player.pid === snap.turn) : -1
  const holderSpot = holderIndex >= 0 ? seatSpot(holderIndex, seats.length, geo) : null
  const holderLook = holderSpot
    ? { x: holderSpot.point.x, y: holderSpot.y, headY: geo.spr * holderSpot.sway * 0.61 }
    : null

  // The dock's spell-check. It asks the card about the word on screen, so a typo
  // is corrected while it is still being typed rather than after it is refused.
  useEffect(() => {
    const word = typed.trim()
    if (!code || !pid || !yourTurn || word.length < 3) {
      setCorrection(null)
      return
    }
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const payload = (await call('/check', { code, pid, answer: word })) as { value?: unknown; repeat?: unknown }
          if (!alive) return
          const value = typeof payload.value === 'string' ? payload.value : ''
          const repeat = Boolean(payload.repeat)
          // A word the card already spells the same way needs no pill; a word it
          // corrects, or one the table has already heard, does.
          const differs = value.toLowerCase() !== word.toLowerCase()
          setCorrection(value && (differs || repeat) ? { typed: word, value, repeat } : null)
        } catch {
          if (alive) setCorrection(null)
        }
      })()
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [code, pid, typed, yourTurn])
  const me = seats.find((player) => player.you)
  const isHost = Boolean(snap && snap.host === snap.you)
  const last = snap?.last ?? null
  // The last event reaches this tab on its next poll, so its display clock starts
  // when it lands here rather than from the server's stamp.
  const lastAt = useRef(0)
  const lastSeenAt = useRef(0)
  if (last?.at && last.at !== lastAt.current) {
    lastAt.current = last.at
    lastSeenAt.current = Date.now()
  }
  const lastAge = Date.now() - lastSeenAt.current
  const lastLive = Boolean(last && lastSeenAt.current && lastAge < 2600)
  // A refused answer shakes for a beat, the way the shipped table jolts.
  const rejectLive = Boolean(last?.kind === 'reject' && lastAge < 1300)
  // The rarity of a scored answer rises off the seat for 1.8s, the same beat
  // the shipped table gives its tier toast.
  const riseLive = Boolean((last?.kind === 'tier' || last?.kind === 'spare') && lastAge < 1800)
  const mascotFor = (seat: number) => MASCOTS[seat % MASCOTS.length]
  // The character you picked, floating between the two door columns before a
  // table is dealt — the shipped gate does the same with the idle buddy.

  // A seat wears its last answer over its head until it says another one: the
  // chip is the seat's standing answer, not a 1.3s toast, so the table can see
  // what everyone has already said without waiting for the next poll.
  const saidSeen = useRef(new Map<number, number>())
  const said = (() => {
    const map = new Map<string, { text: string; tier?: TierId }>()
    const at = Date.now()
    const feed = snap?.feed ?? []
    // The seat's own record is the durable one: it survives the feed scrolling,
    // so a chip stays up from the answer until the next answer replaces it.
    for (const player of snap?.players ?? []) {
      const worn = player.lastAnswer
      if (worn && typeof worn.text === 'string')
        map.set(player.name, { text: worn.text.toLowerCase(), tier: worn.tier as TierId | undefined })
    }
    const live = new Set(feed.map((line) => line.id))
    for (const line of feed) if (!saidSeen.current.has(line.id)) saidSeen.current.set(line.id, at)
    for (const id of [...saidSeen.current.keys()]) if (!live.has(id)) saidSeen.current.delete(id)
    for (const line of feed) {
      const match = /^(.+?): (.+)$/.exec(line.text)
      if (!match || /^(the|every)/i.test(match[1])) continue
      map.set(match[1].trim(), { text: match[2].toLowerCase() })
    }
    // The echo outranks everything until the card turns over.
    const mine = (snap?.players ?? []).find((player) => player.you)
    if (mine && mySaid && mySaid.round === (snap?.round ?? 0)) map.set(mine.name, { text: mySaid.text })
    return map
  })()

  /* ------------------------------------------------------------------ table */

  return (
    <div className="butter-page relative min-h-0 flex-1 overflow-hidden" ref={stage}>
      <div
        className="ds-root pf-root"
        data-phase={snap ? (snap.status === 'playing' ? 'answering' : 'lobby') : 'preview'}
        data-mode={mode}
        data-world="puffer"
        data-short={viewport.h < (viewport.w < 1100 ? 790 : 700) ? '' : undefined}
        data-tight={geo.scale < 0.86 ? '' : undefined}
        data-crowded={seats.length > 8 ? '' : undefined}
        style={{ ['--pf-spr' as string]: `${geo.spr}px`, ['--pf-perch' as string]: `${geo.perch}px` }}
      >
        <div className="ds-stage">
          <div className="pf-world">
            <div className="pf-reef" aria-hidden>
              <img
                className="pf-reef-art pf-smooth"
                alt=""
                src={`/gen/party/${REEF[geo.pane.k].file}`}
                style={{ display: 'block', width: geo.pane.w, height: geo.pane.h, left: geo.pane.ox, top: geo.pane.oy }}
              />
            </div>
            <canvas className="ds-sea" ref={seaRef} />
            <div className="pf-ring">
              {mode === 'round' &&
                seats.map((player, index) => (
                  <Seat
                    key={player.pid}
                    player={player}
                    index={index}
                    total={seats.length}
                    geo={geo}
                    holding={snap?.status === 'playing' && snap.turn === player.pid}
                    status={snap?.status ?? 'lobby'}
                    winner={snap?.winner?.name === player.name}
                    said={said.get(player.name)?.text}
                    reject={
                      rejectLive && last?.kind === 'reject' && last?.name === player.name ? last.answer : undefined
                    }
                    tier={last?.name === player.name ? last?.tier : undefined}
                    rise={riseLive && last?.name === player.name}
                    mascot={mascotFor(player.you ? Math.max(0, MASCOTS.findIndex((m) => m.id === buddy)) : index)}
                    target={snap?.meterTarget ?? 600}
                    maxLives={snap?.maxLives ?? 2}
                    dockTop={chrome.dockTop || Math.round(viewport.h - 140)}
                  />
                ))}
              {/* The door parks the puffer off stage: the real one sits beyond the
                  right edge until a table is dealt, so nothing swims on the menu. */}
              {mode !== 'door' && (
                <Puffer
                  geo={geo}
                  playing={snap?.status === 'playing'}
                  asleep={snap?.status === 'lobby'}
                  turnAt={snap?.turnAt}
                  holder={holderLook}
                  burstId={last?.kind === 'pop' ? Number(last.at ?? 0) : undefined}
                  rejectId={last?.kind === 'reject' ? Number(last.at ?? 0) : undefined}
                  youHold={yourTurn}
                  skew={skew.current}
                  w={viewport.w}
                  h={viewport.h}
                  seaRef={seaRef}
                  foreRef={foreRef}
                />
              )}
            </div>
            <canvas className="ds-fore" ref={foreRef} />
            <div className="ds-dim" />
            <div className="ds-vignette" />
            <div className="ds-edge" />
            <div className="ds-flash" />
          </div>
          <div className="ds-crt" />
        </div>

        {!snap && (
          <div className="pf-door">
            <div className="pf-door-title">
              <div className="ds-title">
                {'BUTTER'.split('').map((letter, index) => (
                  <span key={index} style={{ animationDelay: `${0.18 * index}s` }}>
                    {letter}
                  </span>
                ))}
              </div>
              <h1 className="ds-tagline">PUFFER PARTY</h1>
              <div className="pf-lobby-sub">pass the puffer · don&apos;t let it pop on you</div>
            </div>
            <p className="pf-door-description">
              Butter&apos;s multiplayer category game. Name an answer and pass the puffer before it pops. Play with
              friends or join a public room. Last one floating wins.
            </p>
            <div className="pf-door-gap">
              {/* The gate floats the puffer itself, not the buddy you picked: the
                  fish is the thing you are about to be handed. */}
              <div className="pf-door-buddy" style={{ ['--pf-glow' as string]: '#ffd16659' }} aria-hidden>
                <img draggable={false} alt="" src="/gen/party/puffer-0.png" />
              </div>
            </div>

            <div className="pf-door-cols">
              <div className="pf-door-col">
                <div className="pf-panel">
                  <div className="pf-panel-heading">
                    <h3>WHO&apos;S PLAYING</h3>
                    <button type="button" className="pf-howto-trigger" aria-haspopup="dialog" onClick={() => setHowTo(true)}>
                      HOW TO PLAY
                    </button>
                  </div>
                  <label className="pf-field">
                    <span className="label">YOUR NAME</span>
                    <input
                      className="ds-input"
                      type="text"
                      maxLength={16}
                      autoComplete="nickname"
                      autoCapitalize="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      placeholder="what the ring calls you"
                      value={name}
                      onChange={(event) => setName(event.target.value.slice(0, 16))}
                    />
                  </label>
                  <div className="pf-keys" role="group" aria-label="Your buddy">
                    {MASCOTS.map((mascot) => {
                      const locked = mascot.day > streak
                      return (
                        <button
                          key={mascot.id}
                          type="button"
                          className="pf-key"
                          aria-pressed={mascot.id === buddy}
                          aria-label={locked ? `${mascot.name}, unlocks at a ${mascot.day}-day streak` : mascot.name}
                          title={mascot.name}
                          disabled={locked}
                          onClick={() => {
                            setBuddy(mascot.id)
                            localStorage.setItem(BUDDY_KEY, mascot.id)
                          }}
                        >
                          <img draggable={false} alt="" src={mascot.sprite} />
                          <span>{mascot.name.toUpperCase()}</span>
                          {mascot.day > 0 ? <small>{mascot.day}-day</small> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pf-panel pf-quick">
                  {/* Measured off krillion.io/party at 426×651: this panel is
                      264.9px tall and holds the heading plus the RATING badge,
                      the four sizes, the size hint, both mode buttons and the
                      "your rating is saved on this browser" line. Dropping the
                      badge and that line leaves it 223px, which is where it
                      drifted from the live gate. */}
                  <div className="pf-panel-heading">
                    <h3>PLAY NOW</h3>
                  </div>
                  <div className="pf-sizes" role="radiogroup" aria-label="Table size">
                    {TABLE_SIZES.map((table) => (
                      <button
                        key={table.id}
                        type="button"
                        role="radio"
                        aria-checked={table.id === size}
                        className="pf-size"
                        onClick={() => setSize(table.id)}
                      >
                        {table.label}
                      </button>
                    ))}
                  </div>
                  <span className="pf-hint pf-size-hint">{TABLE_SIZES.find((table) => table.id === size)?.hint}</span>
                  <div className="pf-modes">
                    <div className="pf-mode">
                      <button
                        type="button"
                        className="ds-begin-btn"
                        title={`your rating · ${myRating}`}
                        disabled={busy}
                        onClick={() => void ratedPlay()}
                      >
                        ▶ RATED ◀
                      </button>
                      <span className="pf-hint">near your rating · it moves</span>
                    </div>
                    <div className="pf-mode pf-mode-casual">
                      <button type="button" className="ds-begin-btn" disabled={busy} onClick={() => void quickPlay()}>
                        QUICK PLAY
                      </button>
                      <span className="pf-hint">unrated · just for fun</span>
                    </div>
                  </div>
                </div>

                <div className="pf-panel pf-host-panel">
                  <h3>HOST</h3>
                  <button type="button" className="ds-begin-btn" disabled={busy} onClick={() => void host()}>
                    ▼ HOST A ROOM ▼
                  </button>
                  <div className="pf-host-row">
                    <button
                      type="button"
                      className="pf-privacy"
                      aria-pressed={privacy === 'private'}
                      onClick={() => setPrivacy(privacy === 'public' ? 'private' : 'public')}
                    >
                      {privacy === 'public' ? 'PUBLIC · LISTED' : 'PRIVATE · CODE ONLY'}
                    </button>
                    <span className="pf-hint">
                      {privacy === 'public' ? 'anyone can join from the list' : 'friends join with the code'}
                    </span>
                  </div>
                </div>
                {/* The shipped gate keeps JOIN BY CODE under HOST in the left
                    column, with the rooms list alone on the right. */}
                <div className="pf-panel">
                  <h3>JOIN BY CODE</h3>
                  <div className="pf-code-row">
                    <input
                      className="ds-input"
                      type="text"
                      maxLength={4}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      enterKeyHint="go"
                      placeholder="Room code"
                      aria-label="Room code"
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void join(joinCode)
                      }}
                    />
                    <button
                      type="button"
                      className="ds-dive-btn"
                      disabled={joinCode.length !== 4 || busy}
                      onClick={() => void join(joinCode)}
                    >
                      JOIN
                    </button>
                  </div>
                </div>
              </div>

              <div className="pf-door-col">
                <div className="pf-panel">
                  <h3>
                    PUBLIC ROOMS <small aria-live="polite">SHOWING {rooms.length}</small>
                  </h3>
                  <div className="pf-rooms">
                    {rooms.length === 0 && <div className="pf-empty">no open tables right now. host one</div>}
                    {rooms.map((room) => {
                      const cap = room.cap ?? CAP_FOR[room.size ?? 'party'] ?? 6
                      const full = room.players >= cap
                      return (
                        <button
                          key={room.id}
                          type="button"
                          className="pf-room"
                          disabled={full || busy}
                          onClick={() => void join(room.id)}
                        >
                          <span className="c">{room.id}</span>
                          <span className="h">{room.hostName ?? 'a table'}</span>
                          <span className={`s${room.status === 'playing' ? ' playing' : ''}`}>
                            {room.players}/{cap} · {room.status === 'playing' ? 'PLAYING' : 'IN THE LOBBY'}
                          </span>
                          <span className="go">{full ? 'FULL' : 'JOIN ▸'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="pf-err">{error}</p>}
          </div>
        )}

        {snap && (
          <>
            {snap.status === 'playing' ? (
              <div className={`ds-card${newCat ? ' pf-newcat' : ''}`} ref={cardRef}>
                <div className="rnd">CATEGORY {Math.min(snap.round + 1, 7)} OF 7</div>
                <div className="prompt">{snap.prompt}</div>
                <div className="hint">
                  {yourTurn
                    ? 'your turn — name one and pass the puffer'
                    : `${seats.find((player) => player.pid === snap.turn)?.name ?? 'someone'} has the puffer`}
                </div>
              </div>
            ) : (
              <div className="pf-lobby">
                <div className="pf-lobby-title">
                  <div className="ds-title">
                    {snap.status === 'done' ? 'that is the round' : 'waiting for the table'}
                  </div>
                  <h1 className="ds-tagline">PUFFER PARTY</h1>
                  <div className="pf-lobby-sub">
                    {snap.status === 'done'
                      ? snap.winner
                        ? `${snap.winner.name} is the last one still floating`
                        : 'nobody left floating'
                      : `room ${snap.code} · pass the puffer · don’t let it pop on you`}
                  </div>
                </div>
                <div className="pf-lobby-foot">
                  <div className="pf-lobby-inner">
                    <div className="ds-intro-meta">
                      <span>{snap.players.length} SEATED</span>
                      <span>
                        ROOM <b>{snap.code}</b>
                      </span>
                    </div>
                    {isHost && (
                      <div className="pf-lives-row" role="group" aria-label="Lives per player">
                        <span className="pf-lives-label">LIVES</span>
                        {[1, 2, 3, 4, 5].map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={`pf-lives-btn${count === lives ? ' on' : ''}`}
                            aria-pressed={count === lives}
                            disabled={busy}
                            onClick={() => {
                              livesPicked.current = true
                              setLives(count)
                            }}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="ds-begin-btn"
                      disabled={!isHost || busy}
                      onClick={() => void start()}
                    >
                      {isHost
                        ? snap.status === 'done'
                          ? '▶ PLAY ANOTHER ROUND ◀'
                          : '▶ START THE ROUND ◀'
                        : 'WAITING FOR THE HOST'}
                    </button>
                    {isHost && snap.status === 'lobby' && snap.players.length < (snap.cap ?? 6) && (
                      <button
                        type="button"
                        className="ds-dive-btn"
                        style={{ width: '100%', marginTop: 8 }}
                        disabled={busy}
                        onClick={() => void addBot()}
                      >
                        + ADD A BOT
                      </button>
                    )}
                    <div className="ds-intro-meta">
                      <span>{isHost ? 'anyone with the code can join' : 'the host starts the round'}</span>
                      <button type="button" className="pf-invite" onClick={leave}>
                        LEAVE TABLE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {snap.status === 'playing' && (
              <div
                className="ds-dock"
                ref={dockRef}
                data-turn={yourTurn ? 'you' : 'them'}
                data-reject={last?.kind === 'reject' && lastLive ? 'on' : undefined}
              >
                <div className="ds-dock-inner">
                  <span className="ds-input-col" style={{ paddingBottom: 12 }}>
                    <input
                      className="ds-input"
                      type="text"
                      maxLength={256}
                      autoComplete="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      placeholder={yourTurn ? 'type one answer…' : '…'}
                      aria-label="Your answer"
                      autoFocus={yourTurn}
                      disabled={!yourTurn}
                      value={typed}
                      onChange={(event) => {
                        const next = event.target.value.slice(0, 40)
                        // Autocorrect lands on the space: a misspelt word is rewritten
                        // to the card's spelling as the next word starts, whichever way
                        // the space arrived (key, paste, or a phone keyboard).
                        if (correction && !correction.repeat && correction.value !== correction.typed && next === `${typed} `) {
                          setTyped(`${correction.value} `)
                          return
                        }
                        setTyped(next)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void pass()
                      }}
                    />
                    <span
                      className="ds-fuse"
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: -9,
                        height: 6,
                        background: '#07101d',
                        borderRadius: 3,
                        boxShadow: '0 0 0 1px #16283f, 0 0 10px #4de3ff22',
                        overflow: 'hidden',
                      }}
                    >
                      <i
                        className="ds-fuse-fill"
                        style={{
                          display: 'block',
                          height: '100%',
                          width: '100%',
                          transformOrigin: '0 50%',
                          transform: `scaleX(${fusePct.toFixed(3)})`,
                          background: fusePct < 0.34 ? '#ff5d8f' : '#4de3ff',
                          boxShadow: fusePct < 0.34 ? '0 0 12px #ff5d8f' : '0 0 10px #4de3ff',
                          transition: 'transform .2s linear, background .3s linear',
                        }}
                      />
                    </span>
                  </span>
                  <button type="button" className="ds-dive-btn" disabled={!yourTurn || !typed.trim()} onClick={() => void pass()}>
                    SEND
                  </button>
                </div>
                {/* The dock's meta row is where the card's spell-check and its
                    refusal live: they belong under the input, on the same line
                    as the room code, not floating over somebody's seat. */}
                <div className="ds-intro-meta" style={{ maxWidth: 600, margin: '20px auto 0' }}>
                  {correction ? (
                    <>
                      <span style={{ textTransform: 'none' }}>
                        <span style={{ color: '#7d93b8' }}>{correction.typed}</span>
                        <span style={{ color: '#e8f1ff' }}> → </span>
                        <b style={{ color: correction.repeat ? '#ff9f43' : '#ffd166', textTransform: 'none' }}>
                          {correction.value}
                        </b>
                      </span>
                      <span
                        style={{
                          color: correction.repeat ? '#ff9f43' : '#4de3ff',
                          letterSpacing: '.12em',
                          textTransform: 'none',
                        }}
                      >
                        {correction.repeat ? 'already said — try another' : 'auto-correct'}
                      </span>
                    </>
                  ) : last?.kind === 'reject' && rejectLive ? (
                    <>
                      <span style={{ color: '#ff9f43', textTransform: 'none' }}>
                        “{last.answer}” is not on that card
                      </span>
                      <span style={{ color: '#7d93b8', textTransform: 'none' }}>try another</span>
                    </>
                  ) : (
                    <>
                      <span>
                        ROOM <b>{snap.code}</b>
                      </span>
                      <span>{me ? `${me.score ?? 0} PTS · ${me.hearts} ♥` : ''}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {snap.status === 'playing' && (
              <>
                {chatOpen && (
                  <aside
                    aria-label="Table chat"
                    className="font-pixel"
                    style={{
                      position: 'fixed',
                      right: 4,
                      top: 64,
                      bottom: 10,
                      zIndex: 46,
                      width: 300,
                      maxHeight: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'rgba(4,9,18,0.96)',
                      border: '1px solid #1b3050',
                      borderRadius: 6,
                      boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 9px',
                        fontSize: 13,
                        letterSpacing: 1.5,
                        color: '#4de3ff',
                        borderBottom: '1px solid #14243c',
                      }}
                    >
                      <span>TABLE CHAT</span>
                    </div>
                    <div
                      ref={chatList}
                      // A new line lands at the bottom of a scroller that only
                      // scrolls itself when someone drags it otherwise, so the
                      // reply the table just sent read as cut off.
                      style={{ padding: '7px 9px', overflowY: 'auto', flex: 1, fontSize: 14, lineHeight: 1.35, wordBreak: 'break-word' }}
                    >
                      {(snap.chat ?? []).length === 0 ? (
                        <p style={{ margin: 0, color: '#5d7396' }}>no chatter yet — say hi</p>
                      ) : (
                        (snap.chat ?? []).map((line) => (
                          <p key={line.id} style={{ margin: '0 0 5px', color: line.pid === snap.you ? '#ffe9a8' : '#cfe2f7', overflowWrap: 'anywhere' }}>
                            <b style={{ color: line.pid === snap.you ? '#ffd166' : '#4de3ff', fontWeight: 400 }}>{line.name}</b> {line.text}
                          </p>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        void sendChat()
                      }}
                      style={{ display: 'flex', gap: 5, padding: 7, borderTop: '1px solid #14243c' }}
                    >
                      <input
                        value={chatText}
                        maxLength={160}
                        onChange={(event) => setChatText(event.target.value.slice(0, 160))}
                        placeholder="no links, just talk"
                        aria-label="Chat message"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 14,
                          padding: '4px 6px',
                          color: '#eaf6ff',
                          background: '#081120',
                          border: '1px solid #1b3050',
                          borderRadius: 3,
                          outline: 'none',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!chatText.trim()}
                        style={{
                          fontSize: 13,
                          letterSpacing: 1,
                          padding: '4px 8px',
                          color: '#050a14',
                          background: '#ff5d8f',
                          border: 0,
                          borderRadius: 3,
                          cursor: chatText.trim() ? 'pointer' : 'not-allowed',
                          opacity: chatText.trim() ? 1 : 0.5,
                        }}
                      >
                        SEND
                      </button>
                    </form>
                    {chatError && <p style={{ margin: 0, padding: '0 9px 7px', fontSize: 12, color: '#ff7d9f' }}>{chatError}</p>}
                  </aside>
                )}
              </>
            )}

          </>
        )}

        {howTo && (
          <dialog className="pf-howto" open aria-labelledby="butter-howto">
            <div className="pf-panel">
              <h3 id="butter-howto">HOW TO PLAY</h3>
              <ol className="pf-rules">
                <li>Answer the question before the puffer explodes on you.</li>
                <li>Rarer answers get you closer to an extra heart.</li>
                <li>No reusing answers for the current question.</li>
              </ol>
              <button type="button" className="ds-begin-btn" style={{ width: '100%' }} onClick={() => setHowTo(false)}>
                GOT IT
              </button>
            </div>
          </dialog>
        )}

        {error && snap && <p className="pf-err">{error}</p>}
      </div>

      {/* The reef's other half. Without this the party is a dead end: the door
          has no way back to the dive, and a live round has no leave control. */}
      <ButterMenu className="pf-dive-link pf-dive-corner" />
    </div>
  )
}

/* --------------------------------------------------------------------- seat */

/** Where a seat's perch, body and head land. The seat draws itself from this,
 *  and the puffer aims at the same point, so the fish and the ring agree. */
function seatSpot(index: number, total: number, geo: Geometry) {
  const perch = PERCH[index % PERCH.length]
  const anchor = PERCH_ANCHOR[perch]
  const scale = PERCH_SCALE[perch]
  const point = seatPoint(index, total, geo)
  const sway = 0.8 + 0.2 * ((Math.sin(point.a) + 1) / 2)
  const perchWidth = geo.perch * scale
  // The perch art's height is its width times its own aspect; the seat lifts by
  // the height, which is why a 94px perch only rises ~28px, not 70.
  const perchHeight = perchWidth * PERCH_ASPECT[perch]
  // The shipped table seats the sprite ~0.68 of the way up its own perch: a ring
  // built on the full offset floats every plate a whole perch above the stone.
  const y = point.y - (1 - anchor) * perchHeight * sway * 0.68
  return { perch, anchor, scale, point, sway, perchWidth, perchHeight, y }
}

function Seat({
  player,
  index,
  total,
  geo,
  holding,
  status,
  winner,
  said,
  reject,
  tier,
  rise,
  mascot,
  target,
  maxLives,
}: {
  player: Player
  index: number
  total: number
  geo: Geometry
  holding: boolean
  status: 'lobby' | 'playing' | 'done'
  winner: boolean
  said?: string
  reject?: string
  tier?: string
  rise?: boolean
  mascot: { id: string; name: string; sprite: string; color: string }
  target: number
  maxLives: number
  /** Top of the dock in stage pixels, so a plate never draws under it. */
  dockTop?: number
}) {
  const { perch, anchor, point, sway, perchWidth, perchHeight, y } = seatSpot(index, total, geo)
  // The plate hangs below the perch. On the seat at the bottom of the ring that
  // can land inside the dock, so it rises over its perch instead of hiding the
  // name and the hearts behind the input.
  // The plate hangs off the perch's height, not its width — the same 0.68 lift
  // the seat itself uses, plus the eight pixels the shipped table leaves under
  // the stone. It is never pushed aside for the dock: the shipped lobby lets the
  // front plate sit on top of its start panel, and lifting it hid the name.
  const plateDrop = (1 - anchor) * perchHeight * sway * 0.68 + 8
  const plateTop = plateDrop
  const out = player.hearts <= 0
  const waiting = status === 'lobby'
  // The shipped table pops the heart that was just lost and springs in one
  // that was just earned; the beat is driven by the life count changing.
  const previousHearts = useRef(player.hearts)
  const [heartFx, setHeartFx] = useState<{ pop: number; gain: number } | null>(null)
  useEffect(() => {
    const before = previousHearts.current
    previousHearts.current = player.hearts
    if (before === player.hearts) return
    setHeartFx(
      before > player.hearts ? { pop: player.hearts, gain: -1 } : { pop: -1, gain: player.hearts - 1 },
    )
    const timer = window.setTimeout(() => setHeartFx(null), 1000)
    return () => window.clearTimeout(timer)
  }, [player.hearts])

  return (
    <div
      className={`pf-seat${holding ? ' hold' : ''}${out ? ' out' : ''}${winner ? ' win' : ''}${waiting ? ' waiting' : ''}${player.you ? ' me' : ''}${point.x < geo.cx - 8 ? ' face-l' : ''}`}
      style={{
        transform: `translate(${point.x.toFixed(1)}px, ${y.toFixed(1)}px)`,
        zIndex: 100 + Math.round(point.y),
        ['--pf-glow' as string]: `${mascot.color}59`,
        ['--pf-perch' as string]: `${perchWidth.toFixed(1)}px`,
        // The shipped renderer scales the whole body by depth: the back of the
        // ring is 80% and the front is full size, so the far seats read as far.
        ['--pf-spr' as string]: `${(geo.spr * sway).toFixed(1)}px`,
        // Where each sprite's feet sit, so the perch meets the belly, not the air.
        ['--pf-foot' as string]: String(MASCOT_FOOT[mascot.id] ?? 0.2),
        ['--pf-sink-y' as string]: `${((1 - anchor) * perchWidth * sway * 0.5 + 18).toFixed(0)}px`,
      }}
    >
      <div className="pf-seat-in">
        <div className="pf-body">
          <img className="pf-perch pf-smooth" src={`/gen/party/perch-${perch}.png`} alt="" style={{ top: -anchor * perchWidth }} />
          <div className="pf-spr-wrap">
            <img className="pf-spr" src={mascot.sprite} alt="" />
          </div>
          {(said || reject) && (
            <div
              className={`pf-say ds-chip ds-px on${holding ? ' ok' : ''}${reject ? ' bad ds-reject-shake' : ''}${player.you ? ' rest' : ''}`}
              // Hung off the sprite's own geometry: the head is one sprite height
              // above where its feet sit, so the chip clears the ears instead of
              // landing on the plate or halfway up the body.
              style={{
                ['--cc' as string]: reject ? '#ff9f43' : (TIER_COLOR[tier ?? 'schooler'] ?? '#4de3ff'),
                bottom: 'calc(var(--pf-foot, .2) * var(--pf-spr) + var(--pf-spr) + 6px)',
              }}
            >
              {reject ?? said}
            </div>
          )}
        </div>
        <span
          className={`pf-meter pf-seat-meter${(player.meter ?? 0) >= target ? ' full' : ''}`}
          // The sheet sets the meter itself at desktop widths (44x6 at 1100 and
          // up, 34x5 below), so only a phone narrows it to its perch.
          style={{
            top: (1 - anchor) * perchWidth * sway - 7,
            ...(typeof window !== 'undefined' && window.innerWidth >= 1100 ? null : { width: Math.round(perchWidth * 0.6) }),
          }}
          aria-hidden
        >
          {(player.meter ?? 0) >= target ? (
            <i style={{ width: '100%', background: TIER_COLOR.krillion }} />
          ) : (
            (player.segs ?? []).map((seg, index) => (
              <i
                key={index}
                style={{
                  width: `${Math.max(1, (Math.min(seg.amt, target) / target) * 100)}%`,
                  background: seg.tier ? TIER_COLOR[seg.tier] : '#22365a',
                }}
              />
            ))
          )}
        </span>

        <div className="pf-plate" style={{ top: plateTop }}>
          <b className="pf-name">{player.you ? `${player.name} · YOU` : player.name}</b>
          <div className="pf-row">
            <Hearts hearts={player.hearts} max={maxLives} pop={heartFx?.pop} gain={heartFx?.gain} />
            {typeof player.rating === 'number' && <span className="pf-elo">{player.rating}</span>}
          </div>
        </div>
        {rise && tier && (
          <div
            className="pf-rise"
            style={{
              left: Math.abs(point.x - geo.cx) < 30 ? 0 : point.x > geo.cx ? -40 : 40,
              bottom: Math.round((1 - anchor) * perchWidth * sway + perchWidth * 0.62 + 44),
              ['--tc' as string]: TIER_COLOR[tier] ?? '#ffd166',
            }}
          >
            <img src={`/tiers/${tier}.png`} alt="" />
            {TIER_LABEL[tier] ?? ''}
          </div>
        )}
      </div>
    </div>
  )
}
