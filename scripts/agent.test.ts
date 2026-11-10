import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAgentReceipt, ensureArtifactPlan, fallbackAgentPlan, isProviderLimitText, isUsableAgentAnswer, normalizeAgentPlan, parseAgentPlan } from '../src/shared/agent'
import type { AgentStep } from '../src/shared/types'

test('parses a fenced plan and always ends with an answer step', () => {
  const raw = [
    '```json',
    '{"steps":[',
    '{"tool":"research","title":"Find sources","instruction":"Find current sources about the topic."},',
    '{"tool":"answer","title":"Write it up","instruction":"Answer the goal with citations."}',
    ']}',
    '```',
  ].join('\n')
  const plan = parseAgentPlan(raw)
  assert.ok(plan)
  assert.deepEqual(plan?.map((step) => step.tool), ['research', 'answer'])
  assert.equal(plan?.[0].title, 'Find sources')
})

test('drops unknown and duplicate tools and caps the run', () => {
  const plan = parseAgentPlan(
    JSON.stringify({
      steps: [
        { tool: 'research', title: 'One', instruction: 'First research task.' },
        { tool: 'research', title: 'Two', instruction: 'Duplicate research task.' },
        { tool: 'build', title: 'Page', instruction: 'Build a page.' },
        { tool: 'canvas', title: 'Deck', instruction: 'Make a deck.' },
        { tool: 'analyze', title: 'Nope', instruction: 'Unsupported tool.' },
        { tool: 'answer', title: 'Done', instruction: 'Write the answer.' },
      ],
    }),
  )
  assert.ok(plan)
  assert.deepEqual(plan?.map((step) => step.tool), ['research', 'build', 'canvas', 'answer'])
  assert.equal(plan?.length, 4)
})

test('an unreadable plan returns undefined so a fallback can run', () => {
  assert.equal(parseAgentPlan('I will research this for you.'), undefined)
  assert.equal(parseAgentPlan('{"steps":[{"tool":"analyze"}]}'), undefined)
})

test('the fallback only adds a tool when the wording asks for one', () => {
  assert.deepEqual(fallbackAgentPlan('Explain how compound interest works').map((step) => step.tool), ['answer'])
  assert.deepEqual(fallbackAgentPlan('Make a snake game in a single page').map((step) => step.tool), ['build', 'answer'])
  assert.deepEqual(fallbackAgentPlan('Research the latest pricing and cite sources').map((step) => step.tool), ['research', 'answer'])
  assert.deepEqual(fallbackAgentPlan('Make flashcards for the French Revolution').map((step) => step.tool), ['canvas', 'answer'])
})

test('a research-plus-artifact request plans both tools without slowing ordinary builds', () => {
  assert.deepEqual(
    fallbackAgentPlan('Research the latest proxy tools and make a proxy page').map((step) => step.tool),
    ['research', 'build', 'answer'],
  )
  assert.deepEqual(
    fallbackAgentPlan('Make a bakery page with price tags').map((step) => step.tool),
    ['build', 'answer'],
  )
})

test('a request to make a proxy plans a build, even if the planner answers directly', () => {
  assert.deepEqual(fallbackAgentPlan('make a proxy').map((step) => step.tool), ['build', 'answer'])
  const direct = [{ tool: 'answer' as const, title: 'Write the answer', instruction: 'Write it.' }]
  assert.deepEqual(ensureArtifactPlan('make a proxy', direct).map((step) => step.tool), ['build', 'answer'])
  assert.deepEqual(ensureArtifactPlan('explain how proxy servers work', direct).map((step) => step.tool), ['answer'])
  const researched = [
    { tool: 'research' as const, title: 'Research', instruction: 'Find options.' },
    { tool: 'answer' as const, title: 'Answer', instruction: 'Write it.' },
  ]
  assert.deepEqual(ensureArtifactPlan('make a proxy', researched).map((step) => step.tool), ['build', 'answer'])
  assert.deepEqual(
    ensureArtifactPlan('research the latest proxies and make a proxy page', researched).map((step) => step.tool),
    ['build', 'research', 'answer'],
  )
})

test('a status word, stub or quota notice is not a usable answer', () => {
  assert.equal(isUsableAgentAnswer('running', true), false)
  assert.equal(isUsableAgentAnswer('Sorry.', false), false)
  assert.equal(isUsableAgentAnswer('Hello!', false), true)
  assert.equal(isUsableAgentAnswer('Too short.', true), false)
  assert.equal(isUsableAgentAnswer('I built **Proxy**. The page is ready and shown below.', true), true)
})

test('normalizing keeps one tool of each kind and the answer', () => {
  const plan = normalizeAgentPlan([
    { tool: 'build', title: 'A', instruction: 'a' },
    { tool: 'build', title: 'B', instruction: 'b' },
    { tool: 'answer', title: 'Answer', instruction: 'c' },
  ])
  assert.deepEqual(plan.map((step) => step.tool), ['build', 'answer'])
  assert.equal(plan[1].title, 'Answer')
})

test('a provider quota notice is not mistaken for an answer', () => {
  assert.equal(
    isProviderLimitText(
      'Sorry, to prevent abuse of free resources, accounts that have not been recharged can only try 10 times. You can increase the free quota after recharging; https://console.aihubmix.com/topup',
    ),
    true,
  )
  assert.equal(isProviderLimitText('Insufficient credits are one reason an API request can fail.'), false)
  assert.equal(isProviderLimitText('A rate limit is a cap a server places on requests over time.'), false)
  assert.equal(isProviderLimitText('The sky looks blue because air scatters short wavelengths of sunlight.'), false)
})

test('the receipt reports what actually ran, failed and was skipped', () => {
  const steps: AgentStep[] = [
    { id: '1', tool: 'research', title: 'Research', instruction: 'x', status: 'done', detail: '5 sources · 4 supported' },
    { id: '2', tool: 'build', title: 'Build', instruction: 'x', status: 'failed', detail: 'No usable page.' },
    { id: '3', tool: 'canvas', title: 'Study', instruction: 'x', status: 'skipped', detail: 'Used up today.' },
    { id: '4', tool: 'answer', title: 'Answer', instruction: 'x', status: 'done' },
  ]
  const receipt = buildAgentReceipt({ status: 'partial', steps, startedAt: 0, finishedAt: 12_400 })
  assert.match(receipt, /^Run partly complete/)
  assert.match(receipt, /1\/3 tools ran/)
  assert.match(receipt, /Research: 5 sources · 4 supported/)
  assert.match(receipt, /1 failed/)
  assert.match(receipt, /1 skipped/)
  assert.match(receipt, /12s$/)
})
