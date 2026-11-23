import type { BuildInfo } from '../shared/types'
import {
  applyWorkspaceEdits,
  formatPlan,
  parseWorkspaceEdits,
  parseWorkspacePlan,
  parseWorkspaceRequests,
  workspaceContext,
  workspacePages,
  workspaceReadResults,
  workspaceTree,
  type EditOutcome,
  type PlanItem,
  type WorkspaceFile,
} from '../shared/workspace'
import type { ChatMessage } from './ai'
import { pageCheckImprovement, verifyPages } from './build'
import { newWorkspaceProblems } from './workspace-checks'

/**
 * The shared diff-edit turn.
 *
 * Buffy Code and Chat's Build mode both edit a workspace of files. They used to
 * carry separate copies of this prompt and dialect; this module is the single
 * copy, so an improvement to the edit loop reaches both.
 *
 * The dialect is a plain SEARCH/REPLACE block that a hosted model can copy by
 * hand from the file content it is shown, and that fails loudly instead of
 * guessing when the quoted text does not match.
 */

export const CODE_EDIT_SYSTEM = `You are Buffy Code, editing an existing multi-file project.

The project is a workspace of files. You receive the file tree and the current contents of the files that matter. Return surgical edits, never a reprint of unchanged code.

EDIT FORMAT — return only these blocks, with no commentary and no Markdown fences:
=== FILE: path/to/file.ext
<<<<<<< SEARCH
exact current lines
=======
replacement lines
>>>>>>> REPLACE

Rules:
- SEARCH is copied character for character from the file above and must appear exactly once. If one line appears twice, include a neighbouring line that makes it unique.
- Replace the smallest span that satisfies the request. Every other line, including indentation, comments and blank lines, stays untouched.
- To add a file, use a CREATE block with the complete file:
=== FILE: styles.css
<<<<<<< CREATE
/* complete file */
>>>>>>> CREATE
- To remove a file, or move one, use a single line and fix the references in the same answer:
=== DELETE: legacy.css
=== RENAME: styles.css -> css/site.css
- Do the whole request in this answer. If it names several changes, send a block for each one; do not stop after the first.
- Never rewrite a whole existing file. A site-wide change is several small blocks, not one big one.
- At most 12 blocks. Do not rename or delete a file unless the request asks for it.
- When you change the page's main heading, update the <title> to match it. A stale title is a wrong page.
- A large project is only partly shown to you. Never guess at text you cannot see: reply with only these lines, and you get the answer in the next message:
=== READ: path/to/file.ext
=== FIND: exact snippet
=== LIST
- Read before you edit when the request names something you were not shown. Do not spend reads on files already in front of you.
- If you are unsure of a real API (a canvas method, a CSS property, a library call), read the reference instead of guessing:
=== FETCH: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
You get that page's text in the next message. One page at a time, official docs first.
- When the work takes more than one step, end with a checklist you will keep true:
=== PLAN
- [x] finished step
- [ ] next step
Repeat the whole list each time, marking what you completed. Keep it under 8 lines, and do not put code in it.
- The preview inlines local assets, so <link rel="stylesheet" href="styles.css"> and <script src="app.js"></script> work with paths relative to the page.
- Do not claim to have tested anything.`

export const CODE_EDIT_MAX_TOKENS = 6_000
export const CODE_EDIT_TIMEOUT_MS = 100_000
export const CODE_EDIT_IDLE_MS = 20_000

/** A request for a different product is not an edit of the current one. */
/** A request that genuinely asks for a removal. Used to police DELETE blocks. */
const DELETE_ASK = /\b(?:delete|remove|drop|get rid of|without|no longer|strip out)\b/i

export const REBUILD_REQUEST =
  /\b(?:from scratch|start over|start again|rebuild|rewrite (?:it|everything|the whole)|brand[ -]?new|different (?:project|site|app|game)|scrap (?:it|this))\b/i

export function codeEditPrompt(
  files: WorkspaceFile[],
  prompt: string,
  plan?: PlanItem[] | null,
  absent?: string[],
): string {
  return `${formatPlan(plan)}${workspaceContext(files, prompt, absent)}\n\nRequested change:\n${prompt}`
}

export function codeEditRepairPrompt(
  files: WorkspaceFile[],
  prompt: string,
  failures: string[],
  plan?: PlanItem[] | null,
  absent?: string[],
): string {
  return `${formatPlan(plan)}${workspaceContext(files, prompt, absent)}\n\nYour previous edit blocks did not apply. Fix exactly these problems and return only the corrected blocks:\n${failures
    .slice(0, 6)
    .map((failure) => `- ${failure}`)
    .join('\n')}\n\nRequested change:\n${prompt}`
}

/** Builds the page a person sees from the files they now have. */
/**
 * The result for a workspace that is not a website: an imported repository
 * with no HTML page. There is nothing to preview, but the files, the changes
 * and the sandbox verdict are what the person needs, so they are rendered as a
 * small receipt. Returning null here used to mean "no result", and the turn
 * answered that by generating a new site over the repository.
 */
export function buildWorkspaceReceipt(
  files: WorkspaceFile[],
  options: {
    title?: string
    label?: string
    changed?: string[]
    interactive?: boolean
    problems?: string[]
    /** Set when the turn could not change the repository at all. */
    warning?: string
  } = {},
): BuildInfo {
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const changed = options.changed ?? []
  const warning = options.warning?.trim()
  const title = options.title?.trim() || 'Project files'
  const rows = files
    .map(
      (file) =>
        `<li><code>${escape(file.path)}</code>${changed.includes(file.path) ? ' <b>· changed</b>' : ''}</li>`,
    )
    .join('')
  // A warning the person cannot read is not a warning: whatever made the
  // receipt amber is listed beside it.
  const problems = options.problems ?? []
  const problemList = problems.length
    ? `<h2>Still to fix</h2><ul class="todo">${problems
        .slice(0, 6)
        .map((problem) => `<li>${escape(problem)}</li>`)
        .join('')}</ul>`
    : ''
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#f6f7f9;color:#14161a}main{max-width:44rem;margin:0 auto;padding:2rem 1.25rem}h1{font-size:1.35rem;margin:0 0 .25rem}h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.04em;color:#5b6472;margin:1.5rem 0 .5rem}p{margin:.25rem 0 1.25rem;color:#5b6472}ul{list-style:none;padding:0;margin:0;display:grid;gap:.35rem}li{background:#fff;border:1px solid #e3e6ea;border-radius:.5rem;padding:.5rem .75rem}ul.todo li{border-left:3px solid #d97706}code{font:13px/1.5 ui-monospace,monospace}b{color:#0b7a3b;font-size:12px;text-transform:uppercase;letter-spacing:.04em}.warn{border-left:3px solid #d97706;padding-left:.75rem;color:#8a4b00}</style></head>
<body><main><h1>${escape(title)}</h1>${
    warning ? `<p class="warn">${escape(warning)}</p>` : ''
  }<p>${files.length} file${files.length === 1 ? '' : 's'} in the workspace${
    changed.length ? `, ${changed.length} changed this turn` : ''
  }.</p><ul>${rows}${problemList}</main></body></html>`
  return {
    status: warning || problems.length ? 'warning' : 'ready',
    kind: 'page',
    title,
    html,
    files,
    ...(options.interactive ? { interactive: true } : {}),
    models: options.label ? [options.label] : [],
    asOf: Date.now(),
    ...(warning ? { reason: warning } : {}),
  }
}

export function buildFromWorkspace(
  files: WorkspaceFile[],
  options: { interactive?: boolean; question?: string; label?: string; repaired?: boolean; problems?: string[] } = {},
): BuildInfo | null {
  const pages = workspacePages(files)
  if (!pages.length) return null
  const verification = verifyPages(pages, { interactive: options.interactive, question: options.question })
  const problems = options.problems ?? []
  const checks = problems.length
    ? [
        ...verification.checks,
        ...problems.map((problem, index) => ({
          id: `code-${index + 1}`,
          label: 'Files are internally consistent',
          status: 'warn' as const,
          detail: problem.slice(0, 240),
        })),
      ]
    : verification.checks
  return {
    status: verification.failures.length || problems.length ? 'warning' : 'ready',
    kind: 'page',
    title: pageTitle(pages[0]!.html),
    html: pages[0]!.html,
    ...(pages.length > 1 ? { pages } : {}),
    files,
    ...(options.interactive ? { interactive: true } : {}),
    models: options.label ? [options.label] : [],
    asOf: Date.now(),
    verification: {
      status: verification.failures.length || problems.length ? 'warning' : 'verified',
      checks,
      repaired: options.repaired ?? false,
      spec: false,
      score: verification.score,
      asOf: Date.now(),
    },
  }
}

function pageTitle(html: string): string {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
  const text = (raw ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 120) || 'Buffy project'
}

export type CodeEditResult = {
  /** `rejected` means the diff applied but made the page checks worse. */
  status: 'applied' | 'rejected' | 'no-change'
  files: WorkspaceFile[]
  report: EditOutcome | null
  /** The model was asked to correct its own rejected block. */
  repaired: boolean
  /** The checklist this turn ended with, when it sent one. */
  plan: PlanItem[] | null
  /** Code-level problems this turn could not fix (broken refs, bad syntax). */
  problems: string[]
}

/**
 * Asks for diff blocks, applies them, and refuses a change that makes the
 * deterministic checks worse. A rejected edit returns the workspace the caller
 * passed in, so callers can fall back to a full build without having to undo
 * anything.
 *
 * A turn is not one shot: an accepted edit whose plan still has open steps
 * continues with the next one, and an edit that introduces broken code gets the
 * problems back for one repair. Both are bounded by the caller's attempt budget.
 */
export async function runCodeEditTurn(input: {
  files: WorkspaceFile[]
  prompt: string
  complete: (messages: ChatMessage[]) => Promise<string>
  /** The checklist from the previous turn, shown so the work does not drift. */
  plan?: PlanItem[] | null
  /**
   * Files that exist in the imported repository but are not in the workspace,
   * named so a missing read cannot be mistaken for a missing file.
   */
  absent?: string[]
  attempts?: number
  /** How many times the turn may stop and ask to see files it was not shown. */
  readRounds?: number
  /** Web reference notes for this request, injected before the first call. */
  research?: string
  /** Reads one public documentation page for the model. */
  fetchDocument?: (url: string) => Promise<string>
  /** How many documentation pages one turn may read. */
  fetchRounds?: number
  /**
   * How many accepted edit rounds one request may take. A request with three
   * steps used to stop after the first one; the plan decides whether there is
   * another step, this bounds how many.
   */
  rounds?: number
  interactive?: boolean
  signal?: AbortSignal
  onStatus?: (text: string) => void | Promise<unknown>
  /** A completion that threw. Callers log it; the turn falls back either way. */
  onError?: (error: unknown) => void
}): Promise<CodeEditResult> {
  const verify = (files: WorkspaceFile[]) =>
    verifyPages(workspacePages(files), { interactive: input.interactive, question: input.prompt })
  const baseline = verify(input.files)
  // A single-use Duck proof cannot make a second call inside one request, so a
  // turn that has no repair budget passes 1. Reading and extra rounds are model
  // calls too, so they follow the same budget.
  const attempts = Math.max(1, input.attempts ?? 2)
  const readRounds = Math.max(0, input.readRounds ?? (attempts > 1 ? 2 : 0))
  const fetchRounds = Math.max(0, input.fetchRounds ?? (attempts > 1 && input.fetchDocument ? 1 : 0))
  const maxRounds = Math.max(1, Math.min(input.rounds ?? (attempts > 1 ? 2 : 1), attempts > 1 ? 4 : 1))

  let current = input.files
  let plan = input.plan ?? null
  let repaired = false
  let attempt = 0
  let reads = 0
  let fetches = 0
  let rounds = 0
  let rejected: EditOutcome | null = null
  let problems: string[] = []
  const merged: EditOutcome = { files: input.files, changed: [], created: [], removed: [], renamed: [], failures: [] }

  const merge = (source: EditOutcome) => {
    merged.changed = [...new Set([...merged.changed, ...source.changed])]
    merged.created = [...new Set([...merged.created, ...source.created])]
    merged.removed = [...new Set([...merged.removed, ...source.removed])]
    merged.renamed = [...merged.renamed, ...source.renamed]
    merged.failures = [...merged.failures, ...source.failures]
  }
  const finish = (): CodeEditResult => {
    if (merged.changed.length || merged.removed.length || merged.renamed.length) {
      return { status: 'applied', files: current, report: { ...merged, files: current }, repaired, plan, problems }
    }
    if (rejected) return { status: 'rejected', files: input.files, report: rejected, repaired, plan, problems }
    return { status: 'no-change', files: input.files, report: null, repaired, plan, problems }
  }

  const research = input.research?.trim() ?? ''
  let request = research
    ? `${research}\n\n${codeEditPrompt(current, input.prompt, plan, input.absent)}`
    : codeEditPrompt(current, input.prompt, plan, input.absent)
  let done = false

  while (rounds < maxRounds && !done && !input.signal?.aborted) {
    let accepted = false
    while (attempt < attempts && !input.signal?.aborted) {
      let raw = ''
      try {
        raw = await input.complete([
          { role: 'system', content: CODE_EDIT_SYSTEM },
          { role: 'user', content: request },
        ])
      } catch (error) {
        input.onError?.(error)
        return finish()
      }
      // A plan block rides along with the answer; it never changes the files.
      const nextPlan = parseWorkspacePlan(raw)
      if (nextPlan) plan = nextPlan
      const parsed = parseWorkspaceEdits(raw)
      let outcome = applyWorkspaceEdits(current, parsed.edits)
      const failures = [...parsed.rejected, ...outcome.failures]
      // A file the request never asked to remove is work, not cleanup. Models
      // reach for DELETE when they mean RENAME, and a silent delete loses the
      // user's stylesheet. Keep the file, and tell the model what to send.
      if (outcome.removed.length && !DELETE_ASK.test(input.prompt)) {
        const keep = outcome.removed.filter((path) => current.some((file) => file.path === path))
        if (keep.length) {
          const restored = current.filter((file) => keep.includes(file.path))
          outcome = {
            ...outcome,
            files: [...outcome.files, ...restored],
            removed: outcome.removed.filter((path) => !keep.includes(path)),
          }
          failures.push(
            `You removed ${keep.join(', ')} but the request did not ask to delete ${keep.length === 1 ? 'that file' : 'those files'}. ${keep.length === 1 ? 'It is' : 'They are'} still in the project. To move a file, send === RENAME: old/path -> new/path; otherwise edit its content.`,
          )
        }
      }
      // `=== DONE` ends the request. It only ends it silently when the answer
      // carries no edit: blocks plus DONE means "this was the last step".
      const stops = parsed.edits.length === 0 && /^=+\s*DONE\s*$/im.test(raw.trim())
      if (stops) {
        done = true
        break
      }
      const last = () => /^=+\s*DONE\s*$/im.test(raw.trim())

      // A removal moves no bytes in a surviving file, so it has to count as a
      // change on its own.
      if (outcome.changed.length || outcome.removed.length || outcome.renamed.length) {
        const candidatePages = workspacePages(outcome.files)
        const candidate = verify(outcome.files)
        // Deleting a page on purpose is not a regression: judge the pages that
        // survive, not the total the project used to have.
        const survivors = new Set(candidatePages.map((page) => page.name))
        const compare =
          outcome.removed.length || outcome.renamed.length
            ? verify(
                input.files.filter((file) => survivors.has(file.path.split('/').pop() ?? file.path)),
              )
            : baseline
        if (!pageCheckImprovement(compare, candidate)) {
          // The diff applies but trades a passing check for a failing one. A
          // full rebuild is the last resort, not the first: give the model its
          // own failing checks back.
          rejected = { ...outcome, failures }
          if (attempt + 1 < attempts) {
            attempt += 1
            repaired = true
            await input.onStatus?.('That edit made the page checks worse — asking for a fix…')
            request = codeEditRepairPrompt(
              current,
              input.prompt,
              [
                `Your edit applied but made the page checks worse (score ${compare.score} → ${candidate.score}).`,
                ...(candidate.failures.length ? candidate.failures : ['Every check it broke was passing before.']),
              ],
              plan,
              input.absent,
            )
            continue
          }
          break
        }

        // The page scores the same, but the code can still be broken in ways a
        // rendered document cannot show: an unclosed tag, a script that does
        // not parse, a link to a file that is not there. That is what a compiler
        // catches for a person, so it gets one repair turn.
        // A good edit is never thrown away over these: accept it, then spend
        // one call trying to clean it up. Whatever happens, the caller keeps
        // the work and sees the remaining problems.
        const introduced = newWorkspaceProblems(current, outcome.files)
        problems = introduced
        merge(outcome)
        current = outcome.files
        accepted = true
        rounds += 1
        if (last()) done = true
        if (introduced.length && attempt + 1 < attempts) {
          attempt += 1
          repaired = true
          await input.onStatus?.('Checking the files it just wrote…')
          request = codeEditRepairPrompt(
            current,
            input.prompt,
            ['The page passes its checks, but the files themselves have these problems:', ...introduced],
            plan,
            input.absent,
          )
          continue
        }
        break
      }

      // No edit blocks: the model may be asking to see text that was not shown,
      // or to read a page of documentation before writing an API it is unsure of.
      const asks = parseWorkspaceRequests(raw)
      const wanted = asks.filter((ask) => ask.kind === 'fetch')
      if (wanted.length && input.fetchDocument && fetches < fetchRounds) {
        fetches += 1
        const url = wanted[0]!.url
        await input.onStatus?.('Reading the documentation it asked for…')
        const document = await input
          .fetchDocument(url)
          .catch((error: unknown) =>
            `Could not read ${url}: ${error instanceof Error ? error.message : String(error)}. Use what the workspace already shows.`,
          )
        request = `${formatPlan(plan)}${document}\n\nThe workspace tree:\n${workspaceTree(
          current,
        )}\n\nRequested change:\n${input.prompt}\n\nNow return only the edit blocks.`
        continue
      }
      const fileAsks = asks.filter((ask) => ask.kind !== 'fetch')
      if (fileAsks.length && reads < readRounds) {
        reads += 1
        await input.onStatus?.(
          fileAsks.length === 1 ? 'Reading the file it asked for…' : `Reading ${fileAsks.length} requested files…`,
        )
        request = `${formatPlan(plan)}Requested context:\n\n${workspaceReadResults(
          current,
          fileAsks,
          undefined,
          input.absent,
        )}\n\nThe workspace tree:\n${workspaceTree(
          current,
        )}\n\nRequested change:\n${input.prompt}\n\nNow return only the edit blocks.`
        continue
      }

      // Only promise a correction when the caller granted the attempt.
      if (attempt + 1 < attempts && failures.length) {
        attempt += 1
        repaired = true
        await input.onStatus?.('That edit did not apply — asking for a corrected diff…')
        request = codeEditRepairPrompt(current, input.prompt, failures, plan, input.absent)
        continue
      }
      break
    }

    if (!accepted) break
    // The plan is what decides there is more to do. A request that names three
    // changes should not end after the first one just because it applied.
    const next = plan?.find((item) => !item.done)
    if (!next || rounds >= maxRounds || done) break
    await input.onStatus?.(`Step ${rounds + 1}: ${next.text}`)
    request = `${formatPlan(plan)}${workspaceContext(current, input.prompt, input.absent)}\n\nRequested change:\n${
      input.prompt
    }\n\nNext step: ${next.text}\nDo only that step and return its edit blocks with the updated plan. If the whole request is already complete, reply with exactly:\n=== DONE`
  }

  return finish()
}
