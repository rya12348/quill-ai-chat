import { resolveWorkspacePath, type WorkspaceFile } from '../shared/workspace'

/**
 * Code-level problems the page checker cannot see.
 *
 * verifyPage() scores a rendered document: titles, viewport, headings,
 * stylesheet size. That is useful, but it passes a page whose JavaScript has a
 * syntax error, whose <link> points at a file the workspace does not have, or
 * whose markup never closes a <div>. Those are the failures a free model
 * actually makes, so they are checked here, deterministically and offline —
 * no Vercel token required.
 *
 * These checks are deliberately conservative: only structural errors that are
 * wrong in every case. A false positive costs the model a repair turn, so
 * anything arguable is left out.
 */

/** Tags that generated markup closes essentially always. */
const BALANCED_TAGS = [
  'div',
  'section',
  'main',
  'header',
  'footer',
  'nav',
  'article',
  'aside',
  'form',
  'table',
  'select',
  'button',
  'style',
  'script',
]

function countMatches(haystack: string, pattern: RegExp): number {
  return (haystack.match(pattern) ?? []).length
}

/**
 * Bracket balance for JavaScript and CSS, ignoring strings, comments, template
 * literals and regex literals. Returns one problem, because the first mismatch
 * makes the rest meaningless.
 */
export function bracketProblem(code: string): string | null {
  const stack: string[] = []
  let quote: string | null = null
  let index = 0
  while (index < code.length) {
    const char = code[index]!
    const next = code[index + 1]
    if (quote) {
      if (char === '\\') {
        index += 2
        continue
      }
      if (char === quote) quote = null
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      index += 1
      continue
    }
    if (char === '/' && next === '/') {
      const lineEnd = code.indexOf('\n', index)
      index = lineEnd < 0 ? code.length : lineEnd
      continue
    }
    if (char === '/' && next === '*') {
      const end = code.indexOf('*/', index + 2)
      index = end < 0 ? code.length : end + 2
      continue
    }
    if (char === '/') {
      const previous = code.slice(0, index).trimEnd().slice(-1)
      // A division sign follows a value; a regex follows an operator or a
      // line start. Only the second case opens a literal.
      if (!previous || /[(,=:[!&|?{};+\-*%<>~^]/.test(previous)) {
        let cursor = index + 1
        let inClass = false
        while (cursor < code.length && code[cursor] !== '\n') {
          const inner = code[cursor]!
          if (inner === '\\') {
            cursor += 2
            continue
          }
          if (inner === '[') inClass = true
          else if (inner === ']') inClass = false
          else if (inner === '/' && !inClass) {
            cursor += 1
            break
          }
          cursor += 1
        }
        index = cursor
        continue
      }
    }
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char)
      index += 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      const want = char === ')' ? '(' : char === ']' ? '[' : '{'
      if (stack.pop() !== want) return `an unmatched ${char} closes more than it opens`
      index += 1
      continue
    }
    index += 1
  }
  if (quote) return `a ${quote === '`' ? 'template literal' : 'string'} is never closed`
  if (stack.length) return `${stack.length} bracket${stack.length === 1 ? ' is' : 's are'} never closed`
  return null
}

const LOCAL_REFERENCE = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi

function pageReferenceProblems(files: WorkspaceFile[], page: WorkspaceFile): string[] {
  const problems: string[] = []
  const known = new Set(files.map((file) => file.path))
  const seen = new Set<string>()
  for (const match of page.content.matchAll(LOCAL_REFERENCE)) {
    const reference = (match[1] ?? '').trim()
    if (!reference || seen.has(reference)) continue
    seen.add(reference)
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) continue
    const target = resolveWorkspacePath(page.path, reference)
    if (target && !known.has(target)) {
      problems.push(`${page.path}: "${reference}" is referenced but that file does not exist`)
    }
  }
  return problems
}

function pageTagProblems(page: WorkspaceFile): string[] {
  const problems: string[] = []
  const markup = page.content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  for (const tag of BALANCED_TAGS) {
    const opened = countMatches(markup, new RegExp(`<${tag}\\b`, 'gi'))
    const closed = countMatches(markup, new RegExp(`</${tag}\\s*>`, 'gi'))
    if (opened > closed) problems.push(`${page.path}: ${opened - 1} <${tag}> block${opened - 1 === 1 ? '' : 's'} never close`)
    else if (closed > opened) problems.push(`${page.path}: </${tag}> appears ${closed - opened} more time${closed - opened === 1 ? '' : 's'} than <${tag}>`)
  }
  return problems
}

/**
 * Paths some other file refers to by name. Quoted strings are scanned rather
 * than only tags, because a module can import a sibling and a stylesheet can
 * @import one.
 */
function referencedPaths(files: WorkspaceFile[]): Set<string> {
  const known = new Set(files.map((file) => file.path))
  const referenced = new Set<string>()
  for (const file of files) {
    for (const match of file.content.matchAll(/["']([^"'\s]{1,160})["']/g)) {
      const target = resolveWorkspacePath(file.path, (match[1] ?? '').trim())
      if (target && target !== file.path && known.has(target)) referenced.add(target)
    }
  }
  return referenced
}

/**
 * A stylesheet or script no page loads has no effect, and it is how a model
 * "splits out the CSS" while leaving the page's own <style> block in place.
 * Only reported when the project has a page to link it from.
 */
function orphanProblems(files: WorkspaceFile[]): string[] {
  const pages = files.filter((file) => /\.html?$/i.test(file.path))
  if (!pages.length) return []
  const referenced = referencedPaths(files)
  return files
    .filter((file) => /\.[cm]?js$|\.css$/i.test(file.path) && !referenced.has(file.path))
    .map((file) => `${file.path}: no page or script references this file, so it does nothing`)
}

/**
 * Every structural problem in the workspace, as `path: reason` lines. An empty
 * array means the files are at least internally consistent.
 */
export function workspaceProblems(files: WorkspaceFile[]): string[] {
  const problems: string[] = []
  for (const file of files) {
    if (/\.js$/i.test(file.path)) {
      const problem = bracketProblem(file.content)
      if (problem) problems.push(`${file.path}: ${problem}`)
      continue
    }
    if (/\.css$/i.test(file.path)) {
      const opened = countMatches(file.content.replace(/\/\*[\s\S]*?\*\//g, ''), /\{/g)
      const closed = countMatches(file.content.replace(/\/\*[\s\S]*?\*\//g, ''), /\}/g)
      if (opened !== closed) {
        problems.push(`${file.path}: ${Math.abs(opened - closed)} CSS block${Math.abs(opened - closed) === 1 ? '' : 's'} ${opened > closed ? 'never close' : 'close without opening'}`)
      }
      continue
    }
    if (/\.html?$/i.test(file.path)) {
      problems.push(...pageTagProblems(file), ...pageReferenceProblems(files, file))
    }
  }
  problems.push(...orphanProblems(files))
  return problems
}

/** Problems the edit introduced: a pre-existing one is not this turn's fault. */
export function newWorkspaceProblems(before: WorkspaceFile[], after: WorkspaceFile[]): string[] {
  const known = new Set(workspaceProblems(before))
  return workspaceProblems(after).filter((problem) => !known.has(problem))
}
