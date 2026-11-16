// Loopback bridge between Ink's Worker and the Codebuff agent SDK.
//
// The SDK is Node-only and much too large for a Cloudflare Worker, so it stays
// here and speaks a small OpenAI-compatible SSE dialect. The Worker reaches it
// at 127.0.0.1:8766 in local development; a deployed Ink copy has no bridge
// unless its owner deliberately points BUFFY_BRIDGE_URL at one.
//
// Usage: npm run buffy
// Requires CODEBUFF_API_KEY in .env (or the shell environment). If the
// Codebuff account has no SDK credits, the bridge answers through a clearly
// labelled free fallback lane (Step 5 through NVIDIA, then keyless Kilo).

import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { CodebuffClient, getCustomToolDefinition } from '@codebuff/sdk'
import { z } from 'zod/v4'
import { buffyBrowser } from './buffy-browser.mjs'

// Node 20+ can load the same files Wrangler reads. `.env.local` wins because
// it is loaded second and loadEnvFile does not overwrite existing values.
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file)
  } catch {
    /* the file is optional */
  }
}

const PORT = Number(process.env.BUFFY_BRIDGE_PORT || 8766)
const HOST = '127.0.0.1'
const API_KEY = (process.env.CODEBUFF_API_KEY || process.env.FREEBUFF_API_KEY || '').trim()
const TOKEN = (process.env.BUFFY_BRIDGE_TOKEN || '').trim()
const MODEL = (process.env.BUFFY_MODEL || 'anthropic/claude-opus-4.7').trim()
const COST_MODE = (process.env.BUFFY_COST_MODE || 'normal').trim()
const NVIDIA_KEY = (process.env.NVIDIA_API_KEY || '').trim()
const OPENROUTER_KEY = (process.env.OPENROUTER_API_KEY || '').trim()
const FALLBACK_MODEL = (process.env.BUFFY_FALLBACK_MODEL || 'stepfun-ai/step-5-preview').trim()
const MOCK = process.env.BUFFY_MOCK === '1'
const MAX_STEPS = Math.min(80, Math.max(10, Number(process.env.BUFFY_MAX_STEPS || 40)))
const PREVIEW_URL = (process.env.BUFFY_PREVIEW_URL || 'http://127.0.0.1:5180').replace(/\/+$/, '')
const WORKSPACE = process.cwd()
const execFileAsync = promisify(execFile)
const MAX_BODY_BYTES = 512 * 1024
const MAX_CONTEXT_CHARS = 48_000
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OVH_URL = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions'
const KILO_URL = 'https://api.kilo.ai/api/gateway/chat/completions'
const BLOCKRUN_URL = 'https://blockrun.ai/api/v1/chat/completions'
const ULTRA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b'
// After a 402, do not make every chat wait for the same failed paid call.
let codebuffBlockedUntil = 0

const BUFFY_INSTRUCTIONS = `You are Buffy, the Codebuff coding agent inside Ink. You are working on the owner's real project on this computer, rooted at ${WORKSPACE}. You are not a chat-only assistant: you can read, search, edit, run commands, browse, and verify.

Work like a frontier coding agent. For any task that needs more than a sentence:
1. Inspect before changing. Use read_files, read_subtree, find_files, glob, list_directory and code_search. Use think_deeply for hard design or debugging problems, and compact_context to reload a bounded project map when the conversation gets long.
2. Track complex work with write_todos, add_subgoal and update_subgoal. Keep the list current instead of silently changing the plan.
3. Make the smallest complete change with write_file, str_replace or apply_patch. Read a file before editing it, preserve existing behavior and style, and do not remove working code without a reason.
4. Verify with run_terminal_command using the project's own commands (typecheck, focused test, build). Check the exit status. If a check fails, fix the cause and rerun only the affected check.
5. For UI work, use the browser tools: preview_navigate to open a page, preview_snapshot before acting, preview_logs for console and network errors, preview_wait for async state, preview_click and preview_type for interaction, preview_evaluate for state the snapshot cannot show, and preview_screenshot for a visual check. UIDs from a snapshot expire when the page changes, so take a fresh snapshot after navigation or a major DOM change. The local app is normally at ${PREVIEW_URL}.
6. Use spawn_agents for independent research, review, or verification when parallel work helps. Do not spawn helpers for trivial tasks.
7. Finish with the result, the checks actually run, and any real limitation. Do not claim you changed, ran, tested or verified something when you did not.

Tools: read_files, read_subtree, find_files, glob, list_directory, code_search, read_docs, web_search; write_file, str_replace, apply_patch, propose_write_file, propose_str_replace; run_terminal_command, run_file_change_hooks; think_deeply, compact_context, add_message, set_messages, write_todos, add_subgoal, update_subgoal, create_plan; preview_navigate, preview_snapshot, preview_logs, preview_wait, preview_click, preview_type, preview_press, preview_scroll, preview_evaluate, preview_screenshot, browser_logs; spawn_agents, spawn_agent_inline; end_turn, task_completed, set_output, suggest_followups, skill, lookup_agent_info.

Safety: stay inside ${WORKSPACE}. Never read .env, .dev.vars, credential files, or anything under .freebuff; never print secret values. Do not push git history, deploy, install globally, or run destructive or hard-to-reverse commands unless the person explicitly asked. Do not start background services unless the work needs one; if you do, report how to stop it and verify it is still running. The browser uses a separate local Chrome profile and never takes over the person's own tab.

Style for a chat window: direct and technically precise. Short paragraphs, markdown lists only when they help, and code blocks with a language tag. Never invent tool output, fake a tool call, or describe an action as done before the tool result confirms it.`

const READ_ONLY_TOOL_NAMES = [
  'read_files',
  'read_subtree',
  'find_files',
  'glob',
  'list_directory',
  'code_search',
  'read_docs',
  'web_search',
  'think_deeply',
  'end_turn',
]

// The parent agent gets every SDK tool Buffy can execute plus the local
// browser tools below. ask_user is intentionally absent: the bridge has no
// way to pause a Codebuff run for a structured answer, so Buffy asks in chat.
const AGENT_TOOL_NAMES = [
  'apply_patch',
  'add_message',
  'add_subgoal',
  'browser_logs',
  'code_search',
  'create_plan',
  'end_turn',
  'find_files',
  'glob',
  'list_directory',
  'lookup_agent_info',
  'propose_str_replace',
  'propose_write_file',
  'read_docs',
  'read_files',
  'read_subtree',
  'run_file_change_hooks',
  'run_terminal_command',
  'set_messages',
  'set_output',
  'skill',
  'spawn_agents',
  'spawn_agent_inline',
  'str_replace',
  'suggest_followups',
  'task_completed',
  'think_deeply',
  'update_subgoal',
  'web_search',
  'write_file',
  'write_todos',
]

const PREVIEW_TOOL_NAMES = [
  'preview_navigate',
  'preview_snapshot',
  'preview_logs',
  'preview_wait',
  'preview_click',
  'preview_type',
  'preview_press',
  'preview_scroll',
  'preview_evaluate',
  'preview_screenshot',
  'compact_context',
]

const SUBAGENTS = [
  {
    id: 'buffy-scout',
    displayName: 'Buffy Scout',
    model: MODEL,
    toolNames: READ_ONLY_TOOL_NAMES,
    outputMode: 'last_message',
    instructionsPrompt:
      'You are Buffy Scout, a read-only research subagent. Find the smallest set of files and facts that answer the parent agent\'s question. Use read_files, code_search, glob, list_directory, read_subtree, read_docs and web_search. Return a concise report with exact file paths, line references when useful, and the facts the parent needs. Do not edit, run commands, or claim verification you did not perform.',
  },
  {
    id: 'buffy-reviewer',
    displayName: 'Buffy Reviewer',
    model: MODEL,
    toolNames: READ_ONLY_TOOL_NAMES,
    outputMode: 'last_message',
    instructionsPrompt:
      'You are Buffy Reviewer, an independent code reviewer. Read the relevant code and look for real bugs, regressions, security problems, broken edge cases and missing verification. Be specific: cite paths and explain the failure mode. Do not edit or run commands. Report only actionable findings, strongest first, and say plainly when the change looks sound.',
  },
  {
    id: 'buffy-runner',
    displayName: 'Buffy Runner',
    model: MODEL,
    toolNames: ['read_files', 'code_search', 'glob', 'list_directory', 'run_terminal_command', 'end_turn'],
    outputMode: 'last_message',
    instructionsPrompt:
      'You are Buffy Runner, a verification subagent. Inspect the project scripts, run the narrowest relevant checks, and report the exact commands, exit status and important output. Do not edit files. Never start a long-lived server unless the parent explicitly asked for one.',
  },
]

const agent = {
  id: 'buffy',
  displayName: 'Buffy',
  model: MODEL,
  toolNames: [...AGENT_TOOL_NAMES, ...PREVIEW_TOOL_NAMES],
  spawnableAgents: SUBAGENTS.map((subagent) => subagent.id),
  instructionsPrompt: BUFFY_INSTRUCTIONS,
}

const TOOL_STATUS = {
  read_files: 'Reading files…',
  read_subtree: 'Reading the project tree…',
  find_files: 'Finding files…',
  code_search: 'Searching the code…',
  glob: 'Looking for files…',
  list_directory: 'Listing the project…',
  read_docs: 'Reading documentation…',
  web_search: 'Searching the web…',
  think_deeply: 'Thinking it through…',
  compact_context: 'Compacting project context…',
  write_todos: 'Updating the plan…',
  add_subgoal: 'Updating the plan…',
  update_subgoal: 'Updating the plan…',
  create_plan: 'Writing a plan…',
  add_message: 'Updating working memory…',
  set_messages: 'Compacting context…',
  write_file: 'Writing a file…',
  str_replace: 'Editing a file…',
  apply_patch: 'Applying a patch…',
  propose_write_file: 'Drafting a file change…',
  propose_str_replace: 'Drafting an edit…',
  run_terminal_command: 'Running a command…',
  run_file_change_hooks: 'Running file checks…',
  preview_navigate: 'Opening the browser…',
  preview_snapshot: 'Reading the page…',
  preview_logs: 'Checking browser logs…',
  preview_wait: 'Waiting for the page…',
  preview_click: 'Clicking in the browser…',
  preview_type: 'Typing in the browser…',
  preview_press: 'Pressing a key…',
  preview_scroll: 'Scrolling the page…',
  preview_evaluate: 'Inspecting page state…',
  preview_screenshot: 'Taking a screenshot…',
  browser_logs: 'Opening the browser…',
  spawn_agents: 'Spawning a helper…',
  spawn_agent_inline: 'Spawning a helper…',
  set_output: 'Preparing the answer…',
  task_completed: 'Finishing…',
  end_turn: '',
}

function jsonResult(value) {
  return [{ type: 'json', value }]
}

function clean(value, max = 240) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function compactPath(value) {
  const path = clean(value, 240)
  return path || '(project root)'
}

function toolDetail(name, input) {
  if (!input || typeof input !== 'object') return ''
  const value = input
  if (name === 'read_files' && Array.isArray(value.paths)) return value.paths.slice(0, 6).join(', ')
  if (name === 'code_search') return [value.pattern, value.cwd ? `in ${value.cwd}` : ''].filter(Boolean).join(' ')
  if (name === 'glob') return value.pattern || ''
  if (name === 'list_directory') return compactPath(value.path)
  if (name === 'read_subtree') return Array.isArray(value.paths) ? value.paths.slice(0, 5).join(', ') : '(whole tree)'
  if (name === 'find_files') return value.prompt || ''
  if (name === 'web_search') return value.query || ''
  if (name === 'run_terminal_command') return `${value.command || ''}${value.cwd ? `  ·  ${value.cwd}` : ''}`
  if (name === 'write_file' || name === 'str_replace' || name === 'apply_patch') {
    return compactPath(value.path || value.operation?.path)
  }
  if (name === 'propose_write_file' || name === 'propose_str_replace') return compactPath(value.path)
  if (name === 'preview_navigate' || name === 'browser_logs') return value.url || ''
  if (name === 'preview_click') return value.uid ? `uid ${value.uid}` : value.text || value.selector || ''
  if (name === 'preview_type') return `${value.uid ? `uid ${value.uid}` : value.selector || 'focused field'}: ${clean(value.text, 80)}`
  if (name === 'preview_press') return value.key || ''
  if (name === 'preview_wait') return [value.text, value.selector, value.url_contains].filter(Boolean).join(' · ')
  if (name === 'preview_evaluate') return clean(value.expression, 100)
  if (name === 'spawn_agents' && Array.isArray(value.agents)) return value.agents.map((agent) => agent.agent_type).join(', ')
  if (name === 'preview_screenshot') return value.path || 'viewport'
  if (name === 'compact_context') return value.focus || ''
  return ''
}

function outputSummary(output) {
  if (!Array.isArray(output)) return { status: 'done', summary: '' }
  const json = output.find((item) => item && item.type === 'json')?.value
  const media = output.find((item) => item && item.type === 'media')
  if (json && typeof json === 'object') {
    if (typeof json.errorMessage === 'string') return { status: 'error', summary: clean(json.errorMessage, 320) }
    if (typeof json.exitCode === 'number' && json.exitCode !== 0) {
      return { status: 'error', summary: clean(json.stderr || json.stdout || `Exit code ${json.exitCode}.`, 320) }
    }
    if (typeof json.message === 'string') return { status: 'done', summary: clean(json.message, 320) }
    if (json.page && typeof json.page === 'object') return { status: 'done', summary: clean(json.page.title || json.page.url, 320) }
    if (Array.isArray(json.elements)) return { status: 'done', summary: `${clean(json.title || json.url, 180)} · ${json.elements.length} controls` }
    if (Array.isArray(json.entries)) return { status: 'done', summary: `${json.entries.length} browser events` }
    try {
      return { status: 'done', summary: clean(JSON.stringify(json), 320) }
    } catch {
      return { status: 'done', summary: 'Tool finished.' }
    }
  }
  if (media) return { status: 'done', summary: `${media.mediaType || 'media'} captured` }
  return { status: 'done', summary: 'Tool finished.' }
}

function fileFilter(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/')
  if (/(^|\/)(?:\.env\.example|\.env\.sample|\.env\.template)$/.test(normalized)) return { status: 'allow' }
  if (/(^|\/)(?:\.env(?:\..*)?|\.dev\.vars|\.freebuff)(?:\/|$)/.test(normalized)) return { status: 'blocked' }
  return { status: 'allow' }
}

async function compactContext(focus = '') {
  const parts = []
  if (focus) parts.push(`Focus: ${clean(focus, 300)}`)
  try {
    const raw = await readFile(resolve(WORKSPACE, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw)
    parts.push(`Package: ${pkg.name || '(unnamed)'}`)
    if (pkg.scripts && typeof pkg.scripts === 'object') {
      parts.push(`Scripts: ${Object.entries(pkg.scripts).map(([name, command]) => `${name}=${command}`).join(' | ')}`)
    }
    parts.push(`Dependencies: ${Object.keys(pkg.dependencies || {}).join(', ') || '(none)'}`)
  } catch {
    /* package.json is optional */
  }
  for (const file of ['README.md', 'STARTUP.md', 'AGENTS.md']) {
    try {
      const text = (await readFile(resolve(WORKSPACE, file), 'utf8')).trim()
      if (text) parts.push(`--- ${file} ---\n${text.slice(0, 1_500)}`)
    } catch {
      /* optional */
    }
  }
  try {
    const entries = (await readdir(WORKSPACE, { withFileTypes: true }))
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`)
    parts.push(`Top level: ${entries.slice(0, 80).join(', ')}`)
  } catch {
    /* optional */
  }
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short'], { cwd: WORKSPACE, timeout: 5_000 })
    parts.push(`Git status:\n${stdout.trim().slice(0, 2_500) || '(clean)'}`)
  } catch {
    parts.push('Git status: unavailable')
  }
  const browser = buffyBrowser.status()
  if (browser.connected) parts.push(`Browser page: ${browser.page.title || browser.page.url || 'about:blank'}`)
  return parts.join('\n\n').slice(0, 12_000)
}

const previewDefinitions = [
  getCustomToolDefinition({
    toolName: 'preview_navigate',
    description:
      'Open a URL in Buffy\'s local Chrome session. Use this for the Ink dev server or any public page. It returns the page title, URL and a compact snapshot. Take a fresh preview_snapshot after the page loads.',
    inputSchema: z.object({
      url: z.string().min(1),
      wait_until: z.enum(['load', 'domcontentloaded', 'networkidle0']).optional(),
    }),
    exampleInputs: [{ url: PREVIEW_URL }],
    endsAgentStep: true,
    execute: async ({ url, wait_until }) => jsonResult(await buffyBrowser.navigate(url, wait_until || 'load')),
  }),
  getCustomToolDefinition({
    toolName: 'preview_snapshot',
    description:
      'Read the current browser page as text plus interactive controls with stable uids. Always snapshot before clicking or typing. uids expire when the page changes; after navigation or a major DOM change, snapshot again.',
    inputSchema: z.object({}),
    exampleInputs: [{}],
    endsAgentStep: true,
    execute: async () => jsonResult(await buffyBrowser.snapshot()),
  }),
  getCustomToolDefinition({
    toolName: 'preview_logs',
    description:
      'Read console messages, uncaught page errors, failed network requests and HTTP 4xx/5xx responses from the current browser page. Set clear to true to start a fresh log window.',
    inputSchema: z.object({ clear: z.boolean().optional() }),
    exampleInputs: [{}],
    endsAgentStep: true,
    execute: async ({ clear }) => jsonResult(await buffyBrowser.logs({ clear: Boolean(clear) })),
  }),
  getCustomToolDefinition({
    toolName: 'preview_wait',
    description:
      'Wait until visible text, a CSS selector, or a URL fragment appears (state visible) or disappears (state hidden). Use state time to wait for a fixed timeout. Returns a timeout error rather than pretending the page changed.',
    inputSchema: z.object({
      text: z.string().optional(),
      selector: z.string().optional(),
      url_contains: z.string().optional(),
      state: z.enum(['visible', 'hidden', 'time']).optional(),
      timeout_ms: z.number().min(250).max(120000).optional(),
    }),
    exampleInputs: [{ text: 'Saved', timeout_ms: 5000 }],
    endsAgentStep: true,
    execute: async ({ text, selector, url_contains, state, timeout_ms }) =>
      jsonResult(
        await buffyBrowser.waitFor({
          text,
          selector,
          urlContains: url_contains,
          state: state || 'visible',
          timeoutMs: timeout_ms,
        }),
      ),
  }),
  getCustomToolDefinition({
    toolName: 'preview_click',
    description:
      'Click a visible control by uid from the latest preview_snapshot, by CSS selector, or by visible text. The page is scrolled into view first. After a navigation, snapshot again before the next click.',
    inputSchema: z.object({
      uid: z.string().optional(),
      selector: z.string().optional(),
      text: z.string().optional(),
    }),
    exampleInputs: [{ text: 'Save' }],
    endsAgentStep: true,
    execute: async ({ uid, selector, text }) => jsonResult(await buffyBrowser.click({ uid, selector, text })),
  }),
  getCustomToolDefinition({
    toolName: 'preview_type',
    description:
      'Focus an input by uid or selector and insert text. By default it replaces the field\'s existing value. Set press_enter to submit a search or form. If no target is given it types into the focused element.',
    inputSchema: z.object({
      uid: z.string().optional(),
      selector: z.string().optional(),
      text: z.string(),
      clear: z.boolean().optional(),
      press_enter: z.boolean().optional(),
    }),
    exampleInputs: [{ text: 'hello', press_enter: true }],
    endsAgentStep: true,
    execute: async ({ uid, selector, text, clear, press_enter }) =>
      jsonResult(
        await buffyBrowser.type({
          uid,
          selector,
          text,
          clear: clear !== false,
          pressEnter: Boolean(press_enter),
        }),
      ),
  }),
  getCustomToolDefinition({
    toolName: 'preview_press',
    description: 'Send one keyboard key to the focused browser element. Supports Enter, Escape, Tab, Home, End, Backspace, Delete, Space and arrow keys.',
    inputSchema: z.object({
      key: z.string().min(1),
      modifiers: z.array(z.enum(['Alt', 'Ctrl', 'Meta', 'Shift'])).optional(),
    }),
    exampleInputs: [{ key: 'Enter' }],
    endsAgentStep: true,
    execute: async ({ key, modifiers }) => jsonResult(await buffyBrowser.press(key, modifiers || [])),
  }),
  getCustomToolDefinition({
    toolName: 'preview_scroll',
    description: 'Scroll the current browser page by x and y pixels.',
    inputSchema: z.object({ x: z.number().optional(), y: z.number().optional() }),
    exampleInputs: [{ y: 600 }],
    endsAgentStep: true,
    execute: async ({ x, y }) => jsonResult(await buffyBrowser.scroll(x || 0, y || 0)),
  }),
  getCustomToolDefinition({
    toolName: 'preview_evaluate',
    description:
      'Evaluate a read-only JavaScript expression in the current page and return its JSON value. Use it for computed state the snapshot cannot show. Do not use it to bypass normal clicks or to make unrelated destructive changes.',
    inputSchema: z.object({ expression: z.string().min(1) }),
    exampleInputs: [{ expression: 'document.title' }],
    endsAgentStep: true,
    execute: async ({ expression }) => {
      const value = await buffyBrowser.evaluate(expression, 20_000)
      return jsonResult({ value: value === undefined ? null : value })
    },
  }),
  getCustomToolDefinition({
    toolName: 'preview_screenshot',
    description:
      'Capture a PNG of the current browser viewport for a visual check. Optionally save it inside the project with path. The image is returned to the model and the saved path is reported when provided.',
    inputSchema: z.object({ path: z.string().optional() }),
    exampleInputs: [{ path: 'buffy-preview.png' }],
    endsAgentStep: true,
    execute: async ({ path }) => {
      const shot = await buffyBrowser.screenshot()
      let saved = ''
      if (path) {
        const destination = resolve(WORKSPACE, path)
        if (destination !== WORKSPACE && !destination.startsWith(`${WORKSPACE}${sep}`)) {
          throw new Error('Screenshot path must stay inside the project.')
        }
        await mkdir(dirname(destination), { recursive: true })
        await writeFile(destination, shot.data)
        saved = destination
      }
      return [
        ...jsonResult({
          message: `Captured ${shot.title || shot.url}.`,
          url: shot.url,
          title: shot.title,
          ...(saved ? { path: saved } : {}),
          bytes: shot.data.length,
        }),
        { type: 'media', data: shot.data.toString('base64'), mediaType: 'image/png' },
      ]
    },
  }),
  getCustomToolDefinition({
    toolName: 'compact_context',
    description:
      'Build a compact, high-signal project snapshot (package scripts, README, top-level layout, git status and current browser page). Use it to reload context during a long task without rereading the whole tree.',
    inputSchema: z.object({ focus: z.string().optional() }),
    exampleInputs: [{ focus: 'model routing' }],
    endsAgentStep: true,
    execute: async ({ focus }) => jsonResult({ message: await compactContext(focus || '') }),
  }),
]

const browserLogsTool = async ({ type, url, waitUntil }) => {
  if (type && type !== 'navigate') {
    return jsonResult({ errorMessage: 'browser_logs supports navigate here. Use preview_snapshot, preview_logs and the other preview_* tools for the rest.' })
  }
  const page = await buffyBrowser.navigate(url, waitUntil || 'load')
  const logs = await buffyBrowser.logs()
  const snapshot = await buffyBrowser.snapshot()
  return jsonResult({
    message: `Opened ${page.url} and read ${logs.entries.length} browser events.`,
    page,
    logs: logs.entries.slice(-80),
    pageText: snapshot.text.slice(0, 2_500),
    elements: snapshot.elements.slice(0, 40),
  })
}

// The free lane has no tools. Giving it the agent instructions above made it
// imitate tool calls; these instructions keep the same persona without
// promising capabilities it cannot use.
const BUFFY_FREE_INSTRUCTIONS = `You are Buffy, the Codebuff assistant inside Ink.

Be direct, technically precise and useful. Answer the question that was asked. Do not pad the reply with introductions, restatements, or a summary of what you are about to do. If you are unsure, say what you would need to check.

You are running as Buffy on the free lane: you have no tools. You cannot read files, search the web, run commands, or change anything, and you must not claim otherwise. Never output a tool name, a JSON tool call, or a fake tool result. This chat may include a small, secret-free snapshot of the Ink project; if one is present, use it when it helps. If no snapshot is present, do not assume a project is open and do not ask for one. You have the conversation and your own knowledge; say plainly when a question needs a file or fact that is not available.

Your name is Buffy. The surrounding app is called Ink; never introduce yourself as Ink.

Format for a chat window: short paragraphs, markdown lists only when they help, and code blocks with a language tag. Never claim you changed, ran or tested something when you did not.`

const client = API_KEY
  ? new CodebuffClient({
      apiKey: API_KEY,
      cwd: process.cwd(),
    })
  : null

function textPart(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  if (Array.isArray(value.content)) return value.content.map(textPart).join('')
  return ''
}

function messageText(value) {
  if (Array.isArray(value)) return value.map(textPart).join('')
  return textPart(value)
}

function messageContent(message) {
  if (!message || typeof message !== 'object') return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) return message.content.map(textPart).join('')
  return ''
}

function buildPrompt(messages) {
  const system = messages
    .filter((message) => message?.role === 'system')
    .map((message) => messageContent(message).trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8_000)
  const dialog = messages
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .map((message) => {
      const content = messageContent(message).trim().slice(0, 12_000)
      return content ? `${message.role === 'user' ? 'Person' : 'Buffy'}: ${content}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(-MAX_CONTEXT_CHARS)
  return [
    system ? `Context supplied by the Ink app:\n${system}` : '',
    dialog || 'The person sent an empty message.',
    'Reply to the last Person message as Buffy. Use any tools available to you when they help; never claim a tool ran when it did not.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function writeEvent(res, payload) {
  if (res.writableEnded || res.destroyed) return false
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
    return true
  } catch {
    return false
  }
}

function writeStatus(res, text) {
  if (res.writableEnded || res.destroyed) return
  try {
    res.write(`event: status\ndata: ${JSON.stringify({ type: 'status', text })}\n\n`)
  } catch {
    /* the reader disconnected */
  }
}

function writeTool(res, payload) {
  if (res.writableEnded || res.destroyed) return
  try {
    res.write(`event: tool\ndata: ${JSON.stringify(payload)}\n\n`)
  } catch {
    /* the reader disconnected */
  }
}

function writeDelta(res, text) {
  if (!text) return
  writeEvent(res, { choices: [{ index: 0, delta: { content: text } }] })
}

function finish(res) {
  if (res.writableEnded || res.destroyed) return
  writeEvent(res, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
  try {
    res.write('data: [DONE]\n\n')
    res.end()
  } catch {
    /* the reader disconnected */
  }
}

function fail(res, message, status = 502) {
  if (res.headersSent) {
    writeEvent(res, { error: { message } })
    finish(res)
    return
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify({ error: message }))
}

function authorized(req) {
  if (!TOKEN) return true
  return req.headers.authorization === `Bearer ${TOKEN}`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function mockReply(res) {
  const text = 'The Buffy bridge is running in mock mode. Set CODEBUFF_API_KEY in .env to talk to the real Codebuff agent.'
  for (const word of text.split(' ')) {
    if (res.destroyed) return
    writeDelta(res, `${word} `)
    await new Promise((resolve) => setTimeout(resolve, 18))
  }
  finish(res)
}

/** Free OpenAI-compatible lanes used only when the Codebuff run cannot start. */
function fallbackLanes() {
  return [
    // OpenRouter's free Ultra variant is the strongest zero-cost lane. It is
    // still free even when the same OpenRouter key also has paid models.
    ...(OPENROUTER_KEY
      ? [{ url: OPENROUTER_URL, model: `${ULTRA_MODEL}:free`, headers: { authorization: `Bearer ${OPENROUTER_KEY}` } }]
      : []),
    // NVIDIA NIM's free allowance includes the same 550B model.
    ...(NVIDIA_KEY
      ? [
          { url: NVIDIA_URL, model: ULTRA_MODEL, headers: { authorization: `Bearer ${NVIDIA_KEY}` } },
          { url: NVIDIA_URL, model: FALLBACK_MODEL, headers: { authorization: `Bearer ${NVIDIA_KEY}` } },
        ]
      : []),
    // Keyless fallbacks, strongest first. OVH allows only a few requests a
    // minute, so it sits behind the keyed lanes and ahead of the tiny models.
    { url: OVH_URL, model: 'Qwen3.5-397B-A17B', headers: {} },
    { url: KILO_URL, model: `${ULTRA_MODEL}:free`, headers: {} },
    { url: KILO_URL, model: 'kilo-auto/free', headers: {} },
    { url: BLOCKRUN_URL, model: 'nvidia/nemotron-3.5-lightning', headers: {} },
  ]
}

/** A small, secret-free snapshot so Lite can still answer project questions. */
async function projectSnapshot() {
  const parts = []
  for (const file of ['README.md', 'STARTUP.md', 'package.json']) {
    try {
      const text = await readFile(file, 'utf8')
      if (text.trim()) parts.push(`--- ${file} ---\n${text.slice(0, 5_000)}`)
    } catch {
      /* the file is optional */
    }
  }
  for (const directory of ['src/app/pages', 'src/worker/routes', 'scripts']) {
    try {
      const names = (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .slice(0, 80)
      if (names.length) parts.push(`--- ${directory} ---\n${names.join('\n')}`)
    } catch {
      /* the directory is optional */
    }
  }
  return parts.join('\n\n').slice(0, 16_000)
}

async function fallbackReply(res, prompt, signal, reason) {
  writeStatus(res, 'Buffy is answering…')
  const snapshot = await projectSnapshot()
  let lastError = ''
  for (const lane of fallbackLanes()) {
    try {
      const response = await fetch(lane.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...lane.headers },
        body: JSON.stringify({
          model: lane.model,
          stream: true,
          max_tokens: 4_096,
          messages: [
            {
              role: 'system',
              content: `${BUFFY_FREE_INSTRUCTIONS}\n\nCodebuff is unavailable (${String(reason).slice(0, 160)}).${snapshot ? `\n\nFixed read-only project snapshot:\n${snapshot}` : ''}`,
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal,
      })
      if (!response.ok || !response.body) {
        lastError = `HTTP ${response.status}`
        continue
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let gotText = false
      let done = false
      while (!done) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        const blocks = buffer.split(/\r?\n\r?\n/)
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          for (const line of block.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw) continue
            if (raw === '[DONE]') {
              done = true
              break
            }
            try {
              const parsed = JSON.parse(raw)
              const piece = parsed?.choices?.[0]?.delta?.content
              if (typeof piece === 'string' && piece) {
                if (!gotText) writeDelta(res, '**Buffy** (free lane)\n\n')
                gotText = true
                writeDelta(res, piece)
              }
            } catch {
              /* a malformed lane chunk should not end the whole reply */
            }
          }
          if (done) break
        }
      }
      if (gotText) {
        console.log('buffy.fallback.lane', { model: lane.model, url: lane.url })
        finish(res)
        return
      }
      lastError = 'The fallback returned no text.'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      lastError = error instanceof Error ? error.message : 'The fallback failed.'
    }
  }
  fail(
    res,
    `Codebuff is unavailable (${String(reason).slice(0, 120)}) and the free fallback did not answer${lastError ? ` (${lastError.slice(0, 100)})` : ''}.`,
    503,
  )
}

async function runBuffy(res, prompt, signal) {
  writeStatus(res, 'Buffy is thinking…')
  if (!client) {
    await fallbackReply(res, prompt, signal, 'CODEBUFF_API_KEY is missing')
    return
  }
  if (Date.now() < codebuffBlockedUntil) {
    await fallbackReply(res, prompt, signal, 'Codebuff is out of credits')
    return
  }

  let streamed = false
  let finalText = ''
  let streamError = ''
  try {
    const result = await client.run({
      agent,
      prompt,
      agentDefinitions: [agent, ...SUBAGENTS],
      customToolDefinitions: previewDefinitions,
      overrideTools: { browser_logs: browserLogsTool },
      fileFilter,
      maxAgentSteps: MAX_STEPS,
      costMode: COST_MODE,
      signal,
      handleStreamChunk: (chunk) => {
        if (typeof chunk === 'string' && chunk) {
          streamed = true
          writeDelta(res, chunk)
        }
      },
      handleEvent: (event) => {
        if (!event || typeof event !== 'object') return
        if (event.type === 'tool_call') {
          const status = TOOL_STATUS[event.toolName]
          if (status) writeStatus(res, status)
          writeTool(res, {
            type: 'tool_call',
            id: event.toolCallId || `${event.toolName}-${Date.now()}`,
            name: event.toolName || 'tool',
            detail: toolDetail(event.toolName, event.input),
            ...(event.agentId ? { agentId: event.agentId } : {}),
            ...(event.parentAgentId ? { parentAgentId: event.parentAgentId } : {}),
          })
        } else if (event.type === 'tool_result') {
          const outcome = outputSummary(event.output)
          writeTool(res, {
            type: 'tool_result',
            id: event.toolCallId || `${event.toolName}-result`,
            name: event.toolName || 'tool',
            status: outcome.status,
            summary: outcome.summary,
            ...(event.parentAgentId ? { parentAgentId: event.parentAgentId } : {}),
          })
        } else if (event.type === 'subagent_start') {
          writeStatus(res, `${event.displayName || 'A helper'} is working…`)
        } else if (event.type === 'error') {
          streamError = typeof event.message === 'string' ? event.message : 'The Codebuff run failed.'
        } else if (event.type === 'text' && !streamed && typeof event.text === 'string') {
          finalText = event.text
        }
      },
    })

    if (result?.output?.type === 'error') {
      throw new Error(result.output.message || 'The Codebuff run failed.')
    }
    if (streamError && !streamed) throw new Error(streamError)
    if (!streamed) {
      const outputText =
        result?.output?.type === 'lastMessage' || result?.output?.type === 'allMessages'
          ? messageText(result.output.value)
          : ''
      const text = finalText || outputText
      if (text) {
        streamed = true
        writeDelta(res, text)
      }
    }
    if (!streamed) throw new Error('Buffy finished without a text reply.')
    codebuffBlockedUntil = 0
    finish(res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Codebuff run failed.'
    if (streamed) {
      writeEvent(res, { error: { message: message.slice(0, 600) } })
      finish(res)
      return
    }
    // A Codebuff account with no remaining credits returns before any text.
    // Remember it briefly so the next message goes straight to the free lane.
    if (/credit|payment required|402/i.test(message)) codebuffBlockedUntil = Date.now() + 10 * 60_000
    // Keep the chat usable with a clearly labelled free lane.
    await fallbackReply(res, prompt, signal, message)
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(
      JSON.stringify({
        ok: true,
        configured: Boolean(API_KEY || NVIDIA_KEY || MOCK),
        codebuff: Boolean(API_KEY),
        fallback: NVIDIA_KEY ? FALLBACK_MODEL : 'kilo-auto/free',
        mock: MOCK,
        model: MODEL,
        tools: agent.toolNames.length,
        browser: true,
        preview: PREVIEW_URL,
        maxSteps: MAX_STEPS,
        subagents: SUBAGENTS.map((subagent) => subagent.id),
      }),
    )
    return
  }

  if (url.pathname !== '/v1/chat/completions' && url.pathname !== '/chat/completions') {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Not found.' }))
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'POST' })
    res.end(JSON.stringify({ error: 'Use POST.' }))
    return
  }

  if (!authorized(req)) {
    res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Unauthorized.' }))
    return
  }

  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch (error) {
    fail(res, error instanceof Error ? error.message : 'Invalid JSON.', 400)
    return
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) {
    fail(res, 'At least one message is required.', 400)
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.flushHeaders?.()

  const controller = new AbortController()
  res.on('close', () => controller.abort())
  const prompt = buildPrompt(messages)
  const freeOnly = url.searchParams.get('free') === '1'

  if (MOCK) {
    await mockReply(res)
    return
  }

  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    if (freeOnly) await fallbackReply(res, prompt, controller.signal, 'the free model lane is selected')
    else await runBuffy(res, prompt, controller.signal)
  } finally {
    clearTimeout(timeout)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Buffy bridge listening on http://${HOST}:${PORT}`)
  console.log(`Codebuff key: ${API_KEY ? 'configured' : 'missing'}${MOCK ? ' (mock mode)' : ''}`)
  console.log(`Model: ${MODEL}`)
  console.log(`Tools: ${agent.toolNames.length} (including local browser and ${SUBAGENTS.length} subagents)`)
  if (NVIDIA_KEY) console.log(`Free fallback: ${FALLBACK_MODEL}`)
  if (!API_KEY && !MOCK) console.log('Set CODEBUFF_API_KEY in .env, then restart this bridge.')
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await buffyBrowser.close().catch(() => {})
    process.exit(0)
  })
}
process.once('exit', () => {
  void buffyBrowser.close()
})
