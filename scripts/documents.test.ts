import assert from 'node:assert/strict'
import test from 'node:test'

import { isDocumentFile, normalizeDocumentText } from '../src/shared/documents'

test('recognises PDF and DOCX documents, not other files', () => {
  assert.equal(isDocumentFile('paper.pdf'), true)
  assert.equal(isDocumentFile('Report.DOCX'), true)
  assert.equal(isDocumentFile('notes.txt'), false)
  assert.equal(isDocumentFile('old.doc'), false)
})

test('collapses extraction whitespace without joining paragraphs', () => {
  assert.equal(normalizeDocumentText('Hello   world \n\n\n\nSecond  line\r\n', 1000).text, 'Hello world\n\nSecond line')
})

test('keeps a short document exactly as extracted', () => {
  const result = normalizeDocumentText('A short abstract.', 1000)
  assert.deepEqual(result, { text: 'A short abstract.', truncated: false })
})

test('caps a long document and states how much was dropped', () => {
  const raw = 'word '.repeat(400).trim()
  const result = normalizeDocumentText(raw, 300)
  assert.equal(result.truncated, true)
  assert.ok(result.text.length <= 300)
  assert.ok(result.text.includes('[Document truncated:'))
  assert.ok(result.text.endsWith(']'))
})
