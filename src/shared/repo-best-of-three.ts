import {
  runRepoVerifierLoop,
  type RepoCompletion,
  type RepoLoopEvent,
  type RepoLoopResult,
  type RepoTools,
} from './repo-loop'

export const BEST_OF_THREE_CANDIDATES = 3

/**
 * One isolated attempt. The caller owns the clone and must provide an accept
 * operation that only succeeds after the chosen source has been applied to the
 * real project and its tests have passed there.
 */
export type RepoCandidate = {
  id: string
  tools: RepoTools
  complete: RepoCompletion
  accept: () => Promise<void>
  discard?: () => Promise<void>
}

export type RepoBestOfThreeEvent = {
  candidateId: string
  event: RepoLoopEvent
}

export type RepoBestOfThreeCandidateResult = {
  id: string
  accepted: boolean
  result?: RepoLoopResult
  error?: string
}

export type RepoBestOfThreeInput = {
  task: string
  files: string[]
  createCandidate: (index: number) => Promise<RepoCandidate>
  maxSteps?: number
  /** Number of candidate loops in flight at once; defaults to all three. */
  concurrency?: number
  signal?: AbortSignal
  system?: string
  onEvent?: (event: RepoBestOfThreeEvent) => void
}

export type RepoBestOfThreeResult = {
  solved: boolean
  summary: string
  selectedId?: string
  candidates: RepoBestOfThreeCandidateResult[]
  latencyMs: number
  modelCalls: number
  toolCalls: number
  testRuns: number
  error?: string
}

function failedResult(
  candidates: RepoBestOfThreeCandidateResult[],
  startedAt: number,
  summary: string,
  error?: string,
): RepoBestOfThreeResult {
  return {
    solved: false,
    summary,
    candidates,
    latencyMs: Date.now() - startedAt,
    modelCalls: candidates.reduce((sum, candidate) => sum + (candidate.result?.modelCalls ?? 0), 0),
    toolCalls: candidates.reduce((sum, candidate) => sum + (candidate.result?.toolCalls ?? 0), 0),
    testRuns: candidates.reduce((sum, candidate) => sum + (candidate.result?.testRuns ?? 0), 0),
    ...(error ? { error } : {}),
  }
}

async function discard(candidate: RepoCandidate | undefined): Promise<void> {
  if (!candidate?.discard) return
  await candidate.discard().catch(() => undefined)
}

/**
 * Run three isolated Dent attempts and accept the first one whose final project
 * test run passed. Candidate loops run concurrently; model calls and token use
 * are still three times a single attempt.
 *
 * The candidate's `accept` must be a verified operation, not a blind copy:
 * it is the only bridge between an isolated attempt and the real project.
 */
export async function runBestOfThreeRepoVerifierLoop(
  input: RepoBestOfThreeInput,
): Promise<RepoBestOfThreeResult> {
  const startedAt = Date.now()
  const candidates: RepoCandidate[] = []
  const results: RepoBestOfThreeCandidateResult[] = []

  try {
    for (let index = 0; index < BEST_OF_THREE_CANDIDATES; index += 1) {
      candidates.push(await input.createCandidate(index))
    }
  } catch (error) {
    await Promise.all(candidates.map((candidate) => discard(candidate)))
    return failedResult(
      results,
      startedAt,
      'Could not prepare all three candidate repositories.',
      error instanceof Error ? error.message : String(error),
    )
  }

  const concurrency = Math.max(
    1,
    Math.min(BEST_OF_THREE_CANDIDATES, Math.trunc(input.concurrency ?? BEST_OF_THREE_CANDIDATES)),
  )
  const settled: PromiseSettledResult<{ candidate: RepoCandidate; result: RepoLoopResult }>[] = new Array(
    candidates.length,
  )
  let nextIndex = 0
  const worker = async () => {
    for (;;) {
      const index = nextIndex
      nextIndex += 1
      if (index >= candidates.length) return
      const candidate = candidates[index]
      try {
        const result = await runRepoVerifierLoop({
          task: input.task,
          files: input.files,
          maxSteps: input.maxSteps,
          signal: input.signal,
          system: input.system,
          tools: candidate.tools,
          complete: candidate.complete,
          onEvent: (event) => input.onEvent?.({ candidateId: candidate.id, event }),
        })
        settled[index] = { status: 'fulfilled', value: { candidate, result } }
      } catch (reason) {
        settled[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()))

  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      results.push({ id: outcome.value.candidate.id, accepted: false, result: outcome.value.result })
    } else {
      results.push({
        id: candidates[index]?.id ?? `candidate-${index + 1}`,
        accepted: false,
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      })
    }
  })

  // `lastExitCode === 0` is deliberate: a candidate whose finish call timed out
  // after a green suite is still a candidate patch. `accept` re-runs the tests
  // on the real project before the result is reported as solved.
  const passing = results.find(
    (candidate) => candidate.result && candidate.result.testRuns > 0 && candidate.result.lastExitCode === 0,
  )

  if (!passing) {
    await Promise.all(candidates.map((candidate) => discard(candidate)))
    return failedResult(
      results,
      startedAt,
      'None of the three candidates passed the project tests.',
      'No candidate reached a passing project test run.',
    )
  }

  const selected = candidates.find((candidate) => candidate.id === passing.id)
  try {
    if (!selected) throw new Error('The selected candidate is unavailable.')
    await selected.accept()
    passing.accepted = true
    return {
      solved: true,
      summary: `Candidate ${passing.id} passed the project tests and was accepted.`,
      selectedId: passing.id,
      candidates: results,
      latencyMs: Date.now() - startedAt,
      modelCalls: results.reduce((sum, candidate) => sum + (candidate.result?.modelCalls ?? 0), 0),
      toolCalls: results.reduce((sum, candidate) => sum + (candidate.result?.toolCalls ?? 0), 0),
      testRuns: results.reduce((sum, candidate) => sum + (candidate.result?.testRuns ?? 0), 0),
    }
  } catch (error) {
    return failedResult(
      results,
      startedAt,
      'A passing candidate could not be applied to the project.',
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    await Promise.all(candidates.map((candidate) => discard(candidate)))
  }
}
