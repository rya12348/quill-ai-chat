import assert from 'node:assert/strict'
import test from 'node:test'

import { analysisMarkdown, artifactSlug, canvasMarkdown, researchMarkdown } from '../src/shared/artifacts'

test('artifactSlug makes a filesystem-safe stem', () => {
  assert.equal(artifactSlug('Corner Roast | Coffee'), 'corner-roast-coffee')
  assert.equal(artifactSlug('  2026 Plan  '), '2026-plan')
  assert.equal(artifactSlug('***'), 'artifact')
  assert.equal(artifactSlug('a'.repeat(80)).length, 60)
  assert.ok(!artifactSlug('Trailing ---').endsWith('-'))
})

test('canvasMarkdown marks the right quiz answer and keeps explanations', () => {
  const markdown = canvasMarkdown({
    title: 'Cells',
    kind: 'quiz',
    questions: [
      {
        question: 'Powerhouse of the cell?',
        choices: ['Nucleus', 'Mitochondria'],
        answer: 1,
        explanation: 'Mitochondria make ATP.',
      },
    ],
  })
  assert.match(markdown, /^# Cells$/m)
  assert.match(markdown, /- \[ \] Nucleus/)
  assert.match(markdown, /- \[x\] Mitochondria/)
  assert.match(markdown, /_Mitochondria make ATP\._/)
})

test('canvasMarkdown lists both sides of flashcards in order', () => {
  const markdown = canvasMarkdown({ title: 'Deck', kind: 'flashcards', cards: [{ front: 'Hi', back: 'Hello' }] })
  assert.match(markdown, /## Hi\n\nHello/)
})

test('analysisMarkdown keeps the code, output and shape of the run', () => {
  const markdown = analysisMarkdown({
    status: 'verified',
    question: 'Which region grew fastest?',
    datasetId: 'dataset',
    fileName: 'sales.csv',
    code: 'print("west")',
    stdout: 'west',
    rows: 1200,
    columns: ['region', 'sales'],
    models: ['model'],
    asOf: 1,
  })
  assert.match(markdown, /Which region grew fastest\?/)
  assert.match(markdown, /```python\nprint\("west"\)\n```/)
  assert.match(markdown, /```text\nwest\n```/)
  assert.match(markdown, /1,200 rows · 2 columns/)
})

test('researchMarkdown appends numbered sources', () => {
  const markdown = researchMarkdown('Is the sky blue?', 'Yes, because of scattering.', [
    { title: 'Why is the sky blue?', url: 'https://example.com/sky' },
  ])
  assert.match(markdown, /^# Is the sky blue\?$/m)
  assert.match(markdown, /1\. \[Why is the sky blue\?\]\(https:\/\/example\.com\/sky\)/)
})

test('researchMarkdown leaves out the sources heading when there are none', () => {
  assert.doesNotMatch(researchMarkdown('Q', 'Body'), /## Sources/)
})
