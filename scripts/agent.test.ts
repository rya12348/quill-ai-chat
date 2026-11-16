import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAgentReceipt, correctDecisionPlan, ensureArtifactPlan, fallbackAgentPlan, isAnalyzeIntent, isBuildRequest, isCanvasRequest, isProviderLimitText, isResearchIntent, isSmallTalk, isUsableAgentAnswer, isWritingRequest, needsBuffyTools, needsCurrentFacts, normalizeAgentPlan, parseAgentPlan, parseAgentReview, proofAnswerIssue, shouldPlanWithModel } from '../src/shared/agent'
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
        { tool: 'proof', title: 'Check', instruction: 'Verify the result.' },
        { tool: 'analyze', title: 'Nope', instruction: 'Unsupported tool.' },
        { tool: 'answer', title: 'Done', instruction: 'Write the answer.' },
      ],
    }),
  )
  assert.ok(plan)
  assert.deepEqual(plan?.map((step) => step.tool), ['research', 'build', 'canvas', 'proof', 'answer'])
  assert.equal(plan?.length, 5)
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
  assert.deepEqual(fallbackAgentPlan('Verify this calculation and double-check the result').map((step) => step.tool), ['proof', 'answer'])
})

test('Buffy escalates only explicit tool work, not bare tool words', () => {
  for (const ordinary of [
    'search for a good pizza recipe',
    'test my knowledge of French history',
    'explain this code',
    'what is a unit test?',
    'write code to reverse a string',
    'how do I search a binary tree?',
    'what is a repository?',
    'search engines are useful',
    'code review best practices',
    'build a test plan',
  ]) {
    assert.equal(needsBuffyTools(ordinary), false, ordinary)
  }

  for (const toolWork of [
    'read the file src/app.ts',
    'run the tests',
    'inspect src/worker/chat.ts',
    'git status',
    'open the terminal',
    'fix the bug in my code',
    'fix the failing test',
    'run the failing tests',
    'read the source file',
    'test this code',
    'search the web for the React docs',
    'search my repo for TODO',
    'npm test',
    'run npm test',
    'read the docs',
    'execute this code',
    'review my code',
    'install the dependencies',
    'deploy the app',
    'read package.json',
  ]) {
    assert.equal(needsBuffyTools(toolWork), true, toolWork)
  }
})

test('parses a strict reviewer verdict and ignores malformed reviews', () => {
  assert.deepEqual(parseAgentReview('{"verdict":"revise","issues":["The total is unsupported."]}'), {
    verdict: 'revise',
    issues: ['The total is unsupported.'],
  })
  assert.deepEqual(parseAgentReview('{"verdict":"pass","issues":[]}'), { verdict: 'pass', issues: [] })
  assert.equal(parseAgentReview('The draft is good.'), undefined)
  assert.equal(parseAgentReview('{"verdict":"maybe"}'), undefined)
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

test('only real proof output can become the final answer', () => {
  const quota =
    'Sorry, to prevent abuse of free resources, accounts that have not been recharged can only try 10 times. You can increase the free quota after recharging; https://console.aihubmix.com/topup'
  const checks = [{ id: 'arithmetic', label: 'The stated arithmetic recomputes', status: 'pass' as const, critical: true }]
  assert.equal(proofAnswerIssue({ status: 'unverified', checks: [] }, '17 × 24 = 408.'), 'no-checks')
  assert.equal(proofAnswerIssue({ status: 'unverified', checks }, quota), 'unusable')
  assert.equal(proofAnswerIssue({ status: 'verified', checks }, '17 × 24 = 408.'), undefined)
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

test('the planner runs for ambiguous decisions but not clear tasks', () => {
  const decision =
    'Should I build a Shopify app or a productized service first? I have about 20 hours a week and want $10k/month.'
  assert.equal(shouldPlanWithModel(decision, fallbackAgentPlan(decision)), true)
  assert.equal(shouldPlanWithModel('Compare the best free CRMs for a small team', fallbackAgentPlan('Compare the best free CRMs for a small team')), true)
  assert.equal(shouldPlanWithModel('Make a snake game in a single page', fallbackAgentPlan('Make a snake game in a single page')), false)
  assert.equal(shouldPlanWithModel('Explain how compound interest works', fallbackAgentPlan('Explain how compound interest works')), false)
})

test('a personal decision does not become research or a build', () => {
  const question = 'Should I build a Shopify app or a service for $10k/month? Be direct.'
  const researchPlan = [
    { tool: 'research' as const, title: 'Market', instruction: 'Research the market.' },
    { tool: 'answer' as const, title: 'Answer', instruction: 'Answer the question.' },
  ]
  assert.deepEqual(correctDecisionPlan(question, researchPlan).map((step) => step.tool), ['answer'])

  const withResearch = 'Should I build a Shopify app? Research the latest pricing and cite sources.'
  assert.deepEqual(correctDecisionPlan(withResearch, researchPlan).map((step) => step.tool), ['research', 'answer'])

  const buildPlan = [
    { tool: 'build' as const, title: 'Mockup', instruction: 'Build a mockup.' },
    { tool: 'answer' as const, title: 'Answer', instruction: 'Answer the question.' },
  ]
  assert.deepEqual(correctDecisionPlan('Should I build a landing page? Build me a mockup.', buildPlan).map((step) => step.tool), ['build', 'answer'])
})

test('modes fall back for greetings and only fire for their own request', () => {
  assert.equal(isSmallTalk('hi'), true)
  assert.equal(isSmallTalk('What can you do?'), true)
  assert.equal(isSmallTalk('hi, make a page'), false)
  assert.equal(isBuildRequest('Make a bakery page'), true)
  assert.equal(isBuildRequest('hi'), false)
  assert.equal(isCanvasRequest('Make flashcards for biology'), true)
  assert.equal(isCanvasRequest('hi'), false)
  assert.equal(isResearchIntent('What is the latest AI news?'), true)
  assert.equal(isResearchIntent('hi'), false)
  assert.equal(isResearchIntent('Make a website'), false)
  assert.equal(isResearchIntent('Create a mock IRR for AP Seminar'), true)
  assert.equal(isAnalyzeIntent('Analyze this data'), true)
  assert.equal(isAnalyzeIntent('hi'), false)
})

test('a writing request is a document, not a live research report', () => {
  assert.equal(isWritingRequest('Create a mock IRR for AP Seminar'), true)
  assert.equal(isWritingRequest('create a moch irr for ap seminar'), true)
  assert.equal(isWritingRequest('Write a practice essay about Hamlet'), true)
  assert.equal(isWritingRequest('Write an essay about Hamlet'), true)
  assert.equal(isWritingRequest('hi'), false)
  assert.equal(isWritingRequest('Calculate the IRR for this project'), false)
  assert.equal(isWritingRequest('Create a mock report page'), false)
  assert.equal(isWritingRequest('What is the IRR in AP Seminar?'), false)
  assert.equal(needsCurrentFacts('Write a report on the latest AI news'), true)
  assert.equal(needsCurrentFacts('Write an essay about Hamlet'), false)
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
  const reviewed = buildAgentReceipt({ status: 'done', steps, startedAt: 0, finishedAt: 12_400, reviewed: true, revised: true })
  assert.match(reviewed, /revised after review/)
})
