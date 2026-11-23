import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyWorkspaceEdits,
  inlineWorkspaceAssets,
  splitInlineStylesheet,
  styleFileName,
  normalizeWorkspace,
  parseWorkspaceEdits,
  parseWorkspacePlan,
  parseWorkspaceRequests,
  formatPlan,
  resolveWorkspacePath,
  safeWorkspacePath,
  workspaceContext,
  workspaceFromPages,
  workspacePages,
  workspaceReadResults,
} from '../src/shared/workspace'

test('workspace paths stay relative and previewable', () => {
  assert.equal(safeWorkspacePath('index.html'), 'index.html')
  assert.equal(safeWorkspacePath('./css/styles.css'), 'css/styles.css')
  assert.equal(safeWorkspacePath('/about.html'), 'about.html')
  assert.equal(safeWorkspacePath('../secrets.js'), null)
  assert.equal(safeWorkspacePath('a/../../b.js'), null)
  // Source files of an imported repository are editable. A declaration file is
  // the case that used to be thrown away, and it broke the project's type check.
  assert.equal(safeWorkspacePath('app.ts'), 'app.ts')
  assert.equal(safeWorkspacePath('src/index.d.ts'), 'src/index.d.ts')
  assert.equal(safeWorkspacePath('photo.png'), null, 'a binary is never editable text')
  assert.equal(safeWorkspacePath(''), null)
})

test('normalizeWorkspace drops duplicates, unsafe paths and empty files', () => {
  const files = normalizeWorkspace([
    { path: 'index.html', content: '<h1>Hello</h1>' },
    { path: 'index.html', content: '<h1>Duplicate</h1>' },
    { path: '../escape.js', content: 'alert(1)' },
    { path: 'app.js', content: '' },
    { path: 'styles.css', content: 'body{margin:0}' },
  ])
  assert.deepEqual(files.map((file) => file.path), ['index.html', 'styles.css'])
})

test('a SEARCH/REPLACE block changes only its own span', () => {
  const files = [{ path: 'index.html', content: '<h1>Old</h1>\n<p>Keep</p>' }]
  const parsed = parseWorkspaceEdits(`=== FILE: index.html
<<<<<<< SEARCH
<h1>Old</h1>
=======
<h1>New</h1>
>>>>>>> REPLACE`)
  assert.equal(parsed.edits.length, 1)
  const outcome = applyWorkspaceEdits(files, parsed.edits)
  assert.deepEqual(outcome.failures, [])
  assert.deepEqual(outcome.changed, ['index.html'])
  assert.equal(outcome.files[0]?.content, '<h1>New</h1>\n<p>Keep</p>')
})

test('a CREATE block adds a file and a second edit can use it', () => {
  const parsed = parseWorkspaceEdits(`=== FILE: styles.css
<<<<<<< CREATE
body { background: #111; }
>>>>>>> CREATE

=== FILE: index.html
<<<<<<< SEARCH
</head>
=======
  <link rel="stylesheet" href="styles.css">
</head>
>>>>>>> REPLACE`)
  const outcome = applyWorkspaceEdits([{ path: 'index.html', content: '<html><head></head><body></body></html>' }], parsed.edits)
  assert.deepEqual(outcome.failures, [])
  assert.deepEqual(outcome.created, ['styles.css'])
  const html = outcome.files.find((file) => file.path === 'index.html')
  assert.match(html?.content ?? '', /styles\.css/)
})

test('a missing or ambiguous SEARCH is reported, never guessed', () => {
  const files = [{ path: 'app.js', content: 'const a = 1\nconst a = 1\n' }]
  const missing = applyWorkspaceEdits(files, [
    { kind: 'replace', path: 'app.js', search: 'const b = 2', replace: 'const b = 3' },
  ])
  assert.equal(missing.changed.length, 0)
  assert.match(missing.failures[0] ?? '', /not found/)

  const ambiguous = applyWorkspaceEdits(files, [
    { kind: 'replace', path: 'app.js', search: 'const a = 1', replace: 'const a = 2' },
  ])
  assert.equal(ambiguous.changed.length, 0)
  assert.match(ambiguous.failures[0] ?? '', /appears 2 times/)

  const unknown = applyWorkspaceEdits(files, [
    { kind: 'replace', path: 'nope.js', search: 'x', replace: 'y' },
  ])
  assert.match(unknown.failures[0] ?? '', /does not exist/)
})

test('an empty SEARCH appends instead of replacing', () => {
  const outcome = applyWorkspaceEdits(
    [{ path: 'app.js', content: 'const a = 1' }],
    [{ kind: 'replace', path: 'app.js', search: '', replace: 'console.log(a)' }],
  )
  assert.deepEqual(outcome.failures, [])
  assert.equal(outcome.files[0]?.content, 'const a = 1\n\nconsole.log(a)\n')
})

test('malformed blocks are rejected without applying anything', () => {
  const parsed = parseWorkspaceEdits(`=== FILE: app.js
<<<<<<< SEARCH
const a = 1`)
  assert.equal(parsed.edits.length, 0)
  assert.match(parsed.rejected[0] ?? '', /unfinished/)
})

test('the preview inlines local css and js and leaves remote urls alone', () => {
  const files = [
    { path: 'styles.css', content: '.card { color: red }' },
    { path: 'app.js', content: 'console.log("hi")' },
  ]
  const html = inlineWorkspaceAssets(
    `<link rel="stylesheet" href="styles.css"><script src="app.js"></script><link rel="stylesheet" href="https://cdn.example/x.css">`,
    files,
  )
  assert.match(html, /<style data-workspace="styles\.css">/)
  assert.match(html, /<script data-workspace="app\.js">/)
  assert.match(html, /https:\/\/cdn\.example\/x\.css/)
  assert.equal(html.includes('rel="stylesheet" href="styles.css"'), false)
})

test('pages order index first and ignore non-html files', () => {
  const pages = workspacePages([
    { path: 'about.html', content: '<h1>About</h1>' },
    { path: 'styles.css', content: 'body{}' },
    { path: 'index.html', content: '<h1>Home</h1>' },
  ])
  assert.deepEqual(pages.map((page) => page.name), ['index.html', 'about.html'])
})

test('a single-document build converts into workspace files and back', () => {
  const files = workspaceFromPages([
    { name: 'index.html', html: '<h1>One</h1>' },
    { name: 'menu.html', html: '<h1>Two</h1>' },
  ])
  assert.deepEqual(files.map((file) => file.path), ['index.html', 'menu.html'])
  assert.deepEqual(workspacePages(files).map((page) => page.html), ['<h1>One</h1>', '<h1>Two</h1>'])
})

test('relative references resolve inside the workspace only', () => {
  assert.equal(resolveWorkspacePath('pages/about.html', 'styles.css'), 'pages/styles.css')
  assert.equal(resolveWorkspacePath('pages/about.html', '../styles.css'), 'styles.css')
  assert.equal(resolveWorkspacePath('index.html', 'app.js'), 'app.js')
  assert.equal(resolveWorkspacePath('index.html', 'https://x.test/a.js'), null)
  assert.equal(resolveWorkspacePath('index.html', '../../escape.js'), null)
})

test('the prompt context names the tree and the files that matter', () => {
  const context = workspaceContext(
    [
      { path: 'index.html', content: '<h1>Home</h1>' },
      { path: 'styles.css', content: 'body{}' },
    ],
    'change the colour in styles.css',
  )
  assert.match(context, /index\.html/)
  assert.match(context, /<file path="styles\.css">/)
})

test('read requests are parsed from the edit dialect and unsafe paths ignored', () => {
  const requests = parseWorkspaceRequests(`=== READ: styles.css
=== READ: ../secrets.js
=== FIND: addEventListener
=== LIST`)
  assert.deepEqual(requests, [
    { kind: 'file', path: 'styles.css' },
    { kind: 'find', text: 'addEventListener' },
    { kind: 'list' },
  ])
})

test('read results answer the request with real text, line numbers and the tree', () => {
  const files = [
    { path: 'index.html', content: '<h1>Home</h1>\n<script src="app.js"></script>' },
    { path: 'app.js', content: 'const a = 1\ndocument.getElementById("go").addEventListener("click", fn)' },
  ]
  const read = workspaceReadResults(files, [{ kind: 'file', path: 'app.js' }])
  assert.match(read, /<file path="app\.js">/)
  assert.match(read, /addEventListener/)

  const found = workspaceReadResults(files, [{ kind: 'find', text: 'h1' }])
  assert.match(found, /index\.html:1:/)

  const missing = workspaceReadResults(files, [{ kind: 'file', path: 'missing.js' }])
  assert.match(missing, /no such file/)
  assert.match(missing, /index\.html/)

  const list = workspaceReadResults(files, [{ kind: 'list' }])
  assert.match(list, /Workspace files:/)
  assert.match(list, /app\.js/)
})

test('a file the import left out is named, not reported as missing', () => {
  const files = [{ path: 'index.html', content: '<h1>Home</h1>' }]
  const absent = ['src/legacy.ts']

  const context = workspaceContext(files, 'fix the bug', absent)
  assert.match(context, /not imported here/)
  assert.match(context, /src\/legacy\.ts/)
  assert.match(context, /do not create them/i)

  const read = workspaceReadResults(files, [{ kind: 'file', path: 'src/legacy.ts' }], 24_000, absent)
  assert.match(read, /exists in the repository but was not imported/)
  assert.match(read, /Do not create it/)
  assert.equal(/no such file/.test(read), false, 'an existing file is never called missing')
})

test('read output is bounded so one answer cannot flood the prompt', () => {
  const files = [{ path: 'index.html', content: 'x'.repeat(50_000) }]
  const read = workspaceReadResults(files, [{ kind: 'file', path: 'index.html' }], 1_000)
  assert.ok(read.length < 1_200, `expected a bounded answer, got ${read.length} chars`)
  assert.match(read, /read budget is used/)
})

test('a plan block is read from the answer and rendered back into the prompt', () => {
  const plan = parseWorkspacePlan(`=== FILE: styles.css
<<<<<<< SEARCH
a
=======
b
>>>>>>> REPLACE

=== PLAN
- [x] Add the toolbar
- [ ] Style it for mobile
- [ ] Wire the buttons`)
  assert.deepEqual(plan, [
    { text: 'Add the toolbar', done: true },
    { text: 'Style it for mobile', done: false },
    { text: 'Wire the buttons', done: false },
  ])
  assert.match(formatPlan(plan), /Plan so far:/)
  assert.match(formatPlan(plan), /- \[x\] Add the toolbar/)
  assert.equal(formatPlan(null), '')
  assert.equal(parseWorkspacePlan('no plan here'), null)
})

test('DELETE and RENAME are parsed and applied, and references follow a move', () => {
  const files = [
    { path: 'index.html', content: '<link rel="stylesheet" href="old.css"><h1>x</h1>' },
    { path: 'old.css', content: 'body{margin:0}' },
    { path: 'legacy.js', content: 'var a=1' },
  ]
  const parsed = parseWorkspaceEdits('=== DELETE: legacy.js\n=== RENAME: old.css -> css/site.css')
  assert.deepEqual(parsed.edits, [
    { kind: 'delete', path: 'legacy.js' },
    { kind: 'rename', path: 'old.css', to: 'css/site.css' },
  ])
  const outcome = applyWorkspaceEdits(files, parsed.edits)
  assert.deepEqual(outcome.files.map((file) => file.path).sort(), ['css/site.css', 'index.html'])
  assert.match(outcome.files.find((file) => file.path === 'index.html')!.content, /href="css\/site\.css"/)
  assert.deepEqual(outcome.removed, ['legacy.js'])
  assert.deepEqual(outcome.renamed, [{ from: 'old.css', to: 'css/site.css' }])
})

test('removing the only page, a missing file, or an existing target is refused', () => {
  const files = [
    { path: 'index.html', content: '<h1>x</h1>' },
    { path: 'a.css', content: 'b{}' },
  ]
  const page = applyWorkspaceEdits(files, [{ kind: 'delete', path: 'index.html' }])
  assert.equal(page.files.length, 2)
  assert.match(page.failures[0]!, /at least one page/)

  const missing = applyWorkspaceEdits(files, [{ kind: 'delete', path: 'nope.js' }])
  assert.match(missing.failures[0]!, /does not exist/)

  const collision = applyWorkspaceEdits(files, [{ kind: 'rename', path: 'a.css', to: 'index.html' }])
  assert.match(collision.failures[0]!, /already exists/)
})

test('deleting a page is not treated as a regression by the edit gate', async () => {
  const withSecond = [
    { path: 'index.html', content: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home</title></head><body><h1>Home</h1></body></html>' },
    { path: 'about.html', content: '<!doctype html><html><head><title>About</title></head><body><h1>About</h1></body></html>' },
  ]
  const { runCodeEditTurn } = await import('../src/worker/code-edit')
  const result = await runCodeEditTurn({
    files: withSecond,
    prompt: 'remove the about page',
    complete: async () => '=== DELETE: about.html',
  })
  assert.equal(result.status, 'applied')
  assert.deepEqual(result.files.map((file) => file.path), ['index.html'])
})

test('splitting the inline CSS out makes a real stylesheet the page links', () => {
  const css = `.card{border:1px solid #ddd;border-radius:12px;padding:24px}
body{margin:0;font:16px/1.6 system-ui,sans-serif}
button{min-height:44px;padding:0 18px}`
  const files = [
    { path: 'index.html', content: `<!doctype html><html><head><title>Card</title><style>\n${css}\n</style></head><body><h1>Card</h1></body></html>` },
  ]
  const split = splitInlineStylesheet(files)
  const page = split.find((file) => file.path === 'index.html')!
  const sheet = split.find((file) => file.path === 'styles.css')!
  assert.ok(sheet, 'the stylesheet file exists')
  assert.match(page.content, /<link rel="stylesheet" href="styles\.css">/)
  assert.doesNotMatch(page.content, /<style/)
  assert.ok(sheet.content.includes('button{min-height:44px'))
})

test('a page that already links a stylesheet is left alone, and tiny blocks are ignored', () => {
  const linked = [
    { path: 'index.html', content: '<html><head><link rel="stylesheet" href="styles.css"></head><body></body></html>' },
    { path: 'styles.css', content: 'body{margin:0}' },
  ]
  assert.deepEqual(splitInlineStylesheet(linked), linked)
  const tiny = [{ path: 'index.html', content: '<html><head><style>p{color:red}</style></head><body></body></html>' }]
  assert.deepEqual(splitInlineStylesheet(tiny), tiny)
})

test('the requested stylesheet name is used when the prompt names one', () => {
  assert.equal(styleFileName('Move the CSS into a file called theme.css instead of styles.css.'), 'theme.css')
  assert.equal(styleFileName('put the css in a separate stylesheet'), 'styles.css')
})
