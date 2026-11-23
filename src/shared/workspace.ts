/**
 * A small multi-file project workspace.
 *
 * The coding agent used to hand back one complete HTML document per turn, so a
 * follow-up request reprinted thousands of unchanged lines and every turn was a
 * fresh chance to lose a feature. A workspace keeps files on disk and lets the
 * model send targeted SEARCH/REPLACE edits instead: less output, fewer silent
 * regressions, and diffs a person can read.
 *
 * Everything here is deterministic and runs on either side of the wire. No
 * execution, no network, no dependencies: the preview assembles pages by
 * inlining local CSS and JS.
 */

export type WorkspaceFile = { path: string; content: string }

export type WorkspaceEdit =
  | { kind: 'replace'; path: string; search: string; replace: string }
  | { kind: 'create'; path: string; content: string }
  | { kind: 'delete'; path: string }
  | { kind: 'rename'; path: string; to: string }

export type ParsedEdits = { edits: WorkspaceEdit[]; rejected: string[] }

export type EditOutcome = {
  files: WorkspaceFile[]
  /** Paths whose content changed, in the order the edits touched them. */
  changed: string[]
  /** Paths the model created. */
  created: string[]
  /** Paths the model removed. */
  removed: string[]
  /** Files the model moved, old path to new. */
  renamed: { from: string; to: string }[]
  /** Human-readable reasons a block could not be applied. */
  failures: string[]
}

export const WORKSPACE_LIMITS = {
  files: 40,
  fileChars: 90_000,
  totalChars: 400_000,
  edits: 16,
  /** Characters of file content sent to the model in one edit turn. */
  promptChars: 60_000,
}

const PATH_PATTERN = /^(?!\/)[A-Za-z0-9._\-/]{1,120}$/
/**
 * Every kind of file a real repository holds, not just the ones a generated
 * page needs. This list used to be html/css/js/json only, which silently threw
 * away `index.d.ts` and every other source file an imported project depends on.
 */
const EXTENSION_PATTERN =
  /\.(?:html?|css|scss|sass|less|js|mjs|cjs|jsx|ts|tsx|json|svg|md|markdown|txt|webmanifest|ya?ml|toml|ini|cfg|conf|py|rb|go|rs|java|kt|kts|cs|c|h|cpp|hpp|php|sh|bash|sql|xml|vue|svelte)$/i

/** A workspace path is relative, flat enough to read, and an asset we can preview. */
export function safeWorkspacePath(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/^\.\/+/, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
  if (!value || !PATH_PATTERN.test(value)) return null
  if (!EXTENSION_PATTERN.test(value)) return null
  const parts = value.split('/')
  if (parts.length > 4) return null
  if (parts.some((part) => !part || part === '.' || part === '..')) return null
  return value
}

/** Drops unsafe paths, duplicates and anything past the size budget. */
export function normalizeWorkspace(value: unknown): WorkspaceFile[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const files: WorkspaceFile[] = []
  let total = 0
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as { path?: unknown; content?: unknown }
    if (typeof raw.path !== 'string' || typeof raw.content !== 'string') continue
    const path = safeWorkspacePath(raw.path)
    if (!path || seen.has(path)) continue
    if (!raw.content.trim() || raw.content.length > WORKSPACE_LIMITS.fileChars) continue
    if (total + raw.content.length > WORKSPACE_LIMITS.totalChars) break
    total += raw.content.length
    seen.add(path)
    files.push({ path, content: raw.content })
  }
  return files.slice(0, WORKSPACE_LIMITS.files)
}

const FILE_HEADER = /^(?:={3,}|-{3,}|#{1,6})\s*FILE\s*:\s*(.+?)\s*$/i
const SEARCH_START = /^<{5,9}\s*SEARCH\s*$/i
const CREATE_START = /^<{5,9}\s*CREATE\s*$/i
const REPLACE_END = /^>{5,9}\s*REPLACE\s*$/i
const CREATE_END = /^>{5,9}\s*CREATE\s*$/i
const MIDDLE = /^={7,}\s*$/
const DELETE_LINE = /^={3,}\s*DELETE\s*:\s*(.+?)\s*$/i
const RENAME_LINE = /^={3,}\s*RENAME\s*:\s*(.+?)\s*(?:->|=>|\sto\s)\s*(.+?)\s*$/i

function trimBlock(lines: string[]): string {
  const copy = [...lines]
  // A model almost always puts one newline right after the marker. Removing
  // that single leading blank line keeps exact matches possible; deeper
  // whitespace is left alone because it may be code indentation.
  if (copy.length && copy[0]!.trim() === '') copy.shift()
  while (copy.length && copy[copy.length - 1]!.trim() === '') copy.pop()
  return copy.join('\n')
}

/**
 * Reads the edit dialect the prompt asks for:
 *
 *   === FILE: styles.css
 *   <<<<<<< SEARCH
 *   .card { color: red }
 *   =======
 *   .card { color: blue }
 *   >>>>>>> REPLACE
 *
 * A block that cannot be read is reported, not applied.
 */
export function parseWorkspaceEdits(raw: string): ParsedEdits {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const edits: WorkspaceEdit[] = []
  const rejected: string[] = []
  let file: string | null = null
  let mode: 'idle' | 'search' | 'replace' | 'create' = 'idle'
  let search: string[] = []
  let body: string[] = []

  const closeIncomplete = () => {
    if (mode !== 'idle') rejected.push(`${file ?? 'unknown file'}: an unfinished ${mode} block was ignored`)
    mode = 'idle'
  }

  for (const line of lines) {
    // Whole-file operations are one line, so they never open a block.
    const removal = DELETE_LINE.exec(line.trim())
    if (removal) {
      closeIncomplete()
      file = null
      const path = safeWorkspacePath(removal[1] ?? '')
      if (path) edits.push({ kind: 'delete', path })
      else rejected.push(`Unsafe or unsupported path: ${(removal[1] ?? '').slice(0, 80)}`)
      continue
    }
    const move = RENAME_LINE.exec(line.trim())
    if (move) {
      closeIncomplete()
      file = null
      const from = safeWorkspacePath(move[1] ?? '')
      const to = safeWorkspacePath(move[2] ?? '')
      if (from && to) edits.push({ kind: 'rename', path: from, to })
      else rejected.push(`Unsafe or unsupported path in a rename: ${line.trim().slice(0, 80)}`)
      continue
    }
    const header = FILE_HEADER.exec(line)
    if (header) {
      closeIncomplete()
      file = safeWorkspacePath(header[1] ?? '')
      if (!file) rejected.push(`Unsafe or unsupported path: ${(header[1] ?? '').slice(0, 80)}`)
      search = []
      body = []
      continue
    }
    if (SEARCH_START.test(line)) {
      closeIncomplete()
      mode = 'search'
      search = []
      body = []
      continue
    }
    if (CREATE_START.test(line)) {
      closeIncomplete()
      mode = 'create'
      body = []
      continue
    }
    if (mode === 'search' && MIDDLE.test(line)) {
      mode = 'replace'
      body = []
      continue
    }
    if (mode === 'replace' && REPLACE_END.test(line)) {
      if (!file) rejected.push('An edit block had no file header')
      else {
        edits.push({ kind: 'replace', path: file, search: trimBlock(search), replace: trimBlock(body) })
      }
      mode = 'idle'
      search = []
      body = []
      continue
    }
    if (mode === 'create' && CREATE_END.test(line)) {
      if (!file) rejected.push('A create block had no file header')
      else edits.push({ kind: 'create', path: file, content: trimBlock(body) })
      mode = 'idle'
      body = []
      continue
    }
    if (mode === 'search') search.push(line)
    else if (mode === 'replace' || mode === 'create') body.push(line)
  }
  closeIncomplete()

  if (edits.length > WORKSPACE_LIMITS.edits) {
    rejected.push(`Only the first ${WORKSPACE_LIMITS.edits} edit blocks were applied`)
    return { edits: edits.slice(0, WORKSPACE_LIMITS.edits), rejected }
  }
  return { edits, rejected }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return count
    count += 1
    from = at + needle.length
  }
}

/**
 * Applies edits in order. A SEARCH block must match exactly once: silence or
 * ambiguity is reported rather than guessed, because guessing is how an agent
 * quietly deletes the wrong function.
 */
/** Points attributes and CSS url() at the new name after a move. */
function rewriteReferences(files: WorkspaceFile[], from: string, to: string): WorkspaceFile[] {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const attribute = new RegExp(`((?:href|src)=["'])${escaped}(["'])`, 'gi')
  const cssUrl = new RegExp(`(url\\(["']?)${escaped}(["']?\\))`, 'gi')
  return files.map((file) => {
    if (!file.content.includes(from)) return file
    const content = file.content.replace(attribute, `$1${to}$2`).replace(cssUrl, `$1${to}$2`)
    return content === file.content ? file : { ...file, content }
  })
}

export function applyWorkspaceEdits(files: WorkspaceFile[], edits: WorkspaceEdit[]): EditOutcome {
  let current = files.map((file) => ({ ...file }))
  const changed = new Set<string>()
  const created: string[] = []
  const removed: string[] = []
  const renamed: { from: string; to: string }[] = []
  const failures: string[] = []

  for (const edit of edits) {
    const index = current.findIndex((file) => file.path === edit.path)
    if (edit.kind === 'delete') {
      if (index < 0) {
        failures.push(`${edit.path}: that file does not exist, so it cannot be removed.`)
        continue
      }
      if (current.length <= 1) {
        failures.push(`${edit.path}: the workspace needs at least one file.`)
        continue
      }
      const pages = current.filter((file) => /\.html?$/i.test(file.path))
      if (pages.length <= 1 && /\.html?$/i.test(edit.path)) {
        failures.push(`${edit.path}: the project needs at least one page.`)
        continue
      }
      current.splice(index, 1)
      changed.add(edit.path)
      removed.push(edit.path)
      continue
    }
    if (edit.kind === 'rename') {
      if (index < 0) {
        failures.push(`${edit.path}: that file does not exist, so it cannot be moved.`)
        continue
      }
      if (current.some((file) => file.path === edit.to)) {
        failures.push(`${edit.to}: that file already exists.`)
        continue
      }
      const from = edit.path
      current[index] = { path: edit.to, content: current[index]!.content }
      current = rewriteReferences(current, from, edit.to)
      changed.add(edit.to)
      renamed.push({ from, to: edit.to })
      continue
    }
    if (edit.kind === 'create') {
      if (!edit.content.trim()) {
        failures.push(`${edit.path}: the new file was empty`)
        continue
      }
      if (index >= 0) {
        if (current[index]!.content !== edit.content) changed.add(edit.path)
        current[index] = { path: edit.path, content: edit.content }
      } else {
        if (current.length >= WORKSPACE_LIMITS.files) {
          failures.push(`${edit.path}: the workspace already has ${WORKSPACE_LIMITS.files} files`)
          continue
        }
        current.push({ path: edit.path, content: edit.content })
        changed.add(edit.path)
        created.push(edit.path)
      }
      continue
    }

    if (index < 0) {
      failures.push(`${edit.path}: that file does not exist. Send a CREATE block for a new file.`)
      continue
    }
    const file = current[index]!
    if (!edit.search) {
      if (!edit.replace.trim()) continue
      current[index] = { path: file.path, content: `${file.content.replace(/\s+$/, '')}\n\n${edit.replace}\n` }
      changed.add(file.path)
      continue
    }
    const matches = countOccurrences(file.content, edit.search)
    if (matches === 0) {
      failures.push(`${edit.path}: SEARCH text was not found exactly. Copy it from the file above, whitespace included.`)
      continue
    }
    if (matches > 1) {
      failures.push(`${edit.path}: SEARCH text appears ${matches} times. Include a unique surrounding line.`)
      continue
    }
    current[index] = { path: file.path, content: file.content.replace(edit.search, edit.replace) }
    changed.add(file.path)
  }

  current = normalizeWorkspace(current)
  return {
    files: current,
    changed: [...changed].filter((path) => current.some((file) => file.path === path)),
    created: created.filter((path) => current.some((file) => file.path === path)),
    removed: removed.filter((path) => !current.some((file) => file.path === path)),
    renamed: renamed.filter((move) => current.some((file) => file.path === move.to)),
    failures,
  }
}

/** A compact tree for the model and the workspace header. */
export function workspaceTree(files: WorkspaceFile[]): string {
  if (!files.length) return '(empty workspace)'
  return files
    .map((file) => `${file.path} (${Math.max(1, Math.round(file.content.length / 1024))} KB)`)
    .join('\n')
}

function mentionedIn(request: string, path: string): boolean {
  const haystack = request.toLowerCase()
  if (haystack.includes(path.toLowerCase())) return true
  const base = path.split('/').pop()?.toLowerCase()
  return Boolean(base && base.length > 3 && haystack.includes(base))
}

/**
 * The files one edit turn can see. Mentioned files first, then pages, then
 * assets, up to a character budget; anything omitted is named so the model
 * knows it exists and must not be re-created.
 */
export function workspaceContext(files: WorkspaceFile[], request: string, absent: string[] = []): string {
  if (!files.length) return 'The workspace is empty. Create the files this request needs.'
  const ranked = [...files].sort((left, right) => {
    const score = (file: WorkspaceFile) =>
      (mentionedIn(request, file.path) ? 2 : 0) + (/\.html?$/i.test(file.path) ? 1 : 0)
    return score(right) - score(left)
  })
  const shown: string[] = []
  const hidden: string[] = []
  let used = 0
  for (const file of ranked) {
    const block = `<file path="${file.path}">\n${file.content}\n</file>`
    if (used + block.length > WORKSPACE_LIMITS.promptChars && shown.length) {
      hidden.push(file.path)
      continue
    }
    used += block.length
    shown.push(block)
  }
  // A file the repository import left out still exists. Naming it stops the
  // model from reading "not shown" as "not there" and creating a duplicate.
  const absentNote = absent.length
    ? `\n\nIn the repository but not imported here, so not editable this turn (they exist; do not create them): ${absent
        .slice(0, 40)
        .join(', ')}${absent.length > 40 ? ', …' : ''}`
    : ''
  return `Workspace files:\n${workspaceTree(files)}\n\n${shown.join('\n\n')}${
    hidden.length
      ? `\n\nNot shown this turn, unchanged unless you edit them: ${hidden.join(', ')}`
      : ''
  }${absentNote}`
}

/**
 * A short checklist the agent keeps between turns. It is what stops a long
 * request from drifting: the next prompt shows what is already done.
 */
export type PlanItem = { text: string; done: boolean }

const PLAN_LINE = /^={3,}\s*PLAN\s*$/i
const PLAN_ITEM = /^\s*(?:[-*]\s*)?\[( |x|X)\]\s*(.+?)\s*$/
export const PLAN_LIMIT = 8

/** Reads a trailing `=== PLAN` block, or null when the answer has none. */
export function parseWorkspacePlan(raw: string): PlanItem[] | null {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.findIndex((line) => PLAN_LINE.test(line.trim()))
  if (start < 0) return null
  const items: PlanItem[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) continue
    const match = PLAN_ITEM.exec(line)
    if (!match) break
    const text = (match[2] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (text) items.push({ text, done: (match[1] ?? '').toLowerCase() === 'x' })
    if (items.length >= PLAN_LIMIT) break
  }
  return items.length ? items : null
}

/** The plan as the prompt shows it, or an empty string when there is none. */
export function formatPlan(plan: PlanItem[] | undefined | null): string {
  if (!plan?.length) return ''
  return `Plan so far:\n${plan.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')}\n\n`
}

export type WorkspaceRequest =
  | { kind: 'file'; path: string }
  | { kind: 'find'; text: string }
  | { kind: 'list' }
  | { kind: 'fetch'; url: string }

const READ_LINE = /^={3,}\s*READ\s*:\s*(.+?)\s*$/i
const FIND_LINE = /^={3,}\s*FIND\s*:\s*(.+?)\s*$/i
const FETCH_LINE = /^={3,}\s*FETCH\s*:\s*(.+?)\s*$/i
const LIST_LINE = /^={3,}\s*LIST\s*$/i

/**
 * The read half of the edit dialect: a model that cannot see a file asks for it
 * instead of guessing at its contents.
 *
 *   === READ: styles.css
 *   === FIND: addEventListener
 *   === LIST
 */
export function parseWorkspaceRequests(raw: string): WorkspaceRequest[] {
  const requests: WorkspaceRequest[] = []
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const trimmed = line.trim()
    const read = READ_LINE.exec(trimmed)
    if (read) {
      const path = safeWorkspacePath(read[1] ?? '')
      if (path) requests.push({ kind: 'file', path })
      continue
    }
    const find = FIND_LINE.exec(trimmed)
    if (find && (find[1] ?? '').trim().length >= 2) {
      requests.push({ kind: 'find', text: (find[1] ?? '').trim().slice(0, 120) })
      continue
    }
    const fetchLine = FETCH_LINE.exec(trimmed)
    if (fetchLine) {
      const url = (fetchLine[1] ?? '').trim()
      // The worker decides what it will actually fetch; this only rejects the
      // obviously unusable so the model gets told instead of silently ignored.
      if (/^https?:\/\//i.test(url) && url.length <= 300) requests.push({ kind: 'fetch', url })
      continue
    }
    if (LIST_LINE.test(trimmed)) requests.push({ kind: 'list' })
  }
  return requests.slice(0, 4)
}

/** How many search hits one turn may see before the reader is asked to narrow. */
export const FIND_HITS = 30

/** Code before configuration before prose, so a search lands where the change is. */
function findRank(path: string): number {
  if (/\.(?:js|cjs|mjs|jsx|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|cs|php|vue|svelte)$/i.test(path)) return 0
  if (/\.(?:css|scss|sass|less|html?)$/i.test(path)) return 1
  if (/\.(?:json|ya?ml|toml|ini|cfg|conf)$/i.test(path)) return 2
  return 3
}

/**
 * Answers those requests, bounded, so the next call can quote exact lines.
 * An unknown path lists what does exist instead of pretending it read it.
 */
export function workspaceReadResults(
  files: WorkspaceFile[],
  requests: WorkspaceRequest[],
  budget = 24_000,
  absent: string[] = [],
): string {
  const byPath = new Map(files.map((file) => [file.path, file.content]))
  const names = files.map((file) => file.path).join(', ')
  const blocks: string[] = []
  let used = 0
  const add = (text: string) => {
    if (used + text.length > budget) {
      blocks.push('(further output omitted: this turn\'s read budget is used)')
      return false
    }
    used += text.length
    blocks.push(text)
    return true
  }
  for (const request of requests) {
    // Fetches are not workspace content; the caller answers them over the wire.
    if (request.kind === 'fetch') continue
    if (request.kind === 'list') {
      if (!add(`Workspace files:\n${workspaceTree(files)}`)) break
      continue
    }
    if (request.kind === 'find') {
      const needle = request.text.toLowerCase()
      const hits: { path: string; line: number; text: string }[] = []
      for (const file of files) {
        file.content.split('\n').forEach((line, index) => {
          if (line.toLowerCase().includes(needle)) {
            hits.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 160) })
          }
        })
      }
      // In an imported repository a common word matches everywhere, so the
      // order decides what the model actually sees: source before prose, then
      // a stable path and line order so repeated searches agree.
      hits.sort(
        (left, right) =>
          findRank(left.path) - findRank(right.path) ||
          left.path.localeCompare(right.path) ||
          left.line - right.line,
      )
      const capped = hits.slice(0, FIND_HITS)
      const body = capped.length
        ? `Matches for "${request.text}" (${hits.length} in ${new Set(hits.map((hit) => hit.path)).size} files):\n${capped
            .map((hit) => `${hit.path}:${hit.line}: ${hit.text}`)
            .join('\n')}${hits.length > capped.length ? `\n… ${hits.length - capped.length} more` : ''}`
        : `No file contains "${request.text}". Files: ${names}`
      if (!add(body)) break
      continue
    }
    const content = byPath.get(request.path)
    if (content === undefined) {
      // A file that exists in the repository but fell outside the import reads
      // as "missing" otherwise, and a model told that will create it again.
      const note = absent.includes(request.path)
        ? `${request.path}: exists in the repository but was not imported this turn. Do not create it; work within the imported files.`
        : `${request.path}: no such file. Files: ${names}`
      if (!add(note)) break
      continue
    }
    const body = content.length > 20_000 ? `${content.slice(0, 20_000)}\n…(truncated)` : content
    if (!add(`<file path="${request.path}">\n${body}\n</file>`)) break
  }
  return blocks.join('\n\n')
}

/** Resolves a relative reference from one workspace file to another. */
export function resolveWorkspacePath(from: string, reference: string): string | null {
  const clean = reference.trim().split(/[?#]/)[0] ?? ''
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null
  const base = clean.startsWith('/') ? [] : from.split('/').slice(0, -1)
  const stack = [...base]
  for (const part of clean.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!stack.length) return null
      stack.pop()
      continue
    }
    stack.push(part)
  }
  return stack.join('/') || null
}

/** Inlines local stylesheets and scripts so the sandboxed preview can run them. */
export function inlineWorkspaceAssets(html: string, files: WorkspaceFile[], from = 'index.html'): string {
  const byPath = new Map(files.map((file) => [file.path, file.content]))
  const stylesheet = /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi
  const script = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi
  let output = html.replace(stylesheet, (tag, href: string) => {
    const target = resolveWorkspacePath(from, href)
    const content = target ? byPath.get(target) : undefined
    return content === undefined ? tag : `<style data-workspace="${target}">\n${content}\n</style>`
  })
  output = output.replace(script, (tag, src: string) => {
    const target = resolveWorkspacePath(from, src)
    const content = target ? byPath.get(target) : undefined
    return content === undefined ? tag : `<script data-workspace="${target}">\n${content}\n</script>`
  })
  return output
}

/**
 * The previewable pages of a workspace: HTML files only, index first. Local
 * assets are inlined because the preview uses srcdoc and has no document base.
 */
/**
 * A request that asks for the CSS in its own file, and the file it names.
 * "Put the CSS in a separate stylesheet" used to produce one HTML document with
 * a <style> block, which then left an unused styles.css behind on a later turn.
 */
export const STYLE_FILE_REQUEST =
  /\b(?:separate|own|external|different)\s+(?:css|stylesheet|style\s?sheet)|\bput the css in|\bmove the css\b|\b(?:styles?|theme)\.css\b/i

export function styleFileName(prompt: string): string {
  return prompt.match(/\b([\w-]+\.css)\b/i)?.[1] ?? 'styles.css'
}

/**
 * Moves one documented page's inline <style> block into a real stylesheet and
 * links it, so the files match what the person asked for. The page keeps
 * looking identical: the preview inlines assets anyway.
 */
export function splitInlineStylesheet(files: WorkspaceFile[], name = 'styles.css'): WorkspaceFile[] {
  const page = files.find((file) => /\.html?$/i.test(file.path))
  if (!page || /<link[^>]+stylesheet/i.test(page.content)) return files
  const blocks = [...page.content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  const css = blocks.map((block) => (block[1] ?? '').trim()).filter(Boolean).join('\n')
  // A one-line override is not a stylesheet worth a file of its own.
  if (css.length < 120) return files
  let html = page.content
  for (const block of blocks) html = html.replace(block[0], '')
  const link = `<link rel="stylesheet" href="${name}">`
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `  ${link}\n</head>`) : `${link}\n${html}`
  const next = files.map((file) => (file.path === page.path ? { ...file, content: html } : file))
  const existing = next.find((file) => file.path === name)
  return existing
    ? next.map((file) => (file.path === name ? { ...file, content: `${file.content.trim()}\n${css}` } : file))
    : [...next, { path: name, content: css }]
}

export function workspacePages(files: WorkspaceFile[]): { name: string; html: string }[] {
  const pages = files
    .filter((file) => /\.html?$/i.test(file.path))
    .map((file) => ({
      name: file.path.split('/').pop() ?? file.path,
      html: inlineWorkspaceAssets(file.content, files, file.path),
    }))
    .sort((left, right) => {
      if (/^index\.html?$/i.test(left.name)) return -1
      if (/^index\.html?$/i.test(right.name)) return 1
      return left.name.localeCompare(right.name)
    })
  return pages.slice(0, 8)
}

/** Turns the pages of an earlier single-document build into workspace files. */
export function workspaceFromPages(pages: { name: string; html: string }[]): WorkspaceFile[] {
  return normalizeWorkspace(pages.map((page) => ({ path: page.name, content: page.html })))
}

/** A one-line summary for the agent activity row. */
export function describeEdits(outcome: EditOutcome): string {
  if (!outcome.changed.length && !outcome.removed.length && !outcome.renamed.length) {
    return outcome.failures.length ? 'No edit applied' : 'No change needed'
  }
  const edited = outcome.changed.length - outcome.created.length - outcome.renamed.length
  const parts: string[] = []
  if (edited > 0) parts.push(`${edited} file${edited === 1 ? '' : 's'} edited`)
  if (outcome.created.length) parts.push(`${outcome.created.length} created`)
  if (outcome.removed.length) parts.push(`${outcome.removed.length} removed`)
  if (outcome.renamed.length) parts.push(`${outcome.renamed.length} moved`)
  if (outcome.failures.length) parts.push(`${outcome.failures.length} block${outcome.failures.length === 1 ? '' : 's'} rejected`)
  return parts.join(' · ')
}
