import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeMath } from '../src/shared/math'

test('display delimiters become remark-math display math', () => {
  const result = normalizeMath('Speed:\n\n\\[\n\\frac{180}{5} = 36\\ \\text{mph}\n\\]\n')
  assert.ok(result.includes('$$\n\\frac{180}{5} = 36\\ \\text{mph}\n$$'))
  assert.ok(!result.includes('\\['))
})

test('escaped delimiters from a model are recognised too', () => {
  const source = String.raw`\\[` + '\n' + String.raw`\frac{2\!\times\!60}{2+3}` + '\n' + String.raw`\\]`
  const result = normalizeMath(source)
  assert.ok(result.includes(String.raw`\frac{2\!\times\!60}{2+3}`))
  assert.match(result, /\$\$/)
})

test('inline delimiters become inline math', () => {
  assert.equal(normalizeMath(String.raw`the mean \((60+20)/2 = 40\) mph`), 'the mean $(60+20)/2 = 40$ mph')
})

test('inline delimiters with doubled backslashes are recognised', () => {
  assert.equal(normalizeMath(String.raw`the mean \\((60+20)/2 = 40\\) mph`), 'the mean $(60+20)/2 = 40$ mph')
})

test('prices are escaped so they cannot become math', () => {
  assert.equal(normalizeMath('It costs $40-$60.'), 'It costs \\$40-\\$60.')
  assert.equal(normalizeMath('I have $40 and $60.'), 'I have \\$40 and \\$60.')
  assert.equal(normalizeMath('Already \\$40.'), 'Already \\$40.')
})

test('display delimiters are not mistaken for currency', () => {
  assert.equal(normalizeMath('$$40$$'), '$$40$$')
})

test('code spans and fences keep LaTeX source verbatim', () => {
  const source = 'Example:\n\n```latex\n\\[\n\\frac{1}{2}\n\\]\n```\n\nand `\\(x\\)`.'
  const result = normalizeMath(source)
  assert.ok(result.includes('```latex\n\\[\n\\frac{1}{2}\n\\]\n```'))
  assert.ok(result.includes('`\\(x\\)`'))
})
