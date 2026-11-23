import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AGENT_HISTORY_CHARS,
  AGENT_MAX_ROUNDS,
  AGENT_NOTES_PATH,
  AGENT_OBSERVATION_CHARS,
  AGENT_RENDER_MAX,
  AGENT_SYSTEM,
  globToRegExp,
  parsePlan,
  parseAgentStep,
  parseRunOutput,
  renderPlan,
  sameTask,
  runCodeAgentTurn,
  elidedWriteIssue,
  closeCutPage,
} from '../src/worker/code-agent'
import { applyPageShell, stripPageShell } from '../src/worker/page-shell'
import { siteCode } from '../src/shared/sites'
import { orderByPreference } from '../src/worker/public-ai'
import { authWallNotice, quizPlan, quizSummary } from '../src/worker/browser-session'
import type { BrowserSessionLike, QuizPlan } from '../src/worker/browser-session'
import type { SandboxSessionLike } from '../src/worker/sandbox'

/**
 * A live lane can drop a single call without the turn being finished. That
 * retry path never fired in production testing, so it is pinned here: one
 * throw must be retried, the retry must not cost an extra call, and the work
 * already done must survive.
 */

function fakeSession() {
  const commands: string[] = []
  let stops = 0
  const session: SandboxSessionLike = {
    run: async (command: string) => {
      commands.push(command)
      return { ok: true, exitCode: 0, output: '' }
    },
    write: async () => ({ ok: true }),
    stop: async () => {
      stops += 1
    },
  }
  return { session, commands, stops: () => stops }
}

const env = { VERCEL_TOKEN: 'test', VERCEL_PROJECT_ID: 'test' }

/**
 * The sandbox used to be deny-all, so the prompt had to forbid installs. It is
 * registry-only now: a prompt that still says "no network" makes the agent
 * refuse a task that would actually work, which is the expensive failure.
 */
/**
 * The budget used to be the end of the task. It is now the end of a round: the
 * ledger goes back to the caller, and the next round starts with the files, the
 * plan and that ledger. These four pins are the whole contract.
 */
test('a round that runs out of calls hands back a ledger instead of ending the task', async () => {
  const { session } = fakeSession()
  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'count to three in a file',
    calls: 10,
    complete: async () => JSON.stringify({ tool: 'run_command', args: { command: 'echo hi' } }),
  })

  assert.equal(result.status, 'continue')
  assert.equal(result.resume?.round, 1)
  assert.ok((result.resume?.ledger.length ?? 0) > 0, 'the ledger is what survives the turn')
  assert.match(result.resume!.ledger[0]!, /run_command/)
  // The files still come back, so the caller saves the work the round did.
  assert.ok(Array.isArray(result.files))
})

test('the last round ends the task instead of looping forever', async () => {
  const { session } = fakeSession()
  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'count to three in a file',
    calls: 10,
    resume: { round: AGENT_MAX_ROUNDS - 1, ledger: ['✓ run_command: echo hi — hi'] },
    complete: async () => JSON.stringify({ tool: 'run_command', args: { command: 'echo hi' } }),
  })

  assert.equal(result.status, 'budget')
  assert.equal(result.resume, undefined, 'no further round may be requested')
})

/**
 * The production failure this pins: a requested 8-puzzle came back as a
 * 326-character stub ending inside `.wrap{...`, which replaced the 1.7 KB draft
 * the model had just written. Nothing noticed, so the turn reported success on
 * a page that could not run.
 */
test('a write that elides the rest of the file is refused and the draft is kept', async () => {
  let n = 0
  const draft = '<!doctype html><html><head><title>t</title><style>.a{color:red}</style></head><body><h1>Hi</h1></body></html>'
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'build a page',
    calls: 8,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: draft } })
      if (n === 2)
        return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: '<!doctype html><html><head><style>\n.wrap{...' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'built', status: 'done' } })
    },
  })

  assert.equal(
    result.files.find((file) => file.path === 'index.html')?.content,
    applyPageShell(draft),
    'the complete draft survived the stub instead of being replaced by it',
  )
  const refused = result.steps.find((step) => /Nothing was written/.test(step.detail ?? ''))
  assert.ok(refused, `expected the stub to be refused, steps: ${JSON.stringify(result.steps.map((s) => s.detail))}`)
  assert.equal(refused!.status, 'error')
})

test('an elided file is recognised, and a complete one is not', () => {
  assert.match(elidedWriteIssue('index.html', '<div class="wrap">…'), /ends with/)
  assert.match(elidedWriteIssue('index.html', '<style>.wrap{...}</style>'), /placeholder/)
  assert.match(elidedWriteIssue('index.html', '<html><body><script>let a = 1'), /<script> block is never closed/)
  assert.equal(elidedWriteIssue('index.html', '<!doctype html><html><body><h1>Hi</h1></body></html>'), '')
  assert.equal(elidedWriteIssue('app.js', 'const xs = [...items, 1]'), '', 'a spread is not an elision')
})

/**
 * The production shape of this: a complete page cut off mid-JSON, which used to
 * be counted as prose and shown in the chat as the final answer while the page
 * itself was never saved.
 */
test('a write cut off before its JSON closed is not taken as the answer', async () => {
  const prompts: string[] = []
  let n = 0
  const cut = `{"tool":"write_file","args":{"path":"index.html","content":"<!doctype html><html><body>${'x'.repeat(400)}`
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 8,
    openBrowser: async () => null,
    complete: async (messages) => {
      n += 1
      prompts.push(
        messages
          .map((message) => (typeof message.content === 'string' ? message.content : ''))
          .join('\n'),
      )
      if (n <= 3) return cut
      return JSON.stringify({ tool: 'finish', args: { answer: 'The page did not fit.', status: 'failed' } })
    },
  })

  assert.match(prompts[1] ?? '', /cut off at the length limit/, 'it is told why the reply did not arrive whole')
  assert.match(prompts[1] ?? '', /append_file/, 'and what to do instead')
  // The characters that arrived are the opening of the file, so they are kept —
  // exactly as they arrived, with no guessed ending. A repeat of the same
  // opening is not appended a second time.
  const kept = result.files.find((file) => file.path === 'index.html')
  assert.ok(kept, 'the opening that arrived is kept')
  assert.equal(stripPageShell(kept.content).length, '<!doctype html><html><body>'.length + 400)
  assert.match(kept.content, /data-ink-shell/, 'and it still ships with the design system')
  assert.doesNotMatch(result.answer, /"tool":"write_file"/, 'raw JSON never reaches the chat')
})

/**
 * One lane's output limit is not the prompt's wording. Production repeated the
 * chunking advice to the same model three times and got three cut-off writes and
 * no page, so the second cut-off has to retire that lane.
 */
test('two cut-off writes in a row retire the lane and keep the advice', async () => {
  let rejected = 0
  let n = 0
  const prompts: string[] = []
  const cut = `{"tool":"write_file","args":{"path":"index.html","content":"<!doctype html><html><body>${'x'.repeat(300)}`
  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 8,
    openBrowser: async () => null,
    onRejectedReply: () => {
      rejected += 1
    },
    complete: async (messages) => {
      n += 1
      prompts.push(
        messages
          .map((message) => (typeof message.content === 'string' ? message.content : ''))
          .join('\n'),
      )
      if (n <= 2) return cut
      return JSON.stringify({ tool: 'finish', args: { answer: 'stopped', status: 'failed' } })
    },
  })

  assert.equal(rejected, 1, 'the lane that cannot fit a write is retired once')
  assert.match(prompts[2] ?? '', /append_file/, 'the replacement model inherits the chunking advice')
})

/**
 * One production page turn reached 88/100 and then spent another four minutes
 * re-reading and re-patching. A page that is good enough is handed over, with
 * the score it reached, instead of being polished past it.
 */
/** A page that passes every check, so the cap is free to stop on it. */
const CLEAN_PAGE = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sunrise Bakery</title>',
  `<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;color:#14161a}main{max-width:64rem;margin:0 auto;padding:2rem 1.25rem}${'.row{padding:1rem}'.repeat(60)}@media (max-width: 640px){main{padding:1rem}}</style>`,
  '</head><body><main><h1>Sunrise Bakery</h1><p>',
  'Fresh sourdough, rye and seeded loaves are baked every morning before the shop opens. '.repeat(8),
  '</p></main></body></html>',
].join('')

test('a page that is good enough closes the turn and reports its score', async () => {
  let calls = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 12,
    openBrowser: async () => null,
    limits: { pageMs: 60_000, design: 1 },
    complete: async () => {
      calls += 1
      if (calls === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: CLEAN_PAGE } })
      return JSON.stringify({ tool: 'read_file', args: { path: 'index.html' } })
    },
  })

  assert.equal(calls, 2, 'a page that passes every check gets one call of grace, not three')
  assert.match(result.answer, /checks score 100\/100/, 'the score it stopped at is reported')
  assert.match(result.answer, /Every check passes/, 'and it says so plainly')
  assert.equal(result.status, 'done')
})

/**
 * A score on its own is not enough: 85 is one real failure plus one warning.
 * The page-turn ceiling ends the search anyway and says what it holds.
 */
test('a page that never passes still ends at the page-turn ceiling', async () => {
  let calls = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 12,
    openBrowser: async () => null,
    limits: { pageMs: 1 },
    complete: async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (calls === 1)
        return JSON.stringify({
          tool: 'write_file',
          args: { path: 'index.html', content: '<!doctype html><html><head><title>t</title></head><body><p>hi</p></body></html>' },
        })
      return JSON.stringify({ tool: 'read_file', args: { path: 'index.html' } })
    },
  })

  assert.ok(calls <= 3, 'the ceiling ends it within a call or two')
  assert.match(result.answer, /checks score \d+\/100/)
  assert.match(result.answer, /Still failing:/, 'it names the checks it gave up on')
  assert.equal(result.files.some((file) => file.path === 'index.html'), true, 'the page it wrote is kept')
})

test('a page too big for one reply is built with append_file', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 8,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1)
        return JSON.stringify({
          tool: 'write_file',
          args: { path: 'index.html', content: '<!doctype html><html><head><title>t</title></head><body><h1>Hi</h1>' },
        })
      if (n === 2)
        return JSON.stringify({
          tool: 'append_file',
          args: { path: 'index.html', content: '<script>const a = 1;</script></body></html>' },
        })
      return JSON.stringify({ tool: 'finish', args: { answer: 'built', status: 'done' } })
    },
  })

  const file = result.files.find((item) => item.path === 'index.html')
  assert.equal(
    file?.content,
    applyPageShell('<!doctype html><html><head><title>t</title></head><body><h1>Hi</h1>\n<script>const a = 1;</script></body></html>'),
  )
  assert.equal(result.steps.find((step) => step.tool === 'append_file')?.status, 'done')
})

test('a rewrite that throws away most of a file tells the model', async () => {
  let n = 0
  const prompts: string[] = []
  const big = `<!doctype html><html><head><title>t</title></head><body>${'<p>para</p>'.repeat(60)}</body></html>`
  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 8,
    openBrowser: async () => null,
    complete: async (messages) => {
      n += 1
      prompts.push(
        messages
          .map((message) => (typeof message.content === 'string' ? message.content : ''))
          .join('\n'),
      )
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: big } })
      if (n === 2)
        return JSON.stringify({
          tool: 'write_file',
          args: { path: 'index.html', content: '<!doctype html><html><head><title>t</title></head><body><p>one</p></body></html>' },
        })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  // The note rides on the second write's observation, so it shows up on the
  // call after it.
  assert.match(prompts.join('\n'), /replaced a \d+-character version/, 'the shrunken rewrite is not silent')
})

/**
 * A chunk is allowed to end mid-tag — that is what the next append is for —
 * but a chunk that summarises the rest of the file is still refused.
 */
test('append_file takes a partial chunk but refuses an elided one', async () => {
  let n = 0
  const prompts: string[] = []
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 8,
    openBrowser: async () => null,
    complete: async (messages) => {
      n += 1
      prompts.push(
        messages
          .map((message) => (typeof message.content === 'string' ? message.content : ''))
          .join('\n'),
      )
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: '<!doctype html><html><body>' } })
      if (n === 2) return JSON.stringify({ tool: 'append_file', args: { path: 'index.html', content: '<h1>ok</h1>\n…' } })
      if (n === 3)
        return JSON.stringify({ tool: 'append_file', args: { path: 'index.html', content: '<p>done</p></body></html>' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'built', status: 'done' } })
    },
  })

  assert.match(prompts[2] ?? '', /Nothing was appended: it ends with/, 'the elided chunk is refused')
  assert.match(
    result.files.find((item) => item.path === 'index.html')?.content ?? '',
    /<p>done<\/p><\/body>/,
    'the real chunk landed',
  )
})

test('check_page hands the model the page check failures', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 8,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: '<h1>only a heading</h1>' } })
      if (n === 2) return JSON.stringify({ tool: 'check_page', args: { path: 'index.html' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'checked', status: 'done' } })
    },
  })

  const check = result.steps.find((step) => step.tool === 'check_page')
  assert.ok(check, 'the check ran as a step')
  assert.match(String(check!.detail), /Page checks/, 'the model is told what the checks found')
})

test('a continued round is told what earlier rounds already did', async () => {
  const { session } = fakeSession()
  const prompts: string[] = []
  await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'count to three in a file',
    calls: 10,
    resume: { round: 1, ledger: ['✓ write_file: a.txt — wrote three lines'] },
    complete: async (messages) => {
      prompts.push(messages.map((message) => (typeof message.content === 'string' ? message.content : '')).join('\n'))
      return JSON.stringify({ tool: 'run_command', args: { command: 'echo hi' } })
    },
  })

  assert.match(prompts[0]!, /Already done earlier in this task/)
  assert.match(prompts[0]!, /write_file: a\.txt — wrote three lines/)
  assert.match(prompts[0]!, /Do not repeat these steps/)
})

/**
 * Vision in the code agent: the loop asks for a picture, and the picture reaches
 * the model as an image part on its next reply. It must not linger — an image of
 * a page that has since been clicked is worthless and costs tokens every call.
 */
test('a screenshot reaches the model as an image on the next reply and only once', async () => {
  const browser = fakeBrowser()
  const replies = [
    { tool: 'browser', args: { action: 'open', url: 'https://site.test/' } },
    { tool: 'browser', args: { action: 'screenshot' } },
    { tool: 'finish', args: { answer: 'seen the page', status: 'done' } },
  ]
  let n = 0
  const images: number[] = []

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'open the site and look at it',
    openBrowser: async () => browser.session,
    complete: async (messages) => {
      images.push(
        messages.reduce(
          (count, message) =>
            count +
            (Array.isArray(message.content)
              ? message.content.filter((part) => part.type === 'image_url').length
              : 0),
          0,
        ),
      )
      return JSON.stringify(replies[n++])
    },
  })

  assert.equal(result.status, 'done')
  // Step 1 has no picture yet; the open produces one; the screenshot replaces it.
  assert.deepEqual(images, [0, 1, 1])
})

test('the agent is told it can see the page', () => {
  assert.match(AGENT_SYSTEM, /"action":"screenshot"/)
  assert.match(AGENT_SYSTEM, /picture of the viewport is attached/)
  // A picture is layout evidence, never a source of values.
  assert.match(AGENT_SYSTEM, /never read a number or an answer off the image/)
})

test('the prompt says the registry works and the open web does not', () => {
  assert.doesNotMatch(AGENT_SYSTEM, /There is no network/)
  assert.match(AGENT_SYSTEM, /'npm install' works/)
  assert.match(AGENT_SYSTEM, /every other host is blocked/)
  assert.match(AGENT_SYSTEM, /pip has no package index/)
})

test('a dropped model call is retried once and the turn still finishes', async () => {
  const { session } = fakeSession()
  let invocations = 0
  const statuses: string[] = []

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'write a.txt',
    onStatus: (text) => {
      statuses.push(text)
    },
    complete: async () => {
      invocations += 1
      if (invocations === 1) throw new Error('lane dropped')
      if (invocations === 2) {
        return JSON.stringify({ tool: 'write_file', args: { path: 'a.txt', content: 'hi' } })
      }
      return JSON.stringify({ tool: 'finish', args: { answer: 'written', status: 'done' } })
    },
  })

  // drop → retry → write_file → finish → verification pushback → finish
  assert.equal(invocations, 4, 'the first call should have been tried twice')
  assert.equal(result.status, 'done')
  // The retry is the same slot; the verification pushback is its own call.
  assert.equal(result.calls, 3)
  assert.deepEqual(
    result.steps.map((step) => step.tool),
    ['write_file'],
  )
  assert.equal(result.steps[0]?.status, 'done')
  assert.equal(result.files.find((file) => file.path === 'a.txt')?.content, 'hi')
  assert.ok(
    statuses.some((text) => /retrying/i.test(text)),
    `expected a retry status, saw: ${JSON.stringify(statuses)}`,
  )
})

test('two failures in a row end the turn but keep the files and the steps', async () => {
  const { session } = fakeSession()
  let invocations = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'write keep.txt',
    complete: async () => {
      invocations += 1
      if (invocations === 1) {
        return JSON.stringify({ tool: 'write_file', args: { path: 'keep.txt', content: 'keep me' } })
      }
      throw new Error('lane gone')
    },
  })

  assert.equal(invocations, 4, 'two attempts, then a third with a shorter transcript')
  assert.equal(result.status, 'failed')
  assert.equal(result.reason, 'lane gone')
  assert.equal(result.files.find((file) => file.path === 'keep.txt')?.content, 'keep me')
  assert.deepEqual(
    result.steps.map((step) => step.tool),
    ['write_file'],
  )
  assert.match(result.answer, /unfinished/i)
})

test('a turn it owns always stops its sandbox, even when it fails', async () => {
  const { session, stops } = fakeSession()
  let invocations = 0

  const result = await runCodeAgentTurn({
    env,
    files: [],
    prompt: 'do something',
    openSession: async () => session,
    complete: async () => {
      invocations += 1
      throw new Error('never answers')
    },
  })

  assert.equal(result.status, 'failed')
  assert.equal(invocations, 3)
  assert.equal(stops(), 1, 'the owned sandbox must be stopped exactly once')
})

test('a session supplied by the caller is not stopped by the turn', async () => {
  const { session, stops } = fakeSession()

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'do something',
    complete: async () => {
      throw new Error('never answers')
    },
  })

  assert.equal(result.status, 'failed')
  assert.equal(stops(), 0, 'a borrowed session belongs to its caller')
})

test('an aliased tool name and flat arguments are accepted', () => {
  const parsed = parseAgentStep('{"tool":"Bash","command":"ls -la"}')
  assert.ok('step' in parsed, 'a flat call is a step, not a rejection')
  assert.equal(parsed.step.tool, 'run_command')
  assert.equal(parsed.step.args.command, 'ls -la')
})

test('an empty reply is retried as a dropped call, not held against the model', async () => {
  let calls = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'write a.txt',
    complete: async () => {
      calls += 1
      if (calls === 1) return ''
      if (calls === 2) return JSON.stringify({ tool: 'write_file', args: { path: 'a.txt', content: 'hi' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'written', status: 'done' } })
    },
  })

  // empty → retry → write_file → finish → verification pushback → finish
  assert.equal(calls, 4, 'the empty reply is retried, then the step is taken')
  assert.equal(result.status, 'done')
  assert.equal(result.calls, 3, 'the retry is the same call; the pushback is a new one')
  assert.deepEqual(
    result.steps.map((step) => step.tool),
    ['write_file'],
  )
})

test('finishing without doing anything is challenged once, then taken', async () => {
  let calls = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'write a.txt',
    complete: async () => {
      calls += 1
      if (calls === 1) return JSON.stringify({ tool: 'finish', args: { answer: 'Done!', status: 'done' } })
      if (calls === 2) return JSON.stringify({ tool: 'write_file', args: { path: 'a.txt', content: 'hi' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'written', status: 'done' } })
    },
  })

  assert.equal(calls, 3)
  assert.equal(result.status, 'done')
  assert.equal(result.answer, 'written')
  assert.deepEqual(
    result.steps.map((step) => step.tool),
    ['write_file'],
  )
})

test('a sandbox that throws is replaced instead of ending the turn', async () => {
  const dead: SandboxSessionLike = {
    run: async () => {
      throw new Error('connection reset')
    },
    write: async () => ({ ok: true }),
    stop: async () => undefined,
  }
  const replacement = fakeSession()
  const opened: SandboxSessionLike[] = []
  let calls = 0

  const result = await runCodeAgentTurn({
    env,
    session: dead,
    files: [{ path: 'a.txt', content: 'hi' }],
    prompt: 'run it four times',
    openSession: async () => {
      opened.push(replacement.session)
      return replacement.session
    },
    complete: async () => {
      calls += 1
      if (calls <= 4) return JSON.stringify({ tool: 'run_command', args: { command: 'echo ok' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'ran', status: 'done' } })
    },
  })

  assert.equal(opened.length, 1, 'exactly one replacement sandbox')
  assert.equal(result.status, 'done')
  assert.deepEqual(
    result.steps.map((step) => step.status),
    ['error', 'error', 'error', 'done'],
  )
  assert.ok(replacement.commands.length > 0, 'the step is retried in the new sandbox')
})

test('an array of steps is rejected instead of silently running the first', () => {
  const parsed = parseAgentStep('[{"tool":"finish","args":{"answer":"done"}}]')
  assert.ok('error' in parsed)
  assert.match(parsed.error, /one JSON object/i)
})

test('an unknown tool is rejected with the list of real ones', () => {
  const parsed = parseAgentStep('{"tool":"deploy_prod","args":{}}')
  assert.ok('error' in parsed)
  assert.match(parsed.error, /deploy_prod/)
  assert.match(parsed.error, /run_command/)
})

// 20, not 24: a free Worker gets 50 subrequests and a step costs about two, so
// a longer default dies on the platform rather than on its own budget.
test('a model that never finishes is stopped at the 20-call default', async () => {
  const { session } = fakeSession()
  let invocations = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'never stop',
    complete: async () => {
      invocations += 1
      return JSON.stringify({ tool: 'list_files', args: {} })
    },
  })

  assert.equal(invocations, 20, 'the default budget is 20 calls')
  assert.equal(result.calls, 20)
  // Exhausting the default budget is the end of a round, not of the task.
  assert.equal(result.status, 'continue')
  assert.equal(result.reason, 'calls')
  assert.equal(result.steps.length, 20, 'every call left a step in the transcript')
  // The message must explain itself, not echo the last command's output.
  assert.match(result.answer, /20 calls/i)
  assert.match(result.answer, /20 steps/i)
  assert.match(result.answer, /Carrying straight on/i)
  assert.equal(result.resume?.round, 1)
})

test('the budget cannot be asked below 10 or above 60', async () => {
  const run = async (calls: number) => {
    const { session } = fakeSession()
    let invocations = 0
    const result = await runCodeAgentTurn({
      env,
      session,
      files: [],
      prompt: 'never stop',
      calls,
      complete: async () => {
        invocations += 1
        return JSON.stringify({ tool: 'list_files', args: {} })
      },
    })
    return { invocations, result }
  }

  const low = await run(3)
  assert.equal(low.invocations, 10, 'a small request is raised to the floor of 10')
  assert.equal(low.result.calls, 10)

  const high = await run(99)
  assert.equal(high.invocations, 60, 'a large request is capped at 60')
  assert.equal(high.result.calls, 60)
  assert.equal(high.result.reason, 'calls')
})

test('search_files greps the sandbox and shows every hit', async () => {
  const runs: string[] = []
  const session: SandboxSessionLike = {
    run: async (command: string) => {
      runs.push(command)
      return { ok: true, exitCode: 0, output: 'src/a.ts:3:const foo = 1\nsrc/b.ts:9:foo()\n===INK-EXIT:0===' }
    },
    write: async () => ({ ok: true }),
    stop: async () => undefined,
  }
  const replies = [
    { tool: 'search_files', args: { pattern: 'foo', glob: '*.ts' } },
    { tool: 'finish', args: { answer: 'found', status: 'done' } },
  ]
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'find foo',
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.equal(result.steps[0]?.tool, 'search_files')
  assert.equal(result.steps[0]?.status, 'done')
  assert.match(result.steps[0]?.detail ?? '', /src\/a\.ts:3/)
  assert.match(runs.join('\n'), /grep -rnI --include='\*\.ts' -e 'foo' \./)
})

test('an empty search is answered, not treated as a failure', async () => {
  const session: SandboxSessionLike = {
    run: async () => ({ ok: true, exitCode: 1, output: '===INK-EXIT:1===' }),
    write: async () => ({ ok: true }),
    stop: async () => undefined,
  }
  const replies = [
    { tool: 'search_files', args: { pattern: 'missing' } },
    { tool: 'finish', args: { answer: 'nothing', status: 'done' } },
  ]
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'find nothing',
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.equal(result.steps[0]?.status, 'done')
  assert.match(result.steps[0]?.detail ?? '', /No match for missing/)
})

test('notes are saved, handed back, and carried into the next turn', async () => {
  const plan = '1. read a.ts\n2. rename foo to bar\n3. run the tests'
  const first = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'start the job',
    complete: (() => {
      const replies = [
        { tool: 'notes', args: { content: plan } },
        { tool: 'finish', args: { answer: 'planned', status: 'done' } },
      ]
      let n = 0
      return async () => JSON.stringify(replies[n++])
    })(),
  })

  assert.equal(first.notes, plan)
  assert.equal(first.files.find((file) => file.path === AGENT_NOTES_PATH)?.content, plan)

  let seen = ''
  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: first.files,
    notes: first.notes,
    prompt: 'carry on',
    complete: async (messages) => {
      seen = messages.map((message) => message.content).join('\n')
      return JSON.stringify({ tool: 'finish', args: { answer: 'ok', status: 'done' } })
    },
  })

  assert.match(seen, /rename foo to bar/, 'the notes must reach the next turn')
})

test('an observation is big enough to hold a real file or a stack trace', () => {
  assert.ok(AGENT_OBSERVATION_CHARS >= 10_000, `observations are ${AGENT_OBSERVATION_CHARS} characters`)
})

function bigOutput(size: number) {
  const body = 'L'.repeat(size)
  const session: SandboxSessionLike = {
    run: async () => ({ ok: true, exitCode: 0, output: `${body}\n===INK-EXIT:0===` }),
    write: async () => ({ ok: true }),
    stop: async () => undefined,
  }
  return session
}

test('the step being reasoned about is shown whole, however big it is', async () => {
  let prompts: string[] = []
  const replies = [
    { tool: 'run_command', args: { command: 'cat big.txt' } },
    { tool: 'finish', args: { answer: 'read it', status: 'done' } },
  ]
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session: bigOutput(19_000),
    files: [],
    prompt: 'read a big file',
    complete: async (messages) => {
      prompts = messages.map((message) => message.content)
      return JSON.stringify(replies[n++])
    },
  })

  assert.equal(result.status, 'done')
  const observation = prompts.find((content) => content.startsWith('Observation from run_command:')) ?? ''
  assert.ok(
    observation.length > 18_000,
    `the newest observation must arrive whole, got ${observation.length} characters`,
  )
})

test('a long turn keeps its prompt inside the history budget', async () => {
  let last = ''
  const result = await runCodeAgentTurn({
    env,
    session: bigOutput(19_000),
    files: [],
    prompt: 'keep going',
    calls: 12,
    complete: async (messages) => {
      last = messages.map((message) => message.content).join('\n')
      return JSON.stringify({ tool: 'run_command', args: { command: 'echo x' } })
    },
  })

  assert.equal(result.status, 'continue')
  const stepsKept = (last.match(/Observation from run_command:/g) || []).length
  assert.ok(stepsKept > 2, `older steps should survive in compressed form, saw ${stepsKept}`)
  assert.ok(
    last.length <= AGENT_HISTORY_CHARS + AGENT_OBSERVATION_CHARS + 4_000,
    `prompt grew to ${last.length} characters`,
  )
})

function fakeBrowser() {
  const actions: string[] = []
  let closes = 0
  const page = (label: string) => ({ url: 'https://site.test/', title: 'Site', text: `URL: https://site.test/\nPage text:\n${label}` })
  const session: BrowserSessionLike = {
    open: async (url: string) => {
      actions.push(`open ${url}`)
      return page('welcome')
    },
    read: async () => page('read'),
    click: async (target: string) => {
      actions.push(`click ${target}`)
      return { ok: true, detail: `Clicked "${target}".`, page: page(`after ${target}`) }
    },
    type: async (text: string) => {
      actions.push(`type ${text}`)
      return { ok: true, detail: 'Typed.', page: page('typed') }
    },
    press: async (key: string) => {
      actions.push(`press ${key}`)
      return { ok: true, detail: `Pressed ${key}.`, page: page('pressed') }
    },
    wait: async (seconds: number) => {
      actions.push(`wait ${seconds}`)
      return { ok: true, detail: `Waited ${seconds}s; the page moved on.`, page: page('next question') }
    },
    waitFor: async (target: string, seconds: number) => {
      actions.push(`waitFor ${target} ${seconds}`)
      return { ok: true, detail: `"${target}" appeared.`, page: page(`after ${target}`) }
    },
    scroll: async (by: number, target: string) => {
      actions.push(`scroll ${by} ${target}`)
      return { ok: true, detail: `Scrolled ${by > 0 ? 'down' : 'up'} by ${Math.abs(by)}px.`, page: page('scrolled') }
    },
    video: async (command: { play?: boolean; mute?: boolean; rate?: number; seek?: number; end?: boolean }) => {
      actions.push(`video ${JSON.stringify(command)}`)
      return { ok: true, detail: 'Video is 8m 00s long, now at 7m 59s, playing at 2×.', page: page('video end') }
    },
    back: async () => {
      actions.push('back')
      return { ok: true, detail: 'Went back.', page: page('back') }
    },
    screenshot: async () => 'data:image/jpeg;base64,SHOT',
    autoplay: async (plan: QuizPlan) => {
      actions.push(`autoplay ${plan.rounds ?? 7} ${(plan.answers ?? []).length}`)
      return {
        ok: true,
        complete: true,
        detail:
          '7 prompts played · 545 pts · the run is complete.\n1. "name a living animal that is bigger or" → giant grouper (DEEP CUT, 90 pts)',
        page: page('DIVE COMPLETE — 545 pts'),
      }
    },
    close: async () => {
      closes += 1
    },
  }
  return { session, actions, closes: () => closes }
}

test('the browser opens a page, clicks, and closes with the turn', async () => {
  const browser = fakeBrowser()
  const replies = [
    { tool: 'browser', args: { action: 'open', url: 'https://site.test/' } },
    { tool: 'browser', args: { action: 'click', text: 'Start' } },
    { tool: 'finish', args: { answer: 'played', status: 'done' } },
  ]
  let n = 0

  const shots: string[] = []
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'open the site and start',
    openBrowser: async () => browser.session,
    onShot: (shot) => {
      shots.push(shot.url)
    },
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.equal(shots.length, 2, 'one picture per browser action, for the workspace')
  assert.equal(result.status, 'done')
  assert.deepEqual(browser.actions, ['open https://site.test/', 'click Start'])
  assert.equal(browser.closes(), 1, 'the browser is closed when the turn ends')
  assert.match(result.steps[0]?.detail ?? '', /welcome/)
})

test('a timed run is played in one browser action and the transcript comes back', async () => {
  const browser = fakeBrowser()
  // The URL in the task is opened before the first reply, so the run is the
  // very first thing the model asks for.
  const replies = [
    {
      tool: 'browser',
      args: { action: 'autoplay', answers: [{ match: 'animal|creature', picks: ['giant grouper', 'ocean sunfish'] }] },
    },
    { tool: 'finish', args: { answer: 'played all seven', status: 'done' } },
  ]
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'go to https://krillion.io and complete the daily dive',
    openBrowser: async () => browser.session,
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.equal(result.status, 'done')
  assert.equal(browser.actions.length, 2, 'the whole run is one action')
  assert.equal(browser.actions[0], 'open https://krillion.io')
  assert.match(browser.actions[1] ?? '', /^autoplay 7 \d+$/, 'one autoplay carries the model rows and the measured bank')
  const playedStep = result.steps.find((step) => /prompts played/.test(step.detail))
  assert.ok(playedStep, 'the transcript is in the step list')
  assert.match(playedStep.detail, /7 prompts played/)
  assert.match(playedStep.detail, /giant grouper/)
})

test('a reply that names only a browser action is still that browser step', () => {
  assert.deepEqual(parseAgentStep('{"action":"autoplay","answers":[{"match":"bird","picks":["oilbird"]}]}'), {
    step: {
      tool: 'browser',
      args: { action: 'autoplay', answers: [{ match: 'bird', picks: ['oilbird'] }] },
    },
  })
  assert.deepEqual(parseAgentStep('{"action":"click","text":"DIVE"}'), {
    step: { tool: 'browser', args: { action: 'click', text: 'DIVE' } },
  })
  // A word that is not a browser control is still a protocol error.
  const wrong = parseAgentStep('{"action":"explode"}')
  assert.ok('error' in wrong)
})

test('a finished run is not played a second time', async () => {
  const browser = fakeBrowser()
  const replies = [
    { tool: 'browser', args: { action: 'autoplay', answers: [{ match: 'bird', picks: ['oilbird'] }] } },
    { tool: 'browser', args: { action: 'autoplay', answers: [{ match: 'bird', picks: ['kagu'] }] } },
    { tool: 'finish', args: { answer: 'played all seven', status: 'done' } },
  ]
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'go to https://krillion.io and complete the daily dive',
    openBrowser: async () => browser.session,
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.equal(result.status, 'done')
  assert.equal(browser.actions.filter((action) => action.startsWith('autoplay')).length, 1, 'only one run is played')
  const refused = result.steps.find((step) => /already complete/.test(step.detail))
  assert.ok(refused, 'the second run is refused with the transcript in hand')
  assert.match(refused.detail, /giant grouper/)
})

test('a quiz plan takes the shapes a model actually sends, and fills its defaults', () => {
  const plan = quizPlan({
    answers: [
      { pattern: 'bird', answers: ['oilbird', 'kagu'] },
      { match: '', picks: ['nothing'] },
      { match: 'film', pick: 'Sátántangó' },
    ],
    rounds: 99,
    budgetMs: 5,
  })
  assert.deepEqual(plan.answers.slice(0, 2), [
    { match: 'bird', picks: ['oilbird', 'kagu'] },
    { match: 'film', picks: ['Sátántangó'] },
  ])
  assert.ok(plan.answers.length > 20, 'the measured bank fills the shapes the model did not name')
  assert.ok(
    plan.answers.some((row) => row.match === 'number' && row.picks.includes("graham's number")),
    'a number prompt gets a rare answer even when the model sent none',
  )
  // The runner takes the first row that matches, so a specific shape has to be
  // ahead of the broad one it also belongs to.
  const at = (match: string) => plan.answers.findIndex((row) => row.match === match)
  assert.ok(at('battle royale') >= 0 && at('battle royale') < at('video game'), 'a battle royale game is not answered as a video game')
  assert.ok(at('multiple balls|more than one ball|several balls') < at('sport'), 'a multiple-balls game is not answered as a sport')
  assert.ok(at('scoop') < at('tool'), 'a scoop is not answered as a tool')
  assert.deepEqual(plan.fallback, ['Graham’s number'], 'a run with no fallback still gets one')
  assert.equal(plan.rounds, 20, 'rounds are clamped')
  assert.equal(plan.budgetMs, 10_000, 'the budget is clamped')
  assert.equal(quizPlan({}).rounds, 7)
})

test('the run transcript names every prompt, its answer and the score', () => {
  const summary = quizSummary({
    steps: [
      { prompt: 'name a bird', answer: 'oilbird', tier: 'DEEP CUT', pts: 90 },
      { prompt: 'name a number', answer: 'Graham’s number' },
    ],
    complete: true,
  })
  assert.equal(summary.ok, true)
  assert.match(summary.detail, /2 prompts played · 90 pts · the run is complete/)
  assert.match(summary.detail, /1\. "name a bird" → oilbird \(DEEP CUT, 90 pts\)/)
  assert.match(summary.detail, /2\. "name a number" → Graham’s number \(not scored\)/)
  assert.equal(quizSummary({ steps: [], ended: 'timeout' }).ok, false)
})

test('with a browser on offer, reading pages stops after two and points at it', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'use the site',
    openBrowser: async () => fakeBrowser().session,
    fetchPage: async (url: string) => `page body for ${url}`,
    complete: async () => {
      n += 1
      return JSON.stringify({ tool: 'fetch_url', args: { url: `https://site.test/${n}` } })
    },
  })

  const stopped = result.steps.find((step) => /Stop using fetch_url/i.test(step.detail))
  assert.ok(stopped, 'the third read is refused with the browser named')
})

test('two prose replies in a row are taken as the answer, not retried forever', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'write a file and tell me about it',
    calls: 10,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'a.txt', content: 'hi' } })
      return 'I wrote a.txt containing the word hi, and that is everything the task asked for.'
    },
  })

  assert.equal(result.status, 'done', 'the prose answer ends the turn')
  assert.match(result.answer, /I wrote a\.txt/, 'the answer is what the model actually said')
  assert.equal(result.reason, 'answered-in-prose')
  assert.ok(n <= 4, `it stopped asking after two prose replies (made ${n} calls)`)
})

test('a question answered in prose never burns the whole budget', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'what does HTML stand for?',
    calls: 20,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      return 'HTML stands for HyperText Markup Language, which is the language web pages are written in.'
    },
  })

  assert.equal(result.status, 'blocked', 'it stops rather than claiming success')
  assert.match(result.answer, /HyperText Markup Language/)
  assert.match(result.answer, /Nothing was run or changed/)
  assert.equal(n, 3, 'three prose replies, then the answer is taken')
})

test('a single prose reply is still a protocol error, not an answer', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'write a file',
    calls: 8,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return 'Let me think about how to do this task properly.'
      if (n === 2) return JSON.stringify({ tool: 'write_file', args: { path: 'a.txt', content: 'hi' } })
      if (n === 3) return JSON.stringify({ tool: 'run_command', args: { command: 'cat a.txt' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'wrote a.txt', status: 'done' } })
    },
  })

  assert.ok(result.steps.some((step) => step.label === 'unreadable reply'), 'the prose is reported')
  assert.equal(result.reason, undefined)
})

test('finishing after writing files without running anything is pushed back once', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'write a script',
    calls: 8,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'run.js', content: 'console.log(1)' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'it works', status: 'done' } })
    },
  })

  // write_file, finish, the pushback, then the finish it accepts.
  assert.equal(n, 3, 'the turn asked for proof once and took the second finish')
  assert.equal(result.status, 'done', 'the second finish is taken')
})

test('a file that was run afterwards is not pushed back', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'write and run a script',
    calls: 8,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'run.js', content: 'console.log(1)' } })
      if (n === 2) return JSON.stringify({ tool: 'run_command', args: { command: 'node run.js' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'it prints 1', status: 'done' } })
    },
  })

  assert.ok(
    !result.steps.some((step) => /have not run anything since/.test(step.detail || '')),
    'a run command is proof enough to finish',
  )
  assert.equal(result.status, 'done')
})

test('a step is found even when the reply keeps talking after it', () => {
  const trailing = parseAgentStep('{"tool":"run_command","command":"ls"} — that is {all}.\nDone.')
  assert.ok('step' in trailing)
  if ('step' in trailing) assert.equal(trailing.step.args['command'], 'ls')

  const proseFirst = parseAgentStep('I will look at the files {first}.\n{"tool":"list_files","args":{}}')
  assert.ok('step' in proseFirst)
  if ('step' in proseFirst) assert.equal(proseFirst.step.tool, 'list_files')

  const two = parseAgentStep('{"tool":"notes","args":{"content":"a"}}{\"tool\":\"finish\"}')
  assert.ok('step' in two)
  if ('step' in two) assert.equal(two.step.tool, 'notes')
})

test('a flat step with no args wrapper still runs', () => {
  const flat = parseAgentStep('{"tool":"write_file","path":"x.txt","content":"hi"}')
  assert.ok('step' in flat)
  if ('step' in flat) {
    assert.equal(flat.step.args['path'], 'x.txt')
    assert.equal(flat.step.args['content'], 'hi')
  }
})

test('glob matches like a shell, not like a substring', () => {
  assert.ok(globToRegExp('**/*.ts').test('src/deep/a.ts'), '** crosses folders')
  assert.ok(globToRegExp('**/*.ts').test('a.ts'), '**/ may match no folder at all')
  assert.ok(!globToRegExp('src/*.ts').test('src/deep/a.ts'), 'a single * stays in one folder')
  assert.ok(!globToRegExp('*.md').test('docs/x.md'), 'a bare * is not recursive')
  assert.ok(globToRegExp('README.md').test('README.md'))
  assert.ok(globToRegExp('v?.json').test('v1.json'))
  assert.ok(!globToRegExp('v?.json').test('v10.json'))
})

test('a plan survives the turn that wrote it', async () => {
  const first = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'plan a two-part job',
    calls: 4,
    openBrowser: async () => null,
    complete: (() => {
      let n = 0
      return async () => {
        n += 1
        if (n === 1) return JSON.stringify({ tool: 'todo', args: { items: ['read the code', 'change it'] } })
        if (n === 2) return JSON.stringify({ tool: 'todo', args: { done: 1 } })
        return JSON.stringify({ tool: 'finish', args: { answer: 'planned', status: 'done' } })
      }
    })(),
  })

  const saved = first.files.find((file) => file.path === 'PLAN.md')
  assert.ok(saved, 'the checklist is written into the project')
  assert.match(saved.content, /- \[x\] read the code/, 'the tick is saved')
  assert.match(saved.content, /- \[ \] change it/, 'the open item is saved')

  // The next turn starts from that file, without being told about it.
  let other = 0
  const second = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: first.files,
    prompt: 'carry on with the two-part job',
    calls: 4,
    openBrowser: async () => null,
    complete: async () => {
      other += 1
      if (other === 1) return JSON.stringify({ tool: 'todo', args: {} })
      return JSON.stringify({ tool: 'finish', args: { answer: 'ok', status: 'done' } })
    },
  })

  assert.match(second.steps[0]?.detail ?? '', /change it/, 'the next turn reads the saved plan back')
})

test('several reads can share one reply', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [
      { path: 'a.js', content: 'const a = 1' },
      { path: 'b.js', content: 'const b = 2' },
      { path: 'c.css', content: 'body{color:red}' },
    ],
    prompt: 'read a.js and b.js',
    calls: 6,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1)
        return JSON.stringify({
          tool: 'batch',
          args: {
            steps: [
              { tool: 'read_file', args: { path: 'a.js' } },
              { tool: 'read_file', args: { path: 'b.js' } },
              { tool: 'glob', args: { pattern: '**/*.css' } },
            ],
          },
        })
      return JSON.stringify({ tool: 'finish', args: { answer: 'read', status: 'done' } })
    },
  })

  assert.equal(result.calls, 2, 'three reads cost one call, not three')
  const detail = result.steps[0]?.detail ?? ''
  assert.match(detail, /const a = 1/)
  assert.match(detail, /const b = 2/)
  assert.match(detail, /c\.css/)
})

test('a batch refuses anything that changes the project', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'batch a write',
    calls: 6,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1)
        return JSON.stringify({
          tool: 'batch',
          args: { steps: [{ tool: 'write_file', args: { path: 'x.txt', content: 'no' } }] },
        })
      return JSON.stringify({ tool: 'finish', args: { answer: 'ok', status: 'done' } })
    },
  })

  assert.equal(result.files.length, 0, 'the write never happened')
  assert.match(result.steps[0]?.detail ?? '', /a batch runs read_file, glob, list_files, fetch_url and web_search/)
})

test('a long task keeps its own history in front of the model', async () => {
  let n = 0
  let lastSystem = ''

  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'do twelve small things',
    calls: 16,
    openBrowser: async () => null,
    complete: async (messages: { role: string; content: string }[]) => {
      n += 1
      const system = messages.find((message) => message.role === 'system')
      if (system) lastSystem = String(system.content)
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'first.js', content: 'x' } })
      if (n <= 12) return JSON.stringify({ tool: 'run_command', args: { command: `echo step${n}` } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  assert.match(lastSystem, /What you have already done in this task/, 'the ledger is in the instructions')
  assert.match(lastSystem, /write_file: first\.js/, 'an early step far outside the transcript is still listed')
  assert.match(lastSystem, /run_command: echo step12/, 'the most recent work is listed too')
})

test('a shell rm is reflected in the project, not left as a ghost file', async () => {
  const session: SandboxSessionLike = {
    run: async () => ({
      ok: true,
      exitCode: 0,
      output: '===INK-EXIT:0===\n===INK-LIST:a.txt\n===INK-LIST:PLAN.md\n',
    }),
    write: async () => ({ ok: true }),
    stop: async () => {},
  }
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [
      { path: 'a.txt', content: 'a' },
      { path: 'gone.txt', content: 'x' },
      { path: 'PLAN.md', content: '- [ ] x\n' },
    ],
    prompt: 'delete gone.txt with rm',
    calls: 4,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'run_command', args: { command: 'rm gone.txt' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'removed', status: 'done' } })
    },
  })

  assert.deepEqual(
    result.files.map((file) => file.path).sort(),
    ['PLAN.md', 'a.txt'],
    'the file the shell deleted is gone from the project too',
  )
})

test('a shell mv keeps the content at the new path', async () => {
  const session: SandboxSessionLike = {
    run: async (command: string) => {
      // Both scripts mention the marker, so match the copy-back by its shape.
      if (command.startsWith('for f in')) {
        return { ok: true, exitCode: 0, output: `===INK-FILE:docs/readme.md===\n${btoa('moved text')}\n` }
      }
      return {
        ok: true,
        exitCode: 0,
        output: '===INK-EXIT:0===\n===INK-LIST:docs/readme.md\n===INK-LIST:keep.txt\n',
      }
    },
    write: async () => ({ ok: true }),
    stop: async () => {},
  }
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [
      { path: 'keep.txt', content: 'k' },
      { path: 'readme.md', content: 'moved text' },
    ],
    prompt: 'move readme.md into docs',
    calls: 4,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'run_command', args: { command: 'mkdir -p docs && mv readme.md docs/readme.md' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'moved', status: 'done' } })
    },
  })

  const paths = result.files.map((file) => file.path).sort()
  assert.deepEqual(paths, ['docs/readme.md', 'keep.txt'], 'the old path is gone and the new one exists')
  assert.equal(
    result.files.find((file) => file.path === 'docs/readme.md')?.content,
    'moved text',
    'the content survived the rename',
  )
})

test('a listing that would wipe out most of the project is ignored', async () => {
  const session: SandboxSessionLike = {
    run: async () => ({ ok: true, exitCode: 0, output: '===INK-EXIT:0===\n===INK-LIST:only.txt\n' }),
    write: async () => ({ ok: true }),
    stop: async () => {},
  }
  const many = Array.from({ length: 12 }, (_, index) => ({ path: `f${index}.txt`, content: 'x' }))
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: many,
    prompt: 'list the files',
    calls: 4,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'run_command', args: { command: 'ls' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'listed', status: 'done' } })
    },
  })

  assert.equal(result.files.length, 12, 'a suspicious listing never empties the project')
})

test('an oversized file listing is not trusted to remove anything', () => {
  const parsed = parseRunOutput('===INK-EXIT:0===\n===INK-LIST-TRUNC===\n===INK-LIST:a.txt\n')
  assert.equal(parsed.presentComplete, false)
  assert.deepEqual(parsed.present, ['a.txt'])
  assert.equal(parsed.exitCode, 0)
})

test('every result tells the model how much of the turn is left', async () => {
  let n = 0
  const seen: string[] = []

  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'run things forever',
    calls: 12,
    openBrowser: async () => null,
    complete: async (messages: { content: string }[]) => {
      n += 1
      seen.push(String(messages[messages.length - 1]?.content ?? ''))
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'a.js', content: 'x' } })
      return JSON.stringify({ tool: 'run_command', args: { command: `echo ${n}` } })
    },
  })

  assert.match(seen[1] ?? '', /call 1\/12/, 'the second call sees one used of twelve')
  assert.match(seen[1] ?? '', /11 left/, 'and how many are left')
  assert.doesNotMatch(seen[1] ?? '', /wrap up/, 'with plenty left there is no hurry')
  assert.match(seen[7] ?? '', /wrap up/, 'a nearly-spent turn is told to wrap up')
})

test('an old checklist does not hijack an unrelated request', async () => {
  const saved = [
    { path: 'PLAN.md', content: '# migrate the billing database\n- [ ] dump the tables\n- [ ] rewrite the schema\n' },
  ]
  assert.ok(!sameTask('migrate the billing database', 'make a snake game'), 'a different task is not the same task')
  assert.ok(sameTask('migrate the billing database', 'finish the billing database migrate'), 'the same words are the same task')
  assert.ok(sameTask('', 'anything at all'), 'an older file with no task line is offered as before')

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: saved,
    prompt: 'make a snake game in canvas',
    calls: 4,
    openBrowser: async () => null,
    complete: (() => {
      let n = 0
      return async () => {
        n += 1
        if (n === 1) return JSON.stringify({ tool: 'todo', args: {} })
        return JSON.stringify({ tool: 'finish', args: { answer: 'ok', status: 'done' } })
      }
    })(),
  })

  assert.match(
    result.steps[0]?.detail ?? '',
    /no plan yet/i,
    'the old checklist is not offered to a different task',
  )
})

function parsePlanRoundTrip(text: string): string {
  return renderPlan(parsePlan(text))
}

test('the plan file round-trips through its own parser', () => {
  const text = '- [x] done thing\n- [ ] open thing\nnot a line\n* [ ] starred\n'
  assert.equal(parsePlan(text).length, 3, 'only checklist lines count')
  assert.equal(parsePlanRoundTrip(text), '- [x] done thing\n- [ ] open thing\n- [ ] starred\n')
  assert.deepEqual(parsePlan(''), [])
})

test('the plan is kept, ticked off, and read back', async () => {
  let n = 0
  const seen: string[] = []

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'do three things',
    calls: 6,
    openBrowser: async () => null,
    complete: async (messages: { content: string }[]) => {
      n += 1
      const last = messages[messages.length - 1]?.content ?? ''
      seen.push(last)
      if (n === 1) return JSON.stringify({ tool: 'todo', args: { items: ['read the code', 'change it', 'test it'] } })
      if (n === 2) return JSON.stringify({ tool: 'todo', args: { done: 1 } })
      if (n === 3) return JSON.stringify({ tool: 'todo', args: {} })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  const observations = result.steps.map((step) => step.detail || '').join('\n')
  assert.match(observations, /1\. \[x\] read the code/, 'the first item is ticked')
  assert.match(observations, /2\. \[ \] change it/, 'the rest are still open')
  assert.match(result.steps[1]?.label ?? '', /todo 1\/3/, 'the step label carries the progress')
})

test('a file can be deleted and renamed', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [
      { path: 'old.txt', content: 'hello' },
      { path: 'keep.txt', content: 'keep' },
    ],
    prompt: 'rename old.txt to new.txt and delete keep.txt',
    calls: 5,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'move_file', args: { from: 'old.txt', to: 'new.txt' } })
      if (n === 2) return JSON.stringify({ tool: 'delete_file', args: { path: 'keep.txt' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  const paths = result.files.map((file) => file.path)
  assert.deepEqual(paths, ['new.txt'], 'the rename replaced the old path and the delete removed the other')
  assert.equal(result.files[0]?.content, 'hello', 'the content survived the rename')
})

test('a reply with raw newlines in a big string is repaired, not thrown away', () => {
  // A real newline inside the JSON string is exactly what breaks a long file write.
  const raw = '{"tool":"write_file","args":{"path":"game.html","content":"<h1>one</h1>\n<p>two</p>"}}'
  const result = parseAgentStep(raw)
  assert.ok('step' in result, `expected a parsed step, got ${'error' in result ? result.error : ''}`)
  if ('step' in result) {
    assert.equal(result.step.tool, 'write_file')
    assert.match(String(result.step.args['content']), /one<\/h1>\n<p>two/, 'the newline survives')
  }
})

test('a trailing comma does not lose the whole step', () => {
  const result = parseAgentStep('{"tool":"notes","args":{"content":"plan",}}')
  assert.ok('step' in result)
  if ('step' in result) assert.equal(result.step.args['content'], 'plan')
})

test('the same action a fourth time is refused, not repeated to the cap', async () => {
  const browser = fakeBrowser()

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'click next forever',
    calls: 9,
    openBrowser: async () => browser.session,
    complete: async () => JSON.stringify({ tool: 'browser', args: { action: 'click', text: 'Next' } }),
  })

  const clicks = browser.actions.filter((action) => action.startsWith('click')).length
  assert.equal(clicks, 4, 'the fourth repeat refuses to click')
  assert.ok(
    result.steps.some((step) => /Blocked: the same action/.test(step.detail)),
    'the model is told why nothing happened',
  )
})

test('scrolling passes the distance and the target through', async () => {
  const browser = fakeBrowser()
  let n = 0

  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'scroll down to the footer',
    calls: 4,
    openBrowser: async () => browser.session,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://site.test/' } })
      if (n === 2) return JSON.stringify({ tool: 'browser', args: { action: 'scroll', by: 800 } })
      if (n === 3) return JSON.stringify({ tool: 'browser', args: { action: 'scroll', text: 'Contact us' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  assert.match(browser.actions[1] ?? '', /scroll 800/, 'a pixel distance reaches the browser')
  assert.match(browser.actions[2] ?? '', /scroll .*Contact us/, 'a named target reaches the browser')
})

test('a video lesson is jumped through, not waited out', async () => {
  const browser = fakeBrowser()
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'watch the lesson and answer its questions',
    openBrowser: async () => browser.session,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://lesson.test/' } })
      if (n === 2) return JSON.stringify({ tool: 'browser', args: { action: 'video', rate: 2, end: true } })
      if (n === 3) return JSON.stringify({ tool: 'browser', args: { action: 'waitfor', text: 'Question 1' } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  assert.match(browser.actions[1] ?? '', /"rate":2/, 'the playback speed is passed through')
  assert.match(browser.actions[1] ?? '', /"end":true/, 'jumping to the end is passed through')
  assert.match(browser.actions[2] ?? '', /waitFor Question 1/, 'the wait-for text is passed through')
  assert.match(result.steps[1]?.detail ?? '', /8m 00s/, 'the model is told how long the video is')
})

test('a sign-in page is reported as a wall, not guessed at', () => {
  assert.match(
    authWallNotice('https://accounts.google.com/v3/signin/identifier', 0, 'Sign in with your Google Account'),
    /AUTH WALL/,
    'a Google sign-in page is a wall even before a password field renders',
  )
  assert.match(authWallNotice('https://example.test/login', 1, 'Welcome back'), /AUTH WALL/, 'a password field is a wall')
  assert.doesNotMatch(
    authWallNotice('https://krillion.io/', 0, 'KRILLION THE DAILY DIVE 7 prompts · 25 seconds each'),
    /AUTH WALL/,
    'an ordinary page with a search box is not a wall',
  )
  assert.equal(authWallNotice('https://docs.new', 0, 'Untitled document'), '')
})

test('a spent browser allowance ends the turn instead of fetching around it', async () => {
  const session: BrowserSessionLike = {
    ...fakeBrowser().session,
    open: async () => {
      throw new Error('Unable to create new browser: code: 429: message: Rate limit exceeded')
    },
  }

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'Play the dive at https://krillion.io to the end',
    openBrowser: async () => session,
    complete: async () =>
      JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://krillion.io' } }),
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.reason, 'browser-quota')
  assert.match(result.answer, /free minutes for today/i)
})

test('the note file is not read back to the person as part of the answer', async () => {
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'summarise the dive',
    notes: 'Plan: open krillion and work down the ladder',
    complete: async () =>
      JSON.stringify({
        tool: 'finish',
        args: { answer: 'The dive needs a browser. Plan: open krillion and work down the ladder', status: 'blocked' },
      }),
  })

  assert.equal(result.answer.trim(), 'The dive needs a browser.')
})

test('a lane preference puts the named models first and touches nothing else', () => {
  const lanes = [
    { model: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra 550B' },
    { model: 'openai/gpt-oss-120b', label: 'gpt-oss-120b (Groq)' },
    { model: '@cf/openai/gpt-oss-20b', label: 'gpt-oss-20b (Workers AI)' },
    { model: 'command-a-plus-05-2026', label: 'Command A+ (Cohere)' },
  ]

  const pinned = orderByPreference(lanes, ['command-a-plus', 'gpt-oss-120b'])
  assert.deepEqual(
    pinned.map((lane) => lane.label),
    ['Command A+ (Cohere)', 'gpt-oss-120b (Groq)', 'Nemotron 3 Ultra 550B', 'gpt-oss-20b (Workers AI)'],
    'the first named lane leads, the second follows it, the rest keep their order',
  )
  assert.deepEqual(orderByPreference(lanes, []), lanes, 'no preference changes nothing')
  assert.deepEqual(
    orderByPreference(lanes, ['@cf/openai']).map((lane) => lane.label),
    ['gpt-oss-20b (Workers AI)', 'Nemotron 3 Ultra 550B', 'gpt-oss-120b (Groq)', 'Command A+ (Cohere)'],
    'a model id is matched, not just a label',
  )
  assert.deepEqual(orderByPreference(lanes, ['not-a-real-model']), lanes, 'an unknown name is not a filter')
})

test('a lane that replies in prose is not asked again', async () => {
  let rejected = 0
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'do the thing',
    onRejectedReply: () => {
      rejected += 1
    },
    complete: async () => {
      n += 1
      if (n === 1) return 'Sure! I will now click the button for you.'
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  assert.equal(rejected, 1, 'the caller is told, so it can pick another model')
  assert.equal(result.status, 'done')
})

test('a page on a timer is waited for, not abandoned', async () => {
  const browser = fakeBrowser()
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'answer the question, then wait for the next one',
    openBrowser: async () => browser.session,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://site.test/' } })
      if (n === 2) return JSON.stringify({ tool: 'browser', args: { action: 'wait', seconds: 7 } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'waited', status: 'done' } })
    },
  })

  assert.deepEqual(browser.actions, ['open https://site.test/', 'wait 7'], 'the wait is really performed')
  assert.match(result.steps[1]?.detail ?? '', /Waited 7s/)
  assert.equal(result.status, 'done')
})

test('the browser allowance stops at eight actions', async () => {
  const browser = fakeBrowser()
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'click a lot',
    openBrowser: async () => browser.session,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://site.test/' } })
      if (n <= 11) return JSON.stringify({ tool: 'browser', args: { action: 'click', text: `Next ${n}` } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  const clicks = browser.actions.filter((action) => action.startsWith('click')).length
  assert.equal(clicks, 7, 'one open plus seven clicks is the whole allowance')
  assert.equal(result.steps[8]?.status, 'error')
  assert.match(result.steps[8]?.detail ?? '', /allowance/i)
})

test('a limits override lifts the per-turn ceilings', async () => {
  const browser = fakeBrowser()
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'click many times',
    // The open counts as an action, so thirteen allows twelve clicks.
    limits: { browser: 13 },
    openBrowser: async () => browser.session,
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://site.test/' } })
      if (n <= 13) return JSON.stringify({ tool: 'browser', args: { action: 'click', text: `Next ${n}` } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  const clicks = browser.actions.filter((action) => action.startsWith('click')).length
  assert.equal(clicks, 12, 'the override, not the default eight, is the ceiling')
  assert.ok(result.steps.every((step) => step.status === 'done'))
})

test('the browser tool says so when the deployment has none', async () => {
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'open a site',
    calls: 10,
    complete: async () => JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://site.test/' } }),
  })

  assert.equal(result.steps[0]?.status, 'error')
  assert.match(result.steps[0]?.detail ?? '', /no browser available/i)
})

test('fetch_url reads a page and never fetches the same URL twice', async () => {
  const { session } = fakeSession()
  const fetched: string[] = []
  const replies = [
    { tool: 'fetch_url', args: { url: 'https://example.com/a' } },
    { tool: 'fetch_url', args: { url: 'https://example.com/a#section' } },
    { tool: 'fetch_url', args: { url: 'https://example.com/a' } },
    { tool: 'finish', args: { answer: 'read it', status: 'done' } },
  ]
  let step = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'read a page',
    fetchPage: async (url) => {
      fetched.push(url)
      return 'page body'
    },
    complete: async () => JSON.stringify(replies[step++]),
  })

  assert.equal(fetched.length, 1, 'a repeat and a fragment variant come from the turn cache')
  assert.equal(result.status, 'done')
  assert.equal(result.steps.length, 3)
  assert.ok(result.steps.every((entry) => entry.status === 'done'))
})

test('the web allowance stops at four requests in a turn', async () => {
  const { session } = fakeSession()
  const fetched: string[] = []
  let n = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'read five pages',
    fetchPage: async (url) => {
      fetched.push(url)
      return `body of ${url}`
    },
    complete: async () => {
      n += 1
      if (n <= 5) return JSON.stringify({ tool: 'fetch_url', args: { url: `https://example.com/${n}` } })
      return JSON.stringify({ tool: 'finish', args: { answer: 'done', status: 'done' } })
    },
  })

  assert.equal(fetched.length, 4, 'the fifth request must not reach the network')
  assert.equal(result.steps.length, 5)
  assert.equal(result.steps[4]?.status, 'error')
  assert.match(result.steps[4]?.detail ?? '', /allowance/i)
})

test('web tools report themselves off when no reader is configured', async () => {
  const { session } = fakeSession()
  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'read a page',
    complete: async () => JSON.stringify({ tool: 'fetch_url', args: { url: 'https://example.com' } }),
    calls: 10,
  })

  assert.equal(result.steps[0]?.status, 'error')
  assert.match(result.steps[0]?.detail ?? '', /not enabled/i)
})

test('a subrequest cap ends the turn at once instead of retrying', async () => {
  const { session } = fakeSession()
  let invocations = 0

  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'anything',
    complete: async () => {
      invocations += 1
      throw new Error('Too many subrequests by single Worker invocation.')
    },
  })

  assert.equal(invocations, 1, 'a capped Worker cannot fetch again, so do not retry')
  assert.equal(result.status, 'failed')
  assert.equal(result.reason, 'subrequest-limit')
  assert.match(result.answer, /subrequest/i)
})

test('a finish call carries its status through to the result', async () => {
  const { session } = fakeSession()
  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'blocked task',
    complete: async () => JSON.stringify({ tool: 'finish', args: { answer: 'needs a login', status: 'blocked' } }),
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.answer, 'needs a login')
})

/*
 * The workspace follows the agent, and the free rendering minutes are defended
 * twice. A page travels as its siteCode handle so nothing Ink writes names the
 * site; a page the agent wrote travels as an artifact; a page nobody touched is
 * read as text without opening Chrome; and the render budget is carried forward
 * so continuing a task cannot reset it.
 */
test('the page the agent opens reaches the workspace as a handle, never an address', async () => {
  const views: { kind: string; handle?: string; path?: string }[] = []
  const replies = [
    { tool: 'browser', args: { action: 'open', url: 'https://site.test/quiz' } },
    { tool: 'finish', args: { answer: 'looked', status: 'done' } },
  ]
  let n = 0
  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'look at the quiz',
    openBrowser: async () => fakeBrowser().session,
    onView: (view) => {
      views.push(view as { kind: string; handle?: string; path?: string })
    },
    complete: async () => JSON.stringify(replies[n++]),
  })

  const page = views.find((view) => view.kind === 'page')
  assert.ok(page, 'the page is announced to the workspace')
  assert.equal(page!.handle, siteCode('https://site.test/'))
  assert.doesNotMatch(String(page!.handle), /site\.test/, 'the address itself never travels')
})

test('a page the agent writes is announced as an artifact', async () => {
  const views: { kind: string; handle?: string; path?: string }[] = []
  const replies = [
    { tool: 'write_file', args: { path: 'index.html', content: '<h1>hi</h1>' } },
    { tool: 'finish', args: { answer: 'built', status: 'done' } },
  ]
  let n = 0
  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    onView: (view) => {
      views.push(view as { kind: string; handle?: string; path?: string })
    },
    complete: async () => JSON.stringify(replies[n++]),
  })

  // The page travels with the view: the workspace shows what was written now,
  // not at the end of a four-minute turn.
  assert.deepEqual(views, [{ kind: 'artifact', path: 'index.html', html: applyPageShell('<h1>hi</h1>') }])
})

test('a page nobody touched is read as text instead of spending a render', async () => {
  const browser = fakeBrowser()
  const replies = [
    { tool: 'browser', args: { action: 'open', url: 'https://site.test/' } },
    { tool: 'browser', args: { action: 'read' } },
    { tool: 'finish', args: { answer: 'read it', status: 'done' } },
  ]
  let n = 0
  let fetched = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'read that page',
    openBrowser: async () => browser.session,
    fetchPage: async () => {
      fetched += 1
      return 'x'.repeat(900)
    },
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.equal(fetched, 1, 'the read went through fetch')
  assert.deepEqual(browser.actions, ['open https://site.test/'], 'the second look opened no browser action')
  const read = result.steps.find((step) => step.label === 'browser: read')
  assert.match(read?.detail ?? '', /did not need rendering/)
})

test('a task that has spent its renders cannot open the browser again', async () => {
  const browser = fakeBrowser()
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'keep going',
    calls: 10,
    resume: { round: 1, ledger: ['✓ browser: open — welcome'], renders: AGENT_RENDER_MAX },
    openBrowser: async () => browser.session,
    complete: async () =>
      JSON.stringify({ tool: 'browser', args: { action: 'open', url: 'https://site.test/' } }),
  })

  assert.deepEqual(browser.actions, [], 'no page was opened')
  assert.ok(
    result.steps.some((step) => /rendering budget for this task is used/.test(step.detail)),
    'the model is told the budget is gone',
  )
})

/**
 * Parallelism: a batch runs its sub-steps together. Two page fetches are almost
 * all waiting, and a sequential batch made the round pay for that wait twice.
 */
test('a batch runs its sub-steps at the same time', async () => {
  let live = 0
  let peak = 0
  const fetched: string[] = []
  const replies = [
    {
      tool: 'batch',
      args: {
        steps: [
          { tool: 'fetch_url', args: { url: 'https://a.test/' } },
          { tool: 'fetch_url', args: { url: 'https://b.test/' } },
        ],
      },
    },
    { tool: 'finish', args: { answer: 'read both', status: 'done' } },
  ]
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'read both pages',
    calls: 6,
    fetchPage: async (url: string) => {
      live += 1
      peak = Math.max(peak, live)
      await new Promise((resolve) => setTimeout(resolve, 20))
      live -= 1
      fetched.push(url)
      return `text of ${url}`
    },
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.equal(peak, 2, 'both fetches were in flight at once')
  assert.equal(fetched.length, 2)
  const detail = result.steps[0]?.detail ?? ''
  assert.match(detail, /text of https:\/\/a\.test\//)
  assert.match(detail, /text of https:\/\/b\.test\//)
})

// Concurrency must not buy extra web requests: the allowance is spent before
// each step's first await, so the second one in a batch sees what the first left.
test('two fetches in one batch cannot spend more web requests than the turn has', async () => {
  const fetched: string[] = []
  const replies = [
    {
      tool: 'batch',
      args: {
        steps: [
          { tool: 'fetch_url', args: { url: 'https://a.test/' } },
          { tool: 'fetch_url', args: { url: 'https://b.test/' } },
        ],
      },
    },
    { tool: 'finish', args: { answer: 'done', status: 'done' } },
  ]
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'read both pages',
    calls: 6,
    limits: { web: 1 },
    fetchPage: async (url: string) => {
      fetched.push(url)
      return `text of ${url}`
    },
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.deepEqual(fetched, ['https://a.test/'], 'the second fetch never left the Worker')
  assert.match(result.steps[0]?.detail ?? '', /allowance for this turn is used up/)
})

/**
 * Background processes: a dev server never exits, so it is started detached and
 * its log polled. Blocking a call on it was a guaranteed timeout.
 */
test('a dev server is started in the background and its output polled', async () => {
  const commands: string[] = []
  const session: SandboxSessionLike = {
    run: async (command: string) => {
      commands.push(command)
      const output = command.includes('nohup')
        ? 'INK-BG dev: running (pid 42)\n--- log ---\nVITE v6 ready in 312 ms'
        : command.includes('/tmp/ink-bg/dev.log')
          ? 'INK-BG dev: running (pid 42)\n--- log (last 40 lines) ---\nLocal: http://localhost:5173/'
          : ''
      return { ok: true, exitCode: 0, output }
    },
    write: async () => ({ ok: true }),
    stop: async () => {},
  }
  const replies = [
    { tool: 'run_background', args: { command: 'npm run dev', name: 'dev' } },
    { tool: 'read_logs', args: { id: 'dev' } },
    { tool: 'finish', args: { answer: 'the dev server is up', status: 'done' } },
  ]
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'start the dev server',
    calls: 8,
    complete: async () => JSON.stringify(replies[n++]),
  })

  assert.match(commands[0] ?? '', /\/tmp\/ink-bg\/dev\.sh/)
  assert.match(commands[0] ?? '', /nohup/)
  assert.match(result.steps[0]?.detail ?? '', /VITE v6 ready/)
  assert.match(result.steps[1]?.detail ?? '', /localhost:5173/)
})

test('background tools answer to the names models use, and are in the prompt', () => {
  assert.deepEqual(parseAgentStep('{"tool":"bg","args":{"command":"npm run dev"}}'), {
    step: { tool: 'run_background', args: { command: 'npm run dev' } },
  })
  assert.deepEqual(parseAgentStep('{"tool":"logs","args":{"id":"dev"}}'), {
    step: { tool: 'read_logs', args: { id: 'dev' } },
  })
  assert.match(AGENT_SYSTEM, /run_background/)
  assert.match(AGENT_SYSTEM, /read_logs/)
})

/**
 * Production reported "85/100, one failure" while the build frame showed 73 with
 * two: the answer described the best score the page ever had, not the page as it
 * was. A regression must be reported, and must not count as a finish.
 */
test('a page made worse after passing is reported as it stands', async () => {
  let calls = 0
  const worse =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title></head><body><button>Go</button></body></html>'
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 12,
    openBrowser: async () => null,
    limits: { design: 1, pageMs: 3 },
    complete: async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (calls === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: CLEAN_PAGE } })
      if (calls === 2) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: worse } })
      return JSON.stringify({ tool: 'read_file', args: { path: 'index.html' } })
    },
  })

  assert.ok(calls <= 4, 'it stops at the ceiling')
  assert.match(result.answer, /Still failing:/, 'the current failures are named')
  assert.doesNotMatch(result.answer, /Every check passes/, 'a broken page is never described as passing')
  assert.doesNotMatch(result.answer, /score 100\/100/, 'and the best-ever score is not quoted')
})

/**
 * Production built a whole page with `cat >> index.html` heredocs. run_command
 * copies those files back, but the step's checks had already run, so the page
 * was never scored, never previewed and never bounded by its own clock.
 */
test('a page written by a shell redirect is refused so the checks can see it', async () => {
  const prompts: string[] = []
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 8,
    openBrowser: async () => null,
    limits: { pageMs: 60_000, design: 1 },
    complete: async (messages) => {
      n += 1
      prompts.push(JSON.stringify(messages))
      if (n === 1)
        return JSON.stringify({
          tool: 'run_command',
          args: { command: "cat > index.html <<'HTML'\n<!doctype html><html><body><h1>Hi</h1></body></html>\nHTML" },
        })
      if (n === 2) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: CLEAN_PAGE } })
      return JSON.stringify({ tool: 'read_file', args: { path: 'index.html' } })
    },
  })

  assert.match(prompts[1] ?? '', /invisible to the page checks/, 'the refusal says why the shell write is not allowed')
  assert.match(prompts[1] ?? '', /append_file/, 'and names the tool that replaces it')
  assert.equal(result.status, 'done')
  assert.match(result.answer, /checks score 100\/100/, 'the page written afterwards is the one that is reported')
})

/**
 * A page written by a command must be scored like any other page, or a model
 * that reaches for the shell gets no failures to fix and no page clock.
 */
test('a page a command wrote is checked like any other write', async () => {
  const html = Buffer.from('<!doctype html><html><head><title>t</title></head><body><p>hi</p></body></html>').toString(
    'base64',
  )
  const session: SandboxSessionLike = {
    run: async (command: string) => ({
      ok: true,
      exitCode: 0,
      output: /echo hi/.test(command) ? `===INK-EXIT:0===\n===INK-FILE:index.html===\n${html}\n` : '',
    }),
    write: async () => ({ ok: true }),
    stop: async () => undefined,
  }
  const result = await runCodeAgentTurn({
    env,
    session,
    files: [],
    prompt: 'make a page',
    calls: 3,
    openBrowser: async () => null,
    limits: { pageMs: 1, turnMs: 60_000 },
    complete: async () =>
      JSON.stringify({ tool: 'run_command', args: { command: 'echo hi > /tmp/x' } }),
  })

  assert.ok(result.page, 'the command-written page is reported as the page')
  assert.match(result.answer, /checks score \d+\/100/, 'it is scored, not just saved')
})

/**
 * "Design 68" tells a model nothing it can act on, and a production turn spent
 * four polish rounds guessing at the layout until the page clock ran out. The
 * audit knows which points it withheld, so the leftover time is spent on those.
 */
test('a design verdict below the bar names the points the page has not earned', async () => {
  const prompts: string[] = []
  let n = 0
  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 3,
    openBrowser: async () => null,
    limits: { pageMs: 60_000, design: 100 },
    complete: async (messages) => {
      n += 1
      prompts.push(JSON.stringify(messages))
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: CLEAN_PAGE } })
      return JSON.stringify({ tool: 'finish', args: { status: 'done', answer: 'done' } })
    },
  })

  const said = prompts[1] ?? ''
  assert.match(said, /below the 100 bar/, 'the bar is named, not just the score')
  assert.match(said, /Biggest gaps: .*\(\+\d+\)/, 'the missing points and what they are worth reach the model')
})

/**
 * A reply cut off mid-string is not a sketch to refuse: the characters that
 * arrived are the opening of the file. A production turn burned its first minute
 * on two of them and then rebuilt the page from nothing.
 */
test('a write cut off mid-string is kept as the opening of the file', async () => {
  const prompts: string[] = []
  const at = CLEAN_PAGE.lastIndexOf('<p>')
  const opening = CLEAN_PAGE.slice(0, at)
  const rest = CLEAN_PAGE.slice(at)
  // Exactly what a lane returns when it runs out of room: the JSON never closes.
  const cut = JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: opening } }).slice(0, -4)
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 4,
    openBrowser: async () => null,
    limits: { pageMs: 60_000, design: 1 },
    complete: async (messages) => {
      n += 1
      prompts.push(JSON.stringify(messages))
      if (n === 1) return cut
      if (n === 2) return JSON.stringify({ tool: 'append_file', args: { path: 'index.html', content: rest } })
      return JSON.stringify({ tool: 'finish', args: { status: 'done', answer: 'done' } })
    },
  })

  assert.equal(result.status, 'done')
  assert.match(prompts[1] ?? '', /saved as index\.html instead of lost/, 'the kept opening is reported')
  assert.match(result.answer, /checks score 100\/100/, 'the page is complete once the rest is appended')
})

/**
 * A first write cut off inside <style> used to be refused outright, which kept
 * the file list honest and left the turn with no page at all. Closing the block
 * at its last complete rule keeps the rules that arrived; the runtime design
 * system styles the rest, so the page is not blank and is not lost.
 */
test('a first write cut off inside the stylesheet is closed, not thrown away', async () => {
  const prompts: string[] = []
  let n = 0
  const opening = CLEAN_PAGE.slice(0, CLEAN_PAGE.indexOf('</style>'))
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 3,
    openBrowser: async () => null,
    limits: { pageMs: 60_000, design: 1 },
    complete: async (messages) => {
      n += 1
      prompts.push(JSON.stringify(messages))
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: opening } })
      return JSON.stringify({ tool: 'finish', args: { status: 'done', answer: 'done' } })
    },
  })

  const stored = result.files.find((file) => file.path === 'index.html')?.content ?? ''
  assert.match(stored, /<\/style>/, 'the stylesheet is closed')
  assert.match(stored, /data-ink-shell/, 'and the page still carries the design system')
  assert.ok(stored.length > 500, 'the part of the page that arrived is kept')
})

/** A batch that also names a todo used to fail whole, throwing away the readings. */
test('a batch runs the steps it can and names the one it cannot', async () => {
  const prompts: string[] = []
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [{ path: 'a.txt', content: 'hello' }],
    prompt: 'look at things',
    calls: 3,
    openBrowser: async () => null,
    complete: async (messages) => {
      n += 1
      prompts.push(JSON.stringify(messages))
      if (n === 1)
        return JSON.stringify({
          tool: 'batch',
          args: {
            steps: [
              { tool: 'read_file', args: { path: 'a.txt' } },
              { tool: 'todo', args: { items: ['x'] } },
            ],
          },
        })
      return JSON.stringify({ tool: 'finish', args: { status: 'done', answer: 'done' } })
    },
  })

  assert.match(prompts[1] ?? '', /hello/, 'the readable step still ran')
  assert.match(prompts[1] ?? '', /was skipped/, 'the one it cannot batch is named')
  assert.ok(result.steps.some((step) => step.tool === 'batch' && step.status === 'done'))
})

/**
 * The whole-turn bound must not depend on a page being scored. Without this the
 * turn ran to the five-minute round deadline and asked for another round, so the
 * person waited past 330s and never got an answer at all.
 */
test('a turn that never gets a page checked still ends with an answer', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'poke around',
    calls: 20,
    openBrowser: async () => null,
    limits: { pageMs: 1, turnMs: 1 },
    complete: async () => {
      n += 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      return JSON.stringify({ tool: 'run_command', args: { command: 'echo hi' } })
    },
  })

  assert.ok(n <= 3, 'the turn is bounded even with no page')
  assert.equal(result.status, 'budget')
  assert.equal(result.reason, 'turn-cap')
  assert.match(result.answer, /limit/, 'it says the time ran out')
})

/**
 * Production delivered a 15 KB page while the receipt quoted the score of a
 * 3.4 KB draft: append_file returned early while the document was open, so the
 * last verdict belonged to an older, smaller file.
 */
test('an append mid-document still reports the checks for the joined page', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 4,
    openBrowser: async () => null,
    limits: { pageMs: 60_000, design: 1 },
    complete: async () => {
      n += 1
      if (n === 1) return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: CLEAN_PAGE } })
      if (n === 2)
        return JSON.stringify({
          tool: 'append_file',
          args: { path: 'index.html', content: `<style>.x{color:red;padding:${'2rem '.repeat(30)}` },
        })
      return JSON.stringify({ tool: 'read_file', args: { path: 'index.html' } })
    },
  })

  const appended = result.steps.find((step) => step.tool === 'append_file')
  assert.ok(appended, 'the append ran')
  assert.match(appended.detail, /not a complete document yet/, 'it still says the document is open')
  assert.ok(
    appended.detail.includes('Page checks passed') || appended.detail.includes('Page checks failed'),
    'the verdict describes the joined page, not the chunk',
  )
})

/**
 * Production spent fifteen calls in a row watching the same 6 KB page be cut
 * off: every retry was refused with the same advice and never reached append.
 * After three cut-offs the whole-file write is closed for the turn, so the only
 * path left is the chunked one.
 */
test('a page cut off three times cannot be written whole again', async () => {
  let n = 0
  const prompts: string[] = []
  const tooBig = `<!doctype html><html><head><style>${'body{color:#111}'.repeat(80)}`
  await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 6,
    openBrowser: async () => null,
    limits: { pageMs: 60_000, design: 1 },
    complete: async (messages) => {
      n += 1
      prompts.push(JSON.stringify(messages))
      return JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: tooBig } })
    },
  })

  assert.ok(n <= 20, 'the loop did not run away')
  assert.ok(
    prompts.some((prompt) => prompt.includes('closed for the rest of this turn')),
    'the fourth attempt is refused before the content, with append_file as the only way on',
  )
  assert.ok(prompts.some((prompt) => prompt.includes('append_file')), 'and append_file is named')
})

/**
 * Production, measured: after writing a working page the model read the same
 * file nine more times, one 15-second call each, and the turn ended at 216 s.
 * A repeated read of an unchanged file teaches nothing, and a page that exists
 * is the deliverable — neither may buy another round.
 */
test('a repeated read of an unchanged file is refused, and the page ends the turn', async () => {
  let n = 0
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 6,
    openBrowser: async () => null,
    complete: async () => {
      n += 1
      if (n === 1)
        return JSON.stringify({
          tool: 'write_file',
          args: { path: 'index.html', content: '<!doctype html><html><head><title>t</title></head><body><h1>Hi</h1></body></html>' },
        })
      return JSON.stringify({ tool: 'read_file', args: { path: 'index.html' } })
    },
  })

  assert.ok(result.steps.some((step) => /\(repeated\)/.test(step.label)), 'the second identical read is refused')
  assert.equal(result.files.some((file) => file.path === 'index.html'), true, 'the page is kept')
  assert.equal(result.status, 'done', 'a written page is not abandoned as a failure')
})

test('a written page ends the turn instead of opening another round', async () => {
  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 1,
    openBrowser: async () => null,
    complete: async () =>
      JSON.stringify({
        tool: 'write_file',
        args: { path: 'index.html', content: '<!doctype html><html><head><title>t</title></head><body><h1>Hi</h1></body></html>' },
      }),
  })

  assert.equal(result.status, 'done')
  assert.equal(result.reason, 'page-budget')
  assert.equal(result.resume, undefined, 'no second round: the page is the answer')
})

/**
 * The lane cut the very first page write inside its own <style>. Refusing it
 * was honest but useless: the turn ended with no page. Closing the block at the
 * last complete rule keeps the part that arrived.
 */
test('a first page cut off inside its stylesheet is closed and kept', async () => {
  const cut = `<!doctype html><html lang="en"><head><title>t</title><style>.a{color:red}.b{border:0${'x'.repeat(600)}`
  const trimmed = closeCutPage(cut)
  assert.match(trimmed, /\.a\{color:red\}/)
  assert.doesNotMatch(trimmed, /\.b\{border/)
  assert.match(trimmed, /<\/style>/)

  const result = await runCodeAgentTurn({
    env,
    session: fakeSession().session,
    files: [],
    prompt: 'make a page',
    calls: 2,
    openBrowser: async () => null,
    complete: async () => JSON.stringify({ tool: 'write_file', args: { path: 'index.html', content: cut } }),
  })
  const stored = result.files.find((file) => file.path === 'index.html')?.content ?? ''
  assert.match(stored, /\.a\{color:red\}/, 'the complete rule survived')
  assert.match(stored, /data-ink-shell/, 'the page still carries the design system')
})
