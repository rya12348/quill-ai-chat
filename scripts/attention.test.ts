import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { addAttention, clearAttention, setAttentionCount, setInviteAttention } from '../src/app/lib/attention'

type BadgeNavigator = Navigator & {
  setAppBadge?: (count: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

const documentStub = { title: 'Ink' }
if (typeof globalThis.document === 'undefined') {
  Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true })
}

const navigatorStub = (globalThis.navigator ?? {}) as BadgeNavigator
if (!globalThis.navigator) {
  Object.defineProperty(globalThis, 'navigator', { value: navigatorStub, configurable: true })
}

const badgeCalls = { set: [] as number[], clear: 0 }

Object.defineProperty(navigatorStub, 'setAppBadge', {
  configurable: true,
  value: async (count: number) => {
    badgeCalls.set.push(count)
  },
})
Object.defineProperty(navigatorStub, 'clearAppBadge', {
  configurable: true,
  value: async () => {
    badgeCalls.clear += 1
  },
})

beforeEach(() => {
  documentStub.title = 'Ink'
  clearAttention()
  badgeCalls.set.length = 0
  badgeCalls.clear = 0
})

test('unread messages format singular, plural, and capped titles and badges', () => {
  setAttentionCount(1)
  assert.equal(documentStub.title, '(1) new message · Ink')
  assert.deepEqual(badgeCalls.set, [1])

  setAttentionCount(2)
  assert.equal(documentStub.title, '(2) new messages · Ink')
  assert.deepEqual(badgeCalls.set, [1, 2])

  setAttentionCount(99)
  assert.equal(documentStub.title, '(99) new messages · Ink')

  setAttentionCount(100)
  assert.equal(documentStub.title, '(99+) new messages · Ink')
  assert.deepEqual(badgeCalls.set, [1, 2, 99, 100])
})

test('addAttention accumulates across rooms and clamps at zero', () => {
  addAttention(2, 'general')
  assert.equal(documentStub.title, '(2) new messages · Ink')

  addAttention(1, 'general')
  addAttention(2, 'lobby')
  assert.equal(documentStub.title, '(5) new messages · Ink')
  assert.deepEqual(badgeCalls.set, [2, 3, 5])

  addAttention(-10)
  assert.equal(documentStub.title, 'Ink')
  assert.equal(badgeCalls.clear, 1)
})

test('startup clears a stale tab title and app badge', () => {
  documentStub.title = '(7) new messages · Ink'

  clearAttention()

  assert.equal(documentStub.title, 'Ink')
  assert.equal(badgeCalls.clear, 1)
})

test('a room switch clears only that room and leaves other unread rooms counted', () => {
  addAttention(2, 'lobby')
  addAttention(1, 'general')
  assert.equal(documentStub.title, '(3) new messages · Ink')

  clearAttention('lobby')
  assert.equal(documentStub.title, '(1) new message · Ink')
  assert.deepEqual(badgeCalls.set, [2, 3, 1])

  clearAttention('lobby')
  assert.equal(documentStub.title, '(1) new message · Ink')

  clearAttention('general')
  assert.equal(documentStub.title, 'Ink')
  assert.equal(badgeCalls.clear, 1)
})

test('focus clears attention through a zero count update', () => {
  addAttention(2, 'lobby')

  setAttentionCount(0)

  assert.equal(documentStub.title, 'Ink')
  assert.equal(badgeCalls.clear, 1)
})

test('unmount clears every room and is safe to call again', () => {
  addAttention(2, 'lobby')
  addAttention(1, 'general')

  clearAttention()
  clearAttention()

  assert.equal(documentStub.title, 'Ink')
  assert.ok(badgeCalls.clear >= 1)
})

test('unseen invitations add a tab title and app badge without hiding message counts', () => {
  setInviteAttention(['studio'])
  assert.equal(documentStub.title, '(1) new invitation · Ink')
  assert.deepEqual(badgeCalls.set, [1])

  setInviteAttention(['studio', 'lobby'])
  assert.equal(documentStub.title, '(2) new invitations · Ink')

  addAttention(2, 'general')
  assert.equal(documentStub.title, '(4) new notifications · Ink')
  assert.deepEqual(badgeCalls.set, [1, 2, 4])

  setInviteAttention(['studio'])
  assert.equal(documentStub.title, '(3) new notifications · Ink')

  setInviteAttention([])
  assert.equal(documentStub.title, '(2) new messages · Ink')

  clearAttention('general')
  assert.equal(documentStub.title, 'Ink')
})

test('opening an invited room clears only that invitation', () => {
  setInviteAttention(['studio', 'lobby'])

  clearAttention('studio')
  assert.equal(documentStub.title, '(1) new invitation · Ink')

  clearAttention('lobby')
  assert.equal(documentStub.title, 'Ink')
})

test('a zero update clears invitation badges too', () => {
  setInviteAttention(['studio'])

  setAttentionCount(0)

  assert.equal(documentStub.title, 'Ink')
  assert.equal(badgeCalls.clear, 1)
})

test('clearAttention tolerates browsers without app badge support', () => {
  const setAppBadge = navigatorStub.setAppBadge
  const clearAppBadge = navigatorStub.clearAppBadge
  delete navigatorStub.setAppBadge
  delete navigatorStub.clearAppBadge

  try {
    setAttentionCount(2)
    assert.equal(documentStub.title, '(2) new messages · Ink')
    assert.doesNotThrow(() => clearAttention())
    assert.equal(documentStub.title, 'Ink')
  } finally {
    navigatorStub.setAppBadge = setAppBadge
    navigatorStub.clearAppBadge = clearAppBadge
  }
})
