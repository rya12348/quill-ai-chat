import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanReactionEmoji, ROOM_DISPLAY_NAME_CHARS, ROOM_ID, ROOM_MESSAGE_CHARS, ROOM_MESSAGE_TTL_MS } from '../src/shared/config'
import type { Env } from '../src/worker/env'
import { cleanRoomAuthorId, cleanRoomDisplayName, cleanRoomMessage, isRoomOwnerMessage, mapRoomMessage, mapRoomSummary, purgeExpiredRoomMessages, roomAuthorId, roomAuthorName, roomMessageCutoff } from '../src/worker/routes/room'
import { createRealtimeTicket, publishRealtime } from '../src/worker/realtime'
import { cleanRoomPersonLabel, inviteRoomPeople } from '../src/worker/room-people'

test('a private person label is normalized and bounded', () => {
  assert.equal(cleanRoomPersonLabel('  Sam from class  '), 'Sam from class')
  assert.equal(cleanRoomPersonLabel('bad\u0000 name'), 'bad name')
  assert.equal(cleanRoomPersonLabel(''), null)
  assert.equal(cleanRoomPersonLabel('   '), null)
  assert.equal(cleanRoomPersonLabel(42), null)
  assert.equal(cleanRoomPersonLabel('x'.repeat(60))?.length, 40)
})

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
    async batch(statements: { run: () => Promise<{ success: boolean }> }[]) {
      for (const statement of statements) await statement.run()
    },
  } as unknown as D1Database
  const at = 1_800_000_000_000

  await purgeExpiredRoomMessages(db, at)

  assert.equal(calls.length, 3)
  assert.match(calls[0].sql, /DELETE FROM room_message_attachments/)
  assert.deepEqual(calls[0].values, [ROOM_ID, at - ROOM_MESSAGE_TTL_MS])
  assert.match(calls[1].sql, /DELETE FROM room_message_reactions/)
  assert.deepEqual(calls[1].values, [ROOM_ID, ROOM_ID, at - ROOM_MESSAGE_TTL_MS])
  assert.match(calls[2].sql, /DELETE FROM room_messages/)
  assert.match(calls[2].sql, /created_at <= \?/)
  assert.deepEqual(calls[2].values, [ROOM_ID, at - ROOM_MESSAGE_TTL_MS])
})

test('any single emoji is a valid reaction, but text is not', () => {
  assert.equal(cleanReactionEmoji('❤️'), '❤️')
  assert.equal(cleanReactionEmoji('🦄'), '🦄')
  assert.equal(cleanReactionEmoji(' 👍🏽 '), '👍🏽')
  assert.equal(cleanReactionEmoji('👨‍👩‍👧‍👦'), '👨‍👩‍👧‍👦')
  assert.equal(cleanReactionEmoji('🇺🇸'), '🇺🇸')
  assert.equal(cleanReactionEmoji('1️⃣'), '1️⃣')
  assert.equal(cleanReactionEmoji('lol'), null)
  assert.equal(cleanReactionEmoji('❤️ lol'), null)
  assert.equal(cleanReactionEmoji('42'), null)
  assert.equal(cleanReactionEmoji(''), null)
  assert.equal(cleanReactionEmoji(42), null)
})

test('a direct invite grants access and creates an unseen notification', async () => {
  const at = 1_800_000_000_000
  const selects: { sql: string; values: unknown[] }[] = []
  const writes: { sql: string; values: unknown[] }[] = []
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          if (/FROM room_people\s+WHERE author_id IN/.test(sql)) {
            selects.push({ sql, values })
            return {
              all: async () => ({
                results: [
                  { user_sub: 'guest:person', author_id: 'aaaaaaaaaaaa', display_name: 'Ada' },
                ],
              }),
            }
          }
          writes.push({ sql, values })
          return {}
        },
      }
    },
    async batch(statements: unknown[]) {
      assert.equal(statements.length, 1)
    },
  } as unknown as D1Database

  const invited = await inviteRoomPeople(db, 'private-room', 'guest:owner', ['AAAAAAAAAAAA'], at)
  assert.deepEqual(invited, [{ userSub: 'guest:person', authorId: 'aaaaaaaaaaaa', name: 'Ada' }])
  assert.deepEqual(selects[0].values, ['aaaaaaaaaaaa', 'guest:owner'])
  assert.match(writes[0].sql, /INSERT INTO room_access/)
  assert.match(writes[0].sql, /invite_seen/)
  assert.deepEqual(writes[0].values, ['private-room', 'guest:person', at, at, 'guest:owner'])
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

test('a custom chat name overrides the account name and stays within the limit', () => {
  assert.equal(roomAuthorName({ name: 'Alex Morgan' }, 'abcdef123456', '  Ada   Lovelace  '), 'Ada Lovelace')
  assert.equal(roomAuthorName({ name: 'Guest' }, 'abcdef123456', 'Grace Hopper'), 'Grace Hopper')
  assert.equal(roomAuthorName({ name: 'Alex Morgan' }, 'abcdef123456', '   '), 'Alex Morgan')
  assert.equal(cleanRoomDisplayName('x'.repeat(ROOM_DISPLAY_NAME_CHARS)), 'x'.repeat(ROOM_DISPLAY_NAME_CHARS))
  assert.equal(cleanRoomDisplayName('x'.repeat(ROOM_DISPLAY_NAME_CHARS + 1)), null)
  assert.equal(cleanRoomDisplayName('  Ada\n\u0000 Lovelace  '), 'Ada Lovelace')
  assert.equal(cleanRoomDisplayName('   '), null)
})

test('a room rename target must be a public message tag', () => {
  assert.equal(cleanRoomAuthorId('ABCDEF123456'), 'abcdef123456')
  assert.equal(cleanRoomAuthorId('  abcdef123456  '), 'abcdef123456')
  assert.equal(cleanRoomAuthorId('account:492bd1fd'), null)
  assert.equal(cleanRoomAuthorId('abcdef12345'), null)
  assert.equal(cleanRoomAuthorId(42), null)
})

test('only the developer account gets the quiet owner marker', () => {
  const env = {} as Env
  assert.equal(isRoomOwnerMessage(env, 'dev-user', 'alex@example.com'), true)
  assert.equal(isRoomOwnerMessage(env, 'account:owner', 'davehall1248@gmail.com'), true)
  assert.equal(isRoomOwnerMessage(env, 'account:someone', 'someone@example.com'), false)
  assert.equal(isRoomOwnerMessage({ OWNER_SUB: 'account:pinned' } as Env, 'account:pinned', null), true)
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
  assert.equal(Object.hasOwn(message, 'authorOwner'), false)
  assert.equal(mapRoomMessage({
    id: 'm2',
    room: 'lobby',
    author_sub: 'dev-user',
    author_id: 'abcdef123456',
    author_name: 'Alex Morgan',
    body: 'hello',
    created_at: 124,
  }, true).authorOwner, true)
})

test('a room summary marks invite-only access without changing ownership', () => {
  const room = {
    id: 'private-room',
    name: 'Study group',
    visibility: 'private' as const,
    password_hash: 'hash',
    created_by: 'creator',
    invite_token: 'a'.repeat(32),
    created_at: 123,
  }
  assert.equal(mapRoomSummary(room, 'creator', true).createdByMe, true)
  assert.equal(mapRoomSummary(room, 'creator', true).invited, undefined)
  assert.equal(mapRoomSummary(room, 'invitee', true, false).invited, undefined)
  assert.equal(mapRoomSummary(room, 'invitee', true, true).invited, true)
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