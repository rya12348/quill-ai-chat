import { Hono, type Context } from 'hono'

import { answerTier, closestAnswer, flatAnswer, nextTopic, parseSegs, sameAnswer, type ButterTier, type MeterSeg, type ButterTopic } from '../butter-topics'
import { SIMSBURY_CARDS } from '../butter-simsbury'
import { cachedCard, fullCard } from '../butter-cards-full'
import { requireDb } from '../db'
import type { AppContext } from '../env'

/**
 * Puffer Party rooms (Ink's take on Krillion's category game).
 *
 * Turn-based, so the state lives in D1 and clients poll it: no Durable Object, no
 * WebSocket, nothing that the Pages deployer cannot host. The puffer's fuse is a
 * wall-clock deadline stored on the room, and every request settles it first, so
 * two players polling at once always agree on who the puffer popped on.
 *
 * Rules mirrored from the real table: two lives, a 10–30 second fuse, and a
 * rarity meter worth 600 points that pays out a spare life when it fills.
 */

export const butter = new Hono<AppContext>()

// This router is mounted outside the authenticated /api sub-app (the game is
// open to any Ink visitor), so it has to set up the database handle itself.
butter.use('*', requireDb)

/** The arcade's hard ceiling; a table's own cap still comes from its size. */
const MAX_PLAYERS = 16
const MIN_PLAYERS = 2
/** A public table's size is a seat cap, not just a label on the door. */
const TABLE_CAP: Record<string, number> = { duel: 2, trio: 3, party: 6, crowd: 10 }
function capFor(size: string | undefined): number {
  return TABLE_CAP[size ?? ''] ?? MAX_PLAYERS
}
/** A full rarity meter pays out a spare heart. */
const METER_FULL = 600
const LIVES = 2
const MAX_LIVES = 5
const METER_STEP = 50
const MAX_METER_TARGET = 5000
const FUSE_MS = 30_000
const MIN_FUSE_MS = 10_000
/** The shipped settings: every turn's fuse is random in this window, not a
 *  shrinking clock. Krillion's client carries `fuseMinMs: 10_000` and
 *  `fuseMaxMs: 30_000`, and its own bot script describes the result as "the
 *  fuse (10-30s, random, shared across the table)". A fuse that shrank every
 *  turn made the late game a formality; a random one keeps every pass tense. */
const POP_FREEZE_MS = 1_500
const FUSE_FLOOR_MS = 8_000
/** A phone in a pocket throttles its timers to about one tick a minute, so a
 *  seated player who switches tabs is not absent — the fuse is what punishes
 *  them. Only a lobby seat, which nobody is playing from, is ever reclaimed. */
const IDLE_KICK_MS = 180_000
/** A listed table is only joinable while its host is still sitting at it. */
const HOST_FRESH_MS = 90_000
/** A pass that leaves less than eight seconds puts eight back on the clock. */
/** The real door counts the table in before the first fuse is lit. */
const COUNTDOWN_MS = 3_000
const FEED_KEEP = 18
const CHAT_KEEP = 40

/** The table's chat has no links in it, and nothing longer than a breath. */
function cleanChat(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/\b[a-z0-9-]+\.(com|net|org|io|gg|co|ly|me|app|dev)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const BOT_NAMES = ['Biscuit', 'Crumb', 'Scone', 'Muffin', 'Toast', 'Waffle', 'Bagel', 'Pancake', 'Brioche']
/** A lobby only stays listed while its host is still polling the table. */
const ROOM_LIVE_MS = 120_000

type RoomRow = {
  id: string
  host: string
  status: string
  round: number
  turn: string | null
  topic: string
  used: string
  seen: string
  fuse_end: number
  fuse_ms: number
  meter_target: number
  last: string
  winner: string | null
  size: string
  rated: number
  settled: number
  turn_at: number
  updated_at: number
}

type PlayerRow = { pid: string; name: string; hearts: number; seat: number; meter: number; segs: string; score: number; bot: number; seen_at: number; client: string | null }

/** The host is the one seat a lobby cannot run without: they are the only one
 *  who can deal the round. */
function hostFresh(players: PlayerRow[], host: string): boolean {
  const seat = players.find((player) => player.pid === host)
  return Boolean(seat) && now() - Number(seat?.seen_at ?? 0) <= HOST_FRESH_MS
}

const now = () => Date.now()

let schema: Promise<void> | undefined
function ensureSchema(db: D1Database): Promise<void> {
  schema ??= db
    .batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS butter_rooms (
        id TEXT PRIMARY KEY,
        host TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'lobby',
        round INTEGER NOT NULL DEFAULT 0,
        turn TEXT,
        topic TEXT NOT NULL DEFAULT '{}',
        used TEXT NOT NULL DEFAULT '[]',
        seen TEXT NOT NULL DEFAULT '[]',
        fuse_end INTEGER NOT NULL DEFAULT 0,
        fuse_ms INTEGER NOT NULL DEFAULT ${FUSE_MS},
        meter_target INTEGER NOT NULL DEFAULT ${METER_FULL},
        last TEXT NOT NULL DEFAULT '{}',
        winner TEXT,
        size TEXT NOT NULL DEFAULT 'party',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS butter_players (
        room TEXT NOT NULL,
        pid TEXT NOT NULL,
        name TEXT NOT NULL,
        hearts INTEGER NOT NULL DEFAULT ${LIVES},
        seat INTEGER NOT NULL,
        meter INTEGER NOT NULL DEFAULT 0,
        segs TEXT NOT NULL DEFAULT '[]',
        score INTEGER NOT NULL DEFAULT 0,
        seen_at INTEGER NOT NULL,
        PRIMARY KEY (room, pid)
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS butter_players_room ON butter_players(room, seat)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS butter_feed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        text TEXT NOT NULL,
        tone TEXT NOT NULL DEFAULT 'note',
        at INTEGER NOT NULL
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS butter_feed_room ON butter_feed(room, id DESC)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS butter_chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        pid TEXT NOT NULL,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        at INTEGER NOT NULL
      )`),
      db.prepare(`CREATE INDEX IF NOT EXISTS butter_chat_room ON butter_chat(room, id DESC)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS butter_ratings (
        client TEXT PRIMARY KEY,
        rating INTEGER NOT NULL DEFAULT 1000,
        games INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`),
    ])
    // Rooms and players created before the meter existed need the new columns.
    .then(async () => {
      for (const sql of [
        'ALTER TABLE butter_players ADD COLUMN meter INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE butter_players ADD COLUMN bot INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE butter_rooms ADD COLUMN turn_at INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE butter_players ADD COLUMN client TEXT',
        'ALTER TABLE butter_rooms ADD COLUMN rated INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE butter_rooms ADD COLUMN settled INTEGER NOT NULL DEFAULT 0',
        "ALTER TABLE butter_players ADD COLUMN segs TEXT NOT NULL DEFAULT '[]'",
        'ALTER TABLE butter_players ADD COLUMN score INTEGER NOT NULL DEFAULT 0',
        `ALTER TABLE butter_rooms ADD COLUMN meter_target INTEGER NOT NULL DEFAULT ${METER_FULL}`,
        "ALTER TABLE butter_rooms ADD COLUMN last TEXT NOT NULL DEFAULT '{}'",
        "ALTER TABLE butter_rooms ADD COLUMN size TEXT NOT NULL DEFAULT 'party'",
        "ALTER TABLE butter_rooms ADD COLUMN seen TEXT NOT NULL DEFAULT '[]'",
      ]) {
        try {
          await db.prepare(sql).run()
        } catch {
          /* column already exists */
        }
      }
    })
  return schema
}

function db(c: Context<AppContext>): D1Database {
  return c.get('db') as D1Database
}

function crossSite(c: Context<AppContext>): boolean {
  const origin = c.req.header('origin')
  if (!origin) return false
  try {
    return new URL(origin).host !== new URL(c.req.url).host
  } catch {
    return true
  }
}

// The real lobby takes up to 16 characters and allows . and ' — a name like
// O'Brien or J. Crew is accepted there and must be accepted here.
function cleanName(value: unknown): string {
  return String(value ?? '')
    .replace(/[^\p{L}\p{N} _.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
}

function cleanCode(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
}

function roomCode(): string {
  let out = ''
  for (let index = 0; index < 4; index += 1) out += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
  return out
}

async function roomOf(database: D1Database, code: string): Promise<RoomRow | undefined> {
  return (
    (await database
      .prepare(
        `SELECT id, host, status, round, turn, turn_at, topic, used, seen, fuse_end, fuse_ms, meter_target, last, winner, size, rated, settled, updated_at FROM butter_rooms WHERE id = ?`,
      )
      .bind(code)
      .first<RoomRow>()) ?? undefined
  )
}

async function playersOf(database: D1Database, code: string): Promise<PlayerRow[]> {
  const rows = await database
    .prepare(`SELECT pid, name, hearts, seat, meter, segs, score, bot, seen_at, client FROM butter_players WHERE room = ? ORDER BY seat`)
    .bind(code)
    .all<PlayerRow>()
  return (rows.results ?? []).map((player) => ({
    ...player,
    hearts: Number(player.hearts) || 0,
    meter: Number(player.meter) || 0,
    score: Number(player.score) || 0,
    segs: typeof player.segs === 'string' ? player.segs : '[]',
  }))
}

async function say(database: D1Database, code: string, text: string, tone = 'note') {
  await database
    .prepare(`INSERT INTO butter_feed (room, text, tone, at) VALUES (?, ?, ?, ?)`)
    .bind(code, text.slice(0, 160), tone, now())
    .run()
  await database
    .prepare(
      `DELETE FROM butter_feed WHERE room = ? AND id NOT IN (SELECT id FROM butter_feed WHERE room = ? ORDER BY id DESC LIMIT ${FEED_KEEP})`,
    )
    .bind(code, code)
    .run()
}

function topicOf(room: RoomRow): ButterTopic {
  try {
    const parsed = JSON.parse(room.topic) as ButterTopic
    return parsed && Array.isArray(parsed.answers) ? parsed : { prompt: 'Name something', answers: [] }
  } catch {
    return { prompt: 'Name something', answers: [] }
  }
}

function usedOf(room: RoomRow): string[] {
  try {
    const parsed = JSON.parse(room.used)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/** The last scoring event, kept on the room so every client sees the same chip. */
type LastEvent = {
  kind?: 'tier' | 'pop' | 'win' | 'spare' | 'reject'
  name?: string
  answer?: string
  tier?: ButterTier
  points?: number
  at?: number
}

function lastOf(room: RoomRow): LastEvent | null {
  try {
    const parsed = JSON.parse(room.last) as LastEvent
    return parsed && typeof parsed === 'object' && parsed.name ? parsed : null
  } catch {
    return null
  }
}

async function setLast(database: D1Database, code: string, last: LastEvent) {
  await database
    .prepare(`UPDATE butter_rooms SET last = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(last), now(), code)
    .run()
}

function nextAlive(players: PlayerRow[], after: string | null): PlayerRow | undefined {
  const alive = players.filter((player) => player.hearts > 0)
  if (!alive.length) return undefined
  const at = alive.findIndex((player) => player.pid === after)
  return alive[(at + 1) % alive.length] ?? alive[0]
}

/**
 * A card is spent once every accepted answer on it has been named. Left spent,
 * the rest of the round is automatic pops — nothing can be named that is not a
 * repeat — so the rarity meter could never fill and the winner came down to seat
 * order. The real table always has something left to name, so a spent card is
 * replaced and the puffer keeps moving.
 */
/** How many times the town turns up at one table: two games, or three. */
function simsburyTarget(room: RoomRow): number {
  let hash = 0
  for (const character of room.id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return 2 + (hash % 2)
}

/**
 * The Simsbury card this table is due, if it is due one. The town takes the
 * second, fifth and eighth card of a game — so a short game still meets it once,
 * a long one two or three times, and never twice in a row.
 */
function dueSimsbury(room: RoomRow, seen: string[]): ButterTopic | undefined {
  const played = seen.filter((prompt) => SIMSBURY_CARDS.some((card) => card.prompt === prompt)).length
  if (played >= simsburyTarget(room)) return undefined
  const dueAt = [1, 4, 7][played] ?? Number.POSITIVE_INFINITY
  if (room.round < dueAt) return undefined
  const fresh = SIMSBURY_CARDS.filter((card) => !seen.includes(card.prompt))
  if (!fresh.length) return undefined
  const pick = fresh[(room.round * 7 + room.id.length + played) % fresh.length]
  return pick as unknown as ButterTopic
}

/** The next card this table is dealt: the town's when it is due, else the bank. */
function nextPartyTopic(room: RoomRow, seen: string[]): ButterTopic {
  return dueSimsbury(room, seen) ?? nextTopic(seen)
}

/** The categories this table has already dealt, oldest first. */
function seenOf(room: RoomRow): string[] {
  try {
    const parsed = JSON.parse(room.seen || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/** How many past categories a room remembers before it is willing to repeat. */
const SEEN_KEEP = 20

function dealCard(
  room: RoomRow,
  seen: string[],
): { topic: ButterTopic; used: string[]; swapped: boolean; seen: string[] } {
  const topic = topicOf(room)
  const used = usedOf(room)
  if (used.length < topic.answers.length) return { topic, used, swapped: false, seen }
  const fresh = nextPartyTopic(room, [...seen, topic.prompt])
  return { topic: fresh, used: [], swapped: true, seen: [...seen, fresh.prompt].slice(-SEEN_KEEP) }
}

/**
 * Move the puffer on and settle the fuse. Returns the current room row so the
 * caller answers with one consistent snapshot.
 */
/** Every rated seat's rating, defaulting a first-timer to a clean thousand. */
async function ratingsOf(database: D1Database, clients: string[]): Promise<Map<string, number>> {
  const ratings = new Map<string, number>()
  const unique = [...new Set(clients.filter(Boolean))]
  if (!unique.length) return ratings
  const rows = await database
    .prepare(`SELECT client, rating FROM butter_ratings WHERE client IN (${unique.map(() => '?').join(',')})`)
    .bind(...unique)
    .all<{ client: string; rating: number }>()
  for (const row of rows.results ?? []) ratings.set(row.client, Number(row.rating) || 1000)
  return ratings
}

/**
 * A rated table moves ratings the way an elo does: beating stronger seats pays
 * more, losing to them costs less. Every client keeps its rating between rooms,
 * and a room only ever settles once.
 */
async function settleRatings(database: D1Database, room: RoomRow, players: PlayerRow[], winnerPid: string | null) {
  const claim = await database.prepare(`UPDATE butter_rooms SET settled = 1 WHERE id = ? AND settled = 0`).bind(room.id).run()
  if (!claim.meta?.changes) return
  const seated = players.filter((player) => player.client)
  if (seated.length < 2) return
  const current = await ratingsOf(database, seated.map((player) => String(player.client)))
  const table = seated.map((player) => ({ player, rating: current.get(String(player.client)) ?? 1000 }))
  for (const seat of table) {
    const others = table.filter((entry) => entry.player.pid !== seat.player.pid)
    const average = others.reduce((sum, entry) => sum + entry.rating, 0) / Math.max(1, others.length)
    const expected = 1 / (1 + Math.pow(10, (average - seat.rating) / 400))
    const won = winnerPid !== null && seat.player.pid === winnerPid
    const delta = Math.round(32 * ((won ? 1 : 0) - expected))
    const next = Math.max(100, seat.rating + delta)
    await database
      .prepare(
        `INSERT INTO butter_ratings (client, rating, games, updated_at) VALUES (?, ?, 1, ?)
         ON CONFLICT(client) DO UPDATE SET rating = ?, games = games + 1, updated_at = ?`,
      )
      .bind(seat.player.client, next, now(), next, now())
      .run()
    await say(database, room.id, `${seat.player.name} ${next} (${delta >= 0 ? '+' : ''}${delta})`, delta >= 0 ? 'good' : 'bad')
  }
}

function randomFuse(): number {
  return Math.round(MIN_FUSE_MS + Math.random() * (FUSE_MS - MIN_FUSE_MS))
}

/**
 * Move the butter on. The fuse is one shared deadline per round, exactly like
 * the arcade: a pass keeps whatever time is left, and only a pass that leaves
 * under eight seconds puts eight back on the clock. A fresh random fuse is
 * struck after a pop, and the pop is also what deals the next category.
 */
async function advance(
  database: D1Database,
  room: RoomRow,
  players: PlayerRow[],
  popped: boolean,
): Promise<RoomRow> {
  const alive = players.filter((player) => player.hearts > 0)
  // A table of one keeps going: there is nobody to outlast yet, but the round
  // should still run until that player runs out of lives.
  const lastOneStanding = alive.length <= 1 && (players.length > 1 || alive.length === 0)
  if (lastOneStanding) {
    const winner = alive[0]?.pid ?? null
    await database
      .prepare(`UPDATE butter_rooms SET status = 'done', winner = ?, turn = NULL, fuse_end = 0, updated_at = ? WHERE id = ?`)
      .bind(winner, now(), room.id)
      .run()
    if (alive[0]) {
      await say(database, room.id, `${alive[0].name} is the last one still floating.`, 'good')
      await setLast(database, room.id, { kind: 'win', name: alive[0].name, at: now() })
      if (room.rated === 1) await settleRatings(database, room, players, alive[0].pid)
    }
    return (await roomOf(database, room.id)) ?? room
  }

  const next = nextAlive(players, room.turn)
  const strike = randomFuse()

  const seen = seenOf(room)
  let topic = topicOf(room)
  let used = usedOf(room)
  let swapped = false
  let history = seen
  if (popped) {
    // A pop ends the round: new card, cleared answers, new hidden fuse.
    topic = nextPartyTopic(room, [...seen, topic.prompt])
    used = []
    history = [...seen, topic.prompt].slice(-SEEN_KEEP)
  } else {
    const card = dealCard(room, seen)
    topic = card.topic
    used = card.used
    swapped = card.swapped
    history = card.seen
  }

  const fuseEnd = popped
    ? now() + POP_FREEZE_MS + strike
    : Math.max(room.fuse_end, now() + FUSE_FLOOR_MS)
  // The total the client draws its bar against is the fuse itself, not whatever
  // is left of it. Measuring `fuseEnd - now` here folded the door's 3s countdown
  // into the total, so the bar jumped backwards on the first pass.
  const fuseMs = popped
    ? strike
    : Math.max(FUSE_FLOOR_MS, Math.min(Number(room.fuse_ms) || FUSE_MS, fuseEnd - now()))

  await database
    .prepare(
      `UPDATE butter_rooms SET turn = ?, turn_at = ?, round = ?, fuse_ms = ?, fuse_end = ?, topic = ?, used = ?, seen = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(
      next?.pid ?? null,
      now(),
      popped ? room.round + 1 : room.round,
      fuseMs,
      fuseEnd,
      JSON.stringify(topic),
      JSON.stringify(used),
      JSON.stringify(history),
      now(),
      room.id,
    )
    .run()
  if (swapped) await say(database, room.id, `every answer on that card is used — new card: ${topic.prompt}.`, 'note')
  if (popped) await say(database, room.id, `new card: ${topic.prompt}.`, 'note')
  return (await roomOf(database, room.id)) ?? room
}

/** A refusal is cheap: the card stays, the fuse keeps burning, try again. */
function refusalMessage(name: string, answer: string, repeat: boolean): string {
  if (repeat) return `${name} already said "${answer}" — try another.`
  return `"${answer}" is not on that card — ${name} can try again.`
}

/** Settle a fuse that ran out while nobody was polling. */
async function settleFuse(database: D1Database, room: RoomRow): Promise<RoomRow> {
  if (room.status !== 'playing' || !room.fuse_end) return room
  let current = room
  for (let guard = 0; guard < 6; guard += 1) {
    if (current.status !== 'playing' || now() < current.fuse_end) break
    const players = await playersOf(database, current.id)
    const victim = players.find((player) => player.pid === current.turn)
    if (!victim) break
    const hearts = Math.max(0, victim.hearts - 1)
    await database
      .prepare(`UPDATE butter_players SET hearts = ? WHERE room = ? AND pid = ?`)
      .bind(hearts, current.id, victim.pid)
      .run()
    await say(database, current.id, `the fuse ran out. The puffer popped on ${victim.name}.`, 'bad')
    await setLast(database, current.id, { kind: 'pop', name: victim.name, tier: undefined, points: 0, at: now() })
    const updated = players.map((player) => (player.pid === victim.pid ? { ...player, hearts } : player))
    // advance() owns the pass and the end-of-game check. Call it even when
    // nobody is left: a solo table whose last heart just melted must finish
    // instead of re-settling the same expired fuse on every poll.
    current = await advance(database, current, updated, true)
    if (!nextAlive(updated, victim.pid)) break
  }
  return current
}

/** Pick an accepted answer the card has not spent yet. */
function freshAnswer(topic: ButterTopic, used: string[]): string | undefined {
  const spent = new Set(used.map(flatAnswer))
  // A bot is supposed to read like a person at the table, and people say what
  // everyone knows. Picking uniformly from a 12,000 answer card had bots naming
  // the deepest thing on it ("some copper" on town history) while the answer
  // every local would actually say sat unguessed. So they mostly draw from the
  // famous end, and only occasionally dive.
  const famous: string[] = []
  const left: string[] = []
  topic.answers.forEach((answer, index) => {
    if (spent.has(flatAnswer(answer))) return
    left.push(answer)
    const tier = topic.tiers?.[index]
    if (tier === 'plankton' || tier === 'tooclever' || tier === 'schooler') famous.push(answer)
  })
  if (!left.length) return undefined
  const pool = famous.length && Math.random() < 0.85 ? famous : left
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Quick play fills empty seats with bots, and the arcade labels them "bot".
 * They answer on their own clock, from the same accepted list as everyone else,
 * so a bot can never say something the table would refuse.
 */
async function playBots(database: D1Database, room: RoomRow): Promise<RoomRow> {
  let current = room
  for (let guard = 0; guard < 8; guard += 1) {
    if (current.status !== 'playing' || !current.turn) return current
    const players = await playersOf(database, current.id)
    const me = players.find((player) => player.pid === current.turn)
    if (!me || me.bot !== 1) return current
    if (now() - (current.turn_at || current.updated_at) < 1_800) return current
    // A bot that never missed would make a table of bots unpoppable: the fuse
    // could never run out, the round would never end and the game would run
    // forever. So one turn in eight is a dodge, decided per turn so the bot
    // does not answer on a later poll either.
    let seed = 0
    for (const ch of String(me.pid) + ':' + String(current.turn_at)) seed = (seed * 31 + ch.charCodeAt(0)) % 10_000
    if (seed % 8 === 0) return current
    // Two polls can reach the same bot at once. Claim the turn first: the
    // update only lands while turn_at is unchanged, so one of them answers and
    // the other sees an unchanged row and gives up. Without this a bot scored
    // twice for one turn.
    const claim = await database
      .prepare(`UPDATE butter_rooms SET turn_at = ? WHERE id = ? AND turn = ? AND turn_at = ?`)
      .bind(now(), current.id, me.pid, current.turn_at)
      .run()
    if (!claim.meta?.changes) return current
    const topic = topicOf(current)
    const used = usedOf(current)
    const answer = freshAnswer(topic, used)
    if (!answer) return current
    const tier = answerTier(topic, answer)
    if (!tier) return current
    const segs = [...parseSegs(me.segs), { tier: tier.id, amt: tier.score }]
    let meter = me.meter + tier.score
    let hearts = me.hearts
    let target = Number(current.meter_target) || METER_FULL
    if (meter >= target) {
      meter -= target
      if (hearts < MAX_LIVES) hearts += 1
      target = Math.min(MAX_METER_TARGET, target + METER_STEP)
    }
  const reply = tier.value
  used.push(reply)
    await database
      .prepare(`UPDATE butter_players SET hearts = ?, meter = ?, segs = ?, score = ? WHERE room = ? AND pid = ?`)
      .bind(hearts, meter, JSON.stringify(segs), me.score + tier.score, current.id, me.pid)
      .run()
    await database
      .prepare(`UPDATE butter_rooms SET used = ?, meter_target = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(used), target, now(), current.id)
      .run()
    await say(database, current.id, `${me.name}: ${answer}`, 'good')
    current = await advance(
      database,
      { ...current, used: JSON.stringify(used), meter_target: target },
      players.map((player) => (player.pid === me.pid ? { ...player, hearts, meter, score: player.score + tier.score } : player)),
      false,
    )
  }
  return current
}

/**
 * A seat that has not polled for a while is dropped from the table, the same
 * way the arcade kicks an idle player instead of freezing the round on them.
 */
async function reapIdle(database: D1Database, room: RoomRow): Promise<RoomRow> {
  // A round in flight keeps every seat: the puffer already deals out the
  // punishment for a player who stops answering, and a background tab looks
  // exactly like an absent player from here.
  if (room.status !== 'lobby') return room
  const players = await playersOf(database, room.id)
  const idle = players.filter(
    (player) => player.bot !== 1 && player.seen_at > 0 && now() - player.seen_at > IDLE_KICK_MS,
  )
  if (!idle.length) return room
  // In the lobby a stale seat is simply removed, so the table does not wait on
  // someone who never came back.
  for (const player of idle) {
    await database.prepare(`DELETE FROM butter_players WHERE room = ? AND pid = ?`).bind(room.id, player.pid).run()
    await say(database, room.id, `${player.name} was kicked for being idle.`, 'bad')
  }
  const left = players.filter((player) => !idle.some((gone) => gone.pid === player.pid))
  // An empty table is not a room any more: leaving it listed only strands the
  // next visitor in a lobby nobody can start.
  if (!left.length) {
    await database.prepare(`DELETE FROM butter_players WHERE room = ?`).bind(room.id).run()
    await database.prepare(`DELETE FROM butter_feed WHERE room = ?`).bind(room.id).run()
    await database.prepare(`DELETE FROM butter_chat WHERE room = ?`).bind(room.id).run()
    await database.prepare(`DELETE FROM butter_rooms WHERE id = ?`).bind(room.id).run()
    return room
  }
  // The host's chair going stale must not leave the survivors without a start
  // button, so the player who has been waiting longest takes over.
  if (idle.some((gone) => gone.pid === room.host)) {
    await database.prepare(`UPDATE butter_rooms SET host = ?, updated_at = ? WHERE id = ?`).bind(left[0].pid, now(), room.id).run()
    await say(database, room.id, `${left[0].name} is hosting now.`, 'note')
    return { ...room, host: left[0].pid }
  }
  return room
}

/**
 * D1 can refuse a write when two players' polls land at once. A busy database
 * is not a broken table, so a transient refusal is retried instead of turning
 * the whole poll into a 500 and freezing every seat's screen.
 */
async function retrying<T>(work: () => Promise<T>, tries = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!/busy|locked|D1_ERROR|timeout|timed out|reset/i.test(message)) throw error
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)))
    }
  }
  throw lastError
}

async function snapshot(database: D1Database, code: string, pid: string) {
  let room = await roomOf(database, code)
  if (!room) return undefined
  // One poll must never take the table down: if the tick cannot be written this
  // second, answer with the state that is already stored and let the next poll
  // try again.
  try {
    room = await retrying(() => settleFuse(database, room as RoomRow))
    room = await retrying(() => reapIdle(database, room as RoomRow))
    room = await retrying(() => playBots(database, room as RoomRow))
  } catch (error) {
    console.error('butter tick failed', error)
  }
  const players = await playersOf(database, code)
  const viewer = players.find((player) => player.pid === pid)
  const rating = viewer?.client ? ((await ratingsOf(database, [viewer.client])).get(viewer.client) ?? 1000) : null
  // A rated table prints every seat's number under its hearts, the way the
  // arcade does: you can see who you are up against before you answer.
  const seatRatings =
    room.rated === 1
      ? await ratingsOf(
          database,
          players.map((player) => String(player.client ?? '')).filter((client) => client !== ''),
        )
      : null
  const feed = await database
    .prepare(`SELECT id, text, tone, at FROM butter_feed WHERE room = ? ORDER BY id DESC LIMIT ${FEED_KEEP}`)
    .bind(code)
    .all<{ id: number; text: string; tone: string; at: number }>()
  const chat = await database
    .prepare(`SELECT id, pid, name, text, at FROM butter_chat WHERE room = ? ORDER BY id DESC LIMIT ${CHAT_KEEP}`)
    .bind(code)
    .all<{ id: number; pid: string; name: string; text: string; at: number }>()
  const topic = topicOf(room)
  const used = usedOf(room)
  const winner = room.winner ? players.find((player) => player.pid === room.winner) : undefined
  return {
    code: room.id,
    status: room.status,
    round: room.round,
    turn: room.turn,
    you: pid,
    host: room.host,
    // Only the prompt crosses the wire: the accepted list stays on the server.
    prompt: topic.prompt,
    // "Left" is the real card's count once it has been read: the bundled sample
    // stops at 1,203 answers, and a card with 12,000 would otherwise claim to be
    // spent a tenth of the way through.
    left: Math.max(0, (cachedCard(topic.prompt)?.answers.length ?? topic.answers.length) - used.length),
    rated: room.rated === 1,
    rating,
    turnAt: room.turn_at,
    fuseEnd: room.fuse_end,
    fuseMs: room.fuse_ms,
    meterTarget: Number(room.meter_target) || METER_FULL,
    // The gate starts you with two hearts and only shows more slots if you earn
    // one; MAX_LIVES is the ceiling, not the opening hand.
    maxLives: LIVES,
    size: room.size || 'party',
    cap: capFor(room.size),
    serverNow: now(),
    players: players.map((player) => ({
      pid: player.pid,
      name: player.name,
      hearts: player.hearts,
      seat: player.seat,
      meter: player.meter,
      segs: parseSegs(player.segs),
      score: player.score,
      bot: player.bot === 1,
      you: player.pid === pid,
      rating: seatRatings && player.client ? (seatRatings.get(String(player.client)) ?? 1000) : null,
    })),
    feed: (feed.results ?? []).reverse(),
    chat: (chat.results ?? []).reverse(),
    last: lastOf(room),
    winner: winner ? { name: winner.name, you: winner.pid === pid } : null,
  }
}

/** Seat bots in the empty chairs from `firstSeat` on, up to the table's cap. */
async function seatBots(database: D1Database, code: string, size: string | undefined, wanted: number, firstSeat: number) {
  const seats = Math.max(0, Math.min(capFor(size) - 1, 9, Math.floor(wanted)))
  const stamp = now()
  for (let index = 0; index < seats; index += 1) {
    await database
      .prepare(`INSERT INTO butter_players (room, pid, name, hearts, seat, meter, segs, score, bot, seen_at) VALUES (?, ?, ?, ?, ?, 0, '[]', 0, 1, ?)`)
      .bind(code, crypto.randomUUID(), `${BOT_NAMES[(firstSeat + index) % BOT_NAMES.length]} (bot)`, LIVES, firstSeat + index, stamp)
      .run()
  }
  return seats
}

async function touch(database: D1Database, code: string, pid: string) {
  await database.prepare(`UPDATE butter_players SET seen_at = ? WHERE room = ? AND pid = ?`).bind(now(), code, pid).run()
  await database.prepare(`UPDATE butter_rooms SET updated_at = ? WHERE id = ?`).bind(now(), code).run()
}

async function joinRoom(database: D1Database, code: string, name: string) {
  const room = await roomOf(database, code)
  if (!room) return { error: 'No room with that code.', status: 404 as const }
  const players = await playersOf(database, code)
  if (players.length >= capFor(room.size)) return { error: 'That room is full.', status: 409 as const }
  // A round in flight still takes a latecomer, the way the arcade's room list
  // shows PLAYING tables with a JOIN button instead of hiding them.
  if (room.status === 'done') return { error: 'That table has finished.', status: 409 as const }
  // Only a lobby needs its host: they are the one who can deal the round. A
  // round already in flight keeps going without them, so a latecomer still gets
  // a seat on a PLAYING table.
  if (room.status === 'lobby' && !hostFresh(players, room.host)) {
    return { error: 'That table has gone quiet — open a new one.', status: 409 as const }
  }
  const pid = crypto.randomUUID()
  await database
    .prepare(
      `INSERT INTO butter_players (room, pid, name, hearts, seat, meter, segs, score, seen_at) VALUES (?, ?, ?, ?, ?, 0, '[]', 0, ?)`,
    )
    .bind(code, pid, name, LIVES, players.length, now())
    .run()
  await say(database, code, `${name} slid into the room.`, 'note')
  return { pid }
}

butter.post('/create', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const database = db(c)
  await ensureSchema(database)
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; size?: string; bots?: number; client?: string; rated?: boolean }
  const name = cleanName(body.name) || 'Player'
  const size = body.size && TABLE_CAP[body.size] ? body.size : 'party'
  let code = roomCode()
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (!(await roomOf(database, code))) break
    code = roomCode()
  }
  const pid = crypto.randomUUID()
  const stamp = now()
  await database
    .prepare(
      `INSERT INTO butter_rooms (id, host, status, round, turn, turn_at, topic, used, fuse_end, fuse_ms, meter_target, last, size, created_at, updated_at) VALUES (?, ?, 'lobby', 0, NULL, 0, '{}', '[]', 0, ?, ?, '{}', ?, ?, ?)`,
    )
    .bind(code, pid, FUSE_MS, METER_FULL, size, stamp, stamp)
    .run()
  await database
    .prepare(
      `INSERT INTO butter_players (room, pid, name, hearts, seat, meter, segs, score, seen_at) VALUES (?, ?, ?, ?, 0, 0, '[]', 0, ?)`,
    )
    .bind(code, pid, name, LIVES, stamp)
    .run()
  const wanted = Math.max(0, Math.min(capFor(size) - 1, 9, Math.floor(Number(body.bots) || 0)))
  const seated = wanted ? await seatBots(database, code, size, wanted, 1) : 0
  const client = String(body.client ?? '').slice(0, 64) || null
  if (client) {
    await database.prepare(`UPDATE butter_players SET client = ? WHERE room = ? AND pid = ?`).bind(client, code, pid).run()
  }
  if (body.rated === true) {
    await database.prepare(`UPDATE butter_rooms SET rated = 1 WHERE id = ?`).bind(code).run()
  }
  await say(database, code, `${name} opened a table. Share the code ${code}.`, 'note')
  if (seated) await say(database, code, `${seated} bot${seated === 1 ? '' : 's'} took the empty seats.`, 'note')
  return c.json({ code, pid }, 201, { 'cache-control': 'no-store' })
})

/** A host waiting alone can fill the empty chairs, so a solo visitor can always
 *  play instead of staring at "need one more player". */
butter.post('/bots', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const database = db(c)
  await ensureSchema(database)
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; pid?: string; count?: number }
  const code = cleanCode(body.code)
  const pid = String(body.pid ?? '')
  const room = await roomOf(database, code)
  if (!room) return c.json({ error: 'No room with that code.' }, 404)
  if (room.host !== pid) return c.json({ error: 'Only the host can fill the table.' }, 403)
  if (room.status === 'playing') return c.json({ error: 'That game already started.' }, 409)
  const players = await playersOf(database, code)
  const cap = capFor(room.size)
  const free = cap - players.length
  if (free <= 0) return c.json({ error: 'That table is full.' }, 409)
  const wanted = Math.max(1, Math.min(free, Math.floor(Number(body.count) || free)))
  const seated = await seatBots(database, code, room.size, wanted, players.length)
  await say(database, code, `${seated} bot${seated === 1 ? '' : 's'} sat down.`, 'note')
  return c.json(await snapshot(database, code, pid), 201, { 'cache-control': 'no-store' })
})

butter.post('/join', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const database = db(c)
  await ensureSchema(database)
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; name?: string; client?: string }
  const code = cleanCode(body.code)
  if (code.length !== 4) return c.json({ error: 'A room code is four letters.' }, 400)
  const name = cleanName(body.name) || 'Player'
  const result = await joinRoom(database, code, name)
  if ('error' in result) return c.json({ error: result.error }, result.status)
  const client = String(body.client ?? '').slice(0, 64) || null
  if (client) {
    await database.prepare(`UPDATE butter_players SET client = ? WHERE room = ? AND pid = ?`).bind(client, code, result.pid).run()
  }
  return c.json({ code, pid: result.pid }, 201, { 'cache-control': 'no-store' })
})

butter.get('/rooms', async (c) => {
  const database = db(c)
  await ensureSchema(database)
  const rows = await database
    .prepare(
      // Lobby and playing tables alike: a round in flight takes a latecomer, and
      // a full one is listed as FULL rather than vanishing from the list.
      `SELECT r.id, r.status, r.size, r.rated, r.updated_at, p.name AS hostName, p.seen_at AS hostSeen,
        (SELECT COUNT(*) FROM butter_players cp WHERE cp.room = r.id) AS players,
        COALESCE((SELECT br.rating FROM butter_ratings br WHERE br.client = (
          SELECT hp.client FROM butter_players hp WHERE hp.room = r.id AND hp.pid = r.host
        )), 1000) AS rating
       FROM butter_rooms r LEFT JOIN butter_players p ON p.room = r.id AND p.pid = r.host
       WHERE r.updated_at > ? AND r.status IN ('lobby', 'playing')
         AND EXISTS (SELECT 1 FROM butter_players hp WHERE hp.room = r.id AND hp.pid = r.host)
       ORDER BY r.updated_at DESC LIMIT 50`,
    )
    .bind(now() - ROOM_LIVE_MS)
    .all<{ id: string; status: string; size: string; rated: number; players: number; hostName?: string; hostSeen?: number; rating?: number }>()
  // A room stays listed only while its host is actually sitting there. The
  // guests' own polling keeps `updated_at` fresh, so a room whose host closed
  // the tab stayed at the top of this list, and quick play dropped every new
  // player into a lobby where nobody could ever press start.
  const rooms = (rows.results ?? [])
    // A lobby lives and dies with its host; a playing table lives with its
    // players, whose polling keeps `updated_at` fresh.
    .filter((room) =>
      room.status === 'playing'
        ? true
        : Number(room.hostSeen) > 0 && now() - Number(room.hostSeen) <= HOST_FRESH_MS,
    )
    .map((room) => ({ ...room, rated: room.rated === 1, hostSeen: undefined, cap: capFor(room.size) }))
    .slice(0, 50)
  // A live seated count, for the dive's "N playing" line — how many people are
  // sitting at open tables right now, the same number the real game shows on
  // its front door next to "Puffer Party".
  const playing = rooms.reduce((sum, room) => sum + room.players, 0)
  return c.json({ rooms, playing }, 200, { 'cache-control': 'no-store' })
})

butter.get('/state', async (c) => {
  const database = db(c)
  await ensureSchema(database)
  const code = cleanCode(c.req.query('code'))
  const pid = String(c.req.query('pid') ?? '')
  if (code.length !== 4) return c.json({ error: 'A room code is four letters.' }, 400)
  // A poll that loses a race with another seat's write is not a dead table:
  // try the tick twice before letting the request fail.
  const state = await retrying(() => snapshot(database, code, pid), 2)
  if (!state) return c.json({ error: 'No room with that code.' }, 404)
  if (pid) await touch(database, code, pid)
  return c.json(state, 200, { 'cache-control': 'no-store' })
})

butter.post('/start', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const database = db(c)
  await ensureSchema(database)
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; pid?: string }
  const code = cleanCode(body.code)
  const pid = String(body.pid ?? '')
  const room = await roomOf(database, code)
  if (!room) return c.json({ error: 'No room with that code.' }, 404)
  if (room.host !== pid) return c.json({ error: 'Only the host can start.' }, 403)
  // A finished round can be dealt again from the same table; only a round in
  // flight refuses a second start.
  if (room.status === 'playing') return c.json({ error: 'That game already started.' }, 409)
  const players = await playersOf(database, code)
  if (players.length < MIN_PLAYERS) return c.json({ error: 'Somebody has to be at the table.' }, 409)
  // A rematch keeps the table's history, so the card it just finished is not
  // dealt straight back to it.
  const seen = seenOf(room)
  // A rematch starts a fresh count, whatever the last game ended on, and the
  // opening card is always the bank's: the town arrives on the second deal.
  const topic = nextPartyTopic({ ...room, round: 0 }, seen)
  const history = [...seen, topic.prompt].slice(-SEEN_KEEP)
  // The shipped table's fuse is `fuseMinMs: 10_000` to `fuseMaxMs: 30_000` on
  // every deal, the first one included.
  const firstFuse = randomFuse()
  await database
    .prepare(
      `UPDATE butter_players SET hearts = ?, meter = 0, segs = '[]', score = 0 WHERE room = ?`,
    )
    .bind(LIVES, code)
    .run()
  await database
    .prepare(
      `UPDATE butter_rooms SET status = 'playing', topic = ?, used = '[]', seen = ?, turn = ?, turn_at = ?, round = 1, fuse_ms = ?, fuse_end = ?, meter_target = ?, last = '{}', winner = NULL, updated_at = ? WHERE id = ?`,
    )
    .bind(
      JSON.stringify(topic),
      JSON.stringify(history),
      players[0].pid,
      now(),
      // The bar is drawn against `fuse_ms`, so the first card has to carry the
      // same fuse it is actually burning: a second random draw here made the
      // opening bar a different length from the clock behind it.
      firstFuse,
      now() + COUNTDOWN_MS + firstFuse,
      METER_FULL,
      now(),
      code,
    )
    .run()
  await say(database, code, `the puffer is out: ${topic.prompt}.`, 'good')
  return c.json(await snapshot(database, code, pid), 200, { 'cache-control': 'no-store' })
})

butter.post('/chat', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const database = db(c)
  await ensureSchema(database)
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; pid?: string; text?: string }
  const code = cleanCode(body.code)
  const pid = String(body.pid ?? '')
  const text = cleanChat(String(body.text ?? ''))
  if (!text) return c.json({ error: 'Say something first.' }, 400)
  const room = await roomOf(database, code)
  if (!room) return c.json({ error: 'No room with that code.' }, 404)
  const players = await playersOf(database, code)
  const me = players.find((player) => player.pid === pid)
  if (!me) return c.json({ error: 'You are not at this table.' }, 403)
  const last = await database
    .prepare(`SELECT at FROM butter_chat WHERE room = ? AND pid = ? ORDER BY id DESC LIMIT 1`)
    .bind(code, pid)
    .first<{ at: number }>()
  if (last && now() - last.at < 700) return c.json({ error: 'Slow down a second.' }, 429)
  await database
    .prepare(`INSERT INTO butter_chat (room, pid, name, text, at) VALUES (?, ?, ?, ?, ?)`)
    .bind(code, pid, me.name, text, now())
    .run()
  return c.json(await snapshot(database, code, pid), 200, { 'cache-control': 'no-store' })
})

butter.post('/say', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const database = db(c)
  await ensureSchema(database)
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; pid?: string; answer?: string }
  const code = cleanCode(body.code)
  const pid = String(body.pid ?? '')
  const answer = String(body.answer ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  if (!answer) return c.json({ error: 'Type an answer first.' }, 400)
  let room = await roomOf(database, code)
  if (!room) return c.json({ error: 'No room with that code.' }, 404)
  room = await settleFuse(database, room)
  if (room.status !== 'playing') return c.json({ error: 'That game is not running.' }, 409)
  if (room.turn !== pid) return c.json({ error: 'It is not your turn.' }, 409)
  const players = await playersOf(database, code)
  const me = players.find((player) => player.pid === pid)
  if (!me || me.hearts <= 0) return c.json({ error: 'You are out of hearts.' }, 409)

  const topic = topicOf(room)
  const used = usedOf(room)
  // The real card, not the bundled sample: 1.8M answers ride in static files
  // because the worker cannot carry them, and this is where they are read.
  const card = (await fullCard(topic.prompt, c.env.ASSETS, new URL(c.req.url).origin)) ?? topic
  const tier = answerTier(card, answer)
  // "labradr" after "labrador" is the same answer twice, so a near-miss of a
  // spent answer counts as a repeat and the card does not hand out free points.
  const repeat = used.some((spent) => sameAnswer(spent, answer))
  const playerName = me.name

  // A miss is a shake, not a heart. The puffer pops when the fuse runs out and
  // at no other time — that is the whole game. Krillion's client keeps `.ds-reject`
  // and `.ds-reject-shake` for a refused answer and freezes the table on
  // `POP_FREEZE_MS` for a pop; its own bot stops sending after a refusal, which
  // only makes sense if a refusal costs nothing. Charging a life for a wrong
  // word here made the fuse pointless and ended rounds in two guesses.
  if (!tier || repeat) {
    await say(database, code, refusalMessage(playerName, answer, repeat), 'note')
    await setLast(database, code, { kind: 'reject', name: playerName, answer, points: 0, at: now() })
    return c.json(await snapshot(database, code, pid), 200, { 'cache-control': 'no-store' })
  }

  // The card keeps the real spelling, so "labradr" scores as "labrador" and
  // the next player cannot spend the same answer again.
  const reply = tier.value
  used.push(reply)
  const segs: MeterSeg[] = [...parseSegs(me.segs), { tier: tier.id, amt: tier.score }]
  let meter = me.meter + tier.score
  let hearts = me.hearts
  let target = Number(room.meter_target) || METER_FULL
  let spare = false
  if (meter >= target) {
    meter -= target
    if (hearts < MAX_LIVES) {
      hearts += 1
      spare = true
    }
    target = Math.min(MAX_METER_TARGET, target + METER_STEP)
  }
  await database
    .prepare(`UPDATE butter_players SET hearts = ?, meter = ?, segs = ?, score = ? WHERE room = ? AND pid = ?`)
    .bind(hearts, meter, JSON.stringify(segs), me.score + tier.score, code, pid)
    .run()
  await database
    .prepare(`UPDATE butter_rooms SET used = ?, meter_target = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(used), target, now(), code)
    .run()
  await say(database, code, `${playerName}: ${reply}`, 'good')
  await setLast(database, code, {
    kind: spare ? 'spare' : 'tier',
    name: playerName,
    answer: reply,
    tier: tier.id,
    points: tier.score,
    at: now(),
  })
  if (spare) await say(database, code, `${playerName} filled the meter — +1 spare life.`, 'good')

  const advanced = await advance(
    database,
    { ...room, used: JSON.stringify(used), meter_target: target },
    players.map((player) => (player.pid === pid ? { ...player, hearts, meter, score: player.score + tier.score } : player)),
    false,
  )
  return c.json(await snapshot(database, advanced.id, pid), 200, { 'cache-control': 'no-store' })
})

/**
 * The card's own spell-check, the thing the shipped table draws in its
 * `ds-correction` pill: `chedder` becomes `cheddar` while the answer is still
 * being typed, so a typo never has to be sent to be rejected.
 *
 * Only the card currently on the table is checked, so this reveals nothing a
 * player could not already learn by sending the answer, and a wrong word still
 * comes back empty — the reply is the spelling, never the accepted list.
 */
butter.post('/check', async (c) => {
  if (crossSite(c)) return c.json({ error: 'Cross-site request refused.' }, 403)
  const database = db(c)
  await ensureSchema(database)
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; pid?: string; answer?: string }
  const code = cleanCode(body.code)
  const pid = String(body.pid ?? '')
  const answer = String(body.answer ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  const none = { value: null, repeat: false }
  if (!answer) return c.json(none, 200, { 'cache-control': 'no-store' })
  const room = await roomOf(database, code)
  if (!room || room.status !== 'playing') return c.json(none, 200, { 'cache-control': 'no-store' })
  const players = await playersOf(database, code)
  if (!players.some((player) => player.pid === pid)) return c.json({ error: 'You are not at this table.' }, 403)
  const topic = topicOf(room)
  const hit = closestAnswer(topic, answer)
  const repeat = hit ? usedOf(room).some((spent) => sameAnswer(spent, answer)) : false
  return c.json({ value: hit?.value ?? null, repeat }, 200, { 'cache-control': 'no-store' })
})
