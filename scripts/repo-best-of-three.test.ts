import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BEST_OF_THREE_CANDIDATES,
  runBestOfThreeRepoVerifierLoop,
  type RepoCandidate,
} from '../src/shared/repo-best-of-three'
import type { RepoMessage, RepoTools } from '../src/shared/repo-loop'

function candidate(options: {
  id: string
  passes: boolean
  accepted: string[]
  discarded: string[]
  onAccept?: () => void
}): RepoCandidate {
  let source = 'export const value = 1\n'
  const replies = [
    '{"action":"write_file","path":"src/value.js","content":"export const value = 2\\n"}',
    '{"action":"run_tests"}',
    '{"action":"finish","summary":"fixed"}',
  ]
  const tools: RepoTools = {
    listFiles: async () => ['src/value.js'],
    readFile: async () => source,
    writeFile: async (_path, content) => {
      source = content
    },
    runTests: async () => ({
      exitCode: options.passes && source.includes('= 2') ? 0 : 1,
      output: options.passes ? 'passing' : 'failing',
    }),
  }
  return {
    id: options.id,
    tools,
    complete: async (_messages: readonly RepoMessage[]) => {
      const reply = replies.shift()
      if (!reply) throw new Error('unexpected extra completion')
      return reply
    },
    accept: async () => {
      options.onAccept?.()
      options.accepted.push(options.id)
    },
    discard: async () => {
      options.discarded.push(options.id)
    },
  }
}

test('runs three candidates and accepts the first passing one', async () => {
  const accepted: string[] = []
  const discarded: string[] = []
  const result = await runBestOfThreeRepoVerifierLoop({
    task: 'make value two',
    files: ['src/value.js'],
    maxSteps: 3,
    concurrency: 1,
    createCandidate: async (index) =>
      candidate({
        id: `candidate-${index + 1}`,
        passes: index > 0,
        accepted,
        discarded,
      }),
  })

  assert.equal(BEST_OF_THREE_CANDIDATES, 3)
  assert.equal(result.solved, true)
  assert.equal(result.selectedId, 'candidate-2')
  assert.deepEqual(accepted, ['candidate-2'])
  assert.deepEqual(discarded.sort(), ['candidate-1', 'candidate-2', 'candidate-3'])
  assert.equal(result.candidates.length, 3)
  assert.equal(result.candidates[1]?.accepted, true)
  assert.equal(result.modelCalls, 9)
  assert.equal(result.candidates[0]?.result?.solved, false)
  assert.equal(result.candidates[1]?.result?.solved, true)
})

test('does not accept anything when every candidate fails', async () => {
  const accepted: string[] = []
  const discarded: string[] = []
  const result = await runBestOfThreeRepoVerifierLoop({
    task: 'make value two',
    files: ['src/value.js'],
    maxSteps: 3,
    createCandidate: async (index) =>
      candidate({ id: `candidate-${index + 1}`, passes: false, accepted, discarded }),
  })

  assert.equal(result.solved, false)
  assert.equal(result.selectedId, undefined)
  assert.deepEqual(accepted, [])
  assert.deepEqual(discarded.sort(), ['candidate-1', 'candidate-2', 'candidate-3'])
  assert.match(result.summary, /None of the three/)
})

test('rejects the result when applying a passing candidate fails', async () => {
  const accepted: string[] = []
  const discarded: string[] = []
  const result = await runBestOfThreeRepoVerifierLoop({
    task: 'make value two',
    files: ['src/value.js'],
    maxSteps: 3,
    createCandidate: async (index) =>
      candidate({
        id: `candidate-${index + 1}`,
        passes: true,
        accepted,
        discarded,
        onAccept: () => {
          throw new Error('destination tests failed')
        },
      }),
  })

  assert.equal(result.solved, false)
  assert.equal(result.error, 'destination tests failed')
  assert.deepEqual(accepted, [])
  assert.deepEqual(discarded.sort(), ['candidate-1', 'candidate-2', 'candidate-3'])
})
