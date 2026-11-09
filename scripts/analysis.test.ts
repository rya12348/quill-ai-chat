import assert from 'node:assert/strict'
import test from 'node:test'

import * as XLSX from 'xlsx'

import { ANALYZE_DAILY_LIMIT, BUILD_DAILY_LIMIT, MAX_SUMMARY_CHARS } from '../src/shared/config'
import { profileCsv } from '../src/shared/csv'
import { readDataFile } from '../src/app/lib/dataset'
import { isUnsafeAnalysisCode, parseDataset } from '../src/worker/analysis'
import { repairDocument } from '../src/shared/html'
import { extractHtml, extractPages } from '../src/worker/build'
import { pickPhotos, photoQuery } from '../src/worker/photos'
import { normalizeMemory } from '../src/shared/memory'
import { elapsedLabel } from '../src/shared/receipt'
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
  // Mangled CSS and corrupted closing tags are rejected too: they render as a
  // half-styled page even though the copy is there.
  const mangled =
    '<!doctype html><html><head><title>Bakery</title><style>.hero{width:100%;height:100%</style></head><body><h1>Crumb &amp; Co</h1><p>Fresh bread baked every morning on Oak Street.</p></body></html>'
  assert.equal(extractHtml(mangled), undefined)
  const spaced =
    '<!doctype html><html><body><h1>Crumb &amp; Co</h1><p>Fresh bread baked every morning on Oak Street.</p></ h1></body></html>'
  assert.equal(extractHtml(spaced), undefined)
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

test('splits a multi-page build and drops a broken page', () => {
  const page = (title: string, copy: string) =>
    `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>${copy}</p><a href="menu.html">Menu</a></body></html>`
  const two = extractPages(
    [
      '<!-- page: index.html -->',
      page('Oak Street Roast', 'Fresh coffee roasted on Oak Street every morning since 2019.'),
      '<!-- page: menu.html -->',
      page('Menu', 'Espresso, flat white and a filter of the day, all under five dollars.'),
    ].join('\n'),
  )
  assert.equal(two.length, 2)
  assert.equal(two[0].name, 'index.html')
  assert.equal(two[1].name, 'menu.html')
  // A nav link to a generated page becomes a preview tab link.
  assert.match(two[0].html, /href="#page:menu"/)
  // A truncated second page is dropped rather than failing the whole build.
  const broken = extractPages(
    [
      '<!-- page: index.html -->',
      page('Oak Street Roast', 'Fresh coffee roasted on Oak Street every morning since 2019.'),
      '<!-- page: menu.html -->',
      '<!doctype html><html><body><h1>Menu',
    ].join('\n'),
  )
  assert.equal(broken.length, 1)
  // No markers still means one page.
  assert.equal(extractPages(page('Solo', 'A single page about one topic, with enough real copy to pass.')).length, 1)
})

test('keeps the extra pages of a multi-page build', () => {
  const index = '<!doctype html><html><body><h1>Oak Street Roast</h1></body></html>'
  const info = {
    status: 'ready',
    kind: 'page',
    title: 'Oak Street Roast',
    html: index,
    pages: [
      { name: 'index.html', html: index },
      { name: 'menu.html', html: '<!doctype html><html><body><h1>Menu</h1></body></html>' },
    ],
    models: ['A model'],
    asOf: Date.now(),
  }
  const parsed = parseBuild(JSON.stringify({ info }))
  assert.equal(parsed?.pages?.length, 2)
  assert.equal(parsed?.pages?.[1].name, 'menu.html')
  // A single page stays a single page.
  assert.equal(parseBuild(JSON.stringify({ info: { ...info, pages: [info.pages[0]] } }))?.pages, undefined)
})

test('turns a request into a photo subject, not web-page words', () => {
  assert.equal(
    photoQuery('Build a 2-page website for a neighborhood bakery called Crumb & Co, with photos and gentle animations'),
    'neighborhood bakery',
  )
  assert.equal(photoQuery('Build a landing page for a coffee shop with animations'), 'coffee shop')
  assert.equal(photoQuery('make me a portfolio for a wedding photographer named Ana'), 'wedding photographer')
})

test('keeps only usable landscape photographs from Commons', () => {
  const info = (width: number, height: number, mime: string, license: string) => [
    {
      url: `https://upload.wikimedia.org/wikipedia/commons/${width}.jpg`,
      thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/${width}.jpg`,
      width,
      height,
      mime,
      extmetadata: {
        LicenseShortName: { value: license },
        Artist: { value: `<a href="#">A Photographer</a>` },
      },
    },
  ]
  const photos = pickPhotos(
    [
      { title: 'File:Bakery counter.jpg', imageinfo: info(4000, 2600, 'image/jpeg', 'CC BY-SA 4.0') },
      { title: 'File:Bakery portrait.jpg', imageinfo: info(1200, 2000, 'image/jpeg', 'CC BY 4.0') },
      { title: 'File:Bakery logo.svg', imageinfo: info(1200, 800, 'image/svg+xml', 'CC0') },
      { title: 'File:Map of bakeries.jpg', imageinfo: info(2000, 1200, 'image/jpeg', 'CC BY 4.0') },
      { title: 'File:The Erotic Bakery, Seattle.jpg', imageinfo: info(2500, 1600, 'image/jpeg', 'CC BY 3.0') },
      { title: 'File:Bakery ovens.jpg', imageinfo: info(3000, 2000, 'image/jpeg', 'CC BY 2.0') },
    ],
    4,
    'bakery',
  )
  assert.equal(photos.length, 2)
  assert.match(photos[0].url, /^https:\/\/thumb\.wikimedia\.org\//)
  assert.equal(photos[0].credit, 'A Photographer')
  assert.equal(photos[0].license, 'CC BY-SA 4.0')
  assert.equal(photos[0].alt, 'bakery photograph')
  assert.equal(photos[1].license, 'CC BY 2.0')
})

test('labels reply time without inventing precision', () => {
  assert.equal(elapsedLabel(4_200), '4s')
  assert.equal(elapsedLabel(59_600), '1m')
  assert.equal(elapsedLabel(78_000), '1m 18s')
  assert.equal(elapsedLabel(0), '0s')
  assert.equal(elapsedLabel(-5), '0s')
})

test('normalises an edited memory before it is stored', () => {
  assert.equal(normalizeMemory('  Ada\n\nprefers  tea  '), 'Ada prefers tea')
  assert.equal(normalizeMemory('   \n  '), undefined)
  const long = normalizeMemory('x'.repeat(MAX_SUMMARY_CHARS + 500))
  assert.equal(long?.length, MAX_SUMMARY_CHARS)
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
