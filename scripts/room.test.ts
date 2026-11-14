import assert from 'node:assert/strict'
import test from 'node:test'

import { ROOM_ID, ROOM_MESSAGE_CHARS, ROOM_MESSAGE_TTL_MS } from '../src/shared/config'
import type { Env } from '../src/worker/env'
import { cleanRoomMessage, mapRoomMessage, purgeExpiredRoomMessages, roomAuthorId, roomAuthorName, roomMessageCutoff } from '../src/worker/routes/room'
import { createRealtimeTicket, publishRealtime } from '../src/worker/realtime'

test('room messages are bounded and normalized', () => {
  assert.equal(cleanRoomMessage('  hello\r\nworld  '), 'hello\nworld')
  assert.equal(cleanRoomMessage('bad\u0000\u0007 text'), 'bad text')
  assert.equal(cleanRoomMessage('   '), null)
  assert.equal(cleanRoomMessage(42), null)
  assert.equal(cleanRoomMessage('x'.repeat(ROOM_MESSAGE_CHARS)), 'x'.repeat(ROOM_MESSAGE_CHARS))
  assert.equal(cleanRoomMessage('x'.repeat(ROOM_MESSAGE_CHARS + 1)), null)
})

test('room messages expire at the thirty-minute boundary', () => {
  const createdAt = 1_800_000_000_000
  assert.equal(ROOM_MESSAGE_TTL_MS, 30 * 60_000)
  assert.equal(createdAt > roomMessageCutoff(createdAt + ROOM_MESSAGE_TTL_MS - 1), true)
  assert.equal(createdAt > roomMessageCutoff(createdAt + ROOM_MESSAGE_TTL_MS), false)
})

test('expired room messages are permanently deleted', async () => {
  const calls: { sql: string; values: unknown[] }[] = []
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values })
          return { run: async () => ({ success: true }) }
        },
      }
    },
  } as unknown as D1Database
  const at = 1_800_000_000_000

  await purgeExpiredRoomMessages(db, at)

  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /DELETE FROM room_messages/)
  assert.match(calls[0].sql, /created_at <= \?/)
  assert.deepEqual(calls[0].values, [ROOM_ID, at - ROOM_MESSAGE_TTL_MS])
})

test('the public author tag is stable and does not expose the account id', async () => {
  const first = await roomAuthorId('guest:2f1c3d5b-9e4a-4b7c-8d1e-6a2b3c4d5e6f')
  const second = await roomAuthorId('guest:2f1c3d5b-9e4a-4b7c-8d1e-6a2b3c4d5e6f')
  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{12}$/)
  assert.equal(first.includes('2f1c3d5b'), false)
  assert.notEqual(first, await roomAuthorId('dev-user'))
})

test('guest display names are distinguishable without an account', () => {
  assert.equal(roomAuthorName({ name: 'Guest' }, 'abcdef123456'), 'Guest ABCD')
  assert.equal(roomAuthorName({}, 'abcdef123456'), 'Guest ABCD')
  assert.equal(roomAuthorName({ name: 'Alex Morgan' }, 'abcdef123456'), 'Alex Morgan')
  assert.equal(roomAuthorName({ email: 'alex.morgan@example.com' }, 'abcdef123456'), 'Alex Morgan')
})

test('the room projection never exposes the private author id', () => {
  const message = mapRoomMessage({
    id: 'm1',
    room: 'lobby',
    author_sub: 'guest:private',
    author_id: 'abcdef123456',
    author_name: 'Guest ABCD',
    body: 'hello',
    created_at: 123,
  })
  assert.deepEqual(message, {
    id: 'm1',
    room: 'lobby',
    body: 'hello',
    authorName: 'Guest ABCD',
    authorId: 'abcdef123456',
    createdAt: 123,
  })
  assert.equal(Object.hasOwn(message, 'author_sub'), false)
})

test('server realtime helpers send tickets and trusted publishes to the hub', async () => {
  const calls: { path: string; body: Record<string, unknown> }[] = []
  const env = {
    REALTIME: {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: async (request: Request) => {
          calls.push({ path: new URL(request.url).pathname, body: (await request.json()) as Record<string, unknown> })
          return Response.json({ ticket: 'ticket', expiresAt: 1, websocketUrl: 'wss://example.test/room' })
        },
      }),
    },
  } as unknown as Env

  const ticket = await createRealtimeTicket(env, {
    room: 'lobby',
    userId: 'guest:test',
    origin: 'https://stet.example',
    publish: false,
    presence: true,
  })
  assert.equal(ticket.websocketUrl, 'wss://example.test/room')

  await publishRealtime(env, { room: 'lobby', event: 'room_message', data: { id: 'm1' } })
  assert.deepEqual(calls, [
    {
      path: '/ticket',
      body: {
        room: 'lobby',
        userId: 'guest:test',
        origin: 'https://stet.example',
        publish: false,
        presence: true,
      },
    },
    { path: '/publish', body: { room: 'lobby', event: 'room_message', data: { id: 'm1' } } },
  ])
  await assert.rejects(() =>
    createRealtimeTicket({} as Env, {
      room: 'lobby',
      userId: 'guest:test',
      origin: 'https://stet.example',
    }),
  )
})