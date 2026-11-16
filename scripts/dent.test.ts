import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import {
  dentComplete,
  dentPageImprovement,
  dentPageRepairPrompt,
  exactDentAnswer,
  isDentHardTask,
  normalizeDentAnswer,
} from '../src/worker/dent'

test('Dent repair prompt carries the exact checks and complete page data', () => {
  const prompt = dentPageRepairPrompt(
    'Build a tip calculator',
    [{ name: 'index.html', html: '<!doctype html><html><body><h1>Tip</h1></body></html>' }],
    ['No viewport meta tag', 'Every button needs a working action'],
  )
  assert.match(prompt, /No viewport meta tag/)
  assert.match(prompt, /Every button needs a working action/)
  assert.match(prompt, /<!doctype html>/)
  assert.match(prompt, /<!-- page: index.html -->/)
  assert.match(prompt, /Preserve every working control/)
})

test('Dent only accepts a repair that removes a failed check', () => {
  assert.equal(dentPageImprovement({ failures: ['a', 'b'] }, { failures: ['a'] }), true)
  assert.equal(dentPageImprovement({ failures: ['a', 'b'] }, { failures: [] }), true)
  assert.equal(dentPageImprovement({ failures: ['a'] }, { failures: ['b'] }), false)
  assert.equal(dentPageImprovement({ failures: ['a'] }, { failures: ['a'] }), false)
})

test('Dent keeps greetings and simple chat on the fast path', () => {
  assert.equal(isDentHardTask('hi'), false)
  assert.equal(isDentHardTask('what is 2+2?'), false)
  assert.equal(isDentHardTask('implement an LFU cache in Python'), true)
  assert.equal(isDentHardTask('A disease has 1% prevalence. Give the exact fraction.'), true)
})

test('exact-output cleanup removes a forbidden preamble', () => {
  assert.equal(exactDentAnswer('Return only valid JSON.', 'Here you go:\n{"risk":"high","score":80}'), '{"risk":"high","score":80}')
  assert.equal(exactDentAnswer('Answer with one letter only.', 'The answer is B.'), 'B')
  assert.equal(exactDentAnswer('Give a short explanation.', 'A short explanation.'), 'A short explanation.')
})

test('Dent normalizes math notation without rewriting the calculation', () => {
  assert.equal(
    normalizeDentAnswer('Give the exact fraction and percentage.', '\\frac{99}{594} and 16.7\\%'),
    '1/6 and 16.7%',
  )
  assert.equal(normalizeDentAnswer('Return only JSON.', 'Here: {"a":2/4}'), 'Here: {"a":2/4}')
})

test('Dent computes a Bayes result deterministically instead of trusting model arithmetic', () => {
  const answer = normalizeDentAnswer(
    'A disease has 1% prevalence. A test has 99% sensitivity and 95% specificity. What is the probability? Give the exact fraction and percentage.',
    'The answer is 99/694, about 14.3%.',
  )
  assert.match(answer, /\*\*Exact fraction:\*\* 1\/6/)
  assert.match(answer, /\*\*Percentage:\*\* 16\.7%/)
  assert.doesNotMatch(answer, /694/)
})

test('Dent counts a long document exactly', () => {
  const text = Array.from({ length: 240 }, (_, index) => `Row ${index + 1}: the quick brown fox checks the green gate.`).join(' ')
  const expected = [...text].filter((character) => character.toLowerCase() === 'e').length
  assert.equal(
    normalizeDentAnswer(`Count how many times the letter "e" appears. Answer with only the number.\n\nTEXT:\n${text}`, '21560'),
    String(expected),
  )
})

test('Dent sends one draft request and streams the normalized answer', async () => {
  let requests = 0
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      const parsed = JSON.parse(body) as { messages: { role: string; content: string }[] }
      requests += 1
      assert.equal(parsed.messages[0]?.role, 'system')
      const text = '\\frac{99}{594} and 16.7\\%'
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
      response.write('data: [DONE]\n\n')
      response.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  try {
    let answer = ''
    for await (const piece of dentComplete(
      [
        {
          url: `http://127.0.0.1:${address.port}/v1/chat/completions`,
          model: 'deepseek-ai/deepseek-v4.1-flash',
          label: 'DeepSeek V4.1 Flash',
          description: 'test lane',
        },
      ],
      {
        messages: [
          { role: 'system', content: 'You are Dent.' },
          { role: 'user', content: 'A disease has 1% prevalence. Give the exact fraction and percentage.' },
        ],
      },
    )) {
      if (piece.type === 'text') answer += piece.text
    }
    assert.equal(requests, 1)
    assert.match(answer, /1\/6/)
    assert.match(answer, /16\.7%/)
    assert.doesNotMatch(answer, /\\frac/)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})
