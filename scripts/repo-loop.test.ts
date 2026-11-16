import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRepoAction, runRepoVerifierLoop, type RepoMessage, type RepoTools } from '../src/shared/repo-loop'

test('parses tool actions from clean or fenced JSON', () => {
  assert.deepEqual(parseRepoAction('{"action":"list_files"}'), { action: 'list_files' })
  assert.deepEqual(parseRepoAction('```json\n{"action":"read_file","path":"src/a.js"}\n```'), {
    action: 'read_file',
    path: 'src/a.js',
  })
  assert.throws(() => parseRepoAction('I will read the file.'), /JSON/)
  assert.throws(() => parseRepoAction('{"action":"read_file","path":"../secret"}'), /relative/)
})

test('inspect, edit, test and finish in a verified loop', async () => {
  let source = 'export const value = 1\n'
  const prompts: string[] = []
  const replies = [
    '{"action":"list_files"}',
    '{"action":"read_file","path":"src/a.js"}',
    '{"action":"write_file","path":"src/a.js","content":"export const value = 2\\n"}',
    '{"action":"run_tests"}',
    '{"action":"finish","summary":"fixed"}',
  ]
  const tools: RepoTools = {
    listFiles: async () => ['package.json', 'src/a.js', 'tests/a.test.js'],
    readFile: async () => source,
    writeFile: async (_path, content) => {
      source = content
    },
    runTests: async () => ({
      exitCode: source.includes('= 2') ? 0 : 1,
      output: source.includes('= 2') ? '1 passing' : 'expected 2',
    }),
  }
  const result = await runRepoVerifierLoop({
    task: 'make value two',
    files: ['src/a.js'],
    tools,
    complete: async (messages: readonly RepoMessage[]) => {
      prompts.push(messages.at(-1)?.content ?? '')
      const reply = replies.shift()
      assert.ok(reply, 'the loop asked for more replies than expected')
      return reply
    },
  })

  assert.equal(result.solved, true)
  assert.equal(result.steps, 5)
  assert.equal(result.modelCalls, 5)
  assert.equal(result.testRuns, 2)
  assert.equal(result.toolCalls, 5)
  assert.equal(result.lastExitCode, 0)
  assert.equal(result.summary, 'fixed')
  assert.equal(source, 'export const value = 2\n')
  assert.match(prompts[0] ?? '', /TASK:/)
})

test('a finish with failing tests is rejected and the loop continues', async () => {
  let calls = 0
  const result = await runRepoVerifierLoop({
    task: 'repair the failure',
    files: ['src/a.js'],
    maxSteps: 3,
    tools: {
      listFiles: async () => ['src/a.js'],
      readFile: async () => 'broken',
      writeFile: async () => undefined,
      runTests: async () => ({ exitCode: 1, output: 'still failing' }),
    },
    complete: async () => {
      calls += 1
      return calls === 1 ? '{"action":"finish"}' : '{"action":"run_tests"}'
    },
  })
  assert.equal(result.solved, false)
  assert.equal(result.steps, 3)
  assert.equal(result.testRuns >= 2, true)
  assert.match(result.lastOutput, /still failing/)
})
