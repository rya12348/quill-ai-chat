import assert from 'node:assert/strict'
import test from 'node:test'

import { chooseDepth, depthBucket, laneQuality, loadDepthQuality, loadLaneQuality, routingScore, type LaneDepth, type LaneRecord } from '../src/worker/lane-routing'
import type { PublicLane } from '../src/worker/public-ai'

const lanes: PublicLane[] = [
  { url: 'https://a.example/v1/chat/completions', model: 'small', label: 'Small', description: 'test' },
  { url: 'https://b.example/v1/chat/completions', model: 'strong', label: 'Strong', description: 'test' },
]

function fakeDb(proofRows: unknown[], feedbackRows: unknown[]): D1Database {
  return {
    prepare(sql: string) {
      const results = sql.includes('FROM proof_runs') ? proofRows : feedbackRows
      return {
        bind() {
          return this
        },
        async all() {
          return { results }
        },
      }
    },
  } as unknown as D1Database
}

test('a lane with no evidence is neutral', () => {
  assert.equal(laneQuality(), 0.5)
  assert.equal(laneQuality({ wins: 2, losses: 0 }), 0.5)
})

test('wins raise quality and losses lower it', () => {
  assert.ok(laneQuality({ wins: 8, losses: 2 }) > 0.5)
  assert.ok(laneQuality({ wins: 0, losses: 8 }) < 0.5)
})

test('a tiny sample cannot overturn the static capability prior', () => {
  assert.ok(routingScore(76, { wins: 3, losses: 0 }) < routingScore(84))
})

test('a sustained record can promote a weaker lane', () => {
  assert.ok(routingScore(76, { wins: 20, losses: 0 }) > routingScore(84))
})

test('a sustained failure can demote a strong lane', () => {
  assert.ok(routingScore(84, { wins: 0, losses: 20 }) < routingScore(76))
})

test('Proof labels and rating routes are attributed to the right lanes', async () => {
  const stats = await loadLaneQuality(
    fakeDb(
      [
        { kind: 'code', outcome: 'verified', models: JSON.stringify(['Strong']) },
        { kind: 'code', outcome: 'failed', models: JSON.stringify(['Small']) },
        { kind: 'code', outcome: 'unverified', models: JSON.stringify(['Small']) },
        // A pass in another mode is a weaker signal, not a full win.
        { kind: 'general', outcome: 'verified', models: JSON.stringify(['Small']) },
        { kind: 'code', outcome: 'failed', models: '{not json' },
        { kind: 'code', outcome: 'verified', models: JSON.stringify(['Unknown']) },
      ],
      [
        { rating: 'up', route: JSON.stringify({ drafters: ['a.example|small'], referee: 'b.example|strong' }) },
        { rating: 'down', route: JSON.stringify({ drafters: [], referee: 'b.example|strong' }) },
      ],
    ),
    'owner',
    lanes,
    'code',
  )
  assert.deepEqual(stats.get('a.example|small'), { wins: 1.25, losses: 1 })
  assert.deepEqual(stats.get('b.example|strong'), { wins: 2, losses: 1 })
})

test('a malformed route row never blocks the reply', async () => {
  const stats = await loadLaneQuality(
    fakeDb([], [{ rating: 'up', route: 'null' }]),
    'owner',
    lanes,
    'general',
  )
  assert.equal(stats.size, 0)
})

test('depth learning waits for three observations and keeps the faster close winner', () => {
  const empty = new Map<LaneDepth, LaneRecord>()
  assert.equal(chooseDepth('Compare these approaches and explain the trade-offs in detail.', 'standard', empty, false), 'standard')

  const oneSample = new Map<LaneDepth, LaneRecord>([['deep', { wins: 1, losses: 0 }]])
  assert.equal(chooseDepth('Compare these approaches and explain the trade-offs in detail.', 'standard', oneSample, false), 'standard')

  const quickWins = new Map<LaneDepth, LaneRecord>([['quick', { wins: 5, losses: 0 }]])
  assert.equal(chooseDepth('Compare these approaches and explain the trade-offs in detail.', 'standard', quickWins, false), 'quick')

  const standardWins = new Map<LaneDepth, LaneRecord>([['standard', { wins: 5, losses: 0 }]])
  assert.equal(chooseDepth('Compare these approaches and explain the trade-offs in detail.', 'quick', standardWins, false), 'standard')

  const deepWins = new Map<LaneDepth, LaneRecord>([['deep', { wins: 5, losses: 0 }]])
  assert.equal(chooseDepth('Compare these approaches and explain the trade-offs in detail.', 'standard', deepWins, false), 'deep')

  const deepLosses = new Map<LaneDepth, LaneRecord>([['deep', { wins: 0, losses: 5 }]])
  assert.equal(chooseDepth('Compare these approaches and explain the trade-offs in detail.', 'standard', deepLosses, false), 'standard')

  const close = new Map<LaneDepth, LaneRecord>([
    ['quick', { wins: 9, losses: 1 }],
    ['deep', { wins: 10, losses: 1 }],
  ])
  assert.equal(chooseDepth('Compare these approaches and explain the trade-offs in detail.', 'standard', close, false), 'quick')
})

test('short greetings keep the quick path even when deeper replies were rated well', () => {
  const deepWins = new Map<LaneDepth, LaneRecord>([['deep', { wins: 5, losses: 0 }]])
  assert.equal(chooseDepth('hello there', 'quick', deepWins, false), 'quick')
})

test('the router occasionally tries a missing adjacent depth', () => {
  const records = new Map<LaneDepth, LaneRecord>([['quick', { wins: 5, losses: 0 }]])
  const prompts = Array.from({ length: 200 }, (_, index) => `Explain this situation carefully and completely, number ${index}.`)
  assert.ok(prompts.some((text) => chooseDepth(text, 'quick', records) === 'standard'))
})

test('depth buckets do not mix one-line and long requests', () => {
  assert.equal(depthBucket('a'.repeat(200)), 'short')
  assert.equal(depthBucket('a'.repeat(201)), 'medium')
  assert.equal(depthBucket('a'.repeat(320)), 'medium')
  assert.equal(depthBucket('a'.repeat(321)), 'long')
})

test('depth quality joins ratings only to the matching task family and length', async () => {
  const stats = await loadDepthQuality(
    fakeDb([], [
      { rating: 'up', route: JSON.stringify({ depth: 'deep', kind: 'code', bucket: 'short' }) },
      { rating: 'down', route: JSON.stringify({ depth: 'deep', kind: 'code', bucket: 'short' }) },
      { rating: 'up', route: JSON.stringify({ depth: 'quick', kind: 'code', bucket: 'short' }) },
      { rating: 'up', route: JSON.stringify({ depth: 'deep', kind: 'research', bucket: 'short' }) },
      { rating: 'up', route: JSON.stringify({ depth: 'deep', kind: 'code', bucket: 'long' }) },
      { rating: 'up', route: JSON.stringify({ drafters: [] }) },
    ]),
    'owner',
    'code',
    'short',
  )
  assert.deepEqual(stats.get('deep'), { wins: 1, losses: 1 })
  assert.deepEqual(stats.get('quick'), { wins: 1, losses: 0 })
  assert.equal(stats.get('standard'), undefined)
})
