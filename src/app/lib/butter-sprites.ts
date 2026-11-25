/**
 * The two shipped sprite controllers, and the character table they read.
 *
 * Transcribed from the captured bundle, not redesigned:
 *
 *   - `createGoldSpriteController`  — module `81801`
 *   - `createMascotSpriteController` — module `57410`
 *   - `MASCOT_CHARACTERS` / `getMascotCharacter` — module `86968`
 *   - `seasonalKrillSprite` / the season watcher — module `40806`
 *
 * all in `public/krillion-source/pretty/3itjc0tls3d-u.js`. The shipped clients
 * share one `ds-source-pending` dance for every picture that swaps in place: the
 * image is hidden, the new `src` is set, and it is only revealed once that exact
 * source has decoded — guarded by a generation counter, so a picture that
 * arrives after another swap is dropped instead of flashing the wrong sprite.
 *
 * The mascot has no spritesheet: it is one `<img>` animated by CSS, and the
 * shipped controller's real work is the gold swap plus the `ds-fx` layers it
 * dresses around the image when a character carries `pokeFx`.
 */

export type MascotState =
  | 'celebrate'
  | 'faint'
  | 'sad'
  | 'roll'
  | 'dart'
  | 'jet'
  | 'chomp'
  | 'punch'

/** Every state the sprite's class list can carry, as the shipped list reads. */
const STATES: MascotState[] = ['celebrate', 'faint', 'sad', 'roll', 'dart', 'jet', 'chomp', 'punch']
/** The two states that also re-fire their fx layers. */
const FX_STATES: MascotState[] = ['roll', 'punch']

const SOURCE_PENDING = 'ds-source-pending'

function decoded(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0
}

/**
 * The shipped `wait for this image` helper: load and error listeners plus a
 * `decode()` attempt, firing once, with a cancel that settles as a failure.
 */
function whenSettled(img: HTMLImageElement, done: (ok: boolean) => void): () => void {
  let settled = false
  const finish = (ok: boolean) => {
    if (settled) return
    settled = true
    img.removeEventListener('load', onLoad)
    img.removeEventListener('error', onError)
    done(ok)
  }
  const onLoad = () => finish(true)
  const onError = () => finish(false)
  if (decoded(img)) {
    finish(true)
    return () => {}
  }
  img.addEventListener('load', onLoad)
  img.addEventListener('error', onError)
  if (typeof img.decode === 'function') {
    try {
      void img.decode().then(
        () => finish(decoded(img)),
        () => {
          if (img.complete) finish(decoded(img))
        },
      )
    } catch {
      /* no decoder: the listeners above still fire */
    }
  }
  return () => finish(false)
}

/* ------------------------------------------------------- gold car / writer -- */

export type GoldSprite = {
  /** Swap to the plain or the gold picture, hiding it until it has decoded. */
  setGold(gold: boolean): void
  /** Point the same element at a different pair of pictures. */
  setSources(sprite: string, gold: string): void
  destroy(): void
}

/**
 * The shipped gold swap, used by the movies' buddy car and the lexicon's
 * writer: an `<img>` whose `src` flips between two files, hidden behind
 * `.ds-source-pending` while the gold file decodes.
 */
export function createGoldSpriteController(
  el: HTMLImageElement,
  spriteSrc: string,
  goldSrc: string,
): GoldSprite {
  let sprite = spriteSrc
  let gold = goldSrc
  let generation = 0
  let wantsGold = false
  let applied = false
  let cancel: (() => void) | null = null
  let destroyed = false

  el.classList.add(SOURCE_PENDING)
  const probe = el.ownerDocument.createElement('img')
  probe.decoding = 'async'
  const preload = () => {
    probe.src = gold
    if (typeof probe.decode === 'function') {
      try {
        void probe.decode().catch(() => {})
      } catch {
        /* a decode that cannot start is only a warm-up that did not happen */
      }
    }
  }

  const setGold = (next: boolean) => {
    if (destroyed) return
    generation += 1
    wantsGold = next
    applied = true
    cancel?.()
    cancel = null
    const target = next ? gold : sprite
    if (el.getAttribute('src') !== target) el.setAttribute('src', target)
    // The shipped short-circuit: the plain picture is never hidden, and a gold
    // one that is already in hand is revealed straight away.
    if (!next) {
      el.classList.remove(SOURCE_PENDING)
      return
    }
    el.classList.add(SOURCE_PENDING)
    if (decoded(el)) {
      el.classList.remove(SOURCE_PENDING)
      return
    }
    const mine = generation
    cancel = whenSettled(el, (ok) => {
      cancel = null
      if (ok && !destroyed && wantsGold && generation === mine && el.getAttribute('src') === gold) {
        el.classList.remove(SOURCE_PENDING)
      }
    })
  }

  preload()

  return {
    setGold,
    setSources(next, nextGold) {
      if (destroyed || (next === sprite && nextGold === gold)) return
      sprite = next
      gold = nextGold
      preload()
      if (applied) setGold(wantsGold)
    },
    destroy() {
      destroyed = true
      generation += 1
      cancel?.()
      cancel = null
      probe.removeAttribute('src')
    },
  }
}

/* ------------------------------------------------------------ the season -- */

const HALLOWEEN_START = Date.parse('2026-10-16T00:00:00-04:00')
const HALLOWEEN_END = Date.parse('2026-11-01T00:00:00-04:00')

/** The only seasonal pair the shipped client ships. */
const SEASONAL: [string, string][] = [
  ['/tiers/krillion.png', '/tiers/krillion-halloween-2026.png'],
  ['/tiers/krillion-gold.png', '/tiers/krillion-halloween-2026-gold.png'],
]

export function isHalloweenKrill(now: number = Date.now()): boolean {
  return now >= HALLOWEEN_START && now < HALLOWEEN_END
}

function seasonalSwap(src: string, halloween: boolean): string {
  const pair = SEASONAL.find(([plain, festive]) => src === plain || src === festive)
  return pair ? pair[halloween ? 1 : 0] : src
}

/** The krill's picture for the season, the way `getMascotCharacter` applies it. */
export function seasonalKrillSprite(src: string, now: number = Date.now()): string {
  return seasonalSwap(src, isHalloweenKrill(now))
}

/**
 * Re-check the calendar while the page is open, and whenever it is looked at
 * again — a dive left open over midnight on the 31st still swaps.
 */
export function watchKrillSeason(onChange: () => void): () => void {
  let timer = 0
  let wasHalloween = isHalloweenKrill()
  const check = () => {
    window.clearTimeout(timer)
    const now = Date.now()
    const halloween = isHalloweenKrill(now)
    if (halloween !== wasHalloween) {
      wasHalloween = halloween
      onChange()
    }
    const boundary = now < HALLOWEEN_START ? HALLOWEEN_START : HALLOWEEN_END
    if (now < boundary) timer = window.setTimeout(check, Math.min(boundary - now, 0x7fffffff))
  }
  check()
  document.addEventListener('visibilitychange', check)
  window.addEventListener('pageshow', check)
  window.addEventListener('focus', check)
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('pageshow', check)
    window.removeEventListener('focus', check)
  }
}

/* -------------------------------------------------------- the characters -- */

/** The aura art a `pokeFx` character dresses around its sprite. */
export type MascotFx = { id: string; aura: string; goldAura: string; sheen?: string }

export type MascotCharacter = {
  id: string
  name: string
  alt: string
  sprite: string
  goldSprite: string
  color: string
  blub: string
  poke: MascotState
  pokeMs: number
  unlockStreak: number
  pokeFx?: MascotFx
}

export const DEFAULT_CHARACTER_ID = 'krill'

/**
 * The shipped character table. Every sprite and every aura it names is in
 * `public/krillion/`. Which one is *selected* is a server feature — the streak
 * unlocks behind `/api/account/progress`, which Ink's server does not ship — so
 * the default krill is the one this build wears.
 */
export const MASCOT_CHARACTERS: MascotCharacter[] = [
  {
    id: 'krill',
    name: 'The Krill',
    alt: 'krill',
    sprite: '/tiers/krillion.png',
    goldSprite: '/tiers/krillion-gold.png',
    color: '#ff5d8f',
    blub: 'blub!',
    poke: 'roll',
    pokeMs: 950,
    unlockStreak: 0,
  },
  {
    id: 'schooler',
    name: 'Schooler',
    alt: 'schooler fish',
    sprite: '/tiers/schooler.png',
    goldSprite: '/tiers/schooler-gold.png',
    color: '#4de3ff',
    blub: 'glub!',
    poke: 'dart',
    pokeMs: 900,
    unlockStreak: 5,
  },
  {
    id: 'rare',
    name: 'Rare Squid',
    alt: 'rare squid',
    sprite: '/tiers/rare.png',
    goldSprite: '/tiers/rare-gold.png',
    color: '#ff5252',
    blub: 'blorp!',
    poke: 'jet',
    pokeMs: 1050,
    unlockStreak: 14,
  },
  {
    id: 'deepcut',
    name: 'Deep Cut Angler',
    alt: 'deep cut angler',
    sprite: '/tiers/deepcut.png',
    goldSprite: '/tiers/deepcut-gold.png',
    color: '#9d7bff',
    blub: 'chomp!',
    poke: 'chomp',
    pokeMs: 950,
    unlockStreak: 30,
  },
  {
    id: 'evil-krill',
    name: 'Evil Krill',
    alt: 'evil krill with a white body and a red eye',
    sprite: '/tiers/evil-krill-white-v2.png',
    goldSprite: '/tiers/evil-krill-gold-v2.png',
    color: '#ff303b',
    blub: 'mwahaha!',
    poke: 'roll',
    pokeMs: 950,
    unlockStreak: 45,
  },
  {
    id: 'hackmanite',
    name: 'Hackmanite',
    alt: 'luminous white mineral krill with faceted stone armor',
    sprite: '/tiers/hackmanite-v2.png',
    goldSprite: '/tiers/hackmanite-gold-v2.png',
    color: '#dfefee',
    blub: 'glimmer!',
    poke: 'roll',
    pokeMs: 950,
    unlockStreak: 60,
    pokeFx: {
      id: 'glimmer',
      aura: '/buddy-fx/hackmanite-aura.webp',
      goldAura: '/buddy-fx/hackmanite-gold-aura.webp',
    },
  },
  {
    id: 'fossil-krill',
    name: 'Fossil Krill',
    alt: 'fossil krill made of floating reassembled bones',
    sprite: '/tiers/fossil-krill.png',
    goldSprite: '/tiers/fossil-krill-gold.png',
    color: '#e8cfa4',
    blub: 'rattle!',
    poke: 'roll',
    pokeMs: 950,
    unlockStreak: 75,
    pokeFx: {
      id: 'haunt',
      aura: '/buddy-fx/fossil-aura.webp',
      goldAura: '/buddy-fx/fossil-gold-aura.webp',
    },
  },
  {
    id: 'leviathan',
    name: 'Leviathan',
    alt: 'teal leviathan krill with a luminous green eye',
    sprite: '/tiers/leviathan.png',
    goldSprite: '/tiers/leviathan-gold.png',
    color: '#b4f542',
    blub: 'grrrblub!',
    poke: 'roll',
    pokeMs: 950,
    unlockStreak: 150,
    pokeFx: {
      id: 'maelstrom',
      aura: '/buddy-fx/leviathan-aura.webp',
      goldAura: '/buddy-fx/leviathan-gold-aura.webp',
    },
  },
]

/** The character for an id, with the season's picture already swapped in. */
export function getMascotCharacter(id: string, now: number = Date.now()): MascotCharacter {
  const base = MASCOT_CHARACTERS.find((character) => character.id === id) ?? MASCOT_CHARACTERS[0]
  const sprite = seasonalKrillSprite(base.sprite, now)
  const goldSprite = seasonalKrillSprite(base.goldSprite, now)
  return sprite === base.sprite && goldSprite === base.goldSprite ? base : { ...base, sprite, goldSprite }
}

export function isMascotCharacterId(id: string): boolean {
  return MASCOT_CHARACTERS.some((character) => character.id === id)
}

/** A character is unlocked once the streak clears its own threshold. */
export function isMascotUnlocked(character: MascotCharacter, streak: number): boolean {
  return character.unlockStreak === 0 || streak >= character.unlockStreak
}

/* ------------------------------------------------------------- the fx DOM -- */

/**
 * The aura, sheen, glow and glints the shipped controller bolts around the
 * sprite, and the observer that keeps their state classes in step with the
 * image's. Mirrors the shipped `dress`/`destroy` pair, including the 1400 ms
 * `data-fx-play` retrigger.
 */
function dressFx(img: HTMLImageElement) {
  const host = img.parentElement
  if (!host || typeof MutationObserver === 'undefined') {
    return { dress: (_character: MascotCharacter, _gold: boolean) => {}, destroy: () => {} }
  }
  const doc = img.ownerDocument
  type Layers = { back: HTMLElement; front: HTMLElement; aura: HTMLImageElement; sheen: HTMLImageElement }
  let layers: Layers | null = null
  let playTimer = 0

  const twin = (kind: string) => {
    const node = doc.createElement('img')
    node.className = `ds-fx-twin ds-fx-${kind}`
    node.alt = ''
    node.decoding = 'async'
    node.draggable = false
    node.setAttribute('aria-hidden', 'true')
    return node
  }
  const layer = (kind: string, children: string[]) => {
    const node = doc.createElement('span')
    node.className = `ds-fx ds-fx-${kind}`
    node.setAttribute('aria-hidden', 'true')
    for (const child of children) {
      const glint = doc.createElement('i')
      glint.className = child
      node.appendChild(glint)
    }
    return node
  }
  /** The animation states currently on the sprite, in the shipped order. */
  const states = (): MascotState[] => {
    const classes = img.className.split(/\s+/)
    return STATES.filter((state) => classes.includes(state))
  }
  const mirror = (replay: boolean) => {
    if (!layers) return
    const active = states()
    for (const node of [layers.aura, layers.sheen]) {
      node.classList.remove(...STATES)
      // A replayed animation only restarts if the element is laid out again.
      if (replay) void node.offsetWidth
      node.classList.add(...active)
    }
    if (replay && active.some((state) => FX_STATES.includes(state))) {
      host.removeAttribute('data-fx-play')
      void host.offsetWidth
      host.setAttribute('data-fx-play', '')
      window.clearTimeout(playTimer)
      playTimer = window.setTimeout(() => host.removeAttribute('data-fx-play'), 1400)
    }
  }

  const observer = new MutationObserver((records) => {
    const before = states().join(' ')
    const changed = records.some((record) => {
      const old = (record.oldValue ?? '').split(/\s+/)
      return STATES.filter((state) => old.includes(state)).join(' ') !== before
    })
    if (changed) mirror(true)
  })
  observer.observe(img, { attributes: true, attributeFilter: ['class'], attributeOldValue: true })

  return {
    dress(character: MascotCharacter, gold: boolean) {
      const fx = character.pokeFx
      if (!fx) {
        host.removeAttribute('data-fx')
        host.removeAttribute('data-fx-gold')
        host.removeAttribute('data-fx-play')
        return
      }
      if (!layers) {
        const back = layer('back', ['ds-fx-a'])
        const front = layer('front', Array.from({ length: 3 }, () => 'ds-fx-glint'))
        const aura = twin('aura')
        const sheen = twin('sheen')
        host.insertBefore(back, img)
        // The shipped `img.after(aura, sheen, front)`, written as inserts before
        // the sprite's old next sibling so each layer keeps that order.
        const next = img.nextSibling
        host.insertBefore(front, next)
        host.insertBefore(sheen, next)
        host.insertBefore(aura, next)
        layers = { back, front, aura, sheen }
      }
      host.setAttribute('data-fx', fx.id)
      host.toggleAttribute('data-fx-gold', gold)
      const aura = gold ? fx.goldAura : fx.aura
      if (layers.aura.getAttribute('src') !== aura) layers.aura.setAttribute('src', aura)
      if (fx.sheen) {
        if (layers.sheen.getAttribute('src') !== fx.sheen) layers.sheen.setAttribute('src', fx.sheen)
      } else {
        layers.sheen.removeAttribute('src')
      }
      mirror(false)
    },
    destroy() {
      observer.disconnect()
      window.clearTimeout(playTimer)
      if (layers) for (const node of Object.values(layers)) node.remove()
      layers = null
      host.removeAttribute('data-fx')
      host.removeAttribute('data-fx-gold')
      host.removeAttribute('data-fx-play')
    },
  }
}

/* --------------------------------------------------------- the mascot ------ */

export type MascotSprite = {
  setGold(gold: boolean): void
  setSources(sprite: string, gold: string): void
  current(): MascotCharacter
  preview(id: string | null, gold?: boolean): void
  destroy(): void
}

/**
 * The shipped mascot controller. `select` is the shipped preference read
 * (`getSelectedCharacter`); Butter has no character picker to store a choice, so
 * it defaults to the krill, which is also what the shipped client shows before
 * any streak is earned.
 */
export function createMascotSpriteController(
  img: HTMLImageElement,
  onChange?: (character: MascotCharacter) => void,
  select: () => string = () => DEFAULT_CHARACTER_ID,
): MascotSprite {
  let selected = select()
  let character = getMascotCharacter(selected)
  let previewId: string | null = null
  let previewGold: boolean | undefined
  let ownGold = false
  const sprites = createGoldSpriteController(img, character.sprite, character.goldSprite)
  const fx = dressFx(img)
  const gilded = () => (previewId === null ? ownGold : Boolean(previewGold))
  const dress = () => fx.dress(character, gilded())

  img.alt = character.alt
  onChange?.(character)
  dress()

  const refresh = () => {
    const id = previewId ?? select()
    const next = getMascotCharacter(id)
    if (id === selected && next.sprite === character.sprite && next.goldSprite === character.goldSprite) return
    selected = id
    character = next
    img.alt = character.alt
    sprites.setSources(character.sprite, character.goldSprite)
    onChange?.(character)
    dress()
  }
  const offSeason = watchKrillSeason(refresh)

  return {
    setGold(gold) {
      ownGold = gold
      sprites.setGold(gilded())
      dress()
    },
    setSources: sprites.setSources,
    current: () => character,
    preview(id, gold) {
      previewId = id
      previewGold = id === null ? undefined : gold
      refresh()
      sprites.setGold(gilded())
      dress()
    },
    destroy() {
      offSeason()
      fx.destroy()
      sprites.destroy()
    },
  }
}

/** The states a landing can put on the sprite — the class list already has them. */
export function playMascotState(img: HTMLImageElement, state: MascotState, ms: number): void {
  img.classList.remove(...STATES)
  void img.offsetWidth
  img.classList.add(state)
  window.setTimeout(() => img.classList.remove(state), ms)
}
