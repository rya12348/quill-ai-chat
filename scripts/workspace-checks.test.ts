import assert from 'node:assert/strict'
import test from 'node:test'

import { bracketProblem, newWorkspaceProblems, workspaceProblems } from '../src/worker/workspace-checks'

const page = (body: string, head = '<meta charset="utf-8"><title>Card</title>') =>
  `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`

test('bracket balance ignores strings, comments and regex literals', () => {
  assert.equal(bracketProblem('const a = { b: [1, 2] };'), null)
  assert.equal(bracketProblem('const s = "}{"; // } '), null)
  assert.equal(bracketProblem('const r = /\\d{2}/g; const t = /[}]/;'), null)
  assert.equal(bracketProblem('const t = `a ${"}"} b`;'), null)
  assert.match(bracketProblem('function f() {') ?? '', /never closed/)
  assert.match(bracketProblem('if (a > 1) {') ?? '', /never closed/)
  assert.match(bracketProblem('const s = "unterminated;') ?? '', /never closed/)
})

test('a reference to a file that is not there is a problem', () => {
  const problems = workspaceProblems([
    { path: 'index.html', content: page('<link rel="stylesheet" href="styles.css"><h1>Card</h1>') },
  ])
  assert.equal(problems.length, 1)
  assert.match(problems[0]!, /"styles\.css" is referenced but that file does not exist/)
})

test('a reference that resolves, or leaves the workspace, is fine', () => {
  const problems = workspaceProblems([
    {
      path: 'index.html',
      content: page(
        '<link rel="stylesheet" href="styles.css"><a href="https://example.com">x</a><a href="#main">y</a><img src="data:image/png;base64,AA">',
      ),
    },
    { path: 'styles.css', content: 'body { margin: 0 }' },
  ])
  assert.deepEqual(problems, [])
})

test('unclosed markup and unparsable scripts are reported with their path', () => {
  const problems = workspaceProblems([
    { path: 'index.html', content: page('<div><h1>Card</h1><section>open') },
    { path: 'app.js', content: 'function go() { return 1 ' },
    { path: 'styles.css', content: 'body { margin: 0 ' },
  ])
  assert.ok(problems.some((problem) => /index\.html: \d+ <div> block/.test(problem)), problems.join('\n'))
  assert.ok(problems.some((problem) => /app\.js: .*never closed/.test(problem)))
  assert.ok(problems.some((problem) => /styles\.css: 1 CSS block/.test(problem)))
})

test('only problems the edit introduced are returned', () => {
  const before = [{ path: 'index.html', content: page('<div>open') }]
  const after = [{ path: 'index.html', content: page('<div>open<span>still open') }]
  const introduced = newWorkspaceProblems(before, after)
  assert.ok(introduced.every((problem) => /span/.test(problem)), introduced.join('\n'))
  assert.deepEqual(newWorkspaceProblems(before, before), [])
})

test('a stylesheet no page loads is reported as doing nothing', () => {
  const problems = workspaceProblems([
    {
      path: 'index.html',
      content: page('<style>body{margin:0}</style><h1>Card</h1>'),
    },
    { path: 'styles.css', content: 'body{margin:0}' },
  ])
  assert.ok(
    problems.some((problem) => /styles\.css: no page or script references this file/.test(problem)),
    problems.join('\n'),
  )
  assert.deepEqual(
    workspaceProblems([
      { path: 'index.html', content: page('<link rel="stylesheet" href="styles.css"><h1>Card</h1>') },
      { path: 'styles.css', content: 'body{margin:0}' },
    ]),
    [],
  )
})

test('a script imported by another script is not an orphan', () => {
  const problems = workspaceProblems([
    { path: 'index.html', content: page('<script type="module" src="app.js"></script><h1>Card</h1>') },
    { path: 'app.js', content: "import { start } from './util.js'\nstart()" },
    { path: 'util.js', content: 'export function start() {}' },
  ])
  assert.deepEqual(problems, [])
})
