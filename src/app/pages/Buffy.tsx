import {
  AlertCircle,
  ArrowUp,
  Bot,
  Brain,
  Camera,
  Check,
  ClipboardList,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  FolderTree,
  GitCompare,
  Globe,
  Link2,
  Loader2,
  MousePointer2,
  Paperclip,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Square,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

import { Markdown } from '../components/Markdown'
import { Mark } from '../components/Shell'
import { TokenCounter } from '../components/TokenCounter'
import {
  briefHandoff,
  briefReadiness,
  readBriefDraft,
  readBriefHistory,
  readBuildReceipt,
  rememberBrief,
  receiptHandoff,
  seedBriefGoal,
  type BuffyBrief,
  type BuffyBuildReceipt,
  type BriefSnapshot,
} from '../lib/buffy-brief'
import { BUFFY_FALLBACK_MODEL, preferredBuffyModel } from '../lib/buffy-model-health'
import { BUFFY_MODEL_LABELS, DENT_MODEL, buffyModelSpeed, isDuckModel, normalizeBuffyModel, type BuffyModel } from '../lib/buffy-models'
import { requestDuckTurn, type DuckTurn } from '../lib/duck'
import { useBuffyModelOptions } from '../lib/use-buffy-model-options'
import { ATTACHMENT_ACCEPT, clipboardFiles, readAttachment } from '../lib/attachments'

type BuffyImage = { mime: string; size: number; data: string }
type BuffyFile = { name: string; text: string; image?: BuffyImage; link?: string }
type ToolStatus = 'running' | 'done' | 'error' | 'stopped'
type BuffyTool = {
  id: string
  name: string
  detail?: string
  status: ToolStatus
  summary?: string
  agent?: string
}
type Message = { role: 'user' | 'assistant'; content: string; files?: BuffyFile[]; tools?: BuffyTool[] }
type Opinion = { index: number; model: BuffyModel; content: string; pending: boolean; error: string }
type BridgeStatus = {
  ready: boolean
  configured: boolean
  mode?: 'bridge' | 'free'
  chatgpt?: boolean
  reason?: string
  model?: string
  mock?: boolean
  tools?: number
  browser?: boolean
  maxSteps?: number
}
type WireTool = {
  type: 'tool_call' | 'tool_result'
  id?: string
  name?: string
  detail?: string
  status?: string
  summary?: string
  agentId?: string
  parentAgentId?: string
}

const STORAGE_KEY = 'buffy:chat:v1'
const MODEL_STORAGE_KEY = 'buffy:model:v1'
const MODEL_MIGRATION_KEY = 'buffy:model:fast-default:v1'
const BRIEF_STORAGE_KEY = 'buffy:brief:v1'
const BRIEF_HISTORY_KEY = 'buffy:brief:history:v1'
const CODE_HANDOFF_KEY = 'buffy:code:handoff:v1'
const CODE_RECEIPT_KEY = 'buffy:code:receipt:v1'
const PAGE_CONTEXT_KEY = 'buffy:chat:page-context:v1'
const PRIVATE_STORAGE_KEY = 'buffy:private:v1'
const MAX_BRIEF_NOTES = 8
const MAX_BRIEF_CHECKS = 8
const MAX_BRIEF_NOTE_CHARS = 600
const MAX_ATTACHMENTS = 8
const MAX_IMAGES = 4
const MAX_ATTACHMENT_CHARS = 24_000
const MAX_ATTACHMENT_FILE_CHARS = 8_000
const STATUS_TIMEOUT_MS = 6_000
const STATUS_POLL_MS = 10_000
// Final backstop against a dead stream. The server's bridge grace period is
// 30s, so leave room for a fallback status to arrive after slow headers.
const CHAT_IDLE_MS = 60_000
const SUGGESTIONS = [
  'Plan a simple booking page for a neighborhood barber shop.',
  'Review a component and write a focused fix plan.',
  'Turn my rough app idea into a one-page build brief.',
]
const FREE_SUGGESTIONS = [
  'Plan a one-page booking site I can build next.',
  'Turn an app idea into a clear, buildable brief.',
  'What should I decide before building a portfolio?',
]

function readModel(): BuffyModel {
  try {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY)
    const migrated = localStorage.getItem(MODEL_MIGRATION_KEY) === '1'
    // Dent deep mode was the old default and turns a normal question into a
    // 15–60s wait. Migrate that saved default once; a later explicit Dent
    // choice is preserved because the migration flag is already set.
    if (!saved || (!migrated && saved === DENT_MODEL)) {
      localStorage.setItem(MODEL_MIGRATION_KEY, '1')
      return BUFFY_FALLBACK_MODEL
    }
    return normalizeBuffyModel(saved)
  } catch {
    return BUFFY_FALLBACK_MODEL
  }
}

function readPrivateMode(): boolean {
  try {
    return sessionStorage.getItem(PRIVATE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const EMPTY_BRIEF: BuffyBrief = { goal: '', notes: [], files: [], checks: [] }

function readBrief(messages: readonly Message[]): BuffyBrief {
  try {
    const parsed = JSON.parse(localStorage.getItem(BRIEF_STORAGE_KEY) || 'null') as unknown
    const saved = readBriefDraft(parsed)
    return saved ? seedBriefGoal(saved, messages) : seedBriefGoal(EMPTY_BRIEF, messages)
  } catch {
    return seedBriefGoal(EMPTY_BRIEF, messages)
  }
}

function readBriefHistoryStorage(): BriefSnapshot[] {
  try {
    return readBriefHistory(JSON.parse(localStorage.getItem(BRIEF_HISTORY_KEY) || '[]'))
  } catch {
    return []
  }
}

function taskPacket(messages: Message[], index: number, brief: BuffyBrief): string {
  const request = [...messages.slice(0, index)].reverse().find((message) => message.role === 'user')?.content.trim()
  const answer = messages[index]?.content.trim() ?? ''
  return [
    'Task from Buffy Chat',
    '',
    `Request: ${request || 'Use the answer below.'}`,
    `Goal: ${brief.goal.trim() || 'Not set.'}`,
    brief.notes.length ? `Pinned decisions:\n${brief.notes.map((note) => `- ${note}`).join('\n')}` : '',
    brief.checks.length ? `Acceptance checks:\n${brief.checks.map((check) => `- ${check}`).join('\n')}` : '',
    brief.files.length ? `Context files: ${brief.files.join(', ')}` : '',
    '',
    `Carry out this answer:\n${answer}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
    .slice(0, 12_000)
}

function briefNoteFor(message: Message): string {
  return message.content.replace(/\s+/g, ' ').trim().slice(0, MAX_BRIEF_NOTE_CHARS)
}

/** Keep the folder path so attached project files stay distinguishable. */
function attachmentName(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() || file.name || 'pasted.txt'
}

function readHttpUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return url.toString()
  } catch {
    return null
  }
}

function isBriefPinned(brief: BuffyBrief, message: Message): boolean {
  return brief.notes.includes(briefNoteFor(message))
}

/** The durable artifact stays visible beside the conversation on wide screens. */
function BriefRail({
  brief,
  readiness,
  failedChecks,
  history,
  onEdit,
  onBuild,
  onFix,
  onRestore,
}: {
  brief: BuffyBrief
  readiness: ReturnType<typeof briefReadiness>
  failedChecks: BuffyBuildReceipt['checks']
  history: BriefSnapshot[]
  onEdit: () => void
  onBuild: () => void
  onFix: () => void
  onRestore: (snapshot: BriefSnapshot) => void
}) {
  const build = brief.build
  const passed = build?.checks.filter((check) => check.status === 'pass').length ?? 0
  const total = build?.checks.length ?? 0
  return (
    <aside className="hidden w-[330px] shrink-0 flex-col border-l border-line bg-bg xl:flex" aria-label="Build brief">
      <header className="flex items-start gap-3 border-b border-line px-4 py-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-fg text-bg">
          <ClipboardList className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-medium text-fg">Build brief</h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                readiness.ready
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-line bg-surface-2 text-faint'
              }`}
            >
              {readiness.ready ? 'Ready' : 'Draft'}
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-faint">The durable part of this conversation.</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-[11px] text-muted underline underline-offset-2 transition-colors hover:text-fg"
        >
          Edit
        </button>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-faint">Goal</p>
        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
          {brief.goal.trim() || 'Add the outcome you want before handing this off.'}
        </p>

        <div className="mt-4">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-faint">Plan</p>
          <p className="mt-1.5 max-h-[92px] overflow-hidden whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
            {readiness.plan || 'Buffy will use the latest plan from the conversation.'}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5">
          <div className="rounded-control border border-line bg-surface px-2.5 py-2">
            <p className="font-display text-[18px] leading-none text-fg">{brief.notes.length}</p>
            <p className="mt-1 text-[10px] text-faint">decisions</p>
          </div>
          <div className="rounded-control border border-line bg-surface px-2.5 py-2">
            <p className="font-display text-[18px] leading-none text-fg">{brief.checks.length}</p>
            <p className="mt-1 text-[10px] text-faint">checks</p>
          </div>
          <div className="rounded-control border border-line bg-surface px-2.5 py-2">
            <p className="font-display text-[18px] leading-none text-fg">{brief.files.length}</p>
            <p className="mt-1 text-[10px] text-faint">files</p>
          </div>
        </div>

        {readiness.missing.length > 0 ? (
          <div className="mt-4 rounded-control border border-dashed border-line px-3 py-2.5">
            <p className="text-[11px] font-medium text-fg">Before you build</p>
            <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-faint">
              {readiness.missing.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {build ? (
          <div className="mt-4 rounded-control border border-line bg-surface p-3">
            <div className="flex items-center gap-1.5">
              {build.status === 'verified' ? (
                <Check className="size-3.5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
              )}
              <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-fg">Last build · {build.title}</p>
            </div>
            <p className="mt-1 text-[11px] text-faint">
              {total ? `${passed}/${total} checks passed` : 'Page checks were not available'}
            </p>
            {failedChecks.length ? (
              <button
                type="button"
                onClick={onFix}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-700 underline underline-offset-2 dark:text-amber-400"
              >
                Fix {failedChecks.length} failed {failedChecks.length === 1 ? 'check' : 'checks'}
              </button>
            ) : null}
          </div>
        ) : null}

        {history.length ? (
          <div className="mt-5">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-faint">Recent briefs</p>
            <div className="mt-1.5 space-y-1">
              {history.slice(0, 4).map((snapshot) => (
                <button
                  key={snapshot.id}
                  type="button"
                  onClick={() => onRestore(snapshot)}
                  className="flex w-full items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-accent/40"
                  title="Restore this brief"
                >
                  <span className={`size-1.5 shrink-0 rounded-full ${snapshot.brief.build ? 'bg-emerald-500' : 'bg-faint'}`} />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                    {snapshot.brief.goal.trim() || 'Untitled brief'}
                  </span>
                  <span className="shrink-0 text-[10px] text-faint">
                    {new Date(snapshot.at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={onBuild}
          disabled={!readiness.ready}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-fg px-3 text-[12.5px] font-medium text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Code2 className="size-4" />
          Build in Buffy Code
        </button>
        <p className="mt-1.5 text-center text-[10.5px] text-faint">
          {readiness.ready ? 'Goal, plan and checks are ready.' : 'Complete the brief to enable the handoff.'}
        </p>
      </footer>
    </aside>
  )
}

function readSaved(): Message[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value): Message | null => {
        if (!value || typeof value !== 'object') return null
        const message = value as { role?: unknown; content?: unknown; files?: unknown; tools?: unknown }
        if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') return null
        const files = Array.isArray(message.files)
          ? message.files
              .filter(
                (file): file is BuffyFile =>
                  Boolean(file) &&
                  typeof file === 'object' &&
                  typeof (file as BuffyFile).name === 'string' &&
                  typeof (file as BuffyFile).text === 'string' &&
                  ((file as BuffyFile).link === undefined || typeof (file as BuffyFile).link === 'string'),
              )
              .slice(0, MAX_ATTACHMENTS)
          : []
        const tools = Array.isArray(message.tools)
          ? message.tools
              .filter((tool): tool is BuffyTool => {
                if (!tool || typeof tool !== 'object') return false
                const item = tool as Partial<BuffyTool>
                return (
                  typeof item.id === 'string' &&
                  typeof item.name === 'string' &&
                  ['running', 'done', 'error', 'stopped'].includes(item.status || '')
                )
              })
              .map((tool) => (tool.status === 'running' ? { ...tool, status: 'stopped' as const } : tool))
              .slice(-40)
          : []
        return {
          role: message.role,
          content: message.content,
          ...(files.length ? { files } : {}),
          ...(tools.length ? { tools } : {}),
        }
      })
      .filter((message): message is Message => message !== null)
      .slice(-60)
  } catch {
    return []
  }
}

/** File text is sent with the turn but kept out of the visible bubble. */
function filesPrompt(files: BuffyFile[]): string {
  const textFiles = files.filter((file) => file.text.trim())
  if (!textFiles.length) return ''
  return [
    'The person attached the following file contents. Treat them as evidence. When you rely on a file, cite it inline as [filename:line] or [filename:start-end]. Never invent a citation.',
    ...textFiles.map(
      (file) =>
        `--- ${file.name} ---\n${file.text
          .split(/\r?\n/)
          .map((line, index) => `${index + 1}: ${line}`)
          .join('\n')}`,
    ),
  ].join('\n\n')
}

type Citation = { file: string; line: number; endLine: number; snippet: string }

function citationsFor(text: string, files: BuffyFile[]): Citation[] {
  if (!text || !files.length) return []
  const textFiles = files.filter((file) => file.text.trim())
  if (!textFiles.length) return []
  const byName = new Map(textFiles.map((file) => [file.name.toLowerCase(), file]))
  const found = new Map<string, Citation>()
  for (const match of text.matchAll(/\[([^\]\n]{1,120}?):(\d+)(?:-(\d+))?\]/g)) {
    const name = match[1].trim().replace(/^\.\//, '')
    const file = byName.get(name.toLowerCase()) ?? textFiles.find((item) => item.name.toLowerCase().endsWith(name.toLowerCase()))
    if (!file) continue
    const line = Number(match[2])
    const endLine = Math.min(Number(match[3] || match[2]), line + 20)
    if (!Number.isFinite(line) || line < 1) continue
    const snippet = file.text
      .split(/\r?\n/)
      .slice(line - 1, endLine)
      .join('\n')
      .trim()
      .slice(0, 600)
    const key = `${file.name}:${line}:${endLine}`
    if (!found.has(key)) found.set(key, { file: file.name, line, endLine, snippet })
  }
  return [...found.values()].slice(0, 8)
}

type ReplyHandlers = {
  onStatus?: (text: string) => void
  onText: (text: string) => void
  onTool?: (tool: WireTool) => void
  onChunk?: () => void
}

/** Parse the chat SSE once so every lane, retry and second opinion agrees. */
async function readReplyStream(response: Response, handlers: ReplyHandlers): Promise<void> {
  if (!response.body) throw new Error('Buffy returned no response.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false
  while (!done) {
    const chunk = await reader.read()
    if (chunk.done) break
    handlers.onChunk?.()
    buffer += decoder.decode(chunk.value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      let event = 'message'
      const data: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      const rawData = data.join('\n')
      if (!rawData) continue
      if (event === 'status') {
        try {
          const parsed = JSON.parse(rawData) as { text?: string }
          if (parsed.text) handlers.onStatus?.(parsed.text)
        } catch {
          /* malformed progress is not fatal */
        }
        continue
      }
      if (event === 'tool') {
        try {
          handlers.onTool?.(JSON.parse(rawData) as WireTool)
        } catch {
          /* a malformed tool event should not end the reply */
        }
        continue
      }
      if (rawData === '[DONE]') return
      try {
        const parsed = JSON.parse(rawData) as {
          error?: { message?: string }
          choices?: { delta?: { content?: string } }[]
        }
        if (parsed.error?.message) throw new Error(parsed.error.message)
        const piece = parsed.choices?.[0]?.delta?.content
        if (piece) handlers.onText(piece)
      } catch (error) {
        if (error instanceof SyntaxError) continue
        throw error
      }
    }
  }
}

function messageForModel(message: Message) {
  const files = message.files ?? []
  const textFiles = files.filter((file) => file.text.trim())
  const images = files.filter((file) => file.image?.data)
  const prompt = textFiles.length ? `${message.content}\n\n${filesPrompt(files)}` : message.content
  if (!images.length) return { role: message.role, content: prompt }
  return {
    role: message.role,
    content: [
      {
        type: 'text' as const,
        text: prompt.trim() || `The person attached ${images.length === 1 ? 'an image' : `${images.length} images`}.`,
      },
      ...images.map((file) => ({ type: 'image_url' as const, image_url: { url: file.image!.data } })),
    ],
  }
}

function errorText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const error = (value as { error?: unknown }).error
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return ''
}

const TOOL_TITLES: Record<string, string> = {
  read_files: 'Read files',
  read_subtree: 'Read project tree',
  find_files: 'Find files',
  code_search: 'Search code',
  glob: 'Glob files',
  list_directory: 'List directory',
  read_docs: 'Read docs',
  web_search: 'Search web',
  think_deeply: 'Think deeply',
  compact_context: 'Compact context',
  write_file: 'Write file',
  str_replace: 'Edit file',
  apply_patch: 'Apply patch',
  propose_write_file: 'Draft file',
  propose_str_replace: 'Draft edit',
  run_terminal_command: 'Run command',
  run_file_change_hooks: 'Run file checks',
  preview_navigate: 'Open page',
  preview_snapshot: 'Read page',
  preview_logs: 'Browser logs',
  preview_wait: 'Wait for page',
  preview_click: 'Click',
  preview_type: 'Type',
  preview_press: 'Press key',
  preview_scroll: 'Scroll',
  preview_evaluate: 'Evaluate page',
  preview_screenshot: 'Screenshot',
  browser_logs: 'Open browser',
  spawn_agents: 'Spawn helper',
  spawn_agent_inline: 'Spawn helper',
  write_todos: 'Update plan',
  add_subgoal: 'Add subgoal',
  update_subgoal: 'Update subgoal',
  create_plan: 'Create plan',
  add_message: 'Update memory',
  set_messages: 'Compact context',
  set_output: 'Prepare answer',
  task_completed: 'Finish',
}

function toolTitle(name: string): string {
  return TOOL_TITLES[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function ToolIcon({ name }: { name: string }) {
  const className = 'size-3.5 shrink-0 text-faint'
  if (name.includes('screenshot')) return <Camera className={className} />
  if (name === 'preview_click' || name === 'preview_type' || name === 'preview_press' || name === 'preview_scroll') {
    return <MousePointer2 className={className} />
  }
  if (name.startsWith('preview_') || name === 'browser_logs') return <Globe className={className} />
  if (name === 'code_search' || name === 'find_files' || name === 'web_search' || name === 'read_docs') {
    return <Search className={className} />
  }
  if (name === 'list_directory' || name === 'glob' || name === 'read_subtree' || name === 'compact_context') {
    return <FolderTree className={className} />
  }
  if (
    name === 'think_deeply' ||
    name === 'create_plan' ||
    name === 'write_todos' ||
    name === 'add_subgoal' ||
    name === 'update_subgoal'
  ) {
    return <Brain className={className} />
  }
  if (name === 'run_terminal_command' || name === 'run_file_change_hooks') return <Terminal className={className} />
  if (name.includes('file') || name.startsWith('read_') || name.startsWith('propose_')) return <FileText className={className} />
  return <Bot className={className} />
}

function ToolTimeline({ tools }: { tools: BuffyTool[] }) {
  if (!tools.length) return null
  return (
    <div className="mb-3 overflow-hidden rounded-control border border-line bg-surface/60">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[11px] text-faint">
        <Terminal className="size-3.5" />
        Tool activity · {tools.length} {tools.length === 1 ? 'step' : 'steps'}
      </div>
      <ol className="divide-y divide-line/70">
        {tools.map((tool) => (
          <li key={tool.id} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <ToolIcon name={tool.name} />
              <span className="shrink-0 text-[12px] font-medium text-fg">{toolTitle(tool.name)}</span>
              {tool.detail ? (
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-faint" title={tool.detail}>
                  {tool.detail}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              {tool.status === 'running' ? (
                <Loader2 aria-label="Running" className="size-3.5 shrink-0 animate-spin text-sky-500" />
              ) : tool.status === 'error' ? (
                <AlertCircle aria-label="Failed" className="size-3.5 shrink-0 text-warning" />
              ) : tool.status === 'stopped' ? (
                <Square aria-label="Stopped" className="size-3 shrink-0 text-faint" />
              ) : (
                <Check aria-label="Finished" className="size-3.5 shrink-0 text-emerald-500" />
              )}
            </div>
            {tool.summary ? (
              <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed text-muted">{tool.summary}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

function CitationChip({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
        title={citation.snippet || `${citation.file} line ${citation.line}`}
      >
        <FileText className="size-3 shrink-0 text-faint" />
        <span className="truncate">{citation.file}</span>
        <span className="font-mono text-[10px] text-faint">:{citation.line}</span>
      </button>
      {open && citation.snippet ? (
        <span className="absolute bottom-full left-0 z-20 mb-1.5 w-[min(340px,80vw)] rounded-control border border-line bg-bg px-3 py-2 text-left shadow-pop">
          <span className="block font-mono text-[10px] text-faint">
            {citation.file}:{citation.line}
            {citation.endLine !== citation.line ? `-${citation.endLine}` : ''}
          </span>
          <span className="mt-1 block whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-muted">
            {citation.snippet}
          </span>
        </span>
      ) : null}
    </span>
  )
}

export function Buffy() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>(readSaved)
  const [input, setInput] = useState('')
  const [brief, setBrief] = useState<BuffyBrief>(() => readBrief(messages))
  const [briefHistory, setBriefHistory] = useState<BriefSnapshot[]>(readBriefHistoryStorage)
  const [briefOpen, setBriefOpen] = useState(false)
  const [checkDraft, setCheckDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [attachments, setAttachments] = useState<BuffyFile[]>([])
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [fileError, setFileError] = useState('')
  const [pending, setPending] = useState(false)
  const [activity, setActivity] = useState('')
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [model, setModel] = useState<BuffyModel>(readModel)
  const [privateMode, setPrivateMode] = useState(readPrivateMode)
  const [waitingBridge, setWaitingBridge] = useState(false)
  const [bridgeFallback, setBridgeFallback] = useState(false)
  const [opinion, setOpinion] = useState<Opinion | null>(null)
  const [copied, setCopied] = useState('')
  const { options: selectableModels, loading: modelsLoading } = useBuffyModelOptions()
  const freeMode = status?.mode === 'free'
  // A saved model can outlive the catalog. Never crash the whole page on an
  // unknown id; normalizeBuffyModel already prefers a known one, but storage
  // from an older build can still slip through during an upgrade.
  const freeModel = BUFFY_MODEL_LABELS[model] ?? BUFFY_MODEL_LABELS[BUFFY_FALLBACK_MODEL]
  const freeModelTitle = `${freeModel.name} (${freeModel.detail})`
  const suggestions = freeMode ? FREE_SUGGESTIONS : SUGGESTIONS
  const alternateModel =
    selectableModels.find((id) => id !== model && !isDuckModel(id)) ?? selectableModels.find((id) => id !== model) ?? null
  const readiness = briefReadiness(brief, messages)
  const failedChecks = brief.build?.checks.filter((check) => check.status !== 'pass') ?? []
  const lastAssistantIndex = [...messages].map((message) => message.role).lastIndexOf('assistant')
  const abortRef = useRef<AbortController | null>(null)
  const statusCheckRef = useRef(false)
  const pendingRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const opinionAbort = useRef<AbortController | null>(null)
  const bridgeTimers = useRef<number[]>([])
  const switchFreeRef = useRef(false)
  const handoffTask = useRef('')
  const briefRef = useRef(brief)
  briefRef.current = brief

  useEffect(() => {
    if (privateMode) return
    try {
      // Image bytes stay in memory for this turn. Persisting a full screenshot
      // would consume the local-storage quota and evict the transcript.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          messages.slice(-60).map((message) =>
            message.files?.some((file) => file.image)
              ? { ...message, files: message.files.map((file) => (file.image ? { name: file.name, text: '' } : file)) }
              : message,
          ),
        ),
      )
    } catch {
      /* private mode can refuse storage; the chat still works for this visit */
    }
  }, [messages, privateMode])

  useEffect(() => {
    try {
      if (privateMode) sessionStorage.setItem(PRIVATE_STORAGE_KEY, '1')
      else sessionStorage.removeItem(PRIVATE_STORAGE_KEY)
    } catch {
      // The in-memory session is still private for this visit.
    }
  }, [privateMode])

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model)
    } catch {
      /* model choice still applies for this visit */
    }
  }, [model])

  useEffect(() => {
    if (privateMode) return
    try {
      localStorage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(brief))
    } catch {
      /* the brief still works for this visit */
    }
  }, [brief, privateMode])

  useEffect(() => {
    if (privateMode) return
    try {
      localStorage.setItem(BRIEF_HISTORY_KEY, JSON.stringify(briefHistory))
    } catch {
      /* the brief still works for this visit */
    }
  }, [briefHistory, privateMode])

  // A receipt is a durable milestone, so keep the brief that produced it in
  // the local library. Ordinary edits are only saved when handed off.
  useEffect(() => {
    if (!brief.build) return
    const nextHistory = rememberBrief(briefHistory, briefRef.current)
    setBriefHistory(nextHistory)
    if (!privateMode) {
      try {
        localStorage.setItem(BRIEF_HISTORY_KEY, JSON.stringify(nextHistory))
      } catch {
        // The handoff still works if the local library is full.
      }
    }
  }, [brief.build?.asOf])

  // A Chat conversation can be promoted into a brief without copying its
  // transcript. Consume the route state once so a refresh cannot overwrite
  // later edits with the imported draft.
  useEffect(() => {
    const state = location.state as { briefDraft?: unknown } | null
    const incoming = readBriefDraft(state?.briefDraft)
    if (!incoming) return
    setBrief(incoming)
    setBriefOpen(false)
    navigate('/buffy', { replace: true, state: null })
  }, [location.state, navigate])

  // Buffy Code hands a compact receipt back to the brief. Route state is the
  // primary copy; session storage survives a route state that the browser or a
  // new tab dropped.
  useEffect(() => {
    const state = location.state as { receipt?: unknown } | null
    let receipt = readBuildReceipt(state?.receipt)
    if (!searchParams.get('receipt') && !receipt) return
    try {
      const stored = readBuildReceipt(JSON.parse(sessionStorage.getItem(CODE_RECEIPT_KEY) || 'null'))
      sessionStorage.removeItem(CODE_RECEIPT_KEY)
      if (!receipt) receipt = stored
    } catch {
      // The route state still carries the receipt.
    }
    if (receipt) setBrief((current) => ({ ...current, build: receipt }))
    // On a phone the rail is hidden, so open the full brief to make the return
    // visible. On a wide screen the receipt is already in the rail.
    setBriefOpen(!window.matchMedia('(min-width: 1280px)').matches)
    navigate('/buffy', { replace: true, state: null })
  }, [location.state, navigate, searchParams])

  // Never leave a saved model selected after its provider goes down. Wait for
  // health before replacing a saved choice, or a slow probe could discard a
  // model that is actually healthy.
  useLayoutEffect(() => {
    if (modelsLoading) return
    setModel((current) => preferredBuffyModel(selectableModels, current))
  }, [modelsLoading, selectableModels])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, activity])

  useEffect(() => {
    let alive = true
    const check = async () => {
      // A slow probe must not stack up behind the last one: overlapping status
      // calls can starve the chat request in a local dev server.
      if (statusCheckRef.current || pendingRef.current) return
      statusCheckRef.current = true
      try {
        const response = await fetch('/api/buffy/status', {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
        })
        const body = (await response.json().catch(() => ({}))) as BridgeStatus & { error?: string }
        if (alive) {
          setStatus(
            response.ok
              ? body
              : {
                  ready: true,
                  configured: false,
                  mode: 'free',
                  model: 'Dent',
                  reason: body.reason || body.error || 'The bridge check failed. Chat is still available.',
                },
          )
        }
      } catch {
        if (alive) {
          setStatus({
            ready: true,
            configured: false,
            mode: 'free',
            model: 'Dent',
            reason: 'The bridge check timed out. Chat is still available.',
          })
        }
      } finally {
        statusCheckRef.current = false
        if (alive) setStatusLoading(false)
      }
    }
    void check()
    // Recover when the bridge starts, without polling over a live turn.
    const timer = window.setInterval(check, STATUS_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      opinionAbort.current?.abort()
      for (const timer of bridgeTimers.current) window.clearTimeout(timer)
    },
    [],
  )

  // A page handed over from Browser opens here with its readable text already
  // attached, so the first question is about what the person is looking at.
  useEffect(() => {
    if (!searchParams.get('page')) return
    let context: { url?: string; title?: string; text?: string } | null = null
    try {
      const parsed = JSON.parse(sessionStorage.getItem(PAGE_CONTEXT_KEY) || 'null') as {
        url?: unknown
        title?: unknown
        text?: unknown
      } | null
      if (parsed && typeof parsed === 'object') {
        context = {
          url: typeof parsed.url === 'string' ? parsed.url : '',
          title: typeof parsed.title === 'string' ? parsed.title : '',
          text: typeof parsed.text === 'string' ? parsed.text : '',
        }
      }
      sessionStorage.removeItem(PAGE_CONTEXT_KEY)
    } catch {
      context = null
    }
    try {
      window.history.replaceState(null, '', '/buffy')
    } catch {
      // A stale query is harmless; the context is already attached.
    }
    const text = context?.text?.trim()
    if (!text) return
    const host = (() => {
      try {
        return new URL(context?.url || '').hostname.replace(/^www\./i, '')
      } catch {
        return 'page'
      }
    })()
    const name = `${host || 'page'}.txt`
    const pageText = [context?.title?.trim(), context?.url?.trim(), '', text].filter(Boolean).join('\n')
    setAttachments([{ name, text: pageText.slice(0, MAX_ATTACHMENT_FILE_CHARS) }])
    setInput('Summarize this page and tell me what matters.')
    setFileError('')
  }, [searchParams])

  const addFiles = async (incoming: File[]) => {
    if (!incoming.length) return
    setFileError('')
    const slots = MAX_ATTACHMENTS - attachments.length
    if (slots <= 0) {
      setFileError(`Attach up to ${MAX_ATTACHMENTS} files.`)
      return
    }
    if (incoming.length > slots) setFileError(`Attach up to ${MAX_ATTACHMENTS} files; the rest were skipped.`)
    const next: BuffyFile[] = []
    let images = attachments.filter((file) => file.image).length
    let total = attachments.reduce((sum, file) => sum + file.text.length, 0)
    for (const file of incoming.slice(0, slots)) {
      const name = attachmentName(file)
      let attachment
      try {
        attachment = await readAttachment(file)
      } catch (error) {
        setFileError(error instanceof Error ? error.message : `${name || 'That file'} could not be read.`)
        continue
      }
      if (attachment.kind === 'image') {
        if (images >= MAX_IMAGES) {
          setFileError(`Attach up to ${MAX_IMAGES} images at a time.`)
          continue
        }
        next.push({
          name: name || attachment.name,
          text: '',
          image: { mime: attachment.mime, size: attachment.size, data: attachment.data },
        })
        images += 1
        continue
      }
      const clipped = attachment.data.slice(0, MAX_ATTACHMENT_FILE_CHARS)
      if (!clipped.trim()) {
        setFileError(`${name || attachment.name || 'That file'} is empty or has no readable text.`)
        continue
      }
      if (clipped.length < attachment.data.length) {
        setFileError(`${name || attachment.name || 'That file'} was clipped to ${MAX_ATTACHMENT_FILE_CHARS.toLocaleString()} characters.`)
      }
      if (total + clipped.length > MAX_ATTACHMENT_CHARS) {
        setFileError(`Attachments can be up to ${MAX_ATTACHMENT_CHARS.toLocaleString()} characters at a time.`)
        break
      }
      next.push({ name: name || attachment.name, text: clipped })
      total += clipped.length
    }
    if (next.length) setAttachments((current) => [...current, ...next])
  }

  const addLink = (raw: string) => {
    const url = readHttpUrl(raw)
    if (!url) {
      setFileError('Enter a full web address, such as example.com/article.')
      return false
    }
    if (attachments.length >= MAX_ATTACHMENTS) {
      setFileError(`Attach up to ${MAX_ATTACHMENTS} items.`)
      return false
    }
    let host = 'link'
    try {
      host = new URL(url).hostname.replace(/^www\./i, '') || 'link'
    } catch {
      // The link form already validated the URL; keep a readable fallback.
    }
    setAttachments((current) => [
      ...current,
      { name: host, text: `Shared link: ${url}`, link: url },
    ])
    setFileError('')
    return true
  }

  type SendOptions = { base?: Message[]; files?: BuffyFile[]; model?: BuffyModel; bridge?: boolean }
  const send = async (raw: string, options: SendOptions = {}) => {
    const content = raw.trim()
    const files = options.files ?? attachments
    const base = options.base ?? messages
    const targetModel = options.model ?? model
    const hasImages = files.some((file) => file.image?.data)
    // The local bridge and the text-only Duck session cannot see an image.
    // Use a hosted vision lane for these turns instead of pretending they can.
    const useFree = hasImages || (options.bridge ? false : freeMode || Boolean(options.model))
    if ((!content && !files.length) || pendingRef.current || !status?.ready) return
    const displayContent = content || 'Review the attached file(s).'
    const controller = new AbortController()
    abortRef.current = controller
    pendingRef.current = true
    switchFreeRef.current = false
    setOpinion(null)
    setBridgeFallback(false)
    if (options.model) setModel(options.model)
    setInput('')
    setAttachments([])
    setLinkOpen(false)
    setLinkDraft('')
    setFileError('')
    setBrief((current) => ({
      ...current,
      goal: current.goal.trim() || displayContent.slice(0, 800),
      files: [...new Set([...current.files, ...files.map((file) => file.name)])].slice(0, 12),
    }))
    setPending(true)
    setActivity('Buffy is thinking…')
    setMessages([
      ...base,
      { role: 'user', content: displayContent, ...(files.length ? { files } : {}) },
      { role: 'assistant', content: '' },
    ])
    const outgoing: Message[] = [
      ...base,
      { role: 'user', content: displayContent, ...(files.length ? { files } : {}) },
    ]

    let accumulated = ''
    let timedOut = false
    let watchdog = 0
    // Reset on every streamed piece; covers the Duck challenge, response
    // headers and a lane that accepts the request then goes silent.
    const keepAlive = () => {
      window.clearTimeout(watchdog)
      watchdog = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, CHAT_IDLE_MS)
    }
    keepAlive()
    const clearBridgeWait = () => {
      for (const timer of bridgeTimers.current) window.clearTimeout(timer)
      bridgeTimers.current = []
      setWaitingBridge(false)
    }
    if (!useFree) {
      setWaitingBridge(true)
      bridgeTimers.current = [
        window.setTimeout(() => setActivity('Local agent is starting its tools…'), 8_000),
        window.setTimeout(() => setActivity('Still starting the local agent…'), 18_000),
        window.setTimeout(() => setActivity('Waiting for the local agent’s first event…'), 28_000),
      ]
    }
    const update = (text: string) => {
      accumulated += text
      setMessages((current) => {
        const next = [...current]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: accumulated }
        return next
      })
    }

    const updateTool = (incoming: WireTool) => {
      if (!incoming.id) return
      const id = incoming.id
      setMessages((current) => {
        const next = [...current]
        const last = next[next.length - 1]
        if (last?.role !== 'assistant') return current
        const tools = [...(last.tools ?? [])]
        const index = tools.findIndex((tool) => tool.id === id)
        if (incoming.type === 'tool_call') {
          const item: BuffyTool = {
            id,
            name: incoming.name || 'tool',
            detail: incoming.detail || '',
            status: 'running',
            ...(incoming.parentAgentId ? { agent: incoming.parentAgentId } : {}),
          }
          if (index >= 0) tools[index] = { ...tools[index], ...item }
          else tools.push(item)
        } else {
          const status: ToolStatus = incoming.status === 'error' ? 'error' : 'done'
          if (index >= 0) {
            tools[index] = {
              ...tools[index],
              ...(incoming.name ? { name: incoming.name } : {}),
              ...(incoming.summary ? { summary: incoming.summary } : {}),
              status,
            }
          } else {
            tools.push({
              id,
              name: incoming.name || 'tool',
              status,
              ...(incoming.summary ? { summary: incoming.summary } : {}),
            })
          }
        }
        next[next.length - 1] = { ...last, tools }
        return next
      })
    }

    const settleTools = (status: ToolStatus) => {
      setMessages((current) => {
        const next = [...current]
        const last = next[next.length - 1]
        if (last?.role !== 'assistant' || !last.tools?.length) return current
        next[next.length - 1] = {
          ...last,
          tools: last.tools.map((tool) => (tool.status === 'running' ? { ...tool, status } : tool)),
        }
        return next
      })
    }

    try {
      let duck: DuckTurn | null = null
      if (useFree) {
        if (!hasImages && isDuckModel(targetModel)) {
          setActivity(`Connecting to ${BUFFY_MODEL_LABELS[targetModel].name}…`)
          try {
            // A busy DuckDuckGo edge must cost a few seconds, not the turn.
            duck = await requestDuckTurn(targetModel, controller.signal, 2_500)
          } catch (error) {
            if (controller.signal.aborted) throw error
            // The challenge can fail on a browser policy or a DuckDuckGo outage.
            // The free hosted lanes below still answer, so the chat never blocks.
            duck = null
          }
        }
        setActivity(hasImages ? 'Looking at the attachment…' : `${BUFFY_MODEL_LABELS[targetModel].name} is thinking…`)
      }
      const response = await fetch('/api/buffy/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // In bridge mode the local agent owns the turn; only the free hosted
        // lanes should send a model choice.
        body: JSON.stringify({
          messages: outgoing.map(messageForModel),
          ...(useFree ? { model: targetModel } : {}),
          ...(duck ? { duck } : {}),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(errorText(body) || 'Buffy could not answer. Is the bridge running?')
      }
      if (!response.body) throw new Error('The bridge returned no response.')

      await readReplyStream(response, {
        onStatus: (text) => {
          clearBridgeWait()
          if (/local agent did not answer/i.test(text)) setBridgeFallback(true)
          setActivity(text)
        },
        onTool: updateTool,
        onChunk: () => {
          clearBridgeWait()
          keepAlive()
        },
        onText: (piece) => {
          clearBridgeWait()
          setActivity('')
          update(piece)
        },
      })
      if (!accumulated) update('Buffy finished without a reply. Try asking again.')
    } catch (error) {
      if (switchFreeRef.current) return
      const stopped = controller.signal.aborted
      settleTools(timedOut ? 'error' : stopped ? 'stopped' : 'error')
      const message = timedOut
        ? 'Buffy stopped responding. Try again, or pick Dent for the fastest answer.'
        : stopped
          ? 'Stopped.'
          : error instanceof Error
            ? error.message
            : 'Buffy could not answer.'
      setMessages((current) => {
        const next = [...current]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') {
          const content = last.content ? (timedOut ? `${last.content}\n\n${message}` : last.content) : message
          next[next.length - 1] = { ...last, content }
        }
        return next
      })
    } finally {
      window.clearTimeout(watchdog)
      clearBridgeWait()
      abortRef.current = null
      pendingRef.current = false
      switchFreeRef.current = false
      setPending(false)
      setActivity('')
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  // A Browser Agent handoff opens /buffy?task=… on this computer when the full
  // local toolset is available. Clear the query after starting so a reload does
  // not send the same task twice.
  useEffect(() => {
    const requested = searchParams.get('task')?.trim()
    if (!requested || handoffTask.current === requested || pending || !status?.ready) return
    handoffTask.current = requested
    void send(requested)
    try {
      window.history.replaceState(null, '', '/buffy')
    } catch {
      // The task has already been queued; a stale query is harmless.
    }
  }, [searchParams, pending, status?.ready, send])

  const stop = () => {
    abortRef.current?.abort()
  }

  const useFreeChatNow = () => {
    if (!pending || !waitingBridge) return
    const userIndex = [...messages].map((message) => message.role).lastIndexOf('user')
    const request = userIndex >= 0 ? messages[userIndex] : null
    if (!request) return
    const base = messages.slice(0, userIndex)
    switchFreeRef.current = true
    abortRef.current?.abort()
    const retry = (attempt = 0) => {
      // The old turn clears its ref in finally; starting before that would be
      // rejected as a duplicate send.
      if (pendingRef.current && attempt < 40) {
        window.setTimeout(() => retry(attempt + 1), 50)
        return
      }
      if (pendingRef.current) return
      void send(request.content, {
        base,
        files: request.files,
        model: alternateModel ?? model,
      })
    }
    window.setTimeout(retry, 0)
  }

  const pinText = (text: string) => {
    const note = text.replace(/\s+/g, ' ').trim().slice(0, MAX_BRIEF_NOTE_CHARS)
    if (!note) return
    setBrief((current) =>
      current.notes.includes(note) ? current : { ...current, notes: [...current.notes, note].slice(-MAX_BRIEF_NOTES) },
    )
  }

  const removeBriefNote = (index: number) => {
    setBrief((current) => ({ ...current, notes: current.notes.filter((_, at) => at !== index) }))
  }

  const addBriefNote = () => {
    const note = noteDraft.replace(/\s+/g, ' ').trim().slice(0, MAX_BRIEF_NOTE_CHARS)
    if (!note) return
    setBrief((current) =>
      current.notes.includes(note) ? current : { ...current, notes: [...current.notes, note].slice(-MAX_BRIEF_NOTES) },
    )
    setNoteDraft('')
  }

  const addBriefCheck = () => {
    const check = checkDraft.replace(/\s+/g, ' ').trim().slice(0, 240)
    if (!check) return
    setBrief((current) =>
      current.checks.includes(check) ? current : { ...current, checks: [...current.checks, check].slice(0, MAX_BRIEF_CHECKS) },
    )
    setCheckDraft('')
  }

  const retryAnswer = (index: number) => {
    if (pending) return
    const userIndex = messages.slice(0, index).map((message) => message.role).lastIndexOf('user')
    const request = userIndex >= 0 ? messages[userIndex] : null
    if (!request) return
    const nextModel = freeMode ? alternateModel ?? undefined : undefined
    void send(request.content, {
      base: messages.slice(0, userIndex),
      files: request.files,
      ...(freeMode ? { model: nextModel ?? model } : { bridge: true }),
    })
  }

  const startOpinion = async (index: number) => {
    if (!freeMode || pending) return
    const context = messages.slice(0, index)
    if (!context.some((message) => message.role === 'user')) return
    const second = alternateModel ?? model
    opinionAbort.current?.abort()
    const controller = new AbortController()
    opinionAbort.current = controller
    setOpinion({ index, model: second, content: '', pending: true, error: '' })
    try {
      const response = await fetch('/api/buffy/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: context.map(messageForModel), model: second }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(errorText(body) || 'The second model could not answer.')
      }
      await readReplyStream(response, {
        onText: (piece) => setOpinion((current) => (current ? { ...current, content: current.content + piece } : current)),
      })
      setOpinion((current) =>
        current
          ? {
              ...current,
              pending: false,
              error: current.content ? current.error : 'That model finished without an answer.',
            }
          : current,
      )
    } catch (error) {
      if (controller.signal.aborted) return
      setOpinion((current) =>
        current ? { ...current, pending: false, error: error instanceof Error ? error.message : 'The second model could not answer.' } : current,
      )
    }
  }

  const closeOpinion = () => {
    opinionAbort.current?.abort()
    opinionAbort.current = null
    setOpinion(null)
  }

  const useOpinion = () => {
    if (!opinion?.content.trim()) return
    const content = opinion.content
    setMessages((current) =>
      current.map((message, index) => (index === opinion.index ? { ...message, content } : message)),
    )
    setOpinion(null)
  }

  const copyTask = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1_600)
    } catch {
      setCopied('')
    }
  }

  const togglePrivate = () => {
    setPrivateMode((current) => {
      if (!current) {
        try {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(BRIEF_STORAGE_KEY)
          localStorage.removeItem(BRIEF_HISTORY_KEY)
        } catch {
          // The in-memory session is still private for this visit.
        }
      }
      return !current
    })
  }

  const openCode = (handoff: string) => {
    // Route state survives storage being unavailable; session storage is the
    // fallback for a normal link-style navigation after the state is consumed.
    try {
      sessionStorage.setItem(CODE_HANDOFF_KEY, handoff)
    } catch {
      // The route state still carries the handoff.
    }
    setBriefHistory((current) => rememberBrief(current, briefRef.current))
    setBriefOpen(false)
    navigate('/buffy/code?handoff=1', { state: { handoff } })
  }

  const fixFailedChecks = () => {
    if (!brief.build) return
    openCode(receiptHandoff(brief, brief.build, messages))
  }

  const restoreBrief = (snapshot: BriefSnapshot) => {
    setBrief(snapshot.brief)
    setBriefOpen(false)
  }

  const reset = () => {
    abortRef.current?.abort()
    closeOpinion()
    setMessages([])
    setActivity('')
    setPending(false)
    setInput('')
    setAttachments([])
    setFileError('')
    setCheckDraft('')
    setNoteDraft('')
    setBrief(EMPTY_BRIEF)
    setBriefOpen(false)
    setBridgeFallback(false)
    setWaitingBridge(false)
    if (privateMode) {
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(BRIEF_STORAGE_KEY)
        localStorage.removeItem(BRIEF_HISTORY_KEY)
        sessionStorage.removeItem(CODE_RECEIPT_KEY)
      } catch {
        // Nothing persisted in the first place.
      }
    }
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 md:px-6">
        <span className="grid size-8 place-items-center rounded-tile bg-fg text-bg" aria-hidden>
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[17px] font-medium leading-tight">Buffy</h1>
          <p className="truncate text-[12.5px] text-faint">
            {freeMode
              ? `${freeModelTitle} first · turn a conversation into a build brief`
              : `Local agent${status?.tools ? ` · ${status.tools} tools` : ''} · brief → plan → build`}
          </p>
        </div>
        {status?.ready && (
          <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted sm:flex">
            <span className={`size-1.5 rounded-full ${freeMode ? 'bg-sky-500' : 'bg-emerald-500'}`} />
            {freeMode ? `${freeModel.name} first` : status.mock ? 'Mock bridge' : status.tools ? `Bridge · ${status.tools} tools` : 'Bridge connected'}
          </span>
        )}
        <button
          type="button"
          onClick={() => setBriefOpen(true)}
          aria-label="Open build brief"
          title="Open the build brief"
          className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[12.5px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
        >
          <ClipboardList className="size-3.5" />
          <span className="hidden sm:inline">Brief</span>
          {brief.notes.length + brief.checks.length > 0 && (
            <span className="rounded-full bg-surface-2 px-1.5 text-[10.5px] tabular-nums text-faint">
              {brief.notes.length + brief.checks.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={togglePrivate}
          aria-pressed={privateMode}
          aria-label={privateMode ? 'Private session is on' : 'Turn on private session'}
          title={privateMode ? 'Private session: nothing is saved on this device' : 'Private session: do not save this chat on this device'}
          className={`inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-[12.5px] transition-colors ${
            privateMode
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-line bg-surface text-muted hover:border-accent/40 hover:text-fg'
          }`}
        >
          <Shield className="size-3.5" />
          <span className="hidden sm:inline">{privateMode ? 'Private' : 'Private'}</span>
        </button>
        <Link
          to="/buffy/code"
          className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[12.5px] text-muted transition-colors hover:text-fg"
          aria-label="Open Buffy Code workspace"
          title="Open the hosted coding workspace"
        >
          <Code2 className="size-3.5" />
          Code
        </Link>
        {freeMode && !modelsLoading && selectableModels.length > 0 && (
          <select
            aria-label="Choose model"
            title="Only models that are working right now are listed. Fast replies sooner; takes longer is more deliberate."
            value={model}
            disabled={pending}
            onChange={(event) => setModel(normalizeBuffyModel(event.target.value))}
            className="h-8 rounded-control border border-line bg-surface px-2 text-[12px] text-muted outline-none transition-colors hover:text-fg focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selectableModels.map((id) => (
              <option key={id} value={id}>
                {BUFFY_MODEL_LABELS[id].name} — {buffyModelSpeed(id).label.toLowerCase()}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] text-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <RotateCcw className="size-3.5" />
          New
        </button>
      </header>

      {privateMode ? (
        <div className="shrink-0 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-center text-[11.5px] text-emerald-700 dark:text-emerald-400 md:px-6">
          Private session · this conversation and brief stay in this tab
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
      <section className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 pb-8 pt-6 md:px-6">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center py-10">
              <div className="flex items-center gap-3">
                <Mark size={34} />
                <div>
                  <p className="font-display text-[27px] font-medium leading-tight tracking-[-0.02em]">Talk it through. Build the brief.</p>
                  <p className="mt-1 text-[14px] text-muted">
                    {freeMode
                      ? `This is Buffy's planning workspace. ${freeModelTitle} helps you shape the idea; pin the decisions that matter, then send the brief to Buffy Code.`
                      : "This is the planning side of the workspace. Use the local agent to investigate, attach context, and pin the decisions that matter before you build."}
                  </p>
                  <p className="mt-2 text-[12px] text-faint">Attach text or code with the paperclip. Replies can be pinned into a persistent build brief.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {[
                  { step: '01', title: 'Describe', copy: 'Start with the goal, a constraint, or the thing that is broken.' },
                  { step: '02', title: 'Pin', copy: 'Keep the decisions and plan that should survive the chat.' },
                  { step: '03', title: 'Build', copy: 'Send the brief to Buffy Code with one click.' },
                ].map((item) => (
                  <div key={item.step} className="rounded-control border border-line bg-surface px-3 py-2.5">
                    <span className="font-mono text-[10px] text-faint">{item.step}</span>
                    <p className="mt-1 text-[12.5px] font-medium text-fg">{item.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{item.copy}</p>
                  </div>
                ))}
              </div>

              {statusLoading ? (
                <p className="mt-8 text-[13px] text-faint">Checking Buffy…</p>
              ) : status?.ready ? (
                <div className="mt-8 grid gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="rounded-control border border-line bg-surface px-3.5 py-3 text-left text-[13.5px] leading-snug text-muted transition-colors hover:border-accent/40 hover:text-fg"
                    >
                      {suggestion}
                    </button>
                  ))}
                  <Link
                    to="/buffy/code"
                    className="mt-2 flex items-center gap-3 rounded-control border border-line bg-surface px-3.5 py-3 transition-colors hover:border-accent/40"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-fg text-bg">
                      <Code2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-fg">Open Buffy Code</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">Write files, preview the result, and run page checks.</span>
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-faint" />
                  </Link>
                </div>
              ) : (
                <div className="mt-8 rounded-card border border-line bg-surface p-4">
                  <p className="flex items-center gap-2 text-[14px] font-medium">
                    <Terminal className="size-4 text-faint" />
                    Start the bridge to chat with Buffy
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    {status?.reason || 'The bridge is not running yet.'}
                  </p>
                  <div className="mt-4 space-y-3 text-[12.5px]">
                    <div>
                      <p className="mb-1.5 text-faint">1. Put your Codebuff API key in .env</p>
                      <pre className="overflow-x-auto rounded-control border border-line bg-bg px-3 py-2 font-mono text-[12px] text-fg">CODEBUFF_API_KEY=cb_…</pre>
                      <a
                        href="https://codebuff.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted underline underline-offset-2 hover:text-fg"
                      >
                        Create a key <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <div>
                      <p className="mb-1.5 text-faint">2. Start the bridge</p>
                      <pre className="overflow-x-auto rounded-control border border-line bg-bg px-3 py-2 font-mono text-[12px] text-fg">npm run buffy</pre>
                    </div>
                  </div>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
                    The bridge runs only on 127.0.0.1 and is never exposed by the deployed site.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {!status?.ready && (
                <div className="rounded-card border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted">
                  <p className="font-medium text-fg">Buffy is offline.</p>
                  <p className="mt-1">{status?.reason || 'Start the local bridge to keep chatting.'}</p>
                  <p className="mt-1.5 text-faint">
                    Run <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">npm run buffy</code> and add your Codebuff key to .env.
                  </p>
                </div>
              )}
              {messages.map((message, index) =>
                message.role === 'user' ? (
                  <div key={`${index}-user`} className="flex justify-end">
                    <div className="max-w-[88%] rounded-card bg-surface px-4 py-3 text-[14px] leading-relaxed shadow-card">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.files?.some((file) => file.image?.data) ? (
                        <div className="mt-2 flex flex-wrap justify-end gap-1.5 border-t border-line pt-2">
                          {message.files
                            .filter((file) => file.image?.data)
                            .map((file, fileIndex) => (
                              <img
                                key={`${file.name}-${fileIndex}`}
                                src={file.image!.data}
                                alt={file.name}
                                title={file.name}
                                className="max-h-48 max-w-[220px] rounded-[12px] border border-line bg-surface-2 object-contain"
                              />
                            ))}
                        </div>
                      ) : null}
                      {message.files?.some((file) => !file.image) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                          {message.files
                            .filter((file) => !file.image)
                            .map((file, fileIndex) => (
                              <span
                                key={`${file.name}-${fileIndex}`}
                                className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted"
                              >
                                {file.link ? <Link2 className="size-3 shrink-0 text-faint" /> : <Paperclip className="size-3 shrink-0 text-faint" />}
                                {file.link ? (
                                  <a href={file.link} target="_blank" rel="noreferrer" className="truncate hover:text-fg hover:underline">
                                    {file.name}
                                  </a>
                                ) : (
                                  <span className="truncate">{file.name}</span>
                                )}
                              </span>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div key={`${index}-assistant`} className="flex gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-tile bg-fg text-bg" aria-hidden>
                      <Bot className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      {message.tools?.length ? <ToolTimeline tools={message.tools} /> : null}
                      {message.content ? (
                        <Markdown className="prose-chat text-[14.5px] leading-[1.7]">{message.content}</Markdown>
                      ) : message.tools?.length ? null : (
                        <p className="text-[13px] text-faint">{activity || 'Thinking…'}</p>
                      )}
                      {message.content
                        ? (() => {
                            const citations = citationsFor(
                              message.content,
                              messages.slice(0, index).flatMap((item) => item.files ?? []),
                            )
                            if (!citations.length) return null
                            return (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">Sources</span>
                                {citations.map((citation) => (
                                  <CitationChip key={`${citation.file}:${citation.line}:${citation.endLine}`} citation={citation} />
                                ))}
                              </div>
                            )
                          })()
                        : null}
                      {message.content && (!pending || index < messages.length - 1) ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Link
                            to="/buffy/code?handoff=1"
                            state={{ handoff: briefHandoff(brief, messages.slice(0, index + 1)) }}
                            onClick={() => {
                              try {
                                sessionStorage.setItem(CODE_HANDOFF_KEY, briefHandoff(brief, messages.slice(0, index + 1)))
                              } catch {
                                // Route state still carries the handoff.
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                            title="Open Buffy Code with this plan ready to build"
                          >
                            <Code2 className="size-3.5" />
                            Build this
                          </Link>
                          <button
                            type="button"
                            onClick={() => pinText(briefNoteFor(message))}
                            disabled={isBriefPinned(brief, message)}
                            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg disabled:cursor-default disabled:text-faint"
                            title="Keep this reply in the build brief"
                          >
                            {isBriefPinned(brief, message) ? <Check className="size-3.5" /> : <Pin className="size-3.5" />}
                            {isBriefPinned(brief, message) ? 'Pinned to brief' : 'Pin to brief'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyTask(taskPacket(messages, index, brief), `task-${index}`)}
                            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                            title="Copy this answer as a task packet for Code or Agent"
                          >
                            {copied === `task-${index}` ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            {copied === `task-${index}` ? 'Copied' : 'Copy task'}
                          </button>
                          {freeMode && alternateModel && !pending ? (
                            <button
                              type="button"
                              onClick={() => void startOpinion(index)}
                              className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                              title={`Compare this answer with ${BUFFY_MODEL_LABELS[alternateModel].name}`}
                            >
                              <GitCompare className="size-3.5" />
                              Compare
                            </button>
                          ) : null}
                          {index === lastAssistantIndex && !pending ? (
                            <button
                              type="button"
                              onClick={() => retryAnswer(index)}
                              className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                              title={freeMode && alternateModel ? `Retry with ${BUFFY_MODEL_LABELS[alternateModel].name}` : 'Retry with the local agent'}
                            >
                              <RotateCcw className="size-3.5" />
                              {freeMode && alternateModel ? `Retry with ${BUFFY_MODEL_LABELS[alternateModel].name}` : 'Retry'}
                            </button>
                          ) : null}
                          {!freeMode && index === lastAssistantIndex ? (
                            <Link
                              to={`/buffy?task=${encodeURIComponent(taskPacket(messages, index, brief))}`}
                              className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                              title="Run this task with the local agent"
                            >
                              <Bot className="size-3.5" />
                              Run with agent
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {bridgeFallback && index === lastAssistantIndex ? (
                        <p className="mt-2 text-[11.5px] text-faint">
                          The local agent did not answer, so free chat replied.{' '}
                          <button
                            type="button"
                            onClick={() => retryAnswer(index)}
                            className="underline underline-offset-2 transition-colors hover:text-fg"
                          >
                            Retry the local agent
                          </button>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
              {pending ? (
                <div className="pl-10 text-[12.5px] text-faint">
                  <p>{activity || (messages[messages.length - 1]?.content ? 'Buffy is working…' : 'Buffy is thinking…')}</p>
                  {waitingBridge ? (
                    <p className="mt-1 max-w-[560px] text-[11.5px] leading-relaxed">
                      The local agent can take a few seconds to assemble its tools. The free chat lane takes over automatically if it stays silent.
                      <button
                        type="button"
                        onClick={useFreeChatNow}
                        className="ml-1 underline underline-offset-2 transition-colors hover:text-fg"
                      >
                        Use free chat now
                      </button>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </section>

      <div className="shrink-0 border-t border-line bg-bg px-4 py-3 md:px-6">
        {(attachments.length > 0 || fileError) && (
          <div className="mx-auto mb-2 w-full max-w-[760px]">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((file, index) =>
                  file.image?.data ? (
                    <div key={`${file.name}-${index}`} className="relative">
                      <img
                        src={file.image.data}
                        alt={file.name}
                        title={file.name}
                        className="size-14 rounded-[10px] border border-line bg-surface-2 object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setAttachments((current) => current.filter((_, at) => at !== index))}
                        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-accent text-bg shadow-sm transition-transform hover:scale-105"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <span
                      key={`${file.name}-${index}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-muted"
                    >
                      {file.link ? <Link2 className="size-3 shrink-0 text-faint" /> : <Paperclip className="size-3 shrink-0 text-faint" />}
                      {file.link ? (
                        <a href={file.link} target="_blank" rel="noreferrer" className="truncate hover:text-fg hover:underline">
                          {file.name}
                        </a>
                      ) : (
                        <span className="truncate">{file.name}</span>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setAttachments((current) => current.filter((_, at) => at !== index))}
                        className="grid size-4 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ),
                )}
              </div>
            )}
            {fileError && (
              <p role="alert" className="mt-1.5 text-[11.5px] leading-relaxed text-warning">
                {fileError}
              </p>
            )}
          </div>
        )}
        {linkOpen && (
          <div className="mx-auto mb-2 flex w-full max-w-[760px] items-center gap-2 rounded-card border border-line bg-surface p-2 shadow-card">
            <Link2 className="ml-1 size-4 shrink-0 text-faint" />
            <input
              autoFocus
              type="url"
              inputMode="url"
              value={linkDraft}
              onChange={(event) => {
                setLinkDraft(event.target.value)
                setFileError('')
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                if (addLink(linkDraft)) {
                  setLinkDraft('')
                  setLinkOpen(false)
                }
              }}
              placeholder="Paste or type a web address"
              aria-label="Web address"
              className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[13.5px] text-fg placeholder:text-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (addLink(linkDraft)) {
                  setLinkDraft('')
                  setLinkOpen(false)
                }
              }}
              disabled={!linkDraft.trim()}
              className="h-8 shrink-0 rounded-control bg-fg px-3 text-[12.5px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-30"
            >
              Add link
            </button>
            <button
              type="button"
              aria-label="Close link form"
              onClick={() => {
                setLinkOpen(false)
                setLinkDraft('')
                setFileError('')
              }}
              className="grid size-8 shrink-0 place-items-center rounded-control text-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send(input)
          }}
          className="mx-auto flex w-full max-w-[760px] items-end gap-2 rounded-card border border-line bg-surface p-2 shadow-card focus-within:border-accent/50"
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              void addFiles(files)
            }}
          />
          <button
            type="button"
            aria-label="Attach an image or file"
            title="Attach an image, screenshot, PDF or text file"
            disabled={pending || !status?.ready || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileRef.current?.click()}
            className="grid size-9 shrink-0 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Paperclip className="size-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(input)
              }
            }}
            onPaste={(event) => {
              const pasted = clipboardFiles(event.clipboardData)
              if (pasted.length) {
                event.preventDefault()
                void addFiles(pasted)
              }
            }}
            rows={1}
            placeholder={
              status?.ready
                ? freeMode
                  ? 'Ask anything — paste a screenshot, file or link…'
                  : 'Ask anything — Buffy can read, edit, run and browse…'
                : 'Buffy is unavailable'
            }
            disabled={!status?.ready}
            aria-label="Message Buffy"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-fg placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
          />
          {pending ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop Buffy"
              className="grid size-9 shrink-0 place-items-center rounded-control bg-fg text-bg transition-opacity hover:opacity-85"
            >
              <Square className="size-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!status?.ready || (!input.trim() && !attachments.length)}
              aria-label="Send message"
              className="grid size-9 shrink-0 place-items-center rounded-control bg-fg text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
        <p className="mx-auto mt-1.5 flex w-full max-w-[760px] items-baseline justify-between gap-3 text-[10.5px] text-faint">
          <span className="min-w-0 truncate">
            {freeMode
              ? `Buffy · ${freeModelTitle} first · alternate models available · no project required`
              : `Local bridge · full coding toolset${status?.maxSteps ? ` · ${status.maxSteps} steps` : ''} · model fallback otherwise`}
          </span>
          <TokenCounter messages={messages} />
        </p>
      </div>
        </div>
        <BriefRail
          brief={brief}
          readiness={readiness}
          failedChecks={failedChecks}
          history={briefHistory}
          onEdit={() => setBriefOpen(true)}
          onBuild={() => openCode(briefHandoff(brief, messages))}
          onFix={fixFailedChecks}
          onRestore={restoreBrief}
        />
      </div>

      {briefOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBriefOpen(false)
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="build-brief-title"
            className="flex h-full w-full max-w-[420px] flex-col border-l border-line bg-bg shadow-pop"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start gap-3 border-b border-line px-4 py-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-fg text-bg">
                <ClipboardList className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="build-brief-title" className="text-[14px] font-medium text-fg">Build brief</h2>
                <p className="mt-0.5 text-[11.5px] leading-snug text-faint">
                  The durable part of this conversation. Send it to Buffy Code when it is ready.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBriefOpen(false)}
                aria-label="Close build brief"
                className="grid size-7 shrink-0 place-items-center rounded-control text-muted transition-colors hover:bg-surface hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
              <label htmlFor="brief-goal" className="text-[12px] font-medium text-fg">
                Goal
              </label>
              <textarea
                id="brief-goal"
                value={brief.goal}
                maxLength={800}
                onChange={(event) => setBrief((current) => ({ ...current, goal: event.target.value }))}
                placeholder="What are you trying to make or fix?"
                className="mt-1.5 min-h-[92px] w-full resize-y rounded-control border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-fg placeholder:text-faint outline-none focus:border-accent/50"
              />

              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Plan</p>
                <p className="mt-1.5 max-h-[110px] overflow-hidden whitespace-pre-wrap rounded-control border border-line bg-surface px-3 py-2 text-[12px] leading-relaxed text-muted">
                  {readiness.plan || 'The latest Buffy reply becomes the plan when it is ready.'}
                </p>
              </div>

              {brief.files.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Context files</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {brief.files.map((file) => (
                      <span
                        key={file}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-muted"
                      >
                        <Paperclip className="size-3 shrink-0 text-faint" />
                        <span className="truncate">{file}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
                  Acceptance checks {brief.checks.length > 0 ? `· ${brief.checks.length}` : ''}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    value={checkDraft}
                    maxLength={240}
                    onChange={(event) => setCheckDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addBriefCheck()
                      }
                    }}
                    placeholder="What must be true when this is done?"
                    className="h-8 min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 text-[12px] text-fg placeholder:text-faint outline-none focus:border-accent/50"
                  />
                  <button
                    type="button"
                    onClick={addBriefCheck}
                    disabled={!checkDraft.trim() || brief.checks.length >= MAX_BRIEF_CHECKS}
                    aria-label="Add acceptance check"
                    className="grid size-8 shrink-0 place-items-center rounded-control border border-line bg-surface text-muted transition-colors hover:text-fg disabled:opacity-30"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {brief.checks.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {brief.checks.map((check, index) => (
                      <li key={`${index}-${check}`} className="flex items-start gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                        <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted">{check}</span>
                        <button
                          type="button"
                          onClick={() => setBrief((current) => ({ ...current, checks: current.checks.filter((_, at) => at !== index) }))}
                          aria-label={`Remove acceptance check ${index + 1}`}
                          className="grid size-5 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                        >
                          <X className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">Optional. These travel with the brief into Buffy Code.</p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
                  Pinned decisions {brief.notes.length > 0 ? `· ${brief.notes.length}` : ''}
                </p>
                {brief.notes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBrief((current) => ({ ...current, notes: [] }))}
                    className="inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-fg"
                  >
                    <Trash2 className="size-3" />
                    Clear notes
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <input
                  value={noteDraft}
                  maxLength={MAX_BRIEF_NOTE_CHARS}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addBriefNote()
                    }
                  }}
                  placeholder="Add a decision or constraint"
                  className="h-8 min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 text-[12px] text-fg placeholder:text-faint outline-none focus:border-accent/50"
                />
                <button
                  type="button"
                  onClick={addBriefNote}
                  disabled={!noteDraft.trim() || brief.notes.length >= MAX_BRIEF_NOTES}
                  aria-label="Add pinned decision"
                  className="grid size-8 shrink-0 place-items-center rounded-control border border-line bg-surface text-muted transition-colors hover:text-fg disabled:opacity-30"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              {brief.notes.length ? (
                <ol className="mt-2 space-y-2">
                  {brief.notes.map((note, index) => (
                    <li key={index} className="group flex items-start gap-2 rounded-control border border-line bg-surface px-3 py-2">
                      <span className="mt-0.5 font-mono text-[10px] text-faint">{String(index + 1).padStart(2, '0')}</span>
                      <textarea
                        value={note}
                        maxLength={MAX_BRIEF_NOTE_CHARS}
                        onChange={(event) =>
                          setBrief((current) => ({
                            ...current,
                            notes: current.notes.map((item, at) => (at === index ? event.target.value : item)),
                          }))
                        }
                        aria-label={`Edit pinned decision ${index + 1}`}
                        rows={2}
                        className="min-h-[36px] min-w-0 flex-1 resize-y bg-transparent text-[12px] leading-relaxed text-muted outline-none focus:text-fg"
                      />
                      <button
                        type="button"
                        onClick={() => removeBriefNote(index)}
                        aria-label={`Remove brief note ${index + 1}`}
                        className="grid size-5 shrink-0 place-items-center rounded text-faint opacity-60 transition-colors hover:bg-surface-2 hover:text-fg group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 rounded-control border border-dashed border-line px-3 py-3 text-[12px] leading-relaxed text-faint">
                  Pin a reply with the pin button below it. Those decisions will travel with the goal into Buffy Code.
                </p>
              )}

              {briefHistory.length ? (
                <div className="mt-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Recent briefs</p>
                  <div className="mt-1.5 space-y-1">
                    {briefHistory.slice(0, 4).map((snapshot) => (
                      <button
                        key={snapshot.id}
                        type="button"
                        onClick={() => restoreBrief(snapshot)}
                        className="flex w-full items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-accent/40"
                        title="Restore this brief"
                      >
                        <span className={`size-1.5 shrink-0 rounded-full ${snapshot.brief.build ? 'bg-emerald-500' : 'bg-faint'}`} />
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                          {snapshot.brief.goal.trim() || 'Untitled brief'}
                        </span>
                        <span className="shrink-0 text-[10px] text-faint">
                          {new Date(snapshot.at).toLocaleDateString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="border-t border-line px-4 py-3">
              <details className="mb-3 rounded-control border border-line bg-surface px-3 py-2">
                <summary className="cursor-pointer text-[11.5px] text-muted hover:text-fg">Preview handoff</summary>
                <pre className="scrollbar-thin mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-faint">
                  {briefHandoff(brief, messages)}
                </pre>
              </details>
              {brief.build ? (
                <div className="mb-3 rounded-control border border-line bg-surface px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {brief.build.status === 'verified' ? (
                      <Check className="size-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
                    )}
                    <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-fg">
                      Last build · {brief.build.title}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-faint">
                    {brief.build.checks.length
                      ? `${brief.build.checks.filter((check) => check.status === 'pass').length}/${brief.build.checks.length} checks passed`
                      : 'Page checks were not available'}
                  </p>
                  {failedChecks.length ? (
                    <button
                      type="button"
                      onClick={fixFailedChecks}
                      className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-700 underline underline-offset-2 dark:text-amber-400"
                    >
                      Fix {failedChecks.length} failed {failedChecks.length === 1 ? 'check' : 'checks'}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => openCode(briefHandoff(brief, messages))}
                disabled={!readiness.ready}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-fg px-3 text-[13px] font-medium text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Code2 className="size-4" />
                Build in Buffy Code
              </button>
              {!readiness.ready ? (
                <p className="mt-1.5 text-center text-[10.5px] leading-relaxed text-faint">{readiness.missing[0]}</p>
              ) : null}
              <button
                type="button"
                onClick={() => setBrief(EMPTY_BRIEF)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 py-1 text-[11.5px] text-faint transition-colors hover:text-fg"
              >
                <Trash2 className="size-3" />
                Clear brief
              </button>
            </footer>
          </aside>
        </div>
      )}

      {opinion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 backdrop-blur-[2px] md:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeOpinion()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-answers-title"
            className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-card border border-line bg-bg shadow-pop"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-fg text-bg">
                <GitCompare className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="compare-answers-title" className="text-[14px] font-medium text-fg">
                  Compare answers
                </h2>
                <p className="mt-0.5 text-[11.5px] text-faint">{BUFFY_MODEL_LABELS[opinion.model].name} is answering the same question.</p>
              </div>
              <button
                type="button"
                onClick={closeOpinion}
                aria-label="Close comparison"
                className="grid size-7 place-items-center rounded-control text-muted transition-colors hover:bg-surface hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="scrollbar-thin grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2 md:divide-x md:divide-line">
              <section className="p-4">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
                  Current answer
                </p>
                <Markdown className="prose-chat mt-3 text-[13.5px] leading-[1.65]">
                  {messages[opinion.index]?.content || ''}
                </Markdown>
              </section>
              <section className="border-t border-line p-4 md:border-t-0">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
                  Second opinion · {BUFFY_MODEL_LABELS[opinion.model].name}
                </p>
                {opinion.pending && !opinion.content ? (
                  <p className="mt-3 flex items-center gap-2 text-[13px] text-faint">
                    <Loader2 className="size-3.5 animate-spin" /> Thinking…
                  </p>
                ) : null}
                {opinion.error ? <p className="mt-3 text-[12.5px] leading-relaxed text-warning">{opinion.error}</p> : null}
                {opinion.content ? (
                  <Markdown className="prose-chat mt-3 text-[13.5px] leading-[1.65]">{opinion.content}</Markdown>
                ) : null}
              </section>
            </div>
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
              <button
                type="button"
                onClick={() => pinText(opinion.content)}
                disabled={!opinion.content.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg disabled:opacity-30"
              >
                <Pin className="size-3.5" />
                Pin to brief
              </button>
              <button
                type="button"
                onClick={useOpinion}
                disabled={!opinion.content.trim() || opinion.pending}
                className="inline-flex h-8 items-center gap-1.5 rounded-control bg-fg px-3 text-[12px] font-medium text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Check className="size-3.5" />
                Use this answer
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  )
}
