import assert from 'node:assert/strict'
import test from 'node:test'

import { loadTaskQuality } from '../src/worker/lane-routing'

function fakeDb(feedbackRows: unknown[]): D1Database {
  return {
    prepare() {
      return {
        bind() {
          return this
        },
        async all() {
          return { results: feedbackRows }
        },
      }
    },
  } as unknown as D1Database
}

test('build routing learns only from Build routes', async () => {
  const stats = await loadTaskQuality(
    fakeDb([
      { rating: 'up', route: JSON.stringify({ task: 'build', drafters: ['a.example|small'], verifier: 'b.example|strong' }) },
      { rating: 'down', route: JSON.stringify({ task: 'chat', drafters: ['b.example|strong'] }) },
      { rating: 'up', route: JSON.stringify({ drafters: ['b.example|strong'] }) },
      { rating: 'down', route: 'not json' },
    ]),
    'owner',
    'build',
  )
  assert.deepEqual(stats.get('a.example|small'), { wins: 1, losses: 0 })
  assert.deepEqual(stats.get('b.example|strong'), { wins: 1, losses: 0 })
  assert.equal(stats.size, 2)
})

test('chat routing keeps older routes without a task field', async () => {
  const stats = await loadTaskQuality(
    fakeDb([
      { rating: 'up', route: JSON.stringify({ drafters: ['a.example|small'] }) },
      { rating: 'down', route: JSON.stringify({ task: 'build', drafters: ['b.example|strong'] }) },
    ]),
    'owner',
    'chat',
  )
  assert.deepEqual(stats.get('a.example|small'), { wins: 1, losses: 0 })
  assert.equal(stats.get('b.example|strong'), undefined)
})
