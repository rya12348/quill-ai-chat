import { normalizeWorkspace, type WorkspaceFile } from '../shared/workspace'

/**
 * Existing-repository ingress.
 *
 * The coding agent could only ever edit a project it had just written, because
 * there was no way to get a real repository into the workspace. This reads a
 * public GitHub repository as a tarball, unpacks it in the Worker, and keeps the
 * files worth showing an editor: source, tests and the manifest.
 *
 * It is keyless like the rest of the app. codeload.github.com serves archives
 * for public repositories without a token, so no visitor account is involved.
 *
 * A repository is not a website: it is large, it has build output and vendored
 * dependencies, and most of it is irrelevant to one change. Everything here is
 * therefore bounded — bytes, files, per-file size — and ranked so the manifest,
 * tests and `src/` survive the budget when the rest does not.
 */

export const REPO_LIMITS = {
  /** Compressed archive ceiling. Bigger than this is not one edit turn. */
  compressedBytes: 8_000_000,
  tarBytes: 16_000_000,
  files: 40,
  /** Total workspace bytes kept, under the workspace's own 400 KB ceiling. */
  bytes: 380_000,
  fileBytes: 120_000,
} as const

export type RepoRef = { owner: string; repo: string }

/** How many dropped file names are worth carrying into one prompt. */
const NOT_IMPORTED_NAMES = 60

export type RepoImport = {
  ref: RepoRef
  /** The repository name, for the status line. */
  name: string
  files: WorkspaceFile[]
  /** Files that existed but were skipped as irrelevant or oversized. */
  skipped: number
  /**
   * Files left out by the size or count budget. They are real project files,
   * so the editor is told they exist: without that a READ looks like a missing
   * file and a model will recreate it.
   */
  skippedPaths: string[]
  reason?: string
}

/** A GitHub repository address in the request, if it names one. */
export function repoFromPrompt(prompt: string): RepoRef | null {
  const match = /\bhttps?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]{1,90})\/([A-Za-z0-9_.-]{1,90})/i.exec(prompt)
  if (!match) return null
  const owner = match[1] ?? ''
  const repo = (match[2] ?? '').replace(/\.git$/i, '')
  // github.com itself, its own product pages and gist hosts are not projects.
  if (!owner || !repo) return null
  if (/^(?:apps|features|pricing|login|join|about|topics|collections|sponsors|settings|marketplace|explore)$/i.test(owner)) {
    return null
  }
  return { owner, repo }
}

/** Build output, vendored dependencies and secrets are never worth importing. */
const IGNORED_PATH =
  /(?:^|\/)(?:node_modules|\.git|\.github|dist|build|out|coverage|\.next|\.nuxt|\.cache|vendor|target|bin|obj|__pycache__|\.venv|venv)\//i
const IGNORED_FILE =
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Cargo\.lock|\.DS_Store|\.env(?:\.[^/]*)?|\.pem|\.key)$/i
const TEXT_FILE =
  /\.(?:js|cjs|mjs|jsx|ts|tsx|json|css|scss|sass|less|html?|md|markdown|txt|yml|yaml|toml|ini|cfg|conf|py|rb|go|rs|java|kt|kts|c|h|cpp|hpp|cc|cs|php|sh|bash|zsh|sql|xml|vue|svelte)$/i

/** Manifest, then tests, then source: the files an editor needs first. */
export function repoFileRank(path: string): number {
  const base = path.slice(path.lastIndexOf('/') + 1)
  if (base === 'package.json' || base === 'pyproject.toml' || base === 'Cargo.toml' || base === 'go.mod') return 0
  // Source before tests: a real repository has more test files than the budget
  // holds, and they used to fill every slot before `lib/` was reached at all.
  if (/(?:^|\/)(?:test|tests|spec|__tests__)\//i.test(path) || /\.(?:test|spec)\.[a-z]+$/i.test(path)) return 2
  if (/^(?:src|lib|app|packages|internal)\//i.test(path)) return 1
  if (/^readme/i.test(base)) return 4
  return 3
}

function cString(bytes: Uint8Array, start: number, length: number): string {
  let text = ''
  for (let index = start; index < start + length && index < bytes.length; index += 1) {
    const code = bytes[index]!
    if (code === 0) break
    text += String.fromCharCode(code)
  }
  return text
}

/**
 * Reads a ustar archive. Only the fields that matter are used: name, size,
 * type. Directory, link and pax records are skipped, not misread as content.
 */
export function parseTar(buffer: Uint8Array): { path: string; content: Uint8Array }[] {
  const entries: { path: string; content: Uint8Array }[] = []
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const name = cString(header, 0, 100)
    const prefix = cString(header, 345, 155)
    const size = parseInt(cString(header, 124, 12).trim() || '0', 8) || 0
    const type = header[156]
    const start = offset + 512
    // '0' and NUL are regular files; everything else (dir, link, pax) is skipped.
    const regular = type === 48 || type === 0 || type === undefined
    if (regular && size > 0 && start + size <= buffer.length) {
      entries.push({ path: prefix ? `${prefix}/${name}` : name, content: buffer.subarray(start, start + size) })
    }
    offset = start + Math.ceil(size / 512) * 512
  }
  return entries
}

/**
 * Fetches and unpacks one public repository into workspace files. Failures come
 * back as a reason, never as a throw, so the turn can fall back to the page
 * builder instead of dying.
 */
export async function importGithubRepo(
  ref: RepoRef,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<RepoImport> {
  const base: RepoImport = { ref, name: ref.repo, files: [], skipped: 0, skippedPaths: [] }
  const fetchImpl = options.fetchImpl ?? fetch
  const url = `https://codeload.github.com/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/tar.gz/HEAD`

  let response: Response
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/x-gzip', 'user-agent': 'ink-repo-import' },
      redirect: 'follow',
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch {
    return { ...base, reason: 'That repository could not be reached.' }
  }
  if (!response.ok) {
    return {
      ...base,
      reason:
        response.status === 404 || response.status === 403
          ? 'That repository is private or does not exist.'
          : `GitHub answered ${response.status}.`,
    }
  }

  let compressed: Uint8Array
  try {
    compressed = new Uint8Array(await response.arrayBuffer())
  } catch {
    return { ...base, reason: 'The repository archive could not be read.' }
  }
  if (compressed.length > REPO_LIMITS.compressedBytes) {
    return { ...base, reason: 'That repository is too large to import.' }
  }

  let tar: Uint8Array
  try {
    const stream = new Blob([compressed as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
    tar = new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return { ...base, reason: 'The repository archive could not be unpacked.' }
  }
  if (tar.length > REPO_LIMITS.tarBytes) {
    return { ...base, reason: 'That repository is too large to import.' }
  }

  const decoder = new TextDecoder()
  const candidates: { path: string; content: string }[] = []
  const notImported: string[] = []
  let skipped = 0
  for (const entry of parseTar(tar)) {
    // codeload prefixes every path with "<repo>-<ref>/"; drop that one segment.
    const cut = entry.path.indexOf('/')
    const path = cut >= 0 ? entry.path.slice(cut + 1) : entry.path
    if (!path || path.endsWith('/')) continue
    if (IGNORED_PATH.test(path) || IGNORED_FILE.test(path) || !TEXT_FILE.test(path)) {
      skipped += 1
      continue
    }
    if (entry.content.length > REPO_LIMITS.fileBytes) {
      skipped += 1
      if (notImported.length < NOT_IMPORTED_NAMES) notImported.push(path)
      continue
    }
    // A NUL byte means this was never text, whatever the extension said.
    if (entry.content.includes(0)) {
      skipped += 1
      continue
    }
    candidates.push({ path, content: decoder.decode(entry.content) })
  }

  candidates.sort((left, right) => repoFileRank(left.path) - repoFileRank(right.path) || left.path.localeCompare(right.path))
  const kept: WorkspaceFile[] = []
  let bytes = 0
  for (const file of candidates) {
    if (kept.length >= REPO_LIMITS.files) {
      skipped += 1
      // The count ceiling is what drops most of a large repository, so these
      // names matter more than the oversized ones: they are the files the
      // editor will wonder about.
      if (notImported.length < NOT_IMPORTED_NAMES) notImported.push(file.path)
      continue
    }
    if (bytes + file.content.length > REPO_LIMITS.bytes) {
      skipped += 1
      if (notImported.length < NOT_IMPORTED_NAMES) notImported.push(file.path)
      continue
    }
    bytes += file.content.length
    kept.push(file)
  }

  const files = normalizeWorkspace(kept)
  if (!files.length) {
    return { ...base, skipped, reason: 'That repository has no files this editor can change.' }
  }
  return { ref, name: ref.repo, files, skipped, skippedPaths: notImported }
}
