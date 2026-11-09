import assert from 'node:assert/strict'
import test from 'node:test'

import { MAX_TEXT_ATTACHMENT_CHARS } from '../src/shared/config'
import { messageWithAttachments, parseAttachments } from '../src/worker/attachments'

const document = (text: string) => [{ name: 'paper.pdf', mime: 'text/plain', kind: 'text' as const, data: text }]

test('accepts extracted document text up to the attachment limit', () => {
  const parsed = parseAttachments(document('a'.repeat(30_000)))
  assert.equal(parsed[0]?.kind, 'text')
  assert.equal(parsed[0]?.name, 'paper.pdf')
  assert.equal(parsed[0]?.size, 30_000)
})

test('refuses a document above the limit', () => {
  assert.throws(
    () => parseAttachments(document('a'.repeat(MAX_TEXT_ATTACHMENT_CHARS + 1))),
    /40,000 characters/,
  )
})

test('labels the document and clips long text in the model prompt', () => {
  const parsed = parseAttachments(document('x'.repeat(MAX_TEXT_ATTACHMENT_CHARS)))
  const prompt = messageWithAttachments({ role: 'user', content: 'Summarise this paper.' }, parsed)
  assert.equal(typeof prompt.content, 'string')
  const content = prompt.content as string
  assert.ok(content.includes('--- Attached file: paper.pdf (text/plain) ---'))
  assert.ok(content.startsWith('Summarise this paper.'))
  assert.ok(content.includes('[file truncated for context]'))
  assert.ok(content.length < MAX_TEXT_ATTACHMENT_CHARS)
})
