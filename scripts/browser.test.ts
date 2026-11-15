import assert from 'node:assert/strict'
import test from 'node:test'

import { answerVisibleSchedule, cleanPageAnswer, directActionLead, directBrowserAction, directBrowserLead, directBrowserTask, directElementAction, directFindLink, directPageEdit, directPageSearch, directSearchAnswer, directSiteSearch, isDocumentWritingTask, isPageEditingTask, isPurchaseAction, isSameBrowserSite, isSimulationTask, isSpreadsheetChartTask, isSpreadsheetDataTask, looksLikeRefusal, PAGE_ANSWER_UNAVAILABLE, parseCodeReply, parseCompletionVerdict, parseReflection } from '../src/shared/browser'
import type { BrowserElement } from '../src/shared/types'

test('a page answer never exposes a model reasoning trace', () => {
  const trace =
    'That answer is not visible on this page.\nCheck constraints: "Return only the final answer."\nMatches.\nDone.\nOutput generation.\n[Output] That'
  assert.equal(cleanPageAnswer(trace), PAGE_ANSWER_UNAVAILABLE)
  assert.equal(cleanPageAnswer('Alan Turing studied mathematics at Cambridge.\nDone.'), 'Alan Turing studied mathematics at Cambridge.')
  assert.equal(cleanPageAnswer("Here's a thinking process:\nThe page mentions a due date."), '')
  assert.equal(cleanPageAnswer('{"answer":"Two assignments are due today."}'), 'Two assignments are due today.')
  const classroomTrace =
    'The user asks what they have due today. Looking at the page text, I need to determine what "today" is. The page shows "Due soon" items with dates:\n\n- Mon, Nov 16, 10:33 AM - Lesson 4.8\n- Mon, Nov 16, 11:59 PM - UNIT #2 DAY #10\n\nThe page doesn\'t explicitly state today\'s date. However, looking at the Due soon section, the earliest items are Monday Nov 16. Wait - I should be careful. Without knowing the current date, I cannot definitively say what is due today.'
  assert.equal(cleanPageAnswer(classroomTrace), '')
  assert.equal(
    cleanPageAnswer('Due today:\n- UNIT #2 DAY #10 (11:59 PM)\n- QUIZ 2.1-2.5 (11:59 PM)'),
    'Due today:\n- UNIT #2 DAY #10 (11:59 PM)\n- QUIZ 2.1-2.5 (11:59 PM)',
  )
})

test('a due-today question is answered from visible dates', () => {
  const text =
    'Due soon\nMon, Nov 16, 10:33 AM - 11/12 Lesson 4.8 Real world models\nMon, Nov 16, 11:59 PM - UNIT #2 DAY #10\nTue, Nov 17, 7:20 AM - Wayground: Imparfait'
  assert.equal(
    answerVisibleSchedule(text, new Date(2026, 10, 14)),
    'Nothing is due today. Next up:\n- 11/12 Lesson 4.8 Real world models — Nov 16, 10:33 AM',
  )
  assert.equal(
    answerVisibleSchedule(text, new Date(2026, 10, 16)),
    'Due today:\n- 11/12 Lesson 4.8 Real world models (Nov 16, 10:33 AM)\n- UNIT #2 DAY #10 (Nov 16, 11:59 PM)',
  )
  assert.equal(answerVisibleSchedule('No dated work here.', new Date(2026, 10, 14)), null)
})

test('a plain web search opens web results without the planner', () => {
  const task = directBrowserTask('search for cats')
  assert.equal(task?.kind, 'search')
  assert.equal(task?.url, 'https://html.duckduckgo.com/html/?q=cats')
  assert.equal(task?.target, 'Web search: cats')
})

test('search google for a query is parsed without keeping “google” in the query', () => {
  const task = directBrowserTask('search google for French Revolution causes')
  assert.equal(task?.kind, 'search')
  assert.equal(task?.url, 'https://html.duckduckgo.com/html/?q=French%20Revolution%20causes')
})

test('opening a known site and searching is one direct destination', () => {
  const task = directBrowserTask('open google and search for cats')
  assert.equal(task?.kind, 'search')
  assert.equal(task?.url, 'https://html.duckduckgo.com/html/?q=cats')
})

test('a page-scoped search is left to the browser planner', () => {
  assert.equal(directBrowserTask('search this page for cats'), null)
  assert.equal(directBrowserTask('search cats on Wikipedia'), null)
})

test('a web-scoped search strips the search engine from the query', () => {
  const task = directBrowserTask('search cats on the web')
  assert.equal(task?.kind, 'search')
  assert.equal(task?.url, 'https://html.duckduckgo.com/html/?q=cats')
})

test('a multiword web search can stay on the direct path', () => {
  const task = directBrowserTask('search for cats and dogs')
  assert.equal(task?.kind, 'search')
  assert.equal(task?.url, 'https://html.duckduckgo.com/html/?q=cats%20and%20dogs')
})

test('a search followed by another action is left to the browser planner', () => {
  assert.equal(directBrowserTask('search for cats and click the first result'), null)
  assert.equal(directBrowserTask('open google and search for cats and click the first result'), null)
})

test('known destinations still use the direct-open path', () => {
  const task = directBrowserTask('open google')
  assert.equal(task?.kind, 'open')
  assert.equal(task?.url, 'https://www.google.com/')
})

test('classroom and edpuzzle open directly when they are the destination', () => {
  const classroom = directBrowserTask('open google classroom')
  assert.equal(classroom?.kind, 'open')
  assert.equal(classroom?.url, 'https://classroom.google.com/')
  const edpuzzle = directBrowserTask('open edpuzzle')
  assert.equal(edpuzzle?.kind, 'open')
  assert.equal(edpuzzle?.url, 'https://edpuzzle.com/')
})

test('a compound classroom assignment is left to the planner', () => {
  assert.equal(directBrowserTask('go to google classroom and do an edpuzzle'), null)
})

test('a compound task opens its named starting site before planning the rest', () => {
  const lead = directBrowserLead('go to google classroom and do an edpuzzle')
  assert.equal(lead?.url, 'https://classroom.google.com/')
  assert.equal(lead?.rest, 'do an edpuzzle')
  assert.equal(directBrowserLead('open example.com and click Sign in')?.url, 'https://example.com/')
  assert.equal(directBrowserLead('open google and search for cats'), null)
})

test('an ordinary click is not mistaken for a web search', () => {
  assert.equal(directBrowserTask('click Search'), null)
})

test('scroll and key presses skip the planner', () => {
  assert.deepEqual(directBrowserAction('scroll down'), { type: 'scroll', x: 0, y: 480 })
  assert.deepEqual(directBrowserAction('scroll up 700'), { type: 'scroll', x: 0, y: -700 })
  assert.deepEqual(directBrowserAction('scroll to bottom'), { type: 'scroll', x: 0, y: 2_000 })
  assert.deepEqual(directBrowserAction('press enter'), { type: 'press', key: 'Enter' })
  assert.deepEqual(directBrowserAction('press arrow down'), { type: 'press', key: 'ArrowDown' })
  assert.deepEqual(directBrowserAction('go back'), { type: 'back' })
  assert.deepEqual(directBrowserAction('refresh'), { type: 'reload' })
})

test('a write into a page field is not sent to Google Docs', () => {
  assert.equal(isDocumentWritingTask('write a short story'), true)
  assert.equal(isDocumentWritingTask('write a paragraph in the search box'), false)
  assert.equal(isDocumentWritingTask('draft an essay'), true)
})

test('the Docs shortcut does not claim a task meant for another editor', () => {
  assert.equal(isDocumentWritingTask('write an essay in Notion'), false)
  assert.equal(isDocumentWritingTask('write a report on example.com'), false)
  assert.equal(isDocumentWritingTask('write an essay in Google Docs'), true)
})

test('opening a Google Doc and then writing still uses the fast document path', () => {
  assert.equal(isDocumentWritingTask('open a google doc and write an essay'), true)
  assert.equal(isDocumentWritingTask('go into Google Docs and draft a report'), true)
  assert.equal(isDocumentWritingTask('open a google doc'), false)
})

test('the sheet shortcut accepts input-data phrasing and recognizes a chart follow-up', () => {
  assert.equal(isSpreadsheetDataTask('go into spreadsheets and input data and make a graph'), true)
  assert.equal(isSpreadsheetChartTask('go into spreadsheets and input data and make a graph'), true)
  assert.equal(isSpreadsheetChartTask('fill the sheet with monthly sales'), false)
})

test('a compound search or link task stays with the planner', () => {
  assert.equal(directBrowserTask('search for cats then tell me the first result'), null)
  assert.equal(directFindLink('find the homework assignment then open it'), null)
})

test('a URL followed by more work is not opened as one giant address', () => {
  assert.equal(directBrowserTask('go to https://example.com and click More information'), null)
  assert.equal(directBrowserLead('go to https://example.com and click More information')?.url, 'https://example.com/')
})

test('the first native action of a compound task runs without the planner', () => {
  const linkElements: BrowserElement[] = [
    ...elements,
    { id: 'q5', tag: 'a', role: 'link', label: 'Learn more', rect: { x: 0, y: 0, width: 90, height: 22 } },
  ]
  assert.deepEqual(directActionLead('click Learn more and tell me what page opens', linkElements), {
    action: { type: 'click', selector: '[data-stet-id="q5"]' },
    rest: 'tell me what page opens',
  })
})

test('form clauses resolve as native actions, including radio choices', () => {
  const formElements: BrowserElement[] = [
    { id: 'q0', tag: 'input', role: '', label: 'Customer name', rect: { x: 0, y: 0, width: 200, height: 32 } },
    { id: 'q4', tag: 'input', role: '', label: 'Medium', inputType: 'radio', rect: { x: 0, y: 0, width: 16, height: 16 } },
    { id: 'q5', tag: 'button', role: '', label: 'Submit order', rect: { x: 0, y: 0, width: 100, height: 32 } },
  ]
  assert.deepEqual(directActionLead('fill Customer name with Ada Lovelace, choose Medium pizza, and click Submit order', formElements), {
    action: { type: 'type', selector: '[data-stet-id="q0"]', text: 'Ada Lovelace' },
    rest: 'choose Medium pizza, and click Submit order',
  })
  assert.deepEqual(directActionLead('choose Medium pizza, and click Submit order', formElements), {
    action: { type: 'check', selector: '[data-stet-id="q4"]', checked: true },
    rest: 'click Submit order',
  })
})

test('a search-and-answer task resolves its query without a planner', () => {
  assert.deepEqual(directSearchAnswer('Search Google for the capital of France and tell me the answer.'), {
    query: 'the capital of France',
    url: 'https://www.google.com/search?q=the%20capital%20of%20France',
    question: 'me the answer',
  })
  assert.equal(directSearchAnswer('Search Google for Hacker News, open the first result, and tell me the title.'), null)
  assert.equal(directSearchAnswer('Search Wikipedia for Ada Lovelace and tell me when she was born.'), null)
})

test('an exact checkbox label beats a longer superset', () => {
  const toppings: BrowserElement[] = [
    { id: 'q1', tag: 'input', role: '', label: 'Extra Cheese', inputType: 'checkbox', rect: { x: 0, y: 0, width: 16, height: 16 } },
    { id: 'q2', tag: 'input', role: '', label: 'Cheese', inputType: 'checkbox', rect: { x: 0, y: 0, width: 16, height: 16 } },
  ]
  assert.deepEqual(directElementAction('check Cheese', toppings), { type: 'check', selector: '[data-stet-id="q2"]', checked: true })
})

test('a form list keeps bare field clauses and its trailing submit native', () => {
  const formElements: BrowserElement[] = [
    { id: 'q0', tag: 'input', role: '', label: 'Customer name', rect: { x: 0, y: 0, width: 200, height: 32 } },
    { id: 'q1', tag: 'input', role: '', label: 'Telephone', rect: { x: 0, y: 0, width: 200, height: 32 } },
    { id: 'q9', tag: 'button', role: '', label: 'Submit order', rect: { x: 0, y: 0, width: 100, height: 32 } },
  ]
  assert.deepEqual(directActionLead('fill the customer name with Ada Lovelace, the telephone with 555-0100, and submit', formElements), {
    action: { type: 'type', selector: '[data-stet-id="q0"]', text: 'Ada Lovelace' },
    rest: 'the telephone with 555-0100, and submit',
  })
  assert.deepEqual(directActionLead('the telephone with 555-0100, and submit', formElements), {
    action: { type: 'type', selector: '[data-stet-id="q1"]', text: '555-0100' },
    rest: 'submit',
  })
  assert.deepEqual(directActionLead('submit', formElements), {
    action: { type: 'click', selector: '[data-stet-id="q9"]' },
    rest: '',
  })
})

const elements: BrowserElement[] = [
  { id: 'q0', tag: 'input', role: '', label: 'Search', placeholder: 'Search', rect: { x: 0, y: 0, width: 200, height: 32 } },
  { id: 'q1', tag: 'button', role: '', label: 'Sign in', rect: { x: 0, y: 0, width: 80, height: 32 } },
  { id: 'q2', tag: 'input', role: '', label: 'Email', inputType: 'email', rect: { x: 0, y: 0, width: 200, height: 32 } },
  { id: 'q3', tag: 'input', role: '', label: 'Remember me', inputType: 'checkbox', rect: { x: 0, y: 0, width: 16, height: 16 } },
  { id: 'q4', tag: 'button', role: '', label: 'Search', rect: { x: 0, y: 0, width: 80, height: 32 } },
]

test('a whole sentence is never collapsed into one wrong page click', () => {
  const page: BrowserElement[] = [
    { id: 'q1', tag: 'a', role: 'link', label: 'About', href: 'https://about.google/', rect: { x: 0, y: 0, width: 60, height: 24 } },
  ]
  assert.equal(directElementAction('go to slideshow and make a slideshow about space', page), null)
  assert.equal(directElementAction('make a slideshow about space', page), null)
  assert.equal(directFindLink('go to slideshow and make a slideshow about space'), null)
  assert.equal(directBrowserLead('go to slideshow and make a slideshow about space')?.url, 'https://docs.google.com/presentation/')
  assert.deepEqual(directElementAction('click About', page), { type: 'click', selector: '[data-stet-id="q1"]' })
})

test('a simple click resolves against the visible snapshot without a planner', () => {
  assert.deepEqual(directElementAction('click Sign in', elements), { type: 'click', selector: '[data-stet-id="q1"]' })
  assert.deepEqual(directElementAction('click the Search button', elements), { type: 'click', selector: '[data-stet-id="q4"]' })
})

test('every visible link can be opened without a planner', () => {
  const links: BrowserElement[] = [
    { id: 'q8', tag: 'a', role: '', label: 'Edpuzzle', href: 'https://edpuzzle.com/assignments/1', rect: { x: 0, y: 0, width: 120, height: 24 } },
  ]
  assert.deepEqual(directElementAction('open Edpuzzle', links), { type: 'click', selector: '[data-stet-id="q8"]' })
})

test('a link below the fold resolves without a planner and a second scroll', () => {
  const links: BrowserElement[] = [
    { id: 'q9', tag: 'a', role: 'link', label: 'Cell Structure Quiz', href: 'https://classroom.google.com/assignment/2', offscreen: true, rect: { x: 0, y: 2400, width: 240, height: 24 } },
  ]
  assert.deepEqual(directElementAction('open Cell Structure Quiz', links), { type: 'click', selector: '[data-stet-id="q9"]' })
})

test('a named assignment becomes a direct link scan', () => {
  assert.deepEqual(directFindLink('find my edpuzzle assignment'), {
    action: { type: 'findLink', text: 'edpuzzle' },
    query: 'edpuzzle',
    complete: true,
  })
  assert.deepEqual(directFindLink('do an edpuzzle'), {
    action: { type: 'findLink', text: 'edpuzzle' },
    query: 'edpuzzle',
    complete: false,
  })
  assert.deepEqual(directFindLink('look around and find my edpuzzle assignment'), {
    action: { type: 'findLink', text: 'edpuzzle' },
    query: 'edpuzzle',
    complete: true,
  })
  assert.deepEqual(directFindLink('click the Edpuzzle link'), {
    action: { type: 'findLink', text: 'edpuzzle' },
    query: 'edpuzzle',
    complete: true,
  })
  assert.deepEqual(directFindLink('find my edpuzzle assignment in google classroom'), {
    action: { type: 'findLink', text: 'edpuzzle' },
    query: 'edpuzzle',
    complete: true,
  })
  assert.equal(directFindLink('open google classroom'), null)
})

test('an ambiguous click falls through to the planner', () => {
  assert.equal(directElementAction('click Search', elements), null)
})

test('typing and filling resolve the field from the snapshot', () => {
  assert.deepEqual(directElementAction('type ada@example.com into Email', elements), {
    type: 'type',
    selector: '[data-stet-id="q2"]',
    text: 'ada@example.com',
  })
  assert.deepEqual(directElementAction('fill Email with ada@example.com', elements), {
    type: 'type',
    selector: '[data-stet-id="q2"]',
    text: 'ada@example.com',
  })
})

test('checkbox instructions resolve against the snapshot', () => {
  assert.deepEqual(directElementAction('check Remember me', elements), {
    type: 'check',
    selector: '[data-stet-id="q3"]',
    checked: true,
  })
})

test('same-site navigation still honors the exact destination path', () => {
  assert.equal(isSameBrowserSite('https://news.ycombinator.com/newcomments', 'https://news.ycombinator.com/'), false)
  assert.equal(isSameBrowserSite('https://news.ycombinator.com/', 'https://news.ycombinator.com/'), true)
  assert.equal(isSameBrowserSite('https://news.ycombinator.com/item?id=1', 'https://news.ycombinator.com/item'), true)
  assert.equal(isSameBrowserSite('https://news.ycombinator.com/foobar', 'https://news.ycombinator.com/foo'), false)
})

test('a relative target is not guessed from a generic link', () => {
  const links: BrowserElement[] = [
    { id: 'q7', tag: 'a', role: 'link', label: 'comments', rect: { x: 0, y: 0, width: 80, height: 20 } },
    { id: 'q8', tag: 'a', role: 'link', label: 'Next', rect: { x: 0, y: 0, width: 60, height: 20 } },
  ]
  assert.deepEqual(directElementAction('click the comments link for the top story', links), {
    type: 'click',
    selector: '[data-stet-id="q7"]',
  })
  assert.deepEqual(directElementAction('click the Next link', links), { type: 'click', selector: '[data-stet-id="q8"]' })
  assert.equal(
    directElementAction('click the comments link for the top story', [links[1]]),
    null,
  )
})

test('a form field whose snapshot label is only its name still resolves', () => {
  const fields: BrowserElement[] = [
    { id: 'q9', tag: 'input', role: '', label: 'custname', rect: { x: 0, y: 0, width: 200, height: 32 } },
  ]
  assert.deepEqual(directElementAction('fill Customer name with Ada Lovelace', fields), {
    type: 'type',
    selector: '[data-stet-id="q9"]',
    text: 'Ada Lovelace',
  })
})

test('a described target resolves by intent, not an exact command phrase', () => {
  const described: BrowserElement[] = [
    { id: 'q10', tag: 'a', role: 'link', label: 'Early life and education', href: '/wiki/Early_life', rect: { x: 0, y: 120, width: 220, height: 24 } },
    { id: 'q11', tag: 'a', role: 'link', label: 'Turing Award', href: '/wiki/Turing_Award', rect: { x: 0, y: 180, width: 140, height: 24 } },
    { id: 'q12', tag: 'button', role: 'button', label: 'Continue', rect: { x: 0, y: 240, width: 100, height: 32 } },
  ]
  assert.deepEqual(directElementAction('find the section about early life', described), {
    type: 'click',
    selector: '[data-stet-id="q10"]',
  })
  assert.deepEqual(directElementAction('open the page about the Turing Award', described), {
    type: 'click',
    selector: '[data-stet-id="q11"]',
  })
  assert.deepEqual(directElementAction('click the button that says Continue', described), {
    type: 'click',
    selector: '[data-stet-id="q12"]',
  })
})

test('site search and page search resolve to native typing', () => {
  assert.deepEqual(directSiteSearch('search Wikipedia for Alan Turing'), {
    site: 'wikipedia',
    url: 'https://www.wikipedia.org/',
    query: 'Alan Turing',
  })
  assert.deepEqual(directSiteSearch('open Amazon and search for shoes'), {
    site: 'amazon',
    url: 'https://www.amazon.com/',
    query: 'shoes',
  })
  assert.deepEqual(directSiteSearch('Search Wikipedia for Ada Lovelace, then tell me when she was born.'), {
    site: 'wikipedia',
    url: 'https://www.wikipedia.org/',
    query: 'Ada Lovelace',
    followUp: 'tell me when she was born',
  })
  assert.deepEqual(directSiteSearch('Open Wikipedia, search for Ada Lovelace, and tell me what year she was born.'), {
    site: 'wikipedia',
    url: 'https://www.wikipedia.org/',
    query: 'Ada Lovelace',
    followUp: 'tell me what year she was born',
  })
  assert.deepEqual(directSiteSearch('search YouTube for cats and tell me the first title'), {
    site: 'youtube',
    url: 'https://www.youtube.com/',
    query: 'cats',
    searchUrl: 'https://www.youtube.com/results?search_query=cats',
    followUp: 'tell me the first title',
  })
  assert.deepEqual(directSiteSearch('Search DuckDuckGo for browser automation and tell me the first result title.'), {
    site: 'duckduckgo',
    url: 'https://html.duckduckgo.com/html/',
    query: 'browser automation',
    searchUrl: 'https://html.duckduckgo.com/html/?q=browser%20automation',
    followUp: 'tell me the first result title',
  })
  assert.deepEqual(directPageSearch('search for cats', elements), {
    type: 'type',
    selector: '[data-stet-id="q0"]',
    text: 'cats',
    submit: true,
  })
})

test('page edits are recognized and reading or navigating is not', () => {
  assert.equal(isPageEditingTask('change the background to black'), true)
  assert.equal(isPageEditingTask('replace the heading with Welcome'), true)
  assert.equal(isPageEditingTask('make the button blue'), true)
  assert.equal(isPageEditingTask('hide the sidebar'), true)
  assert.equal(isPageEditingTask('make it look like i unlocked all the blooks'), true)
  assert.equal(isPageEditingTask('what is the page title?'), false)
  assert.equal(isPageEditingTask('click the login button'), false)
  assert.equal(isPageEditingTask('delete my account'), false)
})

test('a for-fun visual request is a simulation, not a purchase', () => {
  assert.equal(isSimulationTask('make it look like i unlocked all the blooks, for fun'), true)
  assert.equal(isSimulationTask('pretend I already own every blook'), true)
  assert.equal(isSimulationTask('fake the collection screen'), true)
  assert.equal(isSimulationTask('play this game for fun'), false)
  assert.equal(isSimulationTask('make a quiz for fun'), false)
  assert.equal(isSimulationTask('compare the prices of two blook packs'), false)
})

test('a simulation blocks purchase clicks but allows normal navigation', () => {
  const page: BrowserElement[] = [
    { id: 'buy', tag: 'button', role: '', label: 'Buy Blooks', rect: { x: 0, y: 0, width: 80, height: 32 } },
    { id: 'view', tag: 'a', role: 'link', label: 'Blooks', href: 'https://blooket.com/blooks', rect: { x: 0, y: 0, width: 80, height: 32 } },
  ]
  assert.equal(isPurchaseAction({ type: 'click', selector: '[data-stet-id="buy"]' }, page), true)
  assert.equal(isPurchaseAction({ type: 'findLink', text: 'Open Pack' }, page), true)
  assert.equal(isPurchaseAction({ type: 'click', selector: '[data-stet-id="view"]' }, page), false)
  assert.equal(isPurchaseAction({ type: 'evaluate', expression: 'return 1' }, page), false)
})

test('common page edits are produced without a model', () => {
  const background = directPageEdit('change the background to black', [])
  assert.equal(background?.type, 'evaluate')
  assert.match(background?.type === 'evaluate' ? background.expression : '', /document\.body\.style\.background/)

  const elements = [{ id: 'q1', tag: 'button', label: 'Save' }] as unknown as Parameters<typeof directPageEdit>[1]
  const hide = directPageEdit('hide the Save button', elements)
  assert.equal(hide?.type, 'evaluate')
  assert.match(hide?.type === 'evaluate' ? hide.expression : '', /data-stet-id/)
  assert.match(hide?.type === 'evaluate' ? hide.expression : '', /q1/)

  assert.equal(directPageEdit('what is the page title?', []), null)
})

test('page code is read from JSON or a fenced block', () => {
  assert.deepEqual(parseCodeReply('{"explanation":"recolor the hero","code":"const h=document.querySelector(\'h1\'); h.style.color=\'red\'; return h.style.color"}'), {
    code: "const h=document.querySelector('h1'); h.style.color='red'; return h.style.color",
    explanation: 'recolor the hero',
  })
  assert.deepEqual(parseCodeReply('```js\nreturn document.title\n```'), { code: 'return document.title', explanation: '' })
  assert.equal(parseCodeReply('no code here'), null)
})

test('a reflection is read only when it offers a different route', () => {
  assert.deepEqual(
    parseReflection('{"diagnosis":"the selector matched a hidden copy","options":["target the visible card","set the style by class"]}'),
    { diagnosis: 'the selector matched a hidden copy', options: ['target the visible card', 'set the style by class'] },
  )
  assert.equal(parseReflection('{"diagnosis":"it failed"}'), null)
  assert.equal(parseReflection('try again'), null)
})

test('a completion verdict is read only when it is usable', () => {
  assert.deepEqual(parseCompletionVerdict('{"complete":true}'), { complete: true, missing: '' })
  assert.deepEqual(parseCompletionVerdict('review: {"complete":false,"missing":"the quiz result is not shown"}'), {
    complete: false,
    missing: 'the quiz result is not shown',
  })
  assert.equal(parseCompletionVerdict('I think it is done'), null)
  assert.equal(parseCompletionVerdict('not json'), null)
})

test('a refusal is detected but an honest gap is not', () => {
  assert.equal(looksLikeRefusal("I'm sorry, but I can't help with that."), true)
  assert.equal(looksLikeRefusal('As an AI, I cannot browse this site.'), true)
  assert.equal(looksLikeRefusal("I don't have permission to access that."), true)
  assert.equal(looksLikeRefusal("I'm sorry, I can't provide that."), true)
  assert.equal(looksLikeRefusal("I can’t write that for you."), true)
  assert.equal(looksLikeRefusal("That's not something I can do."), true)
  assert.equal(looksLikeRefusal("I can't help but notice the pattern."), false)
  assert.equal(looksLikeRefusal("I can't find that on this page."), false)
  assert.equal(looksLikeRefusal('The page needs a sign-in before the quiz opens.'), false)
  assert.equal(looksLikeRefusal(''), false)
})
