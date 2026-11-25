/**
 * The shipped pack table, ported from the game's own `CLIENT_PACKS`.
 *
 * Every string here — the name, the tagline, the button words, the reject line,
 * the band verdicts — is copied from the bundle, not written. Each pack is the
 * same seven-round dive wearing a different world: the copy changes the noun
 * (a "picture", a "game", an "expedition", a "chapter"), the unit its answers
 * travel in, and the accent colour the whole screen is lit with.
 */

export type TierId = 'plankton' | 'tooclever' | 'schooler' | 'rare' | 'deepcut' | 'krillion'

export type ButterPack = {
  id: 'classic' | 'movies' | 'sports' | 'geography' | 'lexicon'
  /** The menu/route slug: `/butter/<slug>`. */
  slug: string
  name: string
  tagline: string
  subline: string
  /** The world attribute the stylesheet themes against. */
  world: 'cinema' | 'gauntlet' | 'globe' | 'notebook' | 'ocean'
  accent: string
  panel: string
  ring: string
  art: string
  /** A piece of scene art drawn behind the title screen. */
  scene?: string
  hubOpen?: string
  hubTagline: string
  hubCta: string
  badge: string
  diveLabel: string
  /** What each pack calls its seven rounds on the card. */
  promptWord: string
  ui: {
    boot: string
    begin: string
    submit: string
    next: string
    surface: string
    previewPrefix: string
    reject: (answer: string) => string
    /** The distance a score of `n` reaches, in the pack's own unit. */
    dist: (score: number) => string
    doneHeadline: (game: number) => string
    catchLabel: string
    bearingLabel: string
    gaugeTitle: string
    gaugeSub: string
  }
  hint: string
  /** The five verdicts a finished run can land in, keyed by its floor. */
  bands: { min: number; verdict: string }[]
  blurb: { schooler: string; krillion: string }
  /** What a typed answer that is not on the card is called. */
  missTyped: string
  pickerLabel: string
  pickerGo: string
  replayNote: (game: number, dist: string) => string
  /** Where the intro's two chips go. */
  introLinks: { to: string; label: string }[]
}

export const TIERS: Record<TierId, { name: string; score: number; color: string; blurb: string }> = {
  plankton: { name: 'Margarine', score: 10, color: '#8fa3c4', blurb: 'Not even butter.' },
  tooclever: { name: 'Whipped', score: 15, color: '#ff9f43', blurb: 'Puffed up. Mostly air.' },
  schooler: { name: 'Salted', score: 30, color: '#4de3ff', blurb: 'The standard block. Solid.' },
  rare: { name: 'Cultured', score: 60, color: '#ff5252', blurb: 'Tangier. Takes work to find.' },
  deepcut: { name: 'Brown Butter', score: 85, color: '#9d7bff', blurb: 'Nutty, dark, and hard-won.' },
  krillion: {
    name: 'One in a Butter Churn',
    score: 100,
    color: '#ffd166',
    blurb: 'The designated gem. Churn floor.',
  },
}

export const ROUNDS = 7
export const MAX_SCORE = ROUNDS * 100

const blocks = (score: number) => {
  const value = score / 10
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${text} block${value === 1 ? '' : 's'}`
}

export const PACKS: ButterPack[] = [
  {
    id: 'classic',
    slug: 'endless',
    name: 'THE ENDLESS DIVE',
    tagline: 'THE ENDLESS DIVE',
    subline: 'dive after dive · rarer answers sink deeper',
    world: 'ocean',
    accent: '#4de3ff',
    panel: '#101d33',
    ring: '#123048',
    art: '/krillion/gen/optimized/v1/cards/classic.webp',
    hubOpen: 'OPEN WATERS',
    hubTagline: 'every prompt, every depth · the original ∞',
    hubCta: 'DESCEND ∞ ↓',
    badge: '∞',
    diveLabel: 'endless dive',
    promptWord: 'PROMPT',
    ui: {
      boot: 'descending…',
      begin: '▼ BEGIN DESCENT ▼',
      submit: 'DIVE',
      next: 'NEXT DIVE ∞ ↓',
      surface: 'SURFACE ▲',
      previewPrefix: 'descending · the clock starts in',
      reject: (answer) => `“${answer}”: no echo. try again`,
      dist: (score) => `-${(10 * score).toLocaleString('en-US')}m`,
      doneHeadline: (game) => `∞ Dive #${game} complete`,
      catchLabel: 'the catch',
      bearingLabel: 'the bearing',
      gaugeTitle: 'dive log',
      gaugeSub: 'deeper = rarer',
    },
    hint: '▼ rarer answers sink deeper ▼',
    bands: [
      { min: 0, verdict: 'Never left the harbor. The world stayed still.' },
      { min: 151, verdict: 'A stamped passport and a sunburn. Respectable.' },
      { min: 251, verdict: 'Three continents under your feet. The compass trusts you now.' },
      { min: 351, verdict: 'The horizon keeps giving way. Home is closer ahead than behind.' },
      { min: 450, verdict: 'One in a krillion. Around the world in seven answers.' },
    ],
    blurb: { schooler: 'Solid — the waters hold.', krillion: 'The designated gem. The trench floor.' },
    missTyped: 'no echo on this card.',
    pickerLabel: 'choose a different dive',
    pickerGo: 'Dive it',
    replayNote: (game, dist) => `you surfaced #${game} at ${dist} · diving again replays it`,
    introLinks: [
      { to: '/butter/archive', label: 'ARCHIVE ⟲' },
      { to: '/butter', label: "TODAY'S DIVE" },
    ],
  },
  {
    id: 'movies',
    slug: 'movies',
    name: 'AT THE MOVIES',
    tagline: 'AT THE MOVIES',
    subline: '30 pictures · rarer answers drive farther',
    world: 'cinema',
    accent: '#ffd166',
    panel: '#1a0d24',
    ring: '#3a2050',
    art: '/krillion/gen/optimized/v1/cards/movies.webp',
    scene: '/krillion/gen/optimized/v1/hollywood/bg-mid-neon.webp',
    hubOpen: 'NOW SHOWING',
    hubTagline: '30 pictures · a night drive down the boulevard',
    hubCta: 'TAKE THE DRIVE →',
    badge: '🎬',
    diveLabel: 'picture',
    promptWord: 'SCENE',
    ui: {
      boot: 'warming up the projector…',
      begin: '► START THE DRIVE ►',
      submit: 'ACTION',
      next: 'NEXT PICTURE →',
      surface: 'ROLL CREDITS',
      previewPrefix: 'quiet on set · rolling in',
      reject: (answer) => `“${answer}”: cut — not in this picture. try again`,
      dist: blocks,
      doneHeadline: (game) => `Picture #${game} — that's a wrap`,
      catchLabel: 'the final cut',
      bearingLabel: 'the billing',
      gaugeTitle: 'the route',
      gaugeSub: 'farther = rarer',
    },
    hint: '▶ rarer answers drive farther ▶',
    bands: [
      { min: 0, verdict: 'Straight to video. The boulevard is still long.' },
      { min: 151, verdict: 'A solid matinee. The crowd nods along.' },
      { min: 251, verdict: 'Festival darling. Critics take notes.' },
      { min: 351, verdict: 'Cult classic. Midnight screenings forever.' },
      { min: 450, verdict: 'One in a krillion. Your star is on the boulevard.' },
    ],
    blurb: { schooler: 'Solid — steady box office.', krillion: 'The designated gem. End of the boulevard.' },
    missTyped: 'left on the cutting-room floor.',
    pickerLabel: 'choose a different picture',
    pickerGo: 'Screen it',
    replayNote: (game, dist) => `you wrapped #${game} with ${dist} · driving again replays it`,
    introLinks: [
      { to: '/butter/packs', label: 'THEMED PACKS' },
      { to: '/butter', label: 'THE DAILY DIVE' },
    ],
  },
  {
    id: 'sports',
    slug: 'sports',
    name: 'SPORTS',
    tagline: 'THE DEEP BENCH',
    subline: '30 games · rarer answers run farther',
    world: 'gauntlet',
    accent: '#ffb000',
    panel: '#0d1420',
    ring: '#223048',
    art: '/krillion/gen/optimized/v1/cards/sports.webp',
    scene: '/krillion/gen/optimized/v1/gauntlet/bowl-far.webp',
    hubOpen: 'GAME ON',
    hubTagline: '30 games · run the gauntlet, court to podium',
    hubCta: 'TAKE THE TUNNEL ↓',
    badge: '🏆',
    diveLabel: 'game',
    promptWord: 'ROUND',
    ui: {
      boot: 'cutting the stadium lights…',
      begin: '► TAKE THE TUNNEL ►',
      submit: 'SHOOT',
      next: 'NEXT GAME →',
      surface: 'FINAL WHISTLE',
      previewPrefix: 'warming up · tip-off in',
      reject: (answer) => `“${answer}”: waved off. try again`,
      dist: (score) => `${score} yards`,
      doneHeadline: (game) => `Game #${game} — full time`,
      catchLabel: 'the box score',
      bearingLabel: 'the scouting report',
      gaugeTitle: 'the depth chart',
      gaugeSub: 'farther = rarer',
    },
    hint: '▶ rarer answers run farther ▶',
    bands: [
      { min: 0, verdict: 'Sent down to the practice squad. Run it back.' },
      { min: 151, verdict: 'Solid starter. The tape holds up.' },
      { min: 251, verdict: 'All-conference. Past midfield and pulling away.' },
      { min: 351, verdict: 'Hall of Fame ballot. The jumbotron knows your name.' },
      { min: 450, verdict: 'One in a krillion. Top of the podium.' },
    ],
    blurb: { schooler: 'Solid — makes the highlight reel.', krillion: 'The designated gem. Raised at the podium.' },
    missTyped: 'cut at training camp.',
    pickerLabel: 'choose a different game',
    pickerGo: 'Play it',
    replayNote: (game, dist) => `you closed #${game} at ${dist} · playing again replays it`,
    introLinks: [
      { to: '/butter/packs', label: 'THEMED PACKS' },
      { to: '/butter', label: 'THE DAILY DIVE' },
    ],
  },
  {
    id: 'geography',
    slug: 'geography',
    name: 'GEOGRAPHY',
    tagline: 'GEOGRAPHY',
    subline: 'around the world in seven answers',
    world: 'globe',
    accent: '#ff6b3d',
    panel: '#21120d',
    ring: '#48291f',
    art: '/krillion/gen/optimized/v1/cards/geography.webp',
    scene: '/krillion/gen/optimized/v1/atlas/scene-savanna.webp',
    hubOpen: 'PASSPORT READY',
    hubTagline: '30 expeditions · around the world in seven answers',
    hubCta: 'SET OUT →',
    badge: '🧭',
    diveLabel: 'expedition',
    promptWord: 'LEG',
    ui: {
      boot: 'spinning up the world…',
      begin: '► SET OUT ►',
      submit: 'TREK',
      next: 'NEXT EXPEDITION →',
      surface: 'STRIKE CAMP',
      previewPrefix: 'checking the compass · departure in',
      reject: (answer) => `“${answer}”: not on this map. try again`,
      dist: (score) => `${score} league${score === 1 ? '' : 's'}`,
      doneHeadline: (game) => `Expedition #${game} — home again`,
      catchLabel: 'the field notes',
      bearingLabel: "the traveler's log",
      gaugeTitle: 'the circumnavigation',
      gaugeSub: 'farther = rarer',
    },
    hint: '▶ rarer answers carry you farther round ▶',
    bands: [
      { min: 0, verdict: 'Never left the harbor. The world stayed still.' },
      { min: 151, verdict: 'A stamped passport and a sunburn. Respectable.' },
      { min: 251, verdict: 'Three continents under your feet. The compass trusts you now.' },
      { min: 351, verdict: 'The horizon keeps giving way. Home is closer ahead than behind.' },
      { min: 450, verdict: 'One in a krillion. Around the world in seven answers.' },
    ],
    blurb: { schooler: 'Solid — the route holds.', krillion: 'The designated gem. The world turns for you.' },
    missTyped: 'left off the itinerary.',
    pickerLabel: 'choose a different expedition',
    pickerGo: 'Set out',
    replayNote: (game, dist) => `you logged #${game} at ${dist} · trekking again replays it`,
    introLinks: [
      { to: '/butter/packs', label: 'THEMED PACKS' },
      { to: '/butter', label: 'THE DAILY DIVE' },
    ],
  },
  {
    id: 'lexicon',
    slug: 'lexicon',
    name: 'Words & Language (English)',
    tagline: 'THE LEXICON',
    subline: '30 chapters · rarer answers write more words',
    world: 'notebook',
    accent: '#7d9cff',
    panel: '#101426',
    ring: '#26305c',
    art: '/krillion/gen/optimized/v1/cards/lexicon.webp',
    scene: '/krillion/gen/optimized/v1/lexicon/desk-landscape.webp',
    hubOpen: 'FREE FOR NOW',
    hubTagline: '30 chapters · fill the notebook, word by word',
    hubCta: 'OPEN THE NOTEBOOK →',
    badge: '✒️',
    diveLabel: 'chapter',
    promptWord: 'ENTRY',
    ui: {
      boot: 'uncapping the pen…',
      begin: '► OPEN THE NOTEBOOK ►',
      submit: 'WRITE',
      next: 'NEXT CHAPTER →',
      surface: 'CLOSE THE BOOK',
      previewPrefix: 'dipping the pen · ink flows in',
      reject: (answer) => `“${answer}”: not in the lexicon. try again`,
      dist: (score) => `${score} word${score === 1 ? '' : 's'}`,
      doneHeadline: (game) => `Chapter #${game} — the ink is dry`,
      catchLabel: 'the glossary',
      bearingLabel: 'the marginalia',
      gaugeTitle: 'the manuscript',
      gaugeSub: 'fuller = rarer',
    },
    hint: '▶ rarer answers write more words ▶',
    bands: [
      { min: 0, verdict: 'A doodle in the margin. The page waits.' },
      { min: 151, verdict: 'A tidy paragraph. The nib is warming up.' },
      { min: 251, verdict: 'Pages turn on their own now. The inkwell worries.' },
      { min: 351, verdict: 'Half the notebook in one sitting. Ink-stained fingers.' },
      { min: 450, verdict: 'One in a krillion. Bound, shelved, quoted.' },
    ],
    blurb: { schooler: 'Solid — earns its line.', krillion: 'The designated gem. Written in gold.' },
    missTyped: 'left out of the lexicon.',
    pickerLabel: 'choose a different chapter',
    pickerGo: 'Open it',
    replayNote: (game, dist) => `you inked #${game} at ${dist} · writing again replays it`,
    introLinks: [
      { to: '/butter/packs', label: 'THEMED PACKS' },
      { to: '/butter', label: 'THE DAILY DIVE' },
    ],
  },
]

export function packOf(id: string): ButterPack {
  return PACKS.find((pack) => pack.id === id) ?? PACKS[0]
}

export function bandFor(pack: ButterPack, score: number) {
  let found = pack.bands[0]
  for (const band of pack.bands) if (score >= band.min) found = band
  return found
}
