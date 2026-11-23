// Head-to-head bench for the keyless models Buffy Code can reach.
//
// It runs the production edit path, not a prompt in a vacuum: the same
// workspace, the same dialect, the same page checks, one attempt and one round
// so the number is the model's own quality rather than our repair loop's. The
// tasks get harder on purpose and are graded by deterministic assertions on the
// resulting files, because "applied" is a floor every model clears.
//
//   npx tsx scripts/model-bench.ts
//
// Results print and are written to the OS temp directory. Nothing imports this.
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { workspacePages, type WorkspaceFile } from '../src/shared/workspace'
import { verifyPages } from '../src/worker/build'
import { runCodeEditTurn } from '../src/worker/code-edit'
import { geminiWebText } from '../src/worker/gemini-web'
import type { ChatMessage } from '../src/worker/public-ai'

const files: WorkspaceFile[] = [
  {
    path: 'index.html',
    content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Card</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="card">
    <h1>Card</h1>
    <p>A small page used to test edits.</p>
    <button id="go">Go</button>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
  },
  {
    path: 'styles.css',
    content: `:root{--ink:#222;--paper:#f7f4ec}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,sans-serif}
.card{border:1px solid #ddd;border-radius:12px;padding:24px}
button{min-height:44px;padding:0 18px}
@media (max-width:600px){.card{padding:16px}}
`,
  },
  {
    path: 'app.js',
    content: `document.getElementById('go').addEventListener('click', function () {
  document.querySelector('.card').style.background = '#eef';
});
`,
  },
]

type Task = { name: string; prompt: string; checks: { id: string; test: (files: WorkspaceFile[]) => boolean }[] }

const all = (files: WorkspaceFile[]) =>
  files.map((file) => `${file.path}\n${file.content}`).join('\n\n')

const TASKS: Task[] = [
  {
    name: 'three-changes',
    prompt:
      'Change the heading text to "Model Bench", make the button background blue, and add a footer that says Built by Buffy.',
    checks: [
      { id: 'heading', test: (f) => /Model Bench/.test(all(f)) },
      { id: 'footer', test: (f) => /<footer[^>]*>[\s\S]{0,300}Built by Buffy/i.test(all(f)) },
      {
        id: 'blue',
        test: (f) => /button[^{]*\{[^}]*\b(blue|#00f|#0000ff|#1d4ed8|#2563eb|#3b82f6|rgb\(\s*0,\s*0,\s*255)/i.test(all(f)),
      },
    ],
  },
  {
    name: 'theme-toggle',
    prompt:
      'Make the button toggle the card between light and dark theme, remember the choice after a reload, and update the button label to show the theme that clicking it will switch to.',
    checks: [
      { id: 'storage', test: (f) => /localStorage/.test(all(f)) },
      { id: 'toggles', test: (f) => /classList\.(?:toggle|add|remove)|dataset\.theme|setAttribute\(\s*['"]data-theme/i.test(all(f)) },
      { id: 'label', test: (f) => /\.(?:textContent|innerText)\s*=/.test(all(f)) },
      { id: 'dark-css', test: (f) => /dark/i.test(all(f)) },
      { id: 'restores', test: (f) => /getItem\(/.test(all(f)) },
    ],
  },
  {
    name: 'email-form',
    prompt:
      'Add a newsletter form with a required email field that validates on submit without reloading the page, shows an inline error when the address is invalid, and saves valid addresses in localStorage under "emails" as an array with the newest first and at most five kept.',
    checks: [
      { id: 'prevents', test: (f) => /preventDefault\(/.test(all(f)) },
      { id: 'email-type', test: (f) => /type\s*=\s*["']email["']/i.test(all(f)) },
      { id: 'inline-error', test: (f) => /aria-live|role\s*=\s*["']alert["']|id\s*=\s*["'][^"']*error/i.test(all(f)) },
      { id: 'json-storage', test: (f) => /JSON\.(?:stringify|parse)/.test(all(f)) },
      { id: 'keeps-five', test: (f) => /slice\(\s*0\s*,\s*5\s*\)|length\s*>\s*5|MAX_?\w*\s*=\s*5/i.test(all(f)) },
    ],
  },
]

const MAX_MS = 150_000

type Candidate = { name: string; url: string; model: string; key?: string; custom?: boolean }

const CANDIDATES: Candidate[] = [
  { name: 'OVH DeepSeek-V4.1-Flash', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'DeepSeek-V4.1-Flash-1017' },
  { name: 'OVH Qwen3.5-397B-A17B', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'Qwen3.5-397B-A17B' },
  { name: 'OVH gpt-oss-120b', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'gpt-oss-120b' },
  { name: 'OVH Qwen3.6-27B', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'Qwen3.6-27B' },
  { name: 'Kilo auto/free', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'kilo-auto/free' },
  { name: 'Kilo north-mini-code', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'cohere/north-mini-code:free' },
  { name: 'Kilo nemotron-3-ultra', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
  { name: 'Kilo glyph-cluster', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'stealth/glyph-cluster' },
  { name: 'Kilo openrouter/free', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'openrouter/free' },
  { name: 'BlockRun nemotron-3-super', url: 'https://blockrun.ai/api/v1/chat/completions', model: 'nvidia/nemotron-3-super-120b' },
  { name: 'BlockRun laguna-xs-2.1', url: 'https://blockrun.ai/api/v1/chat/completions', model: 'poolside/laguna-xs-2.1' },
  { name: 'Pollinations openai-fast', url: 'https://text.pollinations.ai/openai', model: 'openai-fast' },
  { name: 'Gemini web', url: 'gemini-web', model: 'gemini-web', custom: true },
]

type Row = { name: string; task: string; status: string; passed: number; total: number; missing: string; problems: number; ms: number; error?: string }

async function complete(candidate: Candidate, messages: ChatMessage[]): Promise<string> {
  if (candidate.custom) return geminiWebText(messages, AbortSignal.timeout(MAX_MS))
  const response = await fetch(candidate.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(candidate.key ? { authorization: `Bearer ${candidate.key}` } : {}),
    },
    body: JSON.stringify({ model: candidate.model, messages, stream: false, temperature: 0.15, max_tokens: 6_000 }),
    signal: AbortSignal.timeout(MAX_MS),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 140)}`)
  const body = JSON.parse(text) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error(body.error?.message ?? 'empty completion')
  return content
}

async function run(candidate: Candidate, task: Task): Promise<Row> {
  const started = Date.now()
  let error: string | undefined
  try {
    const result = await runCodeEditTurn({
      files,
      prompt: task.prompt,
      attempts: 1,
      rounds: 1,
      readRounds: 0,
      onError: (caught) => {
        error = caught instanceof Error ? caught.message : String(caught)
      },
      complete: (messages) => complete(candidate, messages),
    })
    const passed = task.checks.filter((check) => check.test(result.files))
    const verification = verifyPages(workspacePages(result.files), { question: task.prompt })
    return {
      name: candidate.name,
      task: task.name,
      status: verification.failures.length ? 'page-failed' : result.status,
      passed: passed.length,
      total: task.checks.length,
      missing: task.checks
        .filter((check) => !passed.includes(check))
        .map((check) => check.id)
        .join(','),
      problems: result.problems.length,
      ms: Date.now() - started,
      ...(error ? { error: error.slice(0, 160) } : {}),
    }
  } catch (caught) {
    return {
      name: candidate.name,
      task: task.name,
      status: 'error',
      passed: 0,
      total: task.checks.length,
      missing: task.checks.map((check) => check.id).join(','),
      problems: 0,
      ms: Date.now() - started,
      error: (caught instanceof Error ? caught.message : String(caught)).slice(0, 160),
    }
  }
}

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let index = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (index < items.length) {
        const item = items[index++]
        if (item === undefined) break
        out.push(await work(item))
      }
    }),
  )
  return out
}

// BENCH_ONLY=glyph-cluster,nemotron re-runs a shortlist after a first pass.
const only = process.env.BENCH_ONLY?.split(',').map((value) => value.trim()).filter(Boolean) ?? []
const shortlist = only.length
  ? CANDIDATES.filter((candidate) => only.some((needle) => candidate.name.toLowerCase().includes(needle.toLowerCase())))
  : CANDIDATES
const jobs = shortlist.flatMap((candidate) => TASKS.map((task) => ({ candidate, task })))
const rows = await pool(jobs, 5, ({ candidate, task }) => run(candidate, task))

const dir = join(tmpdir(), 'ink-model-bench')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'model-bench.json'), JSON.stringify(rows, null, 2))

const pad = (value: string | number, width: number) => String(value).padEnd(width)
const byCandidate = shortlist.map((candidate) => {
  const own = rows.filter((row) => row.name === candidate.name)
  const passed = own.reduce((sum, row) => sum + row.passed, 0)
  const total = own.reduce((sum, row) => sum + row.total, 0)
  const ms = Math.round(own.reduce((sum, row) => sum + row.ms, 0) / Math.max(1, own.length))
  return { candidate, own, passed, total, ms }
}).sort((a, b) => b.passed - a.passed || a.ms - b.ms)

console.log(pad('model', 26), pad('passed', 8), pad('avg ms', 8), 'per task')
for (const row of byCandidate) {
  console.log(
    pad(row.candidate.name, 26),
    pad(`${row.passed}/${row.total}`, 8),
    pad(row.ms, 8),
    row.own.map((task) => `${task.task}:${task.passed}/${task.total}${task.missing ? `(-${task.missing})` : ''}${task.error ? ` [${task.error.slice(0, 40)}]` : ''}`).join('  '),
  )
}
console.log(`\nraw: ${join(dir, 'model-bench.json')}`)
