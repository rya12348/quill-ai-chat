import assert from 'node:assert/strict'
import test from 'node:test'

import type { WorkspaceFile } from '../src/shared/workspace'
import { buildFromWorkspace, buildWorkspaceReceipt, runCodeEditTurn } from '../src/worker/code-edit'

const files: WorkspaceFile[] = [
  {
    path: 'index.html',
    content:
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card</title><link rel="stylesheet" href="styles.css"></head><body><h1>Card</h1><div class="card">Hello</div><button id="go">Go</button><script src="app.js"></script></body></html>',
  },
  {
    path: 'styles.css',
    content:
      ':root{--ink:#222;--paper:#f7f4ec;--accent:#a4472b}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,sans-serif}.card{border:1px solid #ddd;border-radius:12px;padding:24px}button{min-height:44px;padding:0 18px}',
  },
  {
    path: 'app.js',
    content:
      'document.getElementById("go").addEventListener("click", function () { document.querySelector(".card").textContent = "Clicked at " + new Date().toISOString() })',
  },
]

const blue = `=== FILE: styles.css
<<<<<<< SEARCH
.card{border:1px solid #ddd;border-radius:12px;padding:24px}
=======
.card{border:1px solid #0b5;border-radius:12px;padding:24px;background:#eef}
>>>>>>> REPLACE`

test('a valid diff is applied and returned', async () => {
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    complete: async () => blue,
  })
  assert.equal(result.status, 'applied')
  assert.ok(result.report?.changed.includes('styles.css'))
  assert.match(result.files.find((file) => file.path === 'styles.css')?.content ?? '', /#0b5/)
  // The untouched files are byte-identical.
  assert.equal(result.files.find((file) => file.path === 'app.js')?.content, files[2]!.content)
})

test('a model that answers in prose changes nothing and reports no change', async () => {
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    complete: async () => 'Sure! I made the card green.',
  })
  assert.equal(result.status, 'no-change')
  assert.deepEqual(result.files, files)
  assert.equal(result.report, null)
})

test('a rejected SEARCH gets one corrective attempt', async () => {
  const prompts: string[] = []
  const statuses: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    onStatus: (text) => {
      statuses.push(text)
    },
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      return prompts.length === 1
        ? `=== FILE: styles.css
<<<<<<< SEARCH
.card-does-not-exist
=======
.card{border:1px solid #0b5}
>>>>>>> REPLACE`
        : blue
    },
  })
  assert.equal(prompts.length, 2)
  assert.equal(result.status, 'applied')
  assert.equal(result.repaired, true)
  assert.ok(statuses.some((text) => /corrected diff/.test(text)))
  assert.match(prompts[1]!, /was not found exactly/)
})

test('the plan from the last turn is shown, and this turn updates it', async () => {
  const prompts: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    plan: [
      { text: 'Pick a palette', done: true },
      { text: 'Recolour the card', done: false },
    ],
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      return `${blue}

=== PLAN
- [x] Pick a palette
- [x] Recolour the card
- [ ] Check mobile`
    },
  })
  assert.match(prompts[0]!, /Plan so far:/)
  assert.match(prompts[0]!, /\[ \] Recolour the card/)
  assert.equal(result.status, 'applied')
  assert.deepEqual(result.plan, [
    { text: 'Pick a palette', done: true },
    { text: 'Recolour the card', done: true },
    { text: 'Check mobile', done: false },
  ])
})

test('a model that asks to read a file gets it, then sends the diff', async () => {
  const prompts: string[] = []
  const statuses: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    onStatus: (text) => {
      statuses.push(text)
    },
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      if (prompts.length === 1) return '=== READ: styles.css'
      return blue
    },
  })
  assert.equal(prompts.length, 2)
  assert.equal(result.status, 'applied')
  // The answer carries the real file, so the SEARCH text can be copied exactly.
  assert.match(prompts[1]!, /<file path="styles\.css">/)
  assert.match(prompts[1]!, /--accent:#a4472b/)
  assert.match(prompts[1]!, /Now return only the edit blocks/)
  assert.ok(statuses.some((text) => /Reading/.test(text)))
})

test('reads are bounded and a one-attempt turn gets none', async () => {
  let calls = 0
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    attempts: 1,
    complete: async () => {
      calls += 1
      return '=== READ: styles.css'
    },
  })
  assert.equal(calls, 1, 'a single-use proof must stay a single call')
  assert.equal(result.status, 'no-change')
})

test('a diff that breaks a page check is repaired from the failing checks', async () => {
  const prompts: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'simplify the page',
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      if (prompts.length === 1) {
        // Removing the only heading breaks a deterministic check.
        return `=== FILE: index.html
<<<<<<< SEARCH
<h1>Card</h1>
=======
<div class="card-title">Card</div>
>>>>>>> REPLACE`
      }
      // The rejected diff was discarded, so the fix is relative to the original.
      return `=== FILE: index.html
<<<<<<< SEARCH
<h1>Card</h1>
=======
<h1>Card Project</h1>
>>>>>>> REPLACE`
    },
  })
  assert.equal(prompts.length, 2, 'the regression buys one corrective call')
  assert.match(prompts[1]!, /made the page checks worse/)
  assert.match(prompts[1]!, /Score|score|heading|title|viewport/i)
  assert.equal(result.status, 'applied')
  assert.equal(result.repaired, true)
})

test('a correction that still scores worse is rejected, not published', async () => {
  const gutted = `=== FILE: index.html
<<<<<<< CREATE
<!doctype html><html><body></body></html>
>>>>>>> CREATE`
  const result = await runCodeEditTurn({
    files,
    prompt: 'simplify the page',
    complete: async () => gutted,
  })
  assert.equal(result.status, 'rejected')
  assert.equal(result.repaired, true)
  assert.deepEqual(result.files, files)
})

test('attempts: 1 is one call with no corrective turn', async () => {
  // Duck's proof is single-use, so Buffy Code passes one attempt there.
  let calls = 0
  const statuses: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    attempts: 1,
    onStatus: (text) => {
      statuses.push(text)
    },
    complete: async () => {
      calls += 1
      return `=== FILE: styles.css
<<<<<<< SEARCH
.card-does-not-exist
=======
.card{border:1px solid #0b5}
>>>>>>> REPLACE`
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.status, 'no-change')
  assert.equal(result.repaired, false)
  assert.equal(statuses.length, 0)
})

test('a throwing completion is reported and leaves the workspace alone', async () => {
  const errors: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    onError: (error) => {
      errors.push(error instanceof Error ? error.message : String(error))
    },
    complete: async () => {
      throw new Error('all lanes failed')
    },
  })
  assert.deepEqual(errors, ['all lanes failed'])
  assert.equal(result.status, 'no-change')
  assert.deepEqual(result.files, files)
})

test('a diff that guts the page is rejected and the original workspace survives', async () => {
  const result = await runCodeEditTurn({
    files,
    prompt: 'simplify the page',
    complete: async () => `=== FILE: index.html
<<<<<<< CREATE
<!doctype html><html><body></body></html>
>>>>>>> CREATE`,
  })
  assert.equal(result.status, 'rejected')
  assert.deepEqual(result.files, files, 'a rejected edit may not mutate the workspace')
  assert.ok(result.report?.changed.includes('index.html'))
})

test('a repository with no page gets a receipt instead of a generated site', () => {
  const repo = [
    { path: 'index.js', content: 'export const queue = []\n' },
    { path: 'index.d.ts', content: 'export declare const queue: unknown[]\n' },
  ]
  const built = buildWorkspaceReceipt(repo, { title: 'yocto-queue', changed: ['index.js'] })

  assert.equal(built.status, 'ready')
  assert.equal(built.title, 'yocto-queue')
  assert.equal(built.files?.length, 2, 'the project files travel with the receipt')
  assert.match(built.html, /index\.js/)
  assert.match(built.html, /index\.d\.ts/)
  assert.match(built.html, /1 changed this turn/)
  // It must not pretend to be a page from the project.
  assert.equal(/<script/i.test(built.html), false)

  const failed = buildWorkspaceReceipt(repo, { title: 'yocto-queue', warning: 'The edit did not apply' })
  assert.equal(failed.status, 'warning')
  assert.match(failed.html, /did not apply/)

  // An amber receipt always says why.
  const flagged = buildWorkspaceReceipt(repo, { title: 'yocto-queue', problems: ['app.js: unclosed brace'] })
  assert.equal(flagged.status, 'warning')
  assert.match(flagged.html, /Still to fix/)
  assert.match(flagged.html, /unclosed brace/)
})

test('a page is built from the workspace with its local assets inlined', () => {
  const built = buildFromWorkspace(files, { question: 'card', label: 'Test lane' })
  assert.ok(built)
  assert.equal(built.title, 'Card')
  assert.match(built.html, /<style data-workspace="styles\.css">/)
  assert.match(built.html, /<script data-workspace="app\.js">/)
  assert.deepEqual(built.models, ['Test lane'])
  assert.equal(built.files?.length, 3)
})

const brokenCss = `=== FILE: styles.css
<<<<<<< CREATE
${files[1]!.content}
.card { padding: 24px
>>>>>>> CREATE`

test('a plan with an open step continues into another round', async () => {
  const prompts: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'recolour the card and add a hover state',
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      if (prompts.length === 1) {
        return `${blue}

=== PLAN
- [x] Recolour the card
- [ ] Add a hover state`
      }
      return `=== FILE: styles.css
<<<<<<< SEARCH
button{min-height:44px;padding:0 18px}
=======
button{min-height:44px;padding:0 18px}button:hover{background:#eef}
>>>>>>> REPLACE

=== PLAN
- [x] Recolour the card
- [x] Add a hover state`
    },
  })
  assert.equal(prompts.length, 2, 'the open step buys a second round')
  assert.match(prompts[1]!, /Next step: Add a hover state/)
  assert.equal(result.status, 'applied')
  assert.match(result.files.find((file) => file.path === 'styles.css')!.content, /button:hover/)
  assert.match(result.files.find((file) => file.path === 'styles.css')!.content, /#0b5/)
  assert.deepEqual(result.plan, [
    { text: 'Recolour the card', done: true },
    { text: 'Add a hover state', done: true },
  ])
})

test('=== DONE at the end of the last step stops the loop', async () => {
  let calls = 0
  const result = await runCodeEditTurn({
    files,
    prompt: 'recolour the card and add a hover state',
    complete: async () => {
      calls += 1
      return `${blue}

=== PLAN
- [x] Recolour the card
- [ ] Add a hover state
=== DONE`
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.status, 'applied')
})

test('broken code is sent back for one repair', async () => {
  const prompts: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      if (prompts.length === 1) return brokenCss
      return `=== FILE: styles.css
<<<<<<< CREATE
${files[1]!.content}
>>>>>>> CREATE`
    },
  })
  assert.equal(prompts.length, 2, 'a code problem buys one repair call')
  assert.match(prompts[1]!, /files themselves have these problems/)
  assert.equal(result.status, 'applied')
  assert.deepEqual(result.problems, [])
})

test('an unrepaired code problem keeps the edit and reports it', async () => {
  const result = await runCodeEditTurn({
    files,
    prompt: 'make the card green',
    complete: async () => brokenCss,
  })
  assert.equal(result.status, 'applied', 'the work is kept, not thrown away')
  assert.ok(result.problems.length > 0)
  assert.match(result.problems[0]!, /styles\.css/)
})

test('a FETCH asks for documentation and gets its text', async () => {
  const prompts: string[] = []
  const asked: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'draw on a canvas',
    fetchDocument: async (url) => {
      asked.push(url)
      return '<document url="https://example.test/docs" title="Canvas"><p>Use fillRect to draw.</p></document>'
    },
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      if (prompts.length === 1) return '=== FETCH: https://example.test/docs'
      return blue
    },
  })
  assert.deepEqual(asked, ['https://example.test/docs'])
  assert.equal(prompts.length, 2)
  assert.match(prompts[1]!, /Use fillRect to draw/)
  assert.match(prompts[1]!, /Now return only the edit blocks/)
  assert.equal(result.status, 'applied')
})

test('a documentation page that will not load does not stop the edit', async () => {
  const prompts: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'draw on a canvas',
    fetchDocument: async () => {
      throw new Error('that address is not a public website')
    },
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      if (prompts.length === 1) return '=== FETCH: https://private.test/docs'
      return blue
    },
  })
  assert.match(prompts[1]!, /Could not read https:\/\/private\.test\/docs/)
  assert.equal(result.status, 'applied')
})

test('research notes reach the model before it writes anything', async () => {
  const prompts: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'add a chart',
    research: 'Reference notes fetched from the web just now:\nChart.js 4 is loaded from jsdelivr.',
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      return blue
    },
  })
  assert.match(prompts[0]!, /^Reference notes fetched from the web just now/)
  assert.match(prompts[0]!, /Chart\.js 4 is loaded from jsdelivr/)
  assert.equal(result.status, 'applied')
})

test('a delete nobody asked for keeps the file and asks for a rename', async () => {
  const prompts: string[] = []
  const result = await runCodeEditTurn({
    files,
    prompt: 'Move the CSS into theme.css instead of styles.css.',
    complete: async (messages) => {
      prompts.push(messages.at(-1)?.content ?? '')
      if (prompts.length === 1) return '=== DELETE: styles.css'
      return '=== RENAME: styles.css -> theme.css'
    },
  })
  assert.equal(prompts.length, 2, 'the delete earns one corrective turn')
  assert.match(prompts[1]!, /did not ask to delete that file/)
  assert.equal(result.status, 'applied')
  assert.ok(result.files.some((file) => file.path === 'theme.css'), 'the rename landed')
  assert.ok(!result.files.some((file) => file.path === 'styles.css'), 'and the old path is gone')
})

test('a delete the request did ask for still happens', async () => {
  const result = await runCodeEditTurn({
    files,
    prompt: 'Delete app.js, the page no longer needs it.',
    complete: async () => '=== DELETE: app.js',
  })
  assert.equal(result.status, 'applied')
  assert.ok(!result.files.some((file) => file.path === 'app.js'))
})
