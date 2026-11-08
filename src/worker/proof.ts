// Proof is the free-model quality gate: a small, deterministic contract, one
// candidate artifact (plus a second where execution can choose between them),
// and checks that are written independently of the candidate. Code is checked
// by tests the solver never sees, and those tests must first reject a set of
// deliberately wrong implementations. The Worker never runs generated code.
//
// The honest boundary is deliberate: arithmetic is recomputed, current sources
// are date-checked, and format is counted. Subjective writing gets an explicit
// "unverified", never a confidence score.

import { MAX_OUTPUT_TOKENS } from '../shared/config'
import type { ChatMessage, StreamPiece } from './ai'
import { activeLanes, laneKey, laneStrength, laneText, type LaneResult, type PublicLane } from './public-ai'
import type { SearchResult } from './search'
import type {
  ProofCheck,
  ProofInfo,
  ProofJob,
  ProofKind,
  ProofRunReport,
  ProofStatus,
} from '../shared/types'

type Status = (text: string) => Promise<unknown> | unknown

export type ProofInput = {
  lanes: PublicLane[]
  messages: ChatMessage[]
  question: string
  results: SearchResult[]
  signal?: AbortSignal
  onStatus?: Status
  onLaneResult?: (result: LaneResult) => void
  /** Previously verified answers, already owner-scoped by the caller. */
  library?: string[]
}

export type ProofOutcome = {
  text: string
  proof: ProofInfo
  /** Present only for code that still needs a browser run. */
  job?: ProofJob
  models: string[]
}

type Contract = {
  kind: ProofKind
  asOf: string
  freshnessDays: number | null
  wordLimit: number | null
  exactCount: number | null
  sourceCount: number | null
  budget: number | null
  sql: boolean
  requirements: { id: string; text: string; critical: boolean }[]
}

const TODAY = () => new Date().toISOString().slice(0, 10)
const CURRENT =
  /\b(latest|newest|today|tonight|this (?:week|month|year)|current(?:ly)?|right now|recent(?:ly)?|news|updates?|releases?|released|launch(?:ed|es)?|announc(?:e|ed|es|ement)|prices?|pricing|costs?|who won|as of|202[5-9])\b/i
const SQL = /\b(select|insert|update|delete)\b[\s\S]{0,500}\b(from|into|set)\b/i
const SQL_INTENT = /\b(database query|sql\b|query that returns|table called)\b/i
const CODE = /```|\bpython\b|\bprogram\b|\bscript\b/i

const WORD_NUMBER: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

/** The check family for a request. Deterministic; never a model call. */
export function kindFor(question: string): ProofKind {
  const text = question.toLowerCase()
  if (SQL.test(question) || SQL_INTENT.test(text)) return 'structured'
  if (CODE.test(text) && /\b(program|script|function|python|code)\b/.test(text)) return 'code'
  // Only an explicit source or recency cue makes this research. A price in a
  // discount calculation is arithmetic, not a pricing lookup.
  if (/\b(cite|sources?|studies|study|latest|newest|current(?:ly)?|news|who won|as of|hands-on review|recent (?:human )?studies)\b/.test(text)) return 'research'
  if (/\b(price|cost|pay|total|average|speed|percent|discount|recipe|calculate|how much|how many)\b/.test(text) && /\d/.test(text)) return 'math'
  if (/\b(exactly|steps?|list|plan|budget|schedule|words?)\b/.test(text) && /\d/.test(text)) return 'structured'
  return 'general'
}

function numberWord(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : (WORD_NUMBER[value] ?? null)
}

/** Turns the request into the requirements the checks are allowed to enforce. */
export function buildContract(question: string): Contract {
  const kind = kindFor(question)
  const text = question.toLowerCase()
  const wordMatch = text.match(/under\s+(\d+)\s+words?/) ?? text.match(/\ba\s+(\d+)-word\b/)
  const countMatch =
    text.match(/exactly\s+(\d+)/) ??
    text.match(/\b(?:the\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:most|things|causes|changes|steps|examples|reasons|features|parts|sections|sources|people)\b/)
  const citeMatch = text.match(/\bcite\s+(one|two|three|1|2|3)\b/)
  const budgetMatch =
    text.match(/\bi have\s+\$([\d,]+)/) ??
    text.match(/(?:budget|under|total|spend)[^$]{0,24}\$([\d,]+)/) ??
    text.match(/\$([\d,]+)[^.]{0,24}\b(?:budget|total|altogether)\b/)
  const freshnessDays = CURRENT.test(text) ? (/\b(latest|newest|released|launch(?:ed)?)\b/.test(text) ? 180 : 365) : null
  const wordLimit = wordMatch ? Number(wordMatch[1]) : null
  const exactCount = countMatch ? numberWord(countMatch[1] ?? '') : null
  const sourceCount = citeMatch ? numberWord(citeMatch[1] ?? '') : /\bsources?\b/.test(text) ? 1 : null
  const budget = budgetMatch ? Number((budgetMatch[1] ?? '').replace(/,/g, '')) : null

  const requirements: Contract['requirements'] = []
  if (kind === 'code') {
    requirements.push(
      { id: 'tests', text: 'Independent tests pass on the program', critical: true },
      { id: 'mutants', text: 'The tests reject deliberately wrong programs', critical: true },
    )
  }
  if (kind === 'research') {
    requirements.push(
      { id: 'sources', text: 'Every cited page came from the retrieved sources', critical: true },
      ...(freshnessDays ? [{ id: 'freshness', text: `The newest cited source is inside ${freshnessDays} days`, critical: true }] : []),
      ...(sourceCount ? [{ id: 'count', text: `At least ${sourceCount} source${sourceCount === 1 ? '' : 's'} are cited`, critical: true }] : []),
    )
  }
  if (kind === 'math') requirements.push({ id: 'arithmetic', text: 'The stated arithmetic recomputes', critical: true })
  if (kind === 'structured') {
    if (wordLimit) requirements.push({ id: 'word-limit', text: `At most ${wordLimit} words`, critical: true })
    if (exactCount) requirements.push({ id: 'count', text: `Exactly ${exactCount} required items`, critical: false })
    if (sourceCount) requirements.push({ id: 'count', text: `At least ${sourceCount} cited source${sourceCount === 1 ? '' : 's'}`, critical: true })
    if (budget) requirements.push({ id: 'budget', text: `The total stays at or under $${budget}`, critical: true })
    if (SQL.test(question) || SQL_INTENT.test(text)) requirements.push({ id: 'sql', text: 'The query selects, filters, groups, filters groups and sorts', critical: true })
  }
  if (!requirements.length) requirements.push({ id: 'format', text: 'The requested shape is present', critical: false })

  return { kind, asOf: TODAY(), freshnessDays, wordLimit, exactCount, sourceCount, budget, sql: SQL.test(question) || SQL_INTENT.test(text), requirements }
}

const check = (id: string, label: string, status: ProofCheck['status'], critical: boolean, detail?: string): ProofCheck => ({
  id,
  label,
  status,
  critical,
  ...(detail ? { detail } : {}),
})

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const listItems = (text: string) => (text.match(/^\s*(?:[-*]|\d+[.)])\s+\S/gm) ?? []).length
const citedUrls = (text: string) => [...new Set([...text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]!))]

function normalUrl(raw: string): string {
  try {
    const url = new URL(raw)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`.toLowerCase()
  } catch {
    return raw.toLowerCase()
  }
}

/** A date visible in a snippet: ISO, a year, or a month name with a year. */
function dateIn(text: string): number | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const month = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(20\d{2})\b/i)
  if (month) return Date.parse(`${month[1]} ${month[2]}`)
  const year = text.match(/\b(20\d{2})\b/)
  if (year) return Date.UTC(Number(year[1]), 0, 1)
  return null
}

function formatChecks(contract: Contract, text: string): ProofCheck[] {
  const checks: ProofCheck[] = []
  if (contract.wordLimit) {
    const words = countWords(text)
    checks.push(check('word-limit', `Word limit (${words}/${contract.wordLimit})`, words <= contract.wordLimit ? 'pass' : 'fail', true))
  }
  if (contract.exactCount) {
    const items = listItems(text)
    checks.push(
      items === 0
        ? check('count', `Exactly ${contract.exactCount} numbered or bulleted items`, 'unknown', false, 'No list was found to count.')
        : check('count', `Exactly ${contract.exactCount} items (found ${items})`, items === contract.exactCount ? 'pass' : 'fail', false),
    )
  }
  if (contract.sourceCount) {
    const cited = citedUrls(text).length
    checks.push(check('sources', `Cited sources (${cited}/${contract.sourceCount})`, cited >= contract.sourceCount ? 'pass' : 'fail', true))
  }
  if (contract.budget !== null) {
    const total = [...text.matchAll(/\btotal[^$\n]{0,30}\$([\d,]+(?:\.\d+)?)/gi)].at(-1)?.[1]
    if (!total) checks.push(check('budget', `Total stays at or under $${contract.budget}`, 'unknown', true, 'No stated total was found to check.'))
    else {
      const value = Number(total.replace(/,/g, ''))
      checks.push(check('budget', `Total $${value} vs $${contract.budget}`, value <= contract.budget ? 'pass' : 'fail', true))
    }
  }
  if (contract.sql) {
    const required: [string, RegExp][] = [
      ['select', /\bselect\b/i],
      ['from', /\bfrom\b/i],
      ['filter to 2025', /\b20\d{2}\b/],
      ['group by', /\bgroup\s+by\b/i],
      ['sum', /\bsum\s*\(/i],
      ['having', /\bhaving\b/i],
      ['descending order', /\border\s+by\b[\s\S]{0,80}\bdesc\b/i],
    ]
    const missing = required.filter(([, pattern]) => !pattern.test(text)).map(([name]) => name)
    checks.push(check('sql', 'Query shape', missing.length ? 'fail' : 'pass', true, missing.length ? `Missing: ${missing.join(', ')}` : 'All required clauses are present.'))
  }
  return checks
}

function researchChecks(contract: Contract, text: string, results: SearchResult[]): ProofCheck[] {
  const checks: ProofCheck[] = []
  const cited = citedUrls(text)
  const retrieved = new Set(results.map((result) => normalUrl(result.url)))
  const matched = results.filter((result) => cited.some((url) => normalUrl(url) === normalUrl(result.url)))
  if (!cited.length) {
    checks.push(check('sources', 'The answer cites its sources', 'fail', true, 'No links were cited.'))
  } else {
    const outside = cited.filter((url) => !retrieved.has(normalUrl(url)))
    checks.push(
      outside.length
        ? check('sources', 'Every cited page came from this search', 'fail', true, `${outside.length} cited page${outside.length === 1 ? ' was' : 's were'} not in the retrieved results.`)
        : check('sources', 'Every cited page came from this search', 'pass', true),
    )
  }
  if (contract.freshnessDays) {
    const dates = matched.map((result) => dateIn(`${result.title} ${result.snippet}`)).filter((date): date is number => date !== null)
    if (!dates.length) {
      checks.push(check('freshness', 'The newest cited source is current', 'unknown', true, 'The cited pages did not expose a date.'))
    } else {
      const newest = Math.max(...dates)
      const cutoff = Date.now() - contract.freshnessDays * 86_400_000
      checks.push(
        check(
          'freshness',
          'The newest cited source is current',
          newest >= cutoff ? 'pass' : 'fail',
          true,
          newest >= cutoff ? 'Inside the freshness window.' : `The newest dated source is from ${new Date(newest).toISOString().slice(0, 10)}.`,
        ),
      )
    }
  }
  return checks
}

const EQUATION = /(\$?\d[\d,]*(?:\.\d+)?)\s*([+\-*/x])\s*(\$?\d[\d,]*(?:\.\d+)?)\s*=\s*(\$?\d[\d,]*(?:\.\d+)?)/g
const PERCENT = /(\d+(?:\.\d+)?)\s*%\s*of\s+\$?(\d[\d,]*(?:\.\d+)?)\s*(?:=|is)\s*\$?(\d[\d,]*(?:\.\d+)?)(?!\d|\.\d)(?=\s*(?:$|[.,;)]))/gm

/** Recomputes arithmetic the answer actually states. A pass is not a proof of the plan. */
function mathChecks(text: string): ProofCheck[] {
  const normalized = text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[×✕✖]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\u00a0/g, ' ')
  const equations: { left: number; right: number }[] = []
  const startsExpression = (index: number) => {
    const before = normalized.slice(0, index).trimEnd().slice(-1)
    return !before || !/[+\-*/x×÷]/.test(before)
  }
  for (const match of normalized.matchAll(EQUATION)) {
    if (!startsExpression(match.index ?? 0)) continue
    const a = Number((match[1] ?? '').replace(/[$,]/g, ''))
    const b = Number((match[3] ?? '').replace(/[$,]/g, ''))
    const stated = Number((match[4] ?? '').replace(/[$,]/g, ''))
    const op = match[2]
    const value = op === '+' ? a + b : op === '-' ? a - b : op === '/' ? a / b : a * b
    equations.push({ left: value, right: stated })
  }
  for (const match of normalized.matchAll(PERCENT)) {
    if (!startsExpression(match.index ?? 0)) continue
    const percent = Number(match[1])
    const of = Number((match[2] ?? '').replace(/[$,]/g, ''))
    const stated = Number((match[3] ?? '').replace(/[$,]/g, ''))
    equations.push({ left: (percent / 100) * of, right: stated })
  }
  if (!equations.length) return [check('arithmetic', 'The stated arithmetic recomputes', 'unknown', true, 'No explicit equation was found.')]
  const wrong = equations.filter((equation) => Math.abs(equation.left - equation.right) > 0.011)
  return [
    check(
      'arithmetic',
      `The stated arithmetic recomputes (${equations.length - wrong.length}/${equations.length})`,
      wrong.length ? 'fail' : 'pass',
      true,
      wrong.length ? `First mismatch: ${wrong[0]!.left.toFixed(2)} was written as ${wrong[0]!.right.toFixed(2)}.` : 'Every stated equation is correct.',
    ),
  ]
}

function statusFor(kind: ProofKind, checks: ProofCheck[]): ProofStatus {
  if (checks.some((item) => item.critical && item.status === 'fail')) return 'failed'
  if (checks.some((item) => item.critical && item.status === 'unknown')) return 'unverified'
  if (kind === 'general') return 'unverified'
  // Format checks are real but do not prove the content. Structured work is
  // reported as checked, never as verified.
  if (kind === 'structured') return 'warning'
  if (checks.some((item) => item.status !== 'pass')) return 'warning'
  return 'verified'
}

function baseInfo(kind: ProofKind, checks: ProofCheck[], models: string[], candidates: number, attempts: number, mutants: ProofInfo['mutants']): ProofInfo {
  return {
    status: statusFor(kind, checks),
    kind,
    checks,
    attempts,
    candidates,
    mutants,
    models,
    asOf: Date.now(),
  }
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)

function jsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Tag-delimited code survives model prose and embedded braces better than JSON. */
function tagged(text: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi')
  return [...text.matchAll(pattern)].map((match) => (match[1] ?? '').trim()).filter(Boolean)
}

function fencedPython(text: string): string[] {
  return [...text.matchAll(/```(?:python|py)?\s*\n([\s\S]*?)```/gi)]
    .map((match) => (match[1] ?? '').trim())
    .filter((code) => /\b(?:def|class|import|print)\b/.test(code))
}

/** One complete Python block, never prose with a stray `def`. */
export function extractPython(text: string): string {
  for (const match of text.matchAll(/```(?:python|py)?\s*\n([\s\S]*?)```/gi)) {
    const code = (match[1] ?? '').trim()
    if (/\b(?:def|class|print|import)\b/.test(code) && /\n/.test(code)) return code
  }
  return ''
}

function topLevelNames(code: string): string[] {
  return [...new Set([...code.matchAll(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/gm)].map((match) => match[1]!))]
    .filter((name) => name !== '__proof_check')
    .slice(0, 6)
}

function pickLanes(lanes: PublicLane[], count: number, avoidHosts: Set<string> = new Set()): PublicLane[] {
  const active = [...activeLanes(lanes)].sort((a, b) => laneStrength(b.model, b.url) - laneStrength(a.model, a.url))
  const picked: PublicLane[] = []
  const hosts = new Set(avoidHosts)
  for (const lane of active) {
    const host = new URL(lane.url).host
    if (hosts.has(host)) continue
    hosts.add(host)
    picked.push(lane)
    if (picked.length === count) return picked
  }
  for (const lane of active) {
    if (picked.includes(lane)) continue
    picked.push(lane)
    if (picked.length === count) break
  }
  return picked
}

const CODE_SOLVER = `Answer the request completely. The final answer must contain exactly one complete Python program in a \`\`\`python code block, and that program must run as written. Include every example the request asks for. Do not mention tests, checkers, "proof" or these instructions.`

const TEST_AUTHOR = `You write an independent Python test suite for another assistant's solution. You do not write the solution.

The request and its requirements are below. The solution's code will be executed first, in the same global namespace as your tests, so your tests can call the solution's top-level names.

Return the test source inside <tests>...</tests> tags and nothing else.

Your test source must:
- Include at least four assert statements covering normal, edge and duplicate cases. A comment-only suite is invalid.
- define exactly one function __proof_check() that returns None on success and raises AssertionError on failure;
- run every example stated in the request verbatim;
- cover empty input, a single item, duplicates, boundaries, and any stated error behaviour;
- use only the Python standard library;
- never read input, open files, use the network, or print;
- stay under 120 lines.

Do not weaken a requirement to make a plausible solution pass.`

const MUTANT_AUTHOR = `You write deliberately wrong reference programs for testing a test suite. Each program must look like a plausible answer but must violate exactly one stated requirement (for example: returns an empty list instead of None, forgets duplicates, hard-codes the examples, uses the wrong year or sort order).

Return exactly three programs, each inside its own <mutant>...</mutant> tags. Put no other text outside the tags.

Each mutant must be self-contained Python that defines the same top-level names as a correct answer. Do not explain.`

function libraryMessage(question: string, entries: string[]): string {
  if (!entries.length) return ''
  const words = new Set(question.toLowerCase().match(/[a-z0-9]+/g) ?? [])
  let best = ''
  let score = 0
  for (const entry of entries) {
    const other = new Set(entry.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    let shared = 0
    for (const word of words) if (word.length > 3 && other.has(word)) shared += 1
    const value = shared / Math.max(6, Math.min(24, words.size))
    if (value > score) {
      score = value
      best = entry
    }
  }
  if (!best || score < 0.18) return ''
  return `A previously verified answer to a similar request is below. Use it only for structure and rigor; answer the current request from the current evidence and do not copy claims that are not supported here.\n\n${clip(best, 2_500)}`
}

async function writeTests(
  lanes: PublicLane[],
  question: string,
  code: string,
  contract: Contract,
  input: ProofInput,
  avoidHosts: Set<string> = new Set(),
): Promise<string> {
  const names = topLevelNames(code)
  const requirements = contract.requirements.map((item) => `- ${item.text}`).join('\n')
  for (const lane of pickLanes(lanes, 2, avoidHosts)) {
    try {
      const reply = await laneText(lane, {
        messages: [
          { role: 'system', content: TEST_AUTHOR },
          {
            role: 'user',
            content: [
              `REQUEST:\n${clip(question, 3_000)}`,
              `REQUIREMENTS:\n${requirements}`,
              `The candidate defines these top-level names: ${names.join(', ') || '(none; the program may run directly)'}.`,
              'Write the tests now.',
            ].join('\n\n'),
          },
        ],
        signal: input.signal,
        temperature: 0.2,
        maxTokens: 2_200,
        onLaneResult: input.onLaneResult,
      })
      const direct = tagged(reply, 'tests')[0]
      const fromJson = typeof jsonObject(reply)?.tests === 'string' ? String(jsonObject(reply)!.tests) : ''
      const fallback = fencedPython(reply).find((codeBlock) => codeBlock.includes('__proof_check')) ?? ''
      const tests = (direct || fromJson || fallback).trim()
      const assertions = (tests.match(/^\s*assert\b/gm) ?? []).length
      if (tests.includes('__proof_check') && tests.length >= 250 && assertions >= 2) {
        console.log('proof.tests', { lane: lane.label, chars: tests.length, assertions })
        return clip(tests, 8_000)
      }
      console.log('proof.tests.rejected', { lane: lane.label, chars: tests.length, assertions })
    } catch {
      // Try the next independent lane.
    }
  }
  return ''
}

const MUTANT_EDITS: Array<[RegExp, string]> = [
  [/\[\s*:\s*2\s*\]/g, '[:1]'],
  [/\[\s*:\s*1\s*\]/g, '[:0]'],
  [/\breverse\s*=\s*True\b/g, 'reverse=False'],
  [/\breverse\s*=\s*False\b/g, 'reverse=True'],
  [/\bmax\s*\(/g, 'min('],
  [/\bmin\s*\(/g, 'max('],
  [/len\s*\(([^)]*)\)\s*<\s*2/g, 'len($1) < 1'],
  [/len\s*\(([^)]*)\)\s*<=\s*2/g, 'len($1) <= 1'],
  [/\breturn\s+None\b/g, 'return []'],
  [/\breturn\s+\[\]\b/g, 'return None'],
  [/\bif\s+not\s+/g, 'if '],
  [/>=/g, '>'],
  [/<=/g, '<'],
]

/** Wrong programs independent of the tests, derived from the candidate by one edit. */
function deriveMutants(code: string): string[] {
  const found: string[] = []
  for (const [pattern, replacement] of MUTANT_EDITS) {
    const next = code.replace(pattern, replacement)
    if (next !== code && !found.includes(next)) found.push(clip(next, 4_000))
    if (found.length >= 3) break
  }
  return found
}

async function writeMutants(
  code: string,
  lanes: PublicLane[],
  question: string,
  input: ProofInput,
  avoidHosts: Set<string> = new Set(),
): Promise<string[]> {
  const names = topLevelNames(code)
  const usable = (source: string) =>
    source.length >= 40 &&
    /\b(?:def|class)\s+\w+/.test(source) &&
    names.every((name) => new RegExp(`\\b${name}\\b`).test(source))
  const model: string[] = []
  const lane = pickLanes(lanes, 1, avoidHosts)[0]
  if (lane) {
    try {
      const reply = await laneText(lane, {
        messages: [
          { role: 'system', content: MUTANT_AUTHOR },
          { role: 'user', content: `REQUEST:\n${clip(question, 2_500)}\n\nWrite three wrong programs now.` },
        ],
        signal: input.signal,
        temperature: 0.8,
        maxTokens: 2_800,
        onLaneResult: input.onLaneResult,
      })
      const direct = tagged(reply, 'mutant')
      const fromJson = jsonObject(reply)?.mutants
      const list = direct.length
        ? direct
        : Array.isArray(fromJson)
          ? fromJson.filter((item): item is string => typeof item === 'string')
          : fencedPython(reply)
      for (const mutant of list) {
        const next = mutant.trim()
        if (usable(next) && !model.includes(next)) model.push(clip(next, 4_000))
        if (model.length >= 3) break
      }
      if (!model.length) console.log('proof.mutants.raw', { lane: lane.label, chars: reply.length, head: reply.slice(0, 240) })
    } catch {
      // The derived mutants below still exercise the suite.
    }
  }
  const derived = deriveMutants(code).filter(usable)
  // Prefer the deterministic edits; a model's plausible-looking placeholder is
  // worse than an edit we know still defines the candidate's API.
  const found = [...new Set([...derived.slice(0, 2), ...model])].slice(0, 3)
  console.log('proof.mutants', { model: model.length, derived: derived.length, total: found.length })
  return found
}

async function solveCode(lanes: PublicLane[], input: ProofInput, count: number): Promise<{ lane: PublicLane; text: string; code: string }[]> {
  const solvers = pickLanes(lanes, count)
  if (!solvers.length) return []
  const settled = await Promise.allSettled(
    solvers.map(async (lane) => {
      const text = await laneText(lane, {
        messages: [{ role: 'system', content: CODE_SOLVER }, ...input.messages],
        signal: input.signal,
        temperature: 0.35,
        maxTokens: MAX_OUTPUT_TOKENS,
        onLaneResult: input.onLaneResult,
      })
      return { lane, text, code: extractPython(text) }
    }),
  )
  return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
}

/**
 * Runs Proof for one turn. Code returns a job for the browser; everything else
 * is checked here and returns a finished proof record.
 */
export async function proofComplete(input: ProofInput): Promise<ProofOutcome> {
  const contract = buildContract(input.question)
  const library = libraryMessage(input.question, input.library ?? [])
  const messages: ChatMessage[] = library
    ? [{ role: 'system', content: library }, ...input.messages]
    : input.messages

  if (contract.kind === 'code') {
    await input.onStatus?.('Two free models are writing independent programs…')
    const candidates = await solveCode(input.lanes, { ...input, messages }, 2)
    const runnable = candidates.filter((candidate) => candidate.code)
    if (!runnable.length) {
      const proof: ProofInfo = {
        status: 'failed',
        kind: 'code',
        checks: [check('code', 'A runnable Python block', 'fail', true, 'No complete fenced Python program was returned.')],
        attempts: 1,
        candidates: candidates.length,
        mutants: null,
        models: candidates.map((candidate) => candidate.lane.label),
        asOf: Date.now(),
        reason: 'no runnable program',
      }
      return { text: candidates[0]?.text ?? '', proof, models: proof.models }
    }

    const testLane = pickLanes(input.lanes, 1)[0]
    const testHost = testLane ? new URL(testLane.url).host : ''
    const mutantLane = pickLanes(input.lanes, 1, new Set([testHost]))[0]
    await input.onStatus?.('Independent tests and wrong programs are being prepared…')
    const [tests, mutants] = await Promise.all([
      writeTests(input.lanes, input.question, runnable[0]!.code, contract, input),
      writeMutants(runnable[0]!.code, input.lanes, input.question, input, new Set([testHost])),
    ])
    if (!tests) {
      const proof: ProofInfo = {
        status: 'unverified',
        kind: 'code',
        checks: [check('tests', 'Independent tests could not be written', 'unknown', true)],
        attempts: 1,
        candidates: runnable.length,
        mutants: null,
        models: runnable.map((candidate) => candidate.lane.label),
        asOf: Date.now(),
        reason: 'test author unavailable',
      }
      return { text: runnable[0]!.text, proof, models: proof.models }
    }

    const models = [...new Set([...runnable.map((candidate) => candidate.lane.label), ...(testLane ? [testLane.label] : []), ...(mutantLane ? [mutantLane.label] : [])])]
    if (mutants.length < 1) {
      const proof: ProofInfo = {
        status: 'unverified',
        kind: 'code',
        checks: [
          check('tests', 'Independent tests are ready', 'pass', true),
          check('mutants', 'The tests were checked against wrong programs', 'unknown', true, 'No mutants could be generated, so a pass would not mean much.'),
        ],
        attempts: 1,
        candidates: runnable.length,
        mutants: { total: mutants.length, killed: 0 },
        models,
        asOf: Date.now(),
        reason: 'tests were not validated',
      }
      return { text: runnable[0]!.text, proof, models }
    }

    const job: ProofJob = {
      messageId: '',
      round: 1,
      question: input.question,
      tests,
      candidates: runnable.map((candidate) => ({ label: candidate.lane.label, code: candidate.code, text: candidate.text })),
      mutants,
      models,
    }
    const proof: ProofInfo = {
      status: 'checking',
      kind: 'code',
      checks: [
        check('tests', 'Independent tests run', 'unknown', true, 'Waiting for the browser runner.'),
        check('mutants', 'The tests reject wrong programs', 'unknown', true, 'Waiting for the browser runner.'),
      ],
      attempts: 1,
      candidates: runnable.length,
      mutants: { total: mutants.length, killed: 0 },
      models,
      asOf: Date.now(),
    }
    return { text: runnable[0]!.text, proof, job, models }
  }

  await input.onStatus?.('A free model is writing the answer…')
  const lane = pickLanes(input.lanes, 1)[0]
  if (!lane) {
    const proof = baseInfo(contract.kind, [check('answer', 'A free model answered', 'unknown', true)], [], 0, 1, null)
    return { text: '', proof, models: [] }
  }
  let text = ''
  try {
    text = await laneText(lane, {
      messages,
      signal: input.signal,
      temperature: 0.3,
      maxTokens: MAX_OUTPUT_TOKENS,
      onLaneResult: input.onLaneResult,
    })
  } catch {
    const proof = baseInfo(contract.kind, [check('answer', 'A free model answered', 'unknown', true)], [lane.label], 0, 1, null)
    return { text: '', proof, models: [lane.label] }
  }

  const checks: ProofCheck[] =
    contract.kind === 'research'
      ? [...researchChecks(contract, text, input.results), ...formatChecks(contract, text)]
      : contract.kind === 'math'
        ? mathChecks(text)
        : formatChecks(contract, text)
  const proof = baseInfo(contract.kind, checks, [lane.label], 1, 1, null)
  return { text, proof, models: [lane.label] }
}

/** Reads a browser report without trusting its size or shape. */
export function sanitizeReport(value: unknown): ProofRunReport {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const runs = Array.isArray(row.runs)
    ? row.runs.slice(0, 24).flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const run = item as Record<string, unknown>
        if ((run.target !== 'candidate' && run.target !== 'mutant') || typeof run.index !== 'number') return []
        const target: 'candidate' | 'mutant' = run.target
        return [{
          target,
          index: Math.max(0, Math.min(7, Math.floor(run.index))),
          ok: run.ok === true,
          ...(typeof run.error === 'string' && run.error ? { error: run.error.slice(0, 400) } : {}),
        }]
      })
    : []
  return {
    runs,
    ...(typeof row.loadError === 'string' && row.loadError ? { loadError: row.loadError.slice(0, 300) } : {}),
  }
}

const INVALID_MUTANT = /^(?:SyntaxError|IndentationError|TabError)\b/i

/** The server-side verdict. The browser only reports what ran. */
export function judgeReport(job: ProofJob, report: ProofRunReport): { info: ProofInfo; passing: number[]; suiteTrusted: boolean } {
  const candidateRuns = job.candidates.map((_, index) => report.runs.find((run) => run.target === 'candidate' && run.index === index))
  const passing = candidateRuns.flatMap((run, index) => (run?.ok ? [index] : []))
  const mutantRuns = job.mutants.map((_, index) => report.runs.find((run) => run.target === 'mutant' && run.index === index))
  // A mutant that cannot even parse is not evidence about the assertions.
  const usable = mutantRuns.flatMap((run, index) => {
    const source = job.mutants[index] ?? ''
    if (source.length < 40 || !/\b(?:def|class)\s+\w+/.test(source)) return []
    return run && INVALID_MUTANT.test(run.error ?? '') ? [] : [index]
  })
  const killed = usable.filter((index) => {
    const run = mutantRuns[index]
    return run && !run.ok
  }).length
  const assertions = (job.tests.match(/^\s*assert\b/gm) ?? []).length
  const suiteTrusted = !report.loadError && assertions >= 2 && usable.length > 0 && killed === usable.length
  const failedCandidates = candidateRuns.filter((run) => run && !run.ok)
  const firstFailure = failedCandidates.find((run) => run?.error)?.error

  const checks: ProofCheck[] = [
    check(
      'assertions',
      'The tests assert expected behavior',
      assertions >= 2 ? 'pass' : 'fail',
      true,
      assertions >= 2 ? `${assertions} assertions` : 'The suite has fewer than two assertions.',
    ),
    check(
      'tests',
      `Independent tests (${passing.length}/${job.candidates.length} candidates passed)`,
      candidateRuns.some((run) => run) ? (passing.length ? 'pass' : 'fail') : 'unknown',
      true,
      firstFailure ? clip(firstFailure.replace(/\s+/g, ' '), 240) : undefined,
    ),
    check(
      'mutants',
      `Tests reject wrong programs (${killed}/${usable.length})`,
      suiteTrusted ? 'pass' : 'fail',
      true,
      suiteTrusted
        ? 'Every mutant was rejected.'
        : usable.length === 0
          ? 'No usable wrong programs were supplied.'
          : 'A wrong program passed the tests, so the tests cannot be trusted.',
    ),
  ]

  let status: ProofStatus
  let reason: string | undefined
  if (report.loadError) {
    status = 'unverified'
    reason = 'code runner unavailable'
  } else if (!suiteTrusted) {
    status = 'unverified'
    reason = assertions < 2 ? 'tests have no assertions' : 'tests could not reject wrong code'
  } else if (passing.length) {
    status = 'verified'
  } else {
    status = 'failed'
    reason = 'tests failed'
  }

  return {
    info: {
      status,
      kind: 'code',
      checks,
      attempts: job.round,
      candidates: job.candidates.length,
      mutants: { total: usable.length, killed },
      models: job.models,
      asOf: Date.now(),
      ...(reason ? { reason } : {}),
    },
    passing,
    suiteTrusted,
  }
}

/** One bounded repair with the exact failing output. */
export async function repairCode(input: {
  lanes: PublicLane[]
  question: string
  candidate: string
  failures: string[]
  signal?: AbortSignal
  onLaneResult?: (result: LaneResult) => void
}): Promise<{ text: string; code: string } | null> {
  const lane = pickLanes(input.lanes, 1)[0]
  if (!lane) return null
  const failures = input.failures.filter(Boolean).slice(0, 4).map((failure) => `- ${clip(failure.replace(/\s+/g, ' '), 300)}`).join('\n')
  try {
    const text = await laneText(lane, {
      messages: [
        { role: 'system', content: CODE_SOLVER },
        { role: 'user', content: `REQUEST:\n${clip(input.question, 2_500)}\n\nA checker ran the candidate below and it failed:\n${failures || '- the tests did not pass'}\n\nFix the program. Keep the same top-level names. Return the complete corrected answer with one Python block.` },
        { role: 'assistant', content: clip(input.candidate, 6_000) },
        { role: 'user', content: 'Return the corrected complete answer now.' },
      ],
      signal: input.signal,
      temperature: 0.2,
      maxTokens: MAX_OUTPUT_TOKENS,
      onLaneResult: input.onLaneResult,
    })
    const code = extractPython(text)
    return code ? { text, code } : null
  } catch {
    return null
  }
}

/** Small pieces, so a buffered proof answer still streams. */
export async function* streamChunks(text: string, signal?: AbortSignal, pause = 6): AsyncGenerator<StreamPiece> {
  const words = text.match(/\s+|\S+/g) ?? []
  for (let index = 0; index < words.length; index += 3) {
    if (signal?.aborted) return
    yield { type: 'text', text: words.slice(index, index + 3).join('') }
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause))
  }
}

/** A stable signature for the verified-artifact library. */
export function proofSignature(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
}

export { laneKey }
