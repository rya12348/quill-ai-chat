import assert from 'node:assert/strict'
import test from 'node:test'

import { pickResults, sourceBrief, sourceDocument } from '../src/worker/research'
import { readPage, type SearchResult } from '../src/worker/search'

const question = 'write a short research paper on the causes of the French Revolution, 4 sources'

const results: SearchResult[] = [
  {
    title: 'Causes of the French Revolution',
    url: 'https://history.example/french-revolution',
    snippet: 'France faced a financial crisis, social division and political conflict.',
  },
  {
    title: 'French Revolution: the Estates General and the monarchy',
    url: 'https://civics.example/estates-general',
    snippet: 'King Louis XVI called the Estates General in 1789 during the French Revolution.',
  },
  {
    title: 'French Revolution: bread prices and popular unrest',
    url: 'https://economics.example/bread-prices',
    snippet: 'Poor harvests and rising bread prices pushed Parisians toward revolt during the French Revolution.',
  },
  {
    title: 'Greek government',
    url: 'https://news.example/greek-government',
    snippet: 'Greece faced a sovereign debt crisis after the 2008 financial crisis.',
  },
]

const evidence = [
  {
    title: 'Causes of the French Revolution',
    url: 'https://history.example/french-revolution',
    host: 'history.example',
    snippet: '',
    text: 'France faced a severe financial crisis caused by war debt and an unfair tax system. French society was divided into three estates, with the nobility and clergy enjoying privileges. Enlightenment ideas about liberty and equality challenged the old order.',
    opened: true,
  },
  {
    title: 'The Estates General and the monarchy',
    url: 'https://civics.example/estates-general',
    host: 'civics.example',
    snippet: '',
    text: 'King Louis XVI called the Estates General in 1789 to solve the fiscal crisis. The Third Estate declared itself a national assembly after a dispute over voting.',
    opened: true,
  },
  {
    title: 'Bread prices and popular unrest',
    url: 'https://economics.example/bread-prices',
    host: 'economics.example',
    snippet: '',
    text: 'Poor harvests and rising bread prices pushed ordinary Parisians toward revolt. The cost of living and food shortages made the monarchy increasingly unpopular.',
    opened: true,
  },
]

test('research drops results that do not overlap with the question', () => {
  const picked = pickResults(results, question)
  assert.ok(picked.some((result) => result.title === 'Causes of the French Revolution'))
  assert.ok(!picked.some((result) => result.title === 'Greek government'))
})

test('an explicit source count caps the selected sources', () => {
  const extra = [
    { title: 'French Revolution overview', url: 'https://overview.example/french-revolution', snippet: 'A short history of the French Revolution.' },
    { title: 'French Revolution timeline', url: 'https://timeline.example/french-revolution', snippet: 'A timeline of the French Revolution.' },
    { title: 'French Revolution of 1848', url: 'https://later.example/french-revolution-1848', snippet: 'A later French revolution.' },
  ]
  const picked = pickResults([...results, ...extra], question, 4)
  assert.equal(picked.length, 4)
  assert.ok(!picked.some((result) => result.title === 'Greek government'))
  assert.ok(!picked.some((result) => result.title === 'French Revolution of 1848'))
})

test('the document fallback synthesizes themes instead of reviewing sources one by one', () => {
  const picked = pickResults(results, question)
  const document = sourceDocument(
    picked.map((result) => ({
      ...result,
      host: new URL(result.url).hostname,
      text: evidence.find((item) => item.url === result.url)?.text ?? result.snippet,
      opened: true,
    })),
    question,
  )
  assert.ok(document)
  assert.match(document, /## (?!Introduction|Conclusion|What the evidence shows)/)
  assert.doesNotMatch(document, /Economic pressures|Social divisions|Political conflict|Ideas and culture/)
  assert.match(document, /social divisions|three estates/i)
  assert.match(document, /\[1\]/)
  assert.doesNotMatch(document, /### /)
  assert.doesNotMatch(document, /Greek government/)
  assert.doesNotMatch(document, /Review of the sources/)
})

test('a causal paper ignores definitions and unrelated revolutions', () => {
  const document = sourceDocument(
    [
      {
        title: 'Causes of the French Revolution',
        url: 'https://history.example/causes',
        host: 'history.example',
        snippet: '',
        text: 'The French Revolution was a period of political upheaval. The Haitian Revolution was an armed conflict in the Caribbean. Many of the revolution\'s ideas are considered fundamental principles of liberal democracy. France faced a severe financial crisis caused by war debt and an unfair tax system.',
        opened: true,
      },
      {
        title: 'French Revolution: bread and the Estates General',
        url: 'https://civics.example/causes',
        host: 'civics.example',
        snippet: '',
        text: 'Poor harvests and rising bread prices pushed ordinary Parisians toward revolt. King Louis XVI called the Estates General in 1789 to solve the fiscal crisis.',
        opened: true,
      },
    ],
    question,
  )
  assert.ok(document)
  assert.doesNotMatch(document, /Haitian Revolution/)
  assert.doesNotMatch(document, /was a period/)
  assert.doesNotMatch(document, /Many of the revolution's ideas/)
  assert.match(document, /financial crisis caused by war debt/)
})

test('the document fallback handles non-history questions', () => {
  const document = sourceDocument(
    [
      {
        title: 'Photosynthesis',
        url: 'https://biology.example/photosynthesis',
        host: 'biology.example',
        snippet: '',
        text: 'Photosynthesis is the process plants use to convert light energy into chemical energy. Chlorophyll absorbs light, while carbon dioxide and water are used to build sugars. Oxygen is released as a by-product.',
        opened: true,
      },
      {
        title: 'How plants make food',
        url: 'https://botany.example/plant-food',
        host: 'botany.example',
        snippet: '',
        text: 'Plants take in carbon dioxide through their leaves and water through their roots. The light reactions produce energy carriers that power the Calvin cycle.',
        opened: true,
      },
    ],
    'how does photosynthesis work?',
  )
  assert.ok(document)
  assert.match(document, /Photosynthesis/i)
  assert.doesNotMatch(document, /Economic pressures|Social divisions|Political conflict|Ideas and culture/)
  assert.match(document, /## (?!Introduction|Conclusion|What the evidence shows)/)
})

test('causal document fallback works outside history too', () => {
  const document = sourceDocument(
    [
      {
        title: 'What caused inflation in 2022?',
        url: 'https://economics.example/inflation-2022',
        host: 'economics.example',
        snippet: '',
        text: 'Inflation in 2022 was driven by supply chain disruptions and strong consumer demand. Energy prices rose because Russia curtailed gas exports.',
        opened: true,
      },
      {
        title: 'Inflation and interest rates',
        url: 'https://finance.example/rates',
        host: 'finance.example',
        snippet: '',
        text: 'Central banks raised interest rates because inflation remained high. Higher borrowing costs can reduce demand and slow price growth.',
        opened: true,
      },
    ],
    'what caused inflation in 2022?',
  )
  assert.ok(document)
  assert.match(document, /Inflation/i)
  assert.match(document, /\[1\]/)
})

test('source selection respects years named in the question, not a fixed topic', () => {
  const picked = pickResults(
    [
      { title: '2024 United States election results', url: 'https://news.example/2024-election', snippet: 'Results from the 2024 election.' },
      { title: '2020 United States election results', url: 'https://news.example/2020-election', snippet: 'Results from the 2020 election.' },
      { title: 'What happened in the 2024 election', url: 'https://civics.example/2024-election', snippet: 'A guide to the 2024 election.' },
    ],
    'what happened in the 2024 United States election?',
    2,
  )
  assert.ok(picked.some((result) => result.title.includes('2024')))
  assert.ok(!picked.some((result) => result.title.includes('2020')))
})

test('the report fallback returns a cited thematic brief', () => {
  const brief = sourceBrief(evidence, question)
  assert.ok(brief)
  assert.match(brief, /^## Answer/m)
  assert.match(brief, /## What the sources say/)
  assert.match(brief, /\[1\]/)
  assert.doesNotMatch(brief, /The sources gathered for this question point to the evidence summarized below/)
})

test('page reads prefer article text over navigation and footer boilerplate', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(
      `<!doctype html><html><head><title>French Revolution background</title></head><body>
       <nav>Cookie settings and menu links</nav>
       <article><h1>French Revolution background</h1><p>France faced a financial crisis and social division before 1789. The Estates General met at Versailles and the Third Estate demanded a national assembly.</p></article>
       <footer>All rights reserved and privacy policy</footer>
       </body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } },
    )) as typeof fetch
  try {
    const page = await readPage('https://history.example/article')
    assert.ok(page)
    assert.match(page.text, /France faced a financial crisis/)
    assert.doesNotMatch(page.text, /Cookie settings/)
    assert.doesNotMatch(page.text, /All rights reserved/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
