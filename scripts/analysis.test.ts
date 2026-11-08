import assert from 'node:assert/strict'
import test from 'node:test'

import * as XLSX from 'xlsx'

import { ANALYZE_DAILY_LIMIT, BUILD_DAILY_LIMIT } from '../src/shared/config'
import { profileCsv } from '../src/shared/csv'
import { readDataFile } from '../src/app/lib/dataset'
import { isUnsafeAnalysisCode, parseDataset } from '../src/worker/analysis'
import { repairDocument } from '../src/shared/html'
import { extractHtml } from '../src/worker/build'
import { analysisToday, buildToday, parseAnalysis, parseBuild, parseCanvas } from '../src/worker/db'
import { findSiteTarget } from '../src/worker/site-proxy'

test('profiles a CSV header, rows and sample', () => {
  const profile = profileCsv('name,score\nAda,10\nGrace,12\n')
  assert.ok(profile)
  assert.deepEqual(profile.columns, ['name', 'score'])
  assert.equal(profile.rows, 2)
  assert.equal(profile.delimiter, ',')
  assert.match(profile.sample, /Ada,10/)
})

test('handles quoted commas and TSV', () => {
  const csv = profileCsv('name,note\nAda,"hello, world"\n')
  assert.ok(csv)
  assert.deepEqual(csv.columns, ['name', 'note'])
  const tsv = profileCsv('name\tscore\nAda\t10\n')
  assert.ok(tsv)
  assert.equal(tsv.delimiter, '\t')
  assert.deepEqual(tsv.columns, ['name', 'score'])
})

test('rejects a file with no header or data', () => {
  assert.equal(profileCsv(''), undefined)
  assert.equal(profileCsv('\n\n'), undefined)
  assert.equal(profileCsv('name,score\n'), undefined)
})

test('validates the browser dataset profile', () => {
  const dataset = {
    id: 'dataset-12345678',
    name: 'sales.csv',
    mime: 'text/csv',
    size: 164,
    rows: 8,
    columns: ['region', 'units'],
    sample: 'region,units\nNorth,10',
  }
  assert.deepEqual(parseDataset(dataset), dataset)
  assert.equal(parseDataset({ ...dataset, columns: [] }), undefined)
  assert.equal(parseDataset({ ...dataset, sample: '' }), undefined)
  assert.equal(parseDataset({ ...dataset, rows: 0 }), undefined)
})

test('converts an XLSX workbook in the browser dataset path', async () => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['name', 'score'],
      ['Ada', 10],
      ['Grace', 12],
    ]),
    'Scores',
  )
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
  const file = new File([bytes], 'scores.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const attachment = await readDataFile(file)
  assert.ok(attachment.dataset)
  assert.equal(attachment.dataset.name, 'scores.xlsx')
  assert.deepEqual(attachment.dataset.columns, ['name', 'score'])
  assert.equal(attachment.dataset.rows, 2)
  assert.match(attachment.data ?? '', /Ada,10/)
})

test('treats “run poki.com” as a live site, not a generated clone', () => {
  assert.equal(findSiteTarget('run poki.com'), 'https://poki.com/')
  assert.equal(findSiteTarget('run https://poki.com/'), 'https://poki.com/')
  assert.equal(findSiteTarget('play example.com'), 'https://example.com/')
  assert.equal(findSiteTarget('build a game like poki'), undefined)
  assert.equal(findSiteTarget('show localhost:3000'), undefined)
})

test('rejects unsafe Python and accepts a normal pandas program', () => {
  assert.equal(isUnsafeAnalysisCode('print(df.head())'), false)
  assert.equal(isUnsafeAnalysisCode('plt.bar(df["name"], df["score"])'), false)
  assert.equal(isUnsafeAnalysisCode("open('/etc/passwd').read()"), true)
  assert.equal(isUnsafeAnalysisCode("pd.read_csv('secret.csv')"), true)
  assert.equal(isUnsafeAnalysisCode('import os\nprint(os.listdir())'), true)
  assert.equal(isUnsafeAnalysisCode('df.head()'), true)
})

test('parses a persisted analysis and decays an abandoned checking state', () => {
  const info = {
    status: 'verified',
    question: 'Which product wins?',
    datasetId: 'dataset-12345678',
    fileName: 'sales.csv',
    code: 'print(df.head())',
    stdout: 'Alpha 520',
    rows: 8,
    columns: ['product', 'revenue'],
    models: ['A model'],
    asOf: Date.now(),
  }
  const parsed = parseAnalysis(JSON.stringify({ info }))
  assert.ok(parsed)
  assert.equal(parsed.status, 'verified')
  assert.equal(parsed.datasetId, info.datasetId)
  assert.equal(parsed.stdout, 'Alpha 520')

  const stale = parseAnalysis(JSON.stringify({ info: { ...info, status: 'checking', asOf: Date.now() - 11 * 60_000 } }))
  assert.ok(stale)
  assert.equal(stale.status, 'unverified')
  assert.match(stale.reason ?? '', /did not finish/)
})

test('parses a generated build and rejects an empty one', () => {
  const build = {
    status: 'ready',
    title: 'Tip splitter',
    html: '<!doctype html><html><head><title>Tip splitter</title></head><body></body></html>',
    models: ['A model'],
    asOf: Date.now(),
  }
  assert.equal(parseBuild(JSON.stringify({ info: build }))?.title, 'Tip splitter')
  assert.equal(parseBuild(JSON.stringify({ info: { ...build, html: '' } })), undefined)
})

test('closes an unclosed style tag so the page is not swallowed as CSS', () => {
  const broken =
    '<!doctype html><html><head><title>Coffee</title><style>body{background:#fff}<header><h1>Coffee</h1></header></body></html>'
  const fixed = repairDocument(broken)
  assert.match(fixed, /<\/style>\s*<header>/)
  assert.equal((fixed.match(/<\/style>/gi) ?? []).length, 1)
  const page = '<!doctype html><html><head><title>Coffee</title><style>body{color:#333}</style></head><body><h1>Coffee</h1></body></html>'
  assert.equal(repairDocument(page), page)
})

test('ignores an echoed prompt and keeps the real build document', () => {
  const echo =
    'Return ONLY the document, starting with <!doctype html> and ending with </html>. Key requirements: - Semantic HTML - Responsive layouts'
  assert.equal(extractHtml(echo), undefined)
  const page =
    '<!doctype html><html><head><title>Coffee</title></head><body><h1>Coffee</h1><p>Fresh coffee on Maple Street, open from seven every morning.</p></body></html>'
  assert.equal(extractHtml(`${echo}\n\n${page}`), page)
  assert.equal(extractHtml(`Here you go:\n\`\`\`html\n${page}\n\`\`\``), page)
  // A page that omits head/body is still the page, and a trailing sentence
  // mentioning the tags must not beat it.
  const loose =
    '<!doctype html><html><style>body{color:#333}</style><div><h1>Coffee</h1><p>Fresh coffee on Maple Street, open from seven every morning.</p></div></html>'
  assert.equal(extractHtml(loose), loose)
  assert.equal(extractHtml(`${page}\n\nThat is the complete <html> page.`), page)
  // A CSS-only shell is a blank preview, not a page.
  const shell = '<!doctype html><html><head><title>Shell</title><style>body{background:#fff}</style></head><body></body></html>'
  assert.equal(extractHtml(shell), undefined)
  // Neither is a heading followed by "..." placeholders.
  const dots =
    '<!doctype html><html><body><h1>Corner Roast</h1><p>...</p><p>...</p><p>...</p><p>...</p><p>...</p></body></html>'
  assert.equal(extractHtml(dots), undefined)
})

test('parses a generated canvas set and rejects an empty one', () => {
  const info = {
    status: 'ready',
    kind: 'flashcards',
    title: 'Cell basics',
    cards: [{ front: 'Mitochondria', back: 'Produces ATP' }],
    models: ['A model'],
    asOf: Date.now(),
  }
  assert.equal(parseCanvas(JSON.stringify({ info }))?.cards?.length, 1)
  assert.equal(parseCanvas(JSON.stringify({ info: { ...info, cards: [] } })), undefined)
})

test('uses separate daily caps and counter queries', async () => {
  assert.equal(ANALYZE_DAILY_LIMIT, 3)
  assert.equal(BUILD_DAILY_LIMIT, 3)
  const fake = {
    prepare: () => ({ bind: () => ({ first: async () => ({ n: 3 }) }) }),
  } as unknown as D1Database
  assert.equal(await analysisToday(fake, 'owner'), 3)
  assert.equal(await buildToday(fake, 'owner'), 3)
})
