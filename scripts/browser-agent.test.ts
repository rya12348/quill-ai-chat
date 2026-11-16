import assert from 'node:assert/strict'
import test from 'node:test'

import { compactBrowserAgentHistory, diffBrowserState, isSimpleBrowserReadTask, missionFromTask, parseBrowserAgentCall, parseBrowserAgentQuickAnswer, summarizeBrowserState } from '../src/shared/browser-agent'
import type { BrowserViewState } from '../src/shared/types'

function page(overrides: Partial<BrowserViewState> = {}): BrowserViewState {
  return {
    url: 'https://example.com/',
    title: 'Example',
    snapshot: {
      url: 'https://example.com/',
      title: 'Example',
      text: 'Example Domain. This domain is for use in documentation examples.',
      viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0, pageHeight: 1200 },
      active: '',
      elements: [
        {
          id: 'q0',
          tag: 'a',
          role: 'link',
          label: 'More information',
          href: 'https://iana.org/domains/example',
          rect: { x: 10, y: 20, width: 100, height: 20 },
        },
      ],
      media: [],
      headings: [{ level: 1, text: 'Example Domain' }],
      frames: [],
      at: 1,
    },
    ...overrides,
  } as BrowserViewState
}

test('parses one named browser tool and its args', () => {
  const call = parseBrowserAgentCall('```json\n{"thinking":"Read the page first","plan":["read","verify"],"tool":"snapshot","args":{}}\n```')
  assert.deepEqual(call, {
    tool: 'snapshot',
    args: {},
    thinking: 'Read the page first',
    plan: ['read', 'verify'],
  })
})

test('accepts a nested call envelope but rejects unknown tools', () => {
  assert.equal(parseBrowserAgentCall('{"call":{"tool":"assert_text","args":{"text":"Example"}}}')?.tool, 'assert_text')
  assert.equal(parseBrowserAgentCall('{"tool":"invent_a_tool","args":{}}'), null)
  assert.equal(parseBrowserAgentCall('not json'), null)
})

test('keeps tool arguments bounded and ignores non-object args', () => {
  const call = parseBrowserAgentCall('{"tool":"click","args":["[data-stet-id=\\"q0\\"]"]}')
  assert.deepEqual(call?.args, {})
  const long = parseBrowserAgentCall(`{"tool":"think","args":{"text":"${'x'.repeat(2_000)}"},"thinking":"${'y'.repeat(2_000)}"}`)
  assert.equal(long?.thinking?.length, 500)
})

test('compacts the oldest evidence first', () => {
  const history = Array.from({ length: 14 }, (_, index) => ({ tool: `tool-${index}`, result: 'r'.repeat(500) }))
  const compact = compactBrowserAgentHistory(history, 5, 1_200)
  assert.equal(compact.length, 3)
  assert.equal(compact.at(-1)?.tool, 'tool-13')
  assert.ok(compact.reduce((total, entry) => total + entry.result.length, 0) <= 1_200)
})

test('summarizes the current page without dropping evidence', () => {
  const text = summarizeBrowserState(page(), 200, 10)
  assert.match(text, /URL: https:\/\/example\.com\//)
  assert.match(text, /Example Domain/)
  assert.match(text, /q0 a role=link/)
  assert.match(text, /More information/)
})

test('turns a task into an explicit acceptance contract', () => {
  const mission = missionFromTask('Open example.com and tell me the heading')
  assert.equal(mission.kind, 'mixed')
  assert.ok(mission.criteria.length >= 2)
  assert.match(mission.criteria.join(' '), /answer/)
  assert.match(mission.criteria.join(' '), /action/)
})

test('routes simple page reads to the fast path and actions to the full agent', () => {
  assert.equal(
    isSimpleBrowserReadTask('On example.com, read the main heading and the page purpose from the page, then tell me exactly what the heading is and what the page is for.'),
    true,
  )
  assert.equal(isSimpleBrowserReadTask('Open https://example.com and tell me the heading.'), true)
  assert.equal(isSimpleBrowserReadTask('Summarize this page.'), true)
  assert.equal(
    isSimpleBrowserReadTask('Open https://www.selenium.dev/selenium/web/web-form.html, set the text input to Buffy, select Two, check the first checkbox and submit the form.'),
    false,
  )
  assert.equal(isSimpleBrowserReadTask('Click the first result and tell me its price.'), false)
  assert.equal(isSimpleBrowserReadTask('Edit the page heading to say Buffy.'), false)
  assert.equal(isSimpleBrowserReadTask('Compare the prices across these two pages.'), false)
})

test('parses the one-shot quick page answer and requires a visible result', () => {
  const parsed = parseBrowserAgentQuickAnswer('```json\n{"found":true,"answer":"Example Domain","evidence":"This domain is for use in documentation examples"}\n```')
  assert.deepEqual(parsed, { answer: 'Example Domain', evidence: 'This domain is for use in documentation examples', found: true })
  assert.equal(parseBrowserAgentQuickAnswer('{"found":false,"answer":"That answer is not visible on this page.","evidence":""}')?.found, false)
  assert.equal(parseBrowserAgentQuickAnswer('{"found":true,"answer":""}'), null)
  assert.equal(parseBrowserAgentQuickAnswer('not json'), null)
})

test('uses the document title when the page has no headings', () => {
  const noHeadings = page()
  noHeadings.snapshot.headings = []
  noHeadings.snapshot.title = 'Example Domain'
  noHeadings.title = 'Example Domain'
  const text = summarizeBrowserState(noHeadings, 200, 10)
  assert.match(text, /HEADINGS: \(none — use TITLE as the page-level heading; do not search for an h1\)/)
  assert.doesNotMatch(text, /HEADINGS:\n/)
})

test('shows select options and control state in the page summary', () => {
  const select = page()
  select.snapshot.elements = [
    {
      id: 'q1',
      tag: 'select',
      role: 'combobox',
      label: 'Country',
      value: 'CA',
      placeholder: 'Choose a country',
      options: [
        { label: 'Canada', value: 'CA' },
        { label: 'United States', value: 'US' },
      ],
      checked: false,
      required: true,
      expanded: true,
      autocomplete: 'country',
      rect: { x: 10, y: 20, width: 100, height: 20 },
    },
  ]
  const text = summarizeBrowserState(select, 200, 10)
  assert.match(text, /options=\[Canada \| United States\]/)
  assert.match(text, /checked=false/)
  assert.match(text, /required/)
  assert.match(text, /expanded/)
  assert.match(text, /placeholder=“Choose a country”/)
  assert.match(text, /autocomplete=country/)
})

test('reports real page changes and no-ops', () => {
  const before = page()
  const after = page({
    url: 'https://example.com/next',
    snapshot: {
      ...before.snapshot,
      url: 'https://example.com/next',
      title: 'Next',
      text: 'The next page is ready.',
      elements: [],
    },
  })
  assert.match(diffBrowserState(before, after), /URL:/)
  assert.match(diffBrowserState(before, after), /Interactive elements changed/)
  assert.equal(diffBrowserState(before, before), 'No visible page change detected.')
})
